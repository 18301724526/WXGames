const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldMapFastDragCompositeRenderer = require('./WorldMapFastDragCompositeRenderer');

function createCtx(calls = []) {
  return {
    setTransform(...args) { calls.push(['setTransform', ...args]); },
    clearRect(...args) { calls.push(['clearRect', ...args]); },
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
  };
}

function createWork(id = 'work', calls = []) {
  return {
    id,
    canvas: { id: `${id}-canvas` },
    ctx: createCtx(calls),
    width: 100,
    height: 60,
    pixelWidth: 200,
    pixelHeight: 120,
    scale: 2,
  };
}

function createLayout(overrides = {}) {
  return {
    kind: 'world',
    frame: { x: -10, y: -20, width: 100, height: 60 },
    drawX: 50,
    drawY: 40,
    ...overrides,
  };
}

function createHost(overrides = {}) {
  const calls = [];
  const compositeWork = createWork('composite', calls);
  const worldMapCacheState = {
    worldTileStaticCacheKey: overrides.worldTileStaticCacheKey || 'static-key',
    worldTileWaterLayerCacheKey: overrides.worldTileWaterLayerCacheKey || 'water-key',
    worldTileStaticCache: overrides.worldTileStaticCache || createWork('static', calls),
    worldTileWaterLayerCache: overrides.worldTileWaterLayerCache || createWork('water', calls),
    worldTileFastDragComposite: overrides.worldTileFastDragComposite || null,
  };
  return {
    calls,
    ctx: createCtx(calls),
    worldMapCacheState,
    getWorldTileStaticCacheScale() {
      calls.push(['getWorldTileStaticCacheScale']);
      return 2;
    },
    getWorldTileLayerCacheContext(name, width, height, scale) {
      calls.push(['getWorldTileLayerCacheContext', name, width, height, scale]);
      return compositeWork;
    },
    resolveWorldTileStaticCacheLayout() {
      calls.push(['resolveWorldTileStaticCacheLayout']);
      return createLayout({ drawX: 120, drawY: 80 });
    },
    drawWorldTileLayerCache(...args) {
      calls.push(['drawWorldTileLayerCache', ...args]);
      return true;
    },
    compositeWork,
    ...overrides,
  };
}

test('WorldMapFastDragCompositeRenderer builds a compact layer signature', () => {
  const host = createHost();
  const renderer = new WorldMapFastDragCompositeRenderer({ host });

  assert.equal(renderer.getWorldTileFastDragCompositeSignature(), 'static-key::water-key');
});

test('WorldMapFastDragCompositeRenderer updates composite cache from water and static layers', () => {
  const host = createHost();
  const renderer = new WorldMapFastDragCompositeRenderer({ host });

  assert.equal(renderer.updateWorldTileFastDragComposite(createLayout(), {}), true);
  assert.equal(host.worldMapCacheState.worldTileFastDragComposite.signature, 'static-key::water-key');
  assert.equal(host.worldMapCacheState.worldTileFastDragComposite.work, host.compositeWork);
  assert.equal(host.calls.filter((call) => call[0] === 'drawWorldTileLayerCache').length, 2);
  assert.deepEqual(host.calls.find((call) => call[0] === 'getWorldTileLayerCacheContext').slice(1), [
    'worldTileFastDragCompositeCache',
    100,
    60,
    2,
  ]);
});

test('WorldMapFastDragCompositeRenderer repositions and draws valid composite cache', () => {
  const host = createHost();
  host.worldMapCacheState.worldTileFastDragComposite = {
    signature: 'static-key::water-key',
    layout: createLayout({ drawX: 0, drawY: 0 }),
    work: createWork('cached-composite', host.calls),
  };
  const renderer = new WorldMapFastDragCompositeRenderer({ host });

  assert.equal(renderer.renderWorldTileFastDragComposite({}, {}, { x: 0, y: 0, width: 100, height: 100 }, []), true);
  const drawCall = host.calls.find((call) => call[0] === 'drawWorldTileLayerCache');
  assert.equal(drawCall[1], host.worldMapCacheState.worldTileFastDragComposite.work);
  assert.equal(drawCall[2].drawX, 120);
  assert.equal(drawCall[2].drawY, 80);
});

test('WorldMapFastDragCompositeRenderer rejects stale or chunk composite layouts', () => {
  const host = createHost({
    resolveWorldTileStaticCacheLayout() {
      host.calls.push(['resolveWorldTileStaticCacheLayout']);
      return { kind: 'chunks', layouts: [] };
    },
  });
  host.worldMapCacheState.worldTileFastDragComposite = {
    signature: 'old-signature',
    layout: createLayout(),
    work: createWork('cached-composite', host.calls),
  };
  const renderer = new WorldMapFastDragCompositeRenderer({ host });

  assert.equal(renderer.renderWorldTileFastDragComposite({}, {}, {}, []), false);
  host.worldMapCacheState.worldTileFastDragComposite.signature = 'static-key::water-key';
  assert.equal(renderer.renderWorldTileFastDragComposite({}, {}, {}, []), false);
});

test('WorldMapFastDragCompositeRenderer loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapFastDragCompositeRenderer.js') > -1);
  assert.ok(html.indexOf('WorldMapFastDragCompositeRenderer.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapFastDragCompositeRenderer') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
