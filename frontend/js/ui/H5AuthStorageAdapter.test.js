const test = require('node:test');
const assert = require('node:assert/strict');

const H5AuthStorageAdapter = require('./H5AuthStorageAdapter');

function createStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

test('H5AuthStorageAdapter remembers username without storing plaintext password', () => {
  const storage = createStorage();
  const adapter = H5AuthStorageAdapter.fromStorage(storage);

  adapter.persistRememberedCredentials('alice', 'secret-password', true);

  assert.equal(storage.getItem('cf_remember_enabled'), 'true');
  assert.equal(storage.getItem('cf_remember_username'), 'alice');
  assert.equal(storage.getItem('cf_remember_password'), null);
  assert.deepEqual(adapter.getCredentialSnapshot(), {
    rememberEnabled: true,
    rememberedUsername: 'alice',
    rememberedPassword: '',
    username: null,
  });
});
