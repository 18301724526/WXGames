const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasStageScheduler = require('./CanvasStageScheduler');

test('CanvasStageScheduler flushes modal through projectModalLayer', () => {
  const calls = [];
  const scheduler = new CanvasStageScheduler({
    panelSurfaceManager: {
      projectModalLayer(options) {
        calls.push(['projectModalLayer', options.dirty.length, options.reason, options.requestedPanelKey]);
        return true;
      },
    },
  });

  assert.equal(
    scheduler.markDirty('modal', 'openFamousPersons', {
      action: { type: 'openFamousPersons' },
      descriptor: { panelKey: 'famousPersons' },
    }),
    true,
  );
  assert.equal(scheduler.flush(['modal']), true);
  assert.deepEqual(calls, [['projectModalLayer', 1, 'openFamousPersons', 'famousPersons']]);
  assert.equal(scheduler.flush(['modal']), false);
});

test('CanvasStageScheduler flushes modal once through open-set projection', () => {
  const calls = [];
  const scheduler = new CanvasStageScheduler({
    panelSurfaceManager: {
      projectModalLayer(options) {
        calls.push(options.reason);
        return true;
      },
    },
  });

  scheduler.markDirty('modal', 'syntheticPanelAction', {
    action: { type: 'openSettings', panelKey: 'settings' },
    descriptor: { panelKey: 'settings' },
  });

  assert.equal(scheduler.flush(['modal']), true);
  assert.deepEqual(calls, ['syntheticPanelAction']);
});

test('CanvasStageScheduler records modal projection failure and clears dirty slot', () => {
  const scheduler = new CanvasStageScheduler({
    panelSurfaceManager: {
      projectModalLayer() {
        return false;
      },
    },
  });

  scheduler.markDirty('modal', 'closeFamousPersons', {
    action: { type: 'closeFamousPersons' },
    descriptor: { panelKey: 'famousPersons' },
  });

  assert.equal(scheduler.flush(['modal']), false);
  assert.deepEqual(scheduler.getFailures().map((failure) => failure.detail.message), [
    'modal projection returned false',
  ]);
  assert.equal(scheduler.flush(['modal']), false);
  assert.equal(scheduler.getFailures().length, 1);
});

test('CanvasStageScheduler runAtomic batches dirty slots', () => {
  const calls = [];
  const scheduler = new CanvasStageScheduler({
    panelSurfaceManager: {
      projectModalLayer(options) {
        calls.push(options.dirty.map((entry) => entry.reason));
        return true;
      },
    },
  });

  scheduler.runAtomic(() => {
    scheduler.markDirty('modal', 'openFamousPersons', { descriptor: { panelKey: 'famousPersons' } });
    scheduler.markDirty('modal', 'openFamousPersonDetail', { descriptor: { panelKey: 'famousPersons' } });
  }, { flush: ['modal'] });

  assert.deepEqual(calls, [['openFamousPersons', 'openFamousPersonDetail']]);
});

test('entrypoints load panel action scheduler stack before app and shell facades', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
  const minigame = fs.readFileSync(path.resolve(__dirname, '../../minigame/game.js'), 'utf8');
  const htmlOrder = [
    'CanvasPanelSurfaceManager.js',
    'CanvasStageScheduler.js',
    'CanvasPanelActionRegistry.js',
    'CanvasPanelActionContextAdapter.js',
    'CanvasPanelActionRunner.js',
    'CanvasGameApp.js',
    'CanvasActionDispatchRegistry.js',
    'CanvasActionDispatcher.js',
    'CanvasGameShell.js',
  ];
  const minigameOrder = [
    "require('../js/platform/CanvasPanelSurfaceManager')",
    "require('../js/platform/CanvasStageScheduler')",
    "require('../js/platform/CanvasPanelActionRegistry')",
    "require('../js/platform/CanvasPanelActionContextAdapter')",
    "require('../js/platform/CanvasPanelActionRunner')",
    "require('../js/platform/CanvasGameApp')",
  ];

  htmlOrder.forEach((needle) => assert.notEqual(html.indexOf(needle), -1, `${needle} should load in index.html`));
  for (let index = 1; index < htmlOrder.length; index += 1) {
    assert.equal(
      html.indexOf(htmlOrder[index - 1]) < html.indexOf(htmlOrder[index]),
      true,
      `${htmlOrder[index - 1]} should load before ${htmlOrder[index]}`,
    );
  }

  minigameOrder.forEach((needle) => assert.notEqual(minigame.indexOf(needle), -1, `${needle} should load in minigame`));
  for (let index = 1; index < minigameOrder.length; index += 1) {
    assert.equal(
      minigame.indexOf(minigameOrder[index - 1]) < minigame.indexOf(minigameOrder[index]),
      true,
      `${minigameOrder[index - 1]} should load before ${minigameOrder[index]}`,
    );
  }
});
