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
const createTerritoryScoutRecords = require('../services/territory/TerritoryScoutRecords');

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
    'TerritoryScoutRecords.js',
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
