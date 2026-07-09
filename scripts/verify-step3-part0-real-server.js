'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');

const REPO_ROOT = path.resolve(__dirname, '..');
const requireBackend = createRequire(path.join(REPO_ROOT, 'backend', 'package.json'));
const Database = requireBackend('better-sqlite3');
const { openDatabase } = require('../backend/services/DatabaseRuntime');
const GameStateRepository = require('../backend/repositories/GameStateRepository');
const TutorialService = require('../backend/services/TutorialService');
const ConfigPipeline = require('../backend/services/config/ConfigPipeline');
const ConfigReleaseService = require('../backend/services/config/ConfigReleaseService');

const LOCAL_JWT_SECRET = 'step3-part0-real-server-local-only';

function parseArgs(argv = process.argv.slice(2)) {
  const outputIndex = argv.indexOf('--output');
  return {
    output: outputIndex >= 0 ? String(argv[outputIndex + 1] || '').trim() : '',
  };
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function serializeHeaders(headers = {}) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), String(value)]),
  );
}

async function requestRaw(url, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = serializeHeaders(options.headers || {});
  const body = options.body === undefined
    ? ''
    : typeof options.body === 'string'
      ? options.body
      : JSON.stringify(options.body);
  const response = await fetch(url, {
    method,
    headers,
    body: body || undefined,
  });
  const responseBody = await response.text();
  return {
    request: {
      method,
      url,
      headers,
      body,
    },
    response: {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseBody,
    },
  };
}

async function waitForHealth(url, child, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`real server exited before health check: ${child.exitCode}`);
    }
    try {
      const result = await requestRaw(url);
      if (result.response.status === 200) return result;
      lastError = new Error(`health returned ${result.response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`real server health timeout: ${lastError?.message || 'unknown error'}`);
}

function configureEmptyFormation(dbPath, playerId) {
  const { db } = openDatabase(Database, dbPath);
  try {
    const repository = new GameStateRepository(db);
    repository.init();
    const gameState = repository.findByPlayerId(playerId);
    if (!gameState) throw new Error(`missing seeded player state: ${playerId}`);
    gameState.tutorial = {
      ...TutorialService.normalizeTutorialState(gameState.tutorial),
      currentStep: TutorialService.TUTORIAL_STEPS.completed,
      completed: true,
      disabled: true,
    };
    gameState.exploreMissions = [];
    const capital = gameState.cities?.capital;
    if (!capital?.military) throw new Error('missing capital military state');
    capital.military.formations = [
      { slot: 1, memberIds: [], soldierAssignments: {} },
    ];
    gameState.military = capital.military;
    repository.save(gameState);
    return {
      playerId,
      revision: repository.findByPlayerId(playerId)?.revision ?? null,
      formation: capital.military.formations[0],
    };
  } finally {
    db.close();
  }
}

function publishConfigRuntime(tempRoot) {
  const historyPath = path.join(tempRoot, 'configReleases.json');
  const activePath = path.join(tempRoot, 'configActiveRelease.json');
  const now = new Date();
  const snapshot = ConfigPipeline.buildCurrentSnapshot({ generatedAt: now.toISOString() });
  const publish = ConfigReleaseService.publishRelease(
    { snapshot, source: 'step3-part0-real-server' },
    {
      historyPath,
      activePath,
      operator: 'codex-real-server-verification',
      now,
    },
  );
  if (!publish.success) {
    throw new Error(`failed to publish real-server config runtime: ${(publish.errors || []).join('; ')}`);
  }
  return {
    historyPath,
    activePath,
    releaseId: publish.release?.id || '',
    snapshotHash: publish.release?.snapshotHash || '',
  };
}

function parseJsonBody(record, label) {
  try {
    return JSON.parse(record.response.body);
  } catch (error) {
    throw new Error(
      `${label} response was not JSON: ${error.message}; raw=${record.response.body.slice(0, 4000)}`,
    );
  }
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

async function main() {
  const args = parseArgs();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wxgames-step3-part0-real-server-'));
  const dbPath = path.join(tempRoot, 'civilization.db');
  const logsDbPath = path.join(tempRoot, 'observability.db');
  const configRuntime = publishConfigRuntime(tempRoot);
  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const stdout = [];
  const stderr = [];
  const child = spawn(process.execPath, ['backend/server.js'], {
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
  child.stdout.on('data', (chunk) => stdout.push(String(chunk)));
  child.stderr.on('data', (chunk) => stderr.push(String(chunk)));

  let evidence;
  try {
    const health = await waitForHealth(`${baseUrl}/api/health`, child);
    const login = await requestRaw(`${baseUrl}/api/player/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { username: 'test1', password: '123456' },
    });
    const loginBody = parseJsonBody(login, 'login');
    if (login.response.status !== 200 || !loginBody.token) {
      throw new Error(`real login failed: ${login.response.status} ${login.response.body}`);
    }
    const setup = configureEmptyFormation(dbPath, loginBody.playerId);
    const march = await requestRaw(`${baseUrl}/api/game/action`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${loginBody.token}`,
        'content-type': 'application/json',
      },
      body: {
        action: 'startWorldMarch',
        targetQ: 1,
        targetR: 0,
        cityId: 'capital',
        formationSlot: 1,
      },
    });
    const marchBody = parseJsonBody(march, 'startWorldMarch');
    if (march.response.status !== 400) {
      throw new Error(`expected HTTP 400, received ${march.response.status}`);
    }
    if (marchBody.error !== 'FORMATION_EMPTY') {
      throw new Error(`expected FORMATION_EMPTY, received ${marchBody.error || 'missing error'}`);
    }

    evidence = {
      schema: 'step3-part0-real-server-evidence-v1',
      generatedAt: new Date().toISOString(),
      integrity: {
        stubFree: true,
        serverEntry: 'backend/server.js',
        serverPid: child.pid,
        processExecPath: process.execPath,
        repoRoot: REPO_ROOT,
        tempRoot,
        dbPath,
        logsDbPath,
        port,
        configRuntime,
      },
      health,
      login: {
        request: login.request,
        response: {
          status: login.response.status,
          statusText: login.response.statusText,
          headers: login.response.headers,
          bodySha256: crypto.createHash('sha256').update(login.response.body).digest('hex'),
          playerId: loginBody.playerId,
        },
      },
      setup,
      startWorldMarch: march,
      assertion: {
        passed: true,
        expectedStatus: 400,
        expectedError: 'FORMATION_EMPTY',
        actualStatus: march.response.status,
        actualError: marchBody.error,
        actualMessage: marchBody.message,
      },
    };
  } finally {
    await stopChild(child);
  }

  evidence.serverOutput = {
    stdout: stdout.join(''),
    stderr: stderr.join(''),
    exitCode: child.exitCode,
    signalCode: child.signalCode,
  };
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  if (args.output) {
    const outputPath = path.resolve(REPO_ROOT, args.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, serialized, 'utf8');
  }
  process.stdout.write(serialized);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = {
  configureEmptyFormation,
  findFreePort,
  parseArgs,
  publishConfigRuntime,
  requestRaw,
  waitForHealth,
};
