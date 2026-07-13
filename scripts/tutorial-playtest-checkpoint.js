const fs = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');

const backendRequire = createRequire(path.join(__dirname, '..', 'backend', 'package.json'));
const Database = backendRequire('better-sqlite3');

function getArgValue(name, fallback = '') {
  const exact = `--${name}`;
  const prefix = `${exact}=`;
  const index = process.argv.findIndex((arg) => arg === exact || arg.startsWith(prefix));
  if (index < 0) return fallback;
  const arg = process.argv[index];
  if (arg.startsWith(prefix)) return arg.slice(prefix.length);
  const next = process.argv[index + 1];
  return next && !next.startsWith('--') ? next : '1';
}

function resolveFile(value, label) {
  const resolved = path.resolve(String(value || '').trim());
  if (!String(value || '').trim()) throw new Error(`${label} is required`);
  return resolved;
}

function assertDifferentFiles(sourcePath, targetPath) {
  if (sourcePath === targetPath) throw new Error('checkpoint source and destination must differ');
}

function assertDatabaseIntegrity(dbPath) {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const result = db.pragma('integrity_check', { simple: true });
    if (result !== 'ok') throw new Error(`sqlite integrity_check failed: ${String(result)}`);
  } finally {
    db.close();
  }
}

async function createSqliteCheckpoint(options = {}) {
  const sourcePath = resolveFile(options.sourcePath, 'sourcePath');
  const checkpointPath = resolveFile(options.checkpointPath, 'checkpointPath');
  assertDifferentFiles(sourcePath, checkpointPath);
  if (!fs.existsSync(sourcePath)) throw new Error(`sqlite source does not exist: ${sourcePath}`);
  if (fs.existsSync(checkpointPath)) {
    throw new Error(`checkpoint already exists: ${checkpointPath}`);
  }

  fs.mkdirSync(path.dirname(checkpointPath), { recursive: true });
  const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  try {
    await source.backup(checkpointPath);
  } finally {
    source.close();
  }
  assertDatabaseIntegrity(checkpointPath);

  const stat = fs.statSync(checkpointPath);
  const manifest = {
    schema: 'tutorial-playtest-checkpoint/v1',
    createdAt: new Date().toISOString(),
    sourcePath,
    checkpointPath,
    bytes: stat.size,
    metadata: options.metadata || {},
  };
  const manifestPath = `${checkpointPath}.json`;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { ...manifest, manifestPath };
}

function restoreSqliteCheckpoint(options = {}) {
  const checkpointPath = resolveFile(options.checkpointPath, 'checkpointPath');
  const targetPath = resolveFile(options.targetPath, 'targetPath');
  const overwrite = Boolean(options.overwrite);
  assertDifferentFiles(checkpointPath, targetPath);
  if (!fs.existsSync(checkpointPath)) throw new Error(`checkpoint does not exist: ${checkpointPath}`);

  const targetFiles = [targetPath, `${targetPath}-wal`, `${targetPath}-shm`];
  const existing = targetFiles.filter((file) => fs.existsSync(file));
  if (existing.length && !overwrite) {
    throw new Error(`restore target already exists: ${existing.join(', ')}`);
  }
  if (overwrite) existing.forEach((file) => fs.rmSync(file, { force: true }));

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(checkpointPath, targetPath, fs.constants.COPYFILE_EXCL);
  assertDatabaseIntegrity(targetPath);
  return {
    schema: 'tutorial-playtest-checkpoint-restore/v1',
    checkpointPath,
    targetPath,
    bytes: fs.statSync(targetPath).size,
  };
}

async function runCli() {
  const command = String(process.argv[2] || '').trim();
  const checkpointPath = getArgValue('checkpoint');
  if (command === 'save') {
    const result = await createSqliteCheckpoint({
      sourcePath: getArgValue('db'),
      checkpointPath,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (command === 'restore') {
    const result = restoreSqliteCheckpoint({
      checkpointPath,
      targetPath: getArgValue('db'),
      overwrite: getArgValue('overwrite', '0') === '1',
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  throw new Error(
    'Usage: node scripts/tutorial-playtest-checkpoint.js <save|restore> '
    + '--checkpoint <file> --db <file> [--overwrite=1]',
  );
}

if (require.main === module) {
  runCli().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = {
  Database,
  assertDatabaseIntegrity,
  createSqliteCheckpoint,
  restoreSqliteCheckpoint,
};
