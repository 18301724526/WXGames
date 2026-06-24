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

    const locked = new SchemaMigrationService(db, [
      {
        id: '002-locked',
        statements: ['CREATE TABLE locked_table (id TEXT PRIMARY KEY)'],
      },
    ]);
    locked.initTables();
    db.prepare('INSERT INTO schema_migration_locks (id, lockedAt) VALUES (?, ?)').run(
      'schema-migration',
      '2026-06-24T00:00:00.000Z',
    );
    assert.throws(
      () => locked.migrate(),
      (error) => error.code === 'SCHEMA_MIGRATION_LOCKED',
    );
  } finally {
    db.close();
  }
});
