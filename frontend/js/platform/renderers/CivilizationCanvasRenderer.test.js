const test = require('node:test');
const assert = require('node:assert/strict');

const CivilizationCanvasRenderer = require('./CivilizationCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

function createCivilizationView(overrides = {}) {
  const disabled = Boolean(overrides.disabled);
  return {
    text: {
      eraName: 'Stone Age',
      civOverviewDay: 'Day 7',
      civOverviewPop: '18',
      civOverviewBuildings: '4',
      civOverviewTechs: '3',
      civOverviewHappiness: '92%',
      eraTargetName: 'Agriculture',
      eraProgressText: '2/4 complete',
      advanceLabel: disabled ? 'Locked' : 'Advance',
      featureDescription: 'Small camps gain better food storage.',
    },
    progress: { percentage: 50 },
    conditions: [
      { met: true, name: 'Population', progressText: '18/10' },
      { met: false, name: 'Food', progressText: '12/20' },
    ],
    advanceButton: { disabled },
  };
}

function createHost(overrides = {}) {
  const hitTargets = [];
  const calls = [];
  const host = {
    width: 390,
    height: 844,
    ctx: { fillRect() {}, globalAlpha: 1 },
    presenterArgs: null,
    presenter: {
      buildCivilizationViewState(state, tutorial, options) {
        host.presenterArgs = { state, tutorial, options };
        return createCivilizationView(overrides.viewOverrides || {});
      },
    },
    hitTargets,
    calls,
    addHitTarget(rect, action) { hitTargets.push({ rect, action }); },
    createGradient() { return '#123'; },
    drawAsset(assetPath) { calls.push(['drawAsset', assetPath]); return false; },
    drawButton(x, y, width, height, label, options = {}) { calls.push(['drawButton', label, options]); },
    drawLine() { calls.push(['drawLine']); },
    drawPanel(x, y, width, height) { calls.push(['drawPanel', x, y, width, height]); },
    drawProgressBar(x, y, width, height, percentage) { calls.push(['drawProgressBar', percentage]); },
    drawText(text) { calls.push(['drawText', text]); },
    drawTextLines(lines) { calls.push(['drawTextLines', lines]); },
    getLayout() { return { contentX: 10, contentWidth: 360, contentRight: 370 }; },
    renderSectionHeader(title) { calls.push(['renderSectionHeader', title]); },
    truncateText(text) { return String(text || ''); },
    wrapTextLimit(text) { return [String(text || '')]; },
    ...overrides,
  };
  return host;
}

// UI-REDO knife 8: buttons and the era progress bar are painted by the shared
// ModalPlateRenderer (drawPanel/drawText/createGradient/drawLine), so
// drawButton/drawProgressBar are no longer part of the drawing surface set.
const CIVILIZATION_DRAWING_METHODS = [
  'addHitTarget',
  'createGradient',
  'drawAsset',
  'drawLine',
  'drawPanel',
  'drawText',
  'drawTextLines',
  'getLayout',
  'renderSectionHeader',
  'truncateText',
  'wrapTextLimit',
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
    drawLine() {
      calls.push([label, 'drawLine']);
    },
    drawPanel() {
      calls.push([label, 'drawPanel']);
    },
    drawProgressBar(_x, _y, _width, _height, percentage) {
      calls.push([label, 'drawProgressBar', percentage]);
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
    renderSectionHeader(title) {
      calls.push([label, 'renderSectionHeader', title]);
    },
    truncateText(text) {
      calls.push([label, 'truncateText', text]);
      return String(text || '');
    },
    wrapTextLimit(text) {
      calls.push([label, 'wrapTextLimit', text]);
      return [String(text || '')];
    },
  };
}

function getCalledDrawingSurfaceMethods(calls, label) {
  return Array.from(new Set(calls.filter((call) => call[0] === label).map((call) => call[1]))).sort();
}

test('CivilizationCanvasRenderer prefers explicit drawing surface over proxy fallback host', () => {
  const calls = [];
  const explicitSurface = createDrawingSurfaceSentinel('explicit', calls);
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  const renderer = new CivilizationCanvasRenderer({
    host: fallbackHost,
    drawingSurface: explicitSurface,
  });

  renderer.renderCivilization({ tutorial: { step: 'civ' } }, 100, 460, { canOpenCivilizationTab: true });

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'explicit'), CIVILIZATION_DRAWING_METHODS);
  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), []);
});

test('CivilizationCanvasRenderer falls back to host drawing surface when none is injected', () => {
  const calls = [];
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  const renderer = new CivilizationCanvasRenderer({ host: fallbackHost });

  renderer.renderCivilization({ tutorial: { step: 'civ' } }, 100, 460, { canOpenCivilizationTab: true });

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), CIVILIZATION_DRAWING_METHODS);
});

test('CivilizationCanvasRenderer reads dynamic host presenter through explicit getter', () => {
  const firstPresenter = createHost().presenter;
  const secondPresenter = createHost({ viewOverrides: { disabled: true } }).presenter;
  const host = createHost({ presenter: firstPresenter });
  const renderer = new CivilizationCanvasRenderer({ host });

  assert.equal(renderer.presenter, firstPresenter);

  host.presenter = secondPresenter;

  assert.equal(renderer.presenter, secondPresenter);
});

test('CivilizationCanvasRenderer does not proxy unknown host properties', () => {
  const host = createHost({
    someRandomProp: 'host-only',
  });
  const renderer = new CivilizationCanvasRenderer({ host });

  assert.equal(host.someRandomProp, 'host-only');
  assert.equal(renderer.someRandomProp, undefined);
});

test('CivilizationCanvasRenderer renders overview, era and feature areas', () => {
  const host = createHost();
  const renderer = new CivilizationCanvasRenderer({ host });

  renderer.renderCivilization({ tutorial: { step: 'civ' } }, 100, 460, { canOpenCivilizationTab: true });

  assert.equal(host.presenterArgs.options.canOpenCivilizationTab, true);
  assert.ok(host.calls.filter((call) => call[0] === 'drawPanel').length >= 4);
  assert.equal(host.calls.some((call) => call[0] === 'renderSectionHeader' && call[1] === '时代进阶'), true);
  assert.equal(host.calls.some((call) => call[0] === 'renderSectionHeader' && call[1] === '当前时代特性'), true);
  // Era progress goes through ModalPlateRenderer.drawModalProgressBar: the
  // 50% fill panel is exactly half of the 312px track (contentWidth 360).
  assert.equal(host.calls.some((call) => call[0] === 'drawPanel' && call[3] === 312), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawPanel' && call[3] === 156), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'advanceEra' && target.action.disabled === false), true);
});

test('CanvasGameRenderer exposes civilization rendering through facade', () => {
  class StubCivilizationRenderer {
    constructor(options) {
      this.host = options.host;
    }

    renderCivilization(...args) {
      return { host: this.host, args };
    }
  }

  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    civilizationRendererClass: StubCivilizationRenderer,
  });
  const state = { civilization: { era: 1 } };
  const options = { canOpenCivilizationTab: false };

  const result = renderer.renderCivilization(state, 120, 240, options);

  assert.equal(result.host, renderer);
  assert.deepEqual(result.args, [state, 120, 240, options]);
});

test('CivilizationCanvasRenderer preserves disabled advance hit target contract', () => {
  const host = createHost({ viewOverrides: { disabled: true } });
  const renderer = new CivilizationCanvasRenderer({ host });

  renderer.renderCivilization({}, 100, 420, {});

  const advanceTarget = host.hitTargets.find((target) => target.action.type === 'advanceEra');
  assert.equal(advanceTarget.action.disabled, true);
  // Advance button paints through ModalPlateRenderer (disabled grey face +
  // token disabled label color); the label still lands via drawText.
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === 'Locked'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawButton'), false);
});
