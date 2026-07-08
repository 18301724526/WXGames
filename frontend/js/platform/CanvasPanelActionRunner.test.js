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
    getTutorialController: () => overrides.tutorial || null,
    getUiStateOwner: () => ({}),
    t: (key) => key,
    showFloatingText: (message) => calls.push(['showFloatingText', message]),
    log: (message) => calls.push(['log', message?.message || message]),
  };
}

test('CanvasPanelActionRunner executes famous open hooks and modal flush', () => {
  const calls = [];
  const tutorial = {
    canOpenTab(panelKey) {
      calls.push(['canOpenTab', panelKey]);
      return true;
    },
    onFamousPersonsOpened() {
      calls.push(['opened']);
    },
    refreshCurrentHighlight() {
      calls.push(['refresh']);
    },
  };
  const runner = new CanvasPanelActionRunner();

  assert.equal(runner.run({ type: 'openFamousPersons' }, createContext(calls, { tutorial })), true);
  assert.deepEqual(calls, [
    ['canOpenTab', 'famousPersons'],
    ['openPanel', 'famousPersons'],
    ['markDirty', 'modal', 'openFamousPersons'],
    ['flush', 'modal'],
    ['opened'],
    ['refresh'],
    ['setTimeout', 0],
    ['refresh'],
  ]);
});

test('CanvasPanelActionRunner executes famous close hooks without duplicate sync refresh', () => {
  const calls = [];
  const tutorial = {
    onFamousPersonsClosed() {
      calls.push(['closed']);
    },
    refreshCurrentHighlight() {
      calls.push(['refresh']);
    },
  };
  const runner = new CanvasPanelActionRunner();

  assert.equal(runner.run({ type: 'closeFamousPersons' }, createContext(calls, { tutorial })), true);
  assert.deepEqual(calls, [
    ['closePanel', 'famousPersons'],
    ['markDirty', 'modal', 'closeFamousPersons'],
    ['flush', 'modal'],
    ['closed'],
    ['setTimeout', 0],
    ['refresh'],
  ]);
});

test('CanvasPanelActionRunner vetoes before mutation and feedbacks', () => {
  const calls = [];
  const tutorial = {
    canOpenTab() {
      calls.push(['canOpenTab']);
      return false;
    },
  };
  const runner = new CanvasPanelActionRunner();

  assert.equal(runner.run({ type: 'openFamousPersons' }, createContext(calls, { tutorial })), false);
  assert.deepEqual(calls, [
    ['canOpenTab'],
    ['showFloatingText', 'guide.completeCurrentStep'],
  ]);
});

test('CanvasPanelActionRunner short-circuits disabled actions', () => {
  const calls = [];
  const runner = new CanvasPanelActionRunner();

  assert.equal(runner.run({ type: 'openFamousPersons', disabled: true }, createContext(calls)), true);
  assert.deepEqual(calls, []);
});
