'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const test = require('node:test');
const Database = require('better-sqlite3');

const { openDatabase } = require('../services/DatabaseRuntime');
const GameStateRepository = require('../repositories/GameStateRepository');
const { normalizeOwnerKeys } = require('../repositories/OwnerLockRepository');

const CHILD_PATH = path.join(__dirname, 'fixtures', 'owner-lock-child.js');

function createFileRepository() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wxgames-owner-lock-'));
  const dbPath = path.join(tempRoot, 'owner-lock.db');
  const { db } = openDatabase(Database, dbPath);
  const repository = new GameStateRepository(db);
  repository.init();
  return { tempRoot, dbPath, db, repository };
}

function spawnLockChild(dbPath, ownerKeys, holdMs, label) {
  const child = spawn(process.execPath, [
    CHILD_PATH,
    dbPath,
    JSON.stringify(ownerKeys),
    String(holdMs),
    label,
  ], {
    cwd: path.resolve(__dirname, '..', '..'),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.output = '';
  child.errors = '';
  child.stdout.on('data', (chunk) => { child.output += chunk; });
  child.stderr.on('data', (chunk) => { child.errors += chunk; });
  return child;
}

function waitForOutput(child, expected, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`child output timeout: ${child.errors}`)), timeoutMs);
    const inspect = () => {
      if (!child.output.includes(expected)) return;
      clearTimeout(timer);
      child.stdout.off('data', inspect);
      resolve();
    };
    child.stdout.on('data', inspect);
    inspect();
  });
}

function waitForExit(child, timeoutMs = 7000) {
  return new Promise((resolve, reject) => {
    if (child.exitCode !== null) {
      if (child.exitCode === 0) resolve(child);
      else reject(new Error(`child failed ${child.exitCode}: ${child.errors}`));
      return;
    }
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`child exit timeout: ${child.errors}`));
    }, timeoutMs);
    child.once('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(child);
      else reject(new Error(`child failed ${code}: ${child.errors}`));
    });
  });
}

test('OwnerLockRepository deduplicates and sorts owner keys with one canonical order', () => {
  assert.deepEqual(
    normalizeOwnerKeys(['player:z', 'encounter:A', 'player:z']),
    ['encounter:A', 'player:z'],
  );
  assert.throws(
    () => normalizeOwnerKeys(['player:a', '']),
    (error) => error.code === 'OWNER_KEY_REQUIRED',
  );
  assert.throws(
    () => normalizeOwnerKeys(['player:']),
    (error) => error.code === 'OWNER_KEY_INVALID',
  );
});

test('OwnerLockRepository releases partial acquisitions on timeout', () => {
  const db = new Database(':memory:');
  const first = new GameStateRepository(db);
  first.init();
  const second = new GameStateRepository(db);
  second.init();
  try {
    first.withOwnerLocks(['player:b'], 'held', () => {
      assert.throws(
        () => second.withOwnerLocks(['player:b', 'player:a'], 'contender', () => {}, { waitMs: 0 }),
        (error) => error.code === 'OWNER_LOCK_TIMEOUT'
          && error.ownerKey === 'player:b'
          && error.acquiredOwnerKeys.join(',') === 'player:a',
      );
      const rows = db.prepare('SELECT ownerKey FROM owner_locks ORDER BY ownerKey').all();
      assert.deepEqual(rows, [{ ownerKey: 'player:b' }]);
    }, { waitMs: 0 });
  } finally {
    db.close();
  }
});

test('OwnerLockRepository allows different keys while another owner is held', () => {
  const db = new Database(':memory:');
  const first = new GameStateRepository(db);
  first.init();
  const second = new GameStateRepository(db);
  second.init();
  try {
    first.withOwnerLocks(['player:a'], 'first', () => {
      const result = second.withOwnerLocks(['player:b'], 'second', () => 'parallel-key', { waitMs: 0 });
      assert.equal(result, 'parallel-key');
    }, { waitMs: 0 });
  } finally {
    db.close();
  }
});

test('OwnerLockRepository reclaims an expired crashed-holder lease', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();
  try {
    db.prepare(`
      INSERT INTO owner_locks (ownerKey, holderId, scope, lockedAt, expiresAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      'player:expired',
      'crashed-holder',
      'crashed',
      '2026-07-09T00:00:00.000Z',
      '2026-07-09T00:00:01.000Z',
    );
    const result = repository.withOwnerLocks(
      ['player:expired'],
      'reclaim',
      () => 'reclaimed',
      { waitMs: 0 },
    );
    assert.equal(result, 'reclaimed');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM owner_locks').get().count, 0);
  } finally {
    db.close();
  }
});

test('OwnerLockRepository serializes the same owner across real child processes', async (t) => {
  const fixture = createFileRepository();
  const child = spawnLockChild(fixture.dbPath, ['player:cross-process'], 350, 'holder');
  t.after(() => {
    if (child.exitCode === null) child.kill('SIGKILL');
    fixture.db.close();
    fs.rmSync(fixture.tempRoot, { recursive: true, force: true });
  });

  await waitForOutput(child, 'acquired:holder');
  const startedAt = Date.now();
  const result = fixture.repository.withOwnerLocks(
    ['player:cross-process'],
    'parent-contender',
    () => 'serialized-after-child',
    { waitMs: 3000, ttlMs: 10000, pollMs: 10 },
  );
  const elapsedMs = Date.now() - startedAt;
  await waitForExit(child);

  assert.equal(result, 'serialized-after-child');
  assert.ok(elapsedMs >= 150, `expected real contention wait, got ${elapsedMs}ms`);
});

test('OwnerLockRepository keeps different cross-process owner keys concurrent', async (t) => {
  const fixture = createFileRepository();
  const child = spawnLockChild(fixture.dbPath, ['player:held-a'], 350, 'different-key');
  t.after(() => {
    if (child.exitCode === null) child.kill('SIGKILL');
    fixture.db.close();
    fs.rmSync(fixture.tempRoot, { recursive: true, force: true });
  });

  await waitForOutput(child, 'acquired:different-key');
  const startedAt = Date.now();
  const result = fixture.repository.withOwnerLocks(
    ['player:free-b'],
    'parent-different-key',
    () => 'concurrent',
    { waitMs: 0 },
  );
  const elapsedMs = Date.now() - startedAt;
  await waitForExit(child);

  assert.equal(result, 'concurrent');
  assert.ok(elapsedMs < 150, `different key was unexpectedly serialized for ${elapsedMs}ms`);
});

test('OwnerLockRepository avoids deadlock for opposite dual-lock mention order', async (t) => {
  const fixture = createFileRepository();
  const first = spawnLockChild(
    fixture.dbPath,
    ['player:X', 'encounter:Y'],
    150,
    'order-a',
  );
  const second = spawnLockChild(
    fixture.dbPath,
    ['encounter:Y', 'player:X'],
    150,
    'order-b',
  );
  t.after(() => {
    if (first.exitCode === null) first.kill('SIGKILL');
    if (second.exitCode === null) second.kill('SIGKILL');
    fixture.db.close();
    fs.rmSync(fixture.tempRoot, { recursive: true, force: true });
  });

  await Promise.all([waitForExit(first), waitForExit(second)]);
  assert.match(first.output, /acquired:order-a/);
  assert.match(second.output, /acquired:order-b/);
});
