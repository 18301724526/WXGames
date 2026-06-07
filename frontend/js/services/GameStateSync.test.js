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
