const test = require('node:test');
const assert = require('node:assert/strict');

const DtoMapper = require('../services/worldExplorer/WorldExplorerDtoMapper');
const ClientState = require('../services/worldExplorer/WorldExplorerClientState');

function createMission(overrides = {}) {
  return {
    id: 'mission-1',
    kind: 'worldExplore',
    mode: 'manual',
    status: 'active',
    origin: { q: 0, r: 0, tileId: 'tile_0_0', cityId: 'capital' },
    homeOrigin: { q: 0, r: 0, tileId: 'tile_0_0', cityId: 'capital' },
    target: { q: 2, r: 0, tileId: 'tile_2_0' },
    position: { q: 1, r: 0, tileId: 'tile_1_0' },
    route: [
      { q: 1, r: 0, tileId: 'tile_1_0', step: 1, revealed: true, revealedAt: '2026-06-06T00:00:10.000Z' },
      { q: 2, r: 0, tileId: 'tile_2_0', step: 2, revealed: false },
    ],
    plannedTiles: [{ id: 'tile_2_0', q: 2, r: 0, terrain: 'forest' }],
    plannedSites: [{
      tileId: 'tile_2_0',
      q: 2,
      r: 0,
      siteId: 'site_2_0',
      materialized: false,
      site: { id: 'site_2_0', x: 2, y: 0, owner: 'neutral' },
    }],
    formation: { cityId: 'capital', slot: 1, memberIds: ['fp-1'] },
    formationSnapshot: {
      schema: 'formation-snapshot-v1',
      sourceCityId: 'capital',
      slot: 1,
      members: [{ personId: 'fp-1', soldiersCommitted: 120, soldiersRemaining: 90 }],
      soldiersCommitted: 120,
      soldiersRemaining: 90,
      lockedAt: '2026-06-06T00:00:00.000Z',
      settledAt: null,
    },
    revealedTileIds: ['tile_1_0'],
    stepDurationMs: 10000,
    startedAt: '2026-06-06T00:00:00.000Z',
    nextStepAt: '2026-06-06T00:00:20.000Z',
    completesAt: '2026-06-06T00:00:20.000Z',
    ...overrides,
  };
}

test('WorldExplorerDtoMapper maps a mission into the public API shape', () => {
  const dto = DtoMapper.getMissionDto(createMission(), new Date('2026-06-06T00:00:12.000Z'));

  assert.equal(dto.id, 'mission-1');
  assert.equal(dto.kind, 'worldExplore');
  assert.equal(dto.remainingSeconds, 8);
  assert.equal(dto.position.tileId, 'tile_1_0');
  assert.equal(dto.stepDurationSeconds, 10);
  assert.deepEqual(dto.route.map((step) => step.tileId), ['tile_1_0', 'tile_2_0']);
  assert.equal(dto.plannedSites[0].site.id, 'site_2_0');
  assert.equal(dto.formationSnapshot.soldiersCommitted, 120);
  assert.equal(dto.formationSnapshot.soldiersRemaining, 90);
});

test('WorldExplorerDtoMapper derives public tile identity from coordinates', () => {
  const dto = DtoMapper.getMissionDto(createMission({
    origin: { q: 0, r: 0, tileId: 'stale-origin-tile', cityId: 'capital' },
    homeOrigin: { q: 0, r: 0, tileId: 'stale-home-tile', cityId: 'capital' },
    target: { q: 2, r: -1, tileId: 'stale-target-tile' },
    position: { q: 1, r: -1, tileId: 'stale-position-tile' },
    route: [
      { q: 1, r: -1, tileId: 'stale-route-tile', step: 1, revealed: true },
      { q: 2, r: -1, tileId: 'stale-route-target', step: 2, revealed: false },
    ],
    plannedTiles: [{ id: 'stale-planned-tile', q: 2, r: -1, terrain: 'forest' }],
    plannedSites: [{
      tileId: 'stale-planned-site-tile',
      q: 2,
      r: -1,
      siteId: 'site_2_-1',
      materialized: false,
      site: { id: 'site_2_-1', x: 2, y: -1, owner: 'neutral' },
    }],
  }), new Date('2026-06-06T00:00:12.000Z'));

  assert.equal(dto.origin.tileId, 'tile_0_0');
  assert.equal(dto.homeOrigin.tileId, 'tile_0_0');
  assert.equal(dto.target.tileId, 'tile_2_-1');
  assert.equal(dto.position.tileId, 'tile_1_-1');
  assert.deepEqual(dto.route.map((step) => step.tileId), ['tile_1_-1', 'tile_2_-1']);
  assert.deepEqual(dto.plannedTiles.map((tile) => tile.id), ['tile_2_-1']);
  assert.deepEqual(dto.plannedSites.map((site) => site.tileId), ['tile_2_-1']);
});

test('WorldExplorerDtoMapper derives public revealed route identity from coordinate-bearing route aliases', () => {
  const dto = DtoMapper.getMissionDto(createMission({
    revealedTileIds: ['legacy-route-1'],
    route: [
      { q: 1, r: 0, tileId: 'legacy-route-1', step: 1 },
      { q: 2, r: 0, tileId: 'legacy-route-2', step: 2 },
    ],
  }), new Date('2026-06-06T00:00:12.000Z'));

  assert.deepEqual(dto.revealedTileIds, ['tile_1_0']);
  assert.equal(dto.route[0].revealed, true);
  assert.equal(JSON.stringify(dto).includes('legacy-route'), false);
});

test('WorldExplorerDtoMapper keeps area visibility separate from route arrival', () => {
  const dto = DtoMapper.getMissionDto(createMission({
    id: 'return-home',
    origin: { q: 2, r: 0, tileId: 'tile_2_0', cityId: 'capital' },
    homeOrigin: { q: 0, r: 0, tileId: 'tile_0_0', cityId: 'capital' },
    target: { q: 0, r: 0, tileId: 'tile_0_0' },
    position: { q: 1, r: 0, tileId: 'tile_1_0' },
    route: [
      { q: 1, r: 0, tileId: 'tile_1_0', step: 1, revealed: true },
      { q: 0, r: 0, tileId: 'tile_0_0', step: 2, revealed: false },
    ],
    revealedTileIds: ['tile_1_0', 'tile_0_0'],
    startedAt: '2026-06-06T00:00:40.000Z',
    nextStepAt: '2026-06-06T00:01:00.000Z',
    completesAt: '2026-06-06T00:01:00.000Z',
  }), new Date('2026-06-06T00:00:55.000Z'));

  assert.deepEqual(dto.route.map((step) => step.revealed), [true, false]);
  assert.equal(dto.position.tileId, 'tile_1_0');
  assert.deepEqual(dto.revealedTileIds, ['tile_1_0', 'tile_0_0']);
});

test('WorldExplorerDtoMapper groups active and idle DTOs without retired ready reports', () => {
  const state = DtoMapper.getClientStateDto([
    createMission({ id: 'active-1', status: 'active' }),
    createMission({ id: 'ready-1', status: 'ready' }),
    createMission({ id: 'idle-1', status: 'idle' }),
  ], { now: new Date('2026-06-06T00:00:12.000Z') });

  assert.equal(state.missions.length, 2);
  assert.equal(state.activeMission.id, 'active-1');
  assert.equal(Object.prototype.hasOwnProperty.call(state, 'readyMissions'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(state, 'randomRouteLength'), false);
  assert.deepEqual(state.idleMissions.map((mission) => mission.id), ['idle-1']);
  assert.deepEqual(state.busyFormations.map((item) => `${item.missionId}:${item.status}`), ['active-1:active']);
  assert.equal(state.stepDurationSeconds, 5); // EXPLORE_STEP_DURATION_MS = 5s (manual-march cadence)
  // Route world-bounds are delivered so the client's optimistic route + preview compute with the
  // SAME inputs the backend planner uses (single source = WorldMapConstants) — no divergence.
  assert.equal(state.worldWidth, 1024);
  assert.equal(state.worldHeight, 1024);
  assert.equal(state.worldWrapping, true);
});

test('WorldExplorerClientState keeps legacy API by delegating to DTO mapper after progression', () => {
  const gameState = {
    worldMap: { seed: 'dto-test', tiles: [] },
    exploreMissions: [createMission()],
    tutorial: { completed: true },
  };
  const now = new Date('2026-06-06T00:00:12.000Z');
  const viaClient = ClientState.getClientMission(gameState.exploreMissions[0], now);
  const viaMapper = DtoMapper.getMissionDto(gameState.exploreMissions[0], now);
  const clientState = ClientState.getClientState(gameState, now);

  assert.deepEqual(viaClient, viaMapper);
  assert.equal(clientState.activeMission.id, 'mission-1');
  assert.equal(clientState.activeMission.remainingSeconds, 8);
});
