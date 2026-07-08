const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const { SchemaMigrationService } = require('../services/SchemaMigrationService');

test('SchemaMigrationService records applied migrations and reports dry-run plans', () => {
  const db = new Database(':memory:');
  try {
    const service = new SchemaMigrationService(
      db,
      [
        {
          id: '001-create-unit-table',
          description: 'create unit table',
          statements: ['CREATE TABLE unit_schema_migration (id TEXT PRIMARY KEY)'],
        },
      ],
      {
        now: () => new Date('2026-06-24T00:00:00.000Z'),
      },
    );

    assert.deepEqual(
      service.migrate({ dryRun: true }).plan.map((item) => item.status),
      ['pending'],
    );
    const result = service.migrate();
    assert.deepEqual(result.applied, ['001-create-unit-table']);

    const rows = db.prepare('SELECT id, status, appliedAt FROM schema_migrations').all();
    assert.deepEqual(rows, [
      {
        id: '001-create-unit-table',
        status: 'applied',
        appliedAt: '2026-06-24T00:00:00.000Z',
      },
    ]);
    assert.deepEqual(service.migrate().applied, []);
    assert.equal(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'unit_schema_migration'",
        )
        .get().name,
      'unit_schema_migration',
    );
  } finally {
    db.close();
  }
});

test('SchemaMigrationService blocks checksum drift and concurrent migration locks', () => {
  const db = new Database(':memory:');
  try {
    const initial = new SchemaMigrationService(db, [
      {
        id: '001-create-unit-table',
        description: 'create unit table',
        statements: ['CREATE TABLE unit_schema_migration (id TEXT PRIMARY KEY)'],
      },
    ]);
    initial.migrate();

    const changed = new SchemaMigrationService(db, [
      {
        id: '001-create-unit-table',
        description: 'changed definition',
        statements: ['CREATE TABLE unit_schema_migration_changed (id TEXT PRIMARY KEY)'],
      },
    ]);
    assert.throws(
      () => changed.migrate(),
      (error) =>
        error.code === 'SCHEMA_MIGRATION_PLAN_BLOCKED' &&
        error.blockers[0].status === 'checksum-mismatch',
    );

    // A FRESH foreign lock makes the loser wait; with a tiny wait budget it times out
    // with SCHEMA_MIGRATION_LOCKED instead of crashing immediately (deploy-restart peers
    // normally finish within the wait window).
    const locked = new SchemaMigrationService(
      db,
      [
        {
          id: '002-locked',
          statements: ['CREATE TABLE locked_table (id TEXT PRIMARY KEY)'],
        },
      ],
      { lockWaitMs: 120, lockPollMs: 30 },
    );
    locked.initTables();
    db.prepare('INSERT INTO schema_migration_locks (id, lockedAt) VALUES (?, ?)').run(
      'schema-migration',
      new Date().toISOString(),
    );
    assert.throws(
      () => locked.migrate(),
      (error) => error.code === 'SCHEMA_MIGRATION_LOCKED',
    );
    db.prepare('DELETE FROM schema_migration_locks WHERE id = ?').run('schema-migration');

    // A STALE lock (crash leftover, older than staleLockMs) is reclaimed and migration
    // proceeds instead of wedging every future restart.
    const stale = new SchemaMigrationService(
      db,
      [
        {
          id: '003-stale-lock',
          statements: ['CREATE TABLE stale_lock_table (id TEXT PRIMARY KEY)'],
        },
      ],
      { lockWaitMs: 500, lockPollMs: 30, staleLockMs: 60000 },
    );
    db.prepare('INSERT INTO schema_migration_locks (id, lockedAt) VALUES (?, ?)').run(
      'schema-migration',
      new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    );
    const staleResult = stale.migrate();
    assert.deepEqual(staleResult.applied, ['003-stale-lock']);
    assert.equal(
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='stale_lock_table'")
        .get()?.name,
      'stale_lock_table',
    );
  } finally {
    db.close();
  }
});
