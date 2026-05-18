const test = require('node:test');
const assert = require('node:assert/strict');

const AdvanceEraAction = require('../actions/AdvanceEraAction');
const BuildingActionService = require('../services/BuildingActionService');
const CityService = require('../services/CityService');
const EventDomain = require('../domain/Event');
const EventService = require('../services/EventService');
const gameStateService = require('../services/GameStateService');
const AssignPopulationAction = require('../actions/AssignPopulationAction');

function createOccupiedCityState() {
  const state = gameStateService.createInitialGameState('city-service-player');
  state.currentEra = 5;
  state.tutorial.completed = true;
  state.resources = { food: 1000, knowledge: 600, wood: 500, stone: 0, metal: 0 };
  state.buildings.house = { level: 1 };
  state.buildings.barracks = { level: 2 };
  state.buildings.watchtower = { level: 1 };
  state.military = { soldiers: 6 };
  state.territories.push({
    id: 'site_harbor',
    x: 1,
    y: 0,
    naturalName: '河湾村镇',
    cityName: '河湾城',
    type: 'town',
    owner: 'player',
    status: 'occupied',
    scale: 2,
    threat: 2,
    defense: 4,
    recommendedSoldiers: 4,
    art: 'assets/art/world-site-town-cutout.png',
    effects: { foodOutputMultiplier: 0.05, threatDefense: 2 },
    discoveredAt: '2026-05-17T08:00:00.000Z',
    occupiedAt: '2026-05-17T08:02:00.000Z',
  });
  return gameStateService.normalizeState(state);
}

test('旧存档会迁移出首都城市，客户端返回城市列表', () => {
  const state = gameStateService.createInitialGameState('city-migration-player');
  state.resources.food = 345;
  state.buildings.house = { level: 1 };
  state.population.total = 4;
  state.population.unassigned = 1;

  const normalized = gameStateService.normalizeState(state);
  const clientState = gameStateService.getClientGameState(normalized);

  assert.equal(normalized.cities.capital.resources.food, 345);
  assert.equal(normalized.cities.capital.population.total, 4);
  assert.equal(clientState.cityState.activeCityId, 'capital');
  assert.equal(clientState.cityState.cities.length, 1);
  assert.equal(clientState.isCapitalCity, true);
});

test('占领地会创建可管理分城并可切换镜像状态', () => {
  const state = createOccupiedCityState();

  assert.ok(state.cities.site_harbor);
  assert.equal(state.cities.site_harbor.name, '河湾城');
  assert.equal(state.activeCityId, 'capital');

  const result = CityService.setActiveCity(state, 'site_harbor');

  assert.equal(result.success, true);
  assert.equal(state.activeCityId, 'site_harbor');
  assert.equal(state.resources, state.cities.site_harbor.resources);
  assert.equal(state.buildings, state.cities.site_harbor.buildings);
  assert.equal(state.buildingEffects.territoryFoodOutputBonus, 0.05);
  assert.equal(state.buildingEffects.threatDefense, 2);
});

test('分城建造只消耗和改变分城，不影响主城建筑', () => {
  const state = createOccupiedCityState();
  const capitalFood = state.cities.capital.resources.food;
  const subCityFood = state.cities.site_harbor.resources.food;
  CityService.setActiveCity(state, 'site_harbor');

  const result = BuildingActionService.build(state, state.tutorial, 'house');

  assert.equal(result.success, true);
  assert.equal(state.cities.site_harbor.resources.food, subCityFood - 30);
  assert.equal(state.cities.site_harbor.buildings.house.level, 1);
  assert.equal(state.cities.capital.resources.food, capitalFood);
  assert.equal(state.cities.capital.buildings.house.level, 1);
  assert.equal(state.activeCityId, 'site_harbor');
  assert.equal(state.population.max, state.cities.site_harbor.population.max);
});

test('分城人口分配只修改分城人口', () => {
  const state = createOccupiedCityState();
  CityService.setActiveCity(state, 'site_harbor');
  state.cities.site_harbor.population.unassigned = 1;
  state.cities.site_harbor.population.farmers = Math.max(0, state.cities.site_harbor.population.farmers - 1);
  CityService.syncActiveCityToLegacyFields(state);
  const capitalFarmers = state.cities.capital.population.farmers;

  const result = AssignPopulationAction.execute(state, state.tutorial, { target: 'scholar', count: 1 });

  assert.equal(result.success, true);
  assert.equal(state.cities.site_harbor.population.scholars, 1);
  assert.equal(state.cities.site_harbor.population.unassigned, 0);
  assert.equal(state.cities.capital.population.farmers, capitalFarmers);
});

test('分城不能进阶，时代进阶始终使用主城资源', () => {
  const state = createOccupiedCityState();
  state.currentEra = 3;
  state.cities.capital.resources = { food: 900, wood: 500, knowledge: 260, stone: 0, metal: 0 };
  state.cities.capital.military.soldiers = 3;
  state.cities.site_harbor.resources = { food: 9999, wood: 9999, knowledge: 9999, stone: 0, metal: 0 };
  CityService.setActiveCity(state, 'site_harbor');

  const blocked = AdvanceEraAction.execute(state, state.tutorial);
  assert.equal(blocked.success, false);
  assert.equal(blocked.error, 'CITY_CANNOT_ADVANCE');
  assert.equal(state.currentEra, 3);

  CityService.setActiveCity(state, 'capital');
  const success = AdvanceEraAction.execute(state, state.tutorial);

  assert.equal(success.success, true);
  assert.equal(state.currentEra, 4);
  assert.equal(state.cities.capital.resources.food, 0);
  assert.equal(state.cities.site_harbor.resources.food, 9999);
});

test('事件奖励和消耗作用于当前城市', () => {
  const state = createOccupiedCityState();
  CityService.setActiveCity(state, 'site_harbor');
  state.cities.site_harbor.resources.food = 100;
  state.cities.capital.resources.food = 500;
  state.eventQueue = [
    EventDomain.createRegularEvent(
      EventDomain.REGULAR_EVENT_TEMPLATES.find((item) => item.id === 'harvest_sign'),
      new Date('2026-05-17T08:00:00.000Z'),
      0,
    ),
  ];
  CityService.syncActiveCityToLegacyFields(state);

  const result = EventService.claimEvent(state, state.eventQueue[0].id, 'hold_festival', new Date('2026-05-17T08:00:00.000Z'));

  assert.equal(result.success, true);
  assert.equal(state.cities.site_harbor.resources.food, 80);
  assert.equal(state.cities.capital.resources.food, 500);
  assert.equal(state.resources.food, 80);
});

test('城市心跳会推进所有城市产出和训练', () => {
  const state = createOccupiedCityState();
  state.cities.capital.buildings.farm = { level: 1 };
  state.cities.capital.population.farmers = 3;
  state.cities.site_harbor.buildings.farm = { level: 1 };
  state.cities.site_harbor.population.farmers = 2;
  const capitalFood = state.cities.capital.resources.food;
  const subCityFood = state.cities.site_harbor.resources.food;

  CityService.advanceAllCities(state, 10);

  assert.ok(state.cities.capital.resources.food > capitalFood);
  assert.ok(state.cities.site_harbor.resources.food > subCityFood);
});
