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
  listeners.pointerup({ clientX: 205, clientY: 442 });

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
  assert.deepEqual(renderCalls[0], { state, options: { activeTab: 'resources', mode: 'hud' } });
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
  listeners.pointerup({ clientX: 205, clientY: 442 });
  assert.deepEqual(actions, [{ type: 'switchTab', tab: 'buildings' }]);

  shell.setInputEnabled(false);
  assert.equal(shell.inputEnabled, false);
  assert.equal(shell.tapDisposer, null);
  listeners.pointerup({ clientX: 205, clientY: 442 });
  assert.equal(actions.length, 1);
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
  listeners.pointerup({ clientX: 205, clientY: 442 });
  assert.deepEqual(switched, ['events']);
});

test('stage 5 verification hides original DOM resource strip while keeping canvas HUD enabled', () => {
  const css = fs.readFileSync(path.join(projectRoot, 'frontend', 'style.css'), 'utf8');
  const appJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'app.js'), 'utf8');

  assert.match(css, /\.top-bar > \.resource-panel\.resource-strip/);
  assert.match(css, /clip-path: inset\(50%\)/);
  assert.match(css, /pointer-events: none/);
  assert.match(appJs, /previewEnabled: true/);
  assert.match(appJs, /inputEnabled: false/);
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
  assert.match(appJs, /inputEnabled: false/);
  assert.match(appJs, /action\?\.type === 'switchTab'/);
  assert.match(appJs, /this\.switchTab\(action\.tab\)/);
  assert.match(appJs, /canvasShell\.renderReadOnly\(this\.state, this\.state\.currentTab\)/);
});
