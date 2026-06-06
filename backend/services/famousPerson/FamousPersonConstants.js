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

function round2(value) {
  return Math.round(value * 100) / 100;
}

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

module.exports = {
  APPEARANCE_POOLS,
  APPEARANCE_VERSION,
  ARCHETYPES,
  ATTRIBUTE_INITIAL_MAX_VALUE,
  ATTRIBUTE_KEYS,
  ATTRIBUTE_MAX_VALUE,
  ATTRIBUTE_MIN_VALUE,
  ATTRIBUTE_POINT_MILESTONE,
  ATTRIBUTE_POINTS_PER_MILESTONE,
  AUTO_GROWTH_WEIGHTS,
  BASE_LEVEL,
  EFFECTS,
  ENABLED_SOURCE_TYPES,
  GENERATOR_VERSION,
  MAX_CANDIDATES,
  MIN_SEEK_ERA,
  PORTRAIT_LAYER_BASE,
  QUALITY_AUTO_GROWTH_POINTS,
  SOURCE_TYPES,
  SURNAMES,
};
