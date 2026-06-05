const test = require('node:test');
const assert = require('node:assert/strict');

const TutorialGuideController = require('./TutorialGuideController');

test('TutorialGuideController advances city entry directly into the house guide', async () => {
  const calls = [];
  const game = {
    tutorial: { completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.initial },
    applyApiState(result) {
      this.tutorial = result.tutorial;
      calls.push(['applyApiState', result.tutorial.currentStep]);
    },
  };
  const api = {
    async advanceTutorial(step) {
      calls.push(['advanceTutorial', step]);
      return { tutorial: { completed: false, currentStep: step, phaseCompleted: { newbie: false, era2: false } } };
    },
  };
  const controller = new TutorialGuideController({ game, api });
  controller.sync(game.tutorial);

  await controller.markCityEntered();

  assert.deepEqual(calls.map(([name, step]) => [name, step]), [
    ['advanceTutorial', TutorialGuideController.TUTORIAL_STEPS.cityEntered],
    ['applyApiState', TutorialGuideController.TUTORIAL_STEPS.cityEntered],
    ['advanceTutorial', TutorialGuideController.TUTORIAL_STEPS.houseGuideReady],
    ['applyApiState', TutorialGuideController.TUTORIAL_STEPS.houseGuideReady],
  ]);
});

test('TutorialGuideController only allows first house build during house guide', () => {
  const controller = new TutorialGuideController({
    state: { completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.houseGuideReady },
  });

  assert.equal(controller.onBuildingAction('house', 'build'), true);
  assert.equal(controller.onBuildingAction('farm', 'build'), false);
  assert.equal(controller.onBuildingAction('house', 'upgrade'), false);
  assert.equal(controller.canOpenTab('events'), false);
});

test('TutorialGuideController highlights the house build button when available', () => {
  const calls = [];
  const shell = {
    showCityManagement: false,
    activeCityManagementTab: '',
    getCanvasTarget(type, predicate) {
      const action = { type: 'buildBuilding', buildingId: 'house' };
      if (type === 'buildBuilding' && predicate(action)) return { x: 10, y: 20, width: 100, height: 30 };
      return null;
    },
    showTutorialHighlight(target, message, options) {
      calls.push({ target, message, options });
      return true;
    },
  };
  const game = {
    tutorial: { completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.houseGuideReady },
    canvasShell: shell,
  };
  const controller = new TutorialGuideController({ game });
  controller.sync(game.tutorial);

  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.equal(shell.showCityManagement, true);
  assert.equal(shell.activeCityManagementTab, 'buildings');
  assert.equal(calls.some((call) => call.options?.allowedAction?.buildingId === 'house'), true);
});
