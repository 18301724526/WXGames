'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GAME_STATE_BASELINE_MIGRATION,
  TASK_REWARD_GRANTS_MIGRATION,
} = require('../migrations/immutableGameStateMigrations');
const { normalizeMigration } = require('../services/SchemaMigrationService');

test('published game-state migration checksums remain immutable', () => {
  const normalized = [
    GAME_STATE_BASELINE_MIGRATION,
    TASK_REWARD_GRANTS_MIGRATION,
  ].map(normalizeMigration);

  assert.deepEqual(
    normalized.map(({ id, checksum }) => ({ id, checksum })),
    [
      { id: '001-game-states-compat-columns', checksum: 'a826520de5505131' },
      { id: '005-task-reward-grants-column', checksum: 'fca3b1afc0462255' },
    ],
  );
});
