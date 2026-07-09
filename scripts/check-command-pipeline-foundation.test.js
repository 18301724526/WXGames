'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const { inspectFoundation, runCheck } = require('./check-command-pipeline-foundation');

test('command pipeline foundation guard accepts the live Phase 4 foundation', () => {
  assert.deepEqual(runCheck().violations, []);
});

test('command pipeline foundation guard fires when canonical owner ordering is removed', () => {
  const file = 'backend/repositories/OwnerLockRepository.js';
  const live = fs.readFileSync(file, 'utf8');
  const violations = inspectFoundation({
    sources: {
      [file]: live.replace(
        'Array.from(new Set(normalized)).sort()',
        'Array.from(new Set(normalized)).reverse()',
      ),
    },
  }).violations;

  assert.ok(violations.includes('owner keys are not deduplicated and sorted by one canonical order'));
});

test('command pipeline foundation guard fires when a pipeline stage disappears', () => {
  const file = 'backend/application/commands/CommandExecutionPipeline.js';
  const live = fs.readFileSync(file, 'utf8');
  const violations = inspectFoundation({
    sources: {
      [file]: live.replace("trace.mark('committing')", "trace.mark('commit-hidden')"),
    },
  }).violations;

  assert.ok(violations.includes("pipeline stage marker is missing: trace.mark('committing')"));
});
