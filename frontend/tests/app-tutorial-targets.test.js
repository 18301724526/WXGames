const test = require('node:test');
const assert = require('node:assert/strict');

function createWindowStub() {
  return {
    GameConfig: {
      API_BASE: '/api',
      SYNC_INTERVAL_MS: 2000,
      TUTORIAL_WAIT_SYNC_INTERVAL_MS: 500,
      TUTORIAL_START_DELAY_MS: 0,
      BUILDINGS: {},
      ERAS: [],
    },
    GameAPI: class {},
    GameStateSync: class {},
    GameStateManager: class {},
    ResourceRenderer: class {},
    BuildingUIRenderer: class {},
    EventUIRenderer: class {},
    TutorialUIRenderer: class {},
    TutorialController: class {},
    EventController: class {},
    BuildingController: class {},
    DOMHelper: { setText() {} },
  };
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

    const expected = {
      'tab-resources': 'tabResources',
      'tab-civilization': 'tabCivilization',
      'tab-buildings': 'tabBuildings',
      'tab-events': 'tabEvents',
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
    assert.equal(elements.get('btnEraLabel').textContent, '进阶（消耗 80 🌾）');
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    global.localStorage = originalLocalStorage;
  }
});
