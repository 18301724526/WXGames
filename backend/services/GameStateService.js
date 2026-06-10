const BuildingState = require('../domain/BuildingState');
const { getAdvanceConfig } = require('../config/EraConfig');
const GameConfig = require('../config/GameConfig');
const CityService = require('./CityService');
const GameStateNormalizer = require('./GameStateNormalizer');
const ClientGameStateAssembler = require('./ClientGameStateAssembler');

function getBuildingLevel(buildings, buildingId) {
  return BuildingState.getLevel(buildings, buildingId);
}

function createInitialGameState(playerId) {
  return GameStateNormalizer.createInitialGameState(playerId);
}

function normalizeState(rawState) {
  return GameStateNormalizer.normalizeState(rawState);
}

function advanceRuntimeState(gameState, now = new Date()) {
  return GameStateNormalizer.advanceRuntimeState(gameState, now);
}

function getClientGameState(gameState) {
  return ClientGameStateAssembler.getClientGameState(gameState);
}

function getClientGameStateFromNormalized(gameState) {
  return ClientGameStateAssembler.getClientGameStateFromNormalized(gameState);
}

function applyOnlineProgress(gameState, now = new Date()) {
  const normalized = advanceRuntimeState(gameState, now);
  const lastUpdated = new Date(normalized.updatedAt || now);
  const elapsedSeconds = Math.floor((now - lastUpdated) / 1000);
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return normalized;
  const cappedSeconds = Math.min(elapsedSeconds, 60);
  CityService.advanceAllCities(normalized, cappedSeconds);
  normalized.updatedAt = now.toISOString();
  return normalized;
}

function calculateEraProgressFromNormalized(normalized) {
  const capital = CityService.getCapitalCity(normalized);
  const advanceConfig = getAdvanceConfig(normalized.currentEra);
  if (!advanceConfig) return { percentage: 100, canAdvance: false, conditions: [] };
  const conditions = advanceConfig.conditions.map((condition) => {
    const source = condition.source || 'resources';
    let rawCurrent = capital.resources?.[condition.key];
    if (source === 'military') rawCurrent = capital.military?.[condition.key];
    if (source === 'building') rawCurrent = getBuildingLevel(capital.buildings, condition.key);
    const current = Math.floor(rawCurrent || 0);
    const progress = Math.min(100, Math.floor((current / condition.required) * 100));
    return {
      name: condition.label,
      key: condition.key,
      source,
      required: condition.required,
      current,
      met: current >= condition.required,
      progress,
    };
  });
  const percentage = conditions.length ? Math.floor(conditions.reduce((sum, item) => sum + item.progress, 0) / conditions.length) : 100;
  return {
    percentage,
    canAdvance: conditions.every((item) => item.met),
    conditions,
    targetEra: advanceConfig.nextEra,
    targetEraName: advanceConfig.name,
    cost: advanceConfig.cost,
  };
}

function calculateEraProgress(gameState) {
  return calculateEraProgressFromNormalized(normalizeState(gameState));
}

function calculateOfflineIncome(gameState, offlineSeconds) {
  const normalized = normalizeState(gameState);
  const actualOffline = Math.min(Math.max(0, offlineSeconds), GameConfig.resources.maxOfflineHours * 3600);
  const result = CityService.calculateOfflineIncomeForAllCities(normalized, actualOffline, GameConfig.resources.offlineBaseEfficiency);
  return {
    ...(result.totalIncome || result.activeIncome || { food: 0, knowledge: 0, wood: 0, offlineHours: 0, efficiency: GameConfig.resources.offlineBaseEfficiency }),
    activeCity: result.activeIncome,
    byCity: result.incomeByCity,
  };
}

module.exports = {
  createInitialGameState,
  normalizeState,
  advanceRuntimeState,
  getClientGameState,
  getClientGameStateFromNormalized,
  calculateEraProgress,
  calculateEraProgressFromNormalized,
  calculateOfflineIncome,
  applyOnlineProgress,
};
