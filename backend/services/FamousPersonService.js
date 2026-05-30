const CityService = require('./CityService');
const SkillGeneratorService = require('./SkillGeneratorService');

const GENERATOR_VERSION = 'famous-person-v0.2';
const APPEARANCE_VERSION = 'famous-portrait-v3.0';
const MIN_SEEK_ERA = 3;
const MAX_CANDIDATES = 3;
const PORTRAIT_LAYER_BASE = 'assets/art/famous-person/layers/';
const ENABLED_SOURCE_TYPES = Object.freeze(['seek']);
const BASE_LEVEL = 1;
const ATTRIBUTE_POINT_MILESTONE = 10;
const ATTRIBUTE_POINTS_PER_MILESTONE = 10;
const ATTRIBUTE_MIN_VALUE = 1;
const ATTRIBUTE_INITIAL_MAX_VALUE = 99;
const ATTRIBUTE_MAX_VALUE = 9999;
const ATTRIBUTE_KEYS = Object.freeze(['command', 'force', 'intelligence', 'politics', 'charisma', 'speed']);
const QUALITY_AUTO_GROWTH_POINTS = Object.freeze({
  common: 4,
  good: 6,
  great: 8,
  legendary: 10,
});
const AUTO_GROWTH_WEIGHTS = Object.freeze({
  commander: Object.freeze({ command: 0.45, force: 0.15, intelligence: 0.1, politics: 0.1, charisma: 0.1, speed: 0.1 }),
  vanguard: Object.freeze({ command: 0.15, force: 0.45, intelligence: 0.05, politics: 0.05, charisma: 0.1, speed: 0.2 }),
  strategist: Object.freeze({ command: 0.1, force: 0.05, intelligence: 0.5, politics: 0.15, charisma: 0.1, speed: 0.1 }),
  governor: Object.freeze({ command: 0.05, force: 0.05, intelligence: 0.15, politics: 0.5, charisma: 0.2, speed: 0.05 }),
  charmer: Object.freeze({ command: 0.1, force: 0.05, intelligence: 0.15, politics: 0.2, charisma: 0.45, speed: 0.05 }),
  scout: Object.freeze({ command: 0.1, force: 0.1, intelligence: 0.2, politics: 0.05, charisma: 0.15, speed: 0.4 }),
});

const SOURCE_TYPES = Object.freeze({
  seek: { label: '寻访', roles: ['military', 'governance', 'knowledge'] },
  event: { label: '事件投奔', roles: ['military', 'governance'] },
  postWar: { label: '战后归附', roles: ['military'] },
});

const ARCHETYPES = Object.freeze([
  {
    id: 'vanguard',
    label: '突击领队',
    roles: ['military'],
    titlePool: ['山道突骑', '破阵先登', '血刃游侠'],
    namePool: ['骁', '峻', '烈', '岚', '锋'],
    abilityArchetype: 'vanguard',
    attributes: { command: 66, force: 78, intelligence: 42, strategy: 42, politics: 26, governance: 26, charisma: 52, speed: 64 },
    skillPairs: [['lifesteal', 'combo'], ['combo', 'armorBreak'], ['ambush', 'combo']],
  },
  {
    id: 'guardian',
    label: '守备领队',
    roles: ['military'],
    titlePool: ['垒门守将', '铁壁护军', '边墙执盾'],
    namePool: ['衡', '坚', '岳', '承', '镇'],
    abilityArchetype: 'commander',
    attributes: { command: 76, force: 62, intelligence: 48, strategy: 48, politics: 34, governance: 34, charisma: 58, speed: 52 },
    skillPairs: [['shield', 'counter'], ['shield', 'morale'], ['counter', 'heal']],
  },
  {
    id: 'tactician',
    label: '谋略领队',
    roles: ['military', 'knowledge'],
    titlePool: ['火计谋士', '雾林策士', '伏兵参谋'],
    namePool: ['策', '玄', '微', '昭', '临'],
    abilityArchetype: 'strategist',
    attributes: { command: 58, force: 34, intelligence: 82, strategy: 82, politics: 44, governance: 44, charisma: 56, speed: 50 },
    skillPairs: [['burn', 'ambush'], ['poison', 'armorBreak'], ['morale', 'combo']],
  },
  {
    id: 'warden',
    label: '城市治理',
    roles: ['governance'],
    titlePool: ['聚落执政', '仓廪主事', '民生长者'],
    namePool: ['宁', '禾', '安', '序', '清'],
    abilityArchetype: 'governor',
    attributes: { command: 38, force: 24, intelligence: 54, strategy: 54, politics: 82, governance: 82, charisma: 66, speed: 38 },
    skillPairs: [['morale', 'heal'], ['shield', 'heal'], ['morale', 'shield']],
  },
  {
    id: 'artisan',
    label: '营造人才',
    roles: ['governance'],
    titlePool: ['炉火匠首', '石工督造', '木作名匠'],
    namePool: ['钧', '砺', '椽', '铎', '工'],
    abilityArchetype: 'governor',
    attributes: { command: 34, force: 32, intelligence: 46, strategy: 46, politics: 82, governance: 82, charisma: 42, speed: 36 },
    skillPairs: [['armorBreak', 'shield'], ['burn', 'morale'], ['counter', 'armorBreak']],
  },
  {
    id: 'scholar',
    label: '知识人才',
    roles: ['knowledge'],
    titlePool: ['观星学者', '古卷译者', '火种记史'],
    namePool: ['闻', '简', '知', '言', '书'],
    abilityArchetype: 'strategist',
    attributes: { command: 28, force: 18, intelligence: 74, strategy: 74, politics: 64, governance: 64, charisma: 54, speed: 42 },
    skillPairs: [['morale', 'ambush'], ['poison', 'heal'], ['shield', 'morale']],
  },
  {
    id: 'envoy',
    label: '魅力人才',
    roles: ['governance', 'charisma'],
    titlePool: ['游说名士', '盟会使者', '乡望长者'],
    namePool: ['望', '舒', '容', '信', '和'],
    abilityArchetype: 'charmer',
    attributes: { command: 34, force: 22, intelligence: 58, strategy: 58, politics: 66, governance: 66, charisma: 84, speed: 42 },
    skillPairs: [['morale', 'heal'], ['shield', 'morale'], ['heal', 'shield']],
  },
  {
    id: 'scout',
    label: '斥候游骑',
    roles: ['military', 'knowledge'],
    titlePool: ['山林斥候', '疾行游骑', '探路前锋'],
    namePool: ['迅', '隼', '遥', '踪', '越'],
    abilityArchetype: 'scout',
    attributes: { command: 44, force: 48, intelligence: 62, strategy: 62, politics: 28, governance: 28, charisma: 52, speed: 82 },
    skillPairs: [['ambush', 'combo'], ['morale', 'ambush'], ['combo', 'shield']],
  },
]);

const SURNAMES = Object.freeze(['陆', '姜', '林', '石', '孟', '许', '白', '韩', '秦', '苏']);

const APPEARANCE_POOLS = Object.freeze({
  outfit: Array.from({ length: 10 }, (_, index) => `fp-layer-v3-outfit-${String(index + 1).padStart(2, '0')}.png`),
  face: Array.from({ length: 10 }, (_, index) => `fp-layer-v3-face-${String(index + 1).padStart(2, '0')}.png`),
  hair: Array.from({ length: 10 }, (_, index) => `fp-layer-v3-hair-${String(index + 1).padStart(2, '0')}.png`),
});

const EFFECTS = Object.freeze({
  directDamage: {
    label: '直接伤害',
    create: (roll) => ({ key: 'directDamage', value: round2(1.2 + roll * 0.3) }),
  },
  secondHit: {
    label: '二段伤害',
    create: (roll) => ({ key: 'secondHit', multiplier: round2(0.22 + roll * 0.14) }),
  },
  firstStrike: {
    label: '先手',
    create: (roll) => ({ key: 'firstStrike', value: round2(0.18 + roll * 0.12) }),
  },
  attributeBonus: {
    label: '属性修正',
    create: (roll) => ({ key: 'attributeBonus', attribute: 'force', value: 5 + Math.floor(roll * 5) }),
  },
  lifesteal: {
    label: '吸血',
    create: (roll) => ({ key: 'lifesteal', value: round2(0.12 + roll * 0.08) }),
  },
  combo: {
    label: '连击',
    create: (roll) => ({ key: 'combo', chance: round2(0.18 + roll * 0.1), times: 1 }),
  },
  counter: {
    label: '反击',
    create: (roll) => ({ key: 'counter', chance: round2(0.16 + roll * 0.1) }),
  },
  shield: {
    label: '护盾',
    create: (roll) => ({ key: 'shield', value: round2(0.12 + roll * 0.08) }),
  },
  armorBreak: {
    label: '破甲',
    create: (roll) => ({ key: 'armorBreak', value: round2(0.1 + roll * 0.08) }),
  },
  burn: {
    label: '灼烧',
    create: (roll) => ({ key: 'burn', value: round2(0.08 + roll * 0.07), turns: 2 }),
  },
  poison: {
    label: '中毒',
    create: (roll) => ({ key: 'poison', value: round2(0.07 + roll * 0.06), turns: 3 }),
  },
  morale: {
    label: '士气',
    create: (roll) => ({ key: 'morale', value: round2(0.08 + roll * 0.06) }),
  },
  heal: {
    label: '治疗',
    create: (roll) => ({ key: 'heal', value: round2(0.1 + roll * 0.08) }),
  },
  ambush: {
    label: '伏击',
    create: (roll) => ({ key: 'ambush', chance: round2(0.14 + roll * 0.1) }),
  },
});

function round2(value) {
  return Math.round(value * 100) / 100;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function rollUnit(randomSource = Math.random) {
  const value = Number(randomSource());
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(0.999999, value));
}

function pick(list, randomSource = Math.random) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[Math.floor(rollUnit(randomSource) * list.length)];
}

function hashText(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeedRandom(seed) {
  let state = hashText(seed) || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

function sanitizeText(value, fallback = '') {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

function toInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function clampAttributeValue(value, fallback = 50, max = ATTRIBUTE_MAX_VALUE) {
  return Math.max(ATTRIBUTE_MIN_VALUE, Math.min(max, toInteger(value, fallback)));
}

function roundToNearestTen(value) {
  return Math.max(10, Math.round((Number(value) || 0) / 10) * 10);
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

function normalizeStatus(raw = {}) {
  return {
    assigned: sanitizeText(raw.assigned, 'idle'),
    cityId: raw.cityId || null,
    missionId: raw.missionId || null,
    woundedUntil: raw.woundedUntil || null,
    fatigue: Math.max(0, Math.min(100, toInteger(raw.fatigue, 0))),
    loyalty: Math.max(0, Math.min(100, toInteger(raw.loyalty, 60))),
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

function normalizeRoles(rawRoles = [], fallbackRoles = []) {
  const source = Array.isArray(rawRoles) && rawRoles.length ? rawRoles : fallbackRoles;
  const roles = source
    .map((role) => (String(role) === 'craft' ? 'governance' : String(role)))
    .filter(Boolean);
  return [...new Set(roles.length ? roles : fallbackRoles.map(String))];
}

function normalizeSkill(raw = {}) {
  const effects = Array.isArray(raw.effects)
    ? raw.effects.map((effect) => SkillGeneratorService.normalizeEffect(effect)).filter(Boolean)
    : [];
  if (!effects.length) return null;
  return {
    id: sanitizeText(raw.id, `skill_${effects.map((effect) => effect.key).join('_')}`),
    name: sanitizeText(raw.name, makeSkillName(effects)),
    type: sanitizeText(raw.type, 'battle'),
    slot: sanitizeText(raw.slot, raw.kind === 'active' ? 'activeSkill' : ''),
    kind: sanitizeText(raw.kind, raw.type === 'battle' ? 'active' : ''),
    category: sanitizeText(raw.category, raw.damageType || 'blade'),
    damageType: sanitizeText(raw.damageType, raw.category || 'blade'),
    multiplier: Number.isFinite(Number(raw.multiplier)) ? Number(raw.multiplier) : undefined,
    cooldown: Number.isFinite(Number(raw.cooldown)) ? Math.max(1, toInteger(raw.cooldown, 3)) : undefined,
    castPolicy: sanitizeText(raw.castPolicy, ''),
    castConditions: Array.isArray(raw.castConditions) ? raw.castConditions.map((condition) => ({ ...condition })) : undefined,
    effects,
    budget: raw.budget && typeof raw.budget === 'object' ? { ...raw.budget } : undefined,
    generatorVersion: sanitizeText(raw.generatorVersion, ''),
  };
}

function layerPath(filename) {
  return filename ? `${PORTRAIT_LAYER_BASE}${filename}` : null;
}

function createAppearance(archetype, seed, randomSource = null) {
  const source = typeof randomSource === 'function' ? randomSource : createSeedRandom(seed);
  const layers = {
    outfit: layerPath(pick(APPEARANCE_POOLS.outfit, source)),
    face: layerPath(pick(APPEARANCE_POOLS.face, source)),
    hair: layerPath(pick(APPEARANCE_POOLS.hair, source)),
  };
  return {
    version: APPEARANCE_VERSION,
    seed: sanitizeText(seed, `${archetype.id}:appearance`),
    palette: archetype.roles.includes('military') ? 'military_red' : 'settlement_blue',
    layers,
  };
}

function normalizeAppearance(raw = {}, archetype, fallbackSeed) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const rawLayers = source.layers && typeof source.layers === 'object' ? source.layers : {};
  const generated = createAppearance(archetype, source.seed || fallbackSeed);
  if (source.version !== APPEARANCE_VERSION) return generated;
  const allowedLayerKeys = ['outfit', 'face', 'hair'];
  const layers = allowedLayerKeys
    .reduce((result, key) => {
      const value = sanitizeText(rawLayers[key]);
      if (value) result[key] = value;
      return result;
    }, {});
  const mergedLayers = {
    ...generated.layers,
    ...layers,
  };
  return {
    version: sanitizeText(source.version, APPEARANCE_VERSION),
    seed: sanitizeText(source.seed, fallbackSeed),
    palette: sanitizeText(source.palette, generated.palette),
    layers: mergedLayers,
  };
}

function normalizePerson(raw = {}, options = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const id = sanitizeText(raw.id);
  if (!id) return null;
  const archetype = ARCHETYPES.find((item) => item.id === raw.archetype) || ARCHETYPES[0];
  const quality = SkillGeneratorService.normalizeQuality(raw.quality);
  const abilityArchetype = SkillGeneratorService.normalizeAbilityArchetype(
    raw.abilityArchetype || raw.abilityKit?.archetype || archetype.abilityArchetype || archetype.id,
  );
  const rawSkills = Array.isArray(raw.skills) ? raw.skills.map(normalizeSkill).filter(Boolean).slice(0, 2) : [];
  const abilityKit = SkillGeneratorService.normalizeAbilityKit(raw.abilityKit, {
    archetype: archetype.id,
    abilityArchetype,
    quality,
    skills: rawSkills,
    source: raw.source?.type,
    seed: raw.source?.seed || raw.source?.candidateId || id,
  });
  const activeSkill = normalizeSkill(SkillGeneratorService.getActiveBattleSkill(abilityKit) || {});
  const skills = abilityKit.battlePolicy === 'basicAttackOnly' || !activeSkill ? [] : [activeSkill];
  const fallbackAppearanceSeed = raw.source?.seed || `${id}:${raw.name || archetype.id}:${raw.createdAt || ''}`;
  const person = {
    id,
    name: sanitizeText(raw.name, '无名之士').slice(0, 12),
    title: sanitizeText(raw.title, archetype.titlePool[0]).slice(0, 16),
    eraBorn: Math.max(0, toInteger(raw.eraBorn, 0)),
    source: raw.source && typeof raw.source === 'object' ? { ...raw.source } : { type: 'seek' },
    archetype: archetype.id,
    archetypeLabel: archetype.label,
    abilityArchetype,
    quality,
    qualityLabel: SkillGeneratorService.getQualityLabel(quality),
    roles: normalizeRoles(raw.roles, archetype.roles),
    attributes: normalizeAttributes(raw.attributes),
    traits: Array.isArray(raw.traits) ? raw.traits.map(String).slice(0, 4) : [],
    abilityKit,
    skills,
    appearance: normalizeAppearance(raw.appearance, archetype, fallbackAppearanceSeed),
    status: normalizeStatus(raw.status),
    createdAt: raw.createdAt || new Date().toISOString(),
    joinedAt: options.candidate ? null : (raw.joinedAt || raw.createdAt || new Date().toISOString()),
    generatorVersion: sanitizeText(raw.generatorVersion, GENERATOR_VERSION),
  };
  if (!options.candidate) {
    Object.assign(person, normalizeProgression(raw));
    applyPendingAutoAttributeGrowth(person);
  }
  return person;
}

function normalizeFamousPeople(rawPeople = []) {
  const people = Array.isArray(rawPeople) ? rawPeople : [];
  const seen = new Set();
  return people
    .map((item) => normalizePerson(item))
    .filter((item) => {
      if (!item || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}

function normalizeFamousPersonState(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const candidates = Array.isArray(source.candidates)
    ? source.candidates.map((item) => normalizePerson(item, { candidate: true })).filter(Boolean)
    : [];
  const seek = source.seek && typeof source.seek === 'object' ? source.seek : {};
  return {
    candidates: candidates.slice(0, MAX_CANDIDATES),
    seek: {
      count: Math.max(0, toInteger(seek.count, 0)),
      lastAt: seek.lastAt || null,
    },
  };
}

function createInitialFamousPersonState() {
  return normalizeFamousPersonState({ candidates: [], seek: { count: 0, lastAt: null } });
}

function ensureFamousPersonState(gameState) {
  gameState.famousPeople = normalizeFamousPeople(gameState.famousPeople);
  gameState.famousPersonState = normalizeFamousPersonState(gameState.famousPersonState);
  const acceptedCandidateIds = new Set(gameState.famousPeople.map((person) => person.source?.candidateId).filter(Boolean));
  gameState.famousPersonState.candidates = gameState.famousPersonState.candidates.filter((candidate) => (
    !acceptedCandidateIds.has(candidate.id)
  ));
  return gameState.famousPersonState;
}

function grantBattleExperience(gameState, leaderId, experienceSummary = {}, now = new Date()) {
  const id = sanitizeText(leaderId);
  if (!gameState || !id || id === 'unavailable') return null;
  gameState.famousPeople = normalizeFamousPeople(gameState.famousPeople);
  const person = gameState.famousPeople.find((item) => item.id === id);
  if (!person) return null;

  const gained = Math.max(0, toInteger(experienceSummary?.total, 0));
  const before = normalizeProgression(person);
  person.level = before.level;
  person.experience = before.experience + gained;
  person.totalExperience = before.totalExperience + gained;
  person.freeAttributePoints = before.freeAttributePoints;
  person.earnedAttributePoints = before.earnedAttributePoints;
  person.assignedAttributePoints = before.assignedAttributePoints;
  person.autoAttributeGrowth = before.autoAttributeGrowth;
  person.earnedAutoAttributePoints = before.earnedAutoAttributePoints;
  person.autoGrowthMilestones = before.autoGrowthMilestones;

  let freeAttributePointsGained = 0;
  const autoGrowthMilestoneLevels = [];
  while (person.experience >= getLevelUpExperience(person.level)) {
    person.experience -= getLevelUpExperience(person.level);
    person.level += 1;
    if (person.level % ATTRIBUTE_POINT_MILESTONE === 0) {
      freeAttributePointsGained += ATTRIBUTE_POINTS_PER_MILESTONE;
      autoGrowthMilestoneLevels.push(person.level);
    }
  }
  if (freeAttributePointsGained > 0) {
    person.freeAttributePoints += freeAttributePointsGained;
    person.earnedAttributePoints += freeAttributePointsGained;
  }
  const autoGrowth = applyAutoAttributeGrowth(person, autoGrowthMilestoneLevels);
  person.nextLevelExperience = getLevelUpExperience(person.level);
  const growthDate = now instanceof Date ? now : new Date(now);
  person.lastGrowthAt = Number.isFinite(growthDate.getTime()) ? growthDate.toISOString() : new Date().toISOString();

  return {
    applied: true,
    leaderId: person.id,
    leaderName: person.name,
    experienceGained: gained,
    levelBefore: before.level,
    levelAfter: person.level,
    leveledUp: person.level > before.level,
    experienceBefore: before.experience,
    experienceAfter: person.experience,
    totalExperience: person.totalExperience,
    nextLevelExperience: person.nextLevelExperience,
    freeAttributePointsBefore: before.freeAttributePoints,
    freeAttributePointsAfter: person.freeAttributePoints,
    freeAttributePointsGained,
    autoAttributeGrowthBefore: before.autoAttributeGrowth,
    autoAttributeGrowthAfter: person.autoAttributeGrowth,
    autoAttributeGrowthGained: autoGrowth.attributes,
    autoAttributeGrowthTotal: autoGrowth.total,
    autoGrowthMilestones: autoGrowth.milestones,
  };
}

function assignAttributePoint(gameState, personId, attributeKey, now = new Date()) {
  const id = sanitizeText(personId);
  const key = sanitizeText(attributeKey);
  if (!gameState || !id) {
    return { success: false, error: 'FAMOUS_PERSON_NOT_FOUND', message: '名人不存在' };
  }
  if (!ATTRIBUTE_KEYS.includes(key)) {
    return { success: false, error: 'INVALID_ATTRIBUTE', message: '请选择可分配的六维属性' };
  }
  gameState.famousPeople = normalizeFamousPeople(gameState.famousPeople);
  const person = gameState.famousPeople.find((item) => item.id === id);
  if (!person) {
    return { success: false, error: 'FAMOUS_PERSON_NOT_FOUND', message: '名人不存在' };
  }
  const progression = normalizeProgression(person);
  if (progression.freeAttributePoints <= 0) {
    return { success: false, error: 'NO_FREE_ATTRIBUTE_POINTS', message: '没有可分配属性点' };
  }

  const attributes = normalizeAttributes(person.attributes || {});
  const before = attributes[key];
  attributes[key] = clampAttributeValue(before + 1, before);
  person.attributes = syncAttributeAliases(attributes);
  person.freeAttributePoints = progression.freeAttributePoints - 1;
  person.earnedAttributePoints = progression.earnedAttributePoints;
  person.assignedAttributePoints = {
    ...progression.assignedAttributePoints,
    [key]: Math.max(0, toInteger(progression.assignedAttributePoints[key], 0)) + 1,
  };
  person.autoAttributeGrowth = progression.autoAttributeGrowth;
  person.earnedAutoAttributePoints = progression.earnedAutoAttributePoints;
  person.autoGrowthMilestones = progression.autoGrowthMilestones;
  person.nextLevelExperience = getLevelUpExperience(progression.level);
  const assignedDate = now instanceof Date ? now : new Date(now);
  person.lastAttributeAssignedAt = Number.isFinite(assignedDate.getTime()) ? assignedDate.toISOString() : new Date().toISOString();

  const label = {
    command: '统帅',
    force: '武力',
    intelligence: '智力',
    politics: '政治',
    charisma: '魅力',
    speed: '速度',
  }[key] || key;
  return {
    success: true,
    message: `${person.name} ${label} +1`,
    famousPerson: clone(person),
    famousPersonState: getClientState(gameState),
    assignment: {
      personId: person.id,
      attribute: key,
      attributeLabel: label,
      before,
      after: attributes[key],
      freeAttributePoints: person.freeAttributePoints,
    },
  };
}

function getCandidateIdAsPersonId(candidateId) {
  return String(candidateId || '').replace(/^fpc_/, 'fp_');
}

function makeSkillName(effects = []) {
  const keys = effects.map((effect) => effect.key);
  if (keys.includes('lifesteal') && keys.includes('combo')) return '血刃连袭';
  if (keys.includes('combo') && keys.includes('armorBreak')) return '破阵连击';
  if (keys.includes('ambush') && keys.includes('combo')) return '伏击追袭';
  if (keys.includes('shield') && keys.includes('counter')) return '守势反击';
  if (keys.includes('shield') && keys.includes('morale')) return '固阵振军';
  if (keys.includes('counter') && keys.includes('heal')) return '回锋自守';
  if (keys.includes('burn') && keys.includes('ambush')) return '伏火奇袭';
  if (keys.includes('poison') && keys.includes('armorBreak')) return '蚀甲毒计';
  if (keys.includes('morale') && keys.includes('combo')) return '鼓锋连战';
  if (keys.includes('morale') && keys.includes('heal')) return '振军疗伤';
  if (keys.includes('armorBreak') && keys.includes('shield')) return '破甲护阵';
  return effects.map((effect) => EFFECTS[effect.key]?.label || effect.key).join('');
}

function createSkill(archetype, randomSource = Math.random) {
  const pair = pick(archetype.skillPairs, randomSource) || archetype.skillPairs[0];
  const effects = pair.map((key) => EFFECTS[key].create(rollUnit(randomSource)));
  return {
    id: `skill_${pair.join('_')}`,
    name: makeSkillName(effects),
    type: archetype.roles.includes('military') ? 'battle' : 'support',
    effects,
  };
}

function createAttributes(archetype, randomSource = Math.random) {
  return Object.entries(archetype.attributes).reduce((result, [key, base]) => {
    const variance = Math.floor(rollUnit(randomSource) * 15) - 4;
    result[key] = clampAttributeValue(base + variance, base, ATTRIBUTE_INITIAL_MAX_VALUE);
    return result;
  }, {});
}

function getArchetypePool(sourceType) {
  const source = SOURCE_TYPES[sourceType] || SOURCE_TYPES.seek;
  return ARCHETYPES.filter((archetype) => archetype.roles.some((role) => source.roles.includes(role)));
}

function createFamousPersonCandidate(gameState, payload = {}, now = new Date(), randomSource = Math.random) {
  const requestedSource = SOURCE_TYPES[payload.source] ? payload.source : 'seek';
  const sourceType = ENABLED_SOURCE_TYPES.includes(requestedSource) ? requestedSource : 'seek';
  const pool = getArchetypePool(sourceType);
  const archetype = pick(pool, randomSource) || ARCHETYPES[0];
  const quality = SkillGeneratorService.rollQuality(randomSource);
  const surname = pick(SURNAMES, randomSource) || SURNAMES[0];
  const given = pick(archetype.namePool, randomSource) || archetype.namePool[0];
  const title = pick(archetype.titlePool, randomSource) || archetype.titlePool[0];
  const rollId = Math.floor(rollUnit(randomSource) * 1000000).toString(36).padStart(4, '0');
  const activeCityId = gameState.activeCityId || CityService.CAPITAL_CITY_ID;
  const seed = `${gameState.playerId || 'player'}:${now.getTime()}:${rollId}`;
  const abilityArchetype = SkillGeneratorService.normalizeAbilityArchetype(archetype.abilityArchetype || archetype.id);
  const abilityKit = SkillGeneratorService.createAbilityKit({ archetype: archetype.id, abilityArchetype, quality, source: sourceType, seed }, randomSource);
  const activeSkill = SkillGeneratorService.getActiveBattleSkill(abilityKit);
  return {
    id: `fpc_${now.getTime().toString(36)}_${rollId}`,
    name: `${surname}${given}`,
    title,
    eraBorn: Math.max(0, toInteger(gameState.currentEra, 0)),
    source: {
      type: sourceType,
      label: SOURCE_TYPES[sourceType].label,
      cityId: activeCityId,
      seed,
    },
    archetype: archetype.id,
    archetypeLabel: archetype.label,
    abilityArchetype,
    quality,
    qualityLabel: SkillGeneratorService.getQualityLabel(quality),
    roles: [...archetype.roles],
    attributes: createAttributes(archetype, randomSource),
    traits: [archetype.label, SkillGeneratorService.getQualityLabel(quality)],
    abilityKit,
    skills: activeSkill ? [activeSkill] : [],
    appearance: createAppearance(archetype, seed, randomSource),
    status: normalizeStatus({ assigned: 'candidate', loyalty: 55 + Math.floor(rollUnit(randomSource) * 30) }),
    createdAt: now.toISOString(),
    joinedAt: null,
    generatorVersion: GENERATOR_VERSION,
  };
}

function getSeekAvailability(gameState) {
  const state = ensureFamousPersonState(gameState);
  const currentEra = Math.max(0, toInteger(gameState.currentEra, 0));
  if (currentEra < MIN_SEEK_ERA) {
    return {
      available: false,
      reason: 'ERA_LOCKED',
      message: '城邦时代后才会出现稳定的寻访线索',
    };
  }
  if (state.candidates.length >= MAX_CANDIDATES) {
    return {
      available: false,
      reason: 'CANDIDATES_FULL',
      message: '候选名人已满，请先接纳或放弃一位候选',
    };
  }
  return { available: true, reason: null, message: null };
}

function seekFamousPerson(gameState, payload = {}, now = new Date(), randomSource = Math.random) {
  const availability = getSeekAvailability(gameState);
  if (!availability.available) {
    return { success: false, error: availability.reason, message: availability.message };
  }
  const state = ensureFamousPersonState(gameState);
  const candidate = createFamousPersonCandidate(gameState, payload, now, randomSource);
  state.candidates = [candidate, ...state.candidates].slice(0, MAX_CANDIDATES);
  state.seek = {
    count: Math.max(0, toInteger(state.seek?.count, 0)) + 1,
    lastAt: now.toISOString(),
  };
  return {
    success: true,
    message: `寻访发现：${candidate.name}`,
    candidate: clone(candidate),
    famousPersonState: getClientState(gameState),
  };
}

function acceptFamousPerson(gameState, candidateId, now = new Date()) {
  const state = ensureFamousPersonState(gameState);
  const id = String(candidateId || '').trim();
  const candidate = state.candidates.find((item) => item.id === id);
  if (!candidate) {
    return { success: false, error: 'FAMOUS_PERSON_CANDIDATE_NOT_FOUND', message: '候选名人不存在' };
  }
  const personId = getCandidateIdAsPersonId(candidate.id);
  if (gameState.famousPeople.some((person) => person.id === personId || person.source?.candidateId === candidate.id)) {
    state.candidates = state.candidates.filter((item) => item.id !== candidate.id);
    return { success: false, error: 'FAMOUS_PERSON_ALREADY_ACCEPTED', message: '这位名人已经加入' };
  }
  const person = normalizePerson({
    ...candidate,
    id: personId,
    source: { ...candidate.source, candidateId: candidate.id },
    status: { ...candidate.status, assigned: 'idle' },
    joinedAt: now.toISOString(),
  });
  person.appearance = clone(candidate.appearance);
  gameState.famousPeople = [person, ...gameState.famousPeople];
  state.candidates = state.candidates.filter((item) => item.id !== candidate.id);
  return {
    success: true,
    message: `${person.name}已加入文明`,
    famousPerson: clone(person),
    famousPersonState: getClientState(gameState),
  };
}

function dismissFamousPersonCandidate(gameState, candidateId) {
  const state = ensureFamousPersonState(gameState);
  const id = String(candidateId || '').trim();
  const before = state.candidates.length;
  state.candidates = state.candidates.filter((item) => item.id !== id);
  if (state.candidates.length === before) {
    return { success: false, error: 'FAMOUS_PERSON_CANDIDATE_NOT_FOUND', message: '候选名人不存在' };
  }
  return {
    success: true,
    message: '已放弃该候选',
    famousPersonState: getClientState(gameState),
  };
}

function getClientState(gameState = {}) {
  const state = ensureFamousPersonState(gameState);
  const availability = getSeekAvailability(gameState);
  return {
    people: clone(gameState.famousPeople),
    candidates: clone(state.candidates),
    count: gameState.famousPeople.length,
    candidateCount: state.candidates.length,
    maxCandidates: MAX_CANDIDATES,
    generatorVersion: GENERATOR_VERSION,
    seek: {
      available: availability.available,
      reason: availability.reason,
      message: availability.message,
      minEra: MIN_SEEK_ERA,
      count: state.seek.count,
      lastAt: state.seek.lastAt,
      sources: ENABLED_SOURCE_TYPES.map((id) => ({ id, label: SOURCE_TYPES[id].label })),
    },
  };
}

module.exports = {
  GENERATOR_VERSION,
  APPEARANCE_VERSION,
  MIN_SEEK_ERA,
  MAX_CANDIDATES,
  ENABLED_SOURCE_TYPES,
  BASE_LEVEL,
  ATTRIBUTE_POINT_MILESTONE,
  ATTRIBUTE_POINTS_PER_MILESTONE,
  QUALITY_AUTO_GROWTH_POINTS,
  AUTO_GROWTH_WEIGHTS,
  ATTRIBUTE_KEYS,
  ARCHETYPES,
  EFFECTS,
  getLevelUpExperience,
  normalizeProgression,
  calculateAutoAttributeGrowth,
  applyAutoAttributeGrowth,
  grantBattleExperience,
  assignAttributePoint,
  createInitialFamousPersonState,
  normalizeFamousPeople,
  normalizeFamousPersonState,
  ensureFamousPersonState,
  createFamousPersonCandidate,
  makeSkillName,
  getClientState,
  seekFamousPerson,
  acceptFamousPerson,
  dismissFamousPersonCandidate,
};
