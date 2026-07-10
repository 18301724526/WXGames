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

test('CanvasActionDispatcher canHandle is context-aware for dispatcher-first hosts', () => {
  const dispatcher = new CanvasActionDispatcher();

  assert.equal(dispatcher.canHandle({ type: 'openLogs' }, {}), false);
  assert.equal(dispatcher.handle({ type: 'openLogs' }, {}), false);
  assert.equal(dispatcher.canHandle({ type: 'openLogs' }, { openLogs() {} }), true);
  assert.equal(dispatcher.canHandle({ type: 'openFamousPersons' }, {}), true);
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

test('CanvasActionDispatcher preserves visual disabled command state without suppressing submit', () => {
  const calls = [];
  const dispatcher = new CanvasActionDispatcher();
  const action = { type: 'startWorldMarch', disabled: true };

  assert.equal(dispatcher.handle(action, {
    startWorldMarch(value) { calls.push(['startWorldMarch', value.visualDisabled]); return true; },
    render(value) { calls.push(['render', value.visualDisabled, value.disabled]); },
  }), true);
  assert.deepEqual(calls, [
    ['startWorldMarch', true],
    ['render', true, undefined],
  ]);
});

test('CanvasActionDispatcher logs allowed local blocks and ignores domain block reasons', () => {
  const calls = [];
  const logs = [];
  const dispatcher = new CanvasActionDispatcher();
  const context = {
    clientOperationLog: { record(event, detail) { logs.push([event, detail]); } },
    startWorldMarch(action) { calls.push(action.type); return true; },
  };

  assert.equal(dispatcher.handle({
    type: 'startWorldMarch',
    missionId: 'm-1',
    commandDisabled: 'IN_FLIGHT',
    clientActionTraceId: 'cat-startWorldMarch',
  }, context), true);
  assert.deepEqual(calls, []);
  assert.equal(logs.length, 1);
  assert.equal(logs[0][0], 'command:localBlock');
  assert.equal(logs[0][1].commandType, 'startWorldMarch');
  assert.equal(logs[0][1].commandKey, 'startWorldMarch:m-1');
  assert.equal(logs[0][1].reason, 'IN_FLIGHT');
  assert.equal(logs[0][1].schema, 'client-action-trace-v1');
  assert.equal(logs[0][1].clientActionTraceId, 'cat-startWorldMarch');
  assert.equal(logs[0][1].actionType, 'startWorldMarch');
  assert.equal(logs[0][1].hitTargetId, 'm-1');

  assert.equal(dispatcher.handle({ type: 'startWorldMarch', missionId: 'm-2', commandDisabled: 'MARCH' }, context), true);
  assert.deepEqual(calls, ['startWorldMarch']);
});

test('CanvasActionDispatcher records UI-local actions without command submission', () => {
  const calls = [];
  const logs = [];
  const dispatcher = new CanvasActionDispatcher();

  assert.equal(dispatcher.handle({
    type: 'openLogs',
    clientActionTraceId: 'cat-open-logs',
    sourceSurface: 'toolbar',
  }, {
    clientOperationLog: { record(event, detail) { logs.push([event, detail]); } },
    openLogs(action) { calls.push(['openLogs', action.clientActionTrace.clientActionTraceId]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.deepEqual(calls, [
    ['openLogs', 'cat-open-logs'],
    ['render', 'openLogs'],
  ]);
  assert.equal(logs.length, 1);
  assert.equal(logs[0][0], 'action:uiLocal');
  assert.equal(logs[0][1].schema, 'client-action-trace-v1');
  assert.equal(logs[0][1].clientActionTraceId, 'cat-open-logs');
  assert.equal(logs[0][1].sourceSurface, 'toolbar');
  assert.equal(logs[0][1].uiOwner, 'CanvasActionDispatchRegistry');
  assert.equal(logs[0][1].triggersRender, true);
});

test('CanvasActionDispatcher passes client action trace to command handlers', () => {
  const calls = [];
  const logs = [];
  const dispatcher = new CanvasActionDispatcher();

  assert.equal(dispatcher.handle({
    type: 'startWorldMarch',
    missionId: 'march-1',
    clientActionTraceId: 'cat-march-1',
    sourceSurface: 'world-map',
  }, {
    clientOperationLog: { record(event, detail) { logs.push([event, detail]); } },
    startWorldMarch(action) { calls.push(action.clientActionTrace); return true; },
  }), true);

  assert.equal(logs.length, 0);
  assert.equal(calls[0].schema, 'client-action-trace-v1');
  assert.equal(calls[0].clientActionTraceId, 'cat-march-1');
  assert.equal(calls[0].sourceSurface, 'world-map');
  assert.equal(calls[0].hitTargetId, 'march-1');
  assert.equal(calls[0].actionType, 'startWorldMarch');
  assert.equal(calls[0].actionDescriptorId, 'startWorldMarch');
});

test('CanvasActionDispatcher routes famous descriptors through panel runner only', () => {
  const calls = [];
  const action = { type: 'openFamousPersons' };
  const dispatcher = new CanvasActionDispatcher({
    panelActionRunner: {
      run(value, context) {
        calls.push(['panelRunner.run', value.type, context.id]);
        return true;
      },
    },
  });

  assert.equal(dispatcher.handle(action, {
    id: 'ctx-1',
    openFamousPersons() {
      calls.push(['legacy.openFamousPersons']);
      return true;
    },
    render() {
      calls.push(['render']);
    },
  }), true);

  assert.deepEqual(calls, [
    ['panelRunner.run', 'openFamousPersons', 'ctx-1'],
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

test('index.html loads action registry before dispatcher', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
  const descriptorPosition = html.indexOf('CanvasActionDescriptorRegistry.js');
  const registryPosition = html.indexOf('CanvasActionDispatchRegistry.js');
  const dispatcherPosition = html.indexOf('CanvasActionDispatcher.js');

  assert.notEqual(descriptorPosition, -1);
  assert.notEqual(registryPosition, -1);
  assert.notEqual(dispatcherPosition, -1);
  assert.equal(descriptorPosition < registryPosition, true);
  assert.equal(registryPosition < dispatcherPosition, true);
});

test('minigame loads action dispatch registry before dispatcher and app', () => {
  const minigame = fs.readFileSync(path.resolve(__dirname, '../../minigame/game.js'), 'utf8');
  const descriptorPosition = minigame.indexOf("require('../js/platform/CanvasActionDescriptorRegistry')");
  const registryPosition = minigame.indexOf("require('../js/platform/CanvasActionDispatchRegistry')");
  const dispatcherPosition = minigame.indexOf("require('../js/platform/CanvasActionDispatcher')");
  const appPosition = minigame.indexOf("require('../js/platform/CanvasGameApp')");

  assert.notEqual(descriptorPosition, -1);
  assert.notEqual(registryPosition, -1);
  assert.notEqual(dispatcherPosition, -1);
  assert.notEqual(appPosition, -1);
  assert.equal(descriptorPosition < registryPosition, true);
  assert.equal(registryPosition < dispatcherPosition, true);
  assert.equal(dispatcherPosition < appPosition, true);
});
