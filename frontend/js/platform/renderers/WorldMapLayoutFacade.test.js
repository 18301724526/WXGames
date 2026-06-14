const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('../../domain/TileMapGeometry');
const WorldMapLayoutModel = require('./WorldMapLayoutModel');
const WorldMapLayoutFacade = require('./WorldMapLayoutFacade');

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
    signature: 'facade-map-v1',
    version: '1',
    seed: 'layout-facade-test',
    tiles,
  };
}

function createHost(overrides = {}) {
  return {
    constructor: {
      getWorldMapLayoutModel() {
        return WorldMapLayoutModel;
      },
      getTileMapGeometry() {
        return global.TileMapGeometry;
      },
      getTileMapAssetManifest() {
        return {
          getSiteOverlayKey(type) {
            return `site:${type}`;
          },
          getOverlayOffset(key) {
            return key === 'site:city' ? { x: 8, y: -4 } : { x: 0, y: 0 };
          },
        };
      },
    },
    analyzeAssetAlphaBounds() {
      return { x: 0, y: 0, width: 100, height: 80 };
    },
    getWorldTileStaticChunkSize() {
      return 256;
    },
    getWorldTileStaticChunkCacheScale() {
      return 1;
    },
    getWorldTileStaticCachePixelBudget() {
      return 256 * 256;
    },
    getWorldTileDragCachePanRange() {
      return 180;
    },
    ...overrides,
  };
}

test('WorldMapLayoutFacade delegates projection and site layout to the layout model', () => {
  const renderer = new WorldMapLayoutFacade({ host: createHost() });
  const viewport = { originX: 100, originY: 80, panX: 10, panY: -5, scale: 0.5 };
  const center = renderer.getWorldTileScreenCenter({ q: 1, r: 2 }, viewport, geometry);
  const layout = renderer.getWorldTileSiteLayout(
    createTileMapView().tiles[0],
    { originX: 100, originY: 80, panX: 0, panY: 0, scale: 0.5 },
    geometry,
    96,
    48,
    { x: 100, y: 80 },
  );

  assert.deepEqual(center, { x: 62, y: 147 });
  assert.equal(renderer.getWorldTileDrawRect(center, 0.5, geometry).width, 97.5);
  assert.equal(layout.site.id, 'capital');
  assert.equal(layout.baseX, 102);
});

test('WorldMapLayoutFacade caches local and visible render entries by layout model keys', () => {
  const renderer = new WorldMapLayoutFacade({ host: createHost() });
  const tileMapView = createTileMapView(8);
  const viewport = { originX: 100, originY: 80, panX: 10, panY: -5, scale: 0.5 };
  const frame = { x: 0, y: 0, width: 260, height: 220 };

  const localA = renderer.getWorldTileLocalEntries(tileMapView, viewport, geometry);
  const localB = renderer.getWorldTileLocalEntries(tileMapView, viewport, geometry);
  const visibleA = renderer.getWorldTileRenderEntries(tileMapView, viewport, frame, geometry);
  const visibleB = renderer.getWorldTileRenderEntries(tileMapView, viewport, frame, geometry);

  assert.equal(localA, localB);
  assert.equal(visibleA, visibleB);
  assert.equal(visibleA.length > 0, true);
  assert.equal(visibleA.every((entry) => entry.inView), true);
});

test('WorldMapLayoutFacade fallback derives cache identity from stable tile coordinates', () => {
  const host = createHost({
    constructor: {
      getWorldMapLayoutModel() {
        return null;
      },
      getTileMapGeometry() {
        return global.TileMapGeometry;
      },
      getTileMapAssetManifest() {
        return {};
      },
    },
  });
  const renderer = new WorldMapLayoutFacade({ host });
  const stableTileMapView = {
    signature: 'same-signature',
    version: '1',
    seed: 'layout-facade-test',
    tiles: [{
      id: 'legacy-a',
      tileId: 'legacy-tile-a',
      x: 4,
      y: -2,
      q: 99,
      r: 99,
      terrain: 'forest',
      discovered: true,
    }],
  };
  const legacyShapeTileMapView = {
    ...stableTileMapView,
    tiles: [{
      ...stableTileMapView.tiles[0],
      id: 'legacy-b',
      tileId: 'legacy-tile-b',
      q: 4,
      r: -2,
    }],
  };
  delete legacyShapeTileMapView.tiles[0].x;
  delete legacyShapeTileMapView.tiles[0].y;

  assert.equal(
    renderer.getWorldTileEntitySignature(stableTileMapView),
    renderer.getWorldTileEntitySignature(legacyShapeTileMapView),
  );
});

test('WorldMapLayoutFacade creates static cache, chunk, and drag layouts', () => {
  const renderer = new WorldMapLayoutFacade({ host: createHost() });
  const tileMapView = createTileMapView(40);
  const viewport = { originX: 180, originY: 220, panX: -24, panY: 12, scale: 0.65 };
  const frame = { x: 10, y: 90, width: 360, height: 300 };

  const cacheLayout = renderer.getWorldTileStaticCacheLayout(tileMapView, viewport, geometry);
  const visibleEntries = renderer.getWorldTileRenderEntries(tileMapView, viewport, frame, geometry);
  const viewportLayout = renderer.getWorldTileStaticViewportCacheLayout(tileMapView, viewport, frame, visibleEntries);
  const chunkLayouts = renderer.getWorldTileStaticChunkLayouts(tileMapView, viewport, frame, geometry);
  const dragLayout = renderer.getWorldTileStaticDragCacheLayout(tileMapView, viewport, frame, geometry);

  assert.equal(cacheLayout.kind, 'world');
  assert.equal(cacheLayout.renderViewport.originX, 0);
  assert.equal(viewportLayout.kind, 'viewport');
  assert.equal(chunkLayouts.length > 0, true);
  assert.equal(dragLayout.kind, 'drag');
});

test('WorldMapLayoutFacade computes rendered diamond center without layout model dependency', () => {
  const renderer = new WorldMapLayoutFacade({
    host: createHost({
      getWorldTileTemplateBaseAsset() {
        return { asset: 'tile.png' };
      },
      getWorldTileTemplateMetrics() {
        return { width: 100, height: 80 };
      },
    }),
  });

  assert.deepEqual(renderer.getWorldTileRenderedDiamondCenter({}, { x: 10, y: 20, width: 30, height: 40 }), {
    x: 25,
    y: 40,
  });
});

test('WorldMapLayoutFacade loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapLayoutFacade.js') > -1);
  assert.ok(html.indexOf('WorldMapLayoutFacade.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapLayoutFacade') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
