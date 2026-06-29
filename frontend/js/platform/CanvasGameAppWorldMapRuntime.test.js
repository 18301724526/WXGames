const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasGameAppWorldMapRuntime = require('./CanvasGameAppWorldMapRuntime');
const CanvasGameAppInputRouter = require('./CanvasGameAppInputRouter');
const WorldMarchGeometry = require('../domain/WorldMarchGeometry');

test('CanvasGameAppWorldMapRuntime installs world map methods on app prototype', () => {
  class App {}
  assert.equal(CanvasGameAppWorldMapRuntime.install(App), true);

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

test('CanvasGameAppWorldMapRuntime tracks snapshot drag water time and cooldown', () => {
  class App {}
  CanvasGameAppWorldMapRuntime.install(App);

  let now = 1000;
  const calls = [];
  const app = new App();
  app.now = () => now;
  app.getWorldMapDragCooldownMs = () => 220;
  app.worldMapRuntime = { waterTimeMs: 123 };
  app.worldMapDragWaterTimeMs = null;
  app.worldMapDragCooldownUntil = 0;
  app.worldMapPinchDragging = true;
  app.updateWorldActorAnimationLoop = (options) => calls.push(['updateWorldActorAnimationLoop', options.force]);

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
  assert.deepEqual(calls, [
    ['updateWorldActorAnimationLoop', true],
  ]);
});

test('CanvasGameAppWorldMapRuntime delegates render decisions to coordinator', () => {
  class App {}
  CanvasGameAppWorldMapRuntime.install(App);

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

test('CanvasGameAppWorldMapRuntime forces render for stale baked backing store', () => {
  class App {}
  CanvasGameAppWorldMapRuntime.install(App);

  const app = new App();
  app.state = { id: 'state-stale' };
  app.runtime = {
    getLayerBackingStoreState() {
      return { epoch: 2, width: 300, height: 200, pixelRatio: 1 };
    },
  };
  app.renderer = {};
  app.worldMapRuntimeCoordinator = null;

  const coordinator = app.ensureWorldMapRuntimeCoordinator();
  const runtime = coordinator.ensureRuntime();
  runtime.hasBakedMapLayer = true;
  runtime.mapBakeDirty = false;
  runtime.bakedLayerState = { epoch: 1, width: 300, height: 200, pixelRatio: 1 };
  coordinator.canRender = () => true;

  assert.equal(runtime.isBakedLayerStateValid(), false);
  assert.equal(app.shouldRenderRuntimeWorldMap(app.state, {}), true);
});

test('CanvasGameAppWorldMapRuntime refreshes snapshot layer and commits camera', () => {
  class App {}
  CanvasGameAppWorldMapRuntime.install(App);

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

test('CanvasGameAppWorldMapRuntime keeps actor anchor on the dragged map snapshot frame', () => {
  class App {}
  CanvasGameAppWorldMapRuntime.install(App);

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

test('CanvasGameAppWorldMapRuntime does not skip map layer when snapshot render misses', () => {
  class App {}
  CanvasGameAppWorldMapRuntime.install(App);

  const calls = [];
  const runtime = {
    baseHitTargets: [{ action: { type: 'enterCity' } }],
    hasBakedMapLayer: false,
    hitTargets: [{ action: { type: 'enterCity' } }],
    lastHitTargetSync: {
      baseHitTargetCount: 1,
      hitTargetCount: 1,
      mapTargetCount: 0,
      preserved: true,
      sourceHitTargetCount: 0,
    },
    mapBakeDirty: true,
    getCameraUiState: () => ({ worldPanX: 0, worldPanY: 0 }),
    syncHitTargetsFromRenderer(options) {
      calls.push(['syncHitTargetsFromRenderer', options]);
    },
  };
  const app = new App();
  app.state = { id: 'state-miss' };
  app.getWorldEpochNowMs = () => 1000;
  app.now = () => 2000;
  app.worldMapRuntimeCoordinator = {
    canRender() {
      return true;
    },
    getMapRuntime() {
      return runtime;
    },
  };
  app.renderer = {
    lastWorldMapLayerRenderResult: {
      rendered: true,
      drewFrame: false,
      reason: 'snapshotMiss',
    },
    renderWorldMapSnapshotLayer() {
      calls.push(['renderSnapshot']);
      return true;
    },
    renderWorldMapActorLayer() {
      calls.push(['renderActor']);
      return true;
    },
    render(state, options) {
      calls.push(['render', options.skipWorldMapLayer, options.preserveCanvas, options.worldMapFrameState?.hitTargetsPreserved]);
    },
  };

  assert.equal(app.renderWorldMapSnapshotDragFrame(), true);
  assert.deepEqual(calls, [
    ['renderSnapshot'],
    ['renderActor'],
    ['syncHitTargetsFromRenderer', { preserveOnEmpty: true }],
    ['render', false, false, true],
  ]);
});

test('CanvasGameAppWorldMapRuntime commits baked state only after a snapshot frame draws', () => {
  class App {}
  CanvasGameAppWorldMapRuntime.install(App);

  const calls = [];
  const runtime = {
    camera: { x: 2, y: 3 },
    getCameraUiState: () => ({ worldPanX: 2, worldPanY: 3 }),
    markBakedCamera() {
      calls.push(['markBakedCamera']);
    },
    markBakedLayerCommitted() {
      calls.push(['markBakedLayerCommitted']);
    },
    syncHitTargetsFromRenderer() {
      calls.push(['syncHitTargetsFromRenderer']);
    },
  };
  const app = new App();
  app.state = { id: 'state-commit' };
  app.worldMapRuntimeCoordinator = {
    getMapRuntime: () => runtime,
  };
  app.renderer = {
    getTopBarBottom: () => 91,
    lastWorldMapLayerRenderResult: {
      rendered: true,
      drewFrame: false,
      reason: 'snapshotMiss',
    },
    renderWorldMapSnapshotLayer() {
      calls.push(['renderSnapshot']);
      return true;
    },
    renderWorldMapActorLayer() {
      calls.push(['renderActor']);
      return true;
    },
  };

  assert.equal(app.refreshWorldMapLayerFromSnapshot(), true);
  assert.equal(runtime.hasBakedMapLayer, undefined);
  assert.equal(runtime.mapBakeDirty, undefined);
  assert.deepEqual(calls, [
    ['renderSnapshot'],
    ['renderActor'],
    ['syncHitTargetsFromRenderer'],
    ['markBakedCamera'],
  ]);

  calls.length = 0;
  app.renderer.lastWorldMapLayerRenderResult = {
    rendered: true,
    drewFrame: true,
    reason: 'snapshotDrawn',
  };
  assert.equal(app.refreshWorldMapLayerFromSnapshot(), true);
  assert.equal(runtime.hasBakedMapLayer, true);
  assert.equal(runtime.mapBakeDirty, false);
  assert.deepEqual(calls, [
    ['renderSnapshot'],
    ['renderActor'],
    ['syncHitTargetsFromRenderer'],
    ['markBakedLayerCommitted'],
    ['markBakedCamera'],
  ]);
});

test('CanvasGameAppWorldMapRuntime observes async action failures without changing the rejection', async () => {
  class App {}
  CanvasGameAppWorldMapRuntime.install(App);
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
      return Promise.reject(new Error('world map runtime action failed'));
    },
  };
  app.advanceTutorialIntro = () => {};
  app.log = (error) => errors.push(error?.message || String(error || ''));
  app.now = () => 1;

  const coordinator = app.ensureWorldMapRuntimeCoordinator();
  const handled = coordinator.onAction({ type: 'selectWorldMarchTarget' }, null, {});

  await assert.rejects(
    () => handled,
    /world map runtime action failed/,
  );
  assert.deepEqual(errors, ['world map runtime action failed']);
});
