'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const GameStateRepository = require('../repositories/GameStateRepository');
const GameStateNormalizer = require('../services/GameStateNormalizer');
const {
  GAME_STATE_BASELINE_MIGRATION,
} = require('../migrations/immutableGameStateMigrations');
const {
  CURRENT_GAME_STATE_COLUMN_NAMES,
  CURRENT_GAME_STATE_SCHEMA_MIGRATION,
} = require('../migrations/currentGameStateSchemaMigration');

function getGameStateColumnNames(db) {
  return db.prepare('PRAGMA table_info(game_states)').all().map((column) => column.name);
}

test('fresh databases finish with exactly the current game-state columns', () => {
  const db = new Database(':memory:');
  try {
    new GameStateRepository(db).init();

    assert.deepEqual(getGameStateColumnNames(db), CURRENT_GAME_STATE_COLUMN_NAMES);
    assert.equal(
      db.prepare('SELECT status FROM schema_migrations WHERE id = ?')
        .get(CURRENT_GAME_STATE_SCHEMA_MIGRATION.id).status,
      'applied',
    );
  } finally {
    db.close();
  }
});

test('existing databases rebuild to the current columns without losing game state', () => {
  const db = new Database(':memory:');
  try {
    const repository = new GameStateRepository(db);
    repository.init();
    const state = GameStateNormalizer.createInitialGameState('current-schema-upgrade-test');
    state.gameDay = 37;
    state.taskProgress.claimed.schema_upgrade_task = {
      claimedAt: '2026-07-14T00:00:00.000Z',
    };
    repository.save(state);

    GAME_STATE_BASELINE_MIGRATION.apply(db);
    const allowed = new Set(CURRENT_GAME_STATE_COLUMN_NAMES);
    const extraColumns = getGameStateColumnNames(db).filter((name) => !allowed.has(name));
    assert.equal(extraColumns.length, 2);
    const assignments = extraColumns.map((name) => `"${name.replace(/"/g, '""')}" = ?`).join(', ');
    db.prepare(`UPDATE game_states SET ${assignments} WHERE playerId = ?`).run(
      ...extraColumns.map(() => JSON.stringify({ retired: true })),
      state.playerId,
    );
    db.prepare('DELETE FROM schema_migrations WHERE id = ?')
      .run(CURRENT_GAME_STATE_SCHEMA_MIGRATION.id);

    const upgradedRepository = new GameStateRepository(db);
    upgradedRepository.init();
    const upgraded = upgradedRepository.findByPlayerId(state.playerId);

    assert.deepEqual(getGameStateColumnNames(db), CURRENT_GAME_STATE_COLUMN_NAMES);
    assert.equal(upgraded.gameDay, 37);
    assert.deepEqual(upgraded.taskProgress.claimed.schema_upgrade_task, {
      claimedAt: '2026-07-14T00:00:00.000Z',
    });
  } finally {
    db.close();
  }
});
