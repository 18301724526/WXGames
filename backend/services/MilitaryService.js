const { BuildingConfig, TutorialFlowConfig } = require('./config/GameplayConfigRuntime');
const BuildingState = require('../modules/BuildingState');
const TerritoryService = require('./TerritoryService');
const { manualAdvance } = require('./tutorial/TutorialProgression');
const { getTutorialScoutPersonId, getFirstArmyReserveFloor } = require('./tutorial/TutorialSelectors');
const FormationStrengthService = require('./military/FormationStrengthService');

const MAX_FORMATION_SLOTS = 3;
const MAX_FORMATION_MEMBERS = 5;
const FORMATION_NAMES = ['Formation 1', 'Formation 2', 'Formation 3'];
// Formations have no user-set name (the client never sends one), so the slot label is purely a
// localized default rendered by the client. Persisting the English default ('Formation N') leaked
// it into zh-CN UI, so store an empty name and let the client localize via military.formation.*.
const DEFAULT_FORMATION_NAME_PATTERN = /^Formation \d+$/;
function toStoredFormationName(rawName) {
  const name = String(rawName || '').trim();
  return DEFAULT_FORMATION_NAME_PATTERN.test(name) ? '' : name;
}

function getBarracksLevel(buildings) {
  return BuildingState.getLevel(buildings, 'barracks');
}

function getBarracksMilitaryConfig() {
  return BuildingConfig.getBuilding('barracks')?.military || {};
}

function getFormationStrengthPolicy() {
  return FormationStrengthService.normalizePolicy(getBarracksMilitaryConfig());
}

function getValueByLevel(values, level, fallback) {
  if (Array.isArray(values) && Number.isFinite(values[level])) return values[level];
  if (Array.isArray(values) && values.length > 0) return values[Math.min(level, values.length - 1)] || fallback;
  return fallback;
}

function getTrainingStats(buildings) {
  const level = getBarracksLevel(buildings);
  const config = getBarracksMilitaryConfig();
  const fallbackCap = level > 0 ? level * 5 : 0;
  const fallbackInterval = level > 0 ? Math.max(10, 40 - level * 10) : 0;
  const fallbackBatchSize = level > 0 ? 1 : 0;
  return {
    barracksLevel: level,
    soldierCap: getValueByLevel(config.soldierCapByLevel, level, fallbackCap),
    trainingIntervalSeconds: getValueByLevel(config.trainingIntervalSecondsByLevel, level, fallbackInterval),
    trainingBatchSize: getValueByLevel(config.trainingBatchSizeByLevel, level, fallbackBatchSize),
    defensePerSoldier: Number.isFinite(config.defensePerSoldier) ? config.defensePerSoldier : 1,
  };
}

function toNonNegativeNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return number;
}

function buildSoldierAvailabilityState(gameState = {}, soldiers = 0) {
  const military = {
    ...(gameState?.military || {}),
    soldiers,
  };
  const availabilityState = {
    ...(gameState || {}),
    military,
  };
  const activeCityId = availabilityState.activeCityId || 'capital';
  if (availabilityState.cities && typeof availabilityState.cities === 'object') {
    const city = availabilityState.cities[activeCityId];
    if (city) {
      availabilityState.cities = {
        ...availabilityState.cities,
        [activeCityId]: {
          ...city,
          military: {
            ...(city.military || {}),
            soldiers,
          },
        },
      };
    }
  }
  return availabilityState;
}

function normalizeFormationSlot(slot) {
  const value = Math.floor(Number(slot) || 0);
  if (value < 1 || value > MAX_FORMATION_SLOTS) return 0;
  return value;
}

// Formation members are validated against the famous-person roster. The roster
// lives in TWO places: the persisted single-source `famousPersons.people` and the
// legacy flat `famousPeople` (kept populated only while an ensure-grant ran on
// every load). Reading only the flat field silently drops every formation member
// once the flat copy is gone (e.g. after the tutorial scout grant became a
// one-shot task reward), which then trips the world-march tutorial gate. Union
// both so validation matches the persisted truth regardless of collection.
function collectValidPersonIds(gameState = {}) {
  const ids = new Set();
  const add = (list) => {
    (Array.isArray(list) ? list : []).forEach((person) => {
      const id = String(person?.id || '').trim();
      if (id) ids.add(id);
    });
  };
  add(gameState.famousPeople);
  add(gameState.famousPersons?.people);
  return ids;
}

function normalizeFormationMemberIds(memberIds, validPersonIds = null) {
  const rawIds = Array.isArray(memberIds) ? memberIds : [];
  const seen = new Set();
  const validSet = validPersonIds instanceof Set ? validPersonIds : null;
  const result = [];
  rawIds.forEach((rawId) => {
    const id = String(rawId || '').trim();
    if (!id || seen.has(id)) return;
    if (validSet && !validSet.has(id)) return;
    seen.add(id);
    result.push(id);
  });
  return result.slice(0, MAX_FORMATION_MEMBERS);
}

function createEmptyFormations() {
  const strengthPolicy = getFormationStrengthPolicy();
  return Array.from({ length: MAX_FORMATION_SLOTS }, (_, index) => ({
    slot: index + 1,
    name: '',
    memberIds: [],
    maxMembers: MAX_FORMATION_MEMBERS,
    maxSoldiersPerMember: strengthPolicy.perMemberSoldierCap,
    soldierAssignments: {},
    soldiersAssigned: 0,
  }));
}

function normalizeCityFormations(rawCityFormations, validPersonIds = null) {
  const strengthPolicy = getFormationStrengthPolicy();
  const source = Array.isArray(rawCityFormations)
    ? rawCityFormations
    : Object.values(rawCityFormations && typeof rawCityFormations === 'object' ? rawCityFormations : {});
  const bySlot = new Map();
  source.forEach((rawFormation, index) => {
    const raw = rawFormation && typeof rawFormation === 'object' ? rawFormation : {};
    const slot = normalizeFormationSlot(raw.slot || index + 1);
    if (!slot) return;
    const memberIds = normalizeFormationMemberIds(raw.memberIds || raw.members, validPersonIds);
    const strength = FormationStrengthService.normalizeFormationStrength({
      ...raw,
      memberIds,
    }, strengthPolicy);
    bySlot.set(slot, {
      slot,
      name: toStoredFormationName(raw.name),
      memberIds,
      maxMembers: MAX_FORMATION_MEMBERS,
      maxSoldiersPerMember: strengthPolicy.perMemberSoldierCap,
      soldierAssignments: strength.soldierAssignments,
      soldiersAssigned: strength.soldiersAssigned,
    });
  });
  return createEmptyFormations().map((fallback) => ({
    ...fallback,
    ...(bySlot.get(fallback.slot) || {}),
  }));
}

// Formations used to be double-keyed: cities[X].military.formations[X] — the outer
// cities map already scopes by city, so the inner cityId map was pure duplication, and a
// key mismatch silently read as an empty formation (the world-march 403 family). The
// owned shape is a plain 3-slot ARRAY on the city's military; the map arms below exist
// only to migrate legacy saves on read ('capital' covers historical mis-keyed writes).
function pickCityFormationsSource(rawFormations, cityId = 'capital') {
  if (Array.isArray(rawFormations)) return rawFormations;
  if (rawFormations && typeof rawFormations === 'object') {
    if (Array.isArray(rawFormations[cityId])) return rawFormations[cityId];
    if (Array.isArray(rawFormations.capital)) return rawFormations.capital;
    const firstArray = Object.values(rawFormations).find(Array.isArray);
    if (firstArray) return firstArray;
  }
  return [];
}

function normalizeMilitaryState(rawMilitary, gameState) {
  const stats = getTrainingStats(gameState?.buildings || {});
  // Tutorial first-army grant floor: while the formation guide runs, the
  // granted reserve must survive the barracks cap clamp (cap AND soldiers are
  // floored at the granted amount; after scoutFormationSaved the floor is 0 and
  // the residual reserve re-clamps to the barracks cap).
  const reserveFloor = getFirstArmyReserveFloor(gameState || {});
  const cap = Math.max(0, Math.floor(stats.soldierCap || 0), reserveFloor);
  const interval = Math.max(0, Number(stats.trainingIntervalSeconds || 0));
  const batchSize = Math.max(0, Math.floor(Number(stats.trainingBatchSize || 0)));
  const soldiers = Math.max(
    reserveFloor,
    Math.min(cap, Math.floor(toNonNegativeNumber(rawMilitary?.soldiers))),
  );
  const trainingProgress = cap > 0 && soldiers < cap && interval > 0
    ? Math.min(interval, toNonNegativeNumber(rawMilitary?.trainingProgress))
    : 0;
  const defensePerSoldier = Math.max(0, toNonNegativeNumber(stats.defensePerSoldier));
  const availabilityState = buildSoldierAvailabilityState(gameState || {}, soldiers);
  return {
    soldiers,
    soldierCap: cap,
    soldiersOnMission: TerritoryService.countSoldiersOnMission(availabilityState),
    availableSoldiers: TerritoryService.getAvailableSoldiers(availabilityState),
    trainingProgress,
    trainingIntervalSeconds: interval,
    trainingBatchSize: batchSize,
    defensePerSoldier,
    defense: soldiers * defensePerSoldier,
    formations: normalizeCityFormations(
      pickCityFormationsSource(rawMilitary?.formations, gameState?.activeCityId || 'capital'),
      collectValidPersonIds(gameState || {}),
    ),
  };
}

function getCityForMilitaryUpdate(gameState = {}, cityId = 'capital') {
  return gameState.cities?.[cityId] || null;
}

function getCityMilitary(gameState = {}, cityId = 'capital') {
  const city = getCityForMilitaryUpdate(gameState, cityId);
  if (city?.military) return city.military;
  return gameState.military || {};
}

function getCityResources(gameState = {}, cityId = 'capital') {
  const city = getCityForMilitaryUpdate(gameState, cityId);
  if (city?.resources) return city.resources;
  return gameState.resources || {};
}

function setCityMilitary(gameState = {}, cityId = 'capital', military = {}) {
  if (gameState.cities?.[cityId]) {
    gameState.cities[cityId].military = military;
    // Maintain the top-level alias (same reference as the active city) so legacy readers
    // keep seeing the city truth until the next normalize pass re-aliases.
    if (cityId === (gameState.activeCityId || 'capital')) gameState.military = military;
  } else {
    // No city slot to write to (an uninitialized object reached this service directly).
    // Fall back to the top-level field so the value is not silently dropped; once
    // cities[] exists it is the sole truth.
    gameState.military = military;
  }
  return military;
}

function setCityResources(gameState = {}, cityId = 'capital', resources = {}) {
  if (gameState.cities?.[cityId]) {
    gameState.cities[cityId].resources = resources;
    if (cityId === (gameState.activeCityId || 'capital')) gameState.resources = resources;
  } else {
    gameState.resources = resources;
  }
  return resources;
}

function applyResourceDelta(resources = {}, delta = {}) {
  const next = { ...(resources || {}) };
  Object.entries(delta || {}).forEach(([key, value]) => {
    const amount = Number(value) || 0;
    if (!key || amount === 0) return;
    next[key] = Math.max(0, Number(next[key] || 0) + amount);
    if (key === 'iron') next.metal = next.iron;
    if (key === 'metal') next.iron = next.metal;
  });
  return next;
}

function createNegativeCost(cost = {}) {
  return Object.fromEntries(Object.entries(cost || {}).map(([key, value]) => [key, -Math.max(0, Number(value) || 0)]));
}

function createMilitaryContext(gameState = {}, cityId = 'capital', military = null) {
  return {
    ...(gameState || {}),
    activeCityId: cityId,
    buildings: gameState.cities?.[cityId]?.buildings || gameState.buildings,
    military: military || getCityMilitary(gameState, cityId),
  };
}

function isFormationLocked(gameState = {}, cityId = 'capital', slot = 1) {
  return (Array.isArray(gameState.exploreMissions) ? gameState.exploreMissions : [])
    .some((mission) => FormationStrengthService.isFormationLockedByMission(mission, cityId, slot));
}

function setArmyFormation(gameState, payload = {}) {
  const cityId = String(payload.cityId || gameState?.activeCityId || 'capital').trim() || 'capital';
  const slot = normalizeFormationSlot(payload.slot);
  if (!slot) {
    return { success: false, error: 'FORMATION_SLOT_INVALID', message: 'Formation slot invalid' };
  }
  if (gameState?.cities && Object.keys(gameState.cities).length && !gameState.cities[cityId]) {
    return { success: false, error: 'CITY_NOT_FOUND', message: 'City not found' };
  }
  if (isFormationLocked(gameState, cityId, slot)) {
    return { success: false, error: 'FORMATION_LOCKED_BY_MISSION', message: 'Formation is away from the city.' };
  }
  const sourceMilitary = getCityMilitary(gameState, cityId);
  const context = createMilitaryContext(gameState, cityId, sourceMilitary);
  const normalizedMilitary = normalizeMilitaryState(sourceMilitary, context);
  setCityMilitary(gameState, cityId, normalizedMilitary);
  const validPersonIds = collectValidPersonIds(gameState);
  const memberIds = normalizeFormationMemberIds(payload.memberIds || payload.members, validPersonIds);
  const strengthPolicy = getFormationStrengthPolicy();
  const requestedSource = payload.soldierAssignments || payload.memberSoldiers || {};
  const assignmentValidation = FormationStrengthService.validateRequestedAssignments(
    requestedSource,
    memberIds,
    strengthPolicy,
  );
  if (!assignmentValidation.success) {
    return {
      success: false,
      error: assignmentValidation.error,
      message: assignmentValidation.error === 'FORMATION_SOLDIER_CAP_EXCEEDED'
        ? 'Formation soldier cap exceeded'
        : 'Formation soldier assignment invalid',
      personId: assignmentValidation.personId,
      cap: assignmentValidation.cap,
    };
  }
  const formations = normalizeCityFormations(
    pickCityFormationsSource(normalizedMilitary.formations, cityId),
    validPersonIds,
  );
  const previousFormation = formations[slot - 1] || {};
  const requestedAssignments = FormationStrengthService.normalizeSoldierAssignments(
    payload.soldierAssignments || payload.memberSoldiers || previousFormation.soldierAssignments || {},
    memberIds,
    strengthPolicy,
  );
  const previousAssigned = FormationStrengthService.sumAssignments(previousFormation.soldierAssignments || {});
  const nextAssigned = FormationStrengthService.sumAssignments(requestedAssignments);
  const reserveDelta = nextAssigned - previousAssigned;
  const cityResources = getCityResources(gameState, cityId);
  if (reserveDelta > normalizedMilitary.soldiers) {
    return { success: false, error: 'INSUFFICIENT_CITY_SOLDIERS', message: 'City reserve soldiers are insufficient' };
  }
  const refund = reserveDelta < 0
    ? FormationStrengthService.scaleResourceCost(
      strengthPolicy.recruitmentCostPerSoldier,
      Math.abs(reserveDelta),
      strengthPolicy.soldierRefundRatio,
      { round: 'floor' },
    )
    : {};
  formations[slot - 1] = {
    ...formations[slot - 1],
    slot,
    name: FORMATION_NAMES[slot - 1] || `Formation ${slot}`,
    memberIds,
    maxMembers: MAX_FORMATION_MEMBERS,
    maxSoldiersPerMember: strengthPolicy.perMemberSoldierCap,
    soldierAssignments: requestedAssignments,
    soldiersAssigned: nextAssigned,
  };
  const nextMilitary = normalizeMilitaryState({
    ...normalizedMilitary,
    soldiers: normalizedMilitary.soldiers - Math.max(0, reserveDelta),
    formations,
  }, createMilitaryContext(gameState, cityId, normalizedMilitary));
  setCityMilitary(gameState, cityId, nextMilitary);
  if (reserveDelta < 0) setCityResources(gameState, cityId, applyResourceDelta(cityResources, refund));
  const scoutPersonId = getTutorialScoutPersonId(gameState);
  const tutorial = scoutPersonId && memberIds.includes(String(scoutPersonId))
    ? manualAdvance(gameState.tutorial, TutorialFlowConfig.TUTORIAL_STEPS.scoutFormationSaved)
    : gameState.tutorial;
  gameState.tutorial = tutorial;
  return {
    success: true,
    message: `${FORMATION_NAMES[slot - 1] || `Formation ${slot}`} saved`,
    formation: (getCityMilitary(gameState, cityId).formations || [])[slot - 1] || null,
    reserveDelta,
    refund,
    tutorial,
  };
}

function advanceTraining(gameState, deltaSeconds = 0) {
  const elapsed = Math.max(0, Math.floor(toNonNegativeNumber(deltaSeconds)));
  const cityId = gameState.activeCityId || 'capital';
  const current = normalizeMilitaryState(getCityMilitary(gameState, cityId), gameState);
  let soldiers = current.soldiers;
  let trainingProgress = current.trainingProgress;
  let trained = 0;
  const strengthPolicy = getFormationStrengthPolicy();
  const cityResources = getCityResources(gameState, cityId);

  if (
    elapsed > 0
    && current.soldierCap > 0
    && current.trainingIntervalSeconds > 0
    && current.trainingBatchSize > 0
    && soldiers < current.soldierCap
  ) {
    const totalProgress = trainingProgress + elapsed;
    const possibleBatches = Math.floor(totalProgress / current.trainingIntervalSeconds);
    const possibleTrained = Math.min(possibleBatches * current.trainingBatchSize, current.soldierCap - soldiers);
    trained = FormationStrengthService.getAffordableSoldierCount(
      cityResources,
      strengthPolicy.recruitmentCostPerSoldier,
      possibleTrained,
    );
    soldiers += trained;
    if (trained > 0) {
      const resourceCost = FormationStrengthService.scaleResourceCost(strengthPolicy.recruitmentCostPerSoldier, trained);
      setCityResources(gameState, cityId, applyResourceDelta(cityResources, createNegativeCost(resourceCost)));
    }
    trainingProgress = trained <= 0 && possibleTrained > 0
      ? current.trainingIntervalSeconds
      : soldiers >= current.soldierCap
      ? 0
      : totalProgress - possibleBatches * current.trainingIntervalSeconds;
  }

  const nextMilitary = normalizeMilitaryState({ ...current, soldiers, trainingProgress }, gameState);
  setCityMilitary(gameState, cityId, nextMilitary);
  return { trained, military: nextMilitary };
}

function settleFormationSnapshot(gameState, snapshot = {}, options = {}) {
  const normalizedSnapshot = FormationStrengthService.normalizeFormationSnapshot(snapshot);
  if (!normalizedSnapshot || FormationStrengthService.isSnapshotSettled(snapshot)) {
    return { success: false, error: 'FORMATION_SNAPSHOT_INVALID' };
  }
  const cityId = String(options.cityId || normalizedSnapshot.sourceCityId || 'capital').trim() || 'capital';
  const slot = normalizeFormationSlot(options.slot || normalizedSnapshot.slot);
  if (!slot) return { success: false, error: 'FORMATION_SLOT_INVALID' };
  const sourceMilitary = getCityMilitary(gameState, cityId);
  const context = createMilitaryContext(gameState, cityId, sourceMilitary);
  const normalizedMilitary = normalizeMilitaryState(sourceMilitary, context);
  const validPersonIds = collectValidPersonIds(gameState);
  const formations = normalizeCityFormations(
    pickCityFormationsSource(normalizedMilitary.formations, cityId),
    validPersonIds,
  );
  const formation = formations[slot - 1] || null;
  if (!formation) return { success: false, error: 'FORMATION_NOT_FOUND' };
  const assignments = FormationStrengthService.normalizeSoldierAssignments(
    FormationStrengthService.getSnapshotAssignments(normalizedSnapshot),
    formation.memberIds,
    getFormationStrengthPolicy(),
  );
  formations[slot - 1] = {
    ...formation,
    soldierAssignments: assignments,
    soldiersAssigned: FormationStrengthService.sumAssignments(assignments),
  };
  const nextMilitary = normalizeMilitaryState({
    ...normalizedMilitary,
    formations,
  }, context);
  setCityMilitary(gameState, cityId, nextMilitary);
  const settledAt = options.now instanceof Date ? options.now.toISOString() : new Date(options.now || Date.now()).toISOString();
  return {
    success: true,
    formation: (nextMilitary.formations || [])[slot - 1] || null,
    snapshot: {
      ...normalizedSnapshot,
      settledAt,
    },
  };
}

module.exports = {
  MAX_FORMATION_SLOTS,
  MAX_FORMATION_MEMBERS,
  getFormationStrengthPolicy,
  getTrainingStats,
  normalizeMilitaryState,
  normalizeCityFormations,
  pickCityFormationsSource,
  setArmyFormation,
  settleFormationSnapshot,
  advanceTraining,
  // Canonical city-scoped accessors — the single read/write doorway for military and
  // resource facts (top-level fields are aliases of the active city, never copies).
  getCityMilitary,
  setCityMilitary,
  getCityResources,
  setCityResources,
};
