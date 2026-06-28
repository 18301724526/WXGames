const test = require('node:test');
const assert = require('node:assert/strict');

// Characterization baseline for P3 "Axis A" — the triple-host live-state mirror
// (host.state / lastGame.state / canvasShell.state, plus the sibling canvasShell
// networkState mirror). See docs/refactor/REFACTOR_HANDOFF_2026-06-27.md section 5.
//
// These tests PIN THE CURRENT, pre-collapse behavior so the Axis A collapse (single
// state owner, `extends CanvasGameApp` removed) can be proven behavior-preserving.
//   - Assertions tagged "MIRROR BASELINE" document the debt the collapse will REMOVE;
//     they are EXPECTED to change when the mirror is collapsed to one owner.
//   - Assertions tagged "READ CONTRACT" document behavior that MUST survive the
//     collapse unchanged.
// Until then, there is zero coverage of the three-host fan-out: the existing
// WorldMarchOptimisticState.test.js host has only `state` (no lastGame/canvasShell),
// and the existing CanvasGameAppStateSync heartbeat tests have no canvasShell.

const WorldMarchOptimisticState = require('../domain/WorldMarchOptimisticState');
const CanvasGameAppStateSync = require('./CanvasGameAppStateSync');

function makeSeedState() {
  return {
    activeCityId: 'capital',
    worldExplorerState: {
      missions: [],
      activeMission: null,
      idleMissions: [],
      maxManualRouteLength: 10,
    },
    territoryState: { worldMap: { tiles: [{ q: 0, r: 0, siteId: 'capital' }] } },
  };
}

function makeOptimisticHost(slots = {}) {
  return {
    config: { WORLD_MARCH_RECONCILE_THRESHOLD_TILES: 0.75 },
    networkState: { status: 'online', failureCount: 0 },
    getWorldEpochNowMs() {
      return Date.parse('2026-06-21T00:00:00.000Z');
    },
    renderCanvasSurface() {},
    ...slots,
  };
}

// --- Part 1: WorldMarchOptimisticState.setExplorer three-host fan-out --------

test('Axis A baseline: a host-rooted optimistic march fans state to host.state AND canvasShell.state as one reference', () => {
  const host = makeOptimisticHost({
    state: makeSeedState(),
    canvasShell: { state: { sentinel: 'stale-shell' } },
  });

  const pending = WorldMarchOptimisticState.beginStart(host, {
    cityId: 'capital',
    formationSlot: 1,
    targetQ: 2,
    targetR: 0,
  });

  assert.ok(pending, 'beginStart created an optimistic mission');
  assert.match(pending.mission.id, /^optimistic_manual_/);

  // READ CONTRACT (must survive the collapse): the owner sees the new active mission.
  assert.equal(host.state.worldExplorerState.activeMission.id, pending.mission.id);

  // MIRROR BASELINE (collapse removes this fan-out): canvasShell.state was overwritten
  // with the SAME new object reference host.state points at.
  assert.equal(host.canvasShell.state, host.state);
  assert.equal(host.canvasShell.state.worldExplorerState.activeMission.id, pending.mission.id);
});

test('Axis A baseline: with lastGame present, reads use lastGame.state precedence and all three host slots receive one reference', () => {
  const parkedMission = {
    id: 'march-parked',
    kind: 'worldExplore',
    mode: 'manual',
    status: 'idle',
    origin: { q: 7, r: -2, tileId: 'tile_7_-2' },
    homeOrigin: { q: 1, r: 1, tileId: 'tile_1_1' },
    target: { q: 7, r: -2, tileId: 'tile_7_-2' },
    position: { q: 7, r: -2, tileId: 'tile_7_-2' },
    route: [],
    formation: { cityId: 'frontier-city', slot: 2 },
    stepDurationSeconds: 10,
    stepDurationMs: 10000,
    nextStepAt: null,
    completedAt: '2026-06-21T00:00:00.000Z',
  };
  const seed = {
    activeCityId: 'capital',
    worldExplorerState: {
      missions: [parkedMission],
      activeMission: null,
      idleMissions: [parkedMission],
      maxManualRouteLength: 10,
    },
  };
  const host = makeOptimisticHost({
    state: { sentinel: 'stale-host' },
    lastGame: { state: seed },
    canvasShell: { state: { sentinel: 'stale-shell' } },
  });

  const pending = WorldMarchOptimisticState.beginStart(host, {
    missionId: 'march-parked',
    cityId: 'capital',
    formationSlot: 1,
    targetQ: 9,
    targetR: -2,
  });

  // READ CONTRACT: beginStart could only find the parked mission because the read
  // path getState() = host.lastGame?.state || host.state preferred lastGame.state.
  assert.ok(pending, 'beginStart read the parked mission via lastGame.state precedence');
  assert.equal(pending.mission.id, 'march-parked');

  // MIRROR BASELINE: setExplorer writes the same nextState object into all three slots.
  const fanned = host.lastGame.state;
  assert.equal(host.lastGame.state, fanned);
  assert.equal(host.state, fanned);
  assert.equal(host.canvasShell.state, fanned);
  assert.equal(fanned.worldExplorerState.activeMission.id, 'march-parked');
});

// --- Part 2: CanvasGameAppStateSync sibling networkState mirror -------------

test('Axis A baseline: applyConnectionState mirrors the new networkState onto canvasShell.setNetworkState', () => {
  class Host {}
  CanvasGameAppStateSync.install(Host);
  const pushed = [];
  const host = new Host();
  Object.assign(host, {
    state: { currentTab: 'military' },
    networkState: { status: 'online', failureCount: 0 },
    renderCanvasSurface() {},
    canvasShell: {
      setNetworkState(networkState) {
        pushed.push(networkState);
      },
    },
  });

  const result = host.applyConnectionState({ status: 'reconnecting', failureCount: 2 });

  // READ CONTRACT: the host's own networkState is updated.
  assert.equal(host.networkState.status, 'reconnecting');
  assert.equal(host.networkState.failureCount, 2);
  assert.equal(result, host.networkState);

  // MIRROR BASELINE: the SAME networkState object is pushed into canvasShell.
  assert.equal(pushed.length, 1);
  assert.equal(pushed[0], host.networkState);
});

test('Axis A baseline: applyConnectionState without a canvasShell mirror falls back to a render', () => {
  class Host {}
  CanvasGameAppStateSync.install(Host);
  const renders = [];
  const host = new Host();
  Object.assign(host, {
    state: { currentTab: 'military' },
    networkState: { status: 'online', failureCount: 0 },
    renderCanvasSurface(tab) {
      renders.push(tab);
    },
  });

  host.applyConnectionState({ status: 'reconnecting', failureCount: 1 });

  // READ CONTRACT: with no shell mirror present, the host re-renders instead.
  assert.deepEqual(renders, ['military']);
  assert.equal(host.networkState.status, 'reconnecting');
});
