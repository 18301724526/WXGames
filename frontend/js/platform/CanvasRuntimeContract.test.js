const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasRuntimeContract = require('./CanvasRuntimeContract');
const H5CanvasRuntime = require('./H5CanvasRuntime');
const PlatformRuntime = require('./PlatformRuntime');

function createMiniGameHost() {
  return {
    createCanvas() {
      return {
        getContext() {
          return {};
        },
      };
    },
    getSystemInfoSync() {
      return { windowWidth: 390, windowHeight: 844, pixelRatio: 2 };
    },
    getStorageSync() {
      return '';
    },
    setStorageSync() {},
    removeStorageSync() {},
    request(options = {}) {
      options.success?.({
        statusCode: 200,
        data: {},
      });
    },
    onTouchEnd() {},
    onTouchStart() {},
    onTouchMove() {},
    onTouchCancel() {},
    showKeyboard() {},
  };
}

test('CanvasRuntimeContract reports missing required runtime methods', () => {
  const missing = CanvasRuntimeContract.findMissingMethods({
    createCanvas() {},
    requestAnimationFrame() {},
  });

  assert.equal(missing.includes('getSystemInfo'), true);
  assert.equal(missing.includes('request'), true);
});

test('H5CanvasRuntime satisfies the shared canvas runtime contract', () => {
  const runtime = new H5CanvasRuntime({
    runtime: {
      setTimeout() {},
      clearTimeout() {},
      setInterval() {},
      clearInterval() {},
      requestAnimationFrame() {},
      addEventListener() {},
      fetch() {},
    },
  });

  assert.equal(runtime.canvasRuntimeContract.schema, 'canvas-runtime-v1');
  assert.equal(runtime.canvasRuntimeContract.kind, 'h5');
  assert.deepEqual(runtime.canvasRuntimeContract.missingMethods, []);
});

test('PlatformRuntime satisfies the same contract for mini-game hosts', () => {
  const runtime = new PlatformRuntime({
    kind: 'wechat',
    host: createMiniGameHost(),
    scheduler: {
      setInterval() {},
      clearInterval() {},
      setTimeout() {},
      clearTimeout() {},
      requestAnimationFrame() {},
    },
  });

  assert.equal(runtime.canvasRuntimeContract.schema, 'canvas-runtime-v1');
  assert.equal(runtime.canvasRuntimeContract.kind, 'wechat');
  assert.deepEqual(runtime.canvasRuntimeContract.missingMethods, []);
});

test('H5 and minigame entries load the contract before concrete runtimes', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
  const minigame = fs.readFileSync(path.resolve(__dirname, '../../minigame/game.js'), 'utf8');

  const contractHtmlIndex = html.indexOf('js/platform/CanvasRuntimeContract.js');
  const h5RuntimeIndex = html.indexOf('js/platform/H5CanvasRuntime.js');
  const contractMinigameIndex = minigame.indexOf("require('../js/platform/CanvasRuntimeContract')");
  const platformRuntimeIndex = minigame.indexOf("require('../js/platform/PlatformRuntime')");

  assert.notEqual(contractHtmlIndex, -1);
  assert.notEqual(h5RuntimeIndex, -1);
  assert.equal(contractHtmlIndex < h5RuntimeIndex, true);
  assert.notEqual(contractMinigameIndex, -1);
  assert.notEqual(platformRuntimeIndex, -1);
  assert.equal(contractMinigameIndex < platformRuntimeIndex, true);
});
