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

const SCOUT_EFFECTS = Object.freeze([
  'firstStrike',
  'directDamage',
  'secondHit',
  'attributeBonus',
  'scoutReportBonusPct',
]);

const EFFECT_LABELS = Object.freeze({
  directDamage: '直接伤害',
  secondHit: '二段伤害',
  firstStrike: '先手',
  lifesteal: '吸血',
  heal: '治疗',
  shield: '护盾',
  attributeBonus: '属性修正',
  resourceOutputPct: '资源产出',
  allBasicOutputPct: '基础产出',
  constructionSpeedPct: '建造速度',
  constructionCostPct: '建造消耗',
  knowledgeOutputPct: '知识产出',
  populationCapPct: '人口上限',
  happinessFlat: '幸福度',
  trainingSpeedPct: '训练速度',
  eventRewardPct: '事件收益',
  eventRiskReductionPct: '事件风险',
  settlementPacifyPct: '安抚效率',
  famousRetentionPct: '名人说服',
  diplomacyBonusPct: '外交加成',
  scoutReportBonusPct: '侦查情报',
  cityStabilityPct: '城市稳定',
});

const LEGACY_EFFECT_MIGRATIONS = Object.freeze({
  combo: 'secondHit',
  ambush: 'firstStrike',
  morale: 'attributeBonus',
  counter: null,
});

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

function getDefaultEffectPool(domain) {
  if (domain === 'civil') return [...CIVIL_EFFECTS];
  if (domain === 'hybrid') return [...SCOUT_EFFECTS];
  return [...FIRST_BATCH_BATTLE_EFFECTS];
}

function normalizeEffectPool(pool, domain) {
  const allowed = new Set(getDefaultEffectPool(domain));
  const requested = Array.isArray(pool)
    ? pool.map(String).filter((key) => allowed.has(key))
    : [];
  const unique = [...new Set(requested)];
  return unique.length ? unique : getDefaultEffectPool(domain);
}

function createGeneratorInput(options = {}, abilityArchetype, quality, meta) {
  const source = sanitizeText(options.source, 'seek');
  const seed = sanitizeText(options.seed, `${source}:${abilityArchetype}:${quality}`);
  return {
    quality,
    archetype: abilityArchetype,
    source,
    seed,
    availableEffectPool: normalizeEffectPool(options.availableEffectPool, meta.domain),
    generatorVersion: GENERATOR_VERSION,
  };
}

function normalizeGeneratorInput(raw = {}, fallback = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const abilityArchetype = normalizeAbilityArchetype(source.archetype || fallback.abilityArchetype || fallback.archetype);
  const quality = normalizeQuality(source.quality || fallback.quality);
  const meta = getAbilityMeta(abilityArchetype);
  return {
    quality,
    archetype: abilityArchetype,
    source: sanitizeText(source.source || fallback.source, 'seek'),
    seed: sanitizeText(source.seed || fallback.seed, `${source.source || fallback.source || 'seek'}:${abilityArchetype}:${quality}`),
    availableEffectPool: normalizeEffectPool(source.availableEffectPool || fallback.availableEffectPool, meta.domain),
    generatorVersion: GENERATOR_VERSION,
  };
}

function normalizeEffect(raw = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const legacyKey = raw.key;
  const key = Object.prototype.hasOwnProperty.call(LEGACY_EFFECT_MIGRATIONS, legacyKey)
    ? LEGACY_EFFECT_MIGRATIONS[legacyKey]
    : legacyKey;
  if (!key || !EFFECT_LABELS[key]) return null;
  const migratedFrom = key !== legacyKey ? legacyKey : raw.migratedFrom;
  if (key === 'secondHit') {
    const multiplier = Number(raw.multiplier ?? raw.value ?? raw.chance);
    return {
      key,
      multiplier: Number.isFinite(multiplier) ? round2(Math.max(0.18, Math.min(0.36, multiplier))) : 0.3,
      ...(migratedFrom ? { migratedFrom } : {}),
    };
  }
  if (key === 'firstStrike') {
    const value = Number(raw.value ?? raw.chance);
    return {
      key,
      value: Number.isFinite(value) ? round2(Math.max(0.16, Math.min(0.32, value))) : 0.22,
      ...(migratedFrom ? { migratedFrom } : {}),
    };
  }
  if (key === 'attributeBonus') {
    const value = Number(raw.value);
    return {
      key,
      attribute: raw.attribute || raw.keyAttribute || 'command',
      value: Number.isFinite(value) && Math.abs(value) >= 1 ? Math.round(value) : 5,
      ...(migratedFrom ? { migratedFrom } : {}),
    };
  }
  return {
    ...raw,
    key,
    ...(migratedFrom ? { migratedFrom } : {}),
  };
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

function describeEffects(effects = []) {
  return effects
    .map((effect) => EFFECT_LABELS[effect?.key] || effect?.key)
    .filter(Boolean)
    .join(' / ');
}

function getAttributeLabel(key = '') {
  return {
    command: '统帅',
    force: '武力',
    intelligence: '智力',
    strategy: '智力',
    politics: '政治',
    charisma: '魅力',
    speed: '速度',
  }[key] || key || '属性';
}

function formatPercent(value, fallback = 0) {
  const numeric = Number.isFinite(Number(value)) ? Number(value) : fallback;
  return `${Math.round(numeric * 100)}%`;
}

function describeEffectSentence(effect = {}, ability = {}) {
  if (effect.key === 'directDamage') {
    return ability.damageType === 'strategy'
      ? '发动战法攻击目标，造成一次谋略伤害。'
      : '发动战法攻击目标，造成一次兵刃伤害。';
  }
  if (effect.key === 'secondHit') return '造成伤害后追加一次追击（追击：根据本次攻击的一部分伤害再次打击目标）。';
  if (effect.key === 'firstStrike') return '首次出手时抢先压制目标，并追加一次先机打击。';
  if (effect.key === 'lifesteal') return '施加倒戈（倒戈：将敌方本次损失兵力的一部分转换为自己的兵力）。';
  if (effect.key === 'heal') return '恢复我方一部分兵力。';
  if (effect.key === 'shield') return '获得守御，可抵消一部分伤害。';
  if (effect.key === 'attributeBonus') {
    const attribute = getAttributeLabel(effect.attribute || effect.keyAttribute);
    const value = Math.round(Number(effect.value) || 0);
    if (ability.kind === 'passive' || ability.slot === 'passiveTrait') return `战斗开始前，自己的${attribute}提高 ${value} 点。`;
    return `发动后，本场战斗中自己的${attribute}提高 ${value} 点。`;
  }
  if (effect.key === 'resourceOutputPct') return `${effect.resource === 'food' ? '粮食' : '资源'}产出提高 ${formatPercent(effect.value)}。`;
  if (effect.key === 'allBasicOutputPct') return `基础资源产出提高 ${formatPercent(effect.value)}。`;
  if (effect.key === 'constructionSpeedPct') return `建造速度提高 ${formatPercent(effect.value)}。`;
  if (effect.key === 'constructionCostPct') return `建造消耗降低 ${formatPercent(effect.value)}。`;
  if (effect.key === 'knowledgeOutputPct') return `知识产出提高 ${formatPercent(effect.value)}。`;
  if (effect.key === 'populationCapPct') return `人口上限提高 ${formatPercent(effect.value)}。`;
  if (effect.key === 'happinessFlat') return `幸福度提高 ${Math.round(Number(effect.value) || 0)} 点。`;
  if (effect.key === 'trainingSpeedPct') return `训练速度提高 ${formatPercent(effect.value)}。`;
  if (effect.key === 'eventRewardPct') return `事件奖励提高 ${formatPercent(effect.value)}。`;
  if (effect.key === 'eventRiskReductionPct') return `事件风险降低 ${formatPercent(effect.value)}。`;
  if (effect.key === 'settlementPacifyPct') return `安抚效率提高 ${formatPercent(effect.value)}。`;
  if (effect.key === 'famousRetentionPct') return `名人说服成功率提高 ${formatPercent(effect.value)}。`;
  if (effect.key === 'diplomacyBonusPct') return `外交收益提高 ${formatPercent(effect.value)}。`;
  if (effect.key === 'scoutReportBonusPct') return `侦查情报质量提高 ${formatPercent(effect.value)}。`;
  if (effect.key === 'cityStabilityPct') return `城市稳定提高 ${formatPercent(effect.value)}。`;
  return '';
}

function describePlayerFacingEffects(ability = {}) {
  const effects = Array.isArray(ability.effects) ? ability.effects : [];
  const hasDirectDamage = effects.some((effect) => effect?.key === 'directDamage');
  const hasLifesteal = effects.some((effect) => effect?.key === 'lifesteal');
  if (hasDirectDamage && hasLifesteal) {
    const damageText = ability.damageType === 'strategy' ? '谋略伤害' : '兵刃伤害';
    return `发动战法攻击目标，造成一次${damageText}，并施加倒戈（倒戈：将敌方本次损失兵力的一部分转换为自己的兵力）。`;
  }
  return effects.map((effect) => describeEffectSentence(effect, ability)).filter(Boolean).join('');
}

function describeAbility(ability = {}) {
  const effectsText = describePlayerFacingEffects(ability) || describeEffects(ability.effects) || '暂无具体效果。';
  return effectsText;
}

function sanitizeAbilityDescription(value = '') {
  const text = sanitizeText(value);
  if (!text) return '';
  if (/自身行动|冷却\s*\d*\s*次|冷却就绪|目标存活|直接伤害|属性修正|二段伤害|吸血|当前阶段|当前仅展示|后续接入|实际收益|实际侦查|再次释放|等自己出手|再出手|才能再放|再放前/.test(text)) {
    return '';
  }
  return text;
}

function withAbilityDescription(ability = {}) {
  const fallback = describeAbility(ability);
  const existing = sanitizeAbilityDescription(ability.description);
  return {
    ...ability,
    description: existing || fallback,
  };
}

function templateFitsEffectPool(template = {}, effectPool = []) {
  const allowed = new Set(Array.isArray(effectPool) ? effectPool : []);
  if (!allowed.size) return true;
  const effects = Array.isArray(template.effects) ? template.effects : [];
  return effects.every((effect) => allowed.has(effect.key));
}

function filterTemplatesForPool(templates = [], effectPool = []) {
  const filtered = templates.filter((template) => templateFitsEffectPool(template, effectPool));
  return filtered.length ? filtered : templates;
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

function createActiveSkill(abilityArchetype, quality, randomSource = Math.random, effectPool = null) {
  const archetype = normalizeAbilityArchetype(abilityArchetype);
  const scout = archetype === 'scout';
  const templates = filterTemplatesForPool(ACTIVE_TEMPLATES[archetype] || ACTIVE_TEMPLATES.vanguard, effectPool);
  const template = pick(templates, randomSource) || templates[0];
  const { active, limit } = clampActiveForQuality(template, quality, scout);
  return withAbilityDescription({
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
  });
}

function createBattlePassive(abilityArchetype, quality, randomSource = Math.random, effectPool = null) {
  const archetype = normalizeAbilityArchetype(abilityArchetype);
  const templates = filterTemplatesForPool(PASSIVE_TEMPLATES[archetype] || PASSIVE_TEMPLATES.vanguard, effectPool);
  const template = clone(pick(templates, randomSource) || templates[0]);
  const limit = QUALITY_BUDGETS[normalizeQuality(quality)].passive;
  return withAbilityDescription({
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
  });
}

function createCivilAbility(abilityArchetype, slot, quality, randomSource = Math.random, effectPool = null) {
  const archetype = normalizeAbilityArchetype(abilityArchetype, 'governor');
  const templateGroup = CIVIL_TEMPLATES[archetype] || CIVIL_TEMPLATES.governor;
  const groupKey = slot === 'civilSecondary' ? 'secondary' : 'primary';
  const templates = filterTemplatesForPool(templateGroup[groupKey], effectPool);
  const template = clone(pick(templates, randomSource) || templates[0]);
  const limitKey = slot === 'civilSecondary' ? 'civilSecondary' : 'civilPrimary';
  const limit = QUALITY_BUDGETS[normalizeQuality(quality)][limitKey];
  return withAbilityDescription({
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
  });
}

function createScoutTrait(quality, randomSource = Math.random, effectPool = null) {
  const templates = filterTemplatesForPool(SCOUT_TRAITS, effectPool);
  const template = clone(pick(templates, randomSource) || templates[0]);
  const limit = QUALITY_BUDGETS[normalizeQuality(quality)].scoutTrait;
  return withAbilityDescription({
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
  });
}

function createBudgetChecks(abilities = []) {
  return abilities.map((ability) => {
    const cost = Number(ability?.budget?.cost) || 0;
    const limit = Number(ability?.budget?.limit) || 0;
    return {
      slot: ability?.slot || '',
      id: ability?.id || '',
      cost,
      limit,
      withinLimit: limit <= 0 ? true : cost <= limit,
    };
  });
}

function summarizeBudgetStatus(checks = []) {
  return checks.every((check) => check.withinLimit) ? 'withinLimit' : 'overLimit';
}

function findAbilityBySlot(abilities = [], slot) {
  return abilities.find((ability) => ability?.slot === slot) || null;
}

function findActiveAbility(abilities = []) {
  return findAbilityBySlot(abilities, 'activeSkill')
    || abilities.find((ability) => ability?.kind === 'active' || ability?.type === 'battle')
    || null;
}

function findPassiveAbility(abilities = []) {
  return findAbilityBySlot(abilities, 'passiveTrait')
    || abilities.find((ability) => ability?.kind === 'passive' && ability?.trigger === 'preBattle')
    || null;
}

function findCivilAbility(abilities = [], slot) {
  return findAbilityBySlot(abilities, slot)
    || abilities.find((ability) => ability?.kind === 'civil' && !['civilPrimary', 'civilSecondary'].includes(ability?.slot))
    || null;
}

function normalizeActiveAbility(raw = {}) {
  const normalized = normalizeAbility({
    ...raw,
    type: 'battle',
    slot: 'activeSkill',
    kind: 'active',
  });
  if (!normalized) return null;
  if (!Array.isArray(normalized.effects) || !normalized.effects.length) return null;
  const cooldown = Number(normalized.cooldown);
  return withAbilityDescription({
    ...normalized,
    type: 'battle',
    slot: 'activeSkill',
    kind: 'active',
    cooldown: Number.isFinite(cooldown) ? Math.max(1, Math.floor(cooldown)) : 3,
    castPolicy: sanitizeText(normalized.castPolicy, 'conditional'),
    castConditions: addBaseConditions(normalized.castConditions),
    generatorVersion: GENERATOR_VERSION,
  });
}

function normalizeBattlePassive(raw = {}) {
  const normalized = normalizeAbility({
    ...raw,
    slot: 'passiveTrait',
    kind: 'passive',
    trigger: 'preBattle',
  });
  if (!normalized) return null;
  return withAbilityDescription({
    ...normalized,
    slot: 'passiveTrait',
    kind: 'passive',
    trigger: 'preBattle',
    generatorVersion: GENERATOR_VERSION,
  });
}

function normalizeCivilStoredAbility(raw = {}, slot) {
  const normalized = normalizeAbility({
    ...raw,
    slot,
    kind: 'civil',
    trigger: 'passiveStored',
    implementationStatus: 'storedOnly',
  });
  if (!normalized) return null;
  return withAbilityDescription({
    ...normalized,
    slot,
    kind: 'civil',
    trigger: 'passiveStored',
    implementationStatus: 'storedOnly',
    generatorVersion: GENERATOR_VERSION,
  });
}

function normalizeScoutTrait(raw = {}) {
  const normalized = normalizeAbility({
    ...raw,
    slot: 'scoutTrait',
    kind: 'passive',
    trigger: 'passiveStored',
    implementationStatus: 'storedOnly',
  });
  if (!normalized) return null;
  return withAbilityDescription({
    ...normalized,
    slot: 'scoutTrait',
    kind: 'passive',
    trigger: 'passiveStored',
    implementationStatus: 'storedOnly',
    generatorVersion: GENERATOR_VERSION,
  });
}

function completeAbilitySlots(abilities = [], abilityArchetype, quality, meta, generatorInput) {
  const source = createSeedRandom(`${generatorInput.seed}:ability-kit-upgrade:${abilityArchetype}:${quality}`);
  const effectPool = generatorInput.availableEffectPool;
  if (meta.domain === 'civil') {
    const rawPrimary = findCivilAbility(abilities, 'civilPrimary');
    const rawSecondary = findCivilAbility(
      abilities.filter((ability) => ability !== rawPrimary),
      'civilSecondary',
    );
    const primary = normalizeCivilStoredAbility(rawPrimary, 'civilPrimary')
      || createCivilAbility(abilityArchetype, 'civilPrimary', quality, source, effectPool);
    const secondary = normalizeCivilStoredAbility(rawSecondary, 'civilSecondary')
      || createCivilAbility(abilityArchetype, 'civilSecondary', quality, source, effectPool);
    return [primary, secondary];
  }
  if (meta.domain === 'hybrid') {
    const active = normalizeActiveAbility(findActiveAbility(abilities))
      || createActiveSkill('scout', quality, source, effectPool);
    const scoutTrait = normalizeScoutTrait(findAbilityBySlot(abilities, 'scoutTrait'))
      || createScoutTrait(quality, source, effectPool);
    return [active, scoutTrait];
  }
  const active = normalizeActiveAbility(findActiveAbility(abilities))
    || createActiveSkill(abilityArchetype, quality, source, effectPool);
  const passive = normalizeBattlePassive(findPassiveAbility(abilities))
    || createBattlePassive(abilityArchetype, quality, source, effectPool);
  return [active, passive];
}

function createAbilityKit(options = {}, randomSource = null) {
  const abilityArchetype = normalizeAbilityArchetype(options.abilityArchetype || options.archetype);
  const quality = normalizeQuality(options.quality);
  const meta = getAbilityMeta(abilityArchetype);
  const generatorInput = createGeneratorInput(options, abilityArchetype, quality, meta);
  const source = typeof randomSource === 'function' ? randomSource : createSeedRandom(generatorInput.seed);
  const abilities = [];
  if (meta.domain === 'civil') {
    abilities.push(createCivilAbility(abilityArchetype, 'civilPrimary', quality, source, generatorInput.availableEffectPool));
    abilities.push(createCivilAbility(abilityArchetype, 'civilSecondary', quality, source, generatorInput.availableEffectPool));
  } else if (meta.domain === 'hybrid') {
    abilities.push(createActiveSkill('scout', quality, source, generatorInput.availableEffectPool));
    abilities.push(createScoutTrait(quality, source, generatorInput.availableEffectPool));
  } else {
    abilities.push(createActiveSkill(abilityArchetype, quality, source, generatorInput.availableEffectPool));
    abilities.push(createBattlePassive(abilityArchetype, quality, source, generatorInput.availableEffectPool));
  }
  const budgetChecks = createBudgetChecks(abilities);
  return {
    archetype: abilityArchetype,
    quality,
    qualityLabel: getQualityLabel(quality),
    domain: meta.domain,
    battlePolicy: meta.battlePolicy,
    source: generatorInput.source,
    seed: generatorInput.seed,
    generatorInput,
    abilities,
    budget: clone(QUALITY_BUDGETS[quality]),
    budgetChecks,
    budgetStatus: summarizeBudgetStatus(budgetChecks),
    availableEffectPool: [...generatorInput.availableEffectPool],
    generatorVersion: GENERATOR_VERSION,
  };
}

function isKnownEffect(effect = {}) {
  return Boolean(normalizeEffect(effect));
}

function normalizeAbility(raw = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const effects = Array.isArray(raw.effects)
    ? raw.effects.map(normalizeEffect).filter(Boolean)
    : [];
  if (!effects.length && raw.kind !== 'active') return null;
  return withAbilityDescription({
    ...raw,
    id: sanitizeText(raw.id, 'ability_generated'),
    name: sanitizeText(raw.name, '能力'),
    slot: sanitizeText(raw.slot, raw.kind === 'active' ? 'activeSkill' : 'passiveTrait'),
    kind: sanitizeText(raw.kind, raw.type === 'battle' ? 'active' : 'passive'),
    effects,
    generatorVersion: sanitizeText(raw.generatorVersion, GENERATOR_VERSION),
  });
}

function createLegacyAbilityKit(archetype, abilityArchetype, quality, skills = [], fallback = {}) {
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
  const generatorInput = normalizeGeneratorInput(archetype?.generatorInput, {
    abilityArchetype,
    quality,
    source: archetype?.source || fallback.source,
    seed: archetype?.seed || fallback.seed,
    availableEffectPool: archetype?.availableEffectPool || fallback.availableEffectPool,
  });
  const upgradedAbilities = completeAbilitySlots(abilities, abilityArchetype, quality, meta, generatorInput);
  const budgetChecks = createBudgetChecks(upgradedAbilities);
  return {
    archetype: normalizeAbilityArchetype(abilityArchetype),
    quality: normalizeQuality(quality),
    qualityLabel: getQualityLabel(quality),
    domain: meta.domain,
    battlePolicy: meta.battlePolicy,
    source: generatorInput.source,
    seed: generatorInput.seed,
    generatorInput,
    abilities: upgradedAbilities,
    budget: clone(QUALITY_BUDGETS[normalizeQuality(quality)]),
    budgetChecks,
    budgetStatus: summarizeBudgetStatus(budgetChecks),
    availableEffectPool: [...generatorInput.availableEffectPool],
    generatorVersion: GENERATOR_VERSION,
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
    return createLegacyAbilityKit(raw, abilityArchetype, quality, options.skills, options);
  }
  const generatorInput = normalizeGeneratorInput(raw.generatorInput, {
    abilityArchetype,
    quality,
    source: raw.source || options.source,
    seed: raw.seed || options.seed,
    availableEffectPool: raw.availableEffectPool || options.availableEffectPool,
  });
  const abilities = completeAbilitySlots(
    raw.abilities.map(normalizeAbility).filter(Boolean),
    abilityArchetype,
    quality,
    meta,
    generatorInput,
  );
  const budgetChecks = createBudgetChecks(abilities);
  return {
    archetype: abilityArchetype,
    quality,
    qualityLabel: getQualityLabel(quality),
    domain: meta.domain,
    battlePolicy: meta.battlePolicy,
    source: generatorInput.source,
    seed: generatorInput.seed,
    generatorInput,
    abilities,
    budget: raw.budget && typeof raw.budget === 'object' ? clone(raw.budget) : clone(QUALITY_BUDGETS[quality]),
    budgetChecks,
    budgetStatus: summarizeBudgetStatus(budgetChecks),
    availableEffectPool: [...generatorInput.availableEffectPool],
    generatorVersion: GENERATOR_VERSION,
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
  SCOUT_EFFECTS,
  LEGACY_EFFECT_MIGRATIONS,
  QUALITY_BUDGETS,
  QUALITY_LABELS,
  rollQuality,
  getQualityLabel,
  normalizeQuality,
  normalizeAbilityArchetype,
  normalizeEffect,
  getDefaultEffectPool,
  createAbilityKit,
  normalizeAbilityKit,
  getActiveBattleSkill,
};
