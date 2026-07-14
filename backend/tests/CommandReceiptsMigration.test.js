'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');

const GameStateRepository = require('../repositories/GameStateRepository');
const {
  COMMAND_RECEIPTS_MIGRATION,
} = require('../migrations/commandReceiptsMigration');
const { normalizeMigration } = require('../services/SchemaMigrationService');

function getUniqueColumnSets(db) {
  return db.prepare('PRAGMA index_list(command_receipts)').all()
    .filter((index) => index.unique === 1)
    .map((index) => db.prepare(`PRAGMA index_info(${JSON.stringify(index.name)})`).all()
      .map((column) => column.name))
    .sort((left, right) => left.join(',').localeCompare(right.join(',')));
}

test('008 command receipts migration is immutable and converges in an isolated database', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wxgame-m1-command-receipts-'));
  const databasePath = path.join(directory, 'migration.sqlite');
  const db = new Database(databasePath);

  try {
    const normalizedMigration = normalizeMigration(COMMAND_RECEIPTS_MIGRATION);
    assert.equal(normalizedMigration.id, '008-create-command-receipts');
    assert.equal(normalizedMigration.checksum, 'd4c7e74e15b68c65');

    const repository = new GameStateRepository(db);
    repository.init();
    repository.init();

    assert.deepEqual(
      db.prepare('SELECT checksum, status FROM schema_migrations WHERE id = ?')
        .get(COMMAND_RECEIPTS_MIGRATION.id),
      { checksum: 'd4c7e74e15b68c65', status: 'applied' },
    );

    const columns = db.prepare('PRAGMA table_info(command_receipts)').all();
    assert.deepEqual(columns.map((column) => column.name), [
      'command_id',
      'payload_hash',
      'session_id',
      'client_seq',
      'status',
      'result_json',
      'plan_attempt',
      'admission_credential_version',
      'admission_session_epoch',
      'admission_authz_epoch',
      'created_at',
      'updated_at',
    ]);
    assert.equal(columns.find((column) => column.name === 'command_id').pk, 1);
    assert.equal(columns.find((column) => column.name === 'result_json').notnull, 0);
    assert.equal(columns.find((column) => column.name === 'plan_attempt').dflt_value, '0');
    for (const name of [
      'admission_credential_version',
      'admission_session_epoch',
      'admission_authz_epoch',
    ]) {
      assert.equal(columns.find((column) => column.name === name).notnull, 1);
    }
    assert.deepEqual(getUniqueColumnSets(db), [
      ['command_id'],
      ['session_id', 'client_seq'],
    ]);

    const insert = db.prepare(`
      INSERT INTO command_receipts (
        command_id, payload_hash, session_id, client_seq, status,
        admission_credential_version, admission_session_epoch, admission_authz_epoch,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const createdAt = '2026-07-15T00:00:00.000Z';
    insert.run('cmd-1', 'a'.repeat(64), 'session-1', 1, 'accepted', 3, 5, 7, createdAt, createdAt);
    assert.equal(
      db.prepare('SELECT plan_attempt FROM command_receipts WHERE command_id = ?').get('cmd-1').plan_attempt,
      0,
    );
    assert.throws(
      () => insert.run('cmd-2', 'a'.repeat(64), 'session-1', 1, 'accepted', 3, 5, 7, createdAt, createdAt),
      /UNIQUE constraint failed/,
    );
    assert.throws(
      () => insert.run('cmd-1', 'a'.repeat(64), 'session-2', 2, 'accepted', 3, 5, 7, createdAt, createdAt),
      /UNIQUE constraint failed/,
    );
  } finally {
    db.close();
    fs.rmSync(directory, { force: true, recursive: true });
  }
});
