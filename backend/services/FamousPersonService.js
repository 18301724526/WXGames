const SkillGeneratorService = require('./SkillGeneratorService');
const {
  APPEARANCE_VERSION,
  ARCHETYPES,
  ATTRIBUTE_KEYS,
  ATTRIBUTE_POINT_MILESTONE,
  ATTRIBUTE_POINTS_PER_MILESTONE,
  AUTO_GROWTH_WEIGHTS,
  BASE_LEVEL,
  EFFECTS,
  ENABLED_SOURCE_TYPES,
  GENERATOR_VERSION,
  MAX_CANDIDATES,
  MIN_SEEK_ERA,
  QUALITY_AUTO_GROWTH_POINTS,
  SOURCE_TYPES,
} = require('./famousPerson/FamousPersonConstants');
const {
  clone,
  sanitizeText,
  toInteger,
} = require('./famousPerson/FamousPersonShared');
const {
  applyAutoAttributeGrowth,
  applyPendingAutoAttributeGrowth,
  calculateAutoAttributeGrowth,
  clampAttributeValue,
  getLevelUpExperience,
  normalizeAttributes,
  normalizeProgression,
  syncAttributeAliases,
} = require('./famousPerson/FamousPersonProgression');
const {
  createFamousPersonCandidate: buildFamousPersonCandidate,
  createTutorialScoutFamousPerson: buildTutorialScoutFamousPerson,
  isTutorialStarterFamousPerson, makeSkillName,
  normalizeAppearance,
} = require('./famousPerson/FamousPersonGenerator');
const { normalizeSkill } = require('./famousPerson/FamousPersonSkillNormalizer');
const FamousPersonRandomAuthority = require('./famousPerson/FamousPersonRandomAuthority');
const PersonSocialFields = require('./person/PersonSocialFields');

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

function normalizeRoles(rawRoles = [], fallbackRoles = []) {
  const source = Array.isArray(rawRoles) && rawRoles.length ? rawRoles : fallbackRoles;
  const roles = source
    .map((role) => (String(role) === 'craft' ? 'governance' : String(role)))
    .filter(Boolean);
  return [...new Set(roles.length ? roles : fallbackRoles.map(String))];
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
    ...PersonSocialFields.normalizeSocial(raw, id),
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

function resolveCandidateRandomSource(gameState, sourceType, now, randomSource = null) {
  if (typeof randomSource === 'function') return randomSource;
  return FamousPersonRandomAuthority.createCandidateRandomSource(gameState, sourceType, now);
}

function attachRandomAuthorityMetadata(candidate, randomSource) {
  const metadata = FamousPersonRandomAuthority.createSourceMetadata(randomSource);
  if (!candidate || !metadata) return candidate;
  return {
    ...candidate,
    source: {
      ...(candidate.source || {}),
      randomAuthority: metadata,
    },
  };
}

function createFamousPersonCandidate(gameState, payload = {}, now = new Date(), randomSource = null) {
  const requestedSource = SOURCE_TYPES[payload.source] ? payload.source : 'seek';
  const sourceType = ENABLED_SOURCE_TYPES.includes(requestedSource) ? requestedSource : 'seek';
  const source = resolveCandidateRandomSource(gameState, sourceType, now, randomSource);
  const candidate = normalizePerson(
    buildFamousPersonCandidate(gameState, { ...payload, source: sourceType }, now, source),
    { candidate: true },
  );
  return attachRandomAuthorityMetadata(candidate, source);
}

function createTutorialScoutFamousPerson(gameState = {}, now = new Date()) {
  return normalizePerson(buildTutorialScoutFamousPerson(gameState, now));
}

function grantTutorialScoutFamousPerson(gameState, now = new Date()) {
  if (!gameState || typeof gameState !== 'object') return null;
  gameState.famousPeople = normalizeFamousPeople(gameState.famousPeople);
  const existing = gameState.famousPeople.find(isTutorialStarterFamousPerson);
  if (existing) {
    return { person: clone(existing), grantedAt: existing.joinedAt || existing.createdAt || now.toISOString(), created: false };
  }
  const person = createTutorialScoutFamousPerson(gameState, now);
  gameState.famousPeople = [person, ...gameState.famousPeople];
  ensureFamousPersonState(gameState);
  return { person: clone(person), grantedAt: person.joinedAt || now.toISOString(), created: true };
}

function getSeekAvailability(gameState) {
  const state = ensureFamousPersonState(gameState);
  return getSeekAvailabilityFromState(gameState, state);
}

function getSeekAvailabilityFromState(gameState, state = normalizeFamousPersonState(null)) {
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

function seekFamousPerson(gameState, payload = {}, now = new Date(), randomSource = null) {
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
  return getClientStateFromNormalized({
    ...gameState,
    famousPersonState: state,
  });
}

function getClientStateFromNormalized(gameState = {}) {
  const state = gameState.famousPersonState || normalizeFamousPersonState(null);
  const people = Array.isArray(gameState.famousPeople) ? gameState.famousPeople : [];
  const availability = getSeekAvailabilityFromState(gameState, state);
  return {
    people: clone(people),
    candidates: clone(state.candidates),
    count: people.length,
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
  createTutorialScoutFamousPerson,
  grantTutorialScoutFamousPerson,
  makeSkillName,
  getSeekAvailabilityFromState,
  getClientState,
  getClientStateFromNormalized,
  seekFamousPerson,
  acceptFamousPerson,
  dismissFamousPersonCandidate,
};
