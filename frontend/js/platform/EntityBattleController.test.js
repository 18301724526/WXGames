const test = require('node:test');
const assert = require('node:assert/strict');

const EntityBattleController = require('./EntityBattleController');

// SHAPE-B single-owner contract: the controller owns the live session + stepping
// timer and reaches the host only through explicit facilities. One implementation
// must serve an app-like host (getState -> this.state) and a shell-like host
// (getState -> this.lastGame.state).

function makeStore() {
  let session = null;
  return {
    openEntityBattle(next) {
      session = next || null;
      return session;
    },
    closeEntityBattle() {
      session = null;
    },
    getEntityBattle() {
      return session;
    },
  };
}

function makeAppLikeHost(state) {
  const host = {
    state,
    calls: [],
    intervalCallback: null,
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
      return this.nowMs || 0;
    },
    getAnimationFrameMs() {
      return 50;
    },
    scheduler: {
      setInterval: (callback) => {
        host.intervalCallback = callback;
        return 21;
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

function withSimCore(callback) {
  const previous = global.BattleSimCore;
  global.BattleSimCore = {
    createBattle() {
      return {
        config: { tickHz: 20 },
        tick: 0,
        squads: { g1: { side: 0, generalId: 'u1' } },
        units: { u1: { skills: [] } },
        result: null,
      };
    },
    step(battle) {
      battle.tick += 1;
    },
  };
  try {
    callback();
  } finally {
    global.BattleSimCore = previous;
  }
}

for (const [shape, makeHost] of [
  ['app-like', makeAppLikeHost],
  ['shell-like', makeShellLikeHost],
]) {
  test(`open publishes the SAME live session into the store and renders the state tab (${shape} host)`, () => {
    withSimCore(() => {
      const host = makeHost({ currentTab: 'territory' });
      const controller = new EntityBattleController({ host });

      assert.equal(controller.open({ setup: { sides: [{}, {}] }, battleId: 'b-1' }), true);
      assert.equal(controller.session.battleId, 'b-1');
      assert.equal(host.store.getEntityBattle(), controller.session);
      assert.deepEqual(host.calls.at(-1), ['renderSurface', 'territory']);
    });
  });
}

test('tick steps the sim on the accumulated clock and self-stops when hidden', () => {
  withSimCore(() => {
    const host = makeAppLikeHost({ currentTab: 'military' });
    const controller = new EntityBattleController({ host });
    controller.open({ setup: { sides: [{}, {}] } });

    host.nowMs = 1000;
    controller.tick();
    assert.equal(controller.session.battle.tick, 0);

    host.nowMs = 1100;
    controller.tick();
    assert.equal(controller.session.battle.tick, 2);

    controller.session.visible = false;
    assert.equal(controller.tick(), false);
    assert.deepEqual(host.calls.at(-1), ['clearInterval', 21]);
  });
});

test('issueInput guards: no session, replay mode, and ended all refuse', () => {
  withSimCore(() => {
    const host = makeAppLikeHost({ currentTab: 'military' });
    const controller = new EntityBattleController({ host });
    assert.equal(controller.issueInput({ type: 'order' }), false);

    controller.open({ setup: { sides: [{}, {}] }, mode: 'replay', inputStream: [] });
    assert.equal(controller.issueInput({ type: 'order' }), false);

    controller.open({ setup: { sides: [{}, {}] } });
    assert.equal(controller.issueInput({ type: 'order' }), true);
    assert.equal(controller.session.inputStream.length, 1);
    assert.equal(controller.session.pending.length, 1);

    controller.session.ended = true;
    assert.equal(controller.issueInput({ type: 'order' }), false);
  });
});

test('close clears the store and the session, then renders when no onClose is given', () => {
  withSimCore(() => {
    const host = makeAppLikeHost({ currentTab: 'military' });
    const controller = new EntityBattleController({ host });
    controller.open({ setup: { sides: [{}, {}] } });
    host.calls.length = 0;

    assert.equal(controller.close(), true);
    assert.equal(controller.session, null);
    assert.equal(host.store.getEntityBattle(), null);
    assert.deepEqual(host.calls, [
      ['clearInterval', 21],
      ['renderSurface', 'military'],
    ]);
  });
});
