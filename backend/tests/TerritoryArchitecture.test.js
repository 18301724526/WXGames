const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const TerritoryService = require('../services/TerritoryService');
const TerritoryConstants = require('../services/territory/TerritoryConstants');
const TerritoryVisuals = require('../services/territory/TerritoryVisuals');
const TerritoryInitialState = require('../services/territory/TerritoryInitialState');
const TerritoryShared = require('../services/territory/TerritoryShared');
const createTerritoryCombatTargets = require('../services/territory/TerritoryCombatTargets');
const createTerritoryMilitaryMissions = require('../services/territory/TerritoryMilitaryMissions');
const createTerritoryScoutPlanner = require('../services/territory/TerritoryScoutPlanner');
const createTerritoryScoutRecords = require('../services/territory/TerritoryScoutRecords');
const createTerritoryScoutResults = require('../services/territory/TerritoryScoutResults');

const serviceRoot = path.join(__dirname, '..', 'services');
const territoryRoot = path.join(serviceRoot, 'territory');

function lineCount(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length;
}

test('TerritoryService starts delegating foundation responsibilities to territory modules', () => {
  const moduleFiles = fs.readdirSync(territoryRoot)
    .filter((name) => name.endsWith('.js'))
    .sort();

  assert.deepEqual(moduleFiles, [
    'TerritoryCombatTargets.js',
    'TerritoryConstants.js',
    'TerritoryInitialState.js',
    'TerritoryMilitaryMissions.js',
    'TerritoryScoutPlanner.js',
    'TerritoryScoutRecords.js',
    'TerritoryScoutResults.js',
    'TerritoryShared.js',
    'TerritoryVisuals.js',
  ]);
  for (const fileName of moduleFiles) {
    assert.ok(lineCount(path.join(territoryRoot, fileName)) < 500, `${fileName} should stay below 500 lines`);
  }
});

test('territory foundation modules preserve initial-state and visual contracts', () => {
  const now = '2026-06-06T00:00:00.000Z';

  assert.deepEqual(TerritoryInitialState.createInitialPolity(), {
    name: null,
    namePrompted: false,
    capitalCityName: '首都',
    color: '#d9a441',
  });
  assert.deepEqual(TerritoryInitialState.createInitialTerritories(now), TerritoryService.createInitialTerritories(now));
  assert.equal(TerritoryInitialState.createInitialTerritories(now)[0].art, TerritoryConstants.SITE_ART.capital);
  assert.equal(TerritoryConstants.SITE_TEMPLATES[0].naturalNames[0], '河畔前哨');

  assert.deepEqual(TerritoryVisuals.createVisualOffset(0, 0), { x: 0, y: 0 });
  assert.deepEqual(TerritoryVisuals.createVisualOffset(3, -2, 'seed'), TerritoryVisuals.createVisualOffset(3, -2, 'seed'));
  assert.deepEqual(TerritoryVisuals.normalizeVisualOffset({ x: 9, y: -9 }, 1, 1), { x: 0.55, y: -0.55 });
});

test('territory shared helpers preserve terrain and soldier normalization contracts', () => {
  assert.equal(TerritoryShared.toInteger('4.8'), 4);
  assert.equal(TerritoryShared.toInteger('bad', 7), 7);
  assert.equal(TerritoryShared.normalizeSoldierScale(3), 300);
  assert.equal(TerritoryShared.normalizeSoldierScale(120), 120);
  assert.equal(TerritoryShared.getDistance(-3, 2), 3);
  assert.equal(TerritoryShared.getRelativeDistance(1, 1, -2, 4), 3);
  assert.equal(TerritoryShared.getCoordinateKey(-2, 4), '-2,4');
  assert.equal(TerritoryShared.normalizeMapTerrainId('forest'), 'forest');
  assert.equal(TerritoryShared.normalizeMapTerrainId('unknown'), null);
  assert.equal(TerritoryShared.getPlanningTerrainForMapTerrain('mountain'), 'hills');
  assert.equal(TerritoryShared.getPlanningTerrainForMapTerrain('coast'), 'coast');
});

test('territory combat targets module owns garrison and battle target contracts', () => {
  const leaderCalls = [];
  const CombatTargets = createTerritoryCombatTargets({
    DefenderLeaderService: {
      ensureDefenderLeader: (territory, options) => {
        leaderCalls.push({ territory, options });
        return {
          id: 'leader-1',
          name: '守备长',
          quality: 'rare',
          abilityKit: { id: 'shield-wall' },
        };
      },
    },
    WorldMapService: {
      getTileId: (q, r) => `tile_${q}_${r}`,
    },
  });

  assert.equal(CombatTargets.normalizeGarrison(null, { id: 'capital', owner: 'player' }), null);
  assert.equal(CombatTargets.normalizeGarrison(null, { id: 'empty', owner: 'neutral' }), null);

  const territory = {
    id: 'camp-1',
    x: 3,
    y: -1,
    type: 'camp',
    owner: 'tribe',
    status: 'discovered',
    naturalName: '林地部落',
    defense: 80,
    recommendedSoldiers: 80,
    threat: 4,
    scale: 2,
    mapTerrain: 'forest',
    discoveredAt: '2026-06-06T00:00:00.000Z',
  };

  const garrison = CombatTargets.normalizeGarrison(null, territory, '2026-06-06T00:00:00.000Z');
  assert.equal(garrison.id, 'garrison_camp-1');
  assert.equal(garrison.siteId, 'camp-1');
  assert.equal(garrison.owner, 'tribe');
  assert.equal(garrison.soldiers, 8000);
  assert.equal(garrison.quality, 'rare');
  assert.equal(garrison.threat, 4);
  assert.equal(garrison.scale, 2);
  assert.equal(garrison.leader.id, 'leader-1');
  assert.equal(leaderCalls.length, 1);

  const battleTarget = CombatTargets.normalizeBattleTarget({
    q: 3,
    r: -1,
    mapTerrain: 'mountain',
    defender: garrison,
  }, territory, '2026-06-06T00:01:00.000Z');

  assert.deepEqual(battleTarget.tile, { id: 'tile_3_-1', q: 3, r: -1, terrain: 'mountain' });
  assert.equal(battleTarget.site.id, 'camp-1');
  assert.equal(battleTarget.site.terrain, 'hills');
  assert.equal(battleTarget.defender.soldiers, 8000);
  assert.deepEqual(battleTarget.intelSnapshot, {
    knownTerrain: true,
    knownSite: true,
    knownOwner: true,
    knownGarrison: true,
    knownLeader: true,
    knownSkill: true,
  });
});

test('territory scout records module owns report and area normalization contracts', () => {
  const calls = [];
  const ScoutRecords = createTerritoryScoutRecords({
    WorldMapService: {
      getTileId: (q, r) => `tile_${q}_${r}`,
    },
    ensureMissionRevealArea: (gameState, mission) => {
      calls.push({ gameState, mission });
      return [
        { q: 2, r: 1, kind: 'main', step: 1 },
        { q: 2, r: 2, kind: 'branch', step: 2 },
      ];
    },
    getScoutResolvedCoordinate: () => ({ x: 2, y: 1 }),
    normalizeDirection: (direction) => (direction === 'bad' ? null : direction),
  });

  const report = ScoutRecords.normalizeScoutReport({
    id: 'report-1',
    q: '2',
    r: '1',
    mapTerrain: 'mountain',
    direction: 'e',
    revealArea: [{ q: 2, r: 1, revealed: false }],
  });
  assert.match(report.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  delete report.createdAt;
  assert.deepEqual(report, {
    id: 'report-1',
    siteId: null,
    title: '侦察报告',
    text: '',
    direction: 'e',
    tileId: 'tile_2_1',
    q: 2,
    r: 1,
    mapTerrain: 'mountain',
    terrain: 'hills',
    tile: { id: 'tile_2_1', q: 2, r: 1, terrain: 'mountain' },
    revealArea: [{ q: 2, r: 1, step: 0, kind: 'main', tileId: 'tile_2_1', revealed: false }],
  });

  const coordinates = ScoutRecords.normalizeScoutCoordinates([
    { x: 4, y: 1, result: 'empty', scoutedAt: '2026-06-06T00:00:00.000Z' },
    { x: 4, y: 1, result: 'site', siteId: 'site-1', scoutedAt: '2026-06-06T00:01:00.000Z' },
    { x: 0, y: 0, result: 'site' },
  ]);
  assert.deepEqual(coordinates, [
    { x: 4, y: 1, result: 'site', siteId: 'site-1', scoutedAt: '2026-06-06T00:01:00.000Z' },
  ]);

  const gameState = {};
  const area = ScoutRecords.upsertScoutAreaRecord(gameState, {
    id: 'mission-1',
    direction: 'e',
    originX: 0,
    originY: 0,
    targetX: 2,
    targetY: 1,
    revealArea: [{ q: 2, r: 1 }],
  }, 'empty', { scoutedAt: '2026-06-06T00:02:00.000Z' });

  assert.equal(calls.length, 1);
  assert.equal(area.id, 'mission-1');
  assert.deepEqual(gameState.scoutState.areas[0].tileIds, ['tile_2_1', 'tile_2_2']);
  assert.deepEqual(gameState.scoutState.areas[0].coords, [
    { q: 2, r: 1, tileId: 'tile_2_1' },
    { q: 2, r: 2, tileId: 'tile_2_2' },
  ]);
});

test('territory military missions module owns selectors and soldier allocation contracts', () => {
  const MilitaryMissions = createTerritoryMilitaryMissions({
    WorldMapService: {
      getTileId: (q, r) => `tile_${q}_${r}`,
      revealScoutArea: () => [],
      recordScoutTrail: () => {},
    },
    ensureMissionRevealArea: (_gameState, mission) => mission.revealArea || [],
    isDirectionalScoutAreaMission: (mission) => mission.revealAreaSource === 'directional-route-v1',
  });

  const gameState = {
    activeCityId: 'frontier',
    military: { soldiers: 180 },
    cities: {
      capital: { id: 'capital', military: { soldiers: 140 } },
      frontier: { id: 'frontier', military: { soldiers: 120 } },
      outpost: { id: 'outpost', military: { soldiers: 90 } },
    },
    warMissions: [
      { id: 'scout-active', kind: 'scout', status: 'active', startedAt: '2026-06-06T00:00:00.000Z' },
      { id: 'scout-ready', kind: 'scout', status: 'ready', startedAt: '2026-06-06T00:01:00.000Z' },
      {
        id: 'conquest-ready',
        kind: 'conquest',
        territoryId: 'site-1',
        status: 'ready',
        sourceCityId: 'capital',
        soldiersCommitted: 100,
        soldierAllocations: [{ cityId: 'capital', soldiers: 100 }],
      },
      { id: 'conquest-done', kind: 'conquest', territoryId: 'site-2', status: 'done', soldiersCommitted: 400 },
    ],
  };

  assert.equal(MilitaryMissions.getMissionKind({ kind: 'scout' }), 'scout');
  assert.equal(MilitaryMissions.getMissionKind({ kind: 'other' }), 'conquest');
  assert.deepEqual(MilitaryMissions.getScoutMissions(gameState).map((mission) => mission.id), ['scout-active', 'scout-ready']);
  assert.equal(MilitaryMissions.getActiveScoutMission(gameState).id, 'scout-active');
  assert.equal(MilitaryMissions.countActiveScoutMissions(gameState), 1);
  assert.equal(MilitaryMissions.getActiveMissionForTerritory(gameState, 'site-1').id, 'conquest-ready');
  assert.equal(MilitaryMissions.getActiveMissionForTerritory(gameState, 'site-2'), null);
  assert.deepEqual(MilitaryMissions.getMissionSoldierAllocations({ sourceCityId: 'frontier', soldiersCommitted: 2 }), [
    { cityId: 'frontier', soldiers: 200 },
  ]);
  assert.deepEqual(MilitaryMissions.getCitySoldierEntries(gameState), [
    { id: 'capital', soldiers: 140 },
    { id: 'frontier', soldiers: 180 },
    { id: 'outpost', soldiers: 90 },
  ]);
  assert.equal(MilitaryMissions.countSoldiersOnMission(gameState, 'capital'), 100);
  assert.equal(MilitaryMissions.countTotalSoldiersOnMission(gameState), 100);
  assert.equal(MilitaryMissions.getAvailableSoldiers(gameState), 310);
  assert.equal(MilitaryMissions.getAvailableSoldiersForCity(gameState, 'capital'), 40);
  assert.deepEqual(MilitaryMissions.allocateSoldiersForMission(gameState, 260), [
    { cityId: 'frontier', soldiers: 180 },
    { cityId: 'capital', soldiers: 40 },
    { cityId: 'outpost', soldiers: 40 },
  ]);
  assert.equal(MilitaryMissions.allocateSoldiersForMission(gameState, 999), null);
});

test('territory military missions module advances scout reveal steps and enforces scout limit', () => {
  const trails = [];
  const MilitaryMissions = createTerritoryMilitaryMissions({
    WorldMapService: {
      getTileId: (q, r) => `tile_${q}_${r}`,
      revealScoutArea: (_gameState, targets) => targets.map((coord) => ({
        id: `tile_${coord.q}_${coord.r}`,
        q: coord.q,
        r: coord.r,
        terrain: 'plains',
      })),
      recordScoutTrail: (_gameState, mission, tileIds, completed) => {
        trails.push({ missionId: mission.id, tileIds: [...tileIds], completed });
      },
    },
    ensureMissionRevealArea: (_gameState, mission) => mission.revealArea || [],
    isDirectionalScoutAreaMission: (mission) => mission.revealAreaSource === 'directional-route-v1',
  });

  const mission = {
    id: 'scout-1',
    kind: 'scout',
    status: 'active',
    startedAt: '2026-06-06T00:00:00.000Z',
    nextStepAt: '2026-06-06T00:00:00.000Z',
    completesAt: '2026-06-06T00:02:00.000Z',
    actionPoints: 2,
    actionPointsRemaining: 2,
    route: [
      { q: 1, r: 0, step: 1, tileId: 'tile_1_0', revealed: false },
      { q: 2, r: 0, step: 2, tileId: 'tile_2_0', revealed: false },
    ],
    revealAreaSource: 'directional-route-v1',
    revealArea: [
      { q: 1, r: 0, step: 1, kind: 'main', tileId: 'tile_1_0', revealed: false },
      { q: 1, r: 1, step: 1, kind: 'branch', tileId: 'tile_1_1', revealed: false },
      { q: 2, r: 0, step: 2, kind: 'main', tileId: 'tile_2_0', revealed: false },
    ],
    revealedTileIds: [],
  };
  const gameState = { warMissions: [mission] };

  MilitaryMissions.updateMissionReadiness(gameState, new Date('2026-06-06T00:00:01.000Z'));
  assert.equal(mission.status, 'active');
  assert.equal(mission.actionPointsRemaining, 1);
  assert.deepEqual(mission.revealedTileIds, ['tile_1_0', 'tile_1_1']);
  assert.equal(trails.at(-1).completed, false);

  MilitaryMissions.updateMissionReadiness(gameState, new Date('2026-06-06T00:00:12.000Z'));
  assert.equal(mission.status, 'ready');
  assert.equal(mission.actionPointsRemaining, 0);
  assert.deepEqual(mission.revealedTileIds, ['tile_1_0', 'tile_1_1', 'tile_2_0']);
  assert.equal(trails.at(-1).completed, true);

  const limitState = {
    warMissions: [
      { id: 'old', kind: 'scout', status: 'active', startedAt: '2026-06-06T00:00:00.000Z' },
      { id: 'middle', kind: 'scout', status: 'active', startedAt: '2026-06-06T00:01:00.000Z' },
      { id: 'new', kind: 'scout', status: 'active', startedAt: '2026-06-06T00:02:00.000Z' },
      { id: 'ready', kind: 'scout', status: 'ready', startedAt: '2026-06-06T00:03:00.000Z' },
    ],
  };
  MilitaryMissions.enforceScoutMissionLimit(limitState);
  assert.deepEqual(limitState.warMissions.map((item) => item.id), ['old', 'middle', 'ready']);
});

test('territory scout planner module owns scout origins and frontier target scoring', () => {
  const Planner = createTerritoryScoutPlanner({
    WorldMapService: {
      SCOUT_REVEAL_MAIN_LIMIT: 3,
      getTileId: (q, r) => `tile_${q}_${r}`,
      ensureWorldMap: () => ({
        seed: 'seed',
        tiles: [
          { id: 'tile_0_0', q: 0, r: 0, visibility: 'controlled' },
          { id: 'tile_2_0', q: 2, r: 0, visibility: 'controlled', siteId: 'frontier-site' },
          { id: 'tile_1_0', q: 1, r: 0, discovered: true },
        ],
      }),
      buildScoutRoute: ({ q, r }, direction, actionPoints, options) => {
        const start = options.startDistance;
        return Array.from({ length: actionPoints }, (_, index) => ({
          q: direction === 'e' ? q + start + index : q,
          r,
          step: index + 1,
        }));
      },
      getScoutRevealArea: (_seed, route) => route.flatMap((step) => [
        { q: step.q, r: step.r, step: step.step, kind: 'main' },
        { q: step.q, r: step.r + 1, step: step.step, kind: 'branch' },
      ]),
    },
    getScoutOrigin: () => ({
      cityId: 'capital',
      territoryId: 'capital',
      name: '棣栭兘',
      x: 0,
      y: 0,
    }),
    normalizeScoutState: (state) => ({
      areas: [],
      ...(state && typeof state === 'object' ? state : {}),
    }),
  });

  const gameState = {
    territories: [
      { id: 'capital', status: 'occupied', cityName: '棣栭兘', x: 0, y: 0 },
      { id: 'frontier', status: 'occupied', naturalName: '鍓嶅摠', x: 2, y: 0 },
      { id: 'occupied-east', status: 'discovered', x: 3, y: 0 },
    ],
    scoutedCoordinates: [{ x: 1, y: 0 }],
    scoutState: {
      areas: [{ tileIds: ['tile_4_0', 'tile_4_1'] }],
    },
  };

  assert.deepEqual(Planner.getKnownWorldCoordinateKeys(gameState), new Set(['0,0', '2,0', '1,0']));
  assert.deepEqual(Planner.getScoutedAreaTileIdSet(gameState), new Set(['tile_4_0', 'tile_4_1']));
  assert.deepEqual(Planner.getControlledScoutOrigins(gameState).map((origin) => ({
    cityId: origin.cityId,
    territoryId: origin.territoryId,
    x: origin.x,
    y: origin.y,
  })), [
    { cityId: 'capital', territoryId: 'capital', x: 0, y: 0 },
    { cityId: 'frontier', territoryId: 'frontier', x: 2, y: 0 },
  ]);

  const target = Planner.findNextCoordinate(gameState, 'e');
  assert.equal(target.origin.territoryId, 'frontier');
  assert.equal(target.x, 4);
  assert.equal(target.y, 0);
  assert.equal(target.distance, 2);
  assert.ok(target.newTileCount > 0);
  assert.equal(target.routeStartDistance, 1);

  assert.equal(Planner.findNextCoordinate(gameState, 'bad'), null);
});

test('territory scout results module owns scout outcomes reports and generated site contracts', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const Results = createTerritoryScoutResults({
    WorldMapService: {
      getTileId: (q, r) => `tile_${q}_${r}`,
      ensureWorldMap: () => ({
        seed: 'seed',
        tiles: [
          { id: 'tile_2_0', q: 2, r: 0, terrain: 'plains' },
          { id: 'tile_3_0', q: 3, r: 0, terrain: 'forest' },
        ],
      }),
      chooseTerrain: (_seed, q) => (q === 3 ? 'forest' : 'plains'),
      canPlaceSiteOnTerrain: (_seed, q) => q !== 9,
    },
    ensureMissionRevealArea: (_gameState, mission) => mission.revealArea || [],
    getScoutCoordinateRecord: (gameState, q, r) => (
      gameState.scoutedCoordinates || []
    ).find((coord) => coord.x === q && coord.y === r) || null,
    getScoutResolvedCoordinate: (mission) => ({
      x: Number.isFinite(Number(mission.siteX)) ? Number(mission.siteX) : Number(mission.targetX),
      y: Number.isFinite(Number(mission.siteY)) ? Number(mission.siteY) : Number(mission.targetY),
    }),
    getSiteSpacingProfile: (_gameState, q) => (q === 4
      ? { valid: false, nearestDistance: 1, score: -100 }
      : { valid: true, nearestDistance: 5, score: 10 }),
    normalizeGarrison: (_raw, site) => (site.owner === 'neutral' ? null : {
      id: `garrison_${site.id}`,
      leader: { id: 'leader-1', abilityKit: { id: 'shield-wall' } },
    }),
    normalizeScoutReport: (report) => ({ ...report, normalized: true }),
    normalizeScoutState: (state) => ({
      emptyStreak: 0,
      neutralSiteStreak: 0,
      areas: [],
      ...(state && typeof state === 'object' ? state : {}),
    }),
  });

  const guaranteeState = {
    scoutState: { emptyStreak: TerritoryConstants.SCOUT_SITE_GUARANTEE_AFTER, neutralSiteStreak: 0 },
  };
  assert.equal(Results.rollScoutOutcome(guaranteeState, () => 0.99), 'site');
  assert.equal(Results.rollScoutOutcome({ scoutState: { emptyStreak: 0 } }, () => 0.99), 'empty');
  assert.equal(Results.recordScoutOutcome(guaranteeState, 'empty'), TerritoryConstants.SCOUT_SITE_GUARANTEE_AFTER + 1);
  assert.equal(Results.recordScoutOutcome(guaranteeState, 'site'), 0);
  assert.equal(Results.recordDiscoveredSiteOwnership(guaranteeState, 'neutral'), 1);
  assert.equal(Results.recordDiscoveredSiteOwnership(guaranteeState, 'tribe'), 0);
  assert.equal(Results.getOwnedSiteChance(3, 3), 1);

  const mission = {
    id: 'scout-1',
    direction: 'e',
    originX: 0,
    originY: 0,
    targetX: 2,
    targetY: 0,
    originName: 'Capital',
    scoutDistance: 2,
    revealAreaSource: 'directional-route-v1',
    revealArea: [
      { q: 2, r: 0, step: 1, kind: 'main', revealed: true },
      { q: 3, r: 0, step: 2, kind: 'branch', revealed: false },
    ],
    revealedTileIds: ['tile_3_0'],
  };
  const gameState = {
    scoutState: { emptyStreak: 0, neutralSiteStreak: 0 },
    scoutedCoordinates: [{ x: 2, y: 0, result: 'empty' }],
    territories: [{ id: 'capital', x: 0, y: 0 }],
  };

  assert.deepEqual(Results.getScoutCandidateCoordinates(gameState, mission, now), [
    { q: 3, r: 0 },
    { q: 2, r: 0 },
  ]);
  assert.deepEqual(Results.pickScoutSiteCoordinate(gameState, mission, now), {
    q: 3,
    r: 0,
    terrain: 'forest',
    distance: 3,
    nearestSiteDistance: 5,
    spacingScore: 10,
    score: Results.scoreScoutSiteCandidate(gameState, mission, { q: 3, r: 0 }, 'seed').score,
  });

  const emptyReport = Results.createEmptyScoutReport(gameState, mission, now);
  assert.equal(emptyReport.normalized, true);
  assert.equal(emptyReport.tileId, 'tile_2_0');
  assert.equal(emptyReport.revealArea.length, 2);
  assert.equal(emptyReport.revealArea[0].tileId, 'tile_2_0');

  const created = Results.createSiteFromScout({
    scoutState: { neutralSiteStreak: 3 },
    territories: [{ id: 'capital' }],
  }, {
    ...mission,
    siteX: 3,
    siteY: 0,
    siteTerrain: 'forest',
    scoutDistance: 3,
  }, now, () => 0);
  assert.equal(created.site.id, 'site_3_0');
  assert.equal(created.site.type, 'camp');
  assert.equal(created.site.owner, 'tribe');
  assert.equal(created.site.effects.woodOutputMultiplier, 0.1);
  assert.equal(created.site.garrison.leader.id, 'leader-1');
  assert.equal(created.report.normalized, true);
  assert.equal(created.report.tileId, 'tile_3_0');
});

test('TerritoryService facade preserves the legacy territory API', () => {
  const expectedApi = [
    'CONQUEST_DURATION_MS',
    'DIRECTIONS',
    'MIN_EXPEDITION_SOLDIERS',
    'MISSION_DURATION_MS',
    'SCOUT_ACTION_POINTS',
    'SCOUT_DURATION_MS',
    'SCOUT_SITE_MIN_DISTANCE',
    'SCOUT_STEP_DURATION_MS',
    'SITE_ART',
    'SITE_TEMPLATES',
    'claimConquest',
    'claimScout',
    'countSoldiersOnMission',
    'createInitialPolity',
    'createInitialTerritories',
    'getActiveScoutMission',
    'getAvailableSoldiers',
    'getClientTerritoryState',
    'getScoutMissions',
    'getTerritoryEffects',
    'normalizeTerritoryState',
    'renameCity',
    'renamePolity',
    'scoutTerritory',
    'startConquest',
    'startScout',
    'updateMissionReadiness',
  ];

  assert.deepEqual(Object.keys(TerritoryService).sort(), expectedApi.sort());
});
