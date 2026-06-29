const test = require('node:test');
const assert = require('node:assert/strict');

global.EcsModeRuntime = require('../ecs/mode/EcsModeRuntimeEntry');
const CanvasModeOwnershipRuntime = require('./CanvasModeOwnershipRuntime');
const CanvasModalSnapshotAdapter = require('./CanvasModalSnapshotAdapter');

test('CanvasModeOwnershipRuntime derives world map mode facts from legacy fields', () => {
  const host = {
    state: { currentTab: 'military', militaryView: 'world' },
    mapHomeActive: true,
  };
  const facts = CanvasModeOwnershipRuntime.deriveModeFacts(host);

  assert.equal(facts.baseModeKey, 'worldMap');
  assert.equal(facts.worldMapHomeActive, true);
  assert.deepEqual(facts.modalKeys, []);
});

test('CanvasModeOwnershipRuntime maps scattered modal fields to modal mode keys', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
  const host = new Host();
  host.openModal('modal:naming', { visible: true, view: { title: 'Name' } });
  host.openModal('modal:confirmDialog', { visible: true, kind: 'resetGame' });
  host.openModal('modal:rewardReveal', { rewardText: '+1' });
  // Batch 8F: the blocking panels are per-panel modal subtypes; opening the
  // taskCenter panel surfaces 'modal:taskCenter', not the retired umbrella.
  host.openModal('modal:taskCenter', {});
  Object.assign(host, {
    lastGame: {
      state: { currentTab: 'resources', militaryView: 'army' },
    },
  });

  assert.deepEqual(CanvasModeOwnershipRuntime.collectModalKeys(host), [
    'modal:naming',
    'modal:rewardReveal',
    'modal:confirmDialog',
    'modal:taskCenter',
  ]);
});

test('CanvasModeOwnershipRuntime ignores retired naming mirrors when mapping modal keys', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
  const host = Object.assign(new Host(), {
    naming: { visible: true },
    lastGame: {
      state: { currentTab: 'resources', militaryView: 'army' },
      rewardReveal: { rewardText: '+1' },
    },
  });
  host.openModal('modal:confirmDialog', { visible: true, kind: 'resetGame' });
  host.openModal('modal:rewardReveal', { rewardText: '+1' });
  host.openModal('modal:taskCenter', {});

  assert.deepEqual(CanvasModeOwnershipRuntime.collectModalKeys(host), [
    'modal:rewardReveal',
    'modal:confirmDialog',
    'modal:taskCenter',
  ]);
});

test('CanvasModeOwnershipRuntime installs snapshot helpers on legacy facades', () => {
  class Host {}
  assert.equal(CanvasModeOwnershipRuntime.install(Host), true);

  const host = new Host();
  Object.assign(host, {
    state: { currentTab: 'military', militaryView: 'world' },
    mapHomeActive: true,
  });

  const snapshot = host.getModeSnapshot();
  assert.equal(snapshot.baseModeKey, 'worldMap');
  assert.equal(host.canRouteModeWorldMap(), true);

  host.openModal('modal:guidebook', {});
  const blocked = host.refreshModeSnapshot();
  assert.equal(blocked.blockingOverlayActive, true);
  assert.equal(host.canRouteModeWorldMap(), false);
});

test('CanvasModeOwnershipRuntime preserves tech panel routing exception', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
  const host = Object.assign(new Host(), { activeTab: 'tech' });
  // commandPanel='tech' is a general blocking overlay but NOT a tech-tree-routing
  // blocker (it IS tech-tree base access). techDetail/show-stars still block routing.
  host.openModal('modal:commandPanel', { value: 'tech' });

  const facts = CanvasModeOwnershipRuntime.deriveModeFacts(host);
  assert.equal(facts.baseModeKey, 'techTree');
  assert.equal(facts.blockingOverlayActive, true);
  assert.equal(facts.techTreeBlockingOverlayActive, false);

  assert.equal(host.isModeBlockingOverlayOpen(), true);
  assert.equal(host.canRouteModeTechTree(), true);

  host.openModal('modal:settings', {});
  assert.equal(host.refreshModeSnapshot().techTreeBlockingOverlayActive, true);
  assert.equal(host.canRouteModeTechTree(), false);
});

test('CanvasModeOwnershipRuntime resolves covered-mode input intents from the snapshot', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);

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
    CanvasModeOwnershipRuntime.resolveInputIntent(worldHost, { kind: 'drag' }).route,
    'world-map',
  );
});

test('CanvasModeOwnershipRuntime owns modal open/close/update + token callbacks', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
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

test('CanvasModeOwnershipRuntime does not install retired naming owner wrappers', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
  const host = new Host();

  assert.equal(typeof host.openNamingModal, 'undefined');
  assert.equal(typeof host.closeNamingOwner, 'undefined');
  assert.equal(typeof host.updateNamingPayload, 'undefined');
});

test('CanvasModeOwnershipRuntime does not install retired confirmDialog owner wrappers', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
  const host = new Host();

  assert.equal(typeof host.openConfirmDialogModal, 'undefined');
  assert.equal(typeof host.closeConfirmDialogOwner, 'undefined');
  assert.equal(typeof host.updateConfirmDialogPayload, 'undefined');
  assert.equal(typeof host.resolveConfirmDialogCallback, 'undefined');
});

test('CanvasModeOwnershipRuntime generic modal APIs seal confirmDialog continuations', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
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

test('CanvasModeOwnershipRuntime does not install retired rewardReveal owner wrappers', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
  const host = new Host();

  assert.equal(typeof host.openRewardRevealModal, 'undefined');
  assert.equal(typeof host.closeRewardRevealOwner, 'undefined');
});

test('CanvasModeOwnershipRuntime does not install retired event owner wrappers', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
  const host = new Host();

  assert.equal(typeof host.openEventModal, 'undefined');
  assert.equal(typeof host.closeEventOwner, 'undefined');
  assert.equal(typeof CanvasModeOwnershipRuntime.openEventModal, 'undefined');
  assert.equal(typeof CanvasModeOwnershipRuntime.closeEventOwner, 'undefined');
});

test('CanvasModeOwnershipRuntime event snapshot uses one canonical owner without touching EventController cursor', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
  CanvasModalSnapshotAdapter.install(Host);
  const shell = new Host();
  const game = new Host();
  game.canvasShell = shell;
  shell.lastGame = game;
  game.eventController = { activeEventId: 'claim-cursor' };

  // Opening from the shell writes to the game owner; both hosts read the same owner
  // snapshot without storing a second shell modal world.
  assert.equal(shell.openEventSnapshot('event-1'), 'event-1');
  assert.equal(shell.isEventSnapshotOpen(), true);
  assert.equal(game.isEventSnapshotOpen(), true);
  assert.equal(shell.getModalOwnerHost(), game);
  assert.equal(shell.__ecsModalOwner, undefined);
  assert.deepEqual(shell.getEventSnapshot(), { eventId: 'event-1', visible: true });
  assert.deepEqual(game.getEventSnapshot(), { eventId: 'event-1', visible: true });
  assert.equal(game.eventController.activeEventId, 'claim-cursor');

  shell.closeEventSnapshot();
  assert.equal(shell.isEventSnapshotOpen(), false);
  assert.equal(game.isEventSnapshotOpen(), false);
  assert.equal(game.eventController.activeEventId, 'claim-cursor');
});

test('CanvasModeOwnershipRuntime event snapshot preserves falsy but non-null event ids', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
  CanvasModalSnapshotAdapter.install(Host);
  const host = new Host();

  assert.equal(host.openEventSnapshot(0), 0);
  assert.deepEqual(host.getEventSnapshot(), { eventId: 0, visible: true });
  assert.equal(host.isEventSnapshotOpen(), true);
});

test('CanvasModeOwnershipRuntime does not install retired target picker wrappers', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
  const host = new Host();

  assert.equal(typeof host.openWorldTargetPickerOwner, 'undefined');
  assert.equal(typeof host.openWorldMarchFormationPickerOwner, 'undefined');
  assert.equal(typeof host.closeTargetPickerOwner, 'undefined');
  assert.equal(typeof CanvasModeOwnershipRuntime.openWorldTargetPickerOwner, 'undefined');
  assert.equal(typeof CanvasModeOwnershipRuntime.openWorldMarchFormationPickerOwner, 'undefined');
  assert.equal(typeof CanvasModeOwnershipRuntime.closeTargetPickerOwner, 'undefined');
});

test('CanvasModeOwnershipRuntime targetPicker snapshot uses the canonical game owner', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
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

  // Opening from the shell writes to the game owner, and the territoryUiState mirror
  // is no longer touched.
  assert.deepEqual(shell.openTargetPickerSnapshot({ pickerKind: 'worldTargetPicker', picker }), {
    pickerKind: 'worldTargetPicker',
    picker,
  });
  assert.equal(shell.isTargetPickerSnapshotOpen(), true);
  assert.equal(game.isTargetPickerSnapshotOpen(), true);
  assert.equal(shell.getModalOwnerHost(), game);
  assert.equal(shell.__ecsModalOwner, undefined);
  assert.deepEqual(
    CanvasModeOwnershipRuntime.collectModalKeys(shell).includes('modal:targetPicker'),
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

test('CanvasModeOwnershipRuntime derives panel facts + blocking from per-panel modal owners', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
  CanvasModalSnapshotAdapter.install(Host);
  const host = new Host();

  host.openBlockingPanelSnapshot('showSettings', true);
  assert.equal(host.isModalOpen('modal:settings'), true);
  assert.equal(host.getRendererSnapshot().panel.showSettings, true);
  assert.deepEqual(CanvasModeOwnershipRuntime.collectModalKeys(host), ['modal:settings']);
  assert.equal(host.refreshModeSnapshot().techTreeBlockingOverlayActive, true);

  host.closeBlockingPanelSnapshot('showSettings');
  host.openBlockingPanelSnapshot('activeCommandPanel', 'tech');
  assert.equal(host.getCommandPanelValue(), 'tech');
  assert.equal(host.getRendererSnapshot().panel.activeCommandPanel, 'tech');
  // commandPanel='tech' is a general overlay but NOT a tech-routing blocker.
  assert.equal(host.refreshModeSnapshot().blockingOverlayActive, true);
  assert.equal(host.refreshModeSnapshot().techTreeBlockingOverlayActive, false);

  host.openBlockingPanelSnapshot('showSettings', true);
  assert.equal(host.refreshModeSnapshot().techTreeBlockingOverlayActive, true);

  host.closeBlockingPanelSnapshot('showSettings');
  assert.equal(host.isModalOpen('modal:settings'), false);
  assert.equal(host.getRendererSnapshot().panel.showSettings, false);
});

test('CanvasModeOwnershipRuntime keeps commandPanel=tech and techDetail open simultaneously (Axis 3)', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
  CanvasModalSnapshotAdapter.install(Host);
  const host = new Host();

  // handle_openCommandPanel('tech') then handle_selectTechNode: the tech command
  // panel and the techDetail popup provably coexist (the bug a single-panelKey owner
  // would cause -- they overwrite each other in one slot).
  host.openBlockingPanelSnapshot('activeCommandPanel', 'tech');
  host.openBlockingPanelSnapshot('techDetailOpen', true);

  const panel = host.getRendererSnapshot().panel;
  assert.equal(panel.activeCommandPanel, 'tech');
  assert.equal(panel.techDetailOpen, true);

  // commandPanel=tech is NOT a tech-routing blocker, but the techDetail popup IS,
  // so while techDetail is open tech-tree routing is blocked.
  assert.equal(host.refreshModeSnapshot().canRouteTechTree, false);

  // closing the techDetail popup re-opens tech-tree routing while the tech command
  // panel stays open and observable.
  host.closeBlockingPanelSnapshot('techDetailOpen');
  const panelAfter = host.getRendererSnapshot().panel;
  assert.equal(panelAfter.activeCommandPanel, 'tech');
  assert.equal(panelAfter.techDetailOpen, false);
  assert.equal(host.refreshModeSnapshot().canRouteTechTree, true);
});

test('CanvasModeOwnershipRuntime closeBlockingPanelsSnapshot keeps the except panel', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
  CanvasModalSnapshotAdapter.install(Host);
  const host = new Host();

  host.openBlockingPanelSnapshot('showTaskCenter', true);
  host.openBlockingPanelSnapshot('showSettings', true);
  host.openBlockingPanelSnapshot('activeCommandPanel', 'events');

  host.closeBlockingPanelsSnapshot(['showTaskCenter']);
  assert.equal(host.isModalOpen('modal:taskCenter'), true);
  assert.equal(host.isModalOpen('modal:settings'), false);
  assert.equal(host.getCommandPanelValue(), '');
  assert.equal(host.getRendererSnapshot().panel.showTaskCenter, true);

  host.closeBlockingPanelsSnapshot();
  assert.equal(host.isModalOpen('modal:taskCenter'), false);
  assert.equal(host.getRendererSnapshot().panel.showTaskCenter, false);
});

test('CanvasModeOwnershipRuntime builds renderer snapshots from owner-backed panels', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
  CanvasModalSnapshotAdapter.install(Host);
  const host = new Host();
  const shell = new Host();
  const game = new Host();
  game.canvasShell = shell;
  shell.lastGame = game;
  host.getCanvasGameHost = () => game;
  host.__ecsBattleDomainOwner = global.EcsModeRuntime.BattleDomainOwner.openBattleScene(null, {
    visible: true,
    report: { id: 'report-1' },
    turnIndex: 0,
  });
  host.openEventSnapshot('event-1');
  host.openBlockingPanelSnapshot('showTaskCenter', true);
  host.openBlockingPanelSnapshot('activeCommandPanel', 'tech');

  const snapshot = host.buildRendererSnapshot({
    mode: {
      baseModeKey: 'techTree',
      modalKeys: ['modal:event', 'modal:taskCenter', 'modal:commandPanel'],
      selectedTechId: 'tech-1',
    },
  });

  assert.equal(snapshot.schema, 'renderer-snapshot-v1');
  assert.equal(Object.isFrozen(snapshot), true);
  assert.deepEqual(snapshot.modal['modal:event'].payload, { eventId: 'event-1' });
  assert.deepEqual(snapshot.modal['modal:commandPanel'].payload, { value: 'tech' });
  assert.equal(snapshot.panel.showTaskCenter, true);
  assert.equal(snapshot.panel.activeCommandPanel, 'tech');
  assert.equal(snapshot.panel.selectedTechId, undefined);
  assert.equal(snapshot.mode.baseModeKey, 'techTree');
  assert.equal(snapshot.mode.selectedTechId, undefined);
  assert.equal(snapshot.battle.activeOverlay, 'battleScene');
  assert.deepEqual(snapshot.battle.battleScene.report, { id: 'report-1' });
  assert.equal(host.getRendererSnapshot(), snapshot);

  assert.equal(CanvasModeOwnershipRuntime.getRendererSnapshot(host), snapshot);
});

test('CanvasModeOwnershipRuntime exposes battle facts only through read-only snapshot path', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
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
    assert.equal(typeof CanvasModeOwnershipRuntime[name], 'undefined');
  });

  const snapshot = host.buildRendererSnapshot();

  assert.equal(snapshot.battle.activeOverlay, 'battleScene');
  assert.deepEqual(snapshot.battle.battleScene.report, { id: 'owner-report' });
});

test('CanvasModeOwnershipRuntime ignores removed battleScene mirrors for renderer snapshots', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
  const host = new Host();
  host.battleScene = { visible: true, report: { id: 'removed-mirror' }, turnIndex: 0 };

  const snapshot = host.buildRendererSnapshot();

  assert.equal(snapshot.battle.activeOverlay, 'none');
  assert.equal(snapshot.battle.battleScene, null);
});

test('CanvasModeOwnershipRuntime renderer snapshot helper is null-safe without runtime boundary', () => {
  const previousRuntime = global.EcsModeRuntime;
  delete require.cache[require.resolve('./CanvasModeOwnershipRuntime')];
  global.EcsModeRuntime = { ...previousRuntime, RendererSnapshotBoundary: null };
  const bridge = require('./CanvasModeOwnershipRuntime');
  const host = {};

  try {
    assert.equal(bridge.buildRendererSnapshot(host), null);
    assert.equal(bridge.getRendererSnapshot(host), null);
  } finally {
    global.EcsModeRuntime = previousRuntime;
    delete require.cache[require.resolve('./CanvasModeOwnershipRuntime')];
    require('./CanvasModeOwnershipRuntime');
  }
});
