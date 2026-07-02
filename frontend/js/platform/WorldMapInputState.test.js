const test = require('node:test');
const assert = require('node:assert/strict');

const WorldMapInputState = require('./WorldMapInputState');

test('WorldMapInputState owns hit target sync state as one source', () => {
  const state = WorldMapInputState.createWorldMapInputState();
  const baseHitTargets = [{ x: 1, y: 2, action: { type: 'worldMapDrag' } }];
  const hitTargets = [{ x: 3, y: 4, action: { type: 'worldMapDrag' } }];

  const result = WorldMapInputState.commitHitTargetSync(state, {
    actorTargetCount: 0,
    baseHitTargets,
    hitTargets,
    mapTargetCount: 1,
    preserved: true,
    sourceHitTargetCount: 1,
    viewportOffsetX: 10,
    viewportOffsetY: 20,
  });

  assert.equal(result.hitTargets, state.hitTargets);
  assert.deepEqual(WorldMapInputState.getBaseHitTargets(state), baseHitTargets);
  assert.deepEqual(WorldMapInputState.getHitTargets(state), hitTargets);
  assert.deepEqual(WorldMapInputState.getLastHitTargetSync(state), {
    actorTargetCount: 0,
    baseHitTargetCount: 1,
    hitTargetCount: 1,
    mapTargetCount: 1,
    preserved: true,
    sequence: 1,
    sourceHitTargetCount: 1,
    viewportOffsetX: 10,
    viewportOffsetY: 20,
  });
});

test('WorldMapInputState resets input and picking state without renderer fields', () => {
  const state = WorldMapInputState.createWorldMapInputState({
    hitTargets: [{ action: { type: 'openWorldSite' } }],
    baseHitTargets: [{ action: { type: 'openWorldSite' } }],
    lastHitTargetSync: { preserved: true },
    hitTargetSyncSequence: 3,
    inputEpoch: 4,
    inputSequence: 9,
    lastPickingSignature: 'old',
    pickingSnapshot: { inputEpoch: 4 },
    lastInputIntent: { inputId: 'old' },
  });

  WorldMapInputState.resetWorldMapInputState(state, { resetInputSequence: true });

  assert.deepEqual(state.hitTargets, []);
  assert.deepEqual(state.baseHitTargets, []);
  assert.equal(state.lastHitTargetSync, null);
  assert.equal(state.hitTargetSyncSequence, 0);
  assert.equal(state.inputEpoch, 0);
  assert.equal(state.inputSequence, 0);
  assert.equal(state.lastPickingSignature, '');
  assert.equal(state.pickingSnapshot, null);
  assert.equal(state.lastInputIntent, null);
});
