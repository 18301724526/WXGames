const TaskCenterService = require('../services/TaskCenterService');
const WorldExplorerTrace = require('../services/worldExplorer/WorldExplorerTrace');
const { prepareCommandEntry, sendCommandEntryError } = require('../application/commands/CommandEntryContext');
const GameActionProjection = require('../application/projections/GameActionProjection');

const WORLD_COMBAT_ACTIONS = new Set(['startWorldCombat', 'resolveWorldCombat']);

function buildGameView(gameState, gameStateService, projection = {}) {
  return GameActionProjection.buildGameActionView(gameState, gameStateService, projection);
}

function loadProjection(repository, playerId) {
  return repository.getClientProjectionForPlayer?.(playerId) || {};
}

function loadReadOnlyGameState(repository, gameStateService, playerId) {
  const rawState = repository.findByPlayerId(playerId);
  if (!rawState) return null;
  return gameStateService.normalizeState
    ? gameStateService.normalizeState(rawState)
    : rawState;
}

function shouldTraceWorldMarch(body = {}) {
  return Boolean(body?.debugTrace || body?.worldMarchTrace);
}

function shouldTraceWorldMarchRequest(req) {
  return shouldTraceWorldMarch(req.body) || req.get?.('X-World-March-Trace') === '1';
}

function hasCoordinate(source = {}) {
  return source && typeof source === 'object'
    && (source.q !== undefined || source.x !== undefined || source.r !== undefined || source.y !== undefined);
}

function getTraceTileId(source = {}) {
  const q = Number(source.q ?? source.x ?? 0);
  const r = Number(source.r ?? source.y ?? 0);
  if (hasCoordinate(source)) return `tile_${q}_${r}`;
  return source.tileId || source.id || '';
}

function summarizeCoord(coord = {}) {
  if (!coord || typeof coord !== 'object') return null;
  const q = Number(coord.q ?? coord.x ?? 0);
  const r = Number(coord.r ?? coord.y ?? 0);
  return {
    q,
    r,
    tileId: getTraceTileId(coord),
  };
}

function summarizeMission(mission = null) {
  if (!mission || typeof mission !== 'object') return null;
  const route = Array.isArray(mission.route) ? mission.route : [];
  const plannedTiles = Array.isArray(mission.plannedTiles) ? mission.plannedTiles : [];
  const plannedSites = Array.isArray(mission.plannedSites) ? mission.plannedSites : [];
  const revealedTileIds = Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds : [];
  return {
    id: mission.id || '',
    mode: mission.mode || '',
    status: mission.status || '',
    origin: summarizeCoord(mission.origin),
    target: summarizeCoord(mission.target),
    position: summarizeCoord(mission.position),
    routeCount: route.length,
    routeIds: route.slice(0, 8).map((step) => getTraceTileId(step)),
    plannedTileCount: plannedTiles.length,
    plannedTileIds: plannedTiles.slice(0, 8).map((tile) => getTraceTileId(tile)),
    plannedSiteCount: plannedSites.length,
    plannedSiteIds: plannedSites.slice(0, 8).map((site) => site.siteId || site.site?.id || site.tileId),
    revealedTileCount: revealedTileIds.length,
    revealedTileIds: revealedTileIds.slice(0, 8),
    stepDurationMs: mission.stepDurationMs || null,
    stepDurationSeconds: mission.stepDurationSeconds || null,
    startedAt: mission.startedAt || '',
    nextStepAt: mission.nextStepAt || '',
    completesAt: mission.completesAt || '',
  };
}

function summarizeWorldExplorerState(worldExplorerState = {}) {
  const missions = Array.isArray(worldExplorerState?.missions) ? worldExplorerState.missions : [];
  return {
    missionCount: missions.length,
    activeMission: summarizeMission(worldExplorerState?.activeMission),
    missionIds: missions.slice(0, 8).map((mission) => `${mission.id}:${mission.status}`),
    idleCount: Array.isArray(worldExplorerState?.idleMissions) ? worldExplorerState.idleMissions.length : 0,
    busyFormations: Array.isArray(worldExplorerState?.busyFormations) ? worldExplorerState.busyFormations.slice(0, 8) : [],
  };
}

function traceWorldMarch(stage, payload = {}) {
  try {
    console.info('[WorldMarchTrace:server]', stage, {
      at: new Date().toISOString(),
      ...payload,
    });
  } catch (_) {}
}

function isTaskDefinitionRuntimeError(error = {}) {
  return error?.code === 'TASK_DEFINITIONS_RUNTIME_NOT_READY'
    || error?.code === 'TASK_DEFINITIONS_SOURCE_OVERRIDE_DISABLED';
}

function buildTaskDefinitionRuntimePayload(error = {}) {
  return {
    success: false,
    error: error.code || 'TASK_DEFINITIONS_RUNTIME_ERROR',
    message: error.message || '任务定义运行时不可用',
  };
}

function registerGameRoutes(app, deps) {
  const {
    authMiddleware,
    repository,
    gameStateService,
    presenceService,
    commandEntryReporter,
    commandExecutionPipeline,
    commandDefinitionFactory,
  } = deps;

  app.get('/api/game/state', authMiddleware, (req, res) => {
    const traceEnabled = shouldTraceWorldMarchRequest(req);
    return WorldExplorerTrace.run(traceEnabled, () => {
    const gameState = loadReadOnlyGameState(repository, gameStateService, req.playerId);
    if (!gameState) {
      return res.status(404).json({ error: 'GAME_STATE_NOT_FOUND', message: '游戏状态不存在' });
    }
    const projection = loadProjection(repository, req.playerId);
    if (traceEnabled) {
      traceWorldMarch('route:state:loaded', {
        playerId: req.playerId,
        missions: (gameState.exploreMissions || []).map(summarizeMission),
      });
    }
    const syncTime = new Date().toISOString();
    const responsePayload = {
      ...buildGameView(gameState, gameStateService, projection),
      syncTime,
      serverTime: syncTime,
    };
    if (traceEnabled) {
      traceWorldMarch('route:state:response', {
        playerId: req.playerId,
        worldExplorerState: summarizeWorldExplorerState(responsePayload.gameState?.worldExplorerState),
        worldMapTileCount: Array.isArray(responsePayload.gameState?.territoryState?.worldMap?.tiles)
          ? responsePayload.gameState.territoryState.worldMap.tiles.length
          : 0,
      });
    }
    return res.json(responsePayload);
    });
  });

  const readHeartbeat = (req, res) => {
    const now = new Date();
    presenceService?.recordHeartbeat?.(req.playerId);
    const verificationState = repository.findByPlayerId?.(req.playerId)?.worldMarchVerification || null;
    if (shouldTraceWorldMarchRequest(req)) {
      traceWorldMarch('route:heartbeat:read', {
        playerId: req.playerId,
        serverTime: now.toISOString(),
        returnsGameState: false,
      });
    }
    return res.json({
      type: 'heartbeat',
      serverTime: now.toISOString(),
      heartbeatSeq: now.getTime(),
      worldMarchVerification: verificationState,
    });
  };
  app.get('/api/game/heartbeat', authMiddleware, readHeartbeat);
  app.post('/api/game/heartbeat', authMiddleware, (req, res) => {
    const commandEntry = prepareCommandEntry(req, {
      type: 'heartbeat',
      inventoryId: req.body?.worldMarchClientReport
        ? 'server:game-heartbeat-client-report'
        : 'server:game-heartbeat-march-settlement',
      reporter: commandEntryReporter,
      mode: 'blocking',
      requireClientIds: true,
      requireOwner: true,
    });
    if (!commandEntry.ok) return sendCommandEntryError(res, commandEntry);
    presenceService?.recordHeartbeat?.(req.playerId);
    const response = commandExecutionPipeline.execute(
      commandEntry.envelope,
      commandDefinitionFactory.createHeartbeatDefinition({
        traceEnabled: shouldTraceWorldMarchRequest(req),
      }),
      { scope: 'heartbeat' },
    );
    return res.status(response.statusCode).json(response.payload);
  });

  app.get('/api/game/tasks', authMiddleware, (req, res) => {
    const gameState = loadReadOnlyGameState(repository, gameStateService, req.playerId);
    if (!gameState) {
      return res.status(404).json({ error: 'GAME_STATE_NOT_FOUND', message: '游戏状态不存在' });
    }
    try {
      return res.json({
        taskCenter: TaskCenterService.getTaskCenter(gameState, { activeTab: req.query?.tab }),
        syncTime: new Date().toISOString(),
      });
    } catch (error) {
      if (isTaskDefinitionRuntimeError(error)) {
        return res.status(503).json(buildTaskDefinitionRuntimePayload(error));
      }
      throw error;
    }
  });

  app.post('/api/game/tasks/claim', authMiddleware, (req, res) => {
    const commandEntry = prepareCommandEntry(req, {
      type: 'claimTaskReward',
      inventoryId: 'server:game-tasks-claim',
      reporter: commandEntryReporter,
      mode: 'blocking',
      requireClientIds: true,
      requireOwner: true,
    });
    if (!commandEntry.ok) return sendCommandEntryError(res, commandEntry);
    const response = commandExecutionPipeline.execute(
      commandEntry.envelope,
      commandDefinitionFactory.createTaskClaimDefinition(),
      { scope: 'task-claim' },
    );
    return res.status(response.statusCode).json(response.payload);
  });

  app.post('/api/game/action', authMiddleware, (req, res) => {
    const action = req.body?.action || '';
    const commandEntry = prepareCommandEntry(req, {
      type: action,
      inventoryId: WORLD_COMBAT_ACTIONS.has(action)
        ? 'server:game-action-world-combat-bypass'
        : (action === 'build'
          ? 'server:game-action-build-handler'
          : 'server:game-action-registry'),
      reporter: commandEntryReporter,
      mode: 'blocking',
      requireClientIds: true,
      requireOwner: true,
    });
    if (!commandEntry.ok) return sendCommandEntryError(res, commandEntry);

    const traceEnabled = shouldTraceWorldMarch(req.body);
    const definition = WORLD_COMBAT_ACTIONS.has(action)
      ? commandDefinitionFactory.createWorldCombatDefinition({ traceEnabled })
      : commandDefinitionFactory.createGameActionDefinition(action, { traceEnabled });
    const response = commandExecutionPipeline.execute(
      commandEntry.envelope,
      definition,
      { scope: `game-action:${action || 'unknown'}` },
    );
    return res.status(response.statusCode).json(response.payload);
  });
}

module.exports = registerGameRoutes;
