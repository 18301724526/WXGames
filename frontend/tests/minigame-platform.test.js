const test = require('node:test');
const assert = require('node:assert/strict');

const GameConfig = require('../js/config/GameConfig');
const UIStatePresenter = require('../js/state/UIStatePresenter');
const GameAPI = require('../js/api/GameAPI');
const PlatformRuntime = require('../js/platform/PlatformRuntime');
const MiniGameCanvasRenderer = require('../js/platform/MiniGameCanvasRenderer');
const CanvasActionDispatcher = require('../js/platform/CanvasActionDispatcher');
global.CanvasActionDispatcher = CanvasActionDispatcher;
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

test('minigame entry does not load H5 DOM adapters', () => {
  const projectRoot = path.join(__dirname, '..', '..');
  const entry = fs.readFileSync(path.join(projectRoot, 'frontend', 'minigame', 'game.js'), 'utf8');
  const platformFiles = [
    'PlatformRuntime.js',
    'MiniGameCanvasRenderer.js',
    'CanvasGameApp.js',
  ].map((file) => fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', file), 'utf8')).join('\n');
  const appSource = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'CanvasGameApp.js'), 'utf8');

  assert.doesNotMatch(entry, /app\.js|auth\.js|population\.js|logs\.js|floating-text\.js|DOMHelper|document|getElementById|querySelector|innerHTML|classList/);
  assert.doesNotMatch(platformFiles, /document|getElementById|querySelector|innerHTML|classList/);
  assert.doesNotMatch(platformFiles, /global\.UIStatePresenter|globalThis\.UIStatePresenter|window\.UIStatePresenter/);
  assert.doesNotMatch(appSource, /global\.GameConfig|global\.GameAPI|global\.MiniGameCanvasRenderer|global\.PlatformRuntime/);
  assert.doesNotMatch(platformFiles, /global\.localStorage|global\.setInterval|global\.clearInterval|global\.innerWidth|global\.innerHeight|global\.devicePixelRatio/);
  assert.match(entry, /PlatformRuntime/);
  assert.match(entry, /MiniGameCanvasRenderer/);
  assert.match(entry, /CanvasGameApp/);
  assert.match(entry, /presenter: globalThis\.UIStatePresenter/);
  assert.match(entry, /config: globalThis\.GameConfig/);
  assert.match(entry, /apiClass: globalThis\.GameAPI/);
  assert.match(entry, /rendererClass: globalThis\.MiniGameCanvasRenderer/);
});

test('Canvas game app dispatches canvas taps to server actions without DOM controllers', async () => {
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
    textInput: () => '东岸城',
    scheduler: {
      setInterval() {
        const timer = {};
        return timer;
      },
      clearInterval() {},
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
                  availableSoldiers: 3,
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
                    recommendedSoldiers: 1,
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
          availableSoldiers: 3,
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
            recommendedSoldiers: 1,
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
    app.renderer.addHitTarget({ x: 1, y: 1, width: 20, height: 20 }, { type: 'scrollBuildings', delta: 1 });
    app.handleTap({ x: 10, y: 10 });
    assert.equal(app.buildingOffset, 1);

    app.switchTab('resources');
    assert.equal(app.buildingOffset, 0);
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
    assert.equal(calls.some((call) => call[0] === 'fillText' && call[1] === '🌲 森林低语'), true);
    assert.equal(requests.some((request) => request.action === 'claimEvent'), false);
    const claimTarget = app.renderer.hitTargets.find((target) => target.action?.type === 'claimEvent' && target.action.optionId === 'collect_wood');
    assert.ok(claimTarget);
    app.handleTap({
      x: claimTarget.x + claimTarget.width / 2,
      y: claimTarget.y + claimTarget.height / 2,
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(app.activeEventId, null);

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
    const guideTaskTarget = app.renderer.hitTargets.find((target) => target.action?.type === 'claimGuideTaskReward');
    assert.ok(guideTaskTarget);
    app.handleTap({
      x: guideTaskTarget.x + guideTaskTarget.width / 2,
      y: guideTaskTarget.y + guideTaskTarget.height / 2,
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(requests.find((request) => request.action === 'claimGuideTaskReward'), {
      action: 'claimGuideTaskReward',
      target: 'barracks_supplies',
    });

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
          military: { soldierCapByLevel: [0, 5], trainingIntervalSecondsByLevel: [0, 30] },
        },
      },
      buildingCosts: { barracks: { food: 260, knowledge: 80 } },
      buildings: { barracks: { level: 0 } },
      resources: { food: 260, knowledge: 80 },
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
      expedition: { soldiers: 1 },
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
