const {
  BuildingConfig,
  EraConfig,
} = require('../config/GameplayConfigRuntime');
const {
  RESOURCE_KEYS,
  addResources,
  sanitizeText,
  toNumber,
} = require('./TaskDefinitionShared');

function resolveRewardFormula(formula) {
  const [rawKind, ...parts] = sanitizeText(formula).split(':').map((item) => item.trim());
  const kind = rawKind.toLowerCase();
  if (['buildcost', 'buildingcost'].includes(kind)) {
    const buildingId = parts[0];
    if (!BuildingConfig.hasBuilding(buildingId)) return { error: `UNKNOWN_BUILDING:${buildingId}` };
    return { resources: BuildingConfig.getBuildCost(buildingId) };
  }
  if (['advancecost', 'eraadvancecost'].includes(kind)) {
    const era = Math.max(0, Math.floor(toNumber(parts[0], 0)));
    const config = EraConfig.getAdvanceConfig(era);
    if (!config) return { error: `UNKNOWN_ERA_ADVANCE:${era}` };
    return { resources: config.cost || {} };
  }
  if (['upgradecost', 'buildingupgradecost'].includes(kind)) {
    const buildingId = parts[0];
    const level = Math.max(1, Math.floor(toNumber(parts[1], 1)));
    const cost = BuildingConfig.getUpgradeCost(buildingId, level);
    if (!cost) return { error: `UNKNOWN_UPGRADE:${buildingId}:${level}` };
    return { resources: cost };
  }
  return { error: `UNKNOWN_REWARD_FORMULA:${formula}` };
}

function resolveRewardResources(reward = {}) {
  const resources = {};
  const errors = [];
  addResources(resources, reward.resources || {});
  const formulaResourcesResolved = Boolean(
    reward.formulaResourcesResolved
      && Object.keys(resources).length > 0,
  );
  for (const formula of reward.formulas || []) {
    const resolved = resolveRewardFormula(formula);
    if (resolved.error) {
      errors.push(resolved.error);
    } else if (!formulaResourcesResolved) {
      addResources(resources, resolved.resources);
    }
  }
  return { resources, errors };
}

function formatRewardText(resources = {}) {
  return RESOURCE_KEYS
    .filter((key) => Number(resources[key]) > 0)
    .map((key) => `${key}+${resources[key]}`)
    .join(' / ') || 'none';
}

module.exports = {
  resolveRewardFormula,
  resolveRewardResources,
  formatRewardText,
};
