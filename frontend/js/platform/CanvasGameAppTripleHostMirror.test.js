const test = require('node:test');
const assert = require('node:assert/strict');

// Characterization tests for P3 "Axis A" — collapsing the triple-host live-state
// mirror (host.state / lastGame.state / canvasShell.state, plus sibling canvasShell
// mirrors) to a single owner. See docs/refactor/REFACTOR_HANDOFF_2026-06-27.md §5.
//
// Tags:
//   - "SINGLE OWNER": behavior AFTER an Axis A collapse landed — exactly one state
//     slot (the getState() read source) is written and the old mirror copies are
//     gone. These guard against the mirror being re-introduced.
//   - "READ CONTRACT": behavior that MUST hold regardless of the collapse.
//   - "MIRROR BASELINE": a mirror NOT yet collapsed — pins current behavior so the
//     eventual collapse can be proven behavior-preserving (expected to change then).
// Part 1 (setExplorer) is collapsed. Part 2 (CanvasGameAppStateSync canvasShell
// networkState mirror) is still a pre-collapse baseline.

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

// --- Part 1: WorldMarchOptimisticState.setExplorer single-owner write (COLLAPSED) ---

test('Axis A: a host-rooted optimistic march writes only the owner (host.state), not canvasShell.state', () => {
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

  // READ CONTRACT: the owner sees the new active mission.
  assert.equal(host.state.worldExplorerState.activeMission.id, pending.mission.id);

  // SINGLE OWNER: canvasShell.state is no longer mirrored (write-only dead field
  // removed). The shell reads the owner via lastGame.state; its own state field is
  // left as the stale object it started with.
  assert.notEqual(host.canvasShell.state, host.state);
  assert.equal(host.canvasShell.state.sentinel, 'stale-shell');
});

test('Axis A: with lastGame present, setExplorer writes only the lastGame owner (write target == read source)', () => {
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

  // SINGLE OWNER: only the owner (lastGame.state, the read source) is written; the
  // vestigial host.state and canvasShell.state are left as their stale sentinels.
  const owner = host.lastGame.state;
  assert.equal(owner.worldExplorerState.activeMission.id, 'march-parked');
  assert.equal(host.state.sentinel, 'stale-host');
  assert.equal(host.canvasShell.state.sentinel, 'stale-shell');
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
