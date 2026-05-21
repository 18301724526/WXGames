const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const UIStatePresenter = require('../js/state/UIStatePresenter');
const H5AuthStorageAdapter = require('../js/ui/H5AuthStorageAdapter');
const H5AuthRuntimeAdapter = require('../js/ui/H5AuthRuntimeAdapter');

const projectRoot = path.join(__dirname, '..', '..');

function createStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

function createCanvasShell() {
  return {
    auth: {
      view: {},
      credentials: {},
    },
    setLoginMessage(message) {
      this.auth.view = {
        ...this.auth.view,
        loginPanelVisible: true,
        appVisible: false,
        message: message || '',
      };
    },
    applyAuthShell(view) {
      this.auth.view = { ...view };
    },
    applyCredentials(view) {
      this.auth.credentials = { ...view };
    },
    readCredentials() {
      return {
        username: String(this.auth.credentials.usernameValue || '').trim().toLowerCase(),
        password: this.auth.credentials.passwordValue || '',
        rememberPassword: Boolean(this.auth.credentials.rememberPasswordChecked),
      };
    },
    renderReadOnly() {},
  };
}

function createGame() {
  return {
    apiBase: 'http://localhost:3000/api',
    token: null,
    playerId: null,
    canvasShell: createCanvasShell(),
    state: { currentTab: 'resources' },
    buildingAPI: { setToken(token) { this.token = token; } },
    applyApiState(data) { this.lastAppliedState = data; },
    startHeartbeat() { this.heartbeatStarted = true; },
    log() {},
    showFloatingText() {},
  };
}

test('记住密码会回填到 Canvas 登录状态', async () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalLocalStorage = global.localStorage;

  try {
    global.window = {};
    global.document = undefined;
    global.localStorage = undefined;
    const storage = createStorage({
      cf_remember_enabled: 'true',
      cf_remember_username: 'test2',
      cf_remember_password: '123456',
    });

    require('../auth');

    const game = createGame();
    game.authStorage = H5AuthStorageAdapter.fromStorage(storage);
    global.window.mountAuthMethods(game, {
      presenter: UIStatePresenter,
      authStorage: game.authStorage,
      authRuntime: H5AuthRuntimeAdapter.fromRuntime({}),
    });
    game.showLoginPanel();

    assert.equal(game.canvasShell.auth.credentials.usernameValue, 'test2');
    assert.equal(game.canvasShell.auth.credentials.passwordValue, '123456');
    assert.equal(game.canvasShell.auth.credentials.rememberPasswordChecked, true);
    assert.equal(game.canvasShell.auth.view.loginPanelVisible, true);
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    global.localStorage = originalLocalStorage;
    delete require.cache[require.resolve('../auth')];
  }
});

test('登录会读取 Canvas 凭据并保存记住密码信息', async () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalLocalStorage = global.localStorage;
  const originalFetch = global.fetch;

  try {
    global.window = {};
    global.document = undefined;
    global.localStorage = undefined;
    const storage = createStorage();

    let requestBody = null;
    global.fetch = async (url, options) => {
      requestBody = JSON.parse(options.body);
      assert.match(url, /\/player\/login$/);
      return {
        ok: true,
        async text() {
          return JSON.stringify({
            token: 'token-1',
            playerId: 'test1',
            username: 'test1',
            gameState: { currentEra: 0 },
            tutorial: { currentStep: 0, completed: false },
            eraProgress: { percentage: 0, canAdvance: false, conditions: [] },
          });
        },
      };
    };

    require('../auth');

    const game = createGame();
    game.authStorage = H5AuthStorageAdapter.fromStorage(storage);
    global.window.mountAuthMethods(game, {
      presenter: UIStatePresenter,
      authStorage: game.authStorage,
      authRuntime: H5AuthRuntimeAdapter.fromRuntime({}),
    });
    game.canvasShell.applyCredentials({
      usernameValue: 'test1',
      passwordValue: '123456',
      rememberPasswordChecked: true,
    });
    await game.handleLogin();

    assert.deepEqual(requestBody, { username: 'test1', password: '123456' });
    assert.equal(storage.getItem('cf_token'), 'token-1');
    assert.equal(storage.getItem('cf_username'), 'test1');
    assert.equal(storage.getItem('cf_remember_enabled'), 'true');
    assert.equal(storage.getItem('cf_remember_username'), 'test1');
    assert.equal(storage.getItem('cf_remember_password'), '123456');
    assert.equal(game.heartbeatStarted, true);
    assert.deepEqual(game.lastAppliedState.gameState, { currentEra: 0 });
    assert.equal(game.canvasShell.auth.view.loginPanelVisible, false);
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    global.localStorage = originalLocalStorage;
    global.fetch = originalFetch;
    delete require.cache[require.resolve('../auth')];
  }
});

test('auth module source has no DOM shell dependency', () => {
  const source = fs.readFileSync(path.join(projectRoot, 'frontend', 'auth.js'), 'utf8');

  assert.doesNotMatch(source, /AuthShellAdapter|authShell|document|getElementById|querySelector|classList|style\.|textContent|addEventListener/);
});
