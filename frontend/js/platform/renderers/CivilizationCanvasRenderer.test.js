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
    drawPanel() { calls.push(['drawPanel']); },
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

test('CivilizationCanvasRenderer renders overview, era and feature areas', () => {
  const host = createHost();
  const renderer = new CivilizationCanvasRenderer({ host });

  renderer.renderCivilization({ tutorial: { step: 'civ' } }, 100, 460, { canOpenCivilizationTab: true });

  assert.equal(host.presenterArgs.options.canOpenCivilizationTab, true);
  assert.ok(host.calls.filter((call) => call[0] === 'drawPanel').length >= 4);
  assert.equal(host.calls.some((call) => call[0] === 'renderSectionHeader' && call[1] === '时代进阶'), true);
  assert.equal(host.calls.some((call) => call[0] === 'renderSectionHeader' && call[1] === '当前时代特性'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawProgressBar' && call[1] === 50), true);
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
  const buttonCall = host.calls.find((call) => call[0] === 'drawButton' && call[1] === 'Locked');
  assert.equal(buttonCall[2].disabled, true);
  assert.equal(buttonCall[2].active, false);
});
