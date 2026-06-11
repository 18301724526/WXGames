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
      advanceRuntimeState(state, now, options) {
        calls.push(['advanceRuntimeState', state.playerId, now.toISOString(), options]);
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

test('WorldWorkerService advances player runtime without background AI world expansion', () => {
  const calls = [];
  const service = new WorldWorkerService({
    repository: {
      findRecentlyActive() {
        return [{
          playerId: 'test1',
          worldAi: {
            explorers: [{
              id: 'ai-frontier-1',
              nextStepAt: '2026-06-11T23:00:00.000Z',
            }],
          },
          worldMap: {
            tiles: Array.from({ length: 2100 }, (_, index) => ({
              id: `hidden_${index}`,
              q: index,
              r: 0,
              visibility: 'hidden',
              visible: false,
            })),
          },
        }];
      },
      save(state) {
        calls.push(['save', state.playerId]);
      },
    },
    gameStateService: {
      advanceRuntimeState(state, _now, options) {
        calls.push(['advanceRuntimeState', state.playerId, options]);
        return state;
      },
    },
    worldAiService: {
      advanceAiExploration() {
        throw new Error('world worker must not expand AI exploration inside player ticks');
      },
    },
    now: () => new Date('2026-06-12T00:00:05.000Z'),
  });

  const summary = service.tickOnce();

  assert.equal(summary.processedCount, 1);
  assert.deepEqual(calls, [
    ['advanceRuntimeState', 'test1', { advanceWorldAi: false }],
    ['save', 'test1'],
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
