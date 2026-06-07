const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasGameShell = require('./CanvasGameShell');

const SHELL_MODULES = [
  'CanvasGameShellMounting',
  'CanvasGameShellInputRouter',
  'CanvasGameShellCommands',
  'CanvasGameShellGuideUi',
  'CanvasGameShellWorldMapRuntime',
  'CanvasGameShellRenderingRuntime',
  'CanvasGameShellSystemUi',
];

test('CanvasGameShell installs responsibility modules into the compatibility facade', () => {
  const proto = CanvasGameShell.prototype;
  const expectedMethods = {
    mounting: ['createRenderer', 'mount'],
    inputRouter: ['bindInput', 'handleTap', 'handleDrag', 'handleGesture'],
    commands: ['openCityManagement', 'openArmyFormation', 'forwardCanvasAction', 'closeWorldSiteHud'],
    guideUi: ['getCanvasTarget', 'showTutorialHighlight', 'hideTutorialHighlight'],
    worldMapRuntime: ['ensureWorldMapRuntime', 'renderWorldMapLayer', 'requestWorldMapRenderAnimationFrame'],
    renderingRuntime: ['renderActive', 'renderReadOnly', 'buildRenderOptions', 'setTechTreeZoom'],
    systemUi: ['applyAuthShell', 'showLoading', 'setNetworkState', 'startBattleScene'],
  };

  Object.entries(expectedMethods).forEach(([group, methods]) => {
    methods.forEach((method) => {
      assert.equal(typeof proto[method], 'function', `${group}.${method} should be installed`);
    });
  });
});

test('index.html loads CanvasGameShell modules before the facade', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
  const facadePosition = html.indexOf('CanvasGameShell.js');
  assert.notEqual(facadePosition, -1);

  SHELL_MODULES.forEach((moduleName) => {
    const modulePosition = html.indexOf(`${moduleName}.js`);
    assert.notEqual(modulePosition, -1, `${moduleName}.js should be loaded`);
    assert.equal(modulePosition < facadePosition, true, `${moduleName}.js should load before CanvasGameShell.js`);
  });
});

test('CanvasGameShell refreshes tutorial highlight after naming input is filled', async () => {
  const calls = [];
  const game = {
    tutorialController: {
      refreshCurrentHighlight() {
        calls.push(['refreshCurrentHighlight']);
        return true;
      },
    },
  };
  const shell = new CanvasGameShell({
    runtime: {
      requestTextInput() {
        calls.push(['requestTextInput']);
        return Promise.resolve('River City');
      },
      setTimeout(callback, delayMs) {
        calls.push(['setTimeout', delayMs]);
        callback();
      },
    },
  });
  shell.lastGame = game;
  shell.naming = {
    visible: true,
    view: { title: 'Name city', maxLength: 12 },
    inputValue: '',
    submitting: false,
  };
  shell.renderActive = () => {
    calls.push(['renderActive', shell.naming.inputValue]);
    return true;
  };

  assert.equal(shell.requestNamingInput(), true);
  await Promise.resolve();

  assert.equal(shell.naming.inputValue, 'River City');
  assert.deepEqual(calls, [
    ['requestTextInput'],
    ['renderActive', 'River City'],
    ['setTimeout', 0],
    ['refreshCurrentHighlight'],
  ]);
});

test('CanvasGameShell preserves world map layer when drag snapshot refresh misses', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    runtime: {
      setLayerTranslate(layer, x, y) {
        calls.push(['setLayerTranslate', layer, x, y]);
        return true;
      },
    },
    renderer: {},
  });
  shell.worldMapRuntime = {
    getCameraOffsetFromBaked() {
      return { x: 32, y: -18 };
    },
  };
  shell.refreshWorldMapLayerFromSnapshot = (options) => {
    calls.push(['refreshWorldMapLayerFromSnapshot', options]);
    return false;
  };

  const offset = shell.updateWorldMapDragCompositor();

  const refresh = calls.find((call) => call[0] === 'refreshWorldMapLayerFromSnapshot');
  assert.equal(refresh[1].commitCamera, false);
  assert.equal(refresh[1].clearTransform, false);
  assert.equal(refresh[1].preserveOnMiss, true);
  assert.deepEqual(offset, { x: 32, y: -18 });
  assert.equal(calls.some((call) => JSON.stringify(call) === JSON.stringify(['setLayerTranslate', 'worldMap', 32, -18])), true);
  assert.equal(calls.some((call) => JSON.stringify(call) === JSON.stringify(['setLayerTranslate', 'worldFog', 32, -18])), true);
});

test('CanvasGameShell passes runtime frame time into render options', () => {
  const shell = new CanvasGameShell({
    runtime: {
      now() {
        return 4321.25;
      },
    },
  });
  shell.lastGame = {
    state: { currentTab: 'military', militaryView: 'world' },
    mapHomeActive: true,
    tutorial: {},
  };

  const options = shell.buildRenderOptions('military', {});

  assert.equal(options.now, 4321.25);
});

test('CanvasGameShell treats tutorial advisor dialogue as a blocking overlay', () => {
  const shell = new CanvasGameShell({});

  shell.tutorialAdvisorDialogue = { source: 'houseBuilt' };
  assert.equal(shell.hasBlockingOverlayOpen(), true);
  assert.equal(shell.hasBlockingOverlayExceptTechTree(), true);

  shell.tutorialAdvisorDialogue = null;
  shell.lastGame = { tutorialAdvisorDialogue: { source: 'houseBuilt' } };
  assert.equal(shell.hasBlockingOverlayOpen(), true);
  assert.equal(shell.hasBlockingOverlayExceptTechTree(), true);
});

test('CanvasGameShell routes unobstructed world map tile taps through runtime actions', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget(point) {
        calls.push(['rendererHit', point.x, point.y]);
        return null;
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.targetQ, action.targetR]);
        return true;
      },
    },
  });
  shell.lastGame = {
    state: {
      currentTab: 'military',
      militaryView: 'world',
      territoryState: { worldMap: { tiles: [{ id: 'tile_1_1', q: 1, r: 1 }] } },
    },
    mapHomeActive: true,
    getActiveTab() {
      return 'military';
    },
  };
  shell.hasBlockingOverlayOpen = () => false;
  shell.ensureWorldMapRuntimeCoordinator = () => ({
    handleTap(point, event) {
      calls.push(['runtimeTap', point.x, point.y, Boolean(event)]);
      return shell.actionController.handle({ type: 'selectWorldMarchTarget', targetQ: 1, targetR: 1 });
    },
    getMapRuntime() {
      return { hitTargets: [] };
    },
  });

  assert.equal(shell.handleTap({ x: 200, y: 360 }, {}), true);
  assert.deepEqual(calls, [
    ['rendererHit', 200, 360],
    ['runtimeTap', 200, 360, true],
    ['handle', 'selectWorldMarchTarget', 1, 1],
  ]);
});

test('CanvasGameShell routes foreground world map drag background taps through runtime actions', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget(point) {
        calls.push(['rendererHit', point.x, point.y]);
        return { type: 'worldMapDrag', background: true };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.targetQ, action.targetR]);
        return true;
      },
    },
  });
  shell.lastGame = {
    state: {
      currentTab: 'military',
      militaryView: 'world',
      territoryState: { worldMap: { tiles: [{ id: 'tile_1_1', q: 1, r: 1 }] } },
    },
    mapHomeActive: true,
    getActiveTab() {
      return 'military';
    },
  };
  shell.closeWorldSiteHud = () => {
    calls.push(['closeWorldSiteHud']);
    return true;
  };
  shell.ensureWorldMapRuntimeCoordinator = () => ({
    handleTap(point, event) {
      calls.push(['runtimeTap', point.x, point.y, Boolean(event)]);
      return shell.actionController.handle({ type: 'selectWorldMarchTarget', targetQ: 1, targetR: 1 });
    },
    getMapRuntime() {
      return { hitTargets: [] };
    },
  });

  assert.equal(shell.handleTap({ x: 210, y: 372 }, {}), true);
  assert.deepEqual(calls, [
    ['rendererHit', 210, 372],
    ['runtimeTap', 210, 372, true],
    ['handle', 'selectWorldMarchTarget', 1, 1],
  ]);
});

test('CanvasGameShell routes world map HUD taps before closing existing map HUD state', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget(point) {
        calls.push(['rendererHit', point.x, point.y]);
        return null;
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.targetQ, action.targetR]);
        return true;
      },
    },
  });
  shell.lastGame = {
    state: {
      currentTab: 'military',
      militaryView: 'world',
      territoryState: { worldMap: { tiles: [{ id: 'tile_1_1', q: 1, r: 1 }] } },
    },
    mapHomeActive: true,
    getActiveTab() {
      return 'military';
    },
  };
  shell.closeWorldSiteHud = () => {
    calls.push(['closeWorldSiteHud']);
    return true;
  };
  shell.ensureWorldMapRuntimeCoordinator = () => ({
    handleTap(point) {
      calls.push(['runtimeTap', point.x, point.y]);
      return shell.actionController.handle({ type: 'openWorldMarchFormationPicker', targetQ: 1, targetR: 1 });
    },
    getMapRuntime() {
      return { hitTargets: [] };
    },
  });

  assert.equal(shell.handleTap({ x: 232, y: 330 }, {}), true);
  assert.deepEqual(calls, [
    ['rendererHit', 232, 330],
    ['runtimeTap', 232, 330],
    ['handle', 'openWorldMarchFormationPicker', 1, 1],
  ]);
});

test('CanvasGameShell can render resources without default map-home coercion', () => {
  const calls = [];
  const state = {
    currentTab: 'military',
    militaryView: 'world',
    territoryState: { worldMap: { tiles: [{ id: 'tile_0_0' }] } },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    renderer: {
      render(renderState, options) {
        calls.push(['render', renderState.currentTab, options.activeTab, options.isMapHome]);
      },
    },
  });
  shell.lastGame = {
    state,
    mapHomeActive: true,
    tutorial: {},
  };
  shell.setWorldMapLayerVisible = () => {};
  shell.renderWorldMapLayer = () => false;

  assert.equal(shell.renderReadOnly(state, 'resources', { forceMapHome: false, allowDefaultMapHome: false }), true);

  assert.deepEqual(calls.at(-1), ['render', 'resources', 'resources', false]);
  assert.equal(state.currentTab, 'resources');
  assert.equal(state.militaryView, 'army');
  assert.equal(shell.mapHomeActive, false);
});

test('CanvasGameShell routes map command tech tree drag through command panel hit target', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      hitTargets: [
        { x: 40, y: 360, width: 300, height: 240, action: { type: 'techTreeDrag', background: true } },
      ],
      getHitTarget(point) {
        calls.push(['getHitTarget', point.x, point.y]);
        return { type: 'blockCanvasModal' };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.phase]);
        return true;
      },
    },
  });
  shell.lastGame = {
    state: { currentTab: 'military', militaryView: 'world' },
    mapHomeActive: true,
    getActiveTab() {
      return 'military';
    },
  };
  shell.activeCommandPanel = 'tech';

  assert.equal(shell.handleDrag('start', { x: 120, y: 420 }, {}), true);
  assert.equal(shell.handleDrag('move', { x: 150, y: 460 }, {}), true);
  assert.equal(shell.handleDrag('end', { x: 150, y: 460 }, {}), true);

  assert.deepEqual(
    calls.filter((call) => call[0] === 'handle'),
    [
      ['handle', 'techTreeDrag', 'start'],
      ['handle', 'techTreeDrag', 'move'],
      ['handle', 'techTreeDrag', 'end'],
    ],
  );
  assert.equal(calls.some((call) => call[0] === 'getHitTarget'), false);
});

test('CanvasGameShell routes map command tech tree wheel zoom at tree hit target', () => {
  const calls = [];
  const event = {
    preventDefault() {
      calls.push(['preventDefault']);
    },
    stopPropagation() {
      calls.push(['stopPropagation']);
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      hitTargets: [
        { x: 40, y: 360, width: 300, height: 240, action: { type: 'techTreeDrag', background: true } },
      ],
      getHitTarget(point) {
        calls.push(['getHitTarget', point.x, point.y]);
        return { type: 'blockCanvasModal' };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.gesture.scaleDelta]);
        return true;
      },
    },
  });
  shell.lastGame = {
    state: { currentTab: 'military', militaryView: 'world' },
    mapHomeActive: true,
    getActiveTab() {
      return 'military';
    },
  };
  shell.activeCommandPanel = 'tech';

  assert.equal(shell.handleGesture({ type: 'wheelZoom', scaleDelta: 1.1, centerX: 180, centerY: 520 }, event), true);

  assert.deepEqual(calls, [
    ['handle', 'techTreeZoom', 1.1],
    ['preventDefault'],
    ['stopPropagation'],
  ]);
});

test('CanvasGameShell resolves guide targets in rendered hit order', () => {
  const shell = new CanvasGameShell({
    renderer: {
      hitTargets: [
        { x: 0, y: 0, width: 420, height: 747, action: { type: 'closeFamousPersons', background: true } },
        { x: 24, y: 64, width: 58, height: 30, action: { type: 'closeFamousPersons' } },
      ],
    },
  });

  const target = shell.getCanvasTarget('closeFamousPersons');

  assert.equal(target.x, 24);
  assert.equal(target.y, 64);
  assert.equal(target.width, 58);
  assert.equal(target.height, 30);
  assert.deepEqual(target.action, { type: 'closeFamousPersons' });
});

test('CanvasGameShell closeFamousPersons syncs game state and resumes tutorial', () => {
  const calls = [];
  const game = {
    showFamousPersons: true,
    famousPersonsPage: 2,
    selectedFamousPersonId: 'fp-scout',
    tutorialController: {
      onFamousPersonsClosed() {
        calls.push(['onFamousPersonsClosed']);
      },
    },
  };
  const shell = new CanvasGameShell({
    renderer: {
      clearFamousSkillTooltip() {
        calls.push(['clearFamousSkillTooltip']);
      },
    },
  });
  shell.lastGame = game;
  shell.showFamousPersons = true;
  shell.famousPersonsPage = 1;
  shell.selectedFamousPersonId = 'fp-scout';

  assert.equal(shell.closeFamousPersons(), true);

  assert.equal(shell.showFamousPersons, false);
  assert.equal(shell.famousPersonsPage, 0);
  assert.equal(shell.selectedFamousPersonId, '');
  assert.equal(game.showFamousPersons, false);
  assert.equal(game.famousPersonsPage, 0);
  assert.equal(game.selectedFamousPersonId, '');
  assert.deepEqual(calls, [['clearFamousSkillTooltip'], ['onFamousPersonsClosed']]);
});

test('CanvasGameShell action controller advances tutorial after closeFamousPersons tap', () => {
  const calls = [];
  const game = {
    showFamousPersons: true,
    famousPersonsPage: 2,
    selectedFamousPersonId: 'fp-scout',
    tutorialController: {
      onFamousPersonsClosed() {
        calls.push(['onFamousPersonsClosed']);
      },
      refreshCurrentHighlight() {
        calls.push(['refreshCurrentHighlight']);
      },
    },
  };
  const shell = new CanvasGameShell({
    runtime: {
      setTimeout(callback, delayMs) {
        calls.push(['setTimeout', delayMs]);
        callback();
      },
    },
    renderer: {
      clearFamousSkillTooltip() {
        calls.push(['clearFamousSkillTooltip']);
      },
    },
  });
  shell.lastGame = game;
  shell.showFamousPersons = true;
  shell.famousPersonsPage = 1;
  shell.selectedFamousPersonId = 'fp-scout';
  shell.renderActive = () => {
    calls.push(['renderActive']);
    return true;
  };

  assert.equal(shell.actionController.handle({ type: 'closeFamousPersons' }), true);

  assert.equal(shell.showFamousPersons, false);
  assert.equal(game.showFamousPersons, false);
  assert.deepEqual(calls, [
    ['clearFamousSkillTooltip'],
    ['renderActive'],
    ['onFamousPersonsClosed'],
    ['setTimeout', 0],
    ['refreshCurrentHighlight'],
  ]);
});

test('CanvasGameShell re-renders highlighted resource guides outside map home', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      hitTargets: [],
    },
  });
  shell.lastGame = { state: { currentTab: 'resources', militaryView: 'army' } };
  shell.renderReadOnly = (state, activeTab, options) => {
    calls.push(['renderReadOnly', activeTab, options]);
    return true;
  };
  shell.renderActive = () => {
    calls.push(['renderActive']);
    return true;
  };

  assert.equal(shell.showTutorialHighlight(
    { x: 24, y: 96, width: 80, height: 32 },
    'open policy',
    {
      allowedAction: { type: 'openTalentPolicy' },
      renderActiveTab: 'resources',
      renderOptions: { forceMapHome: false, allowDefaultMapHome: false },
    },
  ), true);

  assert.deepEqual(calls, [
    ['renderReadOnly', 'resources', { forceMapHome: false, allowDefaultMapHome: false }],
  ]);
  assert.deepEqual(shell.tutorialHighlight.renderOptions, { forceMapHome: false, allowDefaultMapHome: false });
});

test('CanvasGameShell consumes tutorial drag outside the target without moving world map', () => {
  const calls = [];
  const event = {
    preventDefault() {
      calls.push(['preventDefault']);
    },
    stopPropagation() {
      calls.push(['stopPropagation']);
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget(point) {
        if (point.x >= 100 && point.x <= 160 && point.y >= 200 && point.y <= 260) {
          return { type: 'openWorldSite', siteId: 'capital' };
        }
        return { type: 'blockCanvasModal', allowedAction: { type: 'openWorldSite', siteId: 'capital' } };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.phase || '']);
        return true;
      },
    },
  });
  shell.tutorialIntro = { active: true, step: 'city', capitalCityId: 'capital' };
  shell.worldMapRuntimeCoordinator = {
    canRouteDrag() {
      calls.push(['canRouteDrag']);
      return true;
    },
    handleDrag() {
      calls.push(['worldDrag']);
      return true;
    },
    getMapRuntime() {
      return null;
    },
  };

  assert.equal(shell.handleDrag('start', { x: 20, y: 40 }, event), true);
  assert.equal(shell.handleDrag('move', { x: 40, y: 80 }, event), true);

  assert.equal(calls.some((call) => call[0] === 'canRouteDrag'), false);
  assert.equal(calls.some((call) => call[0] === 'worldDrag'), false);
  assert.equal(calls.some((call) => call[0] === 'handle'), false);
  assert.equal(calls.filter((call) => call[0] === 'preventDefault').length >= 2, true);
  assert.equal(calls.filter((call) => call[0] === 'stopPropagation').length >= 2, true);
});

test('CanvasGameShell still allows tutorial target taps to advance', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget(point) {
        if (point.x >= 100 && point.x <= 160 && point.y >= 200 && point.y <= 260) {
          return { type: 'openWorldSite', siteId: 'capital' };
        }
        return { type: 'blockCanvasModal', allowedAction: { type: 'openWorldSite', siteId: 'capital' } };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type]);
        return true;
      },
    },
  });
  shell.tutorialIntro = { active: true, step: 'city', capitalCityId: 'capital' };
  shell.tutorialIntroOverlay = {
    advanceFromAction(action) {
      calls.push(['advance', action.type]);
      return true;
    },
  };

  assert.equal(shell.handleTap({ x: 120, y: 220 }, {}), true);

  assert.deepEqual(calls, [
    ['handle', 'openWorldSite'],
    ['advance', 'openWorldSite'],
  ]);
});

test('CanvasGameShell lets reward reveal close above tutorial highlight', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget() {
        return { type: 'closeRewardReveal' };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type]);
        return true;
      },
    },
  });
  shell.rewardReveal = { rewardText: '+10' };
  shell.tutorialHighlight = {
    allowedAction: { type: 'buildBuilding', buildingId: 'farm' },
  };

  assert.equal(shell.handleTap({ x: 120, y: 420 }, {}), true);
  assert.deepEqual(calls, [
    ['handle', 'closeRewardReveal'],
  ]);
});

test('CanvasGameShell lets debug reset bypass tutorial highlight blocking', () => {
  const calls = [];
  const event = {
    preventDefault() {
      calls.push(['preventDefault']);
    },
    stopPropagation() {
      calls.push(['stopPropagation']);
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget() {
        return { type: 'resetGame', source: 'debugResetAccount' };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.source]);
        return true;
      },
    },
  });
  shell.showTutorialHighlight(
    { x: 100, y: 100, width: 100, height: 80 },
    'locked guide',
    { allowedAction: { type: 'openTalentPolicy' } },
  );

  assert.equal(shell.handleTap({ x: 380, y: 690 }, event), true);

  assert.deepEqual(calls, [
    ['handle', 'resetGame', 'debugResetAccount'],
    ['preventDefault'],
    ['stopPropagation'],
  ]);
});

test('CanvasGameShell blocks non-matching actions during guided highlights', () => {
  const calls = [];
  const event = {
    preventDefault() {
      calls.push(['preventDefault']);
    },
    stopPropagation() {
      calls.push(['stopPropagation']);
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget(point) {
        if (point.x < 100) return { type: 'openSettings' };
        return { type: 'switchTab', tab: 'civilization' };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.tab || '']);
        return true;
      },
    },
  });
  shell.showTutorialHighlight(
    { x: 100, y: 100, width: 100, height: 80 },
    'open civilization',
    { allowedAction: { type: 'switchTab', tab: 'civilization' } },
  );

  assert.equal(shell.handleTap({ x: 20, y: 20 }, event), true);
  assert.equal(shell.handleTap({ x: 120, y: 120 }, event), true);

  assert.deepEqual(calls, [
    ['preventDefault'],
    ['stopPropagation'],
    ['handle', 'switchTab', 'civilization'],
    ['preventDefault'],
    ['stopPropagation'],
  ]);
});

test('CanvasGameShell treats world site id fields as equivalent during guided highlights', () => {
  const calls = [];
  const event = {
    preventDefault() {
      calls.push(['preventDefault']);
    },
    stopPropagation() {
      calls.push(['stopPropagation']);
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget() {
        return { type: 'openWorldSite', territoryId: 'site_1_2' };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.territoryId || '']);
        return true;
      },
    },
  });
  shell.showTutorialHighlight(
    { x: 100, y: 100, width: 100, height: 80 },
    'open first city',
    { allowedAction: { type: 'openWorldSite', siteId: 'site_1_2' } },
  );

  assert.equal(shell.handleTap({ x: 120, y: 120 }, event), true);

  assert.deepEqual(calls, [
    ['handle', 'openWorldSite', 'site_1_2'],
    ['preventDefault'],
    ['stopPropagation'],
  ]);
});

test('CanvasGameShell lets explicit guide highlight override stale intro action rules', () => {
  const calls = [];
  const event = {
    preventDefault() {
      calls.push(['preventDefault']);
    },
    stopPropagation() {
      calls.push(['stopPropagation']);
    },
  };
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget() {
        return { type: 'openWorldSite', siteId: 'site_2_-8' };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.siteId || '']);
        return true;
      },
    },
  });
  shell.tutorialIntro = { active: true, step: 'city', capitalCityId: 'capital' };
  shell.showTutorialHighlight(
    { x: 300, y: 200, width: 80, height: 80 },
    'open first empty city',
    { allowedAction: { type: 'openWorldSite', siteId: 'site_2_-8' } },
  );

  assert.equal(shell.handleTap({ x: 340, y: 240 }, event), true);

  assert.deepEqual(calls, [
    ['handle', 'openWorldSite', 'site_2_-8'],
    ['preventDefault'],
    ['stopPropagation'],
  ]);
});

test('CanvasGameShell keeps local world site selection after forwarded open action', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    onAction(action) {
      calls.push(['forward', action.type, action.siteId]);
      return true;
    },
  });
  shell.lastGame = {
    tutorialController: {
      refreshCurrentHighlight() {
        calls.push(['refresh']);
      },
    },
  };

  assert.equal(shell.forwardCanvasAction({ type: 'openWorldSite', siteId: 'site_2_-8' }), true);

  assert.equal(shell.territoryUiState.selectedSiteId, 'site_2_-8');
  assert.deepEqual(calls, [
    ['forward', 'openWorldSite', 'site_2_-8'],
    ['refresh'],
  ]);
});

test('CanvasGameShell syncs local world site selection after handled open action', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    actionController: {
      handle(action) {
        calls.push(['handle', action.type, action.siteId]);
        return true;
      },
    },
  });

  assert.equal(shell.handleAction({ type: 'openWorldSite', siteId: 'site_3_-9' }), true);

  assert.equal(shell.territoryUiState.selectedSiteId, 'site_3_-9');
  assert.deepEqual(calls, [['handle', 'openWorldSite', 'site_3_-9']]);
});

test('CanvasGameShell blocks all drags while a guided highlight is active', () => {
  const calls = [];
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    renderer: {
      getHitTarget() {
        return { type: 'worldMapDrag' };
      },
    },
    actionController: {
      handle(action) {
        calls.push(['handle', action.type]);
        return true;
      },
    },
  });
  shell.showTutorialHighlight(
    { x: 20, y: 20, width: 100, height: 100 },
    'tap only',
    { allowedAction: { type: 'switchTab', tab: 'civilization' } },
  );

  assert.equal(shell.handleDrag('start', { x: 30, y: 30 }, {}), true);

  assert.deepEqual(calls, []);
});

test('CanvasGameShell refreshes both map layer and HUD while exploration is active', () => {
  const calls = [];
  let intervalCallback = null;
  const shell = new CanvasGameShell({
    previewEnabled: true,
    inputEnabled: true,
    runtime: {
      setInterval(callback, ms) {
        calls.push(['setInterval', ms]);
        intervalCallback = callback;
        return 1;
      },
      clearInterval(timer) {
        calls.push(['clearInterval', timer]);
      },
    },
    renderer: {},
    worldMapRenderer: {},
  });
  shell.lastGame = {
    state: {
      currentTab: 'military',
      militaryView: 'world',
      worldExplorerState: {
        activeMission: { id: 'explore-1', status: 'active' },
      },
    },
    mapHomeActive: true,
    getActiveTab() {
      return 'military';
    },
  };
  shell.getActiveTab = () => 'military';
  shell.isWorldMapDragging = () => false;
  shell.isWorldMapDragCoolingDown = () => false;
  shell.renderWorldMapLayerFrame = (options) => {
    calls.push(['renderWorldMapLayerFrame', options]);
    return true;
  };
  shell.renderAnimationFrame = () => {
    calls.push(['renderAnimationFrame']);
    return true;
  };

  assert.equal(shell.startTileMapWaterTimer(), true);
  intervalCallback();

  assert.equal(calls.some((call) => call[0] === 'renderWorldMapLayerFrame' && call[1].force === true), true);
  assert.equal(calls.some((call) => call[0] === 'renderAnimationFrame'), true);
});
