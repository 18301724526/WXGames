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
      getClientProjectionForPlayer(playerId) {
        calls.push(['getClientProjectionForPlayer', playerId]);
        return { sharedWorldTerritories: [{ id: 'worker-shared-site' }] };
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
    ['getClientProjectionForPlayer', 'test1'],
    ['advanceRuntimeState', 'test1', {
      advanceWorldAi: false,
      marchVerification: { enabled: true },
      planningContext: { sharedWorldTerritories: [{ id: 'worker-shared-site' }] },
    }],
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

test('WorldWorkerService re-reads the latest revision and retries on conflict', () => {
  // Active players write through the API while the worker ticks; the worker must not
  // starve them: on GAME_STATE_REVISION_CONFLICT it re-reads the fresh state and retries.
  let saves = 0;
  let reads = 0;
  const service = new WorldWorkerService({
    repository: {
      findRecentlyActive() {
        return [{ playerId: 'hot-player', revision: 1 }];
      },
      findByPlayerId(playerId) {
        reads += 1;
        return { playerId, revision: 1 + reads };
      },
      save() {
        saves += 1;
        if (saves === 1) {
          const error = new Error('Game state revision conflict');
          error.code = 'GAME_STATE_REVISION_CONFLICT';
          throw error;
        }
      },
    },
    gameStateService: { advanceRuntimeState: (state) => state },
    now: () => new Date('2026-07-04T00:00:05.000Z'),
  });

  const summary = service.tickOnce();

  assert.equal(summary.processedCount, 1, 'conflicted player is retried and advanced');
  assert.equal(summary.errorCount, 0);
  assert.equal(saves, 2);
  assert.equal(reads >= 2, true, 'fresh state re-read after the conflict');
});

test('WorldWorkerService gives up after bounded conflict retries without erroring', () => {
  const service = new WorldWorkerService({
    repository: {
      findRecentlyActive() {
        return [{ playerId: 'hottest-player' }];
      },
      findByPlayerId(playerId) {
        return { playerId };
      },
      save() {
        const error = new Error('Game state revision conflict');
        error.code = 'GAME_STATE_REVISION_CONFLICT';
        throw error;
      },
    },
    gameStateService: { advanceRuntimeState: (state) => state },
    now: () => new Date('2026-07-04T00:00:05.000Z'),
  });

  const summary = service.tickOnce();

  // The player just waits for the next tick — a delayed march, never a starved one,
  // and never a crash-loop error entry.
  assert.equal(summary.processedCount, 0);
  assert.equal(summary.errorCount, 1);
});
