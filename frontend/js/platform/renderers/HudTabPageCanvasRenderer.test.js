const test = require('node:test');
const assert = require('node:assert/strict');

const HudTabPageCanvasRenderer = require('./HudTabPageCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

function createHost(overrides = {}) {
  const calls = [];
  const host = {
    width: 390,
    height: 844,
    viewportOffsetY: 0,
    bottomSafeArea: 12,
    calls,
    getTransitionFrame(frame) {
      calls.push(['getTransitionFrame', frame]);
      return frame?.ready ? { direction: frame.direction ?? 1, eased: frame.eased ?? 0.5 } : null;
    },
    renderBuildings(...args) { calls.push(['renderBuildings', args]); },
    renderCivilization(...args) { calls.push(['renderCivilization', args]); },
    renderEvents(...args) { calls.push(['renderEvents', args]); },
    renderMapHomeWorldView(...args) { calls.push(['renderMapHomeWorldView', args]); return true; },
    renderMilitary(...args) { calls.push(['renderMilitary', args]); },
    renderPopulation(...args) { calls.push(['renderPopulation', args]); return 220; },
    renderTech(...args) { calls.push(['renderTech', args]); },
    withSlideClip(...args) {
      const callback = args.at(-1);
      calls.push(['withSlideClip', args.slice(0, -1)]);
      return callback();
    },
    withSuppressedHitTargets(callback) {
      calls.push(['withSuppressedHitTargets']);
      return callback();
    },
    ...overrides,
  };
  return host;
}

function callNames(host) {
  return host.calls.map((call) => call[0]);
}

test('HudTabPageCanvasRenderer preserves main panel tab dispatch', () => {
  const host = createHost();
  const renderer = new HudTabPageCanvasRenderer({ host });
  const options = {
    buildingOffset: 20,
    buildingTransition: { eased: 0.2 },
    activeBuildingCategory: 'housing',
  };

  renderer.renderMainPanel({ cityState: {} }, 'buildings', 100, 240, options);
  renderer.renderMainPanel({}, 'events', 110, 230, options);
  renderer.renderMainPanel({}, 'tech', 120, 220, options);
  renderer.renderMainPanel({}, 'civilization', 130, 210, options);
  renderer.renderMainPanel({}, 'military', 140, 200, options);

  assert.deepEqual(callNames(host), ['renderBuildings', 'renderEvents', 'renderTech', 'renderCivilization', 'renderMilitary']);
  assert.equal(host.calls[0][1][3].offset, 20);
  assert.equal(host.calls[0][1][3].activeBuildingCategory, 'housing');
});

test('HudTabPageCanvasRenderer preserves resource and content tab layouts', () => {
  const host = createHost({ height: 844, bottomSafeArea: 12 });
  const renderer = new HudTabPageCanvasRenderer({ host });

  renderer.renderHudTabPage({ tutorial: { step: 1 } }, 'resources', 96, {});
  renderer.renderHudTabPage({ tutorial: { step: 2 } }, 'buildings', 96, { tutorial: { step: 3 }, buildingOffset: 8 });
  renderer.renderHudTabPage({}, 'civilization', 96, { tutorial: { step: 4 } });
  renderer.renderHudTabPage({}, 'military', 96, {});

  assert.deepEqual(callNames(host), ['renderBuildings', 'renderCivilization', 'renderMilitary']);
  assert.equal(host.calls[0][1][0].tutorial.step, 3);
  assert.equal(host.calls[0][1][2], 664);
  assert.equal(host.calls[1][1][2], 664);
  assert.equal(host.calls[2][1][2], 664);
});

test('HudTabPageCanvasRenderer preserves map-home military behavior', () => {
  const drawHost = createHost();
  const drawRenderer = new HudTabPageCanvasRenderer({ host: drawHost });
  drawRenderer.renderHudTabPage({}, 'military', 96, { isMapHome: true });

  assert.deepEqual(callNames(drawHost), ['renderMapHomeWorldView']);

  const skipHost = createHost();
  const skipRenderer = new HudTabPageCanvasRenderer({ host: skipHost });
  skipRenderer.renderHudTabPage({}, 'military', 96, { isMapHome: true, skipWorldMapLayer: true });

  assert.deepEqual(skipHost.calls, []);
});

test('HudTabPageCanvasRenderer preserves page transition flow', () => {
  const host = createHost();
  const renderer = new HudTabPageCanvasRenderer({ host });
  const transition = {
    ready: true,
    fromTab: 'buildings',
    toTab: 'tech',
    direction: -1,
    eased: 0.25,
    fromBuildingOffset: 44,
  };

  renderer.renderHudTabPageWithTransition({}, 'tech', 96, {
    pageTransition: transition,
    buildingOffset: 8,
    buildingTransition: { active: true },
  });

  assert.equal(host.calls.filter((call) => call[0] === 'withSlideClip').length, 2);
  assert.equal(host.calls.some((call) => call[0] === 'withSuppressedHitTargets'), true);
  const buildingCall = host.calls.find((call) => call[0] === 'renderBuildings');
  const techCall = host.calls.find((call) => call[0] === 'renderTech');
  assert.equal(buildingCall[1][3].offset, 44);
  assert.equal(buildingCall[1][3].buildingTransition, null);
  assert.ok(techCall);
});

test('HudTabPageCanvasRenderer falls back to direct render without valid transition', () => {
  const host = createHost();
  const renderer = new HudTabPageCanvasRenderer({ host });

  renderer.renderHudTabPageWithTransition({}, 'events', 96, { pageTransition: { fromTab: 'tech', toTab: 'events' } });

  assert.deepEqual(callNames(host), ['getTransitionFrame', 'renderEvents']);
});

test('HudTabPageCanvasRenderer reads host layout state dynamically after proxy removal', () => {
  const host = createHost({
    bottomSafeArea: 12,
    height: 844,
    viewportOffsetY: 0,
    width: 390,
  });
  const renderer = new HudTabPageCanvasRenderer({ host });

  assert.equal(renderer.bottomSafeArea, 12);
  assert.equal(renderer.height, 844);
  assert.equal(renderer.viewportOffsetY, 0);
  assert.equal(renderer.width, 390);

  host.bottomSafeArea = 24;
  host.height = 900;
  host.viewportOffsetY = 18;
  host.width = 512;

  assert.equal(renderer.bottomSafeArea, 24);
  assert.equal(renderer.height, 900);
  assert.equal(renderer.viewportOffsetY, 18);
  assert.equal(renderer.width, 512);
});

test('HudTabPageCanvasRenderer does not proxy unknown host properties after proxy removal', () => {
  const host = createHost({ someRandomProp: 'host-only' });
  const renderer = new HudTabPageCanvasRenderer({ host });

  assert.equal(renderer.someRandomProp, undefined);
});

test('HudTabPageCanvasRenderer delegates host methods explicitly after proxy removal', () => {
  const calls = [];
  const callbackResult = { callback: true };
  const host = {
    getTransitionFrame(...args) {
      calls.push(['getTransitionFrame', args]);
      return { sentinel: 'transition' };
    },
    renderBuildings(...args) {
      calls.push(['renderBuildings', args]);
      return { sentinel: 'buildings' };
    },
    renderCivilization(...args) {
      calls.push(['renderCivilization', args]);
      return { sentinel: 'civilization' };
    },
    renderEvents(...args) {
      calls.push(['renderEvents', args]);
      return { sentinel: 'events' };
    },
    renderMapHomeWorldView(...args) {
      calls.push(['renderMapHomeWorldView', args]);
      return { sentinel: 'map-home' };
    },
    renderMilitary(...args) {
      calls.push(['renderMilitary', args]);
      return { sentinel: 'military' };
    },
    renderTech(...args) {
      calls.push(['renderTech', args]);
      return { sentinel: 'tech' };
    },
    withSlideClip(...args) {
      calls.push(['withSlideClip', args]);
      const callback = args.at(-1);
      return callback();
    },
    withSuppressedHitTargets(...args) {
      calls.push(['withSuppressedHitTargets', args]);
      const callback = args[0];
      return callback();
    },
  };
  const renderer = new HudTabPageCanvasRenderer({ host });
  const callback = () => callbackResult;

  assert.deepEqual(renderer.getTransitionFrame({ ready: true }), { sentinel: 'transition' });
  assert.deepEqual(renderer.renderBuildings('state', 1, 2), { sentinel: 'buildings' });
  assert.deepEqual(renderer.renderCivilization('state', 1, 2), { sentinel: 'civilization' });
  assert.deepEqual(renderer.renderEvents('state', 1, 2), { sentinel: 'events' });
  assert.deepEqual(renderer.renderMapHomeWorldView('state', 1, {}), { sentinel: 'map-home' });
  assert.deepEqual(renderer.renderMilitary('state', 1, 2), { sentinel: 'military' });
  assert.deepEqual(renderer.renderTech('state', 1, 2), { sentinel: 'tech' });
  assert.equal(renderer.withSlideClip(0, 1, 2, 3, 4, callback), callbackResult);
  assert.equal(renderer.withSuppressedHitTargets(callback), callbackResult);

  assert.deepEqual(calls, [
    ['getTransitionFrame', [{ ready: true }]],
    ['renderBuildings', ['state', 1, 2]],
    ['renderCivilization', ['state', 1, 2]],
    ['renderEvents', ['state', 1, 2]],
    ['renderMapHomeWorldView', ['state', 1, {}]],
    ['renderMilitary', ['state', 1, 2]],
    ['renderTech', ['state', 1, 2]],
    ['withSlideClip', [0, 1, 2, 3, 4, callback]],
    ['withSuppressedHitTargets', [callback]],
  ]);
});

test('CanvasGameRenderer exposes HUD tab page rendering through facade', () => {
  class StubHudTabPageRenderer {
    constructor(options) {
      this.host = options.host;
    }

    renderMainPanel(...args) {
      return { method: 'renderMainPanel', host: this.host, args };
    }

    renderHudTabPageWithTransition(...args) {
      return { method: 'renderHudTabPageWithTransition', host: this.host, args };
    }
  }

  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    hudTabPageRendererClass: StubHudTabPageRenderer,
  });
  const state = { resources: {} };

  const panel = renderer.renderMainPanel(state, 'tech', 120, 200, {});
  const transition = renderer.renderHudTabPageWithTransition(state, 'tech', 96, {});

  assert.equal(panel.host, renderer);
  assert.equal(panel.method, 'renderMainPanel');
  assert.equal(transition.method, 'renderHudTabPageWithTransition');
});
