const test = require('node:test');
const assert = require('node:assert/strict');

const WorldMapRuntimeBakePolicy = require('./WorldMapRuntimeBakePolicy');

function createState(explorerStatus = 'active') {
  return {
    territoryState: {
      worldMap: {
        version: 3,
        seed: 'seed',
        tiles: [{
          id: 'tile_0_0',
          q: 0,
          r: 0,
          terrain: 'plains',
          discovered: true,
          visible: true,
          riverPorts: ['east'],
        }],
      },
      territories: [{ id: 'capital', x: 0, y: 0, type: 'capital', owner: 'player' }],
      scoutMissions: [{ id: 'scout-1', status: 'ready', route: [{ q: 1, r: 0 }], revealedTileIds: ['tile_1_0'] }],
    },
    worldExplorerState: {
      activeMission: explorerStatus ? {
        id: 'explore-1',
        status: explorerStatus,
        route: [{ q: 1, r: 0, tileId: 'tile_1_0', revealed: explorerStatus === 'ready' }],
        plannedTiles: [{ id: 'tile_1_0', q: 1, r: 0, terrain: 'plains' }],
        plannedSites: [{ siteId: 'site_1_0', tileId: 'tile_1_0', materialized: explorerStatus === 'ready' }],
        revealedTileIds: explorerStatus === 'ready' ? ['tile_1_0'] : [],
      } : null,
      readyMissions: [],
      idleMissions: [],
    },
  };
}

test('WorldMapRuntimeBakePolicy delegates map data signature to presenter when available', () => {
  const calls = [];
  const presenter = {
    getWorldTileMapSignature(territoryState, worldExplorerState, options) {
      calls.push({ territoryState, worldExplorerState, options });
      return `presenter:${territoryState.worldMap.version}:${worldExplorerState.activeMission.status}:${options.epochNowMs}`;
    },
  };
  const state = createState('active');

  assert.equal(
    WorldMapRuntimeBakePolicy.getMapDataSignature(state, { presenter, epochNowMs: 1234 }),
    'presenter:3:active:1234',
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].territoryState, state.territoryState);
  assert.equal(calls[0].worldExplorerState, state.worldExplorerState);
});

test('WorldMapRuntimeBakePolicy fallback signature includes world explorer state', () => {
  const activeSignature = WorldMapRuntimeBakePolicy.getMapDataSignature(createState('active'));
  const readySignature = WorldMapRuntimeBakePolicy.getMapDataSignature(createState('ready'));

  assert.notEqual(activeSignature, readySignature);
  assert.equal(activeSignature.includes('explore-1'), true);
  assert.equal(readySignature.includes('site_1_0'), true);
});

test('WorldMapRuntimeBakePolicy reports sync and dirty states without mutating runtime', () => {
  assert.deepEqual(WorldMapRuntimeBakePolicy.getSignatureSyncResult('', 'abc'), {
    signature: 'abc',
    changed: true,
    hadPreviousSignature: false,
    shouldInvalidateBake: false,
  });
  assert.deepEqual(WorldMapRuntimeBakePolicy.getSignatureSyncResult('abc', 'def'), {
    signature: 'def',
    changed: true,
    hadPreviousSignature: true,
    shouldInvalidateBake: true,
  });
  assert.deepEqual(WorldMapRuntimeBakePolicy.getSignatureSyncResult('abc', 'abc'), {
    signature: 'abc',
    changed: false,
    hadPreviousSignature: true,
    shouldInvalidateBake: false,
  });

  const state = createState('active');
  const options = { presenter: { getWorldTileMapSignature: () => 'same' } };
  assert.equal(WorldMapRuntimeBakePolicy.isMapBakeDirty({
    hasBakedMapLayer: false,
    mapBakeDirty: false,
    lastMapDataSignature: 'same',
  }, state, options), true);
  assert.equal(WorldMapRuntimeBakePolicy.isMapBakeDirty({
    hasBakedMapLayer: true,
    mapBakeDirty: true,
    lastMapDataSignature: 'same',
  }, state, options), true);
  assert.equal(WorldMapRuntimeBakePolicy.isMapBakeDirty({
    hasBakedMapLayer: true,
    mapBakeDirty: false,
    lastMapDataSignature: 'same',
  }, state, options), false);
});
