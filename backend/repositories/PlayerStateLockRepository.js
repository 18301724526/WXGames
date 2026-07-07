const crypto = require('node:crypto');

const DEFAULT_LOCK_TTL_MS = 30 * 1000;
const DEFAULT_WAIT_MS = 10 * 1000;
const DEFAULT_POLL_MS = 50;

function positiveInteger(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.min(number, max);
}

function isoFromMs(ms) {
  return new Date(ms).toISOString();
}

function sleepSync(ms) {
  const waitMs = Math.max(0, Math.floor(Number(ms) || 0));
  if (!waitMs) return;
  if (typeof Atomics !== 'undefined' && typeof SharedArrayBuffer !== 'undefined') {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, waitMs);
    return;
  }
  const until = Date.now() + waitMs;
  while (Date.now() < until) {}
}

class PlayerStateLockRepository {
  constructor(db, options = {}) {
    if (!db) throw new Error('PlayerStateLockRepository requires db');
    this.db = db;
    this.instanceId = options.instanceId || `${process.pid || 'pid'}-${crypto.randomUUID()}`;
    this.localLocks = new Map();
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS player_state_locks (
        playerId TEXT PRIMARY KEY,
        ownerId TEXT NOT NULL,
        scope TEXT,
        lockedAt TEXT NOT NULL,
        expiresAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_player_state_locks_expires_at
        ON player_state_locks(expiresAt);
    `);
  }

  createOwnerId(playerId, scope) {
    return `${this.instanceId}:${playerId}:${scope || 'state-write'}:${crypto.randomUUID()}`;
  }

  createTimeoutError(playerId, holder = null) {
    const error = new Error(`Player state lock is already held for ${playerId}`);
    error.code = 'PLAYER_STATE_LOCK_TIMEOUT';
    error.playerId = playerId;
    error.lockHolder = holder || null;
    return error;
  }

  tryAcquire(playerId, options = {}) {
    const normalizedPlayerId = String(playerId || '').trim();
    if (!normalizedPlayerId) throw new Error('Player state lock requires playerId');
    const ttlMs = positiveInteger(options.ttlMs, DEFAULT_LOCK_TTL_MS, 5 * 60 * 1000);
    const scope = String(options.scope || 'state-write').slice(0, 80);
    const nowMs = Date.now();
    const lockedAt = isoFromMs(nowMs);
    const expiresAt = isoFromMs(nowMs + ttlMs);
    const ownerId = options.ownerId || this.createOwnerId(normalizedPlayerId, scope);
    const result = this.db.prepare(`
      INSERT INTO player_state_locks (playerId, ownerId, scope, lockedAt, expiresAt)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(playerId) DO UPDATE SET
        ownerId = excluded.ownerId,
        scope = excluded.scope,
        lockedAt = excluded.lockedAt,
        expiresAt = excluded.expiresAt
      WHERE player_state_locks.expiresAt <= ?
    `).run(normalizedPlayerId, ownerId, scope, lockedAt, expiresAt, lockedAt);
    if (result.changes > 0) {
      return {
        acquired: true,
        playerId: normalizedPlayerId,
        ownerId,
        scope,
        lockedAt,
        expiresAt,
      };
    }
    const holder = this.db.prepare(`
      SELECT ownerId, scope, lockedAt, expiresAt
      FROM player_state_locks
      WHERE playerId = ?
    `).get(normalizedPlayerId);
    return {
      acquired: false,
      playerId: normalizedPlayerId,
      ownerId,
      holder: holder || null,
    };
  }

  acquire(playerId, options = {}) {
    const normalizedPlayerId = String(playerId || '').trim();
    const active = this.localLocks.get(normalizedPlayerId);
    if (active) {
      active.depth += 1;
      return { ...active.lock, reentrant: true };
    }

    const waitMs = Math.max(0, Math.floor(Number(options.waitMs ?? DEFAULT_WAIT_MS) || 0));
    const pollMs = positiveInteger(options.pollMs, DEFAULT_POLL_MS, 1000);
    const startedAt = Date.now();
    let lastAttempt = null;
    for (;;) {
      lastAttempt = this.tryAcquire(normalizedPlayerId, options);
      if (lastAttempt.acquired) {
        this.localLocks.set(normalizedPlayerId, { lock: lastAttempt, depth: 1 });
        return lastAttempt;
      }
      if (Date.now() - startedAt >= waitMs) {
        throw this.createTimeoutError(normalizedPlayerId, lastAttempt.holder);
      }
      sleepSync(Math.min(pollMs, waitMs - (Date.now() - startedAt)));
    }
  }

  release(lock) {
    if (!lock?.playerId || !lock.ownerId) return;
    const active = this.localLocks.get(lock.playerId);
    if (active?.lock?.ownerId === lock.ownerId) {
      active.depth -= 1;
      if (active.depth > 0) return;
      this.localLocks.delete(lock.playerId);
    }
    if (lock.reentrant) return;
    this.db.prepare(`
      DELETE FROM player_state_locks
      WHERE playerId = ? AND ownerId = ?
    `).run(lock.playerId, lock.ownerId);
  }

  withLock(playerId, callback, options = {}) {
    try {
      const lock = this.acquire(playerId, options);
      try {
        return callback(lock);
      } finally {
        this.release(lock);
      }
    } catch (error) {
      if (error?.code === 'PLAYER_STATE_LOCK_TIMEOUT' && Object.prototype.hasOwnProperty.call(options, 'timeoutResult')) {
        return typeof options.timeoutResult === 'function'
          ? options.timeoutResult(error)
          : options.timeoutResult;
      }
      throw error;
    }
  }
}

module.exports = {
  DEFAULT_LOCK_TTL_MS,
  DEFAULT_WAIT_MS,
  DEFAULT_POLL_MS,
  PlayerStateLockRepository,
};
