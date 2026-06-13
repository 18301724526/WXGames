const test = require('node:test');
const assert = require('node:assert/strict');

const LogService = require('../services/logService');

function createDbHarness() {
  const calls = [];
  return {
    calls,
    db: {
      exec(sql) {
        calls.push(['exec', sql]);
      },
      prepare(sql) {
        calls.push(['prepare', sql]);
        return {
          run(...args) {
            calls.push(['run', args]);
            return { changes: 1 };
          },
          all() {
            calls.push(['all']);
            return [];
          },
        };
      },
    },
  };
}

test('LogService stores server operation metadata inside local api logs', () => {
  const { calls, db } = createDbHarness();
  const service = new LogService(db);

  service.logApi(
    'player-1',
    'device-1',
    'POST',
    '/api/game/action',
    {
      action: 'startWorldMarch',
      clientRequestId: 'api-7',
      targetQ: 2,
      targetR: -1,
      formationSlot: 1,
    },
    200,
    { success: true, mission: { id: 'march-1' } },
    42,
  );

  const runCall = calls.find((call) => call[0] === 'run');
  const body = JSON.parse(runCall[1][4]);

  assert.equal(body.action, 'startWorldMarch');
  assert.equal(body.operationLog.schema, 'server-operation-log-v1');
  assert.equal(body.operationLog.requestId, 'api-7');
  assert.equal(body.operationLog.action, 'startWorldMarch');
  assert.equal(body.operationLog.targetQ, 2);
  assert.equal(body.operationLog.targetR, -1);
  assert.equal(body.operationLog.success, true);
});
