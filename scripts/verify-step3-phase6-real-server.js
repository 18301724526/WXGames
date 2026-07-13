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
const TerritoryService = require('../backend/services/TerritoryService');
const WorldExplorerService = require('../backend/services/WorldExplorerService');
const WorldMapService = require('../backend/services/WorldMapService');
const WorldCombatEncounterService = require('../backend/services/worldCombat/WorldCombatEncounterService');
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
const LOCAL_JWT_SECRET = 'step3-phase6-real-server-local-only';
const TERRITORY_ID = 'phase6-real-shared-territory';
const MARCH_ENCOUNTER_ID = 'phase6-real-march-handoff-encounter';
const COMBAT_ENCOUNTER_ID = 'phase6-real-resolve-storm-encounter';
const WORKER_ENCOUNTER_ID = 'phase6-real-worker-force-settle-encounter';
const WORKER_INTERVAL_MS = 3000;

const IDS = Object.freeze({
  territoryA: {
    commandId: 'cmd-phase6-territory-a-real-1',
    idempotencyKey: 'idem-phase6-territory-a-real-1',
  },
  territoryB: {
    commandId: 'cmd-phase6-territory-b-real-1',
    idempotencyKey: 'idem-phase6-territory-b-real-1',
  },
  march: {
    commandId: 'cmd-phase6-march-handoff-real-1',
    idempotencyKey: 'idem-phase6-march-handoff-real-1',
  },
  combatStart: {
    commandId: 'cmd-phase6-combat-start-real-1',
    idempotencyKey: 'idem-phase6-combat-start-real-1',
  },
  combatResolve: {
    commandId: 'cmd-phase6-combat-resolve-real-1',
    idempotencyKey: 'idem-phase6-combat-resolve-real-1',
  },
});

function parseArgs(argv = process.argv.slice(2)) {
  const outputIndex = argv.indexOf('--output');
  return {
    output: outputIndex >= 0 ? String(argv[outputIndex + 1] || '').trim() : '',
    quiet: argv.includes('--quiet'),
  };
}

function sha256(value = '') {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`${label} was not JSON: ${error.message}`);
  }
}

function parseJsonBody(record, label) {
  return parseJson(record.response.body, `${label} response`);
}

function assertCondition(condition, message, detail = null) {
  if (condition) return;
  const suffix = detail == null ? '' : `: ${JSON.stringify(detail)}`;
  throw new Error(`${message}${suffix}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    child.once('exit', finish);
    child.kill('SIGTERM');
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      finish();
    }, 3000).unref();
  });
}

async function waitForCondition(check, label, options = {}) {
  const timeoutMs = Math.max(1, Number(options.timeoutMs) || 15000);
  const pollMs = Math.max(5, Number(options.pollMs) || 25);
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(pollMs);
  }
  const suffix = lastError ? `; last error: ${lastError.message}` : '';
  throw new Error(`Timed out waiting for ${label}${suffix}`);
}

function uniqueSorted(values = []) {
  return Array.from(new Set(values.filter(Boolean).map(String))).sort();
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

function getIdempotencyRow(db, playerId, idempotencyKey, options = {}) {
  const row =
    db
      .prepare(
        `
    SELECT playerId, idempotencyKey, commandId, ownerKey, payloadDigest,
           status, responseDigest, responsePayload, statusCode, createdAt, updatedAt
    FROM command_idempotency
    WHERE playerId = ? AND idempotencyKey = ?
  `,
      )
      .get(playerId, idempotencyKey) || null;
  if (!row) return null;
  const responsePayload = row.responsePayload
    ? parseJson(row.responsePayload, 'idempotency responsePayload')
    : null;
  return {
    playerId: row.playerId,
    idempotencyKey: row.idempotencyKey,
    commandId: row.commandId,
    ownerKey: row.ownerKey || '',
    payloadDigest: row.payloadDigest,
    status: row.status,
    responseDigest: row.responseDigest || '',
    statusCode: row.statusCode == null ? null : Number(row.statusCode),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    responsePayloadSha256: sha256(row.responsePayload || ''),
    responseTrace: responsePayload?.command || null,
    ...(options.includeResponsePayload
      ? { responsePayload, responsePayloadRaw: row.responsePayload || '' }
      : {}),
  };
}

function findWorkerTickRow(db, playerId, options = {}) {
  const row = db
    .prepare(
      `
    SELECT idempotencyKey
    FROM command_idempotency
    WHERE playerId = ?
      AND commandId LIKE 'cmd-world-worker-worldWorkerPlayerTick-%'
    ORDER BY createdAt DESC
    LIMIT 1
  `,
    )
    .get(playerId);
  return row ? getIdempotencyRow(db, playerId, row.idempotencyKey, options) : null;
}

function getSharedTerritoryRow(db, territoryId) {
  const row =
    db
      .prepare(
        `
    SELECT id, territory, ownerPlayerId, updatedAt
    FROM shared_world_territories
    WHERE id = ?
  `,
      )
      .get(territoryId) || null;
  return row
    ? {
        ...row,
        territoryJson: parseJson(row.territory, 'shared territory row'),
      }
    : null;
}

function getEncounterRow(db, encounterId) {
  const row =
    db
      .prepare(
        `
    SELECT id, worldId, tileId, encounter, updatedAt
    FROM world_encounters
    WHERE id = ?
  `,
      )
      .get(encounterId) || null;
  return row
    ? {
        ...row,
        encounterJson: parseJson(row.encounter, 'world encounter row'),
      }
    : null;
}

function getPlayerRuntimeRow(db, playerId) {
  const row =
    db
      .prepare(
        `
    SELECT playerId, revision, exploreMissions, worldCombat, updatedAt
    FROM game_states
    WHERE playerId = ?
  `,
      )
      .get(playerId) || null;
  return row
    ? {
        ...row,
        revision: Number(row.revision),
        exploreMissionsJson: parseJson(row.exploreMissions || '[]', 'game_states.exploreMissions'),
        worldCombatJson: parseJson(row.worldCombat || '{}', 'game_states.worldCombat'),
      }
    : null;
}

function getOwnerLockRows(db, ownerKeys = []) {
  if (!ownerKeys.length) return [];
  const placeholders = ownerKeys.map(() => '?').join(', ');
  return db
    .prepare(
      `
    SELECT ownerKey, holderId, scope, lockedAt, expiresAt
    FROM owner_locks
    WHERE ownerKey IN (${placeholders})
    ORDER BY ownerKey ASC
  `,
    )
    .all(...ownerKeys);
}

function summarizeState(state = null, options = {}) {
  if (!state) return null;
  const territoryId = options.territoryId || '';
  const territory = territoryId
    ? (state.territories || []).find((item) => item?.id === territoryId) || null
    : null;
  return {
    playerId: state.playerId || '',
    revision: state.revision ?? null,
    updatedAt: state.updatedAt || '',
    territory: territory
      ? {
          id: territory.id,
          owner: territory.owner,
          ownerPlayerId: territory.ownerPlayerId || '',
          status: territory.status,
        }
      : null,
    missions: (state.exploreMissions || []).map((mission) => ({
      id: mission?.id || '',
      status: mission?.status || '',
      combat: mission?.combat
        ? {
            encounterId: mission.combat.encounterId || '',
            status: mission.combat.status || '',
            battleId: mission.combat.battleId || '',
            battleReportId: mission.combat.battleReportId || '',
          }
        : null,
    })),
    session: state.worldCombat?.session
      ? {
          battleId: state.worldCombat.session.battleId || '',
          encounterId: state.worldCombat.session.encounterId || '',
          status: state.worldCombat.session.status || '',
        }
      : null,
    recentReportIds: (state.worldCombat?.recentReports || []).map((report) => report?.id || ''),
  };
}

function configureFormation(state, personId, soldiers = 500) {
  const cityId = state.activeCityId || 'capital';
  const person = {
    id: personId,
    name: `Phase 6 ${personId}`,
    roles: ['military'],
    attributes: {
      force: 100,
      command: 100,
      speed: 80,
      intelligence: 60,
      politics: 40,
      charisma: 50,
    },
  };
  const formation = {
    cityId,
    slot: 1,
    memberIds: [personId],
    soldierAssignments: { [personId]: soldiers },
  };
  state.famousPeople = [person];
  state.military = {
    ...(state.military || {}),
    soldiers,
    soldierCap: Math.max(soldiers, Number(state.military?.soldierCap) || 0),
    formations: [formation],
  };
  state.cities = state.cities || {};
  state.cities[cityId] = state.cities[cityId] || { id: cityId, territoryId: cityId };
  state.cities[cityId].military = {
    ...(state.cities[cityId].military || {}),
    soldiers,
    soldierCap: Math.max(soldiers, Number(state.cities[cityId].military?.soldierCap) || 0),
    formations: [formation],
  };
  return { cityId, formation, person };
}

function getCapitalCoord(state = {}) {
  const cityId = state.activeCityId || 'capital';
  const territory = (state.territories || []).find(
    (item) => item?.id === cityId || item?.id === 'capital' || item?.type === 'capital',
  );
  return {
    q: Math.floor(Number(territory?.q ?? territory?.x) || 0),
    r: Math.floor(Number(territory?.r ?? territory?.y) || 0),
  };
}

function createEncounterAt(state, encounterId, coord, now, options = {}) {
  const fallback = WorldCombatEncounterService.createEncounter(state, now);
  return WorldCombatEncounterService.normalizeEncounter(
    {
      ...fallback,
      id: encounterId,
      q: coord.q,
      r: coord.r,
      tileId: WorldMapService.getTileId(coord.q, coord.r),
      defender: {
        ...(fallback.defender || {}),
        soldiers: options.defenderSoldiers ?? 1,
        baseSoldiers: options.baseSoldiers ?? 1,
      },
    },
    state,
    now,
  );
}

function chooseMarchEncounter(state, repository, encounterId, now) {
  const origin = getCapitalCoord(state);
  const offsets = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
    [1, -1],
    [-1, 1],
    [2, 0],
    [0, 2],
    [-2, 0],
    [0, -2],
    [2, -1],
    [1, 1],
    [-1, 2],
    [-2, 1],
  ];
  for (const [dq, dr] of offsets) {
    const coord = { q: origin.q + dq, r: origin.r + dr };
    const occupied = repository.worldEncounterRepo.getActiveEncounterAt(coord, {
      refreshRespawns: false,
      projectRespawns: true,
    });
    if (occupied) continue;
    const encounter = createEncounterAt(state, encounterId, coord, now);
    const route = WorldExplorerService.buildManualRoute(origin, coord, state.worldMap?.seed, {
      gameState: state,
      now,
      combatEncounter: encounter,
    });
    if (route.success && Array.isArray(route.route) && route.route.length > 0) {
      return { encounter, origin, routeLength: route.route.length };
    }
  }
  throw new Error('Unable to find a traversable unoccupied coordinate for march handoff evidence');
}

function prepareTerritoryClaimState(repository, playerId, territoryId, now) {
  const state = repository.findByPlayerId(playerId);
  assertCondition(state, `Missing login state for ${playerId}`);
  state.territories = (state.territories || []).filter(
    (territory) => territory?.id !== territoryId,
  );
  state.territories.push({
    id: territoryId,
    x: 1,
    y: 0,
    q: 1,
    r: 0,
    type: 'town',
    owner: 'neutral',
    status: 'discovered',
    naturalName: 'Phase 6 Shared Crossing',
    capitalDistance: 0,
    defense: 0,
  });
  state.warMissions = (state.warMissions || []).filter(
    (mission) => mission?.territoryId !== territoryId,
  );
  const started = TerritoryService.startConquest(state, territoryId, {}, now);
  assertCondition(
    started.success,
    `Failed to prepare claim-ready territory for ${playerId}`,
    started,
  );
  started.mission.status = 'ready';
  started.mission.completesAt = new Date(0).toISOString();
  return summarizeState(repository.save(state), { territoryId });
}

function prepareMarchState(repository, playerId, now) {
  const state = repository.findByPlayerId(playerId);
  assertCondition(state, `Missing login state for ${playerId}`);
  const formation = configureFormation(state, 'phase6-real-march-hero', 500);
  state.exploreMissions = [];
  WorldCombatEncounterService.normalizeCombatState(state, now);
  state.worldCombat.session = null;
  state.worldCombat.recentReports = [];
  const selected = chooseMarchEncounter(state, repository, MARCH_ENCOUNTER_ID, now);
  const encounter = repository.worldEncounterRepo.upsertEncounter(selected.encounter, now);
  const saved = repository.save(state);
  return {
    playerId,
    cityId: formation.cityId,
    origin: selected.origin,
    target: { q: encounter.q, r: encounter.r, tileId: encounter.tileId },
    routeLength: selected.routeLength,
    encounter,
    state: summarizeState(saved),
  };
}

function createCombatMission(state, encounter, missionId, personId, soldiers, options = {}) {
  const origin = getCapitalCoord(state);
  return {
    id: missionId,
    status: 'idle',
    position: { q: encounter.q, r: encounter.r, tileId: encounter.tileId },
    target: { q: encounter.q, r: encounter.r, tileId: encounter.tileId },
    homeOrigin: { ...origin, tileId: WorldMapService.getTileId(origin.q, origin.r) },
    origin: { ...origin, tileId: WorldMapService.getTileId(origin.q, origin.r) },
    formation: { cityId: state.activeCityId || 'capital', slot: 1, memberIds: [personId] },
    formationSnapshot: {
      schema: 'formation-snapshot-v1',
      cityId: state.activeCityId || 'capital',
      slot: 1,
      soldiersCommitted: soldiers,
      soldiersRemaining: soldiers,
      members: [
        {
          personId,
          soldiersCommitted: soldiers,
          soldiersRemaining: soldiers,
        },
      ],
    },
    ...(options.combat ? { combat: options.combat } : {}),
  };
}

function prepareCombatReadyState(repository, playerId, now) {
  const state = repository.findByPlayerId(playerId);
  assertCondition(state, `Missing login state for ${playerId}`);
  const personId = 'phase6-real-combat-hero';
  configureFormation(state, personId, 500);
  const fallback = WorldCombatEncounterService.createEncounter(state, now);
  const encounter = createEncounterAt(
    state,
    COMBAT_ENCOUNTER_ID,
    { q: fallback.q, r: fallback.r },
    now,
  );
  repository.worldEncounterRepo.upsertEncounter(encounter, now);
  WorldCombatEncounterService.normalizeCombatState(state, now);
  state.worldCombat.session = null;
  state.worldCombat.recentReports = [];
  state.exploreMissions = [
    createCombatMission(state, encounter, 'phase6-real-combat-mission', personId, 500),
  ];
  const saved = repository.save(state);
  return {
    playerId,
    encounter,
    missionId: 'phase6-real-combat-mission',
    state: summarizeState(saved),
  };
}

function prepareWorkerState(repository, db, playerId, now) {
  const state = repository.findByPlayerId(playerId);
  assertCondition(state, `Missing worker fixture state for ${playerId}`);
  const personId = 'phase6-real-worker-hero';
  configureFormation(state, personId, 500);
  const fallback = WorldCombatEncounterService.createEncounter(state, now);
  const encounter = createEncounterAt(
    state,
    WORKER_ENCOUNTER_ID,
    { q: fallback.q + 1, r: fallback.r },
    now,
  );
  repository.worldEncounterRepo.upsertEncounter(encounter, now);
  WorldCombatEncounterService.normalizeCombatState(state, now);
  state.worldCombat.session = null;
  state.worldCombat.recentReports = [];
  state.exploreMissions = [
    createCombatMission(state, encounter, 'phase6-real-worker-engaged-mission', personId, 500, {
      combat: {
        encounterId: encounter.id,
        status: 'engaged',
        engagedAt: now.toISOString(),
      },
    }),
  ];
  const saved = repository.save(state);
  const activeAt = new Date().toISOString();
  db.prepare('UPDATE players SET lastActiveAt = ?').run(new Date(0).toISOString());
  db.prepare('UPDATE players SET lastActiveAt = ? WHERE playerId = ?').run(activeAt, playerId);
  return {
    playerId,
    encounter,
    activeAt,
    state: summarizeState(saved),
    rawPlayerRow: getPlayerRuntimeRow(db, playerId),
    rawEncounterRow: getEncounterRow(db, encounter.id),
  };
}

function createApi(baseUrl, token, transport, seed) {
  return new GameAPI(`${baseUrl}/api`, token, {
    timeoutMs: 20000,
    maxRetries: 0,
    transport,
    abortControllerFactory: () => transport.createAbortController(),
    createCommandIdSeed: () => seed,
  });
}

async function loginPlayer(baseUrl, username) {
  const raw = await requestRaw(`${baseUrl}/api/player/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { username, password: '123456' },
  });
  const body = parseJsonBody(raw, `login ${username}`);
  assertCondition(raw.response.status === 200 && body.token, `Real login failed for ${username}`, {
    status: raw.response.status,
    body: raw.response.body,
  });
  return {
    token: body.token,
    playerId: body.playerId,
    evidence: {
      request: raw.request,
      response: {
        status: raw.response.status,
        statusText: raw.response.statusText,
        headers: raw.response.headers,
        bodySha256: sha256(raw.response.body),
        playerId: body.playerId,
      },
    },
  };
}

async function settleApiCall(call) {
  try {
    return { kind: 'resolved', result: await call() };
  } catch (error) {
    return {
      kind: 'rejected',
      status: error?.status ?? null,
      error: error?.payload?.error || error?.code || '',
      message: error?.payload?.message || error?.message || '',
      payload: error?.payload || null,
    };
  }
}

function launchTimedApiCall(index, call) {
  const startedAt = new Date();
  const startedAtMonotonicMs = Number(process.hrtime.bigint()) / 1e6;
  return settleApiCall(call).then((outcome) => {
    const settledAt = new Date();
    const settledAtMonotonicMs = Number(process.hrtime.bigint()) / 1e6;
    return {
      index,
      startedAt: startedAt.toISOString(),
      settledAt: settledAt.toISOString(),
      startedAtMonotonicMs,
      settledAtMonotonicMs,
      outcome,
    };
  });
}

function assertConcurrentLaunchWindow(label, calls, expectedCount) {
  assertCondition(calls.length === expectedCount, `${label} invocation count mismatch`, {
    expectedCount,
    actualCount: calls.length,
  });
  const latestStartedAtMonotonicMs = Math.max(
    ...calls.map((call) => call.startedAtMonotonicMs),
  );
  const earliestSettledAtMonotonicMs = Math.min(
    ...calls.map((call) => call.settledAtMonotonicMs),
  );
  assertCondition(
    latestStartedAtMonotonicMs <= earliestSettledAtMonotonicMs,
    `${label} requests were not all launched before the first response settled`,
    calls,
  );
  return {
    requestCount: calls.length,
    firstStartedAt: calls.reduce(
      (value, call) => (call.startedAt < value ? call.startedAt : value),
      calls[0].startedAt,
    ),
    lastStartedAt: calls.reduce(
      (value, call) => (call.startedAt > value ? call.startedAt : value),
      calls[0].startedAt,
    ),
    firstSettledAt: calls.reduce(
      (value, call) => (call.settledAt < value ? call.settledAt : value),
      calls[0].settledAt,
    ),
    lastSettledAt: calls.reduce(
      (value, call) => (call.settledAt > value ? call.settledAt : value),
      calls[0].settledAt,
    ),
    allRequestsStartedBeforeFirstSettled: true,
  };
}

function assertTraceOwners(label, trace, expectedOwnerKey, expectedOwnerKeys) {
  assertCondition(trace, `${label} response lacked command trace`);
  assertCondition(trace.ownerKey === expectedOwnerKey, `${label} ownerKey mismatch`, trace);
  assertCondition(
    JSON.stringify(uniqueSorted(trace.ownerKeys)) ===
      JSON.stringify(uniqueSorted(expectedOwnerKeys)),
    `${label} ownerKeys mismatch`,
    trace,
  );
}

function assertTerritoryTraceOwners(label, trace, playerId, territoryId, playerIds) {
  const expectedOwnerKey = `territory:${territoryId}`;
  const requiredOwnerKeys = [
    `player:${playerId}`,
    `territory-owner:${playerId}`,
    expectedOwnerKey,
  ];
  const allowedOwnerKeys = new Set([
    ...requiredOwnerKeys,
    ...playerIds.map((candidateId) => `territory-owner:${candidateId}`),
  ]);
  assertCondition(trace, `${label} response lacked command trace`);
  assertCondition(trace.ownerKey === expectedOwnerKey, `${label} ownerKey mismatch`, trace);
  const actualOwnerKeys = uniqueSorted(trace.ownerKeys);
  assertCondition(
    requiredOwnerKeys.every((ownerKey) => actualOwnerKeys.includes(ownerKey)),
    `${label} omitted a required territory owner lock`,
    trace,
  );
  assertCondition(
    actualOwnerKeys.every((ownerKey) => allowedOwnerKeys.has(ownerKey)),
    `${label} carried an unexpected owner lock`,
    trace,
  );
  return actualOwnerKeys;
}

function assertOwnerResolvedBeforeLock(label, trace, expectedOwnerKeys) {
  const phases = Array.isArray(trace?.phases) ? trace.phases : [];
  const resolvingIndex = phases.findIndex((phase) => phase.phase === 'owner_resolving');
  const waitingIndex = phases.findIndex((phase) => phase.phase === 'owner_lock_waiting');
  const lockedIndex = phases.findIndex((phase) => phase.phase === 'owner_locked');
  assertCondition(
    resolvingIndex >= 0 && resolvingIndex < waitingIndex && waitingIndex < lockedIndex,
    `${label} did not resolve owners before acquiring locks`,
    phases,
  );
  assertCondition(
    JSON.stringify(uniqueSorted(phases[lockedIndex].ownerKeys)) ===
      JSON.stringify(uniqueSorted(expectedOwnerKeys)),
    `${label} owner_locked phase did not carry the expected owner set`,
    phases[lockedIndex],
  );
  return { resolvingIndex, waitingIndex, lockedIndex };
}

function assertRawReplaySet(label, records, expectedCount) {
  assertCondition(records.length === expectedCount, `${label} raw request count mismatch`, {
    expectedCount,
    actualCount: records.length,
  });
  assertCondition(
    records.every((record) => record.response.status === 200),
    `${label} returned non-200`,
    records,
  );
  const body = records[0]?.response.body || '';
  assertCondition(
    records.every((record) => record.response.body === body),
    `${label} raw responses differed`,
  );
}

async function main() {
  const args = parseArgs();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wxgames-step3-phase6-real-server-'));
  const dbPath = path.join(tempRoot, 'civilization.db');
  const logsDbPath = path.join(tempRoot, 'observability.db');
  const configRuntime = publishConfigRuntime(tempRoot, { source: 'step3-phase6-real-server' });
  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const serverStdout = [];
  const serverStderr = [];
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
  server.stdout.on('data', (chunk) => serverStdout.push(String(chunk)));
  server.stderr.on('data', (chunk) => serverStderr.push(String(chunk)));

  let worker = null;
  let evidence = null;
  let verificationDb = null;
  try {
    const healthBefore = await waitForHealth(`${baseUrl}/api/health`, server);
    const loginA = await loginPlayer(baseUrl, 'test1');
    const loginB = await loginPlayer(baseUrl, 'test2');
    const loginMarch = await loginPlayer(baseUrl, 'test3');
    const loginCombat = await loginPlayer(baseUrl, 'codexqa');

    const opened = openDatabase(Database, dbPath);
    verificationDb = opened.db;
    const repository = new GameStateRepository(verificationDb);
    repository.init();

    const setupNow = new Date();
    const territorySetupA = prepareTerritoryClaimState(
      repository,
      loginA.playerId,
      TERRITORY_ID,
      setupNow,
    );
    const territorySetupB = prepareTerritoryClaimState(
      repository,
      loginB.playerId,
      TERRITORY_ID,
      setupNow,
    );

    const transportRecords = [];
    const transport = H5GameApiTransportAdapter.fromRuntime(globalThis, {
      fetch: createRecordingFetch(transportRecords),
    });
    const apiA = createApi(baseUrl, loginA.token, transport, 'phase6-territory-a');
    const apiB = createApi(baseUrl, loginB.token, transport, 'phase6-territory-b');
    const [territoryCallA, territoryCallB] = await Promise.all([
      launchTimedApiCall(0, () => apiA.claimConquest(TERRITORY_ID, IDS.territoryA)),
      launchTimedApiCall(1, () => apiB.claimConquest(TERRITORY_ID, IDS.territoryB)),
    ]);
    const territoryConcurrentWindow = assertConcurrentLaunchWindow(
      'Territory contest',
      [territoryCallA, territoryCallB],
      2,
    );
    const territoryOutcomeA = territoryCallA.outcome;
    const territoryOutcomeB = territoryCallB.outcome;
    const territoryRecordsA = getCommandRecords(transportRecords, IDS.territoryA.commandId);
    const territoryRecordsB = getCommandRecords(transportRecords, IDS.territoryB.commandId);
    assertCondition(
      territoryRecordsA.length === 1 && territoryRecordsB.length === 1,
      'Territory contest did not produce one real response per player',
      { territoryRecordsA, territoryRecordsB },
    );
    const territoryBodyA = parseJsonBody(territoryRecordsA[0], 'territory player A');
    const territoryBodyB = parseJsonBody(territoryRecordsB[0], 'territory player B');
    const territoryResults = [
      {
        label: 'player A',
        login: loginA,
        outcome: territoryOutcomeA,
        record: territoryRecordsA[0],
        body: territoryBodyA,
      },
      {
        label: 'player B',
        login: loginB,
        outcome: territoryOutcomeB,
        record: territoryRecordsB[0],
        body: territoryBodyB,
      },
    ];
    const territoryWinner = territoryResults.find(
      (result) => result.record.response.status === 200,
    );
    const territoryContender = territoryResults.find(
      (result) => result.record.response.status === 409,
    );
    assertCondition(
      territoryWinner && territoryContender,
      'Territory contest did not produce exactly one 200 winner and one 409 contender',
      territoryResults.map((result) => ({
        label: result.label,
        status: result.record.response.status,
        outcome: result.outcome,
      })),
    );
    assertCondition(
      territoryWinner.outcome.kind === 'resolved',
      'Territory winner GameAPI call rejected',
      territoryWinner.outcome,
    );
    assertCondition(
      territoryContender.outcome.kind === 'rejected' &&
        territoryContender.outcome.status === 409 &&
        territoryContender.outcome.error === 'TERRITORY_ALREADY_OCCUPIED',
      'Territory contender did not surface TERRITORY_ALREADY_OCCUPIED',
      territoryContender.outcome,
    );
    const territoryPlayerIds = [loginA.playerId, loginB.playerId];
    const territoryOwnerKeysA = assertTerritoryTraceOwners(
      'territory player A',
      territoryBodyA.command,
      loginA.playerId,
      TERRITORY_ID,
      territoryPlayerIds,
    );
    const territoryOwnerKeysB = assertTerritoryTraceOwners(
      'territory player B',
      territoryBodyB.command,
      loginB.playerId,
      TERRITORY_ID,
      territoryPlayerIds,
    );
    const territoryPhaseOrderA = assertOwnerResolvedBeforeLock(
      'territory player A',
      territoryBodyA.command,
      territoryOwnerKeysA,
    );
    const territoryPhaseOrderB = assertOwnerResolvedBeforeLock(
      'territory player B',
      territoryBodyB.command,
      territoryOwnerKeysB,
    );
    const sharedTerritoryRow = getSharedTerritoryRow(verificationDb, TERRITORY_ID);
    assertCondition(
      sharedTerritoryRow?.ownerPlayerId === territoryWinner.login.playerId,
      'Shared territory row did not retain the contest winner',
      sharedTerritoryRow,
    );
    const territoryIdempotencyA = getIdempotencyRow(
      verificationDb,
      loginA.playerId,
      IDS.territoryA.idempotencyKey,
    );
    const territoryIdempotencyB = getIdempotencyRow(
      verificationDb,
      loginB.playerId,
      IDS.territoryB.idempotencyKey,
    );
    const territoryWinnerIdempotency =
      territoryWinner.login.playerId === loginA.playerId
        ? territoryIdempotencyA
        : territoryIdempotencyB;
    const territoryContenderIdempotency =
      territoryContender.login.playerId === loginA.playerId
        ? territoryIdempotencyA
        : territoryIdempotencyB;
    assertCondition(
      territoryWinnerIdempotency?.status === 'committed' &&
        territoryWinnerIdempotency.statusCode === 200,
      'Territory winner idempotency row mismatch',
      territoryWinnerIdempotency,
    );
    assertCondition(
      territoryContenderIdempotency?.status === 'rejected' &&
        territoryContenderIdempotency.statusCode === 409,
      'Territory contender idempotency row mismatch',
      territoryContenderIdempotency,
    );
    const territoryStateA = summarizeState(repository.findByPlayerId(loginA.playerId), {
      territoryId: TERRITORY_ID,
    });
    const territoryStateB = summarizeState(repository.findByPlayerId(loginB.playerId), {
      territoryId: TERRITORY_ID,
    });
    const territoryWinnerState =
      territoryWinner.login.playerId === loginA.playerId ? territoryStateA : territoryStateB;
    const territoryContenderState =
      territoryContender.login.playerId === loginA.playerId ? territoryStateA : territoryStateB;
    assertCondition(
      territoryWinnerState.territory?.status === 'occupied',
      'Territory winner state was not occupied',
      territoryWinnerState,
    );
    assertCondition(
      territoryContenderState.territory?.status === 'contested',
      'Territory contender state mutated after rejection',
      territoryContenderState,
    );

    const marchSetup = prepareMarchState(repository, loginMarch.playerId, new Date());
    const marchApi = createApi(baseUrl, loginMarch.token, transport, 'phase6-march-handoff');
    const marchOutcome = await settleApiCall(() =>
      marchApi.startWorldMarch({
        targetQ: marchSetup.target.q,
        targetR: marchSetup.target.r,
        cityId: marchSetup.cityId,
        formationSlot: 1,
        commandOptions: IDS.march,
      }),
    );
    const marchRecords = getCommandRecords(transportRecords, IDS.march.commandId);
    assertCondition(
      marchOutcome.kind === 'resolved',
      'March handoff command rejected',
      marchOutcome,
    );
    assertCondition(
      marchRecords.length === 1 && marchRecords[0].response.status === 200,
      'March handoff did not return one real 200 response',
      marchRecords,
    );
    const marchRequestBody = parseJson(marchRecords[0].request.body, 'march request');
    const marchResponseBody = parseJsonBody(marchRecords[0], 'march handoff');
    assertCondition(
      !marchRequestBody.encounterId &&
        !marchRequestBody.combatEncounterId &&
        !marchRequestBody.clientCommand?.payload?.encounterId &&
        !marchRequestBody.clientCommand?.payload?.combatEncounterId,
      'March handoff request unexpectedly carried an encounter id',
      marchRequestBody,
    );
    const marchOwnerKeys = [`encounter:${MARCH_ENCOUNTER_ID}`, `player:${loginMarch.playerId}`];
    assertTraceOwners(
      'march handoff',
      marchResponseBody.command,
      `encounter:${MARCH_ENCOUNTER_ID}`,
      marchOwnerKeys,
    );
    const marchPhaseOrder = assertOwnerResolvedBeforeLock(
      'march handoff',
      marchResponseBody.command,
      marchOwnerKeys,
    );
    assertCondition(
      marchResponseBody.mission?.combat?.encounterId === MARCH_ENCOUNTER_ID,
      'March domain result did not receive the pre-lock encounter handoff',
      marchResponseBody.mission,
    );
    const marchIdempotency = getIdempotencyRow(
      verificationDb,
      loginMarch.playerId,
      IDS.march.idempotencyKey,
    );
    assertCondition(
      marchIdempotency?.ownerKey === `encounter:${MARCH_ENCOUNTER_ID}` &&
        marchIdempotency.status === 'committed',
      'March idempotency owner mismatch',
      marchIdempotency,
    );

    const combatSetup = prepareCombatReadyState(repository, loginCombat.playerId, new Date());
    const combatApi = createApi(baseUrl, loginCombat.token, transport, 'phase6-combat-start');
    const combatBefore = summarizeState(repository.findByPlayerId(loginCombat.playerId));
    const combatStartOutcome = await settleApiCall(() =>
      combatApi.startWorldCombat({
        encounterId: COMBAT_ENCOUNTER_ID,
        missionId: combatSetup.missionId,
        formationSlot: 1,
        cityId: 'capital',
        targetQ: combatSetup.encounter.q,
        targetR: combatSetup.encounter.r,
        commandOptions: IDS.combatStart,
      }),
    );
    assertCondition(
      combatStartOutcome.kind === 'resolved',
      'startWorldCombat rejected',
      combatStartOutcome,
    );
    const combatStartRecords = getCommandRecords(transportRecords, IDS.combatStart.commandId);
    assertCondition(
      combatStartRecords.length === 1 && combatStartRecords[0].response.status === 200,
      'startWorldCombat did not return one real 200 response',
      combatStartRecords,
    );
    const combatStartBody = parseJsonBody(combatStartRecords[0], 'startWorldCombat');
    assertTraceOwners(
      'startWorldCombat',
      combatStartBody.command,
      `encounter:${COMBAT_ENCOUNTER_ID}`,
      [`encounter:${COMBAT_ENCOUNTER_ID}`, `player:${loginCombat.playerId}`],
    );
    const combatAfterStart = summarizeState(repository.findByPlayerId(loginCombat.playerId));
    assertCondition(
      combatAfterStart.revision === combatBefore.revision + 1,
      'startWorldCombat did not commit exactly one player revision',
      { combatBefore, combatAfterStart },
    );

    const resolveInputStream = [
      { tick: 0, type: 'order', side: 0, order: 'allOut' },
      { tick: 0, type: 'order', side: 1, order: 'allOut' },
    ];
    const resolveTimedCalls = await Promise.all(
      Array.from({ length: 50 }, (_, index) => {
        const resolveApi = createApi(
          baseUrl,
          loginCombat.token,
          transport,
          `phase6-combat-resolve-${index}`,
        );
        return launchTimedApiCall(index, () =>
          resolveApi.resolveWorldCombat(
            combatStartBody.battleId,
            resolveInputStream,
            COMBAT_ENCOUNTER_ID,
            IDS.combatResolve,
          ),
        );
      }),
    );
    const resolveConcurrentWindow = assertConcurrentLaunchWindow(
      'resolveWorldCombat duplicate storm',
      resolveTimedCalls,
      50,
    );
    const resolveOutcomeSummary = resolveTimedCalls.map((call) => ({
      index: call.index,
      startedAt: call.startedAt,
      settledAt: call.settledAt,
      kind: call.outcome.kind,
      status: call.outcome.status ?? (call.outcome.kind === 'resolved' ? 200 : null),
      error: call.outcome.error || '',
      resultSha256:
        call.outcome.kind === 'resolved' ? sha256(JSON.stringify(call.outcome.result)) : '',
    }));
    const firstResolveOutcome = resolveTimedCalls[0].outcome;
    const replayOutcomeSummary = resolveOutcomeSummary.slice(1);
    assertCondition(
      resolveOutcomeSummary.every((outcome) => outcome.kind === 'resolved'),
      'A concurrent resolveWorldCombat request rejected',
      resolveOutcomeSummary,
    );
    const resolveRecords = getCommandRecords(transportRecords, IDS.combatResolve.commandId);
    assertRawReplaySet('resolveWorldCombat duplicate storm', resolveRecords, 50);
    const resolveBody = parseJsonBody(resolveRecords[0], 'resolveWorldCombat');
    assertTraceOwners(
      'resolveWorldCombat',
      resolveBody.command,
      `encounter:${COMBAT_ENCOUNTER_ID}`,
      [`encounter:${COMBAT_ENCOUNTER_ID}`, `player:${loginCombat.playerId}`],
    );
    const combatAfterResolve = summarizeState(repository.findByPlayerId(loginCombat.playerId));
    const combatEncounterAfter = getEncounterRow(verificationDb, COMBAT_ENCOUNTER_ID);
    const combatResolveIdempotency = getIdempotencyRow(
      verificationDb,
      loginCombat.playerId,
      IDS.combatResolve.idempotencyKey,
    );
    assertCondition(
      combatAfterResolve.revision === combatAfterStart.revision + 1,
      'Resolve storm committed more than one player revision',
      { combatAfterStart, combatAfterResolve },
    );
    assertCondition(
      combatAfterResolve.recentReportIds.length === 1,
      'Resolve storm wrote more than one player report',
      combatAfterResolve,
    );
    assertCondition(
      combatEncounterAfter?.encounterJson?.status === 'resolved',
      'Resolve storm did not resolve the shared encounter',
      combatEncounterAfter,
    );
    assertCondition(
      combatResolveIdempotency?.status === 'committed' &&
        combatResolveIdempotency.statusCode === 200,
      'Resolve storm idempotency row mismatch',
      combatResolveIdempotency,
    );

    const workerTimeoutBase = new Date(
      Date.now() - WorldCombatEncounterService.AUTO_ENGAGE_FALLBACK_MS - 60 * 1000,
    );
    const workerSetup = prepareWorkerState(
      repository,
      verificationDb,
      loginCombat.playerId,
      workerTimeoutBase,
    );
    const workerOwnerKeys = [`encounter:${WORKER_ENCOUNTER_ID}`, `player:${loginCombat.playerId}`];
    const workerLocksBefore = getOwnerLockRows(verificationDb, workerOwnerKeys);
    const workerStdout = [];
    const workerStderr = [];
    const workerStartedAt = new Date().toISOString();
    worker = spawn(process.execPath, ['backend/world-worker.js'], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        DB_PATH: dbPath,
        LOGS_DB_PATH: logsDbPath,
        JWT_SECRET: LOCAL_JWT_SECRET,
        CONFIG_RELEASE_GATE: 'required',
        CONFIG_RELEASE_HISTORY_PATH: configRuntime.historyPath,
        CONFIG_ACTIVE_RELEASE_PATH: configRuntime.activePath,
        WORLD_WORKER_INTERVAL_MS: String(WORKER_INTERVAL_MS),
        WORLD_WORKER_ACTIVE_WINDOW_MS: String(60 * 60 * 1000),
        WORLD_WORKER_ACTIVE_LIMIT: '1',
        WORLD_WORKER_SLOW_TICK_MS: String(30 * 1000),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    worker.stdout.on('data', (chunk) => workerStdout.push(String(chunk)));
    worker.stderr.on('data', (chunk) => workerStderr.push(String(chunk)));
    const workerPid = worker.pid;

    const workerObserved = await waitForCondition(
      () => {
        if (worker.exitCode !== null) {
          throw new Error(
            `world worker exited early with code ${worker.exitCode}: ${workerStderr.join('')}`,
          );
        }
        const idempotency = findWorkerTickRow(verificationDb, loginCombat.playerId);
        const encounter = getEncounterRow(verificationDb, WORKER_ENCOUNTER_ID);
        const state = repository.findByPlayerId(loginCombat.playerId);
        if (
          idempotency?.status !== 'committed' ||
          encounter?.encounterJson?.status !== 'resolved' ||
          state?.worldCombat?.recentReports?.length !== 1
        )
          return null;
        return { idempotency, encounter, state: summarizeState(state) };
      },
      'real world worker force-settle',
      { timeoutMs: 20000, pollMs: 20 },
    );
    await stopChild(worker);
    const workerStoppedAt = new Date().toISOString();
    const workerIdempotency = findWorkerTickRow(verificationDb, loginCombat.playerId, {
      includeResponsePayload: true,
    });
    const workerAfter = summarizeState(repository.findByPlayerId(loginCombat.playerId));
    const workerRawPlayerAfter = getPlayerRuntimeRow(verificationDb, loginCombat.playerId);
    const workerRawEncounterAfter = getEncounterRow(verificationDb, WORKER_ENCOUNTER_ID);
    const workerLocksAfter = getOwnerLockRows(verificationDb, workerOwnerKeys);
    assertCondition(
      workerIdempotency?.responseTrace,
      'Worker idempotency row lacked a command trace',
      workerIdempotency,
    );
    assertTraceOwners(
      'worldWorkerPlayerTick',
      workerIdempotency.responseTrace,
      `player:${loginCombat.playerId}`,
      workerOwnerKeys,
    );
    const workerPhaseOrder = assertOwnerResolvedBeforeLock(
      'worldWorkerPlayerTick',
      workerIdempotency.responseTrace,
      workerOwnerKeys,
    );
    assertCondition(
      workerAfter.revision === workerSetup.state.revision + 1,
      'Worker force-settle committed more than one player revision',
      { before: workerSetup.state, after: workerAfter },
    );
    assertCondition(
      workerAfter.recentReportIds.length === 1,
      'Worker force-settle did not write exactly one report',
      workerAfter,
    );
    assertCondition(
      workerRawEncounterAfter?.encounterJson?.status === 'resolved',
      'Worker force-settle did not resolve the shared encounter',
      workerRawEncounterAfter,
    );
    assertCondition(
      workerLocksBefore.length === 0 && workerLocksAfter.length === 0,
      'Worker owner locks leaked outside command execution',
      { workerLocksBefore, workerLocksAfter },
    );

    const healthAfter = await requestRaw(`${baseUrl}/api/health`);
    assertCondition(
      healthAfter.response.status === 200,
      'Real server health failed after worker verification',
      healthAfter,
    );

    evidence = {
      schema: 'step3-phase6-real-server-evidence-v1',
      generatedAt: new Date().toISOString(),
      integrity: {
        stubFree: true,
        serverEntry: 'backend/server.js',
        serverPid: server.pid,
        workerEntry: 'backend/world-worker.js',
        workerPid,
        processExecPath: process.execPath,
        repoRoot: REPO_ROOT,
        tempRoot,
        dbPath,
        logsDbPath,
        port,
        configRuntime,
        setupMode:
          'production repositories and domain services against the same temporary SQLite database',
        fixtureSetup:
          'direct deterministic repository setup before requests; no route, handler, pipeline, server, worker, or transport replacement',
        clientPath: 'GameAPI -> ClientCommandSender -> H5GameApiTransportAdapter -> global fetch',
        captureMode:
          'real fetch plus Response.clone raw capture; real server and worker child processes',
      },
      healthBefore,
      healthAfter,
      logins: {
        territoryPlayerA: loginA.evidence,
        territoryPlayerB: loginB.evidence,
        marchPlayer: loginMarch.evidence,
        combatAndWorkerPlayer: loginCombat.evidence,
      },
      territoryContest: {
        territoryId: TERRITORY_ID,
        setup: { playerA: territorySetupA, playerB: territorySetupB },
        concurrentWindow: territoryConcurrentWindow,
        playerA: {
          ids: IDS.territoryA,
          outcome: territoryOutcomeA,
          rawRequests: territoryRecordsA,
          responseTrace: territoryBodyA.command,
          phaseOrder: territoryPhaseOrderA,
          idempotency: territoryIdempotencyA,
          stateAfter: territoryStateA,
        },
        playerB: {
          ids: IDS.territoryB,
          outcome: territoryOutcomeB,
          rawRequests: territoryRecordsB,
          responseTrace: territoryBodyB.command,
          phaseOrder: territoryPhaseOrderB,
          idempotency: territoryIdempotencyB,
          stateAfter: territoryStateB,
        },
        sharedRow: sharedTerritoryRow,
        assertion: {
          requestStatuses: territoryResults.map((result) => result.record.response.status),
          winnerPlayerId: territoryWinner.login.playerId,
          contenderPlayerId: territoryContender.login.playerId,
          contenderStatus: 409,
          contenderError: territoryContender.body.error,
          sharedOwnerPlayerId: sharedTerritoryRow.ownerPlayerId,
          allRequestsStartedBeforeFirstSettled:
            territoryConcurrentWindow.allRequestsStartedBeforeFirstSettled,
          contenderStateStayedContested:
            territoryContenderState.territory?.status === 'contested',
        },
      },
      marchEncounterHandoff: {
        ids: IDS.march,
        setup: marchSetup,
        outcome: marchOutcome,
        rawRequests: marchRecords,
        requestBody: marchRequestBody,
        responseTrace: marchResponseBody.command,
        idempotency: marchIdempotency,
        phaseOrder: marchPhaseOrder,
        assertion: {
          requestEncounterIdOmitted: true,
          coordinate: marchSetup.target,
          resolvedEncounterId: MARCH_ENCOUNTER_ID,
          ownerKeys: marchResponseBody.command.ownerKeys,
          ownerResolvedBeforeLock: true,
        },
      },
      encounterResolveStorm: {
        encounterId: COMBAT_ENCOUNTER_ID,
        setup: combatSetup,
        beforeStart: combatBefore,
        start: {
          ids: IDS.combatStart,
          outcome: combatStartOutcome,
          rawRequests: combatStartRecords,
          responseTrace: combatStartBody.command,
          battleId: combatStartBody.battleId,
          after: combatAfterStart,
          idempotency: getIdempotencyRow(
            verificationDb,
            loginCombat.playerId,
            IDS.combatStart.idempotencyKey,
          ),
        },
        resolve: {
          ids: IDS.combatResolve,
          inputStream: resolveInputStream,
          concurrentWindow: resolveConcurrentWindow,
          invocationOutcomes: resolveOutcomeSummary,
          firstOutcome: firstResolveOutcome,
          replayOutcomes: replayOutcomeSummary,
          rawRequests: resolveRecords,
          responseTrace: resolveBody.command,
          idempotency: combatResolveIdempotency,
          encounterAfter: combatEncounterAfter,
          stateAfter: combatAfterResolve,
        },
        assertion: {
          realHttpRequestCount: resolveRecords.length,
          allStatuses: resolveRecords.map((record) => record.response.status),
          rawResponsesIdentical: true,
          allRequestsStartedBeforeFirstSettled:
            resolveConcurrentWindow.allRequestsStartedBeforeFirstSettled,
          playerRevisionDelta: combatAfterResolve.revision - combatAfterStart.revision,
          reportCount: combatAfterResolve.recentReportIds.length,
          sharedEncounterStatus: combatEncounterAfter.encounterJson.status,
        },
      },
      worldWorkerForceSettle: {
        playerId: loginCombat.playerId,
        encounterId: WORKER_ENCOUNTER_ID,
        process: {
          entry: 'backend/world-worker.js',
          pid: workerPid,
          startedAt: workerStartedAt,
          stoppedAt: workerStoppedAt,
          intervalMs: WORKER_INTERVAL_MS,
          activeWindowMs: 60 * 60 * 1000,
          activeLimit: 1,
          exitCode: worker.exitCode,
          signalCode: worker.signalCode,
          stopped: worker.exitCode !== null || worker.signalCode !== null,
          stdout: workerStdout.join(''),
          stderr: workerStderr.join(''),
        },
        before: {
          setup: workerSetup,
          ownerLocks: workerLocksBefore,
        },
        observedBeforeStop: workerObserved,
        after: {
          state: workerAfter,
          rawPlayerRow: workerRawPlayerAfter,
          rawEncounterRow: workerRawEncounterAfter,
          ownerLocks: workerLocksAfter,
        },
        idempotency: workerIdempotency,
        responseTrace: workerIdempotency.responseTrace,
        phaseOrder: workerPhaseOrder,
        assertion: {
          ownerKeys: workerIdempotency.responseTrace.ownerKeys,
          ownerResolvedBeforeLock: true,
          playerRevisionDelta: workerAfter.revision - workerSetup.state.revision,
          reportCount: workerAfter.recentReportIds.length,
          sharedEncounterStatus: workerRawEncounterAfter.encounterJson.status,
          ownerLocksReleased: workerLocksAfter.length === 0,
        },
      },
      assertion: {
        passed: true,
        stubFree: true,
        territoryContestClosed: true,
        marchEncounterHandoffClosed: true,
        encounterResolveStormClosed: true,
        worldWorkerForceSettleClosed: true,
        sameServerHealthBeforeAndAfter: true,
      },
    };
  } finally {
    await stopChild(worker);
    if (verificationDb?.open) verificationDb.close();
    await stopChild(server);
  }

  evidence.serverOutput = {
    stdout: serverStdout.join(''),
    stderr: serverStderr.join(''),
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
  assertOwnerResolvedBeforeLock,
  assertRawReplaySet,
  getCommandRecords,
  getIdempotencyRow,
  parseArgs,
  prepareCombatReadyState,
  prepareMarchState,
  prepareTerritoryClaimState,
  prepareWorkerState,
};
