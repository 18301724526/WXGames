const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AoiSyncSnapshot,
  CommandAuthorityContract,
  ServerTimelineSnapshot,
} = require('../services/realtime');

function createMission(overrides = {}) {
  return {
    id: 'explore-1',
    kind: 'worldExplore',
    mode: 'manual',
    status: 'active',
    origin: { q: 0, r: 0, tileId: 'tile_0_0' },
    position: { q: 0, r: 0, tileId: 'tile_0_0' },
    target: { q: 2, r: 0, tileId: 'tile_2_0' },
    route: [
      { q: 1, r: 0, tileId: 'tile_1_0', step: 1 },
      { q: 2, r: 0, tileId: 'tile_2_0', step: 2 },
    ],
    formation: { cityId: 'capital', slot: 1, memberIds: ['fp-1'] },
    stepDurationMs: 10000,
    startedAt: '2026-06-06T00:00:00.000Z',
    nextStepAt: '2026-06-06T00:00:10.000Z',
    completesAt: '2026-06-06T00:00:20.000Z',
    ...overrides,
  };
}

function createGameState() {
  return {
    playerId: 'realtime-contract-test',
    worldMap: {
      seed: 'realtime-contract-seed',
      version: 7,
      tiles: [
        { id: 'tile_0_0', q: 0, r: 0, terrain: 'plains', visibility: 'controlled' },
        { id: 'tile_1_0', q: 1, r: 0, terrain: 'forest', visibility: 'scouted' },
        { id: 'tile_9_9', q: 9, r: 9, terrain: 'hills', visibility: 'scouted' },
      ],
    },
    territories: [
      { id: 'capital', x: 0, y: 0, owner: 'player', status: 'occupied', type: 'capital' },
      { id: 'far-site', x: 9, y: 9, owner: 'neutral', status: 'discovered', type: 'camp' },
    ],
    exploreMissions: [createMission()],
  };
}

test('ServerTimelineSnapshot derives server-owned movement interpolation and stop tile', () => {
  const now = new Date('2026-06-06T00:00:06.000Z');
  const snapshot = ServerTimelineSnapshot.createMissionSnapshot(createMission(), { now });

  assert.equal(snapshot.schema, 'server-timeline-snapshot-v1');
  assert.equal(snapshot.authority, undefined);
  assert.equal(snapshot.missionId, 'explore-1');
  assert.equal(snapshot.current.q > 0, true);
  assert.equal(snapshot.current.q < 1, true);
  assert.equal(snapshot.stopTile.tileId, 'tile_1_0');
  assert.equal(snapshot.interpolation.authority, 'server');
  assert.equal(snapshot.interpolation.clientMayInterpolate, true);
});

test('AoiSyncSnapshot returns bounded area data instead of full world payloads', () => {
  const gameState = createGameState();
  const snapshot = AoiSyncSnapshot.createSnapshot(gameState, {
    now: new Date('2026-06-06T00:00:06.000Z'),
    mission: gameState.exploreMissions[0],
    radius: 2,
  });

  assert.equal(snapshot.schema, 'aoi-sync-snapshot-v1');
  assert.equal(snapshot.worldMapVersion, 7);
  assert.equal(snapshot.tiles.some((tile) => tile.id === 'tile_0_0'), true);
  assert.equal(snapshot.tiles.some((tile) => tile.id === 'tile_9_9'), false);
  assert.equal(snapshot.territories.some((site) => site.id === 'capital'), true);
  assert.equal(snapshot.territories.some((site) => site.id === 'far-site'), false);
  assert.deepEqual(snapshot.counts, {
    tiles: snapshot.tiles.length,
    territories: snapshot.territories.length,
    missions: snapshot.missions.length,
  });
});

test('AoiSyncSnapshot treats wrapped edge tiles and territories as inside the radius', () => {
  const gameState = createGameState();
  gameState.worldMap.tiles.push({
    id: 'tile_1023_0',
    q: 1023,
    r: 0,
    terrain: 'forest',
    visibility: 'scouted',
    discovered: true,
    visible: true,
  });
  gameState.territories.push({
    id: 'edge-site',
    x: 1023,
    y: 0,
    owner: 'neutral',
    status: 'discovered',
    type: 'town',
  });

  const snapshot = AoiSyncSnapshot.createSnapshot(gameState, {
    now: new Date('2026-06-06T00:00:06.000Z'),
    center: { q: 0, r: 0 },
    radius: 1,
  });

  assert.equal(snapshot.tiles.some((tile) => tile.id === 'tile_1023_0'), true);
  assert.equal(snapshot.territories.some((site) => site.id === 'edge-site'), true);
});

test('CommandAuthorityContract wraps accepted and rejected commands consistently', () => {
  const accepted = CommandAuthorityContract.accept({
    type: 'stopWorldMarch',
    actorId: 'explore-1',
    playerId: 'player-1',
    serverTime: '2026-06-06T00:00:06.000Z',
  });
  const rejected = CommandAuthorityContract.attach({
    success: false,
    error: 'MISSION_NOT_FOUND',
    message: 'missing',
  }, {
    type: 'stopWorldMarch',
    actorId: 'missing',
    serverTime: '2026-06-06T00:00:06.000Z',
  });

  assert.equal(accepted.schema, 'command-authority-contract-v1');
  assert.equal(accepted.status, 'accepted');
  assert.equal(accepted.authority.owner, 'server');
  assert.equal(accepted.authority.frontendRole, 'intent-only');
  assert.equal(rejected.authority.status, 'rejected');
  assert.equal(rejected.authority.rejection.error, 'MISSION_NOT_FOUND');
});

test('CommandAuthorityContract preserves only compact client input evidence', () => {
  const accepted = CommandAuthorityContract.accept({
    type: 'startWorldMarch',
    actorId: 'explore-1',
    playerId: 'player-1',
    serverTime: '2026-06-06T00:00:06.000Z',
    clientInputIntent: {
      schema: 'world-map-input-intent-v1',
      kind: 'tap',
      inputId: 'wmi-run-a-7',
      clientSequence: 7,
      points: {
        physical: { x: 12, y: 34 },
        layer: { x: 112, y: 234 },
      },
      action: {
        type: 'startWorldMarch',
        tileId: 'tile_4_-2',
        targetQ: 4,
        targetR: -2,
        rendererPayload: 'x'.repeat(3000),
      },
      target: { kind: 'tile', tileId: 'tile_4_-2', targetQ: 4, targetR: -2 },
      picking: { inputEpoch: 7, signature: 'sig-7', counts: { targets: 5 } },
      view: { camera: { x: 1, y: 2 }, viewport: { scale: 1.25 } },
      tileMapView: { tiles: Array.from({ length: 100 }, (_, index) => ({ id: `tile_${index}` })) },
    },
  });
  const evidenceText = JSON.stringify(accepted.command.clientInput);

  assert.equal(accepted.command.clientInput.schema, 'world-map-input-intent-v1');
  assert.equal(accepted.command.clientInput.inputId, 'wmi-run-a-7');
  assert.equal(accepted.command.clientInput.clientSequence, 7);
  assert.equal(accepted.command.clientInput.target.tileId, 'tile_4_-2');
  assert.equal(accepted.command.clientInput.picking.inputEpoch, 7);
  assert.equal(evidenceText.includes('tileMapView'), false);
  assert.equal(evidenceText.includes('rendererPayload'), false);
  assert.ok(evidenceText.length < 1600);
});
