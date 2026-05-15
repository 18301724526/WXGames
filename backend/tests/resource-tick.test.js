const test = require('node:test');
const assert = require('node:assert/strict');

const ResourceTickCalculator = require('../calculators/ResourceTickCalculator');
const gameStateService = require('../services/GameStateService');

test('人口自然增长在食物充足且未达上限时生效', () => {
  const state = gameStateService.createInitialGameState('growth-player');
  state.resources.food = 100;
  state.population.total = 2;
  state.population.farmers = 2;
  state.population.unassigned = 0;
  state.population.max = 3;
  state.population.maxPop = 3;
  state.population.growthProgress = 119;

  const result = ResourceTickCalculator.applyPopulationGrowth(state, 1);

  assert.equal(result.grown, 1);
  assert.equal(state.population.total, 3);
  assert.equal(state.population.unassigned, 1);
  assert.equal(state.population.growthProgress, 0);
});

test('客户端状态返回食物产出/消耗/净增长拆解', () => {
  const state = gameStateService.createInitialGameState('breakdown-player');
  const clientState = gameStateService.getClientGameState(state);

  assert.equal(clientState.resources.foodOutputPerSecond, 3);
  assert.equal(clientState.resources.foodConsumptionPerSecond, 0.6);
  assert.equal(clientState.resources.foodNetPerSecond, 2.4);
  assert.equal(clientState.resources.foodPerSecond, 2.4);
});
