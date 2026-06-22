const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasTerritoryActionHandlers = require('./CanvasTerritoryActionHandlers');
const CanvasActionController = require('./CanvasActionController');

class HostController {
  constructor(host) {
    this.host = host;
    this.awaitAsync = true;
  }

  getGameHost() {
    return this.host?.lastGame || this.host;
  }

  getState() {
    return this.host?.state || this.getGameHost()?.state || {};
  }

  getTerritoryController() {
    return this.host?.territoryController || this.getGameHost()?.territoryController || null;
  }

  getSharedTerritoryUiState() {
    const game = this.getGameHost();
    const territoryController = this.getTerritoryController();
    const uiState = territoryController?.uiState
      || this.host.territoryUiState
      || game?.territoryUiState
      || {};
    this.host.territoryUiState = uiState;
    if (game && game !== this.host) game.territoryUiState = uiState;
    if (territoryController && !territoryController.uiState) territoryController.uiState = uiState;
    return uiState;
  }

  forward() {
    if (typeof this.host?.forwardCanvasAction === 'function') {
      return this.host.forwardCanvasAction(...arguments);
    }
    return undefined;
  }

  finalize(result) {
    if (!result || typeof result.then !== 'function') return result !== false;
    return result.then((value) => value !== false);
  }

  finalizeForwarded(result, afterAllowed = null) {
    if (result === undefined) return undefined;
    const normalize = (value) => {
      const allowed = value !== false;
      if (allowed && typeof afterAllowed === 'function') afterAllowed(value);
      return allowed;
    };
    if (!result || typeof result.then !== 'function') return normalize(result);
    return this.finalize(result.then(normalize));
  }

  afterHandled(action) {
    this.host.renderCanvasAction?.(action);
    return true;
  }

  refreshWorldMarchLayer(action) {
    this.afterHandled(action);
    this.host.requestWorldMapRenderAnimationFrame?.({ force: true, invalidateWorldTileView: false });
    return true;
  }
}

CanvasTerritoryActionHandlers.install(HostController);

test('CanvasTerritoryActionHandlers installs world-site compatibility methods', () => {
  const calls = [];
  const host = {
    territoryUiState: {},
    state: {
      territoryState: {
        worldMap: { tiles: [{ id: 'tile_2_3', q: 2, r: 3, siteId: 'site_2_3' }] },
        territories: [{ id: 'site_2_3', x: 2, y: 3 }],
      },
    },
    runtime: { width: 420, height: 747 },
    renderer: {
      getTopBarBottom() {
        return 84;
      },
    },
    worldMapRuntime: {
      setCamera(x, y, options) {
        calls.push(['setCamera', Math.round(x), Math.round(y), options.source]);
      },
    },
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
  };
  const controller = new HostController(host);

  assert.equal(controller.handle_openWorldSite({ type: 'openWorldSite', territoryId: 'site_2_3' }), true);
  assert.equal(host.territoryUiState.selectedSiteId, 'site_2_3');
  assert.equal(controller.centerWorldMapOnSite('site_2_3'), true);

  assert.deepEqual(calls, [
    ['render', 'openWorldSite'],
    ['setCamera', 60, -125, 'subcityJump'],
  ]);
});

test('CanvasTerritoryActionHandlers keeps world march HUD state and refresh contract', async () => {
  const calls = [];
  const game = {
    territoryUiState: {},
    state: { activeCityId: 'capital' },
    startWorldMarch(options) {
      calls.push(['startWorldMarch', options]);
      return Promise.resolve(true);
    },
    stopWorldMarch(missionId) {
      calls.push(['stopWorldMarch', missionId]);
      return Promise.resolve(true);
    },
    tutorialController: {
      onWorldMarchTargetSelected(action) {
        calls.push(['targetSelected', action.targetQ, action.targetR]);
        return true;
      },
      refreshCurrentHighlight() {
        calls.push(['refreshCurrentHighlight']);
      },
    },
    runtime: {
      setTimeout(callback) {
        calls.push(['setTimeout']);
        callback?.();
      },
    },
  };
  const host = {
    territoryUiState: game.territoryUiState,
    lastGame: game,
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
    requestWorldMapRenderAnimationFrame(options) {
      calls.push(['refreshWorldMap', options]);
    },
  };
  const controller = new HostController(host);

  assert.equal(await controller.handle_selectWorldMarchTarget({
    type: 'selectWorldMarchTarget',
    targetQ: 4,
    targetR: -2,
  }), true);
  assert.deepEqual(host.territoryUiState.worldMarchTarget, {
    q: 4,
    r: -2,
    tileId: 'tile_4_-2',
    pickerOpen: false,
  });

  assert.equal(controller.handle_openWorldMarchFormationPicker({
    type: 'openWorldMarchFormationPicker',
    targetQ: 4,
    targetR: -2,
  }), true);
  assert.deepEqual(host.territoryUiState.worldMarchTarget, {
    q: 4,
    r: -2,
    tileId: 'tile_4_-2',
    pickerOpen: true,
  });

  assert.equal(await controller.handle_startWorldMarch({
    type: 'startWorldMarch',
    targetQ: 4,
    targetR: -2,
    formationSlot: 2,
  }), true);
  assert.equal(host.territoryUiState.worldMarchTarget, null);

  assert.equal(await controller.handle_stopWorldMarch({
    type: 'stopWorldMarch',
    missionId: 'march-1',
    targetQ: 999,
    targetR: 999,
  }), true);

  assert.deepEqual(calls, [
    ['targetSelected', 4, -2],
    ['render', 'selectWorldMarchTarget'],
    ['refreshWorldMap', { force: true, invalidateWorldTileView: false }],
    ['refreshCurrentHighlight'],
    ['setTimeout'],
    ['refreshCurrentHighlight'],
    ['render', 'openWorldMarchFormationPicker'],
    ['refreshWorldMap', { force: true, invalidateWorldTileView: false }],
    ['refreshCurrentHighlight'],
    ['setTimeout'],
    ['refreshCurrentHighlight'],
    ['startWorldMarch', {
      mode: 'manual',
      targetQ: 4,
      targetR: -2,
      formationSlot: 2,
      cityId: 'capital',
    }],
    ['render', 'startWorldMarch'],
    ['refreshWorldMap', { force: true, invalidateWorldTileView: false }],
    ['refreshCurrentHighlight'],
    ['setTimeout'],
    ['refreshCurrentHighlight'],
    ['stopWorldMarch', 'march-1'],
    ['render', 'stopWorldMarch'],
    ['refreshWorldMap', { force: true, invalidateWorldTileView: false }],
    ['refreshCurrentHighlight'],
    ['setTimeout'],
    ['refreshCurrentHighlight'],
  ]);
});

test('CanvasTerritoryActionHandlers refreshes world march UI before start command resolves', async () => {
  const calls = [];
  let resolveStart = null;
  const startPromise = new Promise((resolve) => {
    resolveStart = resolve;
  });
  const game = {
    territoryUiState: {
      worldMarchTarget: { q: 4, r: -2, tileId: 'tile_4_-2', pickerOpen: true },
    },
    state: { activeCityId: 'capital' },
    startWorldMarch(options) {
      calls.push(['startWorldMarch', options.targetQ, options.targetR]);
      return startPromise;
    },
    tutorialController: {
      refreshCurrentHighlight() {
        calls.push(['refreshCurrentHighlight']);
      },
    },
    runtime: {
      setTimeout(callback) {
        calls.push(['setTimeout']);
        callback?.();
      },
    },
  };
  const host = {
    territoryUiState: game.territoryUiState,
    lastGame: game,
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
    requestWorldMapRenderAnimationFrame(options) {
      calls.push(['refreshWorldMap', options.force]);
    },
  };
  const controller = new HostController(host);

  const handled = controller.handle_startWorldMarch({
    type: 'startWorldMarch',
    targetQ: 4,
    targetR: -2,
  });

  assert.equal(host.territoryUiState.worldMarchTarget, null);
  assert.deepEqual(calls, [
    ['startWorldMarch', 4, -2],
    ['render', 'startWorldMarch'],
    ['refreshWorldMap', true],
    ['refreshCurrentHighlight'],
    ['setTimeout'],
    ['refreshCurrentHighlight'],
  ]);

  resolveStart(true);
  assert.equal(await handled, true);
});

test('CanvasTerritoryActionHandlers opens and resolves world target picker candidates', () => {
  const calls = [];
  const host = {
    territoryUiState: {},
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
    requestWorldMapRenderAnimationFrame(options) {
      calls.push(['refreshWorldMap', options]);
    },
  };
  const controller = new HostController(host);

  assert.equal(controller.handle_openWorldTargetPicker({
    type: 'openWorldTargetPicker',
    q: 0,
    r: 0,
    tileId: 'tile_0_0',
    candidates: [
      { id: 'capital', kind: 'site', label: 'Capital', action: { type: 'openWorldSite', siteId: 'capital' } },
      { id: 'march-1', kind: 'actor', label: 'Scout A', action: { type: 'selectWorldActor', actorId: 'march-1' } },
    ],
  }), true);

  assert.equal(host.territoryUiState.worldTargetPicker.candidates.length, 2);
  assert.equal(host.territoryUiState.selectedSiteId, '');

  assert.equal(controller.handle_chooseWorldTarget({
    type: 'chooseWorldTarget',
    targetId: 'march-1',
  }), true);

  assert.equal(host.territoryUiState.worldTargetPicker, null);
  assert.equal(host.territoryUiState.selectedWorldActorId, 'march-1');
  assert.deepEqual(calls.map((call) => call[0] === 'render' ? call : [call[0]]), [
    ['render', 'openWorldTargetPicker'],
    ['refreshWorldMap'],
    ['render', 'selectWorldActor'],
    ['refreshWorldMap'],
  ]);
});

test('CanvasTerritoryActionHandlers forwards selected world mission id on start march only when present', async () => {
  const calls = [];
  const game = {
    territoryUiState: { selectedWorldActorId: 'march-1', selectedWorldMissionId: 'march-1' },
    state: { activeCityId: 'capital' },
    startWorldMarch(options) {
      calls.push(['startWorldMarch', options]);
      return Promise.resolve(true);
    },
  };
  const host = {
    territoryUiState: game.territoryUiState,
    lastGame: game,
    renderCanvasAction() {},
    requestWorldMapRenderAnimationFrame() {},
  };
  const controller = new HostController(host);

  assert.equal(await controller.handle_startWorldMarch({
    type: 'startWorldMarch',
    targetQ: 4,
    targetR: -2,
    formationSlot: 1,
  }), true);
  assert.equal(calls[0][1].missionId, 'march-1');
  assert.equal(host.territoryUiState.selectedWorldActorId, '');

  assert.equal(await controller.handle_startWorldMarch({
    type: 'startWorldMarch',
    targetQ: 5,
    targetR: -3,
    formationSlot: 1,
  }), true);
  assert.equal(Object.hasOwn(calls[1][1], 'missionId'), false);
});

test('CanvasTerritoryActionHandlers preserves selected world actor id through target and picker handoff', async () => {
  const calls = [];
  const game = {
    territoryUiState: { selectedWorldActorId: 'march-1', selectedWorldMissionId: 'march-1' },
    state: { activeCityId: 'capital' },
    startWorldMarch(options) {
      calls.push(['startWorldMarch', options]);
      return Promise.resolve(true);
    },
  };
  const host = {
    territoryUiState: game.territoryUiState,
    lastGame: game,
    renderCanvasAction() {},
    requestWorldMapRenderAnimationFrame() {},
  };
  const controller = new HostController(host);

  assert.equal(await controller.handle_selectWorldMarchTarget({
    type: 'selectWorldMarchTarget',
    targetQ: 4,
    targetR: -2,
  }), true);
  assert.equal(host.territoryUiState.worldMarchTarget.missionId, 'march-1');
  assert.equal(host.territoryUiState.selectedWorldActorId, '');

  assert.equal(controller.handle_openWorldMarchFormationPicker({
    type: 'openWorldMarchFormationPicker',
    targetQ: 4,
    targetR: -2,
  }), true);
  assert.equal(host.territoryUiState.worldMarchTarget.missionId, 'march-1');

  assert.equal(await controller.handle_startWorldMarch({
    type: 'startWorldMarch',
    targetQ: 4,
    targetR: -2,
    formationSlot: 1,
  }), true);
  assert.equal(calls[0][1].missionId, 'march-1');
});

test('CanvasTerritoryActionHandlers carries combat encounter id into world march options', async () => {
  const calls = [];
  const game = {
    territoryUiState: {},
    state: { activeCityId: 'capital' },
    tutorialController: {
      onWorldMarchTargetSelected() { return true; },
      refreshCurrentHighlight() {},
    },
    startWorldMarch(options) {
      calls.push(['startWorldMarch', options]);
      return Promise.resolve(true);
    },
  };
  const host = {
    territoryUiState: game.territoryUiState,
    lastGame: game,
    renderCanvasAction() {},
    requestWorldMapRenderAnimationFrame() {},
  };
  const controller = new HostController(host);

  assert.equal(await controller.handle_selectWorldMarchTarget({
    type: 'selectWorldMarchTarget',
    targetQ: 2,
    targetR: -1,
    combatEncounterId: 'hostile_force_capital_ridge',
    combatTarget: { encounterId: 'hostile_force_capital_ridge', defender: { soldiers: 40 } },
  }), true);
  assert.equal(host.territoryUiState.worldMarchTarget.combatEncounterId, 'hostile_force_capital_ridge');

  assert.equal(controller.handle_openWorldMarchFormationPicker({
    type: 'openWorldMarchFormationPicker',
    targetQ: 2,
    targetR: -1,
  }), true);

  assert.equal(await controller.handle_startWorldMarch({
    type: 'startWorldMarch',
    targetQ: 2,
    targetR: -1,
    formationSlot: 1,
  }), true);

  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].combatEncounterId, 'hostile_force_capital_ridge');
  assert.equal(Object.hasOwn(calls[0][1], 'missionId'), false);
  assert.equal(calls[0][1].targetQ, 2);
  assert.equal(calls[0][1].targetR, -1);
});

test('CanvasTerritoryActionHandlers keeps combat actor identity out of march mission payloads', async () => {
  const calls = [];
  const game = {
    territoryUiState: { selectedWorldActorId: 'hostile_force_capital_ridge' },
    state: { activeCityId: 'capital' },
    startWorldMarch(options) {
      calls.push(['startWorldMarch', options]);
      return Promise.resolve(true);
    },
  };
  const host = {
    territoryUiState: game.territoryUiState,
    lastGame: game,
    renderCanvasAction() {},
    requestWorldMapRenderAnimationFrame() {},
  };
  const controller = new HostController(host);
  const combatTarget = { encounterId: 'hostile_force_capital_ridge', defender: { soldiers: 40 } };

  assert.equal(controller.handle_openWorldMarchFormationPicker({
    type: 'openWorldMarchFormationPicker',
    targetQ: 2,
    targetR: -1,
    combatEncounterId: 'hostile_force_capital_ridge',
    combatTarget,
  }), true);

  assert.equal(host.territoryUiState.worldMarchTarget.combatEncounterId, 'hostile_force_capital_ridge');
  assert.equal(Object.hasOwn(host.territoryUiState.worldMarchTarget, 'missionId'), false);
  assert.equal(Object.hasOwn(host.territoryUiState.worldMarchTarget, 'actorId'), false);

  assert.equal(await controller.handle_startWorldMarch({
    type: 'startWorldMarch',
    targetQ: 2,
    targetR: -1,
    formationSlot: 1,
    combatEncounterId: 'hostile_force_capital_ridge',
  }), true);

  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].combatEncounterId, 'hostile_force_capital_ridge');
  assert.equal(Object.hasOwn(calls[0][1], 'missionId'), false);
});

test('CanvasTerritoryActionHandlers resets runtime world camera for return-home control', () => {
  const calls = [];
  const runtime = {
    camera: { x: 32, y: -18 },
    resetCamera(options) {
      calls.push(['resetCamera', options]);
      this.camera = { x: 0, y: 0 };
    },
  };
  const host = {
    territoryUiState: { worldPanX: 32, worldPanY: -18 },
    clearWorldMapLayerTransform() {
      calls.push(['clearTransform']);
      return true;
    },
    ensureWorldMapRuntimeCoordinator() {
      return {
        ensureRuntime() {
          calls.push(['ensureRuntime']);
          return runtime;
        },
      };
    },
    renderWorldMapLayerFrame(options) {
      calls.push(['renderWorldMapLayerFrame', options]);
      return true;
    },
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
  };
  const controller = new HostController(host);

  assert.equal(controller.handle_resetWorldPan({ type: 'resetWorldPan' }), true);
  assert.deepEqual(runtime.camera, { x: 0, y: 0 });
  assert.equal(host.territoryUiState.worldPanX, 0);
  assert.equal(host.territoryUiState.worldPanY, 0);
  assert.deepEqual(calls, [
    ['ensureRuntime'],
    ['resetCamera', { source: 'resetWorldPan', render: false }],
    ['clearTransform'],
    ['renderWorldMapLayerFrame', {
      force: true,
      reuseCachedWorldTileView: false,
      snapshotOnly: false,
      waterTimeMs: null,
    }],
    ['render', 'resetWorldPan'],
  ]);
});

test('CanvasTerritoryActionHandlers resets world camera to the current capital spawn', () => {
  const calls = [];
  const runtime = {
    camera: { x: 12, y: -8 },
    setCamera(x, y, options) {
      calls.push(['setCamera', Math.round(x), Math.round(y), options.source, options.render]);
      this.camera = { x, y };
      host.territoryUiState.worldPanX = x;
      host.territoryUiState.worldPanY = y;
      return true;
    },
    requestRender(options) {
      calls.push(['requestRender', options]);
      return true;
    },
  };
  const host = {
    territoryUiState: { worldPanX: 12, worldPanY: -8 },
    state: {
      territoryState: {
        worldMap: {
          origin: { q: 18, r: -4 },
          tiles: [{ id: 'tile_18_-4', q: 18, r: -4, siteId: 'capital' }],
        },
        territories: [{ id: 'capital', x: 18, y: -4 }],
      },
      cityState: { capitalCityId: 'capital' },
    },
    runtime: { width: 420, height: 747 },
    renderer: {
      getTopBarBottom() {
        return 84;
      },
    },
    clearWorldMapLayerTransform() {
      calls.push(['clearTransform']);
      return true;
    },
    ensureWorldMapRuntimeCoordinator() {
      return {
        ensureRuntime() {
          calls.push(['ensureRuntime']);
          return runtime;
        },
        getMapRuntime() {
          return runtime;
        },
      };
    },
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
  };
  const controller = new HostController(host);

  assert.equal(controller.handle_resetWorldPan({ type: 'resetWorldPan' }), true);

  assert.deepEqual(calls, [
    ['ensureRuntime'],
    ['setCamera', 0, 24, 'resetWorldPan', false],
    ['clearTransform'],
    ['requestRender', { force: true }],
    ['render', 'resetWorldPan'],
  ]);
  assert.equal(Math.round(host.territoryUiState.worldPanX), 0);
  assert.equal(Math.round(host.territoryUiState.worldPanY), 24);
});

test('CanvasTerritoryActionHandlers centers a non-zero world-origin capital in render space', () => {
  const calls = [];
  const host = {
    territoryUiState: { worldPanX: -1131, worldPanY: -1076 },
    state: {
      territoryState: {
        worldMap: {
          origin: { q: 28, r: 9, tileId: 'tile_28_9' },
          tiles: [{ id: 'tile_28_9', q: 28, r: 9, siteId: 'capital' }],
        },
        territories: [{ id: 'capital', x: 28, y: 9 }],
      },
      cityState: { capitalCityId: 'capital' },
    },
    runtime: { width: 420, height: 747 },
    renderer: {
      getTopBarBottom() {
        return 84;
      },
    },
    worldMapRuntime: {
      setCamera(x, y, options) {
        calls.push(['setCamera', Math.round(x), Math.round(y), options.source, options.render]);
        host.territoryUiState.worldPanX = x;
        host.territoryUiState.worldPanY = y;
      },
    },
  };
  const controller = new HostController(host);

  assert.equal(controller.centerWorldMapOnCapital({ source: 'resumeWorldMap', render: false }), true);

  assert.deepEqual(calls, [
    ['setCamera', 0, 24, 'resumeWorldMap', false],
  ]);
  assert.equal(Math.round(host.territoryUiState.worldPanX), 0);
  assert.equal(Math.round(host.territoryUiState.worldPanY), 24);
});

test('CanvasTerritoryActionHandlers resolves the capital site id from state when resetting camera', () => {
  const calls = [];
  const runtime = {
    camera: { x: 0, y: 0 },
    setCamera(x, y, options) {
      calls.push(['setCamera', Math.round(x), Math.round(y), options.source, options.render]);
      return true;
    },
    requestRender(options) {
      calls.push(['requestRender', options]);
      return true;
    },
  };
  const host = {
    territoryUiState: { worldPanX: 0, worldPanY: 0 },
    state: {
      territoryState: {
        worldMap: {
          origin: { q: 7, r: 2 },
          tiles: [{ id: 'tile_7_2', q: 7, r: 2, siteId: 'capital_a' }],
        },
        territories: [{ id: 'capital_a', x: 7, y: 2 }],
      },
      cityState: { capitalCityId: 'capital_a' },
    },
    runtime: { width: 420, height: 747 },
    renderer: {
      getTopBarBottom() {
        return 84;
      },
    },
    clearWorldMapLayerTransform() {
      calls.push(['clearTransform']);
      return true;
    },
    ensureWorldMapRuntimeCoordinator() {
      return {
        ensureRuntime() {
          calls.push(['ensureRuntime']);
          return runtime;
        },
        getMapRuntime() {
          return runtime;
        },
      };
    },
  };
  const controller = new HostController(host);

  assert.equal(controller.resetWorldMapCamera({ source: 'accountReset' }), true);

  assert.deepEqual(calls, [
    ['ensureRuntime'],
    ['setCamera', 0, 24, 'accountReset', false],
    ['clearTransform'],
    ['requestRender', { force: true }],
  ]);
});

test('CanvasTerritoryActionHandlers can invalidate world runtime before account reset state is applied', () => {
  const calls = [];
  const runtime = {
    resetWorldState(options) {
      calls.push(['resetWorldState', options.source]);
    },
    setCamera(x, y, options) {
      calls.push(['setCamera', Math.round(x), Math.round(y), options.source, options.render]);
      return false;
    },
  };
  const host = {
    territoryUiState: { worldPanX: 5, worldPanY: 6 },
    state: {
      territoryState: {
        worldMap: {
          origin: { q: 0, r: 0 },
          tiles: [{ id: 'tile_0_0', q: 0, r: 0, siteId: 'capital' }],
        },
        territories: [{ id: 'capital', x: 0, y: 0 }],
      },
      cityState: { capitalCityId: 'capital' },
    },
    runtime: { width: 420, height: 747 },
    renderer: {
      lastWorldTileMapContext: { stale: true },
      invalidateWorldTileCaches() {
        calls.push(['invalidateRendererCaches']);
      },
      getTopBarBottom() {
        return 84;
      },
    },
    ensureWorldMapRuntimeCoordinator() {
      return {
        ensureRuntime() {
          calls.push(['ensureRuntime']);
          return runtime;
        },
        getMapRuntime() {
          return runtime;
        },
      };
    },
    clearWorldMapLayerTransform() {
      calls.push(['clearTransform']);
      return true;
    },
  };
  const controller = new HostController(host);

  assert.equal(controller.resetWorldMapCamera({ source: 'accountReset', render: false, resetRuntimeState: true }), true);

  assert.deepEqual(calls, [
    ['ensureRuntime'],
    ['resetWorldState', 'accountReset'],
    ['invalidateRendererCaches'],
    ['setCamera', 0, 24, 'accountReset', false],
    ['invalidateRendererCaches'],
    ['clearTransform'],
  ]);
  assert.equal(host.renderer.lastWorldTileMapContext, null);
});

test('CanvasTerritoryActionHandlers clears cyclic world renderer graph without recursion overflow', () => {
  const calls = [];
  const runtime = {
    setCamera(x, y, options) {
      calls.push(['setCamera', Math.round(x), Math.round(y), options.source, options.render]);
      return true;
    },
    requestRender(options) {
      calls.push(['requestRender', options]);
      return true;
    },
  };
  const worldMapRenderer = {
    lastWorldTileMapContext: { stale: 'map' },
    lastMapHomeWorldHudContext: { stale: 'mapHud' },
    lastWorldMapLayerRenderResult: { stale: 'mapResult' },
    hitTargets: [{ action: { type: 'openWorldSite' } }],
    invalidateWorldTileCaches() {
      calls.push(['invalidateWorldTileCaches', 'map']);
    },
    invalidateWorldTileViewCache() {
      calls.push(['invalidateWorldTileViewCache', 'map']);
    },
    setHitTargets(targets) {
      calls.push(['setHitTargets', 'map', targets.length]);
      this.hitTargets = targets;
    },
  };
  const worldActorLayerRenderer = {
    lastWorldTileMapContext: { stale: 'actor' },
    lastMapHomeWorldHudContext: { stale: 'actorHud' },
    hitTargets: [{ action: { type: 'openWorldSite' } }],
    invalidateWorldTileCaches() {
      calls.push(['invalidateWorldTileCaches', 'actor']);
    },
    invalidateWorldTileViewCache() {
      calls.push(['invalidateWorldTileViewCache', 'actor']);
    },
    setHitTargets(targets) {
      calls.push(['setHitTargets', 'actor', targets.length]);
      this.hitTargets = targets;
    },
  };
  worldMapRenderer.worldActorLayerRenderer = worldActorLayerRenderer;
  worldActorLayerRenderer.worldMapRenderer = worldMapRenderer;
  const host = {
    territoryUiState: { worldPanX: 3, worldPanY: 4 },
    state: {
      territoryState: {
        worldMap: {
          origin: { q: 12, r: 6 },
          tiles: [{ id: 'tile_12_6', q: 12, r: 6, siteId: 'capital' }],
        },
        territories: [{ id: 'capital', x: 12, y: 6 }],
      },
      cityState: { capitalCityId: 'capital' },
    },
    runtime: { width: 420, height: 747 },
    renderer: { getTopBarBottom: () => 84 },
    worldMapRenderer,
    worldActorLayerRenderer,
    ensureWorldMapRuntimeCoordinator() {
      return {
        ensureRuntime() {
          calls.push(['ensureRuntime']);
          return runtime;
        },
        getMapRuntime() {
          return runtime;
        },
      };
    },
    clearWorldMapLayerTransform() {
      calls.push(['clearTransform']);
      return true;
    },
  };
  const controller = new HostController(host);

  assert.equal(controller.resetWorldMapCamera({ source: 'accountReset' }), true);

  assert.equal(worldMapRenderer.lastWorldTileMapContext, null);
  assert.equal(worldMapRenderer.lastMapHomeWorldHudContext, null);
  assert.equal(worldMapRenderer.lastWorldMapLayerRenderResult, null);
  assert.deepEqual(worldMapRenderer.hitTargets, []);
  assert.equal(worldActorLayerRenderer.lastWorldTileMapContext, null);
  assert.equal(worldActorLayerRenderer.lastMapHomeWorldHudContext, null);
  assert.deepEqual(worldActorLayerRenderer.hitTargets, []);
  assert.deepEqual(calls.filter((call) => call[0] === 'setCamera'), [
    ['setCamera', 0, 24, 'accountReset', false],
  ]);
  assert.deepEqual(calls.filter((call) => call[0] === 'requestRender'), [
    ['requestRender', { force: true }],
  ]);
});

test('CanvasActionController centers account reset camera from the updated game state behind the shell', () => {
  const calls = [];
  const runtime = {
    setCamera(x, y, options) {
      calls.push(['setCamera', Math.round(x), Math.round(y), options.source, options.render]);
      return true;
    },
    requestRender(options) {
      calls.push(['requestRender', options]);
      return true;
    },
  };
  const game = {
    state: {
      territoryState: {
        worldMap: {
          origin: { q: 18, r: -4 },
          tiles: [{ id: 'tile_18_-4', q: 18, r: -4, siteId: 'capital' }],
        },
        territories: [{ id: 'capital', x: 18, y: -4 }],
      },
      cityState: { capitalCityId: 'capital' },
    },
    ensureWorldMapRuntimeCoordinator() {
      return {
        ensureRuntime() {
          calls.push(['gameEnsureRuntime']);
          return runtime;
        },
        getMapRuntime() {
          return runtime;
        },
      };
    },
  };
  const shell = {
    lastGame: game,
    state: {
      territoryState: {
        worldMap: { tiles: [{ id: 'tile_0_0', q: 0, r: 0, siteId: 'capital' }] },
        territories: [{ id: 'capital', x: 0, y: 0 }],
      },
      cityState: { capitalCityId: 'capital' },
    },
    getCanvasGameHost() {
      return game;
    },
    getCanvasActionState() {
      return game.state;
    },
    runtime: { width: 420, height: 747 },
    renderer: {
      getTopBarBottom() {
        return 84;
      },
    },
    ensureWorldMapRuntimeCoordinator() {
      return {
        ensureRuntime() {
          calls.push(['shellEnsureRuntime']);
          return runtime;
        },
        getMapRuntime() {
          return runtime;
        },
      };
    },
    clearWorldMapLayerTransform() {
      calls.push(['clearTransform']);
      return true;
    },
  };
  game.canvasShell = shell;
  const controller = new CanvasActionController({ host: shell });

  assert.equal(controller.resetWorldMapCamera({ source: 'accountReset', render: true }), true);

  assert.deepEqual(calls, [
    ['shellEnsureRuntime'],
    ['setCamera', 0, 24, 'accountReset', false],
    ['clearTransform'],
    ['requestRender', { force: true }],
  ]);
});

test('CanvasTerritoryActionHandlers forwards runtime input intent evidence to world march commands', async () => {
  const calls = [];
  const inputIntent = {
    schema: 'world-map-input-intent-v1',
    kind: 'tap',
    target: { kind: 'tile', tileId: 'tile_4_-2', targetQ: 4, targetR: -2 },
    picking: { inputEpoch: 3, signature: 'pick-3' },
  };
  const game = {
    territoryUiState: {},
    state: { activeCityId: 'capital' },
    startWorldMarch(options) {
      calls.push(['startWorldMarch', options]);
      return Promise.resolve(true);
    },
    returnWorldMarch(missionId, options) {
      calls.push(['returnWorldMarch', missionId, options]);
      return Promise.resolve(true);
    },
    stopWorldMarch(missionId, options) {
      calls.push(['stopWorldMarch', missionId, options]);
      return Promise.resolve(true);
    },
  };
  const host = {
    territoryUiState: game.territoryUiState,
    lastGame: game,
    renderCanvasAction() {},
    requestWorldMapRenderAnimationFrame() {},
  };
  const controller = new HostController(host);

  assert.equal(await controller.handle_startWorldMarch({
    type: 'startWorldMarch',
    targetQ: 4,
    targetR: -2,
    formationSlot: 2,
  }, { inputIntent }), true);
  assert.equal(await controller.handle_returnWorldMarch({
    type: 'returnWorldMarch',
    missionId: 'march-1',
  }, { inputIntent }), true);
  assert.equal(await controller.handle_stopWorldMarch({
    type: 'stopWorldMarch',
    missionId: 'march-1',
  }, { inputIntent }), true);

  assert.equal(calls[0][1].clientInputIntent, inputIntent);
  assert.equal(calls[1][2].clientInputIntent, inputIntent);
  assert.equal(calls[2][2].clientInputIntent, inputIntent);
});

test('CanvasTerritoryActionHandlers derives world march tile identity from target coordinates', async () => {
  const calls = [];
  const game = {
    territoryUiState: {},
    state: { activeCityId: 'capital' },
    startWorldMarch(options) {
      calls.push(['startWorldMarch', options]);
      return Promise.resolve(true);
    },
    tutorialController: {
      onWorldMarchTargetSelected() {
        return true;
      },
      refreshCurrentHighlight() {},
    },
  };
  const host = {
    territoryUiState: game.territoryUiState,
    lastGame: game,
    renderCanvasAction() {},
    requestWorldMapRenderAnimationFrame() {},
  };
  const controller = new HostController(host);

  assert.equal(await controller.handle_selectWorldMarchTarget({
    type: 'selectWorldMarchTarget',
    targetQ: 4,
    targetR: -2,
    tileId: 'stale-renderer-tile',
  }), true);
  assert.deepEqual(host.territoryUiState.worldMarchTarget, {
    q: 4,
    r: -2,
    tileId: 'tile_4_-2',
    pickerOpen: false,
  });

  assert.equal(controller.handle_openWorldMarchFormationPicker({
    type: 'openWorldMarchFormationPicker',
    targetQ: 5,
    targetR: -3,
    tileId: 'stale-picker-tile',
  }), true);
  assert.deepEqual(host.territoryUiState.worldMarchTarget, {
    q: 5,
    r: -3,
    tileId: 'tile_5_-3',
    pickerOpen: true,
  });

  assert.equal(await controller.handle_startWorldMarch({
    type: 'startWorldMarch',
    targetQ: 5,
    targetR: -3,
    tileId: 'stale-start-tile',
  }), true);
  assert.deepEqual(calls[0][1], {
    mode: 'manual',
    targetQ: 5,
    targetR: -3,
    formationSlot: 1,
    cityId: 'capital',
  });
  assert.equal(Object.hasOwn(calls[0][1], 'tileId'), false);
});

test('CanvasTerritoryActionHandlers resets local shell camera after forwarded return-home action', () => {
  const calls = [];
  const runtime = {
    camera: { x: -44, y: 26 },
    resetCamera(options) {
      calls.push(['resetCamera', options]);
      this.camera = { x: 0, y: 0 };
    },
  };
  const host = {
    territoryUiState: { worldPanX: -44, worldPanY: 26 },
    forwardCanvasAction(action) {
      calls.push(['forward', action.type]);
      return true;
    },
    clearWorldMapLayerTransform() {
      calls.push(['clearTransform']);
      return true;
    },
    ensureWorldMapRuntimeCoordinator() {
      return {
        ensureRuntime() {
          calls.push(['ensureRuntime']);
          return runtime;
        },
      };
    },
    renderWorldMapLayerFrame(options) {
      calls.push(['renderWorldMapLayerFrame', options]);
      return true;
    },
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
  };
  const controller = new HostController(host);

  assert.equal(controller.handle_resetWorldPan({ type: 'resetWorldPan' }), true);
  assert.deepEqual(runtime.camera, { x: 0, y: 0 });
  assert.equal(host.territoryUiState.worldPanX, 0);
  assert.equal(host.territoryUiState.worldPanY, 0);
  assert.deepEqual(calls, [
    ['forward', 'resetWorldPan'],
    ['ensureRuntime'],
    ['resetCamera', { source: 'resetWorldPan', render: false }],
    ['clearTransform'],
    ['renderWorldMapLayerFrame', {
      force: true,
      reuseCachedWorldTileView: false,
      snapshotOnly: false,
      waterTimeMs: null,
    }],
    ['render', 'resetWorldPan'],
  ]);
});

test('entrypoints load territory action handlers before CanvasActionController', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
  const minigame = fs.readFileSync(path.resolve(__dirname, '../../minigame/game.js'), 'utf8');
  assert.equal(html.indexOf('CanvasTerritoryActionHandlers.js') < html.indexOf('CanvasActionController.js'), true);
  assert.equal(minigame.indexOf("require('../js/platform/CanvasTerritoryActionHandlers')")
    < minigame.indexOf("require('../js/platform/CanvasActionController')"), true);
});
