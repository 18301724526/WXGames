const test = require('node:test');
const assert = require('node:assert/strict');

const GuideTaskService = require('../services/GuideTaskService');
const gameStateService = require('../services/GameStateService');

function completeTutorial(state) {
  state.tutorial.completed = true;
  state.tutorial.currentStep = 15;
  state.tutorial.phaseCompleted = { newbie: true, era2: true };
}

test('主线任务奖励按差额补到下一步所需资源', () => {
  const state = gameStateService.createInitialGameState('guide-task-barracks-reward');
  completeTutorial(state);
  state.currentEra = 3;
  state.resources.food = 100;
  state.resources.knowledge = 20;

  const tasks = GuideTaskService.getGuideTasks(state);
  assert.equal(tasks.visible, true);
  assert.equal(tasks.tasks[0].id, 'barracks_supplies');
  assert.equal(tasks.tasks[0].status, 'claimable');
  assert.deepEqual(tasks.tasks[0].reward.resources, { food: 160, knowledge: 60 });

  const result = GuideTaskService.claimReward(state, 'barracks_supplies');

  assert.equal(result.success, true);
  assert.deepEqual(result.reward.resources, { food: 160, knowledge: 60 });
  assert.equal(state.resources.food, 260);
  assert.equal(state.resources.knowledge, 80);
  assert.equal(result.rewardReveal.title, '获得奖励');
});

test('领奖后兵营任务保持强引导直到建造完成，并拦截偏离操作', () => {
  const state = gameStateService.createInitialGameState('guide-task-barracks-strong');
  completeTutorial(state);
  state.currentEra = 3;
  state.resources.food = 0;
  state.resources.knowledge = 0;

  const claim = GuideTaskService.claimReward(state, 'barracks_supplies');
  assert.equal(claim.success, true);

  const guide = GuideTaskService.getGuide(state);
  assert.equal(guide.mode, 'strong');
  assert.equal(guide.target, 'card-barracks');

  const blocked = GuideTaskService.validateAction(state, 'advanceEra', {});
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.code, 'GUIDE_TASK_BLOCKED');

  const allowed = GuideTaskService.validateAction(state, 'build', { target: 'barracks' });
  assert.equal(allowed.allowed, true);
});

test('时代进阶主线奖励可补齐资源和士兵条件', () => {
  const state = gameStateService.createInitialGameState('guide-task-border-reward');
  completeTutorial(state);
  state.currentEra = 3;
  state.buildings.barracks = { level: 1 };
  state.resources.food = 700;
  state.resources.wood = 120;
  state.resources.knowledge = 80;
  state.military = { soldiers: 1 };
  gameStateService.normalizeState(state);

  const tasks = GuideTaskService.getGuideTasks(state);
  assert.equal(tasks.tasks[0].id, 'border_advance_supplies');

  const result = GuideTaskService.claimReward(state, 'border_advance_supplies');
  assert.equal(result.success, true);
  assert.deepEqual(result.reward.resources, { food: 200, wood: 380, knowledge: 180 });
  assert.equal(result.reward.soldiers, 2);
  assert.equal(state.resources.food, 900);
  assert.equal(state.resources.wood, 500);
  assert.equal(state.resources.knowledge, 260);
  assert.equal(state.military.soldiers, 3);
});
