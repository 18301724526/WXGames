const BuildingConfig = require('../config/BuildingConfig');
const BuildingState = require('../domain/BuildingState');
const TerritoryService = require('./TerritoryService');

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
  getTrainingStats,
  normalizeMilitaryState,
  advanceTraining,
};
