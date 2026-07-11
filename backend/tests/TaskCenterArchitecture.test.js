const test = require('node:test');
const assert = require('node:assert/strict');

const CityService = require('../services/CityService');
const TaskCenterAssembler = require('../services/taskCenter/TaskCenterAssembler');
const TaskProgressEvaluator = require('../services/taskCenter/TaskProgressEvaluator');
const TaskRewardClaimer = require('../services/taskCenter/TaskRewardClaimer');
const TaskRewardGrantLedger = require('../services/taskCenter/TaskRewardGrantLedger');

function createGameState() {
  const city = CityService.createCityState({
    id: CityService.CAPITAL_CITY_ID,
    isCapital: true,
    resources: { food: 5, knowledge: 1, wood: 0 },
    buildings: { house: { level: 1 } },
  });
  return {
    playerId: 'task-center-architecture-test',
    activeCityId: CityService.CAPITAL_CITY_ID,
    cities: { [CityService.CAPITAL_CITY_ID]: city },
    resources: city.resources,
    buildings: city.buildings,
    currentEra: 1,
    eventHistory: [{ id: 'forest_whisper' }],
    tutorial: { currentStep: 1, completed: false },
    taskProgress: { claimed: {} },
  };
}

test('TaskProgressEvaluator owns task progress and condition evaluation', () => {
  const gameState = createGameState();

  assert.equal(TaskProgressEvaluator.getTaskProgress(gameState).claimed !== undefined, true);
  assert.equal(
    TaskProgressEvaluator.isTaskConditionMet(gameState, {
      type: 'all',
      conditions: [
        { type: 'buildingLevel', buildingId: 'house', count: 1 },
        { type: 'eraAtLeast', era: 1 },
        { type: 'eventClaimed', eventId: 'forest_whisper' },
      ],
    }),
    true,
  );
});

test('TaskProgressEvaluator evaluates task reward grant conditions', () => {
  const gameState = createGameState();
  const condition = {
    type: 'taskRewardGranted',
    grantType: 'soldiers',
    grantKey: 'firstArmy',
  };

  assert.equal(TaskProgressEvaluator.isTaskConditionMet(gameState, condition), false);
  TaskRewardGrantLedger.recordSoldierGrant(gameState, TaskRewardGrantLedger.FIRST_ARMY_GRANT_KEY, {
    soldiers: 1000,
    grantedAt: '2026-07-11T00:00:00.000Z',
  });
  assert.equal(TaskProgressEvaluator.isTaskConditionMet(gameState, condition), true);
  assert.equal(
    TaskProgressEvaluator.isTaskConditionMet(gameState, {
      type: 'taskRewardGranted',
      grantType: 'soldiers',
      grantKey: '',
    }),
    false,
  );
  assert.equal(
    TaskProgressEvaluator.isTaskConditionMet(gameState, {
      type: 'taskRewardGranted',
      grantType: 'unknown',
      grantKey: 'firstArmy',
    }),
    false,
  );
});

test('TaskCenterAssembler owns task tabs, category assembly, and task view status', () => {
  const gameState = createGameState();
  const definitions = {
    version: 'arch',
    hash: 'hash',
    importedAt: '2026-06-06T00:00:00.000Z',
    importedBy: 'unit',
    source: 'unit',
    tasks: [
      {
        id: 'arch_task',
        category: 'main',
        title: 'Architecture Task',
        description: 'assembled by module',
        target: 'tasks',
        condition: { type: 'buildingLevel', buildingId: 'house', count: 1 },
        reward: { resources: { food: 1 } },
        rewardText: 'food+1',
      },
    ],
  };

  const taskCenter = TaskCenterAssembler.getTaskCenter(gameState, definitions, { activeTab: 'main' });
  const task = taskCenter.categories.main.tasks[0];

  assert.equal(taskCenter.tabs.find((tab) => tab.id === 'main').badge, 1);
  assert.equal(task.status, 'claimable');
  assert.deepEqual(task.action, { type: 'claimTaskReward', taskId: 'arch_task', category: 'main' });
});

test('TaskRewardClaimer owns resource payout and reward reveal payload', () => {
  const gameState = createGameState();
  const task = {
    id: 'arch_reward_task',
    category: 'main',
    title: 'Reward Task',
    rewardText: 'food+4',
    reward: { resources: { food: 4 } },
  };

  const reward = TaskRewardClaimer.applyTaskReward(gameState, task.reward);
  const reveal = TaskRewardClaimer.buildRewardReveal(task, reward.resources);

  assert.equal(reward.success, true);
  assert.equal(gameState.cities.capital.resources.food, 9);
  assert.deepEqual(reveal.resources, { food: 4 });
  assert.equal(reveal.subtitle, 'Reward Task');
});
