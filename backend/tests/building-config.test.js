const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BuildingConfig = require('../config/BuildingConfig');

test('BuildingConfig 暴露当前配置版本与来源路径', () => {
  assert.equal(BuildingConfig.getVersion(), '2.1');
  assert.match(BuildingConfig.getSourcePath(), /shared[\\/]+buildingConfig\.json$/);
  assert.equal(BuildingConfig.getBuildCost('farm').food, 0);
});

test('边境时代只新增瞭望台，工坊学院神庙继续后置', () => {
  assert.equal(BuildingConfig.getBuilding('watchtower').unlockEra, 4);
  assert.equal(BuildingConfig.getBuilding('workshop').unlockEra, 5);
  assert.equal(BuildingConfig.getBuilding('academy').unlockEra, 5);
  assert.equal(BuildingConfig.getBuilding('temple').unlockEra, 5);
  assert.equal(BuildingConfig.getBuilding('lumbermill').unlockEra, 2);
  assert.equal(BuildingConfig.getBuilding('barracks').unlockEra, 3);
});

test('所有建筑配置都有存在的美术资源', () => {
  const projectRoot = path.join(__dirname, '..', '..');
  for (const building of Object.values(BuildingConfig.getAllBuildings())) {
    assert.ok(building.art, `${building.id} missing art`);
    const assetPath = path.join(projectRoot, 'frontend', building.art);
    assert.equal(fs.existsSync(assetPath), true, `${building.id} art not found: ${building.art}`);
  }
});

test('barracks config only exposes soldier training, not output or defense-level bonuses', () => {
  const barracks = BuildingConfig.getBuilding('barracks');

  assert.deepEqual(barracks.effects.perLevel, {});
  assert.deepEqual(barracks.ui.effectText, []);
  assert.equal(barracks.military.trainingIntervalSecondsByLevel[1], 30);
  assert.equal(barracks.military.soldierCapByLevel[1], 5);
});

test('watchtower config exposes threat defense effect only', () => {
  const watchtower = BuildingConfig.getBuilding('watchtower');

  assert.equal(watchtower.effects.perLevel.threatDefense, 2);
  assert.deepEqual(watchtower.ui.effectText, [
    { field: 'threatDefenseBonus', label: '边境防御', format: 'number' },
  ]);
});
