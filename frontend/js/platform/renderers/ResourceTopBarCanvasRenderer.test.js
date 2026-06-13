const test = require('node:test');
const assert = require('node:assert/strict');

const ResourceTopBarCanvasRenderer = require('./ResourceTopBarCanvasRenderer');
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

test('ResourceTopBarCanvasRenderer preserves top bar resource and utility hit targets', () => {
  const host = createHost();
  const renderer = new ResourceTopBarCanvasRenderer({ host });

  const bottom = renderer.renderTopBar({ currentEraName: 'Stone', population: { total: 12 } }, {});

  assert.equal(bottom, 190);
  assert.equal(host.hitTargets.filter((target) => target.action.type === 'openResourceDetails').length, 5);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openAdvisor'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openLogs'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openSettings'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openCitySwitcher'), true);
});

test('ResourceTopBarCanvasRenderer falls back when presenter resource view is unavailable', () => {
  const host = createHost({ presenter: null });
  const renderer = new ResourceTopBarCanvasRenderer({ host });

  const bottom = renderer.renderMapHomeTopBar({
    resources: { food: 20, wood: 10, stone: 8, iron: 5, knowledge: 3 },
    population: { total: 12 },
  });

  assert.equal(bottom, 72);
  assert.equal(host.hitTargets.filter((target) => target.action.type === 'openResourceDetails').length, 6);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === '1200'), true);
});

test('ResourceTopBarCanvasRenderer does not own city people, policy, or home feature rendering', () => {
  const host = createHost();
  const renderer = new ResourceTopBarCanvasRenderer({ host });

  assert.equal(typeof renderer.renderPopulation, 'undefined');
  assert.equal(typeof renderer.renderHomeFeatureGrid, 'undefined');
  assert.equal(host.hitTargets.some((target) => target.action?.source === 'talentPolicyShortcut'), false);
});

test('CanvasGameRenderer exposes resource top bar rendering through facade', () => {
  class StubResourceTopBarRenderer {
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
    resourceTopBarRendererClass: StubResourceTopBarRenderer,
  });
  const state = { resources: {} };
  const options = { isMapHome: false };

  const result = renderer.renderTopBar(state, options);

  assert.equal(result.host, renderer);
  assert.deepEqual(result.args, [state, options]);
});
