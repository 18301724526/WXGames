const TutorialService = require('../services/TutorialService');
const EventService = require('../services/EventService');
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

function applyEraKnowledgeBonus(gameState, nextEra) {
  const eraKnowledgeBonus = { 1: 5 };
  const bonus = eraKnowledgeBonus[nextEra] || 0;
  if (bonus > 0) {
    gameState.resources.knowledge = (gameState.resources.knowledge || 0) + bonus;
  }
}

function welcomeSettlementResident(gameState, nextEra) {
  if (nextEra !== 2) return;
  const population = gameState.population || {};
  const maxPopulation = population.max || population.maxPop || 0;
  if ((population.unassigned || 0) > 0) return;
  if ((population.total || 0) >= maxPopulation) return;
  population.total = (population.total || 0) + 1;
  population.unassigned = (population.unassigned || 0) + 1;
  population.max = maxPopulation;
  population.maxPop = maxPopulation;
  gameState.population = population;
}

function execute(gameState, tutorial) {
  const config = getAdvanceConfig(gameState.currentEra);
  if (!config) {
    return { success: false, error: 'ERA_MAX_REACHED', message: '已达到当前版本最高时代', tutorial };
  }
  if (!hasEnoughResources(gameState.resources, config.cost)) {
    return { success: false, error: 'INSUFFICIENT_RESOURCES', message: '资源不足，无法进阶', tutorial };
  }

  gameState.resources = deductResources(gameState.resources, config.cost);
  gameState.currentEra = config.nextEra;
  applyEraKnowledgeBonus(gameState, config.nextEra);
  welcomeSettlementResident(gameState, config.nextEra);
  gameState.eraHistory.push({ era: config.nextEra, advancedAt: new Date().toISOString() });

  let nextTutorial = tutorial;
  if (config.nextEra === 2) {
    EventService.generateSpecialEvent(gameState, config.nextEra);
    nextTutorial = TutorialService.advanceTutorial(tutorial, 'eraAdvancedTo2');
  } else {
    nextTutorial = TutorialService.advanceTutorial(tutorial, 'eraAdvanced');
  }

  return {
    success: true,
    message: `已进入${getEraName(config.nextEra)}`,
    currentEra: config.nextEra,
    tutorial: nextTutorial,
  };
}

module.exports = {
  execute,
};
