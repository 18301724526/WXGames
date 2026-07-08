const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasActionDispatchRegistry = require('./CanvasActionDispatchRegistry');
const CanvasActionDispatcher = require('./CanvasActionDispatcher');

test('CanvasActionDispatcher delegates supported action metadata to the registry', () => {
  assert.deepEqual(CanvasActionDispatcher.supportedActions(), CanvasActionDispatchRegistry.supportedActions());
  assert.equal(new CanvasActionDispatcher().canHandle({ type: 'openCommandPanel' }), true);
  assert.equal(new CanvasActionDispatcher().canHandle({ type: 'unknownAction' }), false);
});

test('CanvasActionDispatcher preserves switch tab side effects and render contract', () => {
  const calls = [];
  const dispatcher = new CanvasActionDispatcher();
  const action = { type: 'switchTab', tab: 'events' };
  const handled = dispatcher.handle(action, {
    resetForTabSwitch(value) { calls.push(['reset', value.tab]); },
    switchTab(tab, value) { calls.push(['switch', tab, value === action]); },
    render(value) { calls.push(['render', value.type]); },
  });

  assert.equal(handled, true);
  assert.deepEqual(calls, [
    ['reset', 'events'],
    ['switch', 'events', true],
    ['render', 'switchTab'],
  ]);
});

test('CanvasActionDispatcher preserves render action and disabled contracts', () => {
  const calls = [];
  const dispatcher = new CanvasActionDispatcher();
  assert.equal(dispatcher.handle({ type: 'openLogs', disabled: true }, {
    openLogs() { calls.push(['openLogs']); },
    render() { calls.push(['render']); },
  }), true);
  assert.deepEqual(calls, []);

  const action = { type: 'switchTaskCenterTab', tab: 'main' };
  assert.equal(dispatcher.handle(action, {
    switchTaskCenterTab(tab, value) { calls.push(['switchTaskCenterTab', tab, value === action]); },
    render(value) { calls.push(['render', value.type]); },
  }), true);
  assert.deepEqual(calls, [
    ['switchTaskCenterTab', 'main', true],
    ['render', 'switchTaskCenterTab'],
  ]);
});

test('CanvasActionDispatcher preserves async finish handling and error logging', async () => {
  const calls = [];
  const errors = [];
  const dispatcher = new CanvasActionDispatcher({ log: (error) => errors.push(error.message) });

  assert.equal(dispatcher.handle({ type: 'enterCity' }, {
    enterCity() {
      calls.push(['enterCity']);
      return Promise.resolve(true);
    },
    render(value) { calls.push(['render', value.type]); },
  }), true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(calls, [['enterCity'], ['render', 'enterCity']]);

  assert.equal(dispatcher.handle({ type: 'openCityManagement' }, {
    openCityManagement() {
      return Promise.reject(new Error('network down'));
    },
  }), true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(errors, ['network down']);
});

test('CanvasActionDispatcher rejects retired scout report actions', () => {
  const calls = [];
  const dispatcher = new CanvasActionDispatcher();

  assert.equal(dispatcher.handle({ type: 'startExplore' }, {
    startExplore() { calls.push(['startExplore']); },
    render(value) { calls.push(['render', value.type]); },
  }), false);
  assert.equal(dispatcher.handle({ type: 'claimExplore', value: 'march-3' }, {
    claimExplore(missionId) { calls.push(['claimExplore', missionId]); },
  }), false);

  assert.deepEqual(calls, []);
});

test('CanvasActionDispatcher passes world march mission identifiers to finish handlers', () => {
  const calls = [];
  const dispatcher = new CanvasActionDispatcher();

  assert.equal(dispatcher.handle({ type: 'returnWorldMarch', missionId: 'march-1' }, {
    returnWorldMarch(missionId) { calls.push(['returnWorldMarch', missionId]); },
  }), true);
  assert.equal(dispatcher.handle({ type: 'stopWorldMarch', actorId: 'march-2' }, {
    stopWorldMarch(missionId) { calls.push(['stopWorldMarch', missionId]); },
  }), true);

  assert.deepEqual(calls, [
    ['returnWorldMarch', 'march-1'],
    ['stopWorldMarch', 'march-2'],
  ]);
});

function positionOf(source, needle) {
  const position = source.indexOf(needle);
  assert.notEqual(position, -1, `${needle} should be loaded`);
  return position;
}

test('entrypoints load panel action stack before dispatcher and hosts', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
  const minigame = fs.readFileSync(path.resolve(__dirname, '../../minigame/game.js'), 'utf8');
  const htmlOrder = [
    'FamousPersonsPanel.js',
    'CanvasPanelRegistry.js',
    'CanvasPanelSurfaceManager.js',
    'CanvasStageScheduler.js',
    'CanvasPanelActionContextAdapter.js',
    'CanvasPanelActionRegistry.js',
    'CanvasPanelActionRunner.js',
    'CanvasActionDispatchRegistry.js',
    'CanvasActionDispatcher.js',
  ].map((name) => positionOf(html, name));
  const minigameOrder = [
    "require('../js/platform/panels/FamousPersonsPanel')",
    "require('../js/platform/panels/CanvasPanelRegistry')",
    "require('../js/platform/CanvasPanelSurfaceManager')",
    "require('../js/platform/CanvasStageScheduler')",
    "require('../js/platform/CanvasPanelActionContextAdapter')",
    "require('../js/platform/CanvasPanelActionRegistry')",
    "require('../js/platform/CanvasPanelActionRunner')",
    "require('../js/platform/CanvasActionDispatchRegistry')",
    "require('../js/platform/CanvasActionDispatcher')",
  ].map((name) => positionOf(minigame, name));

  assert.deepEqual(htmlOrder, [...htmlOrder].sort((left, right) => left - right));
  assert.deepEqual(minigameOrder, [...minigameOrder].sort((left, right) => left - right));
  assert.equal(htmlOrder.at(-1) < positionOf(html, 'CanvasActionController.js'), true);
  assert.equal(htmlOrder.at(-1) < positionOf(html, 'CanvasGameApp.js'), true);
  assert.equal(htmlOrder.at(-1) < positionOf(html, 'CanvasGameShell.js'), true);
  assert.equal(minigameOrder.at(-1) < positionOf(minigame, "require('../js/platform/CanvasActionController')"), true);
  assert.equal(minigameOrder.at(-1) < positionOf(minigame, "require('../js/platform/CanvasGameApp')"), true);
});
