const test = require('node:test');
const assert = require('node:assert/strict');

const GameConfig = require('../js/config/GameConfig');
const UIStatePresenter = require('../js/state/UIStatePresenter');
const GameAPI = require('../js/api/GameAPI');
const PlatformRuntime = require('../js/platform/PlatformRuntime');
const MiniGameCanvasRenderer = require('../js/platform/MiniGameCanvasRenderer');
const MiniGameApp = require('../js/platform/MiniGameApp');
const fs = require('node:fs');
const path = require('node:path');

function createCanvasStub(calls) {
  return {
    width: 0,
    height: 0,
    getContext(type) {
      assert.equal(type, '2d');
      return {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        font: '',
        textBaseline: '',
        textAlign: '',
        scale: (...args) => calls.push(['scale', ...args]),
        clearRect: (...args) => calls.push(['clearRect', ...args]),
        fillRect: (...args) => calls.push(['fillRect', ...args]),
        beginPath: () => calls.push(['beginPath']),
        rect: (...args) => calls.push(['rect', ...args]),
        moveTo: (...args) => calls.push(['moveTo', ...args]),
        lineTo: (...args) => calls.push(['lineTo', ...args]),
        fill: () => calls.push(['fill']),
        stroke: () => calls.push(['stroke']),
        fillText: (...args) => calls.push(['fillText', ...args]),
      };
    },
  };
}

test('PlatformRuntime wraps wx style canvas, storage and request APIs without DOM', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  const storage = new Map();
  const runtime = new PlatformRuntime({
    kind: 'wechat',
    host: {
      createCanvas() {
        calls.push(['createCanvas']);
        return createCanvasStub(calls);
      },
      getSystemInfoSync() {
        return { windowWidth: 390, windowHeight: 844, pixelRatio: 2 };
      },
      getStorageSync(key) {
        return storage.get(key);
      },
      setStorageSync(key, value) {
        storage.set(key, value);
      },
      request(options) {
        calls.push(['request', options.url, options.method, options.header.Authorization, options.data]);
        options.success({ statusCode: 200, data: { ok: true } });
      },
    },
  });

  try {
    global.fetch = undefined;
    runtime.setStorage('token', 'abc');
    assert.equal(runtime.getStorage('token'), 'abc');
    const canvas = runtime.createCanvas();
    assert.ok(canvas);
    const response = await runtime.request({
      url: 'https://server.example/api/game/state',
      method: 'POST',
      headers: { Authorization: 'Bearer abc' },
      body: JSON.stringify({ action: 'noop' }),
    });
    assert.equal(response.ok, true);
    assert.deepEqual(await response.json(), { ok: true });
    assert.deepEqual(calls.find((call) => call[0] === 'request'), [
      'request',
      'https://server.example/api/game/state',
      'POST',
      'Bearer abc',
      { action: 'noop' },
    ]);
  } finally {
    global.fetch = originalFetch;
  }
});

test('MiniGame app renders state and syncs through platform transport without document', async () => {
  const originalDocument = global.document;
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  const calls = [];
  const timers = [];
  const runtime = new PlatformRuntime({
    kind: 'douyin',
    host: {
      createCanvas() {
        return createCanvasStub(calls);
      },
      getSystemInfoSync() {
        return { windowWidth: 360, windowHeight: 720, pixelRatio: 1 };
      },
    },
  });
  const api = new GameAPI('/api', null, {
    transport: {
      async request() {
        return {
          ok: true,
          async json() {
            return {
              gameState: {
                currentEra: 2,
                resources: { food: 1200, knowledge: 5, wood: 30, foodNetPerSecond: 1 },
                population: { total: 4, max: 6, unassigned: 1, farmers: 2, scholars: 1, craftsmen: 1 },
                softGuide: { message: '继续建设', target: 'tab-buildings' },
              },
            };
          },
        };
      },
    },
  });
  let app = null;

  try {
    global.document = undefined;
    global.setInterval = (callback, intervalMs) => {
      const timer = { callback, intervalMs };
      timers.push(timer);
      return timer;
    };
    global.clearInterval = () => {};

    app = new MiniGameApp({
      runtime,
      api,
      presenter: UIStatePresenter,
      config: GameConfig,
      initialState: {
        currentEra: 0,
        resources: { food: 10, knowledge: 0 },
        population: { total: 3, max: 3, unassigned: 0, farmers: 3, scholars: 0 },
      },
    });
    app.start();
    await app.syncOnce();

    assert.equal(timers.length, 1);
    assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '建造'));
    assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('1.2k')));
    assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === app.state.softGuide.message));
  } finally {
    app?.stop?.();
    global.document = originalDocument;
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  }
});

test('minigame entry does not load H5 DOM adapters', () => {
  const projectRoot = path.join(__dirname, '..', '..');
  const entry = fs.readFileSync(path.join(projectRoot, 'frontend', 'minigame', 'game.js'), 'utf8');
  const platformFiles = [
    'PlatformRuntime.js',
    'MiniGameCanvasRenderer.js',
    'MiniGameApp.js',
  ].map((file) => fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', file), 'utf8')).join('\n');

  assert.doesNotMatch(entry, /app\.js|auth\.js|population\.js|logs\.js|floating-text\.js|DOMHelper|document|getElementById|querySelector|innerHTML|classList/);
  assert.doesNotMatch(platformFiles, /document|getElementById|querySelector|innerHTML|classList/);
  assert.doesNotMatch(platformFiles, /global\.UIStatePresenter|globalThis\.UIStatePresenter|window\.UIStatePresenter/);
  assert.match(entry, /PlatformRuntime/);
  assert.match(entry, /MiniGameCanvasRenderer/);
  assert.match(entry, /MiniGameApp/);
  assert.match(entry, /presenter: globalThis\.UIStatePresenter/);
});

test('MiniGame app dispatches canvas taps to server actions without DOM controllers', async () => {
  const originalDocument = global.document;
  const calls = [];
  const requests = [];
  let tapHandler = null;
  const runtime = new PlatformRuntime({
    kind: 'wechat',
    host: {
      createCanvas() {
        return createCanvasStub(calls);
      },
      getSystemInfoSync() {
        return { windowWidth: 360, windowHeight: 720, pixelRatio: 1 };
      },
      onTouchEnd(handler) {
        tapHandler = handler;
      },
      offTouchEnd() {
        tapHandler = null;
      },
    },
  });
  const api = new GameAPI('/api', null, {
    transport: {
      async request(options) {
        requests.push(JSON.parse(options.body || '{}'));
        return {
          ok: true,
          async json() {
            return {
              gameState: {
                currentEra: 2,
                resources: { food: 100, knowledge: 4, wood: 1 },
                population: { total: 4, max: 6, unassigned: 1, farmers: 2, scholars: 1, craftsmen: 1 },
              },
            };
          },
        };
      },
    },
  });
  let app = null;

  try {
    global.document = undefined;
    app = new MiniGameApp({
      runtime,
      api,
      presenter: UIStatePresenter,
      config: GameConfig,
      initialState: {
        currentEra: 2,
        resources: { food: 100, knowledge: 4, wood: 1 },
        population: { total: 4, max: 6, unassigned: 1, farmers: 2, scholars: 1, craftsmen: 1 },
      },
    });
    app.start();

    assert.equal(typeof tapHandler, 'function');
    app.handleTap({ x: 96, y: 162 });
    await new Promise((resolve) => setImmediate(resolve));

    app.handleTap({ x: 88, y: 670 });
    assert.equal(app.activeTab, 'buildings');

    assert.deepEqual(requests.find((request) => request.action === 'assign'), {
      action: 'assign',
      target: 'farmer',
      count: 1,
    });
    assert.equal(calls.some((call) => call[0] === 'fillText' && call[1] === '建造'), true);
  } finally {
    app?.stop?.();
    global.document = originalDocument;
  }
});
