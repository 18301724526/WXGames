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
