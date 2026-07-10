'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { scanRouteOwnedPersistence } = require('./check-route-owned-persistence');

test('route-owned persistence gate classifies login and reports zero gameplay violations', () => {
  const report = scanRouteOwnedPersistence();
  assert.equal(report.summary.totalViolations, 0);
  assert.equal(report.summary.classifiedPermanentExceptions >= 2, true);
  assert.equal(report.findings.some((finding) => finding.inventoryId === 'server:player-login'), true);
});

test('route-owned persistence FIRE: gameplay route repository.save is blocked', () => {
  const report = scanRouteOwnedPersistence({
    files: ['backend/routes/gameRoutes.js'],
    readFile: () => "function route() {\n  repository.save(gameState);\n}\n",
  });

  assert.equal(report.summary.totalViolations, 1);
  assert.match(report.violations[0].kind, /repository-save/);
});

test('route-owned persistence FIRE: admin config route cannot touch GameStateRepository', () => {
  const report = scanRouteOwnedPersistence({
    files: ['backend/routes/adminRoutes.js'],
    readFile: () => "function publish() {\n  GameStateRepository.save(state);\n}\n",
  });

  assert.equal(report.summary.totalViolations, 1);
  assert.match(report.violations[0].kind, /gamestate-repository-write/);
});

test('route-owned persistence FIRE: login pattern requires a permanent exception', () => {
  const report = scanRouteOwnedPersistence({
    exceptions: [],
    files: ['backend/routes/playerRoutes.js'],
    readFile: () => [
      ...Array.from({ length: 70 }, () => ''),
      '  withPlayerStateLock(username, () => repository.save(gameState));',
    ].join('\n'),
  });

  assert.equal(report.summary.totalViolations, 2);
  assert.match(report.violations.map((finding) => finding.reason).join('\n'), /missing permanent exception/);
});
