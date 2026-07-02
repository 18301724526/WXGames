const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasGameRenderer = require('./CanvasGameRenderer');
const { createWorldMapCacheState } = require('./renderers/WorldMapCacheState');

// Characterization tests for the CanvasGameRenderer world-tile-map CACHE cluster
// (god-file re-decomposition slice 13). Written against the renderer BEFORE
// WorldTileMapCacheCoordinator was extracted and kept unchanged afterwards. They lock
// the externally observable behavior of the worldMapCacheState-backed accessors, the
// options.worldMapCacheState override/seeding contract, the assetsChanged/invalidation
// methods on BOTH dispatch paths (live composed assetRenderer sharing the renderer's
// cache container, and the local fallback with assetRenderer absent), and the
// resolveWorldTileMapView cached-view reuse guard + getWorldTileMapFallbackSignature
// cache-key computation.

function createRenderer(options = {}) {
  return new CanvasGameRenderer({ ctx: { scale() {} }, presenter: {}, ...options });
}

function createBareRenderer(options = {}) {
  const renderer = createRenderer(options);
  renderer.assetRenderer = null;
  return renderer;
}

test('cache accessors read/write the shared worldMapCacheState container with coercion', () => {
  const renderer = createRenderer();

  assert.equal(renderer.worldTileFastDragActive, false);
  renderer.worldTileFastDragActive = 1;
  assert.equal(renderer.worldTileFastDragActive, true);
  assert.equal(renderer.worldMapCacheState.worldTileFastDragActive, true);

  renderer.worldTileStaticCacheKey = 42;
  assert.equal(renderer.worldTileStaticCacheKey, '42');
  assert.equal(renderer.worldMapCacheState.worldTileStaticCacheKey, '42');
  renderer.worldTileStaticCacheKey = '';
  assert.equal(renderer.worldTileStaticCacheKey, '');

  renderer.worldTileStaticChunkCacheTick = '7';
  assert.equal(renderer.worldTileStaticChunkCacheTick, 7);
  renderer.worldTileStaticChunkCacheTick = 'nope';
  assert.equal(renderer.worldTileStaticChunkCacheTick, 0);

  const cache = { canvas: {} };
  renderer.worldTileStaticCache = cache;
  assert.equal(renderer.worldTileStaticCache, cache);
  renderer.worldTileStaticCache = undefined;
  assert.equal(renderer.worldTileStaticCache, null);
  assert.equal(renderer.worldMapCacheState.worldTileStaticCache, null);

  assert.equal(renderer.worldTileMaskCache instanceof Map, true);
  assert.equal(renderer.worldTileStaticChunkCaches instanceof Map, true);

  const handler = () => {};
  renderer.assetsChangedHandler = handler;
  assert.equal(renderer.assetsChangedHandler, handler);
  renderer.assetsChangedHandler = 'not-a-function';
  assert.equal(renderer.assetsChangedHandler, null);
  assert.equal(renderer.worldMapCacheState.assetsChangedHandler, null);
});

test('options.worldMapCacheState override is adopted as-is and stays the accessor backing', () => {
  const container = createWorldMapCacheState({ worldTileStaticCacheKey: 'seed' });
  const renderer = createRenderer({ worldMapCacheState: container });

  assert.equal(renderer.worldMapCacheState, container);
  assert.equal(renderer.worldTileStaticCacheKey, 'seed');

  renderer.worldTileStaticCacheKey = 'next';
  assert.equal(container.worldTileStaticCacheKey, 'next');
  container.worldTileViewCache = { view: { tiles: [] } };
  assert.equal(renderer.worldTileViewCache, container.worldTileViewCache);
});

test('constructor options seed a fresh worldMapCacheState when no override is given', () => {
  const renderer = createRenderer({
    worldTileFastDragActive: true,
    worldTileWaterLayerCacheKey: 'water-key',
  });
  assert.equal(renderer.worldTileFastDragActive, true);
  assert.equal(renderer.worldTileWaterLayerCacheKey, 'water-key');
  assert.equal(renderer.worldMapCacheState.worldTileWaterLayerCacheKey, 'water-key');
});

test('invalidateWorldTileViewCache local fallback clears the view/entry cache fields', () => {
  const renderer = createBareRenderer();
  renderer.worldTileViewCache = { view: {} };
  renderer.worldTileVisibleEntriesCache = { entries: [] };
  renderer.worldTileLocalEntriesCache = { entries: [] };

  assert.equal(renderer.invalidateWorldTileViewCache(), undefined);
  assert.equal(renderer.worldTileViewCache, null);
  assert.equal(renderer.worldTileVisibleEntriesCache, null);
  assert.equal(renderer.worldTileLocalEntriesCache, null);
  assert.equal(renderer.worldMapCacheState.worldTileViewCache, null);
  assert.equal(renderer.worldMapCacheState.worldTileVisibleEntriesCache, null);
  assert.equal(renderer.worldMapCacheState.worldTileLocalEntriesCache, null);
});

test('invalidateWorldTileCaches local fallback only chains to the view cache invalidation', () => {
  const renderer = createBareRenderer();
  renderer.worldTileStaticCache = { canvas: {} };
  renderer.worldTileStaticCacheKey = 'static-key';
  renderer.worldTileViewCache = { view: {} };

  renderer.invalidateWorldTileCaches();
  assert.equal(renderer.worldTileViewCache, null);
  // The full static-cache wipe lives on the assetRenderer; the local fallback keeps it.
  assert.deepEqual(renderer.worldTileStaticCache, { canvas: {} });
  assert.equal(renderer.worldTileStaticCacheKey, 'static-key');
});

test('invalidateWorldTileCaches live path wipes static caches through the shared container', () => {
  const renderer = createRenderer();
  assert.equal(typeof renderer.assetRenderer?.invalidateWorldTileCaches, 'function');
  renderer.worldTileStaticCache = { canvas: {} };
  renderer.worldTileStaticCacheKey = 'static-key';
  renderer.worldTileStaticChunkCaches.set('chunk', {});
  renderer.worldTileWaterLayerCacheKey = 'water-key';
  renderer.worldTileViewCache = { view: {} };

  renderer.invalidateWorldTileCaches();
  assert.equal(renderer.worldTileStaticCache, null);
  assert.equal(renderer.worldTileStaticCacheKey, '');
  assert.equal(renderer.worldTileStaticChunkCaches.size, 0);
  assert.equal(renderer.worldTileWaterLayerCacheKey, '');
  assert.equal(renderer.worldTileViewCache, null);
});

test('setAssetsChangedHandler/handleAssetsChanged local fallback stores and fires the handler', () => {
  const renderer = createBareRenderer();
  let fired = 0;
  renderer.setAssetsChangedHandler(() => {
    fired += 1;
  });
  assert.equal(typeof renderer.assetsChangedHandler, 'function');
  renderer.setAssetsChangedHandler('not-a-function');
  assert.equal(renderer.assetsChangedHandler, null);

  renderer.setAssetsChangedHandler(() => {
    fired += 1;
  });
  renderer.worldTileViewCache = { view: {} };
  assert.equal(renderer.handleAssetsChanged(), undefined);
  assert.equal(fired, 1);
  assert.equal(renderer.worldTileViewCache, null);

  renderer.setAssetsChangedHandler(null);
  assert.equal(renderer.handleAssetsChanged(), undefined);
  assert.equal(fired, 1);
});

test('resolveWorldTileMapView returns null without a presenter view builder', () => {
  const renderer = createRenderer();
  renderer.presenter = {};
  assert.equal(renderer.resolveWorldTileMapView({}, {}, {}), null);
  renderer.presenter = null;
  assert.equal(renderer.resolveWorldTileMapView({}, {}, {}), null);
});

test('resolveWorldTileMapView builds, caches, and reuses by territoryState + signature', () => {
  const renderer = createRenderer();
  let builds = 0;
  let signature = 'sig-1';
  renderer.presenter = {
    getWorldTileMapSignature: () => signature,
    buildWorldTileMapViewState: (territoryState, viewOptions) => {
      builds += 1;
      return { tiles: [], pan: { x: viewOptions.panX, y: viewOptions.panY } };
    },
  };
  const territoryState = { territories: [] };

  const first = renderer.resolveWorldTileMapView(
    territoryState,
    { worldPanX: 1, worldPanY: 2 },
    {},
  );
  assert.equal(builds, 1);
  assert.deepEqual(first.pan, { x: 1, y: 2 });
  assert.equal(renderer.worldTileViewCache.territoryState, territoryState);
  assert.equal(renderer.worldTileViewCache.signature, 'sig-1');
  assert.equal(renderer.worldTileViewCache.view, first);

  // Reuse guard: same territoryState reference + same signature + explicit opt-in.
  const reused = renderer.resolveWorldTileMapView(
    territoryState,
    { worldPanX: 30, worldPanY: 40 },
    { reuseCachedWorldTileView: true },
  );
  assert.equal(builds, 1);
  assert.equal(reused, first);
  assert.deepEqual(reused.pan, { x: 30, y: 40 });

  // Without the opt-in flag the view is rebuilt even when the signature matches.
  renderer.resolveWorldTileMapView(territoryState, {}, {});
  assert.equal(builds, 2);

  // A different territoryState reference misses the cache.
  renderer.resolveWorldTileMapView({ territories: [] }, {}, { reuseCachedWorldTileView: true });
  assert.equal(builds, 3);

  // A signature change misses the cache and re-caches the new signature.
  renderer.resolveWorldTileMapView(territoryState, {}, { reuseCachedWorldTileView: true });
  assert.equal(builds, 4);
  signature = 'sig-2';
  renderer.resolveWorldTileMapView(territoryState, {}, { reuseCachedWorldTileView: true });
  assert.equal(builds, 5);
  assert.equal(renderer.worldTileViewCache.signature, 'sig-2');
});

test('resolveWorldTileMapView falls back to the local signature when the presenter has none', () => {
  const renderer = createRenderer();
  let builds = 0;
  renderer.presenter = {
    buildWorldTileMapViewState: () => {
      builds += 1;
      return { tiles: [] };
    },
  };
  const territoryState = {
    worldMap: { version: 3, seed: 'alpha', tiles: [{ id: 't1', q: 0, r: 0, terrain: 'grass' }] },
    territories: [],
  };

  renderer.resolveWorldTileMapView(territoryState, {}, {});
  assert.equal(builds, 1);
  assert.equal(
    renderer.worldTileViewCache.signature,
    renderer.getWorldTileMapFallbackSignature(territoryState, {}),
  );

  renderer.resolveWorldTileMapView(territoryState, {}, { reuseCachedWorldTileView: true });
  assert.equal(builds, 1);
});

test('getWorldTileMapFallbackSignature is stable and tracks tile/territory/mission changes', () => {
  const renderer = createRenderer();
  const territoryState = {
    worldMap: {
      version: 1,
      seed: 'seed',
      tiles: [{ id: 't1', q: 1, r: 2, terrain: 'grass', visibility: 'visible' }],
    },
    territories: [{ id: 's1', x: 1, y: 2, status: 'neutral', type: 'city' }],
  };
  const worldExplorerState = {
    activeMission: { id: 'm1', status: 'moving', revealedTileIds: ['t1'] },
  };

  const signature = renderer.getWorldTileMapFallbackSignature(territoryState, worldExplorerState);
  assert.equal(typeof signature, 'string');
  assert.equal(
    signature,
    renderer.getWorldTileMapFallbackSignature(territoryState, worldExplorerState),
  );

  const parsed = JSON.parse(signature);
  assert.equal(parsed.version, 1);
  assert.equal(parsed.seed, 'seed');
  assert.equal(parsed.tiles[0].id, 't1');
  assert.equal(parsed.territories[0].id, 's1');
  assert.equal(parsed.explorerMissions[0].id, 'm1');

  territoryState.worldMap.tiles[0].visibility = 'fog';
  const changed = renderer.getWorldTileMapFallbackSignature(territoryState, worldExplorerState);
  assert.notEqual(changed, signature);

  assert.equal(typeof renderer.getWorldTileMapFallbackSignature(), 'string');
});
