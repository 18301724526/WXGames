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
const MIN_DIMINISHING_EFFECT_EFFICIENCY = 0.05;

function cloneConfig(value) {
  return JSON.parse(JSON.stringify(value));
}

function toLevel(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.floor(number);
}

function getConfiguredMaxLevel(building) {
  return Math.max(1, toLevel(building?.maxLevel || 1));
}

function isOpenEndedScale(building) {
  return Boolean(building?.scalePlan?.openEnded);
}

function getCostGrowth(building) {
  const growth = Number(building?.scalePlan?.costGrowth);
  return Number.isFinite(growth) && growth > 1 ? growth : 1.15;
}

function roundGeneratedCost(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  if (number < 20) return Math.ceil(number);
  if (number < 100) return Math.ceil(number / 5) * 5;
  if (number < 1000) return Math.ceil(number / 10) * 10;
  return Math.ceil(number / 50) * 50;
}

function scaleCost(cost = {}, growth = 1.15, steps = 1) {
  const multiplier = Math.pow(growth, Math.max(1, toLevel(steps)));
  const next = {};
  for (const [resource, amount] of Object.entries(cost || {})) {
    const rounded = roundGeneratedCost(Number(amount) * multiplier);
    if (rounded > 0) next[resource] = rounded;
  }
  return Object.keys(next).length ? next : null;
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
  const level = toLevel(currentLevel);
  if (level <= 0) return null;
  const upgradeCosts = Array.isArray(building.upgradeCosts) ? building.upgradeCosts : [];
  const configured = upgradeCosts[level - 1];
  if (configured) return { ...configured };
  if (!canUpgrade(buildingId, level)) return null;
  const seedCost = upgradeCosts[upgradeCosts.length - 1] || building.buildCost || {};
  return scaleCost(seedCost, getCostGrowth(building), level - upgradeCosts.length);
}

function getMaxLevel(buildingId) {
  return getBuilding(buildingId)?.maxLevel || 1;
}

function canUpgrade(buildingId, currentLevel) {
  const building = getBuilding(buildingId);
  const level = toLevel(currentLevel);
  if (!building || level <= 0) return false;
  if (isOpenEndedScale(building)) return true;
  return level < getConfiguredMaxLevel(building);
}

function getExtraEffectEfficiency(curve, extraIndex) {
  if (curve === 'linear') return 1;
  if (curve === 'step') return 0.5;
  return MIN_DIMINISHING_EFFECT_EFFICIENCY
    + (1 - MIN_DIMINISHING_EFFECT_EFFICIENCY) / Math.sqrt(extraIndex + 2);
}

function roundEffectBonus(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 1_000_000) / 1_000_000;
}

function calculateEffectBonus(buildingId, field, level) {
  const building = typeof buildingId === 'string' ? getBuilding(buildingId) : buildingId;
  const currentLevel = toLevel(level);
  const perLevel = Number(building?.effects?.perLevel?.[field] || 0);
  if (!building || currentLevel <= 0 || perLevel <= 0) return 0;

  const maxLevel = getConfiguredMaxLevel(building);
  const baseLevels = isOpenEndedScale(building) ? Math.min(currentLevel, maxLevel) : Math.min(currentLevel, maxLevel);
  let total = baseLevels * perLevel;
  if (isOpenEndedScale(building) && currentLevel > maxLevel) {
    const extraLevels = currentLevel - maxLevel;
    const curve = building.scalePlan?.effectCurve || 'diminishing';
    for (let index = 0; index < extraLevels; index += 1) {
      total += perLevel * getExtraEffectEfficiency(curve, index);
    }
  }
  return roundEffectBonus(total);
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
  canUpgrade,
  calculateEffectBonus,
  getScalePlan,
  getMaintenancePolicy,
  getMaintenance,
  isMaintenanceActive,
  getMaintenancePreview,
  getScalePlanPreview,
};
