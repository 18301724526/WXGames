const test = require('node:test');
const assert = require('node:assert/strict');

function createWindowStub() {
  return {
    GameConfig: {
      API_BASE: '/api',
      SYNC_INTERVAL_MS: 2000,
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
