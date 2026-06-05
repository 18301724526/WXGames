const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const GameStateRepository = require('../repositories/GameStateRepository');
const GameStateNormalizer = require('../services/GameStateNormalizer');

test('GameStateRepository persists task progress with the game state', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  const state = GameStateNormalizer.createInitialGameState('task-progress-repo-test');
  state.taskProgress.claimed.main_first_supplies = {
    claimedAt: '2026-06-05T00:00:00.000Z',
  };

  repository.save(state);
  const saved = repository.findByPlayerId('task-progress-repo-test');

  assert.deepEqual(saved.taskProgress.claimed.main_first_supplies, {
    claimedAt: '2026-06-05T00:00:00.000Z',
  });
  db.close();
});

test('GameStateRepository persists world explorer missions with the game state', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  const state = GameStateNormalizer.createInitialGameState('explore-mission-repo-test');
  state.exploreMissions = [{
    id: 'explore_random_1',
    status: 'active',
    route: [{ q: 1, r: 0, tileId: 'tile_1_0', revealed: false }],
    plannedTiles: [{ id: 'tile_1_0', q: 1, r: 0, terrain: 'plains' }],
    plannedSites: [{ siteId: 'site_1_0', tileId: 'tile_1_0', owner: 'neutral' }],
    formation: { cityId: 'capital', slot: 1, memberIds: ['fp-scout'] },
  }];

  repository.save(state);
  const saved = repository.findByPlayerId('explore-mission-repo-test');

  assert.equal(saved.exploreMissions.length, 1);
  assert.equal(saved.exploreMissions[0].id, 'explore_random_1');
  assert.equal(saved.exploreMissions[0].plannedTiles[0].id, 'tile_1_0');
  assert.equal(saved.exploreMissions[0].plannedSites[0].siteId, 'site_1_0');
  assert.equal(saved.exploreMissions[0].formation.memberIds[0], 'fp-scout');
  db.close();
});
