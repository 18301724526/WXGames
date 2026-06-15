const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasGameAppWorldMapRuntimeBridge = require('./CanvasGameAppWorldMapRuntimeBridge');
const CanvasGameAppInputRouter = require('./CanvasGameAppInputRouter');
const WorldMarchGeometry = require('../domain/WorldMarchGeometry');

test('CanvasGameAppWorldMapRuntimeBridge installs world map methods on app prototype', () => {
  class App {}
  assert.equal(CanvasGameAppWorldMapRuntimeBridge.install(App), true);

  [
    'getFrozenWorldMapWaterTimeMs',
    'ensureWorldMapRuntimeCoordinator',
    'renderRuntimeWorldMap',
    'shouldRenderRuntimeWorldMap',
    'refreshWorldMapLayerFromSnapshot',
  ].forEach((methodName) => {
    assert.equal(typeof App.prototype[methodName], 'function');
  });
});

test('CanvasGameAppWorldMapRuntimeBridge tracks snapshot drag water time and cooldown', () => {
  class App {}
  CanvasGameAppWorldMapRuntimeBridge.install(App);

  let now = 1000;
  const app = new App();
  app.now = () => now;
  app.getWorldMapDragCooldownMs = () => 220;
  app.worldMapRuntime = { waterTimeMs: 123 };
  app.worldMapDragWaterTimeMs = null;
  app.worldMapDragCooldownUntil = 0;
  app.worldMapPinchDragging = true;

  assert.equal(app.getFrozenWorldMapWaterTimeMs(), 1000);
  assert.equal(app.isWorldMapDragging(), false);
  assert.equal(app.startWorldMapSnapshotDrag(), 1000);
  assert.equal(app.isWorldMapDragging(), true);
  now = 1200;
  app.finishWorldMapSnapshotDrag();

  assert.equal(app.isWorldMapDragging(), false);
  assert.equal(app.isWorldMapDragCoolingDown(), true);
  assert.equal(app.worldMapPinchDragging, false);
  assert.equal(app.worldMapRuntime.waterTimeMs, null);
  assert.equal(app.worldMapDragCooldownUntil, 1420);
});

test('CanvasGameAppWorldMapRuntimeBridge delegates render decisions to coordinator', () => {
  class App {}
  CanvasGameAppWorldMapRuntimeBridge.install(App);

  const calls = [];
  const runtime = {
    isMapBakeDirty(state, options) {
      calls.push(['isMapBakeDirty', state.id, options.force]);
      return false;
    },
  };
  const coordinator = {
    canRender(state) {
      calls.push(['canRender', state.id]);
      return true;
    },
    render(state, options) {
      calls.push(['render', state.id, options.force]);
      return 'rendered';
    },
    getMapRuntime() {
      calls.push(['getMapRuntime']);
      return runtime;
    },
  };
  const app = new App();
  app.state = { id: 'state-1' };
  app.worldMapRuntimeCoordinator = coordinator;

  assert.equal(app.shouldRenderRuntimeWorldMap(), false);
  assert.equal(app.shouldRenderRuntimeWorldMap({ force: true }), true);
  assert.equal(app.renderRuntimeWorldMap({ force: true }), 'rendered');
  assert.equal(app.worldMapRuntime, runtime);
  assert.deepEqual(calls, [
    ['getMapRuntime'],
    ['canRender', 'state-1'],
    ['isMapBakeDirty', 'state-1', undefined],
    ['getMapRuntime'],
    ['canRender', 'state-1'],
    ['render', 'state-1', true],
    ['getMapRuntime'],
  ]);
});

test('CanvasGameAppWorldMapRuntimeBridge refreshes snapshot layer and commits camera', () => {
  class App {}
  CanvasGameAppWorldMapRuntimeBridge.install(App);

  const calls = [];
  const runtime = {
    camera: { x: 2, y: 3 },
    getCameraUiState: () => ({ worldPanX: 2, worldPanY: 3 }),
    markBakedCamera(camera) {
      calls.push(['markBakedCamera', camera]);
    },
    syncHitTargetsFromRenderer(options) {
      calls.push(['syncHitTargetsFromRenderer', options]);
    },
  };
  const app = new App();
  app.state = { id: 'state-2' };
  app.worldMapDragWaterTimeMs = 345;
  app.getWorldEpochNowMs = () => 24680;
  app.worldMapRuntimeCoordinator = {
    getMapRuntime: () => runtime,
  };
  app.renderer = {
    getTopBarBottom: () => 91,
    renderWorldMapSnapshotLayer(state, options) {
      calls.push(['renderWorldMapSnapshotLayer', state.id, options.topBarBottom, options.waterTimeMs, options.epochNowMs]);
      return true;
    },
    renderWorldMapActorLayer(state, options) {
      calls.push(['renderWorldMapActorLayer', state.id, options.territoryUiState.worldPanX, options.epochNowMs]);
      return true;
    },
  };

  assert.equal(app.refreshWorldMapLayerFromSnapshot(), true);
  assert.deepEqual(calls, [
    ['renderWorldMapSnapshotLayer', 'state-2', 91, 345, 24680],
    ['renderWorldMapActorLayer', 'state-2', 2, 24680],
    ['syncHitTargetsFromRenderer', { preserveOnEmpty: true }],
    ['markBakedCamera', runtime.camera],
  ]);
});

test('CanvasGameAppWorldMapRuntimeBridge keeps actor anchor on the dragged map snapshot frame', () => {
  class App {}
  CanvasGameAppWorldMapRuntimeBridge.install(App);

  const oldContext = {
    frame: { x: 0, y: 0, width: 300, height: 200 },
    geometry: { stepX: 96, stepY: 48 },
    tileMapView: { pan: { x: 0, y: 0 } },
    viewport: { originX: 150, originY: 100, panX: 0, panY: 0, scale: 1 },
  };
  const snapshotContext = {
    frame: oldContext.frame,
    geometry: oldContext.geometry,
    tileMapView: { pan: { x: 48, y: -24 } },
    viewport: { ...oldContext.viewport, panX: 48, panY: -24 },
  };
  const calls = [];
  const runtime = {
    camera: { x: 48, y: -24 },
    lastTileMapContext: oldContext,
    getCameraUiState: () => ({ worldPanX: 48, worldPanY: -24 }),
    getLastTileMapContext() {
      return this.lastTileMapContext;
    },
    markBakedCamera() {},
    syncHitTargetsFromRenderer() {},
  };
  const app = new App();
  app.state = { id: 'state-3' };
  app.worldMapRuntimeCoordinator = {
    getMapRuntime: () => runtime,
  };
  app.renderer = {
    lastWorldTileMapContext: oldContext,
    getTopBarBottom: () => 91,
    renderWorldMapSnapshotLayer() {
      this.lastWorldTileMapContext = snapshotContext;
      return true;
    },
    renderWorldMapActorLayer(state, options) {
      const context = options.worldMapRuntimeContext;
      calls.push(['actorContextPan', context.viewport.panX, context.viewport.panY]);
      calls.push([
        'anchor',
        WorldMarchGeometry.getTileScreenCenter({ q: 0, r: 0 }, context.viewport, context.geometry),
      ]);
      return true;
    },
  };

  assert.equal(app.refreshWorldMapLayerFromSnapshot(), true);

  assert.equal(runtime.lastTileMapContext, snapshotContext);
  assert.deepEqual(calls, [
    ['actorContextPan', 48, -24],
    [
      'anchor',
      WorldMarchGeometry.getTileScreenCenter({ q: 0, r: 0 }, snapshotContext.viewport, snapshotContext.geometry),
    ],
  ]);
});

test('CanvasGameAppWorldMapRuntimeBridge observes async action failures without changing the rejection', async () => {
  class App {}
  CanvasGameAppWorldMapRuntimeBridge.install(App);
  CanvasGameAppInputRouter.install(App);

  const errors = [];
  const app = new App();
  app.useWorldMapRuntime = true;
  app.state = {
    currentTab: 'military',
    militaryView: 'world',
    territoryState: { worldMap: { tiles: [{ id: 'tile_0_0', q: 0, r: 0 }] } },
  };
  app.activeTab = 'military';
  app.militaryView = 'world';
  app.mapHomeActive = true;
  app.renderer = {
    renderWorldMapLayer() {},
  };
  app.presenter = {};
  app.actionController = {
    handle() {
      return Promise.reject(new Error('bridge action failed'));
    },
  };
  app.advanceTutorialIntro = () => {};
  app.log = (error) => errors.push(error?.message || String(error || ''));
  app.now = () => 1;

  const coordinator = app.ensureWorldMapRuntimeCoordinator();
  const handled = coordinator.onAction({ type: 'selectWorldMarchTarget' }, null, {});

  await assert.rejects(
    () => handled,
    /bridge action failed/,
  );
  assert.deepEqual(errors, ['bridge action failed']);
});
