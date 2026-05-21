const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..', '..');

test('logs module keeps request logs as data and shows Canvas log panel', () => {
  const originalWindow = global.window;
  try {
    global.window = {};
    delete require.cache[require.resolve('../logs')];
    require('../logs');

    const renderCalls = [];
    const game = {
      state: { currentTab: 'resources' },
      canvasShell: {
        showLogs: false,
        showSettings: true,
        showResourceDetails: true,
        showCitySwitcher: true,
        showAdvisor: true,
        activeEventId: 'event-1',
        renderReadOnly(state, tab) {
          renderCalls.push({ state, tab });
        },
      },
    };
    global.window.mountLogMethods(game);

    game.cacheRequestLog('/game/state', 'GET', null, 200, { ok: true }, 24);
    assert.equal(game.requestLogs.length, 1);
    assert.equal(game.showRequestLogs(), true);
    assert.equal(game.canvasShell.showLogs, true);
    assert.equal(game.canvasShell.showSettings, false);
    assert.equal(game.canvasShell.activeEventId, null);
    assert.deepEqual(renderCalls.at(-1), { state: game.state, tab: 'resources' });

    assert.equal(game.closeRequestLogs(), true);
    assert.equal(game.canvasShell.showLogs, false);

    game.clearRequestLogs();
    assert.deepEqual(game.requestLogs, []);
    assert.equal(game.canvasShell.showLogs, true);
  } finally {
    global.window = originalWindow;
  }
});

test('logs module source has no DOM markup rendering path', () => {
  const source = fs.readFileSync(path.join(projectRoot, 'frontend', 'logs.js'), 'utf8');

  assert.doesNotMatch(source, /innerHTML|<table|<div|LogModalAdapter|RuntimeLogAdapter|logModal|runtimeLog|document|getElementById|querySelector|classList|style\./);
});
