const test = require('node:test');
const assert = require('node:assert/strict');

require('./TileCoord');
require('./WorldTopology');
const WorldChunkAddress = require('./WorldChunkAddress');

const topology = {
  worldWidth: 16,
  worldHeight: 12,
  chunkWidth: 4,
  chunkHeight: 3,
};

test('WorldChunkAddress maps stable tile coordinates into chunk addresses', () => {
  const chunk = WorldChunkAddress.getChunkCoordForTile({ x: 7, y: 5 }, topology);

  assert.equal(chunk.chunkId, 'chunk_1_1');
  assert.equal(chunk.chunkX, 1);
  assert.equal(chunk.chunkY, 1);
  assert.equal(chunk.col, 1);
  assert.equal(chunk.row, 1);
});

test('WorldChunkAddress wraps chunk addresses across every world edge', () => {
  assert.equal(WorldChunkAddress.getChunkCoordForTile({ x: -1, y: -1 }, topology).chunkId, 'chunk_3_3');
  assert.equal(WorldChunkAddress.normalizeChunkCoord({ chunkX: 4, chunkY: 4 }, topology).chunkId, 'chunk_0_0');
});

test('WorldChunkAddress exposes chunk bounds without assuming full world arrays', () => {
  assert.deepEqual(WorldChunkAddress.getChunkBounds({ chunkX: 3, chunkY: 3 }, topology), {
    chunkId: 'chunk_3_3',
    chunkX: 3,
    chunkY: 3,
    minX: 12,
    minY: 9,
    maxX: 15,
    maxY: 11,
    width: 4,
    height: 3,
  });
});

test('WorldChunkAddress expands wrapped tile rects into unique chunk lists', () => {
  const chunks = WorldChunkAddress.getChunksForTileRect({
    minX: 14,
    minY: 10,
    maxX: 17,
    maxY: 13,
  }, topology);

  assert.deepEqual(chunks.map((chunk) => chunk.chunkId), [
    'chunk_0_0',
    'chunk_3_0',
    'chunk_0_3',
    'chunk_3_3',
  ]);
});
