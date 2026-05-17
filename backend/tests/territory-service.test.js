const test = require('node:test');
const assert = require('node:assert/strict');

const gameStateService = require('../services/GameStateService');
const TerritoryService = require('../services/TerritoryService');

function createClassicalState() {
  const state = gameStateService.createInitialGameState('territory-player');
  state.currentEra = 5;
  state.tutorial.completed = true;
  state.buildings.barracks = { level: 2 };
  state.buildings.watchtower = { level: 1 };
  state.military = { soldiers: 8 };
  return gameStateService.normalizeState(state);
}

test('古典时代只默认显示首都和八方向侦察入口', () => {
  const state = createClassicalState();
  const territoryState = TerritoryService.getClientTerritoryState(state);

  assert.equal(territoryState.occupiedCount, 1);
  assert.equal(territoryState.discoveredCount, 1);
  assert.equal(territoryState.territories.length, 1);
  assert.equal(territoryState.territories[0].id, 'capital');
  assert.equal(territoryState.territories[0].x, 0);
  assert.equal(territoryState.territories[0].y, 0);
  assert.deepEqual(territoryState.directions.map((item) => item.id), ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']);
});

test('八方向侦察完成后会在对应坐标生成世界点和报告', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');

  const start = TerritoryService.startScout(state, 'ne', now);
  assert.equal(start.success, true);
  assert.equal(start.mission.targetX, 1);
  assert.equal(start.mission.targetY, -1);

  state.warMissions[0].completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  const claim = TerritoryService.claimScout(state, state.warMissions[0].id, now);

  assert.equal(claim.success, true);
  assert.equal(claim.site.x, 1);
  assert.equal(claim.site.y, -1);
  assert.equal(claim.site.status, 'discovered');
  assert.equal(state.scoutReports.length, 1);
  assert.equal(state.scoutReports[0].siteId, claim.site.id);
  assert.match(state.scoutReports[0].text, /东北/);
});

test('同一方向重复侦察会继续向更远坐标扩展', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');

  let start = TerritoryService.startScout(state, 'e', now);
  state.warMissions[0].completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  TerritoryService.claimScout(state, start.mission.id, now);

  start = TerritoryService.startScout(state, 'e', new Date('2026-05-17T08:02:00.000Z'));
  assert.equal(start.success, true);
  assert.equal(start.mission.targetX, 2);
  assert.equal(start.mission.targetY, 0);
});

test('旧版固定节点只迁移已有进度，不再默认铺满地图', () => {
  const state = createClassicalState();
  state.territories = [
    { id: 'capital', cityName: '火种城', status: 'occupied' },
    { id: 'river_plain', naturalName: '河湾平原', status: 'occupied', cityName: '河湾城', effects: { foodOutputMultiplier: 0.05 } },
    { id: 'north_forest', naturalName: '北部林地', status: 'locked', effects: { woodOutputMultiplier: 0.08 } },
  ];

  const normalized = gameStateService.normalizeState(state);
  const territoryState = TerritoryService.getClientTerritoryState(normalized);

  assert.equal(territoryState.territories.length, 2);
  assert.equal(territoryState.territories.find((item) => item.id === 'river_plain').status, 'occupied');
  assert.equal(territoryState.territories.find((item) => item.id === 'river_plain').x, 1);
  assert.equal(territoryState.territories.some((item) => item.id === 'north_forest'), false);
});

test('侦察、出征、完成占领会产生待命名城市', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');

  const scout = TerritoryService.startScout(state, 'e', now);
  state.warMissions[0].completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  const discovered = TerritoryService.claimScout(state, scout.mission.id, now).site;

  const start = TerritoryService.startConquest(state, discovered.id, discovered.recommendedSoldiers, now);
  assert.equal(start.success, true);
  assert.equal(TerritoryService.getAvailableSoldiers(state), 8 - discovered.recommendedSoldiers);

  const mission = state.warMissions.find((item) => item.kind === 'conquest');
  mission.completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  const claim = TerritoryService.claimConquest(state, discovered.id, now);

  assert.equal(claim.success, true);
  assert.equal(claim.outcome, 'success');
  assert.equal(claim.namingPrompt.type, 'city');
  assert.equal(state.territories.find((item) => item.id === discovered.id).status, 'occupied');
});

test('城市命名后第二块领土会提示命名势力', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  const scout = TerritoryService.startScout(state, 'e', now);
  state.warMissions[0].completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  const site = TerritoryService.claimScout(state, scout.mission.id, now).site;
  TerritoryService.startConquest(state, site.id, site.recommendedSoldiers, now);
  state.warMissions[0].completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  TerritoryService.claimConquest(state, site.id, now);

  const city = TerritoryService.renameCity(state, site.id, '河湾城');
  assert.equal(city.success, true);
  assert.equal(city.namingPrompt.type, 'polity');

  const polity = TerritoryService.renamePolity(state, '赤火联盟');
  assert.equal(polity.success, true);
  assert.equal(state.polity.name, '赤火联盟');
  assert.equal(TerritoryService.getClientTerritoryState(state).namingPrompt, null);
});

test('占领世界点效果会汇总到资源和防御加成', () => {
  const state = createClassicalState();
  state.territories.push({
    id: 'site_food',
    x: 1,
    y: 0,
    naturalName: '河湾村镇',
    type: 'town',
    owner: 'player',
    status: 'occupied',
    scale: 2,
    threat: 2,
    defense: 4,
    recommendedSoldiers: 4,
    art: 'assets/art/world-site-town-cutout.png',
    effects: { foodOutputMultiplier: 0.05, woodOutputMultiplier: 0.08, knowledgeOutputMultiplier: 0.06, threatDefense: 2 },
  });

  const normalized = gameStateService.normalizeState(state);

  assert.equal(normalized.buildingEffects.territoryFoodOutputBonus, 0.05);
  assert.equal(normalized.buildingEffects.territoryWoodOutputBonus, 0.08);
  assert.equal(normalized.buildingEffects.territoryKnowledgeOutputBonus, 0.06);
  assert.equal(normalized.buildingEffects.threatDefense, 4);
});
