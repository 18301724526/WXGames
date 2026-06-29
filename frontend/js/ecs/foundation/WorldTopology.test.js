const test = require('node:test');
const assert = require('node:assert/strict');

require('./TileCoord');
const WorldTopology = require('./WorldTopology');

test('WorldTopology normalizes coordinates on a full wrapping torus', () => {
  assert.deepEqual(WorldTopology.normalizeCoord({ x: -1, y: 8 }, { width: 8, height: 6 }), {
    x: 7,
    y: 2,
    q: 7,
    r: 2,
    tileId: 'tile_7_2',
    worldWidth: 8,
    worldHeight: 6,
    wrapped: true,
  });

  assert.equal(
    WorldTopology.normalizeCoord({ q: 8, r: -1 }, { width: 8, height: 6 }).tileId,
    'tile_0_5',
  );
});

test('WorldTopology can expose unwrapped coordinates for authoring and migration tools', () => {
  const coord = WorldTopology.normalizeCoord(
    { x: -2, y: 9 },
    { width: 8, height: 6, wrapping: false },
  );

  assert.equal(coord.x, -2);
  assert.equal(coord.y, 9);
  assert.equal(coord.tileId, 'tile_-2_9');
  assert.equal(coord.wrapped, false);
});

test('WorldTopology resolves shortest full-direction wrapped deltas and distances', () => {
  assert.deepEqual(
    WorldTopology.getDelta({ x: 0, y: 0 }, { x: 7, y: 5 }, { width: 8, height: 6 }),
    {
      x: -1,
      y: -1,
      q: -1,
      r: -1,
    },
  );

  assert.equal(
    WorldTopology.getWrappedDistance({ x: 0, y: 0 }, { x: 7, y: 5 }, { width: 8, height: 6 }),
    1,
  );
});

test('WorldTopology offsets across every edge and returns normalized tile ids', () => {
  assert.equal(
    WorldTopology.offset({ x: 7, y: 5 }, { x: 1, y: 1 }, { width: 8, height: 6 }).tileId,
    'tile_0_0',
  );
  assert.equal(
    WorldTopology.offset({ q: 0, r: 0 }, { q: -1, r: -1 }, { width: 8, height: 6 }).tileId,
    'tile_7_5',
  );
});
