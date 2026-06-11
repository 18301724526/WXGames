const test = require('node:test');
const assert = require('node:assert/strict');

const WorldWorkerService = require('../services/realtime/WorldWorkerService');

test('WorldWorkerService owns runtime advancement outside the gateway API process', () => {
  const calls = [];
  const service = new WorldWorkerService({
    repository: {
      findRecentlyActive(activeSinceIso, limit) {
        calls.push(['findRecentlyActive', activeSinceIso, limit]);
        return [{ playerId: 'bot00001' }, { playerId: 'bot00002' }];
      },
      save(state) {
        calls.push(['save', state.playerId, state.updatedAt]);
      },
    },
    gameStateService: {
      advanceRuntimeState(state, now) {
        calls.push(['advanceRuntimeState', state.playerId, now.toISOString()]);
        return { ...state, advanced: true };
      },
    },
    cityService: {
      advanceAllCities(state, seconds) {
        calls.push(['advanceAllCities', state.playerId, seconds]);
      },
    },
    territoryService: {
      updateMissionReadiness(state) {
        calls.push(['updateMissionReadiness', state.playerId]);
      },
    },
    eventService: {
      cleanupRuntimeState(state) {
        calls.push(['cleanupRuntimeState', state.playerId]);
      },
      maybeGenerateRegularEvent(state) {
        calls.push(['maybeGenerateRegularEvent', state.playerId]);
      },
      maybeGenerateThreatEvent(state) {
        calls.push(['maybeGenerateThreatEvent', state.playerId]);
      },
    },
    now: () => new Date('2026-06-12T00:00:05.000Z'),
    intervalMs: 5000,
    activeWindowMs: 120000,
    activeLimit: 25,
  });

  const summary = service.tickOnce();

  assert.equal(summary.processedCount, 2);
  assert.equal(summary.intervalMs, 5000);
  assert.equal(summary.activeLimit, 25);
  assert.deepEqual(calls.map((call) => call[0]), [
    'findRecentlyActive',
    'advanceRuntimeState',
    'advanceAllCities',
    'updateMissionReadiness',
    'cleanupRuntimeState',
    'maybeGenerateRegularEvent',
    'maybeGenerateThreatEvent',
    'save',
    'advanceRuntimeState',
    'advanceAllCities',
    'updateMissionReadiness',
    'cleanupRuntimeState',
    'maybeGenerateRegularEvent',
    'maybeGenerateThreatEvent',
    'save',
  ]);
});

test('WorldWorkerService prevents overlapping ticks and records slow batches', () => {
  const nowMs = Date.parse('2026-06-12T00:00:00.000Z');
  let monotonicNow = 1000;
  const service = new WorldWorkerService({
    repository: {
      findRecentlyActive() {
        return [];
      },
    },
    gameStateService: {},
    cityService: {},
    territoryService: {},
    eventService: {},
    now: () => new Date(nowMs),
    monotonicNow: () => {
      const current = monotonicNow;
      monotonicNow += 250;
      return current;
    },
    slowTickMs: 100,
  });

  service.running = true;
  const skipped = service.tickOnce();
  assert.equal(skipped.skipped, true);

  service.running = false;
  const summary = service.tickOnce();
  assert.equal(summary.slow, true);
});

test('WorldWorkerService keeps its interval referenced for standalone PM2 workers', () => {
  let unrefCalled = false;
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  global.setInterval = (handler, intervalMs) => {
    assert.equal(typeof handler, 'function');
    assert.equal(intervalMs, 5000);
    return {
      unref() {
        unrefCalled = true;
      },
    };
  };
  global.clearInterval = () => {};
  try {
    const service = new WorldWorkerService({
      repository: { findRecentlyActive: () => [] },
      intervalMs: 5000,
    });
    service.start();
    assert.equal(unrefCalled, false);
  } finally {
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  }
});
