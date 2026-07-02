const test = require('node:test');
const assert = require('node:assert/strict');

const ScoutCountdownTimer = require('./ScoutCountdownTimer');

// SHAPE-B contract: the class owns the interval handle and reads game state only
// through host.getState(), so one implementation serves an app-like host
// (getState -> this.state) and a shell-like host (getState -> this.lastGame.state).

function makeAppLikeHost(state) {
  const host = {
    state,
    calls: [],
    intervalCallback: null,
    getState() {
      return this.state || {};
    },
    scheduler: {
      setInterval: (callback, ms) => {
        host.intervalCallback = callback;
        host.calls.push(['setInterval', ms]);
        return 7;
      },
      clearInterval: (handle) => {
        host.calls.push(['clearInterval', handle]);
      },
    },
    renderCanvasSurface(tab) {
      this.calls.push(['renderCanvasSurface', tab]);
    },
    renderTerritory() {
      this.calls.push(['renderTerritory']);
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
  test(`tick renders military at era 5+ and skips below (${shape} host)`, () => {
    const host = makeHost({ currentTab: 'military', currentEra: 5 });
    const timer = new ScoutCountdownTimer({ host });

    timer.start();
    timer.start();
    assert.deepEqual(host.calls, [['setInterval', 1000]]);
    assert.equal(timer.isActive(), true);

    host.intervalCallback();
    assert.deepEqual(host.calls.at(-1), ['renderCanvasSurface', 'military']);

    const stateOwner = host.lastGame || host;
    stateOwner.state = { currentTab: 'military', currentEra: 4 };
    host.intervalCallback();
    assert.equal(host.calls.length, 2);
  });
}

test('tick skips while the shell drags the world map', () => {
  const host = makeAppLikeHost({ currentTab: 'military', currentEra: 5 });
  host.canvasShell = { isWorldMapDragging: () => true };
  const timer = new ScoutCountdownTimer({ host });
  timer.start();

  host.intervalCallback();
  assert.deepEqual(host.calls, [['setInterval', 1000]]);
});

test('tick re-renders territory only while a conquest mission is active', () => {
  const host = makeAppLikeHost({
    currentTab: 'territory',
    currentEra: 5,
    territoryState: { territories: [{ mission: { status: 'active' } }, {}] },
  });
  const timer = new ScoutCountdownTimer({ host });
  timer.start();

  host.intervalCallback();
  assert.deepEqual(host.calls.at(-1), ['renderTerritory']);

  host.state = { currentTab: 'territory', currentEra: 5, territoryState: { territories: [{}] } };
  host.intervalCallback();
  assert.equal(host.calls.length, 2);
});

test('stop clears the interval and allows re-arming', () => {
  const host = makeAppLikeHost({});
  const timer = new ScoutCountdownTimer({ host });

  timer.stop();
  assert.deepEqual(host.calls, []);

  timer.start();
  timer.stop();
  assert.equal(timer.isActive(), false);
  timer.start();
  assert.deepEqual(host.calls, [
    ['setInterval', 1000],
    ['clearInterval', 7],
    ['setInterval', 1000],
  ]);
});
