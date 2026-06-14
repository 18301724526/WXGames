const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldMapWaterLayerRenderer = require('./WorldMapWaterLayerRenderer');

function createCtx(calls = []) {
  return {
    setTransform(...args) { calls.push(['setTransform', ...args]); },
    clearRect(...args) { calls.push(['clearRect', ...args]); },
    save() { calls.push(['save']); },
    restore() { calls.push(['restore']); },
    translate(...args) { calls.push(['translate', ...args]); },
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
  };
}

function createWork(calls = []) {
  return {
    canvas: { width: 200, height: 120 },
    ctx: createCtx(calls),
    width: 100,
    height: 60,
    pixelWidth: 200,
    pixelHeight: 120,
    scale: 2,
  };
}

function createEntry(id = 'tile-water') {
  return {
    tile: {
      id,
      water: { kind: 'river', asset: 'water-river.png' },
      templateAssets: [{ key: 'river', asset: 'river-template.png' }],
    },
    center: { x: 10, y: 20 },
    drawRect: { x: 1, y: 2, width: 30, height: 40 },
  };
}

function createLayout(calls = [], overrides = {}) {
  return {
    kind: 'world',
    frame: { x: -10, y: -20, width: 100, height: 60 },
    entries: [createEntry()],
    renderViewport: { originX: 0, originY: 0, panX: 0, panY: 0, scale: 1 },
    drawX: 50,
    drawY: 40,
    ...overrides,
  };
}

function createHost(overrides = {}) {
  const calls = [];
  const work = createWork(calls);
  const layout = createLayout(calls);
  return {
    calls,
    ctx: createCtx(calls),
    worldTileFastDragActive: false,
    worldTileWaterLayerCache: null,
    worldTileWaterLayerCacheKey: '',
    worldTileWaterFrameCaches: new Map(),
    worldTileWaterChunkCaches: new Map(),
    worldTileWaterChunkCacheTick: 0,
    worldTileWaterTimeOverride: null,
    constructor: {
      getWorldMapCachePolicy() {
        return null;
      },
    },
    getNow() {
      calls.push(['getNow']);
      return 0;
    },
    getWorldTileStaticCacheScale() {
      calls.push(['getWorldTileStaticCacheScale']);
      return 2;
    },
    getWorldTileStaticChunkCacheScale() {
      calls.push(['getWorldTileStaticChunkCacheScale']);
      return 2;
    },
    getWorldTileStaticChunkCacheLimit() {
      calls.push(['getWorldTileStaticChunkCacheLimit']);
      return 1;
    },
    resolveWorldTileStaticCacheLayout() {
      calls.push(['resolveWorldTileStaticCacheLayout']);
      return layout;
    },
    createWorldTileLayerWork(width, height, scale) {
      calls.push(['createWorldTileLayerWork', width, height, scale]);
      return { ...createWork(calls), width, height, scale };
    },
    renderWorldTileWaterEntries(...args) {
      calls.push(['renderWorldTileWaterEntries', ...args]);
    },
    drawWorldTileLayerCache(...args) {
      calls.push(['drawWorldTileLayerCache', ...args]);
      return true;
    },
    ...overrides,
  };
}

test('WorldMapWaterLayerRenderer renders and caches all water frame variants', () => {
  const host = createHost({ worldTileWaterTimeOverride: 125 });
  const renderer = new WorldMapWaterLayerRenderer({ host });

  assert.equal(renderer.renderWorldTileWaterLayer({ seed: 'seed' }, {}, {}, [createEntry()]), true);
  assert.equal(host.worldTileWaterFrameCaches.size, 8);
  assert.equal(host.worldTileWaterLayerCache, host.worldTileWaterFrameCaches.get(1));
  assert.equal(host.calls.filter((call) => call[0] === 'renderWorldTileWaterEntries').length, 8);
  assert.equal(host.calls.some((call) => call[0] === 'drawWorldTileLayerCache'), true);
});

test('WorldMapWaterLayerRenderer reuses fast-drag water frame cache without repainting', () => {
  const host = createHost({ worldTileFastDragActive: true, worldTileWaterTimeOverride: 0 });
  const cached = createWork(host.calls);
  cached.key = 'water-cache-v1';
  host.worldTileWaterFrameCaches.set(0, cached);
  const renderer = new WorldMapWaterLayerRenderer({ host });

  assert.equal(renderer.renderWorldTileWaterLayer({ seed: 'seed' }, {}, {}, [createEntry()]), true);
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldTileWaterEntries'), false);
  assert.equal(host.worldTileWaterLayerCache, cached);
  assert.equal(host.worldTileWaterLayerCacheKey, 'water-cache-v1');
});

test('WorldMapWaterLayerRenderer renders chunk water frames and prunes stale chunks', () => {
  const host = createHost({
    worldTileWaterTimeOverride: 0,
    resolveWorldTileStaticCacheLayout() {
      host.calls.push(['resolveWorldTileStaticCacheLayout']);
      return {
        kind: 'chunks',
        layouts: [
          createLayout(host.calls, { kind: 'chunk', chunkX: 0, chunkY: 0 }),
          createLayout(host.calls, { kind: 'chunk', chunkX: 1, chunkY: 0, entries: [] }),
        ],
      };
    },
  });
  host.worldTileWaterChunkCaches.set('stale:0', { canvas: {}, lastUsedAt: 0 });
  const renderer = new WorldMapWaterLayerRenderer({ host });

  assert.equal(renderer.renderWorldTileWaterLayer({ seed: 'seed' }, {}, {}, [createEntry()]), true);
  assert.equal(host.worldTileWaterChunkCaches.has('0,0:0'), true);
  assert.equal(host.worldTileWaterChunkCaches.has('stale:0'), false);
  assert.equal(host.calls.some((call) => call[0] === 'drawWorldTileLayerCache'), true);
});

test('WorldMapWaterLayerRenderer delegates cache identity to WorldMapCachePolicy when available', () => {
  const host = createHost({
    constructor: {
      getWorldMapCachePolicy() {
        return {
          getWorldTileWaterLayerCacheKey() {
            return 'policy-water-key';
          },
          getWorldTileWaterChunkFrameCacheId(layout, frameIndex) {
            return `policy:${layout.chunkX}:${layout.chunkY}:${frameIndex}`;
          },
        };
      },
    },
  });
  const renderer = new WorldMapWaterLayerRenderer({ host });

  assert.equal(renderer.getWorldTileWaterLayerCacheKey({}, {}, {}, [createEntry()], { frameIndex: 0 }), 'policy-water-key');
  assert.equal(renderer.getWorldTileWaterChunkFrameCacheId({ chunkX: 2, chunkY: 3 }, 4), 'policy:2:3:4');
});

test('WorldMapWaterLayerRenderer fallback cache key uses stable coordinates instead of legacy tile id', () => {
  const host = createHost();
  const renderer = new WorldMapWaterLayerRenderer({ host });
  const tileMapView = { signature: 'world-v1', version: 7, seed: 'seed' };
  const viewport = { scale: 1.25 };
  const frame = { x: 0, y: 0, width: 320, height: 240 };
  const options = { frameIndex: 0, cacheScale: 2 };
  const baseEntry = {
    center: { x: 40, y: 24 },
    drawRect: { x: 12, y: 18, width: 30, height: 40 },
  };
  const water = { kind: 'river', asset: 'water-river.png' };
  const templateAssets = [{ key: 'river', asset: 'river-template.png', waterKind: 'river' }];
  const fromXY = {
    ...baseEntry,
    tile: {
      id: 'legacy-water-a',
      tileId: 'legacy-tile-a',
      x: 4,
      y: -2,
      q: 99,
      r: 99,
      water,
      templateAssets,
    },
  };
  const fromQR = {
    ...baseEntry,
    tile: {
      id: 'legacy-water-b',
      tileId: 'legacy-tile-b',
      q: 4,
      r: -2,
      water,
      templateAssets,
    },
  };
  const moved = {
    ...baseEntry,
    tile: {
      id: 'legacy-water-a',
      tileId: 'legacy-tile-a',
      x: 5,
      y: -2,
      q: 99,
      r: 99,
      water,
      templateAssets,
    },
  };

  const xyKey = renderer.getWorldTileWaterLayerCacheKey(tileMapView, viewport, frame, [fromXY], options);
  const qrKey = renderer.getWorldTileWaterLayerCacheKey(tileMapView, viewport, frame, [fromQR], options);
  const movedKey = renderer.getWorldTileWaterLayerCacheKey(tileMapView, viewport, frame, [moved], options);

  assert.equal(qrKey, xyKey);
  assert.notEqual(movedKey, xyKey);
});

test('WorldMapWaterLayerRenderer loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapWaterLayerRenderer.js') > -1);
  assert.ok(html.indexOf('WorldMapWaterLayerRenderer.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapWaterLayerRenderer') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
