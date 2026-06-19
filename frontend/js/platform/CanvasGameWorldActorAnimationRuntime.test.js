const test = require('node:test');
const assert = require('node:assert/strict');

const ActorRuntime = require('./CanvasGameWorldActorAnimationRuntime');

function createHost(overrides = {}) {
  class Host {}
  ActorRuntime.install(Host);
  return Object.assign(new Host(), {
    activeTab: 'military',
    config: {},
    getAnimationFrameMs() {
      return 16;
    },
    getWorldEpochNowMs() {
      return 1000;
    },
    isWorldMapDragCoolingDown() {
      return false;
    },
    isWorldMapDragging() {
      return false;
    },
    isWorldMapHomeActive() {
      return true;
    },
    now() {
      return 1000;
    },
    runtime: {},
    state: {
      currentTab: 'military',
      militaryView: 'world',
      worldExplorerState: {
        activeMission: { id: 'march-1', status: 'active' },
      },
    },
  }, overrides);
}

test('CanvasGameWorldActorAnimationRuntime renders only the actor layer for active marches', () => {
  const calls = [];
  const host = createHost({
    renderWorldActorLayer(options) {
      calls.push(['actor', options.state.worldExplorerState.activeMission.id, options.epochNowMs, options.preserveRuntimeHitTargetsOnEmpty]);
      return true;
    },
  });

  assert.equal(host.renderWorldActorAnimationFrame({ force: true }), true);
  assert.deepEqual(calls, [
    ['actor', 'march-1', 1000, true],
  ]);
});

test('CanvasGameWorldActorAnimationRuntime queues a RAF loop while marches remain active', () => {
  const calls = [];
  const rafCallbacks = [];
  let now = 1000;
  const host = createHost({
    now() {
      return now;
    },
    renderWorldActorLayer(options) {
      calls.push(['actor', options.epochNowMs]);
      return true;
    },
    runtime: {
      requestAnimationFrame(callback) {
        rafCallbacks.push(callback);
        return rafCallbacks.length;
      },
    },
  });

  assert.equal(host.startWorldActorAnimationLoop(), true);
  assert.equal(rafCallbacks.length, 1);
  rafCallbacks.shift()();
  assert.equal(calls.length, 1);
  assert.equal(rafCallbacks.length, 1);

  host.state.worldExplorerState.activeMission.status = 'idle';
  now = 1040;
  rafCallbacks.shift()();
  assert.equal(calls.length, 1);
  assert.equal(host.worldActorAnimationActive, false);
  assert.equal(rafCallbacks.length, 0);
});

test('CanvasGameWorldActorAnimationRuntime stays quiet outside map home or during drag', () => {
  const host = createHost({
    isWorldMapDragging() {
      return true;
    },
    renderWorldActorLayer() {
      throw new Error('actor layer should not render while dragging');
    },
  });

  assert.equal(host.shouldAnimateWorldActors(), false);
  assert.equal(host.startWorldActorAnimationLoop(), false);
  assert.equal(host.renderWorldActorAnimationFrame({ force: true }), false);
});

test('CanvasGameWorldActorAnimationRuntime resumes during drag cooldown', () => {
  const calls = [];
  const host = createHost({
    isWorldMapDragCoolingDown() {
      return true;
    },
    renderWorldActorLayer() {
      calls.push(['actor']);
      return true;
    },
  });

  assert.equal(host.shouldAnimateWorldActors(), true);
  assert.equal(host.renderWorldActorAnimationFrame({ force: true }), true);
  assert.deepEqual(calls, [['actor']]);
});
