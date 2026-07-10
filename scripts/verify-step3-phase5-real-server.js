'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');

const GameAPI = require('../frontend/js/api/GameAPI');
const H5GameApiTransportAdapter = require('../frontend/js/ui/H5GameApiTransportAdapter');
const GameStateRepository = require('../backend/repositories/GameStateRepository');
const TutorialService = require('../backend/services/TutorialService');
const { openDatabase } = require('../backend/services/DatabaseRuntime');
const { createRecordingFetch } = require('./verify-step3-phase2-real-server');
const {
  findFreePort,
  publishConfigRuntime,
  requestRaw,
  waitForHealth,
} = require('./verify-step3-part0-real-server');

const REPO_ROOT = path.resolve(__dirname, '..');
const requireBackend = createRequire(path.join(REPO_ROOT, 'backend', 'package.json'));
const Database = requireBackend('better-sqlite3');
const LOCAL_JWT_SECRET = 'step3-phase5-real-server-local-only';

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function prepareBuildState(repository, playerId) {
  const state = repository.findByPlayerId(playerId);
  if (!state) throw new Error(`missing seeded player state: ${playerId}`);
  state.tutorial = TutorialService.manualAdvance(
    TutorialService.createInitialTutorialState(),
    TutorialService.TUTORIAL_STEPS.cityEntered,
  );
  const saved = repository.save(state);
  return summarizeState(saved);
}

function summarizeState(state = null) {
  if (!state) return null;
  const house = state.cities?.capital?.buildings?.house || state.buildings?.house || {};
  return {
    playerId: state.playerId || '',
    revision: state.revision ?? null,
    updatedAt: state.updatedAt || '',
    houseLevel: Number(house.level || 0),
    reportMissionIds: Object.keys(state.worldMarchClientReports?.missions || {}).sort(),
  };
}

function getIdempotencyRow(db, playerId, idempotencyKey) {
  return db.prepare(`
    SELECT playerId, idempotencyKey, commandId, ownerKey, payloadDigest,
           status, responseDigest, statusCode, createdAt, updatedAt
    FROM command_idempotency
    WHERE playerId = ? AND idempotencyKey = ?
  `).get(playerId, idempotencyKey) || null;
}

function getCommandRecords(records, commandId) {
  return records.filter((record) => {
    if (!record.request.body) return false;
    try {
      return JSON.parse(record.request.body).commandId === commandId;
    } catch (_) {
      return false;
    }
  });
}

function assertExactReplay(label, records, firstResult, replayResult) {
  if (records.length !== 2) {
    throw new Error(`${label} expected two real HTTP requests, received ${records.length}`);
  }
  if (records.some((record) => record.response.status !== 200)) {
    throw new Error(`${label} returned non-200 response: ${JSON.stringify(records)}`);
  }
  if (records[0].response.body !== records[1].response.body) {
    throw new Error(`${label} raw replay response differs from original response`);
  }
  if (JSON.stringify(firstResult) !== JSON.stringify(replayResult)) {
    throw new Error(`${label} parsed replay response differs from original response`);
  }
}

async function main() {
  const args = parseArgs();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wxgames-step3-phase5-real-server-'));
  const dbPath = path.join(tempRoot, 'civilization.db');
  const logsDbPath = path.join(tempRoot, 'observability.db');
  const configRuntime = publishConfigRuntime(tempRoot, { source: 'step3-phase5-real-server' });
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
  let verificationDb = null;
  try {
    const healthBefore = await waitForHealth(`${baseUrl}/api/health`, server);
    const login = await requestRaw(`${baseUrl}/api/player/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { username: 'test1', password: '123456' },
    });
    const loginBody = parseJsonBody(login, 'login');
    if (login.response.status !== 200 || !loginBody.token) {
      throw new Error(`real login failed: ${login.response.status} ${login.response.body}`);
    }

    const opened = openDatabase(Database, dbPath);
    verificationDb = opened.db;
    const repository = new GameStateRepository(verificationDb);
    repository.init();
    const setup = prepareBuildState(repository, loginBody.playerId);

    const transportRecords = [];
    const transport = H5GameApiTransportAdapter.fromRuntime(globalThis, {
      fetch: createRecordingFetch(transportRecords),
    });
    const api = new GameAPI(`${baseUrl}/api`, loginBody.token, {
      timeoutMs: 10000,
      maxRetries: 0,
      transport,
      abortControllerFactory: () => transport.createAbortController(),
      createCommandIdSeed: () => 'phase5-real-server',
    });

    const buildIds = {
      commandId: 'cmd-phase5-build-real-1',
      idempotencyKey: 'idem-phase5-build-real-1',
    };
    const buildBefore = summarizeState(repository.findByPlayerId(loginBody.playerId));
    const buildFirst = await api.build('house', buildIds);
    const buildAfterFirst = summarizeState(repository.findByPlayerId(loginBody.playerId));
    const buildRowAfterFirst = getIdempotencyRow(
      verificationDb,
      loginBody.playerId,
      buildIds.idempotencyKey,
    );
    const buildReplay = await api.build('house', buildIds);
    const buildAfterReplay = summarizeState(repository.findByPlayerId(loginBody.playerId));
    const buildRowAfterReplay = getIdempotencyRow(
      verificationDb,
      loginBody.playerId,
      buildIds.idempotencyKey,
    );
    const buildRecords = getCommandRecords(transportRecords, buildIds.commandId);
    assertExactReplay('build', buildRecords, buildFirst, buildReplay);
    if (buildAfterFirst.houseLevel !== buildBefore.houseLevel + 1
        || buildAfterFirst.revision !== buildBefore.revision + 1
        || JSON.stringify(buildAfterReplay) !== JSON.stringify(buildAfterFirst)
        || JSON.stringify(buildRowAfterReplay) !== JSON.stringify(buildRowAfterFirst)) {
      throw new Error(`build duplicate mutated more than once: ${JSON.stringify({
        buildBefore,
        buildAfterFirst,
        buildAfterReplay,
        buildRowAfterFirst,
        buildRowAfterReplay,
      })}`);
    }

    const heartbeatReadBefore = summarizeState(repository.findByPlayerId(loginBody.playerId));
    const heartbeatReadResult = await api.heartbeat();
    const heartbeatReadAfter = summarizeState(repository.findByPlayerId(loginBody.playerId));
    const heartbeatReadRecord = transportRecords.find((record) => (
      record.request.method === 'GET'
      && record.request.url.endsWith('/api/game/heartbeat')
    ));
    if (!heartbeatReadRecord || heartbeatReadRecord.response.status !== 200) {
      throw new Error('heartbeat GET did not reach the real server');
    }
    if (heartbeatReadAfter.revision !== heartbeatReadBefore.revision
        || heartbeatReadAfter.updatedAt !== heartbeatReadBefore.updatedAt) {
      throw new Error(`heartbeat GET changed persisted state: ${JSON.stringify({
        heartbeatReadBefore,
        heartbeatReadAfter,
      })}`);
    }

    const heartbeatIds = {
      commandId: 'cmd-phase5-heartbeat-real-1',
      idempotencyKey: 'idem-phase5-heartbeat-real-1',
    };
    const worldMarchClientReport = {
      schema: 'world-march-client-report-batch-v1',
      missions: [{
        missionId: 'phase5-real-march-1',
        clientTime: new Date().toISOString(),
        position: { q: 1.25, r: 0 },
      }],
    };
    const heartbeatWriteBefore = summarizeState(repository.findByPlayerId(loginBody.playerId));
    const heartbeatFirst = await api.heartbeat({
      worldMarchClientReport,
      commandOptions: heartbeatIds,
    });
    const heartbeatAfterFirst = summarizeState(repository.findByPlayerId(loginBody.playerId));
    const heartbeatRowAfterFirst = getIdempotencyRow(
      verificationDb,
      loginBody.playerId,
      heartbeatIds.idempotencyKey,
    );
    const heartbeatReplay = await api.heartbeat({
      worldMarchClientReport,
      commandOptions: heartbeatIds,
    });
    const heartbeatAfterReplay = summarizeState(repository.findByPlayerId(loginBody.playerId));
    const heartbeatRowAfterReplay = getIdempotencyRow(
      verificationDb,
      loginBody.playerId,
      heartbeatIds.idempotencyKey,
    );
    const heartbeatRecords = getCommandRecords(transportRecords, heartbeatIds.commandId);
    assertExactReplay('heartbeat POST', heartbeatRecords, heartbeatFirst, heartbeatReplay);
    if (heartbeatAfterFirst.revision !== heartbeatWriteBefore.revision + 1
        || !heartbeatAfterFirst.reportMissionIds.includes('phase5-real-march-1')
        || JSON.stringify(heartbeatAfterReplay) !== JSON.stringify(heartbeatAfterFirst)
        || JSON.stringify(heartbeatRowAfterReplay) !== JSON.stringify(heartbeatRowAfterFirst)) {
      throw new Error(`heartbeat duplicate mutated more than once: ${JSON.stringify({
        heartbeatWriteBefore,
        heartbeatAfterFirst,
        heartbeatAfterReplay,
        heartbeatRowAfterFirst,
        heartbeatRowAfterReplay,
      })}`);
    }

    const resetIds = {
      commandId: 'cmd-phase5-reset-real-1',
      idempotencyKey: 'idem-phase5-reset-real-1',
    };
    const resetBefore = summarizeState(repository.findByPlayerId(loginBody.playerId));
    const resetFirst = await api.resetPlayer(resetIds);
    const resetAfterFirst = summarizeState(repository.findByPlayerId(loginBody.playerId));
    const resetRowAfterFirst = getIdempotencyRow(
      verificationDb,
      loginBody.playerId,
      resetIds.idempotencyKey,
    );
    await sleep(25);
    const resetReplay = await api.resetPlayer(resetIds);
    const resetAfterReplay = summarizeState(repository.findByPlayerId(loginBody.playerId));
    const resetRowAfterReplay = getIdempotencyRow(
      verificationDb,
      loginBody.playerId,
      resetIds.idempotencyKey,
    );
    const resetRecords = getCommandRecords(transportRecords, resetIds.commandId);
    assertExactReplay('player reset', resetRecords, resetFirst, resetReplay);
    if (resetAfterFirst.revision !== 1
        || resetAfterFirst.houseLevel !== 0
        || JSON.stringify(resetAfterReplay) !== JSON.stringify(resetAfterFirst)
        || JSON.stringify(resetRowAfterReplay) !== JSON.stringify(resetRowAfterFirst)) {
      throw new Error(`reset duplicate executed more than once: ${JSON.stringify({
        resetBefore,
        resetAfterFirst,
        resetAfterReplay,
        resetRowAfterFirst,
        resetRowAfterReplay,
      })}`);
    }

    const healthAfter = await requestRaw(`${baseUrl}/api/health`);
    if (healthAfter.response.status !== 200) {
      throw new Error(`real server post-verification health failed: ${healthAfter.response.status}`);
    }

    evidence = {
      schema: 'step3-phase5-real-server-evidence-v1',
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
        routeMigrationClaimed: true,
        clientPath: 'GameAPI -> ClientCommandSender -> H5GameApiTransportAdapter -> global fetch',
        captureMode: 'real fetch request plus Response.clone raw capture',
      },
      healthBefore,
      healthAfter,
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
      build: {
        ids: buildIds,
        before: buildBefore,
        afterFirst: buildAfterFirst,
        afterReplay: buildAfterReplay,
        idempotencyAfterFirst: buildRowAfterFirst,
        idempotencyAfterReplay: buildRowAfterReplay,
        firstResult: buildFirst,
        replayResult: buildReplay,
        requests: buildRecords,
      },
      heartbeatRead: {
        before: heartbeatReadBefore,
        after: heartbeatReadAfter,
        result: heartbeatReadResult,
        request: heartbeatReadRecord,
      },
      heartbeatWrite: {
        ids: heartbeatIds,
        report: worldMarchClientReport,
        before: heartbeatWriteBefore,
        afterFirst: heartbeatAfterFirst,
        afterReplay: heartbeatAfterReplay,
        idempotencyAfterFirst: heartbeatRowAfterFirst,
        idempotencyAfterReplay: heartbeatRowAfterReplay,
        firstResult: heartbeatFirst,
        replayResult: heartbeatReplay,
        requests: heartbeatRecords,
      },
      playerReset: {
        ids: resetIds,
        before: resetBefore,
        afterFirst: resetAfterFirst,
        afterReplay: resetAfterReplay,
        idempotencyAfterFirst: resetRowAfterFirst,
        idempotencyAfterReplay: resetRowAfterReplay,
        firstResult: resetFirst,
        replayResult: resetReplay,
        requests: resetRecords,
      },
      assertion: {
        passed: true,
        buildMutatedExactlyOnce: true,
        buildExactReplay: true,
        heartbeatGetReadOnly: true,
        heartbeatReportMutatedExactlyOnce: true,
        heartbeatExactReplay: true,
        playerResetExecutedExactlyOnce: true,
        playerResetExactReplay: true,
        sameProcessHealthBeforeAndAfter: true,
      },
    };
  } finally {
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
  assertExactReplay,
  getCommandRecords,
  parseArgs,
  prepareBuildState,
  summarizeState,
};
