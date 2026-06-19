const test = require('node:test');
const assert = require('node:assert/strict');

const AdvisorCanvasRenderer = require('./AdvisorCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

function createHost(overrides = {}) {
  const hitTargets = [];
  const calls = [];
  const host = {
    width: 390,
    height: 844,
    bottomSafeArea: 12,
    ctx: { fillRect() {}, globalAlpha: 1 },
    presenter: {
      buildAdvisorViewState() {
        return createAdvisorView(overrides.hasAdvice !== false, overrides.goDisabled === true);
      },
    },
    hitTargets,
    calls,
    addHitTarget(rect, action) { hitTargets.push({ rect, action }); },
    createGradient() { return '#123'; },
    drawButton(x, y, width, height, label, options = {}) { calls.push(['drawButton', label, options]); },
    drawPanel() { calls.push(['drawPanel']); },
    drawText(text) { calls.push(['drawText', text]); },
    drawTextLines(lines) { calls.push(['drawTextLines', lines]); },
    getLayout() { return { contentX: 10, contentWidth: 360, contentRight: 370 }; },
    truncateText(text) { return String(text || ''); },
    wrapText(text) { return [String(text || '')]; },
    ...overrides,
  };
  return host;
}

function createAdvisorView(hasAdvice = true, goDisabled = false) {
  return {
    hidden: !hasAdvice,
    activeAdvisor: hasAdvice ? { message: 'Build more farms.' } : null,
    text: hasAdvice ? { message: 'Build more farms.' } : {},
    goButton: { disabled: goDisabled },
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
    drawButton(_x, _y, _width, _height, buttonLabel) {
      calls.push([label, 'drawButton', buttonLabel]);
    },
    drawPanel() {
      calls.push([label, 'drawPanel']);
    },
    drawText(text) {
      calls.push([label, 'drawText', text]);
    },
    drawTextLines(lines) {
      calls.push([label, 'drawTextLines', lines]);
    },
    getLayout() {
      calls.push([label, 'getLayout']);
      return { contentX: 10, contentWidth: 360, contentRight: 370 };
    },
    wrapText(text) {
      calls.push([label, 'wrapText', text]);
      return [String(text || '')];
    },
  };
}

function getCalledDrawingSurfaceMethods(calls, label) {
  return Array.from(new Set(calls.filter((call) => call[0] === label).map((call) => call[1]))).sort();
}

test('AdvisorCanvasRenderer prefers explicit drawing surface over proxy fallback host', () => {
  const calls = [];
  const explicitSurface = createDrawingSurfaceSentinel('explicit', calls);
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  fallbackHost.presenter = {
    buildAdvisorViewState() {
      return createAdvisorView(true, false);
    },
  };
  const renderer = new AdvisorCanvasRenderer({
    host: fallbackHost,
    drawingSurface: explicitSurface,
  });
  renderer.presenter = fallbackHost.presenter;
  renderer.width = 390;
  renderer.height = 844;
  renderer.bottomSafeArea = 12;

  renderer.renderAdvisorPanel({ softGuide: {} });

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'explicit'), [
    'addHitTarget',
    'createGradient',
    'drawButton',
    'drawPanel',
    'drawText',
    'drawTextLines',
    'getLayout',
    'wrapText',
  ]);
  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), []);
});

test('AdvisorCanvasRenderer falls back to host drawing surface when none is injected', () => {
  const calls = [];
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  fallbackHost.presenter = {
    buildAdvisorViewState() {
      return createAdvisorView(true, false);
    },
  };
  const renderer = new AdvisorCanvasRenderer({ host: fallbackHost });
  renderer.presenter = fallbackHost.presenter;
  renderer.width = 390;
  renderer.height = 844;
  renderer.bottomSafeArea = 12;

  renderer.renderAdvisorPanel({ softGuide: {} });

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), [
    'addHitTarget',
    'createGradient',
    'drawButton',
    'drawPanel',
    'drawText',
    'drawTextLines',
    'getLayout',
    'wrapText',
  ]);
});

test('AdvisorCanvasRenderer renders bottom advisor strip when advice exists', () => {
  const host = createHost();
  const renderer = new AdvisorCanvasRenderer({ host });

  renderer.renderAdvisor({ softGuide: {} });

  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === '顾问'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === 'Build more farms.'), true);
});

test('AdvisorCanvasRenderer preserves floating advisor button hit target', () => {
  const host = createHost();
  const renderer = new AdvisorCanvasRenderer({ host });

  const layout = renderer.getMapHomeFloatingButtonLayout(0);
  renderer.renderFloatingAdvisorButton({ softGuide: {} }, {});

  assert.deepEqual(Object.keys(layout).sort(), ['size', 'x', 'y']);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openAdvisor'), true);
});

test('AdvisorCanvasRenderer preserves advisor modal action contracts', () => {
  const host = createHost();
  const renderer = new AdvisorCanvasRenderer({ host });

  renderer.renderAdvisorPanel({ softGuide: {} });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeAdvisor'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'blockCanvasModal'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'goToAdvisorTarget' && target.action.disabled === false), true);

  const disabledHost = createHost({ goDisabled: true });
  const disabledRenderer = new AdvisorCanvasRenderer({ host: disabledHost });
  disabledRenderer.renderAdvisorPanel({ softGuide: {} });
  assert.equal(disabledHost.hitTargets.some((target) => target.action.type === 'goToAdvisorTarget' && target.action.disabled === true), true);
});

test('CanvasGameRenderer exposes advisor rendering through facade', () => {
  class StubAdvisorRenderer {
    constructor(options) {
      this.host = options.host;
    }

    renderAdvisorPanel(...args) {
      return { host: this.host, args };
    }
  }

  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    advisorRendererClass: StubAdvisorRenderer,
  });
  const state = { softGuide: {} };

  const result = renderer.renderAdvisorPanel(state);

  assert.equal(result.host, renderer);
  assert.deepEqual(result.args, [state]);
});
