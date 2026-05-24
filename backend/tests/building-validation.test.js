const test = require('node:test');
const assert = require('node:assert/strict');
const gameStateService = require('../services/GameStateService');
const BuildingUnlockService = require('../services/BuildingUnlockService');
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

test('城邦时代之前不会解锁工坊和学院', () => {
  assert.deepEqual(BuildingUnlockService.getUnlockedBuildings(2), ['farm', 'house', 'lumbermill']);
  assert.deepEqual(BuildingUnlockService.getUnlockedBuildings(3), ['farm', 'house', 'lumbermill', 'barracks']);
});

test('客户端城邦时代建筑列表只包含农田民居伐木场兵营', () => {
  const state = gameStateService.createInitialGameState('city-unlocks-player');
  state.currentEra = 3;
  state.tutorial.completed = true;

  const clientState = gameStateService.getClientGameState(state);

  assert.deepEqual(clientState.unlockedBuildings, ['farm', 'house', 'lumbermill', 'barracks']);
  assert.equal(clientState.unlockedBuildings.includes('workshop'), false);
  assert.equal(clientState.unlockedBuildings.includes('academy'), false);
});

test('聚落和城邦时代不能建造工坊或学院', () => {
  for (const era of [2, 3]) {
    for (const buildingId of ['workshop', 'academy']) {
      const state = gameStateService.createInitialGameState(`${buildingId}-era-${era}`);
      state.currentEra = era;
      state.tutorial.completed = true;
      state.resources = { food: 999, knowledge: 999, wood: 999, stone: 0, metal: 0 };

      const result = BuildingActionValidator.validateBuild(state, state.tutorial, buildingId);

      assert.equal(result.allowed, false);
      assert.equal(result.code, 'ERA_NOT_UNLOCKED');
    }
  }
});

test('边境时代只新增瞭望台，后续建筑不会提前解锁', () => {
  assert.deepEqual(
    BuildingUnlockService.getUnlockedBuildings(4),
    ['farm', 'house', 'lumbermill', 'barracks', 'watchtower'],
  );

  const state = gameStateService.createInitialGameState('border-unlocks-player');
  state.currentEra = 4;
  state.tutorial.completed = true;
  state.resources = { food: 999, knowledge: 999, wood: 999, stone: 0, metal: 0 };

  const watchtower = BuildingActionValidator.validateBuild(state, state.tutorial, 'watchtower');
  assert.equal(watchtower.allowed, true);

  for (const buildingId of ['workshop', 'academy', 'temple']) {
    const result = BuildingActionValidator.validateBuild(state, state.tutorial, buildingId);
    assert.equal(result.allowed, false, `${buildingId} should remain locked`);
    assert.equal(result.code, 'ERA_NOT_UNLOCKED');
  }
});

test('采石场和矿场只会在对应科技研究后解锁建造', () => {
  const state = gameStateService.createInitialGameState('resource-tech-unlocks-player');
  state.currentEra = 5;
  state.tutorial.completed = true;
  state.resources = { food: 9999, knowledge: 9999, wood: 9999, stone: 9999, iron: 0, metal: 0 };
  state.techs.points = 5;

  assert.equal(BuildingActionValidator.validateBuild(state, state.tutorial, 'quarry').allowed, false);
  assert.equal(BuildingActionValidator.validateBuild(state, state.tutorial, 'mine').allowed, false);

  assert.equal(require('../services/TechTreeService').research(state, 'farming_field_rotation').success, true);
  assert.equal(require('../services/TechTreeService').research(state, 'settlement_logging_rights').success, true);
  assert.equal(require('../services/TechTreeService').research(state, 'city_quarry_survey').success, true);

  assert.equal(BuildingActionValidator.validateBuild(state, state.tutorial, 'quarry').allowed, true);
  assert.equal(BuildingActionValidator.validateBuild(state, state.tutorial, 'mine').allowed, false);

  assert.equal(require('../services/TechTreeService').research(state, 'frontier_bloomery_signs').success, true);

  assert.equal(BuildingActionValidator.validateBuild(state, state.tutorial, 'mine').allowed, true);
});
