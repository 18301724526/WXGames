const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

function loadAuthModule() {
  const modulePath = path.resolve(__dirname, 'auth.js');
  delete require.cache[modulePath];
  require(modulePath);
  return global.window.mountAuthMethods;
}

test('resetGame closes the reset confirmation before showing success feedback', async () => {
  const previousWindow = global.window;
  const calls = [];

  try {
    global.window = {};
    const mountAuthMethods = loadAuthModule();
    const game = {
      token: null,
      canvasShell: {
        applyAuthShell() {},
        applyCredentials() {},
        closeConfirmDialog() {
          calls.push('closeConfirmDialog');
        },
        resetLocalViewToResources() {
          calls.push('shellResetLocalViewToResources');
        },
      },
      getGameApi() {
        return {
          resetPlayer() {
            calls.push('resetPlayer');
            return Promise.resolve({ success: true, message: 'reset ok', gameState: {} });
          },
        };
      },
      applyApiState() {
        calls.push('applyApiState');
      },
      actionController: {
        resetWorldMapCamera(options) {
          calls.push(['resetWorldMapCamera', options]);
        },
      },
      maybeStartTutorialIntro() {
        calls.push('maybeStartTutorialIntro');
      },
      resetLocalViewToResources() {
        calls.push('gameResetLocalViewToResources');
      },
      showFloatingText(message) {
        calls.push(`showFloatingText:${message}`);
      },
      log(message) {
        calls.push(`log:${message}`);
      },
    };

    mountAuthMethods(game, {
      presenter: {
        buildAuthCredentialViewState() {
          return {};
        },
        buildAuthShellViewState() {
          return {};
        },
      },
      authStorage: {
        clearTutorialStorage() {
          calls.push('clearTutorialStorage');
        },
        getCredentialSnapshot() {
          return {};
        },
      },
      authRuntime: {
        alertMessage(message) {
          calls.push(`alertMessage:${message}`);
        },
      },
    });

    calls.length = 0;
    assert.equal(await game.resetGame({ confirmed: true }), true);

    const closeIndex = calls.indexOf('closeConfirmDialog');
    const floatingIndex = calls.findIndex((call) => typeof call === 'string' && call.startsWith('showFloatingText:'));
    const alertIndex = calls.findIndex((call) => typeof call === 'string' && call.startsWith('alertMessage:'));

    assert.ok(closeIndex > -1);
    assert.ok(floatingIndex > closeIndex);
    assert.ok(alertIndex > closeIndex);
    const resetCalls = calls.filter((call) => Array.isArray(call) && call[0] === 'resetWorldMapCamera');
    assert.deepEqual(resetCalls, [
      [
        'resetWorldMapCamera',
        { source: 'accountReset', render: false, resetRuntimeState: true },
      ],
      [
        'resetWorldMapCamera',
        { source: 'accountReset', render: true },
      ],
    ]);
    assert.deepEqual(calls[calls.findIndex((call) => Array.isArray(call) && call[0] === 'resetWorldMapCamera')], [
      'resetWorldMapCamera',
      { source: 'accountReset', render: false, resetRuntimeState: true },
    ]);
    assert.equal(
      calls.findIndex((call) => Array.isArray(call) && call[0] === 'resetWorldMapCamera') < calls.indexOf('applyApiState'),
      true,
    );
    assert.equal(
      calls.findLastIndex((call) => Array.isArray(call) && call[0] === 'resetWorldMapCamera') > calls.indexOf('applyApiState'),
      true,
    );
  } finally {
    global.window = previousWindow;
  }
});
