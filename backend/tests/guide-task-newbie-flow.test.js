const test = require('node:test');
const assert = require('node:assert/strict');

const GuideTaskService = require('../services/GuideTaskService');
const EventService = require('../services/EventService');
const gameStateService = require('../services/GameStateService');

test('settlement task rewards enough resources to continue into era 2 after house guide', () => {
  const state = gameStateService.createInitialGameState('guide-task-settlement-reward');
  state.currentEra = 1;
  state.buildings.house = { level: 1 };
  state.resources.food = 10;
  state.resources.knowledge = 0;
  state.tutorial.currentStep = 8;
  state.tutorial.phaseCompleted = { newbie: true, era2: false };
  gameStateService.normalizeState(state);

  const tasks = GuideTaskService.getGuideTasks(state);
  assert.equal(tasks.visible, true);
  assert.equal(tasks.tasks[0].id, 'settlement_advance_supplies');
  assert.equal(tasks.tasks[0].status, 'claimable');
  assert.deepEqual(tasks.tasks[0].reward.resources, { food: 110, knowledge: 5 });

  const blocked = GuideTaskService.validateAction(state, 'advanceEra', {});
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.code, 'GUIDE_TASK_REWARD_REQUIRED');

  const result = GuideTaskService.claimReward(state, 'settlement_advance_supplies');
  assert.equal(result.success, true);
  assert.equal(state.resources.food, 120);
  assert.equal(state.resources.knowledge, 5);

  const guide = GuideTaskService.getGuide(state);
  assert.equal(guide.mode, 'soft');
  assert.equal(guide.target, 'btn-advance-era');

  const allowed = GuideTaskService.validateAction(state, 'advanceEra', {});
  assert.equal(allowed.allowed, true);
});

test('lumbermill task stays on build target after reward claim instead of looping to claim', () => {
  const state = gameStateService.createInitialGameState('guide-task-lumbermill-loop');
  state.currentEra = 2;
  state.resources.food = 0;
  state.resources.wood = 0;
  state.tutorial.currentStep = 13;
  state.tutorial.phaseCompleted = { newbie: true, era2: false };
  gameStateService.normalizeState(state);

  const claim = GuideTaskService.claimReward(state, 'lumbermill_supplies');
  assert.equal(claim.success, true);

  const tasks = GuideTaskService.getGuideTasks(state);
  assert.equal(tasks.visible, true);
  assert.equal(tasks.tasks[0].id, 'lumbermill_supplies');
  assert.equal(tasks.tasks[0].status, 'active');
  assert.equal(tasks.tasks[0].claimed, true);
  assert.equal(tasks.tasks[0].target, 'card-lumbermill');
  assert.equal(tasks.tasks[0].actionLabel, '前往');
  assert.deepEqual(tasks.tasks[0].action, {
    type: 'goToGuideTaskTarget',
    taskId: 'lumbermill_supplies',
    target: 'card-lumbermill',
    nextAction: { type: 'buildBuilding', buildingId: 'lumbermill' },
  });

  const guide = GuideTaskService.getGuide(state);
  assert.equal(guide.mode, 'soft');
  assert.equal(guide.target, 'card-lumbermill');
  assert.equal(GuideTaskService.validateAction(state, 'claimGuideTaskReward', { target: 'lumbermill_supplies' }).allowed, false);
  assert.equal(GuideTaskService.validateAction(state, 'build', { target: 'lumbermill' }).allowed, true);
});

test('pending settlement event is not blocked by the lumbermill guide task', () => {
  const state = gameStateService.createInitialGameState('guide-task-event-claim');
  state.currentEra = 2;
  state.tutorial.currentStep = 12;
  state.tutorial.phaseCompleted = { newbie: true, era2: false };
  EventService.generateSpecialEvent(state, 2);
  gameStateService.normalizeState(state);

  const tasks = GuideTaskService.getGuideTasks(state);
  assert.equal(tasks.visible, false);

  const guideCheck = GuideTaskService.validateAction(state, 'claimEvent', {
    eventId: EventService.SETTLEMENT_EVENT_ID,
    optionId: EventService.SETTLEMENT_OPTION_ID,
  });
  assert.equal(guideCheck.allowed, true);

  const claim = EventService.claimEvent(state, EventService.SETTLEMENT_EVENT_ID, EventService.SETTLEMENT_OPTION_ID);
  assert.equal(claim.success, true);

  const nextTasks = GuideTaskService.getGuideTasks(state);
  assert.equal(nextTasks.visible, true);
  assert.equal(nextTasks.tasks[0].id, 'lumbermill_supplies');
});
