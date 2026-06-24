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

    const clock = fakeClock('2026-06-24T00:00:00.000Z');
    const locked = new SchemaMigrationService(
      db,
      [
        {
          id: '002-locked',
          statements: ['CREATE TABLE locked_table (id TEXT PRIMARY KEY)'],
        },
      ],
      {
        now: clock.now,
        sleep: clock.advance,
        lockTtlMs: 10_000,
        lockMaxWaitMs: 1_000,
        lockRetryDelayMs: 250,
      },
    );
    locked.initTables();
    // A fresh lock held by a live holder: the loser waits, never steals it, and
    // finally gives up once the wait budget is exhausted.
    db.prepare('INSERT INTO schema_migration_locks (id, lockedAt) VALUES (?, ?)').run(
      'schema-migration',
      '2026-06-24T00:00:00.000Z',
    );
    assert.throws(
      () => locked.migrate(),
      (error) => error.code === 'SCHEMA_MIGRATION_LOCKED',
    );
    assert.equal(
      db.prepare("SELECT name FROM sqlite_master WHERE name = 'locked_table'").get(),
      undefined,
    );
  } finally {
    db.close();
  }
});

function fakeClock(startIso) {
  let ms = new Date(startIso).getTime();
  return {
    now: () => new Date(ms),
    advance: (delta) => {
      ms += Math.max(0, Number(delta) || 0);
    },
  };
}

test('SchemaMigrationService steals a stale lock left by a crashed holder', () => {
  const db = new Database(':memory:');
  try {
    const clock = fakeClock('2026-06-24T00:00:02.000Z');
    const service = new SchemaMigrationService(
      db,
      [
        {
          id: '001-create-unit-table',
          statements: ['CREATE TABLE unit_schema_migration (id TEXT PRIMARY KEY)'],
        },
      ],
      { now: clock.now, lockTtlMs: 1_000 },
    );
    service.initTables();
    // A crashed holder left this lock 2s ago; with a 1s TTL it is reclaimable.
    db.prepare('INSERT INTO schema_migration_locks (id, lockedAt) VALUES (?, ?)').run(
      'schema-migration',
      '2026-06-24T00:00:00.000Z',
    );

    assert.deepEqual(service.migrate().applied, ['001-create-unit-table']);
    assert.equal(
      db
        .prepare("SELECT name FROM sqlite_master WHERE name = 'unit_schema_migration'")
        .get().name,
      'unit_schema_migration',
    );
    // The lock is released after a successful migration, not left dangling.
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM schema_migration_locks').get().n, 0);
  } finally {
    db.close();
  }
});

test('SchemaMigrationService waits for a live holder to release, then proceeds', () => {
  const db = new Database(':memory:');
  try {
    const clock = fakeClock('2026-06-24T00:00:00.000Z');
    let released = false;
    const service = new SchemaMigrationService(
      db,
      [
        {
          id: '001-create-unit-table',
          statements: ['CREATE TABLE unit_schema_migration (id TEXT PRIMARY KEY)'],
        },
      ],
      {
        now: clock.now,
        lockTtlMs: 10_000,
        lockMaxWaitMs: 5_000,
        lockRetryDelayMs: 100,
        // Simulate the winning process finishing while we wait: the first sleep
        // releases the held lock so the next insert attempt succeeds.
        sleep: (delta) => {
          clock.advance(delta);
          if (!released) {
            released = true;
            db.prepare('DELETE FROM schema_migration_locks WHERE id = ?').run('schema-migration');
          }
        },
      },
    );
    service.initTables();
    db.prepare('INSERT INTO schema_migration_locks (id, lockedAt) VALUES (?, ?)').run(
      'schema-migration',
      '2026-06-24T00:00:00.000Z',
    );

    assert.deepEqual(service.migrate().applied, ['001-create-unit-table']);
    assert.equal(released, true);
  } finally {
    db.close();
  }
});
