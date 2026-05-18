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
  return {
    barracksLevel: level,
    soldierCap: getValueByLevel(config.soldierCapByLevel, level, fallbackCap),
    trainingIntervalSeconds: getValueByLevel(config.trainingIntervalSecondsByLevel, level, fallbackInterval),
    defensePerSoldier: Number.isFinite(config.defensePerSoldier) ? config.defensePerSoldier : 1,
  };
}

function toNonNegativeNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return number;
}

function normalizeMilitaryState(rawMilitary, gameState) {
  const stats = getTrainingStats(gameState?.buildings || {});
  const cap = Math.max(0, Math.floor(stats.soldierCap || 0));
  const interval = Math.max(0, Number(stats.trainingIntervalSeconds || 0));
  const soldiers = Math.min(cap, Math.max(0, Math.floor(toNonNegativeNumber(rawMilitary?.soldiers))));
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

  if (elapsed > 0 && current.soldierCap > 0 && current.trainingIntervalSeconds > 0 && soldiers < current.soldierCap) {
    const totalProgress = trainingProgress + elapsed;
    const possibleTrained = Math.floor(totalProgress / current.trainingIntervalSeconds);
    trained = Math.min(possibleTrained, current.soldierCap - soldiers);
    soldiers += trained;
    trainingProgress = soldiers >= current.soldierCap
      ? 0
      : totalProgress - possibleTrained * current.trainingIntervalSeconds;
  }

  gameState.military = normalizeMilitaryState({ ...current, soldiers, trainingProgress }, gameState);
  return { trained, military: gameState.military };
}

module.exports = {
  getTrainingStats,
  normalizeMilitaryState,
  advanceTraining,
};
