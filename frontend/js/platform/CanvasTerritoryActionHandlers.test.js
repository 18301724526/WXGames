const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasTerritoryActionHandlers = require('./CanvasTerritoryActionHandlers');

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
    ensureWorldMapRuntimeCoordinator() {
      return {
        ensureRuntime() {
          calls.push(['ensureRuntime']);
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
  assert.deepEqual(runtime.camera, { x: 0, y: 0 });
  assert.equal(host.territoryUiState.worldPanX, 0);
  assert.equal(host.territoryUiState.worldPanY, 0);
  assert.deepEqual(calls, [
    ['ensureRuntime'],
    ['resetCamera', { source: 'resetWorldPan', render: false }],
    ['render', 'resetWorldPan'],
  ]);
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
    ensureWorldMapRuntimeCoordinator() {
      return {
        ensureRuntime() {
          calls.push(['ensureRuntime']);
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
  assert.deepEqual(runtime.camera, { x: 0, y: 0 });
  assert.equal(host.territoryUiState.worldPanX, 0);
  assert.equal(host.territoryUiState.worldPanY, 0);
  assert.deepEqual(calls, [
    ['forward', 'resetWorldPan'],
    ['ensureRuntime'],
    ['resetCamera', { source: 'resetWorldPan', render: false }],
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
