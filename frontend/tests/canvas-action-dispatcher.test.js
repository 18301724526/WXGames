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

test('H5 与小游戏当前 action 覆盖矩阵明确记录阶段 4 异步迁移起点', () => {
  const h5Shell = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'H5CanvasAppShell.js'), 'utf8');
  const miniGameApp = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'MiniGameApp.js'), 'utf8');
  const h5Actions = extractActionTypes(h5Shell);
  const miniActions = extractActionTypes(miniGameApp);

  const sharedActions = [...h5Actions].filter((action) => miniActions.has(action)).sort();

  // claimScout 已从小游戏直接 if 分支移入 dispatcher，不再是共享直接分支
  assert.equal(sharedActions.includes('claimScout'), false);
  // 阶段 3 纯 UI action 已全部迁入 dispatcher
  assert.equal(h5Actions.has('openSettings'), false);
  assert.equal(h5Actions.has('closeSettings'), false);
  assert.equal(h5Actions.has('openLogs'), false);
  assert.equal(h5Actions.has('closeLogs'), false);
  assert.equal(h5Actions.has('openAdvisor'), false);
  assert.equal(h5Actions.has('closeAdvisor'), false);
  assert.equal(h5Actions.has('openEvent'), false);
  assert.equal(h5Actions.has('closeEvent'), false);
  assert.equal(h5Actions.has('openWorldSite'), false);
  assert.equal(h5Actions.has('closeWorldSite'), false);
  assert.equal(h5Actions.has('resetWorldPan'), false);
  assert.equal(h5Actions.has('changeExpeditionSoldiers'), false);
  // 阶段 4 异步 action 已从小游戏直接 if 分支中移除
  assert.equal(miniActions.has('selectCity'), false);
  assert.equal(miniActions.has('assignJob'), false);
  assert.equal(miniActions.has('buildBuilding'), false);
  assert.equal(miniActions.has('upgradeBuilding'), false);
  assert.equal(miniActions.has('advanceEra'), false);
  assert.equal(miniActions.has('claimEvent'), false);
  assert.equal(miniActions.has('scoutTerritory'), false);
  assert.equal(miniActions.has('claimScout'), false);
  // 阶段 4 第二批异步 action 已从小游戏直接 if 分支中移除
  assert.equal(miniActions.has('requestNamingInput'), false);
  assert.equal(miniActions.has('closeNaming'), false);
  assert.equal(miniActions.has('submitNaming'), false);
  assert.equal(miniActions.has('scrollBuildings'), false);
  assert.equal(miniActions.has('switchMilitaryView'), false);
  // territoryAction 已完全拆分并迁入 dispatcher
  assert.equal(miniActions.has('territoryAction'), false);
});

test('CanvasActionDispatcher 阶段 3 第九批接管 changeExpeditionSoldiers 纯 UI action', () => {
  const dispatcher = new CanvasActionDispatcher();

  assert.deepEqual(CanvasActionDispatcher.supportedActions(), [
    'switchTab',
    'openResourceDetails',
    'closeResourceDetails',
    'openCitySwitcher',
    'closeCitySwitcher',
    'openSettings',
    'closeSettings',
    'openLogs',
    'closeLogs',
    'openAdvisor',
    'closeAdvisor',
    'openEvent',
    'closeEvent',
    'openWorldSite',
    'closeWorldSite',
    'resetWorldPan',
        'changeExpeditionSoldiers',
      ]);
  assert.equal(dispatcher.canHandle({ type: 'switchTab' }), true);
  assert.equal(dispatcher.canHandle({ type: 'openResourceDetails' }), true);
  assert.equal(dispatcher.canHandle({ type: 'closeResourceDetails' }), true);
  assert.equal(dispatcher.canHandle({ type: 'openCitySwitcher' }), true);
  assert.equal(dispatcher.canHandle({ type: 'closeCitySwitcher' }), true);
  assert.equal(dispatcher.canHandle({ type: 'openSettings' }), true);
  assert.equal(dispatcher.canHandle({ type: 'closeSettings' }), true);
  assert.equal(dispatcher.canHandle({ type: 'openLogs' }), true);
  assert.equal(dispatcher.canHandle({ type: 'closeLogs' }), true);
  assert.equal(dispatcher.canHandle({ type: 'openAdvisor' }), true);
  assert.equal(dispatcher.canHandle({ type: 'closeAdvisor' }), true);
  assert.equal(dispatcher.canHandle({ type: 'openEvent' }), true);
  assert.equal(dispatcher.canHandle({ type: 'closeEvent' }), true);
  assert.equal(dispatcher.canHandle({ type: 'openWorldSite' }), true);
  assert.equal(dispatcher.canHandle({ type: 'closeWorldSite' }), true);
  assert.equal(dispatcher.canHandle({ type: 'resetWorldPan' }), true);
  assert.equal(dispatcher.canHandle({ type: 'changeExpeditionSoldiers' }), true);
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

test('CanvasActionDispatcher 通过注入上下文处理资源详情开关，不依赖 H5 或小游戏类', () => {
  const dispatcher = new CanvasActionDispatcher();
  const calls = [];

  assert.equal(dispatcher.handle({ type: 'openResourceDetails' }, {
    openResourceDetails(action) { calls.push(['open', action.type]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.equal(dispatcher.handle({ type: 'closeResourceDetails' }, {
    closeResourceDetails(action) { calls.push(['close', action.type]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.deepEqual(calls, [
    ['open', 'openResourceDetails'],
    ['render', 'openResourceDetails'],
    ['close', 'closeResourceDetails'],
    ['render', 'closeResourceDetails'],
  ]);
});

test('CanvasActionDispatcher 通过注入上下文处理城市切换开关，不依赖 H5 或小游戏类', () => {
  const dispatcher = new CanvasActionDispatcher();
  const calls = [];

  assert.equal(dispatcher.handle({ type: 'openCitySwitcher' }, {
    openCitySwitcher(action) { calls.push(['openCity', action.type]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.equal(dispatcher.handle({ type: 'closeCitySwitcher' }, {
    closeCitySwitcher(action) { calls.push(['closeCity', action.type]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.deepEqual(calls, [
    ['openCity', 'openCitySwitcher'],
    ['render', 'openCitySwitcher'],
    ['closeCity', 'closeCitySwitcher'],
    ['render', 'closeCitySwitcher'],
  ]);
});

test('CanvasActionDispatcher 通过注入上下文处理设置面板开关，不依赖 H5 或小游戏类', () => {
  const dispatcher = new CanvasActionDispatcher();
  const calls = [];

  assert.equal(dispatcher.handle({ type: 'openSettings' }, {
    openSettings(action) { calls.push(['openSettings', action.type]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.equal(dispatcher.handle({ type: 'closeSettings' }, {
    closeSettings(action) { calls.push(['closeSettings', action.type]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.deepEqual(calls, [
    ['openSettings', 'openSettings'],
    ['render', 'openSettings'],
    ['closeSettings', 'closeSettings'],
    ['render', 'closeSettings'],
  ]);
});

test('CanvasActionDispatcher 通过注入上下文处理日志面板开关，不依赖 H5 或小游戏类', () => {
  const dispatcher = new CanvasActionDispatcher();
  const calls = [];

  assert.equal(dispatcher.handle({ type: 'openLogs' }, {
    openLogs(action) { calls.push(['openLogs', action.type]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.equal(dispatcher.handle({ type: 'closeLogs' }, {
    closeLogs(action) { calls.push(['closeLogs', action.type]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.deepEqual(calls, [
    ['openLogs', 'openLogs'],
    ['render', 'openLogs'],
    ['closeLogs', 'closeLogs'],
    ['render', 'closeLogs'],
  ]);
});

test('CanvasActionDispatcher 通过注入上下文处理顾问面板开关，不依赖 H5 或小游戏类', () => {
  const dispatcher = new CanvasActionDispatcher();
  const calls = [];

  assert.equal(dispatcher.handle({ type: 'openAdvisor' }, {
    openAdvisor(action) { calls.push(['openAdvisor', action.type]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.equal(dispatcher.handle({ type: 'closeAdvisor' }, {
    closeAdvisor(action) { calls.push(['closeAdvisor', action.type]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.deepEqual(calls, [
    ['openAdvisor', 'openAdvisor'],
    ['render', 'openAdvisor'],
    ['closeAdvisor', 'closeAdvisor'],
    ['render', 'closeAdvisor'],
  ]);
});

test('CanvasActionDispatcher 通过注入上下文处理事件弹窗开关，不依赖 H5 或小游戏类', () => {
  const dispatcher = new CanvasActionDispatcher();
  const calls = [];

  assert.equal(dispatcher.handle({ type: 'openEvent' }, {
    openEvent(action) { calls.push(['openEvent', action.type]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.equal(dispatcher.handle({ type: 'closeEvent' }, {
    closeEvent(action) { calls.push(['closeEvent', action.type]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.deepEqual(calls, [
    ['openEvent', 'openEvent'],
    ['render', 'openEvent'],
    ['closeEvent', 'closeEvent'],
    ['render', 'closeEvent'],
  ]);
});

test('CanvasActionDispatcher 通过注入上下文处理世界地点弹窗开关，不依赖 H5 或小游戏类', () => {
  const dispatcher = new CanvasActionDispatcher();
  const calls = [];

  assert.equal(dispatcher.handle({ type: 'openWorldSite' }, {
    openWorldSite(action) { calls.push(['openWorldSite', action.type]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.equal(dispatcher.handle({ type: 'closeWorldSite' }, {
    closeWorldSite(action) { calls.push(['closeWorldSite', action.type]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.deepEqual(calls, [
    ['openWorldSite', 'openWorldSite'],
    ['render', 'openWorldSite'],
    ['closeWorldSite', 'closeWorldSite'],
    ['render', 'closeWorldSite'],
  ]);
});

test('CanvasActionDispatcher 通过注入上下文处理 resetWorldPan，不依赖 H5 或小游戏类', () => {
  const dispatcher = new CanvasActionDispatcher();
  const calls = [];

  assert.equal(dispatcher.handle({ type: 'resetWorldPan' }, {
    resetWorldPan(action) { calls.push(['resetWorldPan', action.type]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.deepEqual(calls, [
    ['resetWorldPan', 'resetWorldPan'],
    ['render', 'resetWorldPan'],
  ]);
});

test('CanvasActionDispatcher 通过注入上下文处理 changeExpeditionSoldiers，不依赖 H5 或小游戏类', () => {
  const dispatcher = new CanvasActionDispatcher();
  const calls = [];

  assert.equal(dispatcher.handle({ type: 'changeExpeditionSoldiers', siteId: 'site_1', value: 5 }, {
    changeExpeditionSoldiers(action) { calls.push(['changeExpeditionSoldiers', action.type, action.value]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.deepEqual(calls, [
    ['changeExpeditionSoldiers', 'changeExpeditionSoldiers', 5],
    ['render', 'changeExpeditionSoldiers'],
  ]);
});

test('CanvasActionDispatcher handleAsync handles async actions', async () => {
  const dispatcher = new CanvasActionDispatcher();

  assert.deepEqual(CanvasActionDispatcher.supportedAsyncActions(), [
    'selectCity',
    'assignJob',
    'buildBuilding',
    'upgradeBuilding',
    'advanceEra',
    'claimEvent',
    'scoutTerritory',
    'claimScout',
    'requestNamingInput',
    'closeNaming',
    'submitNaming',
    'scrollBuildings',
    'switchMilitaryView',
    'openExpedition',
    'closeExpedition',
    'conquer',
    'launchExpedition',
    'claimConquest',
    'manageCity',
    'renameCity',
  ]);

  assert.equal(dispatcher.canHandleAsync({ type: 'selectCity' }), true);
  assert.equal(dispatcher.canHandleAsync({ type: 'unknown' }), false);

  const calls = [];
  const result = await dispatcher.handleAsync({ type: 'selectCity', cityId: 'city_1' }, {
    selectCity: async (action) => {
      calls.push(['selectCity', action.cityId]);
      return true;
    },
    render: (action) => {
      calls.push(['render', action.type]);
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.success, true);
  assert.deepEqual(calls, [
    ['selectCity', 'city_1'],
    ['render', 'selectCity'],
  ]);
});

test('CanvasActionDispatcher handleAsync returns not handled for unknown actions', async () => {
  const dispatcher = new CanvasActionDispatcher();
  const result = await dispatcher.handleAsync({ type: 'unknown' }, {});
  assert.equal(result.handled, false);
});

test('CanvasActionDispatcher handleAsync handles errors gracefully', async () => {
  const dispatcher = new CanvasActionDispatcher();
  const result = await dispatcher.handleAsync({ type: 'selectCity' }, {
    selectCity: async () => {
      throw new Error('API error');
    },
  });
  assert.equal(result.handled, true);
  assert.equal(result.success, false);
  assert.ok(result.error);
});
