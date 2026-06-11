const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasGameAppRenderScheduler = require('./CanvasGameAppRenderScheduler');

test('CanvasGameAppRenderScheduler resolves time and animation frame durations', () => {
  const host = {
    runtime: { now: () => 1234 },
    canvasShell: { getAnimationFrameMs: () => 20 },
    renderer: { getWorldTileWaterAnimationFps: () => 10 },
  };

  assert.equal(CanvasGameAppRenderScheduler.now(host), 1234);
  assert.equal(CanvasGameAppRenderScheduler.getAnimationFrameMs(host), 20);
  assert.equal(CanvasGameAppRenderScheduler.getTransitionDurationMs(), 220);
  assert.equal(CanvasGameAppRenderScheduler.getWorldMapDragCooldownMs(), 220);
  assert.equal(CanvasGameAppRenderScheduler.getWorldTileWaterAnimationFrameMs(host), 100);
});

test('CanvasGameAppRenderScheduler applies low-end mobile water animation floor', () => {
  const previousNavigator = global.navigator;
  Object.defineProperty(global, 'navigator', {
    configurable: true,
    value: { hardwareConcurrency: 4, deviceMemory: 4, maxTouchPoints: 5 },
  });
  try {
    const host = {
      canvasShell: null,
      renderer: { getWorldTileWaterAnimationFps: () => 8 },
    };

    assert.equal(CanvasGameAppRenderScheduler.getWorldTileWaterAnimationFrameMs(host), 900);
  } finally {
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: previousNavigator,
    });
  }
});

test('CanvasGameAppRenderScheduler waits through injected scheduler', async () => {
  const calls = [];
  const host = {
    scheduler: {
      setTimeout(callback, delay) {
        calls.push(['setTimeout', delay]);
        callback();
      },
    },
  };

  await CanvasGameAppRenderScheduler.wait(host, 42);
  assert.deepEqual(calls, [['setTimeout', 42]]);
});

test('CanvasGameAppRenderScheduler sets and clears intervals through preferred host', () => {
  const calls = [];
  const host = {
    scheduler: {
      setInterval(callback, delay) {
        calls.push(['scheduler.setInterval', delay]);
        return 'timer-1';
      },
      clearInterval(timer) {
        calls.push(['scheduler.clearInterval', timer]);
      },
    },
    runtime: {
      setInterval() {
        calls.push(['runtime.setInterval']);
      },
    },
  };

  const timer = CanvasGameAppRenderScheduler.setIntervalForHost(host, () => {}, 16);
  assert.equal(timer, 'timer-1');
  assert.equal(CanvasGameAppRenderScheduler.clearIntervalForHost(host, timer), true);
  assert.deepEqual(calls, [
    ['scheduler.setInterval', 16],
    ['scheduler.clearInterval', 'timer-1'],
  ]);
});

test('CanvasGameAppRenderScheduler binds requestAnimationFrame to runtime', () => {
  const runtime = {
    value: 7,
    requestAnimationFrame(callback) {
      callback(this.value);
    },
  };
  const raf = CanvasGameAppRenderScheduler.getRequestAnimationFrame({ runtime });
  let value = 0;
  raf((next) => {
    value = next;
  });
  assert.equal(value, 7);
});
