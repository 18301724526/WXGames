const test = require('node:test');
const assert = require('node:assert/strict');

const BattleSceneController = require('./BattleSceneController');

// SHAPE-B contract: the controller owns the two replay timer handles and the
// turn-duration policy; the scene session lives in the (host-provided) battle store.
// One implementation must serve an app-like host (getState -> this.state) and a
// shell-like host (getState -> this.lastGame.state).

function makeStore() {
  let scene = null;
  return {
    openBattleScene(next) {
      scene = next;
    },
    updateBattleScene(next) {
      scene = next;
    },
    closeBattleScene() {
      scene = null;
    },
    getBattleScene() {
      return scene;
    },
  };
}

function makeAppLikeHost(state) {
  const host = {
    state,
    calls: [],
    timeoutCb: null,
    intervalCb: null,
    store: makeStore(),
    getState() {
      return this.state || {};
    },
    getBattleStore() {
      return this.store;
    },
    invalidateRendererSnapshot() {},
    renderCanvasSurface(tab) {
      this.calls.push(['renderSurface', tab]);
      return true;
    },
    renderAnimationFrame(tab) {
      this.calls.push(['renderFrame', tab]);
      return true;
    },
    now() {
      return 500;
    },
    getAnimationFrameMs() {
      return 50;
    },
    scheduler: {
      setTimeout: (callback, ms) => {
        host.timeoutCb = callback;
        host.calls.push(['setTimeout', ms]);
        return 41;
      },
      clearTimeout: (handle) => {
        host.calls.push(['clearTimeout', handle]);
      },
      setInterval: (callback) => {
        host.intervalCb = callback;
        return 42;
      },
      clearInterval: (handle) => {
        host.calls.push(['clearInterval', handle]);
      },
    },
  };
  return host;
}

function makeShellLikeHost(state) {
  const host = makeAppLikeHost(null);
  delete host.state;
  host.lastGame = { state };
  host.getState = function getState() {
    return this.lastGame.state || {};
  };
  return host;
}

for (const [shape, makeHost] of [
  ['app-like', makeAppLikeHost],
  ['shell-like', makeShellLikeHost],
]) {
  test(`start opens the turn-card scene, arms both timers, and renders the state tab (${shape} host)`, () => {
    const host = makeHost({ currentTab: 'territory' });
    const controller = new BattleSceneController({ host });

    assert.equal(controller.start({ id: 'r1', turns: [{ action: 'attack' }] }), true);
    assert.equal(host.store.getBattleScene().turnDurationMs, 900);
    assert.deepEqual(host.calls, [
      ['setTimeout', 900],
      ['renderSurface', 'territory'],
    ]);
  });
}

test('turn-duration policy adds the skill cut-in on skill turns', () => {
  const controller = new BattleSceneController({ host: makeAppLikeHost({}) });
  assert.equal(controller.getTurnDurationMs({ action: 'attack' }), 900);
  assert.equal(controller.getTurnDurationMs({ action: 'skill' }), 3100);
  assert.equal(controller.getTurnDurationMs({ presentation: { cutIn: true } }), 3100);
  assert.equal(controller.getTurnDurationMs(null), 900);
});

test('advanceTurn walks the report turns, re-arms the timeout, then stops both timers at the end', () => {
  const host = makeAppLikeHost({ currentTab: 'military' });
  const controller = new BattleSceneController({ host });
  controller.start({ id: 'r2', turns: [{ action: 'attack' }, { action: 'skill' }] });
  host.calls.length = 0;

  assert.equal(controller.advanceTurn(), true);
  assert.equal(host.store.getBattleScene().turnIndex, 1);
  assert.equal(host.store.getBattleScene().turnDurationMs, 3100);

  assert.equal(controller.advanceTurn(), true);
  assert.equal(controller.advanceTurn(), false);
  assert.deepEqual(host.calls.at(-2), ['clearTimeout', 41]);
  assert.deepEqual(host.calls.at(-1), ['clearInterval', 42]);
});

test('start routes replay-carrying reports to the host entity-battle overlay', () => {
  const previousCore = global.BattleSimCore;
  global.BattleSimCore = { createBattle() {} };
  const host = makeAppLikeHost({ currentTab: 'military' });
  const opened = [];
  host.openEntityBattle = (opts) => {
    opened.push([opts.mode, opts.report.id]);
    return true;
  };
  const controller = new BattleSceneController({ host });

  try {
    assert.equal(
      controller.start({ id: 'r3', replay: { setup: { sides: [{}, {}] }, inputStream: [] } }),
      true,
    );
    assert.deepEqual(opened, [['replay', 'r3']]);
    assert.equal(host.store.getBattleScene(), null);
  } finally {
    global.BattleSimCore = previousCore;
  }
});

test('close and skip stop both timers, update the store, and re-render', () => {
  const host = makeAppLikeHost({ currentTab: 'military' });
  const controller = new BattleSceneController({ host });
  controller.start({ id: 'r4', turns: [{ action: 'attack' }] });
  host.calls.length = 0;

  assert.equal(controller.skip(), true);
  assert.equal(host.store.getBattleScene().turnIndex, 1);
  assert.deepEqual(host.calls, [
    ['clearTimeout', 41],
    ['clearInterval', 42],
    ['renderSurface', 'military'],
  ]);

  host.calls.length = 0;
  assert.equal(controller.close(), true);
  assert.equal(host.store.getBattleScene(), null);
  assert.deepEqual(host.calls, [['renderSurface', 'military']]);
});
