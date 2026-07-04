const BuildingState = require('../modules/BuildingState');
const BuildingEffectCalculator = require('../calculators/BuildingEffectCalculator');
const ResourceTickCalculator = require('../calculators/ResourceTickCalculator');
const MilitaryService = require('./MilitaryService');
const CityPlanningService = require('./CityPlanningService');

const CAPITAL_CITY_ID = 'capital';

function createInitialResources(resources = {}) {
  return {
    food: Math.max(0, Number(resources.food) || 0),
    knowledge: Math.max(0, Number(resources.knowledge) || 0),
    wood: Math.max(0, Number(resources.wood) || 0),
    iron: Math.max(0, Number(resources.iron ?? resources.metal) || 0),
    stone: Math.max(0, Number(resources.stone) || 0),
    metal: Math.max(0, Number(resources.metal ?? resources.iron) || 0),
  };
}

function createInitialPopulation(population = {}) {
  const getNumber = (value, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };
  const total = Math.max(1, Math.floor(getNumber(population.total, 3)));
  const max = Math.max(total, Math.floor(getNumber(population.max ?? population.maxPop, 3)));
  const farmers = Math.max(0, Math.floor(getNumber(population.farmers, total)));
  const scholars = Math.max(0, Math.floor(getNumber(population.scholars, 0)));
  const craftsmen = Math.max(0, Math.floor(getNumber(population.craftsmen, 0)));
  const assigned = farmers + scholars + craftsmen;
  return {
    total,
    max,
    maxPop: max,
    farmers,
    scholars,
    craftsmen,
    unassigned: Math.max(0, Math.floor(getNumber(population.unassigned, total - assigned))),
    growthProgress: Math.max(0, getNumber(population.growthProgress, 0)),
  };
}

function createCityState(options = {}) {
  const id = options.id || CAPITAL_CITY_ID;
  return {
    id,
    territoryId: options.territoryId || id,
    name: options.name || (id === CAPITAL_CITY_ID ? '首都' : '新城市'),
    isCapital: Boolean(options.isCapital || id === CAPITAL_CITY_ID),
    foundedAt: options.foundedAt || new Date().toISOString(),
    resources: createInitialResources(options.resources || { food: 100, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 }),
    buildings: BuildingState.normalizeBuildingState(options.buildings),
    population: createInitialPopulation(options.population),
    military: options.military || { soldiers: 0, soldierCap: 0, trainingProgress: 0, trainingIntervalSeconds: 0, trainingBatchSize: 0, defensePerSoldier: 0.01, defense: 0 },
    happiness: Number.isFinite(options.happiness) ? options.happiness : 100,
    terrain: CityPlanningService.normalizeTerrainId(options.terrain || options.planning?.terrainId),
    habitability: Number.isFinite(options.habitability) ? options.habitability : 0,
    planning: options.planning || {},
    buildingEffects: {},
  };
}

function createCityForTerritory(territory, now = new Date()) {
  const scale = Math.max(1, Math.floor(Number(territory?.scale) || 1));
  const populationTotal = Math.max(2, Math.min(8, scale + 2));
  const food = 80 + scale * 40;
  const knowledge = Math.max(0, scale * 8);
  const wood = territory?.type === 'camp' ? 60 : 25 + scale * 10;
  return createCityState({
    id: territory.id,
    territoryId: territory.id,
    name: territory.cityName || territory.naturalName || '新城市',
    isCapital: false,
    foundedAt: territory.occupiedAt || now.toISOString(),
    resources: { food, knowledge, wood, iron: 0, stone: 0, metal: 0 },
    population: {
      total: populationTotal,
      max: Math.max(3, populationTotal),
      farmers: populationTotal,
      scholars: 0,
      craftsmen: 0,
      unassigned: 0,
      growthProgress: 0,
    },
    buildings: BuildingState.createInitialBuildingState(),
    military: { soldiers: 0 },
    happiness: 100,
  });
}

function getCapitalName(gameState) {
  const territory = (gameState.territories || []).find((item) => item.id === CAPITAL_CITY_ID);
  return territory?.cityName || gameState.polity?.capitalCityName || '首都';
}

function createCapitalCityFromState(gameState) {
  return createCityState({
    id: CAPITAL_CITY_ID,
    territoryId: CAPITAL_CITY_ID,
    name: getCapitalName(gameState),
    isCapital: true,
    foundedAt: gameState.eraHistory?.[0]?.advancedAt || gameState.updatedAt || new Date().toISOString(),
    resources: gameState.resources,
    buildings: gameState.buildings,
    population: gameState.population,
    military: gameState.military,
    happiness: Number.isFinite(gameState.happiness) ? gameState.happiness : 100,
  });
}

function normalizeCity(rawCity, gameState, now = new Date()) {
  const city = createCityState({
    ...rawCity,
    id: rawCity?.id || rawCity?.territoryId || CAPITAL_CITY_ID,
    territoryId: rawCity?.territoryId || rawCity?.id || CAPITAL_CITY_ID,
    name: rawCity?.name,
    isCapital: rawCity?.isCapital,
    foundedAt: rawCity?.foundedAt || now.toISOString(),
  });
  applyDerivedStatsToCity(city, gameState);
  return city;
}

function normalizeCities(gameState, now = new Date()) {
  const existing = gameState.cities && typeof gameState.cities === 'object' ? gameState.cities : {};
  const cities = {};

  if (existing[CAPITAL_CITY_ID]) {
    cities[CAPITAL_CITY_ID] = normalizeCity({
      ...existing[CAPITAL_CITY_ID],
      id: CAPITAL_CITY_ID,
      territoryId: CAPITAL_CITY_ID,
      isCapital: true,
      name: getCapitalName(gameState),
    }, gameState, now);
  } else {
    cities[CAPITAL_CITY_ID] = createCapitalCityFromState(gameState);
    applyDerivedStatsToCity(cities[CAPITAL_CITY_ID], gameState);
  }

  for (const rawCity of Object.values(existing)) {
    if (!rawCity || rawCity.id === CAPITAL_CITY_ID || rawCity.territoryId === CAPITAL_CITY_ID) continue;
    const normalized = normalizeCity(rawCity, gameState, now);
    cities[normalized.id] = normalized;
  }

  for (const territory of gameState.territories || []) {
    if (!territory || territory.id === CAPITAL_CITY_ID || territory.status !== 'occupied') continue;
    if (!cities[territory.id]) {
      cities[territory.id] = createCityForTerritory(territory, now);
    }
    cities[territory.id].name = territory.cityName || cities[territory.id].name || territory.naturalName;
    applyDerivedStatsToCity(cities[territory.id], gameState);
  }

  gameState.cities = cities;
  if (!cities[gameState.activeCityId]) gameState.activeCityId = CAPITAL_CITY_ID;
  // Whoever rebuilds the city objects must rebuild the top-level aliases: the top-level
  // resources/buildings/population/military ARE the active city's objects (same
  // reference), so no later caller can ever observe diverged sibling copies.
  const activeCity = cities[gameState.activeCityId] || cities[CAPITAL_CITY_ID];
  if (activeCity) {
    gameState.resources = activeCity.resources;
    gameState.buildings = activeCity.buildings;
    gameState.population = activeCity.population;
    gameState.military = activeCity.military;
  }
  return cities;
}

function getActiveCity(gameState) {
  if (!gameState.cities?.[gameState.activeCityId]) normalizeCities(gameState);
  return gameState.cities[gameState.activeCityId] || gameState.cities[CAPITAL_CITY_ID];
}

// Single source of truth: after normalization the top-level resources/buildings/
// population/military fields ARE the active city's objects (same reference), never
// sibling copies. Post-CUT7 saves persist these facts only city-scoped, so the legacy
// top-level rebuild reads as zeros — every legacy reader that still goes through
// gameState.<field> must transparently hit the city truth, and every legacy field-level
// writer must mutate it. Divergence becomes structurally impossible.
function aliasTopLevelToActiveCity(gameState) {
  const city = getActiveCity(gameState);
  if (!city) return gameState;
  gameState.resources = city.resources;
  gameState.buildings = city.buildings;
  gameState.population = city.population;
  gameState.military = city.military;
  return gameState;
}

function getCapitalCity(gameState) {
  if (!gameState.cities?.[CAPITAL_CITY_ID]) normalizeCities(gameState);
  return gameState.cities[CAPITAL_CITY_ID];
}

function applyDerivedStatsToCity(city, gameState) {
  const effects = BuildingEffectCalculator.calculate(city.buildings);
  const territory = (gameState?.territories || []).find((item) => item.id === city.territoryId);
  const territoryEffects = territory?.status === 'occupied' ? territory.effects || {} : {};
  effects.territoryFoodOutputBonus = territoryEffects.foodOutputMultiplier || 0;
  effects.territoryWoodOutputBonus = territoryEffects.woodOutputMultiplier || 0;
  effects.territoryKnowledgeOutputBonus = territoryEffects.knowledgeOutputMultiplier || 0;
  effects.threatDefense += territoryEffects.threatDefense || 0;
  city.buildingEffects = effects;
  const capacity = ResourceTickCalculator.calculatePopulationCapacity(gameState, effects);
  city.population.capacity = capacity;
  city.population.eraCap = capacity.eraCap;
  city.population.housingCap = capacity.housingCap;
  city.population.max = capacity.effectiveCap;
  city.population.maxPop = city.population.max;
  city.happiness = ResourceTickCalculator.calculateBuffedHappiness(effects, {
    ...gameState,
    population: city.population,
    activeBuffs: gameState?.activeBuffs || [],
  });
  city.military = MilitaryService.normalizeMilitaryState(city.military, {
    ...(gameState || {}),
    activeCityId: city.id,
    buildings: city.buildings,
    military: city.military,
  });
  // This replaces the city's military object; keep the top-level alias pointing at the
  // active city's CURRENT object (top-level fields are references, never copies).
  if (
    gameState &&
    gameState.cities?.[city.id] === city &&
    (gameState.activeCityId || CAPITAL_CITY_ID) === city.id
  ) {
    gameState.military = city.military;
  }
  CityPlanningService.applyPlanningToCity(city, gameState);
  return effects;
}

function setActiveCity(gameState, cityId) {
  normalizeCities(gameState);
  if (!gameState.cities[cityId]) return { success: false, error: 'CITY_NOT_FOUND', message: '城市不存在' };
  gameState.activeCityId = cityId;
  // Re-point the top-level aliases at the newly active city.
  aliasTopLevelToActiveCity(gameState);
  return { success: true, message: `已切换到${gameState.cities[cityId].name}`, city: gameState.cities[cityId] };
}

function updateCityName(gameState, territoryId, name) {
  normalizeCities(gameState);
  const city = gameState.cities[territoryId];
  if (city) {
    city.name = name;
    if (territoryId === CAPITAL_CITY_ID && gameState.polity) gameState.polity.capitalCityName = name;
  }
}

function advanceAllCities(gameState, deltaSeconds = 1) {
  normalizeCities(gameState);
  const seconds = Math.max(0, Number(deltaSeconds) || 0);
  for (const city of Object.values(gameState.cities)) {
    applyDerivedStatsToCity(city, gameState);
    const outputs = ResourceTickCalculator.calculateOutputs({
      ...gameState,
      resources: city.resources,
      population: city.population,
      buildings: city.buildings,
      military: city.military,
      happiness: city.happiness,
    }, city.buildingEffects);
    city.resources.food = Math.max(0, (city.resources.food || 0) + outputs.foodPerSecond * seconds);
    city.resources.knowledge = Math.max(0, (city.resources.knowledge || 0) + outputs.knowledgePerSecond * seconds);
    city.resources.wood = Math.max(0, (city.resources.wood || 0) + outputs.woodPerSecond * seconds);
    city.resources.iron = Math.max(0, (city.resources.iron ?? city.resources.metal ?? 0) + outputs.ironPerSecond * seconds);
    city.resources.stone = Math.max(0, (city.resources.stone || 0) + outputs.stonePerSecond * seconds);
    city.resources.metal = city.resources.iron;
    ResourceTickCalculator.applyPopulationGrowth({
      ...gameState,
      resources: city.resources,
      population: city.population,
      buildingEffects: city.buildingEffects,
      habitability: city.habitability,
      planning: city.planning,
    }, seconds);
    const trainingState = {
      ...gameState,
      activeCityId: city.id,
      buildings: city.buildings,
      military: city.military,
    };
    MilitaryService.advanceTraining(trainingState, seconds);
    city.military = trainingState.military;
  }
}

function calculateOfflineIncomeForAllCities(gameState, offlineSeconds, baseEfficiency) {
  normalizeCities(gameState);
  const actualOffline = Math.max(0, offlineSeconds);
  const incomeByCity = {};
  let activeIncome = null;
  for (const city of Object.values(gameState.cities)) {
    applyDerivedStatsToCity(city, gameState);
    const outputs = ResourceTickCalculator.calculateOutputs({
      ...gameState,
      resources: city.resources,
      population: city.population,
      buildings: city.buildings,
      military: city.military,
      happiness: city.happiness,
    }, city.buildingEffects);
    const efficiency = baseEfficiency + (city.buildingEffects.offlineEfficiencyBonus || 0) + ResourceTickCalculator.calculateOfflineEfficiencyBonus(gameState);
    const income = {
      food: Math.max(0, Math.floor(outputs.foodPerSecond * actualOffline * efficiency)),
      knowledge: Math.max(0, Math.floor(outputs.knowledgePerSecond * actualOffline * efficiency)),
      wood: Math.max(0, Math.floor(outputs.woodPerSecond * actualOffline * efficiency)),
      iron: Math.max(0, Math.floor(outputs.ironPerSecond * actualOffline * efficiency)),
      stone: Math.max(0, Math.floor(outputs.stonePerSecond * actualOffline * efficiency)),
      offlineHours: Math.floor((actualOffline / 3600) * 100) / 100,
      efficiency,
    };
    city.resources.food += income.food;
    city.resources.knowledge += income.knowledge;
    city.resources.wood += income.wood;
    city.resources.iron = (city.resources.iron ?? city.resources.metal ?? 0) + income.iron;
    city.resources.stone = (city.resources.stone || 0) + income.stone;
    city.resources.metal = city.resources.iron;
    const trainingState = {
      ...gameState,
      activeCityId: city.id,
      buildings: city.buildings,
      military: city.military,
    };
    MilitaryService.advanceTraining(trainingState, actualOffline);
    city.military = trainingState.military;
    incomeByCity[city.id] = income;
    if (city.id === gameState.activeCityId) activeIncome = income;
  }
  const active = activeIncome || incomeByCity[CAPITAL_CITY_ID] || { food: 0, knowledge: 0, wood: 0, iron: 0, stone: 0, offlineHours: 0, efficiency: baseEfficiency };
  return {
    activeIncome: active,
    incomeByCity,
    totalIncome: Object.values(incomeByCity).reduce((sum, income) => ({
      food: sum.food + (income.food || 0),
      knowledge: sum.knowledge + (income.knowledge || 0),
      wood: sum.wood + (income.wood || 0),
      iron: sum.iron + (income.iron || 0),
      stone: sum.stone + (income.stone || 0),
      offlineHours: Math.max(sum.offlineHours, income.offlineHours || 0),
      efficiency: active.efficiency,
    }), { food: 0, knowledge: 0, wood: 0, iron: 0, stone: 0, offlineHours: 0, efficiency: active.efficiency }),
  };
}

function getClientCityState(gameState) {
  normalizeCities(gameState);
  return getClientCityStateFromNormalized(gameState);
}

function getClientCityStateFromNormalized(gameState) {
  return {
    activeCityId: gameState.activeCityId || CAPITAL_CITY_ID,
    capitalCityId: CAPITAL_CITY_ID,
    cities: Object.values(gameState.cities || {}).map((city) => ({
      id: city.id,
      territoryId: city.territoryId,
      name: city.name,
      isCapital: city.isCapital,
      foundedAt: city.foundedAt,
      population: city.population,
      resources: city.resources,
      military: city.military,
      happiness: city.happiness,
      planning: CityPlanningService.getClientPlanning(city),
      terrain: city.terrain,
      terrainLabel: city.terrainLabel,
      habitability: city.habitability,
      habitabilityLabel: city.habitabilityLabel,
      populationGrowthMultiplier: ResourceTickCalculator.calculatePopulationGrowthMultiplier(city),
      totalBuildings: Object.values(city.buildings || {}).reduce((sum, item) => sum + (item?.level || 0), 0),
    })),
  };
}

module.exports = {
  CAPITAL_CITY_ID,
  createCityState,
  createCityForTerritory,
  normalizeCities,
  getActiveCity,
  aliasTopLevelToActiveCity,
  getCapitalCity,
  applyDerivedStatsToCity,
  setActiveCity,
  updateCityName,
  advanceAllCities,
  calculateOfflineIncomeForAllCities,
  getClientCityState,
  getClientCityStateFromNormalized,
};
