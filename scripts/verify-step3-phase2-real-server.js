'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const GameAPI = require('../frontend/js/api/GameAPI');
const H5GameApiTransportAdapter = require('../frontend/js/ui/H5GameApiTransportAdapter');
const {
  configureEmptyFormation,
  findFreePort,
  publishConfigRuntime,
  requestRaw,
  waitForHealth,
} = require('./verify-step3-part0-real-server');

const REPO_ROOT = path.resolve(__dirname, '..');
const LOCAL_JWT_SECRET = 'step3-phase2-real-server-local-only';

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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wxgames-step3-phase2-real-server-'));
  const dbPath = path.join(tempRoot, 'civilization.db');
  const logsDbPath = path.join(tempRoot, 'observability.db');
  const configRuntime = publishConfigRuntime(tempRoot, { source: 'step3-phase2-real-server' });
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
    const transportRecords = [];
    const transport = H5GameApiTransportAdapter.fromRuntime(globalThis, {
      fetch: createRecordingFetch(transportRecords),
    });
    const api = new GameAPI(`${baseUrl}/api`, loginBody.token, {
      timeoutMs: 10000,
      maxRetries: 0,
      transport,
      abortControllerFactory: () => transport.createAbortController(),
      createCommandIdSeed: () => 'phase2-real-server-1',
    });

    let commandError = null;
    try {
      await api.startWorldMarch({
        targetQ: 1,
        targetR: 0,
        cityId: 'capital',
        formationSlot: 1,
        commandOptions: {
          commandId: 'cmd-phase2-real-server-1',
          idempotencyKey: 'idem-phase2-real-server-1',
        },
      });
    } catch (error) {
      commandError = error;
    }
    const commandRecord = transportRecords.find((record) => record.request.url.endsWith('/api/game/action'));
    if (!commandRecord) throw new Error('GameAPI did not send the real game/action request');
    const requestBody = JSON.parse(commandRecord.request.body);
    const responseBody = parseJsonBody(commandRecord, 'GameAPI startWorldMarch');
    if (commandRecord.response.status !== 400 || responseBody.error !== 'FORMATION_EMPTY') {
      throw new Error(`unexpected real command result: ${commandRecord.response.status} ${commandRecord.response.body}`);
    }
    if (commandError?.status !== 400 || commandError?.payload?.error !== 'FORMATION_EMPTY') {
      throw new Error('GameAPI did not surface the real server rejection');
    }
    if (requestBody.commandId !== 'cmd-phase2-real-server-1'
        || requestBody.idempotencyKey !== 'idem-phase2-real-server-1'
        || requestBody.clientCommand?.type !== 'startWorldMarch') {
      throw new Error(`real request lacked the Phase 2 command envelope: ${commandRecord.request.body}`);
    }

    evidence = {
      schema: 'step3-phase2-real-server-evidence-v1',
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
        captureMode: 'real fetch request plus Response.clone raw capture',
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
      command: commandRecord,
      assertion: {
        passed: true,
        expectedStatus: 400,
        expectedError: 'FORMATION_EMPTY',
        actualStatus: commandRecord.response.status,
        actualError: responseBody.error,
        commandId: requestBody.commandId,
        idempotencyKey: requestBody.idempotencyKey,
        commandType: requestBody.clientCommand.type,
        requestId: requestBody.clientCommand.requestId,
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
