const BuildingConfig = require('../config/BuildingConfig');
const BuildingState = require('../domain/BuildingState');
const TerritoryService = require('./TerritoryService');
const { TUTORIAL_STEPS, createPhaseCompleted } = require('../config/TutorialFlowConfig');

const MAX_FORMATION_SLOTS = 3;
const MAX_FORMATION_MEMBERS = 5;
const FORMATION_NAMES = ['部队一', '部队二', '部队三'];

function advanceTutorialStep(tutorial = {}, nextStep = 0) {
  const step = Math.floor(Number(nextStep) || 0);
  const currentStep = Math.floor(Number(tutorial.currentStep) || 0);
  if (tutorial.completed || tutorial.disabled || step <= currentStep) return tutorial;
  return {
    ...tutorial,
    currentStep: step,
    phaseCompleted: {
      ...(tutorial.phaseCompleted || {}),
      ...createPhaseCompleted(step),
    },
    completed: step >= TUTORIAL_STEPS.completed,
    updatedAt: new Date().toISOString(),
  };
}

function getBarracksLevel(buildings) {
  return BuildingState.getLevel(buildings, 'barracks');
}

function getBarracksMilitaryConfig() {
  return BuildingConfig.getBuilding('barracks')?.military || {};
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

function migrateLegacySoldiers(rawMilitary, stats) {
  const soldiers = Math.max(0, Math.floor(toNonNegativeNumber(rawMilitary?.soldiers)));
  const cap = Math.max(0, Math.floor(stats.soldierCap || 0));
  if (soldiers <= 0 || cap < 100) return soldiers;
  const hasHundredScaleFields = Object.prototype.hasOwnProperty.call(rawMilitary || {}, 'trainingBatchSize')
    || Number(rawMilitary?.defensePerSoldier) === Number(stats.defensePerSoldier);
  if (!hasHundredScaleFields && soldiers < 100) return Math.min(cap, soldiers * 100);
  return soldiers;
}

function normalizeFormationSlot(slot) {
  const value = Math.floor(Number(slot) || 0);
  if (value < 1 || value > MAX_FORMATION_SLOTS) return 0;
  return value;
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
  return Array.from({ length: MAX_FORMATION_SLOTS }, (_, index) => ({
    slot: index + 1,
    name: FORMATION_NAMES[index] || `部队${index + 1}`,
    memberIds: [],
    maxMembers: MAX_FORMATION_MEMBERS,
  }));
}

function normalizeCityFormations(rawCityFormations, validPersonIds = null) {
  const source = Array.isArray(rawCityFormations)
    ? rawCityFormations
    : Object.values(rawCityFormations && typeof rawCityFormations === 'object' ? rawCityFormations : {});
  const bySlot = new Map();
  source.forEach((rawFormation, index) => {
    const raw = rawFormation && typeof rawFormation === 'object' ? rawFormation : {};
    const slot = normalizeFormationSlot(raw.slot || index + 1);
    if (!slot) return;
    bySlot.set(slot, {
      slot,
      name: String(raw.name || FORMATION_NAMES[slot - 1] || `部队${slot}`).trim(),
      memberIds: normalizeFormationMemberIds(raw.memberIds || raw.members, validPersonIds),
      maxMembers: MAX_FORMATION_MEMBERS,
    });
  });
  return createEmptyFormations().map((fallback) => ({
    ...fallback,
    ...(bySlot.get(fallback.slot) || {}),
  }));
}

function normalizeArmyFormations(rawFormations, gameState = {}) {
  const validPersonIds = new Set((Array.isArray(gameState.famousPeople) ? gameState.famousPeople : [])
    .map((person) => String(person?.id || '').trim())
    .filter(Boolean));
  const source = rawFormations && typeof rawFormations === 'object' ? rawFormations : {};
  const cityIds = new Set(Object.keys(source).filter(Boolean));
  cityIds.add(gameState.activeCityId || 'capital');
  cityIds.add('capital');
  const formations = {};
  cityIds.forEach((cityId) => {
    const key = String(cityId || '').trim();
    if (!key) return;
    formations[key] = normalizeCityFormations(source[key], validPersonIds);
  });
  return formations;
}

function normalizeMilitaryState(rawMilitary, gameState) {
  const stats = getTrainingStats(gameState?.buildings || {});
  const cap = Math.max(0, Math.floor(stats.soldierCap || 0));
  const interval = Math.max(0, Number(stats.trainingIntervalSeconds || 0));
  const batchSize = Math.max(0, Math.floor(Number(stats.trainingBatchSize || 0)));
  const soldiers = Math.min(cap, migrateLegacySoldiers(rawMilitary, stats));
  const trainingProgress = cap > 0 && soldiers < cap && interval > 0
    ? Math.min(interval, toNonNegativeNumber(rawMilitary?.trainingProgress))
    : 0;
  const defensePerSoldier = Math.max(0, toNonNegativeNumber(stats.defensePerSoldier));
  return {
    soldiers,
    soldierCap: cap,
    soldiersOnMission: TerritoryService.countSoldiersOnMission(gameState || {}),
    availableSoldiers: TerritoryService.getAvailableSoldiers(gameState || {}),
    trainingProgress,
    trainingIntervalSeconds: interval,
    trainingBatchSize: batchSize,
    defensePerSoldier,
    defense: soldiers * defensePerSoldier,
    formations: normalizeArmyFormations(rawMilitary?.formations, gameState || {}),
  };
}

function setArmyFormation(gameState, payload = {}) {
  const cityId = String(payload.cityId || gameState?.activeCityId || 'capital').trim() || 'capital';
  const slot = normalizeFormationSlot(payload.slot);
  if (!slot) {
    return { success: false, error: 'FORMATION_SLOT_INVALID', message: '编队位置不存在' };
  }
  if (gameState?.cities && Object.keys(gameState.cities).length && !gameState.cities[cityId]) {
    return { success: false, error: 'CITY_NOT_FOUND', message: '城市不存在' };
  }
  gameState.military = normalizeMilitaryState(gameState.military, gameState);
  const validPersonIds = new Set((Array.isArray(gameState.famousPeople) ? gameState.famousPeople : [])
    .map((person) => String(person?.id || '').trim())
    .filter(Boolean));
  const memberIds = normalizeFormationMemberIds(payload.memberIds || payload.members, validPersonIds);
  const formations = {
    ...(gameState.military.formations || {}),
    [cityId]: normalizeCityFormations(gameState.military.formations?.[cityId], validPersonIds),
  };
  formations[cityId][slot - 1] = {
    ...formations[cityId][slot - 1],
    slot,
    name: FORMATION_NAMES[slot - 1] || `部队${slot}`,
    memberIds,
    maxMembers: MAX_FORMATION_MEMBERS,
  };
  gameState.military = normalizeMilitaryState({
    ...gameState.military,
    formations,
  }, gameState);
  if (gameState.cities?.[cityId]) {
    gameState.cities[cityId].military = gameState.military;
  }
  const scoutPersonId = gameState.tutorial?.grants?.scoutFamousPerson?.personId;
  const tutorial = scoutPersonId && memberIds.includes(String(scoutPersonId))
    ? advanceTutorialStep(gameState.tutorial, TUTORIAL_STEPS.scoutFormationSaved)
    : gameState.tutorial;
  gameState.tutorial = tutorial;
  return {
    success: true,
    message: `${FORMATION_NAMES[slot - 1] || `部队${slot}`}编队已保存`,
    formation: gameState.military.formations?.[cityId]?.[slot - 1] || null,
    tutorial,
  };
}

function advanceTraining(gameState, deltaSeconds = 0) {
  const elapsed = Math.max(0, Math.floor(toNonNegativeNumber(deltaSeconds)));
  const current = normalizeMilitaryState(gameState.military, gameState);
  let soldiers = current.soldiers;
  let trainingProgress = current.trainingProgress;
  let trained = 0;

  if (
    elapsed > 0
    && current.soldierCap > 0
    && current.trainingIntervalSeconds > 0
    && current.trainingBatchSize > 0
    && soldiers < current.soldierCap
  ) {
    const totalProgress = trainingProgress + elapsed;
    const possibleBatches = Math.floor(totalProgress / current.trainingIntervalSeconds);
    trained = Math.min(possibleBatches * current.trainingBatchSize, current.soldierCap - soldiers);
    soldiers += trained;
    trainingProgress = soldiers >= current.soldierCap
      ? 0
      : totalProgress - possibleBatches * current.trainingIntervalSeconds;
  }

  gameState.military = normalizeMilitaryState({ ...current, soldiers, trainingProgress }, gameState);
  return { trained, military: gameState.military };
}

module.exports = {
  MAX_FORMATION_SLOTS,
  MAX_FORMATION_MEMBERS,
  getTrainingStats,
  normalizeMilitaryState,
  normalizeArmyFormations,
  setArmyFormation,
  advanceTraining,
};
