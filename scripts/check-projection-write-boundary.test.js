'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const {
  PROJECTION_FILES,
  inspectProjectionWriteBoundary,
} = require('./check-projection-write-boundary');

const TRACE_FILE = 'backend/application/commands/CommandTrace.js';
const HANDLER_FILE = 'backend/application/commands/BuildBuildingCommandHandler.js';

function live(file) {
  return fs.readFileSync(file, 'utf8');
}

test('projection write boundary gate accepts the live projection and trace boundary', () => {
  const report = inspectProjectionWriteBoundary();

  assert.equal(report.summary.totalViolations, 0, JSON.stringify(report.violations, null, 2));
});

test('projection write boundary gate fires when a trace field is removed', () => {
  const source = live(TRACE_FILE).replace('      responseStatus: this.responseStatus,\n', '');
  const report = inspectProjectionWriteBoundary({ sources: { [TRACE_FILE]: source } });

  assert.ok(report.violations.some((finding) => (
    finding.kind === 'missing-trace-field'
    && finding.evidence === 'responseStatus'
  )));
});

test('projection write boundary gate fires when projection writes state', () => {
  const file = PROJECTION_FILES.find((item) => item.endsWith('ClientGameStateAssembler.js'));
  const source = live(file).replace(
    'function getClientGameState(gameState, projection = {}) {',
    'function getClientGameState(gameState, projection = {}) {\n  repository.save(gameState);',
  );
  const report = inspectProjectionWriteBoundary({ sources: { [file]: source } });

  assert.ok(report.violations.some((finding) => (
    finding.file === file
    && finding.kind === 'projection-write'
  )));
});

test('projection write boundary gate fires when command file outside committer persists', () => {
  const source = live(HANDLER_FILE).replace(
    'generateCommandEvents(context.state);',
    'this.repository.commitCommandState(context.state, {});\n    generateCommandEvents(context.state);',
  );
  const report = inspectProjectionWriteBoundary({ sources: { [HANDLER_FILE]: source } });

  assert.ok(report.violations.some((finding) => (
    finding.file === HANDLER_FILE
    && finding.kind === 'non-committer-command-persistence'
  )));
});
