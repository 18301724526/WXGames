const test = require('node:test');
const assert = require('node:assert/strict');

global.EcsModeRuntime = require('../ecs/mode/EcsModeRuntimeEntry');
const CanvasModeOwnershipBridge = require('./CanvasModeOwnershipBridge');
const CanvasModalSnapshotAdapter = require('./CanvasModalSnapshotAdapter');

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
  class Host {}
  CanvasModeOwnershipBridge.install(Host);
  const host = new Host();
  host.openModal('modal:naming', { visible: true, view: { title: 'Name' } });
  host.openModal('modal:confirmDialog', { visible: true, kind: 'resetGame' });
  host.openModal('modal:rewardReveal', { rewardText: '+1' });
  Object.assign(host, {
    showTaskCenter: true,
    lastGame: {
      state: { currentTab: 'resources', militaryView: 'army' },
    },
  });

  assert.deepEqual(CanvasModeOwnershipBridge.collectModalKeys(host), [
    'modal:naming',
    'modal:rewardReveal',
    'modal:confirmDialog',
    'modal:blockingPanel',
  ]);
});

test('CanvasModeOwnershipBridge ignores retired naming mirrors when mapping modal keys', () => {
  class Host {}
  CanvasModeOwnershipBridge.install(Host);
  const host = Object.assign(new Host(), {
    showTaskCenter: true,
    naming: { visible: true },
    lastGame: {
      state: { currentTab: 'resources', militaryView: 'army' },
      rewardReveal: { rewardText: '+1' },
    },
  });
  host.openModal('modal:confirmDialog', { visible: true, kind: 'resetGame' });
  host.openModal('modal:rewardReveal', { rewardText: '+1' });

  assert.deepEqual(CanvasModeOwnershipBridge.collectModalKeys(host), [
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

  assert.equal(typeof host.openNamingModal, 'undefined');
  assert.equal(typeof host.updateNamingPayload, 'undefined');
  assert.equal(typeof host.closeNamingOwner, 'undefined');
});

test('CanvasModeOwnershipBridge does not install retired naming owner wrappers', () => {
  class Host {}
  CanvasModeOwnershipBridge.install(Host);
  const host = new Host();

  assert.equal(typeof host.openNamingModal, 'undefined');
  assert.equal(typeof host.closeNamingOwner, 'undefined');
  assert.equal(typeof host.updateNamingPayload, 'undefined');
});

test('CanvasModeOwnershipBridge does not install retired confirmDialog owner wrappers', () => {
  class Host {}
  CanvasModeOwnershipBridge.install(Host);
  const host = new Host();

  assert.equal(typeof host.openConfirmDialogModal, 'undefined');
  assert.equal(typeof host.closeConfirmDialogOwner, 'undefined');
  assert.equal(typeof host.updateConfirmDialogPayload, 'undefined');
  assert.equal(typeof host.resolveConfirmDialogCallback, 'undefined');
});

test('CanvasModeOwnershipBridge generic modal APIs seal confirmDialog continuations', () => {
  class Host {}
  CanvasModeOwnershipBridge.install(Host);
  const host = new Host();

  let confirmed = 0;
  let cancelled = 0;
  const payload = host.openModal(
    'modal:confirmDialog',
    { visible: true, kind: 'resetGame', title: 'Reset?' },
    { onConfirm: () => (confirmed += 1), onCancel: () => (cancelled += 1) },
  );
  assert.equal(host.isModalOpen('modal:confirmDialog'), true);
  assert.equal(payload.kind, 'resetGame');

  host.updateModalPayload('modal:confirmDialog', { submitting: true });
  assert.equal(host.getModalPayload('modal:confirmDialog').submitting, true);

  host.resolveModalCallback('modal:confirmDialog', 'onConfirm');
  assert.equal(confirmed, 1);

  host.closeModal('modal:confirmDialog');
  assert.equal(host.isModalOpen('modal:confirmDialog'), false);
  host.resolveModalCallback('modal:confirmDialog', 'onCancel'); // callbacks cleared on close -> inert
  assert.equal(cancelled, 0);
});

test('CanvasModeOwnershipBridge does not install retired rewardReveal owner wrappers', () => {
  class Host {}
  CanvasModeOwnershipBridge.install(Host);
  const host = new Host();

  assert.equal(typeof host.openRewardRevealModal, 'undefined');
  assert.equal(typeof host.closeRewardRevealOwner, 'undefined');
});

test('CanvasModeOwnershipBridge does not install retired event owner wrappers', () => {
  class Host {}
  CanvasModeOwnershipBridge.install(Host);
  const host = new Host();

  assert.equal(typeof host.openEventModal, 'undefined');
  assert.equal(typeof host.closeEventOwner, 'undefined');
  assert.equal(typeof CanvasModeOwnershipBridge.openEventModal, 'undefined');
  assert.equal(typeof CanvasModeOwnershipBridge.closeEventOwner, 'undefined');
});

test('CanvasModeOwnershipBridge event snapshot fans out without touching EventController cursor', () => {
  class Host {}
  CanvasModeOwnershipBridge.install(Host);
  CanvasModalSnapshotAdapter.install(Host);
  const shell = new Host();
  const game = new Host();
  game.canvasShell = shell;
  shell.lastGame = game;
  game.eventController = { activeEventId: 'claim-cursor' };

  // Opening on ANY one related host fans the snapshot out to all of them.
  assert.equal(shell.openEventSnapshot('event-1'), 'event-1');
  assert.equal(shell.isEventSnapshotOpen(), true);
  assert.equal(game.isEventSnapshotOpen(), true);
  assert.deepEqual(shell.getEventSnapshot(), { eventId: 'event-1', visible: true });
  assert.deepEqual(game.getEventSnapshot(), { eventId: 'event-1', visible: true });
  assert.equal(game.eventController.activeEventId, 'claim-cursor');

  shell.closeEventSnapshot();
  assert.equal(shell.isEventSnapshotOpen(), false);
  assert.equal(game.isEventSnapshotOpen(), false);
  assert.equal(game.eventController.activeEventId, 'claim-cursor');
});

test('CanvasModeOwnershipBridge event snapshot preserves falsy but non-null event ids', () => {
  class Host {}
  CanvasModeOwnershipBridge.install(Host);
  CanvasModalSnapshotAdapter.install(Host);
  const host = new Host();

  assert.equal(host.openEventSnapshot(0), 0);
  assert.deepEqual(host.getEventSnapshot(), { eventId: 0, visible: true });
  assert.equal(host.isEventSnapshotOpen(), true);
});

test('CanvasModeOwnershipBridge does not install retired target picker wrappers', () => {
  class Host {}
  CanvasModeOwnershipBridge.install(Host);
  const host = new Host();

  assert.equal(typeof host.openWorldTargetPickerOwner, 'undefined');
  assert.equal(typeof host.openWorldMarchFormationPickerOwner, 'undefined');
  assert.equal(typeof host.closeTargetPickerOwner, 'undefined');
  assert.equal(typeof CanvasModeOwnershipBridge.openWorldTargetPickerOwner, 'undefined');
  assert.equal(typeof CanvasModeOwnershipBridge.openWorldMarchFormationPickerOwner, 'undefined');
  assert.equal(typeof CanvasModeOwnershipBridge.closeTargetPickerOwner, 'undefined');
});

test('CanvasModeOwnershipBridge targetPicker snapshot fans out across related hosts', () => {
  class Host {}
  CanvasModeOwnershipBridge.install(Host);
  CanvasModalSnapshotAdapter.install(Host);
  const shell = new Host();
  const game = new Host();
  game.canvasShell = shell;
  shell.lastGame = game;

  const picker = {
    tileId: 'tile_0_0',
    candidates: [
      { id: 'capital', action: { type: 'openWorldSite', siteId: 'capital' } },
      { id: 'march-1', action: { type: 'selectWorldActor', actorId: 'march-1' } },
    ],
  };

  // Opening on ANY one related host fans the snapshot out to all of them, and the
  // territoryUiState mirror is no longer touched.
  assert.deepEqual(shell.openTargetPickerSnapshot({ pickerKind: 'worldTargetPicker', picker }), {
    pickerKind: 'worldTargetPicker',
    picker,
  });
  assert.equal(shell.isTargetPickerSnapshotOpen(), true);
  assert.equal(game.isTargetPickerSnapshotOpen(), true);
  assert.deepEqual(
    CanvasModeOwnershipBridge.collectModalKeys(shell).includes('modal:targetPicker'),
    true,
  );
  assert.deepEqual(shell.getTargetPickerSnapshot(), {
    pickerKind: 'worldTargetPicker',
    picker,
    visible: true,
  });

  const formationTarget = { q: 2, r: -1, tileId: 'tile_2_-1', missionId: 'march-1' };
  shell.openTargetPickerSnapshot({ pickerKind: 'worldMarchFormation', target: formationTarget });
  assert.deepEqual(game.getTargetPickerSnapshot(), {
    pickerKind: 'worldMarchFormation',
    target: formationTarget,
    visible: true,
  });

  shell.closeTargetPickerSnapshot();
  assert.equal(shell.isTargetPickerSnapshotOpen(), false);
  assert.equal(game.isTargetPickerSnapshotOpen(), false);
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
  CanvasModalSnapshotAdapter.install(Host);
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
  host.openEventSnapshot('event-1');
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
  const owner = global.EcsModeRuntime.BattleDomainOwner.openBattleScene(null, {
    visible: true,
    report: { id: 'owner-report' },
    turnIndex: 0,
  });
  host.lastGame = { __ecsBattleDomainOwner: owner };

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

  const snapshot = host.buildRendererSnapshot();

  assert.equal(snapshot.battle.activeOverlay, 'battleScene');
  assert.deepEqual(snapshot.battle.battleScene.report, { id: 'owner-report' });
});

test('CanvasModeOwnershipBridge ignores removed battleScene mirrors for renderer snapshots', () => {
  class Host {}
  CanvasModeOwnershipBridge.install(Host);
  const host = new Host();
  host.battleScene = { visible: true, report: { id: 'removed-mirror' }, turnIndex: 0 };

  const snapshot = host.buildRendererSnapshot();

  assert.equal(snapshot.battle.activeOverlay, 'none');
  assert.equal(snapshot.battle.battleScene, null);
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
