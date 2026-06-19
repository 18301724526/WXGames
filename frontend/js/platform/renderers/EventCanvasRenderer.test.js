const test = require('node:test');
const assert = require('node:assert/strict');

const EventCanvasRenderer = require('./EventCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

function createCtx(calls = []) {
  return {
    fillRect(...args) { calls.push(['fillRect', ...args]); },
    globalAlpha: 1,
  };
}

function createHost(overrides = {}) {
  const hitTargets = [];
  const calls = [];
  const host = {
    width: 390,
    height: 844,
    ctx: createCtx(calls),
    presenter: {
      buildEventViewState() {
        return createEventView();
      },
      buildEventModalViewState() {
        return createEventModalView();
      },
    },
    hitTargets,
    calls,
    addHitTarget(rect, action) { hitTargets.push({ rect, action }); },
    createGradient() { return '#123'; },
    drawAsset() { calls.push(['drawAsset']); return false; },
    drawButton(x, y, width, height, label, options = {}) { calls.push(['drawButton', label, options]); },
    drawLine() {},
    drawPanel() { calls.push(['drawPanel']); },
    drawText(text) { calls.push(['drawText', text]); },
    drawTextLines(lines) { calls.push(['drawTextLines', lines]); },
    getLayout() { return { contentX: 10, contentWidth: 360, contentRight: 370 }; },
    measureTextWidth(text) { return String(text || '').length * 8; },
    renderSectionHeader(title) { calls.push(['renderSectionHeader', title]); },
    resourceIconPath(resource) { return resource === 'food' ? 'assets/art/icon-food-cutout.webp' : ''; },
    resourceShortName(resource) { return resource === 'food' ? 'Food' : String(resource || ''); },
    truncateText(text) { return String(text || ''); },
    wrapTextLimit(text) { return [String(text || '')]; },
    ...overrides,
  };
  return host;
}

function createEventView() {
  return {
    badge: { hidden: false, text: '1' },
    pending: {
      isEmpty: false,
      cards: [{
        id: 'event-1',
        title: 'Harvest',
        description: 'A good harvest.',
        hint: 'Choose a reward',
        classState: {},
        iconAsset: 'assets/art/icon-event-cutout.webp',
      }],
    },
    history: {
      isEmpty: false,
      items: [{
        title: 'Old Event',
        result: 'Done',
        className: 'normal',
        iconAsset: 'assets/art/icon-event-cutout.webp',
      }],
    },
  };
}

function createEventModalView() {
  return {
    showModal: true,
    iconAsset: 'assets/art/icon-event-cutout.webp',
    text: {
      title: 'Harvest',
      description: 'Choose how to spend the harvest.',
      reward: '+10 food',
    },
    metaRows: [{ label: 'Reward', text: '+10 food', tone: 'reward' }],
    claimButton: { optionId: 'claim', label: 'Claim' },
    options: [{
      id: 'food',
      label: 'Take food',
      preview: '+10 food',
      rows: [{ label: 'Gain', tone: 'reward', parts: [{ type: 'resource', resource: 'food', text: '+10' }] }],
    }],
  };
}

const EVENT_DRAWING_METHODS = [
  'addHitTarget',
  'createGradient',
  'drawAsset',
  'drawButton',
  'drawLine',
  'drawPanel',
  'drawText',
  'drawTextLines',
  'getLayout',
  'measureTextWidth',
  'renderSectionHeader',
  'resourceIconPath',
  'resourceShortName',
  'truncateText',
  'wrapTextLimit',
];

function createDrawingSurfaceSentinel(label, calls = []) {
  return {
    width: 390,
    height: 844,
    ctx: createCtx(),
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
    measureTextWidth(text) {
      calls.push([label, 'measureTextWidth', text]);
      return String(text || '').length * 8;
    },
    renderSectionHeader(title) {
      calls.push([label, 'renderSectionHeader', title]);
    },
    resourceIconPath(resource) {
      calls.push([label, 'resourceIconPath', resource]);
      return resource === 'food' ? 'assets/art/icon-food-cutout.webp' : '';
    },
    resourceShortName(resource) {
      calls.push([label, 'resourceShortName', resource]);
      return resource === 'food' ? 'Food' : String(resource || '');
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

function renderEventSentinelPaths(renderer, fallbackHost) {
  renderer.presenter = fallbackHost.presenter;
  renderer.renderEvents({}, 100, 320);
  renderer.renderEventModal({ eventQueue: [{ id: 'event-1' }] }, 'event-1');
}

test('EventCanvasRenderer prefers explicit drawing surface over proxy fallback host', () => {
  const calls = [];
  const explicitSurface = createDrawingSurfaceSentinel('explicit', calls);
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  const renderer = new EventCanvasRenderer({
    host: fallbackHost,
    drawingSurface: explicitSurface,
  });

  renderEventSentinelPaths(renderer, fallbackHost);

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'explicit'), EVENT_DRAWING_METHODS);
  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), []);
});

test('EventCanvasRenderer falls back to host drawing surface when none is injected', () => {
  const calls = [];
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  const renderer = new EventCanvasRenderer({ host: fallbackHost });

  renderEventSentinelPaths(renderer, fallbackHost);

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), EVENT_DRAWING_METHODS);
});

test('EventCanvasRenderer owns event row color and resource part drawing', () => {
  const host = createHost();
  const renderer = new EventCanvasRenderer({ host });

  assert.equal(renderer.eventRowColor('reward'), '#74d3a0');
  assert.equal(renderer.eventRowColor('missing'), '#cbbd96');
  renderer.drawEventParts([{ type: 'resource', resource: 'food', text: '+10' }], 10, 20, 100, { size: 10 });

  assert.equal(host.calls.some((call) => call[0] === 'drawAsset'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === '+10'), true);
});

test('CanvasGameRenderer exposes event helpers through the event renderer facade', () => {
  const renderer = new CanvasGameRenderer({
    ctx: {
      fillText() {},
      measureText(text) { return { width: String(text || '').length * 8 }; },
    },
    presenter: {},
    eventRendererClass: EventCanvasRenderer,
  });

  assert.equal(renderer.eventRowColor('penalty'), '#ff9aa2');
  assert.equal(renderer.drawEventDetailRow({ label: 'Reward', text: 'Food', tone: 'reward' }, 0, 0, 120), 15);
});

test('EventCanvasRenderer preserves event list hit target contract', () => {
  const host = createHost();
  const renderer = new EventCanvasRenderer({ host });

  renderer.renderEvents({}, 100, 320);

  assert.equal(host.hitTargets.some((target) => target.action.type === 'openEvent' && target.action.eventId === 'event-1'), true);
});

test('EventCanvasRenderer preserves event modal close and claim hit targets', () => {
  const host = createHost();
  const renderer = new EventCanvasRenderer({ host });

  renderer.renderEventModal({ eventQueue: [{ id: 'event-1' }] }, 'event-1');

  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeEvent'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'claimEvent' && target.action.optionId === 'food'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'blockCanvasModal'), true);
});
