const test = require('node:test');
const assert = require('node:assert/strict');

const FeatureFlags = require('../config/FeatureFlags');
const DebugOverlayRegistry = require('./DebugOverlayRegistry');

test('DebugOverlayRegistry keeps debug overlays disabled by default', () => {
  assert.deepEqual(DebugOverlayRegistry.getEnabledOverlays(null, { FeatureFlags }), []);
  assert.equal(DebugOverlayRegistry.createOverlaySnapshot({ fps: 60 }, { FeatureFlags }), null);
  assert.equal(DebugOverlayRegistry.isOverlayEnabled('fps', null, { FeatureFlags }), false);
});

test('DebugOverlayRegistry creates selected overlay snapshots when enabled', () => {
  const config = { FEATURES: { DEBUG_OVERLAYS_ENABLED: true } };
  const snapshot = DebugOverlayRegistry.createOverlaySnapshot({
    fps: 60,
    worldMapRuntime: { hasBakedMapLayer: true, mapBakeDirty: false },
    visibilitySnapshot: { counts: { unknown: 1, explored: 2, visible: 3, controlled: 4 }, signature: 'v' },
  }, {
    config,
    FeatureFlags,
    enabledOverlayKeys: ['fps', 'visibility'],
  });

  assert.deepEqual(snapshot.keys, ['fps', 'visibility']);
  assert.equal(snapshot.counts.total, 2);
  assert.equal(snapshot.values[0], '60');
  assert.equal(snapshot.values[1], 'U1 E2 V3 C4');
});

test('DebugOverlayRegistry enables all default overlays when the master flag is true', () => {
  const config = { FEATURES: { DEBUG_OVERLAYS_ENABLED: true } };
  const enabled = DebugOverlayRegistry.getEnabledOverlays(config, { FeatureFlags });
  const first = DebugOverlayRegistry.createOverlaySnapshot({
    fps: 30,
    worldMapRuntime: { hasBakedMapLayer: false, mapBakeDirty: true },
    action: { type: 'worldMapDrag' },
  }, {
    config,
    FeatureFlags,
  });
  const second = DebugOverlayRegistry.createOverlaySnapshot({
    fps: 30,
    worldMapRuntime: { hasBakedMapLayer: false, mapBakeDirty: true },
    action: { type: 'worldMapDrag' },
  }, {
    config,
    FeatureFlags,
  });

  assert.deepEqual(enabled.map((overlay) => overlay.key), ['fps', 'worldMapBake', 'visibility', 'inputTrace']);
  assert.deepEqual(first.keys, ['fps', 'worldMapBake', 'visibility', 'inputTrace']);
  assert.equal(first.signature, second.signature);
});
