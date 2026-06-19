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

  renderer.renderWorldTileMap(createTileMapView(), 10, 90, 360, 300, {
    selectedSiteId: 'capital',
    worldMarchTarget: { q: 1, r: 0, tileId: 'tile_1_0' },
  }, { hitTargetsOnly: true });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'worldMapDrag'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openWorldSite' && target.action.siteId === 'capital'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'selectWorldMarchTarget'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openWorldMarchFormationPicker'), false);
});

test('WorldMapCanvasRenderer exposes tile map context on its host', () => {
  const host = createHost();
  const renderer = new WorldMapCanvasRenderer({ host });
  const tileMapView = createTileMapView();

  renderer.renderWorldTileMap(tileMapView, 10, 90, 360, 300, {}, { hitTargetsOnly: true });

  assert.equal(host.lastWorldTileMapContext.tileMapView, tileMapView);
  assert.equal(host.lastWorldTileMapContext.renderSnapshot.schema, 'world-map-render-snapshot-v1');
  assert.deepEqual(host.lastWorldTileMapContext.frame, { x: 11, y: 91, width: 358, height: 298 });
  assert.equal(host.lastWorldTileMapContext.viewport.originX, 190);
});

test('WorldMapCanvasRenderer renders world march formation picker through HUD facade', () => {
  const host = createHost({
    presenter: {
      buildMilitaryViewState() {
        return {
          formations: [
            { slot: 1, cityId: 'capital', name: 'Scout A', members: [{ id: 'fp-1' }] },
          ],
        };
      },
    },
  });
  const renderer = new WorldMapCanvasRenderer({ host });

  renderer.renderWorldMarchHud({ activeCityId: 'capital' }, {
    worldMarchTarget: { q: 1, r: 0, tileId: 'tile_1_0', pickerOpen: true },
  }, [], { scale: 1 }, {}, { x: 10, y: 90, width: 360, height: 300 });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'startWorldMarch' && target.action.formationSlot === 1), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeWorldMarchHud'), true);
});

test('WorldMapCanvasRenderer renders active explorer units through actor facade', () => {
  const calls = [];
  const baseCtx = createHost().ctx;
  const host = createHost({
    getNow() {
      return new Date('2026-06-06T00:00:05.000Z').getTime();
    },
    getAsset(path) {
      calls.push(['getAsset', path]);
      return { width: 80, height: 120, naturalWidth: 80, naturalHeight: 120 };
    },
    ctx: {
      ...baseCtx,
      drawImage(...args) { calls.push(['drawImage', args]); },
      save() {},
      restore() {},
      beginPath() {},
      ellipse() {},
      fill() {},
      fillStyle: '',
    },
  });
  const renderer = new WorldMapCanvasRenderer({ host });
  const tileMapView = {
    ...createTileMapView(),
    activeScouts: [{
      id: 'explore-1',
      kind: 'worldExplore',
      status: 'active',
      origin: { q: 0, r: 0, tileId: 'tile_0_0' },
      startedAt: '2026-06-06T00:00:00.000Z',
      stepDurationSeconds: 10,
      route: [
        { q: 1, r: 0, tileId: 'tile_1_0', revealed: false },
        { q: 2, r: 0, tileId: 'tile_2_0', revealed: false },
      ],
    }],
  };

  assert.equal(renderer.renderWorldScoutUnits(tileMapView, {
    originX: 100,
    originY: 100,
    panX: 0,
    panY: 0,
    scale: 0.5,
  }), true);
  assert.equal(calls.some((call) => call[0] === 'getAsset' && String(call[1]).includes('assets/art/units/spearman/move/')), true);
  assert.equal(calls.some((call) => call[0] === 'drawImage'), true);
});

test('WorldMapCanvasRenderer computes world march actors from epoch time, not frame time', () => {
  const capturedActors = [];
  const host = createHost({
    epochNowMs: new Date('2026-06-06T00:00:05.000Z').getTime(),
    getNow() {
      return 4321.25;
    },
  });
  const tileMapView = {
    ...createTileMapView(),
    activeScouts: [{
      id: 'explore-1',
      kind: 'worldExplore',
      status: 'active',
      origin: { q: 0, r: 0, tileId: 'tile_0_0' },
      target: { q: 2, r: 0, tileId: 'tile_2_0' },
      startedAt: '2026-06-06T00:00:00.000Z',
      completesAt: '2026-06-06T00:00:20.000Z',
      stepDurationSeconds: 10,
      route: [
        { q: 1, r: 0, tileId: 'tile_1_0', revealed: false },
        { q: 2, r: 0, tileId: 'tile_2_0', revealed: false },
      ],
    }],
  };
  const renderer = new WorldMapCanvasRenderer({
    host,
  });

  renderer.renderWorldTileMap(tileMapView, 10, 90, 360, 300, {}, { hitTargetsOnly: true });
  capturedActors.push(...(host.lastWorldTileMapContext?.visibilityActors || []));

  assert.equal(capturedActors.length, 1);
  assert.equal(host.lastWorldTileMapContext.actors.length, 0);
  assert.equal(host.lastWorldTileMapContext.renderSnapshot.actors.length, 1);
  assert.equal(capturedActors[0].current.q > 0, true);
  assert.equal(capturedActors[0].current.q < 1, true);
  assert.equal(capturedActors[0].remainingSeconds, 15);
});

test('WorldMapCanvasRenderer delegates static layer to split renderer', () => {
  const calls = [];
  const renderer = new WorldMapCanvasRenderer({
    host: createHost(),
    worldMapStaticLayerRenderer: {
      renderWorldTileStaticLayer(...args) {
        calls.push(['static', ...args]);
        return 'static-ok';
      },
    },
  });

  const tileMapView = createTileMapView();
  const viewport = { scale: 1 };
  const frame = { x: 1, y: 2, width: 3, height: 4 };
  const entries = [{ tile: tileMapView.tiles[0] }];
  const uiState = { selectedSiteId: 'capital' };

  assert.equal(renderer.renderWorldTileStaticLayer(tileMapView, viewport, frame, entries, uiState), 'static-ok');
  assert.equal(typeof renderer.renderWorldScoutRouteLayer, 'undefined');
  assert.equal(calls[0][0], 'static');
  assert.equal(calls[0][1], tileMapView);
  assert.equal(calls[0][5], uiState);
});

test('WorldMapCanvasRenderer delegates static entry rendering to split renderer', () => {
  const calls = [];
  const renderer = new WorldMapCanvasRenderer({
    host: createHost(),
    worldMapStaticEntryRenderer: {
      getWorldTileImageAspect(...args) {
        calls.push(['image-aspect', ...args]);
        return 0.8;
      },
      drawWorldOverlayShadow(...args) {
        calls.push(['overlay-shadow', ...args]);
        return 'shadow-ok';
      },
      drawWorldOverlayAsset(...args) {
        calls.push(['overlay-asset', ...args]);
        return 'asset-ok';
      },
      drawWorldTerrainFeature(...args) {
        calls.push(['terrain-feature', ...args]);
        return 'terrain-ok';
      },
      drawWorldTileFeature(...args) {
        calls.push(['tile-feature', ...args]);
        return 'feature-ok';
      },
      drawWorldTileSite(...args) {
        calls.push(['tile-site', ...args]);
        return 'site-ok';
      },
      renderWorldTileStaticEntries(...args) {
        calls.push(['static-entries', ...args]);
        return 'entries-ok';
      },
    },
  });

  const tileMapView = createTileMapView();
  const viewport = { scale: 1 };
  const geometry = tileMapView.geometry;
  const frame = { x: 1, y: 2, width: 3, height: 4 };
  const entries = [{ tile: tileMapView.tiles[0], center: { x: 1, y: 2 }, drawRect: { x: 0, y: 0, width: 10, height: 5 } }];
  const uiState = { selectedSiteId: 'capital' };

  assert.equal(renderer.getWorldTileImageAspect('feature.png'), 0.8);
  assert.equal(renderer.drawWorldOverlayShadow(1, 2, 3, 4, { alpha: 0.5 }), 'shadow-ok');
  assert.equal(renderer.drawWorldOverlayAsset('feature.png', {}, 1, 2, 3, 4, 0.9), 'asset-ok');
  assert.equal(renderer.drawWorldTerrainFeature(tileMapView.tiles[0], viewport, geometry, 192, 96), 'terrain-ok');
  assert.equal(renderer.drawWorldTileFeature(tileMapView.tiles[0], viewport, geometry, 192, 96), 'feature-ok');
  assert.equal(renderer.drawWorldTileSite(tileMapView.tiles[0], viewport, geometry, 192, 96, uiState, {}), 'site-ok');
  assert.equal(renderer.renderWorldTileStaticEntries(tileMapView, viewport, frame, entries, uiState, { addHitTargets: false }), 'entries-ok');
  assert.deepEqual(calls.map((call) => call[0]), [
    'image-aspect',
    'overlay-shadow',
    'overlay-asset',
    'terrain-feature',
    'tile-feature',
    'tile-site',
    'static-entries',
  ]);
  assert.equal(calls[6][1], tileMapView);
  assert.equal(calls[6][4], entries);
  assert.equal(calls[6][5], uiState);
});

test('WorldMapCanvasRenderer delegates water layer orchestration to split renderer', () => {
  const calls = [];
  const renderer = new WorldMapCanvasRenderer({
    host: createHost(),
    worldMapWaterLayerRenderer: {
      renderWorldTileWaterLayer(...args) {
        calls.push(['water-layer', ...args]);
        return 'water-ok';
      },
      getWorldTileWaterAnimationFrameIndex(...args) {
        calls.push(['water-frame-index', ...args]);
        return 3;
      },
      getWorldTileWaterLayerCacheKey(...args) {
        calls.push(['water-cache-key', ...args]);
        return 'water-key';
      },
    },
  });

  const tileMapView = createTileMapView();
  const viewport = { scale: 1 };
  const frame = { x: 1, y: 2, width: 3, height: 4 };
  const entries = [{ tile: tileMapView.tiles[0] }];

  assert.equal(renderer.renderWorldTileWaterLayer(tileMapView, viewport, frame, entries), 'water-ok');
  assert.equal(renderer.getWorldTileWaterAnimationFrameIndex(375), 3);
  assert.equal(renderer.getWorldTileWaterLayerCacheKey(tileMapView, viewport, frame, entries, { frameIndex: 3 }), 'water-key');
  assert.equal(calls[0][0], 'water-layer');
  assert.equal(calls[0][1], tileMapView);
  assert.equal(calls[1][0], 'water-frame-index');
  assert.equal(calls[2][0], 'water-cache-key');
});

test('WorldMapCanvasRenderer delegates water entry rendering to split renderer', () => {
  const calls = [];
  const renderer = new WorldMapCanvasRenderer({
    host: createHost(),
    worldMapWaterEntryRenderer: {
      renderWorldTileWaterEntries(...args) {
        calls.push(['water-entries', ...args]);
        return 'water-entries-ok';
      },
    },
  });

  const tileMapView = createTileMapView();
  const viewport = { scale: 1 };
  const entries = [{ tile: { id: 'water-1', water: { kind: 'river', asset: 'river.png' } } }];

  assert.equal(renderer.renderWorldTileWaterEntries(tileMapView, viewport, entries, 1234), 'water-entries-ok');
  assert.equal(calls[0][0], 'water-entries');
  assert.equal(calls[0][1], tileMapView);
  assert.equal(calls[0][3], entries);
  assert.equal(calls[0][4], 1234);
});

test('WorldMapCanvasRenderer delegates static chunk orchestration to split renderer', () => {
  const calls = [];
  const renderer = new WorldMapCanvasRenderer({
    host: createHost(),
    worldMapStaticChunkRenderer: {
      getWorldTileStaticChunkCacheKey(...args) {
        calls.push(['static-chunk-key', ...args]);
        return 'chunk-key';
      },
      renderWorldTileStaticChunk(...args) {
        calls.push(['static-chunk', ...args]);
        return 'chunk-ok';
      },
      renderWorldTileStaticChunks(...args) {
        calls.push(['static-chunks', ...args]);
        return 'chunks-ok';
      },
    },
  });

  const tileMapView = createTileMapView();
  const viewport = { scale: 1 };
  const layout = { chunkX: 0, chunkY: 0, frame: { x: 0, y: 0, width: 10, height: 10 }, entries: [] };
  const frame = { x: 1, y: 2, width: 3, height: 4 };
  const uiState = { selectedSiteId: 'capital' };

  assert.equal(renderer.getWorldTileStaticChunkCacheKey(tileMapView, viewport, layout, uiState, { cacheScale: 2 }), 'chunk-key');
  assert.equal(renderer.renderWorldTileStaticChunk(tileMapView, layout, uiState, 2), 'chunk-ok');
  assert.equal(renderer.renderWorldTileStaticChunks(tileMapView, [layout], frame, uiState), 'chunks-ok');
  assert.equal(calls[0][0], 'static-chunk-key');
  assert.equal(calls[1][0], 'static-chunk');
  assert.equal(calls[2][0], 'static-chunks');
});

test('WorldMapCanvasRenderer delegates snapshot cache rendering to split renderer', () => {
  const calls = [];
  const renderer = new WorldMapCanvasRenderer({
    host: createHost(),
    worldMapSnapshotCacheRenderer: {
      renderWorldTileSnapshotChunkCacheMap(...args) {
        calls.push(['snapshot-chunk-map', ...args]);
        return 'chunk-map-ok';
      },
      getWorldTileSnapshotDrawLayout(...args) {
        calls.push(['snapshot-layout', ...args]);
        return { drawX: 1, drawY: 2 };
      },
      renderWorldTileSnapshotLayerCache(...args) {
        calls.push(['snapshot-layer', ...args]);
        return 'layer-ok';
      },
      renderWorldTileSnapshotCache(...args) {
        calls.push(['snapshot-cache', ...args]);
        return 'snapshot-ok';
      },
    },
  });

  const cacheMap = new Map();
  const cachedLayout = { frame: { x: 0, y: 0, width: 10, height: 10 } };
  const viewport = { originX: 1, originY: 2 };
  const frame = { x: 1, y: 2, width: 3, height: 4 };
  const tileMapView = createTileMapView();

  assert.equal(renderer.renderWorldTileSnapshotChunkCacheMap(cacheMap, viewport, frame), 'chunk-map-ok');
  assert.deepEqual(renderer.getWorldTileSnapshotDrawLayout(cachedLayout, viewport), { drawX: 1, drawY: 2 });
  assert.equal(renderer.renderWorldTileSnapshotLayerCache({ canvas: {} }, cachedLayout, viewport, frame), 'layer-ok');
  assert.equal(renderer.renderWorldTileSnapshotCache(tileMapView, viewport, frame), 'snapshot-ok');
  assert.deepEqual(calls.map((call) => call[0]), [
    'snapshot-chunk-map',
    'snapshot-layout',
    'snapshot-layer',
    'snapshot-cache',
  ]);
});

test('WorldMapCanvasRenderer delegates fast-drag composite cache to split renderer', () => {
  const calls = [];
  const renderer = new WorldMapCanvasRenderer({
    host: createHost(),
    worldMapFastDragCompositeRenderer: {
      getWorldTileFastDragCompositeSignature(...args) {
        calls.push(['fast-drag-signature', ...args]);
        return 'fast-drag-key';
      },
      renderWorldTileFastDragComposite(...args) {
        calls.push(['fast-drag-render', ...args]);
        return 'fast-drag-render-ok';
      },
      updateWorldTileFastDragComposite(...args) {
        calls.push(['fast-drag-update', ...args]);
        return 'fast-drag-update-ok';
      },
    },
  });

  const tileMapView = createTileMapView();
  const viewport = { scale: 1 };
  const frame = { x: 1, y: 2, width: 3, height: 4 };
  const entries = [{ tile: tileMapView.tiles[0] }];
  const layout = { frame, drawX: 1, drawY: 2 };

  assert.equal(renderer.getWorldTileFastDragCompositeSignature(), 'fast-drag-key');
  assert.equal(renderer.renderWorldTileFastDragComposite(tileMapView, viewport, frame, entries), 'fast-drag-render-ok');
  assert.equal(renderer.updateWorldTileFastDragComposite(layout, frame), 'fast-drag-update-ok');
  assert.deepEqual(calls.map((call) => call[0]), [
    'fast-drag-signature',
    'fast-drag-render',
    'fast-drag-update',
  ]);
  assert.equal(calls[1][1], tileMapView);
  assert.equal(calls[1][4], entries);
  assert.equal(calls[2][1], layout);
});

test('WorldMapCanvasRenderer delegates scout route helpers to split renderer', () => {
  const calls = [];
  const renderer = new WorldMapCanvasRenderer({
    host: createHost(),
    worldMapScoutRenderer: {
      renderWorldScoutRoutes(...args) {
        calls.push(['scout-routes', ...args]);
        return 'routes-ok';
      },
    },
  });

  const tileMapView = createTileMapView();
  const viewport = { scale: 1 };
  const actors = [{ id: 'actor-1' }];

  assert.equal(renderer.renderWorldScoutRoutes(tileMapView, viewport, actors), 'routes-ok');
  assert.deepEqual(calls.map((call) => call[0]), [
    'scout-routes',
  ]);
  assert.equal(calls[0][1], tileMapView);
  assert.equal(calls[0][3], actors);
});

test('WorldMapCanvasRenderer delegates world site overlay helpers to split renderer', () => {
  const calls = [];
  const renderer = new WorldMapCanvasRenderer({
    host: createHost(),
    worldMapSiteOverlayRenderer: {
      getWorldSiteDialogPresenter(...args) {
        calls.push(['site-presenter', ...args]);
        return { id: 'presenter' };
      },
      buildWorldSiteDialogViewState(...args) {
        calls.push(['site-view', ...args]);
        return { selectedSiteId: 'capital', showModal: true, details: [] };
      },
      buildFallbackWorldSiteDialogViewState(...args) {
        calls.push(['site-fallback', ...args]);
        return { selectedSiteId: 'fallback', showModal: false, details: [] };
      },
      renderWorldSiteAction(...args) {
        calls.push(['site-action', ...args]);
        return 99;
      },
      renderWorldExpeditionConfig(...args) {
        calls.push(['site-expedition', ...args]);
        return 123;
      },
      renderWorldSiteModal(...args) {
        calls.push(['site-modal', ...args]);
        return 'modal-ok';
      },
      getWorldCityCommandAnchor(...args) {
        calls.push(['city-anchor', ...args]);
        return { anchorX: 1, anchorY: 2 };
      },
      getWorldSiteCanvasAnchor(...args) {
        calls.push(['site-anchor', ...args]);
        return { center: { x: 1, y: 2 } };
      },
      getWorldCityCommandButtonAction(...args) {
        calls.push(['city-action', ...args]);
        return { type: 'enterCity' };
      },
      drawWorldCityCommandPrimaryButton(...args) {
        calls.push(['city-primary', ...args]);
        return 'primary-ok';
      },
      drawWorldCityCommandSideButton(...args) {
        calls.push(['city-side', ...args]);
        return 'side-ok';
      },
      renderWorldCityCommandOverlay(...args) {
        calls.push(['city-overlay', ...args]);
        return 'overlay-ok';
      },
    },
  });

  const territories = [{ id: 'capital' }];
  const territoryState = { territories };
  const uiState = { selectedSiteId: 'capital' };
  const state = { territoryState };
  const options = { territoryUiState: uiState };
  const detail = { id: 'capital' };
  const button = { action: 'enter-city', territoryId: 'capital' };

  assert.deepEqual(renderer.getWorldSiteDialogPresenter(), { id: 'presenter' });
  assert.equal(renderer.buildWorldSiteDialogViewState(territories, territoryState, uiState).showModal, true);
  assert.equal(renderer.buildFallbackWorldSiteDialogViewState(territories, territoryState, uiState).selectedSiteId, 'fallback');
  assert.equal(renderer.renderWorldSiteAction({ buttons: [] }, 1, 2, 3), 99);
  assert.equal(renderer.renderWorldExpeditionConfig({}, 1, 2, 3), 123);
  assert.equal(renderer.renderWorldSiteModal(state, options), 'modal-ok');
  assert.deepEqual(renderer.getWorldCityCommandAnchor(detail, territories, state, options), { anchorX: 1, anchorY: 2 });
  assert.deepEqual(renderer.getWorldSiteCanvasAnchor('capital', state, options), { center: { x: 1, y: 2 } });
  assert.deepEqual(renderer.getWorldCityCommandButtonAction(button), { type: 'enterCity' });
  assert.equal(renderer.drawWorldCityCommandPrimaryButton(button, 1, 2, 3), 'primary-ok');
  assert.equal(renderer.drawWorldCityCommandSideButton(button, 1, 2, 3, 4), 'side-ok');
  assert.equal(renderer.renderWorldCityCommandOverlay(detail, territories, state, options), 'overlay-ok');
  assert.deepEqual(calls.map((call) => call[0]), [
    'site-presenter',
    'site-view',
    'site-fallback',
    'site-action',
    'site-expedition',
    'site-modal',
    'city-anchor',
    'site-anchor',
    'city-action',
    'city-primary',
    'city-side',
    'city-overlay',
  ]);
});

test('WorldMapCanvasRenderer delegates military world view to split renderer', () => {
  const calls = [];
  const renderer = new WorldMapCanvasRenderer({
    host: createHost(),
    worldMapMilitaryViewRenderer: {
      renderMilitaryWorldView(...args) {
        calls.push(['military-world-view', ...args]);
        return 'military-ok';
      },
    },
  });
  const state = { territoryState: { territories: [] } };
  const options = { territoryUiState: {} };

  assert.equal(renderer.renderMilitaryWorldView(state, 1, 2, 3, 4, options), 'military-ok');
  assert.deepEqual(calls.map((call) => call[0]), ['military-world-view']);
  assert.equal(calls[0][1], state);
  assert.equal(calls[0][5], 4);
  assert.equal(calls[0][6], options);
});

test('WorldMapCanvasRenderer delegates fog mask context capture to split renderer', () => {
  const calls = [];
  const host = createHost();
  const renderer = new WorldMapCanvasRenderer({
    host,
    worldMapFogMaskContextRenderer: {
      renderWorldTileFogMask(...args) {
        calls.push(['fog-mask', ...args]);
        host.lastWorldFogContext = { tileMapView: args[0], viewport: args[1], frame: args[2], entries: args[3] };
        return false;
      },
    },
  });
  const tileMapView = createTileMapView();
  const viewport = { scale: 1 };
  const frame = { x: 1, y: 2, width: 3, height: 4 };
  const entries = [{ tile: tileMapView.tiles[0] }];

  assert.equal(renderer.renderWorldTileFogMask(tileMapView, viewport, frame, entries), false);
  assert.deepEqual(calls.map((call) => call[0]), ['fog-mask']);
  assert.equal(calls[0][1], tileMapView);
  assert.equal(calls[0][4], entries);
  assert.equal(host.lastWorldFogContext.tileMapView, tileMapView);
});

test('WorldMapCanvasRenderer delegates tile-map frame orchestration to split renderer', () => {
  const calls = [];
  const renderer = new WorldMapCanvasRenderer({
    host: createHost(),
    worldMapTileMapRenderer: {
      addWorldMapDragHitTarget(...args) {
        calls.push(['drag-target', ...args]);
        return 'drag-target-ok';
      },
      renderWorldTileMap(...args) {
        calls.push(['tile-map', ...args]);
        return 'tile-map-ok';
      },
    },
  });
  const tileMapView = createTileMapView();
  const uiState = { selectedSiteId: 'capital' };
  const options = { hitTargetsOnly: true };

  assert.equal(renderer.addWorldMapDragHitTarget(10, 20, 30, 40), 'drag-target-ok');
  assert.equal(renderer.renderWorldTileMap(tileMapView, 1, 2, 3, 4, uiState, options), 'tile-map-ok');
  assert.deepEqual(calls.map((call) => call[0]), ['drag-target', 'tile-map']);
  assert.deepEqual(calls[0].slice(1), [10, 20, 30, 40]);
  assert.equal(calls[1][1], tileMapView);
  assert.equal(calls[1][5], 4);
  assert.equal(calls[1][6], uiState);
  assert.equal(calls[1][7], options);
});

test('WorldMapCanvasRenderer delegates actor and march HUD helpers to split renderer', () => {
  const calls = [];
  const renderer = new WorldMapCanvasRenderer({
    host: createHost(),
    worldMapActorHudRenderer: {
      renderWorldScoutUnits(...args) {
        calls.push(['scout-units', ...args]);
        return 'scout-units-ok';
      },
      renderWorldActors(...args) {
        calls.push(['actors', ...args]);
        return 'actors-ok';
      },
      addWorldActorHitTargets(...args) {
        calls.push(['actor-targets', ...args]);
        return 'targets-ok';
      },
      renderWorldMarchHud(...args) {
        calls.push(['march-hud', ...args]);
        return 'hud-ok';
      },
      getNearestWorldTileAtPoint(...args) {
        calls.push(['nearest-tile', ...args]);
        return { id: 'nearest' };
      },
      getEpochNowMs(...args) {
        calls.push(['epoch-now', ...args]);
        return 123456;
      },
    },
  });
  const tileMapView = createTileMapView();
  const viewport = { scale: 1 };
  const geometry = tileMapView.geometry;
  const actors = [{ id: 'actor-1' }];
  const frame = { x: 1, y: 2, width: 3, height: 4 };

  assert.equal(renderer.renderWorldScoutUnits(tileMapView, viewport), 'scout-units-ok');
  assert.equal(renderer.renderWorldActors(actors, viewport, geometry), 'actors-ok');
  assert.equal(renderer.addWorldActorHitTargets(actors, viewport, geometry), 'targets-ok');
  assert.equal(renderer.renderWorldMarchHud({ id: 'state' }, {}, actors, viewport, geometry, frame), 'hud-ok');
  assert.deepEqual(renderer.getNearestWorldTileAtPoint({ x: 1, y: 2 }, tileMapView, viewport), { id: 'nearest' });
  assert.equal(renderer.getEpochNowMs(), 123456);
  assert.deepEqual(calls.map((call) => call[0]), [
    'scout-units',
    'actors',
    'actor-targets',
    'march-hud',
    'nearest-tile',
    'epoch-now',
  ]);
});

test('WorldMapCanvasRenderer delegates layout helpers to split facade', () => {
  const calls = [];
  const renderer = new WorldMapCanvasRenderer({
    host: createHost(),
    worldMapLayoutFacade: {
      getWorldTileScreenCenter(...args) {
        calls.push(['screen-center', ...args]);
        return { x: 1, y: 2 };
      },
      getWorldTileDrawRect(...args) {
        calls.push(['draw-rect', ...args]);
        return { x: 3, y: 4, width: 5, height: 6 };
      },
      getWorldTileRenderEntries(...args) {
        calls.push(['render-entries', ...args]);
        return [{ tile: { id: 'tile-1' } }];
      },
      getWorldTileStaticChunkLayouts(...args) {
        calls.push(['chunk-layouts', ...args]);
        return [{ chunkX: 0, chunkY: 0 }];
      },
    },
  });
  const tileMapView = createTileMapView();
  const viewport = { scale: 1 };
  const geometry = tileMapView.geometry;
  const frame = { x: 1, y: 2, width: 3, height: 4 };

  assert.deepEqual(renderer.getWorldTileScreenCenter(tileMapView.tiles[0], viewport, geometry), { x: 1, y: 2 });
  assert.deepEqual(renderer.getWorldTileDrawRect({ x: 1, y: 2 }, 1, geometry), { x: 3, y: 4, width: 5, height: 6 });
  assert.deepEqual(renderer.getWorldTileRenderEntries(tileMapView, viewport, frame, geometry), [{ tile: { id: 'tile-1' } }]);
  assert.deepEqual(renderer.getWorldTileStaticChunkLayouts(tileMapView, viewport, frame, geometry), [{ chunkX: 0, chunkY: 0 }]);
  assert.deepEqual(calls.map((call) => call[0]), [
    'screen-center',
    'draw-rect',
    'render-entries',
    'chunk-layouts',
  ]);
});

test('WorldMapCanvasRenderer delegates render utility helpers to split facade', () => {
  const calls = [];
  const renderer = new WorldMapCanvasRenderer({
    host: createHost(),
    worldMapRenderUtilityFacade: {
      drawIsoDiamond(...args) {
        calls.push(['diamond', ...args]);
        return 'diamond-ok';
      },
      getFallbackTerrainFill(...args) {
        calls.push(['fill', ...args]);
        return 'fill-ok';
      },
      hashString(...args) {
        calls.push(['hash', ...args]);
        return 123;
      },
      random01(...args) {
        calls.push(['random', ...args]);
        return 0.25;
      },
    },
  });

  assert.equal(renderer.drawIsoDiamond(1, 2, 3, 4, { stroke: '#fff' }), 'diamond-ok');
  assert.equal(renderer.getFallbackTerrainFill('forest'), 'fill-ok');
  assert.equal(renderer.hashString('abc'), 123);
  assert.equal(renderer.random01('seed', 1, 2, 'salt'), 0.25);
  assert.deepEqual(calls.map((call) => call[0]), ['diamond', 'fill', 'hash', 'random']);
  assert.deepEqual(calls[0].slice(1), [1, 2, 3, 4, { stroke: '#fff' }]);
  assert.equal(calls[1][1], 'forest');
  assert.equal(calls[2][1], 'abc');
  assert.deepEqual(calls[3].slice(1), ['seed', 1, 2, 'salt']);
});

test('WorldMapCanvasRenderer delegates cache helpers to split facade', () => {
  const calls = [];
  const renderer = new WorldMapCanvasRenderer({
    host: createHost(),
    worldMapCacheFacade: {
      getWorldTileStaticCacheKey(...args) {
        calls.push(['static-key', ...args]);
        return 'static-key-ok';
      },
      getWorldTileLayerCacheContext(...args) {
        calls.push(['layer-context', ...args]);
        return { id: 'layer-context-ok' };
      },
      createWorldTileLayerWork(...args) {
        calls.push(['layer-work', ...args]);
        return { id: 'layer-work-ok' };
      },
      drawWorldTileLayerCache(...args) {
        calls.push(['layer-draw', ...args]);
        return 'layer-draw-ok';
      },
      resolveWorldTileStaticCacheLayout(...args) {
        calls.push(['resolve-layout', ...args]);
        return { kind: 'viewport' };
      },
    },
  });
  const tileMapView = createTileMapView();
  const viewport = { scale: 1 };
  const frame = { x: 1, y: 2, width: 3, height: 4 };
  const entries = [{ tile: tileMapView.tiles[0] }];
  const uiState = { selectedSiteId: 'capital' };
  const work = { canvas: {}, scale: 1 };
  const layout = { frame, drawX: 1, drawY: 2 };

  assert.equal(renderer.getWorldTileStaticCacheKey(tileMapView, viewport, frame, entries, uiState, { cacheScale: 2 }), 'static-key-ok');
  assert.deepEqual(renderer.getWorldTileLayerCacheContext('cache-a', 10, 20, 2), { id: 'layer-context-ok' });
  assert.deepEqual(renderer.createWorldTileLayerWork(10, 20, 2), { id: 'layer-work-ok' });
  assert.equal(renderer.drawWorldTileLayerCache(work, layout, frame), 'layer-draw-ok');
  assert.deepEqual(renderer.resolveWorldTileStaticCacheLayout(tileMapView, viewport, frame, entries), { kind: 'viewport' });
  assert.equal(typeof renderer.getWorldTileScoutRouteCacheKey, 'undefined');
  assert.deepEqual(calls.map((call) => call[0]), [
    'static-key',
    'layer-context',
    'layer-work',
    'layer-draw',
    'resolve-layout',
  ]);
  assert.equal(calls[0][1], tileMapView);
  assert.equal(calls[0][4], entries);
  assert.equal(calls[3][1], work);
  assert.equal(calls[4][3], frame);
});

test('WorldMapCanvasRenderer delegates cache config helpers to split facade', () => {
  const calls = [];
  const renderer = new WorldMapCanvasRenderer({
    host: createHost(),
    worldMapCacheConfigFacade: {
      getWorldTileStaticChunkSize() {
        calls.push(['chunk-size']);
        return 2048;
      },
      getWorldTileStaticChunkCacheLimit() {
        calls.push(['chunk-limit']);
        return 64;
      },
      getWorldTileStaticChunkCacheScale() {
        calls.push(['chunk-scale']);
        return 2;
      },
      getWorldTileDragCachePanRange() {
        calls.push(['drag-range']);
        return 240;
      },
      getWorldTileStaticCacheScale() {
        calls.push(['cache-scale']);
        return 3;
      },
      getWorldTileStaticCachePixelBudget() {
        calls.push(['pixel-budget']);
        return 32000000;
      },
    },
  });

  assert.equal(renderer.getWorldTileStaticChunkSize(), 2048);
  assert.equal(renderer.getWorldTileStaticChunkCacheLimit(), 64);
  assert.equal(renderer.getWorldTileStaticChunkCacheScale(), 2);
  assert.equal(renderer.getWorldTileDragCachePanRange(), 240);
  assert.equal(renderer.getWorldTileStaticCacheScale(), 3);
  assert.equal(renderer.getWorldTileStaticCachePixelBudget(), 32000000);
  assert.deepEqual(calls.map((call) => call[0]), [
    'chunk-size',
    'chunk-limit',
    'chunk-scale',
    'drag-range',
    'cache-scale',
    'pixel-budget',
  ]);
});

test('WorldMapCanvasRenderer delegates hit-target helpers to split facade', () => {
  const calls = [];
  const renderer = new WorldMapCanvasRenderer({
    host: createHost(),
    worldMapHitTargetFacade: {
      addWorldTileSiteHitTargets(...args) {
        calls.push(['site-targets', ...args]);
        return 'site-targets-ok';
      },
      addWorldMarchTileHitTargets(...args) {
        calls.push(['march-targets', ...args]);
        return 'march-targets-ok';
      },
    },
  });
  const tileMapView = createTileMapView();
  const viewport = { scale: 1 };
  const frame = { x: 1, y: 2, width: 3, height: 4 };
  const entries = [{ tile: tileMapView.tiles[0] }];
  const uiState = { selectedSiteId: 'capital' };

  assert.equal(renderer.addWorldTileSiteHitTargets(tileMapView, viewport, entries, uiState), 'site-targets-ok');
  assert.equal(renderer.addWorldMarchTileHitTargets(tileMapView, viewport, frame), 'march-targets-ok');
  assert.deepEqual(calls.map((call) => call[0]), ['site-targets', 'march-targets']);
  assert.equal(calls[0][1], tileMapView);
  assert.equal(calls[0][3], entries);
  assert.equal(calls[0][4], uiState);
  assert.equal(calls[1][3], frame);
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
