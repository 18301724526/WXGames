const test = require('node:test');
const assert = require('node:assert/strict');

const GuideTaskService = require('../services/GuideTaskService');
const gameStateService = require('../services/GameStateService');

function completeTutorial(state) {
  state.tutorial.completed = true;
  state.tutorial.currentStep = 15;
  state.tutorial.phaseCompleted = { newbie: true, era2: true };
}

test('主线任务奖励按完整奖励展示和发放，不按已有资源缩减', () => {
  const state = gameStateService.createInitialGameState('guide-task-barracks-reward');
  completeTutorial(state);
  state.currentEra = 3;
  state.resources.food = 100;
  state.resources.knowledge = 20;

  const tasks = GuideTaskService.getGuideTasks(state);
  assert.equal(tasks.visible, true);
  assert.equal(tasks.tasks[0].id, 'barracks_supplies');
  assert.equal(tasks.tasks[0].status, 'claimable');
  assert.equal(tasks.tasks[0].action.type, 'claimGuideTaskReward');
  assert.deepEqual(tasks.tasks[0].reward.resources, { food: 260, knowledge: 80 });
  assert.equal(tasks.tasks[0].rewardText, '食物 +260 / 知识 +80');

  const result = GuideTaskService.claimReward(state, 'barracks_supplies');

  assert.equal(result.success, true);
  assert.deepEqual(result.reward.resources, { food: 260, knowledge: 80 });
  assert.equal(result.rewardReveal.rewardText, '食物 +260 / 知识 +80');
  assert.equal(state.resources.food, 360);
  assert.equal(state.resources.knowledge, 100);
  assert.equal(result.rewardReveal.title, '获得奖励');
});

test('资源已经满足时仍显示并发放完整主线奖励', () => {
  const state = gameStateService.createInitialGameState('guide-task-full-reward-when-stocked');
  completeTutorial(state);
  state.currentEra = 3;
  state.resources.food = 999;
  state.resources.knowledge = 999;

  const tasks = GuideTaskService.getGuideTasks(state);
  assert.equal(tasks.tasks[0].id, 'barracks_supplies');
  assert.deepEqual(tasks.tasks[0].reward.resources, { food: 260, knowledge: 80 });
  assert.equal(tasks.tasks[0].rewardText, '食物 +260 / 知识 +80');

  const result = GuideTaskService.claimReward(state, 'barracks_supplies');
  assert.equal(result.success, true);
  assert.equal(result.rewardReveal.rewardText, '食物 +260 / 知识 +80');
  assert.equal(state.resources.food, 1259);
  assert.equal(state.resources.knowledge, 1079);
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

  const tasks = GuideTaskService.getGuideTasks(state);
  assert.equal(tasks.tasks[0].status, 'active');
  assert.equal(tasks.tasks[0].actionLabel, '前往');
  assert.deepEqual(tasks.tasks[0].action, {
    type: 'goToGuideTaskTarget',
    taskId: 'barracks_supplies',
    target: 'card-barracks',
    nextAction: { type: 'buildBuilding', buildingId: 'barracks' },
  });

  const blocked = GuideTaskService.validateAction(state, 'advanceEra', {});
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.code, 'GUIDE_TASK_BLOCKED');

  const allowed = GuideTaskService.validateAction(state, 'build', { target: 'barracks' });
  assert.equal(allowed.allowed, true);
});

test('时代进阶主线奖励按完整条件包发放', () => {
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
  assert.deepEqual(result.reward.resources, { food: 900, wood: 500, knowledge: 260 });
  assert.equal(result.reward.soldiers, 3);
  assert.equal(result.rewardReveal.rewardText, '食物 +900 / 木材 +500 / 知识 +260 / 士兵 +3');
  assert.equal(state.resources.food, 1600);
  assert.equal(state.resources.wood, 620);
  assert.equal(state.resources.knowledge, 340);
  assert.equal(state.military.soldiers, 4);
});

test('first scout main task go action targets the scout button', () => {
  const state = gameStateService.createInitialGameState('guide-task-first-scout-target');
  completeTutorial(state);
  state.currentEra = 5;
  state.buildings.barracks = { level: 2 };
  state.buildings.watchtower = { level: 1 };
  state.warMissions = [];
  state.scoutReports = [];
  state.scoutedCoordinates = [];
  gameStateService.normalizeState(state);

  const tasks = GuideTaskService.getGuideTasks(state);
  assert.equal(tasks.visible, true);
  assert.equal(tasks.tasks[0].id, 'first_scout_reward');
  assert.equal(tasks.tasks[0].status, 'active');
  assert.equal(tasks.tasks[0].target, 'scout-action-first');
  assert.deepEqual(tasks.tasks[0].action, {
    type: 'goToGuideTaskTarget',
    taskId: 'first_scout_reward',
    target: 'scout-action-first',
    nextAction: { type: 'switchMilitaryView', view: 'scout' },
  });

  const guide = GuideTaskService.getGuide(state);
  assert.equal(guide.mode, 'strong');
  assert.equal(guide.target, 'scout-action-first');
});
