const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('../../domain/TileMapGeometry');
const WorldMapLayoutModel = require('./WorldMapLayoutModel');
const WorldMapHitTargetModel = require('./WorldMapHitTargetModel');
const WorldMapHitTargetFacade = require('./WorldMapHitTargetFacade');

const geometry = Object.freeze({
  tileWidth: 192,
  tileHeight: 96,
  stepX: 96,
  stepY: 48,
  anchorY: 0.5,
});

function createTileMapView() {
  return {
    geometry,
    tiles: [
      {
        id: 'capital-tile',
        tileId: 'legacy-capital-tile',
        q: 0,
        r: 0,
        terrain: 'plains',
        discovered: true,
        site: {
          id: 'capital',
          type: 'city',
          art: 'assets/art/world-site-city-cutout.png',
          scale: 0.5,
        },
      },
      {
        id: 'unknown-tile',
        tileId: 'legacy-unknown-tile',
        q: 1,
        r: 0,
        terrain: 'forest',
        terrainLabel: 'Forest',
        visibility: 'unknown',
        discovered: false,
      },
      {
        id: 'far-tile',
        q: 20,
        r: 20,
        terrain: 'mountain',
        discovered: true,
      },
    ],
  };
}

function createHost(overrides = {}) {
  const hitTargets = [];
  const host = {
    constructor: {
      getWorldMapHitTargetModel() {
        return WorldMapHitTargetModel;
      },
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
          getOverlayOffset() {
            return { x: 0, y: 0 };
          },
        };
      },
    },
    addHitTarget(rect, action) {
      hitTargets.push({ rect, action });
    },
    analyzeAssetAlphaBounds() {
      return { x: 0, y: 0, width: 100, height: 80 };
    },
    hitTargets,
    ...overrides,
  };
  return host;
}

test('WorldMapHitTargetFacade registers site targets from hit-target model output', () => {
  const host = createHost();
  const renderer = new WorldMapHitTargetFacade({ host });
  const tileMapView = createTileMapView();
  const viewport = { originX: 100, originY: 80, panX: 0, panY: 0, scale: 0.5 };
  const entries = WorldMapLayoutModel.getWorldTileRenderEntries(
    tileMapView,
    viewport,
    { x: 0, y: 0, width: 260, height: 220 },
    geometry,
  );

  const registered = renderer.addWorldTileSiteHitTargets(tileMapView, viewport, entries, { selectedSiteId: 'capital' });

  assert.equal(registered, true);
  assert.equal(host.hitTargets.length, 1);
  assert.equal(host.hitTargets[0].action.type, 'openWorldSite');
  assert.equal(host.hitTargets[0].action.siteId, 'capital');
  assert.equal(host.hitTargets[0].action.tileId, 'tile_0_0');
});

test('WorldMapHitTargetFacade registers march targets and preserves known flags', () => {
  const host = createHost();
  const renderer = new WorldMapHitTargetFacade({ host });
  const tileMapView = createTileMapView();

  const registered = renderer.addWorldMarchTileHitTargets(
    tileMapView,
    { originX: 100, originY: 80, panX: 0, panY: 0, scale: 0.5 },
    { x: 0, y: 0, width: 260, height: 220 },
  );

  assert.equal(registered, true);
  assert.equal(host.hitTargets.some((target) => target.action.tileId === 'tile_0_0'), true);
  assert.equal(host.hitTargets.some((target) => target.action.tileId === 'tile_20_20'), false);
  assert.equal(host.hitTargets.find((target) => target.action.tileId === 'tile_1_0').action.known, false);
});

test('WorldMapHitTargetFacade keeps fallback registration when model is unavailable', () => {
  const host = createHost({
    constructor: {
      getWorldMapHitTargetModel() {
        return null;
      },
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
    getWorldTileSiteLayout(tile) {
      return {
        site: tile.site,
        hitRect: { x: 1, y: 2, width: 3, height: 4 },
      };
    },
    getWorldTileScreenCenter(tile) {
      return tile.id === 'far-tile' ? { x: 9999, y: 9999 } : { x: 100, y: 100 };
    },
  });
  const renderer = new WorldMapHitTargetFacade({ host });
  const tileMapView = createTileMapView();
  const viewport = { originX: 100, originY: 80, panX: 0, panY: 0, scale: 0.5 };
  const entries = [{ tile: tileMapView.tiles[0], center: { x: 100, y: 80 } }];

  assert.equal(renderer.addWorldTileSiteHitTargets(tileMapView, viewport, entries), true);
  assert.equal(renderer.addWorldMarchTileHitTargets(tileMapView, viewport, { x: 0, y: 0, width: 260, height: 220 }), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openWorldSite'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'selectWorldMarchTarget'), true);
});

test('WorldMapHitTargetFacade fallback derives action identity from stable coordinates', () => {
  const host = createHost({
    constructor: {
      getWorldMapHitTargetModel() {
        return null;
      },
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
    getWorldTileSiteLayout(tile) {
      return {
        site: tile.site,
        hitRect: { x: 1, y: 2, width: 3, height: 4 },
      };
    },
    getWorldTileScreenCenter() {
      return { x: 100, y: 100 };
    },
  });
  const renderer = new WorldMapHitTargetFacade({ host });
  const tileMapView = {
    geometry,
    tiles: [
      {
        id: 'legacy-march-id',
        tileId: 'legacy-march-tile-id',
        x: 4,
        y: -2,
        q: 99,
        r: 99,
        terrain: 'forest',
        discovered: true,
      },
      {
        id: 'legacy-site-id',
        tileId: 'legacy-site-tile-id',
        x: 5,
        y: -2,
        q: 88,
        r: 88,
        terrain: 'plains',
        discovered: true,
        site: {
          id: 'site_5_-2',
          type: 'town',
          art: 'assets/art/world-site-town-cutout.png',
          scale: 0.5,
        },
      },
    ],
  };
  const viewport = { originX: 160, originY: 120, panX: 0, panY: 0, scale: 0.5 };
  const entries = [{ tile: tileMapView.tiles[1], center: { x: 100, y: 80 } }];

  assert.equal(renderer.addWorldTileSiteHitTargets(tileMapView, viewport, entries), true);
  assert.equal(renderer.addWorldMarchTileHitTargets(tileMapView, viewport, { x: 0, y: 0, width: 260, height: 220 }), true);
  assert.equal(host.hitTargets.find((target) => target.action.siteId === 'site_5_-2').action.tileId, 'tile_5_-2');
  assert.equal(host.hitTargets.find((target) => target.action.targetQ === 4 && target.action.targetR === -2).action.tileId, 'tile_4_-2');
});

test('WorldMapHitTargetFacade loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapHitTargetFacade.js') > -1);
  assert.ok(html.indexOf('WorldMapHitTargetModel.js') < html.indexOf('WorldMapHitTargetFacade.js'));
  assert.ok(html.indexOf('WorldMapHitTargetFacade.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapHitTargetModel') < miniGameEntry.indexOf('WorldMapHitTargetFacade'));
  assert.ok(miniGameEntry.indexOf('WorldMapHitTargetFacade') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
