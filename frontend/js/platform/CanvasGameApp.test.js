const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasGameApp = require('./CanvasGameApp');
const BattleStore = require('../state/BattleStore');
const TerritoryUiStateStore = require('../state/TerritoryUiStateStore');
const CanvasGameShell = require('./CanvasGameShell');

const RETIRED_APP_MODULES = [
  'CanvasGameAppStateSync',
  'CanvasGameWorldActorAnimationRuntime',
  'CanvasGameAppRenderingRuntime',
  'CanvasGameAppBattleScene',
  'CanvasGameAppCommands',
  'CanvasGameAppGuideUi',
  'CanvasGameAppInputRouter',
];

function makeAppHost(fields = {}) {
  return Object.assign(Object.create(CanvasGameApp.prototype), fields);
}

test('CanvasGameApp owns retired responsibility methods directly', () => {
  const proto = CanvasGameApp.prototype;
  const expectedMethods = {
    stateSync: ['applyState', 'syncFromServer', 'start', 'stop'],
    actorAnimation: ['startWorldActorAnimationLoop', 'stopWorldActorAnimationLoop', 'renderWorldActorAnimationFrame'],
    renderingRuntime: ['renderCanvasSurface', 'buildRenderOptions', 'ensureWorldMapRuntime', 'switchTab', 'setTechTreeZoom'],
    battleScene: ['startBattleScene', 'skipBattleScene', 'closeBattleScene'],
    commands: ['buildBuilding', 'advanceEra', 'research', 'enterCity', 'showHouseBuiltAdvisorDialogue'],
    guideUi: ['openNaming', 'closeCityManagement', 'renderSoftGuide', 'cacheRequestLog'],
    inputRouter: ['handleTap', 'handleDrag', 'handleGesture', 'isPointBlockedByTutorialShield'],
  };

  Object.entries(expectedMethods).forEach(([group, methods]) => {
    methods.forEach((method) => {
      assert.equal(typeof proto[method], 'function', `${group}.${method} should live on CanvasGameApp`);
    });
  });
});

test('html and minigame entries load CanvasGameApp without retired split modules', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
  const minigame = fs.readFileSync(path.resolve(__dirname, '../../minigame/game.js'), 'utf8');

  const facadeHtmlPosition = html.indexOf('CanvasGameApp.js');
  const facadeMinigamePosition = minigame.indexOf("require('../js/platform/CanvasGameApp')");
  assert.notEqual(facadeHtmlPosition, -1);
  assert.notEqual(facadeMinigamePosition, -1);

  RETIRED_APP_MODULES.forEach((moduleName) => {
    assert.equal(html.includes(`${moduleName}.js`), false, `${moduleName}.js should not be loaded by index.html`);
    assert.equal(
      minigame.includes(`require('../js/platform/${moduleName}')`),
      false,
      `${moduleName} should not be required by minigame/game.js`,
    );
  });

  const optimisticHtmlPosition = html.indexOf('js/state/optimistic/index.js');
  const optimisticMinigamePosition = minigame.indexOf("require('../js/state/optimistic/index')");
  assert.notEqual(optimisticHtmlPosition, -1, 'state/optimistic/index.js should be loaded by index.html');
  assert.notEqual(optimisticMinigamePosition, -1, 'state/optimistic/index should be required by minigame/game.js');
  assert.equal(
    optimisticHtmlPosition < facadeHtmlPosition,
    true,
    'state/optimistic/index.js should load before CanvasGameApp',
  );
  assert.equal(
    optimisticMinigamePosition < facadeMinigamePosition,
    true,
    'state/optimistic/index should require before CanvasGameApp',
  );
});

test('saveArmyFormation lets tutorial own the post-save map transition', async () => {
  const calls = [];
  const host = makeAppHost({
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
    ['setArmyFormation', 'capital', 1, ['fp-scout'], { 'fp-scout': 999 }],
    ['applyApiState', 22],
    ['onArmyFormationSaved', 22],
    ['showFloatingText', 'saved'],
    ['log', 'saved'],
  ]);
});

test('autoReplenishArmyFormation saves the visible draft soldier assignments without a separate confirm step', async () => {
  const calls = [];
  const host = makeAppHost({
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
  assert.equal(await host.saveArmyFormation(), true);
  assert.deepEqual(calls.find((call) => call[0] === 'setArmyFormation'), [
    'setArmyFormation',
    'capital',
    1,
    ['hero-1', 'hero-2'],
    { 'hero-1': 350, 'hero-2': 350 },
  ]);
});

// Characterization tests for the army-formation editor cluster (god-file
// re-decomposition slice 6). Written against the pre-extraction CanvasGameApp
// bodies and kept UNCHANGED through the ArmyFormationEditorController
// extraction -- staying green is the read-proof of behavioural equivalence.
test('openArmyFormation seeds the editor from the city formation and normalizes assignments', () => {
  const calls = [];
  const host = makeAppHost({
    state: {
      activeCityId: 'capital',
      military: {
        soldiers: 500,
        formations: {
          capital: [{
            slot: 2,
            memberIds: ['a', 'b', 'c', 'd', 'e', 'f'],
            maxSoldiersPerMember: 200,
            soldierAssignments: { a: 999, b: -5, c: 20 },
          }],
        },
      },
    },
    renderCanvasSurface(tab) { calls.push(['renderCanvasSurface', tab]); },
  });

  assert.equal(host.openArmyFormation({ slot: 2 }), true);
  assert.deepEqual(host.armyFormationEditor, {
    open: true,
    cityId: 'capital',
    slot: 2,
    memberIds: ['a', 'b', 'c', 'd', 'e'],
    soldierAssignments: { a: 200, b: 0, c: 20, d: 0, e: 0 },
    soldierDraftAssignments: { a: 200, b: 0, c: 20, d: 0, e: 0 },
    page: 0,
    saving: false,
  });
  assert.equal(calls.length, 1);
});

test('toggleArmyFormationMember adds with zeroed assignments, removes, and enforces the 5-member cap', () => {
  const toasts = [];
  const host = makeAppHost({
    state: { activeCityId: 'capital', military: { formations: {} } },
    armyFormationEditor: {
      open: true,
      cityId: 'capital',
      slot: 1,
      memberIds: ['a'],
      soldierAssignments: { a: 10 },
      soldierDraftAssignments: { a: 10 },
      page: 0,
      saving: false,
    },
    renderCanvasSurface() {},
    showFloatingText(message) { toasts.push(message); },
  });

  assert.equal(host.toggleArmyFormationMember({ personId: 'b' }), true);
  assert.deepEqual(host.armyFormationEditor.memberIds, ['a', 'b']);
  assert.deepEqual(host.armyFormationEditor.soldierAssignments, { a: 10, b: 0 });
  assert.deepEqual(host.armyFormationEditor.soldierDraftAssignments, { a: 10, b: 0 });

  assert.equal(host.toggleArmyFormationMember({ personId: 'a' }), true);
  assert.deepEqual(host.armyFormationEditor.memberIds, ['b']);
  assert.deepEqual(host.armyFormationEditor.soldierAssignments, { b: 0 });

  host.toggleArmyFormationMember({ personId: 'c' });
  host.toggleArmyFormationMember({ personId: 'd' });
  host.toggleArmyFormationMember({ personId: 'e' });
  host.toggleArmyFormationMember({ personId: 'f' });
  assert.equal(toasts.length, 0);
  assert.equal(host.toggleArmyFormationMember({ personId: 'g' }), false);
  assert.equal(toasts.length, 1);
  assert.deepEqual(host.armyFormationEditor.memberIds, ['b', 'c', 'd', 'e', 'f']);
});

test('changeArmyFormationPage clamps at zero and requires an open editor', () => {
  const host = makeAppHost({
    state: {},
    armyFormationEditor: { open: true, cityId: 'capital', slot: 1, memberIds: [], page: 1 },
    renderCanvasSurface() {},
  });

  assert.equal(host.changeArmyFormationPage({ delta: -5 }), true);
  assert.equal(host.armyFormationEditor.page, 0);
  assert.equal(host.changeArmyFormationPage({ delta: 2 }), true);
  assert.equal(host.armyFormationEditor.page, 2);

  host.armyFormationEditor = { open: false };
  assert.equal(host.changeArmyFormationPage({ delta: 1 }), false);
});

test('changeArmyFormationSoldiers maps the ratio onto the per-member cap', () => {
  const host = makeAppHost({
    state: {
      activeCityId: 'capital',
      military: {
        soldiers: 1000,
        formations: { capital: [{ slot: 1, maxSoldiersPerMember: 400 }] },
      },
    },
    armyFormationEditor: {
      open: true,
      cityId: 'capital',
      slot: 1,
      memberIds: ['a', 'b'],
      soldierAssignments: { a: 0, b: 0 },
      soldierDraftAssignments: { a: 0, b: 0 },
      page: 0,
      saving: false,
    },
    renderCanvasSurface() {},
  });

  assert.equal(host.changeArmyFormationSoldiers({ personId: 'a', ratio: 0.5 }), true);
  assert.equal(host.armyFormationEditor.soldierDraftAssignments.a, 200);
  assert.equal(host.changeArmyFormationSoldiers({ personId: 'a', ratio: 2 }), true);
  assert.equal(host.armyFormationEditor.soldierDraftAssignments.a, 400);
});

test('setArmyFormationSoldierDraft clamps to the remaining editable pool', () => {
  const host = makeAppHost({
    state: {
      activeCityId: 'capital',
      military: {
        soldiers: 100,
        formations: {
          capital: [{
            slot: 1,
            maxSoldiersPerMember: 1000,
            soldierAssignments: { a: 30, b: 20 },
          }],
        },
      },
    },
    armyFormationEditor: {
      open: true,
      cityId: 'capital',
      slot: 1,
      memberIds: ['a', 'b'],
      soldierAssignments: { a: 30, b: 20 },
      soldierDraftAssignments: { a: 30, b: 20 },
      page: 0,
      saving: false,
    },
    renderCanvasSurface() {},
  });

  // pool = assigned (50) + reserve (100) = 150; b keeps 20 -> a caps at 130.
  assert.equal(host.setArmyFormationSoldierDraft('a', 500), true);
  assert.equal(host.armyFormationEditor.soldierDraftAssignments.a, 130);
  assert.equal(host.setArmyFormationSoldierDraft('missing', 10), false);
});

test('requestArmyFormationSoldierInput prompts through the runtime and applies the draft', async () => {
  const host = makeAppHost({
    state: {
      activeCityId: 'capital',
      military: {
        soldiers: 500,
        formations: { capital: [{ slot: 1, maxSoldiersPerMember: 1000 }] },
      },
    },
    armyFormationEditor: {
      open: true,
      cityId: 'capital',
      slot: 1,
      memberIds: ['a'],
      soldierAssignments: { a: 5 },
      soldierDraftAssignments: { a: 5 },
      page: 0,
      saving: false,
    },
    runtime: {
      async requestTextInput(prompt) {
        return prompt.value === '5' ? '42' : '';
      },
    },
    renderCanvasSurface() {},
  });

  assert.equal(await host.requestArmyFormationSoldierInput({ personId: 'a' }), true);
  assert.equal(host.armyFormationEditor.soldierDraftAssignments.a, 42);

  host.runtime = { async requestTextInput() { return ''; } };
  assert.equal(await host.requestArmyFormationSoldierInput({ personId: 'a' }), false);
});

test('saveArmyFormation failure resets saving, surfaces the message, and re-renders', async () => {
  const calls = [];
  const host = makeAppHost({
    state: { currentTab: 'military' },
    armyFormationEditor: {
      open: true,
      cityId: 'capital',
      slot: 1,
      memberIds: ['a'],
      soldierAssignments: { a: 10 },
      soldierDraftAssignments: { a: 10 },
      page: 0,
      saving: false,
    },
    getGameApi() {
      return {
        async setArmyFormation() {
          const error = new Error('boom');
          error.payload = { message: 'save rejected' };
          throw error;
        },
      };
    },
    applyApiState() { calls.push(['applyApiState']); },
    renderCanvasSurface(tab) { calls.push(['renderCanvasSurface', tab]); },
    showFloatingText(message) { calls.push(['showFloatingText', message]); },
    log(message) { calls.push(['log', message]); },
  });

  assert.equal(await host.saveArmyFormation(), false);
  assert.equal(host.armyFormationEditor.saving, false);
  assert.equal(host.armyFormationEditor.open, true);
  assert.deepEqual(calls, [
    ['renderCanvasSurface', 'military'],
    ['showFloatingText', 'save rejected'],
    ['log', 'save rejected'],
    ['renderCanvasSurface', 'military'],
  ]);
});

test('closeArmyFormationEditor resets to the closed default and honours render:false', () => {
  const calls = [];
  const host = makeAppHost({
    state: { currentTab: 'military' },
    armyFormationEditor: {
      open: true,
      cityId: 'capital',
      slot: 2,
      memberIds: ['a'],
      soldierAssignments: { a: 1 },
      soldierDraftAssignments: { a: 1 },
      page: 3,
      saving: false,
    },
    renderCanvasSurface(tab) { calls.push(['renderCanvasSurface', tab]); },
  });

  assert.equal(host.closeArmyFormationEditor({ render: false }), true);
  assert.deepEqual(host.armyFormationEditor, {
    open: false,
    cityId: '',
    slot: 1,
    memberIds: [],
    soldierAssignments: {},
    soldierDraftAssignments: {},
    page: 0,
    saving: false,
  });
  assert.equal(calls.length, 0);
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

test('CanvasGameApp seeds reports on load and plays only newly arriving ones once', () => {
  const calls = [];
  const host = makeAppHost({
    state: { currentTab: 'military' },
    tutorial: {},
    loading: { visible: false },
    resolveMapHomeViewState(state = {}, options = {}) {
      return {
        activeTab: state.currentTab || options.requestedTab || 'military',
        militaryView: state.militaryView || options.militaryView || 'world',
        isMapHome: false,
      };
    },
    getActiveTab() { return this.state?.currentTab || 'military'; },
    getGameApi() { return null; },
    setPendingBuildingAction() {},
    syncWorldClock() {},
    updateSyncInterval() {},
    render() { calls.push(['render']); },
    startBattleScene(report) { calls.push(['battle', report.id]); return true; },
  });
  const makePayload = (recentReports) => ({
    gameState: {
      currentTab: 'military',
      worldExplorerState: { combat: { recentReports } },
    },
  });
  const report1 = { id: 'report-1', report: { id: 'report-1', turns: [], summary: 'Resolved' } };
  const report2 = { id: 'report-2', report: { id: 'report-2', turns: [], summary: 'Fresh' } };

  // First sync: report-1 already exists (history from before load) -> seeded, not played.
  host.applyState(makePayload([report1]));
  assert.deepEqual(calls.filter((call) => call[0] === 'battle'), []);

  // A new battle (report-2, newest-first) arrives in a later sync -> played once, and not
  // re-played on subsequent syncs; the seeded report-1 never plays.
  host.applyState(makePayload([report2, report1]));
  host.applyState(makePayload([report2, report1]));

  assert.deepEqual(calls.filter((call) => call[0] === 'battle'), [['battle', 'report-2']]);
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
  shell.lastGame = app;
  TerritoryUiStateStore.patch(app, { selectedSiteId: 'capital' });

  app.renderTerritory();

  assert.deepEqual(calls.at(-1), ['render', 'military', 'world', 'military', true, 'capital']);
  assert.equal(app.mapHomeActive, true);
  assert.equal(shell.mapHomeActive, true);
});

test('CanvasGameApp does not preserve canvas when runtime hit targets are preserved but map layer is invalid', () => {
  const calls = [];
  const runtime = {
    hasBakedMapLayer: true,
    worldMapInputState: {
      baseHitTargets: [{ action: { type: 'enterCity' } }],
      hitTargets: [{ action: { type: 'enterCity' } }],
      lastHitTargetSync: {
        baseHitTargetCount: 1,
        hitTargetCount: 1,
        mapTargetCount: 0,
        preserved: true,
        sourceHitTargetCount: 0,
      },
    },
    mapBakeDirty: true,
    getBaseHitTargets() {
      return this.worldMapInputState.baseHitTargets;
    },
    getHitTargets() {
      return this.worldMapInputState.hitTargets;
    },
    getLastHitTargetSync() {
      return this.worldMapInputState.lastHitTargetSync;
    },
    isMapBakeDirty() {
      return true;
    },
  };
  const renderer = {
    render(renderState, options) {
      calls.push(['render', options.skipWorldMapLayer, options.preserveCanvas, options.worldMapFrameState?.hitTargetsPreserved]);
    },
  };
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    renderer,
    worldMapRuntime: runtime,
    useWorldMapRuntime: true,
    initialState: {
      currentTab: 'military',
      militaryView: 'world',
      territoryState: {
        worldMap: { tiles: [{ id: 'tile_0_0' }] },
      },
    },
  });
  app.canvasShell = null;
  app.mapHomeActive = true;
  app.worldMapRuntime = runtime;
  app.worldMapRuntimeCoordinator = {
    canRender() {
      return true;
    },
    getMapRuntime() {
      return runtime;
    },
    render() {
      calls.push(['runtimeRender']);
      return true;
    },
  };

  assert.equal(app.renderCanvasSurface('military'), true);
  assert.deepEqual(calls, [
    ['runtimeRender'],
    ['render', false, false, true],
  ]);
});

test('CanvasGameApp rolls back optimistic world march after start rejection', async () => {
  const calls = [];
  const host = makeAppHost();
  const initialExplorer = {
    missions: [],
    activeMission: null,
    idleMissions: [],
    maxManualRouteLength: 8,
    stepDurationSeconds: 10,
  };
  Object.assign(host, {
    state: {
      activeCityId: 'capital',
      currentTab: 'military',
      worldExplorerState: initialExplorer,
      territoryState: {
        worldMap: { origin: { q: 0, r: 0 }, tiles: [{ q: 0, r: 0, siteId: 'capital' }] },
        territories: [{ id: 'capital', q: 0, r: 0 }],
      },
    },
    config: {},
    getWorldEpochNowMs() {
      return Date.parse('2026-06-21T00:00:00.000Z');
    },
    getGameApi() {
      return {
        async startWorldMarch() {
          calls.push(['api:startWorldMarch', host.state.worldExplorerState.activeMission?.id || '']);
          const error = new Error('busy');
          error.payload = { success: false, error: 'EXPLORE_FORMATION_BUSY', message: 'busy' };
          throw error;
        },
      };
    },
    renderCanvasSurface(tab) {
      calls.push(['renderCanvasSurface', tab, this.state.worldExplorerState.activeMission?.status || 'none']);
    },
    updateWorldActorAnimationLoop(options) {
      calls.push(['updateWorldActorAnimationLoop', options.state.worldExplorerState.activeMission?.status || 'none']);
    },
    log(message) {
      calls.push(['log', message]);
    },
  });

  assert.equal(await host.startWorldMarch({ targetQ: 2, targetR: 0, formationSlot: 1 }), false);

  assert.equal(calls.some((call) => call[0] === 'api:startWorldMarch' && call[1].startsWith('optimistic_manual_')), true);
  assert.equal(calls.some((call) => call[0] === 'renderCanvasSurface' && call[2] === 'active'), true);
  assert.deepEqual(host.state.worldExplorerState, initialExplorer);
});

test('CanvasGameApp starts a selected idle world actor by id without a capital optimistic replacement', async () => {
  const calls = [];
  const parkedMission = {
    id: 'march-parked',
    kind: 'worldExplore',
    mode: 'manual',
    status: 'idle',
    origin: { q: 7, r: -2, tileId: 'tile_7_-2' },
    homeOrigin: { q: 0, r: 0, tileId: 'tile_0_0' },
    target: { q: 7, r: -2, tileId: 'tile_7_-2' },
    position: { q: 7, r: -2, tileId: 'tile_7_-2' },
    route: [],
    formation: { cityId: 'frontier-city', slot: 2 },
    revealedTileIds: [],
    stepDurationSeconds: 10,
    stepDurationMs: 10000,
    nextStepAt: null,
    completedAt: '2026-06-21T00:00:00.000Z',
  };
  const host = makeAppHost({
    state: {
      activeCityId: 'capital',
      currentTab: 'military',
      worldExplorerState: {
        missions: [parkedMission],
        activeMission: null,
        idleMissions: [parkedMission],
        maxManualRouteLength: 10,
        stepDurationSeconds: 10,
      },
      territoryState: {
        worldMap: { origin: { q: 0, r: 0 }, tiles: [{ q: 0, r: 0, siteId: 'capital' }] },
        territories: [{ id: 'capital', q: 0, r: 0 }],
      },
    },
    tutorial: {},
    loading: {},
    canvasShell: { loading: {}, territoryUiState: {} },
    config: {},
    mapHomeActive: false,
    getActiveTab() {
      return this.state.currentTab;
    },
    resolveMapHomeViewState(nextState) {
      return { activeTab: nextState.currentTab || 'military', militaryView: nextState.militaryView || 'army', isMapHome: false };
    },
    setPendingBuildingAction() {},
    getWorldEpochNowMs() {
      return Date.parse('2026-06-21T00:00:00.000Z');
    },
    getGameApi() {
      return {
        async startWorldMarch(options) {
          calls.push(['api:startWorldMarch', options.missionId, host.state.worldExplorerState.activeMission?.id || '']);
          assert.equal(options.missionId, 'march-parked');
          return {
            success: true,
            message: 'Explorer mission started.',
            gameState: {
              ...host.state,
              worldExplorerState: {
                missions: [{
                  ...parkedMission,
                  status: 'active',
                  origin: { q: 7, r: -2, tileId: 'tile_7_-2' },
                  position: { q: 7, r: -2, tileId: 'tile_7_-2' },
                  target: { q: 9, r: -2, tileId: 'tile_9_-2' },
                  route: [
                    { q: 8, r: -2, step: 1, tileId: 'tile_8_-2', revealed: false, revealedAt: null },
                    { q: 9, r: -2, step: 2, tileId: 'tile_9_-2', revealed: false, revealedAt: null },
                  ],
                  plannedTiles: [],
                  plannedSites: [],
                }],
                activeMission: {
                  ...parkedMission,
                  status: 'active',
                  origin: { q: 7, r: -2, tileId: 'tile_7_-2' },
                  position: { q: 7, r: -2, tileId: 'tile_7_-2' },
                  target: { q: 9, r: -2, tileId: 'tile_9_-2' },
                  route: [
                    { q: 8, r: -2, step: 1, tileId: 'tile_8_-2', revealed: false, revealedAt: null },
                    { q: 9, r: -2, step: 2, tileId: 'tile_9_-2', revealed: false, revealedAt: null },
                  ],
                  plannedTiles: [],
                  plannedSites: [],
                },
                idleMissions: [],
              },
            },
            tutorial: {},
          };
        },
      };
    },
    render() {
      calls.push(['render']);
    },
    renderCanvasSurface(tab) {
      calls.push(['renderCanvasSurface', tab, this.state.worldExplorerState.activeMission?.id || '']);
    },
    showFloatingText(message) {
      calls.push(['showFloatingText', message]);
    },
    log(message) {
      calls.push(['log', message]);
    },
    tutorialController: {
      sync() {},
      onExploreStarted() {},
    },
  });

  assert.equal(await host.startWorldMarch({
    missionId: 'march-parked',
    cityId: 'capital',
    formationSlot: 1,
    targetQ: 9,
    targetR: -2,
  }), true);

  const missionIds = host.state.worldExplorerState.missions.map((mission) => mission.id);
  assert.deepEqual(missionIds, ['march-parked']);
  assert.equal(host.state.worldExplorerState.activeMission.origin.tileId, 'tile_7_-2');
  assert.equal(missionIds.some((id) => id.startsWith('optimistic_manual_')), false);
  assert.equal(calls.some((call) => call[0] === 'api:startWorldMarch' && call[1] === 'march-parked' && call[2] === 'march-parked'), true);
});

test('CanvasGameApp applies world march verification pullback overlay from heartbeat', () => {
  const calls = [];
  const host = makeAppHost({
    state: { currentTab: 'military' },
    networkState: { status: 'online', failureCount: 0 },
    renderCanvasSurface(tab) {
      calls.push(['render', tab]);
    },
    ensureWorldClock() {
      return null;
    },
  });

  host.applyHeartbeat({
    type: 'heartbeat',
    serverTime: '2026-06-21T00:00:02.000Z',
    heartbeatSeq: 2,
    worldMarchVerification: {
      status: 'pullback',
      results: [{ missionId: 'march-1', severity: 'large' }],
    },
  });

  assert.equal(host.networkState.status, 'reconnecting');
  assert.equal(host.networkState.message, '网络连接缓慢，正在尝试同步');
  assert.equal(host.networkState.worldMarchReconciliation.status, 'pullback');
  assert.deepEqual(calls, [['render', 'military']]);
});

test('CanvasGameApp clears quiet world march verification heartbeat without overlay', () => {
  const host = makeAppHost({
    state: { currentTab: 'military' },
    networkState: {
      status: 'reconnecting',
      failureCount: 1,
      message: '网络连接缓慢，正在尝试同步',
    },
    renderCanvasSurface() {},
    ensureWorldClock() {
      return null;
    },
  });

  host.applyHeartbeat({
    type: 'heartbeat',
    serverTime: '2026-06-21T00:00:03.000Z',
    heartbeatSeq: 3,
    worldMarchVerification: {
      status: 'ok',
      results: [],
    },
  });

  assert.equal(host.networkState.status, 'online');
  assert.equal(host.networkState.message, null);
  assert.equal(host.networkState.failureCount, 0);
});

test('CanvasGameApp routes active march animation to actor loop instead of map water timer redraw', () => {
  const calls = [];
  let intervalCallback = null;
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    initialState: {
      currentTab: 'military',
      militaryView: 'world',
      worldExplorerState: {
        activeMission: { id: 'march-1', status: 'active' },
      },
    },
    scheduler: {
      setInterval(callback, ms) {
        intervalCallback = callback;
        calls.push(['setInterval', ms]);
        return 1;
      },
      clearInterval() {},
    },
  });
  app.activeTab = 'military';
  app.militaryView = 'world';
  app.mapHomeActive = true;
  app.getActiveTab = () => 'military';
  app.getWorldEpochNowMs = () => 1000;
  app.getWorldTileWaterAnimationFrameMs = () => 125;
  app.isWorldMapDragging = () => false;
  app.isWorldMapDragCoolingDown = () => false;
  app.isWorldMapHomeActive = () => true;
  app.renderRuntimeWorldMap = () => {
    calls.push(['renderRuntimeWorldMap']);
    return true;
  };
  app.renderAnimationFrame = () => {
    calls.push(['renderAnimationFrame']);
    return true;
  };
  app.updateWorldActorAnimationLoop = (options) => {
    calls.push(['updateWorldActorAnimationLoop', options.epochNowMs]);
    return true;
  };
  app.renderer = {
    worldActorLayerRenderer: {},
  };

  assert.equal(app.startTileMapWaterTimer(), true);
  intervalCallback();

  assert.deepEqual(calls, [
    ['setInterval', 125],
    ['updateWorldActorAnimationLoop', 1000],
  ]);
});

// Characterization tests for the scout-countdown / tile-map-water timer lifecycles
// (god-file re-decomposition slice 7). Written against the pre-extraction
// CanvasGameApp bodies and kept UNCHANGED through the ScoutCountdownTimer /
// TileMapWaterAnimationTimer extraction.
test('startScoutCountdownTimer arms a 1s interval that re-renders military and active conquests', () => {
  const calls = [];
  let intervalCallback = null;
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    scheduler: {
      setInterval(callback, ms) {
        intervalCallback = callback;
        calls.push(['setInterval', ms]);
        return 7;
      },
      clearInterval(handle) {
        calls.push(['clearInterval', handle]);
      },
    },
  });
  app.renderCanvasSurface = (tab) => {
    calls.push(['renderCanvasSurface', tab]);
    return true;
  };
  app.renderTerritory = () => {
    calls.push(['renderTerritory']);
    return true;
  };

  app.startScoutCountdownTimer();
  app.startScoutCountdownTimer();
  assert.deepEqual(calls, [['setInterval', 1000]]);

  app.state = { currentTab: 'military', currentEra: 5 };
  intervalCallback();
  assert.deepEqual(calls.at(-1), ['renderCanvasSurface', 'military']);

  app.state = { currentTab: 'military', currentEra: 0 };
  intervalCallback();
  assert.deepEqual(calls.at(-1), ['renderCanvasSurface', 'military']);
  assert.equal(calls.length, 2);

  app.state = { currentTab: 'military', currentEra: 5 };
  app.canvasShell = { isWorldMapDragging: () => true };
  intervalCallback();
  assert.equal(calls.length, 2);

  app.canvasShell = null;
  app.state = {
    currentTab: 'territory',
    currentEra: 5,
    territoryState: { territories: [{ mission: { status: 'active' } }, {}] },
  };
  intervalCallback();
  assert.deepEqual(calls.at(-1), ['renderTerritory']);

  app.syncService = null;
  app.updateChecker = null;
  app.stopHeartbeat();
  assert.deepEqual(calls.at(-1), ['clearInterval', 7]);

  app.startScoutCountdownTimer();
  assert.deepEqual(calls.at(-1), ['setInterval', 1000]);
});

test('tileMapWaterTimer lifecycle: no double-arm, tick self-stops off military, stop re-arms', () => {
  const calls = [];
  let intervalCallback = null;
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    scheduler: {
      setInterval(callback, ms) {
        intervalCallback = callback;
        calls.push(['setInterval', ms]);
        return 3;
      },
      clearInterval(handle) {
        calls.push(['clearInterval', handle]);
      },
    },
  });
  app.getWorldTileWaterAnimationFrameMs = () => 125;

  assert.equal(app.startTileMapWaterTimer(), true);
  assert.equal(app.startTileMapWaterTimer(), false);
  assert.deepEqual(calls, [['setInterval', 125]]);

  app.state = { currentTab: 'resources' };
  app.activeTab = 'resources';
  intervalCallback();
  assert.deepEqual(calls, [
    ['setInterval', 125],
    ['clearInterval', 3],
  ]);

  assert.equal(app.startTileMapWaterTimer(), true);
  app.stopTileMapWaterTimer();
  app.stopTileMapWaterTimer();
  assert.deepEqual(calls.slice(2), [
    ['setInterval', 125],
    ['clearInterval', 3],
  ]);
});

test('CanvasGameApp keeps active march animation from forcing map layer redraw', () => {
  const calls = [];
  const runtime = {
    hasBakedMapLayer: true,
    isBakedLayerStateValid() {
      return true;
    },
    getWorldMapFrameState(options) {
      calls.push(['getWorldMapFrameState', options.rendered]);
      return { visualLayerValid: true, hitTargets: [] };
    },
  };
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    renderer: {
      worldActorLayerRenderer: {},
      render(state, options) {
        calls.push(['render', options.skipWorldMapLayer, options.preserveCanvas]);
      },
    },
    worldMapRuntime: runtime,
    initialState: {
      currentTab: 'military',
      militaryView: 'world',
      territoryState: { worldMap: { tiles: [{ id: 'tile_0_0' }] } },
      worldExplorerState: {
        activeMission: { id: 'march-1', status: 'active' },
      },
    },
  });
  app.activeTab = 'military';
  app.militaryView = 'world';
  app.mapHomeActive = true;
  app.worldMapRuntime = runtime;
  app.worldMapRuntimeCoordinator = {
    canRender() {
      return true;
    },
    getMapRuntime() {
      return runtime;
    },
    render() {
      calls.push(['runtimeRender']);
      return true;
    },
  };
  app.shouldRenderRuntimeWorldMap = () => false;
  app.updateWorldActorAnimationLoop = () => {
    calls.push(['updateWorldActorAnimationLoop']);
    return true;
  };
  app.startTileMapWaterTimer = () => {
    calls.push(['startTileMapWaterTimer']);
    return true;
  };
  app.stopTileMapWaterTimer = () => {
    calls.push(['stopTileMapWaterTimer']);
  };

  assert.equal(app.renderCanvasSurface('military'), true);
  assert.deepEqual(calls, [
    ['getWorldMapFrameState', true],
    ['render', true, true],
    ['updateWorldActorAnimationLoop'],
    ['stopTileMapWaterTimer'],
  ]);
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

test('CanvasGameApp routes battleScene replay overlay through BattleStore', () => {
  BattleStore.closeBattleScene();
  BattleStore.closeEntityBattle();
  const calls = [];
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    renderer: {
      render(_state, options) {
        calls.push(['render', options.battleScene?.report?.id || '', options.battleScene?.turnIndex]);
      },
    },
    scheduler: {
      setTimeout() {
        return 1;
      },
      clearTimeout() {},
      setInterval() {
        return 2;
      },
      clearInterval() {},
    },
    initialState: { currentTab: 'military', militaryView: 'army' },
  });
  app.now = () => 100;

  assert.equal(app.startBattleScene({ id: 'report-owner', turns: [{ action: 'attack' }] }), true);

  assert.equal(BattleStore.getActiveOverlay(), 'battleScene');
  assert.equal(BattleStore.getBattleScene().report.id, 'report-owner');
  assert.equal(app.getRendererSnapshot().battle.battleScene.report.id, 'report-owner');
  assert.equal(Object.prototype.hasOwnProperty.call(app, 'battleScene'), false);
  assert.deepEqual(calls.at(-1), ['render', 'report-owner', 0]);

  app.now = () => 250;
  assert.equal(app.skipBattleScene(), true);
  assert.equal(BattleStore.getBattleScene().turnIndex, 1);
  BattleStore.closeBattleScene();
});

// Characterization tests for the tutorial-highlight lifecycle (god-file
// re-decomposition slice 10). Written against the pre-extraction bodies and kept
// UNCHANGED through the TutorialGuideUiController extraction. The shell-side
// show/hide machinery is already pinned by the CanvasGameShell.test.js suite.
test('hideGuideHighlight forwards to the shell hide and reports its result', () => {
  const calls = [];
  const host = makeAppHost({
    state: { currentTab: 'military' },
    canvasShell: {
      hideTutorialHighlight() {
        calls.push(['hideTutorialHighlight']);
        return true;
      },
    },
    renderCanvasSurface(tab) {
      calls.push(['renderCanvasSurface', tab]);
    },
  });

  assert.equal(host.hideGuideHighlight(), true);
  assert.deepEqual(calls, [['hideTutorialHighlight']]);
});

test('hideGuideHighlight without a shell clears the highlight and re-renders once', () => {
  const calls = [];
  const host = makeAppHost({
    state: { currentTab: 'military' },
    canvasShell: null,
    tutorialHighlight: { rect: { left: 1, top: 2, width: 3, height: 4 } },
    renderCanvasSurface(tab) {
      calls.push(['renderCanvasSurface', tab]);
    },
  });

  assert.equal(host.hideGuideHighlight(), true);
  assert.equal(host.tutorialHighlight, null);
  assert.deepEqual(calls, [['renderCanvasSurface', 'military']]);
  assert.equal(host.hideGuideHighlight(), false);
  assert.equal(calls.length, 1);
});

test('showHouseBuiltAdvisorDialogue clears the tutorial highlight and opens the advisor dialogue', () => {
  const calls = [];
  const host = makeAppHost({
    state: { currentTab: 'buildings' },
    tutorialHighlight: { rect: { left: 1, top: 2, width: 3, height: 4 } },
    closeEventSnapshot() {},
    renderCanvasSurface(tab) {
      calls.push(['renderCanvasSurface', tab]);
    },
  });

  assert.equal(host.showHouseBuiltAdvisorDialogue(), true);
  assert.equal(host.tutorialHighlight, null);
  assert.equal(host.tutorialAdvisorDialogue.source, 'houseBuilt');
  assert.equal(host.state.softGuide.target, 'tab-civilization');
  assert.deepEqual(calls, [['renderCanvasSurface', 'buildings']]);
});

// Characterization tests for the turn-card battle-scene timer cluster (god-file
// re-decomposition slice 9). Written against the pre-extraction CanvasGameApp
// bodies and kept UNCHANGED through the BattleSceneController extraction.

function makeBattleSceneApp() {
  const timers = { timeoutCb: null, timeoutMs: [], intervalCb: null, cleared: [] };
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    renderer: { render() {} },
    scheduler: {
      setTimeout(callback, ms) {
        timers.timeoutCb = callback;
        timers.timeoutMs.push(ms);
        return 31;
      },
      clearTimeout(handle) {
        timers.cleared.push(['timeout', handle]);
      },
      setInterval(callback) {
        timers.intervalCb = callback;
        return 32;
      },
      clearInterval(handle) {
        timers.cleared.push(['interval', handle]);
      },
    },
    initialState: { currentTab: 'military', militaryView: 'army' },
  });
  app.now = () => 500;
  return { app, timers };
}

test('startBattleScene turn-card path arms the turn + animation timers with per-turn durations', () => {
  BattleStore.closeBattleScene();
  BattleStore.closeEntityBattle();
  const { app, timers } = makeBattleSceneApp();

  try {
    assert.equal(
      app.startBattleScene({
        id: 'r1',
        turns: [{ action: 'attack' }, { action: 'skill' }],
      }),
      true,
    );
    assert.equal(BattleStore.getBattleScene().turnDurationMs, 900);
    assert.deepEqual(timers.timeoutMs, [900]);

    // advance turn 0 -> 1: next turn is a skill -> 900 + 2200 cut-in.
    assert.equal(app.advanceBattleSceneTurn(), true);
    assert.equal(BattleStore.getBattleScene().turnIndex, 1);
    assert.equal(BattleStore.getBattleScene().turnDurationMs, 3100);
    assert.deepEqual(timers.timeoutMs, [900, 3100]);

    // advance past the last turn stops both timers.
    assert.equal(app.advanceBattleSceneTurn(), true);
    assert.equal(app.advanceBattleSceneTurn(), false);
    assert.deepEqual(timers.cleared.at(-2), ['timeout', 31]);
    assert.deepEqual(timers.cleared.at(-1), ['interval', 32]);
  } finally {
    BattleStore.closeBattleScene();
  }
});

test('battle animation timer renders while the scene is visible and self-stops after close', () => {
  BattleStore.closeBattleScene();
  BattleStore.closeEntityBattle();
  const { app, timers } = makeBattleSceneApp();
  const renders = [];
  app.renderAnimationFrame = (tab) => {
    renders.push(tab);
    return true;
  };

  try {
    app.startBattleScene({ id: 'r2', turns: [{ action: 'attack' }] });
    timers.intervalCb();
    assert.deepEqual(renders, ['military']);

    BattleStore.closeBattleScene();
    timers.intervalCb();
    assert.deepEqual(renders, ['military']);
    assert.deepEqual(timers.cleared.at(-1), ['interval', 32]);
  } finally {
    BattleStore.closeBattleScene();
  }
});

test('closeBattleScene stops both timers, clears the store scene, and re-renders', () => {
  BattleStore.closeBattleScene();
  BattleStore.closeEntityBattle();
  const { app, timers } = makeBattleSceneApp();
  const renders = [];
  app.renderCanvasSurface = (tab) => {
    renders.push(tab);
    return true;
  };

  try {
    app.startBattleScene({ id: 'r3', turns: [] });
    renders.length = 0;
    assert.equal(app.closeBattleScene(), true);
    assert.equal(BattleStore.getBattleScene(), null);
    assert.deepEqual(renders, ['military']);
    assert.deepEqual(timers.cleared, [
      ['timeout', 31],
      ['interval', 32],
    ]);
  } finally {
    BattleStore.closeBattleScene();
  }
});

test('startBattleScene prefers the entity replay overlay when the report carries a replay', () => {
  BattleStore.closeBattleScene();
  BattleStore.closeEntityBattle();
  const previousCore = global.BattleSimCore;
  global.BattleSimCore = { createBattle() {} };
  const { app } = makeBattleSceneApp();
  const opened = [];
  app.openEntityBattle = (opts) => {
    opened.push([opts.mode, opts.report.id]);
    return true;
  };

  try {
    assert.equal(
      app.startBattleScene({ id: 'r4', replay: { setup: { sides: [{}, {}] }, inputStream: [] } }),
      true,
    );
    assert.deepEqual(opened, [['replay', 'r4']]);
    assert.equal(BattleStore.getBattleScene(), null);
  } finally {
    global.BattleSimCore = previousCore;
    BattleStore.closeBattleScene();
  }
});

test('CanvasGameApp publishes the live entityBattle session into BattleStore', () => {
  BattleStore.closeBattleScene();
  BattleStore.closeEntityBattle();
  const previousCore = global.BattleSimCore;
  global.BattleSimCore = {
    createBattle() {
      return { config: { tickHz: 20 }, squads: { g1: { side: 0, generalId: 'u1' } }, units: { u1: { skills: [] } } };
    },
  };
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    renderer: { render() {} },
    scheduler: {
      setInterval() {
        return 1;
      },
      clearInterval() {},
    },
    initialState: { currentTab: 'military', militaryView: 'army' },
  });
  app.renderCanvasSurface = () => true;

  try {
    assert.equal(app.openEntityBattle({ setup: { sides: [{}, {}] }, battleId: 'battle-owner' }), true);
    assert.equal(app.entityBattle.battleId, 'battle-owner');
    // BattleStore holds the SAME live session object the app steps -- not a copy.
    assert.equal(BattleStore.getActiveOverlay(), 'entityBattle');
    assert.equal(BattleStore.getEntityBattle(), app.entityBattle);
    assert.equal(BattleStore.getEntityBattle().battleId, 'battle-owner');

    app.entityBattleSelectGeneral('g1');
    assert.equal(BattleStore.getEntityBattle().selectedGid, 'g1');
  } finally {
    global.BattleSimCore = previousCore;
    BattleStore.closeEntityBattle();
  }
});

// --- auto-engage: maybeAutoEnterEngagedBattle (connection point 1, 2026-07-05) ---

function makeEngagedMissionState({ status = 'idle', combatStatus = 'engaged', engagedAt = 't1' } = {}) {
  return {
    activeCityId: 'capital',
    worldExplorerState: {
      idleMissions: [
        {
          id: 'm1',
          status,
          position: { q: 2, r: -1 },
          formation: { cityId: 'capital', slot: 1 },
          combat: combatStatus
            ? { status: combatStatus, encounterId: 'enc1', engagedAt }
            : null,
        },
      ],
    },
  };
}

test('maybeAutoEnterEngagedBattle opens the interactive battle once per engagement', () => {
  const calls = [];
  const host = makeAppHost({
    entityBattleController: { session: null }, // no scene open
    enterInteractiveBattle(options) {
      calls.push(options);
      return Promise.resolve(true);
    },
  });
  const state = makeEngagedMissionState();

  assert.equal(host.maybeAutoEnterEngagedBattle(state), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].missionId, 'm1');
  assert.equal(calls[0].targetQ, 2);
  assert.equal(calls[0].targetR, -1);
  assert.equal(calls[0].engagement.encounterId, 'enc1');
  assert.equal(calls[0].engagement.engagedAt, 't1');

  // Same engagement on a re-sync: deduped, no second open.
  assert.equal(host.maybeAutoEnterEngagedBattle(state), false);
  assert.equal(calls.length, 1);
});

test('maybeAutoEnterEngagedBattle does not open while a battle scene is already open', () => {
  const calls = [];
  const host = makeAppHost({
    entityBattleController: { session: { visible: true } }, // a scene IS open
    enterInteractiveBattle(options) {
      calls.push(options);
      return Promise.resolve(true);
    },
  });
  assert.equal(host.maybeAutoEnterEngagedBattle(makeEngagedMissionState()), false);
  assert.equal(calls.length, 0);
});

test('maybeAutoEnterEngagedBattle ignores non-engaged and non-idle missions', () => {
  const calls = [];
  const host = makeAppHost({
    entityBattleController: { session: null },
    enterInteractiveBattle(options) {
      calls.push(options);
      return Promise.resolve(true);
    },
  });
  // marching (not engaged) -> ignored
  assert.equal(
    host.maybeAutoEnterEngagedBattle(makeEngagedMissionState({ combatStatus: 'marching' })),
    false,
  );
  // active (not idle) -> ignored
  assert.equal(
    host.maybeAutoEnterEngagedBattle(makeEngagedMissionState({ status: 'active' })),
    false,
  );
  assert.equal(calls.length, 0);
});

test('a dismissed engagement is not re-opened until a NEW engagement arrives', () => {
  const calls = [];
  const host = makeAppHost({
    entityBattleController: { session: null },
    enterInteractiveBattle(options) {
      calls.push(options);
      return Promise.resolve(true);
    },
  });
  // Player closed the retreat window for engagement (m1/enc1/t1) without resolving.
  host.markEngagementDismissed('m1', 'enc1', 't1');
  assert.equal(host.maybeAutoEnterEngagedBattle(makeEngagedMissionState({ engagedAt: 't1' })), false);
  assert.equal(calls.length, 0);

  // A fresh engagement (new engagedAt) re-opens.
  assert.equal(host.maybeAutoEnterEngagedBattle(makeEngagedMissionState({ engagedAt: 't2' })), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].engagement.engagedAt, 't2');
});

// Characterization tests for the entity-battle session cluster (god-file
// re-decomposition slice 8). Written against the pre-extraction CanvasGameApp
// bodies and kept UNCHANGED through the EntityBattleController extraction.

function makeEntityBattleApp(overrides = {}) {
  const timers = { callback: null, cleared: [] };
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    renderer: { render() {} },
    scheduler: {
      setInterval(callback) {
        timers.callback = callback;
        return 11;
      },
      clearInterval(handle) {
        timers.cleared.push(handle);
      },
    },
    initialState: { currentTab: 'military', militaryView: 'army' },
    ...overrides,
  });
  app.renderCanvasSurface = () => true;
  app.renderAnimationFrame = () => true;
  return { app, timers };
}

function makeSimCoreStub(steps, { endAtTick = Infinity } = {}) {
  return {
    createBattle() {
      return {
        config: { tickHz: 20 },
        tick: 0,
        squads: { g1: { side: 0, generalId: 'u1' }, g2: { side: 1, generalId: 'u2' } },
        units: { u1: { skills: [{ id: 'sk1' }] }, u2: { skills: [] } },
        result: null,
      };
    },
    step(battle, ins) {
      steps.push(ins.map((entry) => entry.type || entry.order || 'unknown'));
      battle.tick += 1;
      if (battle.tick >= endAtTick) battle.result = { winner: 'attacker' };
    },
  };
}

test('entityBattle interactive tick steps queued player + AI inputs and resolves on end', async () => {
  BattleStore.closeBattleScene();
  BattleStore.closeEntityBattle();
  const previousCore = global.BattleSimCore;
  const previousAI = global.BattleAI;
  const steps = [];
  global.BattleSimCore = makeSimCoreStub(steps, { endAtTick: 2 });
  global.BattleAI = {
    decideSideOrders() {
      return [{ type: 'ai-order' }];
    },
  };
  const { app, timers } = makeEntityBattleApp();
  let nowMs = 1000;
  app.now = () => nowMs;
  const resolveCalls = [];

  try {
    assert.equal(
      app.openEntityBattle({
        setup: { sides: [{}, {}] },
        battleId: 'battle-live',
        onResolve: async (payload) => {
          resolveCalls.push(payload);
          return { winner: 'defender', result: { loot: 1 } };
        },
      }),
      true,
    );
    assert.equal(app.entityBattle.mode, 'interactive');

    assert.equal(app.entityBattleOrder('g1', 'charge'), true);

    timers.callback();
    nowMs = 1050;
    timers.callback();
    assert.deepEqual(steps, [['order', 'ai-order']]);
    assert.equal(app.entityBattle.ended, false);

    nowMs = 1100;
    timers.callback();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(app.entityBattle.ended, true);
    assert.equal(resolveCalls.length, 1);
    assert.equal(resolveCalls[0].battleId, 'battle-live');
    assert.equal(resolveCalls[0].inputStream.length >= 2, true);
    assert.equal(app.entityBattle.resultWinner, 'defender');
    assert.deepEqual(app.entityBattle.serverResult, { loot: 1 });
    assert.equal(app.entityBattle.statusColor, '#f85149');
    assert.deepEqual(timers.cleared, [11]);
  } finally {
    global.BattleSimCore = previousCore;
    global.BattleAI = previousAI;
    BattleStore.closeEntityBattle();
  }
});

test('entityBattle replay tick feeds recorded inputs by tick and ends from the report result', () => {
  BattleStore.closeBattleScene();
  BattleStore.closeEntityBattle();
  const previousCore = global.BattleSimCore;
  const steps = [];
  global.BattleSimCore = makeSimCoreStub(steps, { endAtTick: 1 });
  const { app, timers } = makeEntityBattleApp();
  let nowMs = 1000;
  app.now = () => nowMs;

  try {
    assert.equal(
      app.openEntityBattle({
        setup: { sides: [{}, {}] },
        mode: 'replay',
        inputStream: [{ tick: 0, type: 'order' }],
        report: { result: 'victory' },
      }),
      true,
    );
    assert.equal(app.entityBattle.mode, 'replay');

    timers.callback();
    nowMs = 1050;
    timers.callback();
    assert.deepEqual(steps, [['order']]);
    assert.equal(app.entityBattle.ended, true);
    assert.equal(app.entityBattle.statusColor, '#3fb950');
    assert.deepEqual(timers.cleared, [11]);
  } finally {
    global.BattleSimCore = previousCore;
    BattleStore.closeEntityBattle();
  }
});

test('closeEntityBattle stops the timer, clears the store, and prefers onClose over render', () => {
  BattleStore.closeBattleScene();
  BattleStore.closeEntityBattle();
  const previousCore = global.BattleSimCore;
  global.BattleSimCore = makeSimCoreStub([]);
  const { app, timers } = makeEntityBattleApp();
  const calls = [];
  app.renderCanvasSurface = () => {
    calls.push(['render']);
    return true;
  };

  try {
    app.openEntityBattle({
      setup: { sides: [{}, {}] },
      onClose: () => calls.push(['onClose']),
    });
    calls.length = 0;
    assert.equal(app.closeEntityBattle(), true);
    assert.equal(app.entityBattle, null);
    assert.equal(BattleStore.getEntityBattle(), null);
    assert.deepEqual(calls, [['onClose']]);
    assert.deepEqual(timers.cleared, [11]);

    app.openEntityBattle({ setup: { sides: [{}, {}] } });
    calls.length = 0;
    assert.equal(app.closeEntityBattle(), true);
    assert.deepEqual(calls, [['render']]);
  } finally {
    global.BattleSimCore = previousCore;
    BattleStore.closeEntityBattle();
  }
});

test('entityBattle camera zoom and drag route through BattleCameraPolicy', () => {
  BattleStore.closeBattleScene();
  BattleStore.closeEntityBattle();
  const previousCore = global.BattleSimCore;
  const previousPolicy = global.BattleCameraPolicy;
  global.BattleSimCore = makeSimCoreStub([]);
  global.BattleCameraPolicy = {
    createCamera() {
      return { zoom: 1, offsetX: 0, offsetY: 0 };
    },
    zoomAt(camera, _fit, _point, scaleDelta) {
      return { ...camera, zoom: camera.zoom * scaleDelta };
    },
    panBy(camera, _fit, dx, dy) {
      return { ...camera, offsetX: camera.offsetX + dx, offsetY: camera.offsetY + dy };
    },
  };
  const { app } = makeEntityBattleApp();

  try {
    app.openEntityBattle({ setup: { sides: [{}, {}] } });
    assert.equal(app.entityBattleZoom({ scaleDelta: 2 }), false);
    app.entityBattle._viewFit = { scale: 1 };
    assert.equal(app.entityBattleZoom({ centerX: 10, centerY: 20, scaleDelta: 2, deltaX: 5 }), true);
    assert.equal(app.entityBattle.camera.zoom, 2);
    assert.equal(app.entityBattle.camera.offsetX, 5);

    assert.equal(app.entityBattleDrag('start', { x: 100, y: 50 }), true);
    assert.equal(app.entityBattleDrag('move', { x: 110, y: 45 }), true);
    assert.equal(app.entityBattle.camera.offsetX, 15);
    assert.equal(app.entityBattle.camera.offsetY, -5);
    app.entityBattleDrag('end', { x: 110, y: 45 });
    assert.equal(app.entityBattle._dragLast, null);
  } finally {
    global.BattleSimCore = previousCore;
    global.BattleCameraPolicy = previousPolicy;
    BattleStore.closeEntityBattle();
  }
});

test('toggleEntityBattleAuto flips side-0 skills and issueEntityInput guards replay/ended', () => {
  BattleStore.closeBattleScene();
  BattleStore.closeEntityBattle();
  const previousCore = global.BattleSimCore;
  global.BattleSimCore = makeSimCoreStub([]);
  const { app } = makeEntityBattleApp();

  try {
    app.openEntityBattle({ setup: { sides: [{}, {}] } });
    assert.equal(app.toggleEntityBattleAuto(), true);
    assert.equal(app.entityBattle.auto, true);
    assert.equal(app.entityBattle.battle.auto, true);
    assert.equal(app.entityBattle.battle.units.u1.skills[0].auto, true);

    assert.equal(app.entityBattleSkill('g1', 'sk1'), true);
    assert.equal(app.entityBattle.inputStream.at(-1).skillId, 'sk1');
    assert.equal(app.entityBattleMaster('retreat'), true);
    assert.equal(app.entityBattle.inputStream.at(-1).side, 0);

    app.entityBattle.ended = true;
    assert.equal(app.entityBattleOrder('g1', 'charge'), false);

    app.closeEntityBattle();
    app.openEntityBattle({ setup: { sides: [{}, {}] }, mode: 'replay', inputStream: [] });
    assert.equal(app.issueEntityInput({ type: 'order' }), false);
  } finally {
    global.BattleSimCore = previousCore;
    BattleStore.closeEntityBattle();
  }
});
