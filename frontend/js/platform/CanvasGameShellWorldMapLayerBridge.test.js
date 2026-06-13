const test = require('node:test');
const assert = require('node:assert/strict');

const LayerBridge = require('./CanvasGameShellWorldMapLayerBridge');
const WorldMarchGeometry = require('../domain/WorldMarchGeometry');

function createShell(overrides = {}) {
  class Shell {}
  LayerBridge.install(Shell);
  return Object.assign(new Shell(), {
    buildRenderOptions() {
      return { built: true };
    },
    config: {},
    getCanvasLayerMetrics() {
      return { width: 300, height: 200, viewportWidth: 280, viewportHeight: 180, padding: 10 };
    },
    isFogOfWarEnabled() {
      return false;
    },
    lastGame: {
      state: { id: 'state-1' },
    },
    previewEnabled: true,
    renderer: {
      getTopBarBottom() {
        return 91;
      },
    },
    runtime: {
      pixelRatio: 2,
    },
    territoryUiState: {},
    worldMapDragWaterTimeMs: 123,
    worldMapRenderer: {
      height: 1,
      renderWorldMapSnapshotLayer() {
        return true;
      },
      width: 1,
    },
  }, overrides);
}

test('CanvasGameShellWorldMapLayerBridge syncs map and fog metrics', () => {
  const calls = [];
  const shell = createShell({
    isFogOfWarEnabled() {
      return true;
    },
    worldFogRenderer: {
      setMetrics(metrics) {
        calls.push(metrics);
      },
    },
    worldActorLayerRenderer: {},
    worldMapRuntime: {
      invalidateBake() {
        calls.push('invalidateBake');
      },
    },
  });

  assert.equal(shell.syncWorldMapRendererLayerMetrics(), true);
  assert.equal(shell.worldMapRenderer.width, 300);
  assert.equal(shell.worldMapRenderer.viewportOffsetX, 10);
  assert.equal(shell.worldActorLayerRenderer.width, 300);
  assert.equal(shell.worldActorLayerRenderer.viewportOffsetX, 10);
  assert.equal(calls[0].pixelRatio, 2);
  assert.equal(calls.includes('invalidateBake'), true);
});

test('CanvasGameShellWorldMapLayerBridge clears disabled fog and skips plugins', () => {
  const calls = [];
  const shell = createShell({
    worldFogRenderer: {
      clear() {
        calls.push('clear');
      },
      renderWorldFog() {
        calls.push('renderWorldFog');
        return true;
      },
    },
  });

  assert.equal(shell.renderWorldFogLayer(), false);
  assert.deepEqual(calls, ['clear']);
});

test('CanvasGameShellWorldMapLayerBridge treats map, fog, and actor as one camera layer group', () => {
  const calls = [];
  const shell = createShell({
    clearCanvasLayerTransform(name) {
      calls.push(['clearTransform', name]);
      return true;
    },
    setCanvasLayerVisible(name, visible) {
      calls.push(['visible', name, visible]);
      return true;
    },
    worldActorLayerRenderer: {
      clearAll() {
        calls.push(['clearActor']);
      },
    },
    worldFogRenderer: {
      clear() {
        calls.push(['clearFog']);
      },
    },
  });

  assert.equal(shell.clearWorldMapLayerTransform(), true);
  assert.equal(shell.setWorldMapLayerVisible(false), true);
  assert.deepEqual(calls, [
    ['clearTransform', 'worldMap'],
    ['clearTransform', 'worldFog'],
    ['clearTransform', 'worldActor'],
    ['visible', 'worldMap', false],
    ['visible', 'worldFog', false],
    ['visible', 'worldActor', false],
    ['clearFog'],
    ['clearActor'],
  ]);
});

test('CanvasGameShellWorldMapLayerBridge refreshes snapshot layer and commits camera', () => {
  const calls = [];
  const runtime = {
    camera: { x: 1, y: 2 },
    getCameraUiState() {
      return { worldPanX: 1, worldPanY: 2 };
    },
    markBakedCamera(camera) {
      calls.push(['markBakedCamera', camera]);
    },
    syncHitTargetsFromRenderer(options) {
      calls.push(['syncHitTargetsFromRenderer', options]);
    },
  };
  const shell = createShell({
    clearWorldMapLayerTransform() {
      calls.push(['clearTransform']);
      return true;
    },
    renderWorldFogLayer() {
      calls.push(['renderFog']);
      return true;
    },
    renderWorldActorLayer(options) {
      calls.push(['renderActor', options.state.id, options.territoryUiState.worldPanX]);
      if (this.worldMapRuntimeCoordinator?.getMapRuntime) {
        this.worldMapRuntimeCoordinator.getMapRuntime().syncHitTargetsFromRenderer?.({
          preserveOnEmpty: options.preserveRuntimeHitTargetsOnEmpty === true,
        });
      }
      return true;
    },
    syncWorldMapRendererLayerMetrics() {
      calls.push(['syncMetrics']);
      return true;
    },
    worldMapRuntimeCoordinator: {
      getMapRuntime() {
        return runtime;
      },
    },
    worldMapRenderer: {
      renderWorldMapSnapshotLayer(state, options) {
        calls.push(['renderSnapshot', state.id, options.topBarBottom, options.waterTimeMs]);
        return true;
      },
    },
  });

  assert.equal(shell.refreshWorldMapLayerFromSnapshot(), true);
  assert.deepEqual(calls, [
    ['syncMetrics'],
    ['renderSnapshot', 'state-1', 91, 123],
    ['renderFog'],
    ['renderActor', 'state-1', 1],
    ['syncHitTargetsFromRenderer', { preserveOnEmpty: true }],
    ['markBakedCamera', runtime.camera],
    ['clearTransform'],
  ]);
});

test('CanvasGameShellWorldMapLayerBridge preserves runtime targets on empty actor refresh', () => {
  const calls = [];
  const runtime = {
    getCameraUiState() {
      return { worldPanX: 3, worldPanY: 4 };
    },
    syncHitTargetsFromRenderer(options) {
      calls.push(['syncHitTargetsFromRenderer', options]);
    },
  };
  const shell = createShell({
    buildRenderOptions() {
      return { built: true };
    },
    syncWorldMapRendererLayerMetrics() {
      calls.push(['syncMetrics']);
      return true;
    },
    worldMapRuntimeCoordinator: {
      getMapRuntime() {
        return runtime;
      },
    },
    worldMapRenderer: {
      lastWorldTileMapContext: { frame: {} },
      renderWorldMapActorLayer(state, options) {
        calls.push(['renderActor', state.id, options.territoryUiState.worldPanX]);
        return true;
      },
    },
  });

  assert.equal(shell.renderWorldActorLayer({ preserveRuntimeHitTargetsOnEmpty: true }), true);
  assert.deepEqual(calls, [
    ['syncMetrics'],
    ['renderActor', 'state-1', 3],
    ['syncHitTargetsFromRenderer', { preserveOnEmpty: true }],
  ]);
});

test('CanvasGameShellWorldMapLayerBridge keeps actor anchor on the dragged map snapshot frame', () => {
  const calls = [];
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
  const runtime = {
    camera: { x: 48, y: -24 },
    lastTileMapContext: oldContext,
    getCameraUiState() {
      return { worldPanX: 48, worldPanY: -24 };
    },
    getLastTileMapContext() {
      return this.lastTileMapContext;
    },
    markBakedCamera() {},
  };
  const shell = createShell({
    clearWorldMapLayerTransform() {
      return true;
    },
    renderWorldFogLayer() {
      return true;
    },
    syncWorldMapRendererLayerMetrics() {
      return true;
    },
    worldMapRuntimeCoordinator: {
      getMapRuntime() {
        return runtime;
      },
    },
    worldMapRenderer: {
      lastWorldTileMapContext: oldContext,
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
    },
  });

  assert.equal(shell.refreshWorldMapLayerFromSnapshot(), true);

  const expectedAnchor = WorldMarchGeometry.getTileScreenCenter(
    { q: 0, r: 0 },
    snapshotContext.viewport,
    snapshotContext.geometry,
  );
  assert.deepEqual(calls, [
    ['actorContextPan', 48, -24],
    ['anchor', expectedAnchor],
  ]);
});
