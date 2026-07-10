'use strict';

const fs = require('node:fs');
const path = require('node:path');

const liveInventories = require('./command-owner-step1/inventories');
const { buildReport } = require('./report-command-owner-step1');

const REPO_ROOT = path.resolve(__dirname, '..');
const SMOKE_FILE = 'scripts/run-architecture-smoke.js';

const GATE_SCRIPT_BY_ID = Object.freeze({
  'client-command-block-reasons': 'scripts/check-client-command-block-reasons.js',
  'client-command-sender-coverage': 'scripts/check-client-command-sender-coverage.js',
  'command-owner-blocking-map': 'scripts/check-command-owner-blocking-map.js',
  'command-owner-entry-coverage': 'scripts/check-command-owner-entry-coverage.js',
  'command-pipeline-foundation': 'scripts/check-command-pipeline-foundation.js',
  'command-route-migration': 'scripts/check-command-route-migration.js',
});

function isPipelineMigrated(item = {}) {
  return String(item.migrationPhase || '').startsWith('pipeline-migrated-');
}

function uniqueSorted(values = []) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function gateMapEntry(data) {
  const entry = {
    inventoryId: '',
    inventoryKind: '',
    migrationPhase: '',
    sourceReports: [],
    blockingGates: [],
    contracts: [],
    evidence: [],
    ...data,
  };
  entry.sourceReports = Object.freeze(uniqueSorted(data.sourceReports || []));
  entry.blockingGates = Object.freeze(uniqueSorted(data.blockingGates || []));
  entry.contracts = Object.freeze(uniqueSorted(data.contracts || []));
  entry.evidence = Object.freeze(uniqueSorted(data.evidence || []));
  return Object.freeze(entry);
}

function actionUsesSharedOwner(action = {}) {
  const owner = String(action.provisionalOwnerKey || '');
  return /(?:territory|encounter|loot|boss):/.test(owner);
}

function buildBlockingGateMap(inventories = liveInventories) {
  const entries = [];
  const serverEntryById = new Map((inventories.SERVER_WRITE_ENTRIES || [])
    .map((entry) => [entry.inventoryId, entry]));

  (inventories.SERVER_WRITE_ENTRIES || [])
    .filter(isPipelineMigrated)
    .forEach((entry) => {
      const worker = entry.inventoryId === 'worker:world-worker-runtime-writes';
      entries.push(gateMapEntry({
        inventoryId: entry.inventoryId,
        inventoryKind: worker ? 'background-worker-write' : 'server-write',
        migrationPhase: entry.migrationPhase,
        sourceReports: [
          'write-command-inventory',
          'route-write-orchestration',
          'handler-lock-persistence',
          'owner-key-coverage',
          'shared-owner-lookup-coverage',
          'idempotency-coverage',
          'server-fallback-id-classification',
        ],
        blockingGates: worker
          ? [
            'command-owner-blocking-map',
            'command-owner-entry-coverage',
            'command-pipeline-foundation',
          ]
          : [
            'command-owner-blocking-map',
            'command-owner-entry-coverage',
            'command-pipeline-foundation',
            'command-route-migration',
          ],
        contracts: entry.contracts,
        evidence: entry.evidence,
      }));
    });

  (inventories.GAME_ACTIONS || [])
    .filter(isPipelineMigrated)
    .forEach((action) => {
      entries.push(gateMapEntry({
        inventoryId: `game-action:${action.action}`,
        inventoryKind: 'game-action',
        migrationPhase: action.migrationPhase,
        sourceReports: [
          'write-command-inventory',
          'owner-key-coverage',
          'shared-owner-lookup-coverage',
          'idempotency-coverage',
          'server-fallback-id-classification',
          ...(actionUsesSharedOwner(action) ? ['shared-owner-write-coverage'] : []),
        ],
        blockingGates: [
          'command-owner-blocking-map',
          'command-owner-entry-coverage',
          'command-route-migration',
        ],
        contracts: action.contracts,
        evidence: action.evidence
          || serverEntryById.get(action.routeEntry)?.evidence
          || ['backend/routes/gameRoutes.js'],
      }));
    });

  (inventories.FRONTEND_WRITE_HELPERS || [])
    .filter((helper) => helper.submissionClassification === 'through-client-command-sender')
    .forEach((helper) => {
      entries.push(gateMapEntry({
        inventoryId: `frontend-helper:${helper.helper}`,
        inventoryKind: 'frontend-write-helper',
        migrationPhase: 'client-command-sender-migrated-phase2',
        sourceReports: [
          'write-command-inventory',
          'frontend-write-submission-path',
          'idempotency-coverage',
        ],
        blockingGates: [
          'client-command-block-reasons',
          'client-command-sender-coverage',
          'command-owner-blocking-map',
        ],
        contracts: helper.contracts,
        evidence: helper.evidence,
      }));
    });

  (inventories.FRONTEND_COMMAND_PATHS || [])
    .filter((commandPath) => (
      commandPath.classification === 'command-submit'
      && commandPath.submissionClassification === 'through-client-command-sender'
    ))
    .forEach((commandPath) => {
      entries.push(gateMapEntry({
        inventoryId: commandPath.inventoryId,
        inventoryKind: 'frontend-command-path',
        migrationPhase: 'client-command-sender-migrated-phase2',
        sourceReports: [
          'client-command-domain-blockers',
          'client-disabled-command-path',
          'frontend-write-submission-path',
        ],
        blockingGates: [
          'client-command-block-reasons',
          'client-command-sender-coverage',
          'command-owner-blocking-map',
        ],
        contracts: commandPath.contracts,
        evidence: commandPath.evidence || [commandPath.path],
      }));
    });

  return Object.freeze(entries);
}

function collectExpectedInventory(inventories = liveInventories) {
  const server = (inventories.SERVER_WRITE_ENTRIES || [])
    .filter(isPipelineMigrated)
    .map((entry) => ({
      id: entry.inventoryId,
      kind: 'server-write',
      item: entry,
    }));

  const actions = (inventories.GAME_ACTIONS || [])
    .filter(isPipelineMigrated)
    .map((action) => ({
      id: `game-action:${action.action}`,
      kind: 'game-action',
      item: action,
    }));

  const helpers = (inventories.FRONTEND_WRITE_HELPERS || [])
    .filter((helper) => helper.submissionClassification === 'through-client-command-sender')
    .map((helper) => ({
      id: `frontend-helper:${helper.helper}`,
      kind: 'frontend-write-helper',
      item: helper,
    }));

  const paths = (inventories.FRONTEND_COMMAND_PATHS || [])
    .filter((commandPath) => (
      commandPath.classification === 'command-submit'
      && commandPath.submissionClassification === 'through-client-command-sender'
    ))
    .map((commandPath) => ({
      id: commandPath.inventoryId,
      kind: 'frontend-command-path',
      item: commandPath,
    }));

  return Object.freeze([...server, ...actions, ...helpers, ...paths]);
}

function inspectServerOrActionItem(violations, id, item = {}) {
  if (!String(item.commandEnvelopePhase || '').startsWith('blocking-')) {
    violations.push(`${id} lacks blocking envelope enforcement`);
  }
  if (!String(item.ownerResolutionPhase || '').startsWith('blocking-')) {
    violations.push(`${id} lacks blocking owner enforcement`);
  }
  if (item.idempotencyStorePhase !== 'live') {
    violations.push(`${id} idempotency store is not live`);
  }
  if (item.commandPipelinePhase !== 'live') {
    violations.push(`${id} command pipeline is not live`);
  }
}

function inspectFrontendHelper(violations, id, item = {}) {
  if (item.submissionClassification !== 'through-client-command-sender') {
    violations.push(`${id} does not use ClientCommandSender`);
  }
  if (item.idempotencyClassification !== 'client-idempotent') {
    violations.push(`${id} is not client-idempotent`);
  }
  if (!String(item.commandIdSupport || '').includes('commandId')
      || !String(item.commandIdSupport || '').includes('idempotencyKey')) {
    violations.push(`${id} lacks commandId/idempotencyKey support evidence`);
  }
  if (item.domainDisplayCanSuppressCall !== false) {
    violations.push(`${id} can still suppress command submission from domain display state`);
  }
}

function inspectFrontendPath(violations, id, item = {}) {
  if (item.submissionClassification !== 'through-client-command-sender') {
    violations.push(`${id} does not route through ClientCommandSender`);
  }
  if (item.domainDisplayCanSuppressCall !== false) {
    violations.push(`${id} can still suppress command submission from domain display state`);
  }
}

function inspectInventoryItem(violations, expected) {
  const { id, kind, item } = expected;
  if (!id) violations.push(`${kind} has no inventory id`);
  if (!Array.isArray(item.contracts) || item.contracts.length === 0) {
    violations.push(`${id} has no contract ids`);
  }
  if (kind === 'server-write' || kind === 'game-action') inspectServerOrActionItem(violations, id, item);
  else if (kind === 'frontend-write-helper') inspectFrontendHelper(violations, id, item);
  else if (kind === 'frontend-command-path') inspectFrontendPath(violations, id, item);
}

function inspectStep1Report(violations, report) {
  if (report.summary.inventoryDriftFindings !== 0) {
    violations.push(`Step1 inventory drift must be 0, received ${report.summary.inventoryDriftFindings}`);
  }
  const missingAllowlistMetadata = report.checks
    .flatMap((check) => check.findings)
    .filter((finding) => finding.classification === 'allowlist-metadata-missing');
  if (missingAllowlistMetadata.length > 0) {
    violations.push(`allowlist metadata findings remain: ${missingAllowlistMetadata.length}`);
  }
}

function inspectGateMap(options = {}) {
  const inventories = options.inventories || liveInventories;
  const expected = collectExpectedInventory(inventories);
  const expectedIds = new Set(expected.map((item) => item.id));
  const gateMap = options.gateMapEntries || buildBlockingGateMap(inventories);
  const smokeSource = options.smokeSource
    ?? fs.readFileSync(path.join(REPO_ROOT, SMOKE_FILE), 'utf8');
  const report = options.report || buildReport({ repoRoot: REPO_ROOT });
  const violations = [];
  const mapIds = new Map();

  expected.forEach((item) => inspectInventoryItem(violations, item));
  inspectStep1Report(violations, report);

  gateMap.forEach((entry) => {
    if (!entry.inventoryId) {
      violations.push('blocking gate map contains an entry without inventoryId');
      return;
    }
    if (mapIds.has(entry.inventoryId)) {
      violations.push(`${entry.inventoryId} appears more than once in the blocking gate map`);
    }
    mapIds.set(entry.inventoryId, entry);
    if (!expectedIds.has(entry.inventoryId)) {
      violations.push(`${entry.inventoryId} is stale in the blocking gate map`);
    }
    if (!Array.isArray(entry.sourceReports) || entry.sourceReports.length === 0) {
      violations.push(`${entry.inventoryId} has no Step1 source report mapping`);
    }
    if (!Array.isArray(entry.blockingGates) || entry.blockingGates.length === 0) {
      violations.push(`${entry.inventoryId} has no blocking gate mapping`);
    }
    if (!Array.isArray(entry.contracts) || entry.contracts.length === 0) {
      violations.push(`${entry.inventoryId} has no mapped contracts`);
    }
    if (!Array.isArray(entry.evidence) || entry.evidence.length === 0) {
      violations.push(`${entry.inventoryId} has no implementation evidence`);
    }
  });

  expected.forEach(({ id }) => {
    if (!mapIds.has(id)) violations.push(`${id} has no blocking gate map entry`);
  });

  uniqueSorted(gateMap.flatMap((entry) => entry.blockingGates || [])).forEach((gateId) => {
    const script = GATE_SCRIPT_BY_ID[gateId];
    if (!script) {
      violations.push(`unknown blocking gate id in map: ${gateId}`);
      return;
    }
    if (!smokeSource.includes(script)) {
      violations.push(`${gateId} is not wired into architecture smoke`);
    }
  });

  return {
    expectedCount: expected.length,
    gateMapCount: gateMap.length,
    counts: {
      serverWrites: expected.filter((item) => item.kind === 'server-write').length,
      gameActions: expected.filter((item) => item.kind === 'game-action').length,
      frontendWriteHelpers: expected.filter((item) => item.kind === 'frontend-write-helper').length,
      frontendCommandPaths: expected.filter((item) => item.kind === 'frontend-command-path').length,
    },
    gateMap,
    violations,
  };
}

function main() {
  const result = inspectGateMap();
  console.log('[command-owner-blocking-map] blocking gate');
  console.log(`mapped migrated inventory ids: ${result.gateMapCount}`);
  console.log(`expected migrated inventory ids: ${result.expectedCount}`);
  console.log(`server writes: ${result.counts.serverWrites}`);
  console.log(`game actions: ${result.counts.gameActions}`);
  console.log(`frontend write helpers: ${result.counts.frontendWriteHelpers}`);
  console.log(`frontend command paths: ${result.counts.frontendCommandPaths}`);
  console.log(`violations: ${result.violations.length}`);
  result.violations.forEach((violation) => console.error(`- ${violation}`));
  if (result.violations.length > 0) process.exit(1);
  console.log('passed');
}

if (require.main === module) main();

module.exports = {
  GATE_SCRIPT_BY_ID,
  buildBlockingGateMap,
  collectExpectedInventory,
  inspectGateMap,
};
