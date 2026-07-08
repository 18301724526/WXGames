const test = require('node:test');
const assert = require('node:assert/strict');

const DebugOverlaySnapshot = require('./DebugOverlaySnapshot');

test('DebugOverlaySnapshot builds compact rows for fps, bake, visibility, and input trace', () => {
  const snapshot = DebugOverlaySnapshot.createSnapshot({
    renderer: { currentFps: 60, fpsSamples: [60, 58, 59] },
    worldMapRuntime: {
      hasBakedMapLayer: true,
      mapBakeDirty: false,
      lastMapDataSignature: 'abc',
      getHitTargets() {
        return [{}, {}];
      },
      camera: { x: 12, y: -4 },
      bakedCamera: { x: 10, y: -4 },
    },
    visibilitySnapshot: {
      counts: { unknown: 3, explored: 2, visible: 1, controlled: 1 },
      signature: 'visibility-signature',
    },
    lastInputAction: { type: 'selectWorldMarchTarget', targetQ: 2, targetR: 1, background: true },
    lastInputPoint: { x: 120, y: 240 },
  });

  assert.equal(snapshot.schema, 'debug-overlay-snapshot-v1');
  assert.deepEqual(snapshot.keys, ['fps', 'worldMapBake', 'visibility', 'inputTrace']);
  assert.equal(DebugOverlaySnapshot.getRow(snapshot, 'fps').value, '60');
  assert.equal(DebugOverlaySnapshot.getRow(snapshot, 'worldMapBake').value, 'clean');
  assert.equal(DebugOverlaySnapshot.getRow(snapshot, 'visibility').value, 'U3 E2 V1 C1');
  assert.equal(DebugOverlaySnapshot.getRow(snapshot, 'inputTrace').details.targetQ, 2);
  assert.equal(Object.prototype.hasOwnProperty.call(snapshot, 'renderer'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(snapshot, 'worldMapRuntime'), false);
});

test('DebugOverlaySnapshot reads runtime hit targets through the official API only', () => {
  const snapshot = DebugOverlaySnapshot.createSnapshot(
    {
      worldMapRuntime: {
        hasBakedMapLayer: true,
        worldMapInputState: {
          hitTargets: [{}, {}, {}],
        },
      },
    },
    {
      overlayKeys: ['worldMapBake'],
    },
  );

  assert.equal(DebugOverlaySnapshot.getRow(snapshot, 'worldMapBake').details.hitTargetCount, 0);
});

test('DebugOverlaySnapshot filters overlay keys and keeps stable signatures', () => {
  const input = {
    fps: 24,
    worldMapRuntime: {
      hasBakedMapLayer: false,
      mapBakeDirty: true,
      getHitTargets() {
        return [];
      },
    },
  };
  const first = DebugOverlaySnapshot.createSnapshot(input, {
    overlayKeys: ['fps', 'worldMapBake', 'fps'],
  });
  const second = DebugOverlaySnapshot.createSnapshot(input, {
    overlayKeys: ['fps', 'worldMapBake'],
  });

  assert.deepEqual(first.keys, ['fps', 'worldMapBake']);
  assert.equal(DebugOverlaySnapshot.getRow(first, 'fps').status, DebugOverlaySnapshot.STATUS_BAD);
  assert.equal(DebugOverlaySnapshot.getRow(first, 'worldMapBake').value, 'unbaked');
  assert.equal(first.signature, second.signature);
});

test('DebugOverlaySnapshot serializes without runtime or renderer objects', () => {
  const snapshot = DebugOverlaySnapshot.createSnapshot(
    {
      renderer: { currentFps: 0 },
      action: { type: 'openWorldSite' },
    },
    {
      overlayKeys: ['fps', 'inputTrace'],
    },
  );
  const serializable = DebugOverlaySnapshot.toSerializable(snapshot);

  assert.deepEqual(serializable.keys, ['fps', 'inputTrace']);
  assert.equal(serializable.counts.total, 2);
  assert.equal(Object.prototype.hasOwnProperty.call(serializable, 'renderer'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(serializable, 'action'), false);
});
