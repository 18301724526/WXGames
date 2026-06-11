const TutorialService = require('../services/TutorialService');
const TaskCenterService = require('../services/TaskCenterService');
const EventService = require('../services/EventService');
const GameActionRegistry = require('../actions/GameActionRegistry');
const WorldExplorerTrace = require('../services/worldExplorer/WorldExplorerTrace');

function buildGameView(gameState, tutorial, gameStateService) {
  const clientState = gameStateService.getClientGameStateFromNormalized
    ? gameStateService.getClientGameStateFromNormalized(gameState)
    : gameStateService.getClientGameState(gameState);
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

function loadProgressedGameState(repository, gameStateService, playerId) {
  const rawState = repository.findByPlayerId(playerId);
  if (!rawState) return null;
  return gameStateService.applyOnlineProgress
    ? gameStateService.applyOnlineProgress(rawState)
    : gameStateService.normalizeState(rawState);
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

function summarizeCoord(coord = {}) {
  if (!coord || typeof coord !== 'object') return null;
  const q = Number(coord.q ?? coord.x ?? 0);
  const r = Number(coord.r ?? coord.y ?? 0);
  return {
    q,
    r,
    tileId: coord.tileId || `tile_${q}_${r}`,
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
    routeIds: route.slice(0, 8).map((step) => step.tileId || `tile_${step.q}_${step.r}`),
    plannedTileCount: plannedTiles.length,
    plannedTileIds: plannedTiles.slice(0, 8).map((tile) => tile.id || `tile_${tile.q}_${tile.r}`),
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
    readyCount: Array.isArray(worldExplorerState?.readyMissions) ? worldExplorerState.readyMissions.length : 0,
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

function registerGameRoutes(app, deps) {
  const { authMiddleware, repository, gameStateService, presenceService } = deps;

  app.get('/api/game/state', authMiddleware, (req, res) => {
    const traceEnabled = shouldTraceWorldMarchRequest(req);
    return WorldExplorerTrace.run(traceEnabled, () => {
    const gameState = loadReadOnlyGameState(repository, gameStateService, req.playerId);
    if (!gameState) {
      return res.status(404).json({ error: 'GAME_STATE_NOT_FOUND', message: '游戏状态不存在' });
    }
    if (traceEnabled) {
      traceWorldMarch('route:state:loaded', {
        playerId: req.playerId,
        missions: (gameState.exploreMissions || []).map(summarizeMission),
      });
    }
    const tutorial = TutorialService.normalizeTutorialState(gameState.tutorial);
    const responsePayload = {
      ...buildGameView(gameState, tutorial, gameStateService),
      syncTime: new Date().toISOString(),
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

  app.get('/api/game/heartbeat', authMiddleware, (req, res) => {
    const now = new Date();
    presenceService?.recordHeartbeat?.(req.playerId);
    if (shouldTraceWorldMarchRequest(req)) {
      traceWorldMarch('route:heartbeat', {
        playerId: req.playerId,
        serverTime: now.toISOString(),
        returnsGameState: false,
      });
    }
    return res.json({
      type: 'heartbeat',
      serverTime: now.toISOString(),
      heartbeatSeq: now.getTime(),
    });
  });

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
    const gameState = loadProgressedGameState(repository, gameStateService, req.playerId);
    if (!gameState) {
      return res.status(404).json({ error: 'GAME_STATE_NOT_FOUND', message: '游戏状态不存在' });
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

    return res.status(result.success ? 200 : 400).json({
      ...result,
      ...buildGameView(gameState, syncedTutorial, gameStateService),
    });
  });

  app.post('/api/game/action', authMiddleware, (req, res) => {
    const traceEnabled = shouldTraceWorldMarch(req.body);
    return WorldExplorerTrace.run(traceEnabled, () => {
    const gameState = loadProgressedGameState(repository, gameStateService, req.playerId);
    if (!gameState) {
      return res.status(404).json({ error: 'GAME_STATE_NOT_FOUND', message: '游戏状态不存在' });
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
    let result = { success: false, message: '未知操作', error: 'UNKNOWN_ACTION' };

    EventService.maybeGenerateRegularEvent(gameState);
    EventService.maybeGenerateThreatEvent(gameState);
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
      return res.status(403).json({ success: false, error: tutorialCheck.code, message: tutorialCheck.message });
    }

    if (traceEnabled) {
      traceWorldMarch('route:beforeExecute', {
        playerId: req.playerId,
        action,
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
      GameActionRegistry.execute({ action, body: req.body || {}, gameState, tutorial })
    ));
    if (traceEnabled) {
      traceWorldMarch('route:afterExecute', {
        playerId: req.playerId,
        action,
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
      ...buildGameView(gameState, syncedTutorial, gameStateService),
    };
    if (traceEnabled) {
      traceWorldMarch('route:response', {
        playerId: req.playerId,
        action,
        status: result.success ? 200 : 400,
        mission: summarizeMission(responsePayload.mission),
        worldExplorerState: summarizeWorldExplorerState(responsePayload.gameState?.worldExplorerState),
      });
    }
    return res.status(result.success ? 200 : 400).json({
      ...responsePayload,
    });
    });
  });
}

module.exports = registerGameRoutes;
