const test = require('node:test');
const assert = require('node:assert/strict');

const TutorialIntroOverlay = require('./TutorialIntroOverlay');
const TutorialGuideController = require('./TutorialGuideController');

function attachTutorialController(game) {
  const controller = new TutorialGuideController({ game });
  game.tutorialController = controller;
  controller.sync(game.state?.tutorial || game.tutorial || {});
  return game;
}

function createOverlayGame(state = {}) {
  return attachTutorialController({
    hasServerState: true,
    state: {
      gameDay: 1,
      totalBuildings: 0,
      tutorial: { completed: false, currentStep: 0 },
      cityState: { capitalCityId: 'capital' },
      territoryState: { territories: [{ id: 'capital' }] },
      ...state,
    },
    canvasShell: {
      renderActive() {},
    },
  });
}

test('TutorialIntroOverlay delays enter-city completion until the fade transition ends', async () => {
  let currentTime = 1000;
  const timers = [];
  const renders = [];
  let completed = 0;
  const overlay = new TutorialIntroOverlay({
    runtime: {
      performance: { now: () => currentTime },
      setTimeout(callback, delayMs) {
        timers.push({ callback, delayMs });
        return timers.length;
      },
      clearTimeout() {},
    },
    storage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    },
    context: attachTutorialController({
      hasServerState: true,
      state: {
        gameDay: 1,
        totalBuildings: 0,
        cityState: { capitalCityId: 'capital' },
        territoryState: { territories: [{ id: 'capital' }] },
      },
      canvasShell: {
        renderActive(options) {
          renders.push(options);
        },
      },
    }).tutorialController,
  });

  assert.equal(overlay.start(), true);
  assert.equal(overlay.getViewState().marchDurationMs, 4800);
  currentTime = 3400;
  assert.equal(overlay.finishMarch(), true);
  assert.equal(overlay.advanceFromAction({ type: 'openWorldSite', siteId: 'capital' }), true);
  assert.equal(overlay.beginEnterCityTransition({ type: 'enterCity', cityId: 'capital' }, () => { completed += 1; }), true);

  const entering = overlay.getViewState();
  assert.equal(entering.step, 'entering');
  assert.equal(entering.enterDurationMs, 1560);
  assert.equal(completed, 0);
  assert.equal(timers.at(-1).delayMs, 1560);

  currentTime = entering.enterEndedAt;
  assert.equal(overlay.completeEnterCityTransition(), true);
  await Promise.resolve();
  assert.equal(overlay.running, false);
  assert.equal(completed, 1);
  assert.ok(renders.length > 0);
});

test('TutorialIntroOverlay does not start over later server tutorial guides', () => {
  const game = createOverlayGame({
    tutorial: {
      completed: false,
      currentStep: 25,
      phaseCompleted: { newbie: true, era2: true, scoutFormation: true },
      grants: {
        firstExploreEmptyCity: { siteId: 'site_2_2' },
      },
    },
    territoryState: {
      territories: [{ id: 'capital' }, { id: 'site_2_2', naturalName: 'Empty City' }],
      namingPrompt: {
        type: 'polity',
        title: 'Name polity',
        message: 'Name the polity after the first expansion.',
      },
    },
  });
  const overlay = new TutorialIntroOverlay({
    runtime: {},
    storage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    },
    context: game.tutorialController,
  });

  assert.equal(overlay.shouldStart(), false);
  assert.equal(overlay.start(), false);
  assert.equal(game.tutorialIntro, undefined);
});

test('TutorialIntroOverlay allows initial server tutorial steps only', () => {
  const overlay = new TutorialIntroOverlay({
    runtime: {},
    storage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    },
    context: createOverlayGame({ tutorial: { completed: false, currentStep: 1 } }).tutorialController,
  });

  assert.equal(overlay.shouldStart(), true);
});
