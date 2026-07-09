'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const GameAPI = require('../frontend/js/api/GameAPI');
const H5GameApiTransportAdapter = require('../frontend/js/ui/H5GameApiTransportAdapter');
const {
  findFreePort,
  publishConfigRuntime,
  requestRaw,
  waitForHealth,
} = require('./verify-step3-part0-real-server');

const REPO_ROOT = path.resolve(__dirname, '..');
const LOCAL_JWT_SECRET = 'step3-phase3-real-server-local-only';
const COMMAND_ID = 'cmd-phase3-real-server-1';
const IDEMPOTENCY_KEY = 'idem-phase3-real-server-1';
const TERRITORY_ID = 'phase3-real-territory';

function parseArgs(argv = process.argv.slice(2)) {
  const outputIndex = argv.indexOf('--output');
  return {
    output: outputIndex >= 0 ? String(argv[outputIndex + 1] || '').trim() : '',
    quiet: argv.includes('--quiet'),
  };
}

function parseJsonBody(record, label) {
  try {
    return JSON.parse(record.response.body);
  } catch (error) {
    throw new Error(`${label} response was not JSON: ${error.message}`);
  }
}

function serializeRequestHeaders(headers = {}) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), String(value)]),
  );
}

function createRecordingFetch(records) {
  return async function recordingFetch(url, options = {}) {
    const request = {
      method: String(options.method || 'GET').toUpperCase(),
      url: String(url),
      headers: serializeRequestHeaders(options.headers || {}),
      body: options.body === undefined ? '' : String(options.body),
    };
    const response = await fetch(url, options);
    const responseBody = await response.clone().text();
    records.push({
      request,
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseBody,
      },
    });
    return response;
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

async function main() {
  const args = parseArgs();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wxgames-step3-phase3-real-server-'));
  const dbPath = path.join(tempRoot, 'civilization.db');
  const logsDbPath = path.join(tempRoot, 'observability.db');
  const configRuntime = publishConfigRuntime(tempRoot, { source: 'step3-phase3-real-server' });
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
    const healthBefore = await waitForHealth(`${baseUrl}/api/health`, child);
    const login = await requestRaw(`${baseUrl}/api/player/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { username: 'codexqa', password: '123456' },
    });
    const loginBody = parseJsonBody(login, 'login');
    if (login.response.status !== 200 || !loginBody.token) {
      throw new Error(`real login failed: ${login.response.status} ${login.response.body}`);
    }

    const transportRecords = [];
    const transport = H5GameApiTransportAdapter.fromRuntime(globalThis, {
      fetch: createRecordingFetch(transportRecords),
    });
    const api = new GameAPI(`${baseUrl}/api`, loginBody.token, {
      timeoutMs: 10000,
      maxRetries: 0,
      transport,
      abortControllerFactory: () => transport.createAbortController(),
      createCommandIdSeed: () => 'phase3-real-server-1',
    });

    let commandOutcome = null;
    try {
      const result = await api.startConquest(TERRITORY_ID, {}, {
        commandId: COMMAND_ID,
        idempotencyKey: IDEMPOTENCY_KEY,
      });
      commandOutcome = { kind: 'resolved', result };
    } catch (error) {
      commandOutcome = {
        kind: 'rejected',
        status: error?.status ?? null,
        error: error?.payload?.error || error?.code || '',
        message: error?.payload?.message || error?.message || '',
      };
    }

    const commandRecord = transportRecords.find((record) => record.request.url.endsWith('/api/game/action'));
    if (!commandRecord) throw new Error('GameAPI did not send the real game/action request');
    const requestBody = JSON.parse(commandRecord.request.body);
    parseJsonBody(commandRecord, 'GameAPI startConquest');
    if (commandRecord.response.status >= 500) {
      throw new Error(`real command crashed: ${commandRecord.response.status} ${commandRecord.response.body}`);
    }
    if (requestBody.commandId !== COMMAND_ID
        || requestBody.idempotencyKey !== IDEMPOTENCY_KEY
        || requestBody.clientCommand?.schema !== 'game-command-v1'
        || requestBody.clientCommand?.type !== 'startConquest') {
      throw new Error(`real request lacked the Phase 3 command envelope: ${commandRecord.request.body}`);
    }

    const metrics = await requestRaw(`${baseUrl}/api/metrics?eventLimit=20`, {
      headers: { authorization: `Bearer ${loginBody.token}` },
    });
    const metricsBody = parseJsonBody(metrics, 'metrics');
    if (metrics.response.status !== 200) {
      throw new Error(`real metrics request failed: ${metrics.response.status} ${metrics.response.body}`);
    }
    const commandEntry = metricsBody.metrics?.recentCommandEntries?.find(
      (entry) => entry.commandId === COMMAND_ID,
    );
    if (!commandEntry) throw new Error('real server metrics lacked the command entry report');
    const expectedOwnerKeys = ['player:codexqa', `territory:${TERRITORY_ID}`];
    if (commandEntry.ownerStatus !== 'resolved'
        || commandEntry.ownerKey !== `territory:${TERRITORY_ID}`
        || JSON.stringify(commandEntry.ownerKeys) !== JSON.stringify(expectedOwnerKeys)
        || commandEntry.idempotencyClassification !== 'client-idempotent') {
      throw new Error(`unexpected real owner report: ${JSON.stringify(commandEntry)}`);
    }

    const healthAfter = await requestRaw(`${baseUrl}/api/health`);
    const healthAfterBody = parseJsonBody(healthAfter, 'health after command');
    if (healthAfter.response.status !== 200
        || Number(healthAfterBody.observability?.recentCommandEntryCount || 0) < 2) {
      throw new Error(`health did not expose same-process command reports: ${healthAfter.response.body}`);
    }

    evidence = {
      schema: 'step3-phase3-real-server-evidence-v1',
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
        clientPath: 'GameAPI -> ClientCommandSender -> H5GameApiTransportAdapter -> global fetch',
        captureMode: 'real fetch/requestRaw plus Response.clone raw capture',
      },
      healthBefore,
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
      command: commandRecord,
      commandOutcome,
      metrics,
      healthAfter,
      assertion: {
        passed: true,
        commandId: COMMAND_ID,
        idempotencyKey: IDEMPOTENCY_KEY,
        commandType: 'startConquest',
        ownerStatus: commandEntry.ownerStatus,
        ownerKey: commandEntry.ownerKey,
        ownerKeys: commandEntry.ownerKeys,
        idempotencyClassification: commandEntry.idempotencyClassification,
        commandHttpStatus: commandRecord.response.status,
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
    stopped: child.exitCode !== null || child.signalCode !== null,
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
  createRecordingFetch,
  parseArgs,
};
