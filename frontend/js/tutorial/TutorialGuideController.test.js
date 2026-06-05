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

test('TutorialGuideController guides scout formation into world exploration and claim', async () => {
  const calls = [];
  const shell = {
    activeCommandPanel: '',
    getCanvasTarget(type, predicate) {
      const targets = {
        openCommandPanel: { type: 'openCommandPanel', panel: 'military' },
        switchMilitaryView: { type: 'switchMilitaryView', view: 'world' },
        startExplore: { type: 'startExplore', formationSlot: 1 },
        claimExplore: { type: 'claimExplore', missionId: 'explore-1' },
      };
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
    tutorial: { completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.scoutFormationSaved },
    state: {
      currentTab: 'military',
      militaryView: 'army',
      worldExplorerState: {},
    },
    activeCommandPanel: '',
    canvasShell: shell,
    renderCanvasSurface() {
      calls.push({ render: true });
    },
    applyApiState(result) {
      this.tutorial = result.tutorial;
    },
  };
  const api = {
    async advanceTutorial(step) {
      return { tutorial: { completed: false, currentStep: step } };
    },
  };
  const controller = new TutorialGuideController({ game, api });
  controller.sync(game.tutorial);

  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openCommandPanel', panel: 'military' });

  shell.activeCommandPanel = 'military';
  game.activeCommandPanel = 'military';
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'switchMilitaryView', view: 'world' });

  await controller.onMilitaryViewSwitched('world');
  assert.equal(controller.getCurrentStep(), TutorialGuideController.TUTORIAL_STEPS.scoutWorldPanelOpened);
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'startExplore' });

  controller.onExploreStarted({
    tutorial: { completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.scoutExploreStarted },
  });
  game.state.worldExplorerState = {
    activeMission: { id: 'explore-1', status: 'active', route: [{ revealed: false }] },
    readyMissions: [],
  };
  assert.equal(controller.refreshCurrentHighlight(), false);
  assert.equal(calls.some((call) => call.hideHighlight), true);

  game.state.worldExplorerState = {
    activeMission: null,
    readyMissions: [{ id: 'explore-1', status: 'ready', route: [{ revealed: true }] }],
  };
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'claimExplore', missionId: 'explore-1' });

  controller.onExploreClaimed({
    tutorial: { completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.scoutExploreClaimed },
  });
  assert.equal(controller.getCurrentStep(), TutorialGuideController.TUTORIAL_STEPS.scoutExploreClaimed);
});

test('TutorialGuideController guides first empty city occupation and naming', () => {
  const calls = [];
  const siteId = 'site_3_1';
  const shell = {
    activeCommandPanel: 'military',
    getCanvasTarget(type, predicate) {
      const targets = {
        openWorldSite: { type: 'openWorldSite', siteId },
        conquer: { type: 'conquer', territoryId: siteId },
        claimConquest: { type: 'claimConquest', territoryId: siteId },
        renameCity: { type: 'renameCity', territoryId: siteId },
        requestNamingInput: { type: 'requestNamingInput' },
        submitNaming: { type: 'submitNaming', name: '河湾城' },
      };
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
    tutorial: {
      completed: false,
      currentStep: TutorialGuideController.TUTORIAL_STEPS.scoutExploreClaimed,
      grants: { firstExploreEmptyCity: { siteId } },
    },
    state: {
      currentTab: 'military',
      territoryState: {
        territories: [
          { id: 'capital', status: 'occupied', owner: 'player', cityName: '首都' },
          { id: siteId, status: 'discovered', owner: 'neutral', naturalName: 'River Bend' },
        ],
      },
    },
    canvasShell: shell,
    renderCanvasSurface() {
      calls.push({ render: true });
    },
  };
  const controller = new TutorialGuideController({ game });
  controller.sync(game.tutorial);

  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openWorldSite', siteId });

  game.territoryController = { uiState: { selectedSiteId: siteId } };
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'conquer', territoryId: siteId });

  controller.sync({ ...game.tutorial, currentStep: TutorialGuideController.TUTORIAL_STEPS.firstCityConquestStarted });
  game.state.territoryState.territories[1].status = 'contested';
  game.state.territoryState.territories[1].mission = { status: 'ready', mode: 'settlement' };
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'claimConquest', territoryId: siteId });

  controller.sync({ ...game.tutorial, currentStep: TutorialGuideController.TUTORIAL_STEPS.firstCityOccupied });
  game.state.territoryState.territories[1].status = 'occupied';
  game.state.territoryState.namingPrompt = { type: 'city', territoryId: siteId };
  game.naming = { prompt: { type: 'city', territoryId: siteId }, inputValue: '' };
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'requestNamingInput' });

  game.naming.inputValue = 'River City';
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'submitNaming' });

  controller.sync({ ...game.tutorial, currentStep: TutorialGuideController.TUTORIAL_STEPS.firstCityNamed });
  game.state.territoryState.namingPrompt = { type: 'polity' };
  game.naming = { prompt: { type: 'polity' }, inputValue: '' };
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'requestNamingInput' });

  game.naming.inputValue = 'River League';
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'submitNaming' });
});

test('TutorialGuideController focuses guided first city when it is offscreen', () => {
  const calls = [];
  const siteId = 'site_far';
  const shell = {
    runtime: { width: 420, height: 747 },
    actionController: {
      centerWorldMapOnSite(id) {
        calls.push(['center', id]);
        return true;
      },
    },
    renderActive() {
      calls.push(['shellRender']);
    },
    getCanvasTarget() {
      return { x: -220, y: 680, width: 80, height: 80 };
    },
    showTutorialHighlight() {
      calls.push(['highlight']);
      return true;
    },
  };
  const game = {
    tutorial: {
      completed: false,
      currentStep: TutorialGuideController.TUTORIAL_STEPS.scoutExploreClaimed,
      grants: { firstExploreEmptyCity: { siteId } },
    },
    state: {
      currentTab: 'military',
      territoryState: {
        territories: [
          { id: siteId, status: 'discovered', owner: 'neutral', naturalName: 'Far Site' },
        ],
      },
    },
    canvasShell: shell,
    renderCanvasSurface(tab) {
      calls.push(['gameRender', tab]);
    },
  };
  const controller = new TutorialGuideController({ game });
  controller.sync(game.tutorial);

  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.slice(0, 3), [
    ['center', siteId],
    ['gameRender', 'military'],
    ['shellRender'],
  ]);
  assert.equal(calls.some((call) => call[0] === 'highlight'), false);
});

test('TutorialGuideController guides final tech explanation and completes tutorial on advisor close', async () => {
  const calls = [];
  const shell = {
    activeCommandPanel: '',
    getCanvasTarget(type, predicate) {
      const action = { type: 'openCommandPanel', panel: 'tech' };
      if (type === 'openCommandPanel' && (!predicate || predicate(action))) {
        return { x: 10, y: 20, width: 100, height: 30 };
      }
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
    tutorial: { completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.polityNamed },
    state: { currentTab: 'military' },
    activeCommandPanel: '',
    canvasShell: shell,
    renderCanvasSurface(tab) {
      calls.push({ render: tab });
    },
    applyApiState(result) {
      this.tutorial = result.tutorial;
      this.state.tutorial = result.tutorial;
    },
  };
  const api = {
    async advanceTutorial(step) {
      calls.push({ advanceTutorial: step });
      return {
        tutorial: {
          completed: step === TutorialGuideController.TUTORIAL_STEPS.completed,
          currentStep: step,
          phaseCompleted: { newbie: true, era2: true, scoutFormation: true },
        },
      };
    },
  };
  const controller = new TutorialGuideController({ game, api });
  controller.sync(game.tutorial);

  assert.equal(controller.canOpenTab('tech'), true);
  assert.equal(controller.canOpenTab('military'), false);
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openCommandPanel', panel: 'tech' });

  shell.activeCommandPanel = 'tech';
  game.activeCommandPanel = 'tech';
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.equal(game.showAdvisor, true);
  assert.equal(shell.showAdvisor, true);
  assert.equal(game.state.softGuide.target, 'tech-tree');
  assert.match(game.state.softGuide.message, /科技点/);

  await controller.onAdvisorClosed();

  assert.equal(controller.isCompleted(), true);
  assert.equal(game.tutorial.currentStep, TutorialGuideController.TUTORIAL_STEPS.completed);
  assert.equal(game.tutorial.completed, true);
  assert.equal(game.state.softGuide, null);
  assert.equal(controller.canOpenTab('military'), true);
  assert.deepEqual(
    calls.filter((call) => call.advanceTutorial).map((call) => call.advanceTutorial),
    [TutorialGuideController.TUTORIAL_STEPS.completed],
  );
});
