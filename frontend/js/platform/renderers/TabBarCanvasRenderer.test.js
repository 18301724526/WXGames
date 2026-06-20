const test = require('node:test');
const assert = require('node:assert/strict');

const TabBarCanvasRenderer = require('./TabBarCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

const DRAWING_WRAPPER_METHODS = [
  'addHitTarget',
  'createGradient',
  'drawAsset',
  'drawPanel',
  'drawText',
  'getLayout',
];

function createHost(overrides = {}) {
  const hitTargets = [];
  const calls = [];
  const host = {
    width: 390,
    height: 844,
    ctx: {
      fillRect(...args) { calls.push(['fillRect', ...args]); },
      globalAlpha: 1,
      fillStyle: '',
    },
    hitTargets,
    calls,
    presenter: {
      buildEventViewState(input) {
        calls.push(['buildEventViewState', input]);
        return { badge: { hidden: true } };
      },
    },
    addHitTarget(rect, action) { hitTargets.push({ rect, action }); },
    createGradient() { return '#123'; },
    drawAsset(assetPath) { calls.push(['drawAsset', assetPath]); return true; },
    drawPanel(...args) { calls.push(['drawPanel', ...args]); },
    drawText(text, x, y, options = {}) { calls.push(['drawText', text, options]); },
    getLayout() { return { contentX: 10, contentWidth: 360, contentRight: 370 }; },
    renderMapCommandDock(...args) { calls.push(['renderMapCommandDock', args]); },
    ...overrides,
  };
  return host;
}

function createDrawingSurfaceSentinel(label, calls) {
  return {
    addHitTarget(...args) { calls.push([label, 'addHitTarget', args]); },
    createGradient(...args) { calls.push([label, 'createGradient', args]); return `${label}-gradient`; },
    drawAsset(...args) { calls.push([label, 'drawAsset', args]); return `${label}-asset`; },
    drawPanel(...args) { calls.push([label, 'drawPanel', args]); },
    drawText(...args) { calls.push([label, 'drawText', args]); },
    getLayout(...args) {
      calls.push([label, 'getLayout', args]);
      return { contentX: 12, contentWidth: 240, contentRight: 252 };
    },
  };
}

function getCalledDrawingSurfaceMethods(calls, label) {
  return calls.filter((call) => call[0] === label).map((call) => call[1]);
}

test('TabBarCanvasRenderer preserves standard tab hit targets', () => {
  const host = createHost();
  const renderer = new TabBarCanvasRenderer({ host });

  renderer.renderTabs('tech', { resources: {} }, {});

  assert.deepEqual(
    host.hitTargets.map((target) => target.action.type),
    ['switchTab', 'switchTab', 'switchTab', 'openFamousPersons', 'switchTab'],
  );
  assert.deepEqual(
    host.hitTargets.filter((target) => target.action.type === 'switchTab').map((target) => target.action.tab),
    ['resources', 'tech', 'events', 'civilization'],
  );
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openFamousPersons'), true);
});

test('TabBarCanvasRenderer preserves locked tab disabled state', () => {
  const host = createHost();
  const renderer = new TabBarCanvasRenderer({ host });

  renderer.renderTabs('resources', {}, { tabLocks: [{ id: 'tech', disabled: true }, { id: 'famousPersons', isLocked: true }] });

  const techTarget = host.hitTargets.find((target) => target.action.tab === 'tech');
  const famousTarget = host.hitTargets.find((target) => target.action.type === 'openFamousPersons');

  assert.equal(techTarget.action.disabled, true);
  assert.equal(famousTarget.action.disabled, true);
  assert.equal(host.ctx.globalAlpha, 1);
});

test('TabBarCanvasRenderer preserves event badge drawing contract', () => {
  const host = createHost({
    presenter: {
      buildEventViewState(input) {
        host.calls.push(['buildEventViewState', input]);
        return { badge: { hidden: false, text: '3' } };
      },
    },
  });
  const renderer = new TabBarCanvasRenderer({ host });

  renderer.renderTabs('events', { events: [] }, {});

  assert.equal(host.calls.some((call) => call[0] === 'drawPanel' && call[5]?.radius === 9), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === '3' && call[2].baseline === 'middle'), true);
});

test('TabBarCanvasRenderer delegates map-home tabs to command dock', () => {
  const host = createHost();
  const renderer = new TabBarCanvasRenderer({ host });
  const state = { cityState: {} };
  const options = { isMapHome: true, activeCommandPanel: 'tech' };

  renderer.renderTabs('resources', state, options);

  assert.deepEqual(host.calls, [['renderMapCommandDock', [state, options]]]);
  assert.deepEqual(host.hitTargets, []);
});

test('TabBarCanvasRenderer reads host state dynamically after proxy removal', () => {
  const host = createHost();
  const renderer = new TabBarCanvasRenderer({ host });
  const nextCtx = { globalAlpha: 1 };
  const nextPresenter = { buildEventViewState: () => ({ badge: { hidden: true } }) };

  host.height = 912;
  host.presenter = nextPresenter;
  host.ctx = nextCtx;

  assert.equal(renderer.height, 912);
  assert.equal(renderer.presenter, nextPresenter);
  assert.equal(renderer.ctx, nextCtx);
});

test('TabBarCanvasRenderer does not proxy unknown host properties after proxy removal', () => {
  const host = createHost({ someRandomProp: 'host-only' });
  const renderer = new TabBarCanvasRenderer({ host });

  assert.equal(renderer.someRandomProp, undefined);
});

test('TabBarCanvasRenderer drawing wrappers prefer explicit drawing surface over host fallback', () => {
  const calls = [];
  const explicitSurface = createDrawingSurfaceSentinel('explicit', calls);
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  const renderer = new TabBarCanvasRenderer({
    host: {
      ...fallbackHost,
      renderMapCommandDock() {},
    },
    drawingSurface: explicitSurface,
  });

  renderer.addHitTarget({ x: 1 }, { type: 'tab' });
  renderer.createGradient(0, 0, 1, 1, [], '#000');
  renderer.drawAsset('asset.png', 1, 2, 3, 4);
  renderer.drawPanel(1, 2, 3, 4, {});
  renderer.drawText('label', 1, 2, {});
  renderer.getLayout();

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'explicit'), DRAWING_WRAPPER_METHODS);
  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), []);
});

test('TabBarCanvasRenderer delegates command dock rendering to host method', () => {
  const state = { map: true };
  const options = { isMapHome: true };
  const expected = { source: 'host-renderMapCommandDock' };
  const host = createHost({
    renderMapCommandDock(...args) {
      host.calls.push(['renderMapCommandDockResult', args]);
      return expected;
    },
  });
  const renderer = new TabBarCanvasRenderer({ host });

  const result = renderer.renderMapCommandDock(state, options);

  assert.equal(result, expected);
  assert.deepEqual(host.calls, [['renderMapCommandDockResult', [state, options]]]);
});

test('CanvasGameRenderer exposes tab bar rendering through facade', () => {
  class StubTabBarRenderer {
    constructor(options) {
      this.host = options.host;
    }

    renderTabs(...args) {
      return { host: this.host, args };
    }
  }

  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    tabBarRendererClass: StubTabBarRenderer,
  });
  const state = { resources: {} };
  const options = { tabLocks: [] };

  const result = renderer.renderTabs('events', state, options);

  assert.equal(result.host, renderer);
  assert.deepEqual(result.args, ['events', state, options]);
});
