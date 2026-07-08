const test = require('node:test');
const assert = require('node:assert/strict');

const TileMapWaterAnimationTimer = require('./TileMapWaterAnimationTimer');

// SHAPE-B contract: the class owns ONLY the interval lifecycle; the per-frame
// orchestration is the host callback passed at construction (render-stack specific,
// stays on CanvasGameApp).

function makeHost() {
  const host = {
    calls: [],
    intervalCallback: null,
    getWorldTileWaterAnimationFrameMs() {
      return 125;
    },
    scheduler: {
      setInterval: (callback, ms) => {
        host.intervalCallback = callback;
        host.calls.push(['setInterval', ms]);
        return 3;
      },
      clearInterval: (handle) => {
        host.calls.push(['clearInterval', handle]);
      },
    },
  };
  return host;
}

test('start arms once through the host scheduler and reports double-arm as false', () => {
  const host = makeHost();
  const ticks = [];
  const timer = new TileMapWaterAnimationTimer({ host, tick: () => ticks.push('tick') });

  assert.equal(timer.start(), true);
  assert.equal(timer.start(), false);
  assert.deepEqual(host.calls, [['setInterval', 125]]);
  assert.equal(timer.isActive(), true);

  host.intervalCallback();
  host.intervalCallback();
  assert.deepEqual(ticks, ['tick', 'tick']);
});

test('stop clears the handle, tolerates double-stop, and allows re-arming', () => {
  const host = makeHost();
  const timer = new TileMapWaterAnimationTimer({ host, tick: () => {} });

  timer.stop();
  assert.deepEqual(host.calls, []);

  timer.start();
  timer.stop();
  timer.stop();
  assert.equal(timer.isActive(), false);
  assert.equal(timer.start(), true);
  assert.deepEqual(host.calls, [
    ['setInterval', 125],
    ['clearInterval', 3],
    ['setInterval', 125],
  ]);
});

test('start reports false when no interval source exists on the host', () => {
  const timer = new TileMapWaterAnimationTimer({
    host: {
      getWorldTileWaterAnimationFrameMs() {
        return 125;
      },
      scheduler: { setInterval: () => null, clearInterval: () => {} },
    },
    tick: () => {},
  });
  assert.equal(timer.start(), false);
  assert.equal(timer.isActive(), false);
});
