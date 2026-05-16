const test = require('node:test');
const assert = require('node:assert/strict');

const GameStateSync = require('../js/services/GameStateSync');

test('setIntervalMs stores a new interval without starting a stopped sync timer', () => {
  const originalSetInterval = global.setInterval;
  try {
    const scheduled = [];
    global.setInterval = (callback, intervalMs) => {
      const timer = { callback, intervalMs };
      scheduled.push(timer);
      return timer;
    };

    const sync = new GameStateSync({ async getState() { return {}; } }, 2000);
    sync.setIntervalMs(500);

    assert.equal(sync.intervalMs, 500);
    assert.equal(sync.timer, null);
    assert.equal(scheduled.length, 0);

    sync.start();
    assert.equal(scheduled.length, 1);
    assert.equal(scheduled[0].intervalMs, 500);
  } finally {
    global.setInterval = originalSetInterval;
  }
});

test('setIntervalMs restarts an active sync timer with the new interval', () => {
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  try {
    const scheduled = [];
    const cleared = [];
    global.setInterval = (callback, intervalMs) => {
      const timer = { callback, intervalMs };
      scheduled.push(timer);
      return timer;
    };
    global.clearInterval = (timer) => {
      cleared.push(timer);
    };

    const sync = new GameStateSync({ async getState() { return {}; } }, 2000);
    sync.start();
    const firstTimer = sync.timer;

    sync.setIntervalMs(500);
    assert.equal(sync.intervalMs, 500);
    assert.equal(scheduled.length, 2);
    assert.equal(scheduled[1].intervalMs, 500);
    assert.deepEqual(cleared, [firstTimer]);

    sync.setIntervalMs(500);
    assert.equal(scheduled.length, 2);
  } finally {
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  }
});
