const test = require('node:test');
const assert = require('node:assert/strict');

const CityCanvasRenderer = require('./CityCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

function createHost(overrides = {}) {
  const hitTargets = [];
  const calls = [];
  const host = {
    width: 390,
    height: 844,
    ctx: { fillRect() {}, globalAlpha: 1 },
    presenter: {
      buildCitySwitcherViewState() {
        return createCitySwitcherView();
      },
      buildMilitaryViewState() {
        return createMilitaryView();
      },
    },
    hitTargets,
    calls,
    addHitTarget(rect, action) { hitTargets.push({ rect, action }); },
    createGradient() { return '#123'; },
    drawAsset(assetPath) { calls.push(['drawAsset', assetPath]); return false; },
    drawButton(x, y, width, height, label, options = {}) { calls.push(['drawButton', label, options]); },
    drawPanel() { calls.push(['drawPanel']); },
    drawText(text) { calls.push(['drawText', text]); },
    getLayout() { return { contentX: 10, contentWidth: 360, contentRight: 370 }; },
    getTopBarBottom() { return 72; },
    renderArmyFormationStrip(...args) { calls.push(['renderArmyFormationStrip', args]); return true; },
    renderBuildings(...args) { calls.push(['renderBuildings', args]); return true; },
    renderPopulation(...args) { calls.push(['renderPopulation', args]); return 360; },
    truncateText(text) { return String(text || ''); },
    ...overrides,
  };
  return host;
}

function createCitySwitcherView() {
  return {
    hidden: false,
    options: [
      { id: 'capital', name: 'Capital', tag: '主城', metaText: 'Lv.2', isActive: true },
      { id: 'city-2', name: 'Harbor', tag: '分城', metaText: 'Lv.1', isActive: false },
    ],
  };
}

function createMilitaryView() {
  return {
    formationMeta: { cityId: 'city-2', maxMembers: 5 },
    formations: [
      { cityId: 'city-2', slot: 1, name: 'Guard', maxMembers: 5, members: [{ id: 'hero-1' }] },
      { cityId: 'city-2', slot: 2, name: 'Reserve', maxMembers: 5, members: [] },
    ],
  };
}

function createState() {
  return {
    activeCityId: 'city-2',
    cityState: {
      activeCityId: 'city-2',
      cities: [
        { id: 'capital', name: 'Capital', isCapital: true, level: 2, terrainLabel: 'Plain' },
        { id: 'city-2', name: 'Harbor', level: 1, terrainLabel: 'Coast', military: { soldiers: 8 } },
      ],
    },
    territoryState: {
      availableSoldiers: 5,
      territories: [{ id: 'city-2', cityName: 'Harbor Site', terrainLabel: 'Coast' }],
    },
    military: { soldiers: 12 },
  };
}

test('CityCanvasRenderer resolves active city summary from city state and territory state', () => {
  const renderer = new CityCanvasRenderer({ host: createHost() });

  const summary = renderer.getActiveCitySummary(createState());

  assert.deepEqual({
    id: summary.id,
    name: summary.name,
    tag: summary.tag,
    terrainLabel: summary.terrainLabel,
    soldiers: summary.military.soldiers,
  }, {
    id: 'city-2',
    name: 'Harbor',
    tag: '分城',
    terrainLabel: 'Coast',
    soldiers: 8,
  });
});

test('CityCanvasRenderer preserves city switcher and subcity hit target contracts', () => {
  const host = createHost();
  const renderer = new CityCanvasRenderer({ host });

  renderer.renderCitySwitcherMenu(createState());
  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeCitySwitcher'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'blockCanvasModal'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'selectCity' && target.action.cityId === 'city-2'), true);

  host.hitTargets.length = 0;
  renderer.renderSubcityListPanel(createState(), {});
  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeSubcityList'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'jumpToSubcity' && target.action.cityId === 'city-2'), true);
});

test('CityCanvasRenderer preserves management tabs and delegates tab content renderers', () => {
  const host = createHost();
  const renderer = new CityCanvasRenderer({ host });

  renderer.renderCityManagementPanel(createState(), { activeCityManagementTab: 'buildings', activeBuildingCategory: 'housing' });
  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeCityManagement'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'switchCityManagementTab' && target.action.tab === 'people'), true);
  assert.equal(host.calls.some((call) => call[0] === 'renderBuildings'), true);

  host.calls.length = 0;
  renderer.renderCityManagementPanel(createState(), { activeCityManagementTab: 'people' });
  assert.equal(host.calls.some((call) => call[0] === 'renderPopulation'), true);
});

test('CityCanvasRenderer preserves military formation entry contracts', () => {
  const host = createHost();
  const renderer = new CityCanvasRenderer({ host });

  renderer.renderCityMilitaryPanel(createState(), { id: 'city-2', military: { soldiers: 8 } }, 10, 100, 360, 180);

  assert.equal(host.hitTargets.some((target) => target.action.type === 'openArmyFormation' && target.action.cityId === 'city-2' && target.action.slot === 1), true);

  host.calls.length = 0;
  renderer.renderCityMilitaryPanel(createState(), { id: 'city-2', military: { soldiers: 8 } }, 10, 100, 360, 300);
  assert.equal(host.calls.some((call) => call[0] === 'renderArmyFormationStrip'), true);
});

test('CanvasGameRenderer exposes city rendering through facade', () => {
  class StubCityRenderer {
    constructor(options) {
      this.host = options.host;
    }

    renderCityManagementPanel(...args) {
      return { host: this.host, args };
    }
  }

  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    cityRendererClass: StubCityRenderer,
  });
  const state = { cityState: {} };
  const options = { activeCityManagementTab: 'military' };

  const result = renderer.renderCityManagementPanel(state, options);

  assert.equal(result.host, renderer);
  assert.deepEqual(result.args, [state, options]);
});
