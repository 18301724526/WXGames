const CityService = require('../CityService');
const SkillGeneratorService = require('../SkillGeneratorService');
const {
  APPEARANCE_POOLS,
  APPEARANCE_VERSION,
  ARCHETYPES,
  ATTRIBUTE_INITIAL_MAX_VALUE,
  EFFECTS,
  GENERATOR_VERSION,
  PORTRAIT_LAYER_BASE,
  SOURCE_TYPES,
  SURNAMES,
} = require('./FamousPersonConstants');
const {
  createSeedRandom,
  hashText,
  pick,
  rollUnit,
  sanitizeText,
  toInteger,
} = require('./FamousPersonShared');
const {
  clampAttributeValue,
} = require('./FamousPersonProgression');

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
  return {
    version: sanitizeText(source.version, APPEARANCE_VERSION),
    seed: sanitizeText(source.seed, fallbackSeed),
    palette: sanitizeText(source.palette, generated.palette),
    layers: {
      ...generated.layers,
      ...layers,
    },
  };
}

function makeSkillName(effects = []) {
  const keys = effects.map((effect) => effect.key);
  if (keys.includes('lifesteal') && keys.includes('secondHit')) return '血刃连袭';
  if (keys.includes('secondHit') && keys.includes('armorBreak')) return '破阵连击';
  if (keys.includes('firstStrike') && keys.includes('secondHit')) return '伏击追袭';
  if (keys.includes('shield') && keys.includes('armorBreak')) return '守势破甲';
  if (keys.includes('shield') && keys.includes('attributeBonus')) return '固阵振军';
  if (keys.includes('heal') && keys.includes('armorBreak')) return '回锋破阵';
  if (keys.includes('burn') && keys.includes('firstStrike')) return '伏火奇袭';
  if (keys.includes('poison') && keys.includes('armorBreak')) return '蚀甲毒计';
  if (keys.includes('attributeBonus') && keys.includes('secondHit')) return '鼓锋连战';
  if (keys.includes('attributeBonus') && keys.includes('heal')) return '振军疗伤';
  if (keys.includes('armorBreak') && keys.includes('shield')) return '破甲护阵';
  return effects.map((effect) => EFFECTS[effect.key]?.label || effect.key).join('');
}

function createSkill(archetype, randomSource = null) {
  const source = typeof randomSource === 'function' ? randomSource : createSeedRandom(`${archetype.id}:skill`);
  const pair = pick(archetype.skillPairs, source) || archetype.skillPairs[0];
  const effects = pair.map((key) => EFFECTS[key].create(rollUnit(source)));
  return {
    id: `skill_${pair.join('_')}`,
    name: makeSkillName(effects),
    type: archetype.roles.includes('military') ? 'battle' : 'support',
    effects,
  };
}

function createAttributes(archetype, randomSource = null) {
  const source = typeof randomSource === 'function' ? randomSource : createSeedRandom(`${archetype.id}:attributes`);
  return Object.entries(archetype.attributes).reduce((result, [key, base]) => {
    const variance = Math.floor(rollUnit(source) * 15) - 4;
    result[key] = clampAttributeValue(base + variance, base, ATTRIBUTE_INITIAL_MAX_VALUE);
    return result;
  }, {});
}

function getArchetypePool(sourceType) {
  const source = SOURCE_TYPES[sourceType] || SOURCE_TYPES.seek;
  return ARCHETYPES.filter((archetype) => archetype.roles.some((role) => source.roles.includes(role)));
}

function createFamousPersonCandidate(gameState, payload = {}, now = new Date(), randomSource = null) {
  const sourceType = payload.source;
  const fallbackSeed = `${gameState.playerId || 'player'}:${sourceType || 'seek'}:${now.getTime()}`;
  const source = typeof randomSource === 'function' ? randomSource : createSeedRandom(fallbackSeed);
  const pool = getArchetypePool(sourceType);
  const archetype = pick(pool, source) || ARCHETYPES[0];
  const quality = SkillGeneratorService.rollQuality(source);
  const surname = pick(SURNAMES, source) || SURNAMES[0];
  const given = pick(archetype.namePool, source) || archetype.namePool[0];
  const title = pick(archetype.titlePool, source) || archetype.titlePool[0];
  const rollId = Math.floor(rollUnit(source) * 1000000).toString(36).padStart(4, '0');
  const activeCityId = gameState.activeCityId || CityService.CAPITAL_CITY_ID;
  const seed = `${gameState.playerId || 'player'}:${now.getTime()}:${rollId}`;
  const abilityArchetype = SkillGeneratorService.normalizeAbilityArchetype(archetype.abilityArchetype || archetype.id);
  const abilityKit = SkillGeneratorService.createAbilityKit({ archetype: archetype.id, abilityArchetype, quality, source: sourceType, seed }, source);
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
    attributes: createAttributes(archetype, source),
    traits: [archetype.label, SkillGeneratorService.getQualityLabel(quality)],
    abilityKit,
    skills: activeSkill ? [activeSkill] : [],
    appearance: createAppearance(archetype, seed, source),
    status: { assigned: 'candidate', loyalty: 55 + Math.floor(rollUnit(source) * 30) },
    createdAt: now.toISOString(),
    joinedAt: null,
    generatorVersion: GENERATOR_VERSION,
  };
}

// --- Starter reward general: one cohesive home -----------------------------------------------
// The starter reward owns its rules here so changes to archetype or quality do not leak into
// lookup, grant, or use sites.

// Quality of the gift (purple / 英杰). Single source.
const STARTER_QUALITY = 'great';

// The gift must be a COMBAT general so the player can always fight/scout/march and open the game —
// never a civil (governance/knowledge-only) officer they cannot deploy. The pool is DERIVED from
// the archetype roles (mark an archetype 'military' and it is automatically eligible), not a
// hand-maintained id list, so it stays single-source with the archetype definitions.
function getStarterArchetypePool() {
  return ARCHETYPES.filter((archetype) => Array.isArray(archetype.roles) && archetype.roles.includes('military'));
}

// Stable identity of the starter reward general — by grant SOURCE, never by its randomized
// archetype/quality. This is the SINGLE place identity is defined; find/idempotency callers use it
// so changing what the starter is never touches how it is recognized.
function isStarterRewardFamousPerson(person) {
  return person?.source?.type === 'starter-reward';
}

function createStarterScoutFamousPerson(gameState = {}, now = new Date()) {
  const pool = getStarterArchetypePool();
  // Grant-time entropy: a new game (new grant time) rolls a different starter; within a game the
  // grant is idempotent (created once, then stored) so it stays fixed. playerId keeps it unique
  // per account, so it is never "the same for everyone".
  const seed = `${gameState.playerId || 'player'}:starter-reward:${now.getTime()}`;
  const randomSource = createSeedRandom(seed);
  const archetype = pick(pool, randomSource) || pool[0] || ARCHETYPES[0];
  const quality = STARTER_QUALITY;
  const activeCityId = gameState.activeCityId || CityService.CAPITAL_CITY_ID;
  const abilityArchetype = SkillGeneratorService.normalizeAbilityArchetype(archetype.abilityArchetype || archetype.id);
  const abilityKit = SkillGeneratorService.createAbilityKit({
    archetype: archetype.id,
    abilityArchetype,
    quality,
    source: 'starter-reward',
    seed,
  }, randomSource);
  const activeSkill = SkillGeneratorService.getActiveBattleSkill(abilityKit);
  return {
    id: `fp_starter_scout_${hashText(seed).toString(36)}`,
    name: `${pick(SURNAMES, randomSource) || SURNAMES[0]}${pick(archetype.namePool, randomSource) || archetype.namePool[0]}`,
    title: pick(archetype.titlePool, randomSource) || archetype.titlePool[0],
    eraBorn: Math.max(0, toInteger(gameState.currentEra, 0)),
    source: {
      type: 'starter-reward',
      label: '开局奖励',
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
    traits: [archetype.label, '初始赠礼'],
    abilityKit,
    skills: activeSkill ? [activeSkill] : [],
    appearance: createAppearance(archetype, seed, randomSource),
    status: { assigned: 'idle', loyalty: 88 },
    createdAt: now.toISOString(),
    joinedAt: now.toISOString(),
    generatorVersion: GENERATOR_VERSION,
  };
}

module.exports = {
  STARTER_QUALITY,
  createAppearance,
  createAttributes,
  createFamousPersonCandidate,
  createSkill,
  createStarterScoutFamousPerson,
  getArchetypePool,
  getStarterArchetypePool,
  isStarterRewardFamousPerson,
  makeSkillName,
  normalizeAppearance,
};
