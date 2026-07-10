const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

test('H5 game host wires authority state refreshes after replacing the constructor sync service', () => {
  const previousWindow = global.window;
  const previousDocument = global.document;
  const appPath = path.resolve(__dirname, '../../app.js');
  const calls = [];
  let mountedGame = null;

  class FakeCanvasGameApp {
    constructor(options = {}) {
      this.state = options.initialState || {};
      this.tutorial = { completed: false, currentStep: 0 };
      this.hasServerState = false;
    }

    applyApiState(data = {}) {
      calls.push(['applyApiState', data.gameState?.worldExplorerState?.idleMissions?.[0]?.id || '']);
      this.state = {
        ...this.state,
        ...(data.gameState || {}),
      };
    }

    render() {
      calls.push(['render']);
    }

    startScoutCountdownTimer() {
      calls.push(['startScoutCountdownTimer']);
    }
  }

  class FakeGameAPI {
    constructor(baseUrl, token, options = {}) {
      calls.push(['GameAPI', baseUrl, Boolean(token)]);
      this.deployStatusPath = options.deployStatusPath || '';
    }

    setToken() {}
  }

  class FakeGameStateSync {
    constructor(api, intervalMs, scheduler) {
      calls.push(['GameStateSync', intervalMs, Boolean(api), Boolean(scheduler)]);
    }

    setStateProvider(provider) {
      calls.push(['setStateProvider']);
      this.provider = provider;
    }
  }

  class FakeUpdateChecker {
    constructor(options = {}) {
      calls.push(['UpdateChecker', options.api instanceof FakeGameAPI, options.api?.deployStatusPath || '']);
    }

    start() {
      calls.push(['updateChecker.start']);
    }
  }

  class FakeGameStateManager {
    constructor(state) {
      calls.push(['GameStateManager', Boolean(state)]);
    }
  }

  class FakeEventController {
    constructor() {
      calls.push(['EventController']);
    }
  }

  class FakeBuildingController {
    constructor() {
      calls.push(['BuildingController']);
    }
  }

  class FakeTerritoryController {
    constructor() {
      calls.push(['TerritoryController']);
    }

    bind() {
      calls.push(['TerritoryController.bind']);
    }
  }

  class FakeTutorialGuideController {
    constructor() {
      calls.push(['TutorialGuideController']);
    }

    sync() {
      calls.push(['TutorialGuideController.sync']);
    }
  }

  global.document = { readyState: 'complete' };
  global.window = {
    CanvasGameApp: FakeCanvasGameApp,
    H5ShellAdapter: {
      fromRuntime() {
        calls.push(['H5ShellAdapter.fromRuntime']);
        return {
          config: {
            API_BASE: '/api',
            DEPLOY_STATUS_PATH: '.wxgame-deploy-status.json',
            HEARTBEAT_INTERVAL_MS: 1000,
            UPDATE_CHECK_INTERVAL_MS: 5000,
          },
          presenter: {
            formatEventReward: () => '',
          },
          buildingState: {},
          scheduler: {},
          authStorage: {
            getToken() {
              return null;
            },
          },
          gameModules: {
            mount() {
              calls.push(['gameModules.mount']);
            },
          },
          runtimeConstructors: {
            GameAPI: FakeGameAPI,
            GameStateSync: FakeGameStateSync,
            UpdateChecker: FakeUpdateChecker,
            GameStateManager: FakeGameStateManager,
            EventController: FakeEventController,
            BuildingController: FakeBuildingController,
            TerritoryController: FakeTerritoryController,
          },
        };
      },
    },
    TutorialGuideController: FakeTutorialGuideController,
    CanvasGameShell: {
      mount() {
        calls.push(['CanvasGameShell.mount']);
        return {};
      },
    },
    H5GameBootstrap: {
      mount(game) {
        mountedGame = game;
        calls.push(['H5GameBootstrap.mount']);
        return true;
      },
    },
  };

  try {
    delete require.cache[appPath];
    require(appPath);
    mountedGame.init();

    assert.equal(typeof mountedGame.syncService.onState, 'function');
    assert.equal(mountedGame.syncService.provider(), mountedGame.state);

    mountedGame.syncService.onState({
      gameState: {
        worldExplorerState: {
          activeMission: null,
          idleMissions: [{ id: 'explore-1', status: 'idle' }],
        },
      },
    });

    assert.equal(mountedGame.state.worldExplorerState.idleMissions[0].id, 'explore-1');
    assert.equal(calls.filter((call) => call[0] === 'setStateProvider').length >= 1, true);
    assert.deepEqual(calls.filter((call) => call[0] === 'applyApiState'), [
      ['applyApiState', 'explore-1'],
    ]);
  } finally {
    delete require.cache[appPath];
    global.window = previousWindow;
    global.document = previousDocument;
  }
});

test('H5 game host disables tutorial runtime from server tutorialEnabled projection', () => {
  const previousWindow = global.window;
  const previousDocument = global.document;
  const appPath = path.resolve(__dirname, '../../app.js');
  const calls = [];
  let mountedGame = null;

  class FakeCanvasGameApp {
    constructor(options = {}) {
      this.state = options.initialState || {};
      this.tutorial = { completed: false, currentStep: 0 };
      this.hasServerState = false;
    }

    applyApiState(data = {}) {
      calls.push(['applyApiState']);
      this.state = {
        ...this.state,
        ...(data.gameState || {}),
      };
      this.tutorial = data.tutorial || this.tutorial;
    }

    render() {}

    startScoutCountdownTimer() {}
  }

  class FakeGameAPI {
    constructor() {}
    setToken() {}
  }

  class FakeGameStateSync {
    setStateProvider(provider) {
      this.provider = provider;
    }
  }

  class FakeUpdateChecker {
    start() {}
  }

  class FakeNoopController {}

  class FakeTerritoryController {
    bind() {}
  }

  class FakeTutorialGuideController {
    constructor() {
      calls.push(['TutorialGuideController']);
    }

    sync() {
      calls.push(['tutorialSync']);
    }
  }

  global.document = { readyState: 'complete' };
  global.window = {
    CanvasGameApp: FakeCanvasGameApp,
    H5ShellAdapter: {
      fromRuntime() {
        return {
          config: {
            API_BASE: '/api',
            HEARTBEAT_INTERVAL_MS: 1000,
            UPDATE_CHECK_INTERVAL_MS: 5000,
          },
          presenter: { formatEventReward: () => '' },
          buildingState: {},
          scheduler: {},
          authStorage: { getToken: () => null },
          gameModules: { mount() {} },
          runtimeConstructors: {
            GameAPI: FakeGameAPI,
            GameStateSync: FakeGameStateSync,
            UpdateChecker: FakeUpdateChecker,
            GameStateManager: FakeNoopController,
            EventController: FakeNoopController,
            BuildingController: FakeNoopController,
            TerritoryController: FakeTerritoryController,
          },
        };
      },
    },
    FeatureFlags: require('../config/FeatureFlags'),
    TutorialGuideController: FakeTutorialGuideController,
    CanvasGameShell: {
      mount() {
        return {
          hideTutorialHighlight() {
            calls.push(['hideTutorialHighlight']);
          },
        };
      },
    },
    H5GameBootstrap: {
      mount(game) {
        mountedGame = game;
        return true;
      },
    },
  };

  try {
    delete require.cache[appPath];
    require(appPath);
    mountedGame.init();
    mountedGame.applyApiState({
      gameState: { tutorialEnabled: false },
      tutorial: { completed: false, currentStep: 'cityEntered' },
    });

    assert.equal(calls.some((call) => call[0] === 'TutorialGuideController'), true);
    assert.equal(mountedGame.tutorialController, null);
    assert.equal(mountedGame.tutorial.completed, true);
    assert.equal(mountedGame.tutorial.disabled, true);
    assert.equal(mountedGame.maybeStartTutorialIntro(), false);
  } finally {
    delete require.cache[appPath];
    global.window = previousWindow;
    global.document = previousDocument;
  }
});
