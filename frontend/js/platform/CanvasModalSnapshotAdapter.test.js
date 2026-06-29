const test = require('node:test');
const assert = require('node:assert/strict');

global.EcsModeRuntime = require('../ecs/mode/EcsModeRuntimeEntry');
const ModalStore = require('../state/ModalStore');
const CanvasModeOwnershipRuntime = require('./CanvasModeOwnershipRuntime');
const CanvasModalSnapshotAdapter = require('./CanvasModalSnapshotAdapter');

// Modal truth is a single global ModalStore (no per-host owner); reset it before each
// test so presence from a prior test does not leak across hosts.
test.beforeEach(() => {
  ModalStore.closeAll();
});

test('CanvasModalSnapshotAdapter reads naming from renderer snapshot modal owner', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
  CanvasModalSnapshotAdapter.install(Host);
  const host = new Host();

  host.openNamingSnapshot({
    visible: true,
    view: { title: 'Name city' },
    prompt: { type: 'city', territoryId: 'site-1' },
    inputValue: '',
    submitting: false,
  });

  const snapshot = host.getRendererSnapshot();

  assert.deepEqual(CanvasModalSnapshotAdapter.getNamingSnapshotFromRendererSnapshot(snapshot), {
    visible: true,
    view: { title: 'Name city' },
    prompt: { type: 'city', territoryId: 'site-1' },
    inputValue: '',
    submitting: false,
  });
  assert.equal(host.getNamingInputValue(), '');

  host.updateNamingSnapshot({ inputValue: 'River City' });

  assert.equal(host.getNamingInputValue(), 'River City');
  assert.equal(host.getRendererSnapshot().modal['modal:naming'].payload.inputValue, 'River City');
});

test('CanvasModalSnapshotAdapter routes shell updates to the canonical naming owner host', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
  CanvasModalSnapshotAdapter.install(Host);
  const game = new Host();
  const shell = new Host();
  game.canvasShell = shell;
  shell.lastGame = game;

  game.openNamingSnapshot({
    visible: true,
    view: { title: 'Name polity' },
    prompt: { type: 'polity' },
    inputValue: '',
  });

  shell.updateNamingSnapshot({ inputValue: 'River League' });

  assert.equal(game.getModalPayload('modal:naming').inputValue, 'River League');
  assert.equal(shell.getModalOwnerHost(), game);
  assert.equal(shell.__ecsModalOwner, undefined);
  assert.equal(shell.getNamingInputValue(), 'River League');
});

test('CanvasModalSnapshotAdapter reads and updates confirmDialog through modal snapshot', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
  CanvasModalSnapshotAdapter.install(Host);
  const shell = new Host();

  shell.openConfirmDialogSnapshot(
    { visible: true, kind: 'resetGame', source: 'settings', submitting: false },
    { onConfirm: () => true },
  );

  assert.deepEqual(shell.getConfirmDialogSnapshot(), {
    visible: true,
    kind: 'resetGame',
    source: 'settings',
    submitting: false,
  });
  assert.equal(
    CanvasModalSnapshotAdapter.getConfirmDialogSnapshotFromRendererSnapshot(
      shell.getRendererSnapshot(),
    ).kind,
    'resetGame',
  );

  shell.updateConfirmDialogSnapshot({ submitting: true });

  assert.equal(shell.getConfirmDialogSnapshot().submitting, true);
  assert.equal(shell.getRendererSnapshot().modal['modal:confirmDialog'].payload.submitting, true);
});

test('CanvasModalSnapshotAdapter resolves confirmDialog callbacks on the open owner host', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
  CanvasModalSnapshotAdapter.install(Host);
  const game = new Host();
  const shell = new Host();
  game.canvasShell = shell;
  shell.lastGame = game;
  let confirmed = 0;

  shell.openConfirmDialogSnapshot(
    { visible: true, kind: 'resetGame', source: 'settings' },
    { onConfirm: () => (confirmed += 1) },
  );

  game.resolveConfirmDialogSnapshotCallback('onConfirm');
  shell.closeConfirmDialogSnapshot();
  game.resolveConfirmDialogSnapshotCallback('onConfirm');

  assert.equal(confirmed, 1);
});

test('CanvasModalSnapshotAdapter reads and updates rewardReveal through modal snapshot', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
  CanvasModalSnapshotAdapter.install(Host);
  const shell = new Host();

  shell.openRewardRevealSnapshot({ title: 'Wood', resources: { gold: 5 }, createdAt: 1 });

  assert.equal(shell.isRewardRevealSnapshotOpen(), true);
  assert.deepEqual(shell.getRewardRevealSnapshot(), {
    title: 'Wood',
    resources: { gold: 5 },
    createdAt: 1,
    visible: true,
  });
  assert.equal(
    CanvasModalSnapshotAdapter.getRewardRevealSnapshotFromRendererSnapshot(
      shell.getRendererSnapshot(),
    ).title,
    'Wood',
  );

  shell.closeRewardRevealSnapshot();
  assert.equal(shell.isRewardRevealSnapshotOpen(), false);
  assert.equal(shell.getRewardRevealSnapshot(), null);
});

test('CanvasModalSnapshotAdapter opens and closes a boolean blocking panel as a modal subtype', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
  CanvasModalSnapshotAdapter.install(Host);
  const host = new Host();

  assert.equal(host.isBlockingPanelSnapshotOpen('showSettings'), false);

  host.openBlockingPanelSnapshot('showSettings', true);

  assert.equal(host.isModalOpen('modal:settings'), true);
  assert.equal(host.isBlockingPanelSnapshotOpen('showSettings'), true);
  assert.equal(host.getRendererSnapshot().panel.showSettings, true);

  host.closeBlockingPanelSnapshot('showSettings');

  assert.equal(host.isModalOpen('modal:settings'), false);
  assert.equal(host.isBlockingPanelSnapshotOpen('showSettings'), false);
  assert.equal(host.getRendererSnapshot().panel.showSettings, false);
});

test('CanvasModalSnapshotAdapter routes a falsy openBlockingPanelSnapshot to CLOSE (Q6 toggle-via-open)', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
  CanvasModalSnapshotAdapter.install(Host);
  const host = new Host();

  // Open via truthy, then "open" with a falsy value must toggle it closed.
  host.openBlockingPanelSnapshot('showCitySwitcher', true);
  assert.equal(host.isBlockingPanelSnapshotOpen('showCitySwitcher'), true);

  host.openBlockingPanelSnapshot('showCitySwitcher', false);

  assert.equal(host.isModalOpen('modal:citySwitcher'), false);
  assert.equal(host.isBlockingPanelSnapshotOpen('showCitySwitcher'), false);
  assert.equal(host.getRendererSnapshot().panel.showCitySwitcher, false);
});

test('CanvasModalSnapshotAdapter carries the activeCommandPanel string enum in the payload', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
  CanvasModalSnapshotAdapter.install(Host);
  const host = new Host();

  assert.equal(host.getCommandPanelValue(), '');
  assert.equal(host.isBlockingPanelSnapshotOpen('activeCommandPanel'), false);

  host.openBlockingPanelSnapshot('activeCommandPanel', 'tech');

  assert.equal(host.getCommandPanelValue(), 'tech');
  assert.equal(host.isBlockingPanelSnapshotOpen('activeCommandPanel'), true);
  assert.equal(host.getRendererSnapshot().panel.activeCommandPanel, 'tech');

  // '' routes to close: getCommandPanelValue() back to '' and panel reads closed.
  host.openBlockingPanelSnapshot('activeCommandPanel', '');

  assert.equal(host.getCommandPanelValue(), '');
  assert.equal(host.isBlockingPanelSnapshotOpen('activeCommandPanel'), false);
  assert.equal(host.getRendererSnapshot().panel.activeCommandPanel, '');
});

test('CanvasModalSnapshotAdapter closeBlockingPanelsSnapshot keeps the excepted panel open', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
  CanvasModalSnapshotAdapter.install(Host);
  const host = new Host();

  host.openBlockingPanelSnapshot('showSettings', true);
  host.openBlockingPanelSnapshot('showTaskCenter', true);
  host.openBlockingPanelSnapshot('showGuidebook', true);
  host.openBlockingPanelSnapshot('activeCommandPanel', 'military');

  host.closeBlockingPanelsSnapshot(['showTaskCenter']);

  assert.equal(host.isBlockingPanelSnapshotOpen('showTaskCenter'), true);
  assert.equal(host.isBlockingPanelSnapshotOpen('showSettings'), false);
  assert.equal(host.isBlockingPanelSnapshotOpen('showGuidebook'), false);
  assert.equal(host.isBlockingPanelSnapshotOpen('activeCommandPanel'), false);
  assert.equal(host.getCommandPanelValue(), '');

  const panel = host.getRendererSnapshot().panel;
  assert.equal(panel.showTaskCenter, true);
  assert.equal(panel.showSettings, false);
  assert.equal(panel.showGuidebook, false);
  assert.equal(panel.activeCommandPanel, '');
});

test('CanvasModalSnapshotAdapter buildBlockingPanelFacts returns the flat-12 panel facts', () => {
  class Host {}
  CanvasModeOwnershipRuntime.install(Host);
  CanvasModalSnapshotAdapter.install(Host);
  const host = new Host();

  // All-closed baseline: 11 booleans false + activeCommandPanel ''.
  assert.deepEqual(host.buildBlockingPanelFacts(), {
    showSettings: false,
    showLogs: false,
    showResourceDetails: false,
    showCitySwitcher: false,
    showSubcityList: false,
    showCityManagement: false,
    showAdvisor: false,
    showTaskCenter: false,
    showGuidebook: false,
    showFamousPersons: false,
    activeCommandPanel: '',
    techDetailOpen: false,
  });

  host.openBlockingPanelSnapshot('showLogs', true);
  host.openBlockingPanelSnapshot('showFamousPersons', true);
  host.openBlockingPanelSnapshot('techDetailOpen', true);
  host.openBlockingPanelSnapshot('activeCommandPanel', 'capital');

  assert.deepEqual(host.buildBlockingPanelFacts(), {
    showSettings: false,
    showLogs: true,
    showResourceDetails: false,
    showCitySwitcher: false,
    showSubcityList: false,
    showCityManagement: false,
    showAdvisor: false,
    showTaskCenter: false,
    showGuidebook: false,
    showFamousPersons: true,
    activeCommandPanel: 'capital',
    techDetailOpen: true,
  });
});
