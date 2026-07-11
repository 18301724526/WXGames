const test = require('node:test');
const assert = require('node:assert/strict');

const ChangeEventBus = require('../state/ChangeEventBus');
const ModalStore = require('../state/ModalStore');
const StateWriter = require('../state/StateWriter');
const TutorialGuideEventRegistry = require('../tutorial/TutorialGuideEventRegistry');

const RETIRED_POKES = Object.freeze([
  ['frontend/js/platform/WorldMarchActionHandler.js:142', 'state', 'world-march-comment'],
  ['frontend/js/platform/WorldMarchActionHandler.js:148', 'state', 'world-march-guard'],
  ['frontend/js/platform/WorldMarchActionHandler.js:150', 'state', 'world-march-immediate'],
  ['frontend/js/platform/WorldMarchActionHandler.js:153', 'state', 'world-march-deferred'],
  ['frontend/js/platform/ArmyFormationEditorController.js:313', 'state', 'formation-saved'],
  ['frontend/js/platform/GameCommandService.js:110', 'state', 'building-action'],
  ['frontend/js/platform/CanvasGameShell.js:1703', 'state', 'world-site-opened'],
  ['frontend/js/platform/CanvasGameShell.js:3351', 'modal', 'reward-reveal-closed'],
  ['frontend/js/platform/CanvasGameShell.js:3654', 'modal', 'naming-input-updated'],
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
      const subtype = `s6-z4-${source}`;
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
