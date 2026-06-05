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

test('TutorialGuideController guides farm, forest event, lumbermill, and second main task', () => {
  const calls = [];
  const shell = {
    activeCommandPanel: '',
    getCanvasTarget(type, predicate) {
      const targets = {
        buildBuilding: [
          { type: 'buildBuilding', buildingId: 'farm' },
          { type: 'buildBuilding', buildingId: 'lumbermill' },
        ],
        openCommandPanel: [
          { type: 'openCommandPanel', panel: 'civilization' },
          { type: 'openCommandPanel', panel: 'events' },
        ],
        advanceEra: { type: 'advanceEra' },
        openEvent: { type: 'openEvent', eventId: 'evt_settlement_forest_001' },
        claimEvent: { type: 'claimEvent', eventId: 'evt_settlement_forest_001', optionId: 'opt_collect_wood' },
        openTaskCenter: { type: 'openTaskCenter', source: 'taskIcon' },
        claimTaskReward: { type: 'claimTaskReward', taskId: 'main_lumbermill_supplies', category: 'main' },
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
    tutorial: { completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.farmPrepReserved },
    state: {
      currentTab: 'buildings',
      eventQueue: [{ id: 'evt_settlement_forest_001' }],
      buildingDefinitions: {
        farm: { category: 'agriculture' },
        lumbermill: { category: 'production' },
      },
    },
    activeTab: 'buildings',
    canvasShell: shell,
    renderCanvasSurface() {
      calls.push({ render: true });
    },
  };
  const controller = new TutorialGuideController({ game });
  controller.sync(game.tutorial);

  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'buildBuilding', buildingId: 'farm' });
  assert.equal(game.activeBuildingCategory, 'agriculture');
  assert.equal(game.canvasShell.activeBuildingCategory, 'agriculture');

  controller.sync({ completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.era2AdvanceReady });
  game.state.currentTab = 'buildings';
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openCommandPanel', panel: 'civilization' });

  game.state.currentTab = 'civilization';
  shell.activeCommandPanel = 'civilization';
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'advanceEra' });

  controller.onEraAdvanced({
    tutorial: { completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.eraAdvancedTo2 },
  });
  assert.equal(game.showAdvisor, true);
  assert.equal(game.state.softGuide.target, 'events-button');

  game.showAdvisor = false;
  game.canvasShell.showAdvisor = false;
  controller.sync(game.tutorial);
  shell.activeCommandPanel = 'civilization';
  game.activeCommandPanel = 'civilization';
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openCommandPanel', panel: 'events' });
  assert.equal(shell.activeCommandPanel, '');
  assert.equal(game.activeCommandPanel, '');

  shell.activeCommandPanel = 'events';
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openEvent', eventId: 'evt_settlement_forest_001' });

  game.activeEventId = 'evt_settlement_forest_001';
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, {
    type: 'claimEvent',
    eventId: 'evt_settlement_forest_001',
    optionId: 'opt_collect_wood',
  });

  controller.sync({ completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.specialEventClaimed });
  game.activeEventId = null;
  game.canvasShell.activeEventId = null;
  game.state.currentTab = 'events';
  shell.activeCommandPanel = 'events';
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'buildBuilding', buildingId: 'lumbermill' });
  assert.equal(game.canvasShell.activeCommandPanel, 'buildings');
  assert.equal(game.activeBuildingCategory, 'production');
  assert.equal(game.canvasShell.activeBuildingCategory, 'production');

  controller.sync({ completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.lumbermillBuilt });
  game.showTaskCenter = true;
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, {
    type: 'claimTaskReward',
    taskId: 'main_lumbermill_supplies',
    category: 'main',
  });
});

test('TutorialGuideController guides era three, scout famous card, and army formation', async () => {
  const calls = [];
  const shell = {
    activeCommandPanel: '',
    armyFormationEditor: { open: false, cityId: '', slot: 1, memberIds: [] },
    getCanvasTarget(type, predicate) {
      const targets = {
        openCommandPanel: { type: 'openCommandPanel', panel: 'civilization' },
        advanceEra: { type: 'advanceEra' },
        openFamousPersons: { type: 'openFamousPersons' },
        openFamousPersonDetail: { type: 'openFamousPersonDetail', personId: 'fp-scout' },
        closeFamousPersonDetail: { type: 'closeFamousPersonDetail' },
        closeFamousPersons: { type: 'closeFamousPersons' },
        openCommandPanelMilitary: { type: 'openCommandPanel', panel: 'military' },
        openArmyFormation: { type: 'openArmyFormation', cityId: 'capital', slot: 1 },
        toggleArmyFormationMember: { type: 'toggleArmyFormationMember', personId: 'fp-scout' },
        saveArmyFormation: { type: 'saveArmyFormation' },
      };
      if (type === 'openCommandPanel' && predicate?.(targets.openCommandPanelMilitary)) return { x: 10, y: 20, width: 100, height: 30 };
      const action = targets[type];
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
    tutorial: { completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.era3AdvanceReady },
    state: {
      currentTab: 'buildings',
      activeCityId: 'capital',
      famousPersons: {
        people: [{
          id: 'fp-scout',
          archetype: 'scout',
          abilityArchetype: 'scout',
          quality: 'great',
        }],
      },
      military: {
        formations: {
          capital: [{ slot: 1, memberIds: [] }],
        },
      },
    },
    canvasShell: shell,
    selectedFamousPersonId: '',
    renderCanvasSurface() {
      calls.push({ render: true });
    },
    applyApiState(result) {
      this.tutorial = result.tutorial;
    },
  };
  const api = {
    async advanceTutorial(step) {
      return { tutorial: { completed: false, currentStep: step, grants: { scoutFamousPerson: { personId: 'fp-scout' } } } };
    },
  };
  const controller = new TutorialGuideController({ game, api });
  controller.sync(game.tutorial);

  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openCommandPanel', panel: 'civilization' });

  shell.activeCommandPanel = 'civilization';
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'advanceEra' });

  controller.onEraAdvanced({
    tutorial: {
      completed: false,
      currentStep: TutorialGuideController.TUTORIAL_STEPS.scoutFamousGranted,
      grants: { scoutFamousPerson: { personId: 'fp-scout' } },
    },
  });
  assert.equal(game.showAdvisor, true);
  assert.equal(game.state.softGuide.target, 'famous-persons-button');

  game.showAdvisor = false;
  shell.showAdvisor = false;
  controller.sync(game.tutorial);
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openFamousPersons' });

  game.showFamousPersons = true;
  shell.showFamousPersons = true;
  await controller.onFamousPersonsOpened();
  assert.equal(controller.getCurrentStep(), TutorialGuideController.TUTORIAL_STEPS.famousPanelOpened);
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openFamousPersonDetail', personId: 'fp-scout' });

  await controller.onFamousPersonDetailOpened('fp-scout');
  assert.equal(controller.getCurrentStep(), TutorialGuideController.TUTORIAL_STEPS.famousCardViewed);
  game.selectedFamousPersonId = 'fp-scout';
  shell.selectedFamousPersonId = 'fp-scout';
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'closeFamousPersonDetail' });

  game.selectedFamousPersonId = '';
  shell.selectedFamousPersonId = '';
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'closeFamousPersons' });

  game.showFamousPersons = false;
  shell.showFamousPersons = false;
  shell.activeCommandPanel = 'civilization';
  game.activeCommandPanel = 'civilization';
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openCommandPanel', panel: 'military' });
  assert.equal(shell.activeCommandPanel, '');
  assert.equal(game.activeCommandPanel, '');

  shell.activeCommandPanel = 'military';
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openArmyFormation', cityId: 'capital', slot: 1 });

  shell.armyFormationEditor = { open: true, cityId: 'capital', slot: 1, memberIds: [] };
  await controller.onArmyFormationOpened();
  assert.equal(controller.getCurrentStep(), TutorialGuideController.TUTORIAL_STEPS.formationPanelOpened);
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'toggleArmyFormationMember', personId: 'fp-scout' });

  shell.armyFormationEditor.memberIds = ['fp-scout'];
  game.armyFormationEditor = shell.armyFormationEditor;
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'saveArmyFormation' });
});
