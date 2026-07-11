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
  const host = new TutorialHostContext({ game, state: game.tutorial });
  const registry = TutorialGuideEventRegistry.create();
  const unsubscribe = registry.subscribeToBus(bus, host);
  const resultTutorial = { currentStep: 'farmPrepReserved' };
  // Real command handling applies the authoritative game state before publishing
  // the tutorial event; preserve that ordering in this end-to-end fixture.
  game.state.tutorial = resultTutorial;

  bus.emit('tutorial.event', {
    eventName: 'taskRewardClaimed',
    payload: {
      result: { tutorial: resultTutorial },
    },
  });
  unsubscribe();

  assert.equal(host.state.currentStep, 'farmPrepReserved');
  assert.equal(game.tutorial, host.state);
});
