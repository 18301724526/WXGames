'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const {
  FILES,
  inspectFrontendCommandSemantics,
} = require('./check-frontend-command-semantics');

function live(file) {
  return fs.readFileSync(file, 'utf8');
}

test('frontend command semantics gate accepts the live command-submit paths', () => {
  const report = inspectFrontendCommandSemantics();

  assert.equal(report.summary.totalViolations, 0, JSON.stringify(report.violations, null, 2));
});

test('frontend command semantics gate fires when dispatcher normalizeAction is removed', () => {
  const source = live(FILES.dispatcher).replace(
    'const normalizedAction = ClientCommandSemantics?.normalizeAction?.(action) || action;',
    'const normalizedAction = action;',
  );
  const report = inspectFrontendCommandSemantics({ sources: { [FILES.dispatcher]: source } });

  assert.ok(report.violations.some((finding) => finding.kind === 'missing-normalize-action'));
});

test('frontend command semantics gate fires on dispatcher command disabled early return', () => {
  const source = live(FILES.dispatcher).replace(
    'if (!this.canHandle(action, context)) return false;',
    'if (!this.canHandle(action, context)) return false;\n      if (action.disabled) return true;',
  );
  const report = inspectFrontendCommandSemantics({ sources: { [FILES.dispatcher]: source } });

  assert.ok(report.violations.some((finding) => finding.kind === 'command-disabled-early-return'));
});

test('frontend command semantics gate fires when a command action leaves COMMAND_ACTION_TYPES', () => {
  const source = live(FILES.semantics).replace("    'startWorldMarch',\n", '');
  const report = inspectFrontendCommandSemantics({ sources: { [FILES.semantics]: source } });

  assert.ok(report.violations.some((finding) => (
    finding.kind === 'missing-command-action-type'
    && finding.evidence === 'startWorldMarch'
  )));
});

test('frontend command semantics gate fires when advanceEra consumes canAdvanceEraNow', () => {
  const source = live(FILES.app).replace(
    '    async advanceEra() {\n                try {',
    '    async advanceEra() {\n                if (!this.canAdvanceEraNow()) return false;\n                try {',
  );
  const report = inspectFrontendCommandSemantics({ sources: { [FILES.app]: source } });

  assert.ok(report.violations.some((finding) => finding.kind === 'advance-era-local-guard'));
});

test('frontend command semantics gate fires on command click target domain disabled', () => {
  const source = live(FILES.controller).replace(
    '    handle_research(action) {\n            const forwarded = this.forward(action);',
    '    handle_research(action) {\n            if (!canResearch) disabled = true;\n            const forwarded = this.forward(action);',
  );
  const report = inspectFrontendCommandSemantics({ sources: { [FILES.controller]: source } });

  assert.ok(report.violations.some((finding) => finding.kind === 'domain-command-target-block'));
});
