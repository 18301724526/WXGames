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
