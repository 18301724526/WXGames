const test = require('node:test');
const assert = require('node:assert/strict');

const Policy = require('./WorldMapRuntimeRenderPolicy');

function createState(status = 'active') {
  return {
    territoryState: {
      worldMap: {
        tiles: [{ id: 'tile_0_0' }],
      },
    },
    worldExplorerState: {
      activeMission: {
        id: 'mission-1',
        status,
        revealedTileIds: ['tile_0_0', 'tile_1_0'],
      },
    },
  };
}

test('WorldMapRuntimeRenderPolicy resolves snapshot render context', () => {
  const context = Policy.createRenderContext({
    snapshotOnly: true,
    epochNowMs: 12345,
  }, {
    dragging: false,
    hasBakedMapLayer: true,
    epochNowMs: 999,
  });

  assert.equal(context.snapshotOnly, true);
  assert.equal(context.renderOptions.epochNowMs, 12345);
  assert.equal(context.shouldCheckBakeDirty, true);
  assert.equal(Policy.canUseSnapshotLayer(context, {
    hasBakedMapLayer: true,
    mapBakeDirty: false,
    canRenderSnapshotLayer: true,
  }), true);
  assert.equal(Policy.canUseSnapshotLayer(context, {
    hasBakedMapLayer: true,
    mapBakeDirty: true,
    canRenderSnapshotLayer: true,
  }), false);
});

test('WorldMapRuntimeRenderPolicy resolves epoch from world clock when option is absent', () => {
  const context = Policy.createRenderContext({
    worldClock: {
      getEpochNowMs() {
        return 24680;
      },
    },
  }, {
    dragging: false,
  });

  assert.equal(context.renderOptions.epochNowMs, 24680);
});

test('WorldMapRuntimeRenderPolicy preserves runtime throttling rules', () => {
  assert.equal(Policy.shouldThrottleRender({}, {
    nowMs: 110,
    lastRenderAt: 100,
    frameMs: 16,
  }), true);
  assert.equal(Policy.shouldThrottleRender({ force: true }, {
    nowMs: 110,
    lastRenderAt: 100,
    frameMs: 16,
  }), false);
  assert.equal(Policy.shouldThrottleRender({}, {
    nowMs: 116,
    lastRenderAt: 100,
    frameMs: 16,
  }), false);
});

test('WorldMapRuntimeRenderPolicy builds snapshot and full renderer options', () => {
  assert.deepEqual(Policy.createSnapshotRenderOptions({
    waterTimeMs: 44,
    custom: true,
  }, {
    epochNowMs: 1000,
    uiState: { worldPanX: 1 },
    topBarBottom: 84,
    waterTimeMs: 22,
  }), {
    custom: true,
    epochNowMs: 1000,
    activeTab: 'military',
    isMapHome: true,
    territoryUiState: { worldPanX: 1 },
    topBarBottom: 84,
    reuseCachedWorldTileView: true,
    snapshotOnly: true,
    waterTimeMs: 44,
    showFpsOverlay: false,
  });

  assert.deepEqual(Policy.createFullRenderOptions({
    reuseCachedWorldTileView: false,
  }, {
    epochNowMs: 2000,
    uiState: { worldPanY: 2 },
    topBarBottom: 72,
    dragging: true,
    snapshotOnly: true,
    waterTimeMs: 33,
  }), {
    reuseCachedWorldTileView: true,
    epochNowMs: 2000,
    activeTab: 'military',
    isMapHome: true,
    territoryUiState: { worldPanY: 2 },
    topBarBottom: 72,
    collectHitTargets: true,
    snapshotOnly: true,
    waterTimeMs: 33,
    showFpsOverlay: false,
  });
});

test('WorldMapRuntimeRenderPolicy builds trace payloads without renderer state', () => {
  const state = createState('ready');
  const beginTrace = Policy.createRenderBeginTrace(state, {
    snapshotOnly: true,
    renderOptions: { epochNowMs: 20000 },
  }, {
    canUseSnapshotLayer: true,
    hasBakedMapLayer: true,
    mapBakeDirty: false,
  });

  assert.deepEqual(beginTrace.keyParts, [
    true,
    true,
    true,
    false,
    'mission-1',
    'ready',
    2,
    2,
  ]);
  assert.equal(beginTrace.data.activeMission.status, 'ready');

  assert.deepEqual(Policy.createCannotRenderState(), {
    hitTargets: [],
    baseHitTargets: [],
    hasBakedMapLayer: false,
    mapBakeDirty: true,
    lastMapDataSignature: '',
  });
  assert.equal(Policy.createFullTrace(state, true, {
    hasBakedMapLayer: true,
    mapBakeDirty: false,
    hitTargetCount: 5,
  }, 20000).data.hitTargetCount, 5);
});
