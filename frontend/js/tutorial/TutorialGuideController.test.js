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
    hideTutorialHighlight() {
      calls.push({ hideHighlight: true });
      return true;
    },
    hideTutorialHighlight() {
      calls.push({ hideHighlight: true });
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

test('TutorialGuideController guides first era advancement and task reward claim', () => {
  const calls = [];
  const shell = {
    getCanvasTarget(type, predicate) {
      const targets = {
        openCommandPanel: { type: 'openCommandPanel', panel: 'civilization' },
        advanceEra: { type: 'advanceEra' },
        openTaskCenter: [
          { type: 'openTaskCenter', source: 'disabledShortcut', disabled: true },
          { type: 'openTaskCenter', source: 'taskIcon' },
        ],
        claimTaskReward: { type: 'claimTaskReward', taskId: 'main_first_supplies', category: 'main' },
      };
      const candidates = Array.isArray(targets[type]) ? targets[type] : [targets[type]];
      const action = candidates.find((item) => item && (!predicate || predicate(item)));
      if (action && (!predicate || predicate(action))) return { x: 10, y: 20, width: 100, height: 30 };
      return null;
    },
    showTutorialHighlight(target, message, options) {
      calls.push({ target, message, options });
      return true;
    },
    hideTutorialHighlight() {
      calls.push({ hideHighlight: true });
      return true;
    },
  };
  const game = {
    tutorial: { completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.houseBuilt },
    state: { currentTab: 'resources' },
    canvasShell: shell,
    renderCanvasSurface() {
      calls.push({ render: true });
    },
  };
  const controller = new TutorialGuideController({ game });
  controller.sync(game.tutorial);

  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openCommandPanel', panel: 'civilization' });

  game.state.currentTab = 'civilization';
  controller.sync({ completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.civilizationTabOpened });
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'advanceEra' });

  controller.onEraAdvanced({
    tutorial: { completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.eraAdvancedTo1 },
  });
  assert.equal(game.showAdvisor, true);
  assert.equal(game.state.softGuide.target, 'task-center-button');

  controller.sync(game.tutorial);
  assert.equal(controller.refreshCurrentHighlight(), false);
  assert.equal(calls.some((call) => call.hideHighlight), true);

  game.showAdvisor = false;
  game.canvasShell.showAdvisor = false;
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openTaskCenter' });

  game.showTaskCenter = true;
  game.activeTaskCenterTab = 'main';
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, {
    type: 'claimTaskReward',
    taskId: 'main_first_supplies',
    category: 'main',
  });
});
