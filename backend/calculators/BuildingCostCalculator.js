const BuildingConfig = require('../config/BuildingConfig');
const BuildingState = require('../domain/BuildingState');

function getBuildCost(buildingId) {
  return BuildingConfig.getBuildCost(buildingId);
}

function getUpgradeCost(buildingId, currentLevel) {
  return BuildingConfig.getUpgradeCost(buildingId, currentLevel);
}

function getNextActionCost(buildingId, buildings) {
  const currentLevel = BuildingState.getLevel(buildings, buildingId);
  if (currentLevel <= 0) return getBuildCost(buildingId);
  return getUpgradeCost(buildingId, currentLevel);
}

module.exports = {
  getBuildCost,
  getUpgradeCost,
  getNextActionCost,
};
