const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasActionController = require('./CanvasActionController');
const { makeModalOwnerHost } = require('../../test-support/CanvasOwnerTestHarness');

const makeModalHost = makeModalOwnerHost;

const HostController = CanvasActionController;

test('CanvasActionController installs shell compatibility methods', () => {
  assert.equal(typeof HostController.prototype.handle_switchTab, 'function');
  assert.equal(typeof HostController.prototype.handle_openSettings, 'function');
  assert.equal(typeof HostController.prototype.handle_submitNaming, 'function');
});

test('switch tab preserves page transition contract after delegated tab selection', async () => {
  const calls = [];
  const game = {
    activeTab: 'military',
    getActiveTab() {
      return this.activeTab;
    },
    handleCanvasTabSelection(tab) {
      calls.push(['select', tab]);
      this.activeTab = tab;
      return true;
    },
  };
  const host = {
    buildingOffset: 4,
    state: { currentTab: 'resources' },
    lastGame: game,
    resolveMapHomeViewState(state, options) {
      calls.push(['resolve', state.currentTab, options.requestedTab]);
      return { activeTab: options.requestedTab };
    },
    startPageTransition(previousTab, nextTab, options) {
      calls.push(['transition', previousTab, nextTab, options.fromBuildingOffset]);
    },
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
  };
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(await controller.handle_switchTab({ type: 'switchTab', tab: 'tech' }), true);
  assert.deepEqual(calls, [
    ['select', 'tech'],
    ['resolve', 'resources', 'tech'],
  ]);
});

test('advisor close clears dialogue across shell and game then resumes tutorial', async () => {
  const calls = [];
  const game = makeModalHost({
    tutorialAdvisorDialogue: { source: 'houseBuilt' },
    canvasShell: null,
    tutorialController: {
      async onAdvisorClosed() {
        calls.push(['closed']);
        return true;
      },
      refreshCurrentHighlight() {
        calls.push(['refresh']);
      },
    },
  });
  const host = makeModalHost({
    tutorialAdvisorDialogue: { source: 'houseBuilt' },
    lastGame: game,
    renderer: {
      clearTutorialAdvisorDialogue() {
        calls.push(['clear']);
      },
    },
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
  });
  game.canvasShell = host;
  host.openBlockingPanelSnapshot('showAdvisor', true);
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(await controller.handle_closeAdvisor({ type: 'closeAdvisor' }), true);
  assert.equal(host.isBlockingPanelSnapshotOpen('showAdvisor'), false);
  assert.equal(host.isModalOpen('modal:advisor'), false);
  assert.equal(host.tutorialAdvisorDialogue, null);
  assert.equal(game.tutorialAdvisorDialogue, null);
  assert.deepEqual(calls, [['clear'], ['closed'], ['render', 'closeAdvisor'], ['refresh']]);
});

test('submit naming closes shell and game naming after successful submit', async () => {
  const calls = [];
  const game = {
    submitNaming(name) {
      calls.push(['submit', name]);
      return Promise.resolve(true);
    },
    closeNamingModal() {
      calls.push(['gameClose']);
    },
    tutorialController: {
      refreshCurrentHighlight() {
        calls.push(['refresh']);
      },
    },
  };
  const host = {
    lastGame: game,
    getNamingName() {
      return 'River City';
    },
    closeNaming() {
      calls.push(['hostClose']);
    },
  };
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(await controller.handle_submitNaming({ type: 'submitNaming' }), true);
  assert.deepEqual(calls, [['submit', 'River City'], ['hostClose'], ['gameClose'], ['refresh']]);
});

test('submit naming prefers game promise instead of boolean forward result', async () => {
  const calls = [];
  const game = {
    submitNaming(name) {
      calls.push(['submit', name]);
      return Promise.resolve(true);
    },
    closeNamingModal() {
      calls.push(['gameClose']);
    },
    tutorialController: {
      refreshCurrentHighlight() {
        calls.push(['refresh']);
      },
    },
  };
  const host = {
    lastGame: game,
    getNamingName() {
      return 'River City';
    },
    closeNaming() {
      calls.push(['hostClose']);
    },
  };
  const controller = new HostController({ host: host, awaitAsync: true });
  controller.forward = (action) => {
    calls.push(['forward', action.type]);
    return true;
  };

  assert.equal(await controller.handle_submitNaming({ type: 'submitNaming' }), true);
  assert.deepEqual(calls, [['submit', 'River City'], ['hostClose'], ['gameClose'], ['refresh']]);
});

test('reset request opens canvas confirmation before executing reset', async () => {
  const calls = [];
  const game = {
    resetGame() {
      calls.push(['resetGame']);
      return true;
    },
  };
  const host = {
    lastGame: game,
    openResetConfirm(options) {
      calls.push(['openResetConfirm', options.source]);
      return true;
    },
  };
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(
    controller.handle_requestResetGame({ type: 'requestResetGame', source: 'settings' }),
    true,
  );
  assert.equal(controller.handle_resetGame({ type: 'resetGame', source: 'legacy' }), true);
  assert.deepEqual(calls, [
    ['openResetConfirm', 'settings'],
    ['openResetConfirm', 'legacy'],
  ]);
});

test('reset request uses canvas shell when the action host is the game app', async () => {
  const calls = [];
  const canvasShell = {
    openResetConfirm(options) {
      calls.push(['shellOpenResetConfirm', options.source]);
      return true;
    },
  };
  const game = {
    canvasShell,
    resetGame() {
      calls.push(['resetGame']);
      return true;
    },
  };
  const controller = new HostController({ host: game, awaitAsync: true });

  assert.equal(
    controller.handle_requestResetGame({ type: 'requestResetGame', source: 'debugResetAccount' }),
    true,
  );
  assert.deepEqual(calls, [['shellOpenResetConfirm', 'debugResetAccount']]);
});

test('downloadClientOperationLog saves local client operation log through runtime logger', () => {
  const calls = [];
  const game = {
    playerId: 'test1',
    authStorage: { getUsername: () => 'test1' },
  };
  const host = {
    lastGame: game,
    runtime: {
      ClientOperationLog: {
        download(options) {
          calls.push(['download', options.reason, options.playerId, options.username]);
          return { success: true, fileName: 'wxgame-oplog-test1.json' };
        },
      },
    },
    showFloatingText(message) {
      calls.push(['float', message]);
    },
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
  };
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(
    controller.handle_downloadClientOperationLog({ type: 'downloadClientOperationLog' }),
    true,
  );
  assert.deepEqual(calls, [
    ['download', 'settings-download', 'test1', 'test1'],
    ['float', '操作日志已保存：wxgame-oplog-test1.json'],
    ['render', 'downloadClientOperationLog'],
  ]);
});

test('downloadClientOperationLog falls back to global ClientOperationLog', () => {
  const calls = [];
  const previous = globalThis.ClientOperationLog;
  globalThis.ClientOperationLog = {
    download(options) {
      calls.push(['download', options.reason]);
      return { success: true, fileName: 'wxgame-oplog-global.json' };
    },
  };
  const host = {
    showFloatingText(message) {
      calls.push(['float', message]);
    },
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
  };
  const controller = new HostController({ host: host, awaitAsync: true });

  try {
    assert.equal(
      controller.handle_downloadClientOperationLog({ type: 'downloadClientOperationLog' }),
      true,
    );
    assert.deepEqual(calls, [
      ['download', 'settings-download'],
      ['float', '操作日志已保存：wxgame-oplog-global.json'],
      ['render', 'downloadClientOperationLog'],
    ]);
  } finally {
    globalThis.ClientOperationLog = previous;
  }
});

test('downloadClientOperationLog reports concrete local save failure', () => {
  const calls = [];
  const host = {
    runtime: {
      ClientOperationLog: {
        download() {
          calls.push(['download']);
          return { success: false, error: 'CLIENT_OPERATION_LOG_DOWNLOAD_UNSUPPORTED' };
        },
      },
    },
    showFloatingText(message, options) {
      calls.push(['float', message, options.color]);
    },
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
  };
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(
    controller.handle_downloadClientOperationLog({ type: 'downloadClientOperationLog' }),
    true,
  );
  assert.deepEqual(calls, [
    ['download'],
    ['float', 'CLIENT_OPERATION_LOG_DOWNLOAD_UNSUPPORTED', '#ffb86b'],
    ['render', 'downloadClientOperationLog'],
  ]);
});

test('shell blocking panel actions route canonical opens through the snapshot owner', async () => {
  const calls = [];
  const game = makeModalHost({
    tutorialController: {
      refreshCurrentHighlight() {
        calls.push(['refresh']);
      },
    },
  });
  const host = makeModalHost({
    lastGame: game,
    runtime: {
      setTimeout(callback) {
        calls.push(['timeout']);
        callback();
      },
    },
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
  });
  game.canvasShell = host;
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(controller.handle_openSettings({ type: 'openSettings' }), true);
  assert.equal(host.isBlockingPanelSnapshotOpen('showSettings'), true);
  assert.equal(host.isModalOpen('modal:settings'), true);

  assert.equal(
    await controller.handle_openCommandPanel({ type: 'openCommandPanel', panel: 'tech' }),
    true,
  );
  assert.equal(host.getCommandPanelValue(), 'tech');
  assert.equal(host.isModalOpen('modal:commandPanel'), true);
  assert.deepEqual(host.getModalPayload('modal:commandPanel')?.value, 'tech');
  // Axis-1 mutual exclusion: opening the command panel sweeps the settings panel.
  assert.equal(host.isBlockingPanelSnapshotOpen('showSettings'), false);

  assert.equal(controller.handle_closeCommandPanel({ type: 'closeCommandPanel' }), true);
  assert.equal(host.getCommandPanelValue(), '');
  assert.equal(host.isModalOpen('modal:commandPanel'), false);
  assert.deepEqual(
    calls.map((call) => call[0]),
    ['render', 'render', 'refresh', 'timeout', 'refresh', 'render'],
  );
});

test('confirm reset executes reset after canvas confirmation', async () => {
  const calls = [];
  const game = {
    resetGame(options) {
      calls.push(['resetGame', options]);
      return Promise.resolve(true);
    },
    resetLocalViewToResources(options) {
      calls.push(['gameResetView', options]);
    },
  };
  const host = {
    lastGame: game,
    getConfirmDialogSnapshot() {
      return { visible: true, kind: 'resetGame', source: 'settings' };
    },
    setConfirmDialogSubmitting(value) {
      calls.push(['submitting', value]);
      return true;
    },
    closeConfirmDialog() {
      calls.push(['closeConfirmDialog']);
      return true;
    },
    resetLocalViewToResources(options) {
      calls.push(['hostResetView', options]);
    },
    renderCanvasAction(action) {
      calls.push(['render', action.type, action.tab]);
    },
  };
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(await controller.handle_confirmResetGame({ type: 'confirmResetGame' }), true);
  assert.deepEqual(calls, [
    ['submitting', true],
    ['resetGame', { confirmed: true, source: 'settings' }],
    ['submitting', false],
    ['closeConfirmDialog'],
    ['hostResetView', { skipRender: true }],
    ['gameResetView', { skipShell: true, skipRender: true }],
    ['render', 'confirmResetGame', 'military'],
  ]);
});

test('entrypoints load CanvasActionController without retired shell action handler module', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
  const minigame = fs.readFileSync(path.resolve(__dirname, '../../minigame/game.js'), 'utf8');

  assert.equal(html.includes('CanvasShellActionHandlers.js'), false);
  assert.equal(html.includes('CanvasActionController.js'), true);
  assert.equal(minigame.includes("require('../js/platform/CanvasShellActionHandlers')"), false);
  assert.equal(minigame.includes("require('../js/platform/CanvasActionController')"), true);
});
