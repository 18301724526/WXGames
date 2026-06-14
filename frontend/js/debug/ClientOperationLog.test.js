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

test('ClientOperationLog collapses promise-like values before persistence and export', () => {
  const storage = createStorage();
  const logger = new ClientOperationLog({
    runtime: {
      location: { search: '' },
      localStorage: { getItem: () => null },
      sessionStorage: storage,
      performance: { now: () => 10 },
      Date: { now: () => Date.parse('2026-06-14T00:00:00.000Z') },
    },
    storage,
    maxEntries: 10,
    persistLimit: 10,
    flushIntervalMs: 0,
  });
  const thenable = {
    then() {},
    runtime: { rendererPayload: 'must-not-leak' },
    nativeEvent: { type: 'pointerup' },
  };

  const entry = logger.record('input:tapAction', {
    handled: thenable,
    nested: { runtimeHandled: thenable },
  }, { flush: true });

  assert.equal(entry.detail.handled, 'promise');
  assert.equal(entry.detail.nested.runtimeHandled, 'promise');
  const persistedText = storage.dump().clientOperationLog;
  assert.equal(persistedText.includes('must-not-leak'), false);
  assert.equal(persistedText.includes('nativeEvent'), false);
  const exportedText = logger.exportText();
  assert.equal(exportedText.includes('must-not-leak'), false);
  assert.equal(exportedText.includes('nativeEvent'), false);
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

test('ClientOperationLog downloads a local JSON file without network transport', () => {
  const storage = createStorage();
  const calls = [];
  const clicked = [];
  const urls = [];
  const logger = new ClientOperationLog({
    runtime: {
      location: { pathname: '/wxgame/', hash: '' },
      localStorage: { getItem: () => 'test1' },
      sessionStorage: storage,
      navigator: { userAgent: 'node-test-agent' },
      performance: { now: () => 10 },
      Date: { now: () => Date.parse('2026-06-14T00:00:00.000Z') },
      Blob: class {
        constructor(parts, options) {
          calls.push(['blob', parts.join(''), options.type]);
        }
      },
      URL: {
        createObjectURL() {
          urls.push('blob:oplog');
          return 'blob:oplog';
        },
        revokeObjectURL(url) {
          calls.push(['revoke', url]);
        },
      },
      document: {
        body: {
          appendChild(link) {
            calls.push(['append', link.download]);
          },
        },
        createElement(tag) {
          assert.equal(tag, 'a');
          return {
            set href(value) { this._href = value; },
            get href() { return this._href; },
            set download(value) { this._download = value; },
            get download() { return this._download; },
            click() { clicked.push([this.href, this.download]); },
            remove() { calls.push(['remove']); },
          };
        },
      },
      setTimeout(callback) {
        callback();
      },
      fetch() {
        calls.push(['fetch']);
      },
    },
    storage,
    maxEntries: 10,
    persistLimit: 0,
  });

  logger.record('input:tap', { point: { x: 1, y: 2 } });
  const result = logger.download({ reason: 'settings-download' });

  assert.equal(result.success, true);
  assert.equal(result.fileName, 'wxgame-oplog-test1-20260614-000000Z.json');
  assert.equal(result.entryCount, 1);
  assert.deepEqual(clicked, [['blob:oplog', 'wxgame-oplog-test1-20260614-000000Z.json']]);
  assert.equal(calls.some((call) => call[0] === 'fetch'), false);
  const blobCall = calls.find((call) => call[0] === 'blob');
  const payload = JSON.parse(blobCall[1]);
  assert.equal(payload.reason, 'settings-download');
  assert.equal(payload.entries[0].type, 'input:tap');
});

test('ClientOperationLog starts a fresh run and does not export persisted entries from older runs', () => {
  const storage = createStorage();
  storage.setItem('clientOperationLog', JSON.stringify({
    schema: 'client-operation-log-v1',
    runId: 'old-run',
    savedAt: '2026-06-13T00:00:00.000Z',
    entries: [
      { seq: 10, runId: 'old-run', type: 'api:request', detail: { path: '/old' } },
      { seq: 11, type: 'api:response', detail: { path: '/legacy-without-run' } },
    ],
  }));

  const logger = new ClientOperationLog({
    runtime: {
      location: { pathname: '/wxgame/', hash: '' },
      localStorage: { getItem: () => null },
      sessionStorage: storage,
      performance: { now: () => 20 },
      Date: { now: () => Date.parse('2026-06-14T00:00:00.000Z') },
    },
    storage,
    maxEntries: 10,
    persistLimit: 10,
    flushIntervalMs: 0,
    runId: 'new-run',
  });

  assert.deepEqual(logger.getEntries(), []);
  logger.record('input:tap', { point: { x: 1, y: 2 } });

  const snapshot = logger.buildSnapshot({ reason: 'settings-download' });
  assert.equal(snapshot.runId, 'new-run');
  assert.deepEqual(snapshot.entries.map((entry) => entry.type), ['input:tap']);
  assert.equal(snapshot.entries[0].runId, 'new-run');
  const persisted = JSON.parse(storage.dump().clientOperationLog);
  assert.equal(persisted.runId, 'new-run');
  assert.deepEqual(persisted.entries.map((entry) => entry.type), ['input:tap']);
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
