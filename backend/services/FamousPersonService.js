const CityService = require('./CityService');

const GENERATOR_VERSION = 'famous-person-v0.1';
const APPEARANCE_VERSION = 'famous-portrait-v0.2';
const MIN_SEEK_ERA = 3;
const MAX_CANDIDATES = 3;
const PORTRAIT_LAYER_BASE = 'assets/art/famous-person/layers/';

const SOURCE_TYPES = Object.freeze({
  seek: { label: '寻访', roles: ['military', 'governance', 'craft', 'knowledge'] },
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
    attributes: { command: 66, force: 78, strategy: 42, governance: 26, craft: 18, charisma: 52 },
    skillPairs: [['lifesteal', 'combo'], ['combo', 'armorBreak'], ['ambush', 'combo']],
  },
  {
    id: 'guardian',
    label: '守备领队',
    roles: ['military'],
    titlePool: ['垒门守将', '铁壁护军', '边墙执盾'],
    namePool: ['衡', '坚', '岳', '承', '镇'],
    attributes: { command: 76, force: 62, strategy: 48, governance: 34, craft: 22, charisma: 58 },
    skillPairs: [['shield', 'counter'], ['shield', 'morale'], ['counter', 'heal']],
  },
  {
    id: 'tactician',
    label: '谋略领队',
    roles: ['military', 'knowledge'],
    titlePool: ['火计谋士', '雾林策士', '伏兵参谋'],
    namePool: ['策', '玄', '微', '昭', '临'],
    attributes: { command: 58, force: 34, strategy: 82, governance: 44, craft: 20, charisma: 56 },
    skillPairs: [['burn', 'ambush'], ['poison', 'armorBreak'], ['morale', 'combo']],
  },
  {
    id: 'warden',
    label: '城市治理',
    roles: ['governance'],
    titlePool: ['聚落执政', '仓廪主事', '民生长者'],
    namePool: ['宁', '禾', '安', '序', '清'],
    attributes: { command: 38, force: 24, strategy: 54, governance: 82, craft: 42, charisma: 66 },
    skillPairs: [['morale', 'heal'], ['shield', 'heal'], ['morale', 'shield']],
  },
  {
    id: 'artisan',
    label: '工巧人才',
    roles: ['craft'],
    titlePool: ['炉火匠首', '石工督造', '木作名匠'],
    namePool: ['钧', '砺', '椽', '铎', '工'],
    attributes: { command: 34, force: 32, strategy: 46, governance: 58, craft: 82, charisma: 42 },
    skillPairs: [['armorBreak', 'shield'], ['burn', 'morale'], ['counter', 'armorBreak']],
  },
  {
    id: 'scholar',
    label: '知识人才',
    roles: ['knowledge'],
    titlePool: ['观星学者', '古卷译者', '火种记史'],
    namePool: ['闻', '简', '知', '言', '书'],
    attributes: { command: 28, force: 18, strategy: 74, governance: 64, craft: 40, charisma: 54 },
    skillPairs: [['morale', 'ambush'], ['poison', 'heal'], ['shield', 'morale']],
  },
]);

const SURNAMES = Object.freeze(['陆', '姜', '林', '石', '孟', '许', '白', '韩', '秦', '苏']);

const APPEARANCE_POOLS = Object.freeze({
  body: ['fp-layer-body-skin-01.png', 'fp-layer-body-skin-02.png'],
  frontHair: ['fp-layer-frontHair-short-01.png', 'fp-layer-frontHair-tied-01.png'],
  outfit: {
    vanguard: ['fp-layer-outfit-vanguard-01.png'],
    guardian: ['fp-layer-outfit-guardian-01.png'],
    tactician: ['fp-layer-outfit-scholar-01.png'],
    warden: ['fp-layer-outfit-scholar-01.png'],
    artisan: ['fp-layer-outfit-vanguard-01.png'],
    scholar: ['fp-layer-outfit-scholar-01.png'],
  },
  accessory: {
    vanguard: ['fp-layer-accessory-scar-01.png', null],
    guardian: [null, 'fp-layer-accessory-scar-01.png'],
    tactician: [null],
    warden: [null],
    artisan: [null, 'fp-layer-accessory-scar-01.png'],
    scholar: [null],
  },
});

const EFFECTS = Object.freeze({
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

function normalizeAttributes(raw = {}) {
  const defaults = { command: 50, force: 50, strategy: 50, governance: 50, craft: 50, charisma: 50 };
  return Object.keys(defaults).reduce((result, key) => {
    result[key] = Math.max(1, Math.min(99, toInteger(raw[key], defaults[key])));
    return result;
  }, {});
}

function normalizeSkill(raw = {}) {
  const effects = Array.isArray(raw.effects)
    ? raw.effects.filter((effect) => effect && typeof effect === 'object' && EFFECTS[effect.key]).map((effect) => ({ ...effect }))
    : [];
  if (!effects.length) return null;
  return {
    id: sanitizeText(raw.id, `skill_${effects.map((effect) => effect.key).join('_')}`),
    name: sanitizeText(raw.name, makeSkillName(effects)),
    type: sanitizeText(raw.type, 'battle'),
    effects,
  };
}

function layerPath(filename) {
  return filename ? `${PORTRAIT_LAYER_BASE}${filename}` : null;
}

function createAppearance(archetype, seed, randomSource = null) {
  const source = typeof randomSource === 'function' ? randomSource : createSeedRandom(seed);
  const outfitPool = APPEARANCE_POOLS.outfit[archetype.id] || APPEARANCE_POOLS.outfit.vanguard;
  const accessoryPool = APPEARANCE_POOLS.accessory[archetype.id] || [null];
  const layers = {
    body: layerPath(pick(APPEARANCE_POOLS.body, source)),
    outfit: layerPath(pick(outfitPool, source)),
    frontHair: layerPath(pick(APPEARANCE_POOLS.frontHair, source)),
  };
  const accessory = pick(accessoryPool, source);
  if (accessory) layers.accessory = layerPath(accessory);
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
  if (source.version && source.version !== APPEARANCE_VERSION) return generated;
  const layers = ['backHair', 'body', 'face', 'outfit', 'frontHair', 'accessory', 'frameEffect']
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

function normalizePerson(raw = {}, options = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const id = sanitizeText(raw.id);
  if (!id) return null;
  const archetype = ARCHETYPES.find((item) => item.id === raw.archetype) || ARCHETYPES[0];
  const skills = Array.isArray(raw.skills) ? raw.skills.map(normalizeSkill).filter(Boolean).slice(0, 2) : [];
  const fallbackAppearanceSeed = raw.source?.seed || `${id}:${raw.name || archetype.id}:${raw.createdAt || ''}`;
  return {
    id,
    name: sanitizeText(raw.name, '无名之士').slice(0, 12),
    title: sanitizeText(raw.title, archetype.titlePool[0]).slice(0, 16),
    eraBorn: Math.max(0, toInteger(raw.eraBorn, 0)),
    source: raw.source && typeof raw.source === 'object' ? { ...raw.source } : { type: 'seek' },
    archetype: archetype.id,
    archetypeLabel: archetype.label,
    roles: Array.isArray(raw.roles) && raw.roles.length ? raw.roles.map(String) : [...archetype.roles],
    attributes: normalizeAttributes(raw.attributes),
    traits: Array.isArray(raw.traits) ? raw.traits.map(String).slice(0, 4) : [],
    skills,
    appearance: normalizeAppearance(raw.appearance, archetype, fallbackAppearanceSeed),
    status: normalizeStatus(raw.status),
    createdAt: raw.createdAt || new Date().toISOString(),
    joinedAt: options.candidate ? null : (raw.joinedAt || raw.createdAt || new Date().toISOString()),
    generatorVersion: sanitizeText(raw.generatorVersion, GENERATOR_VERSION),
  };
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
    result[key] = Math.max(1, Math.min(99, base + variance));
    return result;
  }, {});
}

function getArchetypePool(sourceType) {
  const source = SOURCE_TYPES[sourceType] || SOURCE_TYPES.seek;
  return ARCHETYPES.filter((archetype) => archetype.roles.some((role) => source.roles.includes(role)));
}

function createFamousPersonCandidate(gameState, payload = {}, now = new Date(), randomSource = Math.random) {
  const sourceType = SOURCE_TYPES[payload.source] ? payload.source : 'seek';
  const pool = getArchetypePool(sourceType);
  const archetype = pick(pool, randomSource) || ARCHETYPES[0];
  const surname = pick(SURNAMES, randomSource) || SURNAMES[0];
  const given = pick(archetype.namePool, randomSource) || archetype.namePool[0];
  const title = pick(archetype.titlePool, randomSource) || archetype.titlePool[0];
  const rollId = Math.floor(rollUnit(randomSource) * 1000000).toString(36).padStart(4, '0');
  const activeCityId = gameState.activeCityId || CityService.CAPITAL_CITY_ID;
  const seed = `${gameState.playerId || 'player'}:${now.getTime()}:${rollId}`;
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
    roles: [...archetype.roles],
    attributes: createAttributes(archetype, randomSource),
    traits: [archetype.label],
    skills: [createSkill(archetype, randomSource)],
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
      sources: Object.entries(SOURCE_TYPES).map(([id, source]) => ({ id, label: source.label })),
    },
  };
}

module.exports = {
  GENERATOR_VERSION,
  APPEARANCE_VERSION,
  MIN_SEEK_ERA,
  MAX_CANDIDATES,
  ARCHETYPES,
  EFFECTS,
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
