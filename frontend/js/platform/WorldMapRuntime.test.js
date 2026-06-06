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
