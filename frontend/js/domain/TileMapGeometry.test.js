const test = require('node:test');
const assert = require('node:assert/strict');

require('./TileCoord');
const TileMapGeometry = require('./TileMapGeometry');

test('TileMapGeometry projects diamond isometric square tiles from stable x/y coordinates', () => {
  const geometry = { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 };

  assert.deepEqual(TileMapGeometry.projectTile({ x: 3, y: -2 }, geometry), {
    x: 480,
    y: 48,
  });
  assert.deepEqual(TileMapGeometry.projectTile({ q: 3, r: -2 }, geometry), {
    x: 480,
    y: 48,
  });
});

test('TileMapGeometry converts screen points back to stable tile coordinates', () => {
  const geometry = { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 };
  const viewport = { originX: 100, originY: 100, panX: 10, panY: -5, scale: 0.5 };
  const center = TileMapGeometry.getTileScreenCenter({ x: 3, y: -2 }, viewport, geometry);
  const coord = TileMapGeometry.screenPointToCoord(center, viewport, geometry);

  assert.deepEqual(coord, {
    x: 3,
    y: -2,
    q: 3,
    r: -2,
    tileId: 'tile_3_-2',
  });
});

test('TileMapGeometry projects non-zero world origins around the local viewport center', () => {
  const geometry = { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 };
  const viewport = { originX: 216, originY: 337, panX: 0, panY: 0, scale: 0.78, worldOrigin: { q: 28, r: 9 } };
  const center = TileMapGeometry.getTileScreenCenter({ q: 28, r: 9 }, viewport, geometry);
  const coord = TileMapGeometry.screenPointToCoord(center, viewport, geometry);

  assert.deepEqual(center, { x: 216, y: 337 });
  assert.deepEqual(coord, {
    x: 28,
    y: 9,
    q: 28,
    r: 9,
    tileId: 'tile_28_9',
  });
});

test('TileMapGeometry sort order treats q/r as compatibility aliases', () => {
  const tiles = TileMapGeometry.sortTilesForIsoDraw([
    { id: 'b', x: 1, y: 0 },
    { id: 'a', q: 0, r: 0 },
    { id: 'c', x: 0, y: 1 },
  ]);

  assert.deepEqual(tiles.map((tile) => tile.id), ['a', 'b', 'c']);
});
