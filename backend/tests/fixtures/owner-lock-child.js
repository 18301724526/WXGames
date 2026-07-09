'use strict';

const Database = require('better-sqlite3');

const { openDatabase } = require('../../services/DatabaseRuntime');
const GameStateRepository = require('../../repositories/GameStateRepository');

function sleepSync(ms) {
  const duration = Math.max(0, Math.floor(Number(ms) || 0));
  if (!duration) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, duration);
}

const [dbPath, rawOwnerKeys, rawHoldMs, label = 'child'] = process.argv.slice(2);
const ownerKeys = JSON.parse(rawOwnerKeys || '[]');
const holdMs = Number(rawHoldMs) || 0;
const { db } = openDatabase(Database, dbPath);

try {
  const repository = new GameStateRepository(db);
  repository.init();
  repository.withOwnerLocks(ownerKeys, `owner-lock-test:${label}`, () => {
    process.stdout.write(`acquired:${label}\n`);
    sleepSync(holdMs);
  }, {
    waitMs: 5000,
    ttlMs: 10000,
    pollMs: 10,
  });
} finally {
  db.close();
}
