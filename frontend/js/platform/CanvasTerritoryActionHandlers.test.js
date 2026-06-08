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
  ]);
});

test('entrypoints load territory action handlers before CanvasActionController', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
  const minigame = fs.readFileSync(path.resolve(__dirname, '../../minigame/game.js'), 'utf8');
  assert.equal(html.indexOf('CanvasTerritoryActionHandlers.js') < html.indexOf('CanvasActionController.js'), true);
  assert.equal(minigame.indexOf("require('../js/platform/CanvasTerritoryActionHandlers')")
    < minigame.indexOf("require('../js/platform/CanvasActionController')"), true);
});
