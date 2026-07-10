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
const { parseFeatureFlagValue } = require('../../shared/featureFlags');

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
  const activeCity = CityService.getActiveCity(normalized) || normalized;
  // Single source of truth: resources/buildings/population/military come from the active
  // city slot (cities[activeCityId]), never the legacy top-level mirror. The DTO context
  // combines the active city's state with gameState-wide fields (currentEra/activeBuffs).
  const cityResources = activeCity.resources || {};
  const cityBuildings = activeCity.buildings || {};
  const cityPopulation = activeCity.population || {};
  const cityMilitary = activeCity.military || {};
  const cityBuildingEffects = activeCity.buildingEffects || {};
  const cityHappiness = Number.isFinite(activeCity.happiness) ? activeCity.happiness : normalized.happiness;
  const outputContext = {
    ...normalized,
    resources: cityResources,
    population: cityPopulation,
    buildings: cityBuildings,
    buildingEffects: cityBuildingEffects,
    happiness: cityHappiness,
  };
  const outputs = ResourceTickCalculator.calculateOutputs(outputContext, cityBuildingEffects);
  const totalBuildings = Object.values(cityBuildings).reduce((sum, item) => sum + (item?.level || 0), 0);
  const growthMultiplier = ResourceTickCalculator.calculatePopulationGrowthMultiplier(activeCity);
  const populationCapacity = ResourceTickCalculator.calculatePopulationCapacity(outputContext, cityBuildingEffects);
  return {
    playerId: normalized.playerId,
    resources: {
      ...cityResources,
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
    buildings: cityBuildings,
    buildingCosts: getBuildingCosts(cityBuildings),
    buildingDefinitions: getBuildingDefinitions(),
    buildingCategories: getBuildingCategories(),
    buildingEffects: cityBuildingEffects,
    military: cityMilitary,
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
      ...cityPopulation,
      max: cityPopulation.max,
      maxPop: cityPopulation.max,
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
    happiness: cityHappiness,
    gameDay: normalized.gameDay,
    eraHistory: normalized.eraHistory,
    eventQueue: normalized.eventQueue,
    eventHistory: normalized.eventHistory,
    regularEventState: normalized.regularEventState,
    threatEventState: normalized.threatEventState,
    activeBuffs: normalized.activeBuffs,
    territoryState: TerritoryService.getClientTerritoryState(normalized, new Date(), projection),
    worldExplorerState: WorldExplorerService.getClientState(normalized, new Date(), projection),
    totalBuildings,
    tutorialEnabled: parseFeatureFlagValue(GameConfig.features?.tutorialEnabled, true),
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
