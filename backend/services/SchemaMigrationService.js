const crypto = require('node:crypto');
const { nowIso } = require('../../shared/timeUtils');

const MIGRATION_STATUS_APPLIED = 'applied';
const MIGRATION_LOCK_ID = 'schema-migration';
// A migration here is a handful of near-instant ALTER TABLEs. If a lock row is
// older than this, the holder almost certainly crashed mid-migration, so the
// next startup is allowed to steal it instead of crash-looping forever.
const DEFAULT_LOCK_TTL_MS = 30_000;
// How long a loser of a genuine concurrent race waits for the live holder to
// finish before giving up. Kept below the TTL so a live holder is waited on,
// not stolen from.
const DEFAULT_LOCK_MAX_WAIT_MS = 15_000;
const DEFAULT_LOCK_RETRY_DELAY_MS = 200;

function nowIsoSafe(now = new Date()) {
  try {
    return nowIso(now);
  } catch (error) {
    return nowIso(new Date());
  }
}

function toEpochMs(value) {
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : Date.now();
}

// Synchronous sleep so the migration startup path (better-sqlite3 is fully
// synchronous) can wait for a concurrent holder without busy-spinning the CPU.
function sleepSync(ms) {
  const duration = Math.max(0, Math.floor(ms));
  if (duration === 0) return;
  const view = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(view, 0, 0, duration);
}

function checksumMigration(migration) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        id: migration.id,
        description: migration.description || '',
        statements: migration.statements || [],
      }),
    )
    .digest('hex')
    .slice(0, 16);
}

function normalizeMigration(migration) {
  if (!migration || typeof migration !== 'object') {
    throw new Error('Schema migration must be an object');
  }
  const id = String(migration.id || '').trim();
  if (!id) throw new Error('Schema migration id is required');
  const apply = typeof migration.apply === 'function' ? migration.apply : null;
  const statements = Array.isArray(migration.statements)
    ? migration.statements.map((statement) => String(statement || '').trim()).filter(Boolean)
    : [];
  if (!apply && statements.length === 0) {
    throw new Error(`Schema migration ${id} must define statements or apply()`);
  }
  return {
    id,
    description: String(migration.description || ''),
    statements,
    apply,
    checksum:
      migration.checksum ||
      checksumMigration({ id, description: migration.description, statements }),
  };
}

class SchemaMigrationService {
  constructor(db, migrations = [], options = {}) {
    if (!db) throw new Error('SchemaMigrationService requires db');
    this.db = db;
    this.migrations = migrations.map(normalizeMigration);
    this.now = options.now || (() => new Date());
    this.sleep = options.sleep || sleepSync;
    const legacyTtlMs = Number.isFinite(options.staleLockMs) ? options.staleLockMs : DEFAULT_LOCK_TTL_MS;
    const legacyWaitMs = Number.isFinite(options.lockWaitMs) ? options.lockWaitMs : DEFAULT_LOCK_MAX_WAIT_MS;
    const legacyRetryMs = Number.isFinite(options.lockPollMs) ? options.lockPollMs : DEFAULT_LOCK_RETRY_DELAY_MS;
    this.lockTtlMs = Number.isFinite(options.lockTtlMs) ? options.lockTtlMs : legacyTtlMs;
    this.lockMaxWaitMs = Number.isFinite(options.lockMaxWaitMs) ? options.lockMaxWaitMs : legacyWaitMs;
    this.lockRetryDelayMs = Number.isFinite(options.lockRetryDelayMs)
      ? options.lockRetryDelayMs
      : legacyRetryMs;
  }

  initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        appliedAt TEXT NOT NULL,
        durationMs INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS schema_migration_locks (
        id TEXT PRIMARY KEY,
        lockedAt TEXT NOT NULL
      );
    `);
  }

  getAppliedMigrations() {
    this.initTables();
    return new Map(
      this.db
        .prepare('SELECT id, checksum, status FROM schema_migrations')
        .all()
        .map((row) => [row.id, row]),
    );
  }

  plan() {
    const applied = this.getAppliedMigrations();
    return this.migrations.map((migration) => {
      const row = applied.get(migration.id);
      if (!row) {
        return {
          id: migration.id,
          checksum: migration.checksum,
          status: 'pending',
        };
      }
      if (row.checksum !== migration.checksum) {
        return {
          id: migration.id,
          checksum: migration.checksum,
          appliedChecksum: row.checksum,
          status: 'checksum-mismatch',
        };
      }
      if (row.status !== MIGRATION_STATUS_APPLIED) {
        return {
          id: migration.id,
          checksum: migration.checksum,
          appliedStatus: row.status,
          status: 'invalid-status',
        };
      }
      return {
        id: migration.id,
        checksum: migration.checksum,
        status: 'applied',
      };
    });
  }

  tryInsertLock() {
    try {
      this.db
        .prepare('INSERT INTO schema_migration_locks (id, lockedAt) VALUES (?, ?)')
        .run(MIGRATION_LOCK_ID, nowIsoSafe(this.now()));
      return true;
    } catch (error) {
      if (String(error.message || '').includes('UNIQUE constraint failed')) {
        return false;
      }
      throw error;
    }
  }

  // Compare-and-delete on the observed lockedAt so only one racer reclaims a
  // given stale row; the loser's delete affects 0 rows and it falls back to the
  // wait path against whoever won the steal.
  stealStaleLock(staleLockedAt) {
    this.db
      .prepare('DELETE FROM schema_migration_locks WHERE id = ? AND lockedAt = ?')
      .run(MIGRATION_LOCK_ID, staleLockedAt);
  }

  acquireLock() {
    const startedMs = toEpochMs(this.now());
    for (;;) {
      if (this.tryInsertLock()) return;

      const lock = this.db
        .prepare('SELECT lockedAt FROM schema_migration_locks WHERE id = ?')
        .get(MIGRATION_LOCK_ID);
      // Lock vanished between the failed insert and this read — retry immediately.
      if (!lock) continue;

      const ageMs = toEpochMs(this.now()) - toEpochMs(lock.lockedAt);
      if (ageMs >= this.lockTtlMs) {
        // Holder is presumed crashed; reclaim and retry the insert.
        this.stealStaleLock(lock.lockedAt);
        continue;
      }

      if (toEpochMs(this.now()) - startedMs >= this.lockMaxWaitMs) {
        const conflict = new Error(
          `Schema migration lock is already held since ${lock.lockedAt || 'unknown'}`,
        );
        conflict.code = 'SCHEMA_MIGRATION_LOCKED';
        throw conflict;
      }

      this.sleep(this.lockRetryDelayMs);
    }
  }

  releaseLock() {
    this.db.prepare('DELETE FROM schema_migration_locks WHERE id = ?').run(MIGRATION_LOCK_ID);
  }

  assertPlanCanApply(plan) {
    const blockers = plan.filter(
      (item) => item.status === 'checksum-mismatch' || item.status === 'invalid-status',
    );
    if (blockers.length === 0) return;
    const error = new Error(
      `Schema migration plan has blockers: ${blockers.map((item) => `${item.id}:${item.status}`).join(', ')}`,
    );
    error.code = 'SCHEMA_MIGRATION_PLAN_BLOCKED';
    error.blockers = blockers;
    throw error;
  }

  applyMigration(migration) {
    const startedAt = Date.now();
    const transaction = this.db.transaction(() => {
      if (migration.apply) {
        migration.apply(this.db);
      } else {
        for (const statement of migration.statements) {
          this.db.prepare(statement).run();
        }
      }
      this.db
        .prepare(
          `
        INSERT INTO schema_migrations (id, checksum, description, status, appliedAt, durationMs)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          migration.id,
          migration.checksum,
          migration.description,
          MIGRATION_STATUS_APPLIED,
          nowIsoSafe(this.now()),
          Date.now() - startedAt,
        );
    });
    transaction();
  }

  migrate(options = {}) {
    const dryRun = Boolean(options.dryRun);
    const plan = this.plan();
    this.assertPlanCanApply(plan);
    if (dryRun) {
      return {
        schema: 'schema-migration-plan-v1',
        dryRun: true,
        plan,
        applied: [],
      };
    }

    this.acquireLock();
    const applied = [];
    let lockedPlan;
    try {
      // Re-plan under the lock: while we waited, the peer process (server vs
      // world-worker after a deploy) may have applied everything already.
      lockedPlan = this.plan();
      this.assertPlanCanApply(lockedPlan);
      const pendingIds = new Set(
        lockedPlan.filter((item) => item.status === 'pending').map((item) => item.id),
      );
      for (const migration of this.migrations) {
        if (!pendingIds.has(migration.id)) continue;
        this.applyMigration(migration);
        applied.push(migration.id);
      }
    } finally {
      this.releaseLock();
    }

    return {
      schema: 'schema-migration-result-v1',
      dryRun: false,
      plan: lockedPlan,
      applied,
    };
  }
}

module.exports = {
  MIGRATION_LOCK_ID,
  MIGRATION_STATUS_APPLIED,
  SchemaMigrationService,
  checksumMigration,
  normalizeMigration,
};
