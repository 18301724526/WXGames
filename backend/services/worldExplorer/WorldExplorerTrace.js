const { AsyncLocalStorage } = require('async_hooks');

const storage = new AsyncLocalStorage();

function run(enabled, callback) {
  if (!enabled || typeof callback !== 'function') return callback?.();
  return storage.run({ enabled: true }, callback);
}

function isEnabled() {
  return Boolean(storage.getStore()?.enabled);
}

function log(stage, payload = {}) {
  if (!isEnabled()) return false;
  try {
    console.info('[WorldMarchTrace:server]', stage, {
      at: new Date().toISOString(),
      ...payload,
    });
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = {
  run,
  isEnabled,
  log,
};
