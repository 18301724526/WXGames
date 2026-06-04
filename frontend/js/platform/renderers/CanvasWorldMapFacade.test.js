const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasGameRenderer = require('../CanvasGameRenderer');
const {
  WORLD_MAP_FACADE_METHODS,
  installWorldMapFacade,
} = require('./CanvasWorldMapFacade');

test('CanvasWorldMapFacade installs every world-map compatibility method', () => {
  class Host {}
  installWorldMapFacade(Host);

  assert.equal(typeof Host.prototype.delegateWorldMapRenderer, 'function');
  WORLD_MAP_FACADE_METHODS.forEach(([method]) => {
    assert.equal(typeof Host.prototype[method], 'function', `${method} should be installed`);
  });
});

test('CanvasWorldMapFacade delegates calls with original arguments', () => {
  class Host {}
  installWorldMapFacade(Host);
  const calls = [];
  const host = new Host();
  host.worldMapRenderer = {
    renderWorldTileMap(...args) {
      calls.push(['renderWorldTileMap', args]);
      return { rendered: true, args };
    },
    getWorldTileDrawRect(...args) {
      calls.push(['getWorldTileDrawRect', args]);
      return { x: 1, y: 2, width: 3, height: 4 };
    },
  };
  const tile = { q: 1, r: 2 };
  const viewport = { scale: 1.25 };

  assert.deepEqual(host.renderWorldTileMap(tile, viewport), { rendered: true, args: [tile, viewport] });
  assert.deepEqual(host.getWorldTileDrawRect(tile, viewport), { x: 1, y: 2, width: 3, height: 4 });
  assert.deepEqual(calls, [
    ['renderWorldTileMap', [tile, viewport]],
    ['getWorldTileDrawRect', [tile, viewport]],
  ]);
});

test('CanvasWorldMapFacade keeps fallback objects and arrays isolated per call', () => {
  class Host {}
  installWorldMapFacade(Host);
  const host = new Host();
  host.worldMapRenderer = {};

  const entries = host.getWorldTileRenderEntries();
  entries.push({ key: 'mutated' });
  assert.deepEqual(host.getWorldTileRenderEntries(), []);

  const center = host.getWorldTileScreenCenter();
  center.x = 99;
  assert.deepEqual(host.getWorldTileScreenCenter(), { x: 0, y: 0 });

  const action = host.getWorldCityCommandButtonAction();
  action.disabled = false;
  assert.deepEqual(host.getWorldCityCommandButtonAction(), { type: 'territoryAction', disabled: true });

  assert.equal(host.renderWorldTileMap(), false);
  assert.equal(host.resolveWorldTileStaticCacheLayout(), undefined);
});

test('CanvasGameRenderer exposes world-map facade through the extracted installer', () => {
  const calls = [];
  const worldMapRenderer = {
    renderWorldSiteModal(...args) {
      calls.push(['renderWorldSiteModal', args]);
      return true;
    },
    getWorldCityCommandAnchor(...args) {
      calls.push(['getWorldCityCommandAnchor', args]);
      return { x: 18, y: 32 };
    },
  };
  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    worldMapRenderer,
  });
  const state = { territoryState: {} };
  const options = { selectedWorldSiteId: 'capital' };

  assert.equal(renderer.renderWorldSiteModal(state, options), true);
  assert.deepEqual(renderer.getWorldCityCommandAnchor(state, options), { x: 18, y: 32 });
  assert.deepEqual(calls, [
    ['renderWorldSiteModal', [state, options]],
    ['getWorldCityCommandAnchor', [state, options]],
  ]);
});
