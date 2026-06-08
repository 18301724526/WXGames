const test = require('node:test');
const assert = require('node:assert/strict');

const WorldMapLayerCanvasRenderer = require('./WorldMapLayerCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

function createCtx(calls = []) {
  return {
    fillRect(...args) { calls.push(['fillRect', ...args]); },
    clearRect(...args) { calls.push(['clearRect', ...args]); },
    drawImage(...args) { calls.push(['drawImage', ...args]); },
    beginPath() { calls.push(['beginPath']); },
    moveTo(...args) { calls.push(['moveTo', ...args]); },
    lineTo(...args) { calls.push(['lineTo', ...args]); },
    rect(...args) { calls.push(['rect', ...args]); },
    stroke() { calls.push(['stroke']); },
    save() { calls.push(['save']); },
    restore() { calls.push(['restore']); },
    clip() { calls.push(['clip']); },
    setTransform(...args) { calls.push(['setTransform', ...args]); },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
  };
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
        site: { id: 'capital', type: 'city', name: 'Capital' },
      },
    ],
  };
}

function createHost(overrides = {}) {
  const calls = [];
  const hitTargets = [];
  const host = {
    width: 390,
    height: 844,
    viewportOffsetX: 0,
    viewportOffsetY: 0,
    viewportWidth: 390,
    viewportHeight: 844,
    bottomSafeArea: 12,
    pixelRatio: 1,
    worldTileWaterTimeOverride: null,
    ctx: createCtx(calls),
    hitTargets,
    calls,
    presenter: {
      buildMilitaryNavigationViewState() {
        calls.push(['buildMilitaryNavigationViewState']);
        return { activeView: 'world' };
      },
    },
    addHitTarget(rect, action) { hitTargets.push({ rect, action }); },
    addWorldMapDragHitTarget(x, y, width, height) {
      calls.push(['addWorldMapDragHitTarget', x, y, width, height]);
      hitTargets.push({ rect: { x, y, width, height }, action: { type: 'worldMapDrag', background: true } });
    },
    addWorldMarchTileHitTargets(tileMapView, viewport, frame) {
      calls.push(['addWorldMarchTileHitTargets', tileMapView, viewport, frame]);
      hitTargets.push({ rect: { x: frame.x + 20, y: frame.y + 20, width: 44, height: 36 }, action: { type: 'selectWorldMarchTarget', targetQ: 1, targetR: 0 } });
    },
    addWorldTileSiteHitTargets(tileMapView, viewport, visibleEntries, uiState) {
      calls.push(['addWorldTileSiteHitTargets', tileMapView, viewport, visibleEntries, uiState]);
    },
    beginFrame(options) { calls.push(['beginFrame', options]); },
    clearAll() { calls.push(['clearAll']); },
    createGradient() { return '#123'; },
    drawButton(x, y, width, height, label, options = {}) { calls.push(['drawButton', label, options]); },
    drawPanel(...args) { calls.push(['drawPanel', ...args]); },
    drawText(text, x, y, options = {}) { calls.push(['drawText', text, options]); },
    endFrame(options) { calls.push(['endFrame', options]); },
    getLayout() { return { contentX: 10, contentWidth: 360, contentRight: 370 }; },
    getWorldTileLayerCacheContext(key, width, height, scale) {
      calls.push(['getWorldTileLayerCacheContext', key, width, height, scale]);
      return {
        canvas: { width: width * scale, height: height * scale },
        ctx: createCtx(calls),
        pixelWidth: width * scale,
        pixelHeight: height * scale,
        width,
        height,
      };
    },
    getWorldTileRenderEntries(tileMapView, viewport, frame, geometry) {
      calls.push(['getWorldTileRenderEntries', tileMapView, viewport, frame, geometry]);
      return [{ tile: tileMapView.tiles[0] }];
    },
    isWorldTileMapWaterAnimated(tileMapView) {
      calls.push(['isWorldTileMapWaterAnimated', tileMapView]);
      return false;
    },
    renderMilitaryWorldView(...args) { calls.push(['renderMilitaryWorldView', args]); },
    renderWorldTileMap(...args) { calls.push(['renderWorldTileMap', args]); },
    renderWorldTileSnapshotCache(...args) {
      calls.push(['renderWorldTileSnapshotCache', args]);
      return true;
    },
    resolveWorldTileMapView(territoryState = {}, uiState = {}) {
      calls.push(['resolveWorldTileMapView', territoryState, uiState]);
      return territoryState.worldMap || { tiles: [] };
    },
    setHitTargets(targets = []) {
      calls.push(['setHitTargets', targets]);
      hitTargets.length = 0;
      targets.forEach((target) => hitTargets.push(target));
    },
    withSuppressedHitTargets(callback) {
      calls.push(['withSuppressedHitTargets']);
      return callback();
    },
    ...overrides,
  };
  return host;
}

test('WorldMapLayerCanvasRenderer preserves map layer layout contracts', () => {
  const host = createHost();
  const renderer = new WorldMapLayerCanvasRenderer({ host });

  const mapHome = renderer.getWorldMapLayerLayout({}, 96, { isMapHome: true });
  const panel = renderer.getWorldMapLayerLayout({}, 96, {});

  assert.deepEqual(mapHome.map, { x: 0, y: 96, width: 390, height: 684 });
  assert.equal(panel.panel.x, 10);
  assert.equal(panel.map.width, 312);
});

test('WorldMapLayerCanvasRenderer preserves map-home tile rendering without HUD controls', () => {
  const host = createHost();
  const renderer = new WorldMapLayerCanvasRenderer({ host });
  const uiState = {};

  const rendered = renderer.renderMapHomeWorldView({
    territoryState: { worldMap: createTileMapView() },
    worldExplorerState: { randomRouteLength: 6 },
  }, 96, { territoryUiState: uiState, reuseCachedWorldTileView: true });

  const worldTileCall = host.calls.find((call) => call[0] === 'renderWorldTileMap');
  assert.equal(rendered, true);
  assert.ok(worldTileCall);
  assert.equal(worldTileCall[1][6].frameless, true);
  assert.equal(worldTileCall[1][6].fastDrag, true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'startExplore'), false);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'claimExplore'), false);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'resetWorldPan'), false);
});

test('WorldMapLayerCanvasRenderer falls back when military navigation presenter is split out', () => {
  const host = createHost({
    presenter: {},
  });
  const renderer = new WorldMapLayerCanvasRenderer({ host });
  const state = {
    militaryView: 'world',
    territoryState: { worldMap: createTileMapView() },
  };

  const layout = renderer.getWorldMapLayerLayout(state, 96, { isMapHome: true });
  const rendered = renderer.renderMapHomeWorldView(state, 96, { territoryUiState: {} });

  assert.ok(layout);
  assert.equal(layout.nav.activeView, 'world');
  assert.equal(rendered, true);
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldTileMap'), true);
});

test('WorldMapLayerCanvasRenderer preserves empty and legacy world fallbacks', () => {
  const emptyHost = createHost();
  const emptyRenderer = new WorldMapLayerCanvasRenderer({ host: emptyHost });

  assert.equal(emptyRenderer.renderMapHomeWorldView({ territoryState: {} }, 96, { loading: { message: 'loading map' } }), true);
  assert.equal(emptyHost.hitTargets.some((target) => target.action.type === 'blockCanvasModal'), true);
  assert.equal(emptyHost.calls.some((call) => call[0] === 'drawText' && call[1] === 'loading map'), true);

  const legacyHost = createHost();
  const legacyRenderer = new WorldMapLayerCanvasRenderer({ host: legacyHost });
  assert.equal(legacyRenderer.renderMapHomeWorldView({
    territoryState: { territories: [{ id: 'old' }] },
    worldExplorerState: { randomRouteLength: 7 },
  }, 96, {}), true);
  assert.equal(legacyHost.calls.some((call) => call[0] === 'renderMilitaryWorldView'), true);
  assert.equal(legacyHost.hitTargets.some((target) => target.action.type === 'startExplore'), false);
});

test('WorldMapLayerCanvasRenderer computes explorer countdown from next step time', () => {
  const host = createHost({
    getNow() {
      return new Date('2026-06-06T00:00:04.250Z').getTime();
    },
  });
  const renderer = new WorldMapLayerCanvasRenderer({ host });

  assert.equal(renderer.getExplorerMissionRemainingSeconds({
    status: 'active',
    remainingSeconds: 10,
    nextStepAt: '2026-06-06T00:00:10.000Z',
    route: [{ revealed: false }],
  }), 6);
});

test('WorldMapLayerCanvasRenderer ignores performance.now for explorer countdowns', () => {
  const renderer = new WorldMapLayerCanvasRenderer({
    host: createHost({
      epochNowMs: new Date('2026-06-06T00:00:04.250Z').getTime(),
      getNow() {
        return 4321.25;
      },
    }),
  });

  assert.equal(renderer.getExplorerMissionRemainingSeconds({
    status: 'active',
    nextStepAt: '2026-06-06T00:00:10.000Z',
    route: [{ revealed: false }],
  }), 6);
});

test('WorldMapLayerCanvasRenderer preserves hit-target-only world site collection without explorer HUD', () => {
  const host = createHost();
  const renderer = new WorldMapLayerCanvasRenderer({ host });
  const uiState = {};

  const collected = renderer.collectMapHomeWorldSiteHitTargets({
    territoryState: { worldMap: createTileMapView() },
    worldExplorerState: { randomRouteLength: 6 },
  }, 96, { territoryUiState: uiState });

  assert.equal(collected, true);
  assert.equal(host.calls.some((call) => call[0] === 'getWorldTileRenderEntries'), true);
  assert.equal(host.calls.some((call) => call[0] === 'addWorldMapDragHitTarget'), true);
  assert.equal(host.calls.some((call) => call[0] === 'addWorldMarchTileHitTargets'), true);
  assert.equal(host.calls.some((call) => call[0] === 'addWorldTileSiteHitTargets'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'worldMapDrag'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'selectWorldMarchTarget'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'startExplore'), false);

  const emptyHost = createHost();
  const emptyRenderer = new WorldMapLayerCanvasRenderer({ host: emptyHost });
  assert.equal(emptyRenderer.collectMapHomeWorldSiteHitTargets({
    territoryState: {},
    worldExplorerState: { randomRouteLength: 5 },
  }, 96, { territoryUiState: {} }), true);
  assert.equal(emptyHost.hitTargets.some((target) => target.action.type === 'startExplore'), false);
});

test('WorldMapLayerCanvasRenderer preserves snapshot backbuffer flow', () => {
  const host = createHost({ pixelRatio: 2 });
  const renderer = new WorldMapLayerCanvasRenderer({ host });

  const rendered = renderer.renderWorldMapSnapshotLayer({ territoryState: { worldMap: createTileMapView() } }, {
    preserveOnMiss: true,
    topBarBottom: 96,
    frameless: true,
    waterTimeMs: 123,
  });

  assert.equal(rendered, true);
  assert.equal(host.ctx, host.calls.find((call) => call[0] === 'getWorldTileLayerCacheContext') && host.ctx);
  assert.equal(host.worldTileWaterTimeOverride, null);
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldTileSnapshotCache'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawImage'), true);
});

test('WorldMapLayerCanvasRenderer keeps current layer untouched when preserved snapshot misses', () => {
  const host = createHost({
    renderWorldTileSnapshotCache(...args) {
      host.calls.push(['renderWorldTileSnapshotCache', args]);
      return false;
    },
  });
  const renderer = new WorldMapLayerCanvasRenderer({ host });

  const rendered = renderer.renderWorldMapSnapshotLayer({ territoryState: { worldMap: createTileMapView() } }, {
    preserveOnMiss: true,
    topBarBottom: 96,
    frameless: true,
    waterTimeMs: 123,
  });

  assert.equal(rendered, false);
  assert.equal(host.calls.some((call) => call[0] === 'drawImage'), false);
  assert.equal(host.calls.filter((call) => call[0] === 'renderWorldTileSnapshotCache').length, 1);
});

test('CanvasGameRenderer exposes world map layer rendering through facade', () => {
  class StubWorldMapLayerRenderer {
    constructor(options) {
      this.host = options.host;
    }

    getWorldMapLayerLayout(...args) {
      return { host: this.host, args };
    }

    renderWorldMapSnapshotLayer(...args) {
      return { method: 'renderWorldMapSnapshotLayer', host: this.host, args };
    }
  }

  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    worldMapLayerRendererClass: StubWorldMapLayerRenderer,
  });
  const state = { territoryState: {} };

  const layout = renderer.getWorldMapLayerLayout(state, 90, { isMapHome: true });
  const snapshot = renderer.renderWorldMapSnapshotLayer(state, { preserveOnMiss: true });

  assert.equal(layout.host, renderer);
  assert.deepEqual(layout.args, [state, 90, { isMapHome: true }]);
  assert.equal(snapshot.method, 'renderWorldMapSnapshotLayer');
});
