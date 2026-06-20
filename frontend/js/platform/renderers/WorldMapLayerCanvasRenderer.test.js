const test = require('node:test');
const assert = require('node:assert/strict');

const WorldMapLayerCanvasRenderer = require('./WorldMapLayerCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');
const WorldActorCanvasRenderer = require('./WorldActorCanvasRenderer');

function createCtx(calls = []) {
  return {
    canvas: null,
    fillRect(...args) { calls.push(['fillRect', ...args]); },
    clearRect(...args) { calls.push(['clearRect', ...args]); },
    drawImage(...args) { calls.push(['drawImage', ...args]); },
    beginPath() { calls.push(['beginPath']); },
    moveTo(...args) { calls.push(['moveTo', ...args]); },
    lineTo(...args) { calls.push(['lineTo', ...args]); },
    rect(...args) { calls.push(['rect', ...args]); },
    stroke() { calls.push(['stroke']); },
    save() { calls.push(['save']); },
    restore() { calls.push(['restore']); },
    clip() { calls.push(['clip']); },
    setTransform(...args) { calls.push(['setTransform', ...args]); },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
  };
}

function createTileMapView() {
  return {
    seed: 'test-seed',
    pan: { x: 0, y: 0 },
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
    tiles: [
      {
        id: 'tile-capital',
        q: 0,
        r: 0,
        terrain: 'plains',
        discovered: true,
        visible: true,
        site: { id: 'capital', type: 'city', name: 'Capital' },
      },
    ],
  };
}

function createHost(overrides = {}) {
  const calls = [];
  const hitTargets = [];
  const host = {
    width: 390,
    height: 844,
    viewportOffsetX: 0,
    viewportOffsetY: 0,
    viewportWidth: 390,
    viewportHeight: 844,
    bottomSafeArea: 12,
    pixelRatio: 1,
    worldTileWaterTimeOverride: null,
    ctx: createCtx(calls),
    hitTargets,
    calls,
    presenter: {
      buildMilitaryNavigationViewState() {
        calls.push(['buildMilitaryNavigationViewState']);
        return { activeView: 'world' };
      },
    },
    addHitTarget(rect, action) { hitTargets.push({ rect, action }); },
    addWorldMapDragHitTarget(x, y, width, height) {
      calls.push(['addWorldMapDragHitTarget', x, y, width, height]);
      hitTargets.push({ rect: { x, y, width, height }, action: { type: 'worldMapDrag', background: true } });
    },
    addWorldMarchTileHitTargets(tileMapView, viewport, frame) {
      calls.push(['addWorldMarchTileHitTargets', tileMapView, viewport, frame]);
      hitTargets.push({ rect: { x: frame.x + 20, y: frame.y + 20, width: 44, height: 36 }, action: { type: 'selectWorldMarchTarget', targetQ: 1, targetR: 0 } });
    },
    addWorldTileSiteHitTargets(tileMapView, viewport, visibleEntries, uiState) {
      calls.push(['addWorldTileSiteHitTargets', tileMapView, viewport, visibleEntries, uiState]);
    },
    addWorldActorHitTargets(actors, viewport, geometry) {
      calls.push(['addWorldActorHitTargets', actors, viewport, geometry]);
    },
    renderWorldMarchHud(state, uiState, actors, viewport, geometry, frame) {
      calls.push(['renderWorldMarchHud', state, uiState, actors, viewport, geometry, frame]);
      if (!uiState.worldMarchTarget) return false;
      hitTargets.push({
        rect: { x: frame.x + 72, y: frame.y + 42, width: 68, height: 32 },
        action: {
          type: 'openWorldMarchFormationPicker',
          targetQ: uiState.worldMarchTarget.q,
          targetR: uiState.worldMarchTarget.r,
          tileId: uiState.worldMarchTarget.tileId,
        },
      });
      return true;
    },
    beginFrame(options) { calls.push(['beginFrame', options]); },
    clearAll() { calls.push(['clearAll']); },
    createGradient() { return '#123'; },
    drawButton(x, y, width, height, label, options = {}) { calls.push(['drawButton', label, options]); },
    drawPanel(...args) { calls.push(['drawPanel', ...args]); },
    drawText(text, x, y, options = {}) { calls.push(['drawText', text, options]); },
    endFrame(options) { calls.push(['endFrame', options]); },
    getLayout() { return { contentX: 10, contentWidth: 360, contentRight: 370 }; },
    getWorldTileLayerCacheContext(key, width, height, scale) {
      calls.push(['getWorldTileLayerCacheContext', key, width, height, scale]);
      return {
        canvas: { width: width * scale, height: height * scale },
        ctx: createCtx(calls),
        pixelWidth: width * scale,
        pixelHeight: height * scale,
        width,
        height,
      };
    },
    getWorldTileRenderEntries(tileMapView, viewport, frame, geometry) {
      calls.push(['getWorldTileRenderEntries', tileMapView, viewport, frame, geometry]);
      return [{ tile: tileMapView.tiles[0] }];
    },
    isWorldTileMapWaterAnimated(tileMapView) {
      calls.push(['isWorldTileMapWaterAnimated', tileMapView]);
      return false;
    },
    renderMilitaryWorldView(...args) { calls.push(['renderMilitaryWorldView', args]); },
    renderWorldTileMap(...args) { calls.push(['renderWorldTileMap', args]); },
    renderWorldTileSnapshotCache(...args) {
      calls.push(['renderWorldTileSnapshotCache', args]);
      return true;
    },
    resolveWorldTileMapView(territoryState = {}, uiState = {}) {
      calls.push(['resolveWorldTileMapView', territoryState, uiState]);
      return territoryState.worldMap || { tiles: [] };
    },
    setHitTargets(targets = []) {
      calls.push(['setHitTargets', targets]);
      hitTargets.length = 0;
      targets.forEach((target) => hitTargets.push(target));
    },
    withSuppressedHitTargets(callback) {
      calls.push(['withSuppressedHitTargets']);
      return callback();
    },
    ...overrides,
  };
  return host;
}

test('WorldMapLayerCanvasRenderer prefers injected world actor renderer over fallback candidates', () => {
  const injectedActorRenderer = { id: 'injected-actor-renderer' };
  const fallbackActorRenderer = { id: 'fallback-actor-renderer' };
  const renderer = new WorldMapLayerCanvasRenderer({
    host: {
      worldActorRenderer: fallbackActorRenderer,
      worldMapRenderer: {
        worldMapActorHudRenderer: { worldActorRenderer: fallbackActorRenderer },
        worldActorRenderer: fallbackActorRenderer,
      },
    },
    worldActorRenderer: injectedActorRenderer,
  });

  assert.equal(renderer.getExplicitWorldActorRenderer(), injectedActorRenderer);
});

test('WorldMapLayerCanvasRenderer keeps fallback actor renderer lookup when nothing is injected', () => {
  const fallbackActorRenderer = { id: 'fallback-actor-renderer' };
  const renderer = new WorldMapLayerCanvasRenderer({
    host: {
      worldMapRenderer: {
        worldMapActorHudRenderer: { worldActorRenderer: fallbackActorRenderer },
      },
    },
  });

  assert.equal(renderer.getExplicitWorldActorRenderer(), fallbackActorRenderer);
});

test('WorldMapLayerCanvasRenderer preserves map layer layout contracts', () => {
  const host = createHost();
  const renderer = new WorldMapLayerCanvasRenderer({ host });

  const mapHome = renderer.getWorldMapLayerLayout({}, 96, { isMapHome: true });
  const panel = renderer.getWorldMapLayerLayout({}, 96, {});

  assert.deepEqual(mapHome.map, { x: 0, y: 96, width: 390, height: 684 });
  assert.equal(panel.panel.x, 10);
  assert.equal(panel.map.width, 312);
});

test('WorldMapLayerCanvasRenderer preserves map-home tile rendering without HUD controls', () => {
  const host = createHost();
  const renderer = new WorldMapLayerCanvasRenderer({ host });
  const uiState = {};

  const rendered = renderer.renderMapHomeWorldView({
    territoryState: { worldMap: createTileMapView() },
  }, 96, { territoryUiState: uiState, reuseCachedWorldTileView: true });

  const worldTileCall = host.calls.find((call) => call[0] === 'renderWorldTileMap');
  assert.equal(rendered, true);
  assert.ok(worldTileCall);
  assert.equal(worldTileCall[1][6].frameless, true);
  assert.equal(worldTileCall[1][6].fastDrag, true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'startExplore'), false);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'claimExplore'), false);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'resetWorldPan'), false);
});

test('WorldMapLayerCanvasRenderer falls back when military navigation presenter is split out', () => {
  const host = createHost({
    presenter: {},
  });
  const renderer = new WorldMapLayerCanvasRenderer({ host });
  const state = {
    militaryView: 'world',
    territoryState: { worldMap: createTileMapView() },
  };

  const layout = renderer.getWorldMapLayerLayout(state, 96, { isMapHome: true });
  const rendered = renderer.renderMapHomeWorldView(state, 96, { territoryUiState: {} });

  assert.ok(layout);
  assert.equal(layout.nav.activeView, 'world');
  assert.equal(rendered, true);
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldTileMap'), true);
});

test('WorldMapLayerCanvasRenderer does not fall back to retired radar when tile map is missing', () => {
  const emptyHost = createHost();
  const emptyRenderer = new WorldMapLayerCanvasRenderer({ host: emptyHost });

  assert.equal(emptyRenderer.renderMapHomeWorldView({ territoryState: {} }, 96, { loading: { message: 'loading map' } }), true);
  assert.equal(emptyHost.hitTargets.some((target) => target.action.type === 'blockCanvasModal'), true);
  assert.equal(emptyHost.calls.some((call) => call[0] === 'drawText' && call[1] === 'loading map'), true);

  const missingTileMapHost = createHost();
  const missingTileMapRenderer = new WorldMapLayerCanvasRenderer({ host: missingTileMapHost });
  assert.equal(missingTileMapRenderer.renderMapHomeWorldView({
    territoryState: { territories: [{ id: 'old' }] },
  }, 96, { loading: { message: 'loading map' } }), true);
  assert.equal(missingTileMapHost.calls.some((call) => call[0] === 'renderMilitaryWorldView'), false);
  assert.equal(missingTileMapHost.calls.some((call) => call[0] === 'drawText' && call[1] === 'loading map'), true);
});

test('WorldMapLayerCanvasRenderer computes explorer countdown from next step time', () => {
  const host = createHost({
    getNow() {
      return new Date('2026-06-06T00:00:04.250Z').getTime();
    },
  });
  const renderer = new WorldMapLayerCanvasRenderer({ host });

  assert.equal(renderer.getExplorerMissionRemainingSeconds({
    status: 'active',
    remainingSeconds: 10,
    nextStepAt: '2026-06-06T00:00:10.000Z',
    route: [{ revealed: false }],
  }), 6);
});

test('WorldMapLayerCanvasRenderer ignores performance.now for explorer countdowns', () => {
  const renderer = new WorldMapLayerCanvasRenderer({
    host: createHost({
      epochNowMs: new Date('2026-06-06T00:00:04.250Z').getTime(),
      getNow() {
        return 4321.25;
      },
    }),
  });

  assert.equal(renderer.getExplorerMissionRemainingSeconds({
    status: 'active',
    nextStepAt: '2026-06-06T00:00:10.000Z',
    route: [{ revealed: false }],
  }), 6);
});

test('WorldMapLayerCanvasRenderer preserves hit-target-only world site collection without explorer HUD', () => {
  const host = createHost();
  const renderer = new WorldMapLayerCanvasRenderer({ host });
  const uiState = {};

  const collected = renderer.collectMapHomeWorldSiteHitTargets({
    territoryState: { worldMap: createTileMapView() },
  }, 96, { territoryUiState: uiState });

  assert.equal(collected, true);
  assert.equal(host.calls.some((call) => call[0] === 'getWorldTileRenderEntries'), true);
  assert.equal(host.calls.some((call) => call[0] === 'addWorldMapDragHitTarget'), true);
  assert.equal(host.calls.some((call) => call[0] === 'addWorldMarchTileHitTargets'), true);
  assert.equal(host.calls.some((call) => call[0] === 'addWorldTileSiteHitTargets'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'worldMapDrag'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'selectWorldMarchTarget'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'startExplore'), false);

  const emptyHost = createHost();
  const emptyRenderer = new WorldMapLayerCanvasRenderer({ host: emptyHost });
  assert.equal(emptyRenderer.collectMapHomeWorldSiteHitTargets({
    territoryState: {},
  }, 96, { territoryUiState: {} }), true);
  assert.equal(emptyHost.hitTargets.some((target) => target.action.type === 'startExplore'), false);
});

test('WorldMapLayerCanvasRenderer can refresh map-home HUD context without registering duplicate map targets', () => {
  const host = createHost({
    lastWorldTileMapContext: {
      renderSnapshot: { actors: [{ id: 'scout-1' }] },
    },
  });
  const renderer = new WorldMapLayerCanvasRenderer({ host });

  const collected = renderer.collectMapHomeWorldSiteHitTargets({
    activeCityId: 'capital',
    territoryState: { worldMap: createTileMapView() },
  }, 96, {
    collectHitTargets: false,
    territoryUiState: {},
  });

  assert.equal(collected, true);
  assert.equal(host.calls.some((call) => call[0] === 'getWorldTileRenderEntries'), true);
  assert.equal(host.calls.some((call) => call[0] === 'addWorldMapDragHitTarget'), false);
  assert.equal(host.calls.some((call) => call[0] === 'addWorldMarchTileHitTargets'), false);
  assert.equal(host.calls.some((call) => call[0] === 'addWorldTileSiteHitTargets'), false);
  assert.equal(host.hitTargets.length, 0);
  assert.deepEqual(host.lastMapHomeWorldHudContext.actors, [{ id: 'scout-1' }]);
  assert.equal(host.lastMapHomeWorldHudContext.tileMapView.seed, 'test-seed');
});

test('WorldMapLayerCanvasRenderer collects map-home world targets without painting march HUD', () => {
  const host = createHost({
    lastWorldTileMapContext: {
      renderSnapshot: { actors: [{ id: 'scout-1' }] },
    },
  });
  const renderer = new WorldMapLayerCanvasRenderer({ host });
  const uiState = {
    worldMarchTarget: { q: 2, r: 2, tileId: 'tile_2_2', terrain: 'plains', terrainLabel: 'Plains' },
  };

  const collected = renderer.collectMapHomeWorldSiteHitTargets({
    activeCityId: 'capital',
    territoryState: { worldMap: createTileMapView() },
  }, 96, { territoryUiState: uiState });

  assert.equal(collected, true);
  assert.equal(host.calls.some((call) => call[0] === 'addWorldActorHitTargets'), false);
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldMarchHud'), false);
  assert.deepEqual(host.lastMapHomeWorldHudContext.actors, [{ id: 'scout-1' }]);
  assert.equal(host.lastMapHomeWorldHudContext.tileMapView.seed, 'test-seed');
  assert.equal(host.lastMapHomeWorldHudContext.uiState, uiState);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'worldMapDrag'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'selectWorldMarchTarget'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openWorldMarchFormationPicker'), false);
});

test('WorldMapLayerCanvasRenderer collects actor targets from runtime context', () => {
  const runtimeContext = {
    actors: [{ id: 'runtime-scout', missionId: 'explore-active-1' }],
    renderSnapshot: { actors: [{ id: 'snapshot-scout' }] },
  };
  const host = createHost({
    lastWorldTileMapContext: {
      actors: [{ id: 'stale-scout' }],
    },
  });
  const renderer = new WorldMapLayerCanvasRenderer({ host });

  const collected = renderer.collectMapHomeWorldSiteHitTargets({
    activeCityId: 'capital',
    territoryState: { worldMap: createTileMapView() },
  }, 96, {
    territoryUiState: { selectedWorldActorId: 'explore-active-1' },
    worldMapRuntimeContext: runtimeContext,
  });

  assert.equal(collected, true);
  assert.equal(host.calls.some((call) => call[0] === 'addWorldActorHitTargets'), false);
  assert.deepEqual(host.lastMapHomeWorldHudContext.actors, runtimeContext.actors);
});

test('WorldMapLayerCanvasRenderer derives actor targets from world explorer state when runtime context is empty', () => {
  const host = createHost({
    lastWorldTileMapContext: {
      actors: [],
      renderSnapshot: { actors: [] },
    },
  });
  const renderer = new WorldMapLayerCanvasRenderer({ host });

  const collected = renderer.collectMapHomeWorldSiteHitTargets({
    activeCityId: 'capital',
    territoryState: { worldMap: createTileMapView() },
    worldExplorerState: {
      activeMission: {
        id: 'explore-active-1',
        status: 'active',
        origin: { q: 0, r: 0, tileId: 'tile_0_0' },
        route: [{ q: 1, r: 0, step: 1, tileId: 'tile_1_0', revealed: false }],
        target: { q: 1, r: 0, tileId: 'tile_1_0' },
        startedAt: '2026-06-06T00:00:00.000Z',
        stepDurationSeconds: 10,
      },
    },
  }, 96, {
    epochNowMs: new Date('2026-06-06T00:00:05.000Z').getTime(),
    territoryUiState: { selectedWorldActorId: 'explore-active-1' },
  });

  assert.equal(collected, true);
  assert.equal(host.calls.some((call) => call[0] === 'addWorldActorHitTargets'), false);
  assert.equal(host.lastMapHomeWorldHudContext.actors.length, 1);
  assert.equal(host.lastMapHomeWorldHudContext.actors[0].missionId, 'explore-active-1');
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldMarchHud'), false);
});

test('CanvasGameRenderer exposes map-home world march targets through world-map facades', () => {
  const renderer = new CanvasGameRenderer({
    ctx: createCtx(),
    presenter: {
      buildWorldTileMapViewState() {
        return createTileMapView();
      },
    },
    width: 390,
    height: 844,
    viewportWidth: 390,
    viewportHeight: 844,
  });

  const collected = renderer.collectMapHomeWorldSiteHitTargets({
    militaryView: 'world',
    territoryState: { worldMap: createTileMapView() },
  }, 96, { territoryUiState: {} });

  assert.equal(collected, true);
  assert.equal(renderer.hitTargets.some((target) => target.action.type === 'worldMapDrag'), true);
  assert.equal(renderer.hitTargets.some((target) => target.action.type === 'selectWorldMarchTarget'), true);
});

test('CanvasGameRenderer keeps map-home HUD picker out of world-map hit-target collection', () => {
  const renderer = new CanvasGameRenderer({
    ctx: {
      fillRect() {},
      clearRect() {},
      drawImage() {},
      beginPath() {},
      closePath() {},
      moveTo() {},
      lineTo() {},
      rect() {},
      arc() {},
      fill() {},
      stroke() {},
      save() {},
      restore() {},
      clip() {},
      fillText() {},
      measureText(text) { return { width: String(text || '').length * 8 }; },
    },
    presenter: {
      buildMilitaryNavigationViewState() {
        return { activeView: 'world' };
      },
      buildMilitaryViewState() {
        return {
          formations: [
            { slot: 1, cityId: 'capital', name: 'Scout A', memberCount: 1, maxMembers: 5, members: [{ id: 'fp-1' }] },
          ],
        };
      },
      buildWorldTileMapViewState() {
        return createTileMapView();
      },
    },
    width: 390,
    height: 844,
    viewportWidth: 390,
    viewportHeight: 844,
  });
  const uiState = {
    worldMarchTarget: { q: 2, r: 2, tileId: 'tile_2_2', terrain: 'plains', terrainLabel: 'Plains' },
  };

  const collected = renderer.collectMapHomeWorldSiteHitTargets({
    activeCityId: 'capital',
    militaryView: 'world',
    territoryState: { worldMap: createTileMapView() },
  }, 96, { territoryUiState: uiState });

  assert.equal(collected, true);
  assert.equal(renderer.hitTargets.some((target) => target.action.type === 'worldMapDrag'), true);
  assert.equal(renderer.hitTargets.some((target) => target.action.type === 'selectWorldMarchTarget'), true);
  assert.equal(renderer.hitTargets.some((target) => target.action.type === 'openWorldMarchFormationPicker'), false);
});

test('CanvasGameRenderer keeps discovered world site targets after map runtime collection', () => {
  const renderer = new CanvasGameRenderer({
    ctx: createCtx(),
    presenter: {
      buildMilitaryNavigationViewState() {
        return { activeView: 'world' };
      },
      buildMilitaryViewState() {
        return { formations: [] };
      },
      buildWorldTileMapViewState() {
        return {
          seed: 'test-seed',
          pan: { x: 0, y: 0 },
          geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
          tiles: [{
            id: 'tile_2_2',
            q: 2,
            r: 2,
            terrain: 'plains',
            terrainLabel: 'Plains',
            discovered: true,
            visible: true,
            siteId: 'site_2_2',
            site: {
              id: 'site_2_2',
              type: 'town',
              owner: 'neutral',
              status: 'discovered',
              name: 'Spring Town',
              art: 'assets/art/world-site-town-cutout.png',
              scale: 0.46,
            },
          }],
          sites: [{ id: 'site_2_2', tileId: 'tile_2_2' }],
        };
      },
    },
    width: 390,
    height: 844,
    viewportWidth: 390,
    viewportHeight: 844,
  });

  renderer.collectMapHomeWorldSiteHitTargets({
    activeCityId: 'capital',
    militaryView: 'world',
    territoryState: { worldMap: { tiles: [] } },
    worldExplorerState: { idleMissions: [] },
  }, 96, { territoryUiState: {} });

  assert.equal(renderer.hitTargets.some((target) => (
    target.action.type === 'openWorldSite'
    && target.action.siteId === 'site_2_2'
    && target.action.tileId === 'tile_2_2'
  )), true);
  assert.equal(renderer.hitTargets.some((target) => (
    target.action.type === 'selectWorldMarchTarget'
    && target.action.tileId === 'tile_2_2'
  )), true);
});

test('WorldMapLayerCanvasRenderer preserves snapshot backbuffer flow', () => {
  const host = createHost({ pixelRatio: 2 });
  const renderer = new WorldMapLayerCanvasRenderer({ host });

  const rendered = renderer.renderWorldMapSnapshotLayer({ territoryState: { worldMap: createTileMapView() } }, {
    preserveOnMiss: true,
    topBarBottom: 96,
    frameless: true,
    waterTimeMs: 123,
  });

  assert.equal(rendered, true);
  assert.equal(host.ctx, host.calls.find((call) => call[0] === 'getWorldTileLayerCacheContext') && host.ctx);
  assert.equal(host.worldTileWaterTimeOverride, null);
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldTileSnapshotCache'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawImage'), true);
});

test('WorldMapLayerCanvasRenderer publishes current snapshot context for split actor layer', () => {
  const host = createHost({
    resolveWorldTileMapView(territoryState = {}, uiState = {}) {
      host.calls.push(['resolveWorldTileMapView', territoryState, uiState]);
      return {
        ...territoryState.worldMap,
        pan: {
          x: Number(uiState.worldPanX) || 0,
          y: Number(uiState.worldPanY) || 0,
        },
      };
    },
  });
  const renderer = new WorldMapLayerCanvasRenderer({ host });

  const rendered = renderer.renderWorldMapSnapshotLayer({ territoryState: { worldMap: createTileMapView() } }, {
    preserveOnMiss: false,
    topBarBottom: 96,
    territoryUiState: { worldPanX: 40, worldPanY: -24 },
  });

  assert.equal(rendered, true);
  assert.equal(host.lastWorldTileMapContext.tileMapView.pan.x, 40);
  assert.equal(host.lastWorldTileMapContext.tileMapView.pan.y, -24);
  assert.equal(host.lastWorldTileMapContext.viewport.panX, 40);
  assert.equal(host.lastWorldTileMapContext.viewport.panY, -24);
});

test('WorldMapLayerCanvasRenderer publishes snapshot context without reading host host', () => {
  const host = createHost();
  Object.defineProperty(host, 'host', {
    get() {
      throw new Error('WorldMapLayerCanvasRenderer should not read host.host while publishing snapshot context');
    },
  });
  const renderer = new WorldMapLayerCanvasRenderer({ host });
  const context = {
    tileMapView: createTileMapView(),
    viewport: { panX: 12, panY: -6 },
  };

  const published = renderer.publishWorldMapSnapshotLayerContext(context);

  assert.equal(published, context);
  assert.equal(renderer.lastWorldTileMapContext, context);
  assert.equal(host.lastWorldTileMapContext, context);
});

test('WorldMapLayerCanvasRenderer paints dynamic actors and registers actor targets on the actor layer', () => {
  const actorContext = {
    actors: [{ id: 'scout-1', missionId: 'explore-active-1' }],
    frame: { x: 1, y: 96, width: 388, height: 684 },
    geometry: { tileWidth: 192, tileHeight: 96 },
    tileMapView: createTileMapView(),
    uiState: { selectedWorldActorId: 'explore-active-1' },
    viewport: { originX: 195, originY: 360, scale: 0.78 },
  };
  const host = createHost({
    lastWorldTileMapContext: actorContext,
    renderWorldScoutRoutes(tileMapView, viewport, actors) {
      host.calls.push(['renderWorldScoutRoutes', tileMapView, viewport, actors]);
      return true;
    },
    renderWorldActors(actors, viewport, geometry) {
      host.calls.push(['renderWorldActors', actors, viewport, geometry]);
      host.hitTargets.push({ rect: { x: 10, y: 20, width: 24, height: 24 }, action: { type: 'selectWorldActor', actorId: actors[0]?.id } });
      return true;
    },
  });
  const renderer = new WorldMapLayerCanvasRenderer({ host });

  const rendered = renderer.renderWorldMapActorLayer({ id: 'state-actor' }, {
    activeTab: 'military',
    isMapHome: true,
    territoryUiState: actorContext.uiState,
  });

  assert.equal(rendered, true);
  assert.equal(host.calls.some((call) => call[0] === 'beginFrame'), true);
  assert.equal(host.calls.some((call) => call[0] === 'setTransform' && call[1] === 1), true);
  assert.equal(host.calls.some((call) => call[0] === 'clearRect'), true);
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldScoutRoutes'), true);
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldActors'), true);
  assert.equal(host.calls.some((call) => call[0] === 'addWorldActorHitTargets'), true);
  assert.equal(
    host.calls.findIndex((call) => call[0] === 'clearRect')
      < host.calls.findIndex((call) => call[0] === 'renderWorldScoutRoutes'),
    true,
  );
  assert.equal(
    host.calls.findIndex((call) => call[0] === 'renderWorldScoutRoutes')
      < host.calls.findIndex((call) => call[0] === 'renderWorldActors'),
    true,
  );
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldMarchHud'), false);
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldTileSnapshotCache'), false);
  assert.equal(host.lastMapHomeWorldHudContext.actors[0].id, 'scout-1');
  assert.equal(host.hitTargets.some((target) => target.action.type === 'selectWorldActor'), true);
});

test('WorldMapLayerCanvasRenderer publishes actor overlay context without stale state copies', () => {
  const host = createHost();
  const renderer = new WorldMapLayerCanvasRenderer({ host });
  const context = { frame: { x: 1, y: 2, width: 3, height: 4 } };
  const layerHost = {};
  const layerRenderer = { host: layerHost };

  renderer.lastGameState = { id: 'stale-game' };
  renderer.lastWorldMarchState = { id: 'stale-march' };

  assert.equal(renderer.publishWorldActorOverlayLayerContext(layerRenderer, context), true);

  assert.equal(layerRenderer.lastWorldTileMapContext, context);
  assert.equal(layerHost.lastWorldTileMapContext, context);
  assert.equal(layerRenderer.lastGameState, undefined);
  assert.equal(layerRenderer.lastWorldMarchState, undefined);
  assert.equal(layerHost.lastGameState, undefined);
  assert.equal(layerHost.lastWorldMarchState, undefined);
});

test('WorldMapLayerCanvasRenderer records actor overlay diagnostics from actual clear and draw canvases', () => {
  const actorContext = {
    actors: [{ id: 'scout-1', status: 'active' }],
    frame: { x: 8, y: 8, width: 60, height: 40 },
    geometry: {},
    tileMapView: createTileMapView(),
    uiState: {},
    viewport: { originX: 195, originY: 360, scale: 0.78 },
  };
  const drawCanvas = { _layerName: 'draw-layer' };
  const host = createHost({
    width: 50,
    height: 40,
    lastWorldTileMapContext: actorContext,
    renderWorldActors(actors) {
      host.calls.push(['renderWorldActors', actors]);
      const diag = host.__worldActorOverlayActiveDiag;
      if (diag) {
        diag.drawnCanvasId = drawCanvas._layerName;
        diag.arrowCanvasId = drawCanvas._layerName;
      }
      return true;
    },
  });
  host.ctx.canvas = { _layerName: 'clear-layer' };
  const renderer = new WorldMapLayerCanvasRenderer({ host });

  const rendered = renderer.renderWorldMapActorLayer({ id: 'state-actor' }, {
    __worldActorOverlayDelegated: true,
    epochNowMs: 1000,
    territoryUiState: actorContext.uiState,
  });
  const diag = host.lastWorldActorOverlayDiag;
  const clearCall = host.calls.find((call) => call[0] === 'clearRect');

  assert.equal(rendered, true);
  assert.equal(diag.delegated, true);
  assert.equal(diag.clearedCanvasId, 'clear-layer');
  assert.equal(diag.drawnCanvasId, 'draw-layer');
  assert.equal(diag.arrowCanvasId, 'draw-layer');
  assert.deepEqual(diag.clearRect, { x: 0, y: 0, w: 50, h: 40 });
  assert.deepEqual(clearCall, ['clearRect', diag.clearRect.x, diag.clearRect.y, diag.clearRect.w, diag.clearRect.h]);
  assert.deepEqual(diag.drawFrame, actorContext.frame);
  assert.equal(diag.actorCount, 1);
  assert.equal(diag.clearedEqualsDrawn, false);
  assert.equal(diag.clearCoversDrawFrame, false);
});

test('WorldMapLayerCanvasRenderer throttles actor overlay diagnostic logs to one per second', () => {
  const previousLogger = global.ClientOperationLog;
  const logs = [];
  global.ClientOperationLog = {
    record(type, detail) {
      logs.push([type, detail]);
      return { type, detail };
    },
  };
  try {
    const actorContext = {
      actors: [{ id: 'scout-1' }],
      frame: { x: 1, y: 1, width: 20, height: 20 },
      geometry: {},
      tileMapView: createTileMapView(),
      uiState: {},
      viewport: { originX: 195, originY: 360, scale: 0.78 },
    };
    const host = createHost({
      lastWorldTileMapContext: actorContext,
      renderWorldActors(actors) {
        host.calls.push(['renderWorldActors', actors]);
        return true;
      },
    });
    const renderer = new WorldMapLayerCanvasRenderer({ host });
    const options = { territoryUiState: actorContext.uiState };

    assert.equal(renderer.renderWorldMapActorLayer({}, { ...options, epochNowMs: 1000 }), true);
    assert.equal(renderer.renderWorldMapActorLayer({}, { ...options, epochNowMs: 1500 }), true);
    assert.equal(renderer.renderWorldMapActorLayer({}, { ...options, epochNowMs: 2000 }), true);

    assert.deepEqual(logs.map((entry) => entry[0]), ['worldActorOverlay:diag', 'worldActorOverlay:diag']);
  } finally {
    global.ClientOperationLog = previousLogger;
  }
});

test('WorldMapLayerCanvasRenderer clears actor backing store before each dynamic actor frame', () => {
  const actorContext = {
    actors: [{ id: 'scout-1', missionId: 'explore-active-1' }],
    frame: { x: 1, y: 96, width: 388, height: 684 },
    geometry: { tileWidth: 192, tileHeight: 96 },
    tileMapView: createTileMapView(),
    uiState: { selectedWorldActorId: 'explore-active-1' },
    viewport: { originX: 195, originY: 360, scale: 0.78 },
  };
  const calls = [];
  const ctx = createCtx(calls);
  const canvas = {
    width: 1200,
    height: 2200,
    clientWidth: 600,
    clientHeight: 1100,
    _backingStorePixelRatio: 2,
  };
  ctx.canvas = canvas;
  const host = createHost({
    calls,
    ctx,
    canvas,
    width: 600,
    height: 1100,
    pixelRatio: 2,
    lastWorldTileMapContext: actorContext,
    clearAll() {
      calls.push(['clearAll']);
    },
    renderWorldActors(actors) {
      calls.push(['renderWorldActors', actors]);
      return true;
    },
  });
  const renderer = new WorldMapLayerCanvasRenderer({ host });

  const rendered = renderer.renderWorldMapActorLayer({ id: 'state-actor' }, {
    activeTab: 'military',
    isMapHome: true,
    territoryUiState: actorContext.uiState,
  });

  assert.equal(rendered, true);
  assert.deepEqual(calls.slice(0, 3), [
    ['setTransform', 1, 0, 0, 1, 0, 0],
    ['clearRect', 0, 0, 1200, 2200],
    ['setTransform', 2, 0, 0, 2, 0, 0],
  ]);
  assert.equal(calls.some((call) => call[0] === 'clearAll'), false);
  assert.equal(calls.findIndex((call) => call[0] === 'clearRect') < calls.findIndex((call) => call[0] === 'renderWorldActors'), true);
});

test('WorldMapLayerCanvasRenderer delegates direct actor frames to a separate overlay renderer', () => {
  const actorContext = {
    actors: [{ id: 'scout-1', missionId: 'explore-active-1' }],
    frame: { x: 1, y: 96, width: 388, height: 684 },
    geometry: { tileWidth: 192, tileHeight: 96 },
    tileMapView: createTileMapView(),
    uiState: {},
    viewport: { originX: 195, originY: 360, scale: 0.78 },
  };
  const terrainCalls = [];
  const overlayCalls = [];
  const terrainCtx = createCtx(terrainCalls);
  const overlayCtx = createCtx(overlayCalls);
  const overlayHost = createHost({
    calls: overlayCalls,
    ctx: overlayCtx,
    canvas: { width: 390, height: 844, _backingStorePixelRatio: 1 },
    lastWorldTileMapContext: actorContext,
    renderWorldActors(actors) {
      overlayCalls.push(['overlayRenderWorldActors', actors]);
      return true;
    },
  });
  const overlayRenderer = new WorldMapLayerCanvasRenderer({ host: overlayHost });
  const host = createHost({
    calls: terrainCalls,
    ctx: terrainCtx,
    canvas: { width: 390, height: 844, _backingStorePixelRatio: 1 },
    lastWorldTileMapContext: actorContext,
    worldActorLayerRenderer: {
      ctx: overlayCtx,
      worldMapLayerRenderer: overlayRenderer,
    },
  });
  const renderer = new WorldMapLayerCanvasRenderer({ host });

  const rendered = renderer.renderWorldMapActorLayer({ id: 'state-actor' }, {
    activeTab: 'military',
    isMapHome: true,
  });

  assert.equal(rendered, true);
  assert.notEqual(overlayCtx, terrainCtx);
  assert.equal(terrainCalls.some((call) => call[0] === 'clearRect'), false);
  assert.equal(overlayCalls.some((call) => call[0] === 'clearRect'), true);
  assert.equal(overlayCalls.some((call) => call[0] === 'overlayRenderWorldActors'), true);
});

test('WorldMapLayerCanvasRenderer prefers explicit actor overlay renderer over host host candidate', () => {
  const currentCtx = createCtx();
  const explicitCtx = createCtx();
  const hostHostCtx = createCtx();
  const explicitLayer = {
    ctx: explicitCtx,
    __sentinelSource: 'explicit',
    renderWorldMapActorLayer() {
      return true;
    },
  };
  const hostHostLayer = {
    ctx: hostHostCtx,
    __sentinelSource: 'hosthost',
    renderWorldMapActorLayer() {
      return true;
    },
  };
  const host = createHost({
    ctx: createCtx(),
    host: {
      worldActorLayerRenderer: hostHostLayer,
    },
  });
  const renderer = new WorldMapLayerCanvasRenderer({ host });
  Object.defineProperty(renderer, 'ctx', { value: currentCtx, configurable: true });
  Object.defineProperty(renderer, 'worldActorLayerRenderer', { value: explicitLayer, configurable: true });

  assert.equal(typeof host.host.worldActorLayerRenderer.renderWorldMapActorLayer, 'function');
  assert.notEqual(host.host.worldActorLayerRenderer.ctx, currentCtx);
  assert.equal(renderer.ctx, currentCtx);
  assert.equal(renderer.worldActorLayerRenderer, explicitLayer);
  assert.notEqual(explicitLayer.ctx, currentCtx);

  const layerRenderer = renderer.getWorldActorOverlayLayerRenderer();

  assert.equal(layerRenderer, explicitLayer);
  assert.equal(layerRenderer.__sentinelSource, 'explicit');
});

test('WorldMapLayerCanvasRenderer skips same-ctx actor overlay candidates', () => {
  const currentCtx = createCtx();
  const differentCtx = createCtx();
  const sameCtxLayer = {
    ctx: currentCtx,
    __sentinelSource: 'sameCtx',
    renderWorldMapActorLayer() {
      return true;
    },
  };
  const differentCtxLayer = {
    ctx: differentCtx,
    __sentinelSource: 'differentCtx',
    renderWorldMapActorLayer() {
      return true;
    },
  };
  const host = createHost({
    ctx: createCtx(),
    worldActorLayerRenderer: differentCtxLayer,
  });
  const renderer = new WorldMapLayerCanvasRenderer({ host });
  Object.defineProperty(renderer, 'ctx', { value: currentCtx, configurable: true });
  Object.defineProperty(renderer, 'worldActorLayerRenderer', { value: sameCtxLayer, configurable: true });

  assert.equal(renderer.ctx, currentCtx);
  assert.equal(sameCtxLayer.ctx, currentCtx);
  assert.notEqual(differentCtxLayer.ctx, currentCtx);
  assert.equal(renderer.worldActorLayerRenderer, sameCtxLayer);
  assert.equal(host.worldActorLayerRenderer, differentCtxLayer);

  const layerRenderer = renderer.getWorldActorOverlayLayerRenderer();

  assert.equal(layerRenderer, differentCtxLayer);
  assert.equal(layerRenderer.__sentinelSource, 'differentCtx');
});

test('WorldMapLayerCanvasRenderer draws delegated actors on explicit worldActor overlay ctx', () => {
  const actorContext = {
    actors: [{
      id: 'scout-1',
      missionId: 'explore-active-1',
      status: 'active',
      unitKey: 'scout_squad_default',
      current: { q: 0, r: 0 },
      target: { q: 1, r: 0 },
    }],
    frame: { x: 1, y: 96, width: 388, height: 684 },
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48 },
    tileMapView: createTileMapView(),
    uiState: {},
    viewport: { originX: 195, originY: 360, scale: 0.78 },
  };
  const terrainCalls = [];
  const overlayCalls = [];
  const terrainCtx = createCtx(terrainCalls);
  const overlayCtx = createCtx(overlayCalls);
  terrainCtx.canvas = { _layerName: 'worldMap' };
  overlayCtx.canvas = { _layerName: 'worldActor' };
  const terrainContainer = {
    ctx: terrainCtx,
    getNow() { return 1000; },
    getAsset(path) {
      terrainCalls.push(['getAsset', path]);
      return { width: 80, height: 120 };
    },
    addHitTarget() {},
  };
  const actorRenderer = new WorldActorCanvasRenderer({ host: terrainContainer });
  terrainContainer.worldMapRenderer = {
    worldMapActorHudRenderer: { worldActorRenderer: actorRenderer },
  };
  const overlayHost = createHost({
    calls: overlayCalls,
    ctx: overlayCtx,
    canvas: { width: 390, height: 844, _layerName: 'worldActor', _backingStorePixelRatio: 1 },
    lastWorldTileMapContext: actorContext,
    worldMapRenderer: terrainContainer,
  });
  const overlayRenderer = new WorldMapLayerCanvasRenderer({ host: overlayHost });

  const rendered = overlayRenderer.renderWorldMapActorLayer({ id: 'state-actor' }, {
    __worldActorOverlayDelegated: true,
    epochNowMs: 1000,
    territoryUiState: actorContext.uiState,
  });
  const diag = overlayHost.lastWorldActorOverlayDiag;

  assert.equal(rendered, true);
  assert.equal(diag.clearedCanvasId, 'worldActor');
  assert.equal(diag.drawnCanvasId, 'worldActor');
  assert.equal(diag.arrowCanvasId, 'worldActor');
  assert.equal(diag.clearedEqualsDrawn, true);
  assert.equal(overlayCalls.some((call) => call[0] === 'stroke'), true);
  assert.equal(overlayCalls.some((call) => call[0] === 'drawImage'), true);
  assert.equal(terrainCalls.some((call) => call[0] === 'stroke'), false);
  assert.equal(terrainCalls.some((call) => call[0] === 'drawImage'), false);
});

test('WorldMapLayerCanvasRenderer refreshes active world actors from epoch time on the actor layer', () => {
  const startedAt = new Date('2026-06-15T00:00:00.000Z').getTime();
  const mission = {
    id: 'return-repro-1',
    status: 'active',
    origin: { q: 1, r: 0, tileId: 'tile_1_0' },
    homeOrigin: { q: 0, r: 0, tileId: 'tile_0_0' },
    route: [{ q: 0, r: 0, step: 1, tileId: 'tile_0_0', revealed: false }],
    target: { q: 0, r: 0, tileId: 'tile_0_0' },
    startedAt: new Date(startedAt).toISOString(),
    nextStepAt: new Date(startedAt + 10000).toISOString(),
    completesAt: new Date(startedAt + 10000).toISOString(),
    stepDurationMs: 10000,
    stepDurationSeconds: 10,
  };
  const actorContext = {
    actors: [{
      id: mission.id,
      missionId: mission.id,
      current: { q: 1, r: 0, segmentProgress: 0, progress: 0 },
    }],
    frame: { x: 1, y: 96, width: 388, height: 684 },
    geometry: { tileWidth: 192, tileHeight: 96 },
    tileMapView: createTileMapView(),
    uiState: { selectedWorldActorId: mission.id },
    viewport: { originX: 195, originY: 360, scale: 0.78 },
  };
  const host = createHost({
    lastWorldTileMapContext: actorContext,
    renderWorldActors(actors, viewport, geometry) {
      host.calls.push(['renderWorldActors', actors, viewport, geometry]);
      return true;
    },
  });
  const renderer = new WorldMapLayerCanvasRenderer({ host });

  const rendered = renderer.renderWorldMapActorLayer({
    worldExplorerState: { activeMission: mission },
  }, {
    activeTab: 'military',
    isMapHome: true,
    territoryUiState: actorContext.uiState,
    epochNowMs: startedAt + 5000,
  });
  const actorsCall = host.calls.find((call) => call[0] === 'renderWorldActors');

  assert.equal(rendered, true);
  assert.equal(actorsCall[1][0].current.q, 0.5);
  assert.equal(actorsCall[1][0].current.segmentProgress, 0.5);
  assert.equal(host.lastMapHomeWorldHudContext.actors[0].current.q, 0.5);
});

test('WorldMapLayerCanvasRenderer ignores stale context mission actors when canonical state is available', () => {
  const startedAt = new Date('2026-06-15T00:00:00.000Z').getTime();
  const mission = {
    id: 'canonical-mission-1',
    status: 'active',
    origin: { q: 0, r: 0, tileId: 'tile_0_0' },
    route: [{ q: 1, r: 0, step: 1, tileId: 'tile_1_0', revealed: false }],
    target: { q: 1, r: 0, tileId: 'tile_1_0' },
    startedAt: new Date(startedAt).toISOString(),
    nextStepAt: new Date(startedAt + 10000).toISOString(),
    completesAt: new Date(startedAt + 10000).toISOString(),
    stepDurationMs: 10000,
    stepDurationSeconds: 10,
  };
  const actorContext = {
    actors: [
      {
        id: 'legacy-active-scout',
        status: 'active',
        unitKey: 'scout_squad_default',
        current: { q: 0.12, r: 0, segmentProgress: 0.12, progress: 0.12 },
        route: mission.route,
      },
      { id: 'non-mission-overlay', current: { q: 2, r: 0 } },
    ],
    visibilityActors: [{
      id: 'legacy-visibility-scout',
      status: 'active',
      current: { q: 0.2, r: 0, segmentProgress: 0.2, progress: 0.2 },
      route: mission.route,
    }],
    frame: { x: 1, y: 96, width: 388, height: 684 },
    geometry: { tileWidth: 192, tileHeight: 96 },
    tileMapView: createTileMapView(),
    uiState: {},
    viewport: { originX: 195, originY: 360, scale: 0.78 },
  };
  const host = createHost({
    lastWorldTileMapContext: actorContext,
    renderWorldActors(actors) {
      host.calls.push(['renderWorldActors', actors]);
      return true;
    },
  });
  const renderer = new WorldMapLayerCanvasRenderer({ host });

  const rendered = renderer.renderWorldMapActorLayer({
    worldExplorerState: { activeMission: mission },
  }, {
    activeTab: 'military',
    isMapHome: true,
    epochNowMs: startedAt + 5000,
  });
  const actorsCall = host.calls.find((call) => call[0] === 'renderWorldActors');

  assert.equal(rendered, true);
  assert.deepEqual(actorsCall[1].map((actor) => actor.id), ['canonical-mission-1', 'non-mission-overlay']);
  assert.equal(actorsCall[1][0].current.q, 0.5);
  assert.equal(host.lastMapHomeWorldHudContext.actors.length, 2);
});

test('WorldMapLayerCanvasRenderer does not revive snapshot actors when canonical state has no missions', () => {
  const actorContext = {
    actors: [],
    visibilityActors: [{
      id: 'legacy-snapshot-scout',
      status: 'active',
      current: { q: 0.2, r: 0 },
      route: [{ q: 1, r: 0, step: 1, tileId: 'tile_1_0' }],
    }],
    frame: { x: 1, y: 96, width: 388, height: 684 },
    geometry: { tileWidth: 192, tileHeight: 96 },
    tileMapView: createTileMapView(),
    uiState: {},
    viewport: { originX: 195, originY: 360, scale: 0.78 },
  };
  const host = createHost({
    lastWorldTileMapContext: actorContext,
    renderWorldActors(actors) {
      host.calls.push(['renderWorldActors', actors]);
      return true;
    },
  });
  const renderer = new WorldMapLayerCanvasRenderer({ host });

  const context = renderer.getWorldMapActorLayerContext({
    worldExplorerState: { missions: [], idleMissions: [] },
  });

  assert.deepEqual(context.actors, []);
});

test('WorldMapLayerCanvasRenderer does not paint route overlays for returned idle actors', () => {
  const actorContext = {
    actors: [{
      id: 'return-home-visual-1',
      missionId: 'return-home-visual-1',
      status: 'idle',
      current: { q: 0, r: 0 },
    }],
    frame: { x: 1, y: 96, width: 388, height: 684 },
    geometry: { tileWidth: 192, tileHeight: 96 },
    tileMapView: createTileMapView(),
    uiState: {},
    viewport: { originX: 195, originY: 360, scale: 0.78 },
  };
  const host = createHost({
    lastWorldTileMapContext: actorContext,
    renderWorldScoutRoutes(tileMapView, viewport, actors) {
      const activeActors = actors.filter((actor) => actor.status === 'active');
      if (activeActors.length) host.calls.push(['renderWorldScoutRoutes', tileMapView, viewport, activeActors]);
      return Boolean(activeActors.length);
    },
    renderWorldActors(actors) {
      host.calls.push(['renderWorldActors', actors]);
      return true;
    },
  });
  const renderer = new WorldMapLayerCanvasRenderer({ host });

  const rendered = renderer.renderWorldMapActorLayer({ worldExplorerState: { idleMissions: [] } }, {
    activeTab: 'military',
    isMapHome: true,
    territoryUiState: actorContext.uiState,
  });

  assert.equal(rendered, true);
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldScoutRoutes'), false);
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldActors'), true);
});

test('WorldMapLayerCanvasRenderer uses world clock instead of stale host epoch for actor refresh', () => {
  const startedAt = new Date('2026-06-15T00:00:00.000Z').getTime();
  const mission = {
    id: 'active-clock-1',
    status: 'active',
    origin: { q: 0, r: 0, tileId: 'tile_0_0' },
    homeOrigin: { q: 0, r: 0, tileId: 'tile_0_0' },
    route: [
      { q: 1, r: 0, step: 1, tileId: 'tile_1_0' },
      { q: 2, r: 0, step: 2, tileId: 'tile_2_0' },
    ],
    target: { q: 2, r: 0, tileId: 'tile_2_0' },
    startedAt: new Date(startedAt).toISOString(),
    nextStepAt: new Date(startedAt + 10000).toISOString(),
    completesAt: new Date(startedAt + 20000).toISOString(),
    stepDurationMs: 10000,
    stepDurationSeconds: 10,
  };
  const actorContext = {
    actors: [{
      id: mission.id,
      missionId: mission.id,
      current: { q: 0, r: 0, segmentProgress: 0, progress: 0 },
    }],
    frame: { x: 1, y: 96, width: 388, height: 684 },
    geometry: { tileWidth: 192, tileHeight: 96 },
    tileMapView: createTileMapView(),
    uiState: {},
    viewport: { originX: 195, originY: 360, scale: 0.78 },
  };
  const host = createHost({
    epochNowMs: startedAt,
    lastRenderOptions: { epochNowMs: startedAt },
    lastWorldTileMapContext: actorContext,
    worldClock: {
      getEpochNowMs() {
        return startedAt + 5000;
      },
    },
    renderWorldActors(actors) {
      host.calls.push(['renderWorldActors', actors]);
      return true;
    },
  });
  const renderer = new WorldMapLayerCanvasRenderer({ host });

  const rendered = renderer.renderWorldMapActorLayer({
    worldExplorerState: { activeMission: mission },
  }, {
    activeTab: 'military',
    isMapHome: true,
    territoryUiState: actorContext.uiState,
  });
  const actorsCall = host.calls.find((call) => call[0] === 'renderWorldActors');

  assert.equal(rendered, true);
  assert.equal(actorsCall[1][0].current.q, 0.5);
  assert.equal(actorsCall[1][0].current.segmentProgress, 0.5);
});

test('WorldMapLayerCanvasRenderer drops stale mission actors after they return home', () => {
  const completedAt = new Date('2026-06-15T00:00:10.000Z').getTime();
  const mission = {
    id: 'return-home-1',
    status: 'idle',
    origin: { q: 1, r: 0, tileId: 'tile_1_0' },
    homeOrigin: { q: 0, r: 0, tileId: 'tile_0_0' },
    route: [{ q: 0, r: 0, step: 1, tileId: 'tile_0_0', revealed: true }],
    target: { q: 0, r: 0, tileId: 'tile_0_0' },
    position: { q: 0, r: 0, tileId: 'tile_0_0' },
    startedAt: new Date(completedAt - 10000).toISOString(),
    nextStepAt: null,
    completesAt: new Date(completedAt).toISOString(),
    completedAt: new Date(completedAt).toISOString(),
    stepDurationMs: 10000,
    stepDurationSeconds: 10,
  };
  const actorContext = {
    actors: [
      {
        id: mission.id,
        missionId: mission.id,
        current: { q: 0.2, r: 0, segmentProgress: 0.8, progress: 0.8 },
      },
      { id: 'non-mission-overlay', current: { q: 2, r: 0 } },
    ],
    frame: { x: 1, y: 96, width: 388, height: 684 },
    geometry: { tileWidth: 192, tileHeight: 96 },
    tileMapView: createTileMapView(),
    uiState: {},
    viewport: { originX: 195, originY: 360, scale: 0.78 },
  };
  const host = createHost({ lastWorldTileMapContext: actorContext });
  const renderer = new WorldMapLayerCanvasRenderer({ host });

  const context = renderer.getWorldMapActorLayerContext({
    worldExplorerState: { idleMissions: [mission] },
  }, {
    epochNowMs: completedAt + 1000,
  });

  assert.deepEqual(context.actors.map((actor) => actor.id), ['non-mission-overlay']);
});

test('WorldMapLayerCanvasRenderer keeps current layer untouched when preserved snapshot misses', () => {
  const host = createHost({
    renderWorldTileSnapshotCache(...args) {
      host.calls.push(['renderWorldTileSnapshotCache', args]);
      return false;
    },
  });
  const renderer = new WorldMapLayerCanvasRenderer({ host });

  const rendered = renderer.renderWorldMapSnapshotLayer({ territoryState: { worldMap: createTileMapView() } }, {
    preserveOnMiss: true,
    topBarBottom: 96,
    frameless: true,
    waterTimeMs: 123,
  });

  assert.equal(rendered, false);
  assert.equal(host.calls.some((call) => call[0] === 'drawImage'), false);
  assert.equal(host.calls.filter((call) => call[0] === 'renderWorldTileSnapshotCache').length, 1);
});

test('WorldMapLayerCanvasRenderer preserves the previous full map layer on transient empty tile input', () => {
  const host = createHost({
    lastWorldTileMapContext: {
      tileMapView: createTileMapView(),
    },
    resolveWorldTileMapView(territoryState = {}, uiState = {}) {
      host.calls.push(['resolveWorldTileMapView', territoryState, uiState]);
      return { tiles: [] };
    },
  });
  const renderer = new WorldMapLayerCanvasRenderer({ host });

  const rendered = renderer.renderWorldMapLayer({
    militaryView: 'world',
    territoryState: { worldMap: { version: 0, tiles: [] } },
  }, {
    activeTab: 'military',
    isMapHome: true,
    topBarBottom: 96,
  });

  assert.equal(rendered, true);
  assert.equal(host.calls.some((call) => call[0] === 'clearAll'), false);
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldTileMap'), false);
});

test('WorldMapLayerCanvasRenderer fails empty tile input when no previous map layer exists', () => {
  const host = createHost({
    resolveWorldTileMapView(territoryState = {}, uiState = {}) {
      host.calls.push(['resolveWorldTileMapView', territoryState, uiState]);
      return { tiles: [] };
    },
  });
  const renderer = new WorldMapLayerCanvasRenderer({ host });

  const rendered = renderer.renderWorldMapLayer({
    militaryView: 'world',
    territoryState: { worldMap: { version: 0, tiles: [] } },
  }, {
    activeTab: 'military',
    isMapHome: true,
    topBarBottom: 96,
  });

  assert.equal(rendered, false);
  assert.equal(host.calls.some((call) => call[0] === 'clearAll'), false);
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldTileMap'), false);
});

test('CanvasGameRenderer exposes world map layer rendering through facade', () => {
  class StubWorldMapLayerRenderer {
    constructor(options) {
      this.host = options.host;
    }

    getWorldMapLayerLayout(...args) {
      return { host: this.host, args };
    }

    renderWorldMapSnapshotLayer(...args) {
      return { method: 'renderWorldMapSnapshotLayer', host: this.host, args };
    }
  }

  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    worldMapLayerRendererClass: StubWorldMapLayerRenderer,
  });
  const state = { territoryState: {} };

  const layout = renderer.getWorldMapLayerLayout(state, 90, { isMapHome: true });
  const snapshot = renderer.renderWorldMapSnapshotLayer(state, { preserveOnMiss: true });

  assert.equal(layout.host, renderer);
  assert.deepEqual(layout.args, [state, 90, { isMapHome: true }]);
  assert.equal(snapshot.method, 'renderWorldMapSnapshotLayer');
});
