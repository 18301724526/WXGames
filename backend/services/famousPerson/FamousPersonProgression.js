const SkillGeneratorService = require('../SkillGeneratorService');
const {
  ATTRIBUTE_INITIAL_MAX_VALUE,
  ATTRIBUTE_KEYS,
  ATTRIBUTE_MAX_VALUE,
  ATTRIBUTE_MIN_VALUE,
  ATTRIBUTE_POINT_MILESTONE,
  ATTRIBUTE_POINTS_PER_MILESTONE,
  AUTO_GROWTH_WEIGHTS,
  BASE_LEVEL,
  QUALITY_AUTO_GROWTH_POINTS,
} = require('./FamousPersonConstants');
const {
  roundToNearestTen,
  toInteger,
} = require('./FamousPersonShared');

function clampAttributeValue(value, fallback = 50, max = ATTRIBUTE_MAX_VALUE) {
  return Math.max(ATTRIBUTE_MIN_VALUE, Math.min(max, toInteger(value, fallback)));
}

function getLevelUpExperience(level = BASE_LEVEL) {
  const currentLevel = Math.max(BASE_LEVEL, toInteger(level, BASE_LEVEL));
  return roundToNearestTen(100 + 35 * currentLevel + 6 * Math.pow(currentLevel, 1.5));
}

function normalizeAttributePointMap(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return ATTRIBUTE_KEYS.reduce((result, key) => {
    const value = Math.max(0, toInteger(source[key], 0));
    if (value > 0) result[key] = value;
    return result;
  }, {});
}

function createEmptyAttributePointMap() {
  return ATTRIBUTE_KEYS.reduce((result, key) => {
    result[key] = 0;
    return result;
  }, {});
}

function sumAttributePoints(points = {}) {
  return ATTRIBUTE_KEYS.reduce((sum, key) => sum + Math.max(0, toInteger(points[key], 0)), 0);
}

function getAutoGrowthMilestoneLevels(level = BASE_LEVEL) {
  const currentLevel = Math.max(BASE_LEVEL, toInteger(level, BASE_LEVEL));
  const levels = [];
  for (let milestone = ATTRIBUTE_POINT_MILESTONE; milestone <= currentLevel; milestone += ATTRIBUTE_POINT_MILESTONE) {
    levels.push(milestone);
  }
  return levels;
}

function normalizeAutoGrowthMilestones(raw = [], level = BASE_LEVEL) {
  if (!Array.isArray(raw)) return [];
  const currentLevel = Math.max(BASE_LEVEL, toInteger(level, BASE_LEVEL));
  return [...new Set(raw
    .map((item) => toInteger(item, 0))
    .filter((item) => item >= ATTRIBUTE_POINT_MILESTONE && item <= currentLevel && item % ATTRIBUTE_POINT_MILESTONE === 0))]
    .sort((a, b) => a - b);
}

function normalizeProgression(raw = {}) {
  const level = Math.max(BASE_LEVEL, toInteger(raw.level, BASE_LEVEL));
  const experience = Math.max(0, toInteger(raw.experience, 0));
  const totalExperience = Math.max(experience, toInteger(raw.totalExperience, experience));
  const freeAttributePoints = Math.max(0, toInteger(raw.freeAttributePoints, 0));
  const earnedAttributePoints = Math.max(freeAttributePoints, toInteger(raw.earnedAttributePoints, freeAttributePoints));
  const assignedAttributePoints = normalizeAttributePointMap(raw.assignedAttributePoints);
  const autoAttributeGrowth = normalizeAttributePointMap(raw.autoAttributeGrowth);
  const rawMilestones = raw.autoGrowthMilestones ?? raw.autoAttributeGrowthMilestones;
  const hasMilestoneLedger = Array.isArray(rawMilestones);
  const autoGrowthTotal = sumAttributePoints(autoAttributeGrowth);
  const normalizedMilestones = hasMilestoneLedger ? normalizeAutoGrowthMilestones(rawMilestones, level) : [];
  const autoGrowthMilestones = hasMilestoneLedger && (normalizedMilestones.length > 0 || autoGrowthTotal === 0)
    ? normalizedMilestones
    : (autoGrowthTotal > 0 ? getAutoGrowthMilestoneLevels(level) : []);
  const earnedAutoAttributePoints = Math.max(autoGrowthTotal, toInteger(raw.earnedAutoAttributePoints, autoGrowthTotal));
  return {
    level,
    experience,
    totalExperience,
    freeAttributePoints,
    earnedAttributePoints,
    assignedAttributePoints,
    autoAttributeGrowth,
    earnedAutoAttributePoints,
    autoGrowthMilestones,
    nextLevelExperience: getLevelUpExperience(level),
  };
}

function normalizeAttributes(raw = {}, options = {}) {
  const strategy = raw.intelligence ?? raw.strategy;
  const politics = raw.politics ?? raw.governance;
  const speed = raw.speed ?? Math.round(
    toInteger(raw.force, 50) * 0.28
    + toInteger(raw.command, 50) * 0.24
    + toInteger(strategy, 50) * 0.18
    + toInteger(raw.charisma, 50) * 0.14
    + toInteger(politics, 50) * 0.06,
  );
  const defaults = {
    command: 50,
    force: 50,
    intelligence: 50,
    strategy: 50,
    politics: 50,
    governance: 50,
    charisma: 50,
    speed: 50,
  };
  const source = {
    ...raw,
    intelligence: strategy,
    strategy,
    politics,
    governance: politics,
    speed,
  };
  const max = options.initial ? ATTRIBUTE_INITIAL_MAX_VALUE : ATTRIBUTE_MAX_VALUE;
  return Object.keys(defaults).reduce((result, key) => {
    result[key] = clampAttributeValue(source[key], defaults[key], max);
    return result;
  }, {});
}

function syncAttributeAliases(attributes = {}) {
  if (Object.prototype.hasOwnProperty.call(attributes, 'intelligence')) {
    attributes.strategy = attributes.intelligence;
  }
  if (Object.prototype.hasOwnProperty.call(attributes, 'politics')) {
    attributes.governance = attributes.politics;
  }
  return attributes;
}

function getAutoGrowthPointsForQuality(quality = 'common') {
  return QUALITY_AUTO_GROWTH_POINTS[SkillGeneratorService.normalizeQuality(quality)] || QUALITY_AUTO_GROWTH_POINTS.common;
}

function getAutoGrowthWeightsForArchetype(abilityArchetype = 'vanguard') {
  const key = SkillGeneratorService.normalizeAbilityArchetype(abilityArchetype);
  return AUTO_GROWTH_WEIGHTS[key] || AUTO_GROWTH_WEIGHTS.vanguard;
}

function calculateAutoAttributeGrowth(quality = 'common', abilityArchetype = 'vanguard') {
  const total = getAutoGrowthPointsForQuality(quality);
  const weights = getAutoGrowthWeightsForArchetype(abilityArchetype);
  const growth = createEmptyAttributePointMap();
  const fractional = ATTRIBUTE_KEYS.map((key, index) => {
    const weight = Number(weights[key]) || 0;
    const exact = total * weight;
    const floor = Math.floor(exact);
    growth[key] = floor;
    return {
      key,
      weight,
      remainder: exact - floor,
      index,
    };
  });
  let remaining = total - sumAttributePoints(growth);
  fractional
    .sort((a, b) => b.remainder - a.remainder || b.weight - a.weight || a.index - b.index)
    .forEach((item) => {
      if (remaining <= 0) return;
      growth[item.key] += 1;
      remaining -= 1;
    });
  return normalizeAttributePointMap(growth);
}

function mergeAttributePointMaps(left = {}, right = {}) {
  return normalizeAttributePointMap(ATTRIBUTE_KEYS.reduce((result, key) => {
    result[key] = Math.max(0, toInteger(left[key], 0)) + Math.max(0, toInteger(right[key], 0));
    return result;
  }, {}));
}

function addAutoAttributeGrowthToAttributes(attributes = {}, growth = {}) {
  const normalized = normalizeAttributes(attributes || {});
  ATTRIBUTE_KEYS.forEach((key) => {
    const value = Math.max(0, toInteger(growth[key], 0));
    if (value > 0) {
      normalized[key] = clampAttributeValue(normalized[key] + value, normalized[key]);
    }
  });
  return syncAttributeAliases(normalized);
}

function applyAutoAttributeGrowth(person, milestoneLevels = []) {
  if (!person || !Array.isArray(milestoneLevels) || !milestoneLevels.length) {
    return { total: 0, attributes: {}, milestones: [] };
  }
  const progression = normalizeProgression(person);
  const applied = new Set(progression.autoGrowthMilestones);
  const milestones = [...new Set(milestoneLevels
    .map((item) => toInteger(item, 0))
    .filter((item) => item >= ATTRIBUTE_POINT_MILESTONE && item % ATTRIBUTE_POINT_MILESTONE === 0 && !applied.has(item)))]
    .sort((a, b) => a - b);
  if (!milestones.length) return { total: 0, attributes: {}, milestones: [] };

  const gained = createEmptyAttributePointMap();
  milestones.forEach(() => {
    const growth = calculateAutoAttributeGrowth(person.quality, person.abilityArchetype);
    ATTRIBUTE_KEYS.forEach((key) => {
      gained[key] += Math.max(0, toInteger(growth[key], 0));
    });
  });
  const normalizedGained = normalizeAttributePointMap(gained);
  const gainedTotal = sumAttributePoints(normalizedGained);
  person.attributes = addAutoAttributeGrowthToAttributes(person.attributes, normalizedGained);
  person.autoAttributeGrowth = mergeAttributePointMaps(progression.autoAttributeGrowth, normalizedGained);
  person.earnedAutoAttributePoints = progression.earnedAutoAttributePoints + gainedTotal;
  person.autoGrowthMilestones = [...new Set([...progression.autoGrowthMilestones, ...milestones])].sort((a, b) => a - b);
  return {
    total: gainedTotal,
    attributes: normalizedGained,
    milestones,
  };
}

function applyPendingAutoAttributeGrowth(person) {
  if (!person) return { total: 0, attributes: {}, milestones: [] };
  const progression = normalizeProgression(person);
  const applied = new Set(progression.autoGrowthMilestones);
  const pending = getAutoGrowthMilestoneLevels(progression.level).filter((level) => !applied.has(level));
  return applyAutoAttributeGrowth(person, pending);
}

module.exports = {
  addAutoAttributeGrowthToAttributes,
  applyAutoAttributeGrowth,
  applyPendingAutoAttributeGrowth,
  calculateAutoAttributeGrowth,
  clampAttributeValue,
  createEmptyAttributePointMap,
  getAutoGrowthMilestoneLevels,
  getAutoGrowthPointsForQuality,
  getAutoGrowthWeightsForArchetype,
  getLevelUpExperience,
  mergeAttributePointMaps,
  normalizeAttributePointMap,
  normalizeAttributes,
  normalizeAutoGrowthMilestones,
  normalizeProgression,
  sumAttributePoints,
  syncAttributeAliases,
};
