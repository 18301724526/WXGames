const test = require('node:test');
const assert = require('node:assert/strict');

const PresenceService = require('../services/realtime/PresenceService');

test('PresenceService absorbs bot heartbeat bursts without per-request database writes', () => {
  const touches = [];
  let nowMs = Date.parse('2026-06-12T00:00:00.000Z');
  const service = new PresenceService({
    repository: {
      touchPlayerActiveAt(playerId) {
        touches.push(playerId);
      },
    },
    now: () => new Date(nowMs),
    minPersistIntervalMs: 60000,
  });

  for (let index = 1; index <= 5000; index += 1) {
    const playerId = `bot${String(index).padStart(5, '0')}`;
    const result = service.recordHeartbeat(playerId);
    assert.equal(result.persisted, false);
  }

  assert.equal(touches.length, 0);
  assert.equal(service.getOnlineSummary().totalOnline, 5000);

  nowMs += 61000;
  const persisted = service.recordHeartbeat('bot00001');

  assert.equal(persisted.persisted, true);
  assert.deepEqual(touches, ['bot00001']);
});

test('PresenceService reports online windows for ops and load-test guardrails', () => {
  let nowMs = Date.parse('2026-06-12T00:00:00.000Z');
  const service = new PresenceService({
    now: () => new Date(nowMs),
    minPersistIntervalMs: 60000,
  });

  service.recordHeartbeat('bot00001');
  service.recordHeartbeat('bot00002');
  nowMs += 11 * 60 * 1000;
  service.recordHeartbeat('bot00003');

  const summary = service.getOnlineSummary({ windowsSeconds: [60, 600, 900] });

  assert.equal(summary.schema, 'presence-summary-v1');
  assert.equal(summary.totalOnline, 3);
  assert.equal(summary.windows.last60s, 1);
  assert.equal(summary.windows.last600s, 1);
  assert.equal(summary.windows.last900s, 3);
});
