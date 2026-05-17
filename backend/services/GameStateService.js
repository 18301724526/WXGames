const BuildingState = require('../domain/BuildingState');
const TutorialService = require('./TutorialService');
const BuildingActionService = require('./BuildingActionService');
const BuildingEffectCalculator = require('../calculators/BuildingEffectCalculator');
const ResourceTickCalculator = require('../calculators/ResourceTickCalculator');
const BuildingUnlockService = require('./BuildingUnlockService');
const BuildingCostCalculator = require('../calculators/BuildingCostCalculator');
const { getAdvanceConfig, getEraName, getEraDescription } = require('../config/EraConfig');
const BuildingConfig = require('../config/BuildingConfig');
const GameConfig = require('../config/GameConfig');
const MilitaryService = require('./MilitaryService');

function createInitialGameState(playerId) {
  const buildings = BuildingState.createInitialBuildingState();
  const buildingEffects = BuildingEffectCalculator.calculate(buildings);
  return {
    playerId,
    resources: { food: 100, knowledge: 0, wood: 0, stone: 0, metal: 0 },
    buildings,
    buildingEffects,
    population: { total: 3, max: 3, maxPop: 3, farmers: 3, scholars: 0, craftsmen: 0, unassigned: 0, growthProgress: 0 },
    techs: {},
    techEffects: {},
    currentEra: 0,
    eraHistory: [{ era: 0, advancedAt: new Date().toISOString() }],
    happiness: 100,
    gameDay: 1,
    eventQueue: [],
    eventHistory: [],
    offlineSnapshot: {},
    offlineEventLog: [],
    negativeStreak: 0,
    lastEventAt: 0,
    tutorial: TutorialService.createInitialTutorialState(),
    softGuideState: {},
    military: { soldiers: 0, soldierCap: 0, trainingProgress: 0, trainingIntervalSeconds: 0, defensePerSoldier: 1, defense: 0 },
    updatedAt: new Date().toISOString(),
  };
}

function normalizeState(rawState) {
  const state = rawState ? { ...rawState } : createInitialGameState('unknown');
  state.resources = {
    food: state.resources?.food || 0,
    knowledge: state.resources?.knowledge || 0,
    wood: state.resources?.wood || 0,
    stone: state.resources?.stone || 0,
    metal: state.resources?.metal || 0,
  };
  state.buildings = BuildingState.normalizeLegacyBuildingState(state.buildings);
  state.population = {
    total: state.population?.total || 3,
    max: state.population?.max || state.population?.maxPop || 3,
    maxPop: state.population?.maxPop || state.population?.max || 3,
    farmers: state.population?.farmers || 0,
    scholars: state.population?.scholars || 0,
    craftsmen: state.population?.craftsmen || 0,
    unassigned: state.population?.unassigned || 0,
    growthProgress: state.population?.growthProgress || 0,
  };
  state.techs = state.techs || {};
  state.techEffects = state.techEffects || {};
  state.eventQueue = state.eventQueue || [];
  state.eventHistory = state.eventHistory || [];
  state.offlineSnapshot = state.offlineSnapshot || {};
  state.offlineEventLog = state.offlineEventLog || [];
  state.tutorial = TutorialService.normalizeTutorialState(state.tutorial);
  state.softGuideState = state.softGuideState && typeof state.softGuideState === 'object' ? state.softGuideState : {};
  state.military = MilitaryService.normalizeMilitaryState(state.military, state);
  state.currentEra = Number.isFinite(state.currentEra) ? state.currentEra : 0;
  state.eraHistory = Array.isArray(state.eraHistory) ? state.eraHistory : [{ era: state.currentEra, advancedAt: new Date().toISOString() }];
  state.gameDay = state.gameDay || 1;
  state.happiness = state.happiness || 100;
  state.updatedAt = state.updatedAt || new Date().toISOString();
  BuildingActionService.applyDerivedStats(state);
  if (state.population.total > state.population.max) state.population.total = state.population.max;
  return state;
}

function calculateEraProgress(gameState) {
  const advanceConfig = getAdvanceConfig(gameState.currentEra);
  if (!advanceConfig) return { percentage: 100, canAdvance: false, conditions: [] };
  const conditions = advanceConfig.conditions.map((condition) => {
    const current = Math.floor(gameState.resources?.[condition.key] || 0);
    const progress = Math.min(100, Math.floor((current / condition.required) * 100));
    return {
      name: condition.label,
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

function getBuildingCosts(buildings) {
  const costs = {};
  for (const id of Object.keys(BuildingConfig.getAllBuildings())) {
    costs[id] = BuildingCostCalculator.getNextActionCost(id, buildings);
  }
  return costs;
}

function getBuildingDefinitions() {
  return BuildingConfig.raw().buildings || {};
}

function getClientGameState(gameState) {
  const normalized = normalizeState(gameState);
  const outputs = ResourceTickCalculator.calculateOutputs(normalized, normalized.buildingEffects);
  const totalBuildings = Object.values(normalized.buildings).reduce((sum, item) => sum + (item?.level || 0), 0);
  return {
    playerId: normalized.playerId,
    resources: {
      ...normalized.resources,
      foodOutputPerSecond: Math.round(outputs.foodOutputPerSecond * 10) / 10,
      foodConsumptionPerSecond: Math.round(outputs.foodConsumptionPerSecond * 10) / 10,
      foodNetPerSecond: Math.round(outputs.foodPerSecond * 10) / 10,
      foodPerSecond: Math.round(outputs.foodPerSecond * 10) / 10,
      knowledgePerSecond: Math.round(outputs.knowledgePerSecond * 10) / 10,
      woodPerSecond: Math.round(outputs.woodPerSecond * 10) / 10,
    },
    buildings: normalized.buildings,
    buildingCosts: getBuildingCosts(normalized.buildings),
    buildingDefinitions: getBuildingDefinitions(),
    buildingEffects: normalized.buildingEffects,
    military: normalized.military,
    unlockedBuildings: BuildingUnlockService.getUnlockedBuildings(normalized.currentEra),
    currentEra: normalized.currentEra,
    currentEraName: getEraName(normalized.currentEra),
    currentEraDescription: getEraDescription(normalized.currentEra),
    population: {
      ...normalized.population,
      max: normalized.population.max,
      maxPop: normalized.population.max,
    },
    techs: normalized.techs,
    techEffects: normalized.techEffects,
    happiness: normalized.happiness,
    gameDay: normalized.gameDay,
    eraHistory: normalized.eraHistory,
    eventQueue: normalized.eventQueue,
    eventHistory: normalized.eventHistory,
    totalBuildings,
  };
}

function calculateOfflineIncome(gameState, offlineSeconds) {
  const normalized = normalizeState(gameState);
  const outputs = ResourceTickCalculator.calculateOutputs(normalized, normalized.buildingEffects);
  const actualOffline = Math.min(Math.max(0, offlineSeconds), GameConfig.resources.maxOfflineHours * 3600);
  const efficiency = GameConfig.resources.offlineBaseEfficiency + (normalized.buildingEffects.offlineEfficiencyBonus || 0);
  return {
    food: Math.max(0, Math.floor(outputs.foodPerSecond * actualOffline * efficiency)),
    knowledge: Math.max(0, Math.floor(outputs.knowledgePerSecond * actualOffline * efficiency)),
    wood: Math.max(0, Math.floor(outputs.woodPerSecond * actualOffline * efficiency)),
    offlineHours: Math.floor((actualOffline / 3600) * 100) / 100,
    efficiency,
  };
}

module.exports = {
  createInitialGameState,
  normalizeState,
  getClientGameState,
  calculateEraProgress,
  calculateOfflineIncome,
};
