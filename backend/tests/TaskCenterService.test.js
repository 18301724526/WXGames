const test = require('node:test');
const assert = require('node:assert/strict');

const CityService = require('../services/CityService');
const TaskCenterService = require('../services/TaskCenterService');
const TutorialService = require('../services/TutorialService');

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
  const tutorial = TutorialService.manualAdvance(
    TutorialService.createInitialTutorialState(),
    options.tutorialStep ?? TutorialService.TUTORIAL_STEPS.eraAdvancedTo1,
  );
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
    tutorial,
    taskProgress: { claimed: {} },
  };
}

function getMainFirstTask(gameState) {
  return TaskCenterService.getTaskCenter(gameState, { activeTab: 'main' })
    .categories.main.tasks.find((task) => task.id === 'main_first_supplies');
}

test('main first supplies waits for house and first era advancement', () => {
  const beforeEraAdvance = createMainTaskState({ currentEra: 0 });
  const afterEraAdvance = createMainTaskState({ currentEra: 1 });

  assert.equal(getMainFirstTask(beforeEraAdvance).status, 'active');
  assert.equal(getMainFirstTask(afterEraAdvance).status, 'claimable');
});

test('claiming main first supplies applies dynamic rewards and advances toward farm guide', () => {
  const gameState = createMainTaskState({ food: 7, knowledge: 2 });
  const result = TaskCenterService.claimTask(gameState, 'main_first_supplies', 'main');

  assert.equal(result.success, true);
  assert.deepEqual(result.reward.resources, { food: 120, knowledge: 5 });
  assert.equal(gameState.resources.food, 127);
  assert.equal(gameState.resources.knowledge, 7);
  assert.equal(gameState.cities.capital.resources.food, 127);
  assert.equal(gameState.taskProgress.claimed.main_first_supplies.reward.resources.food, 120);
  assert.equal(gameState.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.farmPrepReserved);
  assert.equal(getMainFirstTask(gameState).status, 'completed');
});

test('claiming a task reward is idempotent and rejects duplicates', () => {
  const gameState = createMainTaskState();

  assert.equal(TaskCenterService.claimTask(gameState, 'main_first_supplies', 'main').success, true);
  const duplicate = TaskCenterService.claimTask(gameState, 'main_first_supplies', 'main');

  assert.equal(duplicate.success, false);
  assert.equal(duplicate.error, 'TASK_ALREADY_CLAIMED');
  assert.equal(gameState.resources.food, 120);
  assert.equal(gameState.resources.knowledge, 5);
});
