const test = require('node:test');
const assert = require('node:assert/strict');

const CityPeopleCanvasRenderer = require('./CityPeopleCanvasRenderer');

function createHost(overrides = {}) {
  const hitTargets = [];
  const calls = [];
  const host = {
    width: 390,
    height: 844,
    ctx: { fillRect() {}, globalAlpha: 1 },
    presenter: {
      buildPopulationViewState() {
        return createPopulationView();
      },
    },
    hitTargets,
    calls,
    addHitTarget(rect, action) { hitTargets.push({ rect, action }); },
    createGradient() { return '#123'; },
    drawAsset(assetPath) { calls.push(['drawAsset', assetPath]); return false; },
    drawButton(x, y, width, height, label, options = {}) { calls.push(['drawButton', label, options]); },
    drawIconCard() { calls.push(['drawIconCard']); },
    drawLine() { calls.push(['drawLine']); },
    drawPanel() { calls.push(['drawPanel']); },
    drawText(text) { calls.push(['drawText', text]); },
    getLayout() { return { contentX: 10, contentWidth: 360, contentRight: 370 }; },
    truncateText(text) { return String(text || ''); },
    ...overrides,
  };
  return host;
}

function createPopulationView() {
  return {
    text: {
      title: 'Talent',
      subtitle: 'Jobs',
      total: 12,
      unassigned: 3,
    },
    planning: {
      terrainLabel: 'Plains',
      text: {
        habitabilityStatus: 'Good',
        populationGrowthStatus: 'Growing',
        note: 'Stable homes.',
      },
    },
    jobs: [
      { id: 'farmer', visible: true, count: 4, canDecrease: true, canIncrease: true },
      { id: 'scholar', visible: true, count: 2, canDecrease: false, canIncrease: true },
      { id: 'craftsman', visible: true, count: 1, canDecrease: true, canIncrease: false },
    ],
  };
}

const CITY_PEOPLE_DRAWING_METHODS = [
  'addHitTarget',
  'createGradient',
  'drawAsset',
  'drawButton',
  'drawIconCard',
  'drawLine',
  'drawPanel',
  'drawText',
  'getLayout',
  'truncateText',
];

function createDrawingSurfaceSentinel(label, calls = []) {
  return {
    width: 390,
    height: 844,
    ctx: { fillRect() {}, globalAlpha: 1 },
    presenter: createHost().presenter,
    addHitTarget(_rect, action) {
      calls.push([label, 'addHitTarget', action?.type]);
    },
    createGradient() {
      calls.push([label, 'createGradient']);
      return label;
    },
    drawAsset(assetPath) {
      calls.push([label, 'drawAsset', assetPath]);
      return false;
    },
    drawButton(_x, _y, _width, _height, buttonLabel) {
      calls.push([label, 'drawButton', buttonLabel]);
    },
    drawIconCard() {
      calls.push([label, 'drawIconCard']);
    },
    drawLine() {
      calls.push([label, 'drawLine']);
    },
    drawPanel() {
      calls.push([label, 'drawPanel']);
    },
    drawText(text) {
      calls.push([label, 'drawText', text]);
    },
    getLayout() {
      calls.push([label, 'getLayout']);
      return { contentX: 10, contentWidth: 360, contentRight: 370 };
    },
    truncateText(text) {
      calls.push([label, 'truncateText', text]);
      return String(text || '');
    },
  };
}

function getCalledDrawingSurfaceMethods(calls, label) {
  return Array.from(new Set(calls.filter((call) => call[0] === label).map((call) => call[1]))).sort();
}

test('CityPeopleCanvasRenderer prefers explicit drawing surface over proxy fallback host', () => {
  const calls = [];
  const explicitSurface = createDrawingSurfaceSentinel('explicit', calls);
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  const renderer = new CityPeopleCanvasRenderer({
    host: fallbackHost,
    drawingSurface: explicitSurface,
  });
  fallbackHost.presenter = createHost().presenter;

  renderer.renderPopulation({}, 100);

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'explicit'), CITY_PEOPLE_DRAWING_METHODS);
  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), []);
});

test('CityPeopleCanvasRenderer falls back to host drawing surface when none is injected', () => {
  const calls = [];
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  const renderer = new CityPeopleCanvasRenderer({ host: fallbackHost });
  fallbackHost.presenter = createHost().presenter;

  renderer.renderPopulation({}, 100);

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), CITY_PEOPLE_DRAWING_METHODS);
});

test('CityPeopleCanvasRenderer reads dynamic host presenter through explicit getter', () => {
  const firstPresenter = createHost().presenter;
  const secondPresenter = createHost({
    presenter: {
      buildPopulationViewState() {
        return createPopulationView();
      },
    },
  }).presenter;
  const host = createHost({ presenter: firstPresenter });
  const renderer = new CityPeopleCanvasRenderer({ host });

  assert.equal(renderer.presenter, firstPresenter);

  host.presenter = secondPresenter;

  assert.equal(renderer.presenter, secondPresenter);
});

test('CityPeopleCanvasRenderer does not proxy unknown host properties', () => {
  const host = createHost({
    someRandomProp: 'host-only',
  });
  const renderer = new CityPeopleCanvasRenderer({ host });

  assert.equal(host.someRandomProp, 'host-only');
  assert.equal(renderer.someRandomProp, undefined);
});

test('CityPeopleCanvasRenderer owns population assignment and policy hit targets', () => {
  const host = createHost();
  const renderer = new CityPeopleCanvasRenderer({ host });

  const bottom = renderer.renderPopulation({}, 100);

  assert.equal(bottom, 416);
  assert.equal(host.hitTargets.some((target) => (
    target.action.type === 'openCityManagement'
    && target.action.tab === 'people'
    && target.action.source === 'cityPeoplePolicyButton'
  )), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'assignJob' && target.action.job === 'farmer' && target.action.delta === -1), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'assignJob' && target.action.job === 'craftsman' && target.action.disabled === true), true);
});
