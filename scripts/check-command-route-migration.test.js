'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const { inspectRouteMigration } = require('./check-command-route-migration');

test('command route migration guard accepts the live Phase 6 slice', () => {
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

test('command route migration guard fires when a deferred branch is reintroduced', () => {
  const file = 'backend/routes/gameRoutes.js';
  const live = fs.readFileSync(file, 'utf8');
  const violations = inspectRouteMigration({
    sources: {
      [file]: live.replace(
        'const WORLD_COMBAT_ACTIONS',
        "const PHASE6_DEFERRED_ACTIONS = new Set(['advanceEra']);\nconst WORLD_COMBAT_ACTIONS",
      ),
    },
  }).violations;
  assert.ok(violations.includes('game action route retains a Phase 6 deferred branch'));
});

test('command route migration guard fires on world combat handler persistence', () => {
  const file = 'backend/application/commands/WorldCombatCommandHandler.js';
  const live = fs.readFileSync(file, 'utf8');
  const violations = inspectRouteMigration({
    sources: {
      [file]: live.replace(
        'generateCommandEvents(context.state);',
        'context.application.worldEncounterRepo.upsertEncounter({ id: "fake" });\n    generateCommandEvents(context.state);',
      ),
    },
  }).violations;
  assert.ok(violations.includes(
    'WorldCombatCommandHandler persists or locks outside the command pipeline',
  ));
});

test('command route migration guard fires on side-effecting encounter reads', () => {
  const file = 'backend/services/worldCombat/WorldCombatEncounterService.js';
  const live = fs.readFileSync(file, 'utf8');
  const violations = inspectRouteMigration({
    sources: {
      [file]: live.replace('refreshRespawns: false', 'refreshRespawns: true'),
    },
  }).violations;
  assert.ok(violations.includes(
    'WorldCombatEncounterService read options can persist respawns',
  ));
});

test('command route migration guard fires on startup encounter seeding', () => {
  const file = 'backend/repositories/GameStateRepository.js';
  const live = fs.readFileSync(file, 'utf8');
  const violations = inspectRouteMigration({
    sources: {
      [file]: live.replace(
        'this.ensureWorldCitiesSeeded();',
        'this.ensureWorldCitiesSeeded();\n    this.ensureWorldEncountersSeeded();',
      ),
    },
  }).violations;
  assert.ok(violations.includes(
    'GameStateRepository startup can persist encounter planning outside the command pipeline',
  ));
});

test('command route migration guard fires on reset persistence before commit', () => {
  const file = 'backend/application/commands/PlayerResetCommandHandler.js';
  const live = fs.readFileSync(file, 'utf8');
  const violations = inspectRouteMigration({
    sources: {
      [file]: live.replace(
        '    return {\n      success: true,\n      message:',
        '    this.createResetStateForPlayer(context.envelope.playerId);\n    return {\n      success: true,\n      message:',
      ),
    },
  }).violations;
  assert.ok(violations.includes(
    'PlayerResetCommandHandler invokes reset persistence before CommandCommitter',
  ));
});

test('command route migration guard fires when shared mutation owner validation is removed', () => {
  const file = 'backend/application/commands/CommandCommitter.js';
  const live = fs.readFileSync(file, 'utf8');
  const violations = inspectRouteMigration({
    sources: {
      [file]: live.replace('assertSharedMutationOwners(context, sharedMutations);', ''),
    },
  }).violations;
  assert.ok(violations.includes(
    'CommandCommitter is missing assertSharedMutationOwners(context, sharedMutations);',
  ));
});
