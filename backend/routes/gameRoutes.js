const TutorialService = require('../services/TutorialService');
const SoftGuideService = require('../services/SoftGuideService');
const GuideTaskService = require('../services/GuideTaskService');
const TaskCenterService = require('../services/TaskCenterService');
const EventService = require('../services/EventService');
const AdvanceEraAction = require('../actions/AdvanceEraAction');
const AssignPopulationAction = require('../actions/AssignPopulationAction');
const BuildBuildingAction = require('../actions/BuildBuildingAction');
const ClaimEventAction = require('../actions/ClaimEventAction');
const TerritoryAction = require('../actions/TerritoryAction');

function buildGameView(gameState, tutorial, gameStateService) {
  const clientState = gameStateService.getClientGameState(gameState);
  const eraProgress = gameStateService.calculateEraProgress(gameState);
  const guideTasks = GuideTaskService.getGuideTasks(gameState);
  const taskCenter = TaskCenterService.getTaskCenter(gameState);
  const softGuide = GuideTaskService.getGuide(gameState) || SoftGuideService.getSoftGuide(gameState, eraProgress);
  return {
    gameState: clientState,
    tutorial,
    softGuide,
    guideTasks,
    taskCenter,
    eraProgress,
  };
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
    let tutorial = TutorialService.normalizeTutorialState(gameState.tutorial);
    let eraProgress = gameStateService.calculateEraProgress(gameState);
    tutorial = TutorialService.maybeActivateEra2Tutorial(tutorial, gameState, eraProgress);
    gameState.tutorial = tutorial;
    EventService.maybeGenerateRegularEvent(gameState);
    EventService.maybeGenerateThreatEvent(gameState);
    repository.touchPlayerActiveAt(req.playerId);
    repository.save(gameState);
    return res.json({
      ...buildGameView(gameState, tutorial, gameStateService),
      syncTime: new Date().toISOString(),
    });
  });

  app.get('/api/game/tasks', authMiddleware, (req, res) => {
    const gameState = loadProgressedGameState(repository, gameStateService, req.playerId);
    if (!gameState) {
      return res.status(404).json({ error: 'GAME_STATE_NOT_FOUND', message: '游戏状态不存在' });
    }
    EventService.maybeGenerateRegularEvent(gameState);
    EventService.maybeGenerateThreatEvent(gameState);
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

    let tutorial = TutorialService.normalizeTutorialState(gameState.tutorial);
    let eraProgress = gameStateService.calculateEraProgress(gameState);
    tutorial = TutorialService.maybeActivateEra2Tutorial(tutorial, gameState, eraProgress);
    gameState.tutorial = tutorial;
    EventService.maybeGenerateRegularEvent(gameState);
    EventService.maybeGenerateThreatEvent(gameState);

    const { taskId, category } = req.body || {};
    const guideTaskCheck = GuideTaskService.validateAction(gameState, 'claimGuideTaskReward', { target: taskId });
    if (!guideTaskCheck.allowed) {
      return res.status(403).json({ success: false, error: guideTaskCheck.code, message: guideTaskCheck.message });
    }

    const result = TaskCenterService.claimTask(gameState, taskId, category);
    gameState.tutorial = tutorial;
    eraProgress = gameStateService.calculateEraProgress(gameState);
    tutorial = TutorialService.maybeActivateEra2Tutorial(tutorial, gameState, eraProgress);
    gameState.tutorial = tutorial;
    EventService.maybeGenerateRegularEvent(gameState);
    EventService.maybeGenerateThreatEvent(gameState);
    repository.save(gameState);

    return res.status(result.success ? 200 : 400).json({
      ...result,
      ...buildGameView(gameState, tutorial, gameStateService),
    });
  });

  app.post('/api/game/action', authMiddleware, (req, res) => {
    const gameState = loadProgressedGameState(repository, gameStateService, req.playerId);
    if (!gameState) {
      return res.status(404).json({ error: 'GAME_STATE_NOT_FOUND', message: '游戏状态不存在' });
    }

    let tutorial = TutorialService.normalizeTutorialState(gameState.tutorial);
    const { action, target, count, step, eventId, optionId, territoryId, cityId, soldiers, name, direction, missionId } = req.body || {};
    let result = { success: false, message: '未知操作', error: 'UNKNOWN_ACTION' };

    if (action === 'tutorialAdvance') {
      tutorial = TutorialService.manualAdvance(tutorial, step);
      gameState.tutorial = tutorial;
      repository.save(gameState);
      return res.json({ success: true, tutorialStep: tutorial.currentStep, tutorial });
    }

    let eraProgress = gameStateService.calculateEraProgress(gameState);
    tutorial = TutorialService.maybeActivateEra2Tutorial(tutorial, gameState, eraProgress);
    gameState.tutorial = tutorial;
    EventService.maybeGenerateRegularEvent(gameState);
    EventService.maybeGenerateThreatEvent(gameState);
    const tutorialCheck = TutorialService.validateAction(tutorial, action, { target, count, step, eventId, optionId }, gameState);
    if (!tutorialCheck.allowed) {
      return res.status(403).json({ success: false, error: tutorialCheck.code, message: tutorialCheck.message });
    }
    const guideTaskCheck = GuideTaskService.validateAction(gameState, action, { target, count, step, eventId, optionId, direction, missionId, cityId });
    if (!guideTaskCheck.allowed) {
      return res.status(403).json({ success: false, error: guideTaskCheck.code, message: guideTaskCheck.message });
    }

    if (action === 'claimGuideTaskReward') {
      result = GuideTaskService.claimReward(gameState, target);
    } else if (action === 'build' || action === 'upgrade') {
      result = BuildBuildingAction.execute(action, gameState, tutorial, target);
      tutorial = result.tutorial || tutorial;
    } else if (action === 'advanceEra') {
      result = AdvanceEraAction.execute(gameState, tutorial);
      tutorial = result.tutorial || tutorial;
    } else if (action === 'claimEvent') {
      result = ClaimEventAction.execute(gameState, tutorial, { eventId, optionId });
      tutorial = result.tutorial || tutorial;
    } else if (action === 'assign') {
      result = AssignPopulationAction.execute(gameState, tutorial, { target, count });
      tutorial = result.tutorial || tutorial;
    } else if (['scoutTerritory', 'claimScout', 'startConquest', 'claimConquest', 'renameCity', 'renamePolity', 'switchCity'].includes(action)) {
      result = TerritoryAction.execute(action, gameState, { territoryId, cityId, soldiers, name, direction, missionId });
    } else if (action === 'research') {
      result = { success: false, error: 'NOT_IMPLEMENTED', message: '首期未重构科技研发，请稍后再试' };
    }
    gameState.tutorial = tutorial;
    eraProgress = gameStateService.calculateEraProgress(gameState);
    tutorial = TutorialService.maybeActivateEra2Tutorial(tutorial, gameState, eraProgress);
    gameState.tutorial = tutorial;
    EventService.maybeGenerateRegularEvent(gameState);
    EventService.maybeGenerateThreatEvent(gameState);
    repository.save(gameState);
    return res.status(result.success ? 200 : 400).json({
      ...result,
      ...buildGameView(gameState, tutorial, gameStateService),
    });
  });
}

module.exports = registerGameRoutes;
