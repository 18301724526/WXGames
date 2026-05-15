const test = require('node:test');
const assert = require('node:assert/strict');
const BuildingConfig = require('../config/BuildingConfig');

test('raw 返回隔离副本，避免污染共享建筑配置', () => {
  const snapshot = BuildingConfig.raw();
  const originalMaxLevel = BuildingConfig.getMaxLevel('farm');

  snapshot.buildings.farm.maxLevel = originalMaxLevel + 99;

  assert.equal(BuildingConfig.getMaxLevel('farm'), originalMaxLevel);
  assert.notEqual(snapshot.buildings.farm.maxLevel, BuildingConfig.getMaxLevel('farm'));
});
