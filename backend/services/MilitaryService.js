const { BuildingConfig } = require('./config/GameplayConfigRuntime');
const BuildingState = require('../modules/BuildingState');
const TerritoryService = require('./TerritoryService');
const FormationStrengthService = require('./military/FormationStrengthService');
const TaskRewardGrantLedger = require('./taskCenter/TaskRewardGrantLedger');
const veteranCampCore = require('../../shared/veteranCampCore');
const ConfigTables = require('../config/ConfigTables');

const MAX_FORMATION_SLOTS = 3;
const MAX_FORMATION_MEMBERS = 5;
// Every city owns a level-1 veteran camp by default (the user's design: no build-from-zero).
// Existing saves without a camp normalize up to level 1 with an empty parking pool.
const DEFAULT_VETERAN_CAMP_LEVEL = 1;

function resolveNowMs(source) {
  const raw = Number(source?.nowMs);
  return Number.isFinite(raw) && raw > 0 ? raw : Date.now();
}

// The veteran_camp config row for a level, with a fail-safe fallback (a level with no row
// behaves like a zero-capacity camp: everything overflows to instant refund).
function getVeteranCampRow(level) {
  return ConfigTables.getById('veteran_camp', level)
    || { level, capacity: 0, retentionHours: 0, refundRatio: 0.5, upgradeCostGrain: 0 };
}

// Read the camp off a military object, defaulting an absent camp to level 1.
function readVeteranCamp(military) {
  const raw = military?.veteranCamp;
  const level = raw?.level == null ? DEFAULT_VETERAN_CAMP_LEVEL : raw.level;
  return veteranCampCore.normalizeCamp(raw, level);
}

// Resolve the camp's refund ratio, defaulting a missing OR non-finite value (e.g. a NaN from a
// corrupt config cell) to 0.5 — `?? 0.5` alone would let a bad string through as NaN.
function resolveRefundRatio(row) {
  const raw = Number(row?.refundRatio);
  return Math.max(0, Number.isFinite(raw) ? raw : 0.5);
}

// Refund grain for N soldiers leaving the camp (drained or overflowed). Credited as a
// FRACTIONAL delta on purpose: the drain trickles a soldier at a time and scaleResourceCost's
// integer floor would swallow every sub-1 refund (floor(1 * 0.5) = 0). Food is already a
// float in the resource tick, so fractional credit is lossless and consistent.
function veteranCampRefundDelta(soldiers, row) {
  const count = Math.max(0, Number(soldiers) || 0);
  if (count <= 0) return {};
  const ratio = resolveRefundRatio(row);
  const costPerSoldier = getFormationStrengthPolicy().recruitmentCostPerSoldier || { food: 1 };
  const delta = {};
  Object.entries(costPerSoldier).forEach(([key, amount]) => {
    const value = count * (Number(amount) || 0) * ratio;
    if (value > 0) delta[key] = value;
  });
  return delta;
}
// Formations have no user-set name (the client never sends one), so the slot label is purely a
// localized default rendered by the client. Persisting the English default ('Formation N') leaked
// it into zh-CN UI, so store an empty name and let the client localize via military.formation.*.
// The pattern also self-heals legacy saves that still carry the baked English default.
const DEFAULT_FORMATION_NAME_PATTERN = /^Formation \d+$/;
function toStoredFormationName(rawName) {
  const name = String(rawName || '').trim();
  return DEFAULT_FORMATION_NAME_PATTERN.test(name) ? '' : name;
}

// Transient zh display name for server messages only — never persisted.
function getFormationDisplayName(formation = {}, slot = 1) {
  return toStoredFormationName(formation.name) || `${slot}号编队`;
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
// once the flat copy is gone (for example after a one-shot task reward). Union
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

function getFirstArmyReserveFloor(gameState = {}, rawMilitary = null) {
  const grant = TaskRewardGrantLedger.getSoldierGrant(
    gameState,
    TaskRewardGrantLedger.FIRST_ARMY_GRANT_KEY,
  );
  const grantedSoldiers = Math.max(0, Math.floor(Number(grant?.soldiers) || 0));
  if (!grantedSoldiers) return 0;
  const cityId = String(gameState.activeCityId || 'capital');
  const military = rawMilitary || gameState.cities?.[cityId]?.military || gameState.military || {};
  const assignedSoldiers = pickCityFormationsSource(military.formations, cityId)
    .reduce((total, formation) => (
      total + FormationStrengthService.sumAssignments(formation?.soldierAssignments || {})
    ), 0);
  return Math.max(0, grantedSoldiers - assignedSoldiers);
}

function normalizeMilitaryState(rawMilitary, gameState) {
  const stats = getTrainingStats(gameState?.buildings || {});
  // Keep the claimed first-army reward available across cap normalization. Soldiers
  // already assigned to formations reduce the reserve floor, so this never duplicates them.
  const reserveFloor = getFirstArmyReserveFloor(gameState || {}, rawMilitary);
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
    // 老兵营地 (dismissal regret-buffer): parked soldiers + level. Defaults to level 1 so every
    // city has a camp; the pure drain/withdraw math lives in shared/veteranCampCore.
    veteranCamp: readVeteranCamp(rawMilitary),
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
    return { success: false, error: 'FORMATION_SLOT_INVALID', message: '编队槽位无效' };
  }
  if (gameState?.cities && Object.keys(gameState.cities).length && !gameState.cities[cityId]) {
    return { success: false, error: 'CITY_NOT_FOUND', message: '城市不存在' };
  }
  if (isFormationLocked(gameState, cityId, slot)) {
    return { success: false, error: 'FORMATION_LOCKED_BY_MISSION', message: '编队正在城外执行任务，无法调整' };
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
        ? '编队士兵数超过上限'
        : '编队士兵分配无效',
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
    return { success: false, error: 'INSUFFICIENT_CITY_SOLDIERS', message: '城内预备兵力不足' };
  }
  // Dismissing soldiers (reserveDelta < 0) parks them in the veteran camp instead of
  // vanishing for an instant refund. Only what overflows camp capacity — plus any soldiers
  // that drained during the catch-up projection — is refunded now; the rest drains over time.
  let refund = {};
  let nextVeteranCamp = normalizedMilitary.veteranCamp;
  if (reserveDelta < 0) {
    const nowMs = resolveNowMs(payload);
    const dismissed = Math.abs(reserveDelta);
    const camp = readVeteranCamp(normalizedMilitary);
    const campRow = getVeteranCampRow(camp.level);
    const deposited = veteranCampCore.deposit(camp, campRow, dismissed, nowMs);
    nextVeteranCamp = deposited.camp;
    refund = veteranCampRefundDelta(deposited.overflowSoldiers + deposited.drainedSoldiers, campRow);
  }
  formations[slot - 1] = {
    ...formations[slot - 1],
    slot,
    // No default name is persisted: '' lets the client render its localized
    // military.formation.default label (user-set names pass through untouched).
    name: toStoredFormationName(formations[slot - 1]?.name),
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
    veteranCamp: nextVeteranCamp,
  }, createMilitaryContext(gameState, cityId, normalizedMilitary));
  setCityMilitary(gameState, cityId, nextMilitary);
  if (Object.keys(refund).length) setCityResources(gameState, cityId, applyResourceDelta(cityResources, refund));
  return {
    success: true,
    message: `${getFormationDisplayName(formations[slot - 1], slot)}已保存`,
    formation: (getCityMilitary(gameState, cityId).formations || [])[slot - 1] || null,
    reserveDelta,
    refund,
  };
}

// Advance a city's veteran camp to `nowMs`: parked soldiers drain (linearly over retention),
// each drained soldier trickling its refund back into resources. Pure inputs, pure outputs —
// the caller (real-time tick + offline settlement) assigns the returned military/resources.
// Idempotent between the same two timestamps (drainedSoldiers is 0 on a repeat call).
function settleVeteranCampDrain(military = {}, resources = {}, nowMs = Date.now()) {
  const camp = readVeteranCamp(military);
  const campRow = getVeteranCampRow(camp.level);
  const drained = veteranCampCore.projectDrain(camp, campRow, nowMs);
  const nextMilitary = { ...military, veteranCamp: drained.camp };
  if (drained.drainedSoldiers <= 0) {
    return { military: nextMilitary, resources, refund: {} };
  }
  const refund = veteranCampRefundDelta(drained.drainedSoldiers, campRow);
  return {
    military: nextMilitary,
    resources: applyResourceDelta(resources, refund),
    refund,
  };
}

// Withdraw parked soldiers back into the city reserve (the "regret" undo). Drains to now first
// (crediting any pending refund), then pulls up to the reserve's free space so a full reserve
// never clamps — and never silently destroys — the rescued soldiers.
function veteranCampWithdraw(gameState, payload = {}) {
  const cityId = String(payload.cityId || gameState?.activeCityId || 'capital').trim() || 'capital';
  if (gameState?.cities && Object.keys(gameState.cities).length && !gameState.cities[cityId]) {
    return { success: false, error: 'CITY_NOT_FOUND', message: '城市不存在' };
  }
  const nowMs = resolveNowMs(payload);
  const normalized = normalizeMilitaryState(getCityMilitary(gameState, cityId), createMilitaryContext(gameState, cityId));
  const settled = settleVeteranCampDrain(normalized, getCityResources(gameState, cityId), nowMs);
  const camp = readVeteranCamp(settled.military);
  const campRow = getVeteranCampRow(camp.level);
  const reserveSpace = Math.max(0, settled.military.soldierCap - settled.military.soldiers);
  const parked = veteranCampCore.parkedTotal(camp);
  // Distinguish "soldiers omitted" (withdraw all) from an explicit 0 (a no-op). A bare
  // `requested || parked` would treat an explicit 0/negative/fractional request as "withdraw
  // everything" — emptying the camp and forfeiting the accruing drain refund.
  const hasExplicitRequest = payload.soldiers != null && payload.soldiers !== '';
  const requested = Math.max(0, Math.floor(Number(payload.soldiers) || 0));
  const desired = hasExplicitRequest ? requested : parked;
  const target = Math.min(desired, reserveSpace, parked);
  if (target <= 0) {
    if (hasExplicitRequest && requested <= 0) {
      return { success: false, error: 'NOTHING_REQUESTED', message: '未指定取回数量' };
    }
    const reason = reserveSpace <= 0 ? 'RESERVE_FULL' : 'VETERAN_CAMP_EMPTY';
    return {
      success: false,
      error: reason,
      message: reason === 'RESERVE_FULL' ? '城内预备兵力已满，无法取回' : '老兵营地暂无可取回的士兵',
    };
  }
  const pulled = veteranCampCore.withdraw(camp, campRow, target, nowMs);
  const nextMilitary = normalizeMilitaryState({
    ...settled.military,
    soldiers: settled.military.soldiers + pulled.withdrawnSoldiers,
    veteranCamp: pulled.camp,
  }, createMilitaryContext(gameState, cityId, settled.military));
  setCityMilitary(gameState, cityId, nextMilitary);
  setCityResources(gameState, cityId, settled.resources);
  return {
    success: true,
    message: `已从老兵营地取回 ${pulled.withdrawnSoldiers} 名士兵`,
    withdrawnSoldiers: pulled.withdrawnSoldiers,
    veteranCamp: getVeteranCampView(nextMilitary, nowMs),
  };
}

// Upgrade the camp one level for its grain (food) cost. unlockEra is carried in the table but
// not yet gated here (era wiring is a follow-up, like the garrison reclaim rule).
function veteranCampUpgrade(gameState, payload = {}) {
  const cityId = String(payload.cityId || gameState?.activeCityId || 'capital').trim() || 'capital';
  if (gameState?.cities && Object.keys(gameState.cities).length && !gameState.cities[cityId]) {
    return { success: false, error: 'CITY_NOT_FOUND', message: '城市不存在' };
  }
  const normalized = normalizeMilitaryState(getCityMilitary(gameState, cityId), createMilitaryContext(gameState, cityId));
  const camp = readVeteranCamp(normalized);
  const nextLevel = camp.level + 1;
  const nextRow = ConfigTables.getById('veteran_camp', nextLevel);
  if (!nextRow) {
    return { success: false, error: 'VETERAN_CAMP_MAX_LEVEL', message: '老兵营地已达最高等级' };
  }
  const cost = Math.max(0, Math.floor(Number(nextRow.upgradeCostGrain) || 0));
  const cityResources = getCityResources(gameState, cityId);
  if ((Number(cityResources.food) || 0) < cost) {
    return { success: false, error: 'INSUFFICIENT_GRAIN', message: '粮食不足', cost };
  }
  const nextMilitary = normalizeMilitaryState({
    ...normalized,
    veteranCamp: { ...camp, level: nextLevel },
  }, createMilitaryContext(gameState, cityId, normalized));
  setCityMilitary(gameState, cityId, nextMilitary);
  if (cost > 0) setCityResources(gameState, cityId, applyResourceDelta(cityResources, { food: -cost }));
  return {
    success: true,
    message: `老兵营地升级至 ${nextLevel} 级`,
    level: nextLevel,
    cost,
    veteranCamp: getVeteranCampView(nextMilitary, resolveNowMs(payload)),
  };
}

// Read-only client view of the camp: level, capacity, current parked (drained to now), each
// batch's drain ETA, and the next-level upgrade cost. The projection has no side effects — the
// authoritative refund settlement stays in settleVeteranCampDrain (the tick).
function getVeteranCampView(military, nowMs = Date.now()) {
  // Show the LAST-SETTLED counts (not a fresh drain projection): the parked total then always
  // matches the grain refund that has actually been credited, instead of racing ahead of it.
  // The per-batch drain ETA is a pure display projection off atMs, so it stays live.
  const camp = readVeteranCamp(military);
  const campRow = getVeteranCampRow(camp.level);
  const nextRow = ConfigTables.getById('veteran_camp', camp.level + 1);
  return {
    level: camp.level,
    capacity: veteranCampCore.capacityOf(campRow),
    retentionHours: Math.max(0, Number(campRow.retentionHours) || 0),
    refundRatio: resolveRefundRatio(campRow),
    parkedTotal: veteranCampCore.parkedTotal(camp),
    batches: camp.batches.map((batch) => ({
      soldiers: veteranCampCore.batchParked(batch),
      drainEtaMs: veteranCampCore.batchDrainEtaMs(batch, campRow, nowMs),
    })),
    nextLevel: nextRow
      ? { level: camp.level + 1, upgradeCostGrain: Math.max(0, Math.floor(Number(nextRow.upgradeCostGrain) || 0)) }
      : null,
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
  settleVeteranCampDrain,
  veteranCampWithdraw,
  veteranCampUpgrade,
  getVeteranCampView,
  // Canonical city-scoped accessors — the single read/write doorway for military and
  // resource facts (top-level fields are aliases of the active city, never copies).
  getCityMilitary,
  setCityMilitary,
  getCityResources,
  setCityResources,
};
