const test = require('node:test');
const assert = require('node:assert/strict');

const DragRuntime = require('./CanvasGameShellWorldMapDragRuntime');

function createShell(overrides = {}) {
  class Shell {}
  DragRuntime.install(Shell);
  let now = 1000;
  return Object.assign(new Shell(), {
    getWorldMapLayerPadding() {
      return 200;
    },
    now() {
      return now;
    },
    renderActive(options) {
      this.renderActiveOptions = options;
      return 'rendered';
    },
    setNow(value) {
      now = value;
    },
    territoryUiState: {},
    worldMapDragCooldownUntil: 0,
    worldMapDragFrameActive: true,
    worldMapDragWaterTimeMs: null,
    worldMapPinchDragging: true,
    worldMapRuntime: { waterTimeMs: 123 },
  }, overrides);
}

test('CanvasGameShellWorldMapDragRuntime tracks drag water time and cooldown', () => {
  const shell = createShell();

  assert.equal(shell.getFrozenWorldMapWaterTimeMs(), 1000);
  assert.equal(shell.isWorldMapDragging(), true);
  shell.setNow(1200);
  assert.equal(shell.finishWorldMapSnapshotDrag(), true);
  assert.equal(shell.isWorldMapDragging(), false);
  assert.equal(shell.isWorldMapDragCoolingDown(), true);
  assert.equal(shell.worldMapRuntime.waterTimeMs, null);
  assert.equal(shell.worldMapPinchDragging, false);
});

test('CanvasGameShellWorldMapDragRuntime renders deferred frame after drag', () => {
  const shell = createShell({
    deferRenderUntilWorldMapDragEnd: true,
  });

  assert.equal(shell.finishWorldMapSnapshotDrag(), 'rendered');
  assert.deepEqual(shell.renderActiveOptions, { invalidateWorldTileView: false });
  assert.equal(shell.deferRenderUntilWorldMapDragEnd, false);
});

test('CanvasGameShellWorldMapDragRuntime translates layers after snapshot miss', () => {
  const calls = [];
  const shell = createShell({
    getCanvasLayerCanvas() {
      return null;
    },
    ensureCanvasLayer(name, options) {
      calls.push(['ensureCanvasLayer', name, options.padding]);
      return {};
    },
    refreshWorldMapLayerFromSnapshot(options) {
      calls.push(['refreshSnapshot', options.commitCamera, options.clearTransform]);
      return false;
    },
    runtime: {
      ensureLayerCanvas() {},
    },
    setCanvasLayerTranslate(name, x, y) {
      calls.push(['translate', name, x, y]);
      return true;
    },
    worldMapRuntime: {
      getCameraOffsetFromBaked() {
        return { x: 12, y: -8 };
      },
    },
  });

  assert.deepEqual(shell.updateWorldMapDragCompositor(), { x: 12, y: -8 });
  assert.equal(calls.some((call) => call[0] === 'ensureCanvasLayer' && call[1] === 'worldMap'), true);
  assert.equal(calls.some((call) => call[0] === 'translate' && call[1] === 'worldMap' && call[2] === 12), true);
});
