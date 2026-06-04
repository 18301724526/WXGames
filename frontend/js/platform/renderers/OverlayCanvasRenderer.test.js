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
