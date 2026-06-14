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

test('TileMapGeometry sort order treats q/r as compatibility aliases', () => {
  const tiles = TileMapGeometry.sortTilesForIsoDraw([
    { id: 'b', x: 1, y: 0 },
    { id: 'a', q: 0, r: 0 },
    { id: 'c', x: 0, y: 1 },
  ]);

  assert.deepEqual(tiles.map((tile) => tile.id), ['a', 'b', 'c']);
});

test('TileMapGeometry fallback coordinate normalization does not preserve stale tile ids', () => {
  const originalTileCoord = globalThis.TileCoord;
  const tileCoordPath = require.resolve('./TileCoord');
  const modulePath = require.resolve('./TileMapGeometry');
  const originalTileCoordModule = require.cache[tileCoordPath];
  delete globalThis.TileCoord;
  require.cache[tileCoordPath] = {
    id: tileCoordPath,
    filename: tileCoordPath,
    loaded: true,
    exports: null,
  };
  delete require.cache[modulePath];
  const FallbackTileMapGeometry = require('./TileMapGeometry');

  try {
    assert.deepEqual(FallbackTileMapGeometry.normalizeCoord({
      x: 4,
      y: -2,
      q: 99,
      r: 99,
      tileId: 'legacy-away',
      id: 'legacy-id',
    }), {
      x: 4,
      y: -2,
      q: 4,
      r: -2,
      tileId: 'tile_4_-2',
    });
  } finally {
    if (originalTileCoord) globalThis.TileCoord = originalTileCoord;
    else delete globalThis.TileCoord;
    if (originalTileCoordModule) require.cache[tileCoordPath] = originalTileCoordModule;
    else delete require.cache[tileCoordPath];
    delete require.cache[modulePath];
    require('./TileMapGeometry');
  }
});
