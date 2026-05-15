const test = require('node:test');
const assert = require('node:assert/strict');

const BuildingConfig = require('../config/BuildingConfig');

test('BuildingConfig 暴露当前配置版本与来源路径', () => {
  assert.equal(BuildingConfig.getVersion(), '2.0');
  assert.match(BuildingConfig.getSourcePath(), /shared[\\/]+buildingConfig\.json$/);
  assert.equal(BuildingConfig.getBuildCost('farm').food, 0);
});
