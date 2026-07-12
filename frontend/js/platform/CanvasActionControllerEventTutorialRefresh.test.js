const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasActionController = require('./CanvasActionController');
const ChangeEventBus = require('../state/ChangeEventBus');
const ModalStore = require('../state/ModalStore');
const { makeModalOwnerHost } = require('../../test-support/CanvasOwnerTestHarness');

function createOpenEventHarness(calls = []) {
  const eventController = {
    activeEventId: '',
    open(eventId) {
      this.activeEventId = eventId;
      calls.push(['controller.open', eventId]);
    },
    close() {
      this.activeEventId = '';
      calls.push(['controller.close']);
    },
  };
  let game;
  const tutorialController = {
    getActiveEventId() {
      return game.getEventSnapshot()?.eventId || game.eventController.activeEventId || '';
    },
    refreshCurrentHighlight() {
      calls.push(['tutorial.refresh', this.getActiveEventId()]);
      return true;
    },
  };
  const host = makeModalOwnerHost({
    state: { eventQueue: [{ id: 'event-1' }] },
    eventController,
    getCanvasGameHost() {
      return game;
    },
    render() {
      calls.push(['render']);
      return true;
    },
  });
  game = makeModalOwnerHost({
    state: host.state,
    eventController,
    canvasShell: host,
    getTutorialController() {
      return tutorialController;
    },
  });
  return { host, game, eventController, tutorialController };
}

test('handle_openEvent refreshes the tutorial once after the active event id is stable', () => {
  ModalStore.closeAll();
  const calls = [];
  const { host } = createOpenEventHarness(calls);
  const controller = new CanvasActionController({ host });

  try {
    assert.equal(controller.handle_openEvent({ type: 'openEvent', eventId: 'event-1' }), true);
    assert.deepEqual(calls, [
      ['controller.open', 'event-1'],
      ['tutorial.refresh', 'event-1'],
      ['render'],
    ]);
  } finally {
    ModalStore.closeAll();
  }
});

test('handle_openEvent refreshes after repeated identical payloads even when ModalStore deduplicates', () => {
  ModalStore.closeAll();
  const calls = [];
  let modalChangedCount = 0;
  const unsubscribe = ChangeEventBus.subscribe('modal.changed', (change = {}) => {
    if (change.operation === 'open' && change.subtype === 'modal:event') modalChangedCount += 1;
  });
  const { host } = createOpenEventHarness(calls);
  const controller = new CanvasActionController({ host });
  const action = { type: 'openEvent', eventId: 'event-1' };

  try {
    assert.equal(controller.handle_openEvent(action), true);
    assert.equal(controller.handle_openEvent(action), true);
    assert.equal(modalChangedCount, 1);
    assert.equal(calls.filter(([name]) => name === 'tutorial.refresh').length, 2);
    assert.deepEqual(
      calls.filter(([name]) => name === 'tutorial.refresh'),
      [
        ['tutorial.refresh', 'event-1'],
        ['tutorial.refresh', 'event-1'],
      ],
    );
  } finally {
    unsubscribe();
    ModalStore.closeAll();
  }
});

test('handle_claimEvent refreshes the tutorial once after claim state settles', async () => {
  const calls = [];
  const tutorialController = {
    sync(tutorial) {
      calls.push(['tutorial.sync', tutorial.currentStep]);
    },
    refreshCurrentHighlight() {
      calls.push(['tutorial.refresh']);
      return true;
    },
  };
  const eventController = {
    activeEventId: 'event-1',
    open(eventId) {
      this.activeEventId = eventId;
      calls.push(['controller.open', eventId]);
    },
    close() {
      this.activeEventId = '';
      calls.push(['controller.close']);
    },
    async claimActive(optionId) {
      calls.push(['controller.claimActive', optionId]);
      return { tutorial: { currentStep: 13 } };
    },
  };
  const game = {
    tutorialController,
    eventController,
    state: { eventQueue: [{ id: 'event-1' }] },
    getTutorialController() {
      return tutorialController;
    },
  };
  const host = {
    lastGame: game,
    state: game.state,
    eventController,
    closeEventSnapshot() {
      calls.push(['snapshot.close']);
    },
    hideTutorialHighlight() {
      calls.push(['highlight.hide']);
    },
    render() {
      calls.push(['render']);
      return true;
    },
  };
  const controller = new CanvasActionController({ host, awaitAsync: true });

  assert.equal(await controller.handle_claimEvent({
    type: 'claimEvent',
    eventId: 'event-1',
    optionId: 'collect',
  }), true);
  assert.equal(calls.filter(([name]) => name === 'tutorial.refresh').length, 1);
  assert.deepEqual(calls.slice(-2), [['tutorial.refresh'], ['render']]);
});

test('handle_claimEvent waits for forwarded state before refreshing in default async mode', async () => {
  const calls = [];
  let finishForward;
  let refreshed;
  const refreshDone = new Promise((resolve) => {
    refreshed = resolve;
  });
  const tutorialController = {
    sync(tutorial) {
      calls.push(['tutorial.sync', tutorial.currentStep]);
    },
    refreshCurrentHighlight() {
      calls.push(['tutorial.refresh', game.state.tutorial.currentStep]);
      refreshed();
      return true;
    },
  };
  const game = {
    state: { tutorial: { currentStep: 12 } },
    tutorialController,
    getTutorialController() {
      return tutorialController;
    },
  };
  const host = {
    lastGame: game,
    closeEventSnapshot() {},
    eventController: {
      close() {},
    },
    forwardCanvasAction() {
      return new Promise((resolve) => {
        finishForward = () => {
          game.state = { tutorial: { currentStep: 13 } };
          resolve(true);
        };
      });
    },
    render() {
      calls.push(['render']);
      return true;
    },
  };
  const controller = new CanvasActionController({ host });

  assert.equal(controller.handle_claimEvent({
    type: 'claimEvent',
    eventId: 'event-1',
    optionId: 'collect',
  }), true);
  assert.equal(calls.some(([name]) => name === 'tutorial.refresh'), false);

  finishForward();
  await refreshDone;

  assert.equal(calls.filter(([name]) => name === 'tutorial.refresh').length, 1);
  assert.deepEqual(calls.slice(-2), [['tutorial.refresh', 13], ['render']]);
});

test('handle_closeEvent refreshes the tutorial once after event state is cleared', () => {
  ModalStore.closeAll();
  const calls = [];
  const { host, eventController } = createOpenEventHarness(calls);
  host.openEventSnapshot('event-1');
  eventController.open('event-1');
  calls.length = 0;
  const controller = new CanvasActionController({ host });

  try {
    assert.equal(controller.handle_closeEvent({ type: 'closeEvent' }), true);
    assert.deepEqual(calls, [
      ['controller.close'],
      ['tutorial.refresh', ''],
      ['render'],
    ]);
  } finally {
    ModalStore.closeAll();
  }
});
