const test = require('node:test');
const assert = require('node:assert/strict');

const gameStateService = require('../services/GameStateService');
const CityService = require('../services/CityService');
const TerritoryService = require('../services/TerritoryService');
const FamousPersonService = require('../services/FamousPersonService');
const WorldMapService = require('../services/WorldMapService');

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

function completeScout(state, scout, now, randomValues = [0.1, 0.9, 0.5]) {
  const mission = state.warMissions.find((item) => item.id === scout.mission.id);
  const completedAt = new Date(now.getTime() + TerritoryService.SCOUT_DURATION_MS);
  TerritoryService.updateMissionReadiness(state, completedAt, createSequenceRandom(randomValues));
  return TerritoryService.claimScout(state, mission.id, completedAt, createSequenceRandom(randomValues));
}

function discoverFirstSite(state, direction = 'e', now = new Date('2026-05-17T08:00:00.000Z'), randomValues = [0.1, 0.9, 0.5]) {
  let currentTime = now;
  let lastClaim = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const scout = TerritoryService.startScout(state, direction, currentTime);
    assert.equal(scout.success, true);
    lastClaim = completeScout(state, scout, currentTime, randomValues);
    if (lastClaim.site) return { scout, claim: lastClaim, at: currentTime };
    currentTime = new Date(currentTime.getTime() + TerritoryService.SCOUT_DURATION_MS + 1000);
  }
  assert.fail(`expected ${direction} scout to discover a site`);
  return { scout: null, claim: lastClaim, at: currentTime };
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
    type: options.type || 'camp',
    owner: options.owner || 'tribe',
    status: 'discovered',
    scale: options.scale || 2,
    threat: options.threat || 4,
    defense: options.defense || 500,
    recommendedSoldiers: options.recommendedSoldiers || 500,
    art: options.art || 'assets/art/world-site-camp-cutout.png',
    visualOffset: { x: 0, y: 0 },
    terrain: options.terrain,
    mapTerrain: options.mapTerrain,
    discoveredAt: '2026-05-17T08:04:00.000Z',
    occupiedAt: null,
    effects: options.effects || { woodOutputMultiplier: 0.08 },
    summary: '东境外的部落营地。',
    lastBattle: null,
  });
}

function pushReadyScoutMission(state, overrides = {}) {
  const now = overrides.now || new Date('2026-05-17T08:00:00.000Z');
  const targetX = Number.isFinite(overrides.targetX) ? overrides.targetX : 0;
  const targetY = Number.isFinite(overrides.targetY) ? overrides.targetY : 0;
  const originX = Number.isFinite(overrides.originX) ? overrides.originX : 0;
  const originY = Number.isFinite(overrides.originY) ? overrides.originY : 0;
  const mission = {
    id: overrides.id || `scout_${targetX}_${targetY}`,
    kind: 'scout',
    direction: overrides.direction || 'e',
    originX,
    originY,
    targetX,
    targetY,
    scoutDistance: Number.isFinite(overrides.scoutDistance)
      ? overrides.scoutDistance
      : Math.max(Math.abs(targetX - originX), Math.abs(targetY - originY)),
    startedAt: now.toISOString(),
    completesAt: now.toISOString(),
    status: 'ready',
  };
  if (Array.isArray(overrides.revealArea) && overrides.revealArea.length) {
    mission.revealArea = overrides.revealArea.map((coord, index) => ({
      q: coord.q,
      r: coord.r,
      step: coord.step || index + 1,
      kind: coord.kind || 'main',
      tileId: coord.tileId || WorldMapService.getTileId(coord.q, coord.r),
      revealed: coord.revealed !== false,
    }));
    mission.route = mission.revealArea
      .filter((coord) => coord.kind === 'main')
      .map((coord) => ({
        q: coord.q,
        r: coord.r,
        step: coord.step,
        tileId: coord.tileId,
        revealed: coord.revealed,
      }));
    mission.revealAreaSource = 'directional-route-v1';
    mission.revealedTileIds = mission.revealArea
      .filter((coord) => coord.revealed)
      .map((coord) => coord.tileId);
  }
  state.warMissions.push(mission);
  return mission;
}

function pushReadySingleTileScout(state, options = {}) {
  const q = options.q;
  const r = options.r;
  const now = options.now || new Date('2026-05-17T08:00:00.000Z');
  const coord = {
    q,
    r,
    step: 1,
    kind: 'main',
    tileId: WorldMapService.getTileId(q, r),
    revealed: true,
  };
  const mission = pushReadyScoutMission(state, {
    id: options.id || `scout_${q}_${r}`,
    direction: options.direction || 'e',
    targetX: q,
    targetY: r,
    scoutDistance: Number.isFinite(options.scoutDistance)
      ? options.scoutDistance
      : Math.max(Math.abs(q), Math.abs(r)),
    now,
    revealArea: [coord],
  });
  WorldMapService.revealScoutArea(state, mission.revealArea, now);
  return mission;
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

test('legacy scouted coordinates remain a target compatibility source', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  state.scoutedCoordinates = [{ x: 1, y: 0, result: 'empty', siteId: null, scoutedAt: now.toISOString() }];

  const start = TerritoryService.startScout(state, 'e', now);

  assert.equal(start.success, true);
  assert.equal(start.mission.targetX, 2);
  assert.equal(start.mission.targetY, 0);
  assert.equal(state.scoutedCoordinates.length, 1);
});

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
  assert.ok(territoryState.worldMap);
  const capitalTile = territoryState.worldMap.tiles.find((tile) => tile.id === 'tile_0_0');
  assert.equal(capitalTile.terrain, 'capital');
  assert.equal(capitalTile.siteId, 'capital');
});

test('侦察前沿会先解锁区域，水面或贴近首都的位置不会生成地点', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');

  const start = TerritoryService.startScout(state, 'e', now);
  assert.equal(start.success, true);
  assert.equal(start.mission.targetX, 1);
  assert.equal(start.mission.targetY, 0);
  assert.equal(start.mission.actionPoints, TerritoryService.SCOUT_ACTION_POINTS);
  assert.equal(start.mission.actionPointsRemaining, TerritoryService.SCOUT_ACTION_POINTS);
  assert.equal(start.mission.route.length, TerritoryService.SCOUT_ACTION_POINTS);
  assert.ok(start.mission.revealArea.length >= 4);
  assert.ok(start.mission.revealArea.length <= WorldMapService.SCOUT_REVEAL_TILE_LIMIT);
  assert.deepEqual(
    start.mission.revealArea.filter((coord) => coord.kind === 'main').map((coord) => [coord.q, coord.r]),
    start.mission.route.slice(0, WorldMapService.SCOUT_REVEAL_MAIN_LIMIT).map((step) => [step.q, step.r]),
  );
  assert.deepEqual(start.mission.route[0], { q: 1, r: 0, step: 1, tileId: 'tile_1_0', revealed: false });

  const claim = completeScout(state, start, now, [0.95]);

  assert.equal(claim.success, true);
  assert.equal(claim.site, null);
  assert.equal(state.scoutReports.length, 1);
  assert.equal(state.scoutReports[0].siteId, null);
  assert.match(state.scoutReports[0].text, /东方/);
  assert.equal(state.scoutReports[0].tileId, 'tile_3_0');
  assert.equal(state.scoutReports[0].mapTerrain, WorldMapService.chooseTerrain(state.worldMap.seed, 3, 0));
  assert.deepEqual(state.scoutReports[0].revealArea.map((coord) => coord.tileId).toSorted(), start.mission.revealArea.map((coord) => coord.tileId).toSorted());
  assert.equal(state.scoutedCoordinates.some((item) => item.x === 1 && item.y === 0), false);
  assert.equal(state.scoutState.areas.find((area) => area.missionId === start.mission.id)?.result, 'empty');
  const territoryState = TerritoryService.getClientTerritoryState(state, new Date(now.getTime() + TerritoryService.SCOUT_DURATION_MS));
  assert.equal(territoryState.scoutAreas.length, 1);
  assert.equal(territoryState.scoutAreas[0].missionId, start.mission.id);
  assert.deepEqual(territoryState.scoutAreas[0].tileIds, start.mission.revealArea.map((coord) => coord.tileId).toSorted());
  assert.equal(state.worldMap.tiles.length, start.mission.revealArea.length + 1);
});

test('scout target outcome is fixed only when the returned report is claimed', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  state.scoutedCoordinates = Array.from({ length: 6 }, (_, index) => ({
    x: 0,
    y: -(index + 1),
    result: 'empty',
    siteId: null,
    scoutedAt: now.toISOString(),
  }));
  const scout = TerritoryService.startScout(state, 'n', now);
  const reportCountBeforeClaim = state.scoutReports.length;
  const territoryCountBeforeClaim = state.territories.length;
  assert.equal(scout.success, true);
  assert.equal(scout.mission.targetX, 0);
  assert.equal(scout.mission.targetY, -7);

  const completedAt = new Date(now.getTime() + TerritoryService.SCOUT_DURATION_MS);
  TerritoryService.updateMissionReadiness(state, completedAt, createSequenceRandom([0.1, 0.9, 0.5]));

  const mission = state.warMissions.find((item) => item.id === scout.mission.id);
  assert.equal(mission.status, 'ready');
  assert.equal(mission.resolvedTarget, false);
  assert.equal(mission.result, null);
  assert.equal(mission.siteId, null);
  assert.equal(state.scoutReports.length, reportCountBeforeClaim);
  assert.equal(state.territories.length, territoryCountBeforeClaim);
  assert.equal(mission.revealArea.every((coord) => state.worldMap.tiles.some((tile) => tile.id === coord.tileId)), true);
  assert.equal(state.worldMap.tiles.some((tile) => tile.id === `tile_${mission.targetX}_${mission.targetY}`), false);

  const claim = TerritoryService.claimScout(state, mission.id, completedAt, createSequenceRandom([0.1, 0.9, 0.5]));

  assert.equal(claim.success, true);
  assert.ok(claim.site);
  assert.equal(claim.site.mapTerrain, WorldMapService.chooseTerrain(state.worldMap.seed, claim.site.x, claim.site.y));
  assert.equal(claim.site.terrain, 'plains');
  assert.equal(state.scoutReports.at(-1).siteId, claim.site.id);
  assert.equal(state.scoutReports.at(-1).tileId, WorldMapService.getTileId(claim.site.x, claim.site.y));
  assert.equal(state.scoutReports.at(-1).mapTerrain, claim.site.mapTerrain);
  assert.equal(state.scoutReports.at(-1).terrain, claim.site.terrain);
  assert.deepEqual(state.scoutReports.at(-1).tile, {
    id: WorldMapService.getTileId(claim.site.x, claim.site.y),
    q: claim.site.x,
    r: claim.site.y,
    terrain: claim.site.mapTerrain,
  });
  assert.deepEqual(state.scoutReports.at(-1).revealArea.map((coord) => coord.tileId).toSorted(), mission.revealArea.map((coord) => coord.tileId).toSorted());
  assert.ok(state.territories.some((territory) => territory.id === claim.site.id));
  assert.equal(state.scoutState.areas.at(-1).missionId, mission.id);
  assert.equal(state.scoutState.areas.at(-1).result, 'site');
});

test('scout site outcome selects the best valid tile inside the revealed area', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  const mouth = WorldMapService.getWorldWaterFeatures(state.worldMap.seed).river;
  pushReadyScoutMission(state, {
    id: 'scout_coast_area',
    direction: 'e',
    targetX: mouth.q,
    targetY: mouth.r,
    now,
    revealArea: [
      { q: mouth.q, r: mouth.r, step: 1, kind: 'main', tileId: WorldMapService.getTileId(mouth.q, mouth.r), revealed: true },
      { q: 8, r: 0, step: 1, kind: 'branch', tileId: 'tile_8_0', revealed: true },
    ],
  });
  WorldMapService.revealScoutArea(state, state.warMissions.at(-1).revealArea, now);

  const claim = TerritoryService.claimScout(state, 'scout_coast_area', now, createSequenceRandom([0.1, 0.9, 0.5]));

  assert.equal(claim.success, true);
  assert.ok(claim.site);
  assert.notDeepEqual({ x: claim.site.x, y: claim.site.y }, { x: mouth.q, y: mouth.r });
  assert.notEqual(state.worldMap.tiles.find((tile) => tile.id === WorldMapService.getTileId(mouth.q, mouth.r)).siteId, claim.site.id);
  assert.equal(state.worldMap.tiles.find((tile) => tile.id === `tile_${claim.site.x}_${claim.site.y}`).siteId, claim.site.id);
  assert.equal(WorldMapService.canPlaceSiteOnTerrain(state.worldMap.seed, claim.site.x, claim.site.y), true);
});

test('scout site outcome keeps cities separated inside a revealed area', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  addDiscoveredTribeSite(state, { id: 'existing_near_site', x: 5, y: 0 });
  state.warMissions.push({
    id: 'scout_spacing_area',
    kind: 'scout',
    direction: 'e',
    originX: 0,
    originY: 0,
    targetX: 6,
    targetY: 0,
    scoutDistance: 6,
    startedAt: now.toISOString(),
    completesAt: now.toISOString(),
    status: 'ready',
    revealArea: [
      { q: 6, r: 0, step: 1, kind: 'main', tileId: 'tile_6_0', revealed: true },
      { q: 9, r: 3, step: 1, kind: 'branch', tileId: 'tile_9_3', revealed: true },
    ],
    revealAreaSource: 'directional-route-v1',
    revealedTileIds: ['tile_6_0', 'tile_9_3'],
  });
  WorldMapService.revealScoutArea(state, state.warMissions.at(-1).revealArea, now);

  const claim = TerritoryService.claimScout(state, 'scout_spacing_area', now, createSequenceRandom([0.1, 0.9, 0.5]));

  assert.equal(claim.success, true);
  assert.ok(claim.site);
  assert.deepEqual({ x: claim.site.x, y: claim.site.y }, { x: 9, y: 3 });
});

test('scout site candidate scoring prefers less crowded legal tiles', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  addDiscoveredTribeSite(state, { id: 'existing_spacing_anchor', x: 5, y: 0 });
  pushReadyScoutMission(state, {
    id: 'scout_spacing_score',
    direction: 'e',
    targetX: 8,
    targetY: 0,
    scoutDistance: 8,
    now,
    revealArea: [
      { q: 8, r: 0, step: 1, kind: 'main', tileId: 'tile_8_0', revealed: true },
      { q: 9, r: 0, step: 1, kind: 'branch', tileId: 'tile_9_0', revealed: true },
    ],
  });
  WorldMapService.revealScoutArea(state, state.warMissions.at(-1).revealArea, now);

  assert.equal(WorldMapService.chooseTerrain(state.worldMap.seed, 8, 0), 'plains');
  assert.equal(WorldMapService.chooseTerrain(state.worldMap.seed, 9, 0), 'plains');

  const claim = TerritoryService.claimScout(state, 'scout_spacing_score', now, createSequenceRandom([0.1, 0.9, 0.5]));

  assert.equal(claim.success, true);
  assert.ok(claim.site);
  assert.deepEqual({ x: claim.site.x, y: claim.site.y }, { x: 9, y: 0 });
  assert.equal(state.worldMap.tiles.find((tile) => tile.id === 'tile_8_0').siteId, null);
  assert.equal(state.worldMap.tiles.find((tile) => tile.id === 'tile_9_0').siteId, claim.site.id);
});

test('directional scout area ignores legacy empty target when another revealed tile can host a site', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  state.scoutedCoordinates = [{
    x: 6,
    y: 0,
    result: 'empty',
    siteId: null,
    scoutedAt: now.toISOString(),
  }];
  pushReadyScoutMission(state, {
    id: 'scout_area_legacy_empty',
    direction: 'e',
    targetX: 6,
    targetY: 0,
    scoutDistance: 6,
    now,
    revealArea: [
      { q: 6, r: 0, step: 1, kind: 'main', tileId: 'tile_6_0', revealed: true },
      { q: 9, r: 0, step: 1, kind: 'branch', tileId: 'tile_9_0', revealed: true },
    ],
  });
  WorldMapService.revealScoutArea(state, state.warMissions.at(-1).revealArea, now);

  const claim = TerritoryService.claimScout(state, 'scout_area_legacy_empty', now, createSequenceRandom([0.1, 0.9, 0.5]));

  assert.equal(claim.success, true);
  assert.ok(claim.site);
  assert.notDeepEqual({ x: claim.site.x, y: claim.site.y }, { x: 6, y: 0 });
  assert.equal(state.scoutReports.at(-1).tileId, WorldMapService.getTileId(claim.site.x, claim.site.y));
  assert.deepEqual(state.scoutReports.at(-1).revealArea.map((coord) => coord.tileId).toSorted(), ['tile_6_0', 'tile_9_0']);
  assert.equal(state.scoutedCoordinates.find((item) => item.x === 6 && item.y === 0)?.result, 'empty');
});

test('scout missions reveal world map tiles over time and record a trail', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  const scout = TerritoryService.startScout(state, 'e', now);

  TerritoryService.updateMissionReadiness(state, new Date(now.getTime() + 13 * 1000));

  const mission = state.warMissions.find((item) => item.id === scout.mission.id);
  assert.equal(mission.status, 'active');
  assert.ok(mission.revealedTileIds.length >= 2);
  assert.ok(mission.revealArea.filter((coord) => coord.step <= 2).every((coord) => coord.revealed));
  assert.ok(mission.revealArea.filter((coord) => coord.step >= 3).some((coord) => !coord.revealed));
  assert.ok(state.worldMap.tiles.some((tile) => tile.id === 'tile_1_0'));
  assert.ok(state.worldMap.tiles.some((tile) => tile.id === 'tile_2_0'));
  assert.equal(state.worldMap.tiles.some((tile) => tile.id === 'tile_4_0'), false);
  assert.deepEqual(state.worldMap.scoutTrails.find((trail) => trail.missionId === mission.id).returned, false);

  TerritoryService.updateMissionReadiness(state, new Date(now.getTime() + 60 * 1000));

  assert.equal(mission.status, 'ready');
  assert.equal(mission.actionPointsRemaining, 0);
  assert.equal(mission.revealedTileIds.length, mission.revealArea.length);
  assert.ok(mission.revealArea.every((coord) => coord.revealed));
  assert.equal(state.worldMap.tiles.some((tile) => tile.id === 'tile_4_0'), false);
  assert.equal(state.worldMap.tiles.some((tile) => tile.id === 'tile_5_0'), false);
  assert.equal(state.worldMap.scoutTrails.find((trail) => trail.missionId === mission.id).returned, true);
});

test('侦察到空地后会记录区域并跳过整片已解决区域', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');

  let start = TerritoryService.startScout(state, 'w', now);
  const firstAreaIds = start.mission.revealArea.map((coord) => coord.tileId);
  const firstClaim = completeScout(state, start, now, [0.95]);

  assert.equal(firstClaim.success, true);
  assert.equal(firstClaim.site, null);
  assert.match(firstClaim.report.text, /未发现可建立据点或占领的目标/);
  assert.equal(state.scoutedCoordinates.some((item) => item.x === -1 && item.y === 0), false);
  const areaRecord = state.scoutState.areas.find((area) => area.missionId === start.mission.id);
  assert.equal(areaRecord.result, 'empty');
  assert.deepEqual(areaRecord.tileIds, firstAreaIds.toSorted());

  start = TerritoryService.startScout(state, 'w', new Date('2026-05-17T08:02:00.000Z'));
  assert.equal(start.success, true);
  assert.equal(start.mission.targetX, -8);
  assert.equal(start.mission.targetY, 0);
  assert.ok(start.mission.revealArea.some((coord) => !areaRecord.tileIds.includes(coord.tileId)));
  assert.deepEqual(start.mission.route.map((step) => [step.q, step.r]), [[-4, 0], [-5, 0], [-6, 0], [-7, 0], [-8, 0]]);
});

test('scout target selection skips an already resolved reveal area', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');

  const first = TerritoryService.startScout(state, 'e', now);
  const firstAreaIds = new Set(first.mission.revealArea.map((coord) => coord.tileId));
  const firstClaim = completeScout(state, first, now, [0.95]);

  assert.equal(firstClaim.success, true);
  assert.equal(firstClaim.site, null);

  const second = TerritoryService.startScout(state, 'e', new Date('2026-05-17T08:02:00.000Z'));

  assert.equal(second.success, true);
  assert.equal(second.mission.targetX, 8);
  assert.equal(second.mission.targetY, 0);
  assert.ok(second.mission.revealArea.some((coord) => !firstAreaIds.has(coord.tileId)));
  assert.deepEqual(second.mission.route.map((step) => [step.q, step.r]), [[4, 0], [5, 0], [6, 0], [7, 0], [8, 0]]);
});

test('敌对据点会稳定生成守军名人，归一化后继续保留', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');

  const claim = discoverFirstSite(state, 'e', now, [0.1, 0.1, 0.01]).claim;
  const site = claim.site;
  const firstLeader = site.defenderLeader;

  assert.equal(claim.success, true);
  assert.equal(site.owner, 'tribe');
  assert.ok(firstLeader);
  assert.equal(firstLeader.source.type, 'defender');
  assert.equal(firstLeader.source.territoryId, site.id);
  assert.equal(firstLeader.abilityKit.battlePolicy, 'useBattleSkill');
  assert.equal(firstLeader.skills.length, 1);
  assert.ok(site.garrison);
  assert.equal(site.garrison.id, `garrison_${site.id}`);
  assert.equal(site.garrison.siteId, site.id);
  assert.equal(site.garrison.owner, site.owner);
  assert.equal(site.garrison.soldiers, site.defense);
  assert.equal(site.garrison.leader.id, firstLeader.id);

  const normalized = gameStateService.normalizeState(state);
  const normalizedSite = normalized.territories.find((item) => item.id === site.id);
  const normalizedLeader = normalizedSite.defenderLeader;
  assert.equal(normalizedSite.garrison.leader.id, firstLeader.id);
  assert.equal(normalizedSite.garrison.soldiers, site.defense);
  assert.equal(normalizedLeader.id, firstLeader.id);
  assert.equal(normalizedLeader.name, firstLeader.name);
  assert.equal(normalizedLeader.skills[0].id, firstLeader.skills[0].id);
});

test('客户端地点情报默认不暴露完整守将和战法', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  pushReadyScoutMission(state, { id: 'scout_intel_site', direction: 'n', targetX: 0, targetY: -6, now });
  const claim = TerritoryService.claimScout(state, 'scout_intel_site', now, createSequenceRandom([0.1, 0.01, 0.01]));
  const storedSite = state.territories.find((item) => item.id === claim.site.id);
  const territoryState = TerritoryService.getClientTerritoryState(state, now);
  const clientSite = territoryState.territories.find((item) => item.id === claim.site.id);

  assert.ok(storedSite.garrison?.leader);
  assert.equal(storedSite.defenderLeader.id, storedSite.garrison.leader.id);
  assert.equal(clientSite.intel.level, 1);
  assert.equal(clientSite.intel.knownGarrison, false);
  assert.equal(clientSite.intel.knownLeader, false);
  assert.equal(clientSite.intel.knownSkill, false);
  assert.equal(clientSite.garrison, null);
  assert.equal(clientSite.defenderLeader, null);
});

test('侦察地点 tile 保持基础情报，占领后才升级为 controlled', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  pushReadyScoutMission(state, { id: 'scout_tile_intel_site', direction: 'n', targetX: 0, targetY: -6, now });
  const claim = TerritoryService.claimScout(state, 'scout_tile_intel_site', now, createSequenceRandom([0.1, 0.01, 0.01]));
  const site = claim.site;
  const scoutedTile = state.worldMap.tiles.find((tile) => tile.id === WorldMapService.getTileId(site.x, site.y));

  assert.ok(site);
  assert.equal(scoutedTile.siteId, site.id);
  assert.equal(scoutedTile.visibility, 'scouted');
  assert.equal(scoutedTile.intel.level, 1);
  assert.equal(scoutedTile.intel.knownGarrison, false);

  const overwhelmingSoldiers = site.recommendedSoldiers + 5000;
  state.military.soldiers = Math.max(state.military.soldiers, overwhelmingSoldiers);
  if (state.cities?.capital?.military) state.cities.capital.military.soldiers = Math.max(state.cities.capital.military.soldiers || 0, overwhelmingSoldiers);
  const start = TerritoryService.startConquest(state, site.id, { soldiers: overwhelmingSoldiers }, now);
  assert.equal(start.success, true);
  const mission = state.warMissions.find((item) => item.id === start.mission.id);
  mission.completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  const conquered = TerritoryService.claimConquest(state, site.id, now);
  const controlledTile = state.worldMap.tiles.find((tile) => tile.id === WorldMapService.getTileId(site.x, site.y));

  assert.equal(conquered.success, true);
  assert.equal(conquered.outcome, 'success');
  assert.equal(controlledTile.visibility, 'controlled');
  assert.equal(controlledTile.intel.level, 4);
  assert.equal(controlledTile.intel.knownGarrison, true);
  assert.equal(controlledTile.intel.knownLeader, true);
  assert.equal(controlledTile.intel.knownSkill, true);
});

test('客户端地点情报达到等级后才暴露守军层级信息', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  pushReadyScoutMission(state, { id: 'scout_intel_levels', direction: 'n', targetX: 0, targetY: -6, now });
  const claim = TerritoryService.claimScout(state, 'scout_intel_levels', now, createSequenceRandom([0.1, 0.01, 0.01]));
  const site = state.territories.find((item) => item.id === claim.site.id);
  site.intel = { level: 3 };
  const level3Site = TerritoryService.getClientTerritoryState(state, now).territories.find((item) => item.id === site.id);
  site.intel = { level: 4 };
  const level4Site = TerritoryService.getClientTerritoryState(state, now).territories.find((item) => item.id === site.id);

  assert.equal(level3Site.intel.knownGarrison, true);
  assert.equal(level3Site.intel.knownLeader, true);
  assert.equal(level3Site.intel.knownSkill, false);
  assert.equal(level3Site.garrison.soldiers, site.garrison.soldiers);
  assert.equal(level3Site.garrison.leader.name, site.garrison.leader.name);
  assert.equal(level3Site.garrison.leader.abilityKit, null);
  assert.equal(level4Site.intel.knownSkill, true);
  assert.deepEqual(level4Site.garrison.leader.abilityKit, site.garrison.leader.abilityKit);
});

test('中立建立据点目标不会生成守军名人', () => {
  const state = createClassicalState();
  addDiscoveredTribeSite(state, {
    id: 'neutral_town',
    type: 'town',
    owner: 'neutral',
    threat: 2,
    defense: 100,
    recommendedSoldiers: 100,
  });

  const normalized = gameStateService.normalizeState(state);
  const site = normalized.territories.find((item) => item.id === 'neutral_town');

  assert.equal(site.owner, 'neutral');
  assert.equal(site.defenderLeader, null);
  assert.equal(site.garrison, null);
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
  state.worldMap = {
    ...state.worldMap,
    version: 3,
    tiles: [
      ...state.worldMap.tiles,
      { id: 'tile_1_0', q: 1, r: 0, terrain: 'plains', siteId: 'river_plain', discovered: true, visible: true },
    ],
  };
  state.territories = [
    { id: 'capital', cityName: '火种城', status: 'occupied' },
    { id: 'river_plain', naturalName: '河湾平原', status: 'occupied', cityName: '河湾城', effects: { foodOutputMultiplier: 0.05 } },
    { id: 'north_forest', naturalName: '北部林地', status: 'locked', effects: { woodOutputMultiplier: 0.08 } },
  ];

  const normalized = gameStateService.normalizeState(state);
  const territoryState = TerritoryService.getClientTerritoryState(normalized);

  assert.equal(territoryState.territories.length, 2);
  const riverPlain = territoryState.territories.find((item) => item.id === 'river_plain');
  assert.equal(riverPlain.status, 'occupied');
  assert.notDeepEqual({ x: riverPlain.x, y: riverPlain.y }, { x: 1, y: 0 });
  assert.equal(WorldMapService.canPlaceSiteOnTerrain(normalized.worldMap.seed, riverPlain.x, riverPlain.y), true);
  assert.ok(Math.max(Math.abs(riverPlain.x), Math.abs(riverPlain.y)) >= 3);
  assert.equal(territoryState.territories.some((item) => item.id === 'north_forest'), false);
  assert.equal(normalized.worldMap.tiles.find((tile) => tile.id === 'tile_1_0')?.siteId, null);
  assert.equal(normalized.worldMap.tiles.find((tile) => tile.id === WorldMapService.getTileId(riverPlain.x, riverPlain.y))?.siteId, 'river_plain');
  assert.equal(normalized.cities.river_plain.territoryId, 'river_plain');
  assert.deepEqual(normalized.scoutedCoordinates.find((item) => item.x === riverPlain.x && item.y === riverPlain.y), {
    x: riverPlain.x,
    y: riverPlain.y,
    result: 'site',
    siteId: 'river_plain',
    scoutedAt: normalized.territories.find((item) => item.id === 'river_plain').discoveredAt,
  });
});

test('旧迁移写入过的 v4 地图也会再次迁移到当前规则位置', () => {
  const state = createClassicalState();
  state.worldMap = {
    ...state.worldMap,
    version: 4,
    tiles: [
      ...state.worldMap.tiles,
      { id: 'tile_1_0', q: 1, r: 0, terrain: 'plains', siteId: 'river_plain', discovered: true, visible: true },
    ],
  };
  state.territories = [
    { id: 'capital', cityName: '火种城', status: 'occupied' },
    { id: 'river_plain', naturalName: '河湾平原', status: 'occupied', cityName: '河湾城', effects: { foodOutputMultiplier: 0.05 } },
  ];

  const normalized = gameStateService.normalizeState(state);
  const riverPlain = normalized.territories.find((item) => item.id === 'river_plain');

  assert.notDeepEqual({ x: riverPlain.x, y: riverPlain.y }, { x: 1, y: 0 });
  assert.equal(WorldMapService.canPlaceSiteOnTerrain(normalized.worldMap.seed, riverPlain.x, riverPlain.y), true);
  assert.ok(Math.max(Math.abs(riverPlain.x), Math.abs(riverPlain.y)) >= 3);
  assert.equal(normalized.worldMap.tiles.find((tile) => tile.id === 'tile_1_0')?.siteId, null);
  assert.equal(normalized.worldMap.tiles.find((tile) => tile.id === WorldMapService.getTileId(riverPlain.x, riverPlain.y))?.siteId, 'river_plain');
});

test('旧地图里压在水面或贴近城池的地点必须重新生成合法坐标', () => {
  const state = createClassicalState();
  state.worldMap = {
    ...state.worldMap,
    version: 4,
    tiles: [
      ...state.worldMap.tiles,
      { id: 'tile_6_2', q: 6, r: 2, terrain: 'river', siteId: 'river_site', discovered: true, visible: true },
    ],
  };
  state.territories = [
    { id: 'capital', cityName: '火种城', status: 'occupied' },
    { id: 'near_site', x: 2, y: 0, naturalName: '近郊城', status: 'occupied', cityName: '近郊城', type: 'town', owner: 'player' },
    { id: 'river_site', x: 6, y: 2, naturalName: '旧河城', status: 'occupied', cityName: '旧河城', type: 'town', owner: 'player' },
  ];

  const normalized = gameStateService.normalizeState(state);
  const nearSite = normalized.territories.find((item) => item.id === 'near_site');
  const riverSite = normalized.territories.find((item) => item.id === 'river_site');
  const distance = Math.max(Math.abs(riverSite.x - nearSite.x), Math.abs(riverSite.y - nearSite.y));

  for (const territory of normalized.territories.filter((item) => item.id !== 'capital')) {
    assert.equal(WorldMapService.canPlaceSiteOnTerrain(normalized.worldMap.seed, territory.x, territory.y), true);
    assert.ok(Math.max(Math.abs(territory.x), Math.abs(territory.y)) >= 3);
  }
  assert.notDeepEqual({ x: riverSite.x, y: riverSite.y }, { x: 6, y: 2 });
  assert.ok(distance >= 3);
  assert.equal(normalized.worldMap.tiles.find((tile) => tile.id === 'tile_6_2')?.siteId, null);
  assert.equal(normalized.worldMap.tiles.find((tile) => tile.id === WorldMapService.getTileId(riverSite.x, riverSite.y))?.siteId, 'river_site');
});

test('同轴两座城之间会补齐已经生成的基础地块', () => {
  const state = createClassicalState();
  state.worldMap = {
    ...state.worldMap,
    version: WorldMapService.WORLD_MAP_VERSION,
    tiles: state.worldMap.tiles.filter((tile) => tile.id === 'tile_0_0'),
  };
  state.territories = [
    { id: 'capital', cityName: '火种城', status: 'occupied' },
    { id: 'west_town', x: -3, y: 0, naturalName: '西镇', status: 'occupied', cityName: '西镇', type: 'town', owner: 'player' },
    { id: 'east_town', x: 4, y: 0, naturalName: '东镇', status: 'occupied', cityName: '东镇', type: 'town', owner: 'player' },
    { id: 'north_town', x: 2, y: -4, naturalName: '北镇', status: 'occupied', cityName: '北镇', type: 'town', owner: 'player' },
    { id: 'south_town', x: 2, y: 3, naturalName: '南镇', status: 'occupied', cityName: '南镇', type: 'town', owner: 'player' },
    { id: 'diagonal_town', x: 6, y: 6, naturalName: '斜镇', status: 'occupied', cityName: '斜镇', type: 'town', owner: 'player' },
  ];

  const normalized = gameStateService.normalizeState(state);
  const tileIds = new Set(normalized.worldMap.tiles.map((tile) => tile.id));

  for (let x = -3; x <= 4; x += 1) {
    assert.equal(tileIds.has(WorldMapService.getTileId(x, 0)), true);
  }
  for (let y = -4; y <= 3; y += 1) {
    assert.equal(tileIds.has(WorldMapService.getTileId(2, y)), true);
  }
  assert.equal(tileIds.has(WorldMapService.getTileId(5, 5)), false);
  assert.equal(normalized.worldMap.tiles.find((tile) => tile.id === 'tile_2_0')?.siteId, null);
  assert.equal(normalized.worldMap.tiles.find((tile) => tile.id === 'tile_4_0')?.siteId, 'east_town');
  assert.equal(normalized.worldMap.tiles.find((tile) => tile.id === 'tile_2_3')?.siteId, 'south_town');
});

test('侦察、出征、完成占领会产生待命名城市', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');

  const discovered = discoverFirstSite(state, 'e', now, [0.1, 0.9, 0.5]).claim.site;

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

  const discovered = discoverFirstSite(state, 'e', now, [0.1, 0.9, 0.5]).claim.site;

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
  const site = state.territories.find((item) => item.id === discovered.id);
  assert.equal(site.lastBattle.mode, 'settlement');
  assert.equal(site.lastBattle.tileId, WorldMapService.getTileId(discovered.x, discovered.y));
  assert.equal(site.lastBattle.mapTerrain, discovered.mapTerrain);
  assert.equal(site.lastBattle.terrain, discovered.terrain);
  assert.deepEqual(site.lastBattle.tile, {
    id: WorldMapService.getTileId(discovered.x, discovered.y),
    q: discovered.x,
    r: discovered.y,
    terrain: discovered.mapTerrain,
  });
});

test('有主地区占领时会保留出征配置并按人数进行战斗结算', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  state.military.soldiers = 800;
  if (state.cities?.capital?.military) state.cities.capital.military.soldiers = 800;
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
    soldiers: 800,
  }, now);

  assert.equal(start.success, true);
  assert.equal(start.mission.mode, 'conquest');
  assert.equal(start.mission.battleTarget.source, 'tile-map');
  assert.equal(start.mission.battleTarget.tile.id, 'tile_0_-2');
  assert.equal(start.mission.battleTarget.site.id, 'tribe_site');
  assert.equal(start.mission.battleTarget.site.owner, 'tribe');
  assert.equal(start.mission.battleTarget.defender.siteId, 'tribe_site');
  assert.equal(start.mission.battleTarget.defender.soldiers, 500);
  assert.equal(start.mission.battleTarget.intelSnapshot.knownGarrison, true);
  assert.deepEqual(start.mission.expedition, {
    troopType: 'unavailable',
    leader: 'unavailable',
    soldiers: 800,
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
  assert.equal(claim.battleReport.tileId, 'tile_0_-2');
  assert.equal(claim.battleReport.mapTerrain, WorldMapService.chooseTerrain(state.worldMap.seed, 0, -2));
  assert.deepEqual(claim.battleReport.tile, {
    id: 'tile_0_-2',
    q: 0,
    r: -2,
    terrain: claim.battleReport.mapTerrain,
  });
  assert.deepEqual(claim.battleReport.battleTarget, start.mission.battleTarget);
  assert.deepEqual(state.territories.find((item) => item.id === 'tribe_site').lastBattle.battleTarget, start.mission.battleTarget);
  assert.ok(claim.casualties > 0);
  assert.ok(claim.casualties < 800);
  assert.equal(state.territories.find((item) => item.id === 'tribe_site').owner, 'player');
});

test('隐藏客户端守将情报不会影响后端 BattleTarget 结算', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  state.military.soldiers = 800;
  if (state.cities?.capital?.military) state.cities.capital.military.soldiers = 800;
  pushReadyScoutMission(state, { id: 'scout_hidden_defender', direction: 'n', targetX: 0, targetY: -6, now });
  const claim = TerritoryService.claimScout(state, 'scout_hidden_defender', now, createSequenceRandom([0.1, 0.01, 0.01]));
  const clientSite = TerritoryService.getClientTerritoryState(state, now).territories.find((item) => item.id === claim.site.id);

  assert.equal(clientSite.garrison, null);
  assert.equal(clientSite.defenderLeader, null);

  const start = TerritoryService.startConquest(state, claim.site.id, { soldiers: 800, leader: 'unavailable' }, now);

  assert.equal(start.success, true);
  assert.ok(start.mission.battleTarget.defender.leader.id);
  assert.equal(start.mission.battleTarget.defender.soldiers, claim.site.garrison.soldiers);
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
  assert.equal(site.lastBattle.tileId, WorldMapService.getTileId(site.x, site.y));
  assert.equal(site.lastBattle.mapTerrain, WorldMapService.chooseTerrain(state.worldMap.seed, site.x, site.y));
  assert.equal(site.lastBattle.report.tileId, site.lastBattle.tileId);
  assert.equal(site.lastBattle.report.mapTerrain, site.lastBattle.mapTerrain);
  assert.deepEqual(site.lastBattle.report.tile, site.lastBattle.tile);
  assert.equal(site.lastBattle.leaderId, 'fp_luxiao');
  assert.equal(site.lastBattle.leaderName, '陆骁');
  assert.equal(site.lastBattle.report.mode, 'auto-round');
  assert.equal(site.lastBattle.report.attacker.leaderName, '陆骁');
  assert.ok(site.lastBattle.report.defender.leaderId);
  assert.ok(site.lastBattle.report.defender.leaderName);
  assert.ok(site.lastBattle.report.defender.skill.name);
  assert.equal(site.defenderLeader, null);
  assert.equal(site.garrison, null);
  assert.equal(site.lastBattle.report.system, 'attribute-auto-battle-v2');
  assert.equal(site.lastBattle.report.ruleVersion, 'battle-rules-v3');
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
  assert.equal(site.lastBattle.leaderGrowth.applied, true);
  assert.equal(site.lastBattle.leaderGrowth.leaderId, 'fp_luxiao');
  assert.equal(site.lastBattle.leaderGrowth.experienceGained, site.lastBattle.report.experience.total);
  assert.deepEqual(site.lastBattle.report.leaderGrowth, site.lastBattle.leaderGrowth);
  assert.ok(state.famousPeople[0].totalExperience >= site.lastBattle.report.experience.total);
  assert.equal(state.famousPeople[0].nextLevelExperience, FamousPersonService.getLevelUpExperience(state.famousPeople[0].level));
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

test('battle report terrain snapshot prefers the scouted fixed map terrain', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  addFamousLeader(state);
  addDiscoveredTribeSite(state, {
    id: 'fixed_terrain_battle_site',
    x: 3,
    y: 0,
    mapTerrain: 'forest',
    terrain: 'forest',
    defense: 500,
    recommendedSoldiers: 500,
  });
  assert.notEqual(WorldMapService.chooseTerrain(state.worldMap.seed, 3, 0), 'forest');
  gameStateService.normalizeState(state);

  const start = TerritoryService.startConquest(state, 'fixed_terrain_battle_site', {
    troopType: 'unavailable',
    leader: 'fp_luxiao',
    soldiers: 500,
  }, now);
  const mission = state.warMissions.find((item) => item.id === start.mission.id);
  mission.completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  const claim = TerritoryService.claimConquest(state, 'fixed_terrain_battle_site', now);

  assert.equal(claim.success, true);
  assert.equal(claim.battleReport.tileId, 'tile_3_0');
  assert.equal(claim.battleReport.mapTerrain, 'forest');
  assert.equal(claim.battleReport.terrain, 'forest');
  assert.deepEqual(claim.battleReport.tile, {
    id: 'tile_3_0',
    q: 3,
    r: 0,
    terrain: 'forest',
  });
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

  const discovered = discoverFirstSite(state, 'e', now, [0.1, 0.9, 0.5]).claim.site;

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
  const site = discoverFirstSite(state, 'e', now, [0.1, 0.9, 0.5]).claim.site;
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

  state.warMissions.push(
    { id: 'scout_empty_a', kind: 'scout', direction: 'n', targetX: 0, targetY: -7, scoutDistance: 7, startedAt: baseTime.toISOString(), completesAt: baseTime.toISOString(), status: 'ready' },
    { id: 'scout_empty_b', kind: 'scout', direction: 'e', targetX: 7, targetY: 0, scoutDistance: 7, startedAt: baseTime.toISOString(), completesAt: baseTime.toISOString(), status: 'ready' },
    { id: 'scout_site_c', kind: 'scout', direction: 's', targetX: 0, targetY: 7, scoutDistance: 7, startedAt: baseTime.toISOString(), completesAt: baseTime.toISOString(), status: 'ready' },
  );

  const firstClaim = TerritoryService.claimScout(state, 'scout_empty_a', baseTime, () => 0.95);
  assert.equal(firstClaim.site, null);
  assert.equal(state.scoutState.emptyStreak, 1);

  const secondAt = new Date('2026-05-17T08:02:00.000Z');
  const secondClaim = TerritoryService.claimScout(state, 'scout_empty_b', secondAt, () => 0.5);
  assert.equal(secondClaim.site, null);
  assert.equal(state.scoutState.emptyStreak, 2);

  const thirdAt = new Date('2026-05-17T08:04:00.000Z');
  const thirdClaim = TerritoryService.claimScout(state, 'scout_site_c', thirdAt, () => 0.5);
  assert.equal(thirdClaim.success, true);
  assert.ok(thirdClaim.site);
  assert.equal(state.scoutState.emptyStreak, 0);
});

test('连续多次没有出地点后会触发地点保底', () => {
  const state = createClassicalState();
  const baseTime = new Date('2026-05-17T08:00:00.000Z');
  const missions = [
    ['scout_a', 'n', 0, -7, new Date(baseTime)],
    ['scout_b', 'e', 7, 0, new Date('2026-05-17T08:02:00.000Z')],
    ['scout_c', 's', 0, 7, new Date('2026-05-17T08:04:00.000Z')],
    ['scout_d', 'w', -7, 0, new Date('2026-05-17T08:06:00.000Z')],
    ['scout_e', 'ne', 7, -7, new Date('2026-05-17T08:08:00.000Z')],
  ];
  const results = [];
  state.warMissions.push(...missions.map(([id, direction, targetX, targetY, at]) => ({
    id,
    kind: 'scout',
    direction,
    targetX,
    targetY,
    scoutDistance: Math.max(Math.abs(targetX), Math.abs(targetY)),
    startedAt: at.toISOString(),
    completesAt: at.toISOString(),
    status: 'ready',
  })));

  missions.forEach(([id, , , , at]) => {
    results.push(TerritoryService.claimScout(state, id, at, () => 0.99));
  });

  assert.equal(results[0].site, null);
  assert.equal(results[1].site, null);
  assert.equal(results[2].site, null);
  assert.equal(results[3].site, null);
  assert.ok(results[4].site);
  assert.equal(state.scoutState.emptyStreak, 0);
});

test('合法间距外仍有小概率直接发现有主的部落营地', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');

  pushReadyScoutMission(state, { id: 'scout_tribe_far', direction: 'n', targetX: 0, targetY: -7, now });
  const claim = TerritoryService.claimScout(state, 'scout_tribe_far', now, createSequenceRandom([0.1, 0.05, 0.1]));

  assert.equal(claim.success, true);
  assert.ok(claim.site);
  assert.equal(claim.site.owner, 'tribe');
  assert.equal(claim.site.type, 'camp');
});

test('距离越远越容易刷出有主地点', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');

  pushReadyScoutMission(state, { id: 'scout_near_valid', direction: 'e', targetX: 8, targetY: 1, now });
  const nearClaim = TerritoryService.claimScout(state, 'scout_near_valid', now, createSequenceRandom([0.1, 0.9, 0.3])).site;

  const farTime = new Date('2026-05-17T08:03:00.000Z');
  pushReadyScoutMission(state, { id: 'scout_far_valid', direction: 'e', targetX: 11, targetY: 1, now: farTime });
  const farClaim = TerritoryService.claimScout(state, 'scout_far_valid', farTime, createSequenceRandom([0.1, 0.2, 0.5])).site;

  assert.ok(farClaim.x > nearClaim.x);
  assert.ok(['neutral', 'tribe'].includes(nearClaim.owner));
  assert.ok(['city_state', 'tribe', 'ruin_guardians'].includes(farClaim.owner));
  assert.notEqual(farClaim.owner, 'neutral');
});

test('地点类型会按侦察区域内选中地块的地形倾向生成', () => {
  const now = new Date('2026-05-17T08:00:00.000Z');
  const cases = [
    { terrain: 'forest', q: -16, r: -14, random: [0.1, 0.05, 0.01], expected: { owner: 'tribe', type: 'camp' } },
    { terrain: 'plains', q: -16, r: -15, random: [0.1, 0.2, 0.6], expected: { owner: 'city_state', type: 'city' } },
    { terrain: 'hills', q: -16, r: -16, random: [0.1, 0.05, 0.99], expected: { owner: 'ruin_guardians', type: 'ruins' } },
    { terrain: 'waste', q: -14, r: -7, random: [0.1, 0.05, 0.99], expected: { owner: 'ruin_guardians', type: 'ruins' } },
    { terrain: 'desert', q: -15, r: -16, random: [0.1, 0.05, 0.99], expected: { owner: 'ruin_guardians', type: 'ruins' } },
    { terrain: 'mountain', q: -15, r: -11, random: [0.1, 0.05, 0.99], expected: { owner: 'ruin_guardians', type: 'ruins' } },
  ];

  for (const item of cases) {
    const state = createClassicalState();
    assert.equal(WorldMapService.chooseTerrain(state.worldMap.seed, item.q, item.r), item.terrain);
    pushReadySingleTileScout(state, { id: `scout_${item.terrain}`, q: item.q, r: item.r, now });

    const claim = TerritoryService.claimScout(state, `scout_${item.terrain}`, now, createSequenceRandom(item.random));

    assert.equal(claim.success, true);
    assert.equal(claim.site.mapTerrain, item.terrain);
    assert.equal(claim.site.owner, item.expected.owner);
    assert.equal(claim.site.type, item.expected.type);
    assert.equal(state.warMissions.length, 0);
  }
});

test('侦察生成地点的地图地形会驱动占领后的分城规划', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  pushReadySingleTileScout(state, { id: 'scout_forest_city', q: -16, r: -14, now });

  const discovered = TerritoryService.claimScout(state, 'scout_forest_city', now, createSequenceRandom([0.1, 0.99, 0.01])).site;
  const start = TerritoryService.startConquest(state, discovered.id, discovered.recommendedSoldiers, now);
  assert.equal(start.success, true);

  const mission = state.warMissions.find((item) => item.kind === 'conquest');
  mission.completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  const claim = TerritoryService.claimConquest(state, discovered.id, now);
  assert.equal(claim.success, true);

  const normalized = gameStateService.normalizeState(state);
  assert.equal(normalized.territories.find((item) => item.id === discovered.id).mapTerrain, 'forest');
  assert.equal(normalized.cities[discovered.id].planning.terrainLabel, '森林');
});

test('有主地点会细分为部落、城邦和遗迹守军', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');

  pushReadyScoutMission(state, { id: 'scout_tribe', direction: 'n', targetX: 0, targetY: -7, now });
  pushReadyScoutMission(state, { id: 'scout_city', direction: 'e', targetX: 11, targetY: 1, now });
  pushReadyScoutMission(state, { id: 'scout_ruins', direction: 's', targetX: 0, targetY: 7, now });

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
  state.scoutState.neutralSiteStreak = 3;

  pushReadyScoutMission(state, { id: 'scout_forced_owned', direction: 'n', targetX: 0, targetY: -4, scoutDistance: 4, now });
  const forced = TerritoryService.claimScout(state, 'scout_forced_owned', now, createSequenceRandom([0.1, 0.99, 0.1])).site;

  assert.ok(forced);
  assert.notEqual(forced.owner, 'neutral');
  assert.equal(state.scoutState.neutralSiteStreak, 0);
});

test('scout starts from the controlled border in the requested direction', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  addOccupiedSubCity(state, { id: 'site_east_far', x: 6, y: 0, cityName: '东境城' });
  const normalized = gameStateService.normalizeState(state);
  CityService.setActiveCity(normalized, 'capital');

  const start = TerritoryService.startScout(normalized, 'e', now);

  assert.equal(start.success, true);
  assert.equal(start.mission.sourceCityId, 'site_east_far');
  assert.equal(start.mission.originTerritoryId, 'site_east_far');
  assert.equal(start.mission.originX, 6);
  assert.equal(start.mission.originY, 0);
  assert.equal(start.mission.targetX, 7);
  assert.equal(start.mission.targetY, 0);
  assert.ok(start.mission.revealArea.every((coord) => coord.q >= 7));
  assert.deepEqual(start.mission.route[0], { q: 7, r: 0, step: 1, tileId: 'tile_7_0', revealed: false });
});

test('scout frontier can start from controlled world map tiles without a territory object', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  state.worldMap = WorldMapService.ensureWorldMap(state, now);
  WorldMapService.revealTile(state, 4, 0, now, {
    siteId: null,
    visibility: 'controlled',
  });

  const start = TerritoryService.startScout(state, 'e', now);

  assert.equal(start.success, true);
  assert.equal(start.mission.sourceCityId, 'tile_4_0');
  assert.equal(start.mission.originTerritoryId, 'tile_4_0');
  assert.equal(start.mission.originName, '控制区 4,0');
  assert.equal(start.mission.originX, 4);
  assert.equal(start.mission.originY, 0);
  assert.equal(start.mission.targetX, 5);
  assert.equal(start.mission.targetY, 0);
  assert.deepEqual(start.mission.route[0], { q: 5, r: 0, step: 1, tileId: 'tile_5_0', revealed: false });
});
