const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function createWindowStub() {
  return {
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
    DOMHelper: { setText() {} },
  };
}

function createElement(id) {
  const classes = new Set();
  return {
    id,
    hidden: id === 'citySwitcherMenu',
    textContent: '',
    innerHTML: '',
    dataset: {},
    attrs: {},
    classList: {
      toggle(value, force) {
        if (force) classes.add(value);
        else classes.delete(value);
      },
      remove(value) {
        classes.delete(value);
      },
      contains(value) {
        return classes.has(value);
      },
    },
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
  };
}

test('city switcher is a custom HUD menu under the resource strip', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(indexHtml, /id="resourcePanel"[\s\S]*id="citySwitcher"/);
  assert.match(indexHtml, /id="citySwitcherTrigger"/);
  assert.match(indexHtml, /id="citySwitcherMenu"/);
  assert.doesNotMatch(indexHtml, /id="citySelect"/);
});

test('renderCitySwitcher renders custom city options and toggles the menu', () => {
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
        if (!elements.has(id)) elements.set(id, createElement(id));
        return elements.get(id);
      },
    };

    delete require.cache[require.resolve('../app')];
    require('../app');

    const { Game } = global.window;
    Game.state.activeCityId = 'capital';
    Game.state.cityState = {
      activeCityId: 'capital',
      capitalCityId: 'capital',
      cities: [
        { id: 'capital', name: '北京', isCapital: true, population: { total: 8 }, totalBuildings: 4 },
        { id: 'site_river', name: '河湾城', isCapital: false, population: { total: 3 }, totalBuildings: 1 },
      ],
    };

    Game.renderCitySwitcher();

    assert.equal(elements.get('citySwitcher').hidden, false);
    assert.equal(elements.get('citySwitcherName').textContent, '北京');
    assert.match(elements.get('citySwitcherMenu').innerHTML, /data-city-id="site_river"/);
    assert.match(elements.get('citySwitcherMenu').innerHTML, /分城/);

    Game.toggleCitySwitcher();
    assert.equal(elements.get('citySwitcherMenu').hidden, false);
    assert.equal(elements.get('citySwitcherTrigger').attrs['aria-expanded'], 'true');

    Game.closeCitySwitcher();
    assert.equal(elements.get('citySwitcherMenu').hidden, true);
    assert.equal(elements.get('citySwitcherTrigger').attrs['aria-expanded'], 'false');
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    global.localStorage = originalLocalStorage;
  }
});
