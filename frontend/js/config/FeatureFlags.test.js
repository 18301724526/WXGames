const test = require('node:test');
const assert = require('node:assert/strict');

const FeatureFlags = require('./FeatureFlags');

test('FeatureFlags resolves default feature state', () => {
  assert.deepEqual(FeatureFlags.resolve(), {
    FOG_OF_WAR_ENABLED: false,
    DEBUG_OVERLAYS_ENABLED: false,
  });
  assert.equal(FeatureFlags.isEnabled(null, 'FOG_OF_WAR_ENABLED'), false);
  assert.equal(FeatureFlags.isEnabled(null, 'DEBUG_OVERLAYS_ENABLED'), false);
});

test('FeatureFlags enables explicit true flags only', () => {
  assert.equal(FeatureFlags.isEnabled({ FEATURES: { FOG_OF_WAR_ENABLED: true } }, 'FOG_OF_WAR_ENABLED'), true);
  assert.equal(FeatureFlags.isEnabled({ FEATURES: { DEBUG_OVERLAYS_ENABLED: true } }, 'DEBUG_OVERLAYS_ENABLED'), true);
  assert.equal(FeatureFlags.isEnabled({ FEATURES: { FOG_OF_WAR_ENABLED: 'true' } }, 'FOG_OF_WAR_ENABLED'), false);
  assert.equal(FeatureFlags.isEnabled({ FEATURES: { FOG_OF_WAR_ENABLED: 1 } }, 'FOG_OF_WAR_ENABLED'), false);
});

test('FeatureFlags supports runtime overrides without mutating config', () => {
  const config = { FEATURES: { FOG_OF_WAR_ENABLED: false } };
  const resolved = FeatureFlags.resolve(config, { FOG_OF_WAR_ENABLED: true });

  assert.equal(resolved.FOG_OF_WAR_ENABLED, true);
  assert.equal(resolved.DEBUG_OVERLAYS_ENABLED, false);
  assert.equal(config.FEATURES.FOG_OF_WAR_ENABLED, false);
});
