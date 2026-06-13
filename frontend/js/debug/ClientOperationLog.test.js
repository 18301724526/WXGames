const test = require('node:test');
const assert = require('node:assert/strict');

const ClientOperationLog = require('./ClientOperationLog');

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
    dump() {
      return Object.fromEntries(values);
    },
  };
}

test('ClientOperationLog records local entries without any network transport', () => {
  const storage = createStorage();
  const calls = [];
  const logger = new ClientOperationLog({
    runtime: {
      location: { search: '' },
      localStorage: { getItem: () => null },
      sessionStorage: storage,
      performance: { now: () => 12.3456 },
      Date: { now: () => Date.parse('2026-06-14T00:00:00.000Z') },
      fetch() {
        calls.push(['fetch']);
      },
    },
    storage,
    maxEntries: 3,
    persistLimit: 2,
    flushIntervalMs: 0,
  });

  logger.record('input:tap', { point: { x: 1.2345, y: 9.8765 } });
  logger.record('action:begin', { action: { type: 'openWorldSite', siteId: 'capital' } });
  logger.record('api:request', { requestId: 'api-1', path: '/game/action' });

  assert.equal(calls.length, 0);
  assert.deepEqual(logger.getEntries().map((entry) => entry.type), [
    'input:tap',
    'action:begin',
    'api:request',
  ]);
  const persisted = JSON.parse(storage.dump().clientOperationLog);
  assert.equal(persisted.schema, 'client-operation-log-v1');
  assert.deepEqual(persisted.entries.map((entry) => entry.type), ['action:begin', 'api:request']);
});

test('ClientOperationLog uploads an explicit diagnostic snapshot through a configured uploader', async () => {
  const uploaded = [];
  const logger = new ClientOperationLog({
    runtime: {
      location: { search: '' },
      localStorage: { getItem: () => null },
      sessionStorage: createStorage(),
      performance: { now: () => 10 },
      Date: { now: () => Date.parse('2026-06-14T00:00:00.000Z') },
    },
    maxEntries: 10,
    persistLimit: 0,
  });

  logger.record('input:tap', { point: { x: 1, y: 2 } });
  logger.record('action:begin', { action: { type: 'openWorldSite', siteId: 'capital' } });
  logger.setUploader(async (snapshot) => {
    uploaded.push(snapshot);
    return { success: true, logId: 7 };
  });

  const result = await logger.upload({ reason: 'city-click-repro', limit: 5 });

  assert.equal(result.success, true);
  assert.equal(result.logId, 7);
  assert.equal(uploaded.length, 1);
  assert.equal(uploaded[0].schema, 'client-operation-log-v1');
  assert.equal(uploaded[0].reason, 'city-click-repro');
  assert.equal(uploaded[0].entryCount, 2);
  assert.deepEqual(uploaded[0].entries.map((entry) => entry.type), ['input:tap', 'action:begin']);
});

test('ClientOperationLog keeps a bounded local window and samples noisy events', () => {
  let now = 0;
  const logger = new ClientOperationLog({
    runtime: {
      location: { search: '' },
      localStorage: { getItem: () => null },
      sessionStorage: createStorage(),
      performance: { now: () => now },
      Date: { now: () => Date.parse('2026-06-14T00:00:00.000Z') + now },
    },
    maxEntries: 2,
    persistLimit: 0,
  });

  assert.equal(logger.recordSampled('input:dragMove', 'pointer-1', { x: 1 }, 100)?.type, 'input:dragMove');
  now = 50;
  assert.equal(logger.recordSampled('input:dragMove', 'pointer-1', { x: 2 }, 100), null);
  now = 120;
  assert.equal(logger.recordSampled('input:dragMove', 'pointer-1', { x: 3 }, 100)?.detail.x, 3);
  logger.record('action:end', { result: true });

  assert.deepEqual(logger.getEntries().map((entry) => entry.type), ['input:dragMove', 'action:end']);
});
