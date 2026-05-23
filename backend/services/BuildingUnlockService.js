const { ERA_BUILDING_UNLOCKS } = require('../config/EraConfig');
const TechTreeService = require('./TechTreeService');

function getUnlockedBuildings(currentEra, gameState = null) {
  const result = new Set();
  for (let era = 0; era <= currentEra; era += 1) {
    (ERA_BUILDING_UNLOCKS[era] || []).forEach((id) => result.add(id));
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
