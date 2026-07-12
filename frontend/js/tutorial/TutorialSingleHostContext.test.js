const test = require('node:test');
const assert = require('node:assert/strict');

const TutorialHostContext = require('./TutorialHostContext');

let constructionCount = 0;
class CountingTutorialHostContext extends TutorialHostContext {
  constructor(options = {}) {
    super(options);
    constructionCount += 1;
  }
}

const previousGlobalHostContext = global.TutorialHostContext;
global.TutorialHostContext = CountingTutorialHostContext;
delete require.cache[require.resolve('./TutorialGuideController')];
const TutorialGuideController = require('./TutorialGuideController');
const TutorialIntroOverlay = require('./TutorialIntroOverlay');
const TutorialGuideTargetResolver = require('./TutorialGuideTargetResolver');
const TutorialGuideEventRegistry = require('./TutorialGuideEventRegistry');
const CanvasGameApp = require('../platform/CanvasGameApp');
const CanvasGameShell = require('../platform/CanvasGameShell');
const CanvasModalSnapshotAdapter = require('../platform/CanvasModalSnapshotAdapter');
const ChangeEventBus = require('../state/ChangeEventBus');
const ModalStore = require('../state/ModalStore');

test('full guide helpers share the controller TutorialHostContext', () => {
  const initialTutorial = { completed: false, currentStep: 'tutorialStarted' };
  const scheduled = [];
  const game = {
    hasServerState: true,
    tutorial: initialTutorial,
    state: {
      gameDay: 1,
      totalBuildings: 0,
      tutorial: initialTutorial,
      cityState: { capitalCityId: 'capital' },
      territoryState: { territories: [{ id: 'capital' }] },
    },
    canvasShell: {
      getCanvasTarget(type) {
        return type === 'openTaskCenter' ? { action: { type } } : null;
      },
      renderActive() {
        return true;
      },
    },
  };

  const controller = new TutorialGuideController({ game });
  game.tutorialController = controller;
  controller.sync(initialTutorial);
  const introOverlay = new TutorialIntroOverlay({
    resolveContext: () => game.tutorialController,
    runtime: {
      performance: { now: () => 1000 },
      setTimeout(callback, delayMs) {
        scheduled.push({ callback, delayMs });
        return scheduled.length;
      },
      clearTimeout() {},
    },
    storage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    },
  });
  const targetResolver = new TutorialGuideTargetResolver({ host: controller });

  assert.equal(introOverlay.start(game.state), true);
  assert.equal(targetResolver.resolveTarget({
    kind: TutorialGuideTargetResolver.TARGET_RESOLVER_KINDS.HIT_TARGET,
    type: 'openTaskCenter',
    retry: false,
  }).available, true);
  assert.equal(constructionCount, 1);
  assert.equal(introOverlay.context, controller);
  assert.equal(targetResolver.host, controller);

  const commandTutorial = { completed: false, currentStep: 'era2AdvanceReady' };
  game.state.tutorial = commandTutorial;
  controller.syncFromResultPayload({ tutorial: commandTutorial });
  const witnessBefore = TutorialHostContext.getDivergenceWitness().count;
  const controllerStep = controller.getCurrentStep();
  const introStep = introOverlay.context.getCurrentStep();
  const resolverStep = targetResolver.host.getCurrentStep();
  const witnessAfter = TutorialHostContext.getDivergenceWitness().count;

  assert.equal(controllerStep, 'era2AdvanceReady');
  assert.equal(introStep, controllerStep);
  assert.equal(resolverStep, controllerStep);
  assert.equal(witnessAfter - witnessBefore, 0);
  introOverlay.finish({ markSeen: false });
});

test('mounted game and shell create and subscribe exactly one tutorial controller', (t) => {
  ModalStore.closeAll();
  const previousWindow = global.window;
  global.window = {};
  const constructionCountBefore = constructionCount;
  const subscribedHosts = [];
  const modalChanges = [];
  const EventRegistryClass = TutorialGuideEventRegistry.TutorialGuideEventRegistry;
  const originalSubscribeToBus = EventRegistryClass.prototype.subscribeToBus;
  EventRegistryClass.prototype.subscribeToBus = function subscribeToBus(bus, host) {
    subscribedHosts.push(host);
    return originalSubscribeToBus.call(this, bus, host);
  };
  const unsubscribeModal = ChangeEventBus.subscribe('modal.changed', (change) => {
    modalChanges.push(change);
  });

  let game = null;
  t.after(() => {
    game?.tutorialController?.disconnectChangeEventBus?.();
    unsubscribeModal();
    EventRegistryClass.prototype.subscribeToBus = originalSubscribeToBus;
    if (previousWindow === undefined) delete global.window;
    else global.window = previousWindow;
    ModalStore.closeAll();
  });

  const farmBuiltTutorial = { completed: false, currentStep: 'farmBuilt' };
  const state = {
    resources: {},
    population: {},
    buildings: {
      house: { level: 1 },
      farm: { level: 1 },
    },
    currentEra: 1,
    currentTab: 'resources',
    militaryView: 'army',
    eraProgress: { canAdvance: true },
    tutorial: farmBuiltTutorial,
  };
  game = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    hasServerState: true,
    initialState: state,
  });
  const shell = new CanvasGameShell({
    runtime: {
      ensureCanvas() {
        return {};
      },
    },
    renderer: {},
  });
  let pageEvaluationCount = 0;
  shell.renderActive = () => {
    pageEvaluationCount += 1;
    return true;
  };
  game.canvasShell = shell;

  assert.equal(shell.mount(game), true);
  assert.equal(constructionCount - constructionCountBefore, 1);
  assert.equal(shell.tutorialController, null);
  assert.equal(shell.getTutorialController(), game.tutorialController);
  assert.deepEqual(subscribedHosts, [game.tutorialController]);
  assert.equal(subscribedHosts[0].game, game);

  game.tutorialController.sync(farmBuiltTutorial);
  CanvasModalSnapshotAdapter.openBlockingPanelSnapshot(game, 'activeCommandPanel', 'buildings');
  game.syncFromServer(state, farmBuiltTutorial, state.eraProgress, { render: false });
  modalChanges.length = 0;

  const evaluation = ChangeEventBus.emit('state.changed', {
    owner: game,
    source: 'TutorialSingleHostContext:test:farm-built',
  });

  assert.equal(game.tutorialController.getCurrentStep(), 'era2AdvanceReady');
  assert.equal(game.getCommandPanelValue(), '');
  assert.deepEqual(
    modalChanges.map(({ operation, subtype, payload }) => ({
      operation,
      subtype,
      value: payload?.value,
    })),
    [{ operation: 'close', subtype: 'modal:commandPanel', value: 'buildings' }],
  );
  assert.equal(
    modalChanges.some(({ operation, subtype, payload }) => (
      operation === 'open'
      && subtype === 'modal:commandPanel'
      && payload?.value === 'buildings'
    )),
    false,
  );
  assert.equal(evaluation.failed, 0);
  assert.equal(pageEvaluationCount > 0, true);
});

test.after(() => {
  TutorialHostContext.resetDivergenceWitness();
  global.TutorialHostContext = previousGlobalHostContext;
});
