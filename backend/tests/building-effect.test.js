const test = require('node:test');
const assert = require('node:assert/strict');
const BuildingEffectCalculator = require('../calculators/BuildingEffectCalculator');

test('farm 和 house 等级效果计算正确', () => {
  const effects = BuildingEffectCalculator.calculate({
    farm: { level: 2 },
    house: { level: 1 },
    workshop: null,
    academy: null,
    barracks: null,
    temple: null,
  });
  assert.equal(effects.foodOutputMultiplier, 2);
  assert.equal(effects.populationCap, 6);
  assert.equal(effects.happinessBonus, 5);
  assert.equal(effects.byBuilding.farm.foodOutputBonus, 1);
  assert.equal(effects.byBuilding.house.populationCapBonus, 3);
});
