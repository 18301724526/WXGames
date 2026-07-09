'use strict';

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
  while (Date.now() < until) { /* synchronous SQLite fallback */ }
}

function normalizeOwnerKeys(ownerKeys) {
  if (!Array.isArray(ownerKeys) || ownerKeys.length === 0) {
    const error = new Error('Owner locks require at least one owner key');
    error.code = 'OWNER_KEYS_REQUIRED';
    throw error;
  }
  const normalized = ownerKeys.map((value) => String(value ?? '').trim());
  if (normalized.some((value) => !value)) {
    const error = new Error('Owner lock key must not be empty');
    error.code = 'OWNER_KEY_REQUIRED';
    throw error;
  }
  const invalid = normalized.find((value) => (
    value.length > 240 || !/^[a-z][a-z0-9._-]*:[^\s:][^\s]*$/.test(value)
  ));
  if (invalid) {
    const error = new Error(`Invalid owner lock key: ${invalid}`);
    error.code = 'OWNER_KEY_INVALID';
    error.ownerKey = invalid;
    throw error;
  }
  return Array.from(new Set(normalized)).sort();
}

class OwnerLockRepository {
  constructor(db, options = {}) {
    if (!db) throw new Error('OwnerLockRepository requires db');
    this.db = db;
    this.instanceId = options.instanceId || `${process.pid || 'pid'}-${crypto.randomUUID()}`;
    this.now = options.now || (() => Date.now());
    this.sleep = options.sleep || sleepSync;
    this.localLocks = new Map();
  }

  _createHolderId() {
    return `${this.instanceId}:${crypto.randomUUID()}`;
  }

  _createTimeoutError(ownerKey, holder = null, acquiredOwnerKeys = []) {
    const error = new Error(`Owner lock is already held for ${ownerKey}`);
    error.code = 'OWNER_LOCK_TIMEOUT';
    error.ownerKey = ownerKey;
    error.lockHolder = holder || null;
    error.acquiredOwnerKeys = [...acquiredOwnerKeys];
    return error;
  }

  _tryAcquire(ownerKey, scope, options = {}) {
    const ttlMs = positiveInteger(options.ttlMs, DEFAULT_LOCK_TTL_MS, 5 * 60 * 1000);
    const nowMs = Number(this.now());
    const lockedAt = isoFromMs(nowMs);
    const expiresAt = isoFromMs(nowMs + ttlMs);
    const holderId = this._createHolderId();
    const result = this.db.prepare(`
      INSERT INTO owner_locks (ownerKey, holderId, scope, lockedAt, expiresAt)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(ownerKey) DO UPDATE SET
        holderId = excluded.holderId,
        scope = excluded.scope,
        lockedAt = excluded.lockedAt,
        expiresAt = excluded.expiresAt
      WHERE owner_locks.expiresAt <= ?
    `).run(ownerKey, holderId, scope, lockedAt, expiresAt, lockedAt);
    if (result.changes > 0) {
      return {
        acquired: true,
        ownerKey,
        holderId,
        scope,
        lockedAt,
        expiresAt,
      };
    }
    const holder = this.db.prepare(`
      SELECT holderId, scope, lockedAt, expiresAt
      FROM owner_locks
      WHERE ownerKey = ?
    `).get(ownerKey);
    return { acquired: false, ownerKey, holderId, holder: holder || null };
  }

  _acquireOne(ownerKey, scope, options = {}, acquiredOwnerKeys = []) {
    const active = this.localLocks.get(ownerKey);
    if (active) {
      active.depth += 1;
      return { ...active.lock, reentrant: true };
    }

    const waitMs = Math.max(0, Math.floor(Number(options.waitMs ?? DEFAULT_WAIT_MS) || 0));
    const pollMs = positiveInteger(options.pollMs, DEFAULT_POLL_MS, 1000);
    const startedAt = Number(this.now());
    let lastAttempt = null;
    for (;;) {
      lastAttempt = this._tryAcquire(ownerKey, scope, options);
      if (lastAttempt.acquired) {
        this.localLocks.set(ownerKey, { lock: lastAttempt, depth: 1 });
        return lastAttempt;
      }
      const elapsed = Number(this.now()) - startedAt;
      if (elapsed >= waitMs) {
        throw this._createTimeoutError(ownerKey, lastAttempt.holder, acquiredOwnerKeys);
      }
      this.sleep(Math.min(pollMs, Math.max(0, waitMs - elapsed)));
    }
  }

  _releaseOne(lock) {
    if (!lock?.ownerKey || !lock.holderId) return;
    const active = this.localLocks.get(lock.ownerKey);
    if (active?.lock?.holderId === lock.holderId) {
      active.depth -= 1;
      if (active.depth > 0) return;
      this.localLocks.delete(lock.ownerKey);
    }
    this.db.prepare(`
      DELETE FROM owner_locks
      WHERE ownerKey = ? AND holderId = ?
    `).run(lock.ownerKey, lock.holderId);
  }

  withOwnerLocks(ownerKeys, scope, callback, options = {}) {
    if (typeof callback !== 'function') throw new Error('withOwnerLocks requires callback');
    const normalizedOwnerKeys = normalizeOwnerKeys(ownerKeys);
    const normalizedScope = String(scope || 'command').trim().slice(0, 120) || 'command';
    const waitMs = Math.max(0, Math.floor(Number(options.waitMs ?? DEFAULT_WAIT_MS) || 0));
    const deadlineMs = Number(this.now()) + waitMs;
    const acquired = [];
    const startedAt = Number(this.now());
    try {
      for (const ownerKey of normalizedOwnerKeys) {
        const remainingWaitMs = Math.max(0, deadlineMs - Number(this.now()));
        const lock = this._acquireOne(ownerKey, normalizedScope, {
          ...options,
          waitMs: remainingWaitMs,
        }, acquired.map((item) => item.ownerKey));
        acquired.push(lock);
      }
      const context = Object.freeze({
        schema: 'owner-lock-context-v1',
        ownerKeys: [...normalizedOwnerKeys],
        scope: normalizedScope,
        holderIds: acquired.map((lock) => lock.holderId),
        waitMs: Math.max(0, Number(this.now()) - startedAt),
      });
      const result = callback(context);
      if (result && typeof result.then === 'function') {
        const error = new Error('withOwnerLocks callback must be synchronous');
        error.code = 'OWNER_LOCK_ASYNC_CALLBACK_UNSUPPORTED';
        throw error;
      }
      return result;
    } catch (error) {
      if (error?.code === 'OWNER_LOCK_TIMEOUT'
          && Object.prototype.hasOwnProperty.call(options, 'timeoutResult')) {
        return typeof options.timeoutResult === 'function'
          ? options.timeoutResult(error)
          : options.timeoutResult;
      }
      throw error;
    } finally {
      for (let index = acquired.length - 1; index >= 0; index -= 1) {
        this._releaseOne(acquired[index]);
      }
    }
  }
}

module.exports = {
  DEFAULT_LOCK_TTL_MS,
  DEFAULT_POLL_MS,
  DEFAULT_WAIT_MS,
  OwnerLockRepository,
  normalizeOwnerKeys,
};
