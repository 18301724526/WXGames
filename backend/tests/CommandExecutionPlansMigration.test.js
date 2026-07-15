'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');

const GameStateRepository = require('../repositories/GameStateRepository');
const {
  COMMAND_EXECUTION_PLANS_MIGRATION,
} = require('../migrations/commandExecutionPlansMigration');
const { normalizeMigration } = require('../services/SchemaMigrationService');

test('009 command execution plans migration is immutable and converges in an isolated database', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wxgame-m1-command-plans-'));
  const databasePath = path.join(directory, 'migration.sqlite');
  const db = new Database(databasePath);

  try {
    const normalizedMigration = normalizeMigration(COMMAND_EXECUTION_PLANS_MIGRATION);
    assert.equal(normalizedMigration.id, '009-create-command-execution-plans');
    assert.equal(normalizedMigration.checksum, '2a3bf6c22683ea24');

    const repository = new GameStateRepository(db);
    repository.init();
    repository.init();

    assert.deepEqual(
      db.prepare('SELECT checksum, status FROM schema_migrations WHERE id = ?')
        .get(COMMAND_EXECUTION_PLANS_MIGRATION.id),
      { checksum: '2a3bf6c22683ea24', status: 'applied' },
    );

    const columns = db.prepare('PRAGMA table_info(command_execution_plans)').all();
    assert.deepEqual(columns.map((column) => column.name), [
      'command_id',
      'plan_attempt',
      'owner_set_json',
      'owner_set_hash',
      'expected_version_source',
      'superseded_by',
      'created_at',
    ]);
    assert.equal(columns.find((column) => column.name === 'superseded_by').notnull, 0);
    for (const name of [
      'command_id',
      'plan_attempt',
      'owner_set_json',
      'owner_set_hash',
      'expected_version_source',
      'created_at',
    ]) {
      assert.equal(columns.find((column) => column.name === name).notnull, 1);
    }

    const uniqueIndexes = db.prepare('PRAGMA index_list(command_execution_plans)').all()
      .filter((index) => index.unique === 1)
      .map((index) => db.prepare(`PRAGMA index_info(${JSON.stringify(index.name)})`).all()
        .map((column) => column.name));
    assert.deepEqual(uniqueIndexes, [['command_id', 'plan_attempt']]);

    const insert = db.prepare(`
      INSERT INTO command_execution_plans (
        command_id, plan_attempt, owner_set_json, owner_set_hash,
        expected_version_source, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    const createdAt = '2026-07-15T00:00:00.000Z';
    insert.run('cmd-1', 0, '["player:1"]', 'owner-hash-1', 'admission', createdAt);
    insert.run('cmd-1', 1, '["player:1"]', 'owner-hash-1', 'replan', createdAt);
    assert.throws(
      () => insert.run('cmd-1', 1, '["player:2"]', 'owner-hash-2', 'replan', createdAt),
      /UNIQUE constraint failed/,
    );
  } finally {
    db.close();
    fs.rmSync(directory, { force: true, recursive: true });
  }
});
