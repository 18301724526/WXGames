const test = require('node:test');
const assert = require('node:assert/strict');

const TutorialGuideController = require('./TutorialGuideController');
const TerritoryUiStateStore = require('../state/TerritoryUiStateStore');
const { makeModalOwnerHost } = require('../../test-support/CanvasOwnerTestHarness');

const makeModalHost = makeModalOwnerHost;

// Link a game host and its canvasShell so shell reads resolve to the game owner.
function linkGameShell(game, shell) {
  if (game) game.canvasShell = shell;
  if (shell) shell.lastGame = game;
  return game;
}

async function flushTutorialPromises(ticks = 12) {
  for (let index = 0; index < ticks; index += 1) {
    await Promise.resolve();
  }
}

test('TutorialGuideController advances city entry and keeps the house build guide active', async () => {
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
  ]);
});

test('TutorialGuideFlowRegistry guides the first house build at cityEntered', () => {
  const calls = [];
  const shell = makeModalHost({
    activeCityManagementTab: '',
    getCanvasTarget(type, predicate) {
      const action = { type: 'buildBuilding', buildingId: 'house' };
      if (type === 'buildBuilding' && (!predicate || predicate(action))) return { x: 10, y: 20, width: 100, height: 30 };
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
  });
  const game = makeModalHost({
    tutorial: { completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.cityEntered },
    state: { currentTab: 'resources' },
    renderCanvasSurface() {
      calls.push({ render: true });
    },
  });
  linkGameShell(game, shell);
  const controller = new TutorialGuideController({ game });
  controller.sync(game.tutorial);

  assert.equal(controller.canOpenTab('tasks'), false);
  assert.equal(controller.canOpenTab('buildings'), true);
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'buildBuilding', buildingId: 'house' });
});

test('TutorialGuideController only allows first house build during house guide', () => {
  const controller = new TutorialGuideController({
    state: { completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.cityEntered },
  });

  assert.equal(controller.onBuildingAction('house', 'build'), true);
  assert.equal(controller.onBuildingAction('farm', 'build'), false);
  assert.equal(controller.onBuildingAction('house', 'upgrade'), false);
  assert.equal(controller.canOpenTab('events'), false);
});

test('TutorialGuideController deduplicates concurrent advance requests for the same step', async () => {
  const calls = [];
  let resolveAdvance;
  const game = {
    tutorial: { completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.talentPolicyOpened },
    applyApiState(result) {
      this.tutorial = result.tutorial;
      calls.push(['applyApiState', result.tutorial.currentStep]);
    },
  };
  const api = {
    advanceTutorial(step) {
      calls.push(['advanceTutorial', step]);
      return new Promise((resolve) => {
        resolveAdvance = () => resolve({
          tutorial: { completed: false, currentStep: step, phaseCompleted: {} },
        });
      });
    },
  };
  const controller = new TutorialGuideController({ game, api });
  controller.sync(game.tutorial);

  const first = controller.advanceTo(TutorialGuideController.TUTORIAL_STEPS.talentPolicyApplied);
  const second = controller.advanceTo(TutorialGuideController.TUTORIAL_STEPS.talentPolicyApplied);
  assert.equal(calls.filter(([name]) => name === 'advanceTutorial').length, 1);

  resolveAdvance();
  const results = await Promise.all([first, second]);

  assert.equal(results[0], results[1]);
  assert.deepEqual(calls, [
    ['advanceTutorial', TutorialGuideController.TUTORIAL_STEPS.talentPolicyApplied],
    ['applyApiState', TutorialGuideController.TUTORIAL_STEPS.talentPolicyApplied],
  ]);
});

test('TutorialGuideController prepares the house surface before projecting its highlight', async () => {
  const calls = [];
  const shell = makeModalHost({
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
  });
  const game = makeModalHost({
    tutorial: { completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.cityEntered },
  });
  linkGameShell(game, shell);
  const controller = new TutorialGuideController({ game });
  controller.sync(game.tutorial);

  await controller.markCityEntered();
  assert.equal(shell.isBlockingPanelSnapshotOpen('showCityManagement'), true);
  assert.equal(game.activeCityManagementTab, 'buildings');
  assert.equal(shell.activeCityManagementTab, '');
  assert.equal(calls.some((call) => call.options?.allowedAction?.buildingId === 'house'), true);
});

test('TutorialGuideController guides first era advancement and task reward claim', () => {
  const calls = [];
  const shell = makeModalHost({
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
  });
  const game = makeModalHost({
    tutorial: { completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.houseBuilt },
    state: { currentTab: 'resources' },
    __rewardRevealSnapshot: null,
    isRewardRevealSnapshotOpen() {
      return Boolean(this.__rewardRevealSnapshot);
    },
    openRewardRevealSnapshot(payload) {
      this.__rewardRevealSnapshot = { ...(payload || {}), visible: true };
      return this.__rewardRevealSnapshot;
    },
    __namingSnapshot: null,
    getNamingSnapshot() {
      return this.__namingSnapshot;
    },
    getNamingInputValue() {
      return String(this.__namingSnapshot?.inputValue || '').trim();
    },
    openNamingSnapshot(payload) {
      this.__namingSnapshot = { ...(payload || {}), visible: true };
      return this.__namingSnapshot;
    },
    updateNamingSnapshot(patch) {
      this.__namingSnapshot = { ...(this.__namingSnapshot || {}), ...(patch || {}) };
      return this.__namingSnapshot;
    },
    renderCanvasSurface() {
      calls.push({ render: true });
    },
  });
  linkGameShell(game, shell);
  const controller = new TutorialGuideController({ game });
  controller.sync(game.tutorial);

  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openCommandPanel', panel: 'civilization' });

  game.state.currentTab = 'civilization';
  controller.sync({ completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.civilizationTabOpened });
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'advanceEra' });

  game.openBlockingPanelSnapshot('activeCommandPanel', 'civilization');
  controller.onEraAdvanced({
    tutorial: { completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.eraAdvancedTo1 },
  });
  assert.equal(game.isBlockingPanelSnapshotOpen('showAdvisor'), false);
  assert.equal(shell.isBlockingPanelSnapshotOpen('showAdvisor'), false);
  assert.equal(game.getCommandPanelValue(), '');
  assert.equal(shell.getCommandPanelValue(), '');
  assert.equal(game.tutorialAdvisorDialogue.source, 'softGuide:task-center-button');
  assert.equal(game.canvasShell.tutorialAdvisorDialogue, game.tutorialAdvisorDialogue);
  assert.match(game.tutorialAdvisorDialogue.message, /任务|物资|农田|火种/);
  assert.equal(game.state.softGuide.target, 'task-center-button');

  controller.sync(game.tutorial);
  assert.equal(controller.refreshCurrentHighlight(), false);
  assert.equal(calls.some((call) => call.hideHighlight), true);

  game.tutorialAdvisorDialogue = null;
  game.canvasShell.tutorialAdvisorDialogue = null;
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openTaskCenter' });

  game.openBlockingPanelSnapshot('showTaskCenter', true);
  game.activeTaskCenterTab = 'main';
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, {
    type: 'claimTaskReward',
    taskId: 'main_first_supplies',
    category: 'main',
  });

  controller.sync({ completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.farmPrepReserved });
  game.openRewardRevealSnapshot({ rewardText: '+10' });
  assert.equal(controller.refreshCurrentHighlight(), false);
  assert.equal(calls.at(-1).hideHighlight, true);
});

test('TutorialGuideController advances the barracks buildings-tab gate when the panel opens', async () => {
  const calls = [];
  const game = makeModalHost({
    tutorial: { completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.barracksSuppliesClaimed },
    state: { currentTab: 'resources' },
    applyApiState(result) {
      this.tutorial = result.tutorial;
    },
  });
  const api = {
    async advanceTutorial(step) {
      calls.push(['advanceTutorial', step]);
      return { tutorial: { completed: false, currentStep: step } };
    },
  };
  const controller = new TutorialGuideController({ game, api });
  controller.sync(game.tutorial);

  await controller.onCommandPanelOpened('buildings');

  assert.deepEqual(calls, [
    ['advanceTutorial', TutorialGuideController.TUTORIAL_STEPS.buildingsTabOpenedForBarracks],
  ]);
  assert.equal(controller.getCurrentStep(), TutorialGuideController.TUTORIAL_STEPS.buildingsTabOpenedForBarracks);
});

test('TutorialGuideController treats tutorial spine advisor dialogue as an open advisor', () => {
  const controller = new TutorialGuideController({
    game: {
      showAdvisor: false,
      tutorialAdvisorDialogue: { source: 'houseBuilt' },
      canvasShell: { showAdvisor: false },
    },
  });

  assert.equal(controller.isAdvisorOpen(), true);
});

test('TutorialGuideController guides farm, forest event, lumbermill, and second main task', () => {
  const calls = [];
  const shell = makeModalHost({
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
  });
  const game = makeModalHost({
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
    __eventSnapshot: null,
    openEventSnapshot(eventId) {
      this.__eventSnapshot = eventId ? { eventId, visible: true } : null;
      return eventId;
    },
    closeEventSnapshot() {
      this.__eventSnapshot = null;
    },
    getEventSnapshot() {
      return this.__eventSnapshot;
    },
    isEventSnapshotOpen() {
      return Boolean(this.__eventSnapshot);
    },
    renderCanvasSurface() {
      calls.push({ render: true });
    },
  });
  linkGameShell(game, shell);
  const controller = new TutorialGuideController({ game });
  controller.sync(game.tutorial);

  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'buildBuilding', buildingId: 'farm' });
  assert.equal(game.activeBuildingCategory, 'agriculture');
  assert.equal(game.canvasShell.activeBuildingCategory, undefined);

  controller.sync({ completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.era2AdvanceReady });
  game.state.currentTab = 'buildings';
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openCommandPanel', panel: 'civilization' });

  game.state.currentTab = 'civilization';
  game.openBlockingPanelSnapshot('activeCommandPanel', 'civilization');
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'advanceEra' });

  controller.onEraAdvanced({
    tutorial: { completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.eraAdvancedTo2 },
  });
  assert.equal(game.isBlockingPanelSnapshotOpen('showAdvisor'), false);
  assert.equal(shell.isBlockingPanelSnapshotOpen('showAdvisor'), false);
  assert.equal(game.tutorialAdvisorDialogue.source, 'softGuide:events-button');
  assert.equal(game.canvasShell.tutorialAdvisorDialogue, game.tutorialAdvisorDialogue);
  assert.match(game.tutorialAdvisorDialogue.message, /事件|森林|木材/);
  assert.equal(game.state.softGuide.target, 'events-button');

  game.tutorialAdvisorDialogue = null;
  game.canvasShell.tutorialAdvisorDialogue = null;
  controller.sync(game.tutorial);
  game.openBlockingPanelSnapshot('activeCommandPanel', 'civilization');
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openCommandPanel', panel: 'events' });
  assert.equal(shell.getCommandPanelValue(), '');
  assert.equal(game.getCommandPanelValue(), '');

  game.openBlockingPanelSnapshot('activeCommandPanel', 'events');
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openEvent', eventId: 'evt_settlement_forest_001' });

  game.openEventSnapshot('evt_settlement_forest_001');
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, {
    type: 'claimEvent',
    eventId: 'evt_settlement_forest_001',
    optionId: 'opt_collect_wood',
  });

  controller.sync({ completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.specialEventClaimed });
  game.closeEventSnapshot();
  game.state.currentTab = 'events';
  game.openBlockingPanelSnapshot('activeCommandPanel', 'events');
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'buildBuilding', buildingId: 'lumbermill' });
  assert.equal(game.canvasShell.getCommandPanelValue(), 'buildings');
  assert.equal(game.activeBuildingCategory, 'production');
  assert.equal(game.canvasShell.activeBuildingCategory, undefined);

  controller.sync({ completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.lumbermillBuilt });
  game.openBlockingPanelSnapshot('showTaskCenter', true);
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, {
    type: 'claimTaskReward',
    taskId: 'main_lumbermill_supplies',
    category: 'main',
  });
});

test('TutorialGuideController guides era three, scout famous card, and army formation', async () => {
  const calls = [];
  const shell = makeModalHost({
    activeCityManagementTab: '',
    territoryUiState: { selectedSiteId: '' },
    armyFormationEditor: { open: false, cityId: '', slot: 1, memberIds: [] },
    getCanvasTarget(type, predicate) {
      const targets = {
        openCommandPanel: [
          { type: 'openCommandPanel', panel: 'civilization' },
          { type: 'openCommandPanel', panel: 'buildings' },
        ],
        advanceEra: { type: 'advanceEra' },
        openTaskCenter: { type: 'openTaskCenter', source: 'taskIcon' },
        claimTaskReward: [
          { type: 'claimTaskReward', taskId: 'main_barracks_supplies', category: 'main' },
          { type: 'claimTaskReward', taskId: 'main_first_army', category: 'main' },
          { type: 'claimTaskReward', taskId: 'main_scout_officer', category: 'main' },
        ],
        buildBuilding: { type: 'buildBuilding', buildingId: 'barracks' },
        openFamousPersons: { type: 'openFamousPersons' },
        openFamousPersonDetail: { type: 'openFamousPersonDetail', personId: 'fp-scout' },
        closeFamousPersonDetail: { type: 'closeFamousPersonDetail' },
        closeFamousPersons: { type: 'closeFamousPersons' },
        openWorldSite: { type: 'openWorldSite', siteId: 'capital' },
        enterCity: { type: 'enterCity', cityId: 'capital' },
        switchCityManagementTab: { type: 'switchCityManagementTab', tab: 'military' },
        openArmyFormation: { type: 'openArmyFormation', cityId: 'capital', slot: 1 },
        toggleArmyFormationMember: { type: 'toggleArmyFormationMember', personId: 'fp-scout' },
        autoReplenishArmyFormation: { type: 'autoReplenishArmyFormation' },
        saveArmyFormation: { type: 'saveArmyFormation' },
        selectWorldMarchTarget: { type: 'selectWorldMarchTarget', targetQ: 2, targetR: -1 },
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
    actionController: {
      centerWorldMapOnSite(siteId) {
        calls.push({ centerWorldMapOnSite: siteId });
        return true;
      },
    },
  });
  const game = makeModalHost({
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
      territoryState: {
        territories: [{ id: 'capital', q: 0, r: 0 }],
      },
    },
    territoryUiState: shell.territoryUiState,
    selectedFamousPersonId: '',
    renderCanvasSurface() {
      calls.push({ render: true });
    },
    applyApiState(result) {
      this.tutorial = result.tutorial;
    },
  });
  linkGameShell(game, shell);
  const api = {
    async advanceTutorial(step) {
      return { tutorial: { completed: false, currentStep: step, grants: { scoutFamousPerson: { personId: 'fp-scout' } } } };
    },
  };
  const controller = new TutorialGuideController({ game, api });
  controller.sync(game.tutorial);

  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openCommandPanel', panel: 'civilization' });

  game.openBlockingPanelSnapshot('activeCommandPanel', 'civilization');
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'advanceEra' });

  controller.onEraAdvanced({
    tutorial: {
      completed: false,
      currentStep: TutorialGuideController.TUTORIAL_STEPS.era3Advanced,
    },
  });
  assert.equal(game.isBlockingPanelSnapshotOpen('showAdvisor'), false);
  assert.equal(shell.isBlockingPanelSnapshotOpen('showAdvisor'), false);
  assert.equal(game.tutorialAdvisorDialogue.source, 'softGuide:task-center-button');
  assert.equal(shell.tutorialAdvisorDialogue, game.tutorialAdvisorDialogue);
  assert.match(game.tutorialAdvisorDialogue.message, /兵营|任务|军队/);
  assert.equal(game.state.softGuide.target, 'task-center-button');

  game.tutorialAdvisorDialogue = null;
  shell.tutorialAdvisorDialogue = null;
  controller.sync(game.tutorial);

  // Barracks claim pair at era3Advanced.
  assert.equal(controller.canOpenTab('tasks'), true);
  assert.equal(controller.canOpenTab('buildings'), true);
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openTaskCenter' });
  game.openBlockingPanelSnapshot('showTaskCenter', true);
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, {
    type: 'claimTaskReward',
    taskId: 'main_barracks_supplies',
    category: 'main',
  });

  // House-style barracks guide: the claim leaves the player on the world-map
  // home, so the build rule fires DIRECTLY at barracksSuppliesClaimed
  // (showBuildingGuide force-opens city management on the buildings tab).
  controller.sync({ completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.barracksSuppliesClaimed });
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'buildBuilding', buildingId: 'barracks' });
  controller.sync({ completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.buildingsTabOpenedForBarracks });
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'buildBuilding', buildingId: 'barracks' });

  // First-army claim pair at barracksBuilt.
  controller.sync({ completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.barracksBuilt });
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openTaskCenter' });
  game.openBlockingPanelSnapshot('showTaskCenter', true);
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, {
    type: 'claimTaskReward',
    taskId: 'main_first_army',
    category: 'main',
  });

  // Scout-officer claim pair at firstArmyClaimed.
  controller.sync({ completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.firstArmyClaimed });
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, {
    type: 'claimTaskReward',
    taskId: 'main_scout_officer',
    category: 'main',
  });

  game.closeBlockingPanelSnapshot('showTaskCenter');
  controller.sync({
    completed: false,
    currentStep: TutorialGuideController.TUTORIAL_STEPS.scoutFamousGranted,
    grants: { scoutFamousPerson: { personId: 'fp-scout' } },
  });
  game.tutorial = controller.state;
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openFamousPersons' });

  game.openBlockingPanelSnapshot('showFamousPersons', true);
  await controller.onFamousPersonsOpened();
  assert.equal(controller.getCurrentStep(), TutorialGuideController.TUTORIAL_STEPS.famousPanelOpened);
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openFamousPersonDetail', personId: 'fp-scout' });

  await controller.onFamousPersonDetailOpened('fp-scout');
  assert.equal(controller.getCurrentStep(), TutorialGuideController.TUTORIAL_STEPS.famousCardViewed);
  game.selectedFamousPersonId = 'fp-scout';
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'closeFamousPersonDetail' });

  game.selectedFamousPersonId = '';
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'closeFamousPersons' });

  game.openBlockingPanelSnapshot('showFamousPersons', true);
  game.openBlockingPanelSnapshot('activeCommandPanel', 'civilization');
  controller.onFamousPersonsClosed();
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openWorldSite', siteId: 'capital' });
  assert.equal(shell.getCommandPanelValue(), '');
  assert.equal(game.getCommandPanelValue(), '');
  assert.equal(game.isBlockingPanelSnapshotOpen('showFamousPersons'), false);
  assert.equal(shell.isBlockingPanelSnapshotOpen('showFamousPersons'), false);

  shell.territoryUiState.selectedSiteId = 'capital';
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'enterCity', cityId: 'capital' });

  game.openBlockingPanelSnapshot('showCityManagement', true);
  game.activeCityManagementTab = 'buildings';
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'switchCityManagementTab', tab: 'military' });

  game.activeCityManagementTab = 'military';
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openArmyFormation', cityId: 'capital', slot: 1 });

  shell.armyFormationEditor = { open: true, cityId: 'capital', slot: 1, memberIds: [] };
  await controller.onArmyFormationOpened();
  assert.equal(controller.getCurrentStep(), TutorialGuideController.TUTORIAL_STEPS.formationPanelOpened);
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'toggleArmyFormationMember', personId: 'fp-scout' });

  // Middle branch: the scout is a member but has no soldiers drafted yet, so
  // the auto-replenish button is guided before saving.
  shell.armyFormationEditor.memberIds = ['fp-scout'];
  game.armyFormationEditor = shell.armyFormationEditor;
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'autoReplenishArmyFormation' });

  shell.armyFormationEditor.soldierDraftAssignments = { 'fp-scout': 1000 };
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'saveArmyFormation' });

  game.openBlockingPanelSnapshot('showCityManagement', true);
  shell.territoryUiState = {
    selectedSiteId: 'capital',
    worldMarchTarget: { q: 8, r: -3, pickerOpen: true },
    selectedWorldActorId: 'old-march',
  };
  game.territoryUiState = {
    selectedSiteId: 'capital',
    worldMarchTarget: { q: 8, r: -3, pickerOpen: true },
    selectedWorldActorId: 'old-march',
  };
  const handled = controller.onArmyFormationSaved({
    tutorial: {
      completed: false,
      currentStep: TutorialGuideController.TUTORIAL_STEPS.scoutFormationSaved,
      grants: { scoutFamousPerson: { personId: 'fp-scout' } },
    },
  });
  assert.equal(handled, true);
  assert.equal(game.isBlockingPanelSnapshotOpen('showCityManagement'), false);
  assert.equal(shell.isBlockingPanelSnapshotOpen('showCityManagement'), false);
  assert.equal(game.armyFormationEditor.open, false);
  assert.equal(shell.armyFormationEditor.open, false);
  assert.equal(game.mapHomeActive, true);
  assert.equal(shell.mapHomeActive, true);
  assert.equal(game.state.currentTab, 'military');
  assert.equal(game.state.militaryView, 'world');
  assert.equal(game.territoryUiState.selectedSiteId, '');
  assert.equal(game.territoryUiState.worldMarchTarget, null);
  assert.equal(game.territoryUiState.selectedWorldActorId, '');
  assert.equal(shell.territoryUiState.selectedSiteId, '');
  assert.equal(shell.territoryUiState.worldMarchTarget, null);
  assert.equal(shell.territoryUiState.selectedWorldActorId, '');
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'selectWorldMarchTarget' });
});

test('TutorialGuideController clears stale highlight when the next target is unavailable', () => {
  const calls = [];
  const shell = {
    getCanvasTarget() {
      return null;
    },
    hideTutorialHighlight() {
      calls.push(['hideTutorialHighlight']);
      return true;
    },
  };
  const game = {
    state: { currentTab: 'resources' },
    canvasShell: shell,
    renderCanvasSurface(tab) {
      calls.push(['renderCanvasSurface', tab]);
    },
  };
  const controller = new TutorialGuideController({ game });

  assert.equal(controller.showHighlight(
    'openCommandPanel',
    (action) => action.panel === 'military',
    'Missing target',
    { type: 'openCommandPanel', panel: 'military' },
  ), false);
  assert.deepEqual(calls, [
    ['renderCanvasSurface', 'resources'],
    ['hideTutorialHighlight'],
  ]);
});

test('TutorialGuideController guides scout formation into map march and claim', async () => {
  const calls = [];
  const territoryUiState = {};
  const shell = {
    activeCommandPanel: '',
    territoryUiState,
    getCanvasTarget(type, predicate) {
      const targets = {
        selectWorldMarchTarget: { type: 'selectWorldMarchTarget', targetQ: 2, targetR: -1 },
        openWorldMarchFormationPicker: { type: 'openWorldMarchFormationPicker', targetQ: 2, targetR: -1 },
        startWorldMarch: { type: 'startWorldMarch', formationSlot: 1, targetQ: 2, targetR: -1 },
        openWorldSite: { type: 'openWorldSite', siteId: 'site-1' },
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
    renderReadOnly(state, tab, options) {
      calls.push({ renderReadOnly: true, tab, options });
      return true;
    },
  };
  let targetPickerSnapshot = null;
  const game = {
    tutorial: { completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.scoutFormationSaved },
    state: {
      currentTab: 'resources',
      militaryView: 'world',
      worldExplorerState: {},
    },
    activeCommandPanel: '',
    territoryUiState,
    activeTab: 'resources',
    militaryView: 'world',
    mapHomeActive: false,
    canvasShell: shell,
    // Batch 8E: the formation-picker modal state lives in the owner snapshot.
    isTargetPickerSnapshotOpen() {
      return Boolean(targetPickerSnapshot);
    },
    getTargetPickerSnapshot() {
      return targetPickerSnapshot;
    },
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
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'selectWorldMarchTarget' });
  assert.equal(game.mapHomeActive, true);
  assert.equal(game.state.currentTab, 'military');

  game.territoryUiState.worldMarchTarget = { q: 2, r: -1, tileId: 'tile_2_-1' };
  shell.territoryUiState.worldMarchTarget = game.territoryUiState.worldMarchTarget;
  targetPickerSnapshot = null;
  await controller.onWorldMarchTargetSelected();
  assert.equal(controller.getCurrentStep(), TutorialGuideController.TUTORIAL_STEPS.scoutWorldPanelOpened);
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openWorldMarchFormationPicker' });

  game.territoryUiState.worldMarchTarget = { q: 2, r: -1, tileId: 'tile_2_-1' };
  shell.territoryUiState.worldMarchTarget = game.territoryUiState.worldMarchTarget;
  targetPickerSnapshot = { pickerKind: 'worldMarchFormation', target: game.territoryUiState.worldMarchTarget, visible: true };
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'startWorldMarch', formationSlot: 1 });

  controller.onExploreStarted({
    tutorial: { completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.scoutExploreStarted },
  });
  game.state.worldExplorerState = {
    activeMission: { id: 'explore-1', status: 'active', route: [{ revealed: false }] },
  };
  assert.equal(controller.refreshCurrentHighlight(), false);
  assert.equal(calls.some((call) => call.hideHighlight), true);

  controller.onExploreStarted({
    tutorial: {
      completed: false,
      currentStep: TutorialGuideController.TUTORIAL_STEPS.firstCityDiscovered,
      grants: { firstExploreEmptyCity: { siteId: 'site-1' } },
    },
  });
  assert.equal(controller.getCurrentStep(), TutorialGuideController.TUTORIAL_STEPS.firstCityDiscovered);
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openWorldSite', siteId: 'site-1' });
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
      currentStep: TutorialGuideController.TUTORIAL_STEPS.firstCityDiscovered,
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
    __namingSnapshot: null,
    getNamingSnapshot() {
      return this.__namingSnapshot;
    },
    getNamingInputValue() {
      return String(this.__namingSnapshot?.inputValue || '').trim();
    },
    openNamingSnapshot(payload) {
      this.__namingSnapshot = { ...(payload || {}), visible: true };
      return this.__namingSnapshot;
    },
    updateNamingSnapshot(patch) {
      this.__namingSnapshot = { ...(this.__namingSnapshot || {}), ...(patch || {}) };
      return this.__namingSnapshot;
    },
    renderCanvasSurface() {
      calls.push({ render: true });
    },
  };
  const controller = new TutorialGuideController({ game });
  controller.sync(game.tutorial);

  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openWorldSite', siteId });

  TerritoryUiStateStore.ensure(game).selectedSiteId = siteId;
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
  game.openNamingSnapshot({ prompt: { type: 'city', territoryId: siteId }, inputValue: '' });
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'requestNamingInput' });

  game.updateNamingSnapshot({ inputValue: 'River City' });
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'submitNaming' });

  controller.sync({ ...game.tutorial, currentStep: TutorialGuideController.TUTORIAL_STEPS.firstCityNamed });
  game.state.territoryState.namingPrompt = { type: 'polity' };
  game.openNamingSnapshot({ prompt: { type: 'polity' }, inputValue: '' });
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'requestNamingInput' });

  game.updateNamingSnapshot({ inputValue: 'River League' });
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
      currentStep: TutorialGuideController.TUTORIAL_STEPS.firstCityDiscovered,
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
  assert.equal(controller.focusedFirstCitySiteId, '');
});

test('TutorialGuideController highlights guided first city immediately after focus when visible', () => {
  const calls = [];
  const siteId = 'site_visible_after_focus';
  let centered = false;
  const shell = {
    runtime: { width: 420, height: 747 },
    actionController: {
      centerWorldMapOnSite(id) {
        calls.push(['center', id]);
        centered = true;
        return true;
      },
    },
    renderActive() {
      calls.push(['shellRender']);
    },
    getCanvasTarget() {
      return centered
        ? { x: 180, y: 320, width: 80, height: 80 }
        : { x: -220, y: 680, width: 80, height: 80 };
    },
    showTutorialHighlight(target, message, options) {
      calls.push(['highlight', options.allowedAction]);
      return true;
    },
  };
  const game = {
    tutorial: {
      completed: false,
      currentStep: TutorialGuideController.TUTORIAL_STEPS.firstCityDiscovered,
      grants: { firstExploreEmptyCity: { siteId } },
    },
    state: {
      currentTab: 'military',
      territoryState: {
        territories: [
          { id: siteId, status: 'discovered', owner: 'neutral', naturalName: 'Visible Site' },
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
  assert.deepEqual(calls.at(-1), ['highlight', { type: 'openWorldSite', siteId }]);
  assert.equal(controller.focusedFirstCitySiteId, siteId);
});

test('TutorialGuideController guides post-naming policy, manual talent, and famous seek systems', async () => {
  const calls = [];
  const shell = makeModalHost({
    activeCityManagementTab: '',
    resetLocalViewToResources() {
      calls.push({ resetResources: true });
      this.closeBlockingPanelSnapshot('activeCommandPanel');
    },
    getCanvasTarget(type, predicate) {
      const targets = {
        openCityManagement: { type: 'openCityManagement', tab: 'people' },
        switchCityManagementTab: { type: 'switchCityManagementTab', tab: 'people' },
        assignJob: [
          { type: 'assignJob', job: 'farmer', delta: 1, visualDisabled: true },
          { type: 'assignJob', job: 'scholar', delta: 1 },
        ],
        openFamousPersons: { type: 'openFamousPersons' },
        seekFamousPerson: { type: 'seekFamousPerson' },
      };
      const candidates = Array.isArray(targets[type]) ? targets[type] : [targets[type]];
      const action = candidates.find((item) => item && (!predicate || predicate(item)));
      if (!action) return null;
      return { x: 10, y: 20, width: 100, height: 30, action };
    },
    showTutorialHighlight(target, message, options) {
      calls.push({ target, message, options });
      return true;
    },
    hideTutorialHighlight() {
      calls.push({ hideHighlight: true });
      return true;
    },
  });
  const game = makeModalHost({
    tutorial: { completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.polityNamed },
    state: { currentTab: 'military' },
    activeCityManagementTab: '',
    applyApiState(result) {
      this.tutorial = result.tutorial;
      this.state.tutorial = result.tutorial;
    },
    renderCanvasSurface(tab) {
      calls.push({ render: tab });
    },
    getPanelSurfaceManager() {
      return {
        closePanel(panelKey, options) {
          calls.push({ closePanel: panelKey, render: options?.render });
          game.closeBlockingPanelSnapshot('showFamousPersons');
          shell.closeBlockingPanelSnapshot('showFamousPersons');
          return true;
        },
      };
    },
  });
  linkGameShell(game, shell);
  game.openBlockingPanelSnapshot('activeCommandPanel', 'military');
  const api = {
    async advanceTutorial(step) {
      calls.push({ advanceTutorial: step });
      return {
        tutorial: {
          completed: false,
          currentStep: step,
          phaseCompleted: { newbie: true, era2: true, scoutFormation: true },
        },
      };
    },
  };
  const controller = new TutorialGuideController({ game, api });
  controller.sync(game.tutorial);

  assert.equal(controller.canOpenTab('military'), true);
  assert.equal(controller.canOpenTab('resources'), false);
  assert.equal(controller.canOpenTab('tech'), false);
  assert.equal(controller.refreshCurrentHighlight(), false);
  await flushTutorialPromises();

  assert.equal(game.isBlockingPanelSnapshotOpen('showCityManagement'), true);
  assert.equal(shell.isBlockingPanelSnapshotOpen('showCityManagement'), true);
  assert.equal(game.activeCityManagementTab, 'people');
  assert.notEqual(shell.activeCityManagementTab, 'people');
  assert.equal(controller.getCurrentStep(), TutorialGuideController.TUTORIAL_STEPS.talentPolicyApplied);
  assert.equal(calls.some((call) => call.options?.allowedAction?.type === 'openCityManagement'), false);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'assignJob', job: 'scholar', delta: 1 });

  const manualTalentAssignedTutorial = {
    completed: false,
    currentStep: TutorialGuideController.TUTORIAL_STEPS.manualTalentAssigned,
  };
  game.state.tutorial = manualTalentAssignedTutorial;
  controller.onManualTalentAssigned({ tutorial: manualTalentAssignedTutorial });
  assert.equal(controller.canOpenTab('famousPersons'), true);
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'openFamousPersons' });

  game.openBlockingPanelSnapshot('showFamousPersons', true);
  await controller.onFamousPersonsOpened();
  assert.equal(controller.getCurrentStep(), TutorialGuideController.TUTORIAL_STEPS.famousSeekOpened);
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(calls.at(-1).options.allowedAction, { type: 'seekFamousPerson' });

  const famousSeekCompletedTutorial = {
    completed: false,
    currentStep: TutorialGuideController.TUTORIAL_STEPS.famousSeekCompleted,
  };
  game.state.tutorial = famousSeekCompletedTutorial;
  controller.onFamousPersonSought({ tutorial: famousSeekCompletedTutorial });
  assert.equal(game.isBlockingPanelSnapshotOpen('showFamousPersons'), false);
  assert.equal(shell.isBlockingPanelSnapshotOpen('showFamousPersons'), false);
  assert.deepEqual(
    calls.find((call) => call.closePanel === 'famousPersons'),
    { closePanel: 'famousPersons', render: true },
  );
  assert.equal(controller.canOpenTab('tech'), true);
  assert.equal(controller.canOpenTab('resources'), false);
});

test('TutorialGuideController keeps map home while opening city people guide directly', async () => {
  const calls = [];
  const shell = makeModalHost({
    mapHomeActive: true,
    renderReadOnly(state, tab, options) {
      calls.push(['renderReadOnly', tab, options]);
      this.mapHomeActive = Boolean(options?.forceMapHome);
      this.hitTargets = [
        { x: 300, y: 116, width: 58, height: 28, action: { type: 'assignJob', job: 'scholar', delta: 1 } },
      ];
      return true;
    },
    getCanvasTarget(type, predicate) {
      const target = (this.hitTargets || []).find((item) => (
        item.action?.type === type
        && (typeof predicate !== 'function' || predicate(item.action))
      ));
      return target ? { ...target, getRect: () => ({ left: target.x, top: target.y, width: target.width, height: target.height }) } : null;
    },
    showTutorialHighlight(target, message, options) {
      calls.push(['highlight', target.action, options]);
      return true;
    },
  });
  const game = makeModalHost({
    tutorial: { completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.polityNamed },
    state: { currentTab: 'military', militaryView: 'world' },
    activeTab: 'military',
    militaryView: 'world',
    mapHomeActive: true,
    resolveMapHomeViewState(state, options) {
      calls.push(['resolveMapHomeViewState', options]);
      return { activeTab: 'military', requestedTab: 'military', militaryView: 'world', isMapHome: true };
    },
  });
  linkGameShell(game, shell);
  game.openBlockingPanelSnapshot('activeCommandPanel', 'military');
  const controller = new TutorialGuideController({ game });
  controller.sync(game.tutorial);

  assert.equal(controller.refreshCurrentHighlight(), false);
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(game.mapHomeActive, true);
  assert.equal(shell.mapHomeActive, true);
  assert.equal(game.isBlockingPanelSnapshotOpen('showCityManagement'), true);
  assert.equal(shell.isBlockingPanelSnapshotOpen('showCityManagement'), true);
  assert.equal(game.activeCityManagementTab, 'people');
  assert.notEqual(shell.activeCityManagementTab, 'people');
  assert.equal(game.state.currentTab, 'military');
  assert.equal(game.state.militaryView, 'world');
  assert.deepEqual(
    calls.find((call) => call[0] === 'renderReadOnly'),
    ['renderReadOnly', 'military', { forceMapHome: true, isMapHome: true }],
  );
  assert.equal(calls.some((call) => call[0] === 'highlight' && call[1]?.type === 'openCityManagement'), false);
});

test('TutorialGuideController guides final tech explanation and completes tutorial on advisor close', async () => {
  const calls = [];
  const shell = makeModalHost({
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
  });
  const game = makeModalHost({
    tutorial: { completed: false, currentStep: TutorialGuideController.TUTORIAL_STEPS.famousSeekCompleted },
    state: { currentTab: 'military' },
    renderCanvasSurface(tab) {
      calls.push({ render: tab });
    },
    applyApiState(result) {
      this.tutorial = result.tutorial;
      this.state.tutorial = result.tutorial;
    },
  });
  linkGameShell(game, shell);
  game.openBlockingPanelSnapshot('showFamousPersons', true);
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
  assert.equal(game.isBlockingPanelSnapshotOpen('showFamousPersons'), false);

  game.openBlockingPanelSnapshot('activeCommandPanel', 'tech');
  await controller.onCommandPanelOpened('tech');
  assert.equal(controller.getCurrentStep(), TutorialGuideController.TUTORIAL_STEPS.finalTechOpened);
  assert.equal(game.isBlockingPanelSnapshotOpen('showAdvisor'), false);
  assert.equal(shell.isBlockingPanelSnapshotOpen('showAdvisor'), false);
  assert.equal(game.tutorialAdvisorDialogue.source, 'softGuide:tech-tree');
  assert.equal(shell.tutorialAdvisorDialogue, game.tutorialAdvisorDialogue);
  assert.equal(game.state.softGuide.target, 'tech-tree');
  assert.equal(game.tutorialAdvisorDialogue.message, game.state.softGuide.message);

  await controller.onAdvisorClosed();

  assert.equal(controller.isCompleted(), true);
  assert.equal(game.tutorial.currentStep, TutorialGuideController.TUTORIAL_STEPS.completed);
  assert.equal(game.tutorial.completed, true);
  assert.equal(game.state.softGuide, null);
  assert.equal(controller.canOpenTab('military'), true);
  assert.deepEqual(
    calls.filter((call) => call.advanceTutorial).map((call) => call.advanceTutorial),
    [
      TutorialGuideController.TUTORIAL_STEPS.finalTechOpened,
      TutorialGuideController.TUTORIAL_STEPS.completed,
    ],
  );
});
