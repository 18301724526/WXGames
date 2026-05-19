const test = require('node:test');
const assert = require('node:assert/strict');
const UIStatePresenter = require('../js/state/UIStatePresenter');
const AuthShellAdapter = require('../js/ui/AuthShellAdapter');

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

function createElement(overrides = {}) {
  return {
    value: '',
    checked: false,
    textContent: '',
    style: {},
    dataset: {},
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    ...overrides,
  };
}

function createDocument(elements) {
  return {
    getElementById(id) {
      return elements[id] || null;
    },
  };
}

function createGame() {
  return {
    apiBase: 'http://localhost:3000/api',
    token: null,
    playerId: null,
    buildingAPI: { setToken(token) { this.token = token; } },
    applyApiState(data) { this.lastAppliedState = data; },
    startHeartbeat() { this.heartbeatStarted = true; },
    log() {},
    showFloatingText() {},
  };
}

test('记住密码会在登录面板回填用户名和密码', async () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalLocalStorage = global.localStorage;

  try {
    const elements = {
      loginPanel: createElement(),
      loginMessage: createElement(),
      app: createElement(),
      loginUsername: createElement(),
      loginPassword: createElement(),
      rememberPassword: createElement(),
    };
    global.window = { UIStatePresenter, AuthShellAdapter };
    global.document = undefined;
    global.localStorage = createStorage({
      cf_remember_enabled: 'true',
      cf_remember_username: 'test2',
      cf_remember_password: '123456',
    });

    require('../auth');

    const game = createGame();
    game.authShell = AuthShellAdapter.fromDocument(createDocument(elements));
    global.window.mountAuthMethods(game);
    game.showLoginPanel();

    assert.equal(elements.loginUsername.value, 'test2');
    assert.equal(elements.loginPassword.value, '123456');
    assert.equal(elements.rememberPassword.checked, true);
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    global.localStorage = originalLocalStorage;
    delete require.cache[require.resolve('../auth')];
  }
});

test('登录会提交用户名密码并保存记住密码信息', async () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalLocalStorage = global.localStorage;
  const originalFetch = global.fetch;

  try {
    const elements = {
      loginPanel: createElement(),
      loginMessage: createElement(),
      app: createElement(),
      loginUsername: createElement(),
      loginPassword: createElement(),
      rememberPassword: createElement(),
    };
    global.window = { UIStatePresenter, AuthShellAdapter };
    global.document = undefined;
    global.localStorage = createStorage();

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
    game.authShell = AuthShellAdapter.fromDocument(createDocument(elements));
    global.window.mountAuthMethods(game);
    elements.loginUsername.value = 'test1';
    elements.loginPassword.value = '123456';
    elements.rememberPassword.checked = true;
    await game.handleLogin();

    assert.deepEqual(requestBody, { username: 'test1', password: '123456' });
    assert.equal(global.localStorage.getItem('cf_token'), 'token-1');
    assert.equal(global.localStorage.getItem('cf_username'), 'test1');
    assert.equal(global.localStorage.getItem('cf_remember_enabled'), 'true');
    assert.equal(global.localStorage.getItem('cf_remember_username'), 'test1');
    assert.equal(global.localStorage.getItem('cf_remember_password'), '123456');
    assert.equal(game.heartbeatStarted, true);
    assert.deepEqual(game.lastAppliedState.gameState, { currentEra: 0 });
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
    global.localStorage = originalLocalStorage;
    global.fetch = originalFetch;
    delete require.cache[require.resolve('../auth')];
  }
});
