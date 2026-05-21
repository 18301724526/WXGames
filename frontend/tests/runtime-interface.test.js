const test = require('node:test');
const assert = require('node:assert/strict');

const H5CanvasRuntime = require('../js/platform/H5CanvasRuntime');
const PlatformRuntime = require('../js/platform/PlatformRuntime');

function createStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, value); },
    removeItem(key) { data.delete(key); },
  };
}

function assertUnifiedRuntimeShape(runtime) {
  for (const method of [
    'createCanvas',
    'getSystemInfo',
    'request',
    'getStorage',
    'setStorage',
    'removeStorage',
    'onTap',
    'requestTextInput',
    'setInterval',
    'clearInterval',
    'now',
    'log',
  ]) {
    assert.equal(typeof runtime[method], 'function', `${method} should be a runtime function`);
  }
  assert.ok(['h5', 'wechat', 'douyin'].includes(runtime.kind));
}

test('H5CanvasRuntime exposes the unified Canvas runtime interface without replacing callers', async () => {
  const storage = createStorage();
  const calls = [];
  const canvas = {
    style: {},
    setAttribute() {},
    getContext() { return { setTransform() {} }; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 390, height: 844 }; },
  };
  const document = {
    documentElement: { clientWidth: 390, clientHeight: 844 },
    body: { appendChild(node) { calls.push(['appendChild', node]); } },
    createElement(tag) {
      calls.push(['createElement', tag]);
      return canvas;
    },
    addEventListener() {},
  };
  const host = {
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: 2,
    localStorage: storage,
    addEventListener() {},
    setInterval() { return 'timer'; },
    clearInterval(timer) { calls.push(['clearInterval', timer]); },
    prompt() { return '输入值'; },
    fetch(url, options) {
      calls.push(['fetch', url, options.method]);
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) });
    },
    console: { log(message) { calls.push(['log', message]); } },
  };
  const runtime = new H5CanvasRuntime({ document, runtime: host });

  assertUnifiedRuntimeShape(runtime);
  assert.equal(runtime.kind, 'h5');
  assert.equal(runtime.createCanvas(), canvas);
  assert.deepEqual(runtime.getSystemInfo(), { windowWidth: 390, windowHeight: 844, pixelRatio: 2 });
  runtime.setStorage('token', 'abc');
  assert.equal(runtime.getStorage('token'), 'abc');
  runtime.removeStorage('token');
  assert.equal(runtime.getStorage('token'), null);
  assert.equal(await runtime.requestTextInput({ title: '测试' }), '输入值');
  const response = await runtime.request({ url: '/api/test', method: 'POST', headers: {}, body: '{}' });
  assert.equal(response.ok, true);
  assert.ok(Number.isFinite(runtime.now()));
  runtime.log('hello');
  assert.ok(calls.some((call) => call[0] === 'fetch'));
  assert.ok(calls.some((call) => call[0] === 'log' && call[1] === 'hello'));
});

test('PlatformRuntime exposes the same unified Canvas runtime interface for mini game hosts', () => {
  const calls = [];
  const runtime = new PlatformRuntime({
    kind: 'wechat',
    host: {
      createCanvas() { return { getContext() { return {}; } }; },
      getSystemInfoSync() { return { windowWidth: 320, windowHeight: 640, pixelRatio: 3 }; },
      getStorageSync() { return null; },
      setStorageSync() {},
      removeStorageSync() {},
      request() {},
      onTouchEnd() {},
      showKeyboard() {},
    },
    scheduler: {
      setInterval() { return 'timer'; },
      clearInterval(timer) { calls.push(['clearInterval', timer]); },
    },
    logger: { log(message) { calls.push(['log', message]); } },
  });

  assertUnifiedRuntimeShape(runtime);
  assert.equal(runtime.kind, 'wechat');
  assert.deepEqual(runtime.getSystemInfo(), { windowWidth: 320, windowHeight: 640, pixelRatio: 3 });
  assert.ok(Number.isFinite(runtime.now()));
  runtime.log('hello');
  assert.deepEqual(calls.find((call) => call[0] === 'log'), ['log', 'hello']);
});
