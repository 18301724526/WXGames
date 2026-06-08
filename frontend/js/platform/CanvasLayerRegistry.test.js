const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasLayerRegistry = require('./CanvasLayerRegistry');
const FeatureFlags = require('../config/FeatureFlags');

test('CanvasLayerRegistry owns world map layer options', () => {
  assert.equal(CanvasLayerRegistry.getLayerName('worldMap'), 'worldMap');
  assert.deepEqual(CanvasLayerRegistry.getLayerOptions('worldMap', { padding: 240 }), {
    zIndex: 997,
    padding: 240,
  });
  assert.equal(CanvasLayerRegistry.isLayerEnabled('worldMap'), true);
});

test('CanvasLayerRegistry gates world fog through feature flags', () => {
  assert.equal(CanvasLayerRegistry.getLayerName('worldFog'), 'worldFog');
  assert.deepEqual(CanvasLayerRegistry.getLayerOptions('worldFog', { padding: 240 }), {
    zIndex: 998,
    contextType: 'webgl',
    padding: 240,
  });
  assert.equal(CanvasLayerRegistry.isLayerEnabled('worldFog', null, { FeatureFlags }), false);
  assert.equal(CanvasLayerRegistry.isLayerEnabled(
    'worldFog',
    { FEATURES: { FOG_OF_WAR_ENABLED: true } },
    { FeatureFlags }
  ), true);
});

test('CanvasLayerRegistry rejects unknown layer lifecycle requests', () => {
  assert.equal(CanvasLayerRegistry.getLayer('unknown'), null);
  assert.equal(CanvasLayerRegistry.isLayerEnabled('unknown'), false);
  assert.deepEqual(CanvasLayerRegistry.getLayerOptions('unknown', { zIndex: 777 }), {
    zIndex: 777,
  });
});
