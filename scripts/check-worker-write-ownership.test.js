'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const { inspectWorkerWriteOwnership } = require('./check-worker-write-ownership');

const WORKER_SERVICE = 'backend/services/realtime/WorldWorkerService.js';

function live(file) {
  return fs.readFileSync(file, 'utf8');
}

test('worker write ownership gate accepts the live worker closure', () => {
  const report = inspectWorkerWriteOwnership();

  assert.equal(report.summary.totalViolations, 0, JSON.stringify(report.violations, null, 2));
});

test('worker write ownership gate fires on direct repository.save in worker tick code', () => {
  const source = live(WORKER_SERVICE).replace(
    'this.running = true;',
    'this.repository.save({ playerId: "synthetic" });\n    this.running = true;',
  );
  const report = inspectWorkerWriteOwnership({ sources: { [WORKER_SERVICE]: source } });

  assert.ok(report.violations.some((finding) => finding.kind === 'repository-save'));
});

test('worker write ownership gate fires when pipeline execute is removed', () => {
  const source = live(WORKER_SERVICE).replace(
    'return this.commandExecutionPipeline.execute(envelope, definition, {',
    'return definition.execute({ envelope, ownerResolution: { ownerKeys: [] } });',
  );
  const report = inspectWorkerWriteOwnership({ sources: { [WORKER_SERVICE]: source } });

  assert.ok(report.violations.some((finding) => finding.kind === 'missing-pipeline-execute'));
  assert.ok(report.violations.some((finding) => finding.kind === 'direct-definition-execute'));
});

test('worker write ownership gate fires when a worker command split is removed', () => {
  const source = live(WORKER_SERVICE).replace(/'worldWorkerDiplomacyTick',/g, "'syntheticRemovedDiplomacyTick',");
  const report = inspectWorkerWriteOwnership({ sources: { [WORKER_SERVICE]: source } });

  assert.ok(report.violations.some((finding) => (
    finding.kind === 'missing-worker-command'
    && finding.evidence === 'worldWorkerDiplomacyTick'
  )));
});

test('worker write ownership gate follows imported helper/service closure', () => {
  const helperFile = 'backend/services/realtime/SyntheticWorkerPersistenceHelper.js';
  const source = live(WORKER_SERVICE).replace(
    "const { requireOwnerContext } = require('../../application/commands/CommandOwnerContext');",
    "const { requireOwnerContext } = require('../../application/commands/CommandOwnerContext');\nconst SyntheticWorkerPersistenceHelper = require('./SyntheticWorkerPersistenceHelper');",
  ).replace(
    'this.running = true;',
    'SyntheticWorkerPersistenceHelper.persist(this.repository, { playerId: "synthetic" });\n    this.running = true;',
  );
  const helper = [
    "'use strict';",
    'module.exports = {',
    '  persist(repository, state) {',
    '    repository.save(state);',
    '  },',
    '};',
    '',
  ].join('\n');
  const report = inspectWorkerWriteOwnership({
    sources: {
      [WORKER_SERVICE]: source,
      [helperFile]: helper,
    },
  });

  assert.ok(report.violations.some((finding) => (
    finding.file === helperFile
    && finding.kind === 'repository-save'
  )));
});
