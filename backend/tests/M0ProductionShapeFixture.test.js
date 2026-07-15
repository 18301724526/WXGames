'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');

const {
  assertSanitizedFixture,
  checksumDatabase,
  checksumFixture,
  exportProductionShape,
  materializeFixture,
} = require('../../scripts/m0-fixture/export-production-shape');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

function createSourceDatabase(dbPath) {
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE players (
      playerId TEXT PRIMARY KEY,
      deviceId TEXT UNIQUE,
      token TEXT,
      createdAt TEXT,
      lastActiveAt TEXT
    );
    CREATE TABLE audit_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ownerPlayerId TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL,
      updatedAt TEXT
    );
    CREATE INDEX idx_audit_records_owner ON audit_records(ownerPlayerId);
    CREATE TABLE numeric_keys (
      id INTEGER PRIMARY KEY,
      label TEXT NOT NULL,
      updatedAt TEXT
    );
    CREATE TABLE codex_db_write_probe (id TEXT PRIMARY KEY, at TEXT);
  `);
  db.prepare(`
    INSERT INTO players (playerId, deviceId, token, createdAt, lastActiveAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    'real-user-002',
    'device-real-002',
    'eyJabcdefgh.ijklmnop.qrstuvwx',
    '2026-07-15T01:00:00.000Z',
    '2026-07-15T02:00:00.000Z',
  );
  db.prepare(`
    INSERT INTO players (playerId, deviceId, token, createdAt, lastActiveAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    'real-user-001',
    'device-real-001',
    'opaque-production-token-value',
    '2026-07-15T01:00:00.000Z',
    '2026-07-15T02:00:00.000Z',
  );
  db.prepare(`
    INSERT INTO audit_records (ownerPlayerId, payload, status, updatedAt)
    VALUES (?, ?, ?, ?)
  `).run(
    'real-user-001',
    JSON.stringify({
      username: 'alice_operator',
      email: 'alice@example.com',
      authorization: 'Bearer super-secret-token-value',
      callback: 'https://example.test/callback?token=callback-secret-value',
      message: 'alice_operator changed the account',
      nested: { updatedAt: '2026-07-15T03:00:00.000Z' },
    }),
    'accepted',
    '2026-07-15T03:00:00.000Z',
  );
  db.prepare('INSERT INTO codex_db_write_probe (id, at) VALUES (?, ?)')
    .run('probe-only', '2026-07-15T00:00:00.000Z');
  db.prepare('INSERT INTO numeric_keys (id, label, updatedAt) VALUES (?, ?, ?)')
    .run(10, 'ten', '2026-07-15T00:00:00.000Z');
  db.prepare('INSERT INTO numeric_keys (id, label, updatedAt) VALUES (?, ?, ?)')
    .run(2, 'two', '2026-07-15T00:00:00.000Z');
  db.close();
}

test('production-shape export is deterministic, sanitized, and restores to the same checksum', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wxgame-m0-fixture-'));
  const sourceDbPath = path.join(tempRoot, 'source.db');
  const firstFixturePath = path.join(tempRoot, 'first.fixture.json');
  const secondFixturePath = path.join(tempRoot, 'second.fixture.json');
  const restoredDbPath = path.join(tempRoot, 'restored.db');
  try {
    createSourceDatabase(sourceDbPath);
    const first = exportProductionShape({
      Database,
      sourceDbPath,
      outputPath: firstFixturePath,
      metadataPath: path.join(tempRoot, 'first.metadata.json'),
      sourceLabel: 'unit-test',
    });
    const second = exportProductionShape({
      Database,
      sourceDbPath,
      outputPath: secondFixturePath,
      metadataPath: path.join(tempRoot, 'second.metadata.json'),
      sourceLabel: 'unit-test',
    });

    assert.deepEqual(fs.readFileSync(firstFixturePath), fs.readFileSync(secondFixturePath));
    assert.deepEqual(first.checksum, second.checksum);
    assert.deepEqual(first.fixture.tables.map((table) => table.name), [
      'audit_records',
      'numeric_keys',
      'players',
    ]);
    assert.deepEqual(
      first.fixture.tables.find((table) => table.name === 'numeric_keys').rows.map((row) => row.id),
      [2, 10],
    );
    assert.deepEqual(assertSanitizedFixture(first.fixture), {
      rawSensitiveValueLeaks: 0,
      emailPatternLeaks: 0,
      jwtPatternLeaks: 0,
      bearerPatternLeaks: 0,
      querySecretPatternLeaks: 0,
    });

    const fixtureText = fs.readFileSync(firstFixturePath, 'utf8');
    for (const rawValue of [
      'real-user-001',
      'device-real-001',
      'opaque-production-token-value',
      'alice_operator',
      'alice@example.com',
      'super-secret-token-value',
      'callback-secret-value',
    ]) {
      assert.equal(fixtureText.includes(rawValue), false, rawValue);
    }

    materializeFixture(first.fixture, restoredDbPath, { Database });
    const fixtureChecksum = checksumFixture(first.fixture);
    const restoredChecksum = checksumDatabase(restoredDbPath, { Database });
    assert.deepEqual(restoredChecksum, fixtureChecksum);

    const restoredDb = new Database(restoredDbPath);
    const payloadRow = restoredDb.prepare('SELECT id, payload FROM audit_records').get();
    const payload = JSON.parse(payloadRow.payload);
    payload.nested.updatedAt = '2099-01-01T00:00:00.000Z';
    restoredDb.prepare('UPDATE audit_records SET payload = ?, updatedAt = ? WHERE id = ?').run(
      JSON.stringify(payload),
      '2099-01-01T00:00:00.000Z',
      payloadRow.id,
    );
    restoredDb.prepare('UPDATE players SET createdAt = ?, lastActiveAt = ?').run(
      '2099-01-01T00:00:00.000Z',
      '2099-01-01T00:00:00.000Z',
    );
    restoredDb.close();
    assert.deepEqual(checksumDatabase(restoredDbPath, { Database }), fixtureChecksum);

    const changedDb = new Database(restoredDbPath);
    changedDb.prepare('UPDATE audit_records SET status = ?').run('rejected');
    changedDb.close();
    assert.notEqual(checksumDatabase(restoredDbPath, { Database }).checksum, fixtureChecksum.checksum);
  } finally {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
});

test('restore drill is pinned to local tmp/docs artifacts and reuses runtime backup entrypoints', () => {
  const scriptPath = path.join(PROJECT_ROOT, 'scripts', 'm0-fixture', 'run-restore-drill.sh');
  const script = fs.readFileSync(scriptPath, 'utf8');
  assert.match(script, /tmp\/m0-fixture/);
  assert.match(script, /docs\/architecture\/m0/);
  assert.match(script, /backup-runtime-state\.sh/);
  assert.match(script, /restore-runtime-state\.sh/);
  assert.match(script, /ALLOW_RESTORE_WITHOUT_PM2_STOP=1/);
  assert.match(script, /127\.0\.0\.1/);
});
