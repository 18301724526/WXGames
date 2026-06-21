const test = require('node:test');
const assert = require('node:assert/strict');

const GameStateSync = require('./GameStateSync');

test('GameStateSync treats heartbeat as lightweight liveness only', async () => {
  const calls = [];
  const sync = new GameStateSync({
    async heartbeat() {
      return {
        type: 'heartbeat',
        serverTime: '2026-06-06T00:00:00.000Z',
        heartbeatSeq: 1,
        gameState: { shouldNotSync: true },
      };
    },
  }, 1000);

  sync.onHeartbeat = (data) => calls.push(['heartbeat', data.type]);
  sync.onState = (data) => calls.push(['state', data]);

  const data = await sync.fetchNow();

  assert.equal(data.type, 'heartbeat');
  assert.deepEqual(calls, [['heartbeat', 'heartbeat']]);
});

test('GameStateSync refreshes authority state when active world exploration reaches the next step', async () => {
  const calls = [];
  const sync = new GameStateSync({
    async heartbeat() {
      calls.push(['heartbeat']);
      return {
        type: 'heartbeat',
        serverTime: '2026-06-08T21:11:09.600Z',
        heartbeatSeq: 1,
      };
    },
    async getState() {
      calls.push(['getState']);
      return {
        gameState: {
          worldExplorerState: {
            activeMission: null,
            idleMissions: [{ id: 'explore-1', status: 'idle' }],
          },
        },
      };
    },
  }, 1000, {
    getLocalState() {
      return {
        worldExplorerState: {
          activeMission: {
            id: 'explore-1',
            status: 'active',
            nextStepAt: '2026-06-08T21:11:09.575Z',
            completesAt: '2026-06-08T21:11:19.575Z',
          },
        },
      };
    },
  });

  sync.onHeartbeat = (data) => calls.push(['onHeartbeat', data.type]);
  sync.onState = (data, reason) => calls.push([
    'onState',
    data.gameState.worldExplorerState.idleMissions[0].id,
    reason.type,
  ]);

  await sync.fetchNow();

  assert.deepEqual(calls, [
    ['heartbeat'],
    ['onHeartbeat', 'heartbeat'],
    ['getState'],
    ['onState', 'explore-1', 'worldExplorerStepDue'],
  ]);
});

test('GameStateSync throttles repeated authority refreshes while a mission remains due', async () => {
  const calls = [];
  const sync = new GameStateSync({
    async heartbeat() {
      calls.push(['heartbeat']);
      return {
        type: 'heartbeat',
        serverTime: '2026-06-08T21:11:10.000Z',
      };
    },
    async getState() {
      calls.push(['getState']);
      return { gameState: {} };
    },
  }, 1000, {
    stateRefreshMinIntervalMs: 5000,
    getLocalState() {
      return {
        worldExplorerState: {
          activeMission: {
            id: 'explore-1',
            status: 'active',
            nextStepAt: '2026-06-08T21:11:09.575Z',
            completesAt: '2026-06-08T21:11:19.575Z',
          },
        },
      };
    },
  });

  await sync.fetchNow();
  await sync.fetchNow();

  assert.equal(calls.filter((call) => call[0] === 'heartbeat').length, 2);
  assert.equal(calls.filter((call) => call[0] === 'getState').length, 1);
});

test('GameStateSync sends compact march reports and refreshes authority on pullback drift', async () => {
  const calls = [];
  const sync = new GameStateSync({
    async heartbeat(payload) {
      calls.push(['heartbeat', payload.worldMarchClientReport.missions[0].missionId]);
      return {
        type: 'heartbeat',
        serverTime: '2026-06-21T00:00:02.000Z',
        worldMarchVerification: {
          status: 'pullback',
          results: [{ missionId: 'march-1', severity: 'large' }],
        },
      };
    },
    async getState() {
      calls.push(['getState']);
      return { gameState: { worldExplorerState: { activeMission: { id: 'march-1' } } } };
    },
  }, 1000, {
    getLocalState() {
      return { worldExplorerState: { activeMission: { id: 'march-1', status: 'active' } } };
    },
    getWorldMarchClientReport() {
      return {
        schema: 'world-march-client-report-batch-v1',
        missions: [{ missionId: 'march-1', position: { q: 8, r: 0 } }],
      };
    },
  });
  sync.onState = (_data, reason) => calls.push(['onState', reason.type, reason.missionId]);

  await sync.fetchNow();

  assert.deepEqual(calls, [
    ['heartbeat', 'march-1'],
    ['getState'],
    ['onState', 'worldMarchDriftPullback', 'march-1'],
  ]);
});

test('GameStateSync sends no march report when no active report is available', async () => {
  const calls = [];
  const sync = new GameStateSync({
    async heartbeat(payload) {
      calls.push(['heartbeat', payload]);
      return {
        type: 'heartbeat',
        serverTime: '2026-06-21T00:00:02.000Z',
      };
    },
  }, 1000, {
    getWorldMarchClientReport() {
      return null;
    },
  });

  await sync.fetchNow();

  assert.deepEqual(calls, [['heartbeat', undefined]]);
});

test('GameStateSync backs off heartbeat attempts after failures and resets on success', async () => {
  const calls = [];
  let now = 1000;
  let shouldFail = true;
  const sync = new GameStateSync({
    async heartbeat() {
      calls.push(['heartbeat', now]);
      if (shouldFail) throw new Error('Gateway Timeout');
      return {
        type: 'heartbeat',
        serverTime: new Date(now).toISOString(),
      };
    },
  }, 1000, {
    now: () => now,
    backoffBaseMs: 5000,
    backoffMaxMs: 20000,
  });

  await assert.rejects(() => sync.fetchNow(), /Gateway Timeout/);
  assert.equal(sync.failureCount, 1);
  assert.equal(sync.nextAllowedAt, 6000);

  await sync.fetchNow();
  assert.deepEqual(calls, [['heartbeat', 1000]]);

  now = 6000;
  await assert.rejects(() => sync.fetchNow(), /Gateway Timeout/);
  assert.equal(sync.failureCount, 2);
  assert.equal(sync.nextAllowedAt, 16000);

  now = 16000;
  shouldFail = false;
  const data = await sync.fetchNow();
  assert.equal(data.type, 'heartbeat');
  assert.equal(sync.failureCount, 0);
  assert.equal(sync.nextAllowedAt, 0);
  assert.deepEqual(calls, [
    ['heartbeat', 1000],
    ['heartbeat', 6000],
    ['heartbeat', 16000],
  ]);
});
