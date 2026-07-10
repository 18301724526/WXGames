#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const STEP3_SCRIPT = path.join(__dirname, 'verify-step3-phase6-real-server.js');

function parseArgs(argv = process.argv.slice(2)) {
  const outputIndex = argv.indexOf('--output');
  return {
    output: outputIndex >= 0 ? String(argv[outputIndex + 1] || '').trim() : '',
    quiet: argv.includes('--quiet'),
  };
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function hasValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.length > 0;
  return true;
}

function source(pathName, value) {
  return {
    path: pathName,
    exists: hasValue(value),
    value,
  };
}

function assertMeasuredBoolean(name, value, sources) {
  if (typeof value !== 'boolean') {
    throw new Error(`measured assertion ${name} did not resolve to a boolean`);
  }
  const missing = sources.filter((record) => !record.exists).map((record) => record.path);
  if (missing.length) {
    throw new Error(
      `measured assertion ${name} is missing source field(s): ${missing.join(', ')}`,
    );
  }
  return {
    value,
    sources,
  };
}

function collectPhaseNames(trace) {
  return Array.isArray(trace?.phases)
    ? trace.phases.map((phase) => phase?.phase).filter(Boolean)
    : [];
}

function hasPipelinePhases(trace) {
  const phases = collectPhaseNames(trace);
  return [
    'received',
    'idempotency_checking',
    'owner_resolving',
    'owner_locked',
    'domain_executing',
    'committing',
    'projecting',
    'responding',
  ].every((phase) => phases.includes(phase));
}

function measuredAssertionsFromSource(sourceEvidence) {
  const workerForceSettle = sourceEvidence?.worldWorkerForceSettle || null;
  const workerTrace = workerForceSettle?.responseTrace || null;
  const workerProcess = workerForceSettle?.process || null;
  const workerAssertion = workerForceSettle?.assertion || null;
  const workerIdempotency = workerForceSettle?.idempotency || null;
  const workerLocksAfter = workerForceSettle?.after?.ownerLocks;

  const measurements = {
    stubFree: assertMeasuredBoolean(
      'integrity.stubFree',
      sourceEvidence?.integrity?.stubFree === true && sourceEvidence?.assertion?.stubFree === true,
      [
        source('source.integrity.stubFree', sourceEvidence?.integrity?.stubFree),
        source('source.assertion.stubFree', sourceEvidence?.assertion?.stubFree),
      ],
    ),
    productionServer: assertMeasuredBoolean(
      'integrity.productionServer',
      sourceEvidence?.integrity?.serverEntry === 'backend/server.js'
        && Number.isInteger(sourceEvidence?.integrity?.serverPid)
        && sourceEvidence?.healthBefore?.response?.status === 200
        && sourceEvidence?.healthAfter?.response?.status === 200
        && sourceEvidence?.assertion?.sameServerHealthBeforeAndAfter === true,
      [
        source('source.integrity.serverEntry', sourceEvidence?.integrity?.serverEntry),
        source('source.integrity.serverPid', sourceEvidence?.integrity?.serverPid),
        source('source.healthBefore.response.status', sourceEvidence?.healthBefore?.response?.status),
        source('source.healthAfter.response.status', sourceEvidence?.healthAfter?.response?.status),
        source(
          'source.assertion.sameServerHealthBeforeAndAfter',
          sourceEvidence?.assertion?.sameServerHealthBeforeAndAfter,
        ),
      ],
    ),
    productionWorker: assertMeasuredBoolean(
      'integrity.productionWorker',
      sourceEvidence?.integrity?.workerEntry === 'backend/world-worker.js'
        && Number.isInteger(sourceEvidence?.integrity?.workerPid)
        && workerProcess?.entry === 'backend/world-worker.js'
        && Number.isInteger(workerProcess?.pid)
        && workerProcess?.stopped === true,
      [
        source('source.integrity.workerEntry', sourceEvidence?.integrity?.workerEntry),
        source('source.integrity.workerPid', sourceEvidence?.integrity?.workerPid),
        source('source.worldWorkerForceSettle.process.entry', workerProcess?.entry),
        source('source.worldWorkerForceSettle.process.pid', workerProcess?.pid),
        source('source.worldWorkerForceSettle.process.stopped', workerProcess?.stopped),
      ],
    ),
    productionRepositories: assertMeasuredBoolean(
      'integrity.productionRepositories',
      String(sourceEvidence?.integrity?.setupMode || '').includes('production repositories')
        && String(sourceEvidence?.integrity?.fixtureSetup || '').includes(
          'no route, handler, pipeline, server, worker, or transport replacement',
        ),
      [
        source('source.integrity.setupMode', sourceEvidence?.integrity?.setupMode),
        source('source.integrity.fixtureSetup', sourceEvidence?.integrity?.fixtureSetup),
      ],
    ),
    workerForceSettleClosed: assertMeasuredBoolean(
      'workerOwnership.assertion.workerForceSettleClosed',
      sourceEvidence?.assertion?.worldWorkerForceSettleClosed === true
        && workerAssertion?.sharedEncounterStatus === 'resolved'
        && workerAssertion?.reportCount === 1
        && workerAssertion?.playerRevisionDelta === 1,
      [
        source(
          'source.assertion.worldWorkerForceSettleClosed',
          sourceEvidence?.assertion?.worldWorkerForceSettleClosed,
        ),
        source(
          'source.worldWorkerForceSettle.assertion.sharedEncounterStatus',
          workerAssertion?.sharedEncounterStatus,
        ),
        source('source.worldWorkerForceSettle.assertion.reportCount', workerAssertion?.reportCount),
        source(
          'source.worldWorkerForceSettle.assertion.playerRevisionDelta',
          workerAssertion?.playerRevisionDelta,
        ),
      ],
    ),
    usesCommandExecutionPipeline: assertMeasuredBoolean(
      'workerOwnership.assertion.usesCommandExecutionPipeline',
      workerTrace?.schema === 'game-command-summary-v1'
        && workerTrace?.type === 'worldWorkerPlayerTick'
        && workerTrace?.committed === true
        && workerIdempotency?.status === 'committed'
        && hasPipelinePhases(workerTrace),
      [
        source('source.worldWorkerForceSettle.responseTrace.schema', workerTrace?.schema),
        source('source.worldWorkerForceSettle.responseTrace.type', workerTrace?.type),
        source('source.worldWorkerForceSettle.responseTrace.committed', workerTrace?.committed),
        source('source.worldWorkerForceSettle.idempotency.status', workerIdempotency?.status),
        source(
          'source.worldWorkerForceSettle.responseTrace.phases',
          Array.isArray(workerTrace?.phases) ? workerTrace.phases : undefined,
        ),
      ],
    ),
    ownerLocksVerifiedBySourceEvidence: assertMeasuredBoolean(
      'workerOwnership.assertion.ownerLocksVerifiedBySourceEvidence',
      workerAssertion?.ownerResolvedBeforeLock === true
        && workerAssertion?.ownerLocksReleased === true
        && Array.isArray(workerLocksAfter)
        && workerLocksAfter.length === 0,
      [
        source(
          'source.worldWorkerForceSettle.assertion.ownerResolvedBeforeLock',
          workerAssertion?.ownerResolvedBeforeLock,
        ),
        source(
          'source.worldWorkerForceSettle.assertion.ownerLocksReleased',
          workerAssertion?.ownerLocksReleased,
        ),
        source('source.worldWorkerForceSettle.after.ownerLocks', workerLocksAfter),
      ],
    ),
  };

  const assertion = {
    realServer: measurements.productionServer.value,
    realWorker: measurements.productionWorker.value,
    noMocksOrStubs: measurements.stubFree.value && measurements.productionRepositories.value,
    workerWritesThroughPipeline:
      measurements.workerForceSettleClosed.value
      && measurements.usesCommandExecutionPipeline.value
      && measurements.ownerLocksVerifiedBySourceEvidence.value,
  };
  assertion.passed = Object.values(assertion).every((value) => value === true);

  return {
    measurements,
    integrity: {
      stubFree: measurements.stubFree.value,
      productionServer: measurements.productionServer.value,
      productionWorker: measurements.productionWorker.value,
      productionRepositories: measurements.productionRepositories.value,
      clientPath: sourceEvidence?.integrity?.clientPath || '',
    },
    workerOwnershipAssertion: {
      workerForceSettleClosed: measurements.workerForceSettleClosed.value,
      usesCommandExecutionPipeline: measurements.usesCommandExecutionPipeline.value,
      ownerLocksVerifiedBySourceEvidence: measurements.ownerLocksVerifiedBySourceEvidence.value,
    },
    assertion,
  };
}

function buildEvidenceFromSource(sourceEvidence) {
  assertCondition(sourceEvidence?.assertion?.passed === true, 'source Phase6 evidence did not pass');
  assertCondition(
    sourceEvidence?.assertion?.worldWorkerForceSettleClosed === true,
    'source Phase6 evidence did not close worker force-settle',
  );
  const workerForceSettle = sourceEvidence.worldWorkerForceSettle || null;
  const measured = measuredAssertionsFromSource(sourceEvidence);
  const evidence = {
    schema: 'step4-phase3-real-server-evidence-v1',
    generatedAt: new Date().toISOString(),
    sourceScript: 'scripts/verify-step3-phase6-real-server.js',
    sourceSchema: sourceEvidence.schema,
    integrity: measured.integrity,
    workerOwnership: {
      commandTypes: [
        'worldWorkerPlayerTick',
        'worldWorkerPersonUpdate',
        'worldWorkerDiplomacyTick',
      ],
      forceSettle: workerForceSettle,
      assertion: measured.workerOwnershipAssertion,
    },
    sourceAssertions: sourceEvidence.assertion,
    assertionSources: Object.fromEntries(
      Object.entries(measured.measurements).map(([name, measurement]) => [name, measurement.sources]),
    ),
    assertion: measured.assertion,
  };

  assertCondition(evidence.assertion.passed === true, 'Step4 Phase3 measured assertions did not pass');
  return evidence;
}

function main() {
  const args = parseArgs();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wxgame-step4-phase3-evidence-'));
  const step3Output = path.join(tempRoot, 'step3-phase6-source-evidence.json');
  const result = spawnSync(process.execPath, [
    STEP3_SCRIPT,
    '--output',
    step3Output,
    '--quiet',
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status === null ? 1 : result.status);
  }
  const sourceEvidence = JSON.parse(fs.readFileSync(step3Output, 'utf8'));
  const evidence = buildEvidenceFromSource(sourceEvidence);

  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  if (args.output) {
    const outputPath = path.resolve(REPO_ROOT, args.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, serialized, 'utf8');
  }
  if (!args.quiet) process.stdout.write(serialized);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  buildEvidenceFromSource,
  main,
  measuredAssertionsFromSource,
  parseArgs,
};
