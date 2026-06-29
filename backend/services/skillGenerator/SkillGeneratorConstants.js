const GENERATOR_VERSION = 'skill-gen-v1';

const FIRST_BATCH_BATTLE_EFFECTS = Object.freeze([
  'directDamage',
  'secondHit',
  'firstStrike',
  'lifesteal',
  'heal',
  'shield',
  'armorBreak',
  'burn',
  'poison',
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
  armorBreak: '破甲',
  burn: '灼烧',
  poison: '中毒',
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

const ARCHETYPE_CATEGORIES = Object.freeze({
  commander: { category: 'battle', battlePolicy: 'useBattleSkill' },
  vanguard: { category: 'battle', battlePolicy: 'useBattleSkill' },
  strategist: { category: 'battle', battlePolicy: 'useBattleSkill' },
  governor: { category: 'civil', battlePolicy: 'basicAttackOnly' },
  charmer: { category: 'civil', battlePolicy: 'basicAttackOnly' },
  scout: { category: 'hybrid', battlePolicy: 'useBattleSkill' },
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
    {
      id: 'sunder_order',
      name: '压阵破甲',
      category: 'blade',
      damageType: 'blade',
      multiplier: 1.24,
      cooldown: 3,
      cost: 108,
      effects: [{ key: 'directDamage', value: 1.24 }, { key: 'armorBreak', value: 0.1, turns: 2 }],
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
    {
      id: 'rending_charge',
      name: '裂甲猛冲',
      category: 'blade',
      damageType: 'blade',
      multiplier: 1.32,
      cooldown: 3,
      cost: 114,
      effects: [{ key: 'directDamage', value: 1.32 }, { key: 'armorBreak', value: 0.12, turns: 2 }],
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
    {
      id: 'fire_trap',
      name: '伏火断阵',
      category: 'strategy',
      damageType: 'strategy',
      multiplier: 1.2,
      cooldown: 3,
      cost: 118,
      effects: [{ key: 'directDamage', value: 1.2 }, { key: 'burn', value: 0.12, turns: 2 }],
    },
    {
      id: 'poison_mist',
      name: '毒雾缠阵',
      category: 'strategy',
      damageType: 'strategy',
      multiplier: 1.16,
      cooldown: 3,
      cost: 116,
      effects: [{ key: 'directDamage', value: 1.16 }, { key: 'poison', value: 0.11, turns: 3 }],
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

module.exports = {
  ACTIVE_TEMPLATES,
  ARCHETYPE_CATEGORIES,
  CIVIL_EFFECTS,
  CIVIL_TEMPLATES,
  EFFECT_LABELS,
  FIRST_BATCH_BATTLE_EFFECTS,
  GENERATOR_VERSION,
  LEGACY_EFFECT_MIGRATIONS,
  PASSIVE_TEMPLATES,
  QUALITY_BUDGETS,
  QUALITY_LABELS,
  SCOUT_EFFECTS,
  SCOUT_TRAITS,
};
