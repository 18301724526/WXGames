const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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

function createTaskRewardHarness(calls = [], overrides = {}) {
  let rewardRevealOpen = false;
  const tutorialController = {
    refreshCurrentHighlight() {
      calls.push(['tutorial.refresh', rewardRevealOpen]);
      return true;
    },
  };
  const game = {
    getTutorialController() {
      return tutorialController;
    },
    ...overrides.game,
  };
  const host = {
    lastGame: game,
    api: {},
    openRewardRevealSnapshot(reveal) {
      rewardRevealOpen = Boolean(reveal);
      calls.push(['reward.open', rewardRevealOpen]);
    },
    closeRewardRevealSnapshot() {
      const hadReveal = rewardRevealOpen;
      rewardRevealOpen = false;
      calls.push(['reward.close', hadReveal]);
      return hadReveal;
    },
    isRewardRevealSnapshotOpen() {
      return rewardRevealOpen;
    },
    render() {
      calls.push(['render']);
      return true;
    },
    ...overrides.host,
  };
  return {
    host,
    game,
    getRewardRevealOpen: () => rewardRevealOpen,
    setRewardRevealOpen: (value) => {
      rewardRevealOpen = Boolean(value);
    },
  };
}

test('handle_claimTaskReward waits for forwarded state before refreshing and renders afterward', async () => {
  const calls = [];
  let finishForward;
  const harness = createTaskRewardHarness(calls, {
    host: {
      forwardCanvasAction() {
        return new Promise((resolve) => {
          finishForward = () => {
            harness.setRewardRevealOpen(true);
            resolve(true);
          };
        });
      },
    },
  });
  const controller = new CanvasActionController({ host: harness.host });

  assert.equal(controller.handle_claimTaskReward({ type: 'claimTaskReward', taskId: 'task-1' }), true);
  assert.equal(calls.filter(([name]) => name === 'tutorial.refresh').length, 0);

  finishForward();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(calls.filter(([name]) => name === 'tutorial.refresh').length, 1);
  assert.deepEqual(calls.slice(-2), [['tutorial.refresh', true], ['render']]);
});

test('handle_claimTaskReward does not refresh when forwarding returns false', async () => {
  const calls = [];
  const { host } = createTaskRewardHarness(calls, {
    host: {
      forwardCanvasAction() {
        return Promise.resolve(false);
      },
    },
  });
  const controller = new CanvasActionController({ host, awaitAsync: true });

  assert.equal(await controller.handle_claimTaskReward({ type: 'claimTaskReward', taskId: 'task-1' }), false);
  assert.equal(calls.filter(([name]) => name === 'tutorial.refresh').length, 0);
  assert.equal(calls.filter(([name]) => name === 'render').length, 0);
});

test('handle_claimTaskReward refreshes once after the game claim settles successfully', async () => {
  const calls = [];
  let harness;
  harness = createTaskRewardHarness(calls, {
    game: {
      async claimTaskReward() {
        harness.setRewardRevealOpen(true);
        calls.push(['game.claim.settled']);
        return true;
      },
    },
  });
  const controller = new CanvasActionController({ host: harness.host, awaitAsync: true });

  assert.equal(await controller.handle_claimTaskReward({ type: 'claimTaskReward', taskId: 'task-1' }), true);
  assert.equal(calls.filter(([name]) => name === 'tutorial.refresh').length, 1);
  assert.deepEqual(calls.slice(-2), [['game.claim.settled'], ['tutorial.refresh', true]]);
});

test('handle_claimTaskReward does not refresh when the game claim fails or rejects', async () => {
  const falseCalls = [];
  const falseHarness = createTaskRewardHarness(falseCalls, {
    game: {
      claimTaskReward() {
        return false;
      },
    },
  });
  const falseController = new CanvasActionController({ host: falseHarness.host, awaitAsync: true });

  assert.equal(falseController.handle_claimTaskReward({ type: 'claimTaskReward', taskId: 'task-1' }), false);
  assert.equal(falseCalls.filter(([name]) => name === 'tutorial.refresh').length, 0);

  const rejectedCalls = [];
  const rejectedHarness = createTaskRewardHarness(rejectedCalls, {
    game: {
      claimTaskReward() {
        return Promise.reject(new Error('claim failed'));
      },
    },
  });
  const rejectedController = new CanvasActionController({ host: rejectedHarness.host, awaitAsync: true });

  await assert.rejects(
    rejectedController.handle_claimTaskReward({ type: 'claimTaskReward', taskId: 'task-1' }),
    /claim failed/,
  );
  assert.equal(rejectedCalls.filter(([name]) => name === 'tutorial.refresh').length, 0);
});

test('handle_claimTaskReward direct fallback refreshes once after reward reveal state is stable', async () => {
  const calls = [];
  const { host } = createTaskRewardHarness(calls);
  host.api.claimTaskReward = async () => ({
    success: true,
    rewardReveal: { title: 'Supplies' },
  });
  const controller = new CanvasActionController({ host, awaitAsync: true });

  assert.equal(await controller.handle_claimTaskReward({ type: 'claimTaskReward', taskId: 'task-1' }), true);
  assert.equal(calls.filter(([name]) => name === 'tutorial.refresh').length, 1);
  assert.deepEqual(calls.slice(-2), [['reward.open', true], ['tutorial.refresh', true]]);
});

test('handle_claimTaskReward direct fallback does not refresh on failed result or rejection', async () => {
  const failedCalls = [];
  const failedHarness = createTaskRewardHarness(failedCalls);
  failedHarness.host.api.claimTaskReward = async () => ({ success: false });
  const failedController = new CanvasActionController({ host: failedHarness.host, awaitAsync: true });

  assert.equal(await failedController.handle_claimTaskReward({ type: 'claimTaskReward', taskId: 'task-1' }), true);
  assert.equal(failedCalls.filter(([name]) => name === 'tutorial.refresh').length, 0);

  const rejectedCalls = [];
  const rejectedHarness = createTaskRewardHarness(rejectedCalls);
  rejectedHarness.host.api.claimTaskReward = async () => {
    throw new Error('direct claim failed');
  };
  const rejectedController = new CanvasActionController({ host: rejectedHarness.host, awaitAsync: true });

  await assert.rejects(
    rejectedController.handle_claimTaskReward({ type: 'claimTaskReward', taskId: 'task-1' }),
    /direct claim failed/,
  );
  assert.equal(rejectedCalls.filter(([name]) => name === 'tutorial.refresh').length, 0);
});

test('handle_closeRewardReveal refreshes once after the reveal closes and before render', () => {
  const calls = [];
  const harness = createTaskRewardHarness(calls);
  harness.setRewardRevealOpen(true);
  harness.host.closeRewardReveal = () => {
    const hadReveal = harness.getRewardRevealOpen();
    harness.setRewardRevealOpen(false);
    calls.push(['reward.close', hadReveal]);
    return hadReveal;
  };
  const controller = new CanvasActionController({ host: harness.host });

  assert.equal(controller.handle_closeRewardReveal({ type: 'closeRewardReveal' }), true);
  assert.equal(calls.filter(([name]) => name === 'tutorial.refresh').length, 1);
  assert.deepEqual(calls, [
    ['reward.close', true],
    ['tutorial.refresh', false],
    ['render'],
  ]);
});

test('handle_closeRewardReveal does not refresh or render when nothing closes', () => {
  const calls = [];
  const { host } = createTaskRewardHarness(calls, {
    host: {
      closeRewardReveal() {
        calls.push(['reward.close', false]);
        return false;
      },
    },
  });
  const controller = new CanvasActionController({ host });

  assert.equal(controller.handle_closeRewardReveal({ type: 'closeRewardReveal' }), false);
  assert.deepEqual(calls, [['reward.close', false]]);
});

test('handle_closeRewardReveal refreshes after the reward snapshot fallback confirms closure', () => {
  const calls = [];
  const harness = createTaskRewardHarness(calls);
  harness.setRewardRevealOpen(true);
  const controller = new CanvasActionController({ host: harness.host });

  assert.equal(controller.handle_closeRewardReveal({ type: 'closeRewardReveal' }), true);
  assert.deepEqual(calls, [
    ['reward.close', true],
    ['tutorial.refresh', false],
    ['render'],
  ]);
});

test('handle_closeRewardReveal snapshot fallback returns false when no reveal was open', () => {
  const calls = [];
  const { host } = createTaskRewardHarness(calls);
  const controller = new CanvasActionController({ host });

  assert.equal(controller.handle_closeRewardReveal({ type: 'closeRewardReveal' }), false);
  assert.deepEqual(calls, [['reward.close', false]]);
});

test('CanvasActionController keeps refreshCurrentHighlight behind one centralized call site', () => {
  const source = fs.readFileSync(path.join(__dirname, 'CanvasActionController.js'), 'utf8');
  assert.equal((source.match(/refreshCurrentHighlight/g) || []).length, 1);
  assert.match(source, /notifyTutorialAfterEventAction\(\)[\s\S]*refreshCurrentHighlight/);
});
