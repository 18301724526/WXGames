const test = require('node:test');
const assert = require('node:assert/strict');

const ChangeEventBus = require('../state/ChangeEventBus');
const ModalStore = require('../state/ModalStore');
const StateWriter = require('../state/StateWriter');
const TutorialGuideEventRegistry = require('../tutorial/TutorialGuideEventRegistry');

const RETIRED_POKES = Object.freeze([
  ['frontend/js/platform/CanvasGameApp.js:1382', 'state', 'canvas-rendered-state'],
  ['frontend/js/platform/CanvasGameApp.js:3031', 'state', 'city-entered'],
  ['frontend/js/platform/CanvasGameApp.js:3083', 'state', 'formation-opened'],
  ['frontend/js/platform/CanvasGameApp.js:3085', 'state', 'formation-opened-deferred'],
  ['frontend/js/platform/CanvasGameApp.js:3144', 'modal', 'naming-updated'],
  ['frontend/js/platform/CanvasGameApp.js:3198', 'state', 'naming-submitted'],
  ['frontend/js/platform/CanvasGameApp.js:3430', 'modal', 'task-center-opened'],
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
      const subtype = `s6-z3-${source}`;
      ModalStore.openModal(subtype, { source });
      ModalStore.updateModalPayload(subtype, { updated: true });
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
