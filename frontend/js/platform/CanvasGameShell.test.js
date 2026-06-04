const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasGameShell = require('./CanvasGameShell');

test('CanvasGameShell preserves world map layer when drag snapshot refresh misses', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    runtime: {
      setLayerTranslate(layer, x, y) {
        calls.push(['setLayerTranslate', layer, x, y]);
        return true;
      },
    },
    renderer: {},
  });
  shell.worldMapRuntime = {
    getCameraOffsetFromBaked() {
      return { x: 32, y: -18 };
    },
  };
  shell.refreshWorldMapLayerFromSnapshot = (options) => {
    calls.push(['refreshWorldMapLayerFromSnapshot', options]);
    return false;
  };

  const offset = shell.updateWorldMapDragCompositor();

  const refresh = calls.find((call) => call[0] === 'refreshWorldMapLayerFromSnapshot');
  assert.equal(refresh[1].commitCamera, false);
  assert.equal(refresh[1].clearTransform, false);
  assert.equal(refresh[1].preserveOnMiss, true);
  assert.deepEqual(offset, { x: 32, y: -18 });
  assert.deepEqual(calls.at(-1), ['setLayerTranslate', 'worldMap', 32, -18]);
});
