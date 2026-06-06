const test = require('node:test');
const assert = require('node:assert/strict');

const GameCommandService = require('./GameCommandService');
const CanvasGameApp = require('./CanvasGameApp');
const UIStatePresenter = require('../state/UIStatePresenter');
const TutorialGuideController = require('../tutorial/TutorialGuideController');

function createCommandHost(api) {
  const calls = [];
  const host = {
    api,
    state: { activeCityId: 'capital', currentTab: 'resources', techUiState: { detailOpen: true } },
    canvasShell: {},
    pendingBuildingAction: null,
    closeCitySwitcher(options) {
      calls.push(['closeCitySwitcher', options]);
    },
    setPendingBuildingAction(pending) {
      this.pendingBuildingAction = pending;
      calls.push(['setPendingBuildingAction', pending]);
    },
    applyApiState(result) {
      calls.push(['applyApiState', result]);
      if (result?.gameState) this.state = result.gameState;
    },
    showFloatingText(message) {
      calls.push(['showFloatingText', message]);
    },
    log(message) {
      calls.push(['log', message]);
    },
    renderCanvasSurface(tab) {
      calls.push(['renderCanvasSurface', tab]);
    },
    getGameApi() {
      return this.api;
    },
  };
  return { host, calls };
}

test('GameCommandService runs build and upgrade commands through API and applies state', async () => {
  const apiCalls = [];
  const api = {
    async build(buildingId) {
      apiCalls.push(['build', buildingId]);
      return { message: 'built' };
    },
    async upgrade(buildingId) {
      apiCalls.push(['upgrade', buildingId]);
      return { message: 'upgraded' };
    },
  };
  const { host, calls } = createCommandHost(api);
  const service = new GameCommandService({ host });

  assert.equal(await service.buildBuilding('farm'), true);
  assert.equal(await service.upgradeBuilding('house'), true);

  assert.deepEqual(apiCalls, [['build', 'farm'], ['upgrade', 'house']]);
  assert.equal(calls.filter(([name]) => name === 'applyApiState').length, 2);
  assert.deepEqual(host.pendingBuildingAction, null);
  assert.deepEqual(calls.filter(([name]) => name === 'setPendingBuildingAction').map(([, pending]) => pending), [
    { buildingId: 'farm', action: 'build' },
    null,
    { buildingId: 'house', action: 'upgrade' },
    null,
  ]);
});

test('GameCommandService research applies API state and keeps selected tech UI state', async () => {
  const api = {
    async research(techId) {
      return { message: `researched ${techId}`, gameState: { currentTab: 'tech', techUiState: { detailOpen: true } } };
    },
  };
  const { host, calls } = createCommandHost(api);
  const service = new GameCommandService({ host });

  assert.equal(await service.research('writing'), true);

  assert.equal(host.state.techUiState.selectedTechId, 'writing');
  assert.equal(host.state.techUiState.detailOpen, false);
  assert.equal(host.canvasShell.selectedTechId, 'writing');
  assert.equal(host.canvasShell.techDetailOpen, false);
  assert.deepEqual(calls.find(([name]) => name === 'showFloatingText'), ['showFloatingText', 'researched writing']);
});

test('GameCommandService blocks non-house building during tutorial house guide', async () => {
  const apiCalls = [];
  const api = {
    async build(buildingId) {
      apiCalls.push(buildingId);
      return { message: 'built' };
    },
  };
  const { host, calls } = createCommandHost(api);
  host.tutorialController = {
    onBuildingAction(buildingId) {
      return buildingId === 'house';
    },
    refreshCurrentHighlight() {
      calls.push(['refreshCurrentHighlight']);
    },
  };
  const service = new GameCommandService({ host });

  assert.equal(await service.buildBuilding('farm'), false);
  assert.deepEqual(apiCalls, []);
  assert.deepEqual(calls.filter(([name]) => name === 'refreshCurrentHighlight'), [['refreshCurrentHighlight']]);
});

test('GameCommandService switchCity closes picker, calls API, and applies state', async () => {
  const apiCalls = [];
  const api = {
    async switchCity(cityId) {
      apiCalls.push(cityId);
      return { message: `switched ${cityId}`, gameState: { activeCityId: cityId, currentTab: 'resources' } };
    },
  };
  const { host, calls } = createCommandHost(api);
  const service = new GameCommandService({ host });

  assert.equal(await service.switchCity('harbor'), true);
  assert.deepEqual(apiCalls, ['harbor']);
  assert.deepEqual(calls[0], ['closeCitySwitcher', { skipRender: true }]);
  assert.deepEqual(calls.find(([name]) => name === 'applyApiState'), [
    'applyApiState',
    { message: 'switched harbor', gameState: { activeCityId: 'harbor', currentTab: 'resources' } },
  ]);
});

test('CanvasGameApp keeps command facades and delegates to command service', async () => {
  const calls = [];
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    commandService: {
      host: null,
      buildBuilding(buildingId) {
        calls.push(['buildBuilding', buildingId, this.host]);
        return 'build-result';
      },
      upgradeBuilding(buildingId) {
        calls.push(['upgradeBuilding', buildingId, this.host]);
        return 'upgrade-result';
      },
      research(techId) {
        calls.push(['research', techId, this.host]);
        return 'research-result';
      },
      switchCity(cityId) {
        calls.push(['switchCity', cityId, this.host]);
        return 'switch-result';
      },
    },
  });

  assert.equal(await app.buildBuilding('farm'), 'build-result');
  assert.equal(await app.upgradeBuilding('house'), 'upgrade-result');
  assert.equal(await app.research('writing'), 'research-result');
  assert.equal(await app.switchCity('harbor'), 'switch-result');
  assert.deepEqual(calls.map(([name, id]) => [name, id]), [
    ['buildBuilding', 'farm'],
    ['upgradeBuilding', 'house'],
    ['research', 'writing'],
    ['switchCity', 'harbor'],
  ]);
  assert.equal(calls.every(([, , host]) => host === app), true);
});

test('CanvasGameApp advanceEra returns true after applying successful API state', async () => {
  const calls = [];
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    initialState: {
      currentTab: 'military',
      currentEra: 0,
      isCapitalCity: true,
      eraProgress: { canAdvance: true },
    },
    presenter: {
      buildCivilizationViewState() {
        return { advanceButton: { canAdvance: true } };
      },
    },
    api: {
      async advanceEra() {
        calls.push(['advanceEra']);
        return {
          success: true,
          message: '进入农耕时代',
          gameState: {
            currentTab: 'military',
            currentEra: 1,
            isCapitalCity: true,
            eraProgress: { canAdvance: false },
          },
          tutorial: { completed: false, currentStep: 6 },
        };
      },
    },
    tutorialController: {
      sync(tutorial) {
        calls.push(['sync', tutorial.currentStep]);
      },
      onEraAdvanced(result) {
        calls.push(['onEraAdvanced', result.tutorial.currentStep]);
      },
    },
  });
  app.showFloatingText = (message) => calls.push(['showFloatingText', message]);
  app.log = (message) => calls.push(['log', message]);
  app.renderMilitary = () => calls.push(['renderMilitary']);
  app.render = () => calls.push(['render']);

  assert.equal(await app.advanceEra(), true);
  assert.equal(app.state.currentEra, 1);
  assert.deepEqual(calls.filter(([name]) => ['advanceEra', 'onEraAdvanced', 'showFloatingText'].includes(name)), [
    ['advanceEra'],
    ['onEraAdvanced', 6],
    ['showFloatingText', '进入农耕时代'],
  ]);
});

test('CanvasGameApp can advance era two when farm completion is promoted to era guide step', async () => {
  const calls = [];
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    presenter: UIStatePresenter,
    initialState: {
      currentTab: 'military',
      currentEra: 1,
      isCapitalCity: true,
      resources: { food: 132, knowledge: 10, wood: 0 },
      buildings: { house: { level: 1 }, farm: { level: 1 } },
      population: { total: 3 },
      eraProgress: {
        canAdvance: true,
        percentage: 100,
        conditions: [],
      },
      tutorial: { completed: false, currentStep: 9, phaseCompleted: { newbie: true, era2: false } },
    },
    api: {
      async advanceEra() {
        calls.push(['advanceEra']);
        return {
          success: true,
          message: '进入聚落时代',
          gameState: {
            currentTab: 'military',
            currentEra: 2,
            isCapitalCity: true,
            resources: { food: 12, knowledge: 5, wood: 0 },
            buildings: { house: { level: 1 }, farm: { level: 1 } },
            eraProgress: { canAdvance: false, percentage: 0, conditions: [] },
          },
          tutorial: { completed: false, currentStep: 11, phaseCompleted: { newbie: true, era2: false } },
        };
      },
    },
    tutorialController: {
      sync(tutorial) {
        calls.push(['sync', tutorial.currentStep]);
      },
      onEraAdvanced(result) {
        calls.push(['onEraAdvanced', result.tutorial.currentStep]);
      },
    },
  });
  app.tutorial = { completed: false, currentStep: 9, phaseCompleted: { newbie: true, era2: false } };
  app.showFloatingText = (message) => calls.push(['showFloatingText', message]);
  app.log = (message) => calls.push(['log', message]);
  app.renderMilitary = () => calls.push(['renderMilitary']);
  app.render = () => calls.push(['render']);

  assert.equal(app.canAdvanceEraNow(), true);
  assert.equal(await app.advanceEra(), true);
  assert.equal(app.state.currentEra, 2);
  assert.equal(app.tutorial.currentStep, 11);
  assert.deepEqual(calls.filter(([name]) => ['advanceEra', 'onEraAdvanced', 'showFloatingText'].includes(name)), [
    ['advanceEra'],
    ['onEraAdvanced', 11],
    ['showFloatingText', '进入聚落时代'],
  ]);
});

test('CanvasGameApp advisor task target opens task center and refreshes tutorial highlight', () => {
  const calls = [];
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    initialState: { currentTab: 'resources', softGuide: null },
    actionController: {
      handle_openTaskCenter(action) {
        calls.push(['handle_openTaskCenter', action]);
        app.showTaskCenter = true;
        app.activeTaskCenterTab = action.tab;
        return true;
      },
    },
    tutorialController: {
      refreshCurrentHighlight() {
        calls.push(['refreshCurrentHighlight']);
        return true;
      },
    },
  });
  app.showAdvisor = true;
  app.canvasShell = {
    showAdvisor: true,
    hideTutorialHighlight() {
      calls.push(['hideTutorialHighlight']);
      return true;
    },
    actionController: {
      handle_openTaskCenter(action) {
        calls.push(['shell_handle_openTaskCenter', action]);
        app.showTaskCenter = true;
        app.activeTaskCenterTab = action.tab;
        app.canvasShell.showTaskCenter = true;
        app.canvasShell.activeTaskCenterTab = action.tab;
        return true;
      },
    },
  };
  app.activeAdvisor = { target: 'task-center-button' };

  assert.equal(app.goToAdvisorTarget(), true);
  assert.equal(app.showAdvisor, false);
  assert.equal(app.canvasShell.showAdvisor, false);
  assert.equal(app.showTaskCenter, true);
  assert.equal(app.canvasShell.showTaskCenter, true);
  assert.equal(app.activeTaskCenterTab, 'main');
  assert.deepEqual(calls.map(([name]) => name), ['hideTutorialHighlight', 'shell_handle_openTaskCenter', 'refreshCurrentHighlight']);
});

test('CanvasGameApp shows tutorial spine advisor dialogue after first house build', () => {
  const calls = [];
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    initialState: { currentTab: 'buildings', softGuide: null },
  });
  app.tutorial = {
    completed: false,
    currentStep: TutorialGuideController.TUTORIAL_STEPS.houseBuilt,
  };
  app.tutorialController = new TutorialGuideController({ game: app });
  app.canvasShell = {};
  app.renderCanvasSurface = (tab) => calls.push(['renderCanvasSurface', tab]);

  assert.equal(app.maybeShowHouseBuiltAdvisor('build', 'house'), true);

  assert.equal(app.showAdvisor, false);
  assert.equal(app.tutorialAdvisorDialogue.source, 'houseBuilt');
  assert.equal(app.tutorialAdvisorDialogue.advisorName, '谋士');
  assert.match(app.tutorialAdvisorDialogue.message, /民居已经建立起来/);
  assert.equal(app.canvasShell.tutorialAdvisorDialogue, app.tutorialAdvisorDialogue);
  assert.equal(app.state.softGuide.target, 'tab-civilization');
  assert.deepEqual(calls, [['renderCanvasSurface', 'buildings']]);
});

test('CanvasGameApp openNaming syncs shell naming before delayed tutorial highlight refresh', () => {
  const calls = [];
  const timers = [];
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    presenter: {
      buildNamingPromptViewState(prompt) {
        return {
          key: `${prompt.type}:${prompt.territoryId || 'polity'}`,
          title: prompt.title || 'Name',
          message: prompt.message || '',
          placeholder: 'Name',
          maxLength: 12,
        };
      },
    },
    scheduler: {
      setTimeout(callback, delayMs) {
        calls.push(['setTimeout', delayMs]);
        timers.push(callback);
        return 1;
      },
    },
    tutorialController: {
      refreshCurrentHighlight() {
        calls.push(['refreshCurrentHighlight']);
        return true;
      },
    },
  });
  app.canvasShell = { naming: { visible: false } };
  app.render = () => calls.push(['render']);

  app.openNaming({ type: 'city', territoryId: 'site_1' });

  assert.equal(app.naming.visible, true);
  assert.equal(app.naming.prompt.territoryId, 'site_1');
  assert.equal(app.canvasShell.naming, app.naming);
  assert.deepEqual(calls, [['render'], ['setTimeout', 80]]);

  timers[0]();
  assert.deepEqual(calls.at(-1), ['refreshCurrentHighlight']);
});
