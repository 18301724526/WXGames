const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BuildingConfig = require('../config/BuildingConfig');

test('BuildingConfig 暴露当前配置版本与来源路径', () => {
  assert.equal(BuildingConfig.getVersion(), '2.3');
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

test('采石场和矿场作为科技解锁生产建筑进入配置', () => {
  const quarry = BuildingConfig.getBuilding('quarry');
  const mine = BuildingConfig.getBuilding('mine');

  assert.equal(quarry.name, '采石场');
  assert.equal(quarry.category, 'production');
  assert.equal(quarry.effects.perLevel.stoneOutputBase, 1.5);
  assert.deepEqual(quarry.ui.effectText, [
    { field: 'stoneOutputBase', label: '基础石料', format: 'number' },
  ]);

  assert.equal(mine.name, '矿场');
  assert.equal(mine.category, 'production');
  assert.equal(mine.effects.perLevel.ironOutputBase, 1.2);
  assert.deepEqual(mine.ui.effectText, [
    { field: 'ironOutputBase', label: '基础铁矿', format: 'number' },
  ]);
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

test('building maintenance plan is configured but not active in resource tick yet', () => {
  const policy = BuildingConfig.getMaintenancePolicy();
  const houseMaintenance = BuildingConfig.getMaintenance('house');
  const barracksMaintenance = BuildingConfig.getMaintenance('barracks');

  assert.equal(policy.version, '0.1');
  assert.equal(policy.active, false);
  assert.equal(policy.appliesToResourceTick, false);
  assert.equal(BuildingConfig.isMaintenanceActive(), false);
  assert.deepEqual(houseMaintenance.perLevelPerMinute, { food: 0.4, wood: 0.1 });
  assert.equal(houseMaintenance.enabled, false);
  assert.equal(barracksMaintenance.habitabilityPressure, 2);
});

test('building maintenance and scale previews are player-facing but inactive', () => {
  const housePreview = BuildingConfig.getMaintenancePreview('house');
  const barracksPreview = BuildingConfig.getMaintenancePreview('barracks');
  const farmScale = BuildingConfig.getScalePlanPreview('farm');

  assert.equal(housePreview.planned, true);
  assert.equal(housePreview.active, false);
  assert.deepEqual(housePreview.resources, ['food', 'wood']);
  assert.equal(housePreview.resourceText, '食物、木材');
  assert.equal(housePreview.pressureText, '宜居压力平稳');
  assert.match(barracksPreview.text, /维护预案/);
  assert.match(barracksPreview.text, /宜居压力较高/);
  assert.equal(farmScale.openEnded, true);
  assert.equal(farmScale.currentCapRetained, true);
  assert.equal(farmScale.curveText, '规模收益会逐步放缓');
});

test('open-ended scale plan generates upgrade costs beyond retained cap', () => {
  assert.equal(BuildingConfig.canUpgrade('farm', 4), true);
  assert.deepEqual(BuildingConfig.getUpgradeCost('farm', 4), { food: 350 });
  assert.deepEqual(BuildingConfig.getUpgradeCost('farm', 5), { food: 410 });
});
