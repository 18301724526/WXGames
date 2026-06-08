const test = require('node:test');
const assert = require('node:assert/strict');

const WorldMapRuntimeCameraPolicy = require('./WorldMapRuntimeCameraPolicy');

test('WorldMapRuntimeCameraPolicy creates camera and camera ui state', () => {
  assert.deepEqual(WorldMapRuntimeCameraPolicy.createInitialCamera({
    camera: { x: 5, y: 0 },
    initialPanX: 11,
    initialPanY: -7,
  }), { x: 5, y: -7 });

  assert.deepEqual(WorldMapRuntimeCameraPolicy.createCameraUiState({
    selectedSiteId: 'capital',
    worldPanX: 1,
  }, { x: 20, y: -3 }), {
    selectedSiteId: 'capital',
    worldPanX: 20,
    worldPanY: -3,
  });
});

test('WorldMapRuntimeCameraPolicy syncs and resolves camera changes', () => {
  assert.deepEqual(WorldMapRuntimeCameraPolicy.syncCameraFromUi({ x: 4, y: -2 }, {
    worldPanX: '8.5',
    worldPanY: 'bad',
  }), { x: 8.5, y: -2 });

  assert.deepEqual(WorldMapRuntimeCameraPolicy.resolveCameraChange({ x: 3, y: 4 }, '3', 'bad'), {
    camera: { x: 3, y: 4 },
    changed: false,
  });
  assert.deepEqual(WorldMapRuntimeCameraPolicy.resolveCameraChange({ x: 3, y: 4 }, 6, 9), {
    camera: { x: 6, y: 9 },
    changed: true,
  });
});

test('WorldMapRuntimeCameraPolicy derives drag camera and baked offset', () => {
  const drag = WorldMapRuntimeCameraPolicy.createDragState({
    pointerId: 7,
    x: 40,
    y: 50,
  }, { x: 12, y: -8 });

  assert.deepEqual(drag, {
    pointerId: 7,
    startX: 40,
    startY: 50,
    cameraX: 12,
    cameraY: -8,
  });
  assert.deepEqual(WorldMapRuntimeCameraPolicy.resolveDragCamera(drag, {
    pointerId: 7,
    x: 55,
    y: 20,
  }), {
    changed: true,
    camera: { x: 27, y: -38 },
  });
  assert.deepEqual(WorldMapRuntimeCameraPolicy.resolveDragCamera(drag, {
    pointerId: 8,
    x: 55,
    y: 20,
  }), {
    changed: false,
    camera: null,
  });
  assert.equal(WorldMapRuntimeCameraPolicy.canEndDrag(drag, { pointerId: 7 }), true);
  assert.equal(WorldMapRuntimeCameraPolicy.canEndDrag(drag, { pointerId: 8 }), false);
  assert.deepEqual(WorldMapRuntimeCameraPolicy.getCameraOffsetFromBaked({ x: 30, y: 10 }, { x: 12, y: -8 }), {
    x: 18,
    y: 18,
  });
});

test('WorldMapRuntimeCameraPolicy applies drag layer offsets to hit targets', () => {
  const offset = WorldMapRuntimeCameraPolicy.normalizeDragLayerOffset('4', 'bad');
  assert.deepEqual(offset, { x: 4, y: 0 });
  assert.deepEqual(WorldMapRuntimeCameraPolicy.applyOffsetToHitTargets([
    { x: 10, y: 20, action: { type: 'a' } },
    { y: 3, action: { type: 'b' } },
  ], offset), [
    { x: 14, y: 20, action: { type: 'a' } },
    { y: 3, action: { type: 'b' }, x: 4 },
  ]);
});
