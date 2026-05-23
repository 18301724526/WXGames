const test = require('node:test');
const assert = require('node:assert/strict');
const gameStateService = require('../services/GameStateService');
const BuildingActionService = require('../services/BuildingActionService');
const TutorialService = require('../services/TutorialService');

test('farm 首次建造免费并推进到民居引导', () => {
  const state = gameStateService.createInitialGameState('p1');
  state.currentEra = 1;
  state.tutorial = TutorialService.manualAdvance(state.tutorial, 5);
  const result = BuildingActionService.build(state, state.tutorial, 'farm');
  assert.equal(result.success, true);
  assert.equal(result.cost.food, 0);
  assert.equal(state.buildings.farm.level, 1);
  assert.equal(result.tutorial.phaseCompleted.newbie, false);
  assert.equal(result.tutorial.completed, false);
  assert.equal(result.tutorial.currentStep, 7);
});

test('house 建造会提升人口上限但不产出幸福度', () => {
  const state = gameStateService.createInitialGameState('p2');
  state.currentEra = 1;
  state.resources.food = 100;
  state.tutorial.completed = true;
  const result = BuildingActionService.build(state, state.tutorial, 'house');
  assert.equal(result.success, true);
  assert.equal(state.population.max, 6);
  assert.equal(state.happiness, 100);
});

test('open-ended buildings can upgrade beyond the retained scale cap', () => {
  const state = gameStateService.createInitialGameState('p3');
  state.currentEra = 1;
  state.resources.food = 1000;
  state.tutorial.completed = true;
  state.buildings.farm = { level: 4, builtAt: 'x', upgradedAt: 'x' };

  const result = BuildingActionService.upgrade(state, state.tutorial, 'farm');

  assert.equal(result.success, true);
  assert.equal(result.oldLevel, 4);
  assert.equal(result.newLevel, 5);
  assert.deepEqual(result.cost, { food: 350 });
  assert.equal(state.buildings.farm.level, 5);
});
