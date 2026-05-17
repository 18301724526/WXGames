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
    watchtower: null,
    temple: null,
  });
  assert.equal(effects.foodOutputMultiplier, 2);
  assert.equal(effects.populationCap, 6);
  assert.equal(effects.happinessBonus, 5);
  assert.equal(effects.byBuilding.farm.foodOutputBonus, 1);
  assert.equal(effects.byBuilding.house.populationCapBonus, 3);
});

test('barracks does not grant output bonus or building defense level', () => {
  const effects = BuildingEffectCalculator.calculate({
    farm: null,
    house: null,
    workshop: null,
    academy: null,
    lumbermill: null,
    barracks: { level: 1 },
    watchtower: null,
    temple: null,
  });

  assert.equal(effects.globalOutputMultiplier, 1);
  assert.equal(effects.defenseLevel, 0);
  assert.equal(effects.byBuilding.barracks.globalOutputBonus, undefined);
  assert.equal(effects.byBuilding.barracks.defenseLevel, undefined);
});

test('watchtower grants threat defense for event checks', () => {
  const effects = BuildingEffectCalculator.calculate({
    farm: null,
    house: null,
    workshop: null,
    academy: null,
    lumbermill: null,
    barracks: null,
    watchtower: { level: 2 },
    temple: null,
  });

  assert.equal(effects.threatDefense, 4);
  assert.equal(effects.byBuilding.watchtower.threatDefenseBonus, 4);
});
