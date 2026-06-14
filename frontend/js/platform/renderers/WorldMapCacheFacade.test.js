const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldMapCachePolicy = require('./WorldMapCachePolicy');
const WorldMapLayerCacheStore = require('./WorldMapLayerCacheStore');
const WorldMapCacheFacade = require('./WorldMapCacheFacade');

function createCanvasFactory(calls = []) {
  return function createCanvas(width, height) {
    calls.push(['createCanvas', width, height]);
    return {
      width,
      height,
      getContext(type) {
        calls.push(['getContext', type]);
        return {
          type,
          drawImage(...args) {
            calls.push(['workDrawImage', ...args]);
          },
        };
      },
    };
  };
}

function createHost(overrides = {}) {
  const calls = [];
  const host = {
    constructor: {
      getWorldMapCachePolicy() {
        return WorldMapCachePolicy;
      },
      getWorldMapLayerCacheStore() {
        return WorldMapLayerCacheStore;
      },
    },
    ctx: {
      drawImage(...args) {
        calls.push(['drawImage', ...args]);
      },
    },
    createTileWorkCanvas: createCanvasFactory(calls),
    getWorldTileStaticCacheScale() {
      return 2;
    },
    getWorldTileStaticCachePixelBudget() {
      return 1000;
    },
    getWorldTileStaticCacheLayout() {
      return { kind: 'world', frame: { x: 0, y: 0, width: 100, height: 100 } };
    },
    getWorldTileStaticChunkLayouts() {
      return [{ kind: 'chunk', frame: { x: 0, y: 0, width: 40, height: 40 } }];
    },
    getWorldTileStaticViewportCacheLayout() {
      return { kind: 'viewport', frame: { x: 1, y: 2, width: 20, height: 20 } };
    },
    calls,
    ...overrides,
  };
  return host;
}

function createTileMapView() {
  return {
    signature: 'cache-map-v1',
    version: '2',
    seed: 'cache-seed',
    geometry: { tileWidth: 192, tileHeight: 96 },
    activeScouts: [{
      id: 'scout-1',
      status: 'active',
      route: [{ tileId: 'tile-1', q: 1, r: 0, step: 1, revealed: false }],
    }],
  };
}

test('WorldMapCacheFacade delegates static and scout cache identity to cache policy', () => {
  const renderer = new WorldMapCacheFacade({ host: createHost() });
  const tileMapView = createTileMapView();
  const viewport = { originX: 100, originY: 80, panX: 2, panY: -1, scale: 0.5 };
  const frame = { x: 1, y: 2, width: 300, height: 200 };
  const entries = [{
    tile: {
      id: 'tile-1',
      terrain: 'plains',
      terrainAsset: 'terrain-a',
      feature: { asset: 'feature-a', key: 'tree' },
      site: { id: 'capital', art: 'site-a', owner: 'player' },
    },
    center: { x: 1, y: 2 },
    drawRect: { x: 3, y: 4, width: 10, height: 5 },
  }];

  const staticKey = renderer.getWorldTileStaticCacheKey(tileMapView, viewport, frame, entries, { selectedSiteId: 'capital' }, { cacheScale: 2 });
  const scoutKey = renderer.getWorldTileScoutRouteCacheKey(tileMapView, viewport, frame, { cacheScale: 2 });

  assert.equal(staticKey.includes('capital'), true);
  assert.equal(staticKey.includes('feature-a'), true);
  assert.equal(scoutKey.includes('scout-1:active'), true);
});

test('WorldMapCacheFacade fallback derives cache identity from stable tile coordinates', () => {
  const host = createHost({
    constructor: {
      getWorldMapCachePolicy() {
        return null;
      },
      getWorldMapLayerCacheStore() {
        return WorldMapLayerCacheStore;
      },
    },
  });
  const renderer = new WorldMapCacheFacade({ host });
  const viewport = { originX: 100, originY: 80, panX: 2, panY: -1, scale: 0.5 };
  const frame = { x: 1, y: 2, width: 300, height: 200 };
  const stableEntry = {
    tile: {
      id: 'legacy-entry-a',
      tileId: 'legacy-entry-tile-a',
      x: 4,
      y: -2,
      q: 99,
      r: 99,
      terrain: 'plains',
      terrainAsset: 'terrain-a',
      feature: { asset: 'feature-a', key: 'tree' },
    },
    center: { x: 1, y: 2 },
    drawRect: { x: 3, y: 4, width: 10, height: 5 },
  };
  const legacyShapeEntry = {
    ...stableEntry,
    tile: {
      ...stableEntry.tile,
      id: 'legacy-entry-b',
      tileId: 'legacy-entry-tile-b',
      q: 4,
      r: -2,
    },
  };
  delete legacyShapeEntry.tile.x;
  delete legacyShapeEntry.tile.y;
  const stableTileMapView = {
    signature: 'same-signature',
    version: '2',
    seed: 'cache-seed',
    activeScouts: [{
      id: 'scout-1',
      status: 'active',
      route: [{ tileId: 'legacy-route-a', x: 4, y: -2, q: 99, r: 99, step: 1, revealed: false }],
    }],
  };
  const legacyShapeTileMapView = {
    ...stableTileMapView,
    activeScouts: [{
      ...stableTileMapView.activeScouts[0],
      route: [{ tileId: 'legacy-route-b', q: 4, r: -2, step: 1, revealed: false }],
    }],
  };

  assert.equal(
    renderer.getWorldTileStaticCacheKey(stableTileMapView, viewport, frame, [stableEntry], {}, { cacheScale: 2 }),
    renderer.getWorldTileStaticCacheKey(legacyShapeTileMapView, viewport, frame, [legacyShapeEntry], {}, { cacheScale: 2 }),
  );
  assert.equal(
    renderer.getWorldTileScoutRouteCacheKey(stableTileMapView, viewport, frame, { cacheScale: 2 }),
    renderer.getWorldTileScoutRouteCacheKey(legacyShapeTileMapView, viewport, frame, { cacheScale: 2 }),
  );
});

test('WorldMapCacheFacade reuses named layer cache work through cache store', () => {
  const host = createHost();
  const renderer = new WorldMapCacheFacade({ host });

  const first = renderer.getWorldTileLayerCacheContext('worldTileStaticCache', 20, 10, 1);
  const second = renderer.getWorldTileStaticCacheContext(30, 12, 2);

  assert.equal(first, second);
  assert.equal(second.canvas.width, 60);
  assert.equal(second.canvas.height, 24);
  assert.equal(second.pixelWidth, 60);
  assert.equal(host.calls.filter((call) => call[0] === 'createCanvas').length, 1);
});

test('WorldMapCacheFacade creates temporary work and draws clipped cache regions', () => {
  const host = createHost();
  const renderer = new WorldMapCacheFacade({ host });
  const work = renderer.createWorldTileLayerWork(100, 50, 2);

  assert.equal(work.pixelWidth, 200);
  assert.equal(work.pixelHeight, 100);

  const drawn = renderer.drawWorldTileLayerCache(work, {
    frame: { x: 0, y: 0, width: 100, height: 50 },
    drawX: 20,
    drawY: 30,
  }, {
    x: 50,
    y: 40,
    width: 80,
    height: 60,
  });

  assert.equal(drawn, true);
  assert.deepEqual(host.calls.find((call) => call[0] === 'drawImage').slice(2), [
    60,
    20,
    140,
    80,
    50,
    40,
    70,
    40,
  ]);
});

test('WorldMapCacheFacade resolves static cache layout through cache policy', () => {
  const renderer = new WorldMapCacheFacade({ host: createHost() });
  const layout = renderer.resolveWorldTileStaticCacheLayout(
    createTileMapView(),
    { originX: 100, originY: 80, scale: 1 },
    { x: 1, y: 2, width: 100, height: 100 },
    [],
  );

  assert.equal(layout.kind, 'chunks');
  assert.equal(layout.layouts.length, 1);
});

test('WorldMapCacheFacade loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapCacheFacade.js') > -1);
  assert.ok(html.indexOf('WorldMapLayerCacheStore.js') < html.indexOf('WorldMapCacheFacade.js'));
  assert.ok(html.indexOf('WorldMapCacheFacade.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapLayerCacheStore') < miniGameEntry.indexOf('WorldMapCacheFacade'));
  assert.ok(miniGameEntry.indexOf('WorldMapCacheFacade') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
