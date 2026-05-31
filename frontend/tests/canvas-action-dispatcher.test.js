const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..', '..');
const CanvasActionDispatcher = require('../js/platform/CanvasActionDispatcher');
const CanvasActionController = require('../js/platform/CanvasActionController');
const CanvasGuideController = require('../js/platform/CanvasGuideController');

function extractActionTypes(source) {
  const actions = new Set();
  const regex = /action\.type === ['"]([^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(source))) actions.add(match[1]);
  return actions;
}

test('Canvas app and shell action coverage stays centralized after platform unification', () => {
  const canvasShell = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'CanvasGameShell.js'), 'utf8');
  const canvasApp = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'CanvasGameApp.js'), 'utf8');
  const h5Compat = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'H5CanvasAppShell.js'), 'utf8');
  const miniCompat = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'MiniGameApp.js'), 'utf8');
  const h5Actions = extractActionTypes(canvasShell);
  const miniActions = extractActionTypes(canvasApp);

  const sharedActions = [...h5Actions].filter((action) => miniActions.has(action)).sort();
  assert.match(h5Compat, /global\.H5CanvasAppShell = CanvasGameShell/);
  assert.match(miniCompat, /global\.MiniGameApp = CanvasGameApp/);

  // claimScout 已从平台直连分支移入 dispatcher，不再是共享直接分支
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
  // 阶段 4 异步 action 已从平台直连分支中移除
  assert.equal(miniActions.has('selectCity'), false);
  assert.equal(miniActions.has('assignJob'), false);
  assert.equal(miniActions.has('buildBuilding'), false);
  assert.equal(miniActions.has('upgradeBuilding'), false);
  assert.equal(miniActions.has('research'), false);
  assert.equal(miniActions.has('advanceEra'), false);
  assert.equal(miniActions.has('claimEvent'), false);
  assert.equal(miniActions.has('scoutTerritory'), false);
  assert.equal(miniActions.has('claimScout'), false);
  // 阶段 4 第二批异步 action 已从平台直连分支中移除
  assert.equal(miniActions.has('requestNamingInput'), false);
  assert.equal(miniActions.has('closeNaming'), false);
  assert.equal(miniActions.has('submitNaming'), false);
  assert.equal(miniActions.has('scrollBuildings'), false);
  assert.equal(miniActions.has('switchMilitaryView'), false);
  // territoryAction 已完全拆分并迁入 dispatcher
  assert.equal(miniActions.has('territoryAction'), false);
});

test('guide target routing lives only in the shared Canvas guide controller', () => {
  const appSource = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'CanvasGameApp.js'), 'utf8');
  const shellSource = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'CanvasGameShell.js'), 'utf8');
  const dispatcherSource = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'CanvasActionDispatcher.js'), 'utf8');
  const controllerSource = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'CanvasGuideController.js'), 'utf8');
  const guideTokens = [
    'btn-advance-era',
    'task-center-main-claim',
    'guide-task-claim',
    'card-farm',
    'card-house',
    'card-lumbermill',
    'card-barracks',
    'card-watchtower',
    'card-barracks-upgrade',
    'card-craftsman',
    'event-card-special',
    'btn-claim-event',
    'evt_settlement_forest_001',
    'scout-action-first',
    'tab-resources',
    'tab-civilization',
    'tab-buildings',
    'tab-events',
    'tab-military',
    'tab-territory',
  ];

  for (const token of guideTokens) {
    assert.doesNotMatch(shellSource, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `CanvasGameShell must not own guide token ${token}`);
    assert.doesNotMatch(dispatcherSource, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `CanvasActionDispatcher must not own guide token ${token}`);
    assert.match(controllerSource, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `CanvasGuideController should own guide token ${token}`);
  }

  assert.match(appSource, /this\.guideController\?\.getTargetRect\?\.\(key\)/);
  assert.match(appSource, /this\.guideController\?\.goToGuideTaskTarget\?\.\(action\)/);
  assert.match(shellSource, /this\.guideController\?\.getTargetRect\?\.\(key\)/);
  assert.match(shellSource, /this\.guideController\?\.goToGuideTaskTarget\?\.\(action\)/);
  assert.equal(typeof CanvasActionDispatcher.getGuideTargetTab, 'undefined');

  const controller = new CanvasGuideController();
  assert.equal(controller.getTargetTab('card-barracks'), 'buildings');
  assert.equal(controller.getTargetTab('btn-advance-era'), 'civilization');
  assert.equal(controller.getTargetTab('scout-action-first'), 'military');
});

test('canvas gameplay actions are routed by the shared Canvas action controller only', () => {
  const appJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'app.js'), 'utf8');
  const canvasApp = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'CanvasGameApp.js'), 'utf8');
  const canvasShell = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'CanvasGameShell.js'), 'utf8');
  const controller = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'CanvasActionController.js'), 'utf8');
  const gameplayTokens = [
    'buildBuilding',
    'upgradeBuilding',
    'research',
    'advanceEra',
    'claimEvent',
    'claimTaskReward',
    'scoutTerritory',
    'claimScout',
    'switchMilitaryView',
    'territoryAction',
    'assignJob',
  ];

  for (const token of gameplayTokens) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.doesNotMatch(appJs, new RegExp(`action\\?\\.type === ['"]${escaped}['"]`), `app.js must not branch gameplay action ${token}`);
    assert.doesNotMatch(canvasApp, new RegExp(`${escaped}:\\s*async|action\\.type === ['"]${escaped}['"]`), `CanvasGameApp must not own gameplay action ${token}`);
    assert.doesNotMatch(canvasShell, new RegExp(`action\\.type === ['"]${escaped}['"]`), `CanvasGameShell must not own gameplay action ${token}`);
    assert.match(controller, new RegExp(`handle_${escaped}\\b|handleBuilding\\b|claimTaskRewardDirect\\b`), `CanvasActionController should own gameplay action ${token}`);
  }

  assert.doesNotMatch(appJs, /new window\.CanvasActionController\(\{ host: this \}\)/);
  assert.doesNotMatch(appJs, /actionController: this\.canvasActionController/);
  assert.match(canvasApp, /this\.actionController\?\.handle\?\.\(action\)/);
  assert.match(canvasShell, /this\.actionController\?\.handle\?\.\(action, \{ event \}\)/);
  assert.equal(typeof CanvasActionController, 'function');
});

test('CanvasActionDispatcher 阶段 3 第九批接管 changeExpeditionSoldiers 纯 UI action', () => {
  const dispatcher = new CanvasActionDispatcher();

  assert.deepEqual(CanvasActionDispatcher.supportedActions(), [
    'switchTab',
    'openResourceDetails',
    'closeResourceDetails',
    'closeRewardReveal',
    'openCitySwitcher',
    'closeCitySwitcher',
    'openSettings',
    'closeSettings',
    'openLogs',
    'closeLogs',
    'openAdvisor',
    'closeAdvisor',
    'goToAdvisorTarget',
    'openEvent',
    'closeEvent',
    'openWorldSite',
    'closeWorldSite',
    'resetWorldPan',
    'worldMapDrag',
    'changeExpeditionSoldiers',
    'changeExpeditionLeader',
    'enterBattleScene',
    'closeBattleScene',
    'skipBattleScene',
    'goToGuideTaskTarget',
    'openTaskCenter',
    'closeTaskCenter',
    'switchTaskCenterTab',
    'openFamousPersons',
    'closeFamousPersons',
    'changeFamousPersonsPage',
    'openFamousPersonDetail',
    'closeFamousPersonDetail',
    'selectBuildingCategory',
    'selectTechNode',
    'closeTechDetail',
  ]);
  assert.equal(dispatcher.canHandle({ type: 'switchTab' }), true);
  assert.equal(dispatcher.canHandle({ type: 'openResourceDetails' }), true);
  assert.equal(dispatcher.canHandle({ type: 'closeResourceDetails' }), true);
  assert.equal(dispatcher.canHandle({ type: 'closeRewardReveal' }), true);
  assert.equal(dispatcher.canHandle({ type: 'openCitySwitcher' }), true);
  assert.equal(dispatcher.canHandle({ type: 'closeCitySwitcher' }), true);
  assert.equal(dispatcher.canHandle({ type: 'openSettings' }), true);
  assert.equal(dispatcher.canHandle({ type: 'closeSettings' }), true);
  assert.equal(dispatcher.canHandle({ type: 'openLogs' }), true);
  assert.equal(dispatcher.canHandle({ type: 'closeLogs' }), true);
  assert.equal(dispatcher.canHandle({ type: 'openAdvisor' }), true);
  assert.equal(dispatcher.canHandle({ type: 'closeAdvisor' }), true);
  assert.equal(dispatcher.canHandle({ type: 'goToAdvisorTarget' }), true);
  assert.equal(dispatcher.canHandle({ type: 'openEvent' }), true);
  assert.equal(dispatcher.canHandle({ type: 'closeEvent' }), true);
  assert.equal(dispatcher.canHandle({ type: 'openWorldSite' }), true);
  assert.equal(dispatcher.canHandle({ type: 'closeWorldSite' }), true);
  assert.equal(dispatcher.canHandle({ type: 'resetWorldPan' }), true);
  assert.equal(dispatcher.canHandle({ type: 'worldMapDrag' }), true);
  assert.equal(dispatcher.canHandle({ type: 'changeExpeditionSoldiers' }), true);
  assert.equal(dispatcher.canHandle({ type: 'changeExpeditionLeader' }), true);
  assert.equal(dispatcher.canHandle({ type: 'goToGuideTaskTarget' }), true);
  assert.equal(dispatcher.canHandle({ type: 'openTaskCenter' }), true);
  assert.equal(dispatcher.canHandle({ type: 'closeTaskCenter' }), true);
  assert.equal(dispatcher.canHandle({ type: 'switchTaskCenterTab' }), true);
  assert.equal(dispatcher.canHandle({ type: 'openFamousPersons' }), true);
  assert.equal(dispatcher.canHandle({ type: 'closeFamousPersons' }), true);
  assert.equal(dispatcher.canHandle({ type: 'changeFamousPersonsPage' }), true);
  assert.equal(dispatcher.canHandle({ type: 'openFamousPersonDetail' }), true);
  assert.equal(dispatcher.canHandle({ type: 'closeFamousPersonDetail' }), true);
  assert.equal(dispatcher.canHandle({ type: 'selectTechNode' }), true);
  assert.equal(dispatcher.canHandle({ type: 'closeTechDetail' }), true);
  assert.equal(dispatcher.canHandle({ type: 'claimScout' }), false);
});

test('CanvasActionDispatcher 通过注入上下文处理 switchTab，不依赖平台壳类', () => {
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

test('CanvasActionDispatcher 通过注入上下文处理资源详情开关，不依赖平台壳类', () => {
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

test('CanvasActionDispatcher 通过注入上下文处理奖励弹窗关闭，不依赖平台壳类', () => {
  const dispatcher = new CanvasActionDispatcher();
  const calls = [];

  assert.equal(dispatcher.handle({ type: 'closeRewardReveal' }, {
    closeRewardReveal(action) { calls.push(['closeRewardReveal', action.type]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.deepEqual(calls, [
    ['closeRewardReveal', 'closeRewardReveal'],
    ['render', 'closeRewardReveal'],
  ]);
});


test('CanvasActionDispatcher 通过注入上下文处理城市切换开关，不依赖平台壳类', () => {
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

test('CanvasActionDispatcher 通过注入上下文处理设置面板开关，不依赖平台壳类', () => {
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

test('CanvasActionDispatcher 通过注入上下文处理日志面板开关，不依赖平台壳类', () => {
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

test('CanvasActionDispatcher 通过注入上下文处理顾问面板开关，不依赖平台壳类', () => {
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

test('CanvasActionDispatcher 通过注入上下文处理事件弹窗开关，不依赖平台壳类', () => {
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

test('CanvasActionDispatcher 通过注入上下文处理世界地点弹窗开关，不依赖平台壳类', () => {
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

test('CanvasActionDispatcher 通过注入上下文处理 resetWorldPan，不依赖平台壳类', () => {
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

test('CanvasActionDispatcher 通过注入上下文处理 changeExpeditionSoldiers，不依赖平台壳类', () => {
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

test('CanvasActionDispatcher 通过注入上下文处理 changeExpeditionLeader，不依赖平台壳类', () => {
  const dispatcher = new CanvasActionDispatcher();
  const calls = [];

  assert.equal(dispatcher.handle({ type: 'changeExpeditionLeader', siteId: 'site_1', value: 'fp_luxiao' }, {
    changeExpeditionLeader(action) { calls.push(['changeExpeditionLeader', action.type, action.value]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.deepEqual(calls, [
    ['changeExpeditionLeader', 'changeExpeditionLeader', 'fp_luxiao'],
    ['render', 'changeExpeditionLeader'],
  ]);
});

test('CanvasActionDispatcher 通过注入上下文处理主线任务前往，不依赖平台壳类', () => {
  const dispatcher = new CanvasActionDispatcher();
  const calls = [];

  assert.equal(dispatcher.handle({ type: 'goToGuideTaskTarget', target: 'card-barracks' }, {
    goToGuideTaskTarget(action) { calls.push(['goToGuideTaskTarget', action.target]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.deepEqual(calls, [
    ['goToGuideTaskTarget', 'card-barracks'],
    ['render', 'goToGuideTaskTarget'],
  ]);
});

test('CanvasActionDispatcher handles task center panel actions through injected context', () => {
  const dispatcher = new CanvasActionDispatcher();
  const calls = [];

  assert.equal(dispatcher.handle({ type: 'openTaskCenter' }, {
    openTaskCenter(action) { calls.push(['open', action.type]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.equal(dispatcher.handle({ type: 'switchTaskCenterTab', tab: 'daily' }, {
    switchTaskCenterTab(tab, action) { calls.push(['switch', tab, action.type]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.equal(dispatcher.handle({ type: 'closeTaskCenter' }, {
    closeTaskCenter(action) { calls.push(['close', action.type]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.deepEqual(calls, [
    ['open', 'openTaskCenter'],
    ['render', 'openTaskCenter'],
    ['switch', 'daily', 'switchTaskCenterTab'],
    ['render', 'switchTaskCenterTab'],
    ['close', 'closeTaskCenter'],
    ['render', 'closeTaskCenter'],
  ]);
});

test('CanvasActionDispatcher handles famous person panel visibility and page changes', () => {
  const dispatcher = new CanvasActionDispatcher();
  const calls = [];

  assert.equal(dispatcher.handle({ type: 'openFamousPersons' }, {
    openFamousPersons(action) { calls.push(['open', action.type]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.equal(dispatcher.handle({ type: 'closeFamousPersons' }, {
    closeFamousPersons(action) { calls.push(['close', action.type]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.equal(dispatcher.handle({ type: 'changeFamousPersonsPage', delta: 1 }, {
    changeFamousPersonsPage(action) { calls.push(['page', action.delta]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.equal(dispatcher.handle({ type: 'openFamousPersonDetail', personId: 'fp_a' }, {
    openFamousPersonDetail(action) { calls.push(['detail', action.personId]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.equal(dispatcher.handle({ type: 'closeFamousPersonDetail' }, {
    closeFamousPersonDetail(action) { calls.push(['detailClose', action.type]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.equal(dispatcher.canHandle({ type: 'seekFamousPerson' }), false);
  assert.equal(dispatcher.canHandle({ type: 'openFamousPersonDetail' }), true);
  assert.deepEqual(calls, [
    ['open', 'openFamousPersons'],
    ['render', 'openFamousPersons'],
    ['close', 'closeFamousPersons'],
    ['render', 'closeFamousPersons'],
    ['page', 1],
    ['render', 'changeFamousPersonsPage'],
    ['detail', 'fp_a'],
    ['render', 'openFamousPersonDetail'],
    ['detailClose', 'closeFamousPersonDetail'],
    ['render', 'closeFamousPersonDetail'],
  ]);
});

test('CanvasActionController syncs famous person detail selection locally', () => {
  const game = { selectedFamousPersonId: '' };
  const host = {
    selectedFamousPersonId: '',
    renderer: { clearFamousSkillTooltip() {} },
    getCanvasGameHost: () => game,
    renderCanvasAction() { return true; },
  };
  const controller = new CanvasActionController({ host });

  assert.equal(controller.handle({ type: 'openFamousPersonDetail', personId: 'fp_a' }), true);
  assert.equal(host.selectedFamousPersonId, 'fp_a');
  assert.equal(game.selectedFamousPersonId, 'fp_a');

  assert.equal(controller.handle({ type: 'closeFamousPersonDetail' }), true);
  assert.equal(host.selectedFamousPersonId, '');
  assert.equal(game.selectedFamousPersonId, '');
});

test('CanvasActionController handles building category filter through shared canvas action controller', () => {
  const calls = [];
  const controller = new CanvasActionController({
    host: {
      selectBuildingCategory(action) { calls.push(['select', action.category]); return true; },
      renderCanvasAction(action) { calls.push(['render', action.type]); return true; },
    },
  });

  assert.equal(controller.handle({ type: 'selectBuildingCategory', category: 'military' }), true);
  assert.deepEqual(calls, [
    ['select', 'military'],
    ['render', 'selectBuildingCategory'],
  ]);
});

test('CanvasActionController selects tech node before research confirmation', () => {
  const calls = [];
  const host = {
    selectTechNode(action) { calls.push(['select', action.techId]); return true; },
    renderCanvasAction(action) { calls.push(['render', action.type]); return true; },
  };
  const controller = new CanvasActionController({ host });

  assert.equal(controller.handle({ type: 'selectTechNode', techId: 'farming_field_rotation' }), true);
  assert.deepEqual(calls, [
    ['select', 'farming_field_rotation'],
    ['render', 'selectTechNode'],
  ]);
});

test('CanvasActionController forwards famous attribute point assignment', async () => {
  const calls = [];
  const game = {
    assignFamousAttributePoint(personId, attribute) {
      calls.push([personId, attribute]);
      return Promise.resolve(true);
    },
  };
  const controller = new CanvasActionController({
    host: {
      getCanvasGameHost: () => game,
    },
  });

  const handled = await controller.handle({ type: 'assignFamousAttributePoint', personId: 'fp_a', attribute: 'command' });

  assert.equal(handled, true);
  assert.deepEqual(calls, [['fp_a', 'command']]);
});

test('CanvasActionController enters battle scene through game host API from shell host', async () => {
  const report = {
    id: 'battle_1',
    turns: [],
    attacker: { leaderName: '陆骁', soldiersStart: 500 },
    defender: { name: '林地部落', soldiersStart: 500 },
  };
  const calls = [];
  const game = {
    state: {},
    getGameApi() {
      return {
        async claimConquest(territoryId) {
          calls.push(['claimConquest', territoryId]);
          return { success: true, battleReport: report };
        },
      };
    },
    async runAction(callback) {
      const result = await callback();
      calls.push(['runAction', result.success]);
      return result;
    },
    startBattleScene(battleReport) {
      calls.push(['startBattleScene', battleReport.id]);
      return true;
    },
  };
  const shell = {
    getCanvasGameHost: () => game,
  };
  const controller = new CanvasActionController({ host: shell, awaitAsync: true });

  const handled = await controller.handle({ type: 'enterBattleScene', territoryId: 'site-east' });

  assert.equal(handled, true);
  assert.deepEqual(calls, [
    ['claimConquest', 'site-east'],
    ['runAction', true],
    ['startBattleScene', 'battle_1'],
  ]);
});

test('CanvasActionController can skip and close battle scene on game host', () => {
  const calls = [];
  const game = {
    state: {},
    skipBattleScene() { calls.push('skip'); return true; },
    closeBattleScene() { calls.push('close'); return true; },
  };
  const controller = new CanvasActionController({
    host: { getCanvasGameHost: () => game },
  });

  assert.equal(controller.handle({ type: 'skipBattleScene' }), true);
  assert.equal(controller.handle({ type: 'closeBattleScene' }), true);
  assert.deepEqual(calls, ['skip', 'close']);
});

test('CanvasActionDispatcher handles building category filter when used as a compatibility dispatcher', () => {
  const dispatcher = new CanvasActionDispatcher();
  const calls = [];

  assert.equal(dispatcher.handle({ type: 'selectBuildingCategory', category: 'military' }, {
    selectBuildingCategory(action) { calls.push(['select', action.category]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.deepEqual(calls, [
    ['select', 'military'],
    ['render', 'selectBuildingCategory'],
  ]);
});

test('CanvasActionDispatcher handles tech node selection as local UI state', () => {
  const dispatcher = new CanvasActionDispatcher();
  const calls = [];

  assert.equal(dispatcher.handle({ type: 'selectTechNode', techId: 'farming_field_rotation' }, {
    selectTechNode(action) { calls.push(['select', action.techId]); return true; },
    render(action) { calls.push(['render', action.type]); },
  }), true);

  assert.deepEqual(calls, [
    ['select', 'farming_field_rotation'],
    ['render', 'selectTechNode'],
  ]);
});

test('CanvasActionDispatcher no longer owns async gameplay execution', () => {
  assert.equal(typeof CanvasActionDispatcher.supportedAsyncActions, 'undefined');
  assert.equal(typeof CanvasActionDispatcher.prototype.canHandleAsync, 'undefined');
  assert.equal(typeof CanvasActionDispatcher.prototype.handleAsync, 'undefined');

  const controllerSource = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'CanvasActionController.js'), 'utf8');
  for (const token of ['selectCity', 'assignJob', 'buildBuilding', 'upgradeBuilding', 'research', 'advanceEra', 'claimTaskReward', 'scoutTerritory']) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(controllerSource, new RegExp(`handle_${escaped}\\b|handleBuilding\\b|claimTaskRewardDirect\\b`));
  }
});
