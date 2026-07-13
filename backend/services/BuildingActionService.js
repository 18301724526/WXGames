const BuildingState = require('../modules/BuildingState');
const BuildingActionValidator = require('../validators/BuildingActionValidator');
const CityService = require('./CityService');

function deductResources(resources, cost) {
  const next = { ...resources };
  Object.entries(cost || {}).forEach(([key, value]) => {
    next[key] = Math.max(0, (next[key] || 0) - value);
  });
  return next;
}

function applyDerivedStats(gameState) {
  CityService.normalizeCities(gameState);
  const city = CityService.getActiveCity(gameState);
  return CityService.applyDerivedStatsToCity(city, gameState);
}

function build(gameState, buildingId) {
  CityService.normalizeCities(gameState);
  const validation = BuildingActionValidator.validateBuild(gameState, buildingId);
  if (!validation.allowed) return { success: false, error: validation.code, message: validation.message };
  const now = new Date().toISOString();
  const city = CityService.getActiveCity(gameState);
  city.resources = deductResources(city.resources, validation.cost);
  city.buildings = BuildingState.build(city.buildings, buildingId, now);
  CityService.applyDerivedStatsToCity(city, gameState);
  const effects = applyDerivedStats(gameState);
  return {
    success: true,
    message: `建造了${buildingId}`,
    buildingId,
    level: 1,
    cost: validation.cost,
    effects,
  };
}

function upgrade(gameState, buildingId) {
  CityService.normalizeCities(gameState);
  const validation = BuildingActionValidator.validateUpgrade(gameState, buildingId);
  if (!validation.allowed) return { success: false, error: validation.code, message: validation.message };
  const now = new Date().toISOString();
  const city = CityService.getActiveCity(gameState);
  city.resources = deductResources(city.resources, validation.cost);
  city.buildings = BuildingState.upgrade(city.buildings, buildingId, now);
  CityService.applyDerivedStatsToCity(city, gameState);
  const effects = applyDerivedStats(gameState);
  return {
    success: true,
    message: `${buildingId} 升至 ${validation.currentLevel + 1} 级`,
    buildingId,
    oldLevel: validation.currentLevel,
    newLevel: validation.currentLevel + 1,
    cost: validation.cost,
    effects,
  };
}

module.exports = {
  build,
  upgrade,
  applyDerivedStats,
};
