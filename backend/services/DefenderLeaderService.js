const SkillGeneratorService = require('./SkillGeneratorService');
const DefenderLeaderRandomAuthority = require('./defenderLeader/DefenderLeaderRandomAuthority');
const { hashText } = require('../../shared/signatureHash');
const { toInteger, clamp } = require('../../shared/numberUtils');

const DEFENDER_LEADER_VERSION = 'defender-leader-v1';
const APPEARANCE_VERSION = 'famous-portrait-v3.0';
const PORTRAIT_LAYER_BASE = 'assets/art/famous-person/layers/';

const QUALITY_BY_THREAT = Object.freeze([
  { maxThreat: 2, quality: 'common' },
  { maxThreat: 4, quality: 'good' },
  { maxThreat: 6, quality: 'great' },
  { maxThreat: Infinity, quality: 'legendary' },
]);

const PROFILE_BY_OWNER = Object.freeze({
  tribe: {
    ownerLabel: '部落',
    archetype: 'vanguard',
    abilityArchetype: 'vanguard',
    titlePool: ['林地骁将', '营帐战首', '部族先锋'],
    surnamePool: ['赫', '拓', '戎', '林', '山'],
    givenPool: ['烈', '锋', '岚', '峻', '逐'],
    baseAttributes: { command: 54, force: 66, intelligence: 38, politics: 30, charisma: 46, speed: 55 },
  },
  city_state: {
    ownerLabel: '城邦',
    archetype: 'guardian',
    abilityArchetype: 'commander',
    titlePool: ['城门督将', '高墙守备', '城邦军尉'],
    surnamePool: ['石', '韩', '卫', '郭', '陶'],
    givenPool: ['衡', '镇', '承', '垣', '肃'],
    baseAttributes: { command: 66, force: 60, intelligence: 54, politics: 48, charisma: 48, speed: 50 },
  },
  ruin_guardians: {
    ownerLabel: '遗迹',
    archetype: 'tactician',
    abilityArchetype: 'strategist',
    titlePool: ['遗迹守望', '断柱策士', '古道护军'],
    surnamePool: ['玄', '白', '秦', '苏', '墨'],
    givenPool: ['策', '微', '昭', '临', '烬'],
    baseAttributes: { command: 58, force: 62, intelligence: 68, politics: 42, charisma: 42, speed: 52 },
  },
  neutral: {
    ownerLabel: '边地',
    archetype: 'guardian',
    abilityArchetype: 'commander',
    titlePool: ['边地守将', '村镇护卫', '木寨哨长'],
    surnamePool: ['陆', '姜', '许', '孟', '白'],
    givenPool: ['坚', '岳', '安', '衡', '守'],
    baseAttributes: { command: 48, force: 50, intelligence: 42, politics: 38, charisma: 42, speed: 44 },
  },
});

const APPEARANCE_POOLS = Object.freeze({
  outfit: Array.from({ length: 10 }, (_, index) => `fp-layer-v3-outfit-${String(index + 1).padStart(2, '0')}.png`),
  face: Array.from({ length: 10 }, (_, index) => `fp-layer-v3-face-${String(index + 1).padStart(2, '0')}.png`),
  hair: Array.from({ length: 10 }, (_, index) => `fp-layer-v3-hair-${String(index + 1).padStart(2, '0')}.png`),
});

function sanitizeText(value, fallback = '') {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

function createSeedRandom(seed) {
  let state = hashText(seed) || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

function rollUnit(randomSource = null) {
  const value = Number(typeof randomSource === 'function' ? randomSource() : 0);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(0.999999, value));
}

function pick(list, randomSource = null) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[Math.floor(rollUnit(randomSource) * list.length)];
}

function getProfileForOwner(owner = '') {
  return PROFILE_BY_OWNER[owner] || PROFILE_BY_OWNER.neutral;
}

function getQualityForThreat(threat = 0) {
  const normalizedThreat = Math.max(0, toInteger(threat, 0));
  return QUALITY_BY_THREAT.find((item) => normalizedThreat <= item.maxThreat)?.quality || 'common';
}

function getLevelForTerritory(territory = {}) {
  const threat = Math.max(0, toInteger(territory.threat, 0));
  const scale = Math.max(1, toInteger(territory.scale, 1));
  const defense = Math.max(0, toInteger(territory.defense, 0));
  return clamp(1 + threat * 2 + Math.max(0, scale - 1) + Math.floor(defense / 500), 1, 60);
}

function layerPath(filename) {
  return filename ? `${PORTRAIT_LAYER_BASE}${filename}` : null;
}

function createAppearance(seed, randomSource = null) {
  const source = typeof randomSource === 'function' ? randomSource : createSeedRandom(seed);
  return {
    version: APPEARANCE_VERSION,
    seed,
    palette: 'enemy_red',
    layers: {
      outfit: layerPath(pick(APPEARANCE_POOLS.outfit, source)),
      face: layerPath(pick(APPEARANCE_POOLS.face, source)),
      hair: layerPath(pick(APPEARANCE_POOLS.hair, source)),
    },
  };
}

function normalizeAppearance(raw = {}, seed = '') {
  const source = raw && typeof raw === 'object' ? raw : {};
  const generated = createAppearance(sanitizeText(source.seed, seed));
  const rawLayers = source.layers && typeof source.layers === 'object' ? source.layers : {};
  if (source.version !== APPEARANCE_VERSION) return generated;
  return {
    version: APPEARANCE_VERSION,
    seed: sanitizeText(source.seed, seed),
    palette: sanitizeText(source.palette, generated.palette),
    layers: {
      outfit: sanitizeText(rawLayers.outfit, generated.layers.outfit),
      face: sanitizeText(rawLayers.face, generated.layers.face),
      hair: sanitizeText(rawLayers.hair, generated.layers.hair),
    },
  };
}

function createAttributes(profile, territory = {}, randomSource = null) {
  const source = typeof randomSource === 'function'
    ? randomSource
    : createSeedRandom(`defender:${territory.id || territory.naturalName || 'site'}:attributes`);
  const threat = Math.max(0, toInteger(territory.threat, 0));
  const scale = Math.max(1, toInteger(territory.scale, 1));
  const defense = Math.max(0, toInteger(territory.defense, 0));
  const threatBonus = threat * 2 + Math.max(0, scale - 1) + Math.floor(defense / 600);
  const attributes = {};
  Object.entries(profile.baseAttributes).forEach(([key, base]) => {
    const variance = Math.floor(rollUnit(source) * 9) - 3;
    attributes[key] = clamp(base + threatBonus + variance, 1, 140);
  });
  attributes.strategy = attributes.intelligence;
  attributes.governance = attributes.politics;
  return attributes;
}

function createDefenderLeader(territory = {}, options = {}) {
  const profile = getProfileForOwner(territory.owner);
  const seed = sanitizeText(
    options.seed,
    DefenderLeaderRandomAuthority.createLeaderSeed(territory),
  );
  const randomSource = typeof options.randomSource === 'function'
    ? options.randomSource
    : DefenderLeaderRandomAuthority.createLeaderRandomSource(territory, {
      ...options,
      seed,
    });
  const randomAuthority = DefenderLeaderRandomAuthority.createSourceMetadata(randomSource);
  const quality = SkillGeneratorService.normalizeQuality(options.quality || getQualityForThreat(territory.threat));
  const surname = pick(profile.surnamePool, randomSource) || profile.surnamePool[0];
  const given = pick(profile.givenPool, randomSource) || profile.givenPool[0];
  const title = pick(profile.titlePool, randomSource) || profile.titlePool[0];
  const abilityKit = SkillGeneratorService.createAbilityKit({
    archetype: profile.archetype,
    abilityArchetype: profile.abilityArchetype,
    quality,
    source: 'defender',
    seed,
    availableEffectPool: ['directDamage', 'secondHit', 'firstStrike', 'shield', 'armorBreak', 'burn', 'poison', 'attributeBonus'],
  });
  const activeSkill = SkillGeneratorService.getActiveBattleSkill(abilityKit);
  return normalizeDefenderLeader({
    id: `df_${hashText(seed).toString(36)}`,
    name: `${surname}${given}`,
    title,
    source: {
      type: 'defender',
      label: '守军',
      territoryId: territory.id || '',
      territoryName: territory.naturalName || territory.cityName || '',
      owner: territory.owner || 'neutral',
      seed,
      ...(randomAuthority ? { randomAuthority } : {}),
    },
    archetype: profile.archetype,
    archetypeLabel: profile.ownerLabel,
    abilityArchetype: profile.abilityArchetype,
    quality,
    qualityLabel: SkillGeneratorService.getQualityLabel(quality),
    level: getLevelForTerritory(territory),
    roles: ['defender', 'military'],
    attributes: createAttributes(profile, territory, randomSource),
    traits: [profile.ownerLabel, SkillGeneratorService.getQualityLabel(quality)],
    abilityKit,
    skills: activeSkill ? [activeSkill] : [],
    appearance: createAppearance(seed, randomSource),
    status: { assigned: 'defender', loyalty: 0 },
    createdAt: options.createdAt || new Date().toISOString(),
    generatorVersion: DEFENDER_LEADER_VERSION,
  }, territory);
}

function normalizeAttributes(raw = {}, fallback = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const intelligence = source.intelligence ?? source.strategy ?? fallback.intelligence ?? 45;
  const politics = source.politics ?? source.governance ?? fallback.politics ?? 40;
  const attributes = {
    command: clamp(toInteger(source.command, fallback.command ?? 45), 1, 9999),
    force: clamp(toInteger(source.force, fallback.force ?? 45), 1, 9999),
    intelligence: clamp(toInteger(intelligence, 45), 1, 9999),
    politics: clamp(toInteger(politics, 40), 1, 9999),
    charisma: clamp(toInteger(source.charisma, fallback.charisma ?? 42), 1, 9999),
    speed: clamp(toInteger(source.speed, fallback.speed ?? 42), 1, 9999),
  };
  attributes.strategy = attributes.intelligence;
  attributes.governance = attributes.politics;
  return attributes;
}

function normalizeDefenderLeader(raw = {}, territory = {}) {
  const profile = getProfileForOwner(raw.owner || raw.source?.owner || territory.owner);
  const idSeed = sanitizeText(raw.source?.seed, `defender:${territory.id || raw.id || 'site'}`);
  const quality = SkillGeneratorService.normalizeQuality(raw.quality || getQualityForThreat(territory.threat));
  const abilityArchetype = SkillGeneratorService.normalizeAbilityArchetype(
    raw.abilityArchetype || raw.abilityKit?.archetype || profile.abilityArchetype,
  );
  const abilityKit = SkillGeneratorService.normalizeAbilityKit(raw.abilityKit, {
    archetype: raw.archetype || profile.archetype,
    abilityArchetype,
    quality,
    source: 'defender',
    seed: idSeed,
    availableEffectPool: ['directDamage', 'secondHit', 'firstStrike', 'shield', 'armorBreak', 'burn', 'poison', 'attributeBonus'],
  });
  const activeSkill = SkillGeneratorService.getActiveBattleSkill(abilityKit);
  const name = sanitizeText(raw.name);
  return {
    id: sanitizeText(raw.id, `df_${hashText(idSeed).toString(36)}`),
    name: name.slice(0, 12) || `${profile.ownerLabel}守将`,
    title: sanitizeText(raw.title, profile.titlePool[0]).slice(0, 16),
    source: {
      ...(raw.source && typeof raw.source === 'object' ? raw.source : {}),
      type: 'defender',
      label: '守军',
      territoryId: territory.id || raw.source?.territoryId || '',
      territoryName: territory.naturalName || territory.cityName || raw.source?.territoryName || '',
      owner: territory.owner || raw.source?.owner || 'neutral',
      seed: idSeed,
    },
    archetype: sanitizeText(raw.archetype, profile.archetype),
    archetypeLabel: sanitizeText(raw.archetypeLabel, profile.ownerLabel),
    abilityArchetype,
    quality,
    qualityLabel: SkillGeneratorService.getQualityLabel(quality),
    level: Math.max(1, toInteger(raw.level, getLevelForTerritory(territory))),
    roles: Array.isArray(raw.roles) && raw.roles.length ? raw.roles.map(String) : ['defender', 'military'],
    attributes: normalizeAttributes(raw.attributes, profile.baseAttributes),
    traits: Array.isArray(raw.traits) && raw.traits.length
      ? raw.traits.map(String).slice(0, 4)
      : [profile.ownerLabel, SkillGeneratorService.getQualityLabel(quality)],
    abilityKit,
    skills: activeSkill ? [activeSkill] : [],
    appearance: normalizeAppearance(raw.appearance, idSeed),
    status: raw.status && typeof raw.status === 'object' ? { ...raw.status, assigned: 'defender' } : { assigned: 'defender', loyalty: 0 },
    createdAt: raw.createdAt || new Date().toISOString(),
    generatorVersion: sanitizeText(raw.generatorVersion, DEFENDER_LEADER_VERSION),
  };
}

function ensureDefenderLeader(territory = {}, options = {}) {
  if (!territory || typeof territory !== 'object') return null;
  if (territory.owner === 'player' || territory.owner === 'neutral' || territory.id === 'capital') return null;
  const raw = territory.defenderLeader && typeof territory.defenderLeader === 'object'
    ? territory.defenderLeader
    : createDefenderLeader(territory, options);
  return normalizeDefenderLeader(raw, territory);
}

module.exports = {
  DEFENDER_LEADER_VERSION,
  APPEARANCE_VERSION,
  getQualityForThreat,
  getLevelForTerritory,
  createDefenderLeader,
  normalizeDefenderLeader,
  ensureDefenderLeader,
  _test: {
    createSeedRandom,
    hashText,
  },
};
