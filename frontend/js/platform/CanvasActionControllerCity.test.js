const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasActionController = require('./CanvasActionController');
const CanvasActionDescriptorRegistry = require('./CanvasActionDescriptorRegistry');
const CanvasActionDispatcher = require('./CanvasActionDispatcher');
const ChangeEventBus = require('../state/ChangeEventBus');
const { makeModalOwnerHost } = require('../../test-support/CanvasOwnerTestHarness');

const makeModalHost = makeModalOwnerHost;

const HostController = CanvasActionController;

test('CanvasActionController installs city compatibility methods', () => {
  assert.equal(typeof HostController.prototype.handle_openCityManagement, 'function');
  assert.equal(typeof HostController.prototype.handle_buildBuilding, 'undefined');
  assert.equal(typeof HostController.prototype.handle_upgradeBuilding, 'undefined');
  assert.equal(typeof HostController.prototype.handle_claimEvent, 'function');
  assert.equal(typeof HostController.prototype.handle_selectTechNode, 'function');
});

test('building action descriptors declare the command-submit contract', () => {
  assert.deepEqual(CanvasActionDescriptorRegistry.supportedActions(), [
    'buildBuilding',
    'upgradeBuilding',
  ]);

  const build = CanvasActionDescriptorRegistry.resolve({ type: 'buildBuilding' });
  assert.equal(build.id, 'building.build');
  assert.equal(build.actionType, 'buildBuilding');
  assert.equal(build.owner, 'player');
  assert.equal(build.surface, 'city:buildings');
  assert.equal(build.kind, 'command-submit');
  assert.equal(build.commandType, 'build');
  assert.equal(build.payloadBuilder, 'buildingId');
  assert.deepEqual(build.traceFields, [
    'buildingId',
    'clientActionTraceId',
    'sourceSurface',
    'hitTargetId',
  ]);
  assert.equal(build.visualStateSource, 'BuildingPresenter.buildBuildingViewState');
  assert.deepEqual(
    CanvasActionDescriptorRegistry.buildPayload({ type: 'buildBuilding', buildingId: 'house' }),
    { buildingId: 'house' },
  );

  const upgrade = CanvasActionDescriptorRegistry.resolve({ type: 'upgradeBuilding' });
  assert.equal(upgrade.id, 'building.upgrade');
  assert.equal(upgrade.commandType, 'upgrade');
  assert.deepEqual(
    CanvasActionDescriptorRegistry.buildPayload({ type: 'upgradeBuilding', buildingId: 'farm' }),
    { buildingId: 'farm' },
  );
});

test('building descriptor dispatch delegates to the mounted game host', () => {
  const calls = [];
  const game = {
    buildBuilding(buildingId) {
      calls.push(['buildBuilding', buildingId]);
      return true;
    },
    upgradeBuilding(buildingId) {
      calls.push(['upgradeBuilding', buildingId]);
      return true;
    },
  };
  const context = {
    lastGame: game,
    render(action) {
      calls.push(['render', action.type, action.actionDescriptorId]);
    },
  };
  const dispatcher = new CanvasActionDispatcher();

  assert.equal(dispatcher.canHandle({ type: 'buildBuilding', buildingId: 'hut' }, context), true);
  assert.equal(dispatcher.handle({ type: 'buildBuilding', buildingId: 'hut' }, context), true);
  assert.equal(dispatcher.handle({ type: 'upgradeBuilding', buildingId: 'farm' }, context), true);
  assert.deepEqual(calls, [
    ['buildBuilding', 'hut'],
    ['render', 'buildBuilding', 'building.build'],
    ['upgradeBuilding', 'farm'],
    ['render', 'upgradeBuilding', 'building.upgrade'],
  ]);
});

test('building descriptor keeps visualDisabled as trace metadata and still submits', () => {
  const calls = [];
  const logs = [];
  const dispatcher = new CanvasActionDispatcher();

  assert.equal(dispatcher.handle({
    type: 'buildBuilding',
    buildingId: 'farm',
    disabled: true,
    clientActionTraceId: 'cat-build-farm',
    sourceSurface: 'building-panel',
  }, {
    clientOperationLog: { record(event, detail) { logs.push([event, detail]); } },
    buildBuilding(buildingId, meta) {
      calls.push([
        'buildBuilding',
        buildingId,
        meta.descriptor.id,
        meta.payload,
        meta.action.clientActionTrace.actionDescriptorId,
        meta.action.clientActionTrace.visualDisabled,
      ]);
      return true;
    },
  }), true);

  assert.deepEqual(calls, [
    ['buildBuilding', 'farm', 'building.build', { buildingId: 'farm' }, 'building.build', true],
  ]);
  assert.deepEqual(logs, []);
});

test('event claim closes event state, publishes completion, and exposes reward reveal fallback', async () => {
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
  };
  game.canvasShell = host;
  const changeEventBus = ChangeEventBus.createEventBus();
  changeEventBus.subscribe('eventClaimed', (payload) => {
    calls.push(['eventClaimed', payload.eventId, payload.optionId]);
  });
  const controller = new HostController({ host: host, awaitAsync: true, changeEventBus });

  assert.equal(
    await controller.handle_claimEvent({
      type: 'claimEvent',
      eventId: 'event-1',
      optionId: 'collect',
    }),
    true,
  );

  assert.equal(host.isEventSnapshotOpen(), false);
  assert.equal(game.isEventSnapshotOpen(), false);
  assert.deepEqual(host.getRewardRevealSnapshot(), {
    title: 'Wood',
    items: [{ id: 'wood', amount: 5 }],
  });
  assert.deepEqual(calls, [
    ['close'],
    ['open', 'event-1'],
    ['claimActive', 'collect'],
    ['close'],
    ['eventClaimed', 'event-1', 'collect'],
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
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(
    controller.handle_switchTaskCenterTab({ type: 'switchTaskCenterTab', tab: 'seasonal' }),
    true,
  );
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
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(controller.handle_openTaskCenter({ type: 'openTaskCenter', tab: 'seasonal' }), true);
  assert.equal(host.isBlockingPanelSnapshotOpen('showTaskCenter'), true);
  assert.equal(host.isModalOpen('modal:taskCenter'), true);
  assert.equal(host.getRendererSnapshot().panel.showTaskCenter, true);
  assert.equal(host.activeTaskCenterTab, 'seasonal');
  assert.equal(game.activeTaskCenterTab, 'seasonal');
  assert.equal(shell.activeTaskCenterTab, 'seasonal');

  assert.equal(
    controller.handle_selectTechNode({ type: 'selectTechNode', techId: 'writing' }),
    true,
  );
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

test('entrypoints load CanvasActionController without retired city action handler module', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
  const minigame = fs.readFileSync(path.resolve(__dirname, '../../minigame/game.js'), 'utf8');

  assert.equal(html.includes('CanvasCityActionHandlers.js'), false);
  assert.equal(html.includes('CanvasTerritoryActionHandlers.js'), false);
  assert.equal(html.includes('CanvasActionController.js'), true);
  assert.equal(minigame.includes("require('../js/platform/CanvasCityActionHandlers')"), false);
  assert.equal(minigame.includes("require('../js/platform/CanvasTerritoryActionHandlers')"), false);
  assert.equal(minigame.includes("require('../js/platform/CanvasActionController')"), true);
});
