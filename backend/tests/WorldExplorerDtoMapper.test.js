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
});

test('WorldExplorerDtoMapper groups active, ready, idle, and busy formation DTOs', () => {
  const state = DtoMapper.getClientStateDto([
    createMission({ id: 'active-1', status: 'active' }),
    createMission({ id: 'ready-1', status: 'ready' }),
    createMission({ id: 'idle-1', status: 'idle' }),
  ], { now: new Date('2026-06-06T00:00:12.000Z') });

  assert.equal(state.missions.length, 3);
  assert.equal(state.activeMission.id, 'active-1');
  assert.deepEqual(state.readyMissions.map((mission) => mission.id), ['ready-1']);
  assert.deepEqual(state.idleMissions.map((mission) => mission.id), ['idle-1']);
  assert.deepEqual(state.busyFormations.map((item) => `${item.missionId}:${item.status}`), ['active-1:active', 'ready-1:ready']);
  assert.equal(state.stepDurationSeconds, 10);
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
