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
    zIndex: 1000,
    pointerEvents: 'auto',
    role: 'screen-hud-input',
  });
  assert.deepEqual(CanvasLayerRegistry.getLayerOptions('worldActor', { padding: 240 }), {
    zIndex: 999,
    padding: 240,
  });

  assert.deepEqual(CanvasLayerRegistry.getLayerOptions('worldActorSpine', { padding: 0 }), {
    zIndex: 999,
    contextType: 'webgl',
    pointerEvents: 'none',
    padding: 0,
  });

  const stack = CanvasLayerRegistry.getPhysicalLayerStack();
  assert.deepEqual(stack.map((layer) => layer.key), [
    'worldMap',
    'worldFog',
    'worldActor',
    'worldActorSpine',
    'mainHud',
    'panelOverlay',
    'tutorialHighlight',
    'tutorialSpine',
    'tutorialDialogue',
  ]);
  // worldActorSpine shares worldActor's z-index (999): composite order is the array above, and
  // the DOM fallback breaks the tie by document order (which follows this same array).
  assert.deepEqual(stack.map((layer) => layer.zIndex), [997, 998, 999, 999, 1000, 1001, 1002, 1003, 1004]);
  // PHYSICAL_LAYER_ORDER must stay monotonic (non-decreasing) in z-index: H5CanvasRuntime
  // inserts layer canvases into the DOM ordered by z-index so that document order matches this
  // canonical stack (guarding WebView compositors that break stacking-context ties by order).
  const zIndexes = stack.map((layer) => layer.zIndex);
  assert.equal(zIndexes.every(Number.isInteger), true);
  assert.deepEqual(zIndexes, [...zIndexes].sort((a, b) => a - b));
  assert.equal(stack[0].cameraSpace, 'world');
  assert.equal(stack[1].cameraSpace, 'world-overlay');
  assert.equal(stack[2].cameraSpace, 'world-dynamic');
  assert.equal(stack[2].inputSurface, false);
  assert.equal(stack[3].cameraSpace, 'world-dynamic');
  assert.equal(stack[3].inputSurface, false);
  assert.equal(stack[3].contextType, 'webgl');
  assert.equal(stack[4].cameraSpace, 'screen');
  assert.equal(stack[4].inputSurface, true);
  assert.equal(stack[5].cameraSpace, 'screen-overlay');
  assert.equal(stack[5].inputSurface, false);
  assert.equal(stack[6].cameraSpace, 'screen-overlay');
  assert.equal(stack[6].inputSurface, false);
  assert.equal(stack[6].contextType, '2d');
  assert.equal(stack[6].pointerEvents, 'none');
  assert.equal(stack[7].cameraSpace, 'screen-overlay');
  assert.equal(stack[7].inputSurface, false);
  assert.equal(stack[8].cameraSpace, 'screen-overlay');
  assert.equal(stack[8].inputSurface, false);
  assert.equal(stack.filter((layer) => layer.inputSurface).length, 1);
});

test('CanvasLayerRegistry owns tutorial overlay layer options', () => {
  assert.deepEqual(CanvasLayerRegistry.getLayerOptions('panelOverlay'), {
    zIndex: 1001,
    pointerEvents: 'none',
  });
  assert.deepEqual(CanvasLayerRegistry.getLayerOptions('tutorialHighlight', {
    rect: { x: 0, y: 0, width: 390, height: 693 },
  }), {
    zIndex: 1002,
    pointerEvents: 'none',
    rect: { x: 0, y: 0, width: 390, height: 693 },
  });
  assert.deepEqual(CanvasLayerRegistry.getLayerOptions('tutorialSpine', {
    rect: { x: 24, y: 360, width: 160, height: 280 },
  }), {
    zIndex: 1003,
    contextType: 'webgl',
    pointerEvents: 'none',
    rect: { x: 24, y: 360, width: 160, height: 280 },
  });
  assert.deepEqual(CanvasLayerRegistry.getLayerOptions('tutorialDialogue', {
    rect: { x: 0, y: 0, width: 390, height: 693 },
  }), {
    zIndex: 1004,
    pointerEvents: 'none',
    rect: { x: 0, y: 0, width: 390, height: 693 },
  });
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
