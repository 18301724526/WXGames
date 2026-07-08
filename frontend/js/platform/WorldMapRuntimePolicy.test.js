const test = require('node:test');
const assert = require('node:assert/strict');

const Policy = require('./WorldMapRuntimePolicy');

test('WorldMapRuntimePolicy resolves timing and padding values', () => {
  assert.deepEqual(Policy.getSnapshotRenderOptions('123', 456), {
    force: true,
    reuseCachedWorldTileView: true,
    snapshotOnly: true,
    waterTimeMs: 123,
  });
  assert.deepEqual(Policy.getSnapshotRenderOptions('bad', 456), {
    force: true,
    reuseCachedWorldTileView: true,
    snapshotOnly: true,
    waterTimeMs: 456,
  });
  assert.equal(Policy.getWaterAnimationFrameMs({ animationFrameMs: 80, fps: 20 }), 80);
  assert.equal(Policy.getWaterAnimationFrameMs({ animationFrameMs: 16, fps: 10 }), 100);
  assert.equal(
    Policy.getWaterAnimationFrameMs({
      animationFrameMs: 16,
      fps: 8,
      navigator: { hardwareConcurrency: 4, deviceMemory: 4, maxTouchPoints: 5 },
    }),
    900,
  );
  assert.equal(
    Policy.getWaterAnimationFrameMs({
      animationFrameMs: 16,
      fps: 8,
      navigator: { hardwareConcurrency: 6, deviceMemory: 6, maxTouchPoints: 5 },
    }),
    450,
  );
  assert.equal(
    Policy.getWaterAnimationDeviceFloorMs({
      navigator: { hardwareConcurrency: 12, deviceMemory: 16, maxTouchPoints: 0 },
    }),
    0,
  );
  assert.equal(Policy.getLayerPadding({ dragCachePanRange: 260 }), 260);
  assert.equal(Policy.getLayerPadding({ dragCachePanRange: 120 }), 200);
});

test('WorldMapRuntimePolicy resolves drag state and offsets', () => {
  assert.equal(Policy.isDragging(0), true);
  assert.equal(Policy.isDragging(null), false);
  assert.equal(Policy.isDragCoolingDown(1200, 1000), true);
  assert.equal(Policy.isDragCoolingDown(900, 1000), false);
  assert.equal(Policy.getDragTransformLimit(300), 216);
  assert.equal(Policy.isDragTransformNearLimit({ x: 216, y: 0 }, { layerPadding: 300 }), true);
  assert.deepEqual(
    Policy.getDragOffset({
      dragLayerOffset: { x: '8', y: 'bad' },
    }),
    { x: 8, y: 0 },
  );
  assert.deepEqual(
    Policy.getDragOffset({
      getCameraOffsetFromBaked() {
        return { x: 4, y: -2 };
      },
    }),
    { x: 4, y: -2 },
  );
  assert.deepEqual(Policy.getWorldMapPan({ worldPanX: '7', worldPanY: 'bad' }), { x: 7, y: 0 });
});

test('WorldMapRuntimePolicy resolves frame options', () => {
  assert.equal(
    Policy.isSnapshotWaterRefresh({
      snapshotOnly: true,
      reuseCachedWorldTileView: true,
      waterTimeMs: 12,
    }),
    true,
  );
  assert.deepEqual(
    Policy.resolveRuntimeFrameOptions(
      {
        snapshotOnly: false,
      },
      {
        runtimeDragging: true,
        dragFrameActive: false,
        shellDragging: false,
        frozenWaterTimeMs: 55,
      },
    ),
    {
      reuseCachedWorldTileView: true,
      snapshotOnly: true,
      waterTimeMs: 55,
    },
  );
  assert.deepEqual(
    Policy.resolveRuntimeFrameOptions(
      {
        reuseCachedWorldTileView: true,
        waterTimeMs: '99',
      },
      {
        runtimeDragging: false,
        dragFrameActive: false,
        shellDragging: false,
        frozenWaterTimeMs: 55,
      },
    ),
    {
      reuseCachedWorldTileView: true,
      snapshotOnly: false,
      waterTimeMs: 99,
    },
  );
});
