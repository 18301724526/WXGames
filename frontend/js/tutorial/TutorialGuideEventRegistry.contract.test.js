const test = require('node:test');
const assert = require('node:assert/strict');

const ChangeEventBus = require('../state/ChangeEventBus');
const TutorialHostContext = require('./TutorialHostContext');
const TutorialGuideEventRegistry = require('./TutorialGuideEventRegistry');

test('real EventRegistry consumer syncs a server command result delivered through the bus', () => {
  const bus = ChangeEventBus.createEventBus();
  const game = {
    state: { tutorial: { currentStep: 'initial' } },
    tutorial: { currentStep: 'initial' },
  };
  const host = new TutorialHostContext({ game, state: game.tutorial, changeEventBus: bus });
  const resultTutorial = { currentStep: 'farmPrepReserved' };
  // Real command handling applies the authoritative game state before publishing
  // the tutorial event; preserve that ordering in this end-to-end fixture.
  game.state.tutorial = resultTutorial;

  bus.emit('taskRewardClaimed', {
    result: { tutorial: resultTutorial },
  });
  host.disconnectChangeEventBus();

  assert.equal(host.state.currentStep, 'farmPrepReserved');
  assert.equal(game.tutorial, host.state);
});

test('EventRegistry subscribes to all 18 contract event names and rejects invalid payloads', () => {
  const bus = ChangeEventBus.createEventBus();
  const calls = [];
  const handlers = Object.fromEntries(TutorialGuideEventRegistry.EVENT_NAMES.map((eventName) => [
    eventName,
    (_host, payload) => calls.push({ eventName, payload }),
  ]));
  const registry = TutorialGuideEventRegistry.create({ handlers });
  const host = { refreshCurrentHighlight() {} };
  const unsubscribe = registry.subscribeToBus(bus, host);

  assert.equal(TutorialGuideEventRegistry.EVENT_NAMES.length, 18);
  bus.emit('buildingAction', { buildingId: 'farm' });
  bus.emit('eraAdvanced', { result: 'not-an-object' });
  bus.emit('tabClicked', { panelId: 'civilization' });
  bus.emit('buildingAction', { buildingId: 'farm', action: 'build' });
  bus.emit('eraAdvanced', { result: { tutorial: {} } });
  unsubscribe();

  assert.deepEqual(calls.map((entry) => entry.eventName), [
    'tabClicked',
    'buildingAction',
    'eraAdvanced',
  ]);
});

test('contract topics remain repeatable and the retired wrapper topic is inert', () => {
  const bus = ChangeEventBus.createEventBus();
  let handled = 0;
  const registry = TutorialGuideEventRegistry.create({
    handlers: {
      buildingAction() {
        handled += 1;
        return true;
      },
    },
  });
  const host = {};
  const unsubscribe = registry.subscribeToBus(bus, host);
  const payload = { buildingId: 'farm', action: 'build' };

  bus.emit('buildingAction', { ...payload });
  bus.emit('buildingAction', { ...payload });
  bus.emit('tutorial.event', { eventName: 'buildingAction', payload });
  unsubscribe();

  assert.equal(handled, 2);
});

test('state and modal change funnels refresh the current tutorial highlight', () => {
  const bus = ChangeEventBus.createEventBus();
  const game = {};
  let refreshes = 0;
  const host = {
    game,
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

  bus.emit('state.changed', { owner: {} });
  bus.emit('state.changed', { owner: game });
  bus.emit('modal.changed', { operation: 'open', subtype: 'showTaskCenter' });
  unsubscribe();

  assert.equal(refreshes, 2);
});
