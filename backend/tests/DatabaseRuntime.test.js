const test = require('node:test');
const assert = require('node:assert/strict');

const {
  configureDatabase,
  openDatabase,
  resolveBusyTimeoutMs,
} = require('../services/DatabaseRuntime');

test('DatabaseRuntime configures WAL and busy timeout for multi-process soft services', () => {
  const pragmas = [];
  const result = configureDatabase({
    pragma(statement) {
      pragmas.push(statement);
    },
  }, {
    env: {
      SQLITE_BUSY_TIMEOUT_MS: '15000',
    },
  });

  assert.deepEqual(pragmas, [
    'journal_mode = WAL',
    'synchronous = NORMAL',
    'busy_timeout = 15000',
  ]);
  assert.deepEqual(result, {
    schema: 'sqlite-runtime-config-v1',
    journalMode: 'WAL',
    synchronous: 'NORMAL',
    busyTimeoutMs: 15000,
  });
});

test('DatabaseRuntime opens better-sqlite3 with the same timeout it applies by pragma', () => {
  const calls = [];
  function FakeDatabase(dbPath, options) {
    calls.push(['constructor', dbPath, options]);
    this.pragma = (statement) => calls.push(['pragma', statement]);
  }

  const { db, runtimeConfig } = openDatabase(FakeDatabase, '/tmp/wxgame.db', {
    env: {
      SQLITE_BUSY_TIMEOUT_MS: '25000',
    },
  });

  assert.ok(db instanceof FakeDatabase);
  assert.equal(runtimeConfig.busyTimeoutMs, 25000);
  assert.deepEqual(calls[0], ['constructor', '/tmp/wxgame.db', { timeout: 25000 }]);
  assert.deepEqual(calls.slice(1).map((call) => call[1]), [
    'journal_mode = WAL',
    'synchronous = NORMAL',
    'busy_timeout = 25000',
  ]);
});

test('DatabaseRuntime clamps invalid busy timeout values to production-safe bounds', () => {
  assert.equal(resolveBusyTimeoutMs({ SQLITE_BUSY_TIMEOUT_MS: 'bad' }), 10000);
  assert.equal(resolveBusyTimeoutMs({ SQLITE_BUSY_TIMEOUT_MS: '10' }), 1000);
  assert.equal(resolveBusyTimeoutMs({ SQLITE_BUSY_TIMEOUT_MS: '999999' }), 60000);
});
