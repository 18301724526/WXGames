const test = require('node:test');
const assert = require('node:assert/strict');

const WorldMapVisibilityModel = require('./WorldMapVisibilityModel');

test('WorldMapVisibilityModel normalizes tile visibility into serializable arrays', () => {
  const snapshot = WorldMapVisibilityModel.createSnapshot({
    worldMap: {
      version: 7,
      tiles: [
        { q: 0, r: 0, visibility: 'controlled', siteId: 'capital', intel: { level: 4 } },
        { q: 1, r: 0, visibility: 'scouted', intel: { level: 1 } },
        { q: 2, r: 0, visibility: 'unknown', discovered: false, visible: false },
      ],
    },
  });

  assert.equal(snapshot.schema, 'world-map-visibility-v1');
  assert.equal(snapshot.version, 7);
  assert.deepEqual(snapshot.tileIds, ['tile_0_0', 'tile_1_0', 'tile_2_0']);
  assert.deepEqual(snapshot.levels, [
    WorldMapVisibilityModel.LEVEL_CONTROLLED,
    WorldMapVisibilityModel.LEVEL_EXPLORED,
    WorldMapVisibilityModel.LEVEL_UNKNOWN,
  ]);
  assert.deepEqual(snapshot.counts, { unknown: 1, explored: 1, visible: 0, controlled: 1 });
  assert.equal(JSON.parse(JSON.stringify(snapshot)).tileIds.length, 3);
});

test('WorldMapVisibilityModel canonicalizes tile identity through stable axes', () => {
  assert.deepEqual(WorldMapVisibilityModel.normalizeCoord({
    x: 4,
    y: -2,
    q: 99,
    r: 99,
    tileId: 'legacy-visibility',
    id: 'legacy-id',
  }), {
    q: 4,
    r: -2,
    tileId: 'tile_4_-2',
  });
});

test('WorldMapVisibilityModel merges x/y and legacy q/r shapes into one visibility entry', () => {
  const snapshot = WorldMapVisibilityModel.createSnapshot({
    worldMap: {
      version: 8,
      tiles: [
        { x: 4, y: -2, q: 99, r: 99, tileId: 'legacy-visible', visibility: 'visible' },
        { x: 4, y: -2, q: 88, r: 88, id: 'legacy-controlled', visibility: 'controlled' },
      ],
    },
  });

  assert.deepEqual(snapshot.tileIds, ['tile_4_-2']);
  assert.deepEqual(snapshot.q, [4]);
  assert.deepEqual(snapshot.r, [-2]);
  assert.equal(WorldMapVisibilityModel.getLevel(snapshot, 'tile_4_-2'), WorldMapVisibilityModel.LEVEL_CONTROLLED);
  assert.deepEqual(snapshot.counts, { unknown: 0, explored: 0, visible: 0, controlled: 1 });
});

test('WorldMapVisibilityModel applies mission reveals without downgrading stronger tile visibility', () => {
  const snapshot = WorldMapVisibilityModel.createSnapshot({
    worldMap: {
      tiles: [
        { q: 1, r: 0, visibility: 'controlled' },
        { q: 2, r: 0, visibility: 'unknown', discovered: false },
      ],
    },
    worldExplorerState: {
      activeMission: {
        id: 'mission-1',
        status: 'active',
        position: { q: 2, r: 0 },
        revealedTileIds: ['tile_1_0'],
        route: [
          { q: 1, r: 0, tileId: 'tile_1_0' },
          { q: 2, r: 0, tileId: 'tile_2_0' },
        ],
      },
    },
  });

  assert.equal(WorldMapVisibilityModel.getLevel(snapshot, 'tile_1_0'), WorldMapVisibilityModel.LEVEL_CONTROLLED);
  assert.equal(WorldMapVisibilityModel.getLevel(snapshot, 'tile_2_0'), WorldMapVisibilityModel.LEVEL_VISIBLE);
  assert.equal(WorldMapVisibilityModel.isExplored(snapshot, 'tile_2_0'), true);
  assert.equal(WorldMapVisibilityModel.isVisible(snapshot, 'tile_2_0'), true);
});

test('WorldMapVisibilityModel keeps signatures stable and data compact for large maps', () => {
  const tiles = [];
  for (let i = 0; i < 5000; i += 1) {
    tiles.push({
      q: i,
      r: -i,
      visibility: i % 10 === 0 ? 'controlled' : (i % 3 === 0 ? 'unknown' : 'scouted'),
      discovered: i % 3 !== 0,
    });
  }

  const first = WorldMapVisibilityModel.createSnapshot({ worldMap: { version: 2, tiles } });
  const second = WorldMapVisibilityModel.createSnapshot({ worldMap: { version: 2, tiles } });

  assert.equal(first.tileIds.length, 5000);
  assert.equal(first.levels.length, 5000);
  assert.equal(first.signature, second.signature);
  assert.equal(Object.prototype.hasOwnProperty.call(first, 'entries'), false);
  assert.equal(WorldMapVisibilityModel.getLevel(first, 'tile_10_-10'), WorldMapVisibilityModel.LEVEL_CONTROLLED);
});
