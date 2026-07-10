'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const { inspectRouteMigration } = require('./check-command-route-migration');

test('command route migration guard accepts the live Phase 5 slice', () => {
  assert.deepEqual(inspectRouteMigration().violations, []);
});

test('command route migration guard fires on handler-owned persistence', () => {
  const file = 'backend/application/commands/BuildBuildingCommandHandler.js';
  const live = fs.readFileSync(file, 'utf8');
  const violations = inspectRouteMigration({
    sources: {
      [file]: live.replace(
        'generateCommandEvents(context.state);',
        'this.repository.save(context.state);\n    generateCommandEvents(context.state);',
      ),
    },
  }).violations;
  assert.ok(violations.includes(
    'BuildBuildingCommandHandler still owns repository, lock, trace, save, or projection work',
  ));
});

test('command route migration guard fires when a private action enters the deferred branch', () => {
  const file = 'backend/routes/gameRoutes.js';
  const live = fs.readFileSync(file, 'utf8');
  const violations = inspectRouteMigration({
    sources: {
      [file]: live.replace(
        "  'claimConquest',",
        "  'claimConquest',\n  'advanceEra',",
      ),
    },
  }).violations;
  assert.ok(violations.some((violation) => violation.startsWith('Phase 6 deferred actions changed:')));
});
