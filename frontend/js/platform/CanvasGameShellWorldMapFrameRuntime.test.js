const test = require('node:test');
const assert = require('node:assert/strict');

const FrameRuntime = require('./CanvasGameShellWorldMapFrameRuntime');

function createShell(overrides = {}) {
  class Shell {}
  FrameRuntime.install(Shell);
  return Object.assign(new Shell(), {
    getActiveTab() {
      return 'military';
    },
    getAnimationFrameMs() {
      return 16;
    },
    getFrozenWorldMapWaterTimeMs() {
      return 555;
    },
    getRequestAnimationFrame() {
      return null;
    },
    isWorldMapDragCoolingDown() {
      return false;
    },
    isWorldMapDragging() {
      return false;
    },
    isWorldMapHomeActive() {
      return false;
    },
    lastGame: {
      state: { id: 'state-1', currentTab: 'military', militaryView: 'world' },
      mapHomeActive: true,
    },
    now() {
      return 1000;
    },
    previewEnabled: true,
    renderAnimationFrame() {
      this.animationFrameRendered = true;
      return true;
    },
    requestRenderAnimationFrame() {
      this.fallbackRequested = true;
      return true;
    },
    runtime: {},
    shouldRenderRuntimeWorldMap() {
      return true;
    },
    syncWorldMapRendererLayerMetrics() {
      this.metricsSynced = true;
      return true;
    },
    worldMapDragFrameActive: false,
    worldMapLayerRenderQueued: false,
    worldMapQueuedRenderOptions: null,
    worldMapRenderer: {},
  }, overrides);
}

test('CanvasGameShellWorldMapFrameRuntime falls back to shell render frame without world map renderer', () => {
  const shell = createShell({ worldMapRenderer: null });

  assert.equal(shell.requestWorldMapRenderAnimationFrame({ force: true }), true);
  assert.equal(shell.fallbackRequested, true);
});

test('CanvasGameShellWorldMapFrameRuntime merges queued options without requestAnimationFrame', () => {
  const calls = [];
  const shell = createShell({
    renderWorldMapLayerFrame(options) {
      calls.push(options);
      return true;
    },
  });

  assert.equal(shell.requestWorldMapRenderAnimationFrame({ force: true }), true);
  assert.deepEqual(calls, [{ force: true }]);
  assert.equal(shell.worldMapQueuedRenderOptions, null);
});

test('CanvasGameShellWorldMapFrameRuntime renders active exploration frame and HUD', () => {
  const calls = [];
  let intervalCallback = null;
  const shell = createShell({
    lastGame: {
      state: {
        currentTab: 'military',
        militaryView: 'world',
        worldExplorerState: {
          activeMission: { id: 'explore-1', status: 'active' },
        },
      },
      mapHomeActive: true,
    },
    renderAnimationFrame() {
      calls.push(['renderAnimationFrame']);
      return true;
    },
    renderWorldMapLayerFrame(options) {
      calls.push(['renderWorldMapLayerFrame', options]);
      return true;
    },
    runtime: {
      setInterval(callback, ms) {
        intervalCallback = callback;
        calls.push(['setInterval', ms]);
        return 1;
      },
    },
  });

  assert.equal(shell.startTileMapWaterTimer(), true);
  intervalCallback();

  assert.equal(calls.some((call) => call[0] === 'setInterval' && call[1] >= 16), true);
  assert.equal(calls.some((call) => call[0] === 'renderWorldMapLayerFrame' && call[1].force === true), true);
  assert.equal(calls.some((call) => call[0] === 'renderAnimationFrame'), true);
});

test('CanvasGameShellWorldMapFrameRuntime refreshes active missions from mission list', () => {
  const calls = [];
  let intervalCallback = null;
  const shell = createShell({
    lastGame: {
      state: {
        currentTab: 'military',
        militaryView: 'world',
        worldExplorerState: {
          activeMission: null,
          missions: [{
            id: 'explore-1',
            status: 'active',
            origin: { q: 0, r: 0, tileId: 'tile_0_0' },
            route: [{ q: 1, r: 0, tileId: 'tile_1_0', step: 1 }],
            startedAt: '2099-06-06T00:00:00.000Z',
            completesAt: '2099-06-06T00:00:10.000Z',
          }],
        },
      },
      mapHomeActive: true,
    },
    renderAnimationFrame() {
      calls.push(['renderAnimationFrame']);
      return true;
    },
    renderWorldMapLayerFrame(options) {
      calls.push(['renderWorldMapLayerFrame', options]);
      return true;
    },
    runtime: {
      setInterval(callback, ms) {
        intervalCallback = callback;
        calls.push(['setInterval', ms]);
        return 1;
      },
    },
  });

  assert.equal(shell.startTileMapWaterTimer(), true);
  intervalCallback();

  assert.equal(calls.some((call) => call[0] === 'renderWorldMapLayerFrame' && call[1]?.force === true), true);
  assert.equal(calls.some((call) => call[0] === 'renderAnimationFrame'), true);
});
