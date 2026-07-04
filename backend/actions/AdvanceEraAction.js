const TutorialService = require('../services/TutorialService');
const EventService = require('../services/EventService');
const { EraConfig } = require('../services/config/GameplayConfigRuntime');
const BuildingState = require('../modules/BuildingState');
const CityService = require('../services/CityService');
const TechTreeService = require('../services/TechTreeService');

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

function meetsConditions(gameState, conditions) {
  const capital = CityService.getCapitalCity(gameState);
  return (conditions || []).every((condition) => {
    if ((condition.source || 'resources') === 'military') {
      return (capital.military?.[condition.key] || 0) >= condition.required;
    }
    if ((condition.source || 'resources') === 'building') {
      return BuildingState.getLevel(capital.buildings, condition.key) >= condition.required;
    }
    return (capital.resources?.[condition.key] || 0) >= condition.required;
  });
}

function applyEraKnowledgeBonus(gameState, nextEra) {
  const capital = CityService.getCapitalCity(gameState);
  const eraKnowledgeBonus = { 1: 5 };
  const bonus = eraKnowledgeBonus[nextEra] || 0;
  if (bonus > 0) {
    capital.resources.knowledge = (capital.resources.knowledge || 0) + bonus;
  }
}

function welcomeSettlementResident(gameState, nextEra) {
  if (nextEra !== 2) return;
  const capital = CityService.getCapitalCity(gameState);
  const population = capital.population || {};
  const maxPopulation = population.max || population.maxPop || 0;
  if ((population.unassigned || 0) > 0) return;
  if ((population.total || 0) >= maxPopulation) return;
  population.total = (population.total || 0) + 1;
  population.unassigned = (population.unassigned || 0) + 1;
  population.max = maxPopulation;
  population.maxPop = maxPopulation;
  capital.population = population;
}

function execute(gameState, tutorial) {
  CityService.normalizeCities(gameState);
  if ((gameState.activeCityId || CityService.CAPITAL_CITY_ID) !== CityService.CAPITAL_CITY_ID) {
    return { success: false, error: 'CITY_CANNOT_ADVANCE', message: '只有主城可以推动文明进阶', tutorial };
  }
  const capital = CityService.getCapitalCity(gameState);
  const config = EraConfig.getAdvanceConfig(gameState.currentEra);
  if (!config) {
    return { success: false, error: 'ERA_MAX_REACHED', message: '已达到最高时代', tutorial };
  }
  if (!hasEnoughResources(capital.resources, config.cost) || !meetsConditions(gameState, config.conditions)) {
    return { success: false, error: 'INSUFFICIENT_RESOURCES', message: '资源不足，无法进入下一时代', tutorial };
  }

  capital.resources = deductResources(capital.resources, config.cost);
  gameState.currentEra = config.nextEra;
  applyEraKnowledgeBonus(gameState, config.nextEra);
  const techGrant = TechTreeService.grantEraPoints(gameState, config.nextEra);
  welcomeSettlementResident(gameState, config.nextEra);
  gameState.eraHistory.push({ era: config.nextEra, advancedAt: new Date().toISOString() });

  let nextTutorial = tutorial;
  if (config.nextEra === 2) {
    EventService.generateSpecialEvent(gameState, config.nextEra);
    nextTutorial = TutorialService.advanceTutorial(tutorial, 'eraAdvancedTo2');
  } else if (config.nextEra === 3) {
    // The scout famous person is no longer auto-granted here: it is a claimable
    // task reward (main_scout_officer) later in the barracks segment.
    nextTutorial = TutorialService.advanceTutorial(tutorial, 'era3Advanced');
  } else {
    nextTutorial = TutorialService.advanceTutorial(tutorial, 'eraAdvanced');
  }

  return {
    success: true,
    message: `已进入${EraConfig.getEraName(config.nextEra)}${techGrant.granted ? `，科技点 +${techGrant.granted}` : ''}`,
    currentEra: config.nextEra,
    techGrant,
    tutorial: nextTutorial,
  };
}

module.exports = {
  execute,
};
