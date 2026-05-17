const test = require('node:test');
const assert = require('node:assert/strict');

const BuildingConfig = require('../config/BuildingConfig');

test('BuildingConfig 暴露当前配置版本与来源路径', () => {
  assert.equal(BuildingConfig.getVersion(), '2.0');
  assert.match(BuildingConfig.getSourcePath(), /shared[\\/]+buildingConfig\.json$/);
  assert.equal(BuildingConfig.getBuildCost('farm').food, 0);
});

test('工坊和学院预留到城邦时代之后', () => {
  assert.equal(BuildingConfig.getBuilding('workshop').unlockEra, 4);
  assert.equal(BuildingConfig.getBuilding('academy').unlockEra, 4);
  assert.equal(BuildingConfig.getBuilding('lumbermill').unlockEra, 2);
  assert.equal(BuildingConfig.getBuilding('barracks').unlockEra, 3);
});
