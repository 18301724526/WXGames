const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldMapCachePolicy = require('./WorldMapCachePolicy');

function createEntries() {
  return [
    {
      tile: {
        id: 'tile-1',
        terrain: 'plains',
        terrainAsset: 'terrain-a',
        templateAssets: [{ key: 'base', asset: 'base-a', waterKind: '' }],
        feature: { asset: 'feature-a', key: 'tree' },
        site: {
          id: 'capital',
          art: 'site-a',
          owner: 'player',
          name: 'Capital',
          scale: 0.5,
          offset: { x: 4, y: -2 },
        },
      },
      center: { x: 12.34, y: 56.78 },
      drawRect: { x: 1.23, y: 4.56, width: 20, height: 10 },
    },
    {
      tile: {
        id: 'tile-2',
        terrain: 'river',
        water: { kind: 'river', asset: 'water-a' },
        templateAssets: [{ key: 'water', asset: 'water-base', waterKind: 'river' }],
      },
      center: { x: 20, y: 30 },
      drawRect: { x: 10, y: 12, width: 20, height: 10 },
    },
  ];
}

test('WorldMapCachePolicy builds static, scout, and water cache keys from compact render identity', () => {
  const tileMapView = {
    signature: 'map-v1',
    version: '2',
    seed: 'seed-a',
    activeScouts: [{
      id: 'scout-1',
      status: 'active',
      route: [{ tileId: 'tile-1', q: 0, r: 0, step: 1, revealed: false }],
    }],
  };
  const viewport = { originX: 100.04, originY: 80.02, panX: 2.26, panY: -3.24, scale: 0.5 };
  const frame = { x: 1, y: 2, width: 300, height: 200 };
  const entries = createEntries();

  const staticKey = WorldMapCachePolicy.getWorldTileStaticCacheKey(tileMapView, viewport, frame, entries, { selectedSiteId: 'capital' }, { cacheScale: 2 });
  const scoutKey = WorldMapCachePolicy.getWorldTileScoutRouteCacheKey(tileMapView, viewport, frame, { cacheScale: 2 });
  const waterKey = WorldMapCachePolicy.getWorldTileWaterLayerCacheKey(tileMapView, viewport, frame, entries, { cacheScale: 2, frameIndex: 3 });

  assert.equal(staticKey.includes('capital'), true);
  assert.equal(staticKey.includes('feature-a'), true);
  assert.equal(scoutKey.includes('scout-1:active'), true);
  assert.equal(scoutKey.includes('100'), true);
  assert.equal(waterKey.includes('water-a'), true);
  assert.equal(waterKey.includes('feature-a'), false);
});

test('WorldMapCachePolicy resolves world, chunk, viewport, and fast-drag cache layout policy', () => {
  const worldLayout = { kind: 'world', frame: { width: 100, height: 100 } };
  const viewportLayout = { kind: 'viewport', frame: { width: 40, height: 40 } };
  const chunkLayouts = [{ kind: 'chunk', frame: { width: 50, height: 50 } }];

  assert.equal(WorldMapCachePolicy.resolveWorldTileStaticCacheLayout({
    worldLayout,
    cacheScale: 1,
    pixelBudget: 10000,
  }), worldLayout);
  assert.deepEqual(WorldMapCachePolicy.resolveWorldTileStaticCacheLayout({
    worldLayout,
    chunkLayouts,
    cacheScale: 2,
    pixelBudget: 1000,
  }), { kind: 'chunks', layouts: chunkLayouts });
  assert.equal(WorldMapCachePolicy.resolveWorldTileStaticCacheLayout({
    worldLayout,
    viewportLayout,
    cacheScale: 2,
    pixelBudget: 1000,
    fastDragActive: true,
  }), null);
  assert.equal(WorldMapCachePolicy.resolveWorldTileStaticCacheLayout({
    worldLayout,
    viewportLayout,
    cacheScale: 1,
    pixelBudget: 2000,
  }), viewportLayout);
});

test('WorldMapCachePolicy prunes stale chunk caches by least-recent use without deleting active keys', () => {
  const cacheMap = new Map([
    ['active', { lastUsedAt: 1 }],
    ['oldest', { lastUsedAt: 2 }],
    ['middle', { lastUsedAt: 3 }],
    ['newest', { lastUsedAt: 4 }],
  ]);
  const prunable = WorldMapCachePolicy.getPrunableCacheKeys(cacheMap, new Set(['active']), 2);

  assert.deepEqual(prunable, ['oldest', 'middle']);
});

test('WorldMapCachePolicy builds snapshot draw layouts and frame intersections', () => {
  const layout = WorldMapCachePolicy.getWorldTileSnapshotDrawLayout(
    { kind: 'world', frame: { x: -50, y: -40, width: 100, height: 80 } },
    { originX: 100, originY: 120, panX: 10, panY: -5 },
  );
  const chunkLayout = WorldMapCachePolicy.getWorldTileSnapshotChunkDrawLayout(
    { canvas: {}, frame: { x: 0, y: 0, width: 100, height: 80 } },
    { originX: 100, originY: 120, panX: 10, panY: -5 },
  );

  assert.equal(layout.drawX, 60);
  assert.equal(layout.drawY, 75);
  assert.equal(chunkLayout.drawX, 110);
  assert.equal(chunkLayout.drawY, 115);
  assert.equal(WorldMapCachePolicy.intersectsFrame(chunkLayout, { x: 90, y: 90, width: 60, height: 60 }), true);
  assert.equal(WorldMapCachePolicy.intersectsFrame(chunkLayout, { x: -200, y: -200, width: 10, height: 10 }), false);
});

test('WorldMapCachePolicy loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapCachePolicy.js') > -1);
  assert.ok(html.indexOf('WorldMapCachePolicy.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapCachePolicy') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
