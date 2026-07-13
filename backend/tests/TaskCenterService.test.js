const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const CityService = require('../services/CityService');
const TaskCenterService = require('../services/TaskCenterService');
const TaskRewardGrantLedger = require('../services/taskCenter/TaskRewardGrantLedger');
const {
  publishCurrentConfigRuntime,
  resetConfigRuntime,
} = require('./helpers/configRuntimeTestHarness');

before(() => {
  publishCurrentConfigRuntime();
});

after(() => {
  resetConfigRuntime();
});

function createMainTaskState(options = {}) {
  const resources = {
    food: Number(options.food ?? 0),
    knowledge: Number(options.knowledge ?? 0),
    wood: Number(options.wood ?? 0),
    iron: 0,
    stone: 0,
    metal: 0,
  };
  const city = CityService.createCityState({
    id: CityService.CAPITAL_CITY_ID,
    isCapital: true,
    resources,
    buildings: options.houseBuilt === false ? {} : { house: { level: 1 } },
  });
  return {
    playerId: 'task-center-service-test',
    activeCityId: CityService.CAPITAL_CITY_ID,
    cities: { [CityService.CAPITAL_CITY_ID]: city },
    resources: city.resources,
    buildings: city.buildings,
    population: city.population,
    military: city.military,
    currentEra: Number(options.currentEra ?? 1),
    eventHistory: [],
    taskProgress: { claimed: {} },
  };
}

function getMainFirstTask(gameState) {
  return TaskCenterService.getTaskCenter(gameState, { activeTab: 'main' })
    .categories.main.tasks.find((task) => task.id === 'main_first_supplies');
}

function getMainLumbermillTask(gameState) {
  return TaskCenterService.getTaskCenter(gameState, { activeTab: 'main' })
    .categories.main.tasks.find((task) => task.id === 'main_lumbermill_supplies');
}

test('main first supplies waits for house and first era advancement', () => {
  const beforeEraAdvance = createMainTaskState({ currentEra: 0 });
  const afterEraAdvance = createMainTaskState({ currentEra: 1 });

  assert.equal(getMainFirstTask(beforeEraAdvance).status, 'active');
  assert.equal(getMainFirstTask(afterEraAdvance).status, 'claimable');
});

test('claiming main first supplies applies dynamic rewards', () => {
  const gameState = createMainTaskState({ food: 7, knowledge: 2 });
  const result = TaskCenterService.claimTask(gameState, 'main_first_supplies', 'main');

  assert.equal(result.success, true);
  assert.deepEqual(result.reward.resources, { food: 120, knowledge: 5 });
  assert.equal(gameState.cities.capital.resources.food, 127);
  assert.equal(gameState.cities.capital.resources.knowledge, 7);
  assert.equal(gameState.taskProgress.claimed.main_first_supplies.reward.resources.food, 120);
  assert.equal(getMainFirstTask(gameState).status, 'completed');
});

test('claiming a task reward is idempotent and rejects duplicates', () => {
  const gameState = createMainTaskState();

  assert.equal(TaskCenterService.claimTask(gameState, 'main_first_supplies', 'main').success, true);
  const duplicate = TaskCenterService.claimTask(gameState, 'main_first_supplies', 'main');

  assert.equal(duplicate.success, false);
  assert.equal(duplicate.error, 'TASK_ALREADY_CLAIMED');
  assert.equal(gameState.cities.capital.resources.food, 120);
  assert.equal(gameState.cities.capital.resources.knowledge, 5);
});

function getMainTask(gameState, taskId) {
  return TaskCenterService.getTaskCenter(gameState, { activeTab: 'main' })
    .categories.main.tasks.find((task) => task.id === taskId);
}

test('claiming the first-army task pays soldiers into the city military with the grant record', () => {
  const gameState = createMainTaskState({
    currentEra: 3,
  });
  gameState.buildings.barracks = { level: 1 };
  gameState.cities.capital.buildings.barracks = { level: 1 };

  assert.equal(getMainTask(gameState, 'main_first_army').status, 'claimable');
  assert.equal(getMainTask(gameState, 'main_first_army').rewardText, '士兵+1000');

  const result = TaskCenterService.claimTask(gameState, 'main_first_army', 'main');

  assert.equal(result.success, true);
  // Soldiers are NOT a city resource: they land in the city military.
  assert.equal(gameState.cities.capital.resources.soldiers, undefined);
  assert.equal(gameState.cities.capital.military.soldiers, 1000);
  const grant = TaskRewardGrantLedger.getSoldierGrant(
    gameState,
    TaskRewardGrantLedger.FIRST_ARMY_GRANT_KEY,
  );
  assert.equal(grant.soldiers, 1000);
  assert.equal(typeof grant.grantedAt, 'string');

  const duplicate = TaskCenterService.claimTask(gameState, 'main_first_army', 'main');
  assert.equal(duplicate.success, false);
  assert.equal(duplicate.error, 'TASK_ALREADY_CLAIMED');
  assert.equal(gameState.cities.capital.military.soldiers, 1000);
});

test('claiming the scout-officer task grants the starter scout famous person once', () => {
  const gameState = createMainTaskState({
    currentEra: 3,
  });
  TaskRewardGrantLedger.recordSoldierGrant(
    gameState,
    TaskRewardGrantLedger.FIRST_ARMY_GRANT_KEY,
    { soldiers: 1000, grantedAt: '2026-07-11T00:00:00.000Z' },
  );
  gameState.famousPeople = [];
  gameState.famousPersonState = { candidates: [], seek: { count: 0, lastAt: null } };

  assert.equal(getMainTask(gameState, 'main_scout_officer').status, 'claimable');
  const result = TaskCenterService.claimTask(gameState, 'main_scout_officer', 'main');

  assert.equal(result.success, true);
  assert.equal(gameState.famousPeople.length, 1);
  assert.ok(gameState.famousPeople[0].roles.includes('military')); // random combat archetype (deployable)
  assert.equal(gameState.famousPeople[0].quality, 'great');
  const grant = TaskRewardGrantLedger.getFamousPersonGrant(
    gameState,
    TaskRewardGrantLedger.SCOUT_FAMOUS_GRANT_KEY,
  );
  assert.equal(grant.personId, gameState.famousPeople[0].id);

  // Double-claim attempts are rejected before the grant core runs.
  const duplicate = TaskCenterService.claimTask(gameState, 'main_scout_officer', 'main');
  assert.equal(duplicate.success, false);
  assert.equal(duplicate.error, 'TASK_ALREADY_CLAIMED');
  assert.equal(gameState.famousPeople.length, 1);
});

test('main lumbermill supplies wait for lumbermill and pay next era cost', () => {
  const gameState = createMainTaskState({
    food: 11,
    knowledge: 3,
    wood: 7,
    currentEra: 2,
  });
  gameState.buildings.farm = { level: 1 };

  assert.equal(getMainLumbermillTask(gameState).status, 'active');
  gameState.buildings.lumbermill = { level: 1 };
  assert.equal(getMainLumbermillTask(gameState).status, 'claimable');

  const result = TaskCenterService.claimTask(gameState, 'main_lumbermill_supplies', 'main');

  assert.equal(result.success, true);
  assert.deepEqual(result.reward.resources, { food: 500, knowledge: 100, wood: 200 });
  assert.equal(gameState.cities.capital.resources.food, 511);
  assert.equal(gameState.cities.capital.resources.knowledge, 103);
  assert.equal(gameState.cities.capital.resources.wood, 207);
  assert.equal(getMainLumbermillTask(gameState).status, 'completed');
});
