const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldMapRuntime = require('./WorldMapRuntime');

function createState(explorerStatus = 'active') {
  return {
    territoryState: {
      worldMap: {
        version: 1,
        seed: 'seed',
        tiles: [{ id: 'tile_0_0', q: 0, r: 0, terrain: 'plains' }],
      },
      territories: [{ id: 'capital', x: 0, y: 0, type: 'capital', owner: 'player' }],
      scoutMissions: [],
    },
    worldExplorerState: {
      activeMission: explorerStatus ? {
        id: 'explore-1',
        status: explorerStatus,
        route: [{ q: 1, r: 0, tileId: 'tile_1_0', revealed: explorerStatus === 'ready' }],
        plannedTiles: [{ id: 'tile_1_0', q: 1, r: 0, terrain: 'plains' }],
        plannedSites: [{ siteId: 'site_1_0', tileId: 'tile_1_0', materialized: explorerStatus === 'ready' }],
        revealedTileIds: explorerStatus === 'ready' ? ['tile_1_0'] : [],
      } : null,
    },
  };
}

test('WorldMapRuntime includes world explorer state in map bake signature', () => {
  let state = createState('active');
  const runtime = new WorldMapRuntime({
    renderer: {
      renderWorldMapLayer() {},
    },
    presenter: {
      getWorldTileMapSignature(territoryState, worldExplorerState) {
        return JSON.stringify({
          territoryVersion: territoryState.worldMap.version,
          explorer: worldExplorerState.activeMission?.status || '',
          revealed: worldExplorerState.activeMission?.revealedTileIds || [],
        });
      },
    },
    getState: () => state,
  });

  runtime.hasBakedMapLayer = true;
  runtime.mapBakeDirty = false;
  runtime.lastMapDataSignature = runtime.getMapDataSignature(state);
  assert.equal(runtime.isMapBakeDirty(state), false);

  state = createState('ready');
  assert.equal(runtime.isMapBakeDirty(state), true);
});

test('WorldMapRuntime keeps the topmost background tile action over map drag', () => {
  const runtime = new WorldMapRuntime({ renderer: { renderWorldMapLayer() {} } });
  runtime.hitTargets = [
    { x: 0, y: 0, width: 300, height: 300, action: { type: 'worldMapDrag', background: true } },
    { x: 40, y: 40, width: 80, height: 60, action: { type: 'selectWorldMarchTarget', targetQ: 1, targetR: 0, background: true } },
  ];

  assert.deepEqual(runtime.getHitTarget({ x: 60, y: 60 }), {
    type: 'selectWorldMarchTarget',
    targetQ: 1,
    targetR: 0,
    background: true,
  });
});

test('WorldMapRuntime converts map background taps into fog march targets', () => {
  const calls = [];
  const renderer = {
    renderWorldMapLayer() {},
    lastWorldTileMapContext: {
      tileMapView: {
        geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
        tiles: [{ id: 'tile_0_0', q: 0, r: 0, terrain: 'plains', terrainLabel: '平原', visibility: 'scouted' }],
      },
      viewport: {
        originX: 100,
        originY: 100,
        panX: 0,
        panY: 0,
        scale: 0.5,
      },
      geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
    },
  };
  const runtime = new WorldMapRuntime({
    renderer,
    presenter: {},
    onAction(action) {
      calls.push(action);
      return true;
    },
  });
  runtime.hitTargets = [
    { x: 0, y: 0, width: 300, height: 300, action: { type: 'worldMapDrag', background: true } },
  ];
  runtime.lastTileMapContext = renderer.lastWorldTileMapContext;

  assert.equal(runtime.handleTap({ x: 148, y: 220 }), true);
  assert.equal(calls[0].type, 'selectWorldMarchTarget');
  assert.equal(calls[0].known, false);
  assert.equal(calls[0].terrainLabel, '未知');
});

test('WorldMapRuntime infers background tile targets when snapshot hit targets are partial', () => {
  const calls = [];
  const geometry = { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 };
  const renderer = {
    viewportWidth: 390,
    viewportHeight: 844,
    bottomSafeArea: 0,
    renderWorldMapLayer() {},
    getWorldMapLayerLayout() {
      return { map: { x: 0, y: 84, width: 390, height: 640 } };
    },
    lastWorldTileMapContext: {
      frame: { x: 0, y: 84, width: 390, height: 640 },
      tileMapView: {
        geometry,
        tiles: [
          { id: 'tile_0_0', q: 0, r: 0, terrain: 'plains', terrainLabel: 'Plains', visibility: 'scouted' },
          { id: 'tile_1_0', q: 1, r: 0, terrain: 'forest', terrainLabel: 'Forest', visibility: 'unknown', discovered: false },
        ],
      },
      viewport: {
        originX: 160,
        originY: 180,
        panX: 0,
        panY: 0,
        scale: 1,
      },
      geometry,
    },
  };
  const runtime = new WorldMapRuntime({
    renderer,
    runtime: {
      getSystemInfo() {
        return { windowWidth: 390, windowHeight: 844 };
      },
    },
    presenter: {},
    getState: () => createState(),
    getTopBarBottom: () => 84,
    onAction(action) {
      calls.push(action);
      return true;
    },
  });
  runtime.lastTileMapContext = renderer.lastWorldTileMapContext;
  runtime.hitTargets = [
    { x: 8, y: 8, width: 40, height: 40, action: { type: 'resetWorldPan' } },
    { x: 340, y: 760, width: 42, height: 42, action: { type: 'openSettings' } },
  ];

  assert.equal(runtime.handleTap({ x: 256, y: 228 }), true);
  assert.equal(calls[0].type, 'selectWorldMarchTarget');
  assert.equal(calls[0].targetQ, 1);
  assert.equal(calls[0].targetR, 0);
});

test('WorldMapRuntime converts HUD taps into padded world-layer coordinates before inferring fog march targets', () => {
  const calls = [];
  const geometry = { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 };
  const renderer = {
    viewportOffsetX: 120,
    viewportOffsetY: 120,
    renderWorldMapLayer() {},
    lastWorldTileMapContext: {
      tileMapView: {
        geometry,
        tiles: [
          { id: 'tile_0_0', q: 0, r: 0, terrain: 'plains', terrainLabel: 'Plains', visibility: 'scouted' },
          { id: 'tile_1_0', q: 1, r: 0, terrain: 'forest', terrainLabel: 'Forest', visibility: 'unknown', discovered: false },
        ],
      },
      viewport: {
        originX: 120 + 180,
        originY: 120 + 180,
        panX: 0,
        panY: 0,
        scale: 1,
      },
      geometry,
    },
  };
  const runtime = new WorldMapRuntime({
    renderer,
    presenter: {},
    onAction(action) {
      calls.push(action);
      return true;
    },
  });
  runtime.hitTargets = [
    { x: 0, y: 0, width: 300, height: 300, action: { type: 'worldMapDrag', background: true } },
  ];
  runtime.lastTileMapContext = renderer.lastWorldTileMapContext;
  const layerTileCenter = {
    x: renderer.lastWorldTileMapContext.viewport.originX + geometry.stepX,
    y: renderer.lastWorldTileMapContext.viewport.originY + geometry.stepY,
  };
  const hudPoint = {
    x: layerTileCenter.x - renderer.viewportOffsetX,
    y: layerTileCenter.y - renderer.viewportOffsetY,
  };

  assert.equal(runtime.handleTap(hudPoint), true);
  assert.equal(calls[0].type, 'selectWorldMarchTarget');
  assert.equal(calls[0].targetQ, 1);
  assert.equal(calls[0].targetR, 0);
});

test('WorldMapRuntime recomputes background tile targets from the actual tap point', () => {
  const calls = [];
  const geometry = { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 };
  const renderer = {
    viewportOffsetX: 200,
    viewportOffsetY: 200,
    renderWorldMapLayer() {},
    lastWorldTileMapContext: {
      tileMapView: {
        geometry,
        tiles: [
          { id: 'tile_2_2', q: 2, r: 2, terrain: 'waste', terrainLabel: 'Waste', visibility: 'scouted' },
        ],
      },
      viewport: {
        originX: 395,
        originY: 473.94,
        panX: 0,
        panY: 0,
        scale: 0.78,
      },
      geometry,
    },
  };
  const runtime = new WorldMapRuntime({
    renderer,
    presenter: {},
    onAction(action) {
      calls.push(action);
      return true;
    },
  });
  const targetCenter = {
    x: renderer.lastWorldTileMapContext.viewport.originX,
    y: renderer.lastWorldTileMapContext.viewport.originY + (3 + 3) * geometry.stepY * renderer.lastWorldTileMapContext.viewport.scale,
  };
  const hudPoint = {
    x: targetCenter.x - renderer.viewportOffsetX,
    y: targetCenter.y - renderer.viewportOffsetY,
  };
  runtime.hitTargets = [
    { x: 0, y: 0, width: 390, height: 620, action: { type: 'worldMapDrag', background: true } },
    {
      x: hudPoint.x - 70,
      y: hudPoint.y - 40,
      width: 140,
      height: 80,
      action: {
        type: 'selectWorldMarchTarget',
        targetQ: 2,
        targetR: 2,
        tileId: 'tile_2_2',
        known: true,
        background: true,
      },
    },
  ];
  runtime.lastTileMapContext = renderer.lastWorldTileMapContext;

  assert.equal(runtime.handleTap(hudPoint), true);
  assert.equal(calls[0].type, 'selectWorldMarchTarget');
  assert.equal(calls[0].targetQ, 3);
  assert.equal(calls[0].targetR, 3);
  assert.equal(calls[0].known, false);
});

test('WorldMapRuntime subtracts temporary drag transform when converting HUD taps to world-layer coordinates', () => {
  const renderer = {
    viewportOffsetX: 120,
    viewportOffsetY: 120,
    renderWorldMapLayer() {},
  };
  const runtime = new WorldMapRuntime({ renderer, presenter: {} });

  runtime.setDragLayerOffset(32, -18);

  assert.deepEqual(runtime.getLayerPointFromHudPoint({ x: 196, y: 268 }), {
    x: 284,
    y: 406,
  });
});

test('WorldMapRuntime reads tile context from the split world map renderer', () => {
  const calls = [];
  const lastWorldTileMapContext = {
    tileMapView: {
      geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
      tiles: [{ id: 'tile_0_0', q: 0, r: 0, terrain: 'plains', terrainLabel: 'Plains', visibility: 'scouted' }],
    },
    viewport: {
      originX: 100,
      originY: 100,
      panX: 0,
      panY: 0,
      scale: 0.5,
    },
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
  };
  const runtime = new WorldMapRuntime({
    renderer: {
      renderWorldMapLayer() {},
      worldMapRenderer: { lastWorldTileMapContext },
    },
    presenter: {},
    onAction(action) {
      calls.push(action);
      return true;
    },
  });
  runtime.hitTargets = [
    { x: 0, y: 0, width: 300, height: 300, action: { type: 'worldMapDrag', background: true } },
  ];

  assert.equal(runtime.handleTap({ x: 148, y: 220 }), true);
  assert.equal(calls[0].type, 'selectWorldMarchTarget');
  assert.equal(calls[0].tileId, 'tile_3_2');
  assert.equal(calls[0].known, false);
});

test('WorldMapRuntime camera helpers preserve render and hit target side effects', () => {
  const calls = [];
  const runtime = new WorldMapRuntime({
    renderer: { renderWorldMapLayer() {} },
    presenter: {},
    getBaseUiState: () => ({ selectedSiteId: 'capital', worldPanX: 4, worldPanY: 5 }),
    onCameraChanged(camera, options) {
      calls.push(['camera', camera.x, camera.y, options.source || 'none']);
    },
  });
  runtime.requestRender = (options = {}) => {
    calls.push(['render', Boolean(options.snapshotOnly), Boolean(options.reuseCachedWorldTileView)]);
    return true;
  };
  runtime.baseHitTargets = [{ x: 10, y: 20, action: { type: 'worldMapDrag' } }];
  runtime.bakedCamera = { x: 2, y: 3 };

  assert.deepEqual(runtime.syncCameraFromUi(), { x: 4, y: 5 });
  assert.deepEqual(runtime.getCameraUiState(), {
    selectedSiteId: 'capital',
    worldPanX: 4,
    worldPanY: 5,
  });
  assert.equal(runtime.setCamera(12, 8, { source: 'pinchPan', render: false }), true);
  assert.deepEqual(runtime.dragLayerOffset, { x: 10, y: 5 });
  assert.deepEqual(runtime.hitTargets[0], { x: 20, y: 25, action: { type: 'worldMapDrag' } });
  assert.equal(runtime.setCamera(12, 8), false);
  assert.deepEqual(calls, [
    ['camera', 12, 8, 'pinchPan'],
  ]);
});

test('WorldMapRuntime preserves stable map hit targets while refreshing actor targets during snapshot sync', () => {
  const mapTarget = {
    x: 10,
    y: 20,
    width: 80,
    height: 60,
    action: { type: 'openWorldSite', siteId: 'capital' },
  };
  const oldActorTarget = {
    x: 30,
    y: 40,
    width: 42,
    height: 42,
    action: { type: 'selectWorldActor', actorId: 'old' },
  };
  const nextActorTarget = {
    x: 50,
    y: 60,
    width: 42,
    height: 42,
    action: { type: 'selectWorldActor', actorId: 'next' },
  };
  const runtime = new WorldMapRuntime({
    renderer: {
      hitTargets: [],
      viewportOffsetX: 0,
      viewportOffsetY: 0,
      worldActorLayerRenderer: {
        hitTargets: [nextActorTarget],
      },
      renderWorldMapLayer() {},
    },
    presenter: {},
  });
  runtime.baseHitTargets = [mapTarget, oldActorTarget];

  runtime.syncHitTargetsFromRenderer({ preserveOnEmpty: true });

  assert.deepEqual(runtime.baseHitTargets, [mapTarget, nextActorTarget]);
  assert.equal(runtime.hitTargets.some((target) => target.action.type === 'openWorldSite'), true);
  assert.equal(runtime.hitTargets.some((target) => target.action.actorId === 'old'), false);
  assert.equal(runtime.hitTargets.some((target) => target.action.actorId === 'next'), true);
});

test('WorldMapRuntime drag helpers delegate camera math but keep map guards', () => {
  const calls = [];
  const runtime = new WorldMapRuntime({
    renderer: { renderWorldMapLayer() {} },
    presenter: {},
    onCameraChanged(camera, options) {
      calls.push(['camera', camera.x, camera.y, options.source]);
    },
  });
  runtime.canRender = () => true;
  runtime.isPointInMap = (point) => point.x >= 0 && point.y >= 0;
  runtime.requestRender = (options = {}) => {
    calls.push(['render', Boolean(options.snapshotOnly), options.force]);
    return true;
  };

  assert.equal(runtime.beginDrag({ pointerId: 1, x: -1, y: 10 }), false);
  assert.equal(runtime.beginDrag({ pointerId: 1, x: 20, y: 30 }), true);
  assert.equal(runtime.moveDrag({ pointerId: 2, x: 40, y: 55 }), false);
  assert.equal(runtime.moveDrag({ pointerId: 1, x: 40, y: 55 }), true);
  assert.deepEqual(runtime.camera, { x: 20, y: 25 });
  assert.equal(runtime.endDrag({ pointerId: 2 }), false);
  assert.equal(runtime.endDrag({ pointerId: 1 }), true);
  assert.equal(runtime.isDragging(), false);
  assert.deepEqual(calls, [
    ['camera', 20, 25, 'drag'],
    ['render', true, true],
  ]);
});

test('WorldMapRuntime input helpers delegate map rect resolution', () => {
  const runtime = new WorldMapRuntime({
    renderer: {
      renderWorldMapLayer() {},
      getWorldMapLayerLayout() {
        return { panel: {} };
      },
      viewportWidth: 360,
      viewportHeight: 640,
      bottomSafeArea: 10,
    },
    runtime: {
      getSystemInfo() {
        return { windowWidth: 390, windowHeight: 844 };
      },
    },
    presenter: {},
    getTopBarBottom: () => 48,
    getState: () => createState(),
  });

  assert.deepEqual(runtime.getInputMapRect(), {
    x: 0,
    y: 48,
    width: 360,
    height: 522,
  });
  assert.equal(runtime.isPointInMap({ x: 360, y: 570 }), true);
  assert.equal(runtime.isPointInMap({ x: 361, y: 570 }), false);
});

test('entrypoints load runtime policies before WorldMapRuntime', () => {
  const rootDir = path.resolve(__dirname, '../../..');
  const html = fs.readFileSync(path.join(rootDir, 'frontend/index.html'), 'utf8');
  const minigame = fs.readFileSync(path.join(rootDir, 'frontend/minigame/game.js'), 'utf8');

  [
    'WorldMapRuntimeBakePolicy.js',
    'WorldMapRuntimeCameraPolicy.js',
    'WorldMapRuntimeInputPolicy.js',
    'WorldMapRuntimeHitTargetPolicy.js',
    'WorldMapRuntimeRenderPolicy.js',
    'WorldMapRuntimeRenderPipeline.js',
  ].forEach((scriptName) => {
    assert.ok(
      html.indexOf(scriptName) >= 0,
      `index.html should load ${scriptName}`,
    );
    assert.ok(
      html.indexOf(scriptName) < html.indexOf('WorldMapRuntime.js'),
      `index.html should load ${scriptName} before WorldMapRuntime`,
    );
  });
  [
    "require('../js/platform/WorldMapRuntimeBakePolicy')",
    "require('../js/platform/WorldMapRuntimeCameraPolicy')",
    "require('../js/platform/WorldMapRuntimeInputPolicy')",
    "require('../js/platform/WorldMapRuntimeHitTargetPolicy')",
    "require('../js/platform/WorldMapRuntimeRenderPolicy')",
    "require('../js/platform/WorldMapRuntimeRenderPipeline')",
  ].forEach((requireText) => {
    assert.ok(
      minigame.indexOf(requireText) >= 0,
      `minigame should include ${requireText}`,
    );
    assert.ok(
      minigame.indexOf(requireText) < minigame.indexOf("require('../js/platform/WorldMapRuntime')"),
      `minigame should load ${requireText} before WorldMapRuntime`,
    );
  });
});
