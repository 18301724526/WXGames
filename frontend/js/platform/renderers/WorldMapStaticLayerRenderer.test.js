const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldMapStaticLayerRenderer = require('./WorldMapStaticLayerRenderer');

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

function createHost(overrides = {}) {
  const calls = [];
  const work = {
    canvas: { width: 200, height: 120 },
    ctx: createCtx(calls),
    width: 100,
    height: 60,
    pixelWidth: 200,
    pixelHeight: 120,
    scale: 2,
  };
  const layout = {
    kind: 'world',
    frame: { x: -10, y: -20, width: 100, height: 60 },
    entries: [{ tile: { id: 'tile-1' } }],
    renderViewport: { originX: 0, originY: 0, panX: 0, panY: 0, scale: 1 },
    drawX: 50,
    drawY: 40,
  };
  const worldMapCacheState = {
    worldTileFastDragActive: Boolean(overrides.worldTileFastDragActive),
    worldTileStaticCacheKey: overrides.worldTileStaticCacheKey || '',
    worldTileStaticCacheLayoutKind: overrides.worldTileStaticCacheLayoutKind || '',
    worldTileStaticCacheLayout: overrides.worldTileStaticCacheLayout || null,
    worldTileStaticCache: overrides.worldTileStaticCache || work,
  };
  return {
    calls,
    ctx: createCtx(calls),
    worldMapCacheState,
    resolveWorldTileStaticCacheLayout() {
      calls.push(['resolveWorldTileStaticCacheLayout']);
      return layout;
    },
    renderWorldTileStaticChunks() {
      calls.push(['renderWorldTileStaticChunks']);
      return true;
    },
    getWorldTileStaticCacheScale() {
      calls.push(['getWorldTileStaticCacheScale']);
      return 2;
    },
    getWorldTileStaticCacheContext(width, height, scale) {
      calls.push(['getWorldTileStaticCacheContext', width, height, scale]);
      return work;
    },
    getWorldTileStaticCacheKey() {
      calls.push(['getWorldTileStaticCacheKey']);
      return 'static-cache-v1';
    },
    drawWorldTileLayerCache(...args) {
      calls.push(['drawWorldTileLayerCache', ...args]);
      return true;
    },
    withSuppressedHitTargets(callback) {
      calls.push(['withSuppressedHitTargets']);
      return callback();
    },
    renderWorldTileStaticEntries(...args) {
      calls.push(['renderWorldTileStaticEntries', ...args]);
    },
    ...overrides,
  };
}

test('WorldMapStaticLayerRenderer renders and caches static layer work', () => {
  const host = createHost();
  const renderer = new WorldMapStaticLayerRenderer({ host });

  assert.equal(renderer.renderWorldTileStaticLayer({ tiles: [] }, {}, {}, [], { selectedSiteId: 'capital' }), true);
  assert.equal(host.worldMapCacheState.worldTileStaticCacheKey, 'static-cache-v1');
  assert.equal(host.worldMapCacheState.worldTileStaticCacheLayoutKind, 'world');
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldTileStaticEntries'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawWorldTileLayerCache'), true);
});

test('WorldMapStaticLayerRenderer reuses fast-drag static cache without repainting', () => {
  const host = createHost({
    worldTileFastDragActive: true,
    worldTileStaticCacheKey: 'static-cache-v1',
  });
  const renderer = new WorldMapStaticLayerRenderer({ host });

  assert.equal(renderer.renderWorldTileStaticLayer({ tiles: [] }, {}, {}, [], {}), true);
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldTileStaticEntries'), false);
  assert.equal(host.calls.some((call) => call[0] === 'drawWorldTileLayerCache'), true);
});

test('WorldMapStaticLayerRenderer leaves scout routes to the dynamic actor layer', () => {
  const host = createHost();
  const renderer = new WorldMapStaticLayerRenderer({ host });

  assert.equal(typeof renderer.renderWorldScoutRouteLayer, 'undefined');
  assert.equal(typeof renderer.renderScoutRoutesIntoCache, 'undefined');
});

test('WorldMapStaticLayerRenderer delegates chunk static layouts to host chunk renderer', () => {
  const host = createHost({
    resolveWorldTileStaticCacheLayout() {
      host.calls.push(['resolveWorldTileStaticCacheLayout']);
      return { kind: 'chunks', layouts: [{ chunkX: 0, chunkY: 0 }] };
    },
  });
  const renderer = new WorldMapStaticLayerRenderer({ host });

  assert.equal(renderer.renderWorldTileStaticLayer({ tiles: [] }, {}, {}, [], {}), true);
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldTileStaticChunks'), true);
});

test('WorldMapStaticLayerRenderer loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapStaticLayerRenderer.js') > -1);
  assert.ok(html.indexOf('WorldMapStaticLayerRenderer.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapStaticLayerRenderer') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
