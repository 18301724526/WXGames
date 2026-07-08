const test = require('node:test');
const assert = require('node:assert/strict');

require('./TileCoord');
require('./WorldTopology');
require('./WorldChunkAddress');
const WorldInterestWindow = require('./WorldInterestWindow');

const topology = {
  worldWidth: 32,
  worldHeight: 24,
  chunkWidth: 8,
  chunkHeight: 6,
};

test('WorldInterestWindow creates visible preload and AOI windows from one center', () => {
  const interestWindow = WorldInterestWindow.createWindow(
    { x: 10, y: 9 },
    {
      ...topology,
      radiusX: 2,
      radiusY: 1,
      preloadRadiusX: 8,
      preloadRadiusY: 6,
      aoiRadiusX: 12,
      aoiRadiusY: 8,
    },
  );

  assert.equal(interestWindow.schema, 'world-interest-window-v1');
  assert.deepEqual(interestWindow.visibleRect, {
    centerX: 10,
    centerY: 9,
    minX: 8,
    minY: 8,
    maxX: 12,
    maxY: 10,
    width: 5,
    height: 3,
  });
  assert.deepEqual(WorldInterestWindow.getChunkIds(interestWindow, 'visibleChunks'), ['chunk_1_1']);
  assert.ok(interestWindow.counts.preloadChunks > interestWindow.counts.visibleChunks);
  assert.ok(interestWindow.counts.aoiChunks >= interestWindow.counts.preloadChunks);
});

test('WorldInterestWindow includes wrapped preload chunks near world edges', () => {
  const interestWindow = WorldInterestWindow.createWindow(
    { x: 0, y: 0 },
    {
      ...topology,
      radiusX: 1,
      radiusY: 1,
      preloadRadiusX: 3,
      preloadRadiusY: 3,
      aoiRadiusX: 3,
      aoiRadiusY: 3,
    },
  );

  assert.deepEqual(WorldInterestWindow.getChunkIds(interestWindow, 'preloadChunks'), [
    'chunk_0_0',
    'chunk_3_0',
    'chunk_0_3',
    'chunk_3_3',
  ]);
});

test('WorldInterestWindow checks wrapped tile membership near world edges', () => {
  const interestWindow = WorldInterestWindow.createWindow(
    { x: 0, y: 0 },
    {
      ...topology,
      radiusX: 1,
      radiusY: 1,
    },
  );

  assert.equal(WorldInterestWindow.containsTile(interestWindow, { x: 31, y: 0 }), true);
  assert.equal(WorldInterestWindow.containsTile(interestWindow, { x: 0, y: 23 }), true);
  assert.equal(WorldInterestWindow.containsTile(interestWindow, { x: 30, y: 0 }), false);
});

test('WorldInterestWindow checks tile membership without reading map tiles', () => {
  const interestWindow = WorldInterestWindow.createWindow(
    { x: 10, y: 9 },
    {
      ...topology,
      radiusX: 2,
      radiusY: 1,
    },
  );

  assert.equal(WorldInterestWindow.containsTile(interestWindow, { x: 8, y: 8 }), true);
  assert.equal(WorldInterestWindow.containsTile(interestWindow, { x: 13, y: 8 }), false);
});

test('WorldInterestWindow keeps empty interest window defaults unchanged', () => {
  assert.deepEqual(WorldInterestWindow.getChunkIds(), []);
  assert.deepEqual(WorldInterestWindow.getChunkIds({}), []);
  assert.equal(WorldInterestWindow.containsTile({}, { x: 0, y: 0 }), true);
  assert.equal(WorldInterestWindow.containsTile({}, { x: 1, y: 0 }), false);
});
