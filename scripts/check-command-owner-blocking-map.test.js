'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const liveInventories = require('./command-owner-step1/inventories');
const {
  buildBlockingGateMap,
  inspectGateMap,
} = require('./check-command-owner-blocking-map');

function cloneInventories() {
  return {
    ...liveInventories,
    SERVER_WRITE_ENTRIES: liveInventories.SERVER_WRITE_ENTRIES.map((entry) => ({ ...entry })),
    GAME_ACTIONS: liveInventories.GAME_ACTIONS.map((action) => ({ ...action })),
    FRONTEND_WRITE_HELPERS: liveInventories.FRONTEND_WRITE_HELPERS.map((helper) => ({ ...helper })),
    FRONTEND_COMMAND_PATHS: liveInventories.FRONTEND_COMMAND_PATHS.map((commandPath) => ({
      ...commandPath,
    })),
  };
}

test('command owner blocking map accepts the live migrated inventory set', () => {
  const result = inspectGateMap();

  assert.deepEqual(result.violations, []);
  assert.equal(result.counts.serverWrites, 9);
  assert.equal(result.counts.gameActions, 29);
  assert.equal(result.counts.frontendWriteHelpers, 33);
  assert.equal(result.counts.frontendCommandPaths, 54);
  assert.equal(result.expectedCount, 125);
  assert.equal(result.gateMapCount, 125);
});

test('command owner blocking map fires when a migrated id has no map entry', () => {
  const gateMap = buildBlockingGateMap()
    .filter((entry) => entry.inventoryId !== 'server:game-action-world-combat-bypass');
  const violations = inspectGateMap({ gateMapEntries: gateMap }).violations;

  assert.ok(violations.includes(
    'server:game-action-world-combat-bypass has no blocking gate map entry',
  ));
});

test('command owner blocking map fires when a migrated entry falls back to report-only', () => {
  const inventories = cloneInventories();
  const entry = inventories.SERVER_WRITE_ENTRIES
    .find((item) => item.inventoryId === 'server:game-action-registry');
  entry.commandEnvelopePhase = 'report-only-normalized';
  const violations = inspectGateMap({
    inventories,
    gateMapEntries: buildBlockingGateMap(inventories),
  }).violations;

  assert.ok(violations.includes(
    'server:game-action-registry lacks blocking envelope enforcement',
  ));
});

test('command owner blocking map fires when a mapped gate leaves architecture smoke', () => {
  const smokeSource = [
    "run('client command sender coverage blocking guard', process.execPath, [",
    "  'scripts/check-client-command-sender-coverage.js',",
    ']);',
    "run('command owner migrated blocking map guard', process.execPath, [",
    "  'scripts/check-command-owner-blocking-map.js',",
    ']);',
  ].join('\n');
  const violations = inspectGateMap({ smokeSource }).violations;

  assert.ok(violations.includes(
    'command-owner-entry-coverage is not wired into architecture smoke',
  ));
  assert.ok(violations.includes(
    'command-route-migration is not wired into architecture smoke',
  ));
});

test('command owner blocking map fires when a frontend helper can domain-block submission', () => {
  const inventories = cloneInventories();
  const helper = inventories.FRONTEND_WRITE_HELPERS
    .find((item) => item.helper === 'startWorldMarch');
  helper.domainDisplayCanSuppressCall = true;
  const violations = inspectGateMap({
    inventories,
    gateMapEntries: buildBlockingGateMap(inventories),
  }).violations;

  assert.ok(violations.includes(
    'frontend-helper:startWorldMarch can still suppress command submission from domain display state',
  ));
});
