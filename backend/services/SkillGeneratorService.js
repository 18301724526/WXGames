const GENERATOR_VERSION = 'skill-gen-v1';

const FIRST_BATCH_BATTLE_EFFECTS = Object.freeze([
  'directDamage',
  'secondHit',
  'firstStrike',
  'lifesteal',
  'heal',
  'shield',
  'attributeBonus',
]);

const CIVIL_EFFECTS = Object.freeze([
  'resourceOutputPct',
  'allBasicOutputPct',
  'constructionSpeedPct',
  'constructionCostPct',
  'knowledgeOutputPct',
  'populationCapPct',
  'happinessFlat',
  'trainingSpeedPct',
  'eventRewardPct',
  'eventRiskReductionPct',
  'settlementPacifyPct',
  'famousRetentionPct',
  'diplomacyBonusPct',
  'scoutReportBonusPct',
  'cityStabilityPct',
]);

const QUALITY_BUDGETS = Object.freeze({
  common: { active: 100, passive: 40, scoutActive: 85, scoutTrait: 45, civilPrimary: 60, civilSecondary: 35 },
  good: { active: 120, passive: 50, scoutActive: 100, scoutTrait: 55, civilPrimary: 80, civilSecondary: 45 },
  great: { active: 145, passive: 65, scoutActive: 120, scoutTrait: 70, civilPrimary: 105, civilSecondary: 60 },
  legendary: { active: 170, passive: 80, scoutActive: 140, scoutTrait: 90, civilPrimary: 135, civilSecondary: 80 },
});

const QUALITY_LABELS = Object.freeze({
  common: '一般',
  good: '良才',
  great: '英杰',
  legendary: '传奇',
});

const ARCHETYPE_DOMAINS = Object.freeze({
  commander: { domain: 'battle', battlePolicy: 'useBattleSkill' },
  vanguard: { domain: 'battle', battlePolicy: 'useBattleSkill' },
  strategist: { domain: 'battle', battlePolicy: 'useBattleSkill' },
  governor: { domain: 'civil', battlePolicy: 'basicAttackOnly' },
  charmer: { domain: 'civil', battlePolicy: 'basicAttackOnly' },
  scout: { domain: 'hybrid', battlePolicy: 'useBattleSkill' },
});

const ACTIVE_TEMPLATES = Object.freeze({
  commander: [
    {
      id: 'hold_line',
      name: '固阵压前',
      category: 'guard',
      damageType: 'blade',
      multiplier: 1.22,
      cooldown: 3,
      cost: 95,
      effects: [{ key: 'directDamage', value: 1.22 }, { key: 'shield', value: 0.08 }],
    },
    {
      id: 'command_strike',
      name: '统军破阵',
      category: 'blade',
      damageType: 'blade',
      multiplier: 1.36,
      cooldown: 3,
      cost: 110,
      effects: [{ key: 'directDamage', value: 1.36 }, { key: 'attributeBonus', attribute: 'command', value: 6 }],
    },
  ],
  vanguard: [
    {
      id: 'blood_assault',
      name: '血刃破阵',
      category: 'blade',
      damageType: 'blade',
      multiplier: 1.42,
      cooldown: 3,
      cost: 118,
      effects: [{ key: 'directDamage', value: 1.42 }, { key: 'lifesteal', value: 0.12 }],
    },
    {
      id: 'double_cleave',
      name: '裂阵双斩',
      category: 'blade',
      damageType: 'blade',
      multiplier: 1.28,
      cooldown: 3,
      cost: 112,
      effects: [{ key: 'directDamage', value: 1.28 }, { key: 'secondHit', multiplier: 0.32 }],
    },
  ],
  strategist: [
    {
      id: 'mind_break',
      name: '摧阵奇谋',
      category: 'strategy',
      damageType: 'strategy',
      multiplier: 1.46,
      cooldown: 3,
      cost: 120,
      effects: [{ key: 'directDamage', value: 1.46 }, { key: 'attributeBonus', attribute: 'intelligence', value: 6 }],
    },
    {
      id: 'hidden_plan',
      name: '奇策连环',
      category: 'strategy',
      damageType: 'strategy',
      multiplier: 1.26,
      cooldown: 3,
      cost: 112,
      effects: [{ key: 'directDamage', value: 1.26 }, { key: 'secondHit', multiplier: 0.28 }],
    },
  ],
  scout: [
    {
      id: 'first_probe',
      name: '先机穿插',
      category: 'strategy',
      damageType: 'strategy',
      multiplier: 1.18,
      cooldown: 4,
      cost: 82,
      effects: [{ key: 'firstStrike', value: 0.22 }, { key: 'directDamage', value: 1.18 }],
      castConditions: [{ type: 'firstOwnAction' }],
    },
    {
      id: 'swift_feint',
      name: '疾行扰阵',
      category: 'strategy',
      damageType: 'strategy',
      multiplier: 1.14,
      cooldown: 3,
      cost: 88,
      effects: [{ key: 'directDamage', value: 1.14 }, { key: 'secondHit', multiplier: 0.22 }],
    },
  ],
});

const PASSIVE_TEMPLATES = Object.freeze({
  commander: [
    { id: 'steady_command', name: '临阵坚守', effects: [{ key: 'attributeBonus', attribute: 'command', value: 6 }], cost: 35 },
    { id: 'guard_order', name: '整军守势', effects: [{ key: 'attributeBonus', attribute: 'command', value: 8 }], cost: 45 },
  ],
  vanguard: [
    { id: 'sharp_edge', name: '锐锋', effects: [{ key: 'attributeBonus', attribute: 'force', value: 6 }], cost: 35 },
    { id: 'battle_pace', name: '疾斗', effects: [{ key: 'attributeBonus', attribute: 'speed', value: 6 }], cost: 35 },
  ],
  strategist: [
    { id: 'clear_plan', name: '明策', effects: [{ key: 'attributeBonus', attribute: 'intelligence', value: 7 }], cost: 40 },
    { id: 'quiet_command', name: '静谋', effects: [{ key: 'attributeBonus', attribute: 'command', value: 5 }], cost: 30 },
  ],
});

const CIVIL_TEMPLATES = Object.freeze({
  governor: {
    primary: [
      { id: 'field_admin', name: '督田理赋', category: 'production', effects: [{ key: 'resourceOutputPct', resource: 'food', value: 0.1 }], cost: 58 },
      { id: 'works_admin', name: '督工营造', category: 'construction', effects: [{ key: 'constructionSpeedPct', value: 0.08 }], cost: 62 },
    ],
    secondary: [
      { id: 'granary_order', name: '仓廪整备', category: 'governance', effects: [{ key: 'populationCapPct', value: 0.06 }], cost: 34 },
      { id: 'training_register', name: '兵册整训', category: 'production', effects: [{ key: 'trainingSpeedPct', value: 0.05 }], cost: 35 },
    ],
  },
  charmer: {
    primary: [
      { id: 'public_trust', name: '安众得望', category: 'reputation', effects: [{ key: 'happinessFlat', value: 5 }], cost: 58 },
      { id: 'event_grace', name: '善应民情', category: 'reputation', effects: [{ key: 'eventRewardPct', value: 0.08 }], cost: 60 },
    ],
    secondary: [
      { id: 'soft_words', name: '怀柔劝附', category: 'reputation', effects: [{ key: 'settlementPacifyPct', value: 0.05 }], cost: 34 },
      { id: 'risk_sense', name: '察言避险', category: 'intel', effects: [{ key: 'eventRiskReductionPct', value: 0.05 }], cost: 35 },
    ],
  },
});

const SCOUT_TRAITS = Object.freeze([
  { id: 'trail_reader', name: '识径', category: 'intel', effects: [{ key: 'scoutReportBonusPct', value: 0.08 }], cost: 42 },
  { id: 'swift_march', name: '疾行', category: 'intel', effects: [{ key: 'scoutReportBonusPct', value: 0.06 }, { key: 'attributeBonus', attribute: 'speed', value: 4 }], cost: 52 },
]);

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
  if (!Array.isArray(list) || !list.length) return null;
  return list[Math.floor(rollUnit(randomSource) * list.length)];
}

function sanitizeText(value, fallback = '') {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

function normalizeQuality(value) {
  return Object.prototype.hasOwnProperty.call(QUALITY_BUDGETS, value) ? value : 'common';
}

function getQualityLabel(value) {
  return QUALITY_LABELS[normalizeQuality(value)];
}

function rollQuality(randomSource = Math.random) {
  const roll = rollUnit(randomSource);
  if (roll < 0.324) return 'common';
  if (roll < 0.584) return 'good';
  if (roll < 0.944) return 'great';
  return 'legendary';
}

function normalizeAbilityArchetype(value, fallback = 'vanguard') {
  return Object.prototype.hasOwnProperty.call(ARCHETYPE_DOMAINS, value) ? value : fallback;
}

function getAbilityMeta(abilityArchetype) {
  return ARCHETYPE_DOMAINS[normalizeAbilityArchetype(abilityArchetype)] || ARCHETYPE_DOMAINS.vanguard;
}

function addBaseConditions(conditions = []) {
  const result = [{ type: 'cooldownReady' }, { type: 'targetAlive' }];
  conditions.forEach((condition) => {
    if (!condition || typeof condition !== 'object' || !condition.type) return;
    if (result.some((item) => item.type === condition.type)) return;
    result.push({ ...condition });
  });
  return result;
}

function clampActiveForQuality(template, quality, scout = false) {
  const budgets = QUALITY_BUDGETS[normalizeQuality(quality)];
  const limit = scout ? budgets.scoutActive : budgets.active;
  const active = clone(template);
  if (active.cost > limit) {
    const ratio = Math.max(0.82, limit / Math.max(1, active.cost));
    active.multiplier = round2(Math.max(1.1, active.multiplier * ratio));
    active.cost = limit;
    active.effects = active.effects.map((effect) => {
      if (effect.key === 'directDamage') return { ...effect, value: active.multiplier };
      if (effect.key === 'secondHit') return { ...effect, multiplier: round2((Number(effect.multiplier) || 0.25) * ratio) };
      return effect;
    });
  }
  return { active, limit };
}

function createActiveSkill(abilityArchetype, quality, randomSource = Math.random) {
  const archetype = normalizeAbilityArchetype(abilityArchetype);
  const scout = archetype === 'scout';
  const templates = ACTIVE_TEMPLATES[archetype] || ACTIVE_TEMPLATES.vanguard;
  const template = pick(templates, randomSource) || templates[0];
  const { active, limit } = clampActiveForQuality(template, quality, scout);
  return {
    id: `skill_${archetype}_${active.id}`,
    name: active.name,
    slot: 'activeSkill',
    kind: 'active',
    type: 'battle',
    category: active.category,
    damageType: active.damageType,
    multiplier: active.multiplier,
    cooldown: active.cooldown,
    castPolicy: 'conditional',
    castConditions: addBaseConditions(active.castConditions),
    effects: active.effects,
    budget: {
      tier: normalizeQuality(quality),
      cost: active.cost,
      limit,
    },
    generatorVersion: GENERATOR_VERSION,
  };
}

function createBattlePassive(abilityArchetype, quality, randomSource = Math.random) {
  const archetype = normalizeAbilityArchetype(abilityArchetype);
  const templates = PASSIVE_TEMPLATES[archetype] || PASSIVE_TEMPLATES.vanguard;
  const template = clone(pick(templates, randomSource) || templates[0]);
  const limit = QUALITY_BUDGETS[normalizeQuality(quality)].passive;
  return {
    id: `trait_${archetype}_${template.id}`,
    name: template.name,
    slot: 'passiveTrait',
    kind: 'passive',
    trigger: 'preBattle',
    effects: template.effects,
    budget: {
      tier: normalizeQuality(quality),
      cost: Math.min(template.cost, limit),
      limit,
    },
    generatorVersion: GENERATOR_VERSION,
  };
}

function createCivilAbility(abilityArchetype, slot, quality, randomSource = Math.random) {
  const archetype = normalizeAbilityArchetype(abilityArchetype, 'governor');
  const templateGroup = CIVIL_TEMPLATES[archetype] || CIVIL_TEMPLATES.governor;
  const groupKey = slot === 'civilSecondary' ? 'secondary' : 'primary';
  const template = clone(pick(templateGroup[groupKey], randomSource) || templateGroup[groupKey][0]);
  const limitKey = slot === 'civilSecondary' ? 'civilSecondary' : 'civilPrimary';
  const limit = QUALITY_BUDGETS[normalizeQuality(quality)][limitKey];
  return {
    id: `civil_${archetype}_${template.id}`,
    name: template.name,
    slot,
    kind: 'civil',
    category: template.category,
    trigger: 'passiveStored',
    implementationStatus: 'storedOnly',
    effects: template.effects,
    budget: {
      tier: normalizeQuality(quality),
      cost: Math.min(template.cost, limit),
      limit,
    },
    generatorVersion: GENERATOR_VERSION,
  };
}

function createScoutTrait(quality, randomSource = Math.random) {
  const template = clone(pick(SCOUT_TRAITS, randomSource) || SCOUT_TRAITS[0]);
  const limit = QUALITY_BUDGETS[normalizeQuality(quality)].scoutTrait;
  return {
    id: `trait_scout_${template.id}`,
    name: template.name,
    slot: 'scoutTrait',
    kind: 'passive',
    category: template.category,
    trigger: 'passiveStored',
    implementationStatus: 'storedOnly',
    effects: template.effects,
    budget: {
      tier: normalizeQuality(quality),
      cost: Math.min(template.cost, limit),
      limit,
    },
    generatorVersion: GENERATOR_VERSION,
  };
}

function createAbilityKit(options = {}, randomSource = Math.random) {
  const abilityArchetype = normalizeAbilityArchetype(options.abilityArchetype || options.archetype);
  const quality = normalizeQuality(options.quality);
  const meta = getAbilityMeta(abilityArchetype);
  const abilities = [];
  if (meta.domain === 'civil') {
    abilities.push(createCivilAbility(abilityArchetype, 'civilPrimary', quality, randomSource));
    abilities.push(createCivilAbility(abilityArchetype, 'civilSecondary', quality, randomSource));
  } else if (meta.domain === 'hybrid') {
    abilities.push(createActiveSkill('scout', quality, randomSource));
    abilities.push(createScoutTrait(quality, randomSource));
  } else {
    abilities.push(createActiveSkill(abilityArchetype, quality, randomSource));
    abilities.push(createBattlePassive(abilityArchetype, quality, randomSource));
  }
  return {
    archetype: abilityArchetype,
    quality,
    qualityLabel: getQualityLabel(quality),
    domain: meta.domain,
    battlePolicy: meta.battlePolicy,
    abilities,
    budget: clone(QUALITY_BUDGETS[quality]),
    availableEffectPool: [...FIRST_BATCH_BATTLE_EFFECTS],
    generatorVersion: GENERATOR_VERSION,
  };
}

function isKnownEffect(effect = {}) {
  return Boolean(effect && typeof effect === 'object' && (
    FIRST_BATCH_BATTLE_EFFECTS.includes(effect.key) || CIVIL_EFFECTS.includes(effect.key)
  ));
}

function normalizeAbility(raw = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const effects = Array.isArray(raw.effects)
    ? raw.effects.filter(isKnownEffect).map((effect) => ({ ...effect }))
    : [];
  if (!effects.length && raw.kind !== 'active') return null;
  return {
    ...raw,
    id: sanitizeText(raw.id, 'ability_generated'),
    name: sanitizeText(raw.name, '能力'),
    slot: sanitizeText(raw.slot, raw.kind === 'active' ? 'activeSkill' : 'passiveTrait'),
    kind: sanitizeText(raw.kind, raw.type === 'battle' ? 'active' : 'passive'),
    effects,
    generatorVersion: sanitizeText(raw.generatorVersion, GENERATOR_VERSION),
  };
}

function createLegacyAbilityKit(archetype, abilityArchetype, quality, skills = []) {
  const activeSkill = Array.isArray(skills) ? skills.find((skill) => skill?.type === 'battle' || skill?.kind === 'active') : null;
  const meta = getAbilityMeta(abilityArchetype);
  const abilities = [];
  if (activeSkill && meta.battlePolicy === 'useBattleSkill') {
    abilities.push({
      ...clone(activeSkill),
      slot: 'activeSkill',
      kind: 'active',
      castPolicy: activeSkill.castPolicy || 'conditional',
      castConditions: addBaseConditions(activeSkill.castConditions),
      generatorVersion: activeSkill.generatorVersion || 'legacy-skill',
    });
  }
  return {
    archetype: normalizeAbilityArchetype(abilityArchetype),
    quality: normalizeQuality(quality),
    qualityLabel: getQualityLabel(quality),
    domain: meta.domain,
    battlePolicy: meta.battlePolicy,
    abilities,
    budget: clone(QUALITY_BUDGETS[normalizeQuality(quality)]),
    availableEffectPool: [...FIRST_BATCH_BATTLE_EFFECTS],
    generatorVersion: sanitizeText(archetype?.generatorVersion, GENERATOR_VERSION),
  };
}

function normalizeAbilityKit(raw = {}, options = {}) {
  const abilityArchetype = normalizeAbilityArchetype(
    raw?.archetype || options.abilityArchetype || options.archetype,
    'vanguard',
  );
  const quality = normalizeQuality(raw?.quality || options.quality);
  const meta = getAbilityMeta(abilityArchetype);
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.abilities)) {
    return createLegacyAbilityKit(raw, abilityArchetype, quality, options.skills);
  }
  const abilities = raw.abilities.map(normalizeAbility).filter(Boolean);
  return {
    archetype: abilityArchetype,
    quality,
    qualityLabel: sanitizeText(raw.qualityLabel, getQualityLabel(quality)),
    domain: sanitizeText(raw.domain, meta.domain),
    battlePolicy: sanitizeText(raw.battlePolicy, meta.battlePolicy),
    abilities,
    budget: raw.budget && typeof raw.budget === 'object' ? clone(raw.budget) : clone(QUALITY_BUDGETS[quality]),
    availableEffectPool: Array.isArray(raw.availableEffectPool) ? [...raw.availableEffectPool] : [...FIRST_BATCH_BATTLE_EFFECTS],
    generatorVersion: sanitizeText(raw.generatorVersion, GENERATOR_VERSION),
  };
}

function getActiveBattleSkill(abilityKit = {}) {
  if (abilityKit?.battlePolicy === 'basicAttackOnly') return null;
  const abilities = Array.isArray(abilityKit?.abilities) ? abilityKit.abilities : [];
  return abilities.find((ability) => (
    ability
    && ability.kind === 'active'
    && (ability.type === 'battle' || ability.slot === 'activeSkill')
  )) || null;
}

module.exports = {
  GENERATOR_VERSION,
  FIRST_BATCH_BATTLE_EFFECTS,
  CIVIL_EFFECTS,
  QUALITY_BUDGETS,
  QUALITY_LABELS,
  rollQuality,
  getQualityLabel,
  normalizeQuality,
  normalizeAbilityArchetype,
  createAbilityKit,
  normalizeAbilityKit,
  getActiveBattleSkill,
};

