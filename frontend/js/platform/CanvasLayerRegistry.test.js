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

test('CanvasLayerRegistry defines the mature engine physical canvas stack', () => {
  assert.equal(CanvasLayerRegistry.getLayerName('mainHud'), 'mainHud');
  assert.deepEqual(CanvasLayerRegistry.getLayerOptions('mainHud'), {
    zIndex: 999,
    pointerEvents: 'auto',
    role: 'screen-hud-input',
  });

  const stack = CanvasLayerRegistry.getPhysicalLayerStack();
  assert.deepEqual(stack.map((layer) => layer.key), ['worldMap', 'worldFog', 'mainHud']);
  assert.deepEqual(stack.map((layer) => layer.zIndex), [997, 998, 999]);
  assert.equal(stack[0].cameraSpace, 'world');
  assert.equal(stack[1].cameraSpace, 'world-overlay');
  assert.equal(stack[2].cameraSpace, 'screen');
  assert.equal(stack[2].inputSurface, true);
  assert.equal(stack.filter((layer) => layer.inputSurface).length, 1);
});

test('CanvasLayerRegistry locks logical render queue and hit priority order', () => {
  assert.deepEqual(CanvasLayerRegistry.getRenderQueue(), [
    'worldPanel',
    'terrain',
    'water',
    'routes',
    'sites',
    'fogMask',
    'actors',
    'worldHud',
    'screenHud',
    'floatingControls',
    'panels',
    'modals',
    'tutorial',
    'feedback',
    'debug',
  ]);
  assert.deepEqual(CanvasLayerRegistry.getHitPriorityQueue(), [
    'mapBackground',
    'mapTile',
    'mapSite',
    'mapActor',
    'worldHud',
    'screenHud',
    'floatingControls',
    'panel',
    'modal',
    'tutorialShield',
    'debug',
  ]);
  assert.equal(CanvasLayerRegistry.compareRenderOrder('terrain', 'actors') < 0, true);
  assert.equal(CanvasLayerRegistry.compareRenderOrder('modals', 'tutorial') < 0, true);
  assert.equal(CanvasLayerRegistry.compareHitPriority('mapBackground', 'modal') < 0, true);
  assert.equal(CanvasLayerRegistry.compareHitPriority('tutorialShield', 'modal') > 0, true);
});

test('CanvasLayerRegistry rejects unknown layer lifecycle requests', () => {
  assert.equal(CanvasLayerRegistry.getLayer('unknown'), null);
  assert.equal(CanvasLayerRegistry.isLayerEnabled('unknown'), false);
  assert.deepEqual(CanvasLayerRegistry.getLayerOptions('unknown', { zIndex: 777 }), {
    zIndex: 777,
  });
});
