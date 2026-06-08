const test = require('node:test');
const assert = require('node:assert/strict');

const WorldMapRuntimeInputPolicy = require('./WorldMapRuntimeInputPolicy');

test('WorldMapRuntimeInputPolicy detects available input layouts', () => {
  assert.equal(WorldMapRuntimeInputPolicy.hasInputLayout(null), false);
  assert.equal(WorldMapRuntimeInputPolicy.hasInputLayout({}), false);
  assert.equal(WorldMapRuntimeInputPolicy.hasInputLayout({ map: {} }), true);
  assert.equal(WorldMapRuntimeInputPolicy.hasInputLayout({ world: {} }), true);
  assert.equal(WorldMapRuntimeInputPolicy.hasInputLayout({ panel: {} }), true);
});

test('WorldMapRuntimeInputPolicy resolves map rect from runtime metrics', () => {
  assert.equal(WorldMapRuntimeInputPolicy.createInputMapRect({
    layout: {},
    canRender: false,
  }), null);

  assert.deepEqual(WorldMapRuntimeInputPolicy.createInputMapRect({
    layout: { panel: {} },
    topBarBottom: '48',
    renderer: {
      viewportWidth: '360',
      viewportHeight: '640',
      bottomSafeArea: '10',
    },
    runtime: {
      width: 500,
      height: 900,
    },
    systemInfo: {
      windowWidth: 800,
      windowHeight: 1000,
    },
  }), {
    x: 0,
    y: 48,
    width: 360,
    height: 522,
  });

  assert.deepEqual(WorldMapRuntimeInputPolicy.createInputMapRect({
    layout: {},
    canRender: true,
    topBarBottom: 90,
    renderer: {
      viewportWidth: 'bad',
      width: 0,
      viewportHeight: null,
      height: -4,
      bottomSafeArea: -20,
    },
    runtime: {
      width: 512,
    },
    systemInfo: {
      windowWidth: 700,
      windowHeight: 600,
    },
  }), {
    x: 0,
    y: 90,
    width: 512,
    height: 0,
  });
});

test('WorldMapRuntimeInputPolicy checks inclusive map bounds', () => {
  const map = { x: 0, y: 84, width: 390, height: 700 };
  assert.equal(WorldMapRuntimeInputPolicy.isPointInMap({ x: 0, y: 84 }, map), true);
  assert.equal(WorldMapRuntimeInputPolicy.isPointInMap({ x: 390, y: 784 }, map), true);
  assert.equal(WorldMapRuntimeInputPolicy.isPointInMap({ x: -1, y: 84 }, map), false);
  assert.equal(WorldMapRuntimeInputPolicy.isPointInMap({ x: 10, y: 'bad' }, map), false);
  assert.equal(WorldMapRuntimeInputPolicy.isPointInMap({ x: 10, y: 90 }, null), false);
});
