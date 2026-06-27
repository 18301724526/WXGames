const test = require('node:test');
const assert = require('node:assert/strict');

require('./TileCoord');
require('./WorldTopology');
require('./WorldChunkAddress');
require('./WorldInterestWindow');
const WorldRevealStore = require('./WorldRevealStore');

const topology = {
  worldWidth: 16,
  worldHeight: 12,
  chunkWidth: 4,
  chunkHeight: 3,
};

test('WorldRevealStore persists revealed terrain records by tile and chunk', () => {
  const store = WorldRevealStore.createStore({
    version: 3,
    tiles: [
      { x: 1, y: 1, terrain: 'plains', visible: true, siteId: 'capital' },
      { q: 5, r: 4, terrain: 'forest', visibility: 'explored' },
    ],
  }, topology);

  assert.equal(store.schema, 'world-reveal-store-v1');
  assert.equal(store.version, 3);
  assert.equal(WorldRevealStore.isRevealed(store, { x: 1, y: 1 }), true);
  assert.equal(WorldRevealStore.getTile(store, 'tile_5_4').terrain, 'forest');
  assert.deepEqual(WorldRevealStore.getTilesForChunk(store, 'chunk_0_0').map((tile) => tile.tileId), ['tile_1_1']);
  assert.deepEqual(store.materializedChunkIds, ['chunk_0_0', 'chunk_1_1']);
});

test('WorldRevealStore merges duplicate revealed records without downgrading intel', () => {
  const store = WorldRevealStore.createStore({
    tiles: [
      { x: 1, y: 1, terrain: 'plains', visibility: 'visible', intelLevel: 3, siteId: 'capital' },
      { x: 1, y: 1, terrain: 'plains', visibility: 'explored', intelLevel: 1 },
    ],
  }, topology);
  const tile = WorldRevealStore.getTile(store, { x: 1, y: 1 });

  assert.equal(tile.visibility, 'visible');
  assert.equal(tile.intelLevel, 3);
  assert.equal(tile.siteId, 'capital');
});

test('WorldRevealStore returns only revealed records for a streaming interest window', () => {
  const interestWindow = globalThis.WorldInterestWindow.createWindow({ x: 4, y: 3 }, {
    ...topology,
    radiusX: 1,
    radiusY: 1,
    preloadRadiusX: 4,
    preloadRadiusY: 3,
  });
  const store = WorldRevealStore.createStore({
    tiles: [
      { x: 4, y: 3, terrain: 'plains' },
      { x: 14, y: 10, terrain: 'desert' },
    ],
  }, topology);

  assert.deepEqual(WorldRevealStore.getTilesForWindow(store, interestWindow).map((tile) => tile.tileId), ['tile_4_3']);
});

test('WorldRevealStore returns no window tiles when interest window data is omitted', () => {
  const store = WorldRevealStore.createStore({
    tiles: [
      { x: 4, y: 3, terrain: 'plains' },
    ],
  }, topology);

  assert.deepEqual(WorldRevealStore.getTilesForWindow(store), []);
  assert.deepEqual(WorldRevealStore.getTilesForWindow(store, {}), []);
});

test('WorldRevealStore serializes without renderer payloads or full world arrays', () => {
  const store = WorldRevealStore.createStore({
    tiles: [
      { x: 1, y: 1, terrain: 'plains' },
    ],
  }, topology);
  const serializable = WorldRevealStore.toSerializable(store);

  assert.equal(serializable.tiles.length, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(serializable, 'worldMap'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(serializable, 'canvas'), false);
});
