const ResourceTickCalculator = require('../calculators/ResourceTickCalculator');
const BuildingUnlockService = require('./BuildingUnlockService');
const BuildingCostCalculator = require('../calculators/BuildingCostCalculator');
const {
  BuildingConfig,
  EraConfig,
  GameConfig,
} = require('./config/GameplayConfigRuntime');
const TerritoryService = require('./TerritoryService');
const WorldExplorerService = require('./WorldExplorerService');
const CityService = require('./CityService');
const TalentPolicyService = require('./TalentPolicyService');
const CityPlanningService = require('./CityPlanningService');
const TechTreeService = require('./TechTreeService');
const FamousPersonService = require('./FamousPersonService');
const GameStateNormalizer = require('./GameStateNormalizer');

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

function getBuildingCategories() {
  return BuildingConfig.raw().categories || {};
}

function getClientGameStateFromNormalized(normalized, projection = {}) {
  const outputs = ResourceTickCalculator.calculateOutputs(normalized, normalized.buildingEffects);
  const totalBuildings = Object.values(normalized.buildings).reduce((sum, item) => sum + (item?.level || 0), 0);
  const activeCity = CityService.getActiveCity(normalized);
  const growthMultiplier = ResourceTickCalculator.calculatePopulationGrowthMultiplier(activeCity || normalized);
  const populationCapacity = ResourceTickCalculator.calculatePopulationCapacity(normalized, normalized.buildingEffects);
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
      ironPerSecond: Math.round(outputs.ironPerSecond * 10) / 10,
      stonePerSecond: Math.round(outputs.stonePerSecond * 10) / 10,
      metalPerSecond: Math.round(outputs.ironPerSecond * 10) / 10,
    },
    buildings: normalized.buildings,
    buildingCosts: getBuildingCosts(normalized.buildings),
    buildingDefinitions: getBuildingDefinitions(),
    buildingCategories: getBuildingCategories(),
    buildingEffects: normalized.buildingEffects,
    military: normalized.military,
    cityState: CityService.getClientCityStateFromNormalized
      ? CityService.getClientCityStateFromNormalized(normalized)
      : CityService.getClientCityState(normalized),
    activeCityId: normalized.activeCityId,
    isCapitalCity: normalized.activeCityId === CityService.CAPITAL_CITY_ID,
    guidebook: {
      categories: CityPlanningService.getGuidebookCategories(),
    },
    unlockedBuildings: BuildingUnlockService.getUnlockedBuildings(normalized.currentEra, normalized),
    currentEra: normalized.currentEra,
    currentEraName: EraConfig.getEraName(normalized.currentEra),
    currentEraDescription: EraConfig.getEraDescription(normalized.currentEra),
    population: {
      ...normalized.population,
      max: normalized.population.max,
      maxPop: normalized.population.max,
      capacity: populationCapacity,
      eraCap: populationCapacity.eraCap,
      housingCap: populationCapacity.housingCap,
      growthIntervalSeconds: GameConfig.population.growthIntervalSeconds,
      growthMultiplier,
    },
    talentPolicies: TalentPolicyService.getClientStateFromNormalized
      ? TalentPolicyService.getClientStateFromNormalized(normalized)
      : TalentPolicyService.getClientState(normalized),
    famousPersons: FamousPersonService.getClientStateFromNormalized
      ? FamousPersonService.getClientStateFromNormalized(normalized)
      : FamousPersonService.getClientState(normalized),
    techs: TechTreeService.getClientStateFromNormalized
      ? TechTreeService.getClientStateFromNormalized(normalized)
      : TechTreeService.getClientState(normalized),
    techEffects: normalized.techEffects,
    happiness: normalized.happiness,
    gameDay: normalized.gameDay,
    eraHistory: normalized.eraHistory,
    eventQueue: normalized.eventQueue,
    eventHistory: normalized.eventHistory,
    regularEventState: normalized.regularEventState,
    threatEventState: normalized.threatEventState,
    activeBuffs: normalized.activeBuffs,
    territoryState: TerritoryService.getClientTerritoryState(normalized, new Date(), projection),
    worldExplorerState: WorldExplorerService.getClientState(normalized),
    totalBuildings,
  };
}

function getClientGameState(gameState, projection = {}) {
  return getClientGameStateFromNormalized(GameStateNormalizer.normalizeState(gameState), projection);
}

module.exports = {
  getBuildingCosts,
  getBuildingDefinitions,
  getBuildingCategories,
  getClientGameState,
  getClientGameStateFromNormalized,
};
