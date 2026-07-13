const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasPanelActionRunner = require('./CanvasPanelActionRunner');

function createContext(calls = [], overrides = {}) {
  const manager = overrides.manager || {
    openPanel(panelKey) {
      calls.push(['openPanel', panelKey]);
      return true;
    },
    closePanel(panelKey) {
      calls.push(['closePanel', panelKey]);
      return true;
    },
    runPanelAction(panelKey, actionName) {
      calls.push(['runPanelAction', panelKey, actionName]);
      return true;
    },
  };
  const scheduler = overrides.scheduler || {
    markDirty(slot, reason) {
      calls.push(['markDirty', slot, reason]);
    },
    flush(slots) {
      calls.push(['flush', slots.join(',')]);
    },
    isAtomic() {
      return false;
    },
  };
  const runtime = overrides.runtime || {
    setTimeout(callback, delay) {
      calls.push(['setTimeout', delay]);
      callback();
    },
  };
  return {
    isPanelActionContext: true,
    host: {},
    getPanelSurfaceManager: () => manager,
    getScheduler: () => scheduler,
    getRuntimeScheduler: () => runtime,
    getUiStateOwner: () => ({}),
    t: (key) => key,
    showFloatingText: (message) => calls.push(['showFloatingText', message]),
    log: (message) => calls.push(['log', message?.message || message]),
  };
}

test('CanvasPanelActionRunner opens famous panel and flushes modal', () => {
  const calls = [];
  const runner = new CanvasPanelActionRunner();

  assert.equal(runner.run({ type: 'openFamousPersons' }, createContext(calls)), true);
  assert.deepEqual(calls, [
    ['openPanel', 'famousPersons'],
    ['markDirty', 'modal', 'openFamousPersons'],
    ['flush', 'modal'],
  ]);
});

test('CanvasPanelActionRunner closes famous panel and flushes modal', () => {
  const calls = [];
  const runner = new CanvasPanelActionRunner();

  assert.equal(runner.run({ type: 'closeFamousPersons' }, createContext(calls)), true);
  assert.deepEqual(calls, [
    ['closePanel', 'famousPersons'],
    ['markDirty', 'modal', 'closeFamousPersons'],
    ['flush', 'modal'],
  ]);
});

test('CanvasPanelActionRunner short-circuits disabled actions', () => {
  const calls = [];
  const runner = new CanvasPanelActionRunner();

  assert.equal(runner.run({ type: 'openFamousPersons', disabled: true }, createContext(calls)), true);
  assert.deepEqual(calls, []);
});
