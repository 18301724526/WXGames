const TutorialService = require('../services/TutorialService');
const TaskCenterService = require('../services/TaskCenterService');
const EventService = require('../services/EventService');
const GameActionRegistry = require('../actions/GameActionRegistry');
const WorldCombatSessionService = require('../services/worldCombat/WorldCombatSessionService');
const WorldExplorerTrace = require('../services/worldExplorer/WorldExplorerTrace');
const WorldMarchVerification = require('../services/worldExplorer/WorldMarchVerification');

// Interactive world-combat actions are resolved directly here (not via the
// territory/registry pipeline) so the deterministic battle session lives on the
// persisted worldCombat column and flows back through the normal game view.
const WORLD_COMBAT_ACTIONS = new Set(['startWorldCombat', 'resolveWorldCombat']);

function executeWorldCombatAction(action, gameState, body = {}) {
  if (action === 'startWorldCombat') {
    return WorldCombatSessionService.openSession(gameState, {
      missionId: body.missionId,
      formationSlot: body.formationSlot ?? body.slot,
      cityId: body.cityId,
      targetQ: body.targetQ ?? body.q ?? body.x,
      targetR: body.targetR ?? body.r ?? body.y,
    });
  }
  if (action === 'resolveWorldCombat') {
    return WorldCombatSessionService.resolveSession(gameState, {
      battleId: body.battleId,
      inputStream: body.inputStream,
    });
  }
  return { success: false, message: '未知操作', error: 'UNKNOWN_ACTION' };
}

function buildGameView(gameState, tutorial, gameStateService, projection = {}) {
  const clientState = gameStateService.getClientGameStateFromNormalized
    ? gameStateService.getClientGameStateFromNormalized(gameState, projection)
    : gameStateService.getClientGameState(gameState, projection);
  const eraProgress = gameStateService.calculateEraProgressFromNormalized
    ? gameStateService.calculateEraProgressFromNormalized(gameState)
    : gameStateService.calculateEraProgress(gameState);
  const taskCenter = TaskCenterService.getTaskCenter(gameState);
  return {
    gameState: clientState,
    tutorial,
    softGuide: null,
    guideTasks: { visible: false, tasks: [] },
    taskCenter,
    eraProgress,
  };
}

function syncEra2Tutorial(gameState, gameStateService) {
  const tutorial = TutorialService.normalizeTutorialState(gameState.tutorial);
  const eraProgress = gameStateService.calculateEraProgressFromNormalized
    ? gameStateService.calculateEraProgressFromNormalized(gameState)
    : gameStateService.calculateEraProgress(gameState);
  const nextTutorial = TutorialService.maybeActivateEra2Tutorial(tutorial, gameState, eraProgress);
  gameState.tutorial = nextTutorial;
  return nextTutorial;
}

function loadProgressedGameState(repository, gameStateService, playerId, options = {}) {
  const rawState = repository.findByPlayerId(playerId);
  if (!rawState) return null;
  return gameStateService.applyOnlineProgress
    ? gameStateService.applyOnlineProgress(rawState, new Date(), options)
    : gameStateService.normalizeState(rawState);
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

function recordWorldMarchClientReport(repository, gameStateService, playerId, reportPayload = null, now = new Date()) {
  if (!reportPayload || typeof reportPayload !== 'object') return null;
  const batch = WorldMarchVerification.sanitizeReportBatch(reportPayload, now);
  if (!Object.keys(batch.missions || {}).length) return null;
  const gameState = loadReadOnlyGameState(repository, gameStateService, playerId);
  if (!gameState) return null;
  gameState.worldMarchClientReports = batch;
  gameState.updatedAt = now.toISOString();
  repository.save?.(gameState);
  return batch;
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

function isGameStateRevisionConflict(error = {}) {
  return error?.code === 'GAME_STATE_REVISION_CONFLICT';
}

function buildRevisionConflictPayload(error = {}) {
  return {
    success: false,
    error: 'GAME_STATE_REVISION_CONFLICT',
    message: 'Game state changed while processing this action. Please retry.',
    retryable: true,
    expectedRevision: error.expectedRevision ?? null,
    actualRevision: error.actualRevision ?? null,
  };
}

function executeGameActionRequest({
  req,
  repository,
  gameStateService,
  traceEnabled,
  retryAttempt = 0,
}) {
  const planningProjection = loadProjection(repository, req.playerId);
  const gameState = loadProgressedGameState(repository, gameStateService, req.playerId, {
    planningContext: planningProjection,
  });
  if (!gameState) {
    return {
      statusCode: 404,
      payload: { error: 'GAME_STATE_NOT_FOUND', message: '\u6e38\u620f\u72b6\u6001\u4e0d\u5b58\u5728' },
    };
  }

  const tutorial = syncEra2Tutorial(gameState, gameStateService);
  const {
    action,
    target,
    count,
    step,
    eventId,
    optionId,
    territoryId,
    name,
    cityId,
    slot,
    memberIds,
    formationSlot,
    mode,
    targetQ,
    targetR,
    stopQ,
    stopR,
    routeLength,
    q,
    r,
    x,
    y,
    missionId,
    debugTrace,
    worldMarchTrace,
  } = req.body || {};
  let result = { success: false, message: '\u672a\u77e5\u64cd\u4f5c', error: 'UNKNOWN_ACTION' };

  EventService.maybeGenerateRegularEvent(gameState);
  EventService.maybeGenerateThreatEvent(gameState);
  const isWorldCombatAction = WORLD_COMBAT_ACTIONS.has(action);
  if (!isWorldCombatAction && !GameActionRegistry.has(action)) {
    return { statusCode: 400, payload: result };
  }
  const tutorialCheck = TutorialService.validateAction(tutorial, action, {
    target,
    count,
    step,
    eventId,
    optionId,
    territoryId,
    name,
    cityId,
    slot,
    memberIds,
    formationSlot,
    mode,
    targetQ,
    targetR,
    stopQ,
    stopR,
    routeLength,
    q,
    r,
    x,
    y,
    missionId,
    debugTrace,
    worldMarchTrace,
  }, gameState);
  if (!tutorialCheck.allowed) {
    return {
      statusCode: 403,
      payload: { success: false, error: tutorialCheck.code, message: tutorialCheck.message },
    };
  }

  if (traceEnabled) {
    traceWorldMarch('route:beforeExecute', {
      playerId: req.playerId,
      action,
      retryAttempt,
      body: {
        mode,
        targetQ: targetQ ?? q ?? x ?? null,
        targetR: targetR ?? r ?? y ?? null,
        stopQ: stopQ ?? null,
        stopR: stopR ?? null,
        formationSlot: formationSlot ?? slot ?? null,
        missionId: missionId || '',
      },
      beforeMissions: (gameState.exploreMissions || []).map(summarizeMission),
    });
  }
  result = WorldExplorerTrace.run(traceEnabled, () => (
    isWorldCombatAction
      ? executeWorldCombatAction(action, gameState, req.body || {})
      : GameActionRegistry.execute({
        action,
        body: req.body || {},
        gameState,
        tutorial,
        planningContext: planningProjection,
      })
  ));
  if (traceEnabled) {
    traceWorldMarch('route:afterExecute', {
      playerId: req.playerId,
      action,
      retryAttempt,
      result: {
        success: result.success,
        error: result.error || '',
        message: result.message || '',
        mission: summarizeMission(result.mission),
      },
      afterMissions: (gameState.exploreMissions || []).map(summarizeMission),
    });
  }
  const nextTutorial = result.tutorial
    ? TutorialService.normalizeTutorialState(result.tutorial)
    : tutorial;
  gameState.tutorial = nextTutorial;
  const syncedTutorial = syncEra2Tutorial(gameState, gameStateService);
  EventService.maybeGenerateRegularEvent(gameState);
  EventService.maybeGenerateThreatEvent(gameState);
  repository.save(gameState);
  const responsePayload = {
    ...result,
    ...buildGameView(gameState, syncedTutorial, gameStateService, planningProjection),
  };
  if (traceEnabled) {
    traceWorldMarch('route:response', {
      playerId: req.playerId,
      action,
      retryAttempt,
      status: result.success ? 200 : 400,
      mission: summarizeMission(responsePayload.mission),
      worldExplorerState: summarizeWorldExplorerState(responsePayload.gameState?.worldExplorerState),
    });
  }
  return {
    statusCode: result.success ? 200 : 400,
    payload: responsePayload,
  };
}

function registerGameRoutes(app, deps) {
  const { authMiddleware, repository, gameStateService, presenceService } = deps;

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
    const tutorial = TutorialService.normalizeTutorialState(gameState.tutorial);
    const syncTime = new Date().toISOString();
    const responsePayload = {
      ...buildGameView(gameState, tutorial, gameStateService, projection),
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

  const handleHeartbeat = (req, res) => {
    const now = new Date();
    presenceService?.recordHeartbeat?.(req.playerId);
    const clientReport = recordWorldMarchClientReport(
      repository,
      gameStateService,
      req.playerId,
      req.body?.worldMarchClientReport,
      now,
    );
    const verificationState = repository.findByPlayerId?.(req.playerId)?.worldMarchVerification || null;
    if (shouldTraceWorldMarchRequest(req)) {
      traceWorldMarch('route:heartbeat', {
        playerId: req.playerId,
        serverTime: now.toISOString(),
        returnsGameState: false,
        clientReportMissionCount: Object.keys(clientReport?.missions || {}).length,
      });
    }
    return res.json({
      type: 'heartbeat',
      serverTime: now.toISOString(),
      heartbeatSeq: now.getTime(),
      worldMarchVerification: verificationState,
    });
  };
  app.get('/api/game/heartbeat', authMiddleware, handleHeartbeat);
  app.post('/api/game/heartbeat', authMiddleware, handleHeartbeat);

  app.get('/api/game/tasks', authMiddleware, (req, res) => {
    const gameState = loadReadOnlyGameState(repository, gameStateService, req.playerId);
    if (!gameState) {
      return res.status(404).json({ error: 'GAME_STATE_NOT_FOUND', message: '游戏状态不存在' });
    }
    return res.json({
      taskCenter: TaskCenterService.getTaskCenter(gameState, { activeTab: req.query?.tab }),
      syncTime: new Date().toISOString(),
    });
  });

  app.post('/api/game/tasks/claim', authMiddleware, (req, res) => {
    const runClaim = () => {
      const projection = loadProjection(repository, req.playerId);
      const gameState = loadProgressedGameState(repository, gameStateService, req.playerId, {
        planningContext: projection,
      });
      if (!gameState) {
        return { statusCode: 404, payload: { error: 'GAME_STATE_NOT_FOUND', message: '游戏状态不存在' } };
      }

      const tutorial = syncEra2Tutorial(gameState, gameStateService);
      EventService.maybeGenerateRegularEvent(gameState);
      EventService.maybeGenerateThreatEvent(gameState);

      const { taskId, category } = req.body || {};
      const result = TaskCenterService.claimTask(gameState, taskId, category);
      const nextTutorial = result.tutorial
        ? TutorialService.normalizeTutorialState(result.tutorial)
        : TutorialService.normalizeTutorialState(gameState.tutorial || tutorial);
      gameState.tutorial = nextTutorial;
      const syncedTutorial = syncEra2Tutorial(gameState, gameStateService);
      EventService.maybeGenerateRegularEvent(gameState);
      EventService.maybeGenerateThreatEvent(gameState);
      repository.save(gameState);

      return {
        statusCode: result.success ? 200 : 400,
        payload: { ...result, ...buildGameView(gameState, syncedTutorial, gameStateService, projection) },
      };
    };

    // Mirror the /api/game/action contract: a concurrent save can raise a game-state revision
    // conflict, which previously escaped this route as an unhandled 500. Retry once, then fall
    // back to a clean 409 instead of crashing the request.
    try {
      const response = runClaim();
      return res.status(response.statusCode).json(response.payload);
    } catch (error) {
      if (!isGameStateRevisionConflict(error)) throw error;
      try {
        const response = runClaim();
        return res.status(response.statusCode).json(response.payload);
      } catch (retryError) {
        if (!isGameStateRevisionConflict(retryError)) throw retryError;
        return res.status(409).json(buildRevisionConflictPayload(retryError));
      }
    }
  });

  app.post('/api/game/action', authMiddleware, (req, res) => {
    const traceEnabled = shouldTraceWorldMarch(req.body);
    return WorldExplorerTrace.run(traceEnabled, () => {
      try {
        const response = executeGameActionRequest({
          req,
          repository,
          gameStateService,
          traceEnabled,
          retryAttempt: 0,
        });
        return res.status(response.statusCode).json(response.payload);
      } catch (error) {
        if (!isGameStateRevisionConflict(error)) throw error;
        if (traceEnabled) {
          traceWorldMarch('route:revisionConflictRetry', {
            playerId: req.playerId,
            action: req.body?.action || '',
            expectedRevision: error.expectedRevision ?? null,
            actualRevision: error.actualRevision ?? null,
          });
        }
        try {
          const response = executeGameActionRequest({
            req,
            repository,
            gameStateService,
            traceEnabled,
            retryAttempt: 1,
          });
          return res.status(response.statusCode).json(response.payload);
        } catch (retryError) {
          if (!isGameStateRevisionConflict(retryError)) throw retryError;
          return res.status(409).json(buildRevisionConflictPayload(retryError));
        }
      }
    });
  });
}

module.exports = registerGameRoutes;
