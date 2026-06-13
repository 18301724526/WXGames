const test = require('node:test');
const assert = require('node:assert/strict');

const HomeCanvasRenderer = require('./HomeCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

function createHost(overrides = {}) {
  const hitTargets = [];
  const calls = [];
  const host = {
    width: 390,
    height: 844,
    bottomSafeArea: 12,
    ctx: {
      fillRect(...args) { calls.push(['fillRect', ...args]); },
      globalAlpha: 1,
    },
    presenter: {
      buildResourceViewState() {
        return createResourceView();
      },
      buildCitySwitcherViewState() {
        return createCitySwitcherView();
      },
      buildAdvisorViewState() {
        return { hidden: false };
      },
      buildPopulationViewState() {
        return createPopulationView();
      },
      buildHomeFeatureViewState() {
        return createHomeFeatureView();
      },
      toDisplayPopulation(value) {
        return String(Number(value || 0) * 100);
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

function createResourceView() {
  return {
    text: {
      woodValue: '10',
      woodRate: '+1',
      ironValue: '5',
      ironRate: '+0',
      stoneValue: '8',
      stoneRate: '+1',
      foodValue: '20',
      foodRate: '+2',
      knowledgeValue: '3',
      knowledgeRate: '+1',
      populationValue: '1200',
      populationStatus: '',
    },
  };
}

function createCitySwitcherView() {
  return {
    hidden: false,
    activeCityName: 'Capital',
  };
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

function createHomeFeatureView() {
  return {
    title: 'Features',
    subtitle: 'Quick actions',
    entries: [
      { label: 'Tasks', statusText: '1 ready', icon: 'assets/art/icon-event-cutout.webp', badge: 1, action: { type: 'openTaskCenter' } },
      { label: 'Guide', statusText: 'Read', icon: 'assets/art/icon-knowledge-cutout.webp', action: { type: 'openGuidebook' } },
    ],
  };
}

test('HomeCanvasRenderer preserves top bar resource and utility hit targets', () => {
  const host = createHost();
  const renderer = new HomeCanvasRenderer({ host });

  const bottom = renderer.renderTopBar({ currentEraName: 'Stone', population: { total: 12 } }, {});

  assert.equal(bottom, 190);
  assert.equal(host.hitTargets.filter((target) => target.action.type === 'openResourceDetails').length, 5);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openAdvisor'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openLogs'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openSettings'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openCitySwitcher'), true);
});

test('HomeCanvasRenderer falls back when presenter resource view is unavailable', () => {
  const host = createHost({ presenter: null });
  const renderer = new HomeCanvasRenderer({ host });

  const bottom = renderer.renderMapHomeTopBar({
    resources: { food: 20, wood: 10, stone: 8, iron: 5, knowledge: 3 },
    population: { total: 12 },
  });

  assert.equal(bottom, 72);
  assert.equal(host.hitTargets.filter((target) => target.action.type === 'openResourceDetails').length, 6);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === '1200'), true);
});

test('HomeCanvasRenderer does not own city people or policy rendering', () => {
  const host = createHost();
  const renderer = new HomeCanvasRenderer({ host });

  assert.equal(typeof renderer.renderPopulation, 'undefined');
  assert.equal(host.hitTargets.some((target) => target.action?.source === 'talentPolicyShortcut'), false);
});

test('HomeCanvasRenderer preserves home feature grid hit target contract', () => {
  const host = createHost();
  const renderer = new HomeCanvasRenderer({ host });

  const bottom = renderer.renderHomeFeatureGrid({}, 420, { maxBottom: 580 });

  assert.ok(bottom > 420);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openTaskCenter' && target.action.disabled === false), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openGuidebook' && target.action.disabled === false), true);
});

test('CanvasGameRenderer exposes home rendering through facade', () => {
  class StubHomeRenderer {
    constructor(options) {
      this.host = options.host;
    }

    renderTopBar(...args) {
      return { host: this.host, args };
    }
  }

  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    homeRendererClass: StubHomeRenderer,
  });
  const state = { resources: {} };
  const options = { isMapHome: false };

  const result = renderer.renderTopBar(state, options);

  assert.equal(result.host, renderer);
  assert.deepEqual(result.args, [state, options]);
});
