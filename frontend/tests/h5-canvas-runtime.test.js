const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const H5CanvasRuntime = require('../js/platform/H5CanvasRuntime');
global.H5CanvasRuntime = H5CanvasRuntime;
const H5CanvasAppShell = require('../js/platform/H5CanvasAppShell');

const projectRoot = path.join(__dirname, '..', '..');

function createCanvasHarness() {
  const listeners = {};
  const appended = [];
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
  };
  return { canvas, ctx, document, runtime, listeners, appended };
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
  assert.equal(canvas.style.pointerEvents, 'none');
  assert.equal(canvas.style.touchAction, 'auto');
  assert.equal(canvas.style.zIndex, '999');
  assert.equal(canvas.style.background, 'transparent');
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
  listeners['document:pointerup']({ clientX: 205, clientY: 442, type: 'pointerup', timeStamp: 1000 });

  assert.deepEqual(sizes.at(-1), { width: 300, height: 600, pixelRatio: 3 });
  assert.deepEqual(taps.at(-1), { x: 150, y: 300 });
});

test('H5 canvas app shell mounts runtime without requiring renderer', () => {
  const { document, runtime, appended } = createCanvasHarness();
  const shell = H5CanvasAppShell.mount({ state: { resources: {} } }, {
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

test('H5 canvas app shell can render read-only HUD preview when explicitly enabled', () => {
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
  const shell = H5CanvasAppShell.mount({ state }, {
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
        logs: [],
        tutorial: {},
        buildingOffset: 0,
      },
  });
  assert.equal(shell.renderReadOnly({ currentTab: 'buildings' }, 'buildings'), true);
  assert.equal(renderCalls.at(-1).options.activeTab, 'buildings');
  assert.equal(renderCalls.at(-1).options.mode, 'hud');
});

test('H5 canvas app shell keeps preview disabled by default so existing DOM UI remains authoritative', () => {
  const { document, runtime } = createCanvasHarness();
  const renderCalls = [];
  const renderer = { render: (...args) => renderCalls.push(args) };
  const shell = H5CanvasAppShell.mount({ state: { currentTab: 'resources' } }, {
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

test('H5 canvas app shell bridges canvas tab taps only when input is explicitly enabled', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const actions = [];
  const renderer = {
    getHitTarget(point) {
      return point.x > 100 ? { type: 'switchTab', tab: 'buildings' } : null;
    },
    render() {},
  };
  const shell = H5CanvasAppShell.mount({ state: { currentTab: 'resources' } }, {
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

test('H5 canvas app shell can fallback to game.switchTab for canvas tab actions', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const switched = [];
  const renderer = {
    getHitTarget: () => ({ type: 'switchTab', tab: 'events' }),
    render() {},
  };
  const shell = H5CanvasAppShell.mount({
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

test('H5 canvas app shell owns resource details panel state without DOM adapter', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const renderCalls = [];
  const actions = [{ type: 'openResourceDetails' }, { type: 'closeResourceDetails' }];
  const renderer = {
    getHitTarget: () => actions.shift(),
    render(state, options) { renderCalls.push(options); },
  };
  H5CanvasAppShell.mount({ state: { currentTab: 'resources', resources: { food: 10 } } }, {
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

test('H5 canvas app shell owns city switcher state and dispatches canvas city selection', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const actions = [{ type: 'openCitySwitcher' }, { type: 'selectCity', cityId: 'site_river' }];
  const renderCalls = [];
  const selected = [];
  const renderer = {
    getHitTarget: () => actions.shift(),
    render(state, options) { renderCalls.push(options); },
  };
  H5CanvasAppShell.mount({ state: { currentTab: 'resources' } }, {
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

test('H5 canvas app shell dispatches every HUD hit action and consumes the event', () => {
  const { document, runtime, listeners } = createCanvasHarness();
  const renderCalls = [];
  const prevented = [];
  const renderer = {
    getHitTarget: () => ({ type: 'openAdvisor' }),
    render(state, options) { renderCalls.push(options); },
  };
  H5CanvasAppShell.mount({ state: { currentTab: 'resources' } }, {
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

test('H5 canvas app shell owns advisor panel state and dispatches target action', () => {
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
  H5CanvasAppShell.mount({ state: { currentTab: 'resources', softGuide: { message: 'Scout north', target: 'tab-military' } } }, {
    Runtime: H5CanvasRuntime,
    document,
    runtime,
    renderer,
    presenter: {
      buildAdvisorViewState: () => ({ hidden: false, activeAdvisor: { message: 'Scout north', target: 'tab-military' } }),
    },
    previewEnabled: true,
    inputEnabled: true,
    onAction: (action) => {
      if (action.type === 'goToAdvisorTarget') goCalls.push(action.type);
      return true;
    },
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

test('H5 canvas app shell dispatches building actions without DOM adapter', () => {
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
  const shell = H5CanvasAppShell.mount({ state: { currentTab: 'buildings' } }, {
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

test('H5 canvas app shell owns building pager state without DOM adapter', () => {
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
  const shell = H5CanvasAppShell.mount({ state: { currentTab: 'buildings' } }, {
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
  listeners['document:pointerup']({ clientX: 30, clientY: 800, type: 'pointerup', timeStamp: 1300 });
  assert.equal(shell.buildingOffset, 0);
  assert.deepEqual(dispatched, [{ type: 'switchTab', tab: 'resources' }]);
});

test('stage 6 canvas HUD takeover removes resource and city switcher DOM controls', () => {
  const css = fs.readFileSync(path.join(projectRoot, 'frontend', 'style.css'), 'utf8');
  const appJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'app.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(projectRoot, 'frontend', 'index.html'), 'utf8');

  assert.match(css, /#app > \.top-bar > \.top-status-row,[\s\S]*#app > \.tab-bar \{[\s\S]*opacity: 0;[\s\S]*pointer-events: none;/);
  assert.doesNotMatch(css, /city-switcher/);
  assert.doesNotMatch(css, /\.resource-strip/);
  assert.doesNotMatch(indexHtml, /resource-strip/);
  assert.doesNotMatch(indexHtml, /resourcePanel/);
  assert.doesNotMatch(indexHtml, /resourceDetailModal/);
  assert.doesNotMatch(indexHtml, /citySwitcher/);
  assert.doesNotMatch(indexHtml, /population-panel|PopulationPanelAdapter|craftsmanCard|farmerCount|scholarCount|craftsmanCount/);
  assert.doesNotMatch(indexHtml, /advisorModal|advisorBtn|AdvisorPanelAdapter|btnAdvisor|advisorMessage/);
  assert.doesNotMatch(indexHtml, /buildingGrid|BuildingUIRenderer|BuildingActionAdapter|building-panel|building-card/);
  assert.doesNotMatch(indexHtml, /CitySwitcherAdapter/);
  assert.doesNotMatch(indexHtml, /ResourceRenderer/);
  assert.doesNotMatch(indexHtml, /ResourceDetailModalAdapter/);
  assert.match(appJs, /canvasShell\.renderReadOnly\(this\.state, this\.state\.currentTab\)/);
});

test('H5 entry loads canvas shell before app without replacing DOM UI', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'app.js'), 'utf8');

  assert.match(html, /js\/platform\/H5CanvasRuntime\.js\?v=h5-canvas-runtime-v1/);
  assert.match(html, /js\/platform\/H5CanvasAppShell\.js\?v=h5-canvas-shell-v1[\s\S]*app\.js\?v=h5-bootstrap-explicit-doc-v3/);
  assert.match(html, /<div id="app">/);
  assert.match(appJs, /H5CanvasAppShell\?\.mount\(this/);
  assert.match(appJs, /presenter: this\.presenter/);
  assert.match(appJs, /previewEnabled: true/);
  assert.match(appJs, /inputEnabled: true/);
  assert.match(appJs, /action\?\.type === 'switchTab'/);
  assert.match(appJs, /this\.switchTab\(action\.tab\)/);
  assert.match(appJs, /canvasShell\.renderReadOnly\(this\.state, this\.state\.currentTab\)/);
});
