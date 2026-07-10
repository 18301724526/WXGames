'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildEvidenceFromSource } = require('./verify-step4-phase3-real-server');

function createPassingSourceEvidence() {
  return {
    schema: 'step3-phase6-real-server-evidence-v1',
    integrity: {
      stubFree: true,
      serverEntry: 'backend/server.js',
      serverPid: 12345,
      workerEntry: 'backend/world-worker.js',
      workerPid: 23456,
      setupMode: 'production repositories and domain services against the same temporary SQLite database',
      fixtureSetup:
        'direct deterministic repository setup before requests; no route, handler, pipeline, server, worker, or transport replacement',
      clientPath: 'GameAPI -> ClientCommandSender -> H5GameApiTransportAdapter -> global fetch',
    },
    healthBefore: { response: { status: 200 } },
    healthAfter: { response: { status: 200 } },
    worldWorkerForceSettle: {
      process: {
        entry: 'backend/world-worker.js',
        pid: 23456,
        stopped: true,
      },
      after: {
        ownerLocks: [],
      },
      idempotency: {
        status: 'committed',
      },
      responseTrace: {
        schema: 'game-command-summary-v1',
        type: 'worldWorkerPlayerTick',
        committed: true,
        phases: [
          { phase: 'received' },
          { phase: 'idempotency_checking' },
          { phase: 'owner_resolving' },
          { phase: 'owner_locked' },
          { phase: 'domain_executing' },
          { phase: 'committing' },
          { phase: 'projecting' },
          { phase: 'responding' },
        ],
      },
      assertion: {
        ownerResolvedBeforeLock: true,
        ownerLocksReleased: true,
        playerRevisionDelta: 1,
        reportCount: 1,
        sharedEncounterStatus: 'resolved',
      },
    },
    assertion: {
      passed: true,
      stubFree: true,
      worldWorkerForceSettleClosed: true,
      sameServerHealthBeforeAndAfter: true,
    },
  };
}

test('Step4 Phase3 evidence wrapper derives assertions from measured source fields', () => {
  const evidence = buildEvidenceFromSource(createPassingSourceEvidence());

  assert.deepEqual(evidence.integrity, {
    stubFree: true,
    productionServer: true,
    productionWorker: true,
    productionRepositories: true,
    clientPath: 'GameAPI -> ClientCommandSender -> H5GameApiTransportAdapter -> global fetch',
  });
  assert.deepEqual(evidence.workerOwnership.assertion, {
    workerForceSettleClosed: true,
    usesCommandExecutionPipeline: true,
    ownerLocksVerifiedBySourceEvidence: true,
  });
  assert.deepEqual(evidence.assertion, {
    realServer: true,
    realWorker: true,
    noMocksOrStubs: true,
    workerWritesThroughPipeline: true,
    passed: true,
  });
  assert.ok(evidence.assertionSources.productionServer.length >= 1);
});

test('Step4 Phase3 evidence wrapper fails instead of emitting assertions without source fields', () => {
  const source = createPassingSourceEvidence();
  delete source.integrity.workerEntry;

  assert.throws(
    () => buildEvidenceFromSource(source),
    /productionWorker.*missing source field/,
  );
});

test('Step4 Phase3 evidence wrapper fails when measured pipeline evidence does not pass', () => {
  const source = createPassingSourceEvidence();
  source.worldWorkerForceSettle.responseTrace.phases = [{ phase: 'received' }];

  assert.throws(
    () => buildEvidenceFromSource(source),
    /measured assertions did not pass/,
  );
});
