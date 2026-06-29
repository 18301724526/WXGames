const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasCityActionHandlers = require('./CanvasCityActionHandlers');
const CanvasModeOwnershipRuntime = require('./CanvasModeOwnershipRuntime');
const CanvasModalSnapshotAdapter = require('./CanvasModalSnapshotAdapter');

// Batch 8F: the blocking panels are owned modal subtypes. A modal-capable host
// carries the ownership bridge (openModal/isModalOpen/getRendererSnapshot) and the
// snapshot adapter (openBlockingPanelSnapshot/closeBlockingPanelsSnapshot/
// isBlockingPanelSnapshotOpen/getCommandPanelValue) so the city handlers route
// through the owner instead of host mirrors.
class ModalHost {}
CanvasModeOwnershipRuntime.install(ModalHost);
CanvasModalSnapshotAdapter.install(ModalHost);

function makeModalHost(fields = {}) {
  return Object.assign(new ModalHost(), fields);
}

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

  getEventController() {
    return this.host?.eventController || this.getGameHost()?.eventController || null;
  }

  getBuildingController() {
    return this.host?.buildingController || this.getGameHost()?.buildingController || null;
  }

  closePanels(except = []) {
    const keep = new Set(except);
    this.host?.closeBlockingPanelsSnapshot?.(except);
    if (!keep.has('activeEventId')) this.host?.closeEventSnapshot?.();
  }

  closePanelsOn(target, except = []) {
    if (!target || target === this.host || typeof target !== 'object') return;
    const keep = new Set(except);
    target.closeBlockingPanelsSnapshot?.(except);
    if (!keep.has('activeEventId')) target.closeEventSnapshot?.();
  }

  closePanelsEverywhere(except = []) {
    this.closePanels(except);
    const game = this.getGameHost();
    this.closePanelsOn(game, except);
    this.closePanelsOn(game?.canvasShell, except);
    return game;
  }

  forward() {
    return undefined;
  }

  finalize(result) {
    if (!result || typeof result.then !== 'function') return result !== false;
    return result.then((value) => value !== false);
  }

  async runAction(callback) {
    return callback();
  }

  afterHandled(action) {
    this.host.renderCanvasAction?.(action);
    return true;
  }
}

CanvasCityActionHandlers.install(HostController);

test('CanvasCityActionHandlers installs city compatibility methods', () => {
  assert.equal(typeof HostController.prototype.handle_openCityManagement, 'function');
  assert.equal(typeof HostController.prototype.handle_buildBuilding, 'function');
  assert.equal(typeof HostController.prototype.handle_claimEvent, 'function');
  assert.equal(typeof HostController.prototype.handle_selectTechNode, 'function');
});

test('building action delegates to building controller and always clears pending state', async () => {
  const calls = [];
  const game = {
    pendingBuildingAction: null,
    setPendingBuildingAction(pending, options = {}) {
      calls.push(['gamePending', pending, options]);
      this.pendingBuildingAction = pending;
    },
  };
  const host = {
    pendingBuildingAction: null,
    lastGame: game,
    setPendingBuildingAction(pending, options = {}) {
      calls.push(['hostPending', pending, options]);
      this.pendingBuildingAction = pending;
    },
    buildingController: {
      async handleAction(action) {
        calls.push(['handleAction', action]);
      },
    },
  };
  const controller = new HostController(host);

  assert.equal(await controller.handle_buildBuilding({ type: 'buildBuilding', buildingId: 'hut' }), true);

  assert.equal(host.pendingBuildingAction, null);
  assert.equal(game.pendingBuildingAction, null);
  assert.deepEqual(calls, [
    ['hostPending', { buildingId: 'hut', action: 'build' }, {}],
    ['gamePending', { buildingId: 'hut', action: 'build' }, { render: false }],
    ['handleAction', { buildingId: 'hut', action: 'build' }],
    ['hostPending', null, {}],
    ['gamePending', null, { render: false }],
  ]);
});

test('event claim closes event state, syncs tutorial, and exposes reward reveal fallback', async () => {
  const calls = [];
  const game = {
    __eventSnapshot: { eventId: 'event-1', visible: true },
    closeEventSnapshot() {
      this.__eventSnapshot = null;
    },
    isEventSnapshotOpen() {
      return Boolean(this.__eventSnapshot);
    },
    canvasShell: null,
    tutorialController: {
      sync(tutorial) {
        calls.push(['sync', tutorial.currentStep]);
      },
      refreshCurrentHighlight() {
        calls.push(['refresh']);
      },
    },
  };
  const host = {
    __eventSnapshot: { eventId: 'event-1', visible: true },
    closeEventSnapshot() {
      this.__eventSnapshot = null;
      game.closeEventSnapshot();
    },
    isEventSnapshotOpen() {
      return Boolean(this.__eventSnapshot);
    },
    lastGame: game,
    state: { eventQueue: [{ id: 'event-1' }] },
    eventController: {
      open(eventId) {
        calls.push(['open', eventId]);
      },
      close() {
        calls.push(['close']);
      },
      async claimActive(optionId) {
        calls.push(['claimActive', optionId]);
        return {
          tutorial: { currentStep: 14 },
          rewardReveal: { title: 'Wood', items: [{ id: 'wood', amount: 5 }] },
        };
      },
    },
    __rewardRevealSnapshot: null,
    openRewardRevealSnapshot(payload) {
      this.__rewardRevealSnapshot = payload || null;
      return this.__rewardRevealSnapshot;
    },
    getRewardRevealSnapshot() {
      return this.__rewardRevealSnapshot;
    },
    hideGuideHighlight() {
      calls.push(['hideGuideHighlight']);
    },
  };
  game.canvasShell = host;
  const controller = new HostController(host);

  assert.equal(await controller.handle_claimEvent({
    type: 'claimEvent',
    eventId: 'event-1',
    optionId: 'collect',
  }), true);

  assert.equal(host.isEventSnapshotOpen(), false);
  assert.equal(game.isEventSnapshotOpen(), false);
  assert.deepEqual(host.getRewardRevealSnapshot(), { title: 'Wood', items: [{ id: 'wood', amount: 5 }] });
  assert.deepEqual(calls, [
    ['close'],
    ['open', 'event-1'],
    ['claimActive', 'collect'],
    ['sync', 14],
    ['close'],
    ['hideGuideHighlight'],
    ['refresh'],
  ]);
});

test('task center tab switch preserves historical custom category values', () => {
  const calls = [];
  const game = {};
  const host = {
    activeTaskCenterTab: 'main',
    lastGame: game,
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
  };
  const controller = new HostController(host);

  assert.equal(controller.handle_switchTaskCenterTab({ type: 'switchTaskCenterTab', tab: 'seasonal' }), true);
  assert.equal(host.activeTaskCenterTab, 'seasonal');
  assert.equal(game.activeTaskCenterTab, 'seasonal');
  assert.deepEqual(calls, [['render', 'switchTaskCenterTab']]);
});

test('city blocking panels route task center and tech detail through the snapshot owner', () => {
  const calls = [];
  const shell = makeModalHost({});
  const game = makeModalHost({
    canvasShell: shell,
    state: { techUiState: {} },
    tutorialController: {
      refreshCurrentHighlight() {
        calls.push(['refresh']);
      },
    },
  });
  const host = makeModalHost({
    activeTaskCenterTab: 'main',
    lastGame: game,
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
  });
  shell.lastGame = game;
  const controller = new HostController(host);

  assert.equal(controller.handle_openTaskCenter({ type: 'openTaskCenter', tab: 'seasonal' }), true);
  assert.equal(host.isBlockingPanelSnapshotOpen('showTaskCenter'), true);
  assert.equal(host.isModalOpen('modal:taskCenter'), true);
  assert.equal(host.getRendererSnapshot().panel.showTaskCenter, true);
  assert.equal(host.activeTaskCenterTab, 'seasonal');
  assert.equal(game.activeTaskCenterTab, 'seasonal');
  assert.equal(shell.activeTaskCenterTab, 'seasonal');

  assert.equal(controller.handle_selectTechNode({ type: 'selectTechNode', techId: 'writing' }), true);
  assert.equal(host.isBlockingPanelSnapshotOpen('techDetailOpen'), true);
  assert.equal(host.isModalOpen('modal:techDetail'), true);
  assert.equal(host.getRendererSnapshot().panel.techDetailOpen, true);
  assert.equal(host.selectedTechId, undefined);
  assert.equal(game.state.techUiState.selectedTechId, 'writing');
  // Axis-3: opening tech detail does NOT sweep the other panels, so the task center
  // opened above stays open.
  assert.equal(host.isBlockingPanelSnapshotOpen('showTaskCenter'), true);

  assert.equal(controller.handle_closeTechDetail({ type: 'closeTechDetail' }), true);
  assert.equal(host.isBlockingPanelSnapshotOpen('techDetailOpen'), false);
  assert.equal(host.isModalOpen('modal:techDetail'), false);
  assert.equal(game.state.techUiState.detailOpen, false);
});

test('entrypoints load city action handlers before CanvasActionController', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
  const minigame = fs.readFileSync(path.resolve(__dirname, '../../minigame/game.js'), 'utf8');

  assert.equal(html.indexOf('CanvasTerritoryActionHandlers.js') < html.indexOf('CanvasCityActionHandlers.js'), true);
  assert.equal(html.indexOf('CanvasCityActionHandlers.js') < html.indexOf('CanvasActionController.js'), true);
  assert.equal(minigame.indexOf("require('../js/platform/CanvasTerritoryActionHandlers')")
    < minigame.indexOf("require('../js/platform/CanvasCityActionHandlers')"), true);
  assert.equal(minigame.indexOf("require('../js/platform/CanvasCityActionHandlers')")
    < minigame.indexOf("require('../js/platform/CanvasActionController')"), true);
});
