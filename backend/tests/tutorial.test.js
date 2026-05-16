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
  assert.equal(tutorial.phaseCompleted.newbie, false);
  assert.equal(tutorial.completed, false);
  assert.equal(tutorial.currentStep, 7);

  tutorial = TutorialService.advanceTutorial(tutorial, 'houseBuilt');
  assert.equal(tutorial.phaseCompleted.newbie, true);
  assert.equal(tutorial.completed, false);
  assert.equal(tutorial.currentStep, 8);
});

test('农田建成后必须先建造民居，不能直接进阶聚落', () => {
  const state = gameStateService.createInitialGameState('house-guide-player');
  state.currentEra = 1;
  state.resources.food = 120;
  state.resources.knowledge = 5;
  state.population.total = 3;
  state.tutorial = TutorialService.manualAdvance(state.tutorial, 7);

  const advance = TutorialService.validateAction(state.tutorial, 'advanceEra', {}, state);
  const buildHouse = TutorialService.validateAction(state.tutorial, 'build', { target: 'house' }, state);
  const buildLumbermill = TutorialService.validateAction(state.tutorial, 'build', { target: 'lumbermill' }, state);

  assert.equal(advance.allowed, false);
  assert.equal(buildHouse.allowed, true);
  assert.equal(buildLumbermill.allowed, false);
});

test('民居建成后资源达标就进入聚落进阶引导，不再等待人口增长', () => {
  const state = gameStateService.createInitialGameState('era2-ready-player');
  state.currentEra = 1;
  state.resources.food = 120;
  state.resources.knowledge = 5;
  state.population.total = 3;
  state.buildings.house = { level: 1 };
  let tutorial = TutorialService.manualAdvance(state.tutorial, 8);

  tutorial = TutorialService.maybeActivateEra2Tutorial(tutorial, state, gameStateService.calculateEraProgress(state));
  assert.equal(tutorial.currentStep, 9);
});

test('民居建成后资源不足时仍停留在等待阶段', () => {
  const state = gameStateService.createInitialGameState('era2-not-ready-player');
  state.currentEra = 1;
  state.resources.food = 119;
  state.resources.knowledge = 5;
  state.population.total = 3;
  state.buildings.house = { level: 1 };
  let tutorial = TutorialService.manualAdvance(state.tutorial, 8);

  tutorial = TutorialService.maybeActivateEra2Tutorial(tutorial, state, gameStateService.calculateEraProgress(state));
  assert.equal(tutorial.currentStep, 8);
});

test('民居建成等待阶段是软引导，允许自由操作但不能提前进阶', () => {
  let tutorial = TutorialService.createInitialTutorialState();
  tutorial = TutorialService.manualAdvance(tutorial, 8);
  const state = gameStateService.createInitialGameState('soft-house-guide-player');
  state.currentEra = 1;

  assert.equal(TutorialService.canAccessTab(tutorial, 'resources'), true);
  assert.equal(TutorialService.canAccessTab(tutorial, 'buildings'), true);
  assert.equal(TutorialService.canAccessTab(tutorial, 'events'), true);
  assert.equal(TutorialService.canAccessTab(tutorial, 'civilization'), true);

  const assignScholar = TutorialService.validateAction(tutorial, 'assign', { target: 'scholar', count: 1 }, state);
  const upgradeFarm = TutorialService.validateAction(tutorial, 'upgrade', { target: 'farm' }, state);
  const advance = TutorialService.validateAction(tutorial, 'advanceEra', {}, state);

  assert.equal(assignScholar.allowed, true);
  assert.equal(upgradeFarm.allowed, true);
  assert.equal(advance.allowed, false);
});

test('时代2引导步骤会锁定对应标签页', () => {
  let tutorial = TutorialService.createInitialTutorialState();
  tutorial = TutorialService.manualAdvance(tutorial, 11);

  assert.equal(TutorialService.canAccessTab(tutorial, 'events'), true);
  assert.equal(TutorialService.canAccessTab(tutorial, 'buildings'), false);
  assert.equal(TutorialService.canAccessTab(tutorial, 'civilization'), false);
});

test('领取事件奖励后允许切到建筑标签继续引导', () => {
  let tutorial = TutorialService.createInitialTutorialState();
  tutorial = TutorialService.manualAdvance(tutorial, 12);

  assert.equal(TutorialService.canAccessTab(tutorial, 'events'), true);
  assert.equal(TutorialService.canAccessTab(tutorial, 'buildings'), true);
  assert.equal(TutorialService.canAccessTab(tutorial, 'civilization'), false);
});

test('伐木场建成后允许切到资源标签分配工匠', () => {
  let tutorial = TutorialService.createInitialTutorialState();
  tutorial = TutorialService.manualAdvance(tutorial, 14);

  assert.equal(TutorialService.canAccessTab(tutorial, 'resources'), true);
  assert.equal(TutorialService.canAccessTab(tutorial, 'buildings'), true);
  assert.equal(TutorialService.canAccessTab(tutorial, 'events'), false);
});

test('伐木场建造步骤允许切到资源标签查看食物', () => {
  let tutorial = TutorialService.createInitialTutorialState();
  tutorial = TutorialService.manualAdvance(tutorial, 13);

  assert.equal(TutorialService.canAccessTab(tutorial, 'resources'), true);
  assert.equal(TutorialService.canAccessTab(tutorial, 'buildings'), true);
  assert.equal(TutorialService.canAccessTab(tutorial, 'events'), false);
});

test('伐木场资源不足时允许自由进行普通操作', () => {
  const state = gameStateService.createInitialGameState('p3');
  state.currentEra = 2;
  state.resources.food = 20;
  state.resources.wood = 20;
  state.tutorial = TutorialService.manualAdvance(state.tutorial, 13);

  const buildWorkshop = TutorialService.validateAction(state.tutorial, 'build', { target: 'workshop' }, state);
  const assignScholar = TutorialService.validateAction(state.tutorial, 'assign', { target: 'scholar', count: 1 }, state);

  assert.equal(buildWorkshop.allowed, true);
  assert.equal(assignScholar.allowed, true);
});

test('时代2进阶完成后的事件引导步骤允许点击事件标签', () => {
  let tutorial = TutorialService.createInitialTutorialState();
  tutorial = TutorialService.manualAdvance(tutorial, 10);

  assert.equal(TutorialService.canAccessTab(tutorial, 'events'), true);
  assert.equal(TutorialService.canAccessTab(tutorial, 'civilization'), true);
  assert.equal(TutorialService.canAccessTab(tutorial, 'buildings'), false);
});

test('新手引导期间允许调整农民和学者人口', () => {
  const state = gameStateService.createInitialGameState('p2');
  const result = TutorialService.validateAction(state.tutorial, 'assign', { target: 'scholar', count: 1 }, state);
  assert.equal(result.allowed, true);
});
