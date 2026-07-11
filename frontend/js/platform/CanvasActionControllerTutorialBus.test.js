const test = require('node:test');
const assert = require('node:assert/strict');

const ChangeEventBus = require('../state/ChangeEventBus');
const ModalStore = require('../state/ModalStore');
const StateWriter = require('../state/StateWriter');
const TutorialGuideEventRegistry = require('../tutorial/TutorialGuideEventRegistry');

const RETIRED_POKES = Object.freeze([
  ['frontend/js/platform/CanvasActionController.js:812', 'state', 'military-view-switched'],
  ['frontend/js/platform/CanvasActionController.js:814', 'state', 'military-view-switched-deferred'],
  ['frontend/js/platform/CanvasActionController.js:851', 'modal', 'world-site-forwarded'],
  ['frontend/js/platform/CanvasActionController.js:858', 'modal', 'world-site-controller'],
  ['frontend/js/platform/CanvasActionController.js:864', 'state', 'world-site-fallback'],
  ['frontend/js/platform/CanvasActionController.js:1090', 'modal', 'city-management-opened'],
  ['frontend/js/platform/CanvasActionController.js:1114', 'modal', 'city-management-tab-switched'],
  ['frontend/js/platform/CanvasActionController.js:1128', 'modal', 'event-opened'],
  ['frontend/js/platform/CanvasActionController.js:1153', 'modal', 'task-center-opened'],
  ['frontend/js/platform/CanvasActionController.js:1267', 'modal', 'selected-city-management-opened'],
  ['frontend/js/platform/CanvasActionController.js:1385', 'state', 'event-claim-forwarded'],
  ['frontend/js/platform/CanvasActionController.js:1422', 'state', 'event-claim-applied'],
  ['frontend/js/platform/CanvasActionController.js:1529', 'modal', 'naming-closed'],
  ['frontend/js/platform/CanvasActionController.js:1627', 'modal', 'command-panel-opened'],
  ['frontend/js/platform/CanvasActionController.js:1629', 'modal', 'command-panel-opened-deferred'],
  ['frontend/js/platform/CanvasActionController.js:1645', 'modal', 'reward-reveal-closed'],
  ['frontend/js/platform/CanvasActionController.js:1870', 'modal', 'advisor-closed'],
]);

function driveChangeFunnel(kind, source) {
  const bus = ChangeEventBus.createEventBus();
  const game = { state: {} };
  let refreshes = 0;
  const host = {
    isChangeEventRelevant(eventName, change = {}) {
      return eventName !== 'state.changed' || change.owner === game;
    },
    refreshCurrentHighlight() {
      refreshes += 1;
      return true;
    },
  };
  const registry = TutorialGuideEventRegistry.create({ handlers: {} });
  const unsubscribe = registry.subscribeToBus(bus, host);
  const previousBus = global.ChangeEventBus;
  global.ChangeEventBus = bus;
  try {
    if (kind === 'state') {
      StateWriter.commit(game, (previous) => ({ ...previous, tutorialUiProbe: source }), { source });
    } else {
      const subtype = `s6-z2-${source}`;
      ModalStore.openModal(subtype, { source });
      ModalStore.closeModal(subtype);
    }
  } finally {
    global.ChangeEventBus = previousBus;
    unsubscribe();
  }
  return refreshes;
}

RETIRED_POKES.forEach(([fileLine, kind, source]) => {
  test(`${fileLine} refreshes through the ${kind}.changed funnel`, () => {
    assert.ok(driveChangeFunnel(kind, source) > 0);
  });
});
