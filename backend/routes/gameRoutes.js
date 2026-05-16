const TutorialService = require('../services/TutorialService');
const AdvanceEraAction = require('../actions/AdvanceEraAction');
const AssignPopulationAction = require('../actions/AssignPopulationAction');
const BuildBuildingAction = require('../actions/BuildBuildingAction');
const ClaimEventAction = require('../actions/ClaimEventAction');

function registerGameRoutes(app, deps) {
  const { authMiddleware, repository, gameStateService } = deps;

  app.get('/api/game/state', authMiddleware, (req, res) => {
    const rawState = repository.findByPlayerId(req.playerId);
    if (!rawState) {
      return res.status(404).json({ error: 'GAME_STATE_NOT_FOUND', message: '游戏状态不存在' });
    }
    const gameState = gameStateService.normalizeState(rawState);
    let tutorial = TutorialService.normalizeTutorialState(gameState.tutorial);
    const eraProgress = gameStateService.calculateEraProgress(gameState);
    tutorial = TutorialService.maybeActivateEra2Tutorial(tutorial, gameState, eraProgress);
    gameState.tutorial = tutorial;
    TutorialService.ensureLumbermillGuideResources(tutorial, gameState);
    repository.touchPlayerActiveAt(req.playerId);
    repository.save(gameState);
    return res.json({
      gameState: gameStateService.getClientGameState(gameState),
      tutorial,
      eraProgress,
      syncTime: new Date().toISOString(),
    });
  });

  app.post('/api/game/action', authMiddleware, (req, res) => {
    const rawState = repository.findByPlayerId(req.playerId);
    if (!rawState) {
      return res.status(404).json({ error: 'GAME_STATE_NOT_FOUND', message: '游戏状态不存在' });
    }

    const gameState = gameStateService.normalizeState(rawState);
    let tutorial = TutorialService.normalizeTutorialState(gameState.tutorial);
    const { action, target, count, step, eventId, optionId } = req.body || {};
    let result = { success: false, message: '未知操作', error: 'UNKNOWN_ACTION' };

    if (action === 'tutorialAdvance') {
      tutorial = TutorialService.manualAdvance(tutorial, step);
      gameState.tutorial = tutorial;
      repository.save(gameState);
      return res.json({ success: true, tutorialStep: tutorial.currentStep, tutorial });
    }

    let eraProgress = gameStateService.calculateEraProgress(gameState);
    tutorial = TutorialService.maybeActivateEra2Tutorial(tutorial, gameState, eraProgress);
    const tutorialCheck = TutorialService.validateAction(tutorial, action, { target, count, step, eventId, optionId }, gameState);
    if (!tutorialCheck.allowed) {
      return res.status(403).json({ success: false, error: tutorialCheck.code, message: tutorialCheck.message });
    }

    if (action === 'build' || action === 'upgrade') {
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
    } else if (action === 'research') {
      result = { success: false, error: 'NOT_IMPLEMENTED', message: '首期未重构科技研发，请稍后再试' };
    }
    gameState.tutorial = tutorial;
    eraProgress = gameStateService.calculateEraProgress(gameState);
    tutorial = TutorialService.maybeActivateEra2Tutorial(tutorial, gameState, eraProgress);
    gameState.tutorial = tutorial;
    TutorialService.ensureLumbermillGuideResources(tutorial, gameState);
    repository.save(gameState);
    const clientState = gameStateService.getClientGameState(gameState);
    eraProgress = gameStateService.calculateEraProgress(gameState);
    return res.status(result.success ? 200 : 400).json({
      ...result,
      gameState: clientState,
      tutorial,
      eraProgress,
    });
  });
}

module.exports = registerGameRoutes;
