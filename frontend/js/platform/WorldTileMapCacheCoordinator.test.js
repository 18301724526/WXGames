const test = require('node:test');
const assert = require('node:assert/strict');

const WorldTileMapCacheCoordinator = require('./WorldTileMapCacheCoordinator');
const { createWorldMapCacheState } = require('./renderers/WorldMapCacheState');

// Isolated tests for WorldTileMapCacheCoordinator (god-file re-decomposition slice 13):
// the coordinator is exercised against a minimal stub host that carries the REAL
// WorldMapCacheState container and renderer-shaped 1-line delegators, without pulling
// in CanvasGameRenderer.

function createHost(options = {}) {
  const host = {
    worldMapCacheState: createWorldMapCacheState(options.cacheState || {}),
    presenter: options.presenter || null,
    assetRenderer: options.assetRenderer || null,
  };
  host.coordinator = new WorldTileMapCacheCoordinator({ host });
  // Renderer-shaped entry points the coordinator dispatches back through.
  host.invalidateWorldTileCaches = (...args) => host.coordinator.invalidateWorldTileCaches(...args);
  host.invalidateWorldTileViewCache = (...args) =>
    host.coordinator.invalidateWorldTileViewCache(...args);
  host.getWorldTileMapFallbackSignature = (...args) =>
    host.coordinator.getWorldTileMapFallbackSignature(...args);
  return host;
}

test('accessors read/write the host worldMapCacheState container with coercion', () => {
  const host = createHost();
  const coordinator = host.coordinator;

  coordinator.worldTileFastDragActive = 1;
  assert.equal(coordinator.worldTileFastDragActive, true);
  assert.equal(host.worldMapCacheState.worldTileFastDragActive, true);

  coordinator.worldTileStaticCacheKey = 42;
  assert.equal(coordinator.worldTileStaticCacheKey, '42');
  coordinator.worldTileStaticCacheKey = '';
  assert.equal(host.worldMapCacheState.worldTileStaticCacheKey, '');

  coordinator.worldTileStaticChunkCacheTick = '9';
  assert.equal(coordinator.worldTileStaticChunkCacheTick, 9);

  coordinator.assetsChangedHandler = 'not-a-function';
  assert.equal(coordinator.assetsChangedHandler, null);
  const handler = () => {};
  coordinator.assetsChangedHandler = handler;
  assert.equal(host.worldMapCacheState.assetsChangedHandler, handler);

  assert.equal(coordinator.worldTileMaskCache, host.worldMapCacheState.worldTileMaskCache);
});

test('invalidateWorldTileViewCache clears the view caches locally, or forwards to assetRenderer', () => {
  const host = createHost({
    cacheState: {
      worldTileViewCache: { view: {} },
      worldTileVisibleEntriesCache: { entries: [] },
      worldTileLocalEntriesCache: { entries: [] },
    },
  });
  assert.equal(host.coordinator.invalidateWorldTileViewCache(), undefined);
  assert.equal(host.worldMapCacheState.worldTileViewCache, null);
  assert.equal(host.worldMapCacheState.worldTileVisibleEntriesCache, null);
  assert.equal(host.worldMapCacheState.worldTileLocalEntriesCache, null);

  let forwarded = 0;
  const forwardingHost = createHost({
    assetRenderer: {
      invalidateWorldTileViewCache: () => {
        forwarded += 1;
        return 'from-asset-renderer';
      },
    },
  });
  forwardingHost.worldMapCacheState.worldTileViewCache = { view: {} };
  assert.equal(forwardingHost.coordinator.invalidateWorldTileViewCache(), 'from-asset-renderer');
  assert.equal(forwarded, 1);
  assert.deepEqual(forwardingHost.worldMapCacheState.worldTileViewCache, { view: {} });
});

test('handleAssetsChanged fallback invalidates through the host and fires the stored handler', () => {
  const host = createHost({ cacheState: { worldTileViewCache: { view: {} } } });
  let fired = 0;
  host.coordinator.setAssetsChangedHandler(() => {
    fired += 1;
  });
  assert.equal(host.coordinator.handleAssetsChanged(), undefined);
  assert.equal(fired, 1);
  assert.equal(host.worldMapCacheState.worldTileViewCache, null);

  host.coordinator.setAssetsChangedHandler('not-a-function');
  assert.equal(host.worldMapCacheState.assetsChangedHandler, null);
  assert.equal(host.coordinator.handleAssetsChanged(), undefined);
  assert.equal(fired, 1);
});

test('resolveWorldTileMapView caches by territoryState + signature and honors the reuse flag', () => {
  let builds = 0;
  let signature = 'sig-1';
  const host = createHost({
    presenter: {
      getWorldTileMapSignature: () => signature,
      buildWorldTileMapViewState: (territoryState, viewOptions) => {
        builds += 1;
        return { tiles: [], pan: { x: viewOptions.panX, y: viewOptions.panY } };
      },
    },
  });
  const coordinator = host.coordinator;
  const territoryState = { territories: [] };

  const first = coordinator.resolveWorldTileMapView(
    territoryState,
    { worldPanX: 1, worldPanY: 2 },
    {},
  );
  assert.equal(builds, 1);
  assert.equal(host.worldMapCacheState.worldTileViewCache.view, first);

  const reused = coordinator.resolveWorldTileMapView(
    territoryState,
    { worldPanX: 5, worldPanY: 6 },
    { reuseCachedWorldTileView: true },
  );
  assert.equal(builds, 1);
  assert.equal(reused, first);
  assert.deepEqual(reused.pan, { x: 5, y: 6 });

  signature = 'sig-2';
  coordinator.resolveWorldTileMapView(territoryState, {}, { reuseCachedWorldTileView: true });
  assert.equal(builds, 2);

  host.presenter = {};
  assert.equal(coordinator.resolveWorldTileMapView(territoryState, {}, {}), null);
});

test('getWorldTileMapFallbackSignature is deterministic and backs the reuse guard', () => {
  let builds = 0;
  const host = createHost({
    presenter: {
      buildWorldTileMapViewState: () => {
        builds += 1;
        return { tiles: [] };
      },
    },
  });
  const territoryState = {
    worldMap: { version: 2, seed: 'beta', tiles: [{ id: 't1', q: 0, r: 1, terrain: 'water' }] },
    territories: [],
  };

  const signature = host.coordinator.getWorldTileMapFallbackSignature(territoryState, {});
  assert.equal(signature, host.coordinator.getWorldTileMapFallbackSignature(territoryState, {}));
  assert.equal(JSON.parse(signature).seed, 'beta');

  host.coordinator.resolveWorldTileMapView(territoryState, {}, {});
  assert.equal(host.worldMapCacheState.worldTileViewCache.signature, signature);
  host.coordinator.resolveWorldTileMapView(territoryState, {}, { reuseCachedWorldTileView: true });
  assert.equal(builds, 1);

  territoryState.worldMap.tiles[0].terrain = 'grass';
  host.coordinator.resolveWorldTileMapView(territoryState, {}, { reuseCachedWorldTileView: true });
  assert.equal(builds, 2);
});
