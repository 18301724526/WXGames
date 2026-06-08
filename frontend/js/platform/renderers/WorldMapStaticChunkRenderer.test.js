const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldMapStaticChunkRenderer = require('./WorldMapStaticChunkRenderer');

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

function createCanvas(calls = [], width = 1, height = 1) {
  return {
    width,
    height,
    getContext() {
      calls.push(['getContext']);
      return createCtx(calls);
    },
  };
}

function createLayout(overrides = {}) {
  return {
    kind: 'chunk',
    chunkX: 0,
    chunkY: 0,
    frame: { x: -10, y: -20, width: 100, height: 60 },
    entries: [{ tile: { id: 'tile-1' } }],
    renderViewport: { originX: 0, originY: 0, panX: 0, panY: 0, scale: 1 },
    drawX: 50,
    drawY: 40,
    ...overrides,
  };
}

function createHost(overrides = {}) {
  const calls = [];
  return {
    calls,
    ctx: createCtx(calls),
    worldTileStaticChunkCaches: new Map(),
    worldTileStaticChunkCacheTick: 0,
    worldTileStaticCacheLayoutKind: '',
    constructor: {
      getWorldMapCachePolicy() {
        return null;
      },
    },
    createTileWorkCanvas(width, height) {
      calls.push(['createTileWorkCanvas', width, height]);
      return createCanvas(calls, width, height);
    },
    getWorldTileStaticChunkCacheLimit() {
      calls.push(['getWorldTileStaticChunkCacheLimit']);
      return 1;
    },
    getWorldTileStaticChunkCacheScale() {
      calls.push(['getWorldTileStaticChunkCacheScale']);
      return 2;
    },
    getWorldTileStaticCacheKey() {
      calls.push(['getWorldTileStaticCacheKey']);
      return 'static-chunk-key';
    },
    withSuppressedHitTargets(callback) {
      calls.push(['withSuppressedHitTargets']);
      return callback();
    },
    renderWorldTileStaticEntries(...args) {
      calls.push(['renderWorldTileStaticEntries', ...args]);
    },
    drawWorldTileLayerCache(...args) {
      calls.push(['drawWorldTileLayerCache', ...args]);
      return true;
    },
    ...overrides,
  };
}

test('WorldMapStaticChunkRenderer renders and caches static chunk work', () => {
  const host = createHost();
  const renderer = new WorldMapStaticChunkRenderer({ host });

  assert.equal(renderer.renderWorldTileStaticChunk({ seed: 'seed' }, createLayout(), {}, 2), true);
  const work = host.worldTileStaticChunkCaches.get('0,0');
  assert.equal(Boolean(work?.canvas), true);
  assert.equal(work.key, 'static-chunk-key');
  assert.equal(work.lastUsedAt, 1);
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldTileStaticEntries'), true);
});

test('WorldMapStaticChunkRenderer reuses unchanged chunk cache without repainting', () => {
  const host = createHost();
  const cached = {
    canvas: createCanvas(host.calls, 200, 120),
    ctx: createCtx(host.calls),
    key: 'static-chunk-key',
  };
  host.worldTileStaticChunkCaches.set('0,0', cached);
  const renderer = new WorldMapStaticChunkRenderer({ host });

  assert.equal(renderer.renderWorldTileStaticChunk({ seed: 'seed' }, createLayout(), {}, 2), true);
  assert.equal(host.worldTileStaticChunkCaches.get('0,0'), cached);
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldTileStaticEntries'), false);
});

test('WorldMapStaticChunkRenderer draws active chunks and prunes stale chunk caches', () => {
  const host = createHost();
  host.worldTileStaticChunkCaches.set('stale', { canvas: {}, lastUsedAt: 0 });
  const renderer = new WorldMapStaticChunkRenderer({ host });

  assert.equal(renderer.renderWorldTileStaticChunks({ seed: 'seed' }, [
    createLayout({ chunkX: 0, chunkY: 0 }),
    createLayout({ chunkX: 1, chunkY: 0, entries: [] }),
  ], { x: 0, y: 0, width: 100, height: 100 }, {}), true);
  assert.equal(host.worldTileStaticCacheLayoutKind, 'chunks');
  assert.equal(host.worldTileStaticChunkCaches.has('0,0'), true);
  assert.equal(host.worldTileStaticChunkCaches.has('stale'), false);
  assert.equal(host.calls.some((call) => call[0] === 'drawWorldTileLayerCache'), true);
});

test('WorldMapStaticChunkRenderer delegates cache key and prune policy when available', () => {
  const host = createHost({
    constructor: {
      getWorldMapCachePolicy() {
        return {
          getWorldTileStaticChunkCacheKey() {
            return 'policy-static-key';
          },
          getPrunableCacheKeys(cacheMap, activeKeys, limit) {
            return Array.from(cacheMap.keys()).filter((key) => !activeKeys.has(key)).slice(0, Math.max(0, cacheMap.size - limit));
          },
        };
      },
    },
  });
  host.worldTileStaticChunkCaches.set('active', { canvas: {}, lastUsedAt: 1 });
  host.worldTileStaticChunkCaches.set('stale', { canvas: {}, lastUsedAt: 0 });
  const renderer = new WorldMapStaticChunkRenderer({ host });

  assert.equal(renderer.getWorldTileStaticChunkCacheKey({}, {}, createLayout(), {}, {}), 'policy-static-key');
  assert.equal(renderer.pruneWorldTileStaticChunkCaches(new Set(['active'])), true);
  assert.equal(host.worldTileStaticChunkCaches.has('stale'), false);
});

test('WorldMapStaticChunkRenderer loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapStaticChunkRenderer.js') > -1);
  assert.ok(html.indexOf('WorldMapStaticChunkRenderer.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapStaticChunkRenderer') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
