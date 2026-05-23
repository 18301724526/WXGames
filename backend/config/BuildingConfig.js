const path = require('path');
const sourcePath = path.join(__dirname, '..', '..', 'shared', 'buildingConfig.json');
const config = require(sourcePath);

function cloneConfig(value) {
  return JSON.parse(JSON.stringify(value));
}

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

function getMaintenancePolicy() {
  return cloneConfig(config.maintenancePolicy || {});
}

function getMaintenance(buildingId) {
  return cloneConfig(getBuilding(buildingId)?.maintenance || {});
}

function isMaintenanceActive() {
  const policy = config.maintenancePolicy || {};
  return Boolean(policy.active && policy.appliesToResourceTick);
}

module.exports = {
  raw: () => cloneConfig(config),
  getVersion: () => config.version || null,
  getSourcePath: () => sourcePath,
  getAllBuildings,
  getBuilding,
  hasBuilding,
  getBuildCost,
  getUpgradeCost,
  getMaxLevel,
  getMaintenancePolicy,
  getMaintenance,
  isMaintenanceActive,
};
