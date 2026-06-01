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

  const sync = new GameStateSync({ async heartbeat() { return {}; } }, 2000, scheduler);
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

  const sync = new GameStateSync({ async heartbeat() { return {}; } }, 2000, scheduler);
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
  const sync = new GameStateSync({ async heartbeat() { return {}; } }, 1500, {
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

  assert.match(appJs, /new constructors\.GameStateSync\(this\.gameAPI, this\.config\?\.HEARTBEAT_INTERVAL_MS \|\| 1000, this\.scheduler\)/);
  assert.doesNotMatch(appJs, /new window\./);
  assert.doesNotMatch(appJs, /window\.GameConfig/);
  assert.doesNotMatch(serviceJs, /global\.setInterval|global\.clearInterval/);
});

test('GameStateSync sends lightweight heartbeat instead of full game state', async () => {
  const calls = [];
  const seen = [];
  const sync = new GameStateSync({
    async heartbeat() {
      calls.push('heartbeat');
      return { type: 'heartbeat', serverTime: '2026-06-02T00:00:00.000Z' };
    },
    async getState() {
      calls.push('getState');
      return { gameState: { territoryState: { worldMap: { tiles: [] } } } };
    },
  }, 1000, {});
  sync.onHeartbeat = (data) => seen.push(data);

  const data = await sync.fetchNow();

  assert.equal(data.type, 'heartbeat');
  assert.deepEqual(calls, ['heartbeat']);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].gameState, undefined);
  assert.equal(seen[0].revisions, undefined);
});

test('GameStateSync does not fall back to full state when heartbeat is missing', async () => {
  const calls = [];
  const sync = new GameStateSync({
    async getState() {
      calls.push('getState');
      return { gameState: { resources: {} } };
    },
  }, 1000, {});

  await assert.rejects(() => sync.fetchNow(), /requires a lightweight heartbeat endpoint/);
  assert.deepEqual(calls, []);
});

test('GameStateSync reports reconnecting after repeated missed heartbeats', async () => {
  const states = [];
  const sync = new GameStateSync({
    async heartbeat() {
      throw new Error('offline');
    },
  }, 1000, { reconnectThreshold: 3 });
  sync.onConnectionState = (state) => states.push(state.status);

  await assert.rejects(() => sync.fetchNow(), /offline/);
  await assert.rejects(() => sync.fetchNow(), /offline/);
  await assert.rejects(() => sync.fetchNow(), /offline/);

  assert.deepEqual(states, ['reconnecting']);
  assert.equal(sync.reconnecting, true);
});
