const test = require('node:test');
const assert = require('node:assert/strict');

require('./WorldMapVisibilityModel');
require('./TileMapGeometry');
require('./WorldTime');
require('./WorldMarchSystem');
const WorldMapEntitySnapshot = require('./WorldMapEntitySnapshot');

function createInput() {
  return {
    territoryState: {
      worldMap: {
        version: 3,
        seed: 'seed-1',
        tiles: [
          { q: 0, r: 0, terrain: 'capital', siteId: 'capital', visibility: 'controlled' },
          { q: 1, r: 0, terrain: 'plains', visibility: 'scouted' },
        ],
      },
      territories: [
        { id: 'capital', x: 0, y: 0, type: 'capital', owner: 'player', cityName: 'Capital' },
      ],
    },
    worldExplorerState: {
      activeMission: {
        id: 'mission-1',
        kind: 'worldExplore',
        status: 'active',
        origin: { q: 0, r: 0, tileId: 'tile_0_0' },
        target: { q: 1, r: 0, tileId: 'tile_1_0' },
        position: { q: 1, r: 0, tileId: 'tile_1_0' },
        route: [{ q: 1, r: 0, tileId: 'tile_1_0', step: 1, revealed: true }],
        revealedTileIds: ['tile_1_0'],
        formation: { cityId: 'capital', slot: 1 },
        startedAt: '2026-06-06T00:00:00.000Z',
        completesAt: '2026-06-06T00:01:00.000Z',
      },
    },
  };
}

test('WorldMapEntitySnapshot normalizes tiles, sites, missions, and actors', () => {
  const snapshot = WorldMapEntitySnapshot.createSnapshot(createInput(), {
    nowMs: new Date('2026-06-06T00:00:10.000Z').getTime(),
  });

  assert.equal(snapshot.schema, 'world-map-entity-snapshot-v1');
  assert.equal(snapshot.counts.tiles, 2);
  assert.equal(snapshot.counts.sites, 1);
  assert.equal(snapshot.counts.missions, 1);
  assert.equal(snapshot.counts.actors, 1);
  assert.equal(WorldMapEntitySnapshot.getEntity(snapshot, 'tiles', 'tile_0_0').terrain, 'capital');
  assert.equal(WorldMapEntitySnapshot.getEntity(snapshot, 'sites', 'capital').name, 'Capital');
  assert.equal(WorldMapEntitySnapshot.getEntity(snapshot, 'missions', 'mission-1').position.tileId, 'tile_1_0');
  assert.equal(WorldMapEntitySnapshot.getEntity(snapshot, 'actors', 'mission-1').tileId, 'tile_1_0');
});

test('WorldMapEntitySnapshot uses compact indexes and stable signatures', () => {
  const first = WorldMapEntitySnapshot.createSnapshot(createInput(), {
    actors: [{ id: 'actor-1', current: { q: 1, r: 0 }, status: 'idle' }],
  });
  const second = WorldMapEntitySnapshot.createSnapshot(createInput(), {
    actors: [{ id: 'actor-1', current: { q: 1, r: 0 }, status: 'idle' }],
  });

  assert.equal(first.signature, second.signature);
  assert.equal(first.indexById.tiles.tile_1_0, 1);
  assert.equal(first.indexById.actors['actor-1'], 0);
  assert.equal(Object.prototype.hasOwnProperty.call(first, 'entitiesById'), false);
});

test('WorldMapEntitySnapshot handles large tile sets without nested entity maps', () => {
  const tiles = [];
  for (let i = 0; i < 4000; i += 1) {
    tiles.push({ q: i, r: -i, terrain: i % 2 ? 'plains' : 'forest', visibility: i % 5 ? 'scouted' : 'unknown' });
  }
  const snapshot = WorldMapEntitySnapshot.createSnapshot({ worldMap: { version: 9, tiles } });

  assert.equal(snapshot.counts.tiles, 4000);
  assert.equal(snapshot.tiles.length, 4000);
  assert.equal(snapshot.indexById.tiles['tile_3999_-3999'], 3999);
  assert.equal(snapshot.signature.startsWith('9:4000:0:0:0:'), true);
});
