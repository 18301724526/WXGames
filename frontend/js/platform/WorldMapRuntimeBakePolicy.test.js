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

test('WorldMapRuntimeBakePolicy fallback signature follows continuous fog reveal progress', () => {
  const startedAt = Date.parse('2026-06-06T00:00:00.000Z');
  const state = createState('active');
  state.worldExplorerState.activeMission = {
    ...state.worldExplorerState.activeMission,
    origin: { q: 0, r: 0, tileId: 'tile_0_0' },
    route: [
      { q: 1, r: 0, tileId: 'tile_1_0', step: 1, revealed: false },
      { q: 2, r: 0, tileId: 'tile_2_0', step: 2, revealed: false },
    ],
    target: { q: 2, r: 0, tileId: 'tile_2_0' },
    startedAt: new Date(startedAt).toISOString(),
    stepDurationMs: 10000,
    revealedTileIds: [],
  };

  const early = WorldMapRuntimeBakePolicy.getMapDataSignature(state, { epochNowMs: startedAt + 1000 });
  const later = WorldMapRuntimeBakePolicy.getMapDataSignature(state, { epochNowMs: startedAt + 5000 });

  assert.notEqual(early, later);
  assert.equal(early.includes('"revealedTileIds":[]'), true);
  assert.equal(later.includes('"revealedTileIds":[]'), true);
});

test('WorldMapRuntimeBakePolicy fallback signature canonicalizes stable x/y and legacy q/r map shapes', () => {
  const stableShape = {
    territoryState: {
      worldMap: {
        version: 1,
        seed: 'fallback-signature-seed',
        tiles: [
          { id: 'legacy-renderer-id', x: 2, y: -1, q: 99, r: 99, terrain: 'forest', siteId: 'site_2_-1' },
        ],
      },
      territories: [
        { id: 'site_2_-1', x: 2, y: -1, type: 'town', owner: 'neutral', status: 'discovered', cityName: 'Stable City' },
      ],
      scoutMissions: [{
        id: 'scout-stable',
        status: 'active',
        position: { x: 2, y: -1, tileId: 'legacy-position' },
        route: [{ x: 2, y: -1, step: 1, tileId: 'legacy-route', revealed: true }],
        revealArea: [{ x: 3, y: -1, step: 2, tileId: 'legacy-reveal', revealed: false }],
        revealedTileIds: ['tile_2_-1'],
        actionPointsRemaining: 1,
      }],
    },
    worldExplorerState: {
      activeMission: {
        id: 'explore-stable',
        status: 'active',
        position: { x: 4, y: -2, tileId: 'legacy-position' },
        route: [{ x: 4, y: -2, step: 1, tileId: 'legacy-route', revealed: true }],
        plannedTiles: [{ id: 'legacy-planned-id', x: 4, y: -2, terrain: 'hills' }],
        plannedSites: [{
          tileId: 'legacy-site-tile',
          siteId: 'site_4_-2',
          materialized: true,
          site: { id: 'site_4_-2', x: 4, y: -2, type: 'town', owner: 'neutral', status: 'discovered' },
        }],
        revealedTileIds: ['tile_4_-2'],
      },
      idleMissions: [],
    },
  };
  const legacyShape = {
    territoryState: {
      worldMap: {
        version: 1,
        seed: 'fallback-signature-seed',
        tiles: [
          { q: 2, r: -1, terrain: 'forest', siteId: 'site_2_-1' },
        ],
      },
      territories: [
        { id: 'site_2_-1', q: 2, r: -1, type: 'town', owner: 'neutral', status: 'discovered', cityName: 'Stable City' },
      ],
      scoutMissions: [{
        id: 'scout-stable',
        status: 'active',
        position: { q: 2, r: -1 },
        route: [{ q: 2, r: -1, step: 1, revealed: true }],
        revealArea: [{ q: 3, r: -1, step: 2, revealed: false }],
        revealedTileIds: ['tile_2_-1'],
        actionPointsRemaining: 1,
      }],
    },
    worldExplorerState: {
      activeMission: {
        id: 'explore-stable',
        status: 'active',
        position: { q: 4, r: -2 },
        route: [{ q: 4, r: -2, step: 1, revealed: true }],
        plannedTiles: [{ q: 4, r: -2, terrain: 'hills' }],
        plannedSites: [{
          siteId: 'site_4_-2',
          materialized: true,
          site: { id: 'site_4_-2', q: 4, r: -2, type: 'town', owner: 'neutral', status: 'discovered' },
        }],
        revealedTileIds: ['tile_4_-2'],
      },
      idleMissions: [],
    },
  };

  assert.equal(
    WorldMapRuntimeBakePolicy.getMapDataSignature(stableShape),
    WorldMapRuntimeBakePolicy.getMapDataSignature(legacyShape),
  );
});

test('WorldMapRuntimeBakePolicy fallback signature folds revealed route aliases to canonical tile ids', () => {
  const createAliasState = (routeTileId, scoutRevealedTileIds, explorerRevealedTileIds) => ({
    territoryState: {
      worldMap: {
        version: 1,
        seed: 'route-alias-seed',
        tiles: [{ q: 0, r: 0, terrain: 'plains' }],
      },
      territories: [],
      scoutMissions: [{
        id: 'scout-route-alias',
        status: 'active',
        route: [{ q: 2, r: -1, step: 1, tileId: routeTileId, revealed: true }],
        revealedTileIds: scoutRevealedTileIds,
      }],
    },
    worldExplorerState: {
      activeMission: {
        id: 'explore-route-alias',
        status: 'active',
        route: [{ q: 4, r: -2, step: 1, tileId: routeTileId, revealed: true }],
        plannedTiles: [{ q: 4, r: -2, id: 'legacy-planned-id', terrain: 'hills' }],
        revealedTileIds: explorerRevealedTileIds,
      },
      idleMissions: [],
    },
  });

  const staleSignature = WorldMapRuntimeBakePolicy.getMapDataSignature(createAliasState('legacy-route-a', ['legacy-route-a'], ['legacy-route-a']));
  const canonicalSignature = WorldMapRuntimeBakePolicy.getMapDataSignature(createAliasState('legacy-route-b', ['tile_2_-1'], ['tile_4_-2']));

  assert.equal(staleSignature, canonicalSignature);
  assert.equal(staleSignature.includes('legacy-route'), false);
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
