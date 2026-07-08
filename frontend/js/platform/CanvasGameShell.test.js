const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('../ecs/foundation/WorldTime');
require('../ecs/system/WorldMarchProgressSnapshot');
require('../ecs/projection/WorldMapVisibilityModel');
require('../ecs/projection/WorldFogVisualSnapshot');
require('../ecs/system/WorldMarchSystem');
require('../ecs/system/FogRevealModel');
require('../ecs/mode/EcsModeRuntimeEntry');
const WorldMapRenderSnapshot = require('../ecs/projection/WorldMapRenderSnapshot');
const CanvasGameShell = require('./CanvasGameShell');
const BattleStore = require('../state/BattleStore');
const ModalStore = require('../state/ModalStore');
const CanvasSurfaceHitTargets = require('./renderers/CanvasSurfaceHitTargets');

// Modal presence is a single global ModalStore (no per-host owner). Reset it before
// each test so a blocking panel opened by one test cannot leak into another host's
// routing decisions.
test.beforeEach(() => {
  ModalStore.closeAll();
});

const RETIRED_SHELL_MODULES = [
  'CanvasGameShellMounting',
  'CanvasGameShellInputRouter',
  'CanvasGameShellCommands',
  'CanvasGameShellGuideUi',
  'CanvasGameShellWorldMapLayerRuntime',
  'CanvasGameShellWorldMapDragRuntime',
  'CanvasGameShellWorldMapFrameRuntime',
  'CanvasGameShellWorldMapRuntime',
  'CanvasGameWorldActorAnimationRuntime',
  'CanvasGameShellRenderingRuntime',
  'CanvasGameShellTechTreeView',
  'CanvasGameShellTransitionTimers',
  'CanvasGameShellSystemUi',
];

function makeModalHost(fields = {}) {
  return Object.assign(new CanvasGameShell({}), fields);
}

test('CanvasGameShell owns retired responsibility methods directly', () => {
  const proto = CanvasGameShell.prototype;
  const expectedMethods = {
    mounting: ['createRenderer', 'mount'],
    inputRouter: ['bindInput', 'handleTap', 'handleDrag', 'handleGesture'],
    commands: ['openCityManagement', 'openArmyFormation', 'forwardCanvasAction', 'closeWorldSiteHud'],
    guideUi: ['getCanvasTarget', 'showTutorialHighlight', 'hideTutorialHighlight'],
    worldMapRuntime: ['ensureWorldMapRuntime', 'renderWorldMapLayer', 'requestWorldMapRenderAnimationFrame'],
    actorAnimation: ['startWorldActorAnimationLoop', 'stopWorldActorAnimationLoop', 'renderWorldActorAnimationFrame'],
    renderingRuntime: ['renderActive', 'renderReadOnly', 'buildRenderOptions'],
    techTreeView: ['getTechTreePan', 'setTechTreePan', 'getTechTreeZoom', 'setTechTreeZoom'],
    systemUi: ['applyAuthShell', 'showLoading', 'setNetworkState', 'startBattleScene'],
    layerRegistry: ['ensureCanvasLayer', 'setCanvasLayerTranslate', 'setCanvasLayerVisible', 'getCanvasLayerMetrics'],
    debugOverlay: ['isDebugOverlayEnabled', 'createDebugOverlaySnapshot'],
  };

  Object.entries(expectedMethods).forEach(([group, methods]) => {
    methods.forEach((method) => {
      assert.equal(typeof proto[method], 'function', `${group}.${method} should live on CanvasGameShell`);
    });
  });
});

test('CanvasGameShell awaits world tile cache prewarm during asset preload', async () => {
  const calls = [];
  const shell = new CanvasGameShell({
    renderer: {
      getPreloadAssetPaths() {
        calls.push(['getPreloadAssetPaths']);
        return ['assets/art/tile-map/tile-terrain-plains.png'];
      },
      preloadAssets(assetPaths, onProgress) {
        calls.push(['preloadAssets', assetPaths]);
        onProgress?.({ total: 1, completed: 1, loaded: 1, failed: 0, percentage: 100 });
        return Promise.resolve({ total: 1, completed: 1, loaded: 1, failed: 0, percentage: 100 });
      },
    },
    worldMapRenderer: {
      prewarmWorldTileCachesForLoading(assetPaths, onProgress) {
        calls.push(['prewarmWorldTileCachesForLoading', assetPaths]);
        onProgress?.({
          phase: 'assets:prewarm',
          total: 1,
          candidateTotal: 1,
          completed: 1,
          percentage: 100,
          message: '\u6b63\u5728\u51c6\u5907\u5927\u5730\u56fe\u8d44\u6e90',
        });
        return Promise.resolve({ total: 1, candidateTotal: 1, completed: 1, percentage: 100 });
      },
    },
  });
  const progress = [];

  const result = await shell.preloadAssets((event) => progress.push(event));

  assert.deepEqual(result, { total: 1, completed: 1, loaded: 1, failed: 0, percentage: 100 });
  assert.deepEqual(progress.map((event) => event.percentage), [65, 99, 100]);
  assert.deepEqual(progress.map((event) => event.message), [
    '\u6b63\u5728\u52a0\u8f7d\u6e38\u620f\u8d44\u6e90',
    '\u6b63\u5728\u51c6\u5907\u5927\u5730\u56fe\u8d44\u6e90',
    '\u8d44\u6e90\u51c6\u5907\u5b8c\u6210',
  ]);
  assert.deepEqual(calls, [
    ['preloadAssets', undefined],
    ['getPreloadAssetPaths'],
    ['prewarmWorldTileCachesForLoading', ['assets/art/tile-map/tile-terrain-plains.png']],
  ]);
});

test('index.html loads CanvasGameShell without retired split modules', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
  const facadePosition = html.indexOf('CanvasGameShell.js');
  assert.notEqual(facadePosition, -1);
  const layerRegistryPosition = html.indexOf('CanvasLayerRegistry.js');
  assert.notEqual(layerRegistryPosition, -1, 'CanvasLayerRegistry.js should be loaded');
  assert.equal(layerRegistryPosition < facadePosition, true, 'CanvasLayerRegistry.js should load before CanvasGameShell.js');

  RETIRED_SHELL_MODULES.forEach((moduleName) => {
    assert.equal(html.includes(`${moduleName}.js`), false, `${moduleName}.js should not be loaded`);
  });
  assert.equal(
    html.indexOf('WorldMapRuntimePolicy.js') < html.indexOf('CanvasGameAppRenderScheduler.js'),
    true,
    'WorldMapRuntimePolicy.js should load before CanvasGameAppRenderScheduler.js',
  );
});

test('CanvasGameShell owns canvas layer lifecycle through the registry', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    config: { FEATURES: { FOG_OF_WAR_ENABLED: true } },
    runtime: {
      ensureLayerCanvas(name, options) {
        calls.push(['ensureLayerCanvas', name, options]);
        return { name, options };
      },
      getLayerMetrics(name) {
        calls.push(['getLayerMetrics', name]);
        return { width: 300, height: 200 };
      },
      setLayerTranslate(name, x, y) {
        calls.push(['setLayerTranslate', name, x, y]);
        return true;
      },
      setLayerVisible(name, visible) {
        calls.push(['setLayerVisible', name, visible]);
        return true;
      },
    },
  });

  shell.ensureCanvasLayer('worldMap', { padding: 220 });
  shell.ensureCanvasLayer('worldFog', { padding: 220 });
  shell.ensureCanvasLayer('worldActor', { padding: 220 });
  shell.getCanvasLayerMetrics('worldMap');
  shell.setCanvasLayerTranslate('worldFog', 7, -3);
  shell.setCanvasLayerTranslate('worldActor', 7, -3);
  shell.setCanvasLayerVisible('worldFog', false);

  assert.deepEqual(calls, [
    ['ensureLayerCanvas', 'worldMap', { zIndex: 997, padding: 220 }],
    ['ensureLayerCanvas', 'worldFog', { zIndex: 998, contextType: 'webgl', padding: 220 }],
    ['ensureLayerCanvas', 'worldActor', { zIndex: 999, padding: 220 }],
    ['getLayerMetrics', 'worldMap'],
    ['setLayerTranslate', 'worldFog', 7, -3],
    ['setLayerTranslate', 'worldActor', 7, -3],
    ['setLayerVisible', 'worldFog', false],
  ]);
});

test('CanvasGameShell presents the fog layer after every fog render or clear', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    config: { FEATURES: { FOG_OF_WAR_ENABLED: false } },
    runtime: {
      presentLayer(name) {
        calls.push(['presentLayer', name]);
        return true;
      },
    },
  });
  shell.worldFogRenderer = {
    clear() {
      calls.push(['clear']);
      return true;
    },
  };

  // Fog disabled → the content pass clears the webgl surface; the wrapper must still present
  // so the 2d presentation canvas reflects the cleared surface in the same task.
  assert.equal(shell.renderWorldFogLayer({ tileMapView: {}, viewport: {}, frame: {} }), false);
  assert.deepEqual(calls, [['clear'], ['presentLayer', 'worldFog']]);
});

test('CanvasGameShell presents the fog layer when hiding the world map stack', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    config: { FEATURES: { FOG_OF_WAR_ENABLED: true } },
    runtime: {
      setLayerVisible(name, visible) {
        calls.push(['setLayerVisible', name, visible]);
        return true;
      },
      presentLayer(name) {
        calls.push(['presentLayer', name]);
        return true;
      },
    },
  });
  shell.worldFogRenderer = {
    clear() {
      calls.push(['clear']);
      return true;
    },
  };
  shell.worldActorLayerRenderer = {
    clearAll() {
      calls.push(['actorClearAll']);
      return true;
    },
  };

  shell.setWorldMapLayerVisible(false);

  assert.deepEqual(calls, [
    ['setLayerVisible', 'worldMap', false],
    ['setLayerVisible', 'worldFog', false],
    ['setLayerVisible', 'worldActor', false],
    ['clear'],
    ['presentLayer', 'worldFog'],
    ['actorClearAll'],
    ['presentLayer', 'worldActor'],
  ]);
});

test('CanvasGameShell routes the main HUD layer through the runtime layer surface', () => {
  const calls = [];
  const hudSurface = { id: 'hudSurface' };
  const shell = new CanvasGameShell({
    runtime: {
      ensureCanvas() {
        calls.push(['ensureCanvas']);
        return { id: 'visible' };
      },
      ensureLayerCanvas(name, options) {
        calls.push(['ensureLayerCanvas', name, options]);
        return hudSurface;
      },
    },
  });

  assert.equal(shell.ensureCanvasLayer('mainHud'), hudSurface);
  assert.deepEqual(calls, [
    ['ensureLayerCanvas', 'mainHud', { zIndex: 1000, pointerEvents: 'auto', role: 'screen-hud-input' }],
  ]);
});

test('CanvasGameShell falls back to the visible canvas for mainHud without layer support', () => {
  const calls = [];
  const primaryCanvas = { id: 'main' };
  const shell = new CanvasGameShell({
    runtime: {
      ensureCanvas() {
        calls.push(['ensureCanvas']);
        return primaryCanvas;
      },
    },
  });

  assert.equal(shell.ensureCanvasLayer('mainHud'), primaryCanvas);
  assert.deepEqual(calls, [['ensureCanvas']]);
});

test('CanvasGameShell layer helpers ignore disabled feature layers', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    runtime: {
      ensureLayerCanvas(name, options) {
        calls.push(['ensureLayerCanvas', name, options]);
        return {};
      },
      setLayerTranslate(name, x, y) {
        calls.push(['setLayerTranslate', name, x, y]);
        return true;
      },
      setLayerVisible(name, visible) {
        calls.push(['setLayerVisible', name, visible]);
        return true;
      },
    },
  });

  assert.equal(shell.ensureCanvasLayer('worldFog', { padding: 220 }), null);
  assert.equal(shell.setCanvasLayerTranslate('worldFog', 7, -3), false);
  assert.equal(shell.setCanvasLayerVisible('worldFog', false), false);
  assert.deepEqual(calls, []);
});

test('CanvasGameShell refreshes tutorial highlight after naming input is filled', async () => {
  const calls = [];
  const game = makeModalHost({
    tutorialController: {
      refreshCurrentHighlight() {
        calls.push(['refreshCurrentHighlight']);
        return true;
      },
    },
  });
  const shell = new CanvasGameShell({
    runtime: {
      requestTextInput() {
        calls.push(['requestTextInput']);
        return Promise.resolve('River City');
      },
      setTimeout(callback, delayMs) {
        calls.push(['setTimeout', delayMs]);
        callback();
      },
    },
  });
  shell.lastGame = game;
  shell.openNamingSnapshot({
    visible: true,
    view: { title: 'Name city', maxLength: 12 },
    inputValue: '',
    submitting: false,
  });
  shell.renderActive = () => {
    calls.push(['renderActive', shell.getNamingInputValue()]);
    return true;
  };

  assert.equal(shell.requestNamingInput(), true);
  await Promise.resolve();

  assert.equal(shell.getRendererSnapshot().modal['modal:naming'].payload.inputValue, 'River City');
  assert.deepEqual(calls, [
    ['requestTextInput'],
    ['renderActive', 'River City'],
    ['setTimeout', 0],
    ['refreshCurrentHighlight'],
  ]);
});

test('CanvasGameShell falls back to layer transform when drag snapshot refresh misses', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    runtime: {
      setLayerTranslate(layer, x, y) {
        calls.push(['setLayerTranslate', layer, x, y]);
        return true;
      },
    },
    renderer: {},
  });
  shell.worldMapRuntime = {
    getCameraOffsetFromBaked() {
      return { x: 32, y: -18 };
    },
  };
  shell.refreshWorldMapLayerFromSnapshot = (options) => {
    calls.push(['refreshWorldMapLayerFromSnapshot', options]);
    return false;
  };

  const offset = shell.updateWorldMapDragCompositor();

  const refresh = calls.find((call) => call[0] === 'refreshWorldMapLayerFromSnapshot');
  assert.equal(refresh[1].commitCamera, true);
  assert.equal(refresh[1].clearTransform, true);
  assert.equal(refresh[1].preserveOnMiss, true);
  assert.deepEqual(offset, { x: 32, y: -18 });
  assert.equal(calls.some((call) => JSON.stringify(call) === JSON.stringify(['setLayerTranslate', 'worldMap', 32, -18])), true);
  assert.equal(calls.some((call) => JSON.stringify(call) === JSON.stringify(['setLayerTranslate', 'worldActor', 32, -18])), true);
  assert.equal(calls.some((call) => JSON.stringify(call) === JSON.stringify(['setLayerTranslate', 'worldActorSpine', 32, -18])), true);
});

test('CanvasGameShell does not mount world fog by default', () => {
  const previousRenderer = global.H5CanvasGameRenderer;
  const calls = [];
  const contexts = [];
  class FakeRenderer {
    constructor(options = {}) {
      this.presenter = options.presenter || null;
      this.width = options.width || 390;
      this.height = options.height || 844;
      this.viewportWidth = options.viewportWidth || this.width;
      this.viewportHeight = options.viewportHeight || this.height;
      this.viewportOffsetX = options.viewportOffsetX || 0;
      this.viewportOffsetY = options.viewportOffsetY || 0;
    }
    setAssetsChangedHandler() {}
  }
  global.H5CanvasGameRenderer = FakeRenderer;
  const runtime = {
    width: 390,
    height: 844,
    pixelRatio: 1,
    ensureLayerCanvas(name, options) {
      calls.push(['ensureLayerCanvas', name, options]);
      return {
        getContext(type, attrs) {
          contexts.push([name, type, attrs]);
          return type === 'webgl' ? { createShader() {}, createProgram() {}, drawArrays() {} } : null;
        },
      };
    },
    getLayerMetrics() {
      return { width: 390, height: 844, viewportWidth: 390, viewportHeight: 844, padding: 0 };
    },
  };
  const shell = new CanvasGameShell({
    runtime,
    presenter: {},
  });

  try {
    shell.createRenderer({});
  } finally {
    global.H5CanvasGameRenderer = previousRenderer;
  }

  assert.equal(calls.some((call) => call[0] === 'ensureLayerCanvas' && call[1] === 'worldMap'), true);
  assert.equal(calls.some((call) => call[0] === 'ensureLayerCanvas' && call[1] === 'worldActor'), true);
  assert.equal(calls.some((call) => call[0] === 'ensureLayerCanvas' && call[1] === 'worldFog'), false);
  assert.equal(contexts.some((call) => call[0] === 'worldFog' && call[1] === 'webgl'), false);
  assert.equal(contexts.some((call) => call[0] === 'worldFog' && call[1] === '2d'), false);
});

test('CanvasGameShell mounts actor overlay with a context separate from the terrain layer', () => {
  const previousRenderer = global.H5CanvasGameRenderer;
  const previousLog = global.ClientOperationLog;
  const calls = [];
  const events = [];
  const contextsByLayer = new Map();
  class FakeRenderer {
    constructor(options = {}) {
      this.canvas = options.canvas || null;
      this.ctx = this.canvas?.getContext?.('2d') || null;
      this.presenter = options.presenter || null;
      this.width = options.width || 390;
      this.height = options.height || 844;
      this.viewportWidth = options.viewportWidth || this.width;
      this.viewportHeight = options.viewportHeight || this.height;
      this.viewportOffsetX = options.viewportOffsetX || 0;
      this.viewportOffsetY = options.viewportOffsetY || 0;
      this.worldMapRenderer = { rendererKind: 'worldMapChild' };
      this.worldMapLayerRenderer = { rendererKind: 'worldMapLayerChild' };
    }
    setAssetsChangedHandler() {}
  }
  global.H5CanvasGameRenderer = FakeRenderer;
  global.ClientOperationLog = {
    record(type, detail) {
      events.push([type, detail]);
    },
  };
  const runtime = {
    width: 390,
    height: 844,
    pixelRatio: 1,
    ensureLayerCanvas(name, options) {
      calls.push(['ensureLayerCanvas', name, options]);
      const ctx = { layer: name };
      contextsByLayer.set(name, ctx);
      return {
        id: name,
        getContext(type) {
          return type === '2d' ? ctx : null;
        },
      };
    },
    getLayerMetrics() {
      return { width: 390, height: 844, viewportWidth: 390, viewportHeight: 844, padding: 0 };
    },
  };
  const shell = new CanvasGameShell({
    runtime,
    presenter: {},
  });

  try {
    shell.createRenderer({});
  } finally {
    global.H5CanvasGameRenderer = previousRenderer;
    global.ClientOperationLog = previousLog;
  }

  assert.equal(calls.some((call) => call[0] === 'ensureLayerCanvas' && call[1] === 'worldMap'), true);
  assert.equal(calls.some((call) => call[0] === 'ensureLayerCanvas' && call[1] === 'worldActor'), true);
  assert.ok(shell.worldMapRenderer);
  assert.ok(shell.worldActorLayerRenderer);
  assert.notEqual(shell.worldActorLayerRenderer.ctx, shell.worldMapRenderer.ctx);
  assert.equal(shell.worldMapRenderer.worldActorOverlayCtx, shell.worldActorLayerRenderer.ctx);
  assert.equal(shell.worldMapRenderer.worldActorOverlaySeparate, true);
  assert.equal(shell.worldActorLayerRenderer.worldActorOverlaySeparate, true);
  assert.equal(shell.worldMapRenderer.worldActorLayerRenderer, shell.worldActorLayerRenderer);
  assert.equal(
    shell.worldMapRenderer.worldMapRenderer.worldActorLayerRenderer,
    shell.worldActorLayerRenderer,
  );
  assert.equal(shell.worldActorLayerRenderer.worldMapRenderer, shell.worldMapRenderer);
  assert.deepEqual(shell.worldActorOverlayAssembly, {
    enabled: true,
    canvasCreated: true,
    ctxSeparated: true,
    reason: 'ok',
  });
  assert.deepEqual(events, [
    ['worldActorOverlay:assembly', {
      enabled: true,
      canvasCreated: true,
      ctxSeparated: true,
      reason: 'ok',
    }],
  ]);
  assert.equal(contextsByLayer.get('worldActor'), shell.worldActorLayerRenderer.ctx);
});

test('CanvasGameShell records actor overlay assembly when the actor context is shared', () => {
  const previousRenderer = global.H5CanvasGameRenderer;
  const previousLog = global.ClientOperationLog;
  const events = [];
  const sharedCtx = { layer: 'shared' };
  class FakeRenderer {
    constructor(options = {}) {
      this.canvas = options.canvas || null;
      this.ctx = this.canvas?.getContext?.('2d') || null;
      this.presenter = options.presenter || null;
      this.width = options.width || 390;
      this.height = options.height || 844;
      this.viewportWidth = options.viewportWidth || this.width;
      this.viewportHeight = options.viewportHeight || this.height;
      this.viewportOffsetX = options.viewportOffsetX || 0;
      this.viewportOffsetY = options.viewportOffsetY || 0;
    }
    setAssetsChangedHandler() {}
  }
  global.H5CanvasGameRenderer = FakeRenderer;
  global.ClientOperationLog = {
    record(type, detail) {
      events.push([type, detail]);
    },
  };
  const runtime = {
    width: 390,
    height: 844,
    pixelRatio: 1,
    ensureLayerCanvas(name) {
      return {
        id: name,
        getContext(type) {
          return type === '2d' ? sharedCtx : null;
        },
      };
    },
    getLayerMetrics() {
      return { width: 390, height: 844, viewportWidth: 390, viewportHeight: 844, padding: 0 };
    },
  };
  const shell = new CanvasGameShell({
    runtime,
    presenter: {},
  });

  try {
    shell.createRenderer({});
  } finally {
    global.H5CanvasGameRenderer = previousRenderer;
    global.ClientOperationLog = previousLog;
  }

  assert.ok(shell.worldMapRenderer);
  assert.ok(shell.worldActorLayerRenderer);
  assert.equal(shell.worldActorLayerRenderer.ctx, shell.worldMapRenderer.ctx);
  assert.equal(shell.worldMapRenderer.worldActorOverlayCtx, shell.worldActorLayerRenderer.ctx);
  assert.equal(shell.worldMapRenderer.worldActorOverlaySeparate, false);
  assert.equal(shell.worldActorLayerRenderer.worldActorOverlaySeparate, false);
  assert.deepEqual(shell.worldActorOverlayAssembly, {
    enabled: true,
    canvasCreated: true,
    ctxSeparated: false,
    reason: 'ctx_shared',
  });
  assert.deepEqual(events, [
    ['worldActorOverlay:assembly', {
      enabled: true,
      canvasCreated: true,
      ctxSeparated: false,
      reason: 'ctx_shared',
    }],
  ]);
});

test('CanvasGameShell mounts world fog as a WebGL layer when the feature flag is enabled', () => {
  const previousRenderer = global.H5CanvasGameRenderer;
  const calls = [];
  const contexts = [];
  class FakeRenderer {
    constructor(options = {}) {
      this.presenter = options.presenter || null;
      this.width = options.width || 390;
      this.height = options.height || 844;
      this.viewportWidth = options.viewportWidth || this.width;
      this.viewportHeight = options.viewportHeight || this.height;
      this.viewportOffsetX = options.viewportOffsetX || 0;
      this.viewportOffsetY = options.viewportOffsetY || 0;
    }
    setAssetsChangedHandler() {}
  }
  global.H5CanvasGameRenderer = FakeRenderer;
  const runtime = {
    width: 390,
    height: 844,
    pixelRatio: 1,
    ensureLayerCanvas(name, options) {
      calls.push(['ensureLayerCanvas', name, options]);
      return {
        getContext(type, attrs) {
          contexts.push([name, type, attrs]);
          return type === 'webgl' ? { createShader() {}, createProgram() {}, drawArrays() {} } : null;
        },
      };
    },
    getLayerMetrics() {
      return { width: 390, height: 844, viewportWidth: 390, viewportHeight: 844, padding: 0 };
    },
  };
  const shell = new CanvasGameShell({
    runtime,
    presenter: {},
    config: { FEATURES: { FOG_OF_WAR_ENABLED: true } },
  });

  try {
    shell.createRenderer({});
  } finally {
    global.H5CanvasGameRenderer = previousRenderer;
  }

  const fogLayerCall = calls.find((call) => call[0] === 'ensureLayerCanvas' && call[1] === 'worldFog');
  assert.equal(fogLayerCall?.[2]?.contextType, 'webgl');
  assert.equal(contexts.some((call) => call[0] === 'worldFog' && call[1] === 'webgl'), true);
  assert.equal(contexts.some((call) => call[0] === 'worldFog' && call[1] === '2d'), false);
});

test('CanvasGameShell routes enabled fog rendering through the ECS fog owner', () => {
  const shell = new CanvasGameShell({
    config: { FEATURES: { FOG_OF_WAR_ENABLED: true } },
  });
  const calls = [];
  shell.worldFogRenderer = {
    renderWorldFog(context) {
      calls.push(['renderWorldFog', context]);
      return true;
    },
    clear() {
      calls.push(['clear']);
    },
  };
  const tileMapView = {
    version: 1,
    seed: 'shell-fog-test',
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
    tiles: [
      { id: 'tile_1_0', q: 1, r: 0, visibility: 'visible', discovered: true, visible: true },
      { id: 'tile_2_0', q: 2, r: 0, visibility: 'unknown', discovered: false, visible: false },
    ],
  };
  const renderSnapshot = WorldMapRenderSnapshot.createSnapshot({
    tileMapView,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });
  shell.worldMapRenderer = {
    lastWorldTileMapContext: {
      renderSnapshot,
      tileMapView,
      viewport: renderSnapshot.viewport,
      geometry: tileMapView.geometry,
      frame: renderSnapshot.frame,
      entries: [],
    },
  };
  shell.syncWorldMapRendererLayerMetrics = () => {
    calls.push(['syncMetrics']);
    return true;
  };

  assert.equal(shell.renderWorldFogLayer(shell.worldMapRenderer.lastWorldTileMapContext), true);

  const renderCall = calls.find((call) => call[0] === 'renderWorldFog');
  assert.equal(shell.getLastFogProjection().schema, 'fog-projection-v1');
  assert.equal(renderCall?.[1]?.fogVisualSnapshot?.schema, 'world-fog-visual-snapshot-v1');
  assert.equal(renderCall?.[1]?.entries.length, 2);
  assert.equal(renderCall?.[1]?.entries[0].tile.visible, true);
});

test('CanvasGameShell does not invoke the ECS fog owner when fog is disabled', () => {
  const shell = new CanvasGameShell({});
  const calls = [];
  shell.worldFogRenderer = {
    renderWorldFog() {
      calls.push(['renderWorldFog']);
      return true;
    },
    clear() {
      calls.push(['clear']);
    },
  };
  shell.worldMapRenderer = {
    lastWorldTileMapContext: {
      tileMapView: { tiles: [] },
      viewport: { scale: 1 },
      frame: { x: 0, y: 0, width: 100, height: 100 },
    },
  };

  assert.equal(shell.renderWorldFogLayer(shell.worldMapRenderer.lastWorldTileMapContext), false);

  assert.deepEqual(calls, [['clear']]);
  assert.equal(shell.getLastFogProjection?.(), null);
});

test('CanvasGameShell keeps debug overlays disabled by default', () => {
  const shell = new CanvasGameShell({
    renderer: { currentFps: 60 },
  });

  assert.equal(shell.isDebugOverlayEnabled('fps'), false);
  assert.equal(shell.createDebugOverlaySnapshot({ fps: 60 }), null);
});

test('CanvasGameShell creates debug overlay snapshots only when the debug flag is enabled', () => {
  const shell = new CanvasGameShell({
    config: { FEATURES: { DEBUG_OVERLAYS_ENABLED: true } },
    renderer: { currentFps: 60, fpsSamples: [60] },
  });
  shell.worldMapRuntime = {
    hasBakedMapLayer: true,
    mapBakeDirty: false,
    lastMapDataSignature: 'abc',
    hitTargets: [],
  };

  const snapshot = shell.createDebugOverlaySnapshot({
    visibilitySnapshot: {
      counts: { unknown: 0, explored: 1, visible: 2, controlled: 1 },
      signature: 'visibility',
    },
    lastInputAction: { type: 'worldMapDrag', background: true },
  }, {
    enabledOverlayKeys: ['fps', 'worldMapBake', 'visibility', 'inputTrace'],
  });

  assert.equal(shell.isDebugOverlayEnabled('fps'), true);
  assert.deepEqual(snapshot.keys, ['fps', 'worldMapBake', 'visibility', 'inputTrace']);
  assert.equal(snapshot.values[0], '60');
  assert.equal(snapshot.values[2], 'U0 E1 V2 C1');
});

test('CanvasGameShell passes runtime frame time into render options', () => {
  const shell = new CanvasGameShell({
    runtime: {
      now() {
        return 4321.25;
      },
    },
  });
  shell.lastGame = {
    state: { currentTab: 'military', militaryView: 'world' },
    mapHomeActive: true,
    tutorial: {},
  };

  const options = shell.buildRenderOptions('military', {});

  assert.equal(options.now, 4321.25);
});

test('CanvasGameShell reads battleScene render options from BattleStore only', () => {
  const shell = new CanvasGameShell({
    runtime: {
      now() {
        return 1234;
      },
    },
  });
  BattleStore.closeEntityBattle();
  BattleStore.openBattleScene({
    visible: true,
    report: { id: 'snapshot-report' },
    turnIndex: 0,
  });
  shell.lastGame = {
    state: { currentTab: 'military', militaryView: 'army' },
    tutorial: {},
  };
  shell.battleScene = { visible: true, report: { id: 'removed-shell-mirror' }, turnIndex: 0 };

  const options = shell.buildRenderOptions('military', {});

  assert.equal(options.battleScene.report.id, 'snapshot-report');
  BattleStore.closeBattleScene();
});

test('CanvasGameShell treats tutorial advisor dialogue as a blocking overlay', () => {
  const shell = new CanvasGameShell({});

  shell.tutorialAdvisorDialogue = { source: 'houseBuilt' };
  assert.equal(shell.hasBlockingOverlayOpen(), true);
  assert.equal(shell.hasBlockingOverlayExceptTechTree(), true);

  shell.tutorialAdvisorDialogue = null;
  shell.lastGame = { tutorialAdvisorDialogue: { source: 'houseBuilt' } };
  assert.equal(shell.hasBlockingOverlayOpen(), true);
  assert.equal(shell.hasBlockingOverlayExceptTechTree(), true);
});

test('CanvasGameShell routes unobstructed world map tile taps through runtime actions', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget(point) {
        calls.push(['rendererHit', point.x, point.y]);
        return null;
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.targetQ, action.targetR]);
        return true;
      },
    },
  });
  shell.lastGame = {
    state: {
      currentTab: 'military',
      militaryView: 'world',
      territoryState: { worldMap: { tiles: [{ id: 'tile_1_1', q: 1, r: 1 }] } },
    },
    mapHomeActive: true,
    getActiveTab() {
      return 'military';
    },
  };
  shell.hasBlockingOverlayOpen = () => false;
  shell.ensureWorldMapRuntimeCoordinator = () => ({
    handleTap(point, event) {
      calls.push(['runtimeTap', point.x, point.y, Boolean(event)]);
      return shell.actionController.handle({ type: 'selectWorldMarchTarget', targetQ: 1, targetR: 1 });
    },
    getMapRuntime() {
      return { hitTargets: [] };
    },
  });

  assert.equal(shell.handleTap({ x: 200, y: 360 }, {}), true);
  assert.deepEqual(calls, [
    ['rendererHit', 200, 360],
    ['runtimeTap', 200, 360, true],
    ['handle', 'selectWorldMarchTarget', 1, 1],
  ]);
});

test('CanvasGameShell routes foreground world map drag background taps through runtime actions', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget(point) {
        calls.push(['rendererHit', point.x, point.y]);
        return { type: 'worldMapDrag', background: true };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.targetQ, action.targetR]);
        return true;
      },
    },
  });
  shell.lastGame = {
    state: {
      currentTab: 'military',
      militaryView: 'world',
      territoryState: { worldMap: { tiles: [{ id: 'tile_1_1', q: 1, r: 1 }] } },
    },
    mapHomeActive: true,
    getActiveTab() {
      return 'military';
    },
  };
  shell.closeWorldSiteHud = () => {
    calls.push(['closeWorldSiteHud']);
    return true;
  };
  shell.ensureWorldMapRuntimeCoordinator = () => ({
    handleTap(point, event) {
      calls.push(['runtimeTap', point.x, point.y, Boolean(event)]);
      return shell.actionController.handle({ type: 'selectWorldMarchTarget', targetQ: 1, targetR: 1 });
    },
    getMapRuntime() {
      return { hitTargets: [] };
    },
  });

  assert.equal(shell.handleTap({ x: 210, y: 372 }, {}), true);
  assert.deepEqual(calls, [
    ['rendererHit', 210, 372],
    ['runtimeTap', 210, 372, true],
    ['handle', 'selectWorldMarchTarget', 1, 1],
  ]);
});

test('CanvasGameShell routes background march tile hit targets through runtime for precise coordinates', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget(point) {
        calls.push(['rendererHit', point.x, point.y]);
        return { type: 'selectWorldMarchTarget', targetQ: 2, targetR: 2, background: true };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.targetQ, action.targetR]);
        return true;
      },
    },
  });
  shell.lastGame = {
    state: {
      currentTab: 'military',
      militaryView: 'world',
      territoryState: { worldMap: { tiles: [{ id: 'tile_2_2', q: 2, r: 2 }] } },
    },
    mapHomeActive: true,
    getActiveTab() {
      return 'military';
    },
  };
  shell.ensureWorldMapRuntimeCoordinator = () => ({
    handleTap(point, event) {
      calls.push(['runtimeTap', point.x, point.y, Boolean(event)]);
      return shell.actionController.handle({ type: 'selectWorldMarchTarget', targetQ: 3, targetR: 3 });
    },
    getMapRuntime() {
      return { hitTargets: [] };
    },
  });

  assert.equal(shell.handleTap({ x: 195, y: 498.58 }, {}), true);
  assert.deepEqual(calls, [
    ['rendererHit', 195, 498.58],
    ['runtimeTap', 195, 498.58, true],
    ['handle', 'selectWorldMarchTarget', 3, 3],
  ]);
});

test('CanvasGameShell does not dispatch renderer background march targets when runtime misses', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget(point) {
        calls.push(['rendererHit', point.x, point.y]);
        return { type: 'selectWorldMarchTarget', targetQ: 2, targetR: 2, background: true };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.targetQ, action.targetR]);
        return true;
      },
    },
  });
  shell.lastGame = {
    state: {
      currentTab: 'military',
      militaryView: 'world',
      territoryState: { worldMap: { tiles: [{ id: 'tile_2_2', q: 2, r: 2 }] } },
    },
    mapHomeActive: true,
    getActiveTab() {
      return 'military';
    },
  };
  shell.ensureWorldMapRuntimeCoordinator = () => ({
    handleTap(point, event) {
      calls.push(['runtimeTap', point.x, point.y, Boolean(event)]);
      return false;
    },
    getMapRuntime() {
      return { hitTargets: [] };
    },
  });

  assert.equal(shell.handleTap({ x: 195, y: 498.58 }, {}), false);
  assert.deepEqual(calls, [
    ['rendererHit', 195, 498.58],
    ['runtimeTap', 195, 498.58, true],
  ]);
});

test('CanvasGameShell routes world map HUD taps before closing existing map HUD state', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget(point) {
        calls.push(['rendererHit', point.x, point.y]);
        return null;
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.targetQ, action.targetR]);
        return true;
      },
    },
  });
  shell.lastGame = {
    state: {
      currentTab: 'military',
      militaryView: 'world',
      territoryState: { worldMap: { tiles: [{ id: 'tile_1_1', q: 1, r: 1 }] } },
    },
    mapHomeActive: true,
    getActiveTab() {
      return 'military';
    },
  };
  shell.closeWorldSiteHud = () => {
    calls.push(['closeWorldSiteHud']);
    return true;
  };
  shell.ensureWorldMapRuntimeCoordinator = () => ({
    handleTap(point) {
      calls.push(['runtimeTap', point.x, point.y]);
      return shell.actionController.handle({ type: 'openWorldMarchFormationPicker', targetQ: 1, targetR: 1 });
    },
    getMapRuntime() {
      return { hitTargets: [] };
    },
  });

  assert.equal(shell.handleTap({ x: 232, y: 330 }, {}), true);
  assert.deepEqual(calls, [
    ['rendererHit', 232, 330],
    ['runtimeTap', 232, 330],
    ['handle', 'openWorldMarchFormationPicker', 1, 1],
  ]);
});

test('CanvasGameShell can render resources without default map-home coercion', () => {
  const calls = [];
  const state = {
    currentTab: 'military',
    militaryView: 'world',
    territoryState: { worldMap: { tiles: [{ id: 'tile_0_0' }] } },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    renderer: {
      render(renderState, options) {
        calls.push(['render', renderState.currentTab, options.activeTab, options.isMapHome]);
      },
    },
  });
  shell.lastGame = {
    state,
    mapHomeActive: true,
    tutorial: {},
  };
  shell.setWorldMapLayerVisible = () => {};
  shell.renderWorldMapLayer = () => false;

  assert.equal(shell.renderReadOnly(state, 'resources', { forceMapHome: false, allowDefaultMapHome: false }), true);

  assert.deepEqual(calls.at(-1), ['render', 'resources', 'resources', false]);
  // renderReadOnly honors its name: the input `state` object is not mutated; the
  // resolved tab/view land on the canonical owner via StateWriter (single write point).
  assert.equal(state.currentTab, 'military');
  assert.equal(state.militaryView, 'world');
  assert.equal(shell.lastGame.state.currentTab, 'resources');
  assert.equal(shell.lastGame.state.militaryView, 'army');
  assert.equal(shell.mapHomeActive, false);
});

test('CanvasGameShell renderCanvasSurface uses mounted game state instead of inherited shell state', () => {
  const calls = [];
  const gameState = {
    currentTab: 'military',
    militaryView: 'world',
    territoryState: {
      worldMap: { version: 7, tiles: Array.from({ length: 25 }, (_, index) => ({ id: `tile_${index}` })) },
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    renderer: {
      render(renderState, options) {
        calls.push({
          activeTab: options.activeTab,
          tileCount: renderState.territoryState?.worldMap?.tiles?.length || 0,
          version: renderState.territoryState?.worldMap?.version || 0,
        });
      },
    },
  });
  shell.state = {
    currentTab: 'military',
    militaryView: 'world',
    territoryState: { worldMap: { version: 0, tiles: [] } },
  };
  shell.lastGame = {
    state: gameState,
    mapHomeActive: true,
    tutorial: {},
  };
  shell.setWorldMapLayerVisible = () => {};
  shell.renderWorldMapLayer = (renderState) => {
    calls.push({
      layerTileCount: renderState.territoryState?.worldMap?.tiles?.length || 0,
      layerVersion: renderState.territoryState?.worldMap?.version || 0,
    });
    return true;
  };

  assert.equal(shell.renderCanvasSurface('military'), true);

  assert.deepEqual(calls, [
    { layerTileCount: 25, layerVersion: 7 },
    { activeTab: 'military', tileCount: 25, version: 7 },
  ]);
});

test('CanvasGameShell renders HUD with the latest shared world actor selection', () => {
  const calls = [];
  const state = {
    currentTab: 'military',
    militaryView: 'world',
    territoryState: { worldMap: { tiles: [] } },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    renderer: {
      render(renderState, options) {
        calls.push(['render', renderState.currentTab, options.territoryUiState]);
      },
    },
  });
  shell.lastGame = {
    state,
    mapHomeActive: true,
    territoryUiState: {
      selectedWorldActorId: 'explore-active-1',
      worldMarchTarget: null,
      worldPanX: 12,
      worldPanY: -4,
    },
    tutorial: {},
  };
  shell.territoryUiState = shell.lastGame.territoryUiState;
  shell.setWorldMapLayerVisible = () => {};
  shell.renderWorldMapLayer = () => false;

  assert.equal(shell.renderReadOnly(state, 'military'), true);

  const renderedUiState = calls.at(-1)[2];
  assert.equal(renderedUiState.selectedWorldActorId, 'explore-active-1');
  assert.equal(renderedUiState.worldPanX, 12);
  assert.equal(renderedUiState.worldPanY, -4);
});

test('CanvasGameShell redraws runtime world map when baked layer backing store is stale', () => {
  const calls = [];
  const state = {
    currentTab: 'military',
    militaryView: 'world',
    territoryState: { worldMap: { tiles: [{ id: 'tile_0_0' }] } },
  };
  const runtime = {
    hasBakedMapLayer: true,
    mapBakeDirty: false,
    bakedLayerState: {
      epoch: 1,
      width: 300,
      height: 200,
      pixelRatio: 1,
    },
    getBakedLayerState() {
      return this.bakedLayerState;
    },
    isMapBakeDirty() {
      calls.push(['isMapBakeDirty']);
      return false;
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    renderer: {
      render(renderState, options) {
        calls.push(['render', options.skipWorldMapLayer, options.preserveCanvas]);
      },
    },
  });
  shell.lastGame = {
    state,
    mapHomeActive: true,
    tutorial: {},
  };
  shell.getCanvasLayerBackingStoreState = () => ({
    epoch: 2,
    width: 300,
    height: 200,
    pixelRatio: 1,
    reason: 'resize',
  });
  shell.getCanvasLayerMetrics = () => ({ width: 300, height: 200, viewportWidth: 280, viewportHeight: 180, padding: 10 });
  shell.setWorldMapLayerVisible = (visible) => {
    calls.push(['visible', visible]);
    return true;
  };
  shell.renderRuntimeWorldMap = (renderState, options) => {
    calls.push(['renderRuntimeWorldMap', renderState.currentTab, Boolean(options.force)]);
    runtime.bakedLayerState = {
      epoch: 2,
      width: 300,
      height: 200,
      pixelRatio: 1,
    };
    return true;
  };
  shell.worldMapRenderer = {};
  shell.worldMapRuntime = runtime;
  shell.worldMapRuntimeCoordinator = {
    canRender() {
      return true;
    },
    getMapRuntime() {
      return runtime;
    },
  };

  assert.equal(shell.renderReadOnly(state, 'military'), true);

  assert.deepEqual(calls, [
    ['renderRuntimeWorldMap', 'military', true],
    ['visible', true],
    ['render', true, false],
  ]);
});

test('CanvasGameShell refreshes actor overlay when a valid baked map layer is reused', () => {
  const calls = [];
  const state = {
    currentTab: 'military',
    militaryView: 'world',
    territoryState: { worldMap: { tiles: [{ id: 'tile_0_0' }] } },
    worldExplorerState: {
      idleMissions: [{
        id: 'explore-idle',
        status: 'idle',
        current: { q: 1, r: 0, tileId: 'tile_1_0' },
        homeOrigin: { q: 0, r: 0, tileId: 'tile_0_0' },
      }],
    },
  };
  const mapContext = {
    frame: { x: 0, y: 0, width: 300, height: 200 },
    tileMapView: { tiles: [{ id: 'tile_0_0' }] },
    viewport: { scale: 1 },
  };
  const runtime = {
    hasBakedMapLayer: true,
    mapBakeDirty: false,
    bakedLayerState: {
      epoch: 2,
      width: 300,
      height: 200,
      pixelRatio: 1,
    },
    lastTileMapContext: mapContext,
    getBakedLayerState() {
      return this.bakedLayerState;
    },
    getLastTileMapContext() {
      return this.lastTileMapContext;
    },
    isMapBakeDirty() {
      calls.push(['isMapBakeDirty']);
      return false;
    },
    syncHitTargetsFromRenderer(options) {
      calls.push(['syncHitTargetsFromRenderer', options]);
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    renderer: {
      render(renderState, options) {
        calls.push(['render', options.skipWorldMapLayer, options.worldMapRuntimeContext]);
      },
    },
  });
  shell.lastGame = {
    state,
    mapHomeActive: true,
    tutorial: {},
  };
  shell.getCanvasLayerBackingStoreState = () => ({
    epoch: 2,
    width: 300,
    height: 200,
    pixelRatio: 1,
    reason: 'valid',
  });
  shell.getCanvasLayerMetrics = () => ({ width: 300, height: 200, viewportWidth: 280, viewportHeight: 180, padding: 10 });
  shell.setWorldMapLayerVisible = (visible) => {
    calls.push(['visible', visible]);
    return true;
  };
  shell.renderRuntimeWorldMap = () => {
    calls.push(['renderRuntimeWorldMap']);
    return true;
  };
  shell.renderWorldActorLayer = (options) => {
    calls.push([
      'renderWorldActorLayer',
      options.state.worldExplorerState.idleMissions[0].id,
      options.worldMapRuntimeContext,
      options.preserveRuntimeHitTargetsOnEmpty,
    ]);
    return true;
  };
  shell.worldActorLayerRenderer = {};
  shell.worldMapRenderer = {};
  shell.worldMapRuntime = runtime;
  shell.worldMapRuntimeCoordinator = {
    canRender() {
      return true;
    },
    getMapRuntime() {
      return runtime;
    },
  };

  assert.equal(shell.renderReadOnly(state, 'military'), true);

  assert.equal(calls.some((call) => call[0] === 'renderRuntimeWorldMap'), false);
  assert.deepEqual(calls, [
    ['isMapBakeDirty'],
    ['visible', true],
    ['render', true, mapContext],
    ['renderWorldActorLayer', 'explore-idle', mapContext, true],
  ]);
});

test('CanvasGameShell does not skip map layer when hit targets are preserved but baked layer is invalid', () => {
  const calls = [];
  const state = {
    currentTab: 'military',
    militaryView: 'world',
    territoryState: { worldMap: { tiles: [{ id: 'tile_0_0' }] } },
  };
  const runtime = {
    hasBakedMapLayer: true,
    worldMapInputState: {
      baseHitTargets: [{ action: { type: 'enterCity' } }],
      hitTargets: [{ action: { type: 'enterCity' } }],
      lastHitTargetSync: {
        baseHitTargetCount: 1,
        hitTargetCount: 1,
        mapTargetCount: 0,
        preserved: true,
        sourceHitTargetCount: 0,
      },
    },
    mapBakeDirty: false,
    bakedLayerState: {
      epoch: 1,
      width: 300,
      height: 200,
      pixelRatio: 1,
    },
    getBakedLayerState() {
      return this.bakedLayerState;
    },
    getBaseHitTargets() {
      return this.worldMapInputState.baseHitTargets;
    },
    getHitTargets() {
      return this.worldMapInputState.hitTargets;
    },
    getLastHitTargetSync() {
      return this.worldMapInputState.lastHitTargetSync;
    },
    isMapBakeDirty() {
      return false;
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    renderer: {
      render(renderState, options) {
        calls.push(['render', options.skipWorldMapLayer, options.preserveCanvas, options.worldMapFrameState?.hitTargetsPreserved]);
      },
    },
  });
  shell.lastGame = {
    state,
    mapHomeActive: true,
    tutorial: {},
  };
  shell.getCanvasLayerBackingStoreState = () => ({
    epoch: 2,
    width: 300,
    height: 200,
    pixelRatio: 1,
    reason: 'resize',
  });
  shell.getCanvasLayerMetrics = () => ({ width: 300, height: 200, viewportWidth: 280, viewportHeight: 180, padding: 10 });
  shell.setWorldMapLayerVisible = (visible) => {
    calls.push(['visible', visible]);
    return true;
  };
  shell.renderRuntimeWorldMap = () => {
    calls.push(['renderRuntimeWorldMap']);
    return true;
  };
  shell.worldMapRenderer = {};
  shell.worldMapRuntime = runtime;
  shell.worldMapRuntimeCoordinator = {
    canRender() {
      return true;
    },
    getMapRuntime() {
      return runtime;
    },
  };

  assert.equal(shell.renderReadOnly(state, 'military'), true);

  assert.deepEqual(calls, [
    ['renderRuntimeWorldMap'],
    ['visible', false],
    ['render', false, false, undefined],
  ]);
});

test('CanvasGameShell forces world map redraw instead of hiding an invalid baked layer', () => {
  const calls = [];
  const state = {
    currentTab: 'military',
    militaryView: 'world',
    territoryState: { worldMap: { tiles: [{ id: 'tile_0_0' }] } },
  };
  const runtime = {
    hasBakedMapLayer: true,
    mapBakeDirty: false,
    bakedLayerState: {
      epoch: 1,
      width: 300,
      height: 200,
      pixelRatio: 1,
    },
    getBakedLayerState() {
      return this.bakedLayerState;
    },
    isMapBakeDirty() {
      return false;
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    renderer: {
      render(renderState, options) {
        calls.push(['render', options.skipWorldMapLayer, options.preserveCanvas]);
      },
    },
  });
  shell.lastGame = {
    state,
    mapHomeActive: true,
    tutorial: {},
  };
  shell.getCanvasLayerBackingStoreState = () => ({
    epoch: 2,
    width: 300,
    height: 200,
    pixelRatio: 1,
    reason: 'resize',
  });
  shell.getCanvasLayerMetrics = () => ({ width: 300, height: 200, viewportWidth: 280, viewportHeight: 180, padding: 10 });
  shell.setWorldMapLayerVisible = (visible) => {
    calls.push(['visible', visible]);
    return true;
  };
  shell.renderRuntimeWorldMap = (renderState, options) => {
    calls.push(['renderRuntimeWorldMap', Boolean(options.force)]);
    runtime.bakedLayerState = {
      epoch: 2,
      width: 300,
      height: 200,
      pixelRatio: 1,
    };
    return true;
  };
  shell.worldMapRenderer = {};
  shell.worldMapRuntime = runtime;
  shell.worldMapRuntimeCoordinator = {
    canRender() {
      return true;
    },
    getMapRuntime() {
      return runtime;
    },
  };

  assert.equal(shell.renderReadOnly(state, 'military'), true);

  assert.deepEqual(calls, [
    ['renderRuntimeWorldMap', true],
    ['visible', true],
    ['render', true, false],
  ]);
});

test('CanvasGameShell keeps guided resource render target during active refreshes', () => {
  const calls = [];
  const state = {
    currentTab: 'military',
    militaryView: 'world',
    territoryState: { worldMap: { tiles: [{ id: 'tile_0_0' }] } },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    renderer: {
      render(renderState, options) {
        calls.push(['render', renderState.currentTab, options.activeTab, options.isMapHome]);
      },
    },
  });
  shell.lastGame = {
    state,
    mapHomeActive: true,
    activeTab: 'military',
    militaryView: 'world',
    tutorial: {},
  };
  shell.setWorldMapLayerVisible = () => {};
  shell.renderWorldMapLayer = () => false;
  shell.tutorialHighlight = {
    renderActiveTab: 'resources',
    renderOptions: { forceMapHome: false, allowDefaultMapHome: false },
  };

  assert.equal(shell.renderActive(), true);

  assert.deepEqual(calls.at(-1), ['render', 'resources', 'resources', false]);
  // renderReadOnly honors its name: the input `state` object is not mutated; the
  // resolved tab/view land on the canonical owner via StateWriter (single write point).
  assert.equal(state.currentTab, 'military');
  assert.equal(state.militaryView, 'world');
  assert.equal(shell.lastGame.state.currentTab, 'resources');
  assert.equal(shell.lastGame.state.militaryView, 'army');
  assert.equal(shell.mapHomeActive, false);
});

test('CanvasGameShell routes map command tech tree drag through command panel hit target', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      hitTargets: [
        { x: 40, y: 360, width: 300, height: 240, action: { type: 'techTreeDrag', background: true } },
      ],
      getHitTarget(point) {
        calls.push(['getHitTarget', point.x, point.y]);
        return { type: 'blockCanvasModal' };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.phase]);
        return true;
      },
    },
  });
  shell.lastGame = makeModalHost({
    state: { currentTab: 'military', militaryView: 'world' },
    mapHomeActive: true,
    getActiveTab() {
      return 'military';
    },
  });
  shell.lastGame.openBlockingPanelSnapshot('activeCommandPanel', 'tech');

  assert.equal(shell.handleDrag('start', { x: 120, y: 420 }, {}), true);
  assert.equal(shell.handleDrag('move', { x: 150, y: 460 }, {}), true);
  assert.equal(shell.handleDrag('end', { x: 150, y: 460 }, {}), true);

  assert.deepEqual(
    calls.filter((call) => call[0] === 'handle'),
    [
      ['handle', 'techTreeDrag', 'start'],
      ['handle', 'techTreeDrag', 'move'],
      ['handle', 'techTreeDrag', 'end'],
    ],
  );
  assert.equal(calls.some((call) => call[0] === 'getHitTarget'), false);
});

test('CanvasGameShell routes map command tech tree wheel zoom at tree hit target', () => {
  const calls = [];
  const event = {
    preventDefault() {
      calls.push(['preventDefault']);
    },
    stopPropagation() {
      calls.push(['stopPropagation']);
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      hitTargets: [
        { x: 40, y: 360, width: 300, height: 240, action: { type: 'techTreeDrag', background: true } },
      ],
      getHitTarget(point) {
        calls.push(['getHitTarget', point.x, point.y]);
        return { type: 'blockCanvasModal' };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.gesture.scaleDelta]);
        return true;
      },
    },
  });
  shell.lastGame = makeModalHost({
    state: { currentTab: 'military', militaryView: 'world' },
    mapHomeActive: true,
    getActiveTab() {
      return 'military';
    },
  });
  shell.lastGame.openBlockingPanelSnapshot('activeCommandPanel', 'tech');

  assert.equal(shell.handleGesture({ type: 'wheelZoom', scaleDelta: 1.1, centerX: 180, centerY: 520 }, event), true);

  assert.deepEqual(calls, [
    ['handle', 'techTreeZoom', 1.1],
    ['preventDefault'],
    ['stopPropagation'],
  ]);
});

test('CanvasGameShell resolves guide targets in rendered hit order', () => {
  const shell = new CanvasGameShell({
    renderer: {
      hitTargets: [
        { x: 0, y: 0, width: 420, height: 747, action: { type: 'closeFamousPersons', background: true } },
        { x: 24, y: 64, width: 58, height: 30, action: { type: 'closeFamousPersons' } },
      ],
    },
  });

  const target = shell.getCanvasTarget('closeFamousPersons');

  assert.equal(target.x, 24);
  assert.equal(target.y, 64);
  assert.equal(target.width, 58);
  assert.equal(target.height, 30);
  assert.deepEqual(target.action, { type: 'closeFamousPersons' });
});

test('CanvasGameShell closeFamousPersons syncs game state and resumes tutorial', () => {
  const calls = [];
  const game = {
    famousPersonsPage: 2,
    selectedFamousPersonId: 'fp-scout',
    tutorialController: {
      onFamousPersonsClosed() {
        calls.push(['onFamousPersonsClosed']);
      },
    },
  };
  const shell = new CanvasGameShell({
    renderer: {
      clearFamousSkillTooltip() {
        calls.push(['clearFamousSkillTooltip']);
      },
    },
  });
  shell.lastGame = game;
  shell.openBlockingPanelSnapshot('showFamousPersons', true);

  assert.equal(shell.closeFamousPersons(), true);

  assert.equal(shell.isBlockingPanelSnapshotOpen('showFamousPersons'), false);
  assert.equal(shell.famousPersonsPage, 0);
  assert.equal(shell.selectedFamousPersonId, '');
  assert.equal(game.famousPersonsPage, 0);
  assert.equal(game.selectedFamousPersonId, '');
  assert.deepEqual(calls, [['clearFamousSkillTooltip'], ['onFamousPersonsClosed']]);
});

test('CanvasGameShell action controller advances tutorial after closeFamousPersons tap', () => {
  const calls = [];
  const game = {
    famousPersonsPage: 2,
    selectedFamousPersonId: 'fp-scout',
    tutorialController: {
      onFamousPersonsClosed() {
        calls.push(['onFamousPersonsClosed']);
      },
      refreshCurrentHighlight() {
        calls.push(['refreshCurrentHighlight']);
      },
    },
  };
  const shell = new CanvasGameShell({
    runtime: {
      setTimeout(callback, delayMs) {
        calls.push(['setTimeout', delayMs]);
        callback();
      },
    },
    renderer: {
      clearFamousSkillTooltip() {
        calls.push(['clearFamousSkillTooltip']);
      },
    },
  });
  shell.lastGame = game;
  shell.openBlockingPanelSnapshot('showFamousPersons', true);
  shell.renderActive = () => {
    calls.push(['renderActive']);
    return true;
  };

  assert.equal(shell.actionController.handle({ type: 'closeFamousPersons' }), true);

  assert.equal(shell.isBlockingPanelSnapshotOpen('showFamousPersons'), false);
  assert.deepEqual(calls, [
    ['clearFamousSkillTooltip'],
    ['renderActive'],
    ['onFamousPersonsClosed'],
    ['setTimeout', 0],
    ['refreshCurrentHighlight'],
  ]);
});

test('CanvasGameShell keeps highlighted city people guides on map home', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      hitTargets: [],
    },
  });
  shell.lastGame = {
    state: { currentTab: 'military', militaryView: 'world' },
    activeTab: 'military',
    militaryView: 'world',
    mapHomeActive: true,
  };
  shell.renderReadOnly = (state, activeTab, options) => {
    calls.push(['renderReadOnly', activeTab, options]);
    return true;
  };
  shell.renderActive = () => {
    calls.push(['renderActive']);
    return true;
  };

  assert.equal(shell.showTutorialHighlight(
    { x: 24, y: 96, width: 80, height: 32 },
    'open policy',
    {
      allowedAction: { type: 'assignJob' },
      renderActiveTab: 'military',
      renderOptions: { forceMapHome: true, isMapHome: true },
    },
  ), true);

  assert.deepEqual(calls, [
    ['renderReadOnly', 'military', { forceMapHome: true, isMapHome: true }],
  ]);
  assert.deepEqual(shell.tutorialHighlight.renderOptions, { forceMapHome: true, isMapHome: true });
  assert.equal(shell.lastGame.state.currentTab, 'military');
  assert.equal(shell.lastGame.state.militaryView, 'world');
  assert.equal(shell.lastGame.activeTab, 'military');
  assert.equal(shell.lastGame.militaryView, 'world');
  assert.equal(shell.lastGame.mapHomeActive, true);
});

test('CanvasGameShell stores original guide target action for highlight hit forwarding', () => {
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      hitTargets: [],
    },
  });
  shell.renderActive = () => true;

  assert.equal(shell.showTutorialHighlight(
    {
      x: 24,
      y: 96,
      width: 80,
      height: 32,
      action: {
        type: 'selectWorldMarchTarget',
        tileId: 'tile_2_2',
        targetQ: 2,
        targetR: 2,
        background: true,
      },
    },
    'pick a tile',
    { allowedAction: { type: 'selectWorldMarchTarget' } },
  ), true);

  assert.deepEqual(shell.tutorialHighlight.allowedAction, { type: 'selectWorldMarchTarget' });
  assert.deepEqual(shell.tutorialHighlight.targetAction, {
    type: 'selectWorldMarchTarget',
    tileId: 'tile_2_2',
    targetQ: 2,
    targetR: 2,
    background: true,
  });
});

test('CanvasGameShell refreshes world-site guide highlight from live anchor before each render', () => {
  const renderCalls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      render(state, options) {
        renderCalls.push(options.tutorialHighlight?.rect || null);
      },
    },
    worldMapRenderer: {
      lastWorldTileMapContext: { fresh: true },
      getWorldSiteCanvasAnchor(siteId) {
        return {
          hitRect: { x: 144, y: 96, width: 52, height: 44 },
          site: { id: siteId },
          tile: { id: 'tile_live' },
        };
      },
    },
  });
  shell.lastGame = {
    state: {
      currentTab: 'military',
      militaryView: 'world',
      territoryState: {
        territories: [{ id: 'capital' }],
        worldMap: { tiles: [{ id: 'tile_live', q: 0, r: 0, siteId: 'capital' }] },
      },
    },
    activeTab: 'military',
    militaryView: 'world',
    mapHomeActive: true,
  };
  shell.getActiveTab = () => 'military';
  shell.ensureWorldMapRuntimeCoordinator = () => ({ canRender: () => false });
  shell.renderWorldMapLayer = () => true;
  shell.setWorldMapLayerVisible = () => true;
  shell.tutorialHighlight = {
    rect: { left: 12, top: 18, width: 52, height: 44 },
    message: 'open capital',
    allowedAction: { type: 'openWorldSite', siteId: 'capital' },
    targetAction: { type: 'openWorldSite', siteId: 'capital', tileId: 'tile_old' },
    locator: { type: 'worldSite', siteId: 'capital' },
  };

  assert.equal(shell.renderReadOnly(shell.lastGame.state, 'military', { forceMapHome: true }), true);

  assert.deepEqual(renderCalls.at(-1), { left: 144, top: 96, width: 52, height: 44, right: 196, bottom: 140 });
  assert.equal(shell.tutorialHighlight.targetAction.tileId, 'tile_live');
});

test('CanvasGameShell drops world-site guide highlight when live anchor is unavailable', () => {
  const renderCalls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      render(state, options) {
        renderCalls.push(options.tutorialHighlight || null);
      },
    },
    worldMapRenderer: {
      lastWorldTileMapContext: { stale: true },
      getWorldSiteCanvasAnchor() {
        return null;
      },
    },
  });
  shell.lastGame = {
    state: {
      currentTab: 'military',
      militaryView: 'world',
      territoryState: {
        territories: [{ id: 'capital' }],
        worldMap: { tiles: [{ id: 'tile_live', q: 0, r: 0, siteId: 'capital' }] },
      },
    },
    activeTab: 'military',
    militaryView: 'world',
    mapHomeActive: true,
  };
  shell.getActiveTab = () => 'military';
  shell.ensureWorldMapRuntimeCoordinator = () => ({ canRender: () => false });
  shell.renderWorldMapLayer = () => true;
  shell.setWorldMapLayerVisible = () => true;
  shell.tutorialHighlight = {
    rect: { left: 12, top: 18, width: 52, height: 44 },
    message: 'open capital',
    allowedAction: { type: 'openWorldSite', siteId: 'capital' },
    targetAction: { type: 'openWorldSite', siteId: 'capital', tileId: 'tile_old' },
    locator: { type: 'worldSite', siteId: 'capital' },
  };

  assert.equal(shell.renderReadOnly(shell.lastGame.state, 'military', { forceMapHome: true }), true);

  assert.equal(renderCalls.at(-1), null);
  assert.equal(shell.tutorialHighlight, null);
});

test('CanvasGameShell passes world-map anchor source into tutorial intro HUD render options', () => {
  const renderCalls = [];
  const liveContext = { tileMapView: { tiles: [{ id: 'tile_live' }] }, viewport: {} };
  const worldMapRenderer = {
    lastWorldTileMapContext: liveContext,
    getWorldSiteCanvasAnchor(siteId) {
      return { hitRect: { x: 120, y: 80, width: 44, height: 40 }, site: { id: siteId }, tile: { id: 'tile_live' } };
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      render(state, options) {
        renderCalls.push({
          sameAnchorSource: options.worldMapAnchorSource === worldMapRenderer,
          sameRenderer: options.worldMapRenderer === worldMapRenderer,
          context: options.worldMapRuntimeContext,
          intro: options.tutorialIntro,
        });
      },
    },
    worldMapRenderer,
  });
  shell.lastGame = {
    state: {
      currentTab: 'military',
      militaryView: 'world',
      territoryState: {
        territories: [{ id: 'capital' }],
        worldMap: { tiles: [{ id: 'tile_live', q: 0, r: 0, siteId: 'capital' }] },
      },
    },
    activeTab: 'military',
    militaryView: 'world',
    mapHomeActive: true,
    tutorialIntro: { active: true, step: 'city', capitalCityId: 'capital' },
  };
  shell.getActiveTab = () => 'military';
  shell.ensureWorldMapRuntimeCoordinator = () => ({ canRender: () => false });
  shell.renderWorldMapLayer = () => true;
  shell.setWorldMapLayerVisible = () => true;

  assert.equal(shell.renderReadOnly(shell.lastGame.state, 'military', { forceMapHome: true }), true);

  assert.equal(renderCalls.at(-1).sameAnchorSource, true);
  assert.equal(renderCalls.at(-1).sameRenderer, true);
  assert.equal(renderCalls.at(-1).context, liveContext);
  assert.equal(renderCalls.at(-1).intro.capitalCityId, 'capital');
});

test('CanvasGameShell consumes tutorial drag outside the target without moving world map', () => {
  const calls = [];
  const event = {
    preventDefault() {
      calls.push(['preventDefault']);
    },
    stopPropagation() {
      calls.push(['stopPropagation']);
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget(point) {
        if (point.x >= 100 && point.x <= 160 && point.y >= 200 && point.y <= 260) {
          return { type: 'openWorldSite', siteId: 'capital' };
        }
        return { type: 'blockCanvasModal', allowedAction: { type: 'openWorldSite', siteId: 'capital' } };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.phase || '']);
        return true;
      },
    },
  });
  shell.tutorialIntro = { active: true, step: 'city', capitalCityId: 'capital' };
  shell.worldMapRuntimeCoordinator = {
    canRouteDrag() {
      calls.push(['canRouteDrag']);
      return true;
    },
    handleDrag() {
      calls.push(['worldDrag']);
      return true;
    },
    getMapRuntime() {
      return null;
    },
  };

  assert.equal(shell.handleDrag('start', { x: 20, y: 40 }, event), true);
  assert.equal(shell.handleDrag('move', { x: 40, y: 80 }, event), true);

  assert.equal(calls.some((call) => call[0] === 'canRouteDrag'), false);
  assert.equal(calls.some((call) => call[0] === 'worldDrag'), false);
  assert.equal(calls.some((call) => call[0] === 'handle'), false);
  assert.equal(calls.filter((call) => call[0] === 'preventDefault').length >= 2, true);
  assert.equal(calls.filter((call) => call[0] === 'stopPropagation').length >= 2, true);
});

test('CanvasGameShell still allows tutorial target taps to advance', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget(point) {
        if (point.x >= 100 && point.x <= 160 && point.y >= 200 && point.y <= 260) {
          return { type: 'openWorldSite', siteId: 'capital' };
        }
        return { type: 'blockCanvasModal', allowedAction: { type: 'openWorldSite', siteId: 'capital' } };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type]);
        return true;
      },
    },
  });
  shell.tutorialIntro = { active: true, step: 'city', capitalCityId: 'capital' };
  shell.tutorialIntroOverlay = {
    advanceFromAction(action) {
      calls.push(['advance', action.type]);
      return true;
    },
  };

  assert.equal(shell.handleTap({ x: 120, y: 220 }, {}), true);

  assert.deepEqual(calls, [
    ['handle', 'openWorldSite'],
    ['advance', 'openWorldSite'],
  ]);
});

test('CanvasGameShell lets reward reveal close above tutorial highlight', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget() {
        return { type: 'closeRewardReveal' };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type]);
        return true;
      },
    },
  });
  shell.openRewardRevealSnapshot({ rewardText: '+10' });
  shell.tutorialHighlight = {
    allowedAction: { type: 'buildBuilding', buildingId: 'farm' },
  };

  assert.equal(shell.handleTap({ x: 120, y: 420 }, {}), true);
  assert.deepEqual(calls, [
    ['handle', 'closeRewardReveal'],
  ]);
});

test('CanvasGameShell lets current tutorial advisor dialogue continue during guided highlights', () => {
  const calls = [];
  const event = {
    preventDefault() {
      calls.push(['preventDefault']);
    },
    stopPropagation() {
      calls.push(['stopPropagation']);
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget() {
        return { type: 'closeAdvisor', source: 'houseBuilt' };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.source]);
        return true;
      },
    },
  });
  shell.tutorialAdvisorDialogue = { source: 'houseBuilt' };
  shell.showTutorialHighlight(
    { x: 100, y: 100, width: 100, height: 80 },
    'locked guide',
    { allowedAction: { type: 'assignJob' } },
  );

  assert.equal(shell.handleTap({ x: 380, y: 590 }, event), true);

  assert.deepEqual(calls, [
    ['handle', 'closeAdvisor', 'houseBuilt'],
    ['preventDefault'],
    ['stopPropagation'],
  ]);
});

test('CanvasGameShell blocks stale tutorial advisor close actions during guided highlights', () => {
  const calls = [];
  const event = {
    preventDefault() {
      calls.push(['preventDefault']);
    },
    stopPropagation() {
      calls.push(['stopPropagation']);
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget() {
        return { type: 'closeAdvisor', source: 'staleDialogue' };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.source]);
        return true;
      },
    },
  });
  shell.tutorialAdvisorDialogue = { source: 'houseBuilt' };
  shell.showTutorialHighlight(
    { x: 100, y: 100, width: 100, height: 80 },
    'locked guide',
    { allowedAction: { type: 'assignJob' } },
  );

  assert.equal(shell.handleTap({ x: 380, y: 590 }, event), true);

  assert.deepEqual(calls, [
    ['preventDefault'],
    ['stopPropagation'],
  ]);
});

test('CanvasGameShell blocks debug reset during tutorial highlight input', () => {
  const calls = [];
  const event = {
    preventDefault() {
      calls.push(['preventDefault']);
    },
    stopPropagation() {
      calls.push(['stopPropagation']);
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget() {
        return { type: 'requestResetGame', source: 'debugResetAccount' };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.source]);
        return true;
      },
    },
  });
  shell.showTutorialHighlight(
    { x: 100, y: 100, width: 100, height: 80 },
    'locked guide',
    { allowedAction: { type: 'assignJob' } },
  );

  assert.equal(shell.handleTap({ x: 380, y: 690 }, event), true);

  assert.deepEqual(calls, [
    ['preventDefault'],
    ['stopPropagation'],
  ]);
});

test('CanvasGameShell blocks non-matching actions during guided highlights', () => {
  const calls = [];
  const event = {
    preventDefault() {
      calls.push(['preventDefault']);
    },
    stopPropagation() {
      calls.push(['stopPropagation']);
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget(point) {
        if (point.x < 100) return { type: 'openSettings' };
        return { type: 'switchTab', tab: 'civilization' };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.tab || '']);
        return true;
      },
    },
  });
  shell.showTutorialHighlight(
    { x: 100, y: 100, width: 100, height: 80 },
    'open civilization',
    { allowedAction: { type: 'switchTab', tab: 'civilization' } },
  );

  assert.equal(shell.handleTap({ x: 20, y: 20 }, event), true);
  assert.equal(shell.handleTap({ x: 120, y: 120 }, event), true);

  assert.deepEqual(calls, [
    ['preventDefault'],
    ['stopPropagation'],
    ['handle', 'switchTab', 'civilization'],
    ['preventDefault'],
    ['stopPropagation'],
  ]);
});

test('CanvasGameShell treats world site id fields as equivalent during guided highlights', () => {
  const calls = [];
  const event = {
    preventDefault() {
      calls.push(['preventDefault']);
    },
    stopPropagation() {
      calls.push(['stopPropagation']);
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget() {
        return { type: 'openWorldSite', territoryId: 'site_1_2' };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.territoryId || '']);
        return true;
      },
    },
  });
  shell.showTutorialHighlight(
    { x: 100, y: 100, width: 100, height: 80 },
    'open first city',
    { allowedAction: { type: 'openWorldSite', siteId: 'site_1_2' } },
  );

  assert.equal(shell.handleTap({ x: 120, y: 120 }, event), true);

  assert.deepEqual(calls, [
    ['handle', 'openWorldSite', 'site_1_2'],
    ['preventDefault'],
    ['stopPropagation'],
  ]);
});

test('CanvasGameShell lets explicit guide highlight override stale intro action rules', () => {
  const calls = [];
  const event = {
    preventDefault() {
      calls.push(['preventDefault']);
    },
    stopPropagation() {
      calls.push(['stopPropagation']);
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget() {
        return { type: 'openWorldSite', siteId: 'site_2_-8' };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.siteId || '']);
        return true;
      },
    },
  });
  shell.tutorialIntro = { active: true, step: 'city', capitalCityId: 'capital' };
  shell.showTutorialHighlight(
    { x: 300, y: 200, width: 80, height: 80 },
    'open first empty city',
    { allowedAction: { type: 'openWorldSite', siteId: 'site_2_-8' } },
  );

  assert.equal(shell.handleTap({ x: 340, y: 240 }, event), true);

  assert.deepEqual(calls, [
    ['handle', 'openWorldSite', 'site_2_-8'],
    ['preventDefault'],
    ['stopPropagation'],
  ]);
});

test('CanvasGameShell keeps local world site selection after forwarded open action', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    onAction(action) {
      calls.push(['forward', action.type, action.siteId]);
      return true;
    },
  });
  shell.lastGame = {
    tutorialController: {
      refreshCurrentHighlight() {
        calls.push(['refresh']);
      },
    },
  };

  assert.equal(shell.forwardCanvasAction({ type: 'openWorldSite', siteId: 'site_2_-8' }), true);

  assert.equal(shell.territoryUiState.selectedSiteId, 'site_2_-8');
  assert.deepEqual(calls, [
    ['forward', 'openWorldSite', 'site_2_-8'],
    ['refresh'],
  ]);
});

test('CanvasGameShell preserves action meta when forwarding canvas actions', () => {
  const calls = [];
  const inputIntent = {
    schema: 'world-map-input-intent-v1',
    inputId: 'wmi-forward-17',
    clientSequence: 17,
  };
  const event = { type: 'tap' };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    onAction(action, forwardedEvent, meta) {
      calls.push({
        actionType: action.type,
        eventType: forwardedEvent?.type || '',
        inputId: meta?.inputIntent?.inputId || '',
        clientSequence: meta?.inputIntent?.clientSequence || 0,
      });
      return true;
    },
  });

  assert.equal(shell.forwardCanvasAction(
    { type: 'selectWorldMarchTarget', targetQ: 1, targetR: -1 },
    { event, inputIntent },
  ), true);

  assert.deepEqual(calls, [{
    actionType: 'selectWorldMarchTarget',
    eventType: 'tap',
    inputId: 'wmi-forward-17',
    clientSequence: 17,
  }]);
});

test('CanvasGameShell syncs local world site selection after handled open action', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.siteId]);
        return true;
      },
    },
  });

  assert.equal(shell.handleAction({ type: 'openWorldSite', siteId: 'site_3_-9' }), true);

  assert.equal(shell.territoryUiState.selectedSiteId, 'site_3_-9');
  assert.deepEqual(calls, [['handle', 'openWorldSite', 'site_3_-9']]);
});

test('CanvasGameShell opens a target picker when an actor overlaps the city', () => {
  const calls = [];
  const hitTargets = [
    CanvasSurfaceHitTargets.normalizeHitTarget(
      { x: 50, y: 50, width: 42, height: 42 },
      { type: 'selectWorldActor', missionId: 'march-1' },
    ),
    CanvasSurfaceHitTargets.normalizeHitTarget(
      { x: 40, y: 40, width: 80, height: 60 },
      { type: 'openWorldSite', siteId: 'capital' },
    ),
  ];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget(point) {
        return CanvasSurfaceHitTargets.resolveHitTarget(hitTargets, point);
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.siteId || action.missionId || action.candidates?.length || '']);
        return true;
      },
    },
  });

  assert.equal(shell.handleTap({ x: 60, y: 60 }, {}), true);

  assert.deepEqual(calls, [['handle', 'openWorldTargetPicker', 2]]);
  assert.equal(shell.territoryUiState.selectedSiteId || '', '');
});

test('CanvasGameShell routes tagged world-map entity hits through runtime before action dispatch', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget(point) {
        calls.push(['rendererHit', point.x, point.y]);
        return {
          type: 'openWorldSite',
          siteId: 'stale-renderer-site',
          inputSurface: 'worldMap',
        };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.siteId || action.actorId || '']);
        return true;
      },
    },
  });
  shell.lastGame = {
    state: {
      currentTab: 'military',
      militaryView: 'world',
      territoryState: { worldMap: { tiles: [{ id: 'tile_0_0', q: 0, r: 0 }] } },
    },
    mapHomeActive: true,
    getActiveTab() {
      return 'military';
    },
  };
  shell.ensureWorldMapRuntimeCoordinator = () => ({
    handleTap(point, event) {
      calls.push(['runtimeTap', point.x, point.y, Boolean(event)]);
      return shell.handleAction({ type: 'openWorldSite', siteId: 'stable-site' }, event);
    },
    getMapRuntime() {
      return { hitTargets: [] };
    },
  });

  assert.equal(shell.handleTap({ x: 60, y: 60 }, {}), true);

  assert.deepEqual(calls, [
    ['rendererHit', 60, 60],
    ['runtimeTap', 60, 60, true],
    ['handle', 'openWorldSite', 'stable-site'],
  ]);
  assert.equal(shell.territoryUiState.selectedSiteId, 'stable-site');
});

test('CanvasGameShell records tap hit and action result into local operation log', () => {
  const previous = global.ClientOperationLog;
  const events = [];
  global.ClientOperationLog = {
    summarizeAction(action) {
      return action ? { type: action.type, siteId: action.siteId || '' } : null;
    },
    summarizePoint(point) {
      return { x: point.x, y: point.y };
    },
    summarizeUiState(uiState) {
      return { selectedSiteId: uiState.selectedSiteId || '' };
    },
    record(type, detail) {
      events.push([type, detail]);
    },
    recordSampled(type, key, detail) {
      events.push([type, detail]);
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget() {
        return { type: 'openWorldSite', siteId: 'capital' };
      },
    },
    actionController: null,
  });
  shell.actionController = new global.CanvasActionController({ host: shell });
  shell.territoryUiState = { selectedSiteId: '' };
  shell.renderActive = () => true;

  try {
    assert.equal(shell.handleTap({ x: 60, y: 60 }, {}), true);
  } finally {
    global.ClientOperationLog = previous;
  }

  assert.equal(events.some((event) => event[0] === 'input:tapHit'), true);
  assert.equal(events.some((event) => event[0] === 'action:begin'), true);
  assert.equal(events.some((event) => event[0] === 'action:end'), true);
});

test('CanvasGameShell records async tap actions as compact promise state', async () => {
  const previous = global.ClientOperationLog;
  const events = [];
  global.ClientOperationLog = {
    summarizeAction(action) {
      return action ? { type: action.type, siteId: action.siteId || '' } : null;
    },
    summarizePoint(point) {
      return { x: point.x, y: point.y };
    },
    summarizeUiState() {
      return {};
    },
    record(type, detail) {
      events.push([type, detail]);
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget() {
        return { type: 'externalWorldCommand', siteId: 'capital' };
      },
    },
    onAction() {
      return Promise.resolve(true);
    },
  });

  try {
    assert.equal(await shell.handleTap({ x: 60, y: 60 }, {}), true);
  } finally {
    global.ClientOperationLog = previous;
  }

  const actionEvent = events.find((event) => event[0] === 'input:tapAction')?.[1];
  assert.equal(actionEvent.action.type, 'externalWorldCommand');
  assert.equal(actionEvent.handled, 'promise');
});

test('CanvasGameShell records async forwarded action failures instead of false success', async () => {
  const previous = global.ClientOperationLog;
  const events = [];
  global.ClientOperationLog = {
    summarizeAction(action) {
      return action ? { type: action.type, siteId: action.siteId || '' } : null;
    },
    summarizePoint(point) {
      return { x: point.x, y: point.y };
    },
    summarizeInputIntent(intent) {
      return intent ? { inputId: intent.inputId, clientSequence: intent.clientSequence } : null;
    },
    summarizeUiState() {
      return {};
    },
    record(type, detail) {
      events.push([type, detail]);
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget() {
        return { type: 'externalWorldCommand', siteId: 'capital' };
      },
    },
    onAction(action) {
      return Promise.reject(new Error(`forward failed: ${action.type}`));
    },
  });

  try {
    await assert.rejects(
      () => shell.handleTap({ x: 60, y: 60 }, {}),
      /forward failed: externalWorldCommand/,
    );
  } finally {
    global.ClientOperationLog = previous;
  }

  assert.equal(events.some((event) => event[0] === 'action:error'), true);
  assert.equal(events.some((event) => event[0] === 'action:end' && event[1].result === true), false);
});

test('CanvasGameShell observes async world-map runtime tap failures for diagnostics', async () => {
  const errors = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget() {
        return { type: 'worldMapDrag', background: true };
      },
    },
    log(error) {
      errors.push(error?.message || String(error || ''));
    },
  });
  shell.ensureWorldMapRuntimeCoordinator = () => ({
    handleTap() {
      return Promise.reject(new Error('runtime tap failed'));
    },
    getMapRuntime() {
      return null;
    },
  });

  const handled = shell.handleTap({ x: 60, y: 60 }, {});
  await assert.rejects(
    () => handled,
    /runtime tap failed/,
  );

  assert.deepEqual(errors, ['runtime tap failed']);
});

test('CanvasGameShell records async runtime tap routing as compact promise state', async () => {
  const previous = global.ClientOperationLog;
  const events = [];
  global.ClientOperationLog = {
    summarizeAction(action) {
      return action ? { type: action.type, background: Boolean(action.background) } : null;
    },
    summarizePoint(point) {
      return { x: point.x, y: point.y };
    },
    record(type, detail) {
      events.push([type, detail]);
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget() {
        return { type: 'worldMapDrag', background: true };
      },
    },
  });
  shell.isTutorialInputActive = () => false;
  shell.hasBlockingOverlayOpen = () => false;
  shell.ensureWorldMapRuntimeCoordinator = () => ({
    handleTap() {
      return Promise.resolve(true);
    },
    getMapRuntime() {
      return null;
    },
  });

  try {
    assert.equal(await shell.handleTap({ x: 60, y: 60 }, {}), true);
  } finally {
    global.ClientOperationLog = previous;
  }

  const runtimeEvent = events.find((event) => event[0] === 'input:tapRuntime')?.[1];
  assert.equal(runtimeEvent.runtimeHandled, 'promise');
});

test('CanvasGameShell records async runtime tap misses as compact promise state', async () => {
  const previous = global.ClientOperationLog;
  const events = [];
  global.ClientOperationLog = {
    summarizeAction(action) {
      return action ? { type: action.type } : null;
    },
    summarizePoint(point) {
      return { x: point.x, y: point.y };
    },
    record(type, detail) {
      events.push([type, detail]);
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget() {
        return null;
      },
    },
  });
  shell.isTutorialInputActive = () => false;
  shell.hasBlockingOverlayOpen = () => false;
  shell.closeWorldSiteHud = () => false;
  shell.ensureWorldMapRuntimeCoordinator = () => ({
    handleTap() {
      return Promise.resolve(true);
    },
    getMapRuntime() {
      return null;
    },
  });

  try {
    assert.equal(await shell.handleTap({ x: 60, y: 60 }, {}), true);
  } finally {
    global.ClientOperationLog = previous;
  }

  const missEvent = events.find((event) => event[0] === 'input:tapMiss')?.[1];
  assert.equal(missEvent.runtimeHandled, 'promise');
});

test('CanvasGameShell keeps map-home HUD rendering after an open world site action', () => {
  const renders = [];
  const state = {
    currentTab: 'resources',
    militaryView: 'army',
    territoryState: {
      territories: [
        { id: 'site_2_-8', status: 'occupied', owner: 'player', cityName: 'Forward City', x: 2, y: -8 },
      ],
      worldMap: {
        tiles: [
          { id: 'tile_2_-8', q: 2, r: -8, siteId: 'site_2_-8' },
        ],
      },
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getTopBarBottom() {
        return 72;
      },
      getHitTarget() {
        return { type: 'openWorldSite', siteId: 'site_2_-8' };
      },
      render(renderState, options) {
        renders.push({
          activeTab: options.activeTab,
          currentTab: renderState.currentTab,
          isMapHome: options.isMapHome,
          militaryView: renderState.militaryView,
          selectedSiteId: options.territoryUiState?.selectedSiteId || '',
        });
      },
    },
  });
  shell.lastGame = {
    state,
    mapHomeActive: true,
    territoryUiState: { selectedSiteId: '' },
    territoryController: {
      uiState: { selectedSiteId: '' },
      getUiState() {
        return { ...this.uiState };
      },
      openSiteDialog(siteId) {
        this.uiState.selectedSiteId = siteId;
        shell.renderReadOnly(state, 'territory');
      },
    },
    tutorial: {},
    tutorialController: { refreshCurrentHighlight() {} },
  };
  shell.territoryUiState = shell.lastGame.territoryUiState;
  shell.setWorldMapLayerVisible = () => {};

  assert.equal(shell.handleTap({ x: 1, y: 1 }, {}), true);

  assert.equal(renders.length > 0, true);
  assert.deepEqual(renders.at(-1), {
    activeTab: 'military',
    currentTab: 'military',
    isMapHome: true,
    militaryView: 'world',
    selectedSiteId: 'site_2_-8',
  });
});

test('CanvasGameShell blocks all drags while a guided highlight is active', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget() {
        return { type: 'worldMapDrag' };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type]);
        return true;
      },
    },
  });
  shell.showTutorialHighlight(
    { x: 20, y: 20, width: 100, height: 100 },
    'tap only',
    { allowedAction: { type: 'switchTab', tab: 'civilization' } },
  );

  assert.equal(shell.handleDrag('start', { x: 30, y: 30 }, {}), true);

  assert.deepEqual(calls, []);
});

test('CanvasGameShell routes active exploration refreshes to the actor animation loop', () => {
  const calls = [];
  let intervalCallback = null;
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    runtime: {
      setInterval(callback, ms) {
        calls.push(['setInterval', ms]);
        intervalCallback = callback;
        return 1;
      },
      clearInterval(timer) {
        calls.push(['clearInterval', timer]);
      },
    },
    renderer: {},
    worldMapRenderer: {},
  });
  shell.worldActorLayerRenderer = {};
  shell.lastGame = {
    state: {
      currentTab: 'military',
      militaryView: 'world',
      worldExplorerState: {
        activeMission: { id: 'explore-1', status: 'active' },
      },
    },
    mapHomeActive: true,
    getActiveTab() {
      return 'military';
    },
  };
  shell.getActiveTab = () => 'military';
  shell.isWorldMapDragging = () => false;
  shell.isWorldMapDragCoolingDown = () => false;
  shell.renderWorldMapLayerFrame = (options) => {
    calls.push(['renderWorldMapLayerFrame', options]);
    return true;
  };
  shell.renderAnimationFrame = () => {
    calls.push(['renderAnimationFrame']);
    return true;
  };
  shell.updateWorldActorAnimationLoop = (options) => {
    calls.push(['updateWorldActorAnimationLoop', options.epochNowMs]);
    return true;
  };

  assert.equal(shell.startTileMapWaterTimer(), true);
  intervalCallback();

  assert.equal(calls.some((call) => call[0] === 'updateWorldActorAnimationLoop'), true);
  assert.equal(calls.some((call) => call[0] === 'renderWorldMapLayerFrame'), false);
  assert.equal(calls.some((call) => call[0] === 'renderAnimationFrame'), false);
});

test('CanvasGameShell routes active missions kept in mission list to actor animation loop', () => {
  const calls = [];
  let intervalCallback = null;
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    runtime: {
      setInterval(callback, ms) {
        calls.push(['setInterval', ms]);
        intervalCallback = callback;
        return 1;
      },
      clearInterval(timer) {
        calls.push(['clearInterval', timer]);
      },
    },
    renderer: {},
    worldMapRenderer: {},
  });
  shell.worldActorLayerRenderer = {};
  shell.lastGame = {
    state: {
      currentTab: 'military',
      militaryView: 'world',
      worldExplorerState: {
        activeMission: null,
        missions: [{
          id: 'explore-1',
          status: 'active',
          origin: { q: 0, r: 0, tileId: 'tile_0_0' },
          route: [{ q: 1, r: 0, tileId: 'tile_1_0', step: 1 }],
          startedAt: '2099-06-06T00:00:00.000Z',
          completesAt: '2099-06-06T00:00:10.000Z',
        }],
      },
    },
    mapHomeActive: true,
    getActiveTab() {
      return 'military';
    },
  };
  shell.getActiveTab = () => 'military';
  shell.isWorldMapDragging = () => false;
  shell.isWorldMapDragCoolingDown = () => false;
  shell.renderWorldMapLayerFrame = (options) => {
    calls.push(['renderWorldMapLayerFrame', options]);
    return true;
  };
  shell.renderAnimationFrame = () => {
    calls.push(['renderAnimationFrame']);
    return true;
  };
  shell.updateWorldActorAnimationLoop = (options) => {
    calls.push(['updateWorldActorAnimationLoop', options.epochNowMs]);
    return true;
  };

  assert.equal(shell.startTileMapWaterTimer(), true);
  intervalCallback();

  assert.equal(calls.some((call) => call[0] === 'updateWorldActorAnimationLoop'), true);
  assert.equal(calls.some((call) => call[0] === 'renderWorldMapLayerFrame'), false);
  assert.equal(calls.some((call) => call[0] === 'renderAnimationFrame'), false);
});

test('CanvasGameShell animates fog by re-rendering the fog layer only', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    config: { FEATURES: { FOG_OF_WAR_ENABLED: true } },
    runtime: {},
  });
  let nowMs = 100000;
  shell.now = () => nowMs;
  shell.getWorldEpochNowMs = () => nowMs;
  shell.isWorldMapDragging = () => false;
  const frameContext = { tileMapView: {}, viewport: {}, frame: {} };
  shell.getCanonicalWorldTileMapContext = () => frameContext;
  // Fog facts are projected fresh from (state, worldClock) inside the projection, so
  // animating fog must NOT re-render the terrain stack — only the fog layer.
  shell.refreshWorldMapLayerFromSnapshot = () => {
    throw new Error('fog animation must not re-render the terrain stack');
  };
  shell.renderWorldFogLayer = (context, options) => {
    calls.push(['fog', context, options.epochNowMs]);
    return true;
  };

  assert.equal(shell.renderWorldFogAnimationFrame(nowMs), true);
  nowMs += 50;
  assert.equal(shell.renderWorldFogAnimationFrame(nowMs), false, 'throttled inside 125ms');
  nowMs += 100;
  assert.equal(shell.renderWorldFogAnimationFrame(nowMs), true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0][1], frameContext, 'geometry comes from the canonical frame context');
  assert.equal(calls[1][2], nowMs, 'facts are projected for the current world clock instant');

  // Drag frames already refresh the full stack every frame — the animator must yield.
  shell.isWorldMapDragging = () => true;
  nowMs += 200;
  assert.equal(shell.renderWorldFogAnimationFrame(nowMs), false);
  assert.equal(calls.length, 2);

  // Without a committed frame context there is no geometry to draw against.
  shell.isWorldMapDragging = () => false;
  shell.getCanonicalWorldTileMapContext = () => null;
  nowMs += 200;
  assert.equal(shell.renderWorldFogAnimationFrame(nowMs), false);
});
