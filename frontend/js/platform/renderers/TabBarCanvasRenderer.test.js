const test = require('node:test');
const assert = require('node:assert/strict');

const TabBarCanvasRenderer = require('./TabBarCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

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
