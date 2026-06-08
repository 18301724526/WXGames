const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldMapSnapshotCacheRenderer = require('./WorldMapSnapshotCacheRenderer');

function createWork(id = 'work') {
  return {
    id,
    canvas: { id: `${id}-canvas` },
    frame: { x: -10, y: -20, width: 100, height: 60 },
  };
}

function createHost(overrides = {}) {
  const calls = [];
  const host = {
    calls,
    ctx: {
      drawImage() {},
    },
    worldTileStaticCache: createWork('static'),
    worldTileStaticCacheLayout: {
      kind: 'world',
      frame: { x: -10, y: -20, width: 100, height: 60 },
      drawX: 0,
      drawY: 0,
    },
    worldTileScoutRouteCache: createWork('scout'),
    worldTileScoutRouteCacheLayout: {
      kind: 'world',
      frame: { x: -10, y: -20, width: 100, height: 60 },
      drawX: 0,
      drawY: 0,
    },
    worldTileStaticCacheLayoutKind: '',
    worldTileStaticChunkCaches: new Map(),
    worldTileWaterChunkCaches: new Map(),
    constructor: {
      getWorldMapCachePolicy() {
        return null;
      },
    },
    getWorldTileWaterFrameCache() {
      calls.push(['getWorldTileWaterFrameCache']);
      return createWork('water');
    },
    getWorldTileWaterAnimationFrameIndex() {
      calls.push(['getWorldTileWaterAnimationFrameIndex']);
      return 1;
    },
    getWorldTileRenderEntries(...args) {
      calls.push(['getWorldTileRenderEntries', ...args]);
      return [{ tile: { id: 'tile-1' } }];
    },
    renderWorldTileFogMask(...args) {
      calls.push(['renderWorldTileFogMask', ...args]);
      return true;
    },
    drawWorldTileLayerCache(...args) {
      calls.push(['drawWorldTileLayerCache', ...args]);
      return true;
    },
    ...overrides,
  };
  return host;
}

test('WorldMapSnapshotCacheRenderer redraws layered snapshot caches and fog mask', () => {
  const host = createHost();
  const renderer = new WorldMapSnapshotCacheRenderer({ host });

  assert.equal(renderer.renderWorldTileSnapshotCache({ geometry: {} }, { originX: 10, originY: 20, panX: 1, panY: 2 }, { x: 0, y: 0, width: 100, height: 100 }), true);
  assert.equal(host.calls.filter((call) => call[0] === 'drawWorldTileLayerCache').length, 3);
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldTileFogMask'), true);
});

test('WorldMapSnapshotCacheRenderer redraws current water and static chunk caches', () => {
  const staticChunk = createWork('static-chunk');
  const currentWaterChunk = createWork('water-current');
  const staleWaterChunk = createWork('water-stale');
  const host = createHost({
    worldTileStaticCache: null,
    worldTileStaticCacheLayout: null,
    worldTileScoutRouteCache: null,
    worldTileScoutRouteCacheLayout: null,
    worldTileStaticCacheLayoutKind: 'chunks',
    worldTileStaticChunkCaches: new Map([['0,0', staticChunk]]),
    worldTileWaterChunkCaches: new Map([
      ['0,0:1', currentWaterChunk],
      ['0,0:2', staleWaterChunk],
    ]),
  });
  const renderer = new WorldMapSnapshotCacheRenderer({ host });

  assert.equal(renderer.renderWorldTileSnapshotCache({ geometry: {} }, { originX: 10, originY: 20, panX: 1, panY: 2 }, { x: 0, y: 0, width: 100, height: 100 }), true);
  const drawCalls = host.calls.filter((call) => call[0] === 'drawWorldTileLayerCache');
  assert.equal(drawCalls.length, 2);
  assert.equal(drawCalls.some((call) => call[1] === currentWaterChunk), true);
  assert.equal(drawCalls.some((call) => call[1] === staleWaterChunk), false);
  assert.equal(drawCalls.some((call) => call[1] === staticChunk), true);
});

test('WorldMapSnapshotCacheRenderer delegates draw layout and intersection to cache policy', () => {
  const work = createWork('policy-work');
  const host = createHost({
    worldTileStaticCache: null,
    worldTileStaticCacheLayout: null,
    worldTileStaticCacheLayoutKind: 'chunks',
    worldTileStaticChunkCaches: new Map([['0,0', work]]),
    constructor: {
      getWorldMapCachePolicy() {
        return {
          getWorldTileSnapshotChunkDrawLayout(chunkWork, viewport) {
            return {
              kind: 'policy-chunk',
              frame: chunkWork.frame,
              drawX: Number(viewport.originX) || 0,
              drawY: Number(viewport.originY) || 0,
            };
          },
          intersectsFrame(layout) {
            return layout.kind === 'policy-chunk';
          },
          getWorldTileSnapshotDrawLayout(cachedLayout, viewport) {
            return {
              ...cachedLayout,
              drawX: Number(viewport.originX) || 0,
              drawY: Number(viewport.originY) || 0,
            };
          },
        };
      },
    },
  });
  const renderer = new WorldMapSnapshotCacheRenderer({ host });

  assert.deepEqual(renderer.getWorldTileSnapshotDrawLayout({ frame: { x: 1, y: 2 } }, { originX: 7, originY: 8 }), {
    frame: { x: 1, y: 2 },
    drawX: 7,
    drawY: 8,
  });
  assert.equal(renderer.renderWorldTileSnapshotCache({ geometry: {} }, { originX: 10, originY: 20 }, { x: 0, y: 0, width: 100, height: 100 }), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawWorldTileLayerCache' && call[2].kind === 'policy-chunk'), true);
});

test('WorldMapSnapshotCacheRenderer loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapSnapshotCacheRenderer.js') > -1);
  assert.ok(html.indexOf('WorldMapSnapshotCacheRenderer.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapSnapshotCacheRenderer') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
