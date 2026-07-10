'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const { inspectHandlerBoundary } = require('./check-handler-boundary');

const HANDLER_FILE = 'backend/application/commands/BuildBuildingCommandHandler.js';

function live(file) {
  return fs.readFileSync(file, 'utf8');
}

test('handler boundary gate accepts the live command/action closure', () => {
  const report = inspectHandlerBoundary();

  assert.equal(report.summary.totalViolations, 0, JSON.stringify(report.violations, null, 2));
});

test('handler boundary gate fires on direct repository.save in handler', () => {
  const source = live(HANDLER_FILE).replace(
    'generateCommandEvents(context.state);',
    'this.repository.save(context.state);\n    generateCommandEvents(context.state);',
  );
  const report = inspectHandlerBoundary({ sources: { [HANDLER_FILE]: source } });

  assert.ok(report.violations.some((finding) => (
    finding.file === HANDLER_FILE
    && finding.kind === 'repository-save'
  )));
});

test('handler boundary gate fires on direct withOwnerLocks in handler', () => {
  const source = live(HANDLER_FILE).replace(
    'generateCommandEvents(context.state);',
    'withOwnerLocks([\'player:p\'], \'synthetic\', () => {});\n    generateCommandEvents(context.state);',
  );
  const report = inspectHandlerBoundary({ sources: { [HANDLER_FILE]: source } });

  assert.ok(report.violations.some((finding) => finding.kind === 'owner-lock-api'));
});

test('handler boundary gate fires on direct withPlayerStateLock in handler', () => {
  const source = live(HANDLER_FILE).replace(
    'generateCommandEvents(context.state);',
    'withPlayerStateLock(\'p\', () => {});\n    generateCommandEvents(context.state);',
  );
  const report = inspectHandlerBoundary({ sources: { [HANDLER_FILE]: source } });

  assert.ok(report.violations.some((finding) => finding.kind === 'player-state-lock'));
});

test('handler boundary gate fires on OwnerLockRepository in handler', () => {
  const source = live(HANDLER_FILE).replace(
    'generateCommandEvents(context.state);',
    'OwnerLockRepository.acquire([\'player:p\']);\n    generateCommandEvents(context.state);',
  );
  const report = inspectHandlerBoundary({ sources: { [HANDLER_FILE]: source } });

  assert.ok(report.violations.some((finding) => finding.kind === 'owner-lock-repository'));
});

test('handler boundary gate follows imported helper/service closure', () => {
  const helperFile = 'backend/application/commands/SyntheticHandlerPersistenceHelper.js';
  const source = live(HANDLER_FILE).replace(
    'const { requireOwnerContext } = require(\'./CommandOwnerContext\');',
    'const { requireOwnerContext } = require(\'./CommandOwnerContext\');\nconst SyntheticHandlerPersistenceHelper = require(\'./SyntheticHandlerPersistenceHelper\');',
  ).replace(
    'generateCommandEvents(context.state);',
    'SyntheticHandlerPersistenceHelper.persist(this.repository, context.state);\n    generateCommandEvents(context.state);',
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
  const report = inspectHandlerBoundary({
    sources: {
      [HANDLER_FILE]: source,
      [helperFile]: helper,
    },
  });

  assert.ok(report.violations.some((finding) => (
    finding.file === helperFile
    && finding.kind === 'repository-save'
  )));
});
