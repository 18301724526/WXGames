const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('../../domain/TileMapGeometry');
const WorldMapLayoutModel = require('./WorldMapLayoutModel');
const WorldMapHitTargetModel = require('./WorldMapHitTargetModel');

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

function createOptions() {
  return {
    layoutModel: WorldMapLayoutModel,
    analyzeAssetAlphaBounds() {
      return { x: 0, y: 0, width: 100, height: 80 };
    },
    tileMapAssetManifest: {
      getSiteOverlayKey(type) {
        return `site:${type}`;
      },
      getOverlayOffset() {
        return { x: 0, y: 0 };
      },
    },
  };
}

test('WorldMapHitTargetModel creates a background world-map drag target', () => {
  assert.deepEqual(
    WorldMapHitTargetModel.getWorldMapDragHitTarget({ x: 10, y: 20, width: 300, height: 200 }),
    {
      rect: { x: 10, y: 20, width: 300, height: 200 },
      action: { type: 'worldMapDrag', background: true, inputSurface: 'worldMap' },
    },
  );
});

test('WorldMapHitTargetModel creates site hit targets from layout entries', () => {
  const tileMapView = createTileMapView();
  const viewport = { originX: 100, originY: 80, panX: 0, panY: 0, scale: 0.5 };
  const entries = WorldMapLayoutModel.getWorldTileRenderEntries(
    tileMapView,
    viewport,
    { x: 0, y: 0, width: 260, height: 220 },
    geometry,
  );
  const targets = WorldMapHitTargetModel.createWorldTileSiteHitTargets(tileMapView, viewport, entries, createOptions());

  assert.equal(targets.length, 1);
  assert.equal(targets[0].action.type, 'openWorldSite');
  assert.equal(targets[0].action.siteId, 'capital');
  assert.equal(targets[0].action.tileId, 'tile_0_0');
  assert.equal(targets[0].action.inputSurface, 'worldMap');
  assert.equal(targets[0].rect.width > 0, true);
});

test('WorldMapHitTargetModel keeps discovered site targets when asset metrics are not ready', () => {
  const tileMapView = {
    geometry,
    tiles: [{
      id: 'tile_2_2',
      q: 2,
      r: 2,
      terrain: 'plains',
      discovered: true,
      visible: true,
      siteId: 'site_2_2',
      site: {
        id: 'site_2_2',
        type: 'town',
        status: 'discovered',
        owner: 'neutral',
        art: 'assets/art/world-site-town-cutout.png',
        scale: 0.46,
      },
    }],
  };
  const viewport = { originX: 200, originY: 120, panX: 0, panY: 0, scale: 0.5 };
  const entries = WorldMapLayoutModel.getWorldTileRenderEntries(
    tileMapView,
    viewport,
    { x: 0, y: 0, width: 420, height: 320 },
    geometry,
  );
  const targets = WorldMapHitTargetModel.createWorldTileSiteHitTargets(tileMapView, viewport, entries, {
    ...createOptions(),
    analyzeAssetAlphaBounds() {
      return null;
    },
  });

  assert.equal(targets.length, 1);
  assert.equal(targets[0].action.type, 'openWorldSite');
  assert.equal(targets[0].action.siteId, 'site_2_2');
  assert.equal(targets[0].action.tileId, 'tile_2_2');
  assert.equal(targets[0].rect.width > 0, true);
  assert.equal(targets[0].rect.height > 0, true);
});

test('WorldMapHitTargetModel creates march targets for in-frame tiles only', () => {
  const tileMapView = createTileMapView();
  const viewport = { originX: 100, originY: 80, panX: 0, panY: 0, scale: 0.5 };
  const targets = WorldMapHitTargetModel.createWorldMarchTileHitTargets(
    tileMapView,
    viewport,
    { x: 0, y: 0, width: 260, height: 220 },
    createOptions(),
  );

  assert.equal(targets.some((target) => target.action.tileId === 'tile_0_0'), true);
  assert.equal(targets.some((target) => target.action.tileId === 'tile_1_0'), true);
  assert.equal(targets.some((target) => target.action.tileId === 'tile_20_20'), false);
  assert.equal(targets.find((target) => target.action.tileId === 'tile_1_0').action.known, false);
  assert.equal(targets.find((target) => target.action.tileId === 'tile_1_0').action.inputSurface, 'worldMap');
});

test('WorldMapHitTargetModel marks blocked march tile targets without dropping picking evidence', () => {
  const tileMapView = {
    geometry,
    tiles: [
      { id: 'tile_0_0', q: 0, r: 0, terrain: 'plains', discovered: true },
      { id: 'tile_1_0', q: 1, r: 0, terrain: 'ocean', terrainLabel: 'Ocean', discovered: true },
    ],
  };
  const viewport = { originX: 100, originY: 80, panX: 0, panY: 0, scale: 0.5 };
  const targets = WorldMapHitTargetModel.createWorldMarchTileHitTargets(
    tileMapView,
    viewport,
    { x: 0, y: 0, width: 260, height: 220 },
    {
      ...createOptions(),
      evaluateMarchTarget(tile) {
        return tile.terrain === 'ocean'
          ? { canMarch: false, reason: 'EXPLORE_ROUTE_BLOCKED' }
          : { canMarch: true };
      },
    },
  );

  const ocean = targets.find((target) => target.action.targetQ === 1 && target.action.targetR === 0);
  assert.equal(Boolean(ocean), true);
  assert.equal(ocean.action.marchDisabled, true);
  assert.equal(ocean.action.marchDisabledReason, 'EXPLORE_ROUTE_BLOCKED');
  assert.equal(ocean.action.type, 'selectWorldMarchTarget');
});

test('WorldMapHitTargetModel derives action identity from stable x/y coordinates', () => {
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
        terrainLabel: 'Forest',
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
  const entries = WorldMapLayoutModel.getWorldTileRenderEntries(
    tileMapView,
    viewport,
    { x: -400, y: -400, width: 1200, height: 1200 },
    geometry,
  );

  const siteTargets = WorldMapHitTargetModel.createWorldTileSiteHitTargets(tileMapView, viewport, entries, createOptions());
  const marchTargets = WorldMapHitTargetModel.createWorldMarchTileHitTargets(
    tileMapView,
    viewport,
    { x: -400, y: -400, width: 1200, height: 1200 },
    createOptions(),
  );

  assert.equal(siteTargets.find((target) => target.action.siteId === 'site_5_-2').action.tileId, 'tile_5_-2');
  assert.equal(marchTargets.find((target) => target.action.targetQ === 4 && target.action.targetR === -2).action.tileId, 'tile_4_-2');
});

test('WorldMapHitTargetModel loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapHitTargetModel.js') > -1);
  assert.ok(html.indexOf('WorldMapHitTargetModel.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapHitTargetModel') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
