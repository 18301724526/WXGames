const test = require('node:test');
const assert = require('node:assert/strict');

const AdvanceEraAction = require('../actions/AdvanceEraAction');
const gameStateService = require('../services/GameStateService');

test('进入农耕时代会扣除食物并给予启蒙知识奖励', () => {
  const state = gameStateService.createInitialGameState('era-bonus-player');
  state.resources.food = 80;
  state.resources.knowledge = 0;

  const result = AdvanceEraAction.execute(state, state.tutorial);

  assert.equal(result.success, true);
  assert.equal(state.currentEra, 1);
  assert.equal(state.resources.food, 0);
  assert.equal(state.resources.knowledge, 5);
});

test('农耕到聚落使用调优后的食物和知识门槛', () => {
  const state = gameStateService.createInitialGameState('era-cost-player');
  state.currentEra = 1;
  state.resources.food = 120;
  state.resources.knowledge = 5;

  const result = AdvanceEraAction.execute(state, state.tutorial);

  assert.equal(result.success, true);
  assert.equal(state.currentEra, 2);
  assert.equal(state.resources.food, 0);
  assert.equal(state.resources.knowledge, 0);
});

test('提前进入聚落时代时会补一名待分配人口避免工匠引导卡住', () => {
  let state = gameStateService.createInitialGameState('settlement-resident-player');
  state.currentEra = 1;
  state.resources.food = 120;
  state.resources.knowledge = 5;
  state.population.total = 3;
  state.population.unassigned = 0;
  state.buildings.house = { level: 1 };
  state = gameStateService.normalizeState(state);

  const result = AdvanceEraAction.execute(state, state.tutorial);

  assert.equal(result.success, true);
  assert.equal(state.currentEra, 2);
  assert.equal(state.population.total, 4);
  assert.equal(state.population.unassigned, 1);
});

test('聚落到城邦需要 500 食物、200 木材和 100 知识', () => {
  const state = gameStateService.createInitialGameState('city-cost-player');
  state.currentEra = 2;
  state.resources.food = 500;
  state.resources.wood = 200;
  state.resources.knowledge = 99;

  const result = AdvanceEraAction.execute(state, state.tutorial);

  assert.equal(result.success, false);
  assert.equal(result.error, 'INSUFFICIENT_RESOURCES');
  assert.equal(state.currentEra, 2);

  state.resources.knowledge = 100;
  const success = AdvanceEraAction.execute(state, state.tutorial);
  assert.equal(success.success, true);
  assert.equal(state.currentEra, 3);
  assert.equal(state.resources.food, 0);
  assert.equal(state.resources.wood, 0);
  assert.equal(state.resources.knowledge, 0);
});

test('城邦到边境需要资源和至少 300 士兵，士兵不会被扣除', () => {
  let state = gameStateService.createInitialGameState('border-cost-player');
  state.currentEra = 3;
  state.resources.food = 900;
  state.resources.wood = 500;
  state.resources.knowledge = 260;
  state.buildings.barracks = { level: 1 };
  state.military = { soldiers: 200 };
  state = gameStateService.normalizeState(state);

  const blocked = AdvanceEraAction.execute(state, state.tutorial);
  assert.equal(blocked.success, false);
  assert.equal(blocked.error, 'INSUFFICIENT_RESOURCES');
  assert.equal(state.currentEra, 3);

  state.military.soldiers = 300;
  const success = AdvanceEraAction.execute(state, state.tutorial);

  assert.equal(success.success, true);
  assert.equal(state.currentEra, 4);
  assert.equal(state.resources.food, 0);
  assert.equal(state.resources.wood, 0);
  assert.equal(state.resources.knowledge, 0);
  assert.equal(state.military.soldiers, 300);
});

test('边境到古典需要资源、士兵和瞭望台', () => {
  let state = gameStateService.createInitialGameState('classical-expansion-player');
  state.currentEra = 4;
  state.resources.food = 1400;
  state.resources.wood = 900;
  state.resources.knowledge = 520;
  state.buildings.barracks = { level: 2 };
  state.military = { soldiers: 600 };
  state = gameStateService.normalizeState(state);

  const blocked = AdvanceEraAction.execute(state, state.tutorial);
  assert.equal(blocked.success, false);
  assert.equal(state.currentEra, 4);

  state.buildings.watchtower = { level: 1 };
  state = gameStateService.normalizeState(state);
  const success = AdvanceEraAction.execute(state, state.tutorial);

  assert.equal(success.success, true);
  assert.equal(state.currentEra, 5);
  assert.equal(success.message, '已进入古典时代，获得科技点 +3');
  assert.equal(success.techGrant.granted, 3);
});
