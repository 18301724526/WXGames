const TutorialService = require('../services/TutorialService');
const TaskCenterService = require('../services/TaskCenterService');
const EventService = require('../services/EventService');
const TalentPolicyService = require('../services/TalentPolicyService');
const TechTreeService = require('../services/TechTreeService');
const FamousPersonService = require('../services/FamousPersonService');
const AdvanceEraAction = require('../actions/AdvanceEraAction');
const AssignPopulationAction = require('../actions/AssignPopulationAction');
const BuildBuildingAction = require('../actions/BuildBuildingAction');
const ClaimEventAction = require('../actions/ClaimEventAction');
const TerritoryAction = require('../actions/TerritoryAction');

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
    const tutorial = TutorialService.normalizeTutorialState(gameState.tutorial);
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

    const tutorial = TutorialService.normalizeTutorialState(gameState.tutorial);
    gameState.tutorial = tutorial;
    EventService.maybeGenerateRegularEvent(gameState);
    EventService.maybeGenerateThreatEvent(gameState);

    const { taskId, category } = req.body || {};
    const result = TaskCenterService.claimTask(gameState, taskId, category);
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

    const tutorial = TutorialService.normalizeTutorialState(gameState.tutorial);
    const {
      action,
      target,
      count,
      step,
      eventId,
      optionId,
      territoryId,
      cityId,
      soldiers,
      name,
      direction,
      missionId,
      expedition,
      policyId,
      techId,
      tech,
      candidateId,
      personId,
      attribute,
      source,
      basePolicyId,
      tiers,
      policy,
    } = req.body || {};
    let result = { success: false, message: '未知操作', error: 'UNKNOWN_ACTION' };

    gameState.tutorial = tutorial;
    EventService.maybeGenerateRegularEvent(gameState);
    EventService.maybeGenerateThreatEvent(gameState);
    const tutorialCheck = TutorialService.validateAction(tutorial, action, { target, count, step, eventId, optionId }, gameState);
    if (!tutorialCheck.allowed) {
      return res.status(403).json({ success: false, error: tutorialCheck.code, message: tutorialCheck.message });
    }

    if (action === 'build' || action === 'upgrade') {
      result = BuildBuildingAction.execute(action, gameState, tutorial, target);
    } else if (action === 'advanceEra') {
      result = AdvanceEraAction.execute(gameState, tutorial);
    } else if (action === 'claimEvent') {
      result = ClaimEventAction.execute(gameState, tutorial, { eventId, optionId });
    } else if (action === 'assign') {
      result = AssignPopulationAction.execute(gameState, tutorial, { target, count });
    } else if (action === 'applyTalentPolicy') {
      result = TalentPolicyService.applyPolicy(gameState, tutorial, { policyId, basePolicyId, tiers, policy });
    } else if (action === 'saveTalentPolicy') {
      result = TalentPolicyService.saveCustomPolicy(gameState, { policyId, basePolicyId, tiers, policy });
    } else if (action === 'deleteTalentPolicy') {
      result = TalentPolicyService.deleteCustomPolicy(gameState, { policyId });
    } else if (['scoutTerritory', 'claimScout', 'startConquest', 'claimConquest', 'renameCity', 'renamePolity', 'switchCity'].includes(action)) {
      result = TerritoryAction.execute(action, gameState, { territoryId, cityId, soldiers, name, direction, missionId, expedition });
    } else if (action === 'research') {
      result = TechTreeService.research(gameState, techId || target || tech);
    } else if (action === 'seekFamousPerson') {
      result = FamousPersonService.seekFamousPerson(gameState, { source: source || target });
    } else if (action === 'acceptFamousPerson') {
      result = FamousPersonService.acceptFamousPerson(gameState, candidateId || target);
    } else if (action === 'dismissFamousPersonCandidate') {
      result = FamousPersonService.dismissFamousPersonCandidate(gameState, candidateId || target);
    } else if (action === 'assignFamousAttributePoint') {
      result = FamousPersonService.assignAttributePoint(gameState, personId || target, attribute);
    }
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
