const test = require('node:test');
const assert = require('node:assert/strict');

const GameConfig = require('../js/config/GameConfig');
const UIStatePresenter = require('../js/state/UIStatePresenter');
const GameAPI = require('../js/api/GameAPI');
const PlatformRuntime = require('../js/platform/PlatformRuntime');
const MiniGameCanvasRenderer = require('../js/platform/MiniGameCanvasRenderer');
const CanvasActionDispatcher = require('../js/platform/CanvasActionDispatcher');
global.CanvasActionDispatcher = CanvasActionDispatcher;
const WorldMapRuntime = require('../js/platform/WorldMapRuntime');
global.WorldMapRuntime = WorldMapRuntime;
const WorldMapRuntimeCoordinator = require('../js/platform/WorldMapRuntimeCoordinator');
global.WorldMapRuntimeCoordinator = WorldMapRuntimeCoordinator;
const CanvasGameApp = require('../js/platform/CanvasGameApp');
const fs = require('node:fs');
const path = require('node:path');

function createCanvasStub(calls) {
  return {
    width: 0,
    height: 0,
    getContext(type) {
      assert.equal(type, '2d');
      const gradient = {
        addColorStop: (...args) => calls.push(['addColorStop', ...args]),
      };
      return {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        font: '',
        textBaseline: '',
        textAlign: '',
        globalAlpha: 1,
        scale: (...args) => calls.push(['scale', ...args]),
        clearRect: (...args) => calls.push(['clearRect', ...args]),
        fillRect: (...args) => calls.push(['fillRect', ...args]),
        beginPath: () => calls.push(['beginPath']),
        rect: (...args) => calls.push(['rect', ...args]),
        roundRect: (...args) => calls.push(['roundRect', ...args]),
        moveTo: (...args) => calls.push(['moveTo', ...args]),
        lineTo: (...args) => calls.push(['lineTo', ...args]),
        createLinearGradient: (...args) => {
          calls.push(['createLinearGradient', ...args]);
          return gradient;
        },
        fill: () => calls.push(['fill']),
        stroke: () => calls.push(['stroke']),
        save: () => {},
        restore: () => {},
        clip: () => {},
        arc: () => {},
        fillText: (...args) => calls.push(['fillText', ...args]),
        drawImage: (...args) => calls.push(['drawImage', ...args]),
      };
    },
  };
}

function createManualScheduler() {
  const timers = [];
  return {
    timers,
    setInterval(callback, intervalMs) {
      const timer = { type: 'interval', callback, intervalMs };
      timers.push(timer);
      return timer;
    },
    clearInterval() {},
    setTimeout(callback, delayMs) {
      const timer = { type: 'timeout', callback, delayMs };
      timers.push(timer);
      return timer;
    },
    clearTimeout() {},
  };
}

function createTileMapHomeState(overrides = {}) {
  return {
    currentEra: 5,
    currentTab: 'resources',
    militaryView: 'army',
    resources: { food: 100 },
    population: { total: 4, max: 6, unassigned: 1, farmers: 2, scholars: 1, craftsmen: 0 },
    territoryState: {
      worldMap: {
        version: 2,
        seed: 'map-home-test',
        tiles: [
          { id: 'tile_0_0', q: 0, r: 0, terrain: 'plains' },
          { id: 'tile_1_0', q: 1, r: 0, terrain: 'plains' },
        ],
      },
      territories: [],
    },
    ...overrides,
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

test('PlatformRuntime emits shared pinch zoom gestures for touch hosts', () => {
  const handlers = {};
  const runtime = new PlatformRuntime({
    kind: 'wechat',
    host: {
      onTouchStart(handler) { handlers.start = handler; },
      onTouchMove(handler) { handlers.move = handler; },
      onTouchEnd(handler) { handlers.end = handler; },
      offTouchStart() {},
      offTouchMove() {},
      offTouchEnd() {},
    },
  });
  const gestures = [];

  runtime.onGesture((gesture) => {
    gestures.push(gesture);
    return true;
  });
  handlers.start({
    touches: [
      { x: 100, y: 200 },
      { x: 180, y: 200 },
    ],
  });
  handlers.move({
    touches: [
      { x: 90, y: 200 },
      { x: 210, y: 200 },
    ],
  });

  assert.equal(gestures.length, 1);
  assert.equal(gestures[0].type, 'pinchZoom');
  assert.equal(gestures[0].centerX, 150);
  assert.equal(gestures[0].centerY, 200);
  assert.ok(gestures[0].scaleDelta > 1);
});

test('CanvasGameApp defaults unlocked tile map saves to map home and keeps early saves unchanged', () => {
  const runtime = new PlatformRuntime({
    kind: 'wechat',
    host: {
      createCanvas() { return createCanvasStub([]); },
      getSystemInfoSync() { return { windowWidth: 390, windowHeight: 844, pixelRatio: 2 }; },
      setInterval() { return null; },
      clearInterval() {},
    },
  });
  const renderer = { render() {} };
  const unlocked = new CanvasGameApp({
    runtime,
    api: {},
    renderer,
    presenter: UIStatePresenter,
    initialState: createTileMapHomeState(),
  });

  assert.equal(unlocked.activeTab, 'military');
  assert.equal(unlocked.state.currentTab, 'military');
  assert.equal(unlocked.militaryView, 'world');
  assert.equal(unlocked.state.militaryView, 'world');
  assert.equal(unlocked.mapHomeActive, true);

  unlocked.switchTab('tech');
  assert.equal(unlocked.state.currentTab, 'tech');
  assert.equal(unlocked.mapHomeActive, false);

  unlocked.applyState({ gameState: createTileMapHomeState() });
  assert.equal(unlocked.state.currentTab, 'tech');
  assert.equal(unlocked.mapHomeActive, false);

  unlocked.switchTab('resources');
  assert.equal(unlocked.state.currentTab, 'military');
  assert.equal(unlocked.state.militaryView, 'world');
  assert.equal(unlocked.mapHomeActive, true);

  const early = new CanvasGameApp({
    runtime,
    api: {},
    renderer,
    presenter: UIStatePresenter,
    initialState: createTileMapHomeState({ currentEra: 4 }),
  });

  assert.equal(early.activeTab, 'resources');
  assert.equal(early.state.currentTab, 'resources');
  assert.equal(early.militaryView, 'army');
  assert.equal(early.mapHomeActive, false);
});

test('CanvasGameApp syncFromServer preserves map home when unlocked', () => {
  const runtime = new PlatformRuntime({
    kind: 'wechat',
    host: {
      createCanvas() { return createCanvasStub([]); },
      getSystemInfoSync() { return { windowWidth: 390, windowHeight: 844, pixelRatio: 2 }; },
      setInterval() { return null; },
      clearInterval() {},
    },
  });
  const renderCalls = [];
  const app = new CanvasGameApp({
    runtime,
    api: {},
    renderer: {
      render(state, options) {
        renderCalls.push({ state, options });
      },
    },
    presenter: UIStatePresenter,
    initialState: createTileMapHomeState({ currentEra: 4 }),
  });

  app.syncFromServer(createTileMapHomeState(), {}, {});

  assert.equal(app.state.currentTab, 'military');
  assert.equal(app.state.militaryView, 'world');
  assert.equal(app.activeTab, 'military');
  assert.equal(app.mapHomeActive, true);
  assert.equal(renderCalls.at(-1).options.activeTab, 'military');
  assert.equal(renderCalls.at(-1).options.isMapHome, true);
});

test('Canvas game app renders state and syncs through platform transport without document', async () => {
  const originalDocument = global.document;
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
    textInput: () => '东岸城',
    scheduler: {
      setInterval(callback, intervalMs) {
        const timer = { callback, intervalMs };
        timers.push(timer);
        return timer;
      },
      clearInterval() {},
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
    app = new CanvasGameApp({
      runtime,
      api,
      rendererClass: MiniGameCanvasRenderer,
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
  }
});

test('Canvas game app keeps post-login loading visible for at least three seconds', async () => {
  const calls = [];
  const scheduler = createManualScheduler();
  let now = 1000;
  const runtime = new PlatformRuntime({
    kind: 'wechat',
    host: {
      createCanvas() {
        return createCanvasStub(calls);
      },
      getSystemInfoSync() {
        return { windowWidth: 360, windowHeight: 720, pixelRatio: 1 };
      },
    },
    scheduler,
  });
  runtime.now = () => now;
  const app = new CanvasGameApp({
    runtime,
    api: { setToken() {}, async getState() { return {}; } },
    rendererClass: MiniGameCanvasRenderer,
    presenter: UIStatePresenter,
    config: GameConfig,
    initialState: { currentEra: 0, currentTab: 'resources', resources: {}, population: {} },
  });
  app.preloadAssets = async (onProgress) => {
    onProgress({ percentage: 100 });
    now += 200;
    return { loaded: 1, failed: 0, total: 1, completed: 1, percentage: 100 };
  };

  const loadingPromise = app.loadGameAssets({ minimumDurationMs: 3000 });
  await new Promise((resolve) => setImmediate(resolve));

  const timeout = scheduler.timers.find((timer) => timer.type === 'timeout');
  assert.ok(timeout);
  assert.equal(timeout.delayMs, 2800);
  assert.equal(app.loading.visible, true);

  now += timeout.delayMs;
  timeout.callback();
  await loadingPromise;
  assert.equal(app.loading.visible, false);
});

test('Canvas game app can keep loading visible until server state arrives', async () => {
  const calls = [];
  const runtime = new PlatformRuntime({
    kind: 'wechat',
    host: {
      createCanvas() {
        return createCanvasStub(calls);
      },
      getSystemInfoSync() {
        return { windowWidth: 360, windowHeight: 720, pixelRatio: 1 };
      },
    },
  });
  const app = new CanvasGameApp({
    runtime,
    api: { setToken() {}, async getState() { return {}; } },
    rendererClass: MiniGameCanvasRenderer,
    presenter: UIStatePresenter,
    config: GameConfig,
    initialState: { currentEra: 0, currentTab: 'resources', resources: {}, population: {} },
  });
  app.preloadAssets = async (onProgress) => {
    onProgress({ percentage: 100 });
    return { loaded: 1, failed: 0, total: 1, completed: 1, percentage: 100 };
  };

  await app.loadGameAssets({ minimumDurationMs: 0, hideWhenDone: false });
  assert.equal(app.loading.visible, true);
  assert.equal(app.loading.percentage, 100);

  app.applyState({ gameState: { currentEra: 0, currentTab: 'resources', resources: {}, population: {} } });
  assert.equal(app.hasServerState, true);
  assert.equal(app.loading.visible, false);
});

test('minigame entry does not load H5 DOM adapters', () => {
  const projectRoot = path.join(__dirname, '..', '..');
  const entry = fs.readFileSync(path.join(projectRoot, 'frontend', 'minigame', 'game.js'), 'utf8');
  const platformFiles = [
    'PlatformRuntime.js',
    'MiniGameCanvasRenderer.js',
    'CanvasActionController.js',
    'CanvasGuideController.js',
    'CanvasGameApp.js',
  ].map((file) => fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', file), 'utf8')).join('\n');
  const appSource = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'CanvasGameApp.js'), 'utf8');

  assert.doesNotMatch(entry, /app\.js|auth\.js|population\.js|logs\.js|floating-text\.js|DOMHelper|document|getElementById|querySelector|innerHTML|classList/);
  assert.doesNotMatch(platformFiles, /document|getElementById|querySelector|innerHTML|classList/);
  assert.doesNotMatch(platformFiles, /global\.UIStatePresenter|globalThis\.UIStatePresenter|window\.UIStatePresenter/);
  assert.doesNotMatch(appSource, /global\.GameConfig|global\.GameAPI|global\.MiniGameCanvasRenderer|global\.PlatformRuntime/);
  assert.doesNotMatch(platformFiles, /global\.localStorage|global\.setInterval|global\.clearInterval|global\.innerWidth|global\.innerHeight|global\.devicePixelRatio/);
  assert.match(entry, /PlatformRuntime/);
  assert.match(entry, /FamousPortraitLayout/);
  assert.match(entry, /WorldMapRuntime/);
  assert.match(entry, /WorldMapRuntimeCoordinator/);
  assert.match(entry, /MiniGameCanvasRenderer/);
  assert.match(entry, /GameStateSync/);
  assert.match(entry, /CanvasActionController/);
  assert.match(entry, /CanvasGuideController/);
  assert.match(entry, /CanvasGameApp/);
  assert.match(entry, /presenter: globalThis\.UIStatePresenter/);
  assert.match(entry, /config: globalThis\.GameConfig/);
  assert.match(entry, /apiClass: globalThis\.GameAPI/);
  assert.match(entry, /rendererClass: globalThis\.MiniGameCanvasRenderer/);
});

test('Canvas game app stops heartbeat sync service on teardown', () => {
  let stopped = 0;
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    syncService: { start() {}, stop() { stopped += 1; } },
    initialState: { currentEra: 0, currentTab: 'resources', resources: {}, population: {} },
  });

  app.stop();

  assert.equal(stopped, 1);
});

test('map-home runtime orchestration stays shared between H5 and minigame hosts', () => {
  const projectRoot = path.join(__dirname, '..', '..');
  const appSource = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'CanvasGameApp.js'), 'utf8');
  const shellSource = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'CanvasGameShell.js'), 'utf8');

  assert.match(appSource, /WorldMapRuntimeCoordinator/);
  assert.match(shellSource, /WorldMapRuntimeCoordinator/);
  assert.doesNotMatch(appSource, /new\s+(WorldMapRuntime|RuntimeCtor)\s*\(/);
  assert.doesNotMatch(shellSource, /new\s+WorldMapRuntime\s*\(/);
});

test('CanvasGameApp routes map-home drags through WorldMapRuntime without global world drag actions', () => {
  const calls = [];
  const runtime = new PlatformRuntime({
    kind: 'wechat',
    host: {
      createCanvas() {
        return createCanvasStub(calls);
      },
      getSystemInfoSync() {
        return { windowWidth: 390, windowHeight: 844, pixelRatio: 2 };
      },
    },
    scheduler: {
      requestAnimationFrame(callback) {
        callback();
        return 1;
      },
    },
  });
  const renderer = {
    render() {},
    renderWorldMapLayer(state, options) {
      calls.push(['world-layer', options.territoryUiState.worldPanX, options.territoryUiState.worldPanY]);
      return true;
    },
    getTopBarBottom: () => 84,
    getHitTarget: () => ({ type: 'worldMapDrag', background: true }),
  };
  const app = new CanvasGameApp({
    runtime,
    api: {},
    renderer,
    presenter: UIStatePresenter,
    initialState: createTileMapHomeState(),
  });
  const actionCalls = [];
  app.actionController = {
    handle(action) {
      actionCalls.push(action);
      return true;
    },
  };

  assert.equal(app.handleDrag('start', { pointerId: 1, x: 120, y: 180 }), true);
  assert.equal(app.handleDrag('move', { pointerId: 1, x: 142, y: 194 }), true);
  assert.equal(app.handleDrag('end', { pointerId: 1, x: 142, y: 194 }), true);

  assert.deepEqual(actionCalls, []);
  assert.equal(app.territoryUiState.worldPanX, 22);
  assert.equal(app.territoryUiState.worldPanY, 14);
  assert.equal(calls.some((call) => call[0] === 'world-layer' && call[1] === 22 && call[2] === 14), false);
});

test('CanvasGameApp pans map-home through two-finger gestures without map redraws', () => {
  const calls = [];
  const runtime = new PlatformRuntime({
    kind: 'wechat',
    host: {
      createCanvas() {
        return createCanvasStub(calls);
      },
      getSystemInfoSync() {
        return { windowWidth: 390, windowHeight: 844, pixelRatio: 2 };
      },
    },
    scheduler: {
      requestAnimationFrame(callback) {
        callback();
        return 1;
      },
    },
  });
  const layerCalls = [];
  const renderer = {
    render() {},
    renderWorldMapLayer(state, options) {
      layerCalls.push(options);
      calls.push(['world-layer', options.territoryUiState.worldPanX, options.territoryUiState.worldPanY, options.snapshotOnly]);
      return true;
    },
    getTopBarBottom: () => 84,
    getHitTarget: () => ({ type: 'worldMapDrag', background: true }),
  };
  const app = new CanvasGameApp({
    runtime,
    api: {},
    renderer,
    presenter: UIStatePresenter,
    initialState: createTileMapHomeState(),
  });

  assert.equal(app.handleGesture({
    type: 'pinchZoom',
    phase: 'move',
    scaleDelta: 1,
    centerX: 150,
    centerY: 200,
    deltaX: 16,
    deltaY: 12,
  }), true);

  assert.equal(app.territoryUiState.worldPanX, 16);
  assert.equal(app.territoryUiState.worldPanY, 12);
  assert.equal(layerCalls.length, 0);
  assert.equal(calls.some((call) => call[0] === 'world-layer'), false);
});

test('CanvasGameApp skips water frames while dragging and resumes cached snapshot playback after cooldown', () => {
  const calls = [];
  const scheduler = createManualScheduler();
  scheduler.requestAnimationFrame = (callback) => {
    callback();
    return 1;
  };
  let now = 1000;
  const runtime = new PlatformRuntime({
    kind: 'wechat',
    host: {
      createCanvas() {
        return createCanvasStub(calls);
      },
      getSystemInfoSync() {
        return { windowWidth: 390, windowHeight: 844, pixelRatio: 2 };
      },
    },
    scheduler,
  });
  runtime.now = () => now;
  let app = null;
  const renderCalls = [];
  const layerCalls = [];
  const renderer = {
    getWorldTileWaterAnimationFps: () => 8,
    render(state, options) {
      renderCalls.push({ state, options });
      if (app) app.territoryUiState.tileMapWaterAnimated = true;
    },
    renderWorldMapLayer(state, options) {
      layerCalls.push({ state, options });
      return true;
    },
    getTopBarBottom: () => 84,
    getHitTarget: () => ({ type: 'worldMapDrag', background: true }),
  };
  app = new CanvasGameApp({
    runtime,
    scheduler,
    api: {},
    renderer,
    presenter: UIStatePresenter,
    initialState: createTileMapHomeState(),
  });

  app.renderCanvasSurface('resources');
  const timer = scheduler.timers.find((item) => item.type === 'interval');
  assert.ok(timer);
  assert.equal(timer.intervalMs, 125);

  assert.equal(app.handleDrag('start', { pointerId: 1, x: 120, y: 180 }), true);
  assert.equal(app.handleDrag('move', { pointerId: 1, x: 142, y: 194 }), true);
  now = 1080;
  const renderCountBeforeDragTimer = renderCalls.length;
  const layerCountBeforeDragTimer = layerCalls.length;
  timer.callback();

  assert.equal(renderCalls.length, renderCountBeforeDragTimer);
  assert.equal(layerCalls.length, layerCountBeforeDragTimer);

  assert.equal(app.handleDrag('end', { pointerId: 1, x: 142, y: 194 }), true);
  assert.equal(app.isWorldMapDragging(), false);
  assert.equal(app.isWorldMapDragCoolingDown(), true);
  const renderCountAfterDragEnd = renderCalls.length;
  const layerCountAfterDragEnd = layerCalls.length;
  now = 1100;
  timer.callback();

  assert.equal(renderCalls.length, renderCountAfterDragEnd);
  assert.equal(layerCalls.length, layerCountAfterDragEnd);

  now = 1400;
  timer.callback();

  assert.equal(app.isWorldMapDragCoolingDown(), false);
  assert.equal(renderCalls.length, renderCountAfterDragEnd);
  assert.equal(layerCalls.length, layerCountAfterDragEnd + 1);
  assert.equal(layerCalls.at(-1).options.snapshotOnly, true);
  assert.equal(layerCalls.at(-1).options.reuseCachedWorldTileView, true);
});

test('Canvas game app dispatches canvas taps to server actions without DOM controllers', async () => {
  const originalDocument = global.document;
  const calls = [];
  const requests = [];
  const timers = [];
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
    textInput: () => '东岸城',
    scheduler: {
      setInterval(callback, intervalMs) {
        const timer = { callback, intervalMs };
        timers.push(timer);
        return timer;
      },
      clearInterval() {},
    },
  });
  const api = new GameAPI('/api', null, {
    transport: {
      async request(options) {
        const body = JSON.parse(options.body || '{}');
        requests.push(body);
        if (options.url === '/api/game/tasks/claim') {
          return {
            ok: true,
            async json() {
              return {
                success: true,
                rewardReveal: { title: '获得奖励' },
                gameState: {
                  currentEra: 3,
                  currentTab: 'resources',
                  resources: { food: 260, knowledge: 80 },
                  population: { total: 4, max: 6, unassigned: 0, farmers: 3, scholars: 1, craftsmen: 0 },
                  unlockedBuildings: ['barracks'],
                  buildingDefinitions: {
                    barracks: {
                      id: 'barracks',
                      name: '兵营',
                      buildCost: { food: 260, knowledge: 80 },
                      ui: { description: '训练士兵', effectText: [] },
                      military: { soldierCapByLevel: [0, 300], trainingIntervalSecondsByLevel: [0, 30], trainingBatchSizeByLevel: [0, 10] },
                    },
                  },
                  buildingCosts: { barracks: { food: 260, knowledge: 80 } },
                  buildings: { barracks: { level: 0 } },
                },
                guideTasks: {
                  visible: true,
                  tasks: [{
                    id: 'barracks_supplies',
                    title: '城邑守备',
                    description: '建造兵营',
                    status: 'active',
                    target: 'card-barracks',
                    actionLabel: '前往',
                    action: {
                      type: 'goToGuideTaskTarget',
                      taskId: 'barracks_supplies',
                      target: 'card-barracks',
                      nextAction: { type: 'buildBuilding', buildingId: 'barracks' },
                    },
                  }],
                },
                softGuide: {
                  mode: 'strong',
                  target: 'card-barracks',
                  message: '建造兵营',
                },
              };
            },
          };
        }
        return {
          ok: true,
          async json() {
            return {
              gameState: {
                currentEra: 2,
                resources: { food: 100, knowledge: 4, wood: 1 },
                population: { total: 4, max: 6, unassigned: 1, farmers: 2, scholars: 1, craftsmen: 1 },
                activeCityId: 'capital',
                cityState: {
                  activeCityId: 'capital',
                  capitalCityId: 'capital',
                  cities: [
                    { id: 'capital', name: 'Capital', isCapital: true, population: { total: 4 }, totalBuildings: 2 },
                    { id: 'site_river', name: 'River City', isCapital: false, population: { total: 2 }, totalBuildings: 1 },
                  ],
                },
                eventQueue: [{
                  id: 'evt_forest',
                  type: 'special',
                  title: '森林低语',
                  description: '林间传来回声。',
                  icon: '🌲',
                  options: [{ id: 'collect_wood', label: '收集木材', reward: { wood: 20 } }],
                }],
                eventHistory: [],
                currentEra: 5,
                militaryView: 'world',
                territoryState: {
                  availableSoldiers: 300,
                  territories: [{
                    id: 'site-east',
                    status: 'discovered',
                    owner: 'neutral',
                    occupationMode: 'settlement',
                    naturalName: '东岸',
                    type: 'town',
                    art: 'assets/art/world-site-town-cutout.png',
                    relativeX: 1,
                    relativeY: 0,
                    recommendedSoldiers: 100,
                    defense: 0,
                  }],
                  scoutReports: [],
                },
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
    app = new CanvasGameApp({
      runtime,
      api,
      rendererClass: MiniGameCanvasRenderer,
      presenter: UIStatePresenter,
      config: GameConfig,
      initialState: {
        currentEra: 2,
        resources: { food: 100, knowledge: 4, wood: 1 },
        population: { total: 4, max: 6, unassigned: 1, farmers: 2, scholars: 1, craftsmen: 1 },
        activeCityId: 'capital',
        cityState: {
          activeCityId: 'capital',
          capitalCityId: 'capital',
          cities: [
            { id: 'capital', name: 'Capital', isCapital: true, population: { total: 4 }, totalBuildings: 2 },
            { id: 'site_river', name: 'River City', isCapital: false, population: { total: 2 }, totalBuildings: 1 },
          ],
        },
        eventQueue: [{
          id: 'evt_forest',
          type: 'special',
          title: '森林低语',
          description: '林间传来回声。',
          icon: '🌲',
          options: [{ id: 'collect_wood', label: '收集木材', reward: { wood: 20 } }],
        }],
        eventHistory: [],
        currentEra: 5,
        militaryView: 'world',
        territoryState: {
          availableSoldiers: 300,
          territories: [{
            id: 'site-east',
            status: 'discovered',
            owner: 'neutral',
            occupationMode: 'settlement',
            naturalName: '东岸',
            type: 'town',
            art: 'assets/art/world-site-town-cutout.png',
            relativeX: 1,
            relativeY: 0,
            recommendedSoldiers: 100,
            defense: 0,
          }],
          scoutReports: [],
        },
      },
    });
    app.start();

    assert.equal(typeof tapHandler, 'function');
    const assignTarget = app.renderer.hitTargets.find((target) => target.action?.type === 'assignJob' && target.action.job === 'farmer' && target.action.delta === 1);
    assert.ok(assignTarget);
    app.handleTap({
      x: assignTarget.x + assignTarget.width / 2,
      y: assignTarget.y + assignTarget.height / 2,
    });
    await new Promise((resolve) => setImmediate(resolve));

    const tabTarget = app.renderer.hitTargets.find((target) => target.action?.type === 'switchTab' && target.action.tab === 'buildings');
    assert.ok(tabTarget);
    app.handleTap({
      x: tabTarget.x + tabTarget.width / 2,
      y: tabTarget.y + tabTarget.height / 2,
    });
    assert.equal(app.activeTab, 'buildings');
    assert.equal(app.state.currentTab, 'buildings');
    assert.equal(app.pageTransition.fromTab, 'resources');
    assert.equal(app.pageTransition.toTab, 'buildings');
    assert.ok(timers.some((timer) => timer.intervalMs === 16));
    const renderOptions = [];
    const originalRender = app.renderer.render.bind(app.renderer);
    app.renderer.render = (state, options) => {
      renderOptions.push(options);
      return originalRender(state, options);
    };
    app.applyApiState({
      gameState: {
        ...app.state,
        currentTab: 'resources',
        resources: { ...app.state.resources, food: 240 },
      },
    });
    assert.equal(app.activeTab, 'buildings');
    assert.equal(app.state.currentTab, 'buildings');
    assert.equal(renderOptions.at(-1).activeTab, 'buildings');
    app.renderer.addHitTarget({ x: 1, y: 1, width: 20, height: 20 }, { type: 'scrollBuildings', delta: 1 });
    app.handleTap({ x: 10, y: 10 });
    assert.equal(app.buildingOffset, 1);
    assert.equal(app.buildingTransition.fromOffset, 0);
    assert.equal(app.buildingTransition.toOffset, 1);

    app.switchTab('resources');
    assert.equal(app.buildingOffset, 0);
    assert.equal(app.pageTransition.fromTab, 'buildings');
    assert.equal(app.pageTransition.toTab, 'resources');
    const resourceTarget = app.renderer.hitTargets.find((target) => target.action?.type === 'openResourceDetails');
    assert.ok(resourceTarget);
    app.handleTap({
      x: resourceTarget.x + resourceTarget.width / 2,
      y: resourceTarget.y + resourceTarget.height / 2,
    });
    assert.equal(app.showResourceDetails, true);
    assert.equal(calls.some((call) => call[0] === 'fillText' && call[1] === '资源详情'), true);
    const closeResourceTarget = app.renderer.hitTargets.find((target) => target.action?.type === 'closeResourceDetails' && target.width === 28);
    assert.ok(closeResourceTarget);
    app.handleTap({
      x: closeResourceTarget.x + closeResourceTarget.width / 2,
      y: closeResourceTarget.y + closeResourceTarget.height / 2,
    });
    assert.equal(app.showResourceDetails, false);

    const cityTrigger = app.renderer.hitTargets.find((target) => target.action?.type === 'openCitySwitcher');
    assert.ok(cityTrigger);
    app.handleTap({
      x: cityTrigger.x + cityTrigger.width / 2,
      y: cityTrigger.y + cityTrigger.height / 2,
    });
    assert.equal(app.showCitySwitcher, true);
    const cityTarget = app.renderer.hitTargets.find((target) => target.action?.type === 'selectCity' && target.action.cityId === 'site_river');
    assert.ok(cityTarget);
    app.handleTap({
      x: cityTarget.x + cityTarget.width / 2,
      y: cityTarget.y + cityTarget.height / 2,
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(app.showCitySwitcher, false);

    app.switchTab('events');
    const eventTarget = app.renderer.hitTargets.find((target) => target.action?.type === 'openEvent' && target.action.eventId === 'evt_forest');
    assert.ok(eventTarget);
    app.handleTap({
      x: eventTarget.x + eventTarget.width / 2,
      y: eventTarget.y + eventTarget.height / 2,
    });
    assert.equal(app.activeEventId, 'evt_forest');
    assert.equal(calls.some((call) => call[0] === 'fillText' && call[1] === '森林低语'), true);
    assert.equal(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('🌲')), false);
    assert.equal(requests.some((request) => request.action === 'claimEvent'), false);
    const claimTarget = app.renderer.hitTargets.find((target) => target.action?.type === 'claimEvent' && target.action.optionId === 'collect_wood');
    assert.ok(claimTarget);
    app.showGuideHighlight({
      getRect: () => ({
        left: claimTarget.x,
        top: claimTarget.y,
        width: claimTarget.width,
        height: claimTarget.height,
        right: claimTarget.x + claimTarget.width,
        bottom: claimTarget.y + claimTarget.height,
      }),
    }, '领取事件奖励', { source: 'tutorial' });
    app.handleTap({
      x: claimTarget.x + claimTarget.width / 2,
      y: claimTarget.y + claimTarget.height / 2,
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(app.activeEventId, null);
    assert.notEqual(app.tutorialHighlight?.rect?.left, claimTarget.x);

    app.switchTab('military');
    app.state = { ...app.state, currentEra: 5, militaryView: 'world' };
    app.render();
    const worldTarget = app.renderer.hitTargets.find((target) => target.action?.type === 'openWorldSite' && target.action.siteId === 'site-east');
    assert.ok(worldTarget);
    app.handleTap({
      x: worldTarget.x + worldTarget.width / 2,
      y: worldTarget.y + worldTarget.height / 2,
    });
    assert.equal(app.territoryUiState.selectedSiteId, 'site-east');
    const conquerTarget = app.renderer.hitTargets.find((target) => target.action?.type === 'conquer');
    assert.ok(conquerTarget);
    app.handleTap({
      x: conquerTarget.x + conquerTarget.width / 2,
      y: conquerTarget.y + conquerTarget.height / 2,
    });
    await new Promise((resolve) => setImmediate(resolve));

    app.state.territoryState.territories[0] = {
      ...app.state.territoryState.territories[0],
      status: 'occupied',
      owner: 'player',
      cityName: '东岸',
    };
    app.territoryUiState.selectedSiteId = 'site-east';
    app.render();
    const renameTarget = app.renderer.hitTargets.find((target) => target.action?.type === 'renameCity');
    assert.ok(renameTarget);
    app.handleTap({
      x: renameTarget.x + renameTarget.width / 2,
      y: renameTarget.y + renameTarget.height / 2,
    });
    assert.equal(app.naming.visible, true);
    const inputTarget = app.renderer.hitTargets.find((target) => target.action?.type === 'requestNamingInput');
    assert.ok(inputTarget);
    app.handleTap({
      x: inputTarget.x + inputTarget.width / 2,
      y: inputTarget.y + inputTarget.height / 2,
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(app.naming.inputValue, '东岸城');
    const submitNamingTarget = app.renderer.hitTargets.find((target) => target.action?.type === 'submitNaming');
    assert.ok(submitNamingTarget);
    app.handleTap({
      x: submitNamingTarget.x + submitNamingTarget.width / 2,
      y: submitNamingTarget.y + submitNamingTarget.height / 2,
    });
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(requests.find((request) => request.action === 'assign'), {
      action: 'assign',
      target: 'farmer',
      count: 1,
    });
    assert.deepEqual(requests.find((request) => request.action === 'switchCity'), {
      action: 'switchCity',
      cityId: 'site_river',
    });
    assert.deepEqual(requests.find((request) => request.action === 'claimEvent'), {
      action: 'claimEvent',
      eventId: 'evt_forest',
      optionId: 'collect_wood',
    });

    app.state = {
      ...app.state,
      guideTasks: {
        visible: true,
        tasks: [{
          id: 'barracks_supplies',
          title: '城邦守备',
          status: 'claimable',
          rewardText: '食物 +260 / 知识 +80',
        }],
      },
    };
    app.switchTab('resources');
    const guideTaskTarget = app.renderer.hitTargets.find((target) => (
      target.action?.type === 'openTaskCenter'
      && target.action.source === 'taskIcon'
    ));
    assert.ok(guideTaskTarget);
    assert.equal(app.getGuideTargetRect('task-center-main-claim').left, guideTaskTarget.x);
    app.activeTaskCenterTab = 'daily';
    app.handleTap({
      x: guideTaskTarget.x + guideTaskTarget.width / 2,
      y: guideTaskTarget.y + guideTaskTarget.height / 2,
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(app.showTaskCenter, true);
    assert.equal(app.activeTaskCenterTab, 'main');
    const taskCenterClaimTarget = app.renderer.hitTargets.find((target) => target.action?.type === 'claimTaskReward' && target.action.taskId === 'barracks_supplies');
    assert.ok(taskCenterClaimTarget);
    assert.equal(app.tutorialHighlight?.rect.left, taskCenterClaimTarget.x);
    app.handleTap({
      x: taskCenterClaimTarget.x + taskCenterClaimTarget.width / 2,
      y: taskCenterClaimTarget.y + taskCenterClaimTarget.height / 2,
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(requests.find((request) => request.taskId === 'barracks_supplies'), {
      taskId: 'barracks_supplies',
      category: 'main',
    });
    const barracksBuildTargetAfterClaim = app.renderer.hitTargets.find((target) => (
      target.action?.type === 'buildBuilding'
      && target.action.buildingId === 'barracks'
    ));
    assert.ok(barracksBuildTargetAfterClaim);
    assert.equal(app.showTaskCenter, false);
    assert.equal(app.tutorialHighlight?.rect.left, barracksBuildTargetAfterClaim.x);
    assert.notEqual(app.tutorialHighlight?.rect.left, taskCenterClaimTarget.x);
    assert.deepEqual(app.rewardReveal?.title, '获得奖励');
    app.rewardReveal = null;

    app.state = {
      ...app.state,
      currentEra: 3,
      currentTab: 'resources',
      unlockedBuildings: ['barracks'],
      buildingDefinitions: {
        barracks: {
          id: 'barracks',
          name: '兵营',
          buildCost: { food: 260, knowledge: 80 },
          ui: { description: '自动训练士兵', effectText: [] },
          military: { soldierCapByLevel: [0, 300], trainingIntervalSecondsByLevel: [0, 30], trainingBatchSizeByLevel: [0, 10] },
        },
      },
      buildingCosts: { barracks: { food: 260, knowledge: 80 } },
      buildings: { barracks: { level: 0 } },
      resources: { food: 260, knowledge: 80 },
      guideTasks: {
        visible: false,
        tasks: [],
      },
      softGuide: null,
      guidebook: {
        categories: [
          { id: 'planning', label: '规划', title: '城市规划', lines: ['宜居度来自建筑搭配。'] },
          { id: 'policy', label: '方针', title: '人才方针', lines: ['方针会调整人才。'] },
        ],
      },
    };
    app.tutorialHighlight = null;
    app.showTaskCenter = false;
    app.showGuidebook = false;
    app.switchTab('resources');
    app.render();

    const guidebookTarget = app.renderer.hitTargets.find((target) => target.action?.type === 'openGuidebook');
    assert.ok(guidebookTarget);
    app.handleTap({
      x: guidebookTarget.x + guidebookTarget.width / 2,
      y: guidebookTarget.y + guidebookTarget.height / 2,
    });
    assert.equal(app.showGuidebook, true);
    const policyGuidebookTab = app.renderer.hitTargets.find((target) => target.action?.type === 'switchGuidebookTab' && target.action.tab === 'policy');
    assert.ok(policyGuidebookTab);
    app.handleTap({
      x: policyGuidebookTab.x + policyGuidebookTab.width / 2,
      y: policyGuidebookTab.y + policyGuidebookTab.height / 2,
    });
    assert.equal(app.activeGuidebookTab, 'policy');
    const closeGuidebookTarget = app.renderer.hitTargets.find((target) => target.action?.type === 'closeGuidebook' && target.width === 28);
    assert.ok(closeGuidebookTarget);
    app.handleTap({
      x: closeGuidebookTarget.x + closeGuidebookTarget.width / 2,
      y: closeGuidebookTarget.y + closeGuidebookTarget.height / 2,
    });
    assert.equal(app.showGuidebook, false);

    app.state = {
      ...app.state,
      taskCenter: null,
      guideTasks: {
        visible: true,
        tasks: [{
          id: 'barracks_supplies',
          title: '城邦守备',
          description: '建造兵营',
          status: 'active',
          target: 'card-barracks',
          actionLabel: '前往',
          action: {
            type: 'goToGuideTaskTarget',
            taskId: 'barracks_supplies',
            target: 'card-barracks',
            nextAction: { type: 'buildBuilding', buildingId: 'barracks' },
          },
        }],
      },
    };
    app.switchTab('resources');
    app.showTaskCenter = true;
    app.activeTaskCenterTab = 'main';
    app.render();
    const goTarget = app.renderer.hitTargets.find((target) => target.action?.type === 'goToGuideTaskTarget');
    assert.ok(goTarget);
    app.handleTap({
      x: goTarget.x + goTarget.width / 2,
      y: goTarget.y + goTarget.height / 2,
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(app.state.currentTab, 'buildings');
    assert.equal(app.renderer.hitTargets.some((target) => target.action?.type === 'buildBuilding' && target.action.buildingId === 'barracks'), true);
    assert.equal(app.tutorialHighlight?.message, '按这里继续主线任务');

    app.state = {
      ...app.state,
      currentEra: 5,
      currentTab: 'resources',
      militaryView: 'army',
      territoryState: {
        ...app.state.territoryState,
        directions: [
          { id: 'n', label: 'North' },
          { id: 'e', label: 'East' },
        ],
        scoutMissions: [],
        scoutReports: [],
      },
      guideTasks: {
        visible: true,
        tasks: [{
          id: 'first_scout_reward',
          title: 'First scout',
          description: 'Send a scout.',
          status: 'active',
          target: 'scout-action-first',
          actionLabel: 'Go',
          action: {
            type: 'goToGuideTaskTarget',
            taskId: 'first_scout_reward',
            target: 'scout-action-first',
            nextAction: { type: 'switchMilitaryView', view: 'scout' },
          },
        }],
      },
    };
    app.switchTab('resources');
    const scoutGuideTarget = app.renderer.hitTargets.find((target) => (
      target.action?.type === 'goToGuideTaskTarget'
      && target.action.target === 'scout-action-first'
    ));
    assert.ok(scoutGuideTarget);
    app.handleTap({
      x: scoutGuideTarget.x + scoutGuideTarget.width / 2,
      y: scoutGuideTarget.y + scoutGuideTarget.height / 2,
    });
    await new Promise((resolve) => setImmediate(resolve));
    const scoutActionTarget = app.renderer.hitTargets.find((target) => (
      target.action?.type === 'scoutTerritory'
      && target.action.disabled === false
    ));
    assert.ok(scoutActionTarget);
    assert.equal(app.state.currentTab, 'military');
    assert.equal(app.state.militaryView, 'scout');
    assert.equal(app.tutorialHighlight?.rect.left, scoutActionTarget.x);

    assert.deepEqual(requests.find((request) => request.action === 'startConquest'), {
      action: 'startConquest',
      territoryId: 'site-east',
      expedition: { soldiers: 100 },
    });
    assert.deepEqual(requests.find((request) => request.action === 'renameCity'), {
      action: 'renameCity',
      territoryId: 'site-east',
      name: '东岸城',
    });
    assert.equal(calls.some((call) => call[0] === 'fillText' && call[1] === '建造'), true);
  } finally {
    app?.stop?.();
    global.document = originalDocument;
  }
});
