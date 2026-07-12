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

test.after(() => {
  TutorialHostContext.resetDivergenceWitness();
  global.TutorialHostContext = previousGlobalHostContext;
});
