const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasGameApp = require('./CanvasGameApp');
const CanvasGameAppCommands = require('./CanvasGameAppCommands');
const CanvasGameShell = require('./CanvasGameShell');

const APP_MODULES = [
  'CanvasGameAppStateSync',
  'CanvasGameAppRenderingRuntime',
  'CanvasGameAppBattleScene',
  'CanvasGameAppCommands',
  'CanvasGameAppGuideUi',
  'CanvasGameAppInputRouter',
];

test('CanvasGameApp installs responsibility modules into the compatibility facade', () => {
  const proto = CanvasGameApp.prototype;
  const expectedMethods = {
    stateSync: ['applyState', 'syncFromServer', 'start', 'stop'],
    renderingRuntime: ['renderCanvasSurface', 'ensureWorldMapRuntime', 'switchTab', 'setTechTreeZoom'],
    battleScene: ['startBattleScene', 'skipBattleScene', 'closeBattleScene'],
    commands: ['buildBuilding', 'advanceEra', 'research', 'enterCity', 'showHouseBuiltAdvisorDialogue'],
    guideUi: ['openNaming', 'closeCityManagement', 'renderSoftGuide', 'cacheRequestLog'],
    inputRouter: ['handleTap', 'handleDrag', 'handleGesture', 'isPointBlockedByTutorialShield'],
  };

  Object.entries(expectedMethods).forEach(([group, methods]) => {
    methods.forEach((method) => {
      assert.equal(typeof proto[method], 'function', `${group}.${method} should be installed`);
    });
  });
});

test('html and minigame entries load CanvasGameApp modules before the facade', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
  const minigame = fs.readFileSync(path.resolve(__dirname, '../../minigame/game.js'), 'utf8');

  const facadeHtmlPosition = html.indexOf('CanvasGameApp.js');
  const facadeMinigamePosition = minigame.indexOf("require('../js/platform/CanvasGameApp')");
  assert.notEqual(facadeHtmlPosition, -1);
  assert.notEqual(facadeMinigamePosition, -1);

  APP_MODULES.forEach((moduleName) => {
    const htmlPosition = html.indexOf(`${moduleName}.js`);
    const minigamePosition = minigame.indexOf(`require('../js/platform/${moduleName}')`);
    assert.notEqual(htmlPosition, -1, `${moduleName}.js should be loaded by index.html`);
    assert.notEqual(minigamePosition, -1, `${moduleName} should be required by minigame/game.js`);
    assert.equal(htmlPosition < facadeHtmlPosition, true, `${moduleName}.js should load before CanvasGameApp.js`);
    assert.equal(minigamePosition < facadeMinigamePosition, true, `${moduleName} should require before CanvasGameApp`);
  });
});

test('saveArmyFormation lets tutorial own the post-save map transition', async () => {
  class Host {}
  CanvasGameAppCommands.install(Host);
  const calls = [];
  const host = new Host();
  Object.assign(host, {
    state: { currentTab: 'buildings' },
    tutorial: { completed: false, currentStep: 22 },
    armyFormationEditor: {
      open: true,
      cityId: 'capital',
      slot: 1,
      memberIds: ['fp-scout'],
      page: 0,
      saving: false,
    },
    canvasShell: {},
    getGameApi() {
      return {
        async setArmyFormation(cityId, slot, memberIds) {
          calls.push(['setArmyFormation', cityId, slot, memberIds]);
          return {
            message: 'saved',
            tutorial: { completed: false, currentStep: 22 },
          };
        },
      };
    },
    applyApiState(result) {
      calls.push(['applyApiState', result.tutorial.currentStep]);
      this.tutorial = result.tutorial;
    },
    tutorialController: {
      onArmyFormationSaved(result) {
        calls.push(['onArmyFormationSaved', result.tutorial.currentStep]);
        return true;
      },
      sync() {
        calls.push(['sync']);
      },
      refreshCurrentHighlight() {
        calls.push(['refreshCurrentHighlight']);
      },
    },
    renderCanvasSurface(tab) {
      calls.push(['renderCanvasSurface', tab]);
    },
    showFloatingText(message) {
      calls.push(['showFloatingText', message]);
    },
    log(message) {
      calls.push(['log', message]);
    },
  });

  assert.equal(await host.saveArmyFormation(), true);
  assert.deepEqual(calls, [
    ['renderCanvasSurface', 'buildings'],
    ['setArmyFormation', 'capital', 1, ['fp-scout']],
    ['applyApiState', 22],
    ['onArmyFormationSaved', 22],
    ['showFloatingText', 'saved'],
    ['log', 'saved'],
  ]);
});

test('CanvasGameApp wires authority state refreshes from the sync service', () => {
  const calls = [];
  const syncService = {
    setStateProvider(provider) {
      calls.push(['setStateProvider']);
      this.provider = provider;
    },
  };
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    syncService,
    useWorldMapRuntime: false,
    initialState: {
      currentTab: 'military',
      militaryView: 'world',
      worldExplorerState: {
        activeMission: { id: 'explore-1', status: 'active' },
      },
    },
  });
  app.applyApiState = (data) => calls.push([
    'applyApiState',
    data.gameState.worldExplorerState.idleMissions[0].id,
  ]);

  syncService.onState({
    gameState: {
      worldExplorerState: {
        activeMission: null,
        idleMissions: [{ id: 'explore-1', status: 'idle' }],
      },
    },
  });

  assert.equal(syncService.provider(), app.state);
  assert.deepEqual(calls, [
    ['setStateProvider'],
    ['applyApiState', 'explore-1'],
  ]);
});

test('CanvasGameApp renders territory site selection through map-home city HUD', () => {
  const calls = [];
  const renderer = {
    render(renderState, options) {
      calls.push([
        'render',
        renderState.currentTab,
        renderState.militaryView,
        options.activeTab,
        options.isMapHome,
        options.territoryUiState?.selectedSiteId,
      ]);
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    renderer,
  });
  shell.syncWorldMapRendererLayerMetrics = () => {};
  shell.ensureWorldMapRuntimeCoordinator = () => ({ canRender: () => false });
  shell.renderWorldMapLayer = () => false;
  shell.setWorldMapLayerVisible = () => {};

  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    canvasShell: shell,
    initialState: {
      currentTab: 'buildings',
      militaryView: 'army',
      territoryState: {
        worldMap: { tiles: [{ id: 'tile_capital', q: 0, r: 0, siteId: 'capital' }] },
        territories: [{ id: 'capital', status: 'occupied', owner: 'player' }],
      },
    },
  });
  app.territoryController = {
    uiState: { selectedSiteId: 'capital' },
    getUiState() {
      return { selectedSiteId: 'capital' };
    },
  };
  shell.lastGame = app;

  app.renderTerritory();

  assert.deepEqual(calls.at(-1), ['render', 'military', 'world', 'military', true, 'capital']);
  assert.equal(app.mapHomeActive, true);
  assert.equal(shell.mapHomeActive, true);
});

test('CanvasGameApp routes world map drag taps through runtime before action dispatch', async () => {
  const calls = [];
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    initialState: {
      currentTab: 'military',
      militaryView: 'world',
      territoryState: { worldMap: { tiles: [{ id: 'tile_1_1', q: 1, r: 1 }] } },
    },
  });
  app.activeTab = 'military';
  app.militaryView = 'world';
  app.mapHomeActive = true;
  app.renderer = {
    getHitTarget(point) {
      calls.push(['rendererHit', point.x, point.y]);
      return { type: 'worldMapDrag', background: true };
    },
  };
  app.actionController = {
    handle(action) {
      calls.push(['handle', action.type, action.targetQ, action.targetR]);
      return true;
    },
  };
  app.ensureWorldMapRuntimeCoordinator = () => ({
    handleTap(point) {
      calls.push(['runtimeTap', point.x, point.y]);
      return app.actionController.handle({ type: 'selectWorldMarchTarget', targetQ: 1, targetR: 1 });
    },
    getMapRuntime() {
      return { hitTargets: [] };
    },
  });

  assert.equal(await app.handleTap({ x: 200, y: 360 }), true);
  assert.deepEqual(calls, [
    ['rendererHit', 200, 360],
    ['runtimeTap', 200, 360],
    ['handle', 'selectWorldMarchTarget', 1, 1],
  ]);
});

test('CanvasGameApp recomputes renderer background march targets through runtime', async () => {
  const calls = [];
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    initialState: {
      currentTab: 'military',
      militaryView: 'world',
      territoryState: { worldMap: { tiles: [{ id: 'tile_2_2', q: 2, r: 2 }] } },
    },
  });
  app.activeTab = 'military';
  app.militaryView = 'world';
  app.mapHomeActive = true;
  app.renderer = {
    getHitTarget(point) {
      calls.push(['rendererHit', point.x, point.y]);
      return {
        type: 'selectWorldMarchTarget',
        targetQ: 2,
        targetR: 2,
        background: true,
      };
    },
  };
  app.actionController = {
    handle(action) {
      calls.push(['handle', action.type, action.targetQ, action.targetR]);
      return true;
    },
  };
  app.ensureWorldMapRuntimeCoordinator = () => ({
    handleTap(point) {
      calls.push(['runtimeTap', point.x, point.y]);
      return app.actionController.handle({ type: 'selectWorldMarchTarget', targetQ: 3, targetR: 3 });
    },
    getMapRuntime() {
      return { hitTargets: [] };
    },
  });

  assert.equal(await app.handleTap({ x: 195, y: 498.58 }), true);
  assert.deepEqual(calls, [
    ['rendererHit', 195, 498.58],
    ['runtimeTap', 195, 498.58],
    ['handle', 'selectWorldMarchTarget', 3, 3],
  ]);
});

test('CanvasGameApp does not dispatch renderer background world-map taps when runtime misses', async () => {
  const calls = [];
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    initialState: {
      currentTab: 'military',
      militaryView: 'world',
      territoryState: { worldMap: { tiles: [{ id: 'tile_2_2', q: 2, r: 2 }] } },
    },
  });
  app.activeTab = 'military';
  app.militaryView = 'world';
  app.mapHomeActive = true;
  app.renderer = {
    getHitTarget(point) {
      calls.push(['rendererHit', point.x, point.y]);
      return {
        type: 'selectWorldMarchTarget',
        targetQ: 2,
        targetR: 2,
        background: true,
      };
    },
  };
  app.actionController = {
    handle(action) {
      calls.push(['handle', action.type, action.targetQ, action.targetR]);
      return true;
    },
  };
  app.ensureWorldMapRuntimeCoordinator = () => ({
    handleTap(point) {
      calls.push(['runtimeTap', point.x, point.y]);
      return false;
    },
    getMapRuntime() {
      return { hitTargets: [] };
    },
  });

  assert.equal(await app.handleTap({ x: 195, y: 498.58 }), false);
  assert.deepEqual(calls, [
    ['rendererHit', 195, 498.58],
    ['runtimeTap', 195, 498.58],
  ]);
});
