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
  const host = makeHost(
    {
      worldExplorerState: {
        missions: [localMission],
        activeMission: localMission,
        idleMissions: [],
      },
    },
    nowMs,
  );
  WorldMarchOptimisticState.ensureStore(host).pending['pending-1'] = {
    pendingId: 'pending-1',
    missionId: 'march-1',
    action: 'startWorldMarch',
    formation: { cityId: 'capital', slot: 1 },
    routeSignature: '1:0|2:0',
    target: { q: 2, r: 0 },
  };
  localMission._optimistic = { pending: true, pendingId: 'pending-1', action: 'startWorldMarch' };

  const reconciled = WorldMarchOptimisticState.reconcileWorldExplorerState(
    host,
    {
      missions: [serverMission],
      activeMission: serverMission,
      idleMissions: [],
    },
    { epochNowMs: nowMs },
  );

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
  const host = makeHost(
    {
      worldExplorerState: {
        missions: [localMission],
        activeMission: localMission,
        idleMissions: [],
      },
    },
    nowMs,
  );
  WorldMarchOptimisticState.ensureStore(host).pending['pending-1'] = {
    pendingId: 'pending-1',
    missionId: 'march-1',
    action: 'startWorldMarch',
    formation: { cityId: 'capital', slot: 1 },
    routeSignature: '1:0|2:0',
    target: { q: 2, r: 0 },
  };
  localMission._optimistic = { pending: true, pendingId: 'pending-1', action: 'startWorldMarch' };

  const reconciled = WorldMarchOptimisticState.reconcileWorldExplorerState(
    host,
    {
      missions: [serverMission],
      activeMission: serverMission,
      idleMissions: [],
    },
    { epochNowMs: nowMs },
  );

  assert.equal(reconciled.activeMission.origin.q, 8);
  assert.equal(reconciled.activeMission._optimistic.pullback, true);
  assert.equal(host.networkState.status, 'reconnecting');
  assert.equal(host.networkState.message, WorldMarchOptimisticState.SLOW_SYNC_MESSAGE);
});

test('WorldMarchOptimisticState does not reconcile explicit id pending through formation fallback', () => {
  const nowMs = Date.parse('2026-06-21T00:00:00.000Z');
  const localMission = makeMission({
    id: 'march-1',
    route: [{ q: 1, r: 0, step: 1, tileId: 'tile_1_0', revealed: false, revealedAt: null }],
    target: { q: 1, r: 0, tileId: 'tile_1_0' },
    _optimistic: { pending: true, pendingId: 'pending-1', action: 'startWorldMarch' },
  });
  const wrongAuthorityMission = makeMission({
    id: 'other-march',
    route: [{ q: 1, r: 0, step: 1, tileId: 'tile_1_0', revealed: false, revealedAt: null }],
    target: { q: 1, r: 0, tileId: 'tile_1_0' },
    formation: { cityId: 'capital', slot: 1 },
  });
  const host = makeHost(
    {
      worldExplorerState: {
        missions: [localMission],
        activeMission: localMission,
        idleMissions: [],
      },
    },
    nowMs,
  );
  WorldMarchOptimisticState.ensureStore(host).pending['pending-1'] = {
    pendingId: 'pending-1',
    missionId: 'march-1',
    explicitMissionId: 'march-1',
    action: 'startWorldMarch',
    formation: { cityId: 'capital', slot: 1 },
    routeSignature: '1:0',
    target: { q: 1, r: 0 },
  };

  const reconciled = WorldMarchOptimisticState.reconcileWorldExplorerState(
    host,
    {
      missions: [wrongAuthorityMission],
      activeMission: wrongAuthorityMission,
      idleMissions: [],
    },
    { epochNowMs: nowMs },
  );

  assert.equal(
    reconciled.missions.some((mission) => mission.id === 'march-1' && mission._optimistic.pending),
    true,
  );
  assert.equal(
    reconciled.missions.some(
      (mission) => mission.id === 'other-march' && mission._optimistic?.reconciled,
    ),
    false,
  );
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
  const host = makeHost(
    {
      worldExplorerState: { missions: [mission], activeMission: mission, idleMissions: [] },
    },
    nowMs,
  );

  const report = WorldMarchOptimisticState.buildClientReport(host);

  assert.equal(report.schema, 'world-march-client-report-batch-v1');
  assert.equal(report.missions.length, 1);
  assert.equal(report.missions[0].missionId, 'march-1');
  assert.equal(report.missions[0].position.q, 0.5);
  assert.equal(JSON.stringify(report).includes('plannedTiles'), false);
});

test('WorldMarchOptimisticState begins an id-addressed march from the selected idle mission position', () => {
  const parkedMission = makeMission({
    id: 'march-parked',
    status: 'idle',
    origin: { q: 7, r: -2, tileId: 'tile_7_-2' },
    homeOrigin: { q: 1, r: 1, tileId: 'tile_1_1' },
    target: { q: 7, r: -2, tileId: 'tile_7_-2' },
    position: { q: 7, r: -2, tileId: 'tile_7_-2' },
    route: [],
    formation: { cityId: 'frontier-city', slot: 2 },
    nextStepAt: null,
    completedAt: '2026-06-21T00:00:00.000Z',
  });
  const host = makeHost({
    activeCityId: 'capital',
    worldExplorerState: {
      missions: [parkedMission],
      activeMission: null,
      idleMissions: [parkedMission],
      maxManualRouteLength: 10,
    },
  });

  const pending = WorldMarchOptimisticState.beginStart(host, {
    missionId: 'march-parked',
    cityId: 'capital',
    formationSlot: 1,
    targetQ: 9,
    targetR: -2,
  });

  assert.equal(pending.mission.id, 'march-parked');
  assert.deepEqual(pending.mission.origin, { q: 7, r: -2, tileId: 'tile_7_-2' });
  assert.deepEqual(pending.mission.position, { q: 7, r: -2, tileId: 'tile_7_-2' });
  assert.deepEqual(pending.mission.formation, { cityId: 'frontier-city', slot: 2 });
  assert.deepEqual(
    pending.mission.route.map((step) => step.tileId),
    ['tile_8_-2', 'tile_9_-2'],
  );
  assert.equal(host.state.worldExplorerState.missions.length, 1);
  assert.equal(host.state.worldExplorerState.activeMission.id, 'march-parked');
});

test('WorldMarchOptimisticState does not create an optimistic unit when explicit id is missing', () => {
  const host = makeHost({
    activeCityId: 'capital',
    worldExplorerState: {
      missions: [],
      activeMission: null,
      idleMissions: [],
      maxManualRouteLength: 10,
    },
  });

  const pending = WorldMarchOptimisticState.beginStart(host, {
    missionId: 'missing-march',
    cityId: 'capital',
    formationSlot: 1,
    targetQ: 2,
    targetR: 0,
  });

  assert.equal(pending, null);
  assert.equal(host.state.worldExplorerState.missions.length, 0);
  assert.equal(host.state.worldExplorerState.activeMission, null);
});

test('WorldMarchOptimisticState still creates a new optimistic mission when no id is provided', () => {
  const host = makeHost({
    activeCityId: 'capital',
    worldExplorerState: {
      missions: [],
      activeMission: null,
      idleMissions: [],
      maxManualRouteLength: 10,
    },
    territoryState: {
      worldMap: {
        tiles: [{ q: 0, r: 0, siteId: 'capital' }],
      },
    },
  });

  const pending = WorldMarchOptimisticState.beginStart(host, {
    cityId: 'capital',
    formationSlot: 1,
    targetQ: 2,
    targetR: 0,
  });

  assert.match(pending.mission.id, /^optimistic_manual_/);
  assert.deepEqual(pending.mission.origin, { q: 0, r: 0, tileId: 'tile_0_0' });
  assert.deepEqual(pending.mission.formation, { cityId: 'capital', slot: 1 });
  assert.equal(host.state.worldExplorerState.activeMission.id, pending.mission.id);
});
