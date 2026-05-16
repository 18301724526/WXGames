const test = require('node:test');
const assert = require('node:assert/strict');
const gameStateService = require('../services/GameStateService');
const BuildingActionService = require('../services/BuildingActionService');
const TutorialService = require('../services/TutorialService');

test('farm 首次建造免费并推进教程完成', () => {
  const state = gameStateService.createInitialGameState('p1');
  state.currentEra = 1;
  state.tutorial = TutorialService.manualAdvance(state.tutorial, 5);
  const result = BuildingActionService.build(state, state.tutorial, 'farm');
  assert.equal(result.success, true);
  assert.equal(result.cost.food, 0);
  assert.equal(state.buildings.farm.level, 1);
  assert.equal(result.tutorial.phaseCompleted.newbie, true);
  assert.equal(result.tutorial.completed, false);
});

test('house 建造会提升人口上限和幸福度', () => {
  const state = gameStateService.createInitialGameState('p2');
  state.currentEra = 1;
  state.resources.food = 100;
  state.tutorial.completed = true;
  const result = BuildingActionService.build(state, state.tutorial, 'house');
  assert.equal(result.success, true);
  assert.equal(state.population.max, 6);
  assert.equal(state.happiness, 105);
});
