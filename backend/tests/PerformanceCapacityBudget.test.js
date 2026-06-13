const test = require('node:test');
const assert = require('node:assert/strict');

const PerformanceCapacityBudget = require('../services/PerformanceCapacityBudget');

test('PerformanceCapacityBudget accepts API, save, and world-window payloads inside budget', () => {
  const apiReport = PerformanceCapacityBudget.checkApiRequest({
    method: 'POST',
    path: '/api/game/action',
    body: { action: 'build', target: 'farm' },
    response: { success: true, gameState: { resources: { food: 100 } } },
    durationMs: 400,
  });
  const saveReport = PerformanceCapacityBudget.checkSaveState({
    playerId: 'budget-player',
    revision: 3,
    worldMap: { tiles: Array.from({ length: 12 }, (_, index) => ({ id: `tile_${index}` })) },
    exploreMissions: [{ id: 'mission-1' }],
  });
  const windowReport = PerformanceCapacityBudget.checkWorldMapWindow({
    signature: 'window-v1',
    visibleTiles: Array.from({ length: 64 }, (_, index) => ({ id: `tile_${index}` })),
    chunks: [
      { tiles: Array.from({ length: 16 }, (_, index) => ({ id: `chunk-a-${index}` })) },
      { tileCount: 24 },
    ],
  });
  const combined = PerformanceCapacityBudget.combineReports([apiReport, saveReport, windowReport], {
    scenario: 'within-budget',
  });

  assert.equal(combined.ok, true);
  assert.deepEqual(combined.failedKeys, []);
  assert.equal(PerformanceCapacityBudget.assertReport(combined), combined);
});

test('PerformanceCapacityBudget fails loudly for slow action and oversized payloads', () => {
  const report = PerformanceCapacityBudget.checkApiRequest({
    method: 'POST',
    path: '/api/game/action',
    body: { action: 'debug', huge: 'x'.repeat(32) },
    response: { huge: 'x'.repeat(64) },
    durationMs: 1500,
  }, {
    actionLatencyMs: 100,
    apiRequestBytes: 20,
    apiResponseBytes: 20,
  });

  assert.equal(report.ok, false);
  assert.equal(report.failedKeys.includes('api.action-latency'), true);
  assert.equal(report.failedKeys.includes('api.request-bytes'), true);
  assert.equal(report.failedKeys.includes('api.response-bytes'), true);
  assert.throws(
    () => PerformanceCapacityBudget.assertReport(report),
    /Performance capacity budget exceeded/,
  );
});

test('PerformanceCapacityBudget checks save size, total map size, and mission count', () => {
  const report = PerformanceCapacityBudget.checkSaveState({
    playerId: 'oversized-save',
    worldMap: { tiles: Array.from({ length: 4 }, (_, index) => ({ id: `tile_${index}` })) },
    exploreMissions: [{ id: 'a' }, { id: 'b' }],
    warMissions: [{ id: 'c' }],
    huge: 'x'.repeat(256),
  }, {
    saveStateBytes: 100,
    worldMapTiles: 3,
    missions: 2,
  });

  assert.equal(report.ok, false);
  assert.equal(report.failedKeys.includes('save.serializable-size'), true);
  assert.equal(report.failedKeys.includes('save.world-map-tiles'), true);
  assert.equal(report.failedKeys.includes('save.mission-count'), true);
});

test('PerformanceCapacityBudget checks world-map window and chunk budgets', () => {
  const report = PerformanceCapacityBudget.checkWorldMapWindow({
    visibleTiles: Array.from({ length: 5 }, (_, index) => ({ id: `tile_${index}` })),
    chunks: [
      { tileCount: 3 },
      { tiles: Array.from({ length: 5 }, (_, index) => ({ id: `chunk-b-${index}` })) },
    ],
  }, {
    worldMapWindowTiles: 4,
    activeWorldMapChunks: 1,
    worldMapChunkTiles: 4,
  });

  assert.equal(report.ok, false);
  assert.equal(report.failedKeys.includes('world-window.tile-count'), true);
  assert.equal(report.failedKeys.includes('world-window.active-chunks'), true);
  assert.equal(report.failedKeys.includes('world-window.chunk-tile-count'), true);
});

test('PerformanceCapacityBudget checks command evidence and replay summary budgets', () => {
  const compactReport = PerformanceCapacityBudget.checkCommandEvidence({
    clientInput: {
      schema: 'world-map-input-intent-v1',
      target: { kind: 'tile', tileId: 'tile_3_-2', targetQ: 3, targetR: -2 },
      picking: { inputEpoch: 9, signature: 'sig-9' },
    },
    replaySummary: {
      schema: 'command-replay-correlation-v1',
      requestId: 'api-9',
      action: 'startWorldMarch',
      clientInput: {
        schema: 'world-map-input-intent-v1',
        target: { kind: 'tile', tileId: 'tile_3_-2', targetQ: 3, targetR: -2 },
      },
      authority: {
        commandId: 'cmd_123',
        status: 'accepted',
        command: { type: 'startWorldMarch', actorId: 'explore-1' },
      },
      matches: { requestId: true, clientInput: true, authorityCommand: true },
    },
  });

  assert.equal(compactReport.ok, true);
  assert.equal(compactReport.failedKeys.length, 0);

  const oversizedReport = PerformanceCapacityBudget.checkCommandEvidence({
    clientInput: {
      schema: 'world-map-input-intent-v1',
      action: { type: 'startWorldMarch', rendererPayload: 'must-not-pass' },
      picking: {
        counts: { targets: 20 },
        targets: Array.from({ length: 20 }, (_, index) => ({ index })),
      },
      huge: 'x'.repeat(4096),
    },
    replaySummary: {
      schema: 'command-replay-correlation-v1',
      authority: {
        commandId: 'cmd_oversized',
        timeline: { route: Array.from({ length: 100 }, (_, index) => ({ index })) },
      },
      debug: {
        response: { gameState: { worldMap: { tiles: Array.from({ length: 100 }, (_, index) => ({ id: `tile_${index}` })) } } },
      },
      huge: 'x'.repeat(4096),
    },
  });

  assert.equal(oversizedReport.ok, false);
  assert.equal(oversizedReport.failedKeys.includes('command-evidence.client-input-bytes'), true);
  assert.equal(oversizedReport.failedKeys.includes('command-evidence.replay-summary-bytes'), true);
  assert.equal(oversizedReport.failedKeys.includes('command-evidence.no-renderer-payload'), true);
  assert.equal(oversizedReport.failedKeys.includes('command-evidence.no-heavy-authority-payload'), true);
});

test('PerformanceCapacityBudget summarizes failed checks for observability snapshots', () => {
  const report = PerformanceCapacityBudget.checkApiRequest({
    path: '/api/game/action',
    durationMs: 200,
  }, {
    actionLatencyMs: 100,
  });
  const summary = PerformanceCapacityBudget.summarizeReport(report);

  assert.equal(summary.ok, false);
  assert.deepEqual(summary.failedKeys, ['api.action-latency']);
  assert.equal(summary.failedChecks[0].actual, 200);
  assert.equal(summary.meta.scope, 'api');
  assert.equal(typeof summary.checkedAt, 'string');
});
