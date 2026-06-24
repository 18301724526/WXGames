const test = require('node:test');
const assert = require('node:assert/strict');

const WorldMarchRoutePolicy = require('./WorldMarchRoutePolicy');

test('WorldMarchRoutePolicy blocks known ocean tiles on the planned manual route', () => {
  const state = {
    activeCityId: 'capital',
    territoryState: {
      territories: [{ id: 'capital', q: 0, r: 0 }],
      worldMap: {
        tiles: [
          { q: 0, r: 0, terrain: 'capital', discovered: true },
          { q: 1, r: 0, terrain: 'plains', discovered: true },
          { q: 2, r: 0, terrain: 'ocean', discovered: true },
        ],
      },
    },
  };

  const result = WorldMarchRoutePolicy.evaluateMarchTarget(
    state,
    { q: 2, r: 0 },
    { tileMapView: state.territoryState.worldMap },
  );

  assert.equal(result.canMarch, false);
  assert.equal(result.reason, 'EXPLORE_ROUTE_BLOCKED');
  assert.deepEqual(result.blockedStep, { q: 2, r: 0, step: 2, tileId: 'tile_2_0' });
  assert.deepEqual(result.origin, { q: 0, r: 0, tileId: 'tile_0_0' });
});

test('WorldMarchRoutePolicy derives origin from an idle selected mission before city fallback', () => {
  const state = {
    activeCityId: 'capital',
    worldExplorerState: {
      missions: [{
        id: 'idle-1',
        status: 'idle',
        position: { q: 4, r: -2 },
      }],
    },
    territoryState: {
      territories: [{ id: 'capital', q: 0, r: 0 }],
      worldMap: {
        tiles: [
          { q: 4, r: -2, terrain: 'plains', discovered: true },
          { q: 5, r: -2, terrain: 'plains', discovered: true },
        ],
      },
    },
  };

  const result = WorldMarchRoutePolicy.evaluateMarchTarget(
    state,
    { q: 5, r: -2, missionId: 'idle-1' },
    { tileMapView: state.territoryState.worldMap },
  );

  assert.equal(result.canMarch, true);
  assert.deepEqual(result.origin, { q: 4, r: -2, tileId: 'tile_4_-2' });
  assert.deepEqual(result.route, [{ q: 5, r: -2, step: 1, tileId: 'tile_5_-2' }]);
});
