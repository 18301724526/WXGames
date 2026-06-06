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
const createTerritoryConquestMissions = require('../services/territory/TerritoryConquestMissions');
const createTerritoryMilitaryMissions = require('../services/territory/TerritoryMilitaryMissions');
const createTerritoryNaming = require('../services/territory/TerritoryNaming');
const createTerritoryScoutPlanner = require('../services/territory/TerritoryScoutPlanner');
const createTerritoryScoutRecords = require('../services/territory/TerritoryScoutRecords');
const createTerritoryScoutResults = require('../services/territory/TerritoryScoutResults');
const createTerritorySiteMigration = require('../services/territory/TerritorySiteMigration');
const createTerritoryStateNormalizer = require('../services/territory/TerritoryStateNormalizer');

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
    'TerritoryConquestMissions.js',
    'TerritoryConstants.js',
    'TerritoryInitialState.js',
    'TerritoryMilitaryMissions.js',
    'TerritoryNaming.js',
    'TerritoryScoutPlanner.js',
    'TerritoryScoutRecords.js',
    'TerritoryScoutResults.js',
    'TerritoryShared.js',
    'TerritorySiteMigration.js',
    'TerritoryStateNormalizer.js',
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

test('territory site migration module owns current-rule retargeting contracts', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const battleTargets = [];
  const Migration = createTerritorySiteMigration({
    WorldMapService: {
      WORLD_MAP_VERSION: 3,
      getTileId: (q, r) => `tile_${q}_${r}`,
      ensureWorldMap: (gameState) => {
        gameState.worldMap = gameState.worldMap || {
          seed: 'seed',
          tiles: [
            { id: 'tile_0_0', q: 0, r: 0, siteId: 'capital' },
            { id: 'tile_1_0', q: 1, r: 0, siteId: 'old-site' },
            { id: 'tile_2_0', q: 2, r: 0, siteId: 'other-site' },
          ],
        };
        return gameState.worldMap;
      },
      buildScoutRoute: ({ q, r }, direction, actionPoints, options) => {
        const start = options.startDistance;
        return Array.from({ length: actionPoints }, (_, index) => ({
          q: direction === 'e' ? q + start + index : q,
          r,
          step: index + 1,
        }));
      },
      getScoutRevealArea: (_seed, route) => route.map((step) => ({
        q: step.q,
        r: step.r,
        step: step.step,
        kind: 'main',
      })),
      canPlaceSiteOnTerrain: (_seed, q) => q !== 1,
      chooseTerrain: (_seed, q) => (q === 3 ? 'forest' : 'plains'),
    },
    getDirectionProgressScore: () => 0.5,
    getTerrainSiteScore: (terrain) => (terrain === 'forest' ? 6 : 7),
    normalizeBattleTarget: (target, territory, timestamp) => {
      battleTargets.push({ target, territory, timestamp });
      return { normalized: true, target };
    },
    normalizeDirection: (direction) => (direction === 'e' ? 'e' : null),
  });

  const gameState = {
    scoutState: {
      areas: [
        {
          siteId: 'old-site',
          direction: 'e',
          originX: 0,
          originY: 0,
          targetX: 2,
          targetY: 0,
          scoutedAt: '2026-06-06T00:00:00.000Z',
        },
      ],
    },
    scoutedCoordinates: [{ x: 1, y: 0, result: 'site' }],
    territories: [
      { id: 'capital', x: 0, y: 0 },
      {
        id: 'old-site',
        x: 1,
        y: 0,
        type: 'camp',
        naturalName: '旧据点',
        discoveredAt: '2026-06-06T00:00:00.000Z',
        garrison: { id: 'garrison_old' },
        battleTarget: { site: { id: 'old-site' }, defender: { id: 'old-defender' } },
      },
    ],
  };

  const mission = Migration.buildMigrationMissionForTerritory(gameState, gameState.territories[1], now);
  assert.equal(mission.direction, 'e');
  assert.equal(mission.targetX, 2);
  assert.equal(mission.route.length, TerritoryConstants.SCOUT_ACTION_POINTS);
  assert.equal(mission.revealedTileIds[0], 'tile_1_0');

  const coords = Migration.getMigrationSearchCoordinates(mission, 2);
  assert.ok(coords.some((coord) => coord.q === 2 && coord.r === 0));
  assert.ok(!coords.some((coord) => coord.q === 0 && coord.r === 0));

  const score = Migration.scoreMigratedSiteCandidate(gameState, mission, gameState.territories[1], { q: 3, r: 0, priority: 1 }, [gameState.territories[0]], 'seed');
  assert.equal(score.q, 3);
  assert.equal(score.terrain, 'forest');
  assert.equal(score.searchPriority, 1);
  assert.ok(score.score > 0);

  assert.equal(Migration.migrateTerritorySitesToCurrentWorldRules(gameState, 2, now), true);
  const migrated = gameState.territories[1];
  assert.notEqual(migrated.x, 1);
  assert.equal(migrated.mapTerrain, 'plains');
  assert.equal(migrated.garrison.siteId, 'old-site');
  assert.equal(migrated.battleTarget.normalized, true);
  assert.equal(battleTargets.length, 1);
  assert.deepEqual(gameState.scoutedCoordinates, []);
  assert.equal(gameState.worldMap.tiles.find((tile) => tile.id === 'tile_0_0').siteId, 'capital');
  assert.equal(gameState.worldMap.tiles.find((tile) => tile.id === 'tile_1_0').siteId, null);
  assert.equal(Migration.migrateTerritorySitesToCurrentWorldRules(gameState, 3, now), false);
});

test('territory conquest missions module owns settlement and battle resolution contracts', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const boundTiles = [];
  const experienceGrants = [];
  const Conquest = createTerritoryConquestMissions({
    BattleService: {
      getLeaderSnapshot: (_gameState, leader) => (leader === 'leader-1' ? { id: leader, name: '先锋' } : null),
      simulateConquestBattle: (_gameState, mission, territory) => ({
        success: mission.soldiersCommitted >= territory.defense,
        casualties: 30,
        report: {
          id: 'battle-1',
          attacker: { leaderName: '先锋' },
          experience: { leader: 12 },
        },
      }),
      createLegacyBattleReport: () => ({ id: 'legacy-battle' }),
    },
    getFamousPersonService: () => ({
      MAX_CANDIDATES: 3,
      ensureFamousPersonState: (gameState) => {
        gameState.famousPersons = gameState.famousPersons || { candidates: [] };
        return gameState.famousPersons;
      },
      createFamousPersonCandidate: () => ({ id: 'candidate-1', source: { type: 'postWar' } }),
      grantBattleExperience: (_gameState, leader, experience) => {
        experienceGrants.push({ leader, experience });
        return { leader, levelUp: false };
      },
    }),
    WorldMapService: {
      bindSiteToTile: (_gameState, x, y, siteId, _now, options) => {
        boundTiles.push({ x, y, siteId, options });
      },
    },
    allocateSoldiersForMission: (_gameState, required) => [{ cityId: 'capital', soldiers: required }],
    attachBattleTileSnapshot: (report, snapshot, battleTarget) => ({ ...report, snapshot, battleTarget }),
    getActiveMissionForTerritory: (gameState, territoryId) => (
      gameState.warMissions || []
    ).find((mission) => mission.territoryId === territoryId && ['active', 'ready'].includes(mission.status)) || null,
    getAvailableSoldiers: (gameState) => gameState.availableSoldiers,
    getMissionSoldierAllocations: (mission) => mission.soldierAllocations || [],
    getNamingPrompt: () => ({ type: 'city', territoryId: 'site-1' }),
    getTerritory: (gameState, territoryId) => (
      gameState.territories || []
    ).find((territory) => territory.id === territoryId) || null,
    getTerritoryBattleTargetSnapshot: (_gameState, territory) => ({ id: `target_${territory.id}` }),
    getTerritoryBattleTileSnapshot: (_gameState, territory) => ({
      tileId: `tile_${territory.x}_${territory.y}`,
      q: territory.x,
      r: territory.y,
      mapTerrain: territory.mapTerrain || 'plains',
      terrain: territory.terrain || 'plains',
      tile: { id: `tile_${territory.x}_${territory.y}`, q: territory.x, r: territory.y, terrain: territory.mapTerrain || 'plains' },
    }),
    normalizeBattleTarget: (target) => ({ ...target, normalized: true }),
  });

  assert.equal(Conquest.getOccupationMode({ owner: 'neutral' }), 'settlement');
  assert.equal(Conquest.getOccupationMode({ owner: 'tribe' }), 'conquest');
  assert.equal(Conquest.normalizeExpeditionConfig({ soldiers: 20 }, { owner: 'tribe', defense: 250 }).soldiers, TerritoryConstants.MIN_EXPEDITION_SOLDIERS);

  const settlementState = {
    availableSoldiers: TerritoryConstants.MIN_EXPEDITION_SOLDIERS,
    activeCityId: 'capital',
    warMissions: [],
    territories: [{
      id: 'site-1',
      x: 2,
      y: 0,
      naturalName: 'River Bend',
      owner: 'neutral',
      status: 'discovered',
      defense: TerritoryConstants.MIN_EXPEDITION_SOLDIERS,
    }],
  };
  const startedSettlement = Conquest.startConquest(settlementState, 'site-1', {}, now);
  assert.equal(startedSettlement.success, true);
  assert.equal(startedSettlement.mission.mode, 'settlement');
  assert.equal(startedSettlement.mission.soldiersCommitted, TerritoryConstants.MIN_EXPEDITION_SOLDIERS);
  assert.equal(settlementState.territories[0].status, 'contested');
  settlementState.warMissions[0].status = 'ready';
  const claimedSettlement = Conquest.claimConquest(settlementState, 'site-1', now);
  assert.equal(claimedSettlement.success, true);
  assert.equal(claimedSettlement.outcome, 'success');
  assert.equal(claimedSettlement.namingPrompt.type, 'city');
  assert.equal(settlementState.territories[0].status, 'occupied');
  assert.equal(settlementState.territories[0].owner, 'player');
  assert.equal(boundTiles.at(-1).options.visibility, 'controlled');

  const battleState = {
    availableSoldiers: 300,
    activeCityId: 'capital',
    cities: { capital: { id: 'capital', military: { soldiers: 300 } } },
    warMissions: [],
    territories: [{
      id: 'camp-1',
      x: 3,
      y: 0,
      naturalName: 'Forest Camp',
      owner: 'tribe',
      status: 'discovered',
      defense: 200,
      recommendedSoldiers: 200,
      garrison: { id: 'garrison-1' },
      defenderLeader: { id: 'defender-1' },
    }],
  };
  const startedBattle = Conquest.startConquest(battleState, 'camp-1', { soldiers: 220, leader: 'leader-1' }, now);
  assert.equal(startedBattle.success, true);
  assert.equal(startedBattle.mission.mode, 'conquest');
  assert.equal(startedBattle.mission.expedition.leaderSnapshot.name, '先锋');
  battleState.warMissions[0].status = 'ready';
  const claimedBattle = Conquest.claimConquest(battleState, 'camp-1', now);
  assert.equal(claimedBattle.success, true);
  assert.equal(claimedBattle.outcome, 'success');
  assert.equal(claimedBattle.casualties, 30);
  assert.equal(battleState.cities.capital.military.soldiers, 270);
  assert.equal(battleState.territories[0].garrison, null);
  assert.equal(battleState.territories[0].lastBattle.leaderGrowth.leader, 'leader-1');
  assert.deepEqual(experienceGrants[0], { leader: 'leader-1', experience: { leader: 12 } });
});

test('territory state normalizer owns territory, mission, and world sync contracts', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const calls = {
    boundSites: [],
    ensuredMaps: 0,
    migrated: [],
    readiness: 0,
    limited: 0,
  };
  const Normalizer = createTerritoryStateNormalizer({
    WorldMapService: {
      getTileId: (q, r) => `tile_${q}_${r}`,
      getWorldMapVersion: (worldMap) => worldMap?.version || 1,
      buildScoutRoute: ({ q, r }, direction, actionPoints) => Array.from({ length: actionPoints }, (_, index) => ({
        q: direction === 'e' ? q + index + 1 : q,
        r,
        step: index + 1,
      })),
      ensureWorldMap: (gameState) => {
        calls.ensuredMaps += 1;
        gameState.worldMap = gameState.worldMap || { version: 1, seed: 'seed', tiles: [] };
        gameState.worldMap.tiles = gameState.worldMap.tiles || [];
        return gameState.worldMap;
      },
      revealTile: (gameState, q, r) => {
        const tile = { id: `tile_${q}_${r}`, q, r, discovered: true, terrain: 'plains' };
        gameState.worldMap.tiles.push(tile);
        return tile;
      },
      bindSiteToTile: (gameState, x, y, siteId, _now, options) => {
        calls.boundSites.push({ x, y, siteId, options });
        const tileId = `tile_${x}_${y}`;
        const tile = (gameState.worldMap.tiles || []).find((item) => item.id === tileId);
        if (tile) tile.siteId = siteId;
      },
    },
    enforceScoutMissionLimit: (gameState) => {
      calls.limited += 1;
      return gameState.warMissions;
    },
    getMissionSoldierAllocations: (mission) => mission.soldierAllocations || [{ cityId: 'capital', soldiers: 200 }],
    migrateTerritorySitesToCurrentWorldRules: (_gameState, previousWorldMapVersion, timestamp) => {
      calls.migrated.push({ previousWorldMapVersion, timestamp: timestamp.toISOString() });
      return false;
    },
    normalizeBattleTarget: (target) => ({ ...target, normalized: true }),
    normalizeDirection: (direction) => (direction === 'bad' ? null : direction),
    normalizeGarrison: (raw, territory) => (territory.owner === 'tribe'
      ? { id: `garrison_${territory.id}`, siteId: territory.id, leader: { id: 'leader-1' } }
      : raw || null),
    normalizeScoutCoordinates: (coordinates) => (Array.isArray(coordinates) ? coordinates : [])
      .filter((coord) => coord?.result)
      .sort((a, b) => a.x - b.x),
    normalizeScoutReport: (report) => (report ? { ...report, normalized: true } : null),
    normalizeScoutReports: (reports) => (Array.isArray(reports) ? reports : []),
    normalizeScoutState: (state) => ({ emptyStreak: 0, areas: [], ...(state || {}) }),
    updateMissionReadiness: (gameState) => {
      calls.readiness += 1;
      gameState.warMissions = gameState.warMissions.map((mission) => (
        mission.id === 'scout-ready' ? { ...mission, status: 'ready' } : mission
      ));
      return gameState.warMissions;
    },
    upsertScoutCoordinateRecord: (gameState, record) => {
      gameState.scoutedCoordinates = [...(gameState.scoutedCoordinates || []), record]
        .filter((coord, index, all) => index === all.findIndex((item) => item.x === coord.x && item.y === coord.y));
      return record;
    },
  });

  const gameState = {
    polity: { name: '  River League  ', capitalCityName: '  Capital  ', color: '#abc' },
    worldMap: {
      version: 7,
      seed: 'seed',
      tiles: [
        { id: 'tile_0_0', q: 0, r: 0, discovered: true },
        { id: 'tile_1_0', q: 1, r: 0, discovered: true, siteId: 'ghost-site' },
        { id: 'tile_2_0', q: 2, r: 0, discovered: true },
      ],
    },
    territories: [
      { id: 'river_plain', status: 'scouted', naturalName: 'Legacy River' },
      { id: 'camp-1', x: 3, y: 0, type: 'camp', owner: 'tribe', status: 'discovered', defense: 5, recommendedSoldiers: 7 },
      { id: 'zero', x: 0, y: 0, status: 'discovered' },
    ],
    warMissions: [
      { id: 'bad-scout', kind: 'scout', direction: 'bad' },
      {
        id: 'scout-ready',
        kind: 'scout',
        direction: 'e',
        originX: 0,
        originY: 0,
        targetX: 2,
        targetY: 0,
        actionPoints: 2,
        status: 'active',
      },
      {
        id: 'conquest-1',
        kind: 'conquest',
        territoryId: 'camp-1',
        soldiersCommitted: 2,
        expedition: { soldiers: 2, troopType: 'spears', leader: 'leader-1' },
        status: 'ready',
      },
    ],
    scoutReports: [{ id: 'report-1' }],
    scoutedCoordinates: [{ x: 9, y: 9, result: 'empty' }],
    scoutState: { emptyStreak: 2 },
  };

  Normalizer.normalizeTerritoryState(gameState, now);

  assert.equal(gameState.territories[0].id, 'capital');
  assert.equal(gameState.territories.some((territory) => territory.id === 'zero'), false);
  const legacy = gameState.territories.find((territory) => territory.id === 'river_plain');
  assert.equal(legacy.x, 1);
  assert.equal(legacy.y, 0);
  assert.equal(legacy.status, 'discovered');
  assert.equal(legacy.owner, 'neutral');
  const camp = gameState.territories.find((territory) => territory.id === 'camp-1');
  assert.equal(camp.defense, 500);
  assert.equal(camp.garrison.siteId, 'camp-1');
  assert.deepEqual(gameState.warMissions.map((mission) => mission.id), ['scout-ready', 'conquest-1']);
  assert.equal(gameState.warMissions[0].status, 'ready');
  assert.equal(gameState.warMissions[0].route.length, 2);
  assert.equal(gameState.warMissions[1].soldiersCommitted, 200);
  assert.equal(gameState.polity.name, 'River League');
  assert.equal(gameState.scoutState.emptyStreak, 2);
  assert.ok(gameState.scoutedCoordinates.some((coord) => coord.siteId === 'camp-1'));
  assert.ok(calls.boundSites.some((call) => call.siteId === 'camp-1' && call.options.visibility === 'scouted'));
  assert.equal(gameState.worldMap.tiles.find((tile) => tile.id === 'tile_1_0').siteId, 'river_plain');
  assert.equal(calls.migrated[0].previousWorldMapVersion, 7);
  assert.equal(calls.readiness, 1);
  assert.equal(calls.limited, 1);
});

test('territory naming module owns city and polity naming contracts', () => {
  const Naming = createTerritoryNaming({
    getTerritory: (gameState, territoryId) => (
      gameState.territories || []
    ).find((territory) => territory.id === territoryId) || null,
  });

  assert.equal(Naming.sanitizeName(''), null);
  assert.equal(Naming.sanitizeName('  '), null);
  assert.equal(Naming.sanitizeName('  123456789012345  '), '123456789012');

  const oneCityState = {
    polity: { name: null, namePrompted: false, capitalCityName: 'Capital' },
    territories: [
      { id: 'capital', status: 'occupied', cityName: 'Capital', naturalName: 'Capital' },
      { id: 'site-1', status: 'discovered', cityName: null, naturalName: 'River Bend' },
    ],
  };
  assert.equal(Naming.getOccupiedCount(oneCityState), 1);
  assert.equal(Naming.renamePolity(oneCityState, 'Alliance').error, 'POLITY_NOT_READY');

  const namingState = {
    polity: { name: null, namePrompted: false, capitalCityName: 'Capital' },
    territories: [
      { id: 'capital', status: 'occupied', cityName: 'Capital', naturalName: 'Capital' },
      { id: 'site-1', status: 'occupied', cityName: null, naturalName: 'River Bend' },
      { id: 'site-2', status: 'discovered', cityName: null, naturalName: 'Hill Gate' },
    ],
  };

  assert.equal(Naming.getPendingCityNamingTerritory(namingState).id, 'site-1');
  assert.equal(Naming.getNamingPrompt(namingState).type, 'city');
  assert.equal(Naming.getNamingPrompt(namingState).territoryId, 'site-1');
  assert.equal(Naming.renameCity(namingState, 'site-1', '  ').error, 'INVALID_NAME');
  assert.equal(Naming.renameCity(namingState, 'site-2', 'Hill City').error, 'TERRITORY_NOT_OCCUPIED');

  const renamedCity = Naming.renameCity(namingState, 'site-1', '  123456789012345  ');
  assert.equal(renamedCity.success, true);
  assert.equal(namingState.territories[1].cityName, '123456789012');
  assert.equal(renamedCity.namingPrompt.type, 'polity');

  const renamedCapital = Naming.renameCity(namingState, 'capital', 'New Capital');
  assert.equal(renamedCapital.success, true);
  assert.equal(namingState.polity.capitalCityName, 'New Capital');

  const renamedPolity = Naming.renamePolity(namingState, '  River League  ');
  assert.equal(renamedPolity.success, true);
  assert.equal(namingState.polity.name, 'River League');
  assert.equal(namingState.polity.namePrompted, true);
  assert.equal(renamedPolity.namingPrompt, null);
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
