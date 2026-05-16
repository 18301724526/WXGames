const test = require('node:test');
const assert = require('node:assert/strict');
const TutorialService = require('../services/TutorialService');
const gameStateService = require('../services/GameStateService');

test('教程步骤限制时代进阶', () => {
  const state = gameStateService.createInitialGameState('p1');
  const result = TutorialService.validateAction(state.tutorial, 'advanceEra', {}, state);
  assert.equal(result.allowed, false);
});

test('教程事件推进到完成', () => {
  let tutorial = TutorialService.createInitialTutorialState();
  tutorial = TutorialService.advanceTutorial(tutorial, 'tutorialStarted');
  tutorial = TutorialService.advanceTutorial(tutorial, 'civilizationTabOpened');
  tutorial = TutorialService.advanceTutorial(tutorial, 'eraAdvanced');
  tutorial = TutorialService.advanceTutorial(tutorial, 'buildingsTabOpened');
  tutorial = TutorialService.advanceTutorial(tutorial, 'farmBuilt');
  assert.equal(tutorial.phaseCompleted.newbie, true);
  assert.equal(tutorial.completed, false);
  assert.equal(tutorial.currentStep, 7);
});

test('时代2引导步骤会锁定对应标签页', () => {
  let tutorial = TutorialService.createInitialTutorialState();
  tutorial = TutorialService.manualAdvance(tutorial, 10);

  assert.equal(TutorialService.canAccessTab(tutorial, 'events'), true);
  assert.equal(TutorialService.canAccessTab(tutorial, 'buildings'), false);
  assert.equal(TutorialService.canAccessTab(tutorial, 'civilization'), false);
});

test('领取事件奖励后允许切到建筑标签继续引导', () => {
  let tutorial = TutorialService.createInitialTutorialState();
  tutorial = TutorialService.manualAdvance(tutorial, 11);

  assert.equal(TutorialService.canAccessTab(tutorial, 'events'), true);
  assert.equal(TutorialService.canAccessTab(tutorial, 'buildings'), true);
  assert.equal(TutorialService.canAccessTab(tutorial, 'civilization'), false);
});

test('伐木场建成后允许切到资源标签分配工匠', () => {
  let tutorial = TutorialService.createInitialTutorialState();
  tutorial = TutorialService.manualAdvance(tutorial, 13);

  assert.equal(TutorialService.canAccessTab(tutorial, 'resources'), true);
  assert.equal(TutorialService.canAccessTab(tutorial, 'buildings'), true);
  assert.equal(TutorialService.canAccessTab(tutorial, 'events'), false);
});

test('伐木场建造步骤允许切到资源标签查看食物', () => {
  let tutorial = TutorialService.createInitialTutorialState();
  tutorial = TutorialService.manualAdvance(tutorial, 12);

  assert.equal(TutorialService.canAccessTab(tutorial, 'resources'), true);
  assert.equal(TutorialService.canAccessTab(tutorial, 'buildings'), true);
  assert.equal(TutorialService.canAccessTab(tutorial, 'events'), false);
});

test('伐木场资源不足时允许自由进行普通操作', () => {
  const state = gameStateService.createInitialGameState('p3');
  state.currentEra = 2;
  state.resources.food = 20;
  state.resources.wood = 20;
  state.tutorial = TutorialService.manualAdvance(state.tutorial, 12);

  const buildWorkshop = TutorialService.validateAction(state.tutorial, 'build', { target: 'workshop' }, state);
  const assignScholar = TutorialService.validateAction(state.tutorial, 'assign', { target: 'scholar', count: 1 }, state);

  assert.equal(buildWorkshop.allowed, true);
  assert.equal(assignScholar.allowed, true);
});

test('时代2进阶完成后的事件引导步骤允许点击事件标签', () => {
  let tutorial = TutorialService.createInitialTutorialState();
  tutorial = TutorialService.manualAdvance(tutorial, 9);

  assert.equal(TutorialService.canAccessTab(tutorial, 'events'), true);
  assert.equal(TutorialService.canAccessTab(tutorial, 'civilization'), true);
  assert.equal(TutorialService.canAccessTab(tutorial, 'buildings'), false);
});

test('新手引导期间允许调整农民和学者人口', () => {
  const state = gameStateService.createInitialGameState('p2');
  const result = TutorialService.validateAction(state.tutorial, 'assign', { target: 'scholar', count: 1 }, state);
  assert.equal(result.allowed, true);
});
