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
      action: { type: 'worldMapDrag', background: true },
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
  assert.equal(targets[0].action.tileId, 'capital-tile');
  assert.equal(targets[0].rect.width > 0, true);
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

  assert.equal(targets.some((target) => target.action.tileId === 'capital-tile'), true);
  assert.equal(targets.some((target) => target.action.tileId === 'unknown-tile'), true);
  assert.equal(targets.some((target) => target.action.tileId === 'far-tile'), false);
  assert.equal(targets.find((target) => target.action.tileId === 'unknown-tile').action.known, false);
});

test('WorldMapHitTargetModel loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapHitTargetModel.js') > -1);
  assert.ok(html.indexOf('WorldMapHitTargetModel.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapHitTargetModel') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
