const test = require('node:test');
const assert = require('node:assert/strict');

const SoftGuideService = require('../services/SoftGuideService');
const gameStateService = require('../services/GameStateService');

function completeTutorial(state) {
  state.tutorial.completed = true;
  state.tutorial.phaseCompleted = { newbie: true, era2: true };
}

test('城邦进阶软引导在中段后补齐时代3所需资源', () => {
  const state = gameStateService.createInitialGameState('city-guide-resources');
  completeTutorial(state);
  state.currentEra = 2;
  state.resources.food = 250;
  state.resources.wood = 100;
  state.resources.knowledge = 50;
  let progress = gameStateService.calculateEraProgress(state);

  const changed = SoftGuideService.apply(state, progress);
  progress = gameStateService.calculateEraProgress(state);

  assert.equal(changed, true);
  assert.equal(state.resources.food, 500);
  assert.equal(state.resources.wood, 200);
  assert.equal(state.resources.knowledge, 100);
  assert.equal(progress.canAdvance, true);
  assert.equal(SoftGuideService.getSoftGuide(state, progress).id, 'city_advance_ready');
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

test('进入城邦后补齐兵营建造所需资源', () => {
  const state = gameStateService.createInitialGameState('barracks-guide-resources');
  completeTutorial(state);
  state.currentEra = 3;
  state.resources.food = 0;
  state.resources.knowledge = 0;

  const changed = SoftGuideService.apply(state, gameStateService.calculateEraProgress(state));

  assert.equal(changed, true);
  assert.equal(state.resources.food, 260);
  assert.equal(state.resources.knowledge, 80);
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
