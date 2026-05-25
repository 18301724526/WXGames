const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const H5CanvasRuntime = require('../js/platform/H5CanvasRuntime');
global.H5CanvasRuntime = H5CanvasRuntime;
const CanvasGameApp = require('../js/platform/CanvasGameApp');
global.CanvasGameApp = CanvasGameApp;
const CanvasActionDispatcher = require('../js/platform/CanvasActionDispatcher');
global.CanvasActionDispatcher = CanvasActionDispatcher;
const CanvasGameShell = require('../js/platform/CanvasGameShell');

const projectRoot = path.join(__dirname, '..', '..');

function createCanvasHarness() {
  const listeners = {};
  const appended = [];
  const timers = [];
  const ctx = {
    transforms: [],
    setTransform(...args) { this.transforms.push(args); },
  };
  const canvas = {
    id: '',
    width: 0,
    height: 0,
    style: {},
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    getContext(type) {
      assert.equal(type, '2d');
      return ctx;
    },
    addEventListener(type, handler) { listeners[type] = handler; },
    getBoundingClientRect() { return { left: 10, top: 20, width: 390, height: 844 }; },
  };
  const document = {
    documentElement: { clientWidth: 390, clientHeight: 844 },
    body: { appendChild(node) { appended.push(node); } },
    createElement(tag) {
      assert.equal(tag, 'canvas');
      return canvas;
    },
    addEventListener(type, handler) { listeners[`document:${type}`] = handler; },
  };
  const runtime = {
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: 2,
    addEventListener(type, handler) { listeners[`window:${type}`] = handler; },
    setInterval(callback, intervalMs) {
      const timer = { callback, intervalMs };
      timers.push(timer);
      return timer;
    },
    clearInterval(timer) {
      const index = timers.indexOf(timer);
      if (index >= 0) timers.splice(index, 1);
    },
  };
  return { canvas, ctx, document, runtime, listeners, appended, timers };
}

test('H5 canvas runtime creates a non-blocking full viewport canvas', () => {
  const { canvas, ctx, document, runtime, appended } = createCanvasHarness();
  const h5Runtime = new H5CanvasRuntime({ document, runtime });

  const created = h5Runtime.ensureCanvas();

  assert.equal(created, canvas);
  assert.equal(appended.length, 1);
  assert.equal(canvas.id, 'h5CanvasLayer');
  assert.equal(canvas.attributes['aria-hidden'], 'true');
  assert.equal(canvas.style.position, 'fixed');
  assert.equal(canvas.style.pointerEvents, 'auto');
  assert.equal(canvas.style.touchAction, 'none');
  assert.equal(canvas.style.zIndex, '999');
  assert.equal(canvas.style.background, 'transparent');
  assert.equal(canvas.style.height, '100dvh');
  assert.equal(canvas.width, 780);
  assert.equal(canvas.height, 1688);
  assert.deepEqual(ctx.transforms.at(-1), [2, 0, 0, 2, 0, 0]);
});

test('H5 canvas runtime resizes and converts pointer coordinates', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const h5Runtime = new H5CanvasRuntime({ document, runtime });
  const sizes = [];
  const taps = [];

  h5Runtime.onResize((size) => sizes.push(size));
  h5Runtime.onTap((point) => taps.push(point));
  h5Runtime.ensureCanvas();
  runtime.innerWidth = 300;
  runtime.innerHeight = 600;
  runtime.devicePixelRatio = 3;
  listeners['window:resize']();
  listeners.pointerup({ clientX: 205, clientY: 442, type: 'pointerup', timeStamp: 1000 });

  assert.deepEqual(sizes.at(-1), { width: 300, height: 600, pixelRatio: 3 });
  assert.deepEqual(taps.at(-1), { x: 150, y: 300 });
});

test('H5 canvas runtime dispatches drag phases and suppresses tap after movement', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const h5Runtime = new H5CanvasRuntime({ document, runtime });
  const dragEvents = [];
  const taps = [];

  h5Runtime.onDrag((phase, point) => {
    dragEvents.push({ phase, point });
    return true;
  });
  h5Runtime.onTap((point) => taps.push(point));
  h5Runtime.ensureCanvas();

  listeners.pointerdown({ pointerId: 7, clientX: 110, clientY: 220, type: 'pointerdown', cancelable: true, preventDefault() {}, stopPropagation() {} });
  listeners.pointermove({ pointerId: 7, clientX: 140, clientY: 260, type: 'pointermove', cancelable: true, preventDefault() {}, stopPropagation() {} });
  listeners.pointerup({ pointerId: 7, clientX: 140, clientY: 260, type: 'pointerup', cancelable: true, preventDefault() {}, stopPropagation() {} });

  assert.deepEqual(dragEvents.map((event) => event.phase), ['start', 'move', 'end']);
  assert.equal(taps.length, 0);
});

test('H5 canvas runtime emits unified gesture events for wheel and pinch', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const h5Runtime = new H5CanvasRuntime({ document, runtime });
  const gestures = [];
  const prevented = [];

  h5Runtime.onGesture((gesture) => {
    gestures.push(gesture);
    return true;
  });
  h5Runtime.ensureCanvas();

  listeners.wheel({
    clientX: 205,
    clientY: 442,
    deltaY: -120,
    type: 'wheel',
    cancelable: true,
    preventDefault() { prevented.push('wheel'); },
    stopPropagation() {},
  });
  listeners.touchstart({
    touches: [
      { clientX: 100, clientY: 220 },
      { clientX: 180, clientY: 220 },
    ],
    type: 'touchstart',
    cancelable: true,
    preventDefault() {},
  });
  listeners.touchmove({
    touches: [
      { clientX: 90, clientY: 220 },
      { clientX: 200, clientY: 220 },
    ],
    type: 'touchmove',
    cancelable: true,
    preventDefault() { prevented.push('pinch'); },
    stopPropagation() {},
  });

  assert.equal(gestures[0].type, 'wheelZoom');
  assert.ok(gestures[0].scaleDelta > 1);
  assert.deepEqual({ x: Math.round(gestures[0].centerX), y: Math.round(gestures[0].centerY) }, { x: 195, y: 422 });
  assert.equal(gestures[1].type, 'pinchZoom');
  assert.ok(gestures[1].scaleDelta > 1);
  assert.deepEqual({ x: Math.round(gestures[1].centerX), y: Math.round(gestures[1].centerY) }, { x: 135, y: 200 });
  assert.deepEqual(prevented, ['wheel', 'pinch']);
});

test('Canvas game shell mounts runtime without requiring renderer', () => {
  const { document, runtime, appended } = createCanvasHarness();
  const shell = CanvasGameShell.mount({ state: { resources: {} } }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
  });

  assert.ok(shell);
  assert.equal(shell.mounted, true);
  assert.equal(shell.previewEnabled, false);
  assert.equal(shell.inputEnabled, false);
  assert.equal(appended.length, 1);
});

test('Canvas game shell can render read-only HUD preview when explicitly enabled', () => {
  const { document, runtime, appended } = createCanvasHarness();
  const renderCalls = [];
  const renderer = {
    width: 0,
    height: 0,
    pixelRatio: 1,
    render(state, options) {
      renderCalls.push({ state, options });
    },
  };
  const state = { currentTab: 'resources', resources: { food: 10, knowledge: 2 } };
  const shell = CanvasGameShell.mount({ state }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
  });

  assert.ok(shell);
  assert.equal(shell.previewEnabled, true);
  assert.equal(appended.length, 1);
  assert.equal(renderCalls.length, 1);
  assert.deepEqual(renderCalls[0], {
    state,
    options: {
      activeTab: 'resources',
      mode: 'hud',
      showSettings: false,
      showLogs: false,
      showResourceDetails: false,
      showCitySwitcher: false,
      showAdvisor: false,
      showTaskCenter: false,
      activeTaskCenterTab: 'main',
      showGuidebook: false,
      activeGuidebookTab: 'planning',
      showFamousPersons: false,
      showTalentPolicy: false,
      talentPolicyUiState: {},
      logs: [],
      tutorial: {},
      buildingOffset: 0,
      techTreePanX: 0,
      techTreePanY: 0,
      techTreeZoom: 1,
      techDetailOpen: false,
      activeBuildingCategory: 'all',
      activeEventId: null,
      territoryUiState: {},
      tabLocks: [
        { id: 'resources', disabled: false, isLocked: false },
        { id: 'buildings', disabled: false, isLocked: false },
        { id: 'tech', disabled: false, isLocked: false },
        { id: 'events', disabled: false, isLocked: false },
        { id: 'civilization', disabled: false, isLocked: false },
        { id: 'military', disabled: false, isLocked: false },
      ],
      naming: {
        visible: false,
        view: null,
        inputValue: '',
        submitting: false,
      },
      auth: {
        view: {
          loginPanelVisible: false,
          appVisible: true,
          message: '',
        },
        credentials: {
          usernameValue: '',
          passwordValue: '',
          rememberPasswordChecked: false,
        },
      },
      loading: {
        visible: false,
        percentage: 0,
        message: '',
      },
      floatingTexts: [],
      tutorialHighlight: null,
      rewardReveal: null,
    },
  });
  assert.equal(shell.renderReadOnly({ currentTab: 'buildings' }, 'buildings'), true);
  assert.equal(renderCalls.at(-1).options.activeTab, 'buildings');
  assert.equal(renderCalls.at(-1).options.mode, 'hud');
});

test('Canvas game shell keeps preview disabled by default so existing DOM UI remains authoritative', () => {
  const { document, runtime } = createCanvasHarness();
  const renderCalls = [];
  const renderer = { render: (...args) => renderCalls.push(args) };
  const shell = CanvasGameShell.mount({ state: { currentTab: 'resources' } }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
  });

  assert.ok(shell);
  assert.equal(shell.previewEnabled, false);
  assert.equal(shell.inputEnabled, false);
  assert.equal(shell.tapDisposer, null);
  assert.equal(shell.renderReadOnly({ currentTab: 'events' }, 'events'), false);
  assert.equal(renderCalls.length, 0);
});

test('Canvas game shell bridges canvas tab taps only when input is explicitly enabled', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const actions = [];
  const renderer = {
    getHitTarget(point) {
      return point.x > 100 ? { type: 'switchTab', tab: 'buildings' } : null;
    },
    render() {},
  };
  const shell = CanvasGameShell.mount({ state: { currentTab: 'resources' } }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    inputEnabled: true,
    onAction: (action) => {
      actions.push(action);
      return true;
    },
  });

  assert.ok(shell);
  assert.equal(shell.inputEnabled, true);
  assert.equal(typeof shell.tapDisposer, 'function');
  listeners['document:pointerup']({ clientX: 205, clientY: 442 });
  assert.deepEqual(actions, [{ type: 'switchTab', tab: 'buildings' }]);

  shell.setInputEnabled(false);
  assert.equal(shell.inputEnabled, false);
  assert.equal(shell.tapDisposer, null);
  listeners['document:pointerup']({ clientX: 205, clientY: 442 });
  assert.equal(actions.length, 1);
});

test('H5 canvas runtime ignores duplicate compatibility events for the same tap', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const h5Runtime = new H5CanvasRuntime({ document, runtime });
  const taps = [];

  h5Runtime.onTap((point) => {
    taps.push(point);
    return true;
  });
  h5Runtime.ensureCanvas();

  listeners['document:pointerup']({ clientX: 205, clientY: 442, type: 'pointerup', timeStamp: 1000 });
  listeners['document:pointerup']({ clientX: 205, clientY: 442, type: 'pointerup', timeStamp: 1050 });
  listeners['document:pointerup']({ clientX: 205, clientY: 450, type: 'pointerup', timeStamp: 1300 });

  assert.equal(taps.length, 2);
});

test('Canvas game shell can fallback to game.switchTab for canvas tab actions', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const switched = [];
  const renderer = {
    getHitTarget: () => ({ type: 'switchTab', tab: 'events' }),
    render() {},
  };
  const shell = CanvasGameShell.mount({
    state: { currentTab: 'resources' },
    switchTab(tab) { switched.push(tab); },
  }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    inputEnabled: true,
  });

  assert.ok(shell);
  listeners['document:pointerup']({ clientX: 205, clientY: 442 });
  assert.deepEqual(switched, ['events']);
});

test('Canvas game shell owns resource details panel state without DOM adapter', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const renderCalls = [];
  const actions = [{ type: 'openResourceDetails' }, { type: 'closeResourceDetails' }];
  const renderer = {
    getHitTarget: () => actions.shift(),
    render(state, options) { renderCalls.push(options); },
  };
  CanvasGameShell.mount({ state: { currentTab: 'resources', resources: { food: 10 } } }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
  });

  listeners['document:pointerup']({ clientX: 30, clientY: 100, type: 'pointerup', timeStamp: 1000 });
  assert.equal(renderCalls.at(-1).showResourceDetails, true);
  listeners['document:pointerup']({ clientX: 350, clientY: 100, type: 'pointerup', timeStamp: 1300 });
  assert.equal(renderCalls.at(-1).showResourceDetails, false);
});

test('Canvas game shell owns city switcher state and dispatches canvas city selection', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const actions = [{ type: 'openCitySwitcher' }, { type: 'selectCity', cityId: 'site_river' }];
  const renderCalls = [];
  const selected = [];
  const renderer = {
    getHitTarget: () => actions.shift(),
    render(state, options) { renderCalls.push(options); },
  };
  CanvasGameShell.mount({ state: { currentTab: 'resources' } }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
    onAction: (action) => {
      if (action.type === 'selectCity') selected.push(action.cityId);
      return true;
    },
  });

  listeners['document:pointerup']({ clientX: 205, clientY: 155, type: 'pointerup', timeStamp: 1000 });
  assert.equal(renderCalls.at(-1).showCitySwitcher, true);
  listeners['document:pointerup']({ clientX: 205, clientY: 252, type: 'pointerup', timeStamp: 1300 });
  assert.equal(renderCalls.at(-1).showCitySwitcher, false);
  assert.deepEqual(selected, ['site_river']);
});

test('Canvas game shell dispatches every HUD hit action and consumes the event', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const renderCalls = [];
  const prevented = [];
  const renderer = {
    getHitTarget: () => ({ type: 'openAdvisor' }),
    render(state, options) { renderCalls.push(options); },
  };
  CanvasGameShell.mount({ state: { currentTab: 'resources' } }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    presenter: {
      buildAdvisorViewState: () => ({ hidden: false, activeAdvisor: { message: 'Scout north', target: 'tab-military' } }),
    },
    previewEnabled: true,
    inputEnabled: true,
  });

  listeners['document:pointerup']({
    clientX: 205,
    clientY: 442,
    cancelable: true,
    preventDefault() { prevented.push('preventDefault'); },
    stopPropagation() { prevented.push('stopPropagation'); },
  });

  assert.equal(renderCalls.at(-1).showAdvisor, true);
  assert.ok(prevented.includes('preventDefault'));
  assert.ok(prevented.includes('stopPropagation'));
});

test('Canvas game shell owns advisor panel state and dispatches target action', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const actions = [
    { type: 'openAdvisor' },
    { type: 'goToAdvisorTarget' },
    { type: 'openAdvisor' },
    { type: 'closeAdvisor' },
  ];
  const renderCalls = [];
  const goCalls = [];
  const renderer = {
    getHitTarget: () => actions.shift(),
    render(state, options) { renderCalls.push(options); },
  };
  CanvasGameShell.mount({
    state: { currentTab: 'resources', softGuide: { message: 'Scout north', target: 'tab-military' } },
    goToAdvisorTarget() {
      goCalls.push('goToAdvisorTarget');
      return true;
    },
  }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    presenter: {
      buildAdvisorViewState: () => ({ hidden: false, activeAdvisor: { message: 'Scout north', target: 'tab-military' } }),
    },
    previewEnabled: true,
    inputEnabled: true,
  });

  listeners['document:pointerup']({ clientX: 205, clientY: 80, type: 'pointerup', timeStamp: 1000 });
  assert.equal(renderCalls.at(-1).showAdvisor, true);
  listeners['document:pointerup']({ clientX: 205, clientY: 600, type: 'pointerup', timeStamp: 1300 });
  assert.equal(renderCalls.at(-1).showAdvisor, false);
  assert.deepEqual(goCalls, ['goToAdvisorTarget']);
  listeners['document:pointerup']({ clientX: 205, clientY: 80, type: 'pointerup', timeStamp: 1600 });
  assert.equal(renderCalls.at(-1).showAdvisor, true);
  listeners['document:pointerup']({ clientX: 350, clientY: 120, type: 'pointerup', timeStamp: 1900 });
  assert.equal(renderCalls.at(-1).showAdvisor, false);
});

test('Canvas game shell dispatches building actions without DOM adapter', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const actions = [
    { type: 'buildBuilding', buildingId: 'farm' },
    { type: 'upgradeBuilding', buildingId: 'house' },
  ];
  const dispatched = [];
  const renderer = {
    getHitTarget: () => actions.shift(),
    render() {},
  };
  const shell = CanvasGameShell.mount({ state: { currentTab: 'buildings' } }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
    onAction: (action) => {
      dispatched.push(action);
      return true;
    },
  });

  listeners['document:pointerup']({ clientX: 205, clientY: 300, type: 'pointerup', timeStamp: 1000 });
  listeners['document:pointerup']({ clientX: 205, clientY: 390, type: 'pointerup', timeStamp: 1300 });

  assert.deepEqual(dispatched, [
    { type: 'buildBuilding', buildingId: 'farm' },
    { type: 'upgradeBuilding', buildingId: 'house' },
  ]);
});

test('Canvas game shell dispatches era advance without DOM button', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const dispatched = [];
  const renderer = {
    hitTargets: [{ x: 20, y: 220, width: 300, height: 32, action: { type: 'advanceEra' } }],
    getHitTarget: () => ({ type: 'advanceEra' }),
    render() {},
  };
  const shell = CanvasGameShell.mount({ state: { currentTab: 'civilization' } }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
    onAction: (action) => {
      dispatched.push(action);
      return true;
    },
  });

  const target = shell.getTutorialTarget('btn-advance-era');
  assert.deepEqual(target.getBoundingClientRect(), {
    left: 20,
    top: 220,
    width: 300,
    height: 32,
    right: 320,
    bottom: 252,
  });
  listeners['document:pointerup']({ clientX: 205, clientY: 300, type: 'pointerup', timeStamp: 1000 });

  assert.deepEqual(dispatched, [{ type: 'advanceEra' }]);
});

test('Canvas game shell resolves tutorial targets from Canvas hit regions', () => {
  const { document, runtime } = createCanvasHarness();
  const renderCalls = [];
  const renderer = {
    hitTargets: [
      { x: 20, y: 220, width: 300, height: 32, action: { type: 'advanceEra' } },
      { x: 272, y: 786, width: 53, height: 58, action: { type: 'switchTab', tab: 'civilization' } },
      { x: 290, y: 252, width: 78, height: 34, action: { type: 'buildBuilding', buildingId: 'farm' } },
      { x: 290, y: 338, width: 78, height: 34, action: { type: 'buildBuilding', buildingId: 'house' } },
      { x: 290, y: 424, width: 78, height: 34, action: { type: 'buildBuilding', buildingId: 'lumbermill' } },
      { x: 290, y: 510, width: 78, height: 34, action: { type: 'buildBuilding', buildingId: 'barracks' } },
      { x: 346, y: 512, width: 22, height: 22, action: { type: 'assignJob', job: 'craftsman', delta: 1 } },
      { x: 24, y: 164, width: 342, height: 78, action: { type: 'openEvent', eventId: 'evt_settlement_forest_001' } },
      { x: 36, y: 446, width: 318, height: 92, action: { type: 'claimEvent', eventId: 'evt_settlement_forest_001', optionId: 'opt_collect_wood' } },
    ],
    render(state, options) { renderCalls.push(options); },
  };
  const shell = CanvasGameShell.mount({ state: { currentTab: 'civilization' } }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
  });

  assert.deepEqual(shell.getTutorialTarget('tab-civilization').getRect(), {
    left: 272,
    top: 786,
    width: 53,
    height: 58,
    right: 325,
    bottom: 844,
  });
  assert.deepEqual(shell.getTutorialTarget('card-farm').getRect(), {
    left: 290,
    top: 252,
    width: 78,
    height: 34,
    right: 368,
    bottom: 286,
  });
  assert.deepEqual(shell.getTutorialTarget('card-house').getRect(), {
    left: 290,
    top: 338,
    width: 78,
    height: 34,
    right: 368,
    bottom: 372,
  });
  assert.deepEqual(shell.getTutorialTarget('card-lumbermill').getRect(), {
    left: 290,
    top: 424,
    width: 78,
    height: 34,
    right: 368,
    bottom: 458,
  });
  assert.deepEqual(shell.getTutorialTarget('card-barracks').getRect(), {
    left: 290,
    top: 510,
    width: 78,
    height: 34,
    right: 368,
    bottom: 544,
  });
  assert.deepEqual(shell.getTutorialTarget('card-craftsman').getRect(), {
    left: 346,
    top: 512,
    width: 22,
    height: 22,
    right: 368,
    bottom: 534,
  });
  assert.deepEqual(shell.getTutorialTarget('event-card-special').getRect(), {
    left: 24,
    top: 164,
    width: 342,
    height: 78,
    right: 366,
    bottom: 242,
  });
  assert.deepEqual(shell.getTutorialTarget('btn-claim-event').getRect(), {
    left: 36,
    top: 446,
    width: 318,
    height: 92,
    right: 354,
    bottom: 538,
  });
  assert.equal(shell.getTutorialTarget('tab-resources'), null);

  assert.equal(shell.showTutorialHighlight(shell.getTutorialTarget('btn-advance-era'), 'Advance now'), true);
  const highlight = renderCalls.at(-1).tutorialHighlight;
  assert.deepEqual(highlight.rect, {
    left: 20,
    top: 220,
    width: 300,
    height: 32,
    right: 320,
    bottom: 252,
  });
  assert.equal(highlight.message, 'Advance now');
  assert.equal(highlight.transition.durationMs, 260);
  assert.ok(Number.isFinite(highlight.pulseStartedAt));

  assert.equal(shell.hideTutorialHighlight(), true);
  assert.equal(renderCalls.at(-1).tutorialHighlight, null);
});

test('Canvas game shell sends guide task go actions through shared target navigation', async () => {
  const { document, runtime } = createCanvasHarness();
  const renderCalls = [];
  const renderer = {
    hitTargets: [
      { x: 272, y: 786, width: 53, height: 58, action: { type: 'switchTab', tab: 'buildings' } },
      { x: 290, y: 424, width: 78, height: 34, action: { type: 'buildBuilding', buildingId: 'barracks' } },
    ],
    render(state, options) { renderCalls.push(options); },
    getHitTarget: () => ({ type: 'goToGuideTaskTarget', target: 'card-barracks' }),
  };
  const game = {
    state: {
      currentTab: 'resources',
      buildingDefinitions: {},
      guideTasks: { visible: false, tasks: [] },
    },
    tutorial: {},
    tutorialController: { state: {}, canOpenTab: () => true },
    handleCanvasTabSelection(tabId) {
      this.state.currentTab = tabId;
      return true;
    },
  };
  const shell = CanvasGameShell.mount(game, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
  });

  assert.equal(shell.handleAction({ type: 'goToGuideTaskTarget', target: 'card-barracks' }), true);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(game.state.currentTab, 'buildings');
  assert.equal(renderCalls.at(-1).tutorialHighlight.message, '按这里继续主线任务');
  assert.deepEqual(renderCalls.at(-1).tutorialHighlight.rect, {
    left: 290,
    top: 424,
    width: 78,
    height: 34,
    right: 368,
    bottom: 458,
  });
});

test('Canvas game shell highlights first available scout action for the scout guide task', async () => {
  const { document, runtime } = createCanvasHarness();
  const renderCalls = [];
  const scoutTarget = { x: 118, y: 352, width: 86, height: 86, action: { type: 'scoutTerritory', value: 'e', disabled: false } };
  const renderer = {
    hitTargets: [
      { x: 325, y: 786, width: 53, height: 58, action: { type: 'switchTab', tab: 'military' } },
      { x: 135, y: 246, width: 108, height: 34, action: { type: 'switchMilitaryView', view: 'scout' } },
      scoutTarget,
    ],
    render(state, options) { renderCalls.push(options); },
    getHitTarget: () => ({ type: 'goToGuideTaskTarget', target: 'scout-action-first', nextAction: { type: 'switchMilitaryView', view: 'scout' } }),
  };
  const dispatched = [];
  const game = {
    state: {
      currentTab: 'resources',
      currentEra: 5,
      militaryView: 'army',
      guideTasks: { visible: false, tasks: [] },
    },
    tutorial: {},
    tutorialController: { state: {}, canOpenTab: () => true },
    handleCanvasTabSelection(tabId) {
      this.state.currentTab = tabId;
      return true;
    },
  };
  const shell = CanvasGameShell.mount(game, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
    onAction: (action) => {
      dispatched.push(action);
      if (action.type === 'switchMilitaryView') game.state.militaryView = action.view;
      return true;
    },
  });

  assert.equal(shell.handleAction({ type: 'goToGuideTaskTarget', target: 'scout-action-first', nextAction: { type: 'switchMilitaryView', view: 'scout' } }), true);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(game.state.currentTab, 'military');
  assert.deepEqual(dispatched, [{ type: 'switchMilitaryView', view: 'scout' }]);
  assert.equal(game.state.militaryView, 'scout');
  assert.deepEqual(renderCalls.at(-1).tutorialHighlight.rect, {
    left: scoutTarget.x,
    top: scoutTarget.y,
    width: scoutTarget.width,
    height: scoutTarget.height,
    right: scoutTarget.x + scoutTarget.width,
    bottom: scoutTarget.y + scoutTarget.height,
  });
});

test('Canvas game shell guides claimable main task through task icon then panel claim', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const renderCalls = [];
  const guideBarTarget = { x: 286, y: 92, width: 82, height: 34, action: { type: 'openTaskCenter', tab: 'main', target: 'task-center-main-claim', source: 'guideTaskBar' } };
  const taskIconTarget = { x: 302, y: 604, width: 48, height: 48, action: { type: 'openTaskCenter', source: 'taskIcon' } };
  const claimTarget = { x: 258, y: 462, width: 78, height: 34, action: { type: 'claimTaskReward', taskId: 'barracks_supplies', category: 'main' } };
  const renderer = {
    hitTargets: [guideBarTarget, taskIconTarget],
    getHitTarget: () => ({ type: 'openTaskCenter', source: 'taskIcon' }),
    render(state, options) {
      renderCalls.push(options);
      const shouldShowClaim = options.showTaskCenter && options.activeTaskCenterTab === 'main';
      this.hitTargets = shouldShowClaim
        ? [guideBarTarget, taskIconTarget, claimTarget]
        : [guideBarTarget, taskIconTarget];
    },
  };
  const game = {
    state: {
      currentTab: 'resources',
      guideTasks: {
        visible: true,
        tasks: [{ id: 'barracks_supplies', status: 'claimable', claimed: false }],
      },
    },
  };
  const shell = CanvasGameShell.mount(game, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    presenter: {
      buildTaskCenterViewState: () => ({
        categories: {
          main: {
            tasks: [{ id: 'barracks_supplies', status: 'claimable', claimed: false }],
          },
        },
      }),
    },
    previewEnabled: true,
    inputEnabled: true,
  });

  assert.deepEqual(shell.getTutorialTarget('task-center-main-claim').getRect(), {
    left: taskIconTarget.x,
    top: taskIconTarget.y,
    width: taskIconTarget.width,
    height: taskIconTarget.height,
    right: taskIconTarget.x + taskIconTarget.width,
    bottom: taskIconTarget.y + taskIconTarget.height,
  });
  shell.activeTaskCenterTab = 'daily';

  listeners['document:pointerup']({ clientX: 326, clientY: 628, type: 'pointerup', timeStamp: 1000 });

  assert.equal(renderCalls.at(-1).showTaskCenter, true);
  assert.equal(renderCalls.at(-1).activeTaskCenterTab, 'main');
  assert.deepEqual(renderCalls.at(-1).tutorialHighlight.rect, {
    left: claimTarget.x,
    top: claimTarget.y,
    width: claimTarget.width,
    height: claimTarget.height,
    right: claimTarget.x + claimTarget.width,
    bottom: claimTarget.y + claimTarget.height,
  });
});

test('Canvas game shell owns task center state and dispatches reward claims', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const actions = [
    { type: 'openTaskCenter' },
    { type: 'switchTaskCenterTab', tab: 'daily' },
    { type: 'claimTaskReward', taskId: 'barracks_supplies', category: 'main' },
  ];
  const renderCalls = [];
  const dispatched = [];
  const renderer = {
    getHitTarget: () => actions.shift(),
    render(state, options) { renderCalls.push(options); },
  };
  CanvasGameShell.mount({ state: { currentTab: 'resources' } }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
    onAction: (action) => {
      dispatched.push(action);
      return true;
    },
  });

  listeners['document:pointerup']({ clientX: 350, clientY: 720, type: 'pointerup', timeStamp: 1000 });
  assert.equal(renderCalls.at(-1).showTaskCenter, true);
  listeners['document:pointerup']({ clientX: 90, clientY: 180, type: 'pointerup', timeStamp: 1300 });
  assert.equal(renderCalls.at(-1).activeTaskCenterTab, 'daily');
  listeners['document:pointerup']({ clientX: 320, clientY: 500, type: 'pointerup', timeStamp: 1600 });
  assert.equal(renderCalls.at(-1).showTaskCenter, false);
  assert.deepEqual(dispatched, [{ type: 'claimTaskReward', taskId: 'barracks_supplies', category: 'main' }]);
});

test('Canvas game shell opens talent policy panel from the resources HUD', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const actions = [
    { type: 'openTalentPolicy' },
    { type: 'selectTalentPolicyBase', policyId: 'industry', resetTiers: true },
    { type: 'confirmTalentPolicy' },
  ];
  const renderCalls = [];
  const dispatched = [];
  const renderer = {
    getHitTarget: () => actions.shift(),
    render(state, options) { renderCalls.push(options); },
  };
  const shell = CanvasGameShell.mount({ state: { currentTab: 'resources' } }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
    onAction: (action) => {
      dispatched.push(action);
      return true;
    },
  });

  listeners['document:pointerup']({ clientX: 330, clientY: 160, type: 'pointerup', timeStamp: 1000 });
  assert.equal(shell.showTalentPolicy, true);
  assert.equal(renderCalls.at(-1).showTalentPolicy, true);

  listeners['document:pointerup']({ clientX: 205, clientY: 300, type: 'pointerup', timeStamp: 1300 });
  assert.equal(shell.showTalentPolicy, true);
  assert.equal(renderCalls.at(-1).showTalentPolicy, true);
  assert.equal(shell.talentPolicyUiState.basePolicyId, 'industry');
  assert.deepEqual(shell.talentPolicyUiState.tiers, { agriculture: 2, knowledge: 2, industry: 2 });
  assert.deepEqual(dispatched, []);

  listeners['document:pointerup']({ clientX: 205, clientY: 760, type: 'pointerup', timeStamp: 1600 });
  assert.equal(shell.showTalentPolicy, false);
  assert.equal(renderCalls.at(-1).showTalentPolicy, false);
  assert.deepEqual(dispatched, [{ type: 'applyTalentPolicy', policyId: 'industry' }]);
});

test('Canvas game shell refreshes guide highlight after task reward is claimed', async () => {
  const { document, runtime } = createCanvasHarness();
  const renderCalls = [];
  const taskIconTarget = { x: 302, y: 604, width: 48, height: 48, action: { type: 'openTaskCenter', source: 'taskIcon' } };
  const claimTarget = { x: 258, y: 462, width: 78, height: 34, action: { type: 'claimTaskReward', taskId: 'barracks_supplies', category: 'main' } };
  const tabBuildingsTarget = { x: 76, y: 786, width: 58, height: 58, action: { type: 'switchTab', tab: 'buildings' } };
  const barracksTarget = { x: 24, y: 236, width: 342, height: 96, action: { type: 'buildBuilding', buildingId: 'barracks' } };
  const renderer = {
    hitTargets: [taskIconTarget, claimTarget],
    getHitTarget: () => null,
    render(state, options) {
      renderCalls.push(options);
      this.hitTargets = state.currentTab === 'buildings'
        ? [tabBuildingsTarget, barracksTarget]
        : [taskIconTarget, claimTarget];
    },
  };
  const game = {
    state: {
      currentTab: 'resources',
      softGuide: { mode: 'strong', target: 'card-barracks', message: '建造兵营' },
      buildingDefinitions: { barracks: { id: 'barracks' } },
      buildings: { barracks: { level: 0 } },
      unlockedBuildings: ['barracks'],
    },
    tutorialController: { state: { completed: true }, canOpenTab: () => true },
    handleCanvasTabSelection(tabId) {
      this.state.currentTab = tabId;
      shell.renderReadOnly(this.state, tabId);
      return true;
    },
  };
  const shell = CanvasGameShell.mount(game, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    presenter: {
      buildBuildingViewState: () => ({ ids: ['barracks'] }),
    },
    previewEnabled: true,
    inputEnabled: true,
  });
  shell.showTaskCenter = true;
  shell.showTutorialHighlight({ getRect: () => ({
    left: claimTarget.x,
    top: claimTarget.y,
    width: claimTarget.width,
    height: claimTarget.height,
    right: claimTarget.x + claimTarget.width,
    bottom: claimTarget.y + claimTarget.height,
  }) }, '领取奖励');

  assert.equal(shell.refreshCurrentGuideHighlight(), true);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(shell.showTaskCenter, false);
  assert.equal(game.state.currentTab, 'buildings');
  assert.deepEqual(renderCalls.at(-1).tutorialHighlight.rect, {
    left: barracksTarget.x,
    top: barracksTarget.y,
    width: barracksTarget.width,
    height: barracksTarget.height,
    right: barracksTarget.x + barracksTarget.width,
    bottom: barracksTarget.y + barracksTarget.height,
  });
  assert.notEqual(renderCalls.at(-1).tutorialHighlight.rect.left, claimTarget.x);
});

test('Canvas game shell keeps strong guide highlight when a transient target is missing', () => {
  const { document, runtime } = createCanvasHarness();
  const renderCalls = [];
  const renderer = {
    hitTargets: [],
    getHitTarget: () => null,
    render(state, options) { renderCalls.push(options); },
  };
  const game = {
    state: {
      currentTab: 'buildings',
      softGuide: { mode: 'strong', target: 'card-barracks', message: 'Build barracks' },
      buildingDefinitions: { barracks: { id: 'barracks' } },
      buildings: {},
      unlockedBuildings: ['barracks'],
    },
    tutorialController: { state: {}, canOpenTab: () => true },
  };
  const shell = CanvasGameShell.mount(game, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    presenter: {
      buildBuildingViewState: () => ({ ids: ['barracks'] }),
    },
    previewEnabled: true,
    inputEnabled: true,
  });
  const previous = {
    rect: { left: 20, top: 200, width: 80, height: 36, right: 100, bottom: 236 },
    message: 'keep me',
  };
  shell.tutorialHighlight = previous;

  assert.equal(shell.refreshCurrentGuideHighlight(), false);
  assert.equal(shell.tutorialHighlight, previous);
  assert.equal(renderCalls.at(-1).tutorialHighlight, previous);
});

test('Canvas action reset returns the local view to resources before applying reset state', () => {
  const { document, runtime } = createCanvasHarness();
  const renderCalls = [];
  const renderer = {
    getHitTarget: () => ({ type: 'resetGame' }),
    render(state, options) { renderCalls.push({ state, options }); },
  };
  const game = {
    activeTab: 'buildings',
    state: { currentTab: 'buildings', resources: { food: 1 } },
    resetGame() {
      this.resetCalled = true;
      this.state = { ...this.state, resources: { food: 100 } };
      return true;
    },
  };
  const shell = CanvasGameShell.mount(game, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
  });
  shell.showTaskCenter = true;
  shell.showResourceDetails = true;
  shell.buildingOffset = 3;
  const handled = shell.handleTap({ x: 1, y: 1 });

  assert.equal(handled, true);
  assert.equal(game.resetCalled, true);
  assert.equal(game.activeTab, 'resources');
  assert.equal(game.state.currentTab, 'resources');
  assert.equal(shell.showTaskCenter, false);
  assert.equal(shell.showResourceDetails, false);
  assert.equal(shell.buildingOffset, 0);
  assert.equal(renderCalls.at(-1).options.activeTab, 'resources');
});

test('Canvas game shell dispatches military and world actions without DOM adapters', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const actions = [
    { type: 'switchMilitaryView', view: 'scout' },
    { type: 'scoutTerritory', direction: 'n', value: 'n' },
    { type: 'claimScout', missionId: 'scout-n-1', value: 'scout-n-1' },
    { type: 'openWorldSite', siteId: 'site-east' },
    { type: 'territoryAction', territoryId: 'site-east', action: 'conquer' },
    { type: 'changeExpeditionSoldiers', siteId: 'site-east', value: 3 },
    { type: 'closeWorldSite' },
  ];
  const dispatched = [];
  const renderer = {
    getHitTarget: () => actions.shift(),
    render() {},
  };
  CanvasGameShell.mount({ state: { currentTab: 'military' } }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
    onAction: (action) => {
      dispatched.push(action);
      return true;
    },
  });

  for (let index = 0; index < 7; index += 1) {
    listeners['document:pointerup']({ clientX: 205, clientY: 300 + index, type: 'pointerup', timeStamp: 1000 + index * 300 });
  }

  assert.deepEqual(dispatched, [
    { type: 'switchMilitaryView', view: 'scout' },
    { type: 'scoutTerritory', direction: 'n', value: 'n' },
    { type: 'claimScout', missionId: 'scout-n-1', value: 'scout-n-1' },
    { type: 'openWorldSite', siteId: 'site-east' },
    { type: 'territoryAction', territoryId: 'site-east', action: 'conquer' },
    { type: 'changeExpeditionSoldiers', siteId: 'site-east', value: 3 },
    { type: 'closeWorldSite' },
  ]);
});

test('Canvas game shell dispatches world radar drag phases from canvas-owned pointer events', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const dispatched = [];
  const renderer = {
    getHitTarget: () => ({ type: 'worldRadarDrag', background: true }),
    render() {},
  };
  CanvasGameShell.mount({ state: { currentTab: 'military' } }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
    onAction: (action) => {
      dispatched.push(action);
      return true;
    },
  });

  listeners.pointerdown({ pointerId: 3, clientX: 100, clientY: 180, type: 'pointerdown', cancelable: true, preventDefault() {}, stopPropagation() {} });
  listeners.pointermove({ pointerId: 3, clientX: 150, clientY: 210, type: 'pointermove', cancelable: true, preventDefault() {}, stopPropagation() {} });
  listeners.pointerup({ pointerId: 3, clientX: 150, clientY: 210, type: 'pointerup', cancelable: true, preventDefault() {}, stopPropagation() {} });

  assert.deepEqual(dispatched.map((action) => action.phase), ['start', 'move', 'end']);
  assert.ok(dispatched.every((action) => action.type === 'worldRadarDrag'));
});

test('Canvas game shell scrolls tech tree through shared drag action', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const hitTargets = [
    { type: 'techTreeDrag', background: true },
    { type: 'research', techId: 'locked_future', disabled: true, dragType: 'techTreeDrag' },
  ];
  const renderer = {
    getHitTarget: () => hitTargets.shift() || { type: 'techTreeDrag', background: true },
    getLayout: () => ({ contentX: 12, contentWidth: 366 }),
    getTechTreeLayout: () => ({ minPanX: -120, maxPanX: 140, minPanY: -180, maxPanY: 180 }),
    presenter: {
      buildTechViewState: () => ({ tree: { nodes: [] }, text: {} }),
    },
    render() {},
  };
  const shell = CanvasGameShell.mount({ state: { currentTab: 'tech' } }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
  });

  listeners.pointerdown({ pointerId: 4, clientX: 200, clientY: 500, type: 'pointerdown', cancelable: true, preventDefault() {}, stopPropagation() {} });
  listeners.pointermove({ pointerId: 4, clientX: 200, clientY: 350, type: 'pointermove', cancelable: true, preventDefault() {}, stopPropagation() {} });
  listeners.pointerup({ pointerId: 4, clientX: 200, clientY: 350, type: 'pointerup', cancelable: true, preventDefault() {}, stopPropagation() {} });

  assert.equal(shell.techTreePanY, -150);
  assert.equal(shell.techTreePanX, 0);

  listeners.pointerdown({ pointerId: 5, clientX: 200, clientY: 500, type: 'pointerdown', cancelable: true, preventDefault() {}, stopPropagation() {} });
  listeners.pointermove({ pointerId: 5, clientX: 120, clientY: 100, type: 'pointermove', cancelable: true, preventDefault() {}, stopPropagation() {} });
  listeners.pointerup({ pointerId: 5, clientX: 120, clientY: 100, type: 'pointerup', cancelable: true, preventDefault() {}, stopPropagation() {} });

  assert.equal(shell.techTreePanY, -180);
  assert.equal(shell.techTreePanX, -80);
});

test('Canvas game shell starts tech tree drag from disabled node inside tree panel', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const renderer = {
    lastTechTreeScroll: { panel: { x: 40, y: 260, width: 300, height: 360 } },
    getHitTarget: () => ({ type: 'research', techId: 'future_locked', disabled: true }),
    getLayout: () => ({ contentX: 12, contentWidth: 366 }),
    getTechTreeLayout: () => ({ minPanX: -120, maxPanX: 140, minPanY: -180, maxPanY: 180 }),
    presenter: {
      buildTechViewState: () => ({ tree: { nodes: [] }, text: {} }),
    },
    render() {},
  };
  const shell = CanvasGameShell.mount({ state: { currentTab: 'tech' } }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
  });

  listeners.pointerdown({ pointerId: 6, clientX: 210, clientY: 520, type: 'pointerdown', cancelable: true, preventDefault() {}, stopPropagation() {} });
  listeners.pointermove({ pointerId: 6, clientX: 140, clientY: 440, type: 'pointermove', cancelable: true, preventDefault() {}, stopPropagation() {} });
  listeners.pointerup({ pointerId: 6, clientX: 140, clientY: 440, type: 'pointerup', cancelable: true, preventDefault() {}, stopPropagation() {} });

  assert.equal(shell.techTreePanX, -70);
  assert.equal(shell.techTreePanY, -80);
});

test('Canvas game shell keeps tech tree pan synchronized with game host renders', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const renderOptions = [];
  const game = {
    state: { currentTab: 'tech' },
    activeTab: 'tech',
    techTreePanX: 0,
    techTreePanY: 0,
    getActiveTab() { return this.activeTab; },
  };
  const renderer = {
    getHitTarget: () => ({ type: 'research', techId: 'future_locked', disabled: true }),
    getLayout: () => ({ contentX: 12, contentWidth: 366 }),
    getTechTreeLayout: () => ({ minPanX: -120, maxPanX: 140, minPanY: -180, maxPanY: 180 }),
    presenter: {
      buildTechViewState: () => ({ tree: { nodes: [] }, text: {} }),
    },
    render(_state, options) {
      renderOptions.push(options);
    },
  };
  const shell = CanvasGameShell.mount(game, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
  });

  listeners.pointerdown({ pointerId: 9, clientX: 260, clientY: 520, type: 'pointerdown', cancelable: true, preventDefault() {}, stopPropagation() {} });
  listeners.pointermove({ pointerId: 9, clientX: 150, clientY: 390, type: 'pointermove', cancelable: true, preventDefault() {}, stopPropagation() {} });
  listeners.pointerup({ pointerId: 9, clientX: 150, clientY: 390, type: 'pointerup', cancelable: true, preventDefault() {}, stopPropagation() {} });

  assert.equal(shell.techTreePanX, -110);
  assert.equal(shell.techTreePanY, -130);
  assert.equal(game.techTreePanX, -110);
  assert.equal(game.techTreePanY, -130);

  shell.renderReadOnly(game.state, 'tech');
  const lastRender = renderOptions.at(-1);
  assert.equal(lastRender.techTreePanX, -110);
  assert.equal(lastRender.techTreePanY, -130);
});

test('Canvas game shell zooms tech tree through shared gesture action', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const renderOptions = [];
  const layoutOptions = [];
  const game = {
    state: { currentTab: 'tech' },
    activeTab: 'tech',
    getActiveTab() { return this.activeTab; },
  };
  const renderer = {
    lastTechTreeScroll: { panel: { x: 40, y: 260, width: 300, height: 360 } },
    getHitTarget: () => ({ type: 'techTreeDrag', background: true }),
    getLayout: () => ({ contentX: 12, contentWidth: 366 }),
    getTechTreeLayout: (view, _panel, options) => {
      layoutOptions.push(options);
      return {
        minPanX: -300,
        maxPanX: 220,
        minPanY: -500,
        maxPanY: 240,
        panX: Number(options.techTreePanX) || 0,
        panY: Number(options.techTreePanY) || 0,
      };
    },
    presenter: {
      buildTechViewState: () => ({ tree: { nodes: [{ id: 'a' }] }, text: {} }),
    },
    render(_state, options) {
      renderOptions.push(options);
    },
  };
  const shell = CanvasGameShell.mount(game, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
  });

  listeners.wheel({
    clientX: 210,
    clientY: 500,
    deltaY: -120,
    type: 'wheel',
    cancelable: true,
    preventDefault() {},
    stopPropagation() {},
  });

  assert.ok(shell.techTreeZoom > 1);
  assert.equal(game.techTreeZoom, shell.techTreeZoom);
  assert.equal(renderOptions.at(-1).techTreeZoom, shell.techTreeZoom);
  assert.equal(layoutOptions.at(-1).techTreeZoom, shell.techTreeZoom);
  assert.notEqual(shell.techTreePanX, 0);
  assert.notEqual(shell.techTreePanY, 0);
});

test('Canvas game shell clamps tech tree drag with game state instead of shell initial state', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const layoutStates = [];
  const game = {
    state: {
      currentTab: 'tech',
      techs: {
        eras: [
          { era: 1, techs: [{ id: 'visible' }] },
          { era: 2, techs: [{ id: 'future' }] },
        ],
      },
    },
    activeTab: 'tech',
    techTreePanX: 0,
    techTreePanY: 0,
    getActiveTab() { return this.activeTab; },
  };
  const renderer = {
    lastTechTreeScroll: { panel: { x: 40, y: 260, width: 300, height: 360 } },
    getHitTarget: () => ({ type: 'techTreeDrag', background: true }),
    getLayout: () => ({ contentX: 12, contentWidth: 366 }),
    getTechTreeLayout: (view, _panel, options) => {
      layoutStates.push(view);
      const hasFullTreeState = Array.isArray(view.tree?.nodes) && view.tree.nodes.length >= 2;
      return {
        minPanX: -120,
        maxPanX: 140,
        minPanY: hasFullTreeState ? -900 : -96,
        maxPanY: 96,
        panX: Number(options.techTreePanX) || 0,
        panY: Number(options.techTreePanY) || 0,
      };
    },
    presenter: {
      buildTechViewState: (state) => ({
        tree: {
          nodes: state?.techs?.eras?.flatMap((era) => era.techs || []) || [],
        },
        text: {},
      }),
    },
    render() {},
  };
  const shell = CanvasGameShell.mount(game, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
  });

  listeners.pointerdown({ pointerId: 10, clientX: 220, clientY: 620, type: 'pointerdown', cancelable: true, preventDefault() {}, stopPropagation() {} });
  listeners.pointermove({ pointerId: 10, clientX: 220, clientY: 220, type: 'pointermove', cancelable: true, preventDefault() {}, stopPropagation() {} });
  listeners.pointerup({ pointerId: 10, clientX: 220, clientY: 220, type: 'pointerup', cancelable: true, preventDefault() {}, stopPropagation() {} });

  assert.ok(layoutStates.some((view) => view.tree?.nodes?.length >= 2));
  assert.equal(shell.techTreePanY, -400);
  assert.equal(game.techTreePanY, -400);
});

test('Canvas game shell owns naming prompt state and dispatches canvas submit', async () => {
  const { document, runtime, listeners } = createCanvasHarness();
  runtime.prompt = () => ' 赤火联盟 ';
  const actions = [
    { type: 'requestNamingInput' },
    { type: 'submitNaming' },
  ];
  const renderCalls = [];
  const dispatched = [];
  const renderer = {
    getHitTarget: () => actions.shift(),
    render(state, options) { renderCalls.push(options); },
  };
  const shell = CanvasGameShell.mount({ state: { currentTab: 'resources' } }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
    onAction: (action) => {
      dispatched.push(action);
      return true;
    },
  });

  shell.openNaming({ title: '为势力命名', message: '你已经扩张了领土。', placeholder: '例如：赤火联盟', maxLength: 12 });
  assert.equal(renderCalls.at(-1).naming.visible, true);
  listeners['document:pointerup']({ clientX: 205, clientY: 300, type: 'pointerup', timeStamp: 1000 });
  await Promise.resolve();
  assert.equal(renderCalls.at(-1).naming.inputValue, '赤火联盟');
  listeners['document:pointerup']({ clientX: 205, clientY: 540, type: 'pointerup', timeStamp: 1300 });

  assert.deepEqual(dispatched, [{ type: 'submitNaming', name: '赤火联盟' }]);
});

test('Canvas game shell owns floating text effects without DOM adapter', () => {
  const { document, runtime } = createCanvasHarness();
  const timers = [];
  const cleared = [];
  runtime.setInterval = (callback, intervalMs) => {
    const timer = { callback, intervalMs };
    timers.push(timer);
    return timer;
  };
  runtime.clearInterval = (timer) => cleared.push(timer);
  const renderCalls = [];
  const renderer = {
    render(state, options) { renderCalls.push(options); },
  };
  const shell = CanvasGameShell.mount({ state: { currentTab: 'resources' } }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
  });
  let now = 1000;
  shell.now = () => now;

  assert.equal(shell.showFloatingText('建造成功！'), true);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].intervalMs, 16);
  assert.equal(renderCalls.at(-1).floatingTexts[0].text, '建造成功！');
  assert.equal(renderCalls.at(-1).floatingTexts[0].progress, 0);

  now += 600;
  shell.renderReadOnly(shell.lastGame.state, 'resources');
  assert.ok(renderCalls.at(-1).floatingTexts[0].progress > 0);

  now += 700;
  timers[0].callback();
  assert.deepEqual(renderCalls.at(-1).floatingTexts, []);
  assert.deepEqual(cleared, [timers[0]]);
});

test('Canvas game shell uses a 60FPS target for shared canvas animations', () => {
  const { document, runtime } = createCanvasHarness();
  const timers = [];
  runtime.setInterval = (callback, intervalMs) => {
    const timer = { callback, intervalMs };
    timers.push(timer);
    return timer;
  };
  runtime.clearInterval = () => {};
  let now = 1000;
  const renderer = {
    render() {},
  };
  const shell = CanvasGameShell.mount({ state: { currentTab: 'resources' } }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
  });
  shell.now = () => now;

  assert.equal(shell.startPageTransition('resources', 'buildings'), true);
  assert.equal(timers[0].intervalMs, 16);
  now += 16;
  timers[0].callback();
  assert.ok(shell.pageTransition);
});

test('Canvas game app delegates H5 tab transition animation to the mounted canvas shell', () => {
  const { document, runtime } = createCanvasHarness();
  const timers = [];
  runtime.setInterval = (callback, intervalMs) => {
    const timer = { callback, intervalMs };
    timers.push(timer);
    return timer;
  };
  runtime.clearInterval = () => {};
  const renderCalls = [];
  const renderer = {
    render(state, options) { renderCalls.push({ state, options }); },
  };
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    presenter: {
      buildTabNavigationViewState: (state, options) => ({ activeTab: options.requestedTab }),
      buildMilitaryNavigationViewState: () => ({ activeView: 'army' }),
    },
    initialState: { currentTab: 'resources', resources: {}, population: {} },
  });
  app.tutorialController = { render() {} };
  app.renderSoftGuide = () => {};
  app.renderMilitaryView = () => {};
  app.canvasShell = CanvasGameShell.mount(app, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
  });
  let now = 1000;
  app.now = () => now;
  app.canvasShell.now = () => now;

  app.switchTab('civilization');

  assert.equal(app.pageTransition.fromTab, 'resources');
  assert.equal(app.pageTransition.toTab, 'civilization');
  assert.equal(app.canvasShell.pageTransition, app.pageTransition);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].intervalMs, 16);
  assert.equal(renderCalls.at(-1).options.pageTransition, app.pageTransition);
  now += 16;
  timers[0].callback();
  assert.equal(renderCalls.at(-1).options.pageTransition, app.pageTransition);
});

test('Canvas game app guide navigation writes Canvas UI state through the mounted shell', async () => {
  const { document, runtime } = createCanvasHarness();
  const renderCalls = [];
  const watchtowerTarget = { x: 228, y: 662, width: 128, height: 26, action: { type: 'buildBuilding', buildingId: 'watchtower' } };
  const renderer = {
    hitTargets: [],
    render(state, options) {
      renderCalls.push({ state, options });
      this.hitTargets = state.currentTab === 'buildings'
        ? [watchtowerTarget]
        : [{ x: 76, y: 786, width: 58, height: 58, action: { type: 'switchTab', tab: 'buildings' } }];
    },
  };
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    presenter: {
      buildTabNavigationViewState: (state, options) => ({ activeTab: options.requestedTab }),
      buildMilitaryNavigationViewState: () => ({ activeView: 'army' }),
      buildBuildingViewState: () => ({ ids: ['barracks', 'watchtower'], filteredIds: ['barracks', 'watchtower'] }),
    },
    initialState: {
      currentTab: 'resources',
      resources: {},
      population: {},
      softGuide: { mode: 'strong', target: 'card-watchtower', message: '建造瞭望台' },
      buildingDefinitions: { watchtower: { id: 'watchtower', category: 'military' } },
      guideTasks: {
        visible: true,
        tasks: [{
          id: 'watchtower_supplies',
          status: 'active',
          claimed: true,
          target: 'card-watchtower',
          action: { type: 'goToGuideTaskTarget', target: 'card-watchtower' },
        }],
      },
    },
  });
  app.tutorialController = { state: { completed: true }, canOpenTab: () => true, render() {} };
  app.renderMilitaryView = () => {};
  app.canvasShell = CanvasGameShell.mount(app, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
  });

  app.renderCanvasSurface();
  assert.equal(app.goToGuideTaskTarget({ target: 'card-watchtower' }), true);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(app.state.currentTab, 'buildings');
  assert.equal(app.activeBuildingCategory, 'military');
  assert.equal(app.canvasShell.activeBuildingCategory, 'military');
  assert.equal(app.buildingOffset, 0);
  assert.equal(app.canvasShell.buildingOffset, 0);
  assert.deepEqual(app.canvasShell.tutorialHighlight.rect, {
    left: watchtowerTarget.x,
    top: watchtowerTarget.y,
    width: watchtowerTarget.width,
    height: watchtowerTarget.height,
    right: watchtowerTarget.x + watchtowerTarget.width,
    bottom: watchtowerTarget.y + watchtowerTarget.height,
  });
  assert.equal(renderCalls.at(-1).options.activeBuildingCategory, 'military');
  assert.deepEqual(renderCalls.at(-1).options.tutorialHighlight.rect, app.canvasShell.tutorialHighlight.rect);
});

test('Canvas game shell refreshes watchtower guide after guided building tab tap', async () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const renderCalls = [];
  const tabBuildingsTarget = { x: 76, y: 786, width: 58, height: 58, action: { type: 'switchTab', tab: 'buildings' } };
  const watchtowerTarget = { x: 228, y: 662, width: 128, height: 26, action: { type: 'buildBuilding', buildingId: 'watchtower' } };
  const renderer = {
    hitTargets: [tabBuildingsTarget],
    getHitTarget(point) {
      return this.hitTargets.find((target) => (
        point.x >= target.x
        && point.x <= target.x + target.width
        && point.y >= target.y
        && point.y <= target.y + target.height
      ))?.action || null;
    },
    render(state, options) {
      renderCalls.push({ state, options });
      this.hitTargets = state.currentTab === 'buildings' ? [watchtowerTarget] : [tabBuildingsTarget];
    },
  };
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    presenter: {
      buildTabNavigationViewState: (state, options) => ({ activeTab: options.requestedTab }),
      buildMilitaryNavigationViewState: () => ({ activeView: 'army' }),
      buildBuildingViewState: () => ({ ids: ['watchtower'], filteredIds: ['watchtower'] }),
    },
    initialState: {
      currentTab: 'resources',
      resources: {},
      population: {},
      softGuide: { mode: 'strong', target: 'card-watchtower', message: '建造瞭望台' },
      buildingDefinitions: { watchtower: { id: 'watchtower', category: 'military' } },
      guideTasks: {
        visible: true,
        tasks: [{
          id: 'watchtower_supplies',
          status: 'active',
          claimed: true,
          target: 'card-watchtower',
          action: { type: 'goToGuideTaskTarget', target: 'card-watchtower' },
        }],
      },
    },
  });
  app.tutorialController = {
    state: { completed: false, currentStep: 11, phaseCompleted: { newbie: true, era2: false } },
    canOpenTab() { return true; },
    async onTabClicked() { return true; },
    render() {},
  };
  app.renderMilitaryView = () => {};
  app.canvasShell = CanvasGameShell.mount(app, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
  });
  app.renderCanvasSurface();
  app.canvasShell.showTutorialHighlight({ getRect: () => ({
    left: tabBuildingsTarget.x,
    top: tabBuildingsTarget.y,
    width: tabBuildingsTarget.width,
    height: tabBuildingsTarget.height,
    right: tabBuildingsTarget.x + tabBuildingsTarget.width,
    bottom: tabBuildingsTarget.y + tabBuildingsTarget.height,
  }) }, '点击建筑');

  listeners['document:pointerup']({ clientX: 100, clientY: 810, type: 'pointerup', timeStamp: 1000 });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(app.state.currentTab, 'buildings');
  assert.deepEqual(renderCalls.at(-1).options.tutorialHighlight.rect, {
    left: watchtowerTarget.x,
    top: watchtowerTarget.y,
    width: watchtowerTarget.width,
    height: watchtowerTarget.height,
    right: watchtowerTarget.x + watchtowerTarget.width,
    bottom: watchtowerTarget.y + watchtowerTarget.height,
  });
});

test('H5 canvas runtime provides platform text input without exposing DOM input elements', async () => {
  const { document, runtime } = createCanvasHarness();
  const prompts = [];
  runtime.prompt = (message, value) => {
    prompts.push([message, value]);
    return '河湾城';
  };
  const h5Runtime = new H5CanvasRuntime({ document, runtime });

  const value = await h5Runtime.requestTextInput({
    title: '为这座城市命名',
    message: '当前名称：东岸',
    placeholder: '例如：河湾城',
    value: '',
  });

  assert.equal(value, '河湾城');
  assert.match(prompts[0][0], /当前名称：东岸/);
  assert.match(prompts[0][0], /为这座城市命名/);
});

test('Canvas game shell owns login credentials and dispatches canvas login actions', async () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const requested = [];
  runtime.prompt = (message, value) => {
    requested.push({ message, value });
    return requested.length === 1 ? 'TestUser' : 'secret';
  };
  const actions = [
    { type: 'requestLoginUsername' },
    { type: 'requestLoginPassword' },
    { type: 'toggleRememberPassword' },
    { type: 'submitLogin' },
  ];
  const dispatched = [];
  const renderCalls = [];
  const renderer = {
    getHitTarget: () => actions.shift(),
    render(state, options) { renderCalls.push(options); },
  };
  const shell = CanvasGameShell.mount({ state: { currentTab: 'resources' } }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
    onAction: (action) => {
      dispatched.push(action);
      return true;
    },
  });

  shell.applyAuthShell({ loginPanelVisible: true, appVisible: false, message: '请登录' });
  listeners['document:pointerup']({ clientX: 205, clientY: 300, type: 'pointerup', timeStamp: 1000 });
  await Promise.resolve();
  assert.equal(shell.auth.credentials.usernameValue, 'TestUser');

  listeners['document:pointerup']({ clientX: 205, clientY: 352, type: 'pointerup', timeStamp: 1300 });
  await Promise.resolve();
  assert.equal(shell.auth.credentials.passwordValue, 'secret');

  listeners['document:pointerup']({ clientX: 48, clientY: 405, type: 'pointerup', timeStamp: 1600 });
  assert.equal(shell.auth.credentials.rememberPasswordChecked, true);

  listeners['document:pointerup']({ clientX: 205, clientY: 470, type: 'pointerup', timeStamp: 1900 });
  assert.deepEqual(dispatched, [{ type: 'submitLogin' }]);
  assert.deepEqual(shell.readCredentials(), {
    username: 'testuser',
    password: 'secret',
    rememberPassword: true,
  });
  assert.equal(renderCalls.at(-1).auth.view.loginPanelVisible, true);
});

test('Canvas game app keeps famous person panel open through seek and accept actions', async () => {
  const app = new CanvasGameApp({
    runtime: { getStorage: () => '', setStorage: () => {} },
    presenter: {},
    renderer: { render() {} },
    api: {
      seekFamousPerson: async () => ({
        success: true,
        message: '寻访发现：陆骁',
        gameState: {
          currentTab: 'resources',
          famousPersons: {
            count: 0,
            candidateCount: 1,
            candidates: [{ id: 'fpc_a', name: '陆骁' }],
            people: [],
            seek: { available: true },
          },
        },
      }),
      acceptFamousPerson: async (candidateId) => ({
        success: true,
        message: '陆骁已加入文明',
        gameState: {
          currentTab: 'resources',
          famousPersons: {
            count: 1,
            candidateCount: 0,
            candidates: [],
            people: [{ id: 'fp_a', name: '陆骁', source: { candidateId } }],
            seek: { available: true },
          },
        },
      }),
    },
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
  });
  app.canvasShell = { showFamousPersons: false, showFloatingText: () => true };

  const seekResult = await app.actionController.handle({ type: 'seekFamousPerson' });
  assert.equal(seekResult, true);
  assert.equal(app.showFamousPersons, true);
  assert.equal(app.canvasShell.showFamousPersons, true);
  assert.equal(app.state.famousPersons.candidateCount, 1);

  const acceptResult = await app.actionController.handle({ type: 'acceptFamousPerson', candidateId: 'fpc_a' });
  assert.equal(acceptResult, true);
  assert.equal(app.showFamousPersons, true);
  assert.equal(app.state.famousPersons.count, 1);
});

test('Canvas game shell passes shared loading state and preloads assets through renderer', async () => {
  const { document, runtime } = createCanvasHarness();
  const renderCalls = [];
  const progressCalls = [];
  const renderer = {
    getHitTarget: () => null,
    render(state, options) { renderCalls.push(options); },
    async preloadAssets(assetPaths, onProgress) {
      assert.equal(assetPaths, undefined);
      onProgress({ total: 2, completed: 1, percentage: 50 });
      progressCalls.push('preload');
      return { total: 2, completed: 2, loaded: 2, failed: 0, percentage: 100 };
    },
  };
  const shell = CanvasGameShell.mount({ state: { currentTab: 'resources' } }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
  });

  shell.showLoading('Loading resources');
  assert.equal(renderCalls.at(-1).loading.visible, true);
  assert.equal(renderCalls.at(-1).loading.message, 'Loading resources');

  await shell.preloadAssets((progress) => shell.updateLoading(progress));
  assert.equal(progressCalls.length, 1);
  assert.equal(renderCalls.at(-1).loading.percentage, 50);

  shell.hideLoading();
  assert.equal(renderCalls.at(-1).loading.visible, false);
});

test('Canvas game shell owns building pager state without DOM adapter', async () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const actions = [
    { type: 'scrollBuildings', delta: 1 },
    { type: 'switchTab', tab: 'resources' },
  ];
  const renderCalls = [];
  const dispatched = [];
  const renderer = {
    getHitTarget: () => actions.shift(),
    render(state, options) { renderCalls.push(options); },
  };
  const shell = CanvasGameShell.mount({ state: { currentTab: 'buildings' } }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
    onAction: (action) => {
      dispatched.push(action);
      return true;
    },
  });

  listeners['document:pointerup']({ clientX: 300, clientY: 740, type: 'pointerup', timeStamp: 1000 });
  assert.equal(renderCalls.at(-1).buildingOffset, 1);
  assert.equal(renderCalls.at(-1).buildingTransition.fromOffset, 0);
  assert.equal(renderCalls.at(-1).buildingTransition.toOffset, 1);
  listeners['document:pointerup']({ clientX: 30, clientY: 800, type: 'pointerup', timeStamp: 1300 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(shell.buildingOffset, 0);
  assert.equal(renderCalls.at(-1).pageTransition.fromTab, 'buildings');
  assert.equal(renderCalls.at(-1).pageTransition.toTab, 'resources');
  assert.deepEqual(dispatched, [{ type: 'switchTab', tab: 'resources' }]);
});

test('Canvas game shell owns building category state without DOM adapter', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const renderCalls = [];
  const renderer = {
    getHitTarget: () => ({ type: 'selectBuildingCategory', category: 'military' }),
    render(state, options) { renderCalls.push(options); },
  };

  const shell = CanvasGameShell.mount({ state: { currentTab: 'buildings' } }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
  });
  shell.buildingOffset = 2;

  listeners['document:pointerup']({ clientX: 160, clientY: 278, type: 'pointerup', timeStamp: 1000 });

  assert.equal(shell.activeBuildingCategory, 'military');
  assert.equal(shell.buildingOffset, 0);
  assert.equal(renderCalls.at(-1).activeBuildingCategory, 'military');
});

test('Canvas game shell selects tech node and keeps research as detail confirmation', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const renderCalls = [];
  const renderer = {
    getHitTarget: () => ({ type: 'selectTechNode', techId: 'farming_field_rotation' }),
    render(state, options) { renderCalls.push({ state, options }); },
  };

  const game = { state: { currentTab: 'tech', techs: { points: 1, eras: [] } } };
  const shell = CanvasGameShell.mount(game, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
  });

  listeners['document:pointerup']({ clientX: 160, clientY: 420, type: 'pointerup', timeStamp: 1000 });

  assert.equal(shell.selectedTechId, 'farming_field_rotation');
  assert.equal(game.state.techUiState.selectedTechId, 'farming_field_rotation');
  assert.equal(renderCalls.at(-1).options.selectedTechId, 'farming_field_rotation');
});

test('Canvas game shell passes tutorial tab locks into canvas renderer', () => {
  const { document, runtime } = createCanvasHarness();
  const renderCalls = [];
  const renderer = {
    getHitTarget: () => null,
    render(state, options) { renderCalls.push(options); },
  };

  CanvasGameShell.mount({
    state: { currentTab: 'resources' },
    tutorialController: {
      canOpenTab(tabId) {
        return tabId === 'resources';
      },
    },
  }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
  });

  const locks = renderCalls.at(-1).tabLocks;
  assert.deepEqual(locks.find((tab) => tab.id === 'resources'), { id: 'resources', disabled: false, isLocked: false });
  assert.deepEqual(locks.find((tab) => tab.id === 'buildings'), { id: 'buildings', disabled: true, isLocked: true });
});

test('Canvas game shell owns event modal state and dispatches claim actions', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const actions = [
    { type: 'openEvent', eventId: 'evt_forest' },
    { type: 'claimEvent', eventId: 'evt_forest', optionId: 'collect_wood' },
    { type: 'openEvent', eventId: 'evt_forest' },
    { type: 'closeEvent' },
  ];
  const renderCalls = [];
  const controllerCalls = [];
  const dispatched = [];
  const renderer = {
    getHitTarget: () => actions.shift(),
    render(state, options) { renderCalls.push(options); },
  };
  const shell = CanvasGameShell.mount({
    state: {
      currentTab: 'events',
      eventQueue: [{ id: 'evt_forest', options: [{ id: 'collect_wood' }] }],
    },
    eventController: {
      open(eventId) { controllerCalls.push(['open', eventId]); },
      close() { controllerCalls.push(['close']); },
    },
  }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    previewEnabled: true,
    inputEnabled: true,
    onAction: (action) => {
      dispatched.push(action);
      return true;
    },
  });

  listeners['document:pointerup']({ clientX: 205, clientY: 300, type: 'pointerup', timeStamp: 1000 });
  assert.equal(shell.activeEventId, 'evt_forest');
  assert.equal(renderCalls.at(-1).activeEventId, 'evt_forest');
  listeners['document:pointerup']({ clientX: 205, clientY: 500, type: 'pointerup', timeStamp: 1300 });
  assert.equal(shell.activeEventId, null);
  assert.deepEqual(dispatched, [{ type: 'claimEvent', eventId: 'evt_forest', optionId: 'collect_wood' }]);
  listeners['document:pointerup']({ clientX: 205, clientY: 300, type: 'pointerup', timeStamp: 1600 });
  listeners['document:pointerup']({ clientX: 350, clientY: 120, type: 'pointerup', timeStamp: 1900 });
  assert.equal(shell.activeEventId, null);
  assert.deepEqual(controllerCalls, [['open', 'evt_forest'], ['close'], ['open', 'evt_forest'], ['close']]);
});

test('canvas HUD takeover leaves no hidden H5 business UI shell', () => {
  const css = fs.readFileSync(path.join(projectRoot, 'frontend', 'style.css'), 'utf8');
  const appJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'app.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(projectRoot, 'frontend', 'index.html'), 'utf8');

  assert.match(indexHtml, /<div id="app" aria-hidden="true"><\/div>/);
  assert.doesNotMatch(indexHtml, /resource-strip|resourcePanel|resourceDetailModal|citySwitcher/);
  assert.doesNotMatch(indexHtml, /population-panel|PopulationPanelAdapter|craftsmanCard|farmerCount|scholarCount|craftsmanCount/);
  assert.doesNotMatch(indexHtml, /advisorModal|advisorBtn|AdvisorPanelAdapter|btnAdvisor|advisorMessage/);
  assert.doesNotMatch(indexHtml, /buildingGrid|BuildingUIRenderer|BuildingActionAdapter|building-panel|building-card/);
  assert.doesNotMatch(indexHtml, /eventModal|eventsBadge|pendingEventsContainer|eventHistoryList|EventUIRenderer/);
  assert.doesNotMatch(indexHtml, /CitySwitcherAdapter|ResourceRenderer|ResourceDetailModalAdapter/);
  assert.doesNotMatch(indexHtml, /class="page|data-page=|class="tab-btn|data-tab=|offlineModal|modal-overlay/);
  assert.doesNotMatch(css, /\.top-bar|\.tab-bar|\.tab-btn|\.page-container|\.page\b|\.modal-overlay|offline-|resource-strip|city-switcher/);
  assert.doesNotMatch(appJs, /canvasShell\.renderReadOnly\(this\.state, this\.state\.currentTab\)/);
});

test('Browser entry loads Canvas game shell before app as the authoritative UI surface', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'app.js'), 'utf8');
  const actionControllerJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'CanvasActionController.js'), 'utf8');

  assert.match(html, /js\/platform\/H5CanvasRuntime\.js\?v=tech-tree-zoom-gestures-v1/);
  assert.match(html, /js\/platform\/CanvasActionController\.js\?v=tech-tree-zoom-gestures-v1[\s\S]*js\/platform\/CanvasGameShell\.js\?v=tech-tree-zoom-gestures-v1/);
  assert.match(html, /js\/platform\/CanvasGameShell\.js\?v=tech-tree-zoom-gestures-v1[\s\S]*app\.js\?v=h5-bootstrap-explicit-doc-v3/);
  assert.match(html, /<div id="app" aria-hidden="true"><\/div>/);
  assert.match(appJs, /CanvasGameShell\?\.mount\(this/);
  assert.match(appJs, /presenter: this\.presenter/);
  assert.match(appJs, /previewEnabled: true/);
  assert.match(appJs, /inputEnabled: true/);
  assert.match(appJs, /class H5GameHost extends CanvasGameAppBase/);
  assert.doesNotMatch(appJs, /handleCanvasTabSelection\(tabId\)/);
  assert.doesNotMatch(appJs, /action\?\.type === 'switchTab'/);
  assert.match(actionControllerJs, /handle_switchTab\(action/);
  assert.match(actionControllerJs, /handleCanvasTabSelection/);
  assert.match(actionControllerJs, /game\.handleCanvasTabSelection\(action\.tab\)/);
  assert.match(appJs, /class H5GameHost extends CanvasGameAppBase/);
  assert.doesNotMatch(appJs, /canvasShell\.renderReadOnly\(this\.state, this\.state\.currentTab\)/);
});
