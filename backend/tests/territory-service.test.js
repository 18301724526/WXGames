const test = require('node:test');
const assert = require('node:assert/strict');

const gameStateService = require('../services/GameStateService');
const CityService = require('../services/CityService');
const TerritoryService = require('../services/TerritoryService');
const FamousPersonService = require('../services/FamousPersonService');

function createClassicalState() {
  const state = gameStateService.createInitialGameState('territory-player');
  state.currentEra = 5;
  state.tutorial.completed = true;
  state.buildings.barracks = { level: 2 };
  state.buildings.watchtower = { level: 1 };
  state.military = { soldiers: 800 };
  return gameStateService.normalizeState(state);
}

function createSequenceRandom(values) {
  let index = 0;
  return () => {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;
    return value;
  };
}

function addOccupiedSubCity(state, options = {}) {
  state.territories.push({
    id: options.id || 'site_east',
    x: Number.isFinite(options.x) ? options.x : 2,
    y: Number.isFinite(options.y) ? options.y : 0,
    naturalName: options.naturalName || '东境据点',
    cityName: options.cityName || '东境城',
    type: 'town',
    owner: 'player',
    status: 'occupied',
    scale: 2,
    threat: 2,
    defense: 400,
    recommendedSoldiers: 400,
    art: 'assets/art/world-site-town-cutout.png',
    effects: {},
    discoveredAt: '2026-05-17T08:00:00.000Z',
    occupiedAt: '2026-05-17T08:02:00.000Z',
  });
}

function addDiscoveredTribeSite(state, options = {}) {
  state.territories.push({
    id: options.id || 'tribe_target',
    x: Number.isFinite(options.x) ? options.x : 3,
    y: Number.isFinite(options.y) ? options.y : 0,
    naturalName: options.naturalName || '东境营地',
    cityName: null,
    type: 'camp',
    owner: 'tribe',
    status: 'discovered',
    scale: 2,
    threat: 4,
    defense: 500,
    recommendedSoldiers: 500,
    art: 'assets/art/world-site-camp-cutout.png',
    visualOffset: { x: 0, y: 0 },
    discoveredAt: '2026-05-17T08:04:00.000Z',
    occupiedAt: null,
    effects: { woodOutputMultiplier: 0.08 },
    summary: '东境外的部落营地。',
    lastBattle: null,
  });
}

function addFamousLeader(state, options = {}) {
  state.famousPeople = [{
    id: options.id || 'fp_luxiao',
    name: options.name || '陆骁',
    title: options.title || '破阵先登',
    source: { type: 'seek' },
    archetype: 'vanguard',
    roles: ['military'],
    attributes: {
      command: options.command || 82,
      force: options.force || 86,
      intelligence: options.strategy || 48,
      strategy: options.strategy || 48,
      politics: 26,
      governance: 26,
      craft: 18,
      charisma: options.charisma || 58,
      speed: 76,
    },
    abilityKit: {
      archetype: 'vanguard',
      domain: 'battle',
      battlePolicy: 'useBattleSkill',
      abilities: [{
        id: 'skill_vanguard_blood_assault',
        name: '血刃破阵',
        slot: 'activeSkill',
        kind: 'active',
        type: 'battle',
        category: 'blade',
        damageType: 'blade',
        multiplier: 1.42,
        cooldown: 3,
        castPolicy: 'conditional',
        castConditions: [{ type: 'cooldownReady' }, { type: 'targetAlive' }],
        effects: [
          { key: 'directDamage', value: 1.42 },
          { key: 'lifesteal', value: 0.12 },
        ],
      }],
    },
    skills: [{
      id: 'skill_vanguard_blood_assault',
      name: '血刃破阵',
      type: 'battle',
      damageType: 'blade',
      multiplier: 1.42,
      cooldown: 3,
      castPolicy: 'conditional',
      castConditions: [{ type: 'cooldownReady' }, { type: 'targetAlive' }],
      effects: [
        { key: 'directDamage', value: 1.42 },
        { key: 'lifesteal', value: 0.16 },
      ],
    }],
    status: { assigned: 'idle', loyalty: 68 },
    createdAt: '2026-05-17T07:00:00.000Z',
    joinedAt: '2026-05-17T07:01:00.000Z',
  }];
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
  const claim = TerritoryService.claimScout(state, state.warMissions[0].id, now, createSequenceRandom([0.1, 0.9, 0.5]));

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
  const firstClaim = TerritoryService.claimScout(state, start.mission.id, now, () => 0.95);

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

test('分城侦察会以当前分城坐标作为出发原点', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  addOccupiedSubCity(state, { x: 2, y: 0 });
  const normalized = gameStateService.normalizeState(state);
  CityService.setActiveCity(normalized, 'site_east');

  const start = TerritoryService.startScout(normalized, 'e', now);
  const territoryState = TerritoryService.getClientTerritoryState(normalized, now);
  const subCityOnMap = territoryState.territories.find((item) => item.id === 'site_east');

  assert.equal(start.success, true);
  assert.equal(start.mission.sourceCityId, 'site_east');
  assert.equal(start.mission.originX, 2);
  assert.equal(start.mission.originY, 0);
  assert.equal(start.mission.targetX, 3);
  assert.equal(start.mission.targetY, 0);
  assert.equal(territoryState.scoutOrigin.territoryId, 'site_east');
  assert.equal(subCityOnMap.relativeX, 0);
  assert.equal(subCityOnMap.relativeY, 0);
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
  const discovered = TerritoryService.claimScout(state, scout.mission.id, now, createSequenceRandom([0.1, 0.9, 0.5])).site;

  const start = TerritoryService.startConquest(state, discovered.id, discovered.recommendedSoldiers, now);
  assert.equal(start.success, true);
  assert.equal(TerritoryService.getAvailableSoldiers(state), 500);

  const mission = state.warMissions.find((item) => item.kind === 'conquest');
  mission.completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  const claim = TerritoryService.claimConquest(state, discovered.id, now);

  assert.equal(claim.success, true);
  assert.equal(claim.outcome, 'success');
  assert.equal(claim.namingPrompt.type, 'city');
  assert.equal(state.territories.find((item) => item.id === discovered.id).status, 'occupied');
});

test('无主地区占领时会自动按 100 士兵建立据点处理', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');

  const scout = TerritoryService.startScout(state, 'e', now);
  state.warMissions[0].completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  const discovered = TerritoryService.claimScout(state, scout.mission.id, now, createSequenceRandom([0.1, 0.9, 0.5])).site;

  assert.equal(discovered.owner, 'neutral');
  assert.equal(discovered.occupationMode, undefined);

  const start = TerritoryService.startConquest(state, discovered.id, { soldiers: 800 }, now);
  assert.equal(start.success, true);
  assert.equal(start.mission.mode, 'settlement');
  assert.equal(start.mission.soldiersCommitted, 100);
  assert.equal(start.message, `已派出 100 士兵前往${discovered.naturalName}建立据点`);

  const mission = state.warMissions.find((item) => item.kind === 'conquest');
  mission.completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  const claim = TerritoryService.claimConquest(state, discovered.id, now);

  assert.equal(claim.success, true);
  assert.equal(claim.casualties, 0);
  assert.equal(state.territories.find((item) => item.id === discovered.id).owner, 'player');
  assert.equal(state.territories.find((item) => item.id === discovered.id).lastBattle.mode, 'settlement');
});

test('有主地区占领时会保留出征配置并按人数进行战斗结算', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  state.territories.push({
    id: 'tribe_site',
    x: 0,
    y: -2,
    naturalName: '北风营帐',
    cityName: null,
    type: 'camp',
    owner: 'tribe',
    status: 'discovered',
    scale: 2,
    threat: 4,
    defense: 500,
    recommendedSoldiers: 500,
    art: 'assets/art/world-site-camp-cutout.png',
    visualOffset: { x: 0, y: 0 },
    discoveredAt: now.toISOString(),
    occupiedAt: null,
    effects: { woodOutputMultiplier: 0.08 },
    summary: '北方部落已经在这里建立营帐。',
    lastBattle: null,
  });

  const start = TerritoryService.startConquest(state, 'tribe_site', {
    troopType: 'unavailable',
    leader: 'unavailable',
    soldiers: 600,
  }, now);

  assert.equal(start.success, true);
  assert.equal(start.mission.mode, 'conquest');
  assert.deepEqual(start.mission.expedition, {
    troopType: 'unavailable',
    leader: 'unavailable',
    soldiers: 600,
  });

  const mission = state.warMissions.find((item) => item.id === start.mission.id);
  mission.completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  const claim = TerritoryService.claimConquest(state, 'tribe_site', now);

  assert.equal(claim.success, true);
  assert.equal(claim.outcome, 'success');
  assert.equal(claim.battleReport.system, 'attribute-auto-battle-v2');
  assert.equal(claim.battleReport.moraleEffectEnabled, false);
  assert.ok(claim.battleReport.experience.total > 0);
  assert.ok(claim.casualties > 0);
  assert.ok(claim.casualties < 600);
  assert.equal(state.territories.find((item) => item.id === 'tribe_site').owner, 'player');
});

test('名人领队出征会生成自动回合战报并记录到地点', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  addFamousLeader(state);
  addDiscoveredTribeSite(state, {
    id: 'leader_battle_site',
    naturalName: '林地部落',
    defense: 500,
    recommendedSoldiers: 500,
  });
  gameStateService.normalizeState(state);

  const start = TerritoryService.startConquest(state, 'leader_battle_site', {
    troopType: 'unavailable',
    leader: 'fp_luxiao',
    soldiers: 500,
  }, now);

  assert.equal(start.success, true);
  assert.equal(start.mission.expedition.leader, 'fp_luxiao');
  assert.equal(start.mission.expedition.leaderSnapshot.name, '陆骁');

  const mission = state.warMissions.find((item) => item.id === start.mission.id);
  mission.completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  const claim = TerritoryService.claimConquest(state, 'leader_battle_site', now);
  const site = state.territories.find((item) => item.id === 'leader_battle_site');

  assert.equal(claim.success, true);
  assert.equal(claim.outcome, 'success');
  assert.equal(site.lastBattle.mode, 'conquest');
  assert.equal(site.lastBattle.leaderId, 'fp_luxiao');
  assert.equal(site.lastBattle.leaderName, '陆骁');
  assert.equal(site.lastBattle.report.mode, 'auto-round');
  assert.equal(site.lastBattle.report.attacker.leaderName, '陆骁');
  assert.equal(site.lastBattle.report.system, 'attribute-auto-battle-v2');
  assert.equal(site.lastBattle.report.ruleVersion, 'battle-rules-v2');
  assert.equal(site.lastBattle.report.turns[0].actor, 'attacker');
  assert.equal(site.lastBattle.report.turns[0].action, 'skill');
  assert.equal(site.lastBattle.report.turns[0].skillName, '血刃破阵');
  assert.equal(site.lastBattle.report.turns[0].presentation.cutIn, true);
  assert.ok(site.lastBattle.report.turns[0].actorPortrait);
  assert.equal(site.lastBattle.report.turns[0].damageType, 'blade');
  assert.ok(site.lastBattle.report.turns.some((turn) => turn.action === 'basicAttack'));
  assert.equal(site.lastBattle.report.skillRules.openingSkill, false);
  assert.equal(site.lastBattle.report.skillRules.castPolicy, 'conditional');
  assert.equal(site.lastBattle.report.skillRules.speedSortPerRound, true);
  assert.equal(site.lastBattle.report.skillRules.randomTriggerEnabled, false);
  assert.ok(site.lastBattle.report.preparation[0].lines.some((line) => line.includes('士气影响：未启用')));
  assert.ok(site.lastBattle.report.detailEvents[0].lines.some((line) => line.includes('开始行动')));
  assert.equal(site.lastBattle.report.visual.map.background, 'assets/art/battle/battlefield-forest-camp.png');
  assert.ok(site.lastBattle.report.attacker.speed >= site.lastBattle.report.defender.speed);
  assert.ok(site.lastBattle.report.rounds.length >= 1);
  assert.equal(site.lastBattle.report.attacker.groupsStart.length, 5);
  assert.ok(site.lastBattle.report.summary.includes('陆骁'));
});

test('战斗报告按精确兵力结算但按 100 兵向上取整显示小人组', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  addFamousLeader(state);
  addDiscoveredTribeSite(state, {
    id: 'visual_group_site',
    naturalName: '林地部落',
    defense: 500,
    recommendedSoldiers: 500,
  });
  state.military.soldiers = 700;
  gameStateService.normalizeState(state);

  const start = TerritoryService.startConquest(state, 'visual_group_site', {
    troopType: 'unavailable',
    leader: 'fp_luxiao',
    soldiers: 501,
  }, now);
  const mission = state.warMissions.find((item) => item.id === start.mission.id);
  mission.completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  const claim = TerritoryService.claimConquest(state, 'visual_group_site', now);

  assert.equal(claim.success, true);
  assert.equal(claim.battleReport.attacker.soldiersStart, 501);
  assert.equal(claim.battleReport.attacker.groupsStart.length, 6);
  assert.equal(claim.battleReport.attacker.groupsStart[5].soldiers, 1);
  assert.ok(claim.battleReport.turns.length >= 1);
});

test('有主地点征服胜利后暂不生成战后归附候选名人', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  addFamousLeader(state);
  addDiscoveredTribeSite(state, {
    id: 'post_war_site',
    naturalName: '北风营帐',
    defense: 500,
    recommendedSoldiers: 500,
  });
  gameStateService.normalizeState(state);

  const start = TerritoryService.startConquest(state, 'post_war_site', {
    troopType: 'unavailable',
    leader: 'fp_luxiao',
    soldiers: 500,
  }, now);
  const mission = state.warMissions.find((item) => item.id === start.mission.id);
  mission.completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  const claim = TerritoryService.claimConquest(state, 'post_war_site', now);

  assert.equal(claim.success, true);
  assert.equal(claim.outcome, 'success');
  assert.equal(claim.postWarCandidate, null);
  assert.equal(state.famousPersonState.candidates.length, 0);
  assert.doesNotMatch(claim.message, /战后有人愿意投奔/);
});

test('战后候选队列已满时不阻塞征服结算', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  addFamousLeader(state);
  addDiscoveredTribeSite(state, {
    id: 'full_candidate_site',
    naturalName: '山脚部族',
    defense: 500,
    recommendedSoldiers: 500,
  });
  for (let i = 0; i < FamousPersonService.MAX_CANDIDATES; i += 1) {
    state.famousPersonState.candidates.push(FamousPersonService.createFamousPersonCandidate(
      state,
      { source: 'seek' },
      new Date(`2026-05-17T07:0${i}:00.000Z`),
      () => 0.1,
    ));
  }
  gameStateService.normalizeState(state);

  const start = TerritoryService.startConquest(state, 'full_candidate_site', {
    troopType: 'unavailable',
    leader: 'fp_luxiao',
    soldiers: 500,
  }, now);
  const mission = state.warMissions.find((item) => item.id === start.mission.id);
  mission.completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  const claim = TerritoryService.claimConquest(state, 'full_candidate_site', now);

  assert.equal(claim.success, true);
  assert.equal(claim.outcome, 'success');
  assert.equal(claim.postWarCandidate, null);
  assert.equal(state.famousPersonState.candidates.length, FamousPersonService.MAX_CANDIDATES);
  assert.equal(state.territories.find((item) => item.id === 'full_candidate_site').owner, 'player');
});

test('分城可以对共享情报目标发起军事行动并使用全势力兵力', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  addOccupiedSubCity(state, { x: 2, y: 0 });
  addDiscoveredTribeSite(state, { x: -1, y: 0 });
  const normalized = gameStateService.normalizeState(state);
  normalized.cities.capital.military.soldiers = 600;
  normalized.cities.site_east.military.soldiers = 0;
  CityService.setActiveCity(normalized, 'site_east');

  const start = TerritoryService.startConquest(normalized, 'tribe_target', { soldiers: 500 }, now);
  const territoryState = TerritoryService.getClientTerritoryState(normalized, now);

  assert.equal(start.success, true);
  assert.equal(start.mission.sourceCityId, 'capital');
  assert.deepEqual(start.mission.soldierAllocations, [{ cityId: 'capital', soldiers: 500 }]);
  assert.equal(TerritoryService.getAvailableSoldiers(normalized), 100);
  assert.equal(territoryState.availableSoldiers, 100);
  assert.equal(territoryState.soldiersOnMission, 500);
  assert.equal(territoryState.territories.find((item) => item.id === 'tribe_target').mission.sourceCityId, 'capital');
});

test('占领任务会向前端提供行军总时长和剩余时间', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');

  const scout = TerritoryService.startScout(state, 'e', now);
  state.warMissions[0].completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  const discovered = TerritoryService.claimScout(state, scout.mission.id, now, createSequenceRandom([0.1, 0.9, 0.5])).site;

  const conquest = TerritoryService.startConquest(state, discovered.id, discovered.recommendedSoldiers, now);
  const territoryState = TerritoryService.getClientTerritoryState(state, new Date(now.getTime() + 30 * 1000));
  const mission = territoryState.territories.find((item) => item.id === discovered.id).mission;

  assert.equal(conquest.success, true);
  assert.equal(mission.durationSeconds, 120);
  assert.equal(mission.remainingSeconds, 90);
  assert.equal(territoryState.territories.find((item) => item.id === discovered.id).occupationMode, 'settlement');
});

test('城市命名后第二块领土会提示命名势力', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  const scout = TerritoryService.startScout(state, 'e', now);
  state.warMissions[0].completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  const site = TerritoryService.claimScout(state, scout.mission.id, now, createSequenceRandom([0.1, 0.9, 0.5])).site;
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

test('占领世界点效果只作用于对应分城，不再汇总到主城', () => {
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
    defense: 400,
    recommendedSoldiers: 400,
    art: 'assets/art/world-site-town-cutout.png',
    effects: { foodOutputMultiplier: 0.05, woodOutputMultiplier: 0.08, knowledgeOutputMultiplier: 0.06, threatDefense: 2 },
  });

  const normalized = gameStateService.normalizeState(state);

  assert.equal(normalized.activeCityId, 'capital');
  assert.equal(normalized.buildingEffects.territoryFoodOutputBonus, 0);
  assert.equal(normalized.buildingEffects.territoryWoodOutputBonus, 0);
  assert.equal(normalized.buildingEffects.territoryKnowledgeOutputBonus, 0);
  assert.equal(normalized.buildingEffects.threatDefense, 2);
  assert.equal(normalized.cities.site_food.buildingEffects.territoryFoodOutputBonus, 0.05);
  assert.equal(normalized.cities.site_food.buildingEffects.territoryWoodOutputBonus, 0.08);
  assert.equal(normalized.cities.site_food.buildingEffects.territoryKnowledgeOutputBonus, 0.06);
  assert.equal(normalized.cities.site_food.buildingEffects.threatDefense, 2);
});

test('侦察结果会在连续落空时逐步提高出地点概率', () => {
  const state = createClassicalState();
  const baseTime = new Date('2026-05-17T08:00:00.000Z');

  const first = TerritoryService.startScout(state, 'n', baseTime);
  state.warMissions.find((mission) => mission.id === first.mission.id).completesAt = baseTime.toISOString();
  TerritoryService.updateMissionReadiness(state, baseTime);
  const firstClaim = TerritoryService.claimScout(state, first.mission.id, baseTime, () => 0.95);
  assert.equal(firstClaim.site, null);
  assert.equal(state.scoutState.emptyStreak, 1);

  const secondAt = new Date('2026-05-17T08:02:00.000Z');
  const second = TerritoryService.startScout(state, 'e', secondAt);
  state.warMissions.find((mission) => mission.id === second.mission.id).completesAt = secondAt.toISOString();
  TerritoryService.updateMissionReadiness(state, secondAt);
  const secondClaim = TerritoryService.claimScout(state, second.mission.id, secondAt, () => 0.5);
  assert.equal(secondClaim.site, null);
  assert.equal(state.scoutState.emptyStreak, 2);

  const thirdAt = new Date('2026-05-17T08:04:00.000Z');
  const third = TerritoryService.startScout(state, 's', thirdAt);
  state.warMissions.find((mission) => mission.id === third.mission.id).completesAt = thirdAt.toISOString();
  TerritoryService.updateMissionReadiness(state, thirdAt);
  const thirdClaim = TerritoryService.claimScout(state, third.mission.id, thirdAt, () => 0.5);
  assert.equal(thirdClaim.success, true);
  assert.ok(thirdClaim.site);
  assert.equal(state.scoutState.emptyStreak, 0);
});

test('连续多次没有出地点后会触发地点保底', () => {
  const state = createClassicalState();
  const baseTime = new Date('2026-05-17T08:00:00.000Z');
  const steps = [
    ['n', new Date(baseTime)],
    ['e', new Date('2026-05-17T08:02:00.000Z')],
    ['s', new Date('2026-05-17T08:04:00.000Z')],
    ['w', new Date('2026-05-17T08:06:00.000Z')],
    ['ne', new Date('2026-05-17T08:08:00.000Z')],
  ];
  const results = [];

  steps.forEach(([direction, at]) => {
    const started = TerritoryService.startScout(state, direction, at);
    const mission = state.warMissions.find((item) => item.id === started.mission.id);
    mission.completesAt = at.toISOString();
    TerritoryService.updateMissionReadiness(state, at);
    results.push(TerritoryService.claimScout(state, started.mission.id, at, () => 0.99));
  });

  assert.equal(results[0].site, null);
  assert.equal(results[1].site, null);
  assert.equal(results[2].site, null);
  assert.equal(results[3].site, null);
  assert.ok(results[4].site);
  assert.equal(state.scoutState.emptyStreak, 0);
});

test('距离首都 1 格时也有小概率直接发现有主的部落营地', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');

  const scout = TerritoryService.startScout(state, 'n', now);
  state.warMissions[0].completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  const claim = TerritoryService.claimScout(state, scout.mission.id, now, createSequenceRandom([0.1, 0.05, 0.1]));

  assert.equal(claim.success, true);
  assert.ok(claim.site);
  assert.equal(claim.site.owner, 'tribe');
  assert.equal(claim.site.type, 'camp');
});

test('距离越远越容易刷出有主地点', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');

  const nearScout = TerritoryService.startScout(state, 'e', now);
  state.warMissions[0].completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  const nearClaim = TerritoryService.claimScout(state, nearScout.mission.id, now, createSequenceRandom([0.1, 0.2, 0.3])).site;

  state.scoutedCoordinates.push({ x: 2, y: 0, result: 'empty', siteId: null, scoutedAt: now.toISOString() });
  const farTime = new Date('2026-05-17T08:03:00.000Z');
  const farScout = TerritoryService.startScout(state, 'e', farTime);
  const farMission = state.warMissions.find((mission) => mission.id === farScout.mission.id);
  farMission.completesAt = farTime.toISOString();
  TerritoryService.updateMissionReadiness(state, farTime);
  const farClaim = TerritoryService.claimScout(state, farScout.mission.id, farTime, createSequenceRandom([0.1, 0.2, 0.5])).site;

  assert.equal(farScout.mission.targetX, 3);
  assert.ok(['neutral', 'tribe'].includes(nearClaim.owner));
  assert.equal(farClaim.owner, 'city_state');
  assert.equal(farClaim.type, 'city');
});

test('有主地点会细分为部落、城邦和遗迹守军', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');

  const tribeMission = { id: 'scout_tribe', kind: 'scout', direction: 'n', targetX: 0, targetY: -1, startedAt: now.toISOString(), completesAt: now.toISOString(), status: 'ready' };
  const cityMission = { id: 'scout_city', kind: 'scout', direction: 'e', targetX: 3, targetY: 0, startedAt: now.toISOString(), completesAt: now.toISOString(), status: 'ready' };
  const ruinsMission = { id: 'scout_ruins', kind: 'scout', direction: 's', targetX: 0, targetY: 3, startedAt: now.toISOString(), completesAt: now.toISOString(), status: 'ready' };

  state.warMissions.push(tribeMission, cityMission, ruinsMission);

  const tribe = TerritoryService.claimScout(state, 'scout_tribe', now, createSequenceRandom([0.1, 0.01, 0.01])).site;
  const city = TerritoryService.claimScout(state, 'scout_city', now, createSequenceRandom([0.1, 0.2, 0.3])).site;
  const ruins = TerritoryService.claimScout(state, 'scout_ruins', now, createSequenceRandom([0.1, 0.2, 0.95])).site;

  assert.equal(tribe.owner, 'tribe');
  assert.equal(city.owner, 'city_state');
  assert.equal(ruins.owner, 'ruin_guardians');
  assert.equal(ruins.type, 'ruins');
});

test('连续多次发现无主地点后，下一个地点会保底转为有主', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');

  const missions = [
    { id: 'scout_a', kind: 'scout', direction: 'n', targetX: 0, targetY: -1, startedAt: now.toISOString(), completesAt: now.toISOString(), status: 'ready' },
    { id: 'scout_b', kind: 'scout', direction: 'e', targetX: 1, targetY: 0, startedAt: now.toISOString(), completesAt: now.toISOString(), status: 'ready' },
    { id: 'scout_c', kind: 'scout', direction: 's', targetX: 0, targetY: 1, startedAt: now.toISOString(), completesAt: now.toISOString(), status: 'ready' },
    { id: 'scout_d', kind: 'scout', direction: 'w', targetX: -1, targetY: 0, startedAt: now.toISOString(), completesAt: now.toISOString(), status: 'ready' },
  ];
  state.warMissions.push(...missions);

  const first = TerritoryService.claimScout(state, 'scout_a', now, createSequenceRandom([0.1, 0.9, 0.1])).site;
  const second = TerritoryService.claimScout(state, 'scout_b', now, createSequenceRandom([0.1, 0.9, 0.1])).site;
  const third = TerritoryService.claimScout(state, 'scout_c', now, createSequenceRandom([0.1, 0.9, 0.1])).site;
  const fourth = TerritoryService.claimScout(state, 'scout_d', now, createSequenceRandom([0.1, 0.95, 0.2])).site;

  assert.equal(first.owner, 'neutral');
  assert.equal(second.owner, 'neutral');
  assert.equal(third.owner, 'neutral');
  assert.equal(third.owner, 'neutral');
  assert.notEqual(fourth.owner, 'neutral');
  assert.equal(state.scoutState.neutralSiteStreak, 0);
});
