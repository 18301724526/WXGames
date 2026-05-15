const TutorialService = require('../services/TutorialService');
const BuildingActionService = require('../services/BuildingActionService');
const { getAdvanceConfig, getEraName } = require('../config/EraConfig');

function deductResources(resources, cost) {
  const next = { ...resources };
  for (const [key, value] of Object.entries(cost || {})) {
    next[key] = Math.max(0, (next[key] || 0) - value);
  }
  return next;
}

function hasEnoughResources(resources, cost) {
  return Object.entries(cost || {}).every(([key, value]) => (resources?.[key] || 0) >= value);
}

function registerGameRoutes(app, deps) {
  const { authMiddleware, repository, gameStateService } = deps;

  app.get('/api/game/state', authMiddleware, (req, res) => {
    const rawState = repository.findByPlayerId(req.playerId);
    if (!rawState) {
      return res.status(404).json({ error: 'GAME_STATE_NOT_FOUND', message: '游戏状态不存在' });
    }
    const gameState = gameStateService.normalizeState(rawState);
    repository.touchPlayerActiveAt(req.playerId);
    repository.save(gameState);
    return res.json({
      gameState: gameStateService.getClientGameState(gameState),
      tutorial: gameState.tutorial,
      eraProgress: gameStateService.calculateEraProgress(gameState),
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
    const { action, target, count, step } = req.body || {};
    let result = { success: false, message: '未知操作', error: 'UNKNOWN_ACTION' };

    if (action === 'tutorialAdvance') {
      tutorial = TutorialService.manualAdvance(tutorial, step);
      gameState.tutorial = tutorial;
      repository.save(gameState);
      return res.json({ success: true, tutorialStep: tutorial.currentStep, tutorial });
    }

    const tutorialCheck = TutorialService.validateAction(tutorial, action, { target, count, step }, gameState);
    if (!tutorialCheck.allowed) {
      return res.status(403).json({ success: false, error: tutorialCheck.code, message: tutorialCheck.message });
    }

    if (action === 'build') {
      result = BuildingActionService.build(gameState, tutorial, target);
      tutorial = result.tutorial || tutorial;
    } else if (action === 'upgrade') {
      result = BuildingActionService.upgrade(gameState, tutorial, target);
      tutorial = result.tutorial || tutorial;
    } else if (action === 'advanceEra') {
      const config = getAdvanceConfig(gameState.currentEra);
      if (!config) {
        result = { success: false, error: 'ERA_MAX_REACHED', message: '已达到当前版本最高时代' };
      } else if (!hasEnoughResources(gameState.resources, config.cost)) {
        result = { success: false, error: 'INSUFFICIENT_RESOURCES', message: '资源不足，无法进阶' };
      } else {
        gameState.resources = deductResources(gameState.resources, config.cost);
        gameState.currentEra = config.nextEra;
        gameState.eraHistory.push({ era: config.nextEra, advancedAt: new Date().toISOString() });
        tutorial = TutorialService.advanceTutorial(tutorial, 'eraAdvanced');
        result = {
          success: true,
          message: `已进入${getEraName(config.nextEra)}`,
          currentEra: config.nextEra,
          tutorial,
        };
      }
    } else if (action === 'assign') {
      const amount = Number.parseInt(count, 10) || 0;
      const mapping = { farmer: 'farmers', scholar: 'scholars', craftsman: 'craftsmen' };
      const key = mapping[target];
      if (!key || !amount) {
        result = { success: false, error: 'INVALID_ASSIGNMENT', message: '人口分配参数错误' };
      } else if (amount > 0) {
        if (gameState.population.unassigned < amount) {
          result = { success: false, error: 'INSUFFICIENT_POPULATION', message: '可分配人口不足' };
        } else {
          gameState.population.unassigned -= amount;
          gameState.population[key] += amount;
          result = { success: true, message: `已分配 ${amount} 名${target}` };
        }
      } else {
        const absAmount = Math.abs(amount);
        if (gameState.population[key] < absAmount) {
          result = { success: false, error: 'INSUFFICIENT_POPULATION', message: '职业人口不足' };
        } else {
          gameState.population[key] -= absAmount;
          gameState.population.unassigned += absAmount;
          result = { success: true, message: `已撤回 ${absAmount} 名${target}` };
        }
      }
    } else if (action === 'research') {
      result = { success: false, error: 'NOT_IMPLEMENTED', message: '首期未重构科技研发，请稍后再试' };
    }

    gameState.tutorial = tutorial;
    repository.save(gameState);
    const clientState = gameStateService.getClientGameState(gameState);
    return res.status(result.success ? 200 : 400).json({
      ...result,
      gameState: clientState,
      tutorial,
      eraProgress: gameStateService.calculateEraProgress(gameState),
    });
  });
}

module.exports = registerGameRoutes;
