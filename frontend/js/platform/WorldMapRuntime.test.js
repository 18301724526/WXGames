const test = require('node:test');
const assert = require('node:assert/strict');

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
      readyMissions: [],
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
