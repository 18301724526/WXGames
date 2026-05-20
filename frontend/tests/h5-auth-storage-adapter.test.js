const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const H5AuthStorageAdapter = require('../js/ui/H5AuthStorageAdapter');

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

test('H5 auth storage adapter owns account and remembered credential storage', () => {
  const storage = createStorage({
    cf_token: 'token-old',
    cf_username: 'old-user',
    cf_remember_enabled: 'true',
    cf_remember_username: 'saved-user',
    cf_remember_password: 'saved-pass',
    tutorialAutoStarted: 'true',
    tutorialStep: '2',
    tutorialCompleted: 'false',
    civilizationFirePhase2: 'legacy',
  });
  const adapter = H5AuthStorageAdapter.fromStorage(storage);

  assert.equal(adapter.getToken(), 'token-old');
  assert.deepEqual(adapter.getCredentialSnapshot(), {
    rememberEnabled: true,
    rememberedUsername: 'saved-user',
    rememberedPassword: 'saved-pass',
    username: 'old-user',
  });

  adapter.setToken('token-new');
  adapter.setUsername('new-user');
  adapter.persistRememberedCredentials('new-user', 'new-pass', true);

  assert.equal(storage.getItem('cf_token'), 'token-new');
  assert.equal(storage.getItem('cf_username'), 'new-user');
  assert.equal(storage.getItem('cf_remember_enabled'), 'true');
  assert.equal(storage.getItem('cf_remember_username'), 'new-user');
  assert.equal(storage.getItem('cf_remember_password'), 'new-pass');

  adapter.clearSession();

  assert.equal(storage.getItem('cf_token'), null);
  assert.equal(storage.getItem('civilizationFirePhase2'), null);
  assert.equal(storage.getItem('tutorialAutoStarted'), null);
  assert.equal(storage.getItem('tutorialStep'), null);
  assert.equal(storage.getItem('tutorialCompleted'), null);
});

test('H5 auth storage adapter uses only the injected runtime storage', () => {
  const source = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'ui', 'H5AuthStorageAdapter.js'), 'utf8');
  const storage = createStorage({ cf_token: 'runtime-token' });
  const adapter = H5AuthStorageAdapter.fromRuntime({ localStorage: storage });
  const emptyAdapter = H5AuthStorageAdapter.fromRuntime();

  assert.equal(adapter.getToken(), 'runtime-token');
  assert.equal(emptyAdapter.getToken(), null);
  assert.match(source, /static fromRuntime\(runtime = null\)/);
  assert.doesNotMatch(source, /global\.localStorage|runtime = global/);
});

test('auth module and app delegate browser storage to H5 auth storage adapter', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'app.js'), 'utf8');
  const authJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'auth.js'), 'utf8');

  assert.match(html, /js\/ui\/H5AuthStorageAdapter\.js\?v=h5-storage-runtime-v1/);
  assert.match(html, /H5AuthStorageAdapter\.js\?v=h5-storage-runtime-v1[\s\S]*H5ShellAdapter\.js\?v=h5-shell-registry-v1[\s\S]*app\.js\?v=h5-bootstrap-explicit-doc-v2/);
  assert.match(appJs, /this\.token = this\.authStorage\?\.getToken\?\.\(\) \|\| null/);
  assert.match(authJs, /const authStorage = deps\.authStorage \|\| game\.authStorage/);
  assert.doesNotMatch(authJs, /H5AuthStorageAdapter\?\.fromRuntime\(window\)/);
  assert.doesNotMatch(authJs, /\blocalStorage\b|TOKEN_KEY|USERNAME_KEY|REMEMBER_ENABLED_KEY|REMEMBER_USERNAME_KEY|REMEMBER_PASSWORD_KEY/);
});
