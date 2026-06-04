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
    getWorldTileTemplateBaseAsset() { return null; },
    getWorldTileTemplateMetrics() { return null; },
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

test('WorldMapCanvasRenderer falls back for occupied city HUD when presenter is split out', () => {
  const host = createHost({
    presenter: {},
  });
  const renderer = new WorldMapCanvasRenderer({ host });
  const state = {
    territoryState: {
      territories: [
        {
          id: 'capital',
          status: 'occupied',
          owner: 'player',
          cityName: 'Capital',
          summary: 'Home city.',
        },
      ],
      worldMap: createTileMapView(),
    },
  };

  renderer.renderWorldSiteModal(state, { territoryUiState: { selectedSiteId: 'capital' }, isMapHome: true });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'enterCity' && target.action.cityId === 'capital'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'renameCity' && target.action.cityId === 'capital'), true);
});

test('CanvasGameRenderer renders occupied city HUD through split renderer facade', () => {
  const renderer = new CanvasGameRenderer({
    ctx: createHost().ctx,
    presenter: {},
    width: 390,
    height: 844,
    worldMapRendererClass: WorldMapCanvasRenderer,
  });
  renderer.renderTopBar = () => 84;
  renderer.renderHudTabPageWithTransition = () => {};
  renderer.renderTabs = () => {};
  renderer.renderFloatingSubcityButton = () => {};
  renderer.renderFloatingEventButton = () => {};
  renderer.renderFloatingAdvisorButton = () => {};
  renderer.collectMapHomeWorldSiteHitTargets = () => {};
  renderer.renderTutorialIntro = () => {};
  renderer.renderTutorialHighlight = () => {};
  renderer.renderFloatingTexts = () => {};
  renderer.renderRewardReveal = () => {};
  renderer.renderNetworkOverlay = () => {};
  renderer.drawPanel = () => {};
  renderer.drawText = () => {};
  renderer.drawCircle = () => {};
  renderer.drawButton = () => {};
  renderer.clear = () => {};
  renderer.createGradient = () => '#123';
  renderer.getLayout = () => ({ contentWidth: 380, contentX: 10, contentRight: 390 });
  renderer.getTopBarBottom = () => 84;
  renderer.measureTextWidth = (text) => String(text || '').length * 8;
  renderer.resolveWorldTileMapView = (territoryState = {}, uiState = {}) => ({
    ...(territoryState.worldMap || {}),
    pan: { x: Number(uiState.worldPanX) || 0, y: Number(uiState.worldPanY) || 0 },
  });
  renderer.truncateText = (text) => String(text || '');

  renderer.render({
    militaryView: 'world',
    territoryState: {
      territories: [
        {
          id: 'capital',
          status: 'occupied',
          owner: 'player',
          cityName: 'Capital',
          summary: 'Home city.',
        },
      ],
      worldMap: createTileMapView(),
    },
  }, {
    mode: 'hud',
    activeTab: 'military',
    isMapHome: true,
    skipWorldMapLayer: true,
    preserveCanvas: true,
    territoryUiState: { selectedSiteId: 'capital' },
    showFpsOverlay: false,
  });

  assert.equal(renderer.hitTargets.some((target) => target.action.type === 'enterCity' && target.action.cityId === 'capital'), true);
});
