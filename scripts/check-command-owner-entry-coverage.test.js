'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { COMMAND_OWNER_RULES } = require('../backend/application/commands/CommandOwnerResolver');
const { inspectCoverage, runCheck } = require('./check-command-owner-entry-coverage');

test('command owner entry coverage accepts the live Phase 6 wiring', () => {
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

test('command owner entry coverage fires on direct worker persistence', () => {
  const file = 'backend/services/realtime/WorldWorkerService.js';
  const live = require('node:fs').readFileSync(file, 'utf8');
  const violations = inspectCoverage({
    sources: {
      [file]: live.replace(
        'this.reportCommandEntry(envelope);',
        'this.repository.save({});\n    this.reportCommandEntry(envelope);',
      ),
    },
  }).violations;

  assert.ok(violations.includes(
    'world worker retains direct persistence or player-only lock orchestration',
  ));
});

test('command owner entry coverage fires on social computation before owner locking', () => {
  const file = 'backend/services/realtime/WorldWorkerService.js';
  const live = require('node:fs').readFileSync(file, 'utf8');
  const violations = inspectCoverage({
    sources: {
      [file]: live.replace(
        'const playerIds = uniqueSorted(states.map((state) => state?.playerId));',
        'this.worldSocialTickService.advanceRelationships([], {});\n      const playerIds = uniqueSorted(states.map((state) => state?.playerId));',
      ),
    },
  }).violations;

  assert.ok(violations.includes(
    'world worker computes shared social mutations before owner locking',
  ));
});
