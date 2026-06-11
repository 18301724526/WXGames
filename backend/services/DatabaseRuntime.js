const DEFAULT_SQLITE_BUSY_TIMEOUT_MS = 10000;
const MIN_SQLITE_BUSY_TIMEOUT_MS = 1000;
const MAX_SQLITE_BUSY_TIMEOUT_MS = 60000;

function toPositiveInteger(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.min(number, max);
}

function resolveBusyTimeoutMs(env = process.env) {
  return Math.max(
    MIN_SQLITE_BUSY_TIMEOUT_MS,
    toPositiveInteger(
      env.SQLITE_BUSY_TIMEOUT_MS,
      DEFAULT_SQLITE_BUSY_TIMEOUT_MS,
      MAX_SQLITE_BUSY_TIMEOUT_MS,
    ),
  );
}

function configureDatabase(db, options = {}) {
  if (!db) throw new Error('configureDatabase requires db');
  const env = options.env || process.env;
  const busyTimeoutMs = resolveBusyTimeoutMs(env);
  const journalMode = String(env.SQLITE_JOURNAL_MODE || 'WAL').trim().toUpperCase();
  const synchronous = String(env.SQLITE_SYNCHRONOUS || 'NORMAL').trim().toUpperCase();

  if (typeof db.pragma === 'function') {
    if (journalMode && journalMode !== 'OFF') db.pragma(`journal_mode = ${journalMode}`);
    if (synchronous && synchronous !== 'OFF') db.pragma(`synchronous = ${synchronous}`);
    db.pragma(`busy_timeout = ${busyTimeoutMs}`);
  } else if (typeof db.exec === 'function') {
    const statements = [];
    if (journalMode && journalMode !== 'OFF') statements.push(`PRAGMA journal_mode = ${journalMode}`);
    if (synchronous && synchronous !== 'OFF') statements.push(`PRAGMA synchronous = ${synchronous}`);
    statements.push(`PRAGMA busy_timeout = ${busyTimeoutMs}`);
    db.exec(`${statements.join(';\n')};`);
  }

  return {
    schema: 'sqlite-runtime-config-v1',
    journalMode,
    synchronous,
    busyTimeoutMs,
  };
}

function openDatabase(Database, dbPath, options = {}) {
  if (typeof Database !== 'function') throw new Error('openDatabase requires Database constructor');
  const env = options.env || process.env;
  const busyTimeoutMs = resolveBusyTimeoutMs(env);
  const db = new Database(dbPath, { timeout: busyTimeoutMs });
  const runtimeConfig = configureDatabase(db, { env });
  return { db, runtimeConfig };
}

module.exports = {
  DEFAULT_SQLITE_BUSY_TIMEOUT_MS,
  configureDatabase,
  openDatabase,
  resolveBusyTimeoutMs,
};
