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
