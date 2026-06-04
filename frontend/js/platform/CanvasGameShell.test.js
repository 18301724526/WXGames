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

test('CanvasGameShell routes map command tech tree drag through command panel hit target', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      hitTargets: [
        { x: 40, y: 360, width: 300, height: 240, action: { type: 'techTreeDrag', background: true } },
      ],
      getHitTarget(point) {
        calls.push(['getHitTarget', point.x, point.y]);
        return { type: 'blockCanvasModal' };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.phase]);
        return true;
      },
    },
  });
  shell.lastGame = {
    state: { currentTab: 'military', militaryView: 'world' },
    mapHomeActive: true,
    getActiveTab() {
      return 'military';
    },
  };
  shell.activeCommandPanel = 'tech';

  assert.equal(shell.handleDrag('start', { x: 120, y: 420 }, {}), true);
  assert.equal(shell.handleDrag('move', { x: 150, y: 460 }, {}), true);
  assert.equal(shell.handleDrag('end', { x: 150, y: 460 }, {}), true);

  assert.deepEqual(
    calls.filter((call) => call[0] === 'handle'),
    [
      ['handle', 'techTreeDrag', 'start'],
      ['handle', 'techTreeDrag', 'move'],
      ['handle', 'techTreeDrag', 'end'],
    ],
  );
  assert.equal(calls.some((call) => call[0] === 'getHitTarget'), false);
});

test('CanvasGameShell routes map command tech tree wheel zoom at tree hit target', () => {
  const calls = [];
  const event = {
    preventDefault() {
      calls.push(['preventDefault']);
    },
    stopPropagation() {
      calls.push(['stopPropagation']);
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      hitTargets: [
        { x: 40, y: 360, width: 300, height: 240, action: { type: 'techTreeDrag', background: true } },
      ],
      getHitTarget(point) {
        calls.push(['getHitTarget', point.x, point.y]);
        return { type: 'blockCanvasModal' };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.gesture.scaleDelta]);
        return true;
      },
    },
  });
  shell.lastGame = {
    state: { currentTab: 'military', militaryView: 'world' },
    mapHomeActive: true,
    getActiveTab() {
      return 'military';
    },
  };
  shell.activeCommandPanel = 'tech';

  assert.equal(shell.handleGesture({ type: 'wheelZoom', scaleDelta: 1.1, centerX: 180, centerY: 520 }, event), true);

  assert.deepEqual(calls, [
    ['handle', 'techTreeZoom', 1.1],
    ['preventDefault'],
    ['stopPropagation'],
  ]);
});
