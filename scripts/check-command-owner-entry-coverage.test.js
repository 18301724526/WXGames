'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { COMMAND_OWNER_RULES } = require('../backend/application/commands/CommandOwnerResolver');
const { inspectCoverage, runCheck } = require('./check-command-owner-entry-coverage');

test('command owner entry coverage accepts the live report-only Phase 3 wiring', () => {
  assert.deepEqual(runCheck().violations, []);
});

test('command owner entry coverage fires when a real inventory entry stops reporting', () => {
  const file = 'backend/routes/playerRoutes.js';
  const live = require('node:fs').readFileSync(file, 'utf8');
  const violations = inspectCoverage({
    sources: {
      [file]: live.replace('server:player-reset', 'server:player-reset-shadow'),
    },
  }).violations;

  assert.ok(violations.includes('server:player-reset does not enter prepareCommandEntry'));
  assert.ok(violations.includes(`${file} reports undeclared inventory server:player-reset-shadow`));
});

test('command owner entry coverage fires on a fake player fallback for shared combat', () => {
  const violations = inspectCoverage({
    rules: {
      ...COMMAND_OWNER_RULES,
      startWorldCombat: { kind: 'player' },
    },
  }).violations;

  assert.ok(violations.includes('startWorldCombat shared owner declaration is not shared'));
});
