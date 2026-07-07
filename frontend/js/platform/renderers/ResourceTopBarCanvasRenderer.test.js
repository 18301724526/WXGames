const test = require('node:test');
const assert = require('node:assert/strict');

require('../../config/LocaleTextRegistry');
const LocaleText = require('../../ecs/resource/LocaleText');
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

function createDrawingSurfaceSentinel(label, calls = []) {
  return {
    width: 390,
    height: 844,
    bottomSafeArea: 12,
    addHitTarget(rect, action) {
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

test('ResourceTopBarCanvasRenderer reads host ctx presenter and width dynamically after proxy removal', () => {
  const firstCtx = { id: 'first-ctx' };
  const secondCtx = { id: 'second-ctx' };
  const firstPresenter = { id: 'first-presenter' };
  const secondPresenter = { id: 'second-presenter' };
  const host = createHost({ ctx: firstCtx, presenter: firstPresenter, width: 390 });
  const renderer = new ResourceTopBarCanvasRenderer({ host });

  assert.equal(renderer.ctx, firstCtx);
  assert.equal(renderer.presenter, firstPresenter);
  assert.equal(renderer.width, 390);

  host.ctx = secondCtx;
  host.presenter = secondPresenter;
  host.width = 512;

  assert.equal(renderer.ctx, secondCtx);
  assert.equal(renderer.presenter, secondPresenter);
  assert.equal(renderer.width, 512);
});

test('ResourceTopBarCanvasRenderer no longer forwards unknown host properties through proxy', () => {
  const host = createHost({ someRandomProp: 'host-only' });
  const renderer = new ResourceTopBarCanvasRenderer({ host });

  assert.equal(renderer.someRandomProp, undefined);
});

test('ResourceTopBarCanvasRenderer prefers explicit drawing surface over proxy fallback host', () => {
  const calls = [];
  const explicitSurface = createDrawingSurfaceSentinel('explicit', calls);
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  fallbackHost.presenter = createHost().presenter;
  fallbackHost.width = 390;
  fallbackHost.height = 844;
  fallbackHost.bottomSafeArea = 12;
  const renderer = new ResourceTopBarCanvasRenderer({
    host: fallbackHost,
    drawingSurface: explicitSurface,
  });

  renderer.renderTopBar({ currentEraName: 'Stone', population: { total: 12 } }, {});

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'explicit'), [
    'addHitTarget',
    'createGradient',
    'drawAsset',
    'drawButton',
    'drawPanel',
    'drawText',
    'getLayout',
    'truncateText',
  ]);
  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), []);
});

test('ResourceTopBarCanvasRenderer falls back to host drawing surface when none is injected', () => {
  const calls = [];
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  fallbackHost.presenter = createHost().presenter;
  fallbackHost.width = 390;
  fallbackHost.height = 844;
  fallbackHost.bottomSafeArea = 12;
  const renderer = new ResourceTopBarCanvasRenderer({ host: fallbackHost });

  renderer.renderTopBar({ currentEraName: 'Stone', population: { total: 12 } }, {});

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), [
    'addHitTarget',
    'createGradient',
    'drawAsset',
    'drawButton',
    'drawPanel',
    'drawText',
    'getLayout',
    'truncateText',
  ]);
});

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

test('ResourceTopBarCanvasRenderer resolves top bar chrome through active locale', () => {
  LocaleText.setLocale('en-US');
  const host = createHost({
    presenter: {
      ...createHost().presenter,
      buildCitySwitcherViewState() {
        return { hidden: false, activeCityName: '' };
      },
    },
  });
  const renderer = new ResourceTopBarCanvasRenderer({ host });

  renderer.renderTopBar({ population: { total: 12 } }, {});

  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === 'Primitive Era'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === 'Population: 1200'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawButton' && call[1] === 'Advisor'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawButton' && call[1] === 'Logs'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawButton' && call[1] === 'Settings'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawButton' && call[1] === 'Capital'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === 'Food'), true);
  LocaleText.setLocale('zh-CN');
});

test('ResourceTopBarCanvasRenderer falls back when presenter resource view is unavailable', () => {
  const host = createHost({ presenter: null });
  const renderer = new ResourceTopBarCanvasRenderer({ host });

  const bottom = renderer.renderMapHomeTopBar({
    resources: { food: 20, wood: 10, stone: 8, iron: 5, knowledge: 3 },
    population: { total: 12 },
  }, {
    fps: 58,
    network: { latencyMs: 42 },
    serverNowMs: new Date('2026-07-07T11:22:33+08:00').getTime(),
    showTopBarDebugStats: true,
  });

  assert.equal(bottom, 64);
  assert.equal(host.hitTargets.filter((target) => target.action.type === 'openResourceDetails').length, 6);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === '1200'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === 'FPS 58'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === '42ms'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === '11:22:33'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawAsset' && call[1] === 'assets/art/ui-hud/hud-icon-signal.png'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawAsset' && call[1] === 'assets/art/ui-hud/hud-resource-food.png'), true);
});

test('ResourceTopBarCanvasRenderer hides the map-home debug stats block by default', () => {
  const host = createHost({ presenter: null });
  const renderer = new ResourceTopBarCanvasRenderer({ host });

  const bottom = renderer.renderMapHomeTopBar({
    resources: { food: 20, wood: 10, stone: 8, iron: 5, knowledge: 3 },
    population: { total: 12 },
  }, {
    fps: 58,
    network: { latencyMs: 42 },
  });

  assert.equal(bottom, 64);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && String(call[1]).startsWith('FPS')), false);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && String(call[1]).endsWith('ms')), false);
  assert.equal(host.calls.some((call) => call[0] === 'drawAsset' && call[1] === 'assets/art/ui-hud/hud-icon-signal.png'), false);
  assert.equal(host.calls.some((call) => call[0] === 'drawAsset' && call[1] === 'assets/art/ui-hud/hud-resource-food.png'), true);
  assert.equal(host.hitTargets.filter((target) => target.action.type === 'openResourceDetails').length, 6);
});

test('ResourceTopBarCanvasRenderer renders map-home resources in the approved order', () => {
  const host = createHost();
  const renderer = new ResourceTopBarCanvasRenderer({ host });

  renderer.renderMapHomeTopBar({ population: { total: 12 } }, {});

  const resourceIcons = host.calls
    .filter((call) => call[0] === 'drawAsset' && String(call[1]).includes('hud-resource-'))
    .map((call) => call[1]);
  assert.deepEqual(resourceIcons, [
    'assets/art/ui-hud/hud-resource-food.png',
    'assets/art/ui-hud/hud-resource-wood.png',
    'assets/art/ui-hud/hud-resource-stone.png',
    'assets/art/ui-hud/hud-resource-iron.png',
    'assets/art/ui-hud/hud-resource-knowledge.png',
    'assets/art/ui-hud/hud-resource-population.png',
  ]);
});

test('ResourceTopBarCanvasRenderer draws the map-home plate as a 9-slice of hud-plate-top', () => {
  const clippedCalls = [];
  const host = createHost({
    drawAssetClipped(assetPath, sourceRect, x, y, width, height) {
      clippedCalls.push({ assetPath, sourceRect, x, y, width, height });
      return true;
    },
  });
  const renderer = new ResourceTopBarCanvasRenderer({ host });

  renderer.renderMapHomeTopBar({ population: { total: 12 } }, {});

  assert.equal(clippedCalls.length, 9);
  assert.equal(clippedCalls.every((call) => call.assetPath === 'assets/art/ui-hud/hud-plate-top.png'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawPanel'), false);
});

test('ResourceTopBarCanvasRenderer falls back to a token gradient plate without the asset', () => {
  const host = createHost();
  const renderer = new ResourceTopBarCanvasRenderer({ host });

  renderer.renderMapHomeTopBar({ population: { total: 12 } }, {});

  assert.equal(host.calls.some((call) => call[0] === 'drawPanel'), true);
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
