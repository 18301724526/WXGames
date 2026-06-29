const test = require('node:test');
const assert = require('node:assert/strict');

const TileCoord = require('./TileCoord');

test('TileCoord normalizes stable x/y coordinates and legacy q/r aliases', () => {
  assert.deepEqual(TileCoord.normalizeCoord({ x: '3.8', y: '-2.1' }), {
    x: 3,
    y: -3,
    q: 3,
    r: -3,
    tileId: 'tile_3_-3',
  });

  assert.deepEqual(TileCoord.normalizeCoord({ q: '7', r: '4' }), {
    x: 7,
    y: 4,
    q: 7,
    r: 4,
    tileId: 'tile_7_4',
  });
});

test('TileCoord prefers stable x/y over q/r when both are present', () => {
  const coord = TileCoord.normalizeCoord({
    x: 5,
    y: 6,
    q: 99,
    r: 99,
    tileId: 'stale-id',
  });

  assert.equal(coord.x, 5);
  assert.equal(coord.y, 6);
  assert.equal(coord.q, 5);
  assert.equal(coord.r, 6);
  assert.equal(coord.tileId, 'tile_5_6');
});

test('TileCoord keeps explicit legacy tile ids only when requested', () => {
  assert.equal(TileCoord.normalizeCoord({ x: 1, y: 2, tileId: 'legacy' }).tileId, 'tile_1_2');
  assert.equal(TileCoord.normalizeCoord({ x: 1, y: 2, tileId: 'legacy' }, {}, { preserveTileId: true }).tileId, 'legacy');
});

test('TileCoord offsets and compares coordinates through the stable axes', () => {
  const moved = TileCoord.offset({ q: 4, r: 4 }, { x: -1, y: 2 });

  assert.deepEqual(moved, {
    x: 3,
    y: 6,
    q: 3,
    r: 6,
    tileId: 'tile_3_6',
  });
  assert.equal(TileCoord.equals(moved, { x: 3, y: 6 }), true);
  assert.deepEqual(TileCoord.toLegacy(moved), { q: 3, r: 6, tileId: 'tile_3_6' });
});
