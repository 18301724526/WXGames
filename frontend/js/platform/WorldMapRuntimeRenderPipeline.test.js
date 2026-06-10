const test = require('node:test');
const assert = require('node:assert/strict');

const RenderPipeline = require('./WorldMapRuntimeRenderPipeline');

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
  const host = {
    baseHitTargets: [],
    camera: { x: 1, y: 2 },
    enabled: true,
    frameMs: 16,
    getCameraUiState() {
      return { worldPanX: 1, worldPanY: 2 };
    },
    getLastTileMapContext() {
      return { tileMapView: {} };
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
    hasBakedMapLayer: false,
    hitTargets: [],
    isDragging() {
      return false;
    },
    isMapBakeDirty() {
      return true;
    },
    lastMapDataSignature: '',
    lastRenderAt: 0,
    mapBakeDirty: true,
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
      this.hitTargets = [
        ...(Array.isArray(this.renderer.hitTargets) ? this.renderer.hitTargets : []),
        ...(Array.isArray(this.renderer.worldActorLayerRenderer?.hitTargets) ? this.renderer.worldActorLayerRenderer.hitTargets : []),
      ];
      return this.hitTargets;
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
  return Object.assign(host, overrides);
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
  assert.deepEqual(host.hitTargets, []);
  assert.deepEqual(host.baseHitTargets, []);
  assert.equal(host.hasBakedMapLayer, false);
  assert.equal(host.mapBakeDirty, true);
  assert.equal(host.lastMapDataSignature, '');
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
  assert.deepEqual(host.bakedCamera, { x: 1, y: 2 });
  assert.equal(host.hitTargets[0].action.type, 'resetWorldPan');
  assert.equal(actorOptions[0].worldMapRuntimeContext.tileMapView instanceof Object, true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'selectWorldActor'), true);
});
