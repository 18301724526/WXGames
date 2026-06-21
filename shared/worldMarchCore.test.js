const test = require('node:test');
const assert = require('node:assert/strict');

const WorldMarchCore = require('./worldMarchCore');

function createMission(overrides = {}) {
  return {
    id: 'explore-1',
    kind: 'worldExplore',
    mode: 'manual',
    status: 'active',
    origin: { q: 0, r: 0, tileId: 'tile_0_0' },
    position: { q: 0, r: 0, tileId: 'tile_0_0' },
    target: { q: 3, r: 0, tileId: 'tile_3_0' },
    route: [
      { q: 1, r: 0, tileId: 'tile_1_0', step: 1 },
      { q: 2, r: 0, tileId: 'tile_2_0', step: 2 },
      { q: 3, r: 0, tileId: 'tile_3_0', step: 3 },
    ],
    stepDurationSeconds: 10,
    startedAt: '2026-06-06T00:00:00.000Z',
    nextStepAt: '2026-06-06T00:00:10.000Z',
    completesAt: '2026-06-06T00:00:30.000Z',
    ...overrides,
  };
}

test('worldMarchCore uses the unified finished status set as arrival progress sentinel', () => {
  for (const status of ['ready', 'idle', 'cancelled']) {
    const progress = WorldMarchCore.getMissionProgress(createMission({ status }), Date.parse('2026-06-06T00:00:05.000Z'));

    assert.equal(progress.progress, 1);
    assert.equal(progress.segmentProgress, 1);
    assert.equal(progress.segmentIndex, 2);
  }

  const active = WorldMarchCore.getMissionProgress(createMission({ status: 'active' }), Date.parse('2026-06-06T00:00:05.000Z'));
  assert.equal(active.progress > 0, true);
  assert.equal(active.progress < 1, true);
});

test('worldMarchCore floors stepDurationSeconds to milliseconds with a 1000ms minimum', () => {
  assert.equal(WorldMarchCore.getMissionStepDurationMs(createMission({ stepDurationSeconds: 10 })), 10000);
  assert.equal(WorldMarchCore.getMissionStepDurationMs(createMission({ stepDurationSeconds: 0.5 })), 1000);
  assert.equal(WorldMarchCore.getMissionStepDurationMs(createMission({ stepDurationSeconds: 1.9 })), 1900);
});

test('worldMarchCore starts paths from mission.origin before mission.position', () => {
  const path = WorldMarchCore.getMissionPath(createMission({
    origin: { q: -2, r: 0, tileId: 'stale-origin' },
    position: { q: 9, r: 9, tileId: 'stale-position' },
    route: [{ q: -1, r: 0, tileId: 'tile_-1_0', step: 1 }],
  }));

  assert.equal(path[0].tileId, 'tile_-2_0');
  assert.equal(path[1].tileId, 'tile_-1_0');
});

test('worldMarchCore produces deterministic continuous position and route reveal data', () => {
  const nowMs = Date.parse('2026-06-06T00:00:15.000Z');
  const state = WorldMarchCore.computeMarchState(createMission(), nowMs);

  assert.equal(state.current.q > 1, true);
  assert.equal(state.current.q < 2, true);
  assert.deepEqual(state.revealedTileIds, ['tile_1_0']);
  assert.deepEqual(state.renderReadyTileIds, ['tile_1_0', 'tile_2_0']);
  assert.equal(state.renderRevealSources.length, 2);
  assert.equal(state.renderRevealSources[0].strength, 1);
  assert.equal(state.renderRevealSources[1].strength > 0, true);
  assert.equal(state.renderRevealSources[1].strength < 1, true);
});

test('worldMarchCore moves fog reveal strength continuously inside a route step', () => {
  const startedAt = Date.parse('2026-06-06T00:00:00.000Z');
  const mission = createMission({ revealedTileIds: [] });
  const first = WorldMarchCore.computeMarchState(mission, startedAt + 1000);
  const middle = WorldMarchCore.computeMarchState(mission, startedAt + 5000);
  const late = WorldMarchCore.computeMarchState(mission, startedAt + 9000);

  assert.deepEqual(first.renderReadyTileIds, ['tile_1_0']);
  assert.deepEqual(middle.renderReadyTileIds, ['tile_1_0']);
  assert.deepEqual(late.renderReadyTileIds, ['tile_1_0']);
  assert.equal(first.renderRevealSources[0].strength > 0, true);
  assert.equal(first.renderRevealSources[0].strength < middle.renderRevealSources[0].strength, true);
  assert.equal(middle.renderRevealSources[0].strength < late.renderRevealSources[0].strength, true);
  assert.notEqual(first.renderRevealSignature, middle.renderRevealSignature);
  assert.notEqual(middle.renderRevealSignature, late.renderRevealSignature);
});
