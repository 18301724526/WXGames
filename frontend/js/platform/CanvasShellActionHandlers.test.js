const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasShellActionHandlers = require('./CanvasShellActionHandlers');

class HostController {
  constructor(host) {
    this.host = host;
    this.awaitAsync = true;
  }

  getGameHost() {
    return this.host?.lastGame || this.host;
  }

  getState() {
    return this.host?.state || this.getGameHost()?.state || {};
  }

  closePanels(except = []) {
    const keep = new Set(except);
    ['showSettings', 'showLogs', 'showAdvisor', 'activeCommandPanel'].forEach((key) => {
      if (!keep.has(key) && key in this.host) this.host[key] = key === 'activeCommandPanel' ? '' : false;
    });
    if (!keep.has('activeEventId') && 'activeEventId' in this.host) this.host.activeEventId = null;
  }

  forward() {
    return undefined;
  }

  finalize(result) {
    if (!result || typeof result.then !== 'function') return result !== false;
    return result.then((value) => value !== false);
  }

  render(action = {}) {
    this.host.renderCanvasAction?.(action);
    return true;
  }

  afterHandled(action) {
    if (action.type !== 'switchTab' && action.type !== 'goToGuideTaskTarget') this.render(action);
    return true;
  }

  handle(action, meta = {}) {
    const handler = this[`handle_${action.type}`];
    return handler.call(this, action, meta);
  }
}

CanvasShellActionHandlers.install(HostController);

test('CanvasShellActionHandlers installs shell compatibility methods', () => {
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
    state: { currentTab: 'military' },
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
  const controller = new HostController(host);

  assert.equal(await controller.handle_switchTab({ type: 'switchTab', tab: 'tech' }), true);
  assert.deepEqual(calls, [
    ['select', 'tech'],
    ['resolve', 'military', 'tech'],
  ]);
});

test('advisor close clears dialogue across shell and game then resumes tutorial', async () => {
  const calls = [];
  const game = {
    showAdvisor: true,
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
  };
  const host = {
    showAdvisor: true,
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
  };
  game.canvasShell = host;
  const controller = new HostController(host);

  assert.equal(await controller.handle_closeAdvisor({ type: 'closeAdvisor' }), true);
  assert.equal(host.showAdvisor, false);
  assert.equal(game.showAdvisor, false);
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
  const controller = new HostController(host);

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
  const controller = new HostController(host);
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
  const controller = new HostController(host);

  assert.equal(controller.handle_requestResetGame({ type: 'requestResetGame', source: 'settings' }), true);
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
  const controller = new HostController(game);

  assert.equal(controller.handle_requestResetGame({ type: 'requestResetGame', source: 'debugResetAccount' }), true);
  assert.deepEqual(calls, [
    ['shellOpenResetConfirm', 'debugResetAccount'],
  ]);
});

test('confirm reset executes reset after canvas confirmation', async () => {
  const calls = [];
  const game = {
    resetGame(options) {
      calls.push(['resetGame', options]);
      return Promise.resolve(true);
    },
    resetLocalViewToWorldMap(options) {
      calls.push(['gameResetView', options]);
    },
  };
  const host = {
    lastGame: game,
    confirmDialog: { visible: true, kind: 'resetGame', source: 'settings' },
    setConfirmDialogSubmitting(value) {
      calls.push(['submitting', value]);
      return true;
    },
    closeConfirmDialog() {
      calls.push(['closeConfirmDialog']);
      this.confirmDialog = null;
      return true;
    },
    resetLocalViewToWorldMap(options) {
      calls.push(['hostResetView', options]);
    },
    renderCanvasAction(action) {
      calls.push(['render', action.type, action.tab]);
    },
  };
  const controller = new HostController(host);

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

test('shell action handler entrypoints load before CanvasActionController', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
  const minigame = fs.readFileSync(path.resolve(__dirname, '../../minigame/game.js'), 'utf8');

  assert.equal(html.indexOf('CanvasShellActionHandlers.js') < html.indexOf('CanvasActionController.js'), true);
  assert.equal(minigame.indexOf("require('../js/platform/CanvasShellActionHandlers')")
    < minigame.indexOf("require('../js/platform/CanvasActionController')"), true);
});
