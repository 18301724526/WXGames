const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const GameStateSync = require('../js/services/GameStateSync');
const projectRoot = path.join(__dirname, '..', '..');

test('setIntervalMs stores a new interval without starting a stopped sync timer', () => {
  const scheduled = [];
  const scheduler = {
    setInterval(callback, intervalMs) {
      const timer = { callback, intervalMs };
      scheduled.push(timer);
      return timer;
    },
  };

  const sync = new GameStateSync({ async getState() { return {}; } }, 2000, scheduler);
  sync.setIntervalMs(500);

  assert.equal(sync.intervalMs, 500);
  assert.equal(sync.timer, null);
  assert.equal(scheduled.length, 0);

  sync.start();
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].intervalMs, 500);
});

test('setIntervalMs restarts an active sync timer with the new interval', () => {
  const scheduled = [];
  const cleared = [];
  const scheduler = {
    setInterval(callback, intervalMs) {
      const timer = { callback, intervalMs };
      scheduled.push(timer);
      return timer;
    },
    clearInterval(timer) {
      cleared.push(timer);
    },
  };

  const sync = new GameStateSync({ async getState() { return {}; } }, 2000, scheduler);
  sync.start();
  const firstTimer = sync.timer;

  sync.setIntervalMs(500);
  assert.equal(sync.intervalMs, 500);
  assert.equal(scheduled.length, 2);
  assert.equal(scheduled[1].intervalMs, 500);
  assert.deepEqual(cleared, [firstTimer]);

  sync.setIntervalMs(500);
  assert.equal(scheduled.length, 2);
});

test('GameStateSync uses injected scheduler instead of global timers', () => {
  const scheduled = [];
  const sync = new GameStateSync({ async getState() { return {}; } }, 1500, {
    setInterval(callback, intervalMs) {
      const timer = { callback, intervalMs };
      scheduled.push(timer);
      return timer;
    },
    clearInterval() {},
  });

  sync.start();

  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].intervalMs, 1500);
});

test('app injects the shell scheduler into GameStateSync', () => {
  const appJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'app.js'), 'utf8');
  const serviceJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'services', 'GameStateSync.js'), 'utf8');

  assert.match(appJs, /new window\.GameStateSync\(this\.gameAPI, window\.GameConfig\.SYNC_INTERVAL_MS, this\.scheduler\)/);
  assert.doesNotMatch(serviceJs, /global\.setInterval|global\.clearInterval/);
});
