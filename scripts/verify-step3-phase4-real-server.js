'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');

const REPO_ROOT = path.resolve(__dirname, '..');
const requireBackend = createRequire(path.join(REPO_ROOT, 'backend', 'package.json'));
const Database = requireBackend('better-sqlite3');

const { normalizeCommandEnvelope } = require('../backend/application/commands/CommandEnvelope');
const { CommandIdempotencyStore } = require('../backend/application/commands/CommandIdempotencyStore');
const GameStateRepository = require('../backend/repositories/GameStateRepository');
const { openDatabase } = require('../backend/services/DatabaseRuntime');
const {
  findFreePort,
  publishConfigRuntime,
  requestRaw,
  waitForHealth,
} = require('./verify-step3-part0-real-server');

const CHILD_PATH = path.join(REPO_ROOT, 'backend', 'tests', 'fixtures', 'owner-lock-child.js');
const LOCAL_JWT_SECRET = 'step3-phase4-real-server-local-only';

function parseArgs(argv = process.argv.slice(2)) {
  const outputIndex = argv.indexOf('--output');
  return {
    output: outputIndex >= 0 ? String(argv[outputIndex + 1] || '').trim() : '',
    quiet: argv.includes('--quiet'),
  };
}

function stopChild(child) {
  if (!child || child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    child.once('exit', finish);
    child.kill('SIGTERM');
    setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
      finish();
    }, 3000).unref();
  });
}

function spawnLockChild(dbPath, ownerKeys, holdMs, label) {
  const stdout = [];
  const stderr = [];
  const child = spawn(process.execPath, [
    CHILD_PATH,
    dbPath,
    JSON.stringify(ownerKeys),
    String(holdMs),
    label,
  ], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout.on('data', (chunk) => stdout.push(String(chunk)));
  child.stderr.on('data', (chunk) => stderr.push(String(chunk)));
  child.capture = { stdout, stderr };
  return child;
}

function waitForOutput(child, expected, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const inspect = () => {
      const output = child.capture.stdout.join('');
      if (!output.includes(expected)) return;
      clearTimeout(timer);
      child.stdout.off('data', inspect);
      resolve(output);
    };
    const timer = setTimeout(() => {
      child.stdout.off('data', inspect);
      reject(new Error(`child output timeout: ${child.capture.stderr.join('')}`));
    }, timeoutMs);
    child.stdout.on('data', inspect);
    inspect();
  });
}

function waitForExit(child, timeoutMs = 7000) {
  return new Promise((resolve, reject) => {
    if (child.exitCode !== null) {
      if (child.exitCode === 0) resolve();
      else reject(new Error(`child failed ${child.exitCode}: ${child.capture.stderr.join('')}`));
      return;
    }
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`child exit timeout: ${child.capture.stderr.join('')}`));
    }, timeoutMs);
    child.once('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`child failed ${code}: ${child.capture.stderr.join('')}`));
    });
  });
}

function childEvidence(child) {
  return {
    pid: child.pid,
    stdout: child.capture.stdout.join(''),
    stderr: child.capture.stderr.join(''),
    exitCode: child.exitCode,
    signalCode: child.signalCode,
  };
}

function buildEnvelope(payload) {
  return normalizeCommandEnvelope({
    playerId: 'phase4-evidence-player',
    method: 'POST',
    path: '/phase4/module-evidence',
    headers: { 'x-client-request-id': 'api-phase4-evidence' },
    get(name) { return this.headers[String(name).toLowerCase()] || ''; },
    body: {
      action: 'research',
      ...payload,
      commandId: 'cmd-phase4-evidence',
      idempotencyKey: 'idem-phase4-evidence',
      clientCommand: {
        schema: 'game-command-v1',
        type: 'research',
        commandId: 'cmd-phase4-evidence',
        idempotencyKey: 'idem-phase4-evidence',
        payload,
      },
    },
  });
}

async function main() {
  const args = parseArgs();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wxgames-step3-phase4-real-server-'));
  const dbPath = path.join(tempRoot, 'civilization.db');
  const logsDbPath = path.join(tempRoot, 'observability.db');
  const configRuntime = publishConfigRuntime(tempRoot, { source: 'step3-phase4-real-server' });
  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const stdout = [];
  const stderr = [];
  const server = spawn(process.execPath, ['backend/server.js'], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: dbPath,
      LOGS_DB_PATH: logsDbPath,
      JWT_SECRET: LOCAL_JWT_SECRET,
      CONFIG_RELEASE_GATE: 'required',
      CONFIG_RELEASE_HISTORY_PATH: configRuntime.historyPath,
      CONFIG_ACTIVE_RELEASE_PATH: configRuntime.activePath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  server.stdout.on('data', (chunk) => stdout.push(String(chunk)));
  server.stderr.on('data', (chunk) => stderr.push(String(chunk)));

  let evidence;
  const children = [];
  let verificationDb = null;
  try {
    const healthBefore = await waitForHealth(`${baseUrl}/api/health`, server);
    const opened = openDatabase(Database, dbPath);
    verificationDb = opened.db;
    const repository = new GameStateRepository(verificationDb);
    repository.init();

    const ownerLockColumns = verificationDb.prepare('PRAGMA table_info(owner_locks)').all();
    const legacyTable = verificationDb.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name = 'player_state_locks'
    `).get() || null;
    const idempotencyColumns = verificationDb.prepare('PRAGMA table_info(command_idempotency)').all();
    const migrations = verificationDb.prepare(`
      SELECT id, status FROM schema_migrations
      WHERE id IN ('003-owner-locks-generalization', '004-command-idempotency-store')
      ORDER BY id
    `).all();

    const holder = spawnLockChild(dbPath, ['player:phase4-same-owner'], 450, 'same-owner-holder');
    children.push(holder);
    await waitForOutput(holder, 'acquired:same-owner-holder');

    const differentStartedAt = Date.now();
    const differentResult = repository.withOwnerLocks(
      ['player:phase4-different-owner'],
      'phase4-evidence-different',
      () => 'different-key-acquired',
      { waitMs: 0 },
    );
    const differentWaitMs = Date.now() - differentStartedAt;

    const sameStartedAt = Date.now();
    const sameResult = repository.withOwnerLocks(
      ['player:phase4-same-owner'],
      'phase4-evidence-same',
      () => 'same-key-acquired-after-child',
      { waitMs: 3000, ttlMs: 10000, pollMs: 10 },
    );
    const sameOwnerWaitMs = Date.now() - sameStartedAt;
    await waitForExit(holder);

    verificationDb.prepare(`
      INSERT INTO owner_locks (ownerKey, holderId, scope, lockedAt, expiresAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      'player:phase4-expired',
      'crashed-holder',
      'phase4-evidence-expired',
      '2026-07-09T00:00:00.000Z',
      '2026-07-09T00:00:01.000Z',
    );
    const expiredResult = repository.withOwnerLocks(
      ['player:phase4-expired'],
      'phase4-evidence-reclaim',
      () => 'expired-reclaimed',
      { waitMs: 0 },
    );

    const orderA = spawnLockChild(
      dbPath,
      ['player:phase4-X', 'encounter:phase4-Y'],
      150,
      'dual-order-a',
    );
    const orderB = spawnLockChild(
      dbPath,
      ['encounter:phase4-Y', 'player:phase4-X'],
      150,
      'dual-order-b',
    );
    children.push(orderA, orderB);
    await Promise.all([waitForExit(orderA), waitForExit(orderB)]);

    const idempotencyStore = new CommandIdempotencyStore(verificationDb);
    const envelope = buildEnvelope({ techId: 'writing' });
    const started = idempotencyStore.begin(envelope);
    const bound = idempotencyStore.bindOwner(started.record, 'player:phase4-evidence-player');
    const storedResponse = {
      statusCode: 200,
      payload: { success: true, evidence: 'phase4-real-db' },
    };
    const stored = idempotencyStore.recordResult(bound, storedResponse);
    const replay = idempotencyStore.begin(envelope);
    let conflict = null;
    try {
      idempotencyStore.begin(buildEnvelope({ techId: 'mining' }));
    } catch (error) {
      conflict = {
        name: error.name,
        code: error.code,
        status: error.status,
        idempotencyKey: error.idempotencyKey,
        existingPayloadDigest: error.existingPayloadDigest,
        payloadDigest: error.payloadDigest,
      };
    }

    const healthAfter = await requestRaw(`${baseUrl}/api/health`);
    if (healthAfter.response.status !== 200) {
      throw new Error(`real server post-verification health failed: ${healthAfter.response.status}`);
    }

    const expectedOwnerColumns = ['ownerKey', 'holderId', 'scope', 'lockedAt', 'expiresAt'];
    if (JSON.stringify(ownerLockColumns.map((column) => column.name)) !== JSON.stringify(expectedOwnerColumns)) {
      throw new Error(`unexpected owner_locks schema: ${JSON.stringify(ownerLockColumns)}`);
    }
    if (legacyTable) throw new Error('legacy player_state_locks table still exists');
    if (idempotencyColumns.length === 0) throw new Error('command_idempotency table is missing');
    if (sameResult !== 'same-key-acquired-after-child' || sameOwnerWaitMs < 150) {
      throw new Error(`same-owner cross-process serialization failed: ${sameOwnerWaitMs}ms`);
    }
    if (differentResult !== 'different-key-acquired' || differentWaitMs >= 150) {
      throw new Error(`different owner keys serialized unexpectedly: ${differentWaitMs}ms`);
    }
    if (expiredResult !== 'expired-reclaimed') throw new Error('expired owner lease was not reclaimed');
    if (!orderA.capture.stdout.join('').includes('acquired:dual-order-a')
        || !orderB.capture.stdout.join('').includes('acquired:dual-order-b')) {
      throw new Error('dual-lock opposite order did not complete');
    }
    if (replay.status !== 'replay'
        || JSON.stringify(replay.response) !== JSON.stringify(storedResponse)) {
      throw new Error(`idempotency replay mismatch: ${JSON.stringify(replay)}`);
    }
    if (conflict?.code !== 'IDEMPOTENCY_KEY_CONFLICT' || conflict.status !== 409) {
      throw new Error(`idempotency conflict was not enforced: ${JSON.stringify(conflict)}`);
    }

    evidence = {
      schema: 'step3-phase4-real-server-evidence-v1',
      generatedAt: new Date().toISOString(),
      integrity: {
        stubFree: true,
        serverEntry: 'backend/server.js',
        serverPid: server.pid,
        processExecPath: process.execPath,
        repoRoot: REPO_ROOT,
        tempRoot,
        dbPath,
        logsDbPath,
        port,
        configRuntime,
        routeMigrationClaimed: false,
        verificationScope: 'real server startup plus production SQLite lock/idempotency modules',
      },
      healthBefore,
      healthAfter,
      database: {
        runtimeConfig: opened.runtimeConfig,
        ownerLockColumns,
        legacyPlayerLockTable: legacyTable,
        idempotencyColumns,
        migrations,
      },
      ownerLocks: {
        sameOwner: {
          result: sameResult,
          waitMs: sameOwnerWaitMs,
          child: childEvidence(holder),
        },
        differentOwner: {
          result: differentResult,
          waitMs: differentWaitMs,
        },
        expiredLease: { result: expiredResult },
        dualOrder: {
          first: childEvidence(orderA),
          second: childEvidence(orderB),
        },
      },
      idempotency: {
        started,
        bound,
        stored,
        replay,
        conflict,
      },
      assertion: {
        passed: true,
        sameOwnerSerialized: true,
        differentOwnersConcurrent: true,
        expiredLeaseReclaimed: true,
        oppositeOrderNoDeadlock: true,
        exactReplay: true,
        payloadConflictRejected: true,
        legacyLockTableRetired: true,
      },
    };
  } finally {
    for (const child of children) {
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    if (verificationDb?.open) verificationDb.close();
    await stopChild(server);
  }

  evidence.serverOutput = {
    stdout: stdout.join(''),
    stderr: stderr.join(''),
    exitCode: server.exitCode,
    signalCode: server.signalCode,
    stopped: server.exitCode !== null || server.signalCode !== null,
  };
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  if (args.output) {
    const outputPath = path.resolve(REPO_ROOT, args.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, serialized, 'utf8');
  }
  if (!args.quiet) process.stdout.write(serialized);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = {
  buildEnvelope,
  parseArgs,
};
