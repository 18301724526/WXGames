const crypto = require('node:crypto');

const MIGRATION_STATUS_APPLIED = 'applied';
const MIGRATION_LOCK_ID = 'schema-migration';

function nowIsoSafe(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
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
    this.lockWaitMs = Number(options.lockWaitMs ?? 60000);
    this.lockPollMs = Number(options.lockPollMs ?? 250);
    this.staleLockMs = Number(options.staleLockMs ?? 10 * 60 * 1000);
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

  tryAcquireLock() {
    const timestamp = nowIsoSafe(this.now());
    try {
      this.db
        .prepare('INSERT INTO schema_migration_locks (id, lockedAt) VALUES (?, ?)')
        .run(MIGRATION_LOCK_ID, timestamp);
      return { acquired: true, lockedAt: timestamp };
    } catch (error) {
      if (String(error.message || '').includes('UNIQUE constraint failed')) {
        const lock = this.db
          .prepare('SELECT lockedAt FROM schema_migration_locks WHERE id = ?')
          .get(MIGRATION_LOCK_ID);
        return { acquired: false, lockedAt: lock?.lockedAt || '' };
      }
      throw error;
    }
  }

  // server.js and world-worker.js start together after every deploy and both run
  // migrations. The loser must WAIT for the winner (who usually finishes in
  // milliseconds and leaves nothing pending), not crash the process — the old
  // throw-on-locked semantics caused a crash+pm2-restart on nearly every deploy.
  // A lock older than staleLockMs is a crash leftover and gets reclaimed.
  acquireLock(options = {}) {
    const waitMs = Number(options.waitMs ?? this.lockWaitMs ?? 60000);
    const pollMs = Math.max(25, Number(options.pollMs ?? this.lockPollMs ?? 250));
    const staleLockMs = Number(options.staleLockMs ?? this.staleLockMs ?? 10 * 60 * 1000);
    const startedAt = Date.now();
    for (;;) {
      const attempt = this.tryAcquireLock();
      if (attempt.acquired) return;
      const lockedAtMs = Date.parse(attempt.lockedAt || '');
      const nowMs = this.now() instanceof Date ? this.now().getTime() : Date.now();
      if (Number.isFinite(lockedAtMs) && nowMs - lockedAtMs > staleLockMs) {
        this.db
          .prepare('DELETE FROM schema_migration_locks WHERE id = ? AND lockedAt = ?')
          .run(MIGRATION_LOCK_ID, attempt.lockedAt);
        continue;
      }
      if (Date.now() - startedAt >= waitMs) {
        const conflict = new Error(
          `Schema migration lock is already held since ${attempt.lockedAt || 'unknown'}`,
        );
        conflict.code = 'SCHEMA_MIGRATION_LOCKED';
        throw conflict;
      }
      this.sleepSync(pollMs);
    }
  }

  sleepSync(ms) {
    if (typeof Atomics !== 'undefined' && typeof SharedArrayBuffer !== 'undefined') {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
      return;
    }
    const until = Date.now() + ms;
    while (Date.now() < until) {
      // busy-wait fallback; only reachable on runtimes without Atomics.wait
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
