const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const H5UpdateRuntimeAdapter = require('../js/ui/H5UpdateRuntimeAdapter');

const projectRoot = path.join(__dirname, '..', '..');

function createCanvasPromptHarness() {
  const listeners = {};
  const draws = [];
  const gradient = { addColorStop() {} };
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textBaseline: 'top',
    textAlign: 'left',
    setTransform() {},
    clearRect() {},
    fillRect() {},
    beginPath() {},
    roundRect() {},
    rect() {},
    fill() {},
    stroke() {},
    arc() {},
    fillText(text) { draws.push(text); },
    measureText(text) { return { width: String(text).length * 9 }; },
    createLinearGradient() { return gradient; },
  };
  const canvas = {
    style: {},
    width: 0,
    height: 0,
    setAttribute() {},
    getContext() { return ctx; },
    addEventListener(name, handler) { listeners[name] = handler; },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 390, height: 844 };
    },
  };
  const bodyChildren = [];
  const document = {
    body: {
      appendChild(node) {
        bodyChildren.push(node);
      },
    },
    documentElement: {
      clientWidth: 390,
      clientHeight: 844,
    },
    defaultView: {
      addEventListener() {},
    },
    createElement(tag) {
      assert.equal(tag, 'canvas');
      return canvas;
    },
  };
  return { canvas, ctx, document, listeners, bodyChildren, draws };
}

test('H5 update runtime adapter owns confirmation cache clearing and reload', async () => {
  const confirmed = [];
  const deletedCaches = [];
  const unregistered = [];
  const replaced = [];
  const adapter = new H5UpdateRuntimeAdapter({}, {
    confirm(message) {
      confirmed.push(message);
      return true;
    },
    caches: {
      async keys() {
        return ['frontend-v1', 'runtime-v1'];
      },
      async delete(key) {
        deletedCaches.push(key);
      },
    },
    navigator: {
      serviceWorker: {
        async getRegistrations() {
          return [
            { unregister: async () => unregistered.push('sw-a') },
            { unregister: async () => unregistered.push('sw-b') },
          ];
        },
      },
    },
    location: {
      href: 'https://kodagame.top/index.html?foo=bar',
      replace(url) {
        replaced.push(url);
      },
    },
    now: () => 12345,
  });

  const nextUrl = await adapter.promptAndReload({ version: '1.2.3' });

  assert.deepEqual(confirmed, ['游戏有更新，需要重启后继续。\n版本：1.2.3']);
  assert.deepEqual(deletedCaches, ['frontend-v1', 'runtime-v1']);
  assert.deepEqual(unregistered, ['sw-a', 'sw-b']);
  assert.equal(nextUrl, 'https://kodagame.top/index.html?foo=bar&reload=12345');
  assert.deepEqual(replaced, [nextUrl]);
});

test('H5 update runtime adapter binds runtime confirm to avoid illegal invocation', async () => {
  const calls = [];
  const runtime = {
    prefix: 'runtime-bound',
    confirm(message) {
      calls.push(`${this.prefix}:${message}`);
      return true;
    },
  };
  const adapter = H5UpdateRuntimeAdapter.fromRuntime(runtime, {
    caches: { async keys() { return []; }, async delete() {} },
    navigator: { serviceWorker: { async getRegistrations() { return []; } } },
    location: { href: 'https://kodagame.top/', replace() {} },
    now: () => 1,
  });

  await adapter.promptAndReload({ version: '2.0.0' });

  assert.deepEqual(calls, ['runtime-bound:游戏有更新，需要重启后继续。\n版本：2.0.0']);
});

test('H5 update runtime adapter renders a canvas prompt and waits for canvas click before reload', async () => {
  const { canvas, document, listeners, bodyChildren, draws } = createCanvasPromptHarness();
  const replaced = [];
  let confirmCalls = 0;
  const runtime = {
    document,
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: 1,
    confirm() {
      confirmCalls += 1;
      return true;
    },
  };
  const adapter = H5UpdateRuntimeAdapter.fromRuntime(runtime, {
    caches: { async keys() { return []; }, async delete() {} },
    navigator: { serviceWorker: { async getRegistrations() { return []; } } },
    location: {
      href: 'https://kodagame.top/',
      replace(url) {
        replaced.push(url);
      },
    },
    now: () => 99,
  });

  const pending = adapter.promptAndReload({ version: '3.0.0' });

  await Promise.resolve();

  assert.equal(bodyChildren.length, 1);
  assert.equal(canvas.style.display, 'block');
  assert.equal(confirmCalls, 0);
  assert.ok(draws.includes('发现新版本'));
  assert.ok(draws.includes('立即更新'));
  assert.equal(adapter.promptButtonRect.y, 526);
  assert.equal(replaced.length, 0);

  const button = adapter.promptButtonRect;
  listeners.click({
    clientX: button.x + button.width / 2,
    clientY: button.y + button.height / 2,
    preventDefault() {},
  });

  const nextUrl = await pending;

  assert.equal(canvas.style.display, 'none');
  assert.equal(nextUrl, 'https://kodagame.top/?reload=99');
  assert.deepEqual(replaced, [nextUrl]);
});

test('app delegates update reload runtime instead of touching browser globals directly', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'app.js'), 'utf8');
  const adapterJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'ui', 'H5UpdateRuntimeAdapter.js'), 'utf8');

  assert.match(html, /js\/ui\/H5UpdateRuntimeAdapter\.js\?v=h5-update-runtime-v5/);
  assert.match(html, /H5UpdateRuntimeAdapter\.js\?v=h5-update-runtime-v5[\s\S]*H5ShellAdapter\.js\?v=h5-shell-registry-v1[\s\S]*app\.js\?v=h5-bootstrap-explicit-doc-v3/);
  assert.match(appJs, /this\.updateRuntime\?\.promptAndReload\(version\)/);
  assert.doesNotMatch(appJs, /window\.confirm|window\.caches|navigator\.serviceWorker|window\.location|new URL\(window\.location/);
  assert.doesNotMatch(adapterJs, /global\.navigator|global\.URL/);
  assert.match(adapterJs, /this\.runtime\.confirm\.bind\(this\.runtime\)/);
  assert.match(adapterJs, /createElement\('canvas'\)/);
});
