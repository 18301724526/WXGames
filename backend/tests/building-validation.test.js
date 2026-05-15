const test = require('node:test');
const assert = require('node:assert/strict');
const gameStateService = require('../services/GameStateService');
const BuildingActionValidator = require('../validators/BuildingActionValidator');

test('原始时代不能建造 farm', () => {
  const state = gameStateService.createInitialGameState('p1');
  state.tutorial.completed = true;
  const result = BuildingActionValidator.validateBuild(state, state.tutorial, 'farm');
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'ERA_NOT_UNLOCKED');
});

test('未完成教程时不能升级建筑', () => {
  const state = gameStateService.createInitialGameState('p2');
  state.currentEra = 1;
  state.buildings.farm = { level: 1, builtAt: 'x', upgradedAt: 'x' };
  const result = BuildingActionValidator.validateUpgrade(state, state.tutorial, 'farm');
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'TUTORIAL_BLOCKED');
});
