const test = require('node:test');
const assert = require('node:assert/strict');

global.EcsModeRuntime = require('../ecs/mode/EcsModeRuntimeEntry');
const CanvasModeOwnershipBridge = require('./CanvasModeOwnershipBridge');

test('CanvasModeOwnershipBridge derives world map mode facts from legacy fields', () => {
  const host = {
    state: { currentTab: 'military', militaryView: 'world' },
    mapHomeActive: true,
  };
  const facts = CanvasModeOwnershipBridge.deriveModeFacts(host);

  assert.equal(facts.baseModeKey, 'worldMap');
  assert.equal(facts.worldMapHomeActive, true);
  assert.deepEqual(facts.modalKeys, []);
});

test('CanvasModeOwnershipBridge maps scattered modal fields to modal mode keys', () => {
  const host = {
    showTaskCenter: true,
    naming: { visible: true },
    confirmDialog: { visible: true },
    lastGame: {
      state: { currentTab: 'resources', militaryView: 'army' },
      rewardReveal: { rewardText: '+1' },
    },
  };

  assert.deepEqual(CanvasModeOwnershipBridge.collectModalKeys(host), [
    'modal:naming',
    'modal:rewardReveal',
    'modal:confirmDialog',
    'modal:blockingPanel',
  ]);
});

test('CanvasModeOwnershipBridge installs snapshot helpers on legacy facades', () => {
  class Host {}
  assert.equal(CanvasModeOwnershipBridge.install(Host), true);

  const host = new Host();
  Object.assign(host, {
    state: { currentTab: 'military', militaryView: 'world' },
    mapHomeActive: true,
  });

  const snapshot = host.getModeSnapshot();
  assert.equal(snapshot.baseModeKey, 'worldMap');
  assert.equal(host.canRouteModeWorldMap(), true);

  host.showGuidebook = true;
  const blocked = host.refreshModeSnapshot();
  assert.equal(blocked.blockingOverlayActive, true);
  assert.equal(host.canRouteModeWorldMap(), false);
});

test('CanvasModeOwnershipBridge preserves tech panel routing exception', () => {
  const host = {
    activeTab: 'tech',
    activeCommandPanel: 'tech',
  };

  const facts = CanvasModeOwnershipBridge.deriveModeFacts(host);

  assert.equal(facts.baseModeKey, 'techTree');
  assert.equal(facts.blockingOverlayActive, true);
  assert.equal(facts.techTreeBlockingOverlayActive, false);

  class Host {}
  CanvasModeOwnershipBridge.install(Host);
  const installedHost = Object.assign(new Host(), host);

  assert.equal(installedHost.isModeBlockingOverlayOpen(), true);
  assert.equal(installedHost.canRouteModeTechTree(), true);

  installedHost.showSettings = true;
  assert.equal(installedHost.refreshModeSnapshot().techTreeBlockingOverlayActive, true);
  assert.equal(installedHost.canRouteModeTechTree(), false);
});

test('CanvasModeOwnershipBridge resolves covered-mode input intents from the snapshot', () => {
  class Host {}
  CanvasModeOwnershipBridge.install(Host);

  const worldHost = Object.assign(new Host(), {
    state: { currentTab: 'military', militaryView: 'world' },
    mapHomeActive: true,
  });
  assert.equal(worldHost.resolveInputIntent({ kind: 'drag' }).route, 'world-map');
  assert.equal(worldHost.resolveInputIntent({ kind: 'gesture' }).route, 'world-map');

  const techHost = Object.assign(new Host(), { activeTab: 'tech', activeCommandPanel: 'tech' });
  assert.equal(techHost.resolveInputIntent({ kind: 'drag' }).route, 'tech-tree');

  const battleHost = Object.assign(new Host(), { entityBattle: { visible: true } });
  assert.equal(battleHost.resolveInputIntent({ kind: 'drag' }).route, 'entity-battle');

  const cityHost = Object.assign(new Host(), {
    state: { currentTab: 'resources', militaryView: 'army' },
  });
  assert.equal(cityHost.resolveInputIntent({ kind: 'drag' }).route, 'city');

  // The free-function form on the public api takes the host explicitly.
  assert.equal(
    CanvasModeOwnershipBridge.resolveInputIntent(worldHost, { kind: 'drag' }).route,
    'world-map',
  );
});

test('CanvasModeOwnershipBridge owns modal open/close/update + token callbacks', () => {
  class Host {}
  CanvasModeOwnershipBridge.install(Host);
  const host = new Host();

  const opened = host.openModal('modal:naming', {
    visible: true,
    view: { title: 'T' },
    inputValue: '',
  });
  assert.equal(host.isModalOpen('modal:naming'), true);
  assert.deepEqual(opened, { visible: true, view: { title: 'T' }, inputValue: '' });

  host.updateModalPayload('modal:naming', { inputValue: 'abc' });
  assert.equal(host.getModalPayload('modal:naming').inputValue, 'abc');

  host.closeModal('modal:naming');
  assert.equal(host.isModalOpen('modal:naming'), false);
  assert.equal(host.getModalPayload('modal:naming'), null);

  // confirmDialog-style token callback (forward-looking; naming has none).
  let confirmed = 0;
  host.openModal(
    'modal:confirmDialog',
    { visible: true, kind: 'resetGame' },
    { onConfirm: () => (confirmed += 1) },
  );
  host.resolveModalCallback('modal:confirmDialog', 'onConfirm');
  assert.equal(confirmed, 1);
  host.closeModal('modal:confirmDialog');
  host.resolveModalCallback('modal:confirmDialog', 'onConfirm'); // cleared on close -> inert
  assert.equal(confirmed, 1);

  // naming-specific wrappers used by the App/Shell host methods
  const mirror = host.openNamingModal({ visible: true, view: { title: 'N' }, inputValue: '' });
  assert.equal(host.isModalOpen('modal:naming'), true);
  assert.equal(mirror.visible, true);
  host.updateNamingPayload({ inputValue: 'z' });
  assert.equal(host.getModalPayload('modal:naming').inputValue, 'z');
  host.closeNamingOwner();
  assert.equal(host.isModalOpen('modal:naming'), false);
});

test('CanvasModeOwnershipBridge install does not shadow a host closeNamingModal full-close', () => {
  class Host {}
  // Legacy full-close like CanvasGameAppGuideUi.closeNamingModal (reset + render).
  Object.assign(Host.prototype, {
    closeNamingModal() {
      this.naming = { visible: false };
      this.__fullClosed = true;
    },
  });
  // Bridge installs AFTER the legacy mixin (matches CanvasGameApp install order)
  // and must NOT overwrite closeNamingModal with an owner-only close.
  CanvasModeOwnershipBridge.install(Host);
  const host = new Host();
  host.closeNamingModal();
  assert.equal(host.__fullClosed, true);
  assert.equal(host.naming.visible, false);
  assert.equal(typeof host.closeNamingOwner, 'function');
});

test('CanvasModeOwnershipBridge confirmDialog wrappers seal state and resolve continuations', () => {
  class Host {}
  CanvasModeOwnershipBridge.install(Host);
  const host = new Host();

  let confirmed = 0;
  let cancelled = 0;
  const mirror = host.openConfirmDialogModal(
    { visible: true, kind: 'resetGame', title: 'Reset?' },
    { onConfirm: () => (confirmed += 1), onCancel: () => (cancelled += 1) },
  );
  assert.equal(host.isModalOpen('modal:confirmDialog'), true);
  assert.equal(mirror.kind, 'resetGame');

  host.updateConfirmDialogPayload({ submitting: true });
  assert.equal(host.getModalPayload('modal:confirmDialog').submitting, true);

  host.resolveConfirmDialogCallback('onConfirm');
  assert.equal(confirmed, 1);

  host.closeConfirmDialogOwner();
  assert.equal(host.isModalOpen('modal:confirmDialog'), false);
  host.resolveConfirmDialogCallback('onCancel'); // callbacks cleared on close -> inert
  assert.equal(cancelled, 0);
});

test('CanvasModeOwnershipBridge rewardReveal wrappers seal presentation state', () => {
  class Host {}
  CanvasModeOwnershipBridge.install(Host);
  const host = new Host();

  const reveal = host.openRewardRevealModal({
    title: 'Reward',
    resources: { gold: 5 },
    createdAt: 1,
  });
  assert.equal(host.isModalOpen('modal:rewardReveal'), true);
  assert.deepEqual(reveal, { title: 'Reward', resources: { gold: 5 }, createdAt: 1 });
  assert.equal(host.getModalPayload('modal:rewardReveal').title, 'Reward');

  host.closeRewardRevealOwner();
  assert.equal(host.isModalOpen('modal:rewardReveal'), false);
  assert.equal(host.getModalPayload('modal:rewardReveal'), null);
});

test('CanvasModeOwnershipBridge event wrappers sync mirrors without touching EventController cursor', () => {
  class Host {}
  CanvasModeOwnershipBridge.install(Host);
  const host = new Host();
  const shell = { activeEventId: null };
  const game = {
    activeEventId: null,
    canvasShell: shell,
    eventController: { activeEventId: 'claim-cursor' },
  };
  host.getCanvasGameHost = () => game;

  assert.equal(host.openEventModal('event-1'), 'event-1');
  assert.equal(host.isModalOpen('modal:event'), true);
  assert.deepEqual(host.getModalPayload('modal:event'), { eventId: 'event-1' });
  assert.equal(host.activeEventId, 'event-1');
  assert.equal(game.activeEventId, 'event-1');
  assert.equal(shell.activeEventId, 'event-1');
  assert.equal(game.eventController.activeEventId, 'claim-cursor');

  host.closeEventOwner();
  assert.equal(host.isModalOpen('modal:event'), false);
  assert.equal(host.activeEventId, null);
  assert.equal(game.activeEventId, null);
  assert.equal(shell.activeEventId, null);
  assert.equal(game.eventController.activeEventId, 'claim-cursor');
});

test('CanvasModeOwnershipBridge event wrappers preserve falsy but non-null event ids', () => {
  class Host {}
  CanvasModeOwnershipBridge.install(Host);
  const host = new Host();
  const game = { activeEventId: null };
  host.getCanvasGameHost = () => game;

  assert.equal(host.openEventModal(0), 0);
  assert.deepEqual(host.getModalPayload('modal:event'), { eventId: 0 });
  assert.equal(host.activeEventId, 0);
  assert.equal(game.activeEventId, 0);
});

test('CanvasModeOwnershipBridge targetPicker wrappers own picker payload and territory mirrors', () => {
  class Host {}
  CanvasModeOwnershipBridge.install(Host);
  const host = new Host();
  const shell = { territoryUiState: {} };
  const territoryController = { uiState: {} };
  const game = { canvasShell: shell, territoryController, territoryUiState: {} };
  host.getCanvasGameHost = () => game;

  const picker = {
    tileId: 'tile_0_0',
    candidates: [
      { id: 'capital', action: { type: 'openWorldSite', siteId: 'capital' } },
      { id: 'march-1', action: { type: 'selectWorldActor', actorId: 'march-1' } },
    ],
  };
  assert.equal(host.openWorldTargetPickerOwner(territoryController.uiState, picker), picker);
  assert.equal(host.isModalOpen('modal:targetPicker'), true);
  assert.deepEqual(host.getModalPayload('modal:targetPicker'), {
    pickerKind: 'worldTargetPicker',
    picker,
  });
  assert.equal(host.territoryUiState, territoryController.uiState);
  assert.equal(game.territoryUiState, territoryController.uiState);
  assert.equal(shell.territoryUiState, territoryController.uiState);
  assert.equal(territoryController.uiState.worldTargetPicker, picker);
  assert.equal(territoryController.uiState.worldMarchTarget, null);

  const formationTarget = { q: 2, r: -1, tileId: 'tile_2_-1', missionId: 'march-1' };
  const openedTarget = host.openWorldMarchFormationPickerOwner(
    territoryController.uiState,
    formationTarget,
  );
  assert.deepEqual(openedTarget, { ...formationTarget, pickerOpen: true });
  assert.deepEqual(host.getModalPayload('modal:targetPicker'), {
    pickerKind: 'worldMarchFormation',
    target: openedTarget,
  });
  assert.equal(territoryController.uiState.worldTargetPicker, null);
  assert.deepEqual(territoryController.uiState.worldMarchTarget, openedTarget);

  host.closeTargetPickerOwner(territoryController.uiState);
  assert.equal(host.isModalOpen('modal:targetPicker'), false);
  assert.equal(territoryController.uiState.worldTargetPicker, null);
  assert.deepEqual(territoryController.uiState.worldMarchTarget, {
    ...formationTarget,
    pickerOpen: false,
  });
});

test('CanvasModeOwnershipBridge blockingPanel wrappers own umbrella payload and mirrors', () => {
  class Host {}
  CanvasModeOwnershipBridge.install(Host);
  const host = new Host();
  const shell = { showSettings: false, activeCommandPanel: '', techDetailOpen: false };
  const game = {
    canvasShell: shell,
    showSettings: false,
    activeCommandPanel: '',
    techDetailOpen: false,
  };
  host.getCanvasGameHost = () => game;

  const settingsPayload = host.openBlockingPanelOwner('showSettings', true);
  assert.equal(host.isModalOpen('modal:blockingPanel'), true);
  assert.deepEqual(settingsPayload, {
    panelKey: 'showSettings',
    panelKind: 'settings',
    value: true,
  });
  assert.equal(host.showSettings, true);
  assert.equal(game.showSettings, true);
  assert.equal(shell.showSettings, true);

  host.closeBlockingPanelOwner('showSettings');
  const commandPayload = host.openBlockingPanelOwner('activeCommandPanel', 'tech');
  assert.deepEqual(commandPayload, {
    panelKey: 'activeCommandPanel',
    panelKind: 'commandPanel',
    value: 'tech',
  });
  assert.equal(host.activeCommandPanel, 'tech');
  assert.equal(game.activeCommandPanel, 'tech');
  assert.equal(shell.activeCommandPanel, 'tech');
  assert.equal(host.refreshModeSnapshot().techTreeBlockingOverlayActive, false);

  host.openBlockingPanelOwner('showSettings', true);
  assert.equal(host.refreshModeSnapshot().techTreeBlockingOverlayActive, true);

  host.closeBlockingPanelOwner('showSettings');
  assert.equal(host.isModalOpen('modal:blockingPanel'), false);
  assert.equal(host.showSettings, false);
  assert.equal(game.showSettings, false);
  assert.equal(shell.showSettings, false);
});

test('CanvasModeOwnershipBridge closeBlockingPanelsOwner keeps except panel and clears mirrors', () => {
  class Host {}
  CanvasModeOwnershipBridge.install(Host);
  const host = Object.assign(new Host(), {
    showTaskCenter: true,
    showSettings: true,
    activeCommandPanel: 'events',
  });

  host.openBlockingPanelOwner('showTaskCenter', true);
  const kept = host.closeBlockingPanelsOwner(['showTaskCenter']);
  assert.equal(host.isModalOpen('modal:blockingPanel'), true);
  assert.equal(kept.panelKey, 'showTaskCenter');
  assert.equal(host.showTaskCenter, true);
  assert.equal(host.showSettings, false);
  assert.equal(host.activeCommandPanel, '');

  host.closeBlockingPanelsOwner();
  assert.equal(host.isModalOpen('modal:blockingPanel'), false);
  assert.equal(host.showTaskCenter, false);
});

test('CanvasModeOwnershipBridge builds renderer snapshots from owner-backed mirrors', () => {
  class Host {}
  CanvasModeOwnershipBridge.install(Host);
  const host = new Host();
  const shell = {
    showTaskCenter: true,
    activeCommandPanel: 'tech',
    techDetailOpen: false,
    selectedTechId: 'tech-1',
  };
  const game = { canvasShell: shell, showTaskCenter: false, activeCommandPanel: '' };
  host.getCanvasGameHost = () => game;
  host.__ecsBattleDomainOwner = global.EcsModeRuntime.BattleDomainOwner.openBattleScene(null, {
    visible: true,
    report: { id: 'report-1' },
    turnIndex: 0,
  });
  host.openEventModal('event-1');
  host.openBlockingPanelOwner('showTaskCenter', true);

  const snapshot = host.buildRendererSnapshot({
    mode: {
      baseModeKey: 'techTree',
      modalKeys: ['modal:event', 'modal:blockingPanel'],
      selectedTechId: 'tech-1',
    },
  });

  assert.equal(snapshot.schema, 'renderer-snapshot-v1');
  assert.equal(Object.isFrozen(snapshot), true);
  assert.deepEqual(snapshot.modal['modal:event'].payload, { eventId: 'event-1' });
  assert.equal(snapshot.modal['modal:blockingPanel'].payload.panelKey, 'showTaskCenter');
  assert.equal(snapshot.panel.showTaskCenter, true);
  assert.equal(snapshot.panel.activeCommandPanel, 'tech');
  assert.equal(snapshot.panel.selectedTechId, undefined);
  assert.equal(snapshot.mode.baseModeKey, 'techTree');
  assert.equal(snapshot.mode.selectedTechId, undefined);
  assert.equal(snapshot.battle.activeOverlay, 'battleScene');
  assert.deepEqual(snapshot.battle.battleScene.report, { id: 'report-1' });
  assert.equal(host.getRendererSnapshot(), snapshot);

  assert.equal(CanvasModeOwnershipBridge.getRendererSnapshot(host), snapshot);
});

test('CanvasModeOwnershipBridge exposes battle facts only through read-only snapshot path', () => {
  class Host {}
  CanvasModeOwnershipBridge.install(Host);
  const host = new Host();

  const forbiddenWrapperNames = [
    'openBattleSceneOwner',
    'closeBattleSceneOwner',
    'openEntityBattleOwner',
    'closeEntityBattleOwner',
  ];

  forbiddenWrapperNames.forEach((name) => {
    assert.equal(typeof Host.prototype[name], 'undefined');
    assert.equal(typeof CanvasModeOwnershipBridge[name], 'undefined');
  });

  host.battleScene = { visible: true, report: { id: 'legacy-report' }, turnIndex: 0 };
  const snapshot = host.buildRendererSnapshot();

  assert.equal(snapshot.battle.activeOverlay, 'battleScene');
  assert.deepEqual(snapshot.battle.battleScene.report, { id: 'legacy-report' });
});

test('CanvasModeOwnershipBridge renderer snapshot helper is null-safe without runtime boundary', () => {
  const previousRuntime = global.EcsModeRuntime;
  delete require.cache[require.resolve('./CanvasModeOwnershipBridge')];
  global.EcsModeRuntime = { ...previousRuntime, RendererSnapshotBoundary: null };
  const bridge = require('./CanvasModeOwnershipBridge');
  const host = {};

  try {
    assert.equal(bridge.buildRendererSnapshot(host), null);
    assert.equal(bridge.getRendererSnapshot(host), null);
  } finally {
    global.EcsModeRuntime = previousRuntime;
    delete require.cache[require.resolve('./CanvasModeOwnershipBridge')];
    require('./CanvasModeOwnershipBridge');
  }
});
