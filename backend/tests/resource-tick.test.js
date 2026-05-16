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
  state.population.farmers = 2;
  state.population.scholars = 1;
  const clientState = gameStateService.getClientGameState(state);

  assert.equal(clientState.resources.foodOutputPerSecond, 2);
  assert.equal(clientState.resources.foodConsumptionPerSecond, 0.6);
  assert.equal(clientState.resources.foodNetPerSecond, 1.4);
  assert.equal(clientState.resources.foodPerSecond, 1.4);
  assert.equal(clientState.resources.knowledgePerSecond, 0.1);
});

test('伐木场与工匠会产出木材并计入离线收益', () => {
  const state = gameStateService.createInitialGameState('wood-player');
  state.currentEra = 2;
  state.population.farmers = 1;
  state.population.scholars = 1;
  state.population.craftsmen = 1;
  state.buildings.lumbermill = { level: 1, builtAt: new Date().toISOString(), upgradedAt: new Date().toISOString() };
  state.buildingEffects = require('../calculators/BuildingEffectCalculator').calculate(state.buildings);

  const outputs = ResourceTickCalculator.calculateOutputs(state, state.buildingEffects);
  const offline = gameStateService.calculateOfflineIncome(state, 600);

  assert.equal(outputs.woodPerSecond, 2);
  assert.equal(offline.wood, Math.floor(2 * 600 * 0.8));
});
