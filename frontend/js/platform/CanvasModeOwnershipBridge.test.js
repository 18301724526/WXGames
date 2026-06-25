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
