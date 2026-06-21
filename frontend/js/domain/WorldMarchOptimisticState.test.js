const test = require('node:test');
const assert = require('node:assert/strict');

const WorldMarchOptimisticState = require('./WorldMarchOptimisticState');
const WorldMarchCore = require('../../../shared/worldMarchCore');

function makeMission(overrides = {}) {
  return {
    id: 'march-1',
    kind: 'worldExplore',
    mode: 'manual',
    status: 'active',
    origin: { q: 0, r: 0, tileId: 'tile_0_0' },
    homeOrigin: { q: 0, r: 0, tileId: 'tile_0_0' },
    target: { q: 2, r: 0, tileId: 'tile_2_0' },
    route: [
      { q: 1, r: 0, step: 1, tileId: 'tile_1_0', revealed: false, revealedAt: null },
      { q: 2, r: 0, step: 2, tileId: 'tile_2_0', revealed: false, revealedAt: null },
    ],
    formation: { cityId: 'capital', slot: 1 },
    position: { q: 0, r: 0, tileId: 'tile_0_0' },
    revealedTileIds: [],
    stepDurationSeconds: 10,
    stepDurationMs: 10000,
    startedAt: '2026-06-21T00:00:00.000Z',
    nextStepAt: '2026-06-21T00:00:10.000Z',
    completesAt: '2026-06-21T00:00:20.000Z',
    completedAt: null,
    ...overrides,
  };
}

function makeHost(state = {}, nowMs = Date.parse('2026-06-21T00:00:05.000Z')) {
  return {
    state,
    config: { WORLD_MARCH_RECONCILE_THRESHOLD_TILES: 0.75 },
    networkState: { status: 'online', failureCount: 0 },
    getWorldEpochNowMs() {
      return nowMs;
    },
    renderCanvasSurface() {},
  };
}

test('WorldMarchOptimisticState keeps local predicted mission when authority is only stale', () => {
  const nowMs = Date.parse('2026-06-21T00:00:05.000Z');
  const localMission = makeMission();
  const serverMission = makeMission({
    position: { q: 0, r: 0, tileId: 'tile_0_0' },
    revealedTileIds: [],
  });
  const host = makeHost({
    worldExplorerState: { missions: [localMission], activeMission: localMission, idleMissions: [] },
  }, nowMs);
  WorldMarchOptimisticState.ensureStore(host).pending['pending-1'] = {
    pendingId: 'pending-1',
    missionId: 'march-1',
    action: 'startWorldMarch',
    formation: { cityId: 'capital', slot: 1 },
    routeSignature: '1:0|2:0',
    target: { q: 2, r: 0 },
  };
  localMission._optimistic = { pending: true, pendingId: 'pending-1', action: 'startWorldMarch' };

  const reconciled = WorldMarchOptimisticState.reconcileWorldExplorerState(host, {
    missions: [serverMission],
    activeMission: serverMission,
    idleMissions: [],
  }, { epochNowMs: nowMs });

  const current = WorldMarchCore.getCurrentCoord(reconciled.activeMission, nowMs);
  assert.equal(current.q, 0.5);
  assert.equal(reconciled.activeMission._optimistic.pending, true);
  assert.equal(host.networkState.status, 'online');
});

test('WorldMarchOptimisticState marks slow sync and accepts authority on large drift', () => {
  const nowMs = Date.parse('2026-06-21T00:00:05.000Z');
  const localMission = makeMission();
  const serverMission = makeMission({
    id: 'march-1',
    origin: { q: 8, r: 0, tileId: 'tile_8_0' },
    target: { q: 10, r: 0, tileId: 'tile_10_0' },
    route: [
      { q: 9, r: 0, step: 1, tileId: 'tile_9_0', revealed: false, revealedAt: null },
      { q: 10, r: 0, step: 2, tileId: 'tile_10_0', revealed: false, revealedAt: null },
    ],
  });
  const host = makeHost({
    worldExplorerState: { missions: [localMission], activeMission: localMission, idleMissions: [] },
  }, nowMs);
  WorldMarchOptimisticState.ensureStore(host).pending['pending-1'] = {
    pendingId: 'pending-1',
    missionId: 'march-1',
    action: 'startWorldMarch',
    formation: { cityId: 'capital', slot: 1 },
    routeSignature: '1:0|2:0',
    target: { q: 2, r: 0 },
  };
  localMission._optimistic = { pending: true, pendingId: 'pending-1', action: 'startWorldMarch' };

  const reconciled = WorldMarchOptimisticState.reconcileWorldExplorerState(host, {
    missions: [serverMission],
    activeMission: serverMission,
    idleMissions: [],
  }, { epochNowMs: nowMs });

  assert.equal(reconciled.activeMission.origin.q, 8);
  assert.equal(reconciled.activeMission._optimistic.pullback, true);
  assert.equal(host.networkState.status, 'reconnecting');
  assert.equal(host.networkState.message, WorldMarchOptimisticState.SLOW_SYNC_MESSAGE);
});

test('WorldMarchOptimisticState treats successful return route rebase, including empty route, as authority', () => {
  const localMission = makeMission({
    route: [{ q: 1, r: 0, step: 1, tileId: 'tile_1_0', revealed: false, revealedAt: null }],
    target: { q: 1, r: 0, tileId: 'tile_1_0' },
  });
  const authorityMission = makeMission({
    status: 'idle',
    origin: { q: 0, r: 0, tileId: 'tile_0_0' },
    target: { q: 0, r: 0, tileId: 'tile_0_0' },
    position: { q: 0, r: 0, tileId: 'tile_0_0' },
    route: [],
    nextStepAt: null,
    completesAt: '2026-06-21T00:00:05.000Z',
    completedAt: '2026-06-21T00:00:05.000Z',
  });
  const host = makeHost({
    worldExplorerState: { missions: [localMission], activeMission: localMission, idleMissions: [] },
  });
  WorldMarchOptimisticState.ensureStore(host).pending['march-1'] = {
    pendingId: 'march-1',
    missionId: 'march-1',
    action: 'returnWorldMarch',
    formation: { cityId: 'capital', slot: 1 },
    routeSignature: '1:0',
    target: { q: 0, r: 0 },
  };
  localMission._optimistic = { pending: true, pendingId: 'march-1', action: 'returnWorldMarch' };

  const reconciled = WorldMarchOptimisticState.reconcileWorldExplorerState(host, {
    missions: [authorityMission],
    activeMission: null,
    idleMissions: [authorityMission],
  });

  assert.equal(reconciled.activeMission, null);
  assert.equal(reconciled.idleMissions[0].status, 'idle');
  assert.deepEqual(reconciled.idleMissions[0].route, []);
  assert.equal(reconciled.idleMissions[0]._optimistic.reconciled, true);
});

test('WorldMarchOptimisticState builds compact continuous client position reports', () => {
  const nowMs = Date.parse('2026-06-21T00:00:05.000Z');
  const mission = makeMission();
  const host = makeHost({
    worldExplorerState: { missions: [mission], activeMission: mission, idleMissions: [] },
  }, nowMs);

  const report = WorldMarchOptimisticState.buildClientReport(host);

  assert.equal(report.schema, 'world-march-client-report-batch-v1');
  assert.equal(report.missions.length, 1);
  assert.equal(report.missions[0].missionId, 'march-1');
  assert.equal(report.missions[0].position.q, 0.5);
  assert.equal(JSON.stringify(report).includes('plannedTiles'), false);
});
