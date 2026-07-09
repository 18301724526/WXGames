const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('../../state/UIStatePresenter');
const WorldMapSiteOverlayRenderer = require('./WorldMapSiteOverlayRenderer');

function createHost(overrides = {}) {
  const calls = [];
  const hitTargets = [];
  return {
    calls,
    hitTargets,
    width: 390,
    height: 844,
    bottomSafeArea: 12,
    presenter: null,
    addHitTarget(rect, action) {
      hitTargets.push({ rect, action });
    },
    createGradient(...args) {
      calls.push(['createGradient', ...args]);
      return '#123';
    },
    drawAsset(...args) {
      calls.push(['drawAsset', ...args]);
      return false;
    },
    drawButton(...args) {
      calls.push(['drawButton', ...args]);
    },
    drawCircle(...args) {
      calls.push(['drawCircle', ...args]);
    },
    drawPanel(...args) {
      calls.push(['drawPanel', ...args]);
    },
    drawText(...args) {
      calls.push(['drawText', ...args]);
    },
    drawTextLines(...args) {
      calls.push(['drawTextLines', ...args]);
    },
    getLayout() {
      return { contentWidth: 380, contentX: 10, contentRight: 390 };
    },
    getTopBarBottom() {
      return 84;
    },
    measureTextWidth(text) {
      return String(text || '').length * 8;
    },
    truncateText(text) {
      return String(text || '');
    },
    wrapTextLimit(text) {
      return [String(text || '')];
    },
    ...overrides,
  };
}

test('WorldMapSiteOverlayRenderer delegates dialog view state to presenter when available', () => {
  const presenterView = { selectedSiteId: 'site-1', showModal: true, details: [] };
  const host = createHost({
    presenter: {
      buildWorldSiteDialogViewState(territories, territoryState, uiState) {
        assert.equal(territories.length, 1);
        assert.equal(territoryState.version, 1);
        assert.equal(uiState.selectedSiteId, 'site-1');
        return presenterView;
      },
    },
  });
  const renderer = new WorldMapSiteOverlayRenderer({ host });

  assert.equal(renderer.getWorldSiteDialogPresenter(), host.presenter);
  assert.equal(
    renderer.buildWorldSiteDialogViewState([{ id: 'site-1' }], { version: 1 }, { selectedSiteId: 'site-1' }),
    presenterView,
  );
});

test('WorldMapSiteOverlayRenderer prefers explicit presenter over host host presenter', () => {
  const territories = [{ id: 'site-1' }];
  const territoryState = { version: 1 };
  const uiState = { selectedSiteId: 'site-1' };
  const explicitPresenter = {
    buildWorldSiteDialogViewState() {
      return {
        __sentinelSource: 'explicit',
        title: 'Explicit Presenter',
      };
    },
  };
  const hostHostPresenter = {
    buildWorldSiteDialogViewState() {
      return {
        __sentinelSource: 'hosthost',
        title: 'Host Host Presenter',
      };
    },
  };
  const host = createHost({
    presenter: null,
    host: {
      presenter: hostHostPresenter,
    },
  });
  const renderer = new WorldMapSiteOverlayRenderer({ host });
  renderer.presenter = explicitPresenter;

  const hostHostView = host.host.presenter.buildWorldSiteDialogViewState(territories, territoryState, uiState);
  const view = renderer.buildWorldSiteDialogViewState(territories, territoryState, uiState);

  assert.equal(hostHostView.__sentinelSource, 'hosthost');
  assert.equal(typeof host.host.presenter.buildWorldSiteDialogViewState, 'function');
  assert.equal(view.__sentinelSource, 'explicit');
});

test('WorldMapSiteOverlayRenderer prefers explicit viewport source over host host offsets', () => {
  const explicitWorldMapRenderer = {
    viewportOffsetX: 111,
    viewportOffsetY: 111,
  };
  const hostHostOffsetSource = {
    viewportOffsetX: 999,
    viewportOffsetY: 999,
  };
  const host = createHost({
    host: {
      viewportOffsetX: 999,
      viewportOffsetY: 999,
      worldMapRenderer: hostHostOffsetSource,
    },
  });
  const renderer = new WorldMapSiteOverlayRenderer({ host });

  const offset = renderer.getWorldSiteLayerOffset({ worldMapRenderer: explicitWorldMapRenderer });

  assert.equal(host.host.worldMapRenderer.viewportOffsetX, 999);
  assert.equal(host.host.worldMapRenderer.viewportOffsetY, 999);
  assert.equal(host.host.viewportOffsetX, 999);
  assert.equal(host.host.viewportOffsetY, 999);
  assert.deepEqual(offset, { x: 111, y: 111 });
});

test('WorldMapSiteOverlayRenderer passes tutorial context into world site presenter state', () => {
  const host = createHost({
    state: {
      tutorial: {
        currentStep: 25,
        grants: { firstExploreEmptyCity: { siteId: 'site-1' } },
      },
    },
    presenter: {
      buildWorldSiteDialogViewState(territories, territoryState, uiState) {
        assert.equal(territoryState.availableSoldiers, 0);
        assert.equal(territoryState.tutorial.currentStep, 25);
        assert.equal(territoryState.tutorial.grants.firstExploreEmptyCity.siteId, 'site-1');
        assert.equal(uiState.selectedSiteId, 'site-1');
        return {
          selectedSiteId: 'site-1',
          showModal: true,
          details: [{
            id: 'site-1',
            text: {
              name: 'Empty Site',
              status: 'discovered',
              owner: 'neutral',
              distance: '',
              scale: '',
              threat: '',
              summary: '',
              defense: '',
              soldiers: '',
            },
            action: {
              kind: 'single',
              buttons: [{ label: 'Claim', action: 'conquer', territoryId: 'site-1' }],
            },
          }],
        };
      },
    },
  });
  const renderer = new WorldMapSiteOverlayRenderer({ host });

  renderer.renderWorldSiteModal({
    territoryState: {
      availableSoldiers: 0,
      territories: [{
        id: 'site-1',
        status: 'discovered',
        owner: 'neutral',
        naturalName: 'Empty Site',
      }],
    },
  }, { territoryUiState: { selectedSiteId: 'site-1' } });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'conquer' && !target.action.disabled), true);
});

test('WorldMapSiteOverlayRenderer falls back to shared presenter for guided first city actions', () => {
  const host = createHost();
  const renderer = new WorldMapSiteOverlayRenderer({ host });

  renderer.renderWorldSiteModal({
    tutorial: {
      currentStep: 25,
      grants: { firstExploreEmptyCity: { siteId: 'site-1' } },
    },
    territoryState: {
      availableSoldiers: 0,
      territories: [{
        id: 'site-1',
        status: 'discovered',
        owner: 'neutral',
        occupationMode: 'settlement',
        naturalName: 'Empty Site',
        recommendedSoldiers: 100,
      }],
    },
  }, { territoryUiState: { selectedSiteId: 'site-1' } });

  assert.equal(renderer.getWorldSiteDialogPresenter(), globalThis.UIStatePresenter);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'conquer' && !target.action.disabled), true);
});

test('WorldMapSiteOverlayRenderer builds occupied-city fallback action view state', () => {
  const renderer = new WorldMapSiteOverlayRenderer({ host: createHost() });
  const view = renderer.buildWorldSiteDialogViewState([
    {
      id: 'capital',
      status: 'occupied',
      owner: 'player',
      cityName: 'Capital',
      summary: 'Home city.',
      defense: 12,
      recommendedSoldiers: 8,
    },
  ], {}, { selectedSiteId: 'capital' });

  assert.equal(view.showModal, true);
  assert.equal(view.selectedSiteId, 'capital');
  assert.equal(view.details[0].action.kind, 'city-command');
  assert.equal(view.details[0].action.buttons.some((button) => button.action === 'enter-city'), true);
  assert.equal(view.details[0].action.buttons.some((button) => button.action === 'rename-city'), true);
  assert.equal(typeof view.signature, 'string');
});

test('WorldMapSiteOverlayRenderer registers action hit targets with stable action types', () => {
  const host = createHost();
  const renderer = new WorldMapSiteOverlayRenderer({ host });

  const nextY = renderer.renderWorldSiteAction({
    kind: 'single',
    buttons: [
      { label: 'Go', action: 'launch-expedition', territoryId: 'site-1' },
      { label: 'Rename', action: 'rename-city', territoryId: 'capital', secondary: true },
      { label: 'People', action: 'labor-city', territoryId: 'capital', secondary: true },
    ],
  }, 10, 20, 300);

  assert.equal(nextY, 64);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'launchExpedition'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'renameCity'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'enterCity' && target.action.tab === 'people'), true);
});

test('WorldMapSiteOverlayRenderer maps city command buttons through one action helper', () => {
  const renderer = new WorldMapSiteOverlayRenderer({ host: createHost() });

  assert.deepEqual(renderer.getWorldCityCommandButtonAction({ action: 'enter-city', territoryId: 'capital' }), {
    type: 'enterCity',
    territoryId: 'capital',
    cityId: 'capital',
    tab: undefined,
    disabled: false,
    visualDisabled: false,
  });
  assert.deepEqual(renderer.getWorldCityCommandButtonAction({ action: 'labor-city', territoryId: 'capital' }), {
    type: 'enterCity',
    territoryId: 'capital',
    cityId: 'capital',
    tab: 'people',
    disabled: false,
    visualDisabled: false,
  });
  assert.equal(renderer.getWorldCityCommandButtonAction({ action: 'rename-city', territoryId: 'capital' }).type, 'renameCity');
});

test('WorldMapSiteOverlayRenderer resolves site anchors from runtime context in HUD coordinates', () => {
  const host = createHost({
    viewportOffsetX: 120,
    viewportOffsetY: 130,
    getWorldTileScreenCenter(tile, viewport) {
      return {
        x: viewport.originX + (Number(tile.q) || 0) * 96,
        y: viewport.originY + (Number(tile.r) || 0) * 48,
      };
    },
    getWorldTileSiteLayout(tile, viewport, geometry, tileWidth, tileHeight, center) {
      return {
        site: tile.site,
        hitRect: {
          x: center.x - 20,
          y: center.y - 10,
          width: 40,
          height: 30,
        },
      };
    },
  });
  const renderer = new WorldMapSiteOverlayRenderer({ host });
  const state = {
    territoryState: {
      territories: [{ id: 'capital' }],
      worldMap: {
        tiles: [{ id: 'tile_capital', q: 0, r: 0, siteId: 'capital', site: { id: 'capital' } }],
      },
    },
  };
  const context = {
    tileMapView: {
      tiles: [{ id: 'tile_capital', q: 0, r: 0, siteId: 'capital', site: { id: 'capital' } }],
      geometry: { tileWidth: 192, tileHeight: 96 },
    },
    viewport: { originX: 220, originY: 260, panX: 0, panY: 0, scale: 1 },
    geometry: { tileWidth: 192, tileHeight: 96 },
  };

  const anchor = renderer.getWorldSiteCanvasAnchor('capital', state, { worldMapRuntimeContext: context });

  assert.deepEqual(anchor.hitRect, { x: 80, y: 120, width: 40, height: 30 });
  assert.deepEqual(anchor.center, { x: 100, y: 130 });
  assert.deepEqual(anchor.layerCenter, { x: 220, y: 260 });
});

test('WorldMapSiteOverlayRenderer rejects stale runtime context for a moved site', () => {
  const calls = [];
  const host = createHost({
    viewportOffsetX: 120,
    viewportOffsetY: 120,
    resolveWorldTileMapView(territoryState) {
      return territoryState.worldMap;
    },
    getWorldTileScreenCenter(tile) {
      return { x: 200 + (Number(tile.q) || 0) * 10, y: 240 + (Number(tile.r) || 0) * 10 };
    },
    getWorldTileSiteLayout(tile, viewport, geometry, tileWidth, tileHeight, center) {
      calls.push(['layout', tile.id]);
      return {
        site: tile.site,
        hitRect: { x: center.x, y: center.y, width: 40, height: 30 },
      };
    },
  });
  const renderer = new WorldMapSiteOverlayRenderer({ host });
  const state = {
    territoryState: {
      territories: [{ id: 'capital' }],
      worldMap: {
        tiles: [{ id: 'tile_new', q: 2, r: 1, siteId: 'capital', site: { id: 'capital' } }],
      },
    },
  };
  const staleContext = {
    viewportOffsetX: 120,
    viewportOffsetY: 120,
    tileMapView: {
      tiles: [{ id: 'tile_old', q: 0, r: 0, siteId: 'capital', site: { id: 'capital' } }],
      geometry: { tileWidth: 192, tileHeight: 96 },
    },
    viewport: { originX: 220, originY: 260, panX: 0, panY: 0, scale: 1 },
    geometry: { tileWidth: 192, tileHeight: 96 },
  };

  const anchor = renderer.getWorldSiteCanvasAnchor('capital', state, { worldMapRuntimeContext: staleContext });

  assert.equal(anchor, null);
  assert.deepEqual(calls, []);
});

test('WorldMapSiteOverlayRenderer anchors city command HUD to runtime layer context', () => {
  const host = createHost({
    viewportOffsetX: 120,
    viewportOffsetY: 120,
    getWorldMapLayerLayout() {
      return { map: { x: 0, y: 84, width: 390, height: 696 } };
    },
    getWorldTileScreenCenter(tile, viewport) {
      return {
        x: viewport.originX + (Number(tile.q) || 0) * 10,
        y: viewport.originY + (Number(tile.r) || 0) * 10,
      };
    },
    getWorldTileSiteLayout(tile, viewport, geometry, tileWidth, tileHeight, center) {
      return {
        site: tile.site,
        hitRect: { x: center.x - 20, y: center.y - 10, width: 40, height: 30 },
      };
    },
  });
  const renderer = new WorldMapSiteOverlayRenderer({ host });
  const state = {
    territoryState: {
      territories: [{ id: 'capital' }],
      worldMap: {
        tiles: [{ id: 'tile_capital', q: 0, r: 0, siteId: 'capital', site: { id: 'capital' } }],
      },
    },
  };
  const context = {
    viewportOffsetX: 120,
    viewportOffsetY: 120,
    tileMapView: {
      tiles: [{ id: 'tile_capital', q: 0, r: 0, siteId: 'capital', site: { id: 'capital' } }],
      geometry: { tileWidth: 192, tileHeight: 96 },
    },
    viewport: { originX: 260, originY: 310, panX: 0, panY: 0, scale: 1 },
    geometry: { tileWidth: 192, tileHeight: 96 },
  };

  const anchor = renderer.getWorldCityCommandAnchor(
    { id: 'capital' },
    state.territoryState.territories,
    state,
    { worldMapRuntimeContext: context },
  );

  assert.equal(anchor.anchorX, 140);
  assert.equal(anchor.anchorY, 190);
  assert.deepEqual(anchor.tileCenter, { x: 140, y: 190 });
});

test('WorldMapSiteOverlayRenderer does not fallback to recomputed city anchor when runtime context is stale', () => {
  const host = createHost({
    resolveWorldTileMapView(territoryState) {
      return territoryState.worldMap;
    },
    getWorldTileScreenCenter() {
      return { x: 999, y: 999 };
    },
    getWorldTileSiteLayout(tile, viewport, geometry, tileWidth, tileHeight, center) {
      return { site: tile.site, hitRect: { x: center.x, y: center.y, width: 40, height: 30 } };
    },
  });
  const renderer = new WorldMapSiteOverlayRenderer({ host });
  const state = {
    territoryState: {
      territories: [{ id: 'capital' }],
      worldMap: {
        tiles: [{ id: 'tile_new', q: 2, r: 1, siteId: 'capital', site: { id: 'capital' } }],
      },
    },
  };
  const staleContext = {
    tileMapView: {
      tiles: [{ id: 'tile_old', q: 0, r: 0, siteId: 'capital', site: { id: 'capital' } }],
      geometry: { tileWidth: 192, tileHeight: 96 },
    },
    viewport: { originX: 220, originY: 260, panX: 0, panY: 0, scale: 1 },
    geometry: { tileWidth: 192, tileHeight: 96 },
  };

  const anchor = renderer.getWorldCityCommandAnchor(
    { id: 'capital' },
    state.territoryState.territories,
    state,
    { worldMapRuntimeContext: staleContext },
  );

  assert.equal(anchor, null);
});

test('WorldMapSiteOverlayRenderer loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapSiteOverlayRenderer.js') > -1);
  assert.ok(html.indexOf('WorldMapSiteOverlayRenderer.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapSiteOverlayRenderer') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
