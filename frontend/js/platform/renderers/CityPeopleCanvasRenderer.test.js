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
