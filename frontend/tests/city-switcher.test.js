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
    FrontendGameState: require('../js/domain/GameState'),
    GameAPI: class {},
    GameStateSync: class {},
    UpdateChecker: class {
      start() {}
      stop() {}
    },
    GameStateManager: class {},
    UIStatePresenter: require('../js/state/UIStatePresenter'),
    CitySwitcherAdapter: require('../js/ui/CitySwitcherAdapter'),
    BuildingUIRenderer: class {},
    EventUIRenderer: class {},
    TutorialUIRenderer: class {},
    TutorialController: class {},
    EventController: class {},
    BuildingController: class {},
    H5TextAdapter: require('../js/ui/H5TextAdapter'),
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

function createElement(id) {
  const classes = new Set();
  return {
    id,
    hidden: id === 'citySwitcherMenu',
    textContent: '',
    innerHTML: '',
    dataset: {},
    attrs: {},
    listeners: {},
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
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    contains(target) {
      return target === this;
    },
  };
}

test('city switcher is a custom HUD menu under the resource strip', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.doesNotMatch(indexHtml, /id="resourcePanel"/);
  assert.match(indexHtml, /id="citySwitcher"/);
  assert.match(indexHtml, /id="citySwitcherTrigger"/);
  assert.match(indexHtml, /id="citySwitcherMenu"/);
  assert.doesNotMatch(indexHtml, /id="citySelect"/);
  assert.match(css, /\.top-bar \{[\s\S]*?z-index: 220;/);
  assert.match(css, /\.page-container \{[\s\S]*?z-index: 1;/);
  assert.match(css, /\.city-switcher-menu \{[\s\S]*?z-index: 260;/);
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
      listeners: {},
      addEventListener(type, handler) {
        this.listeners[type] = handler;
      },
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, createElement(id));
        return elements.get(id);
      },
    };

    delete require.cache[require.resolve('../app')];
    require('../app');

    const { Game } = global.window;
    Game.citySwitcher = global.window.CitySwitcherAdapter.fromDocument(global.document);
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

    const selected = [];
    Game.switchCity = (cityId) => selected.push(cityId);
    Game.citySwitcher.bind({ onSelect: (cityId) => Game.switchCity(cityId) });
    elements.get('citySwitcherMenu').listeners.click({
      target: {
        closest: () => ({ disabled: false, dataset: { cityId: 'site_river' } }),
      },
      stopPropagation() {},
    });
    assert.deepEqual(selected, ['site_river']);
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    global.localStorage = originalLocalStorage;
  }
});
