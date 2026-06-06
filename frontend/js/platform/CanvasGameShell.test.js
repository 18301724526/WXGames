const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasGameShell = require('./CanvasGameShell');

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
  assert.deepEqual(calls.at(-1), ['setLayerTranslate', 'worldMap', 32, -18]);
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
