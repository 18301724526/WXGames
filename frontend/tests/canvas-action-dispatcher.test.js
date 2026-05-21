const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..', '..');
const CanvasActionDispatcher = require('../js/platform/CanvasActionDispatcher');

function extractActionTypes(source) {
  const actions = new Set();
  const regex = /action\.type === ['"]([^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(source))) actions.add(match[1]);
  return actions;
}

test('H5 与小游戏当前 action 覆盖矩阵明确记录共享 switchTab 起点', () => {
  const h5Shell = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'H5CanvasAppShell.js'), 'utf8');
  const miniGameApp = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'MiniGameApp.js'), 'utf8');
  const h5Actions = extractActionTypes(h5Shell);
  const miniActions = extractActionTypes(miniGameApp);

  const sharedActions = [...h5Actions].filter((action) => miniActions.has(action)).sort();

  assert.ok(sharedActions.includes('switchTab'));
  assert.ok(sharedActions.includes('openResourceDetails'));
  assert.ok(sharedActions.includes('claimScout'));
  assert.ok(h5Actions.has('openSettings'));
  assert.equal(miniActions.has('openSettings'), false);
});

test('CanvasActionDispatcher 阶段 2 只接管 switchTab', () => {
  const dispatcher = new CanvasActionDispatcher();

  assert.deepEqual(CanvasActionDispatcher.supportedActions(), ['switchTab']);
  assert.equal(dispatcher.canHandle({ type: 'switchTab' }), true);
  assert.equal(dispatcher.canHandle({ type: 'claimScout' }), false);
});

test('CanvasActionDispatcher 通过注入上下文处理 switchTab，不依赖 H5 或小游戏类', () => {
  const dispatcher = new CanvasActionDispatcher();
  const calls = [];

  const handled = dispatcher.handle({ type: 'switchTab', tab: 'buildings' }, {
    resetForTabSwitch(action) { calls.push(['reset', action.tab]); },
    switchTab(tab) { calls.push(['switch', tab]); return true; },
    render(action) { calls.push(['render', action.tab]); },
  });

  assert.equal(handled, true);
  assert.deepEqual(calls, [
    ['reset', 'buildings'],
    ['switch', 'buildings'],
    ['render', 'buildings'],
  ]);
});
