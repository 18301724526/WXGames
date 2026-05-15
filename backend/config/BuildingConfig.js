const path = require('path');
const config = require(path.join(__dirname, '..', '..', 'shared', 'buildingConfig.json'));

function getAllBuildings() {
  return config.buildings;
}

function getBuilding(buildingId) {
  return config.buildings[buildingId] || null;
}

function hasBuilding(buildingId) {
  return Boolean(getBuilding(buildingId));
}

function getBuildCost(buildingId) {
  return { ...(getBuilding(buildingId)?.buildCost || {}) };
}

function getUpgradeCost(buildingId, currentLevel) {
  const building = getBuilding(buildingId);
  if (!building) return null;
  return building.upgradeCosts?.[Math.max(0, currentLevel - 1)] || null;
}

function getMaxLevel(buildingId) {
  return getBuilding(buildingId)?.maxLevel || 1;
}

module.exports = {
  raw: config,
  getAllBuildings,
  getBuilding,
  hasBuilding,
  getBuildCost,
  getUpgradeCost,
  getMaxLevel,
};
