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
      soldierAssignments: { 'fp-scout': 120 },
      soldierDraftAssignments: { 'fp-scout': 999 },
      page: 0,
      saving: false,
    },
    canvasShell: {},
    getGameApi() {
      return {
        async setArmyFormation(cityId, slot, memberIds, soldierAssignments) {
          calls.push(['setArmyFormation', cityId, slot, memberIds, soldierAssignments]);
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
    ['setArmyFormation', 'capital', 1, ['fp-scout'], { 'fp-scout': 120 }],
    ['applyApiState', 22],
    ['onArmyFormationSaved', 22],
    ['showFloatingText', 'saved'],
    ['log', 'saved'],
  ]);
});

test('autoReplenishArmyFormation drafts soldiers and confirm applies them to the saved formation payload', async () => {
  class Host {}
  CanvasGameAppCommands.install(Host);
  const calls = [];
  const host = new Host();
  Object.assign(host, {
    state: {
      activeCityId: 'capital',
      military: {
        soldiers: 600,
        formations: {
          capital: [{
            slot: 1,
            memberIds: ['hero-1', 'hero-2'],
            maxSoldiersPerMember: 1000,
            soldierAssignments: { 'hero-1': 100, 'hero-2': 0 },
          }],
        },
      },
    },
    armyFormationEditor: {
      open: true,
      cityId: 'capital',
      slot: 1,
      memberIds: ['hero-1', 'hero-2'],
      soldierAssignments: { 'hero-1': 100, 'hero-2': 0 },
      soldierDraftAssignments: { 'hero-1': 100, 'hero-2': 0 },
      saving: false,
    },
    getGameApi() {
      return {
        async setArmyFormation(cityId, slot, memberIds, soldierAssignments) {
          calls.push(['setArmyFormation', cityId, slot, memberIds, soldierAssignments]);
          return { message: 'saved' };
        },
      };
    },
    applyApiState() {},
    renderCanvasSurface() {},
    showFloatingText(message) { calls.push(['showFloatingText', message]); },
    log(message) { calls.push(['log', message]); },
  });

  assert.equal(host.autoReplenishArmyFormation(), true);
  assert.deepEqual(host.armyFormationEditor.soldierAssignments, { 'hero-1': 100, 'hero-2': 0 });
  assert.deepEqual(host.armyFormationEditor.soldierDraftAssignments, { 'hero-1': 350, 'hero-2': 350 });
  assert.equal(host.confirmArmyFormationSoldiers(), true);
  assert.deepEqual(host.armyFormationEditor.soldierAssignments, { 'hero-1': 350, 'hero-2': 350 });
  assert.equal(await host.saveArmyFormation(), true);
  assert.deepEqual(calls.find((call) => call[0] === 'setArmyFormation'), [
    'setArmyFormation',
    'capital',
    1,
    ['hero-1', 'hero-2'],
    { 'hero-1': 350, 'hero-2': 350 },
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

test('CanvasGameApp routes tagged world-map entity hits through runtime before action dispatch', async () => {
  const calls = [];
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    initialState: {
      currentTab: 'military',
      militaryView: 'world',
      territoryState: { worldMap: { tiles: [{ id: 'tile_0_0', q: 0, r: 0 }] } },
    },
  });
  app.activeTab = 'military';
  app.militaryView = 'world';
  app.mapHomeActive = true;
  app.hasBlockingOverlayOpen = () => false;
  app.renderer = {
    getHitTarget(point) {
      calls.push(['rendererHit', point.x, point.y]);
      return {
        type: 'selectWorldActor',
        actorId: 'stale-renderer-actor',
        inputSurface: 'worldMap',
      };
    },
  };
  app.actionController = {
    handle(action) {
      calls.push(['handle', action.type, action.actorId || action.siteId || '']);
      return true;
    },
  };
  app.ensureWorldMapRuntimeCoordinator = () => ({
    handleTap(point) {
      calls.push(['runtimeTap', point.x, point.y]);
      return app.actionController.handle({ type: 'selectWorldActor', actorId: 'stable-actor' });
    },
    getMapRuntime() {
      return { hitTargets: [] };
    },
  });

  assert.equal(await app.handleTap({ x: 60, y: 60 }), true);

  assert.deepEqual(calls, [
    ['rendererHit', 60, 60],
    ['runtimeTap', 60, 60],
    ['handle', 'selectWorldActor', 'stable-actor'],
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

test('CanvasGameApp observes async world-map runtime tap failures for diagnostics', async () => {
  const errors = [];
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    initialState: {
      currentTab: 'military',
      militaryView: 'world',
      territoryState: { worldMap: { tiles: [{ id: 'tile_1_1', q: 1, r: 1 }] } },
    },
    log(error) {
      errors.push(error?.message || String(error || ''));
    },
  });
  app.activeTab = 'military';
  app.militaryView = 'world';
  app.mapHomeActive = true;
  app.renderer = {
    getHitTarget() {
      return { type: 'worldMapDrag', background: true };
    },
  };
  app.ensureWorldMapRuntimeCoordinator = () => ({
    handleTap() {
      return Promise.reject(new Error('app runtime tap failed'));
    },
    getMapRuntime() {
      return null;
    },
  });

  const handled = app.handleTap({ x: 200, y: 360 });
  await assert.rejects(
    () => handled,
    /app runtime tap failed/,
  );

  assert.deepEqual(errors, ['app runtime tap failed']);
});

test('CanvasGameApp records compat tap hit and runtime routing into local operation log', async () => {
  const previous = global.ClientOperationLog;
  const events = [];
  global.ClientOperationLog = {
    summarizeAction(action) {
      return action ? { type: action.type, background: Boolean(action.background) } : null;
    },
    summarizePoint(point) {
      return { x: point.x, y: point.y };
    },
    record(type, detail) {
      events.push([type, detail]);
    },
  };
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
  app.hasBlockingOverlayOpen = () => false;
  app.renderer = {
    getHitTarget() {
      return { type: 'worldMapDrag', background: true };
    },
  };
  app.ensureWorldMapRuntimeCoordinator = () => ({
    handleTap() {
      return true;
    },
    getMapRuntime() {
      return { hitTargets: [] };
    },
  });

  try {
    assert.equal(await app.handleTap({ x: 200, y: 360 }), true);
  } finally {
    global.ClientOperationLog = previous;
  }

  assert.equal(events.some((event) => event[0] === 'input:tapHit'), true);
  assert.equal(events.some((event) => event[0] === 'input:tapRuntime'), true);
  const runtimeEvent = events.find((event) => event[0] === 'input:tapRuntime')?.[1];
  assert.equal(runtimeEvent.actionType, 'worldMapDrag');
  assert.equal(runtimeEvent.runtimeHandled, true);
});

test('CanvasGameApp records compat async runtime routing as compact promise state', async () => {
  const previous = global.ClientOperationLog;
  const events = [];
  global.ClientOperationLog = {
    summarizeAction(action) {
      return action ? { type: action.type, background: Boolean(action.background) } : null;
    },
    summarizePoint(point) {
      return { x: point.x, y: point.y };
    },
    record(type, detail) {
      events.push([type, detail]);
    },
  };
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
  app.hasBlockingOverlayOpen = () => false;
  app.renderer = {
    getHitTarget() {
      return { type: 'worldMapDrag', background: true };
    },
  };
  app.ensureWorldMapRuntimeCoordinator = () => ({
    handleTap() {
      return Promise.resolve(true);
    },
    getMapRuntime() {
      return { hitTargets: [] };
    },
  });

  try {
    assert.equal(await app.handleTap({ x: 200, y: 360 }), true);
  } finally {
    global.ClientOperationLog = previous;
  }

  const runtimeEvent = events.find((event) => event[0] === 'input:tapRuntime')?.[1];
  assert.equal(runtimeEvent.runtimeHandled, 'promise');
});

test('CanvasGameApp records compat tap misses into local operation log', async () => {
  const previous = global.ClientOperationLog;
  const events = [];
  global.ClientOperationLog = {
    summarizeAction(action) {
      return action ? { type: action.type } : null;
    },
    summarizePoint(point) {
      return { x: point.x, y: point.y };
    },
    record(type, detail) {
      events.push([type, detail]);
    },
  };
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    initialState: {
      currentTab: 'military',
      militaryView: 'world',
    },
  });
  app.activeTab = 'military';
  app.militaryView = 'world';
  app.mapHomeActive = true;
  app.hasBlockingOverlayOpen = () => false;
  app.renderer = {
    getHitTarget() {
      return null;
    },
  };
  app.ensureWorldMapRuntimeCoordinator = () => ({
    handleTap() {
      return false;
    },
    getMapRuntime() {
      return null;
    },
  });

  try {
    assert.equal(await app.handleTap({ x: 80, y: 90 }), false);
  } finally {
    global.ClientOperationLog = previous;
  }

  assert.equal(events.some((event) => event[0] === 'input:tapHit'), true);
  const missEvent = events.find((event) => event[0] === 'input:tapMiss')?.[1];
  assert.equal(missEvent.runtimeHandled, false);
});

test('CanvasGameApp records compat disabled taps into local operation log', async () => {
  const previous = global.ClientOperationLog;
  const events = [];
  global.ClientOperationLog = {
    summarizeAction(action) {
      return action ? { type: action.type, disabled: Boolean(action.disabled) } : null;
    },
    summarizePoint(point) {
      return { x: point.x, y: point.y };
    },
    record(type, detail) {
      events.push([type, detail]);
    },
  };
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    initialState: {
      currentTab: 'military',
      militaryView: 'world',
    },
  });
  app.activeTab = 'military';
  app.militaryView = 'world';
  app.mapHomeActive = true;
  app.hasBlockingOverlayOpen = () => false;
  app.renderer = {
    getHitTarget() {
      return { type: 'openWorldSite', siteId: 'capital', disabled: true };
    },
  };

  try {
    assert.equal(await app.handleTap({ x: 80, y: 90 }), true);
  } finally {
    global.ClientOperationLog = previous;
  }

  assert.equal(events.some((event) => event[0] === 'input:tapHit'), true);
  const disabledEvent = events.find((event) => event[0] === 'input:tapDisabled')?.[1];
  assert.equal(disabledEvent.action.type, 'openWorldSite');
  assert.equal(disabledEvent.action.disabled, true);
});

test('CanvasGameApp records compat non-runtime tap actions into local operation log', async () => {
  const previous = global.ClientOperationLog;
  const events = [];
  global.ClientOperationLog = {
    summarizeAction(action) {
      return action ? { type: action.type, siteId: action.siteId || '' } : null;
    },
    summarizePoint(point) {
      return { x: point.x, y: point.y };
    },
    record(type, detail) {
      events.push([type, detail]);
    },
  };
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    initialState: {
      currentTab: 'military',
      militaryView: 'world',
    },
  });
  app.activeTab = 'military';
  app.militaryView = 'world';
  app.mapHomeActive = true;
  app.hasBlockingOverlayOpen = () => false;
  app.renderer = {
    getHitTarget() {
      return { type: 'openWorldSite', siteId: 'capital' };
    },
  };
  app.actionController = {
    handle() {
      return true;
    },
  };

  try {
    assert.equal(await app.handleTap({ x: 60, y: 60 }), true);
  } finally {
    global.ClientOperationLog = previous;
  }

  assert.equal(events.some((event) => event[0] === 'input:tapHit'), true);
  assert.equal(events.some((event) => event[0] === 'input:tapAction'), true);
  const actionEvent = events.find((event) => event[0] === 'input:tapAction')?.[1];
  assert.equal(actionEvent.action.type, 'openWorldSite');
  assert.equal(actionEvent.handled, true);
});

test('CanvasGameApp records compat async action dispatch before rejection', async () => {
  const previous = global.ClientOperationLog;
  const events = [];
  global.ClientOperationLog = {
    summarizeAction(action) {
      return action ? { type: action.type, siteId: action.siteId || '' } : null;
    },
    summarizePoint(point) {
      return { x: point.x, y: point.y };
    },
    record(type, detail) {
      events.push([type, detail]);
    },
  };
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    initialState: {
      currentTab: 'military',
      militaryView: 'world',
    },
  });
  app.activeTab = 'military';
  app.militaryView = 'world';
  app.mapHomeActive = true;
  app.hasBlockingOverlayOpen = () => false;
  app.renderer = {
    getHitTarget() {
      return { type: 'externalWorldCommand', siteId: 'capital' };
    },
  };
  app.actionController = {
    handle() {
      return Promise.reject(new Error('compat action failed'));
    },
  };

  try {
    await assert.rejects(
      () => app.handleTap({ x: 60, y: 60 }),
      /compat action failed/,
    );
  } finally {
    global.ClientOperationLog = previous;
  }

  const actionEvent = events.find((event) => event[0] === 'input:tapAction')?.[1];
  assert.equal(actionEvent.action.type, 'externalWorldCommand');
  assert.equal(actionEvent.handled, 'promise');
});
