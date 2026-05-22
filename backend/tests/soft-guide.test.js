const test = require('node:test');
const assert = require('node:assert/strict');

const SoftGuideService = require('../services/SoftGuideService');
const gameStateService = require('../services/GameStateService');

function completeTutorial(state) {
  state.tutorial.completed = true;
  state.tutorial.phaseCompleted = { newbie: true, era2: true };
}

test('城邦进阶软引导不再后台补齐时代3所需资源', () => {
  const state = gameStateService.createInitialGameState('city-guide-resources');
  completeTutorial(state);
  state.currentEra = 2;
  state.resources.food = 250;
  state.resources.wood = 100;
  state.resources.knowledge = 50;
  let progress = gameStateService.calculateEraProgress(state);

  const changed = SoftGuideService.apply(state, progress);
  progress = gameStateService.calculateEraProgress(state);

  assert.equal(changed, false);
  assert.equal(state.resources.food, 250);
  assert.equal(state.resources.wood, 100);
  assert.equal(state.resources.knowledge, 50);
  assert.equal(progress.canAdvance, false);
  assert.equal(SoftGuideService.getSoftGuide(state, progress).id, 'city_preparation');
});

test('城邦进阶软引导不会在过早阶段补齐资源', () => {
  const state = gameStateService.createInitialGameState('city-guide-too-early');
  completeTutorial(state);
  state.currentEra = 2;
  state.resources.food = 100;
  state.resources.wood = 20;
  state.resources.knowledge = 10;
  const progress = gameStateService.calculateEraProgress(state);

  const changed = SoftGuideService.apply(state, progress);

  assert.equal(changed, false);
  assert.equal(state.resources.food, 100);
  assert.equal(state.resources.wood, 20);
  assert.equal(state.resources.knowledge, 10);
  assert.equal(SoftGuideService.getSoftGuide(state, progress).id, 'city_preparation');
});

test('进入城邦后软引导不再后台补齐兵营建造资源', () => {
  const state = gameStateService.createInitialGameState('barracks-guide-resources');
  completeTutorial(state);
  state.currentEra = 3;
  state.resources.food = 0;
  state.resources.knowledge = 0;

  const changed = SoftGuideService.apply(state, gameStateService.calculateEraProgress(state));

  assert.equal(changed, false);
  assert.equal(state.resources.food, 0);
  assert.equal(state.resources.knowledge, 0);
  assert.equal(SoftGuideService.getSoftGuide(state, gameStateService.calculateEraProgress(state)).id, 'barracks_unlocked');
});

test('兵营建成后不再补齐兵营资源', () => {
  const state = gameStateService.createInitialGameState('barracks-built-no-topup');
  completeTutorial(state);
  state.currentEra = 3;
  state.resources.food = 0;
  state.resources.knowledge = 0;
  state.buildings.barracks = { level: 1 };

  const changed = SoftGuideService.apply(state, gameStateService.calculateEraProgress(state));

  assert.equal(changed, false);
  assert.equal(state.resources.food, 0);
  assert.equal(state.resources.knowledge, 0);
  assert.equal(SoftGuideService.getSoftGuide(state, gameStateService.calculateEraProgress(state)).id, 'barracks_built');
});

test('城邦后段软引导不再后台补齐边境时代资源', () => {
  const state = gameStateService.createInitialGameState('border-guide-resources');
  completeTutorial(state);
  state.currentEra = 3;
  state.buildings.barracks = { level: 1 };
  state.resources.food = 600;
  state.resources.wood = 350;
  state.resources.knowledge = 160;
  state.military = { soldiers: 3 };
  state.military = require('../services/MilitaryService').normalizeMilitaryState(state.military, state);
  let progress = gameStateService.calculateEraProgress(state);

  const changed = SoftGuideService.apply(state, progress);
  progress = gameStateService.calculateEraProgress(state);

  assert.equal(changed, false);
  assert.equal(state.resources.food, 600);
  assert.equal(state.resources.wood, 350);
  assert.equal(state.resources.knowledge, 160);
  assert.equal(state.military.soldiers, 3);
  assert.equal(progress.canAdvance, false);
  assert.equal(SoftGuideService.getSoftGuide(state, progress).id, 'barracks_built');
});

test('进入边境时代后软引导不再后台补齐瞭望台建造资源', () => {
  const state = gameStateService.createInitialGameState('watchtower-guide-resources');
  completeTutorial(state);
  state.currentEra = 4;
  state.resources.food = 0;
  state.resources.wood = 0;
  state.resources.knowledge = 0;

  const changed = SoftGuideService.apply(state, gameStateService.calculateEraProgress(state));

  assert.equal(changed, false);
  assert.equal(state.resources.food, 0);
  assert.equal(state.resources.wood, 0);
  assert.equal(state.resources.knowledge, 0);
  assert.equal(SoftGuideService.getSoftGuide(state, gameStateService.calculateEraProgress(state)).id, 'watchtower_unlocked');
});

test('瞭望台建成后软引导提示查看威胁事件', () => {
  const state = gameStateService.createInitialGameState('threat-guide');
  completeTutorial(state);
  state.currentEra = 4;
  state.buildings.watchtower = { level: 1 };

  const guide = SoftGuideService.getSoftGuide(state, gameStateService.calculateEraProgress(state));

  assert.equal(guide.id, 'threat_events_open');
  assert.equal(guide.target, 'tab-events');
});
