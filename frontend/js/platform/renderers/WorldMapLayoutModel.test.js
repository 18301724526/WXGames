const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('../../domain/TileMapGeometry');
const WorldMapLayoutModel = require('./WorldMapLayoutModel');

const geometry = Object.freeze({
  tileWidth: 192,
  tileHeight: 96,
  stepX: 96,
  stepY: 48,
  anchorY: 0.5,
});

function createTileMapView(tileCount = 5) {
  const tiles = [];
  for (let index = 0; index < tileCount; index += 1) {
    tiles.push({
      id: `tile-${index}`,
      q: index,
      r: index % 2,
      terrain: index % 2 ? 'forest' : 'plains',
    });
  }
  tiles[0] = {
    ...tiles[0],
    q: 0,
    r: 0,
    site: {
      id: 'capital',
      type: 'city',
      art: 'assets/art/world-site-city-cutout.png',
      owner: 'player',
      scale: 0.5,
      offset: { x: 4, y: -2 },
    },
  };
  return {
    signature: 'test-map-v1',
    version: '1',
    seed: 'layout-test',
    tiles,
  };
}

test('WorldMapLayoutModel computes tile screen centers and draw rects without renderer state', () => {
  const center = WorldMapLayoutModel.getWorldTileScreenCenter(
    { q: 1, r: 2 },
    { originX: 100, originY: 80, panX: 10, panY: -5, scale: 0.5 },
    geometry,
  );

  assert.deepEqual(center, { x: 62, y: 147 });
  assert.deepEqual(
    WorldMapLayoutModel.getWorldTileDrawRect(center, 0.5, geometry),
    { x: 13.25, y: 122.625, width: 97.5, height: 48.75 },
  );
});

test('WorldMapLayoutModel builds site layout from injected metrics and manifest', () => {
  const tile = createTileMapView().tiles[0];
  const layout = WorldMapLayoutModel.getWorldTileSiteLayout(
    tile,
    { originX: 100, originY: 80, panX: 0, panY: 0, scale: 0.5 },
    geometry,
    96,
    48,
    { x: 100, y: 80 },
    {
      analyzeAssetAlphaBounds() {
        return { x: 0, y: 0, width: 100, height: 80 };
      },
      tileMapAssetManifest: {
        getSiteOverlayKey(type) {
          return `site:${type}`;
        },
        getOverlayOffset(key) {
          return key === 'site:city' ? { x: 8, y: -4 } : { x: 0, y: 0 };
        },
      },
    },
  );

  assert.equal(layout.site.id, 'capital');
  assert.equal(layout.baseX, 102);
  assert.equal(layout.baseY, 71.32);
  assert.equal(layout.drawW, 48);
  assert.equal(layout.drawH, 38.400000000000006);
  assert.equal(layout.hitRect.width, 64);
});

test('WorldMapLayoutModel filters visible render entries using local entries', () => {
  const tileMapView = createTileMapView(4);
  const viewport = { originX: 100, originY: 80, panX: 10, panY: -5, scale: 0.5 };
  const localEntries = WorldMapLayoutModel.getWorldTileLocalEntries(tileMapView, viewport, geometry);
  const entries = WorldMapLayoutModel.getWorldTileRenderEntries(
    tileMapView,
    viewport,
    { x: 0, y: 0, width: 260, height: 220 },
    geometry,
    { localEntries },
  );

  assert.equal(localEntries.length, 4);
  assert.equal(entries.length > 0, true);
  assert.equal(entries.every((entry) => entry.inView), true);
  assert.equal(entries[0].center.x, localEntries[0].center.x + viewport.originX + viewport.panX);
});

test('WorldMapLayoutModel creates cache, chunk, and drag layouts with bounded pure calculations', () => {
  const tileMapView = createTileMapView(40);
  const viewport = { originX: 180, originY: 220, panX: -24, panY: 12, scale: 0.65 };
  const frame = { x: 10, y: 90, width: 360, height: 300 };
  const localEntries = WorldMapLayoutModel.getWorldTileLocalEntries(tileMapView, viewport, geometry);
  const cacheLayout = WorldMapLayoutModel.getWorldTileStaticCacheLayout(tileMapView, viewport, geometry, { entries: localEntries });
  const viewportLayout = WorldMapLayoutModel.getWorldTileStaticViewportCacheLayout(tileMapView, viewport, frame, localEntries.slice(0, 3));
  const chunkLayouts = WorldMapLayoutModel.getWorldTileStaticChunkLayouts(tileMapView, viewport, frame, geometry, {
    localEntries,
    atlasLayout: cacheLayout,
    chunkSize: 256,
    cacheScale: 1,
    pixelBudget: 256 * 256,
  });
  const dragLayout = WorldMapLayoutModel.getWorldTileStaticDragCacheLayout(tileMapView, viewport, frame, geometry, {
    localEntries,
    panRange: 180,
  });

  assert.equal(cacheLayout.kind, 'world');
  assert.equal(cacheLayout.renderViewport.originX, 0);
  assert.equal(cacheLayout.entries, localEntries);
  assert.deepEqual(viewportLayout.frame, { x: 8, y: 88, width: 364, height: 304 });
  assert.equal(chunkLayouts.length > 0, true);
  assert.equal(chunkLayouts.every((layout) => layout.entries.length > 0), true);
  assert.equal(dragLayout.kind, 'drag');
  assert.equal(dragLayout.entries.length > 0, true);
});

test('WorldMapLayoutModel exposes stable cache keys without serializing tile payloads', () => {
  const tileMapView = createTileMapView(1000);
  const viewport = { originX: 100, originY: 80, panX: 0, panY: 0, scale: 0.5 };
  const localKey = WorldMapLayoutModel.getWorldTileLocalEntriesCacheKey(tileMapView, viewport, geometry);
  const renderKey = WorldMapLayoutModel.getWorldTileRenderEntriesCacheKey(tileMapView, viewport, { x: 0, y: 0, width: 300, height: 300 });

  assert.equal(localKey.includes('tile-999'), false);
  assert.equal(renderKey.includes('tile-999'), false);
  assert.equal(localKey.length < 90, true);
  assert.equal(renderKey.length < 120, true);
});

test('WorldMapLayoutModel loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapLayoutModel.js') > -1);
  assert.ok(html.indexOf('WorldMapLayoutModel.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapLayoutModel') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
