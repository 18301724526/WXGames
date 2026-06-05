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
