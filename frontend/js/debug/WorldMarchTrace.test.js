const test = require('node:test');
const assert = require('node:assert/strict');

const WorldMarchTrace = require('./WorldMarchTrace');

test('WorldMarchTrace derives coordinate-bearing mission summaries from coordinates', () => {
  const mission = {
    id: 'trace-mission',
    mode: 'manual',
    status: 'active',
    origin: { q: 1, r: -1, tileId: 'legacy-origin-tile' },
    target: { x: 3, y: -2, tileId: 'legacy-target-tile' },
    position: { q: 2, r: -1, tileId: 'legacy-position-tile' },
    route: [
      { q: 2, r: -1, tileId: 'legacy-route-step', revealed: true },
      { x: 3, y: -2, tileId: 'legacy-route-target' },
    ],
    plannedTiles: [
      { id: 'legacy-planned-tile', q: 3, r: -2, terrain: 'forest' },
    ],
    plannedSites: [],
    revealedTileIds: ['legacy-route-step', 'legacy-planned-tile'],
  };

  const summary = WorldMarchTrace.summarizeMission(mission);

  assert.equal(summary.origin.tileId, 'tile_1_-1');
  assert.equal(summary.target.tileId, 'tile_3_-2');
  assert.equal(summary.position.tileId, 'tile_2_-1');
  assert.deepEqual(summary.route.ids, ['tile_2_-1', 'tile_3_-2']);
  assert.deepEqual(summary.route.revealedIds, ['tile_2_-1']);
  assert.deepEqual(summary.revealedTileIds, ['tile_2_-1', 'tile_3_-2']);
  assert.equal(summary.route.first.tileId, 'tile_2_-1');
  assert.equal(summary.route.last.tileId, 'tile_3_-2');
  assert.deepEqual(summary.plannedTiles.ids, ['tile_3_-2']);
  assert.deepEqual(summary.plannedTiles.terrain, ['tile_3_-2:forest']);
  assert.equal(JSON.stringify(summary).includes('legacy-'), false);
});
