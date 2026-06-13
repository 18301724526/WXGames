const test = require('node:test');
const assert = require('node:assert/strict');

const LogService = require('../services/logService');

function createDbHarness() {
  const calls = [];
  const clientOperationLogs = [];
  return {
    calls,
    clientOperationLogs,
    db: {
      exec(sql) {
        calls.push(['exec', sql]);
      },
      prepare(sql) {
        calls.push(['prepare', sql]);
        return {
          run(...args) {
            calls.push(['run', args]);
            if (sql.includes('INSERT INTO client_operation_logs')) {
              clientOperationLogs.push({
                id: clientOperationLogs.length + 1,
                playerId: args[0],
                deviceId: args[1],
                reason: args[2],
                entryCount: args[3],
                payload: args[4],
                timestamp: args[5],
              });
              return { changes: 1, lastInsertRowid: clientOperationLogs.length };
            }
            return { changes: 1 };
          },
          all(...args) {
            calls.push(['all', args]);
            if (sql.includes('FROM client_operation_logs')) {
              return clientOperationLogs
                .filter((row) => row.playerId === args[0])
                .slice(0, args[1]);
            }
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

test('LogService stores and queries explicit client operation log snapshots', () => {
  const { db } = createDbHarness();
  const service = new LogService(db);

  const stored = service.logClientOperationSnapshot('player-1', 'device-1', {
    reason: 'city-click-repro',
    exportedAt: '2026-06-14T00:00:00.000Z',
    entries: [
      { seq: 1, type: 'input:tap', detail: { point: { x: 1, y: 2 } } },
      { seq: 2, type: 'input:tapMiss', detail: {} },
    ],
  });

  assert.equal(stored.id, 1);
  assert.equal(stored.entryCount, 2);
  const rows = service.getPlayerClientOperationLogs('player-1', 5);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].reason, 'city-click-repro');
  assert.equal(rows[0].entryCount, 2);
  const payload = JSON.parse(rows[0].payload);
  assert.equal(payload.schema, 'client-operation-log-v1');
  assert.deepEqual(payload.entries.map((entry) => entry.type), ['input:tap', 'input:tapMiss']);
});
