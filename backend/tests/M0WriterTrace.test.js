'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const { runWithOwnerContext } = require('../application/commands/CommandOwnerContext');
const { openDatabase } = require('../services/DatabaseRuntime');
const {
  TRACE_SCHEMA,
  parseWriteStatement,
} = require('../services/WriterTraceProbe');
const {
  buildRuntimeHitSet,
  buildTriDiff,
  validateHitSet,
} = require('../../scripts/m0-writer-inventory/runtime-report');
const {
  runPlaytest,
} = require('../../scripts/m0-writer-inventory/run-playtest-with-watchdog');

test('WriterTraceProbe recognizes write statements without retaining SQL text', () => {
  assert.deepEqual(parseWriteStatement('INSERT OR REPLACE INTO "players" (id) VALUES (1)'), {
    operation: 'insert',
    table: 'players',
  });
  assert.deepEqual(parseWriteStatement('UPDATE [game_states] SET revision = 2'), {
    operation: 'update',
    table: 'game_states',
  });
  assert.deepEqual(parseWriteStatement('DELETE FROM api_logs WHERE id = 1'), {
    operation: 'delete',
    table: 'api_logs',
  });
  assert.deepEqual(parseWriteStatement('CREATE TABLE IF NOT EXISTS migrations (id TEXT)'), {
    operation: 'create',
    table: 'migrations',
  });
  assert.equal(parseWriteStatement('SELECT * FROM players'), null);
  assert.equal(parseWriteStatement('PRAGMA journal_mode = WAL'), null);
});

test('DatabaseRuntime writer trace records category, table, and command type only when enabled', (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'm0-writer-trace-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  const traceFile = path.join(tempRoot, 'trace.ndjson');
  const { db } = openDatabase(Database, ':memory:', {
    env: {
      M0_WRITER_TRACE: '1',
      M0_WRITER_TRACE_FILE: traceFile,
      SQLITE_JOURNAL_MODE: 'OFF',
      SQLITE_SYNCHRONOUS: 'OFF',
    },
  });
  try {
    db.exec('CREATE TABLE trace_items (id TEXT PRIMARY KEY, secret TEXT)');
    runWithOwnerContext({
      ownerKey: 'player:p1',
      ownerKeys: ['player:p1'],
      scope: 'm0-writer-trace-test',
      commandId: 'trace-command-1',
      commandType: 'build',
    }, () => {
      db.prepare('INSERT INTO trace_items (id, secret) VALUES (?, ?)').run('row-1', 'do-not-log');
    });
  } finally {
    db.close();
  }

  const records = fs.readFileSync(traceFile, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const insert = records.find((record) => record.operation === 'insert');
  assert.equal(insert.schema, TRACE_SCHEMA);
  assert.equal(insert.category, 'command');
  assert.equal(insert.table, 'trace_items');
  assert.equal(insert.commandType, 'build');
  assert.equal(Object.hasOwn(insert, 'sql'), false);
  assert.equal(JSON.stringify(insert).includes('do-not-log'), false);
  assert.equal(insert.stack.some((frame) => frame.file === 'backend/tests/M0WriterTrace.test.js'), true);
});

test('runtime writer hit set maps command and route evidence into both static sets', () => {
  const hitSet = buildRuntimeHitSet([{
    schema: TRACE_SCHEMA,
    category: 'command',
    table: 'game_states',
    commandType: 'build',
    operation: 'update',
    databasePath: '/tmp/civilization.db',
    stack: [{
      file: 'backend/routes/gameRoutes.js',
      line: 250,
      column: 1,
      function: 'route handler',
    }],
  }]);

  assert.deepEqual(hitSet.runtimeWriters.map((entry) => entry.id), [
    'command:build',
    'route:POST /api/game/action',
  ]);
  assert.equal(hitSet.summary.unknownWriterCount, 0);
  const triDiff = buildTriDiff(hitSet);
  assert.deepEqual(triDiff.differences.runtimeMinusStatic, []);
  assert.deepEqual(triDiff.differences.runtimeMinusDeclared, []);
  assert.deepEqual(validateHitSet(hitSet, triDiff), []);
});

test('runtime writer hit set maps the asynchronous API log writer through server middleware', () => {
  const hitSet = buildRuntimeHitSet([{
    schema: TRACE_SCHEMA,
    category: 'unknown',
    table: 'api_logs',
    commandType: '',
    operation: 'insert',
    databasePath: '/tmp/observability.db',
    stack: [{
      file: 'backend/services/logService.js',
      line: 70,
      column: 1,
      function: 'LogService.logApi',
    }, {
      file: 'backend/server.js',
      line: 133,
      column: 1,
      function: 'ServerResponse.<anonymous>',
    }],
  }]);

  assert.deepEqual(hitSet.runtimeWriters.map((entry) => entry.id), [
    'route:middleware:api-log',
  ]);
  assert.equal(hitSet.summary.unknownWriterCount, 0);
  assert.deepEqual(validateHitSet(hitSet), []);
});

test('runtime writer hit set requires explicit ownership for an unknown writer', () => {
  const hitSet = buildRuntimeHitSet([{
    schema: TRACE_SCHEMA,
    category: 'unknown',
    table: 'mystery_rows',
    commandType: '',
    operation: 'insert',
    databasePath: '/tmp/civilization.db',
    stack: [{
      file: 'backend/services/UnknownWriter.js',
      line: 12,
      column: 1,
      function: 'write',
    }],
  }]);

  assert.equal(hitSet.summary.unknownWriterCount, 1);
  assert.match(validateHitSet(hitSet)[0], /unknown writer lacks owner task/);
});

test('stall watchdog waits for the child natural exit and keeps its exit code', async () => {
  const result = await runPlaytest({
    command: process.execPath,
    args: ['-e', 'process.stdout.write("watchdog-child-ok\\n")'],
    cwd: path.resolve(__dirname, '..', '..'),
    env: {
      ...process.env,
      M0_PLAYTEST_STALL_MS: '1000',
      M0_PLAYTEST_WALL_MS: '2000',
    },
  });

  assert.equal(result.code, 0);
  assert.equal(result.signal, '');
  assert.equal(result.stopReason, '');
});
