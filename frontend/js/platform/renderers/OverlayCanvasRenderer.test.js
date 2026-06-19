const test = require('node:test');
const assert = require('node:assert/strict');

const OverlayCanvasRenderer = require('./OverlayCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

function createHost(overrides = {}) {
  const hitTargets = [];
  const calls = [];
  const host = {
    width: 390,
    height: 844,
    ctx: {
      globalAlpha: 1,
      fillRect(...args) { calls.push(['fillRect', ...args]); },
      beginPath() { calls.push(['beginPath']); },
      arc(...args) { calls.push(['arc', ...args]); },
      fill() { calls.push(['fill']); },
    },
    presenter: {
      buildResourceViewState() {
        return createResourceView();
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
    drawTextLines(lines) { calls.push(['drawTextLines', lines]); },
    getLayout() { return { contentX: 10, contentWidth: 360, contentRight: 370 }; },
    getNow() { return 1900; },
    measureTextWidth(text) { return String(text || '').length * 8; },
    truncateText(text) { return String(text || ''); },
    wrapTextLimit(text) { return [String(text || '')]; },
    ...overrides,
  };
  return host;
}

function createResourceView() {
  return {
    text: {
      woodDetailValue: '10',
      woodDetailRate: '+1',
      ironDetailValue: '5',
      ironDetailRate: '+0',
      stoneDetailValue: '8',
      stoneDetailRate: '+1',
      foodDetailValue: '20',
      foodOutputRate: '+2',
      foodConsumptionRate: '-1',
      foodNetRate: '+1',
      knowledgeDetailValue: '3',
      knowledgeDetailRate: '+1',
    },
  };
}

const OVERLAY_DRAWING_METHODS = [
  'addHitTarget',
  'createGradient',
  'drawAsset',
  'drawButton',
  'drawPanel',
  'drawText',
  'drawTextLines',
  'getLayout',
  'getNow',
  'measureTextWidth',
  'truncateText',
  'wrapTextLimit',
];

function createDrawingSurfaceSentinel(label, calls = []) {
  return {
    width: 390,
    height: 844,
    ctx: {
      globalAlpha: 1,
      fillRect() {},
      beginPath() {},
      arc() {},
      fill() {},
    },
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
    getNow() {
      calls.push([label, 'getNow']);
      return 1900;
    },
    measureTextWidth(text) {
      calls.push([label, 'measureTextWidth', text]);
      return String(text || '').length * 8;
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

function renderOverlaySentinelPaths(renderer, fallbackHost) {
  fallbackHost.presenter = createHost().presenter;
  renderer.renderNamingModal({
    visible: true,
    inputValue: 'Harbor',
    submitting: false,
    view: { title: 'Name city', message: 'Pick a name.', placeholder: 'City name' },
  });
  renderer.renderFloatingTexts([{ text: '+10 wood', progress: 0.25, color: '#fff' }]);
  renderer.renderRewardReveal({ title: 'Reward', subtitle: 'Task', rewardText: '+10 wood', createdAt: 1000 });
  renderer.renderResourceDetailsPanel({});
}

test('OverlayCanvasRenderer prefers explicit drawing surface over proxy fallback host', () => {
  const calls = [];
  const explicitSurface = createDrawingSurfaceSentinel('explicit', calls);
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  const renderer = new OverlayCanvasRenderer({
    host: fallbackHost,
    drawingSurface: explicitSurface,
  });

  renderOverlaySentinelPaths(renderer, fallbackHost);

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'explicit'), OVERLAY_DRAWING_METHODS);
  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), []);
});

test('OverlayCanvasRenderer falls back to host drawing surface when none is injected', () => {
  const calls = [];
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  const renderer = new OverlayCanvasRenderer({ host: fallbackHost });

  renderOverlaySentinelPaths(renderer, fallbackHost);

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), OVERLAY_DRAWING_METHODS);
});

test('OverlayCanvasRenderer reads dynamic host state through explicit getters', () => {
  const firstCtx = { fillRect() {}, beginPath() {}, arc() {}, fill() {}, globalAlpha: 1 };
  const secondCtx = { fillRect() {}, beginPath() {}, arc() {}, fill() {}, globalAlpha: 1 };
  const firstPresenter = createHost().presenter;
  const secondPresenter = createHost().presenter;
  const host = createHost({
    width: 390,
    height: 844,
    ctx: firstCtx,
    presenter: firstPresenter,
  });
  const renderer = new OverlayCanvasRenderer({ host });

  assert.equal(renderer.width, 390);
  assert.equal(renderer.height, 844);
  assert.equal(renderer.ctx, firstCtx);
  assert.equal(renderer.presenter, firstPresenter);

  host.width = 512;
  host.height = 900;
  host.ctx = secondCtx;
  host.presenter = secondPresenter;

  assert.equal(renderer.width, 512);
  assert.equal(renderer.height, 900);
  assert.equal(renderer.ctx, secondCtx);
  assert.equal(renderer.presenter, secondPresenter);
});

test('OverlayCanvasRenderer does not proxy unknown host properties', () => {
  const host = createHost({
    someRandomProp: 'host-only',
  });
  const renderer = new OverlayCanvasRenderer({ host });

  assert.equal(host.someRandomProp, 'host-only');
  assert.equal(renderer.someRandomProp, undefined);
});

test('OverlayCanvasRenderer preserves naming modal hit target contract', () => {
  const host = createHost();
  const renderer = new OverlayCanvasRenderer({ host });

  renderer.renderNamingModal({
    visible: true,
    inputValue: 'Harbor',
    submitting: false,
    view: { title: 'Name city', message: 'Pick a name.', placeholder: 'City name' },
  });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeNaming'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'blockCanvasModal'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'requestNamingInput'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'submitNaming' && target.action.disabled === false), true);
});

test('OverlayCanvasRenderer disables empty naming submit', () => {
  const host = createHost();
  const renderer = new OverlayCanvasRenderer({ host });

  renderer.renderNamingModal({
    visible: true,
    inputValue: '',
    view: { title: 'Name city', message: 'Pick a name.' },
  });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'submitNaming' && target.action.disabled === true), true);
});

test('OverlayCanvasRenderer preserves resource details modal contract', () => {
  const host = createHost();
  const renderer = new OverlayCanvasRenderer({ host });

  renderer.renderResourceDetailsPanel({});

  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeResourceDetails'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'blockCanvasModal'), true);
  assert.equal(host.calls.filter((call) => call[0] === 'drawAsset').length, 5);
});

test('OverlayCanvasRenderer preserves floating text and reward reveal feedback', () => {
  const host = createHost();
  const renderer = new OverlayCanvasRenderer({ host });

  renderer.renderFloatingTexts([{ text: '+10 wood', progress: 0.25, color: '#fff' }]);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === '+10 wood'), true);
  assert.equal(host.ctx.globalAlpha, 1);

  host.hitTargets.length = 0;
  renderer.renderRewardReveal({ title: 'Reward', subtitle: 'Task', rewardText: '+10 wood', createdAt: 1000 });
  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeRewardReveal'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'blockCanvasModal'), true);
  assert.equal(host.calls.some((call) => call[0] === 'arc'), true);
});

test('CanvasGameRenderer exposes overlay rendering through facade', () => {
  class StubOverlayRenderer {
    constructor(options) {
      this.host = options.host;
    }

    renderRewardReveal(...args) {
      return { host: this.host, args };
    }
  }

  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    overlayRendererClass: StubOverlayRenderer,
  });
  const reveal = { rewardText: '+10 wood' };

  const result = renderer.renderRewardReveal(reveal);

  assert.equal(result.host, renderer);
  assert.deepEqual(result.args, [reveal]);
});
