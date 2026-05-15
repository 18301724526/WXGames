const test = require('node:test');
const assert = require('node:assert/strict');
const BuildingState = require('../js/domain/BuildingState');

test('前端建筑状态 helper 读取等级和按钮文案', () => {
  const buildings = { farm: { level: 1 }, house: null };
  assert.equal(BuildingState.getLevel(buildings, 'farm'), 1);
  assert.equal(BuildingState.isBuilt(buildings, 'house'), false);
  assert.equal(BuildingState.getActionLabel({ food: 50 }, 1), '升级');
  assert.equal(BuildingState.getActionLabel(null, 2), '已满级');
});
