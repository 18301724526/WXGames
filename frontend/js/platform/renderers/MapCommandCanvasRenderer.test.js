const test = require('node:test');
const assert = require('node:assert/strict');

const MapCommandCanvasRenderer = require('./MapCommandCanvasRenderer');
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
      fillStyle: '',
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
    getMapHomeFloatingButtonLayout(slot = 0) {
      const size = 48;
      return { x: 370 - size, y: 700 - slot * 58, size };
    },
    getTopBarBottom() { return 72; },
    renderMainPanel(...args) { calls.push(['renderMainPanel', args]); return true; },
    renderPopulation(...args) { calls.push(['renderPopulation', args]); return 360; },
    truncateText(text) { return String(text || ''); },
    ...overrides,
  };
  return host;
}

test('MapCommandCanvasRenderer preserves dock command hit targets', () => {
  const host = createHost();
  const renderer = new MapCommandCanvasRenderer({ host });

  renderer.renderMapCommandDock({}, { activeCommandPanel: 'tech', showTaskCenter: true });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'openCommandPanel' && target.action.panel === 'tech'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openCommandPanel' && target.action.panel === 'civilization'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openCommandPanel' && target.action.panel === 'military'), false);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openFamousPersons'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openTaskCenter' && target.action.source === 'taskIcon'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openSettings'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawAsset' && call[1].includes('icon-knowledge')), true);
});

test('MapCommandCanvasRenderer preserves floating map button contracts', () => {
  const host = createHost();
  const renderer = new MapCommandCanvasRenderer({ host });

  renderer.renderFloatingSubcityButton({}, { showSubcityList: true });
  renderer.renderFloatingEventButton({}, { activeCommandPanel: 'events' });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'openSubcityList'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openCommandPanel' && target.action.panel === 'events'), true);
});

test('MapCommandCanvasRenderer ignores legacy capital command panel state', () => {
  const host = createHost();
  const renderer = new MapCommandCanvasRenderer({ host });

  renderer.renderMapCommandPanel({ cityState: {} }, { activeCommandPanel: 'capital' });

  assert.equal(host.hitTargets.length, 0);
  assert.equal(host.calls.some((call) => call[0] === 'renderPopulation'), false);
  assert.equal(host.calls.some((call) => call[0] === 'renderHomeFeatureGrid'), false);
  assert.equal(host.calls.some((call) => call[0] === 'renderMainPanel'), false);
});

test('MapCommandCanvasRenderer preserves command panel main-panel delegation', () => {
  const host = createHost();
  const renderer = new MapCommandCanvasRenderer({ host });

  renderer.renderMapCommandPanel({ militaryView: 'world' }, { activeCommandPanel: 'military', activeBuildingCategory: 'housing' });

  const call = host.calls.find((item) => item[0] === 'renderMainPanel');
  assert.ok(call);
  assert.equal(call[1][1], 'military');
  assert.equal(call[1][0].militaryView, 'army');
});

test('CanvasGameRenderer exposes map command rendering through facade', () => {
  class StubMapCommandRenderer {
    constructor(options) {
      this.host = options.host;
    }

    renderMapCommandDock(...args) {
      return { method: 'renderMapCommandDock', host: this.host, args };
    }

    renderMapCommandPanel(...args) {
      return { method: 'renderMapCommandPanel', host: this.host, args };
    }
  }

  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    mapCommandRendererClass: StubMapCommandRenderer,
  });
  const state = { activeCityId: 'capital' };
  const options = { activeCommandPanel: 'tech' };

  const dockResult = renderer.renderMapCommandDock(state, options);
  const panelResult = renderer.renderMapCommandPanel(state, options);

  assert.equal(dockResult.host, renderer);
  assert.equal(dockResult.method, 'renderMapCommandDock');
  assert.deepEqual(dockResult.args, [state, options]);
  assert.equal(panelResult.method, 'renderMapCommandPanel');
});
