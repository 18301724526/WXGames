const test = require('node:test');
const assert = require('node:assert/strict');

const CommandReplayCorrelation = require('../services/realtime/CommandReplayCorrelation');
const PerformanceCapacityBudget = require('../services/PerformanceCapacityBudget');
const { CommandAuthorityContract } = require('../services/realtime');

function createClientInputIntent() {
  return {
    schema: 'world-map-input-intent-v1',
    kind: 'tap',
    source: 'worldMapRuntime',
    points: {
      physical: { x: 120, y: 240 },
      layer: { x: 320, y: 440 },
    },
    action: { type: 'startWorldMarch', targetQ: 3, targetR: -2 },
    target: { kind: 'tile', tileId: 'tile_3_-2', targetQ: 3, targetR: -2 },
    picking: { inputEpoch: 11, signature: 'pick-sig-11', counts: { targets: 8 } },
    view: { camera: { x: 5, y: 6 }, viewport: { scale: 1.25 } },
    rendererCache: { targets: Array.from({ length: 100 }, (_, index) => ({ index })) },
  };
}

test('CommandReplayCorrelation reconstructs a world-map command evidence chain', () => {
  const clientInputIntent = createClientInputIntent();
  const authority = CommandAuthorityContract.accept({
    type: 'startWorldMarch',
    actorId: 'explore-1',
    playerId: 'player-1',
    clientInputIntent,
    serverTime: '2026-06-14T00:00:00.000Z',
  });
  const apiLogBody = {
    action: 'startWorldMarch',
    clientRequestId: 'api-9',
    targetQ: 3,
    targetR: -2,
    formationSlot: 1,
    clientInputIntent,
    operationLog: {
      schema: 'server-operation-log-v1',
      requestId: 'api-9',
      action: 'startWorldMarch',
      success: true,
      clientInput: CommandAuthorityContract.summarizeClientInput(clientInputIntent),
      authority: {
        commandId: authority.commandId,
        status: authority.status,
      },
    },
  };
  const clientSnapshot = {
    schema: 'client-operation-log-v1',
    runId: 'run-a',
    entries: [
      {
        seq: 1,
        type: 'worldMap:tapHit',
        detail: { inputIntent: clientInputIntent },
      },
      {
        seq: 2,
        type: 'api:request',
        detail: {
          requestId: 'api-9',
          method: 'POST',
          path: '/game/action',
          action: 'startWorldMarch',
          clientInput: CommandAuthorityContract.summarizeClientInput(clientInputIntent),
        },
      },
      {
        seq: 3,
        type: 'api:response',
        detail: {
          requestId: 'api-9',
          method: 'POST',
          path: '/game/action',
          action: 'startWorldMarch',
          payload: {
            success: true,
            authority: {
              commandId: authority.commandId,
              status: authority.status,
            },
          },
        },
      },
    ],
  };

  const summary = CommandReplayCorrelation.createSummary({
    clientSnapshot,
    apiLog: {
      body: JSON.stringify(apiLogBody),
      response: JSON.stringify({ success: true, authority }),
      statusCode: 200,
      timestamp: '2026-06-14T00:00:01.000Z',
    },
  });

  assert.equal(summary.schema, 'command-replay-correlation-v1');
  assert.equal(summary.requestId, 'api-9');
  assert.equal(summary.action, 'startWorldMarch');
  assert.equal(summary.authority.commandId, authority.commandId);
  assert.equal(summary.authority.status, 'accepted');
  assert.equal(summary.clientInput.picking.signature, 'pick-sig-11');
  assert.equal(summary.clientInput.target.tileId, 'tile_3_-2');
  assert.equal(summary.matches.requestId, true);
  assert.equal(summary.matches.clientInput, true);
  assert.equal(summary.matches.authorityCommand, true);
  assert.equal(JSON.stringify(summary).includes('rendererCache'), false);
  assert.ok(JSON.stringify(summary).length < 4000);
  assert.equal(PerformanceCapacityBudget.checkCommandEvidence({
    clientInput: summary.clientInput,
    replaySummary: summary,
  }).ok, true);
});
