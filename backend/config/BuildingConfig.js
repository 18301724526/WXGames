const path = require('path');
const sourcePath = path.join(__dirname, '..', '..', 'shared', 'buildingConfig.json');
const config = require(sourcePath);

const RESOURCE_LABELS = {
  food: '食物',
  wood: '木材',
  iron: '铁矿',
  stone: '石料',
  knowledge: '知识',
  metal: '铁矿',
};

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

function getScalePlan(buildingId) {
  return cloneConfig(getBuilding(buildingId)?.scalePlan || {});
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

function getMaintenanceResourceKeys(maintenance = {}) {
  return Object.entries(maintenance.perLevelPerMinute || {})
    .filter(([, value]) => Number(value) > 0)
    .map(([key]) => key);
}

function describeHabitabilityPressure(value) {
  const pressure = Number(value) || 0;
  if (pressure <= 0) return '宜居压力平稳';
  if (pressure <= 1) return '宜居压力轻微';
  if (pressure <= 2) return '宜居压力较高';
  return '宜居压力沉重';
}

function describeEffectCurve(curve) {
  return {
    diminishing: '规模收益会逐步放缓',
    step: '规模节点会带来阶段提升',
    linear: '规模收益保持稳定',
  }[curve] || '规模收益待规划';
}

function getMaintenancePreview(buildingId) {
  const maintenance = getBuilding(buildingId)?.maintenance || {};
  const resources = getMaintenanceResourceKeys(maintenance);
  const active = Boolean(isMaintenanceActive() && maintenance.enabled);
  return {
    planned: resources.length > 0 || Boolean(maintenance.summary),
    active,
    enabled: Boolean(maintenance.enabled),
    startsAtEra: maintenance.startsAtEra || null,
    resources,
    resourceText: resources.map((key) => RESOURCE_LABELS[key] || key).join('、') || '无',
    pressureText: describeHabitabilityPressure(maintenance.habitabilityPressure),
    summary: maintenance.summary || '',
    text: `${active ? '维护' : '维护预案'}：${resources.map((key) => RESOURCE_LABELS[key] || key).join('、') || '无'} · ${describeHabitabilityPressure(maintenance.habitabilityPressure)}`,
  };
}

function getScalePlanPreview(buildingId) {
  const scalePlan = getBuilding(buildingId)?.scalePlan || {};
  const openEnded = Boolean(scalePlan.openEnded);
  const currentCapRetained = Boolean(scalePlan.currentCapRetained);
  return {
    openEnded,
    currentCapRetained,
    curveText: describeEffectCurve(scalePlan.effectCurve),
    text: openEnded
      ? `${currentCapRetained ? '规模预案' : '规模'}：后续可继续扩张`
      : '规模：当前有上限',
  };
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
  getScalePlan,
  getMaintenancePolicy,
  getMaintenance,
  isMaintenanceActive,
  getMaintenancePreview,
  getScalePlanPreview,
};
