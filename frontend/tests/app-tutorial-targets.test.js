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
    GameAPI: class {},
    GameStateSync: class {},
    UpdateChecker: class {
      start() {}
      stop() {}
    },
    GameStateManager: class {},
    ResourceRenderer: class {},
    BuildingUIRenderer: class {},
    EventUIRenderer: class {},
    TutorialUIRenderer: class {},
    TutorialController: class {},
    EventController: class {},
    BuildingController: class {},
    AdvisorPanelAdapter: require('../js/ui/AdvisorPanelAdapter'),
    NamingModalAdapter: require('../js/ui/NamingModalAdapter'),
    NavigationShellAdapter: require('../js/ui/NavigationShellAdapter'),
    CivilizationPanelAdapter: require('../js/ui/CivilizationPanelAdapter'),
    MilitaryPanelAdapter: require('../js/ui/MilitaryPanelAdapter'),
    TutorialTargetAdapter: require('../js/ui/TutorialTargetAdapter'),
    BuildingActionAdapter: require('../js/ui/BuildingActionAdapter'),
    H5TextAdapter: require('../js/ui/H5TextAdapter'),
  };
}

function attachCivilizationPanel(Game, elements) {
  function getElement(id) {
    if (!elements.has(id)) elements.set(id, { id, style: {}, textContent: '', innerHTML: '', disabled: false });
    return elements.get(id);
  }

  Game.civilizationPanel = new global.window.CivilizationPanelAdapter({
    setText: (id, value) => {
      getElement(id).textContent = value;
    },
    progressBar: getElement('eraProgress'),
    advanceButton: getElement('btnAdvanceEra'),
    advanceLabel: getElement('btnEraLabel'),
    features: getElement('civFeaturesList'),
    conditions: getElement('eraConditions'),
  });
}

function attachMilitaryPanel(Game, elements, textSink = null) {
  function getElement(id) {
    if (!elements.has(id)) elements.set(id, { id, style: {}, textContent: '', innerHTML: '', disabled: false, hidden: false });
    return elements.get(id);
  }

  Game.militaryPanel = new global.window.MilitaryPanelAdapter({
    setText: (id, value) => {
      if (textSink) textSink.set(id, value);
      getElement(id).textContent = value;
    },
    panel: getElement('militaryPanel'),
    trainingProgress: getElement('soldierTrainingProgress'),
    scoutGrid: getElement('scoutDirectionGrid'),
  });
}

test('app 会映射所有教程高亮目标，包括民居卡片', () => {
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
    global.window.Game.tutorialTargets = global.window.TutorialTargetAdapter.fromDocument(global.document);

    const expected = {
      'tab-resources': 'tabResources',
      'tab-civilization': 'tabCivilization',
      'tab-buildings': 'tabBuildings',
      'tab-events': 'tabEvents',
      'tab-military': 'tabMilitary',
      'btn-advance-era': 'btnAdvanceEra',
      'btn-claim-event': 'btnClaimEvent',
      'food-value': 'foodValue',
      'card-farm': 'card-farm',
      'card-house': 'card-house',
      'event-card-special': 'event-card-special',
      'card-lumbermill': 'card-lumbermill',
      'card-craftsman': 'craftsmanCard',
    };

    for (const [key, id] of Object.entries(expected)) {
      assert.equal(global.window.Game.getTutorialTarget(key), elements.get(id));
    }
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

test('era advance button stays locked until tutorial unlocks the advance step', () => {
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
    attachCivilizationPanel(Game, elements);
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

    Game.renderCivilization();
    assert.equal(elements.get('btnAdvanceEra').disabled, true);
    assert.equal(elements.get('btnEraLabel').textContent, '引导未解锁');

    Game.tutorialController.state.currentStep = 9;
    Game.renderCivilization();
    assert.equal(elements.get('btnAdvanceEra').disabled, false);
    assert.equal(elements.get('btnEraLabel').textContent, '满足条件，可进阶');
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    global.localStorage = originalLocalStorage;
  }
});

test('subcity keeps era advance button disabled even when conditions are met', () => {
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
    attachCivilizationPanel(Game, elements);
    Game.state = {
      currentEra: 5,
      currentEraName: '古典时代',
      gameDay: 1,
      population: { total: 4 },
      totalBuildings: 1,
      techs: {},
      happiness: 100,
      isCapitalCity: false,
      eraProgress: {
        percentage: 100,
        canAdvance: true,
        targetEraName: '后续时代',
        conditions: [],
      },
    };
    Game.tutorialController = {
      state: { completed: true, currentStep: 99 },
      canOpenTab() { return true; },
    };

    Game.renderCivilization();

    assert.equal(Game.canAdvanceEraNow(), false);
    assert.equal(elements.get('btnAdvanceEra').disabled, true);
    assert.equal(elements.get('btnEraLabel').textContent, '分城跟随主城时代');
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
    attachCivilizationPanel(Game, elements);
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

test('initial era advance also stays locked before the tutorial reaches the advance step', () => {
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
    attachCivilizationPanel(Game, elements);
    Game.state = {
      currentEra: 0,
      currentEraName: '原始时代',
      gameDay: 1,
      population: { total: 3 },
      totalBuildings: 0,
      techs: {},
      happiness: 100,
      eraProgress: {
        percentage: 100,
        canAdvance: true,
        targetEraName: '农耕时代',
        conditions: [],
      },
    };
    Game.tutorialController = {
      state: { completed: false, currentStep: 1 },
      canOpenTab(tabId) { return tabId === 'civilization'; },
    };

    Game.renderCivilization();
    assert.equal(elements.get('btnAdvanceEra').disabled, true);
    assert.equal(elements.get('btnEraLabel').textContent, '引导未解锁');

    Game.tutorialController.state.currentStep = 2;
    Game.renderCivilization();
    assert.equal(elements.get('btnAdvanceEra').disabled, false);
    assert.equal(elements.get('btnEraLabel').textContent, '满足条件，可进阶');
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

test('renderMilitary displays backend-provided military state', () => {
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
          elements.set(id, {
            id,
            style: {},
            textContent: '',
            innerHTML: '',
            disabled: false,
            hidden: false,
            classList: { toggle() {} },
          });
        }
        return elements.get(id);
      },
      querySelector() {
        return { innerHTML: '' };
      },
    };
    delete require.cache[require.resolve('../app')];
    require('../app');

    const { Game } = global.window;
    attachMilitaryPanel(Game, elements);
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

    Game.renderMilitary();

    assert.equal(elements.get('militaryPanel').hidden, false);
    assert.equal(elements.get('soldierCount').textContent, '2/5');
    assert.equal(elements.get('militaryDefense').textContent, 4);
    assert.equal(elements.get('soldierTrainingText').textContent, '下一名 15/30 秒');
    assert.equal(elements.get('soldierTrainingProgress').style.width, '50%');
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
    Game.advisorPanel = global.window.AdvisorPanelAdapter.fromDocument(global.document);
    Game.state.softGuide = {
      target: 'tab-military',
      message: '派出侦察队探索城市之外的世界。',
    };
    Game.tutorialController = {
      state: { completed: true, currentStep: 99 },
    };

    Game.renderSoftGuide();

    assert.equal(getElement('advisorBtn').hidden, false);
    assert.equal(getElement('advisorMessage').textContent, '派出侦察队探索城市之外的世界。');
    assert.equal(getElement('btnAdvisorGo').disabled, false);

    Game.openAdvisor();
    assert.equal(getElement('advisorModal').classList.contains('show'), true);

    const switched = [];
    Game.switchTab = (tabId) => switched.push(tabId);
    Game.goToAdvisorTarget();

    assert.deepEqual(switched, ['military']);
    assert.equal(getElement('advisorModal').classList.contains('show'), false);
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
    const buttons = [
      { dataset: { militaryView: 'army' }, disabled: false, classList: { toggle() {} }, setAttribute() {} },
      { dataset: { militaryView: 'scout' }, disabled: false, classList: { toggle() {} }, setAttribute() {} },
      { dataset: { militaryView: 'world' }, disabled: false, classList: { toggle() {} }, setAttribute() {} },
    ];
    const pages = [
      { dataset: { militaryPage: 'army' }, classList: { toggle() {} } },
      { dataset: { militaryPage: 'scout' }, classList: { toggle() {} } },
      { dataset: { militaryPage: 'world' }, classList: { toggle() {} } },
    ];

    global.window = createWindowStub();
    global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    global.document = {
      addEventListener() {},
      getElementById(id) {
        return { id };
      },
      querySelectorAll(selector) {
        if (selector === '[data-military-view]') return buttons;
        if (selector === '[data-military-page]') return pages;
        return [];
      },
    };

    delete require.cache[require.resolve('../app')];
    require('../app');

    const { Game } = global.window;
    Game.navigationShell = new global.window.NavigationShellAdapter({
      militaryButtons: buttons,
      militaryPages: pages,
    });
    Game.state.currentEra = 4;
    Game.state.militaryView = 'world';

    Game.renderMilitaryView();

    assert.equal(Game.state.militaryView, 'army');
    assert.equal(buttons[0].disabled, false);
    assert.equal(buttons[1].disabled, true);
    assert.equal(buttons[2].disabled, true);
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    global.localStorage = originalLocalStorage;
  }
});

test('scout controls show countdown and lock other directions while one scout is active', () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalLocalStorage = global.localStorage;
  const originalNow = Date.now;

  try {
    const text = new Map();
    const elements = new Map();
    const container = { innerHTML: '' };
    elements.set('scoutDirectionGrid', container);
    Date.now = () => new Date('2026-05-17T08:00:30.000Z').getTime();
    global.window = createWindowStub();
    global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    global.document = {
      addEventListener() {},
      getElementById(id) {
        if (id === 'scoutDirectionGrid') return container;
        return { id };
      },
    };

    delete require.cache[require.resolve('../app')];
    require('../app');

    const { Game } = global.window;
    attachMilitaryPanel(Game, elements, text);
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

    Game.renderScoutControls();

    assert.match(text.get('scoutStatus'), /北方侦察中，预计 0:30 后返回/);
    assert.match(container.innerHTML, /direction-n status-active/);
    assert.match(container.innerHTML, /<span class="scout-action">0:30<\/span>/);
    assert.match(container.innerHTML, /direction-e status-locked/);
    assert.doesNotMatch(container.innerHTML, /data-scout-direction="e"/);
  } finally {
    Date.now = originalNow;
    global.window = originalWindow;
    global.document = originalDocument;
    global.localStorage = originalLocalStorage;
  }
});
