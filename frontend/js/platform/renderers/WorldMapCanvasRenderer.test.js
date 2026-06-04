const test = require('node:test');
const assert = require('node:assert/strict');

const WorldMapCanvasRenderer = require('./WorldMapCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

function createHost(overrides = {}) {
  const hitTargets = [];
  const host = {
    width: 390,
    height: 844,
    viewportWidth: 390,
    viewportHeight: 844,
    bottomSafeArea: 12,
    ctx: {
      fillRect() {},
      clearRect() {},
      drawImage() {},
      beginPath() {},
      closePath() {},
      moveTo() {},
      lineTo() {},
      rect() {},
      arc() {},
      ellipse() {},
      fill() {},
      stroke() {},
      save() {},
      restore() {},
      clip() {},
      globalAlpha: 1,
    },
    presenter: {},
    addHitTarget(rect, action) { hitTargets.push({ rect, action }); },
    analyzeAssetAlphaBounds() { return { x: 0, y: 0, width: 100, height: 80 }; },
    createGradient() { return '#123'; },
    drawPanel() {},
    drawButton() {},
    drawText() {},
    drawTextLines() {},
    drawLine() {},
    drawPolyline() {},
    drawCircle() {},
    drawTileAsset() { return false; },
    drawWorldTileWater() { return false; },
    drawWorldTileDryTemplate() { return false; },
    getAsset() { return null; },
    getLayout() { return { contentWidth: 380, contentX: 10, contentRight: 390 }; },
    getTopBarBottom() { return 84; },
    isWorldTileMapWaterAnimated() { return false; },
    measureTextWidth(text) { return String(text || '').length * 8; },
    resolveWorldTileMapView(territoryState = {}, uiState = {}) {
      return {
        ...(territoryState.worldMap || {}),
        pan: { x: Number(uiState.worldPanX) || 0, y: Number(uiState.worldPanY) || 0 },
      };
    },
    truncateText(text) { return String(text || ''); },
    wrapTextLimit(text) { return [String(text || '')]; },
    hitTargets,
    ...overrides,
  };
  return host;
}

function createTileMapView() {
  return {
    seed: 'test-seed',
    pan: { x: 0, y: 0 },
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
    tiles: [
      {
        id: 'tile-capital',
        q: 0,
        r: 0,
        terrain: 'plains',
        discovered: true,
        visible: true,
        site: {
          id: 'capital',
          type: 'city',
          name: 'Capital',
          art: 'assets/art/world-site-city-cutout.png',
          owner: 'player',
          scale: 0.46,
        },
      },
    ],
  };
}

test('WorldMapCanvasRenderer owns tile projection and site layout helpers', () => {
  const renderer = new WorldMapCanvasRenderer({ host: createHost() });
  const geometry = { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 };
  const center = renderer.getWorldTileScreenCenter(
    { q: 1, r: 2 },
    { originX: 100, originY: 80, panX: 10, panY: -5, scale: 0.5 },
    geometry,
  );

  assert.deepEqual(center, { x: 62, y: 147 });

  const layout = renderer.getWorldTileSiteLayout(createTileMapView().tiles[0], {
    originX: 100,
    originY: 80,
    panX: 0,
    panY: 0,
    scale: 0.5,
    geometry,
  }, geometry, 96, 48, { x: 100, y: 80 });

  assert.equal(layout.site.id, 'capital');
  assert.equal(layout.hitRect.width > 0, true);
});

test('CanvasGameRenderer exposes world map helpers through the world map renderer facade', () => {
  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    worldMapRendererClass: WorldMapCanvasRenderer,
  });

  assert.deepEqual(
    renderer.getWorldTileScreenCenter({ q: 1, r: 0 }, { originX: 10, originY: 20, panX: 0, panY: 0, scale: 1 }, { stepX: 96, stepY: 48 }),
    { x: 106, y: 68 },
  );
  assert.equal(renderer.getWorldCityCommandButtonAction({ action: 'enter-city', territoryId: 'capital' }).type, 'enterCity');
});

test('WorldMapCanvasRenderer keeps world map hit target contract in hit-target-only mode', () => {
  const host = createHost();
  const renderer = new WorldMapCanvasRenderer({ host });

  renderer.renderWorldTileMap(createTileMapView(), 10, 90, 360, 300, { selectedSiteId: 'capital' }, { hitTargetsOnly: true });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'worldMapDrag'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openWorldSite' && target.action.siteId === 'capital'), true);
});
