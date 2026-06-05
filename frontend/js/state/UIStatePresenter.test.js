const test = require('node:test');
const assert = require('node:assert/strict');

const UIStatePresenter = require('./UIStatePresenter');

test('UIStatePresenter merges server-planned explorer tiles into the world tile view', () => {
  const view = UIStatePresenter.buildWorldTileMapViewState({
    worldMap: {
      version: 1,
      seed: 'presenter-explorer-seed',
      tiles: [{
        id: 'tile_0_0',
        q: 0,
        r: 0,
        terrain: 'capital',
        visibility: 'controlled',
        siteId: 'capital',
      }],
    },
    territories: [{
      id: 'capital',
      x: 0,
      y: 0,
      type: 'capital',
      owner: 'player',
      status: 'occupied',
      cityName: 'Capital',
    }],
    scoutMissions: [],
  }, {
    worldExplorerState: {
      activeMission: {
        id: 'explore-1',
        status: 'active',
        route: [
          { q: 1, r: 0, step: 1, tileId: 'tile_1_0', revealed: false },
          { q: 2, r: 0, step: 2, tileId: 'tile_2_0', revealed: false },
        ],
        plannedTiles: [
          { id: 'tile_1_0', q: 1, r: 0, terrain: 'plains', visibility: 'scouted' },
          { id: 'tile_2_0', q: 2, r: 0, terrain: 'forest', visibility: 'scouted' },
        ],
        revealedTileIds: [],
      },
    },
  });

  assert.equal(view.tiles.some((tile) => tile.id === 'tile_1_0' && tile.terrain === 'plains'), true);
  assert.equal(view.tiles.some((tile) => tile.id === 'tile_2_0' && tile.terrain === 'forest'), true);
  assert.equal(view.activeScouts.length, 1);
  assert.equal(view.activeScouts[0].kind, 'worldExplore');
  assert.equal(view.activeScouts[0].route.length, 2);
});
