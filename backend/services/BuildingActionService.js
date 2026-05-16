const BuildingState = require('../domain/BuildingState');
const BuildingActionValidator = require('../validators/BuildingActionValidator');
const TutorialService = require('./TutorialService');
const BuildingEffectCalculator = require('../calculators/BuildingEffectCalculator');
const ResourceTickCalculator = require('../calculators/ResourceTickCalculator');

function deductResources(resources, cost) {
  const next = { ...resources };
  Object.entries(cost || {}).forEach(([key, value]) => {
    next[key] = Math.max(0, (next[key] || 0) - value);
  });
  return next;
}

function applyDerivedStats(gameState) {
  const effects = BuildingEffectCalculator.calculate(gameState.buildings);
  gameState.buildingEffects = effects;
  gameState.population.max = ResourceTickCalculator.calculatePopulationCap(effects);
  gameState.population.maxPop = gameState.population.max;
  gameState.happiness = ResourceTickCalculator.calculateHappiness(effects);
  return effects;
}

function build(gameState, tutorialState, buildingId) {
  const validation = BuildingActionValidator.validateBuild(gameState, tutorialState, buildingId);
  if (!validation.allowed) return { success: false, error: validation.code, message: validation.message };
  const now = new Date().toISOString();
  gameState.resources = deductResources(gameState.resources, validation.cost);
  gameState.buildings = BuildingState.build(gameState.buildings, buildingId, now);
  const effects = applyDerivedStats(gameState);
  const tutorialEvent = buildingId === 'farm' ? 'farmBuilt' : buildingId === 'house' ? 'houseBuilt' : null;
  const nextTutorial = TutorialService.advanceTutorial(tutorialState, tutorialEvent);
  return {
    success: true,
    message: `建造了${buildingId}`,
    buildingId,
    level: 1,
    cost: validation.cost,
    tutorial: nextTutorial,
    effects,
  };
}

function upgrade(gameState, tutorialState, buildingId) {
  const validation = BuildingActionValidator.validateUpgrade(gameState, tutorialState, buildingId);
  if (!validation.allowed) return { success: false, error: validation.code, message: validation.message };
  const now = new Date().toISOString();
  gameState.resources = deductResources(gameState.resources, validation.cost);
  gameState.buildings = BuildingState.upgrade(gameState.buildings, buildingId, now);
  const effects = applyDerivedStats(gameState);
  return {
    success: true,
    message: `${buildingId} 升至 ${validation.currentLevel + 1} 级`,
    buildingId,
    oldLevel: validation.currentLevel,
    newLevel: validation.currentLevel + 1,
    cost: validation.cost,
    tutorial: tutorialState,
    effects,
  };
}

module.exports = {
  build,
  upgrade,
  applyDerivedStats,
};
