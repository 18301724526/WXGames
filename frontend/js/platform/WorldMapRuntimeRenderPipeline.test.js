const test = require('node:test');
const assert = require('node:assert/strict');

const RenderPipeline = require('./WorldMapRuntimeRenderPipeline');
const WorldMarchGeometry = require('../ecs/foundation/WorldMarchGeometry');

function createState() {
  return {
    territoryState: {
      worldMap: {
        tiles: [{ id: 'tile_0_0' }],
      },
    },
    worldExplorerState: {
      activeMission: {
        id: 'mission-1',
        status: 'active',
        revealedTileIds: [],
      },
    },
  };
}

function createHost(overrides = {}) {
  const state = createState();
  const frameState = {
    hasBakedMapLayer: Boolean(overrides.hasBakedMapLayer),
    lastLayout: overrides.lastLayout || null,
    lastMapDataSignature: overrides.lastMapDataSignature || '',
    lastRenderAt: Number(overrides.lastRenderAt) || 0,
    lastTileMapContext: overrides.lastTileMapContext || null,
    mapBakeDirty: overrides.mapBakeDirty !== false,
  };
  const host = {
    camera: { x: 1, y: 2 },
    enabled: true,
    frameState,
    frameMs: 16,
    worldMapInputState: {
      hitTargets: Array.isArray(overrides.hitTargets) ? overrides.hitTargets : [],
      baseHitTargets: Array.isArray(overrides.baseHitTargets) ? overrides.baseHitTargets : [],
      lastHitTargetSync: overrides.lastHitTargetSync || null,
      hitTargetSyncSequence: Number(overrides.hitTargetSyncSequence) || 0,
    },
    commitFrameState(patch = {}) {
      Object.assign(this.frameState, patch || {});
      return this.frameState;
    },
    commitBakedFrame(context = null, options = {}) {
      this.commitFrameState({
        hasBakedMapLayer: true,
        lastLayout: Object.prototype.hasOwnProperty.call(options, 'lastLayout')
          ? options.lastLayout
          : this.frameState.lastLayout,
        lastTileMapContext: context || null,
        mapBakeDirty: false,
      });
      return this.frameState;
    },
    resetHitTargetState() {
      this.worldMapInputState.hitTargets = [];
      this.worldMapInputState.baseHitTargets = [];
      this.worldMapInputState.lastHitTargetSync = null;
      this.worldMapInputState.hitTargetSyncSequence = 0;
      return true;
    },
    getHitTargets() {
      return this.worldMapInputState.hitTargets;
    },
    setHitTargets(targets = []) {
      this.worldMapInputState.hitTargets = Array.isArray(targets) ? targets : [];
      return this.worldMapInputState.hitTargets;
    },
    getBaseHitTargets() {
      return this.worldMapInputState.baseHitTargets;
    },
    setBaseHitTargets(targets = []) {
      this.worldMapInputState.baseHitTargets = Array.isArray(targets) ? targets : [];
      return this.worldMapInputState.baseHitTargets;
    },
    getLastHitTargetSync() {
      return this.worldMapInputState.lastHitTargetSync || null;
    },
    commitHitTargetSync(sync = {}) {
      this.worldMapInputState.lastHitTargetSync = sync || null;
      return this.worldMapInputState.lastHitTargetSync;
    },
    getCameraUiState() {
      return { worldPanX: 1, worldPanY: 2 };
    },
    getLastTileMapContext() {
      return this.frameState.lastTileMapContext || { tileMapView: {} };
    },
    getLayerLayout() {
      return { map: { x: 0, y: 0, width: 100, height: 100 } };
    },
    getState() {
      return state;
    },
    getTopBarBottom() {
      return 84;
    },
    isDragging() {
      return false;
    },
    isMapBakeDirty() {
      return true;
    },
    get hasBakedMapLayer() { return this.frameState.hasBakedMapLayer; },
    set hasBakedMapLayer(value) { this.frameState.hasBakedMapLayer = Boolean(value); },
    get lastLayout() { return this.frameState.lastLayout; },
    set lastLayout(value) { this.frameState.lastLayout = value || null; },
    get lastMapDataSignature() { return this.frameState.lastMapDataSignature; },
    set lastMapDataSignature(value) { this.frameState.lastMapDataSignature = value || ''; },
    get lastRenderAt() { return this.frameState.lastRenderAt; },
    set lastRenderAt(value) { this.frameState.lastRenderAt = Number(value) || 0; },
    get lastTileMapContext() { return this.frameState.lastTileMapContext; },
    set lastTileMapContext(value) { this.frameState.lastTileMapContext = value || null; },
    get mapBakeDirty() { return this.frameState.mapBakeDirty; },
    set mapBakeDirty(value) { this.frameState.mapBakeDirty = Boolean(value); },
    markBakedLayerCommitted() {
      this.bakedLayerCommitted = true;
      return { epoch: 1, width: 100, height: 100, pixelRatio: 1 };
    },
    markBakedCamera(camera) {
      this.bakedCamera = { ...camera };
      return this.bakedCamera;
    },
    now() {
      return 1000;
    },
    presenter: {},
    renderer: {
      hitTargets: [{ x: 1, y: 2, action: { type: 'worldMapDrag' } }],
      renderWorldMapLayer() {
        return true;
      },
    },
    syncHitTargetsFromRenderer() {
      const targets = [
        ...(Array.isArray(this.renderer.hitTargets) ? this.renderer.hitTargets : []),
        ...(Array.isArray(this.renderer.worldActorLayerRenderer?.hitTargets) ? this.renderer.worldActorLayerRenderer.hitTargets : []),
      ];
      this.setBaseHitTargets(targets);
      this.setHitTargets(targets);
      return this.getHitTargets();
    },
    syncMapDataSignature(stateArg, optionsArg) {
      this.syncedSignature = { stateArg, optionsArg };
      return true;
    },
    syncWaterAnimationFlag(uiState) {
      this.syncedWaterUiState = uiState;
      return true;
    },
    waterTimeMs: 55,
    canRender() {
      return true;
    },
  };
  const {
    baseHitTargets,
    hitTargets,
    hitTargetSyncSequence,
    lastHitTargetSync,
    ...hostOverrides
  } = overrides;
  return Object.assign(host, hostOverrides);
}

test('WorldMapRuntimeRenderPipeline resets runtime render state when render is unavailable', () => {
  const clearCalls = [];
  const host = createHost({
    baseHitTargets: [{ action: {} }],
    canRender() {
      return false;
    },
    hasBakedMapLayer: true,
    hitTargets: [{ action: {} }],
    lastMapDataSignature: 'old',
    mapBakeDirty: false,
    renderer: {
      clearAll() {
        clearCalls.push('clear');
      },
    },
  });

  assert.equal(RenderPipeline.render(host), false);
  assert.deepEqual(clearCalls, ['clear']);
  assert.deepEqual(host.getHitTargets(), []);
  assert.deepEqual(host.getBaseHitTargets(), []);
  assert.equal(host.hasBakedMapLayer, false);
  assert.equal(host.mapBakeDirty, true);
  assert.equal(host.lastMapDataSignature, '');
});

test('WorldMapRuntimeRenderPipeline does not publish renderer state mirrors', () => {
  const state = { id: 'authoritative-state' };
  const retiredStateMirrorKeys = ['last' + 'GameState', 'last' + 'WorldMarchState'];
  const renderer = {
    worldMapRenderer: {},
    worldMapLayerRenderer: {},
    renderWorldMapLayer() {
      return true;
    },
  };
  const host = createHost({
    renderer,
    getState() {
      return state;
    },
  });

  assert.equal(RenderPipeline.render(host, { epochNowMs: 4321 }), true);

  [host, renderer, renderer.worldMapRenderer, renderer.worldMapLayerRenderer].forEach((target) => {
    retiredStateMirrorKeys.forEach((key) => {
      assert.equal(Object.prototype.hasOwnProperty.call(target, key), false);
    });
  });
});

test('WorldMapRuntimeRenderPipeline renders a snapshot frame when baked layer is reusable', () => {
  const snapshotOptions = [];
  const actorOptions = [];
  const host = createHost({
    hasBakedMapLayer: true,
    mapBakeDirty: false,
    isMapBakeDirty() {
      return false;
    },
    renderer: {
      renderWorldMapLayer() {
        throw new Error('full render should not run');
      },
      renderWorldMapSnapshotLayer(state, options) {
        snapshotOptions.push(options);
        return true;
      },
      renderWorldMapActorLayer(state, options) {
        actorOptions.push(options);
        return true;
      },
    },
  });

  assert.equal(RenderPipeline.render(host, { snapshotOnly: true, epochNowMs: 1234 }), true);
  assert.equal(snapshotOptions[0].snapshotOnly, true);
  assert.equal(snapshotOptions[0].reuseCachedWorldTileView, true);
  assert.equal(snapshotOptions[0].waterTimeMs, 55);
  assert.equal(actorOptions[0].worldMapRuntimeContext.tileMapView instanceof Object, true);
  assert.equal(actorOptions[0].territoryUiState.worldPanX, 1);
  assert.deepEqual(host.lastLayout, { map: { x: 0, y: 0, width: 100, height: 100 } });
});

test('WorldMapRuntimeRenderPipeline preserves runtime hit targets during drag snapshot frames', () => {
  const stableTarget = { x: 20, y: 30, width: 80, height: 60, action: { type: 'openWorldSite', siteId: 'capital' } };
  const host = createHost({
    baseHitTargets: [stableTarget],
    dragLayerOffset: { x: 12, y: -8 },
    hasBakedMapLayer: true,
    hitTargets: [{ ...stableTarget, x: 32, y: 22 }],
    mapBakeDirty: false,
    getOffsetHitTargets() {
      return this.getBaseHitTargets().map((target) => ({
        ...target,
        x: target.x + this.dragLayerOffset.x,
        y: target.y + this.dragLayerOffset.y,
      }));
    },
    isDragging() {
      return true;
    },
    isMapBakeDirty() {
      return false;
    },
    renderer: {
      hitTargets: [],
      worldActorLayerRenderer: {
        hitTargets: [],
      },
      renderWorldMapLayer() {
        throw new Error('full render should not run during drag snapshot');
      },
      renderWorldMapSnapshotLayer() {
        this.hitTargets = [];
        return true;
      },
      renderWorldMapActorLayer() {
        this.worldActorLayerRenderer.hitTargets = [];
        return true;
      },
    },
    syncHitTargetsFromRenderer(options = {}) {
      const nextTargets = [
        ...(Array.isArray(this.renderer.hitTargets) ? this.renderer.hitTargets : []),
        ...(Array.isArray(this.renderer.worldActorLayerRenderer?.hitTargets) ? this.renderer.worldActorLayerRenderer.hitTargets : []),
      ];
      if (!nextTargets.length && options.preserveOnEmpty === true) {
        this.setHitTargets(this.getOffsetHitTargets());
        return this.getHitTargets();
      }
      this.setBaseHitTargets(nextTargets);
      this.setHitTargets(this.getOffsetHitTargets());
      return this.getHitTargets();
    },
  });

  assert.equal(RenderPipeline.render(host, { snapshotOnly: true, reuseCachedWorldTileView: true }), true);
  assert.deepEqual(host.getBaseHitTargets(), [stableTarget]);
  assert.deepEqual(host.getHitTargets(), [{ ...stableTarget, x: 32, y: 22 }]);
});

test('WorldMapRuntimeRenderPipeline keeps actor anchor on the snapshot frame context', () => {
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
  const actorAnchors = [];
  const host = createHost({
    hasBakedMapLayer: true,
    lastTileMapContext: oldContext,
    mapBakeDirty: false,
    getLastTileMapContext() {
      return this.lastTileMapContext;
    },
    isMapBakeDirty() {
      return false;
    },
    renderer: {
      lastWorldTileMapContext: oldContext,
      renderWorldMapLayer() {
        throw new Error('full render should not run');
      },
      renderWorldMapSnapshotLayer() {
        this.lastWorldTileMapContext = snapshotContext;
        return true;
      },
      renderWorldMapActorLayer(state, options) {
        const context = options.worldMapRuntimeContext;
        actorAnchors.push(WorldMarchGeometry.getTileScreenCenter(
          { q: 0, r: 0 },
          context.viewport,
          context.geometry,
        ));
        return true;
      },
    },
  });

  assert.equal(RenderPipeline.render(host, { snapshotOnly: true, epochNowMs: 1234 }), true);
  assert.equal(host.lastTileMapContext, snapshotContext);
  assert.deepEqual(actorAnchors, [
    WorldMarchGeometry.getTileScreenCenter({ q: 0, r: 0 }, snapshotContext.viewport, snapshotContext.geometry),
  ]);
});

test('WorldMapRuntimeRenderPipeline renders a full frame and commits bake state', () => {
  const fullOptions = [];
  const actorOptions = [];
  const host = createHost({
    renderer: {
      hitTargets: [{ x: 8, y: 9, action: { type: 'resetWorldPan' } }],
      worldActorLayerRenderer: {
        hitTargets: [{ x: 18, y: 19, action: { type: 'selectWorldActor', actorId: 'scout-1' } }],
      },
      renderWorldMapLayer(state, options) {
        fullOptions.push(options);
        return true;
      },
      renderWorldMapActorLayer(state, options) {
        actorOptions.push(options);
        return true;
      },
    },
  });

  assert.equal(RenderPipeline.render(host, { epochNowMs: 4321 }), true);
  assert.equal(fullOptions[0].collectHitTargets, true);
  assert.equal(fullOptions[0].snapshotOnly, false);
  assert.equal(host.syncedSignature.optionsArg.epochNowMs, 4321);
  assert.equal(host.hasBakedMapLayer, true);
  assert.equal(host.mapBakeDirty, false);
  assert.equal(host.bakedLayerCommitted, true);
  assert.deepEqual(host.bakedCamera, { x: 1, y: 2 });
  assert.equal(host.getHitTargets()[0].action.type, 'resetWorldPan');
  assert.equal(actorOptions[0].worldMapRuntimeContext.tileMapView instanceof Object, true);
  assert.equal(host.getHitTargets().some((target) => target.action.type === 'selectWorldActor'), true);
});

test('WorldMapRuntimeRenderPipeline does not commit bake state when full render only preserves the previous map layer', () => {
  const host = createHost({
    hasBakedMapLayer: true,
    mapBakeDirty: true,
    renderer: {
      hitTargets: [{ x: 8, y: 9, action: { type: 'resetWorldPan' } }],
      lastWorldMapLayerRenderResult: null,
      renderWorldMapLayer() {
        this.lastWorldMapLayerRenderResult = {
          rendered: true,
          drewFrame: false,
          preserved: true,
          reason: 'preservedOnEmptyTiles',
        };
        return true;
      },
      renderWorldMapActorLayer() {
        throw new Error('actor layer should not refresh when no map frame was drawn');
      },
    },
  });

  assert.equal(RenderPipeline.render(host, { epochNowMs: 4321 }), true);
  assert.equal(host.hasBakedMapLayer, true);
  assert.equal(host.mapBakeDirty, true);
  assert.equal(host.bakedLayerCommitted, undefined);
  assert.equal(host.bakedCamera, undefined);
  assert.deepEqual(host.getHitTargets(), []);
  assert.equal(host.syncedWaterUiState.worldPanX, 1);
});

test('WorldMapRuntimeRenderPipeline keeps actor anchor on the full frame context', () => {
  const oldContext = {
    frame: { x: 0, y: 0, width: 300, height: 200 },
    geometry: { stepX: 96, stepY: 48 },
    tileMapView: { pan: { x: 0, y: 0 } },
    viewport: { originX: 150, originY: 100, panX: 0, panY: 0, scale: 1 },
  };
  const fullContext = {
    frame: oldContext.frame,
    geometry: oldContext.geometry,
    tileMapView: { pan: { x: 36, y: -18 } },
    viewport: { ...oldContext.viewport, panX: 36, panY: -18 },
  };
  const actorAnchors = [];
  const host = createHost({
    lastTileMapContext: oldContext,
    getLastTileMapContext() {
      return this.lastTileMapContext;
    },
    renderer: {
      lastWorldTileMapContext: oldContext,
      renderWorldMapLayer() {
        this.lastWorldTileMapContext = fullContext;
        return true;
      },
      renderWorldMapActorLayer(state, options) {
        const context = options.worldMapRuntimeContext;
        actorAnchors.push(WorldMarchGeometry.getTileScreenCenter(
          { q: 0, r: 0 },
          context.viewport,
          context.geometry,
        ));
        return true;
      },
    },
  });

  assert.equal(RenderPipeline.render(host, { epochNowMs: 4321 }), true);
  assert.equal(host.lastTileMapContext, fullContext);
  assert.deepEqual(actorAnchors, [
    WorldMarchGeometry.getTileScreenCenter({ q: 0, r: 0 }, fullContext.viewport, fullContext.geometry),
  ]);
});
