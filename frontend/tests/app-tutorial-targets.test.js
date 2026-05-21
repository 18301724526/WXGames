const test = require('node:test');
const assert = require('node:assert/strict');

function createWindowStub() {
  return {
    UIStatePresenter: require('../js/state/UIStatePresenter'),
    GameConfig: {
      API_BASE: '/api',
      SYNC_INTERVAL_MS: 2000,
      UPDATE_CHECK_INTERVAL_MS: 30000,
      TUTORIAL_WAIT_SYNC_INTERVAL_MS: 500,
      TUTORIAL_START_DELAY_MS: 0,
      BUILDINGS: {},
      ERAS: [],
    },
    FrontendGameState: require('../js/domain/GameState'),
    GameAPI: class {},
    GameStateSync: class {},
    UpdateChecker: class {
      start() {}
      stop() {}
    },
    GameStateManager: class {},
    TutorialCanvasRenderer: class {},
    TutorialController: class {},
    EventController: class {},
    BuildingController: class {},
    H5GameBootstrap: {
      mount(Game, options = {}) {
        const runtime = options.runtime || global.window;
        runtime.Game = Game;
        Game.config = runtime.GameConfig;
        Game.presenter = runtime.UIStatePresenter;
        Game.runtimeConstructors = {
          GameAPI: runtime.GameAPI,
          GameStateSync: runtime.GameStateSync,
          UpdateChecker: runtime.UpdateChecker,
          GameStateManager: runtime.GameStateManager,
          TutorialController: runtime.TutorialController,
          EventController: runtime.EventController,
          BuildingController: runtime.BuildingController,
          TerritoryController: runtime.TerritoryController,
        };
        Game.stateNormalizer = runtime.FrontendGameState;
      },
    },
  };
}

test('app maps tutorial highlight targets from Canvas hit regions only', () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalLocalStorage = global.localStorage;

  try {
    const elements = new Map();
    global.window = createWindowStub();
    global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    global.document = {
      addEventListener() {},
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, { id });
        return elements.get(id);
      },
    };

    delete require.cache[require.resolve('../app')];
    require('../app');
    const canvasAdvanceTarget = { getBoundingClientRect() { return { left: 20, top: 30, width: 120, height: 40, right: 140, bottom: 70 }; } };
    const canvasTabTarget = { x: 10, y: 790, width: 60, height: 58 };
    const canvasFarmTarget = { x: 290, y: 252, width: 78, height: 34 };
    const canvasCraftsmanTarget = { x: 346, y: 512, width: 22, height: 22 };
    const canvasEventTarget = { x: 24, y: 164, width: 342, height: 78 };
    const canvasClaimTarget = { x: 36, y: 446, width: 318, height: 92 };
    global.window.Game.canvasShell = {
      getTutorialTarget: (key) => {
        if (key === 'btn-advance-era') return canvasAdvanceTarget;
        if (key === 'tab-civilization') return canvasTabTarget;
        if (key === 'card-farm') return canvasFarmTarget;
        if (key === 'card-craftsman') return canvasCraftsmanTarget;
        if (key === 'event-card-special') return canvasEventTarget;
        if (key === 'btn-claim-event') return canvasClaimTarget;
        return null;
      },
    };
    assert.equal(global.window.Game.getTutorialTarget('btn-advance-era'), canvasAdvanceTarget);
    assert.equal(global.window.Game.getTutorialTarget('tab-civilization'), canvasTabTarget);
    assert.equal(global.window.Game.getTutorialTarget('tab-resources'), null);
    assert.equal(global.window.Game.getTutorialTarget('card-farm'), canvasFarmTarget);
    assert.equal(global.window.Game.getTutorialTarget('card-house'), null);
    assert.equal(global.window.Game.getTutorialTarget('card-lumbermill'), null);
    assert.equal(global.window.Game.getTutorialTarget('card-craftsman'), canvasCraftsmanTarget);
    assert.equal(global.window.Game.getTutorialTarget('event-card-special'), canvasEventTarget);
    assert.equal(global.window.Game.getTutorialTarget('btn-claim-event'), canvasClaimTarget);
    assert.equal(elements.size, 0);
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    global.localStorage = originalLocalStorage;
  }
});

test('app uses faster polling while waiting for era2 readiness', () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalLocalStorage = global.localStorage;

  try {
    global.window = createWindowStub();
    global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    global.document = {
      addEventListener() {},
      getElementById(id) {
        return { id };
      },
    };

    delete require.cache[require.resolve('../app')];
    require('../app');

    const { Game } = global.window;
    Game.tutorial = { completed: false, currentStep: 0 };
    Game.tutorialController = { state: { completed: false, currentStep: 8 } };
    assert.equal(Game.getSyncInterval(), 500);

    Game.tutorialController.state.currentStep = 9;
    assert.equal(Game.getSyncInterval(), 2000);

    const intervals = [];
    Game.tutorialController.state.currentStep = 8;
    Game.syncService = { setIntervalMs(intervalMs) { intervals.push(intervalMs); } };
    Game.updateSyncInterval();
    assert.deepEqual(intervals, [500]);
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    global.localStorage = originalLocalStorage;
  }
});

test('app uses injected scheduler for scout countdown timer', () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalLocalStorage = global.localStorage;

  try {
    global.window = createWindowStub();
    global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    global.document = {
      addEventListener() {},
      getElementById(id) {
        return { id };
      },
    };

    delete require.cache[require.resolve('../app')];
    require('../app');

    const scheduled = [];
    const cleared = [];
    const { Game } = global.window;
    Game.scheduler = {
      setInterval(callback, intervalMs) {
        const timer = { callback, intervalMs };
        scheduled.push(timer);
        return timer;
      },
      clearInterval(timer) {
        cleared.push(timer);
      },
    };
    Game.syncService = { stop() {} };
    Game.updateChecker = { stop() {} };

    Game.startScoutCountdownTimer();
    assert.equal(scheduled.length, 1);
    assert.equal(scheduled[0].intervalMs, 1000);
    assert.equal(Game.scoutCountdownTimer, scheduled[0]);

    Game.stopHeartbeat();
    assert.deepEqual(cleared, [scheduled[0]]);
    assert.equal(Game.scoutCountdownTimer, null);
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    global.localStorage = originalLocalStorage;
  }
});

test('era advance Canvas state stays locked until tutorial unlocks the advance step', () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalLocalStorage = global.localStorage;

  try {
    global.window = createWindowStub();
    global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    global.document = { addEventListener() {}, getElementById(id) { return { id }; } };

    delete require.cache[require.resolve('../app')];
    require('../app');

    const { Game } = global.window;
    Game.state = {
      currentEra: 1,
      currentEraName: '????',
      gameDay: 1,
      population: { total: 4 },
      totalBuildings: 2,
      techs: {},
      happiness: 100,
      eraProgress: {
        percentage: 100,
        canAdvance: true,
        targetEraName: '????',
        conditions: [],
      },
    };
    Game.tutorialController = {
      state: { completed: false, currentStep: 8 },
      canOpenTab(tabId) { return tabId === 'civilization'; },
    };

    let view = Game.presenter.buildCivilizationViewState(
      Game.state,
      Game.tutorialController.state,
      { canOpenCivilizationTab: Game.tutorialController.canOpenTab('civilization') },
    );
    assert.equal(view.advanceButton.disabled, true);
    const lockedLabel = view.text.advanceLabel;
    assert.ok(lockedLabel.length > 0);

    Game.tutorialController.state.currentStep = 9;
    view = Game.presenter.buildCivilizationViewState(
      Game.state,
      Game.tutorialController.state,
      { canOpenCivilizationTab: Game.tutorialController.canOpenTab('civilization') },
    );
    assert.equal(view.advanceButton.disabled, false);
    assert.ok(view.text.advanceLabel.length > 0);
    assert.notEqual(view.text.advanceLabel, lockedLabel);
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    global.localStorage = originalLocalStorage;
  }
});

test('subcity keeps Canvas era advance disabled even when conditions are met', () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalLocalStorage = global.localStorage;

  try {
    global.window = createWindowStub();
    global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    global.document = { addEventListener() {}, getElementById(id) { return { id }; } };

    delete require.cache[require.resolve('../app')];
    require('../app');

    const { Game } = global.window;
    Game.state = {
      currentEra: 5,
      currentEraName: '????',
      gameDay: 1,
      population: { total: 4 },
      totalBuildings: 1,
      techs: {},
      happiness: 100,
      isCapitalCity: false,
      eraProgress: {
        percentage: 100,
        canAdvance: true,
        targetEraName: '????',
        conditions: [],
      },
    };
    Game.tutorialController = {
      state: { completed: true, currentStep: 99 },
      canOpenTab() { return true; },
    };

    const view = Game.presenter.buildCivilizationViewState(Game.state, Game.tutorialController.state, { canOpenCivilizationTab: true });

    assert.equal(Game.canAdvanceEraNow(), false);
    assert.equal(view.advanceButton.disabled, true);
    assert.ok(view.text.advanceLabel.length > 0);
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    global.localStorage = originalLocalStorage;
  }
});

test('advanceEra does not call the API before tutorial unlocks the advance step', async () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalLocalStorage = global.localStorage;

  try {
    const elements = new Map();
    global.window = createWindowStub();
    global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    global.document = {
      addEventListener() {},
      getElementById(id) {
        if (!elements.has(id)) {
          elements.set(id, { id, style: {}, textContent: '', innerHTML: '', disabled: false });
        }
        return elements.get(id);
      },
    };

    delete require.cache[require.resolve('../app')];
    require('../app');

    const { Game } = global.window;
    let called = false;
    const logs = [];
    Game.gameAPI = {
      async advanceEra() {
        called = true;
        return {};
      },
    };
    Game.log = (message) => logs.push(message);
    Game.state = {
      currentEra: 1,
      currentEraName: '农耕时代',
      gameDay: 1,
      population: { total: 4 },
      totalBuildings: 2,
      techs: {},
      happiness: 100,
      eraProgress: {
        percentage: 100,
        canAdvance: true,
        targetEraName: '聚落时代',
        conditions: [],
      },
    };
    Game.tutorialController = {
      state: { completed: false, currentStep: 8 },
      canOpenTab(tabId) { return tabId === 'civilization'; },
    };

    await Game.advanceEra();

    assert.equal(called, false);
    assert.deepEqual(logs, ['引导未解锁，先完成当前引导']);
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    global.localStorage = originalLocalStorage;
  }
});

test('initial Canvas era advance also stays locked before the tutorial reaches the advance step', () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalLocalStorage = global.localStorage;

  try {
    global.window = createWindowStub();
    global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    global.document = { addEventListener() {}, getElementById(id) { return { id }; } };

    delete require.cache[require.resolve('../app')];
    require('../app');

    const { Game } = global.window;
    Game.state = {
      currentEra: 0,
      currentEraName: '????',
      gameDay: 1,
      population: { total: 3 },
      totalBuildings: 0,
      techs: {},
      happiness: 100,
      eraProgress: {
        percentage: 100,
        canAdvance: true,
        targetEraName: '????',
        conditions: [],
      },
    };
    Game.tutorialController = {
      state: { completed: false, currentStep: 1 },
      canOpenTab(tabId) { return tabId === 'civilization'; },
    };

    let view = Game.presenter.buildCivilizationViewState(
      Game.state,
      Game.tutorialController.state,
      { canOpenCivilizationTab: Game.tutorialController.canOpenTab('civilization') },
    );
    assert.equal(view.advanceButton.disabled, true);
    const lockedLabel = view.text.advanceLabel;
    assert.ok(lockedLabel.length > 0);

    Game.tutorialController.state.currentStep = 2;
    view = Game.presenter.buildCivilizationViewState(
      Game.state,
      Game.tutorialController.state,
      { canOpenCivilizationTab: Game.tutorialController.canOpenTab('civilization') },
    );
    assert.equal(view.advanceButton.disabled, false);
    assert.ok(view.text.advanceLabel.length > 0);
    assert.notEqual(view.text.advanceLabel, lockedLabel);
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    global.localStorage = originalLocalStorage;
  }
});

test('syncFromServer locally promotes step8 to step9 when era2 resource requirements are already met', () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalLocalStorage = global.localStorage;

  try {
    global.window = createWindowStub();
    global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    global.document = {
      addEventListener() {},
      getElementById(id) {
        return { id, style: {}, textContent: '', innerHTML: '', disabled: false };
      },
    };

    delete require.cache[require.resolve('../app')];
    require('../app');

    const { Game } = global.window;
    let tutorialState = null;
    Game.stateManager = {
      sync(serverState, eraProgress) {
        return {
          ...serverState,
          eraProgress,
          currentTab: 'resources',
        };
      },
    };
    Game.tutorialController = {
      state: { completed: false, currentStep: 8 },
      setState(tutorial) {
        tutorialState = tutorial;
        this.state = tutorial;
      },
      canOpenTab() {
        return true;
      },
      render() {},
    };
    Game.syncService = { setIntervalMs() {} };
    Game.render = () => {};

    Game.syncFromServer(
      {
        currentEra: 1,
        buildings: { house: { level: 1 } },
        population: { total: 3 },
      },
      { completed: false, currentStep: 8, phaseCompleted: { newbie: true, era2: false } },
      { percentage: 100, canAdvance: true, conditions: [] },
    );

    assert.equal(tutorialState.currentStep, 9);
    assert.equal(tutorialState.phaseCompleted.newbie, true);
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    global.localStorage = originalLocalStorage;
  }
});

test('renderMilitary refreshes Canvas military state from backend-provided data', () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalLocalStorage = global.localStorage;

  try {
    global.window = createWindowStub();
    global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    global.document = {
      addEventListener() {},
      getElementById(id) {
        return { id };
      },
    };
    delete require.cache[require.resolve('../app')];
    require('../app');

    const { Game } = global.window;
    Game.state = {
      currentEra: 3,
      currentEraName: '城邦时代',
      currentEraDescription: '城邦时代',
      gameDay: 1,
      population: { total: 6 },
      totalBuildings: 4,
      techs: {},
      happiness: 100,
      eraProgress: {
        percentage: 0,
        canAdvance: false,
        targetEraName: '时代未开放',
        conditions: [],
      },
      military: {
        soldiers: 2,
        soldierCap: 5,
        trainingProgress: 15,
        trainingIntervalSeconds: 30,
        defense: 2,
      },
      buildingEffects: {
        threatDefense: 2,
      },
    };
    Game.tutorialController = {
      state: { completed: true, currentStep: 99 },
      canOpenTab() { return true; },
    };
    const renderCalls = [];
    Game.canvasShell = {
      renderReadOnly(state, tab) {
        renderCalls.push({ state, tab });
      },
    };

    Game.renderMilitary();

    const view = Game.presenter.buildMilitaryViewState(Game.state);
    assert.equal(view.text.soldierCount, '2/5');
    assert.equal(view.text.militaryDefense, 4);
    assert.equal(view.text.soldierTrainingText, '下一名 15/30 秒');
    assert.equal(view.training.progressWidth, '50%');
    assert.deepEqual(renderCalls, [{ state: Game.state, tab: Game.state.currentTab }]);
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    global.localStorage = originalLocalStorage;
  }
});

test('soft guide does not repeatedly force the military sub view after manual selection', () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalLocalStorage = global.localStorage;

  try {
    global.window = createWindowStub();
    global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    global.document = {
      addEventListener() {},
      getElementById(id) {
        return { id };
      },
    };

    delete require.cache[require.resolve('../app')];
    require('../app');

    const { Game } = global.window;
    Game.state.currentTab = 'military';
    Game.state.militaryView = 'world';
    Game.state.softGuide = {
      target: 'tab-military',
      message: '派出侦察队探索城市之外的世界。',
    };
    Game.tutorialController = {
      state: { completed: true, currentStep: 99 },
    };
    Game.tutorialRenderer = {
      showSoft() {},
    };
    Game.switchMilitaryView = () => {
      throw new Error('renderSoftGuide should not force a military sub view');
    };

    Game.renderSoftGuide();

    assert.equal(Game.state.militaryView, 'world');
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    global.localStorage = originalLocalStorage;
  }
});

test('renderSoftGuide exposes backend advice through the advisor panel', () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalLocalStorage = global.localStorage;

  try {
    const elements = new Map();
    function getElement(id) {
      if (!elements.has(id)) {
        elements.set(id, {
          id,
          hidden: false,
          disabled: false,
          textContent: '',
          classList: {
            values: new Set(),
            add(value) { this.values.add(value); },
            remove(value) { this.values.delete(value); },
            contains(value) { return this.values.has(value); },
          },
        });
      }
      return elements.get(id);
    }

    global.window = createWindowStub();
    global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    global.document = {
      addEventListener() {},
      getElementById: getElement,
    };

    delete require.cache[require.resolve('../app')];
    require('../app');

    const { Game } = global.window;
    Game.state.softGuide = {
      target: 'tab-military',
      message: '派出侦察队探索城市之外的世界。',
    };
    Game.tutorialController = {
      state: { completed: true, currentStep: 99 },
    };

    Game.renderSoftGuide();

    assert.equal(Game.activeAdvisor.message, '派出侦察队探索城市之外的世界。');
    assert.equal(elements.has('advisorBtn'), false);
    assert.equal(elements.has('advisorModal'), false);

    const switched = [];
    Game.switchTab = (tabId) => switched.push(tabId);
    Game.goToAdvisorTarget();

    assert.deepEqual(switched, ['military']);
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    global.localStorage = originalLocalStorage;
  }
});

test('military scout and world subviews stay disabled before classical era', () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalLocalStorage = global.localStorage;

  try {
    global.window = createWindowStub();
    global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    global.document = {
      addEventListener() {},
      getElementById(id) {
        return { id };
      },
    };

    delete require.cache[require.resolve('../app')];
    require('../app');

    const { Game } = global.window;
    Game.state.currentEra = 4;
    Game.state.militaryView = 'world';

    Game.renderMilitaryView();

    const nav = Game.presenter.buildMilitaryNavigationViewState(Game.state);
    assert.equal(Game.state.militaryView, 'army');
    assert.equal(nav.views.find((view) => view.id === 'army').disabled, false);
    assert.equal(nav.views.find((view) => view.id === 'scout').disabled, true);
    assert.equal(nav.views.find((view) => view.id === 'world').disabled, true);
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    global.localStorage = originalLocalStorage;
  }
});

test('Canvas scout controls show countdown and lock other directions while one scout is active', () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalLocalStorage = global.localStorage;
  const originalNow = Date.now;

  try {
    Date.now = () => new Date('2026-05-17T08:00:30.000Z').getTime();
    global.window = createWindowStub();
    global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    global.document = {
      addEventListener() {},
      getElementById(id) {
        return { id };
      },
    };

    delete require.cache[require.resolve('../app')];
    require('../app');

    const { Game } = global.window;
    Game.state.currentEra = 5;
    Game.state.territoryState = {
      directions: [
        { id: 'n', label: '北方' },
        { id: 'ne', label: '东北' },
        { id: 'e', label: '东方' },
        { id: 'se', label: '东南' },
        { id: 's', label: '南方' },
        { id: 'sw', label: '西南' },
        { id: 'w', label: '西方' },
        { id: 'nw', label: '西北' },
      ],
      scoutMissions: [{
        id: 'scout_n_1',
        kind: 'scout',
        direction: 'n',
        startedAt: '2026-05-17T08:00:00.000Z',
        completesAt: '2026-05-17T08:01:00.000Z',
        status: 'active',
      }],
    };

    const view = Game.presenter.buildScoutControlViewState(Game.state);
    const north = view.cells.find((cell) => cell.id === 'n');
    const east = view.cells.find((cell) => cell.id === 'e');

    assert.match(view.statusText, /北方侦察中，预计 0:30 后返回/);
    assert.equal(north.direction, 'n');
    assert.equal(north.status, 'active');
    assert.equal(north.actionText, '0:30');
    assert.equal(north.disabled, true);
    assert.equal(east.direction, 'e');
    assert.equal(east.status, 'locked');
    assert.equal(east.action, '');
  } finally {
    Date.now = originalNow;
    global.window = originalWindow;
    global.document = originalDocument;
    global.localStorage = originalLocalStorage;
  }
});
