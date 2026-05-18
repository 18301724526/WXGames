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

test('八方向侦察完成后会在有地点的坐标生成世界点和报告', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');

  const start = TerritoryService.startScout(state, 'e', now);
  assert.equal(start.success, true);
  assert.equal(start.mission.targetX, 1);
  assert.equal(start.mission.targetY, 0);

  state.warMissions[0].completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  const claim = TerritoryService.claimScout(state, state.warMissions[0].id, now, () => 0.9);

  assert.equal(claim.success, true);
  assert.equal(claim.site.x, 1);
  assert.equal(claim.site.y, 0);
  assert.equal(claim.site.status, 'discovered');
  assert.ok(Number.isFinite(claim.site.visualOffset.x));
  assert.ok(Number.isFinite(claim.site.visualOffset.y));
  assert.equal(state.scoutReports.length, 1);
  assert.equal(state.scoutReports[0].siteId, claim.site.id);
  assert.match(state.scoutReports[0].text, /东方/);
  assert.deepEqual(state.scoutedCoordinates.find((item) => item.x === 1 && item.y === 0), {
    x: 1,
    y: 0,
    result: 'site',
    siteId: claim.site.id,
    scoutedAt: now.toISOString(),
  });
});

test('侦察到空地后会标记坐标并跳过该坐标', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');

  let start = TerritoryService.startScout(state, 'w', now);
  state.warMissions[0].completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  const firstClaim = TerritoryService.claimScout(state, start.mission.id, now, () => 0.1);

  assert.equal(firstClaim.success, true);
  assert.equal(firstClaim.site, null);
  assert.match(firstClaim.report.text, /未发现可建立据点或占领的目标/);
  assert.deepEqual(state.scoutedCoordinates.find((item) => item.x === -1 && item.y === 0), {
    x: -1,
    y: 0,
    result: 'empty',
    siteId: null,
    scoutedAt: now.toISOString(),
  });

  start = TerritoryService.startScout(state, 'w', new Date('2026-05-17T08:02:00.000Z'));
  assert.equal(start.success, true);
  assert.equal(start.mission.targetX, -2);
  assert.equal(start.mission.targetY, 0);
});

test('侦察队同一时间最多可派出两支，第三支会被拒绝', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');

  const first = TerritoryService.startScout(state, 'n', now);
  const second = TerritoryService.startScout(state, 'e', now);
  const third = TerritoryService.startScout(state, 'w', now);
  const territoryState = TerritoryService.getClientTerritoryState(state, now);

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(third.success, false);
  assert.equal(third.error, 'SCOUT_LIMIT_REACHED');
  assert.equal(territoryState.scoutMissions.length, 2);
  assert.equal(territoryState.activeScoutMission.direction, 'n');
  assert.deepEqual(territoryState.scoutMissions.map((mission) => mission.direction), ['n', 'e']);
});

test('旧存档里的多个侦察任务会收敛为两个待处理任务', () => {
  const state = createClassicalState();
  state.warMissions = [
    { id: 'scout-n', kind: 'scout', direction: 'n', targetX: 0, targetY: -1, startedAt: '2026-05-17T08:00:00.000Z', completesAt: '2026-05-17T08:02:00.000Z', status: 'active' },
    { id: 'scout-e', kind: 'scout', direction: 'e', targetX: 1, targetY: 0, startedAt: '2026-05-17T08:01:00.000Z', completesAt: '2026-05-17T08:02:00.000Z', status: 'active' },
    { id: 'scout-w', kind: 'scout', direction: 'w', targetX: -1, targetY: 0, startedAt: '2026-05-17T08:01:30.000Z', completesAt: '2026-05-17T08:02:00.000Z', status: 'active' },
  ];

  TerritoryService.normalizeTerritoryState(state, new Date('2026-05-17T08:01:30.000Z'));

  assert.deepEqual(state.warMissions.map((mission) => mission.id), ['scout-n', 'scout-e']);
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
  assert.deepEqual(normalized.scoutedCoordinates.find((item) => item.x === 1 && item.y === 0), {
    x: 1,
    y: 0,
    result: 'site',
    siteId: 'river_plain',
    scoutedAt: normalized.territories.find((item) => item.id === 'river_plain').discoveredAt,
  });
});

test('侦察、出征、完成占领会产生待命名城市', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');

  const scout = TerritoryService.startScout(state, 'e', now);
  state.warMissions[0].completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  const discovered = TerritoryService.claimScout(state, scout.mission.id, now, () => 0.9).site;

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

test('占领任务会向前端提供行军总时长和剩余时间', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');

  const scout = TerritoryService.startScout(state, 'e', now);
  state.warMissions[0].completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  const discovered = TerritoryService.claimScout(state, scout.mission.id, now, () => 0.9).site;

  const conquest = TerritoryService.startConquest(state, discovered.id, discovered.recommendedSoldiers, now);
  const territoryState = TerritoryService.getClientTerritoryState(state, new Date(now.getTime() + 30 * 1000));
  const mission = territoryState.territories.find((item) => item.id === discovered.id).mission;

  assert.equal(conquest.success, true);
  assert.equal(mission.durationSeconds, 120);
  assert.equal(mission.remainingSeconds, 90);
});

test('城市命名后第二块领土会提示命名势力', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  const scout = TerritoryService.startScout(state, 'e', now);
  state.warMissions[0].completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  const site = TerritoryService.claimScout(state, scout.mission.id, now, () => 0.9).site;
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

test('侦察结果会在结算时随机决定，并在连续两次空地后触发保底', () => {
  const state = createClassicalState();
  const baseTime = new Date('2026-05-17T08:00:00.000Z');

  const first = TerritoryService.startScout(state, 'n', baseTime);
  state.warMissions.find((mission) => mission.id === first.mission.id).completesAt = baseTime.toISOString();
  TerritoryService.updateMissionReadiness(state, baseTime);
  const firstClaim = TerritoryService.claimScout(state, first.mission.id, baseTime, () => 0.1);
  assert.equal(firstClaim.site, null);
  assert.equal(state.scoutState.emptyStreak, 1);

  const secondAt = new Date('2026-05-17T08:02:00.000Z');
  const second = TerritoryService.startScout(state, 'e', secondAt);
  state.warMissions.find((mission) => mission.id === second.mission.id).completesAt = secondAt.toISOString();
  TerritoryService.updateMissionReadiness(state, secondAt);
  const secondClaim = TerritoryService.claimScout(state, second.mission.id, secondAt, () => 0.1);
  assert.equal(secondClaim.site, null);
  assert.equal(state.scoutState.emptyStreak, 2);

  const thirdAt = new Date('2026-05-17T08:04:00.000Z');
  const third = TerritoryService.startScout(state, 's', thirdAt);
  state.warMissions.find((mission) => mission.id === third.mission.id).completesAt = thirdAt.toISOString();
  TerritoryService.updateMissionReadiness(state, thirdAt);
  const thirdClaim = TerritoryService.claimScout(state, third.mission.id, thirdAt, () => 0.01);
  assert.equal(thirdClaim.success, true);
  assert.ok(thirdClaim.site);
  assert.equal(state.scoutState.emptyStreak, 0);
});
