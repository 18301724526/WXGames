const test = require('node:test');
const assert = require('node:assert/strict');

const BuildingCalculator = require('../modules/BuildingCalculator');
const BuildingEffects = require('../modules/BuildingEffects');
const BuildingValidator = require('../modules/BuildingValidator');
const BuildingSystem = require('../modules/BuildingSystem');
const BuildingState = require('../domain/BuildingState');
const BuildingConfig = require('../config/BuildingConfig');

test('遗留 BuildingCalculator 兼容新版 buildCost/upgradeCosts 配置', () => {
  assert.deepEqual(BuildingCalculator.getBuildingCost('farm', 0), { food: 0 });
  assert.deepEqual(BuildingCalculator.getBuildingCost('farm', 1), { food: 50 });
  assert.equal(BuildingCalculator.getBuildingCost('farm', 4), null);
  assert.equal(BuildingCalculator.getBuildingDef('farm').maxLevel, 4);
});

test('遗留 BuildingEffects 按新版 perLevel 配置计算效果', () => {
  const effects = new BuildingEffects();
  const gameState = {
    buildings: {
      farm: { level: 2 },
      house: { level: 1 },
      workshop: null,
      academy: null,
      barracks: null,
      watchtower: null,
      temple: null,
    },
  };

  assert.equal(effects.getFoodOutputMultiplier(gameState), 2);
  assert.equal(effects.getHappinessBonus(gameState), 0);
});

test('遗留 BuildingValidator 与 BuildingSystem 兼容对象式建筑状态', () => {
  const gameState = {
    currentEra: 1,
    resources: { food: 200, knowledge: 0 },
    buildings: BuildingState.createInitialBuildingState(),
  };

  const validation = BuildingValidator.validateBuildRequest('farm', gameState);
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.cost, { food: 0 });

  const system = new BuildingSystem();
  const result = system.build('farm', gameState);
  assert.equal(result.success, true);
  assert.equal(BuildingState.getLevel(gameState.buildings, 'farm'), 1);
  assert.equal(system.getBuildingInfo('farm', gameState).maxLevel, BuildingConfig.getMaxLevel('farm'));
});

test('遗留 BuildingSystem 进阶建筑条件不再引用工坊和学院', () => {
  const system = new BuildingSystem();

  assert.deepEqual(system.getEraConditionsConfig(3).requiredBuildings, { lumbermill: 1 });
  assert.deepEqual(system.getEraConditionsConfig(4).requiredBuildings, { barracks: 1 });
  assert.deepEqual(system.getEraConditionsConfig(5).requiredBuildings, { watchtower: 1 });
});
