const { EraConfig } = require('./config/GameplayConfigRuntime');
const { TUTORIAL_STEPS, stepBefore } = require('../../shared/tutorialFlowConfig');
const TechTreeService = require('./TechTreeService');

function getUnlockedBuildings(currentEra, gameState = null) {
  const result = new Set();
  for (let era = 0; era <= currentEra; era += 1) {
    (EraConfig.ERA_BUILDING_UNLOCKS[era] || []).forEach((id) => result.add(id));
  }
  const tutorial = gameState?.tutorial || {};
  if (!tutorial.completed && !tutorial.disabled && stepBefore(tutorial.currentStep, TUTORIAL_STEPS.houseBuilt)) {
    result.add('house');
  }
  TechTreeService.getUnlockedBuildings(gameState || {}).forEach((id) => result.add(id));
  return [...result];
}

function isUnlocked(buildingId, currentEra, gameState = null) {
  return getUnlockedBuildings(currentEra, gameState).includes(buildingId);
}

module.exports = {
  getUnlockedBuildings,
  isUnlocked,
};
