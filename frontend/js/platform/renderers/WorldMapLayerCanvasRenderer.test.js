const test = require('node:test');
const assert = require('node:assert/strict');

const WorldMapLayerCanvasRenderer = require('./WorldMapLayerCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

function createCtx(calls = []) {
  return {
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
  assert.equal(host.calls.some((call) => call[0] === 'clearAll'), true);
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldActors'), true);
  assert.equal(host.calls.some((call) => call[0] === 'addWorldActorHitTargets'), true);
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldMarchHud'), false);
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldTileSnapshotCache'), false);
  assert.equal(host.lastMapHomeWorldHudContext.actors[0].id, 'scout-1');
  assert.equal(host.hitTargets.some((target) => target.action.type === 'selectWorldActor'), true);
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
