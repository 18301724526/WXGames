'use strict';

const fs = require('node:fs');
const path = require('node:path');

const GameActionRegistry = require('../backend/actions/GameActionRegistry');
const {
  COMMAND_OWNER_RULES,
  inspectCommandOwners,
  resolveCommandOwners,
} = require('../backend/application/commands/CommandOwnerResolver');
const {
  GAME_ACTIONS,
  SERVER_WRITE_ENTRIES,
  SHARED_OWNER_LOOKUPS,
} = require('./command-owner-step1/inventories');

const REPO_ROOT = path.resolve(__dirname, '..');
const ENTRY_FILES = Object.freeze([
  'backend/routes/adminRoutes.js',
  'backend/routes/buildingRoutes.js',
  'backend/routes/clientEventsRoutes.js',
  'backend/routes/gameRoutes.js',
  'backend/routes/opsRoutes.js',
  'backend/routes/playerRoutes.js',
  'backend/services/realtime/WorldWorkerService.js',
]);

const ORDER_REQUIREMENTS = Object.freeze([
  ['server:game-action-build-handler', 'backend/routes/gameRoutes.js', 'const traceEnabled = shouldTraceWorldMarch'],
  ['server:game-action-registry', 'backend/routes/gameRoutes.js', 'const traceEnabled = shouldTraceWorldMarch'],
  ['server:game-action-world-combat-bypass', 'backend/routes/gameRoutes.js', 'const traceEnabled = shouldTraceWorldMarch'],
  ['server:game-tasks-claim', 'backend/routes/gameRoutes.js', 'const response = commandExecutionPipeline.execute'],
  ['server:game-heartbeat-march-settlement', 'backend/routes/gameRoutes.js', 'presenceService?.recordHeartbeat?.'],
  ['server:game-heartbeat-client-report', 'backend/routes/gameRoutes.js', 'presenceService?.recordHeartbeat?.'],
  ['server:buildings-build-legacy-route', 'backend/routes/buildingRoutes.js', 'const response = commandExecutionPipeline.execute'],
  ['server:player-login', 'backend/routes/playerRoutes.js', 'const { username, password }'],
  ['server:player-reset', 'backend/routes/playerRoutes.js', 'const response = commandExecutionPipeline.execute'],
  ['admin:ops-login-audit', 'backend/routes/opsRoutes.js', 'if (!opsAuthService)'],
  ['admin:ops-maintenance-state', 'backend/routes/opsRoutes.js', 'opsControlService.setMaintenanceState'],
  ['admin:ops-restart-audit', 'backend/routes/opsRoutes.js', 'const operator = getOperator(req);'],
  ['diagnostic:client-events-ingest', 'backend/routes/clientEventsRoutes.js', 'observabilityService.recordClientEvent'],
  ['diagnostic:client-operation-log-ingest', 'backend/routes/clientEventsRoutes.js', 'logService.logClientOperationSnapshot'],
  ['admin:config-release-publish', 'backend/routes/adminRoutes.js', 'configReleaseService.publishRelease'],
  ['admin:config-release-rollback', 'backend/routes/adminRoutes.js', 'configReleaseService.rollbackRelease'],
]);

const ROUTE_ONLY_TYPES = Object.freeze([
  'clientEventIngest',
  'clientOperationLogIngest',
  'configReleasePublish',
  'configReleaseRollback',
  'heartbeat',
  'heartbeatMarchSettlement',
  'opsLoginAudit',
  'opsMaintenanceSet',
  'opsRestartAccepted',
  'playerLogin',
  'playerReset',
  'worldMarchClientReportIngest',
  'worldWorkerRuntimeTick',
]);

function readSources(overrides = {}) {
  return Object.fromEntries(ENTRY_FILES.map((file) => [
    file,
    overrides[file] ?? fs.readFileSync(path.join(REPO_ROOT, file), 'utf8'),
  ]));
}

function findMatchingParen(source, openIndex) {
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(') depth += 1;
    else if (char === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function extractEntryCalls(source = '', file = '') {
  const calls = [];
  const needle = 'prepareCommandEntry(';
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf(needle, cursor);
    if (start < 0) break;
    const open = start + needle.length - 1;
    const end = findMatchingParen(source, open);
    if (end < 0) {
      calls.push({ file, start, end: source.length, body: source.slice(start), inventoryIds: [] });
      break;
    }
    const body = source.slice(start, end + 1);
    const inventoryIds = Array.from(body.matchAll(/['"]([^'"]+)['"]/g))
      .map((match) => match[1])
      .filter((value) => value.includes(':'));
    calls.push({ file, start, end, body, inventoryIds });
    cursor = end + 1;
  }
  return calls;
}

function payloadFor(type) {
  if (type === 'startConquest' || type === 'claimConquest') return { territoryId: 'territory-1' };
  if (type === 'startWorldCombat' || type === 'resolveWorldCombat') return { encounterId: 'encounter-1' };
  if (type === 'playerLogin' || type === 'opsLoginAudit') return { username: 'player-1' };
  return {};
}

function inspectCoverage(options = {}) {
  const sources = readSources(options.sources || {});
  const rules = options.rules || COMMAND_OWNER_RULES;
  const violations = [];
  const calls = Object.entries(sources).flatMap(([file, source]) => extractEntryCalls(source, file));
  const declaredInventoryIds = new Set(SERVER_WRITE_ENTRIES.map((entry) => entry.inventoryId));

  SERVER_WRITE_ENTRIES.forEach((entry) => {
    const matching = calls.filter((call) => call.body.includes(`'${entry.inventoryId}'`)
      || call.body.includes(`"${entry.inventoryId}"`));
    if (matching.length === 0) violations.push(`${entry.inventoryId} does not enter prepareCommandEntry`);
    if (matching.length > 1) violations.push(`${entry.inventoryId} enters prepareCommandEntry more than once`);
    const envelopePhase = String(entry.commandEnvelopePhase || '');
    const ownerPhase = String(entry.ownerResolutionPhase || '');
    if (entry.migrationPhase === 'pipeline-migrated-phase5') {
      if (!envelopePhase.startsWith('blocking-')) {
        violations.push(`${entry.inventoryId} lacks blocking envelope classification`);
      }
      if (!ownerPhase.startsWith('blocking-')) {
        violations.push(`${entry.inventoryId} lacks blocking owner classification`);
      }
    } else if (entry.inventoryId === 'server:game-action-registry') {
      if (!envelopePhase.includes('blocking-') || !envelopePhase.includes('report-only-')) {
        violations.push(`${entry.inventoryId} lacks mixed Phase 5/6 envelope classification`);
      }
      if (!ownerPhase.includes('blocking-') || !ownerPhase.includes('report-only-')) {
        violations.push(`${entry.inventoryId} lacks mixed Phase 5/6 owner classification`);
      }
    } else {
      if (!envelopePhase.startsWith('report-only-')) {
        violations.push(`${entry.inventoryId} lacks report-only envelope classification`);
      }
      if (!ownerPhase.startsWith('report-only-')) {
        violations.push(`${entry.inventoryId} lacks report-only owner classification`);
      }
    }
  });

  calls.forEach((call) => {
    call.inventoryIds
      .filter((inventoryId) => /^(?:server|admin|diagnostic|worker):/.test(inventoryId))
      .forEach((inventoryId) => {
        if (!declaredInventoryIds.has(inventoryId)) {
          violations.push(`${call.file} reports undeclared inventory ${inventoryId}`);
        }
      });
  });

  ORDER_REQUIREMENTS.forEach(([inventoryId, file, marker]) => {
    const source = sources[file] || '';
    const call = calls.find((item) => item.file === file && item.body.includes(inventoryId));
    const markerIndex = call ? source.indexOf(marker, call.end) : -1;
    if (call && markerIndex < 0) {
      violations.push(`${inventoryId} has no post-entry order marker ${marker}`);
    }
  });

  const workerSource = sources['backend/services/realtime/WorldWorkerService.js'] || '';
  const workerEntryIndex = workerSource.indexOf('const commandEntry = this.prepareRuntimeCommandEntry();');
  const workerWriteIndex = workerSource.indexOf('const gameStates = this.getRecentlyActive(now);');
  if (workerEntryIndex < 0 || workerWriteIndex < 0 || workerEntryIndex > workerWriteIndex) {
    violations.push('world worker command entry is not prepared before runtime writes');
  }

  const currentActions = [...GameActionRegistry.listActions(), 'claimTaskReward', 'startWorldCombat', 'resolveWorldCombat']
    .sort();
  const inventoriedActions = GAME_ACTIONS.map((entry) => entry.action).sort();
  if (JSON.stringify(currentActions) !== JSON.stringify(inventoriedActions)) {
    violations.push('current game actions do not match the Step1 inventory');
  }

  [...inventoriedActions, ...ROUTE_ONLY_TYPES].forEach((type) => {
    if (!rules[type]) violations.push(`${type} has no CommandOwnerResolver declaration`);
  });

  GAME_ACTIONS.forEach(({ action }) => {
    try {
      const result = resolveCommandOwners({
        type: action,
        action,
        playerId: 'player-1',
        payload: payloadFor(action),
      });
      if (!result.ownerKey || !result.ownerKeys.includes(result.ownerKey)) {
        violations.push(`${action} does not resolve exactly one primary owner`);
      }
    } catch (error) {
      violations.push(`${action} owner resolution failed: ${error.code || error.message}`);
    }
  });

  SHARED_OWNER_LOOKUPS
    .filter((lookup) => inventoriedActions.includes(lookup.commandType))
    .filter((lookup) => /^(?:territory|encounter):/.test(lookup.ownerKeyType))
    .forEach((lookup) => {
      const rule = rules[lookup.commandType];
      if (rule?.kind !== 'shared') {
        violations.push(`${lookup.commandType} shared owner declaration is not shared`);
        return;
      }
      const blocked = inspectCommandOwners({
        type: lookup.commandType,
        action: lookup.commandType,
        playerId: 'player-1',
        payload: {},
      });
      if (blocked.status !== 'blocked'
          || blocked.error !== lookup.missingTargetError
          || blocked.ownerKey) {
        violations.push(`${lookup.commandType} missing target does not block without player fallback`);
      }
    });

  const handoff = resolveCommandOwners({
    type: 'startWorldMarch',
    playerId: 'player-1',
    payload: { encounterId: 'encounter-1' },
  });
  if (handoff.ownerKey !== 'encounter:encounter-1'
      || JSON.stringify(handoff.ownerKeys) !== JSON.stringify(['encounter:encounter-1', 'player:player-1'])) {
    violations.push('startWorldMarch encounter handoff is not canonical');
  }

  const worker = inspectCommandOwners({ type: 'worldWorkerRuntimeTick', payload: {} });
  if (worker.status !== 'blocked' || worker.error !== 'OWNER_WORKER_COMMAND_SPLIT_REQUIRED') {
    violations.push('worldWorkerRuntimeTick is not recorded as an explicit split blocker');
  }

  return { calls, violations };
}

function runCheck(options = {}) {
  return inspectCoverage(options);
}

function main() {
  const result = runCheck();
  console.log('[command-owner-entry-coverage] blocking gate');
  console.log(`server write entries: ${SERVER_WRITE_ENTRIES.length}`);
  console.log(`entry calls: ${result.calls.length}`);
  console.log(`violations: ${result.violations.length}`);
  result.violations.forEach((violation) => console.error(`- ${violation}`));
  if (result.violations.length > 0) process.exit(1);
  console.log('passed');
}

if (require.main === module) main();

module.exports = {
  ENTRY_FILES,
  extractEntryCalls,
  inspectCoverage,
  runCheck,
};
