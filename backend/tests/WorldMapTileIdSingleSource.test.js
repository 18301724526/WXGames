const test = require('node:test');
const assert = require('node:assert/strict');

const WorldMapShared = require('../services/worldMap/WorldMapShared');
const WorldMapTopology = require('../services/worldMap/WorldMapTopology');

// Backend tile-id format single-source: the worldMap/territory family derives `tile_<q>_<r>`
// from ONE place (WorldMapTopology.getTileId, the tile-identity owner). WorldMapShared.getTileId
// — re-exported as WorldMapService.getTileId and delegated to by the territory wrappers — was a
// raw `tile_${q}_${r}` duplicate; it now delegates to the floored Topology form.

test('WorldMapShared.getTileId delegates to WorldMapTopology.getTileId (single source, floored)', () => {
  // integer coords (the contract: parseTileId only matches integers) — identity format
  assert.equal(WorldMapShared.getTileId(2, -3), 'tile_2_-3');
  assert.equal(WorldMapTopology.getTileId(2, -3), 'tile_2_-3');

  // floored: a fractional coord maps to its containing tile (was raw `tile_1.9_2.1` before
  // single-sourcing — an unparseable id; flooring is the behavior-safe, correct form)
  assert.equal(WorldMapShared.getTileId(1.9, 2.1), 'tile_1_2');

  // both names resolve to the same source
  assert.equal(WorldMapShared.getTileId(4.7, -5.2), WorldMapTopology.getTileId(4.7, -5.2));
});
