const TutorialService = require('../services/TutorialService');
const TaskCenterService = require('../services/TaskCenterService');
const EventService = require('../services/EventService');
const GameActionRegistry = require('../actions/GameActionRegistry');

function buildGameView(gameState, tutorial, gameStateService) {
  const clientState = gameStateService.getClientGameState(gameState);
  const eraProgress = gameStateService.calculateEraProgress(gameState);
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
  const eraProgress = gameStateService.calculateEraProgress(gameState);
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

function registerGameRoutes(app, deps) {
  const { authMiddleware, repository, gameStateService } = deps;

  app.get('/api/game/state', authMiddleware, (req, res) => {
    const gameState = loadProgressedGameState(repository, gameStateService, req.playerId);
    if (!gameState) {
      return res.status(404).json({ error: 'GAME_STATE_NOT_FOUND', message: '游戏状态不存在' });
    }
    const tutorial = syncEra2Tutorial(gameState, gameStateService);
    EventService.maybeGenerateRegularEvent(gameState);
    EventService.maybeGenerateThreatEvent(gameState);
    repository.touchPlayerActiveAt(req.playerId);
    repository.save(gameState);
    return res.json({
      ...buildGameView(gameState, tutorial, gameStateService),
      syncTime: new Date().toISOString(),
    });
  });

  app.get('/api/game/heartbeat', authMiddleware, (req, res) => {
    const now = new Date();
    repository.touchPlayerActiveAt(req.playerId);
    return res.json({
      type: 'heartbeat',
      serverTime: now.toISOString(),
      heartbeatSeq: now.getTime(),
    });
  });

  app.get('/api/game/tasks', authMiddleware, (req, res) => {
    const gameState = loadProgressedGameState(repository, gameStateService, req.playerId);
    if (!gameState) {
      return res.status(404).json({ error: 'GAME_STATE_NOT_FOUND', message: '游戏状态不存在' });
    }
    EventService.maybeGenerateRegularEvent(gameState);
    EventService.maybeGenerateThreatEvent(gameState);
    syncEra2Tutorial(gameState, gameStateService);
    repository.touchPlayerActiveAt(req.playerId);
    repository.save(gameState);
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
    }, gameState);
    if (!tutorialCheck.allowed) {
      return res.status(403).json({ success: false, error: tutorialCheck.code, message: tutorialCheck.message });
    }

    result = GameActionRegistry.execute({ action, body: req.body || {}, gameState, tutorial });
    const nextTutorial = result.tutorial
      ? TutorialService.normalizeTutorialState(result.tutorial)
      : tutorial;
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
}

module.exports = registerGameRoutes;
