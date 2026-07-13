const { EraConfig } = require('./config/GameplayConfigRuntime');
const BuildingState = require('../modules/BuildingState');
const CityService = require('./CityService');
const TechTreeService = require('./TechTreeService');

function getUnlockedBuildings(currentEra, gameState = null) {
  const result = new Set();
  for (let era = 0; era <= currentEra; era += 1) {
    (EraConfig.ERA_BUILDING_UNLOCKS[era] || []).forEach((id) => result.add(id));
  }
  const activeBuildings = gameState
    ? (CityService.getActiveCity(gameState)?.buildings || gameState.buildings || {})
    : {};
  if (!BuildingState.isBuilt(activeBuildings, 'house')) {
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
