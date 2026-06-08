const test = require('node:test');
const assert = require('node:assert/strict');

const GameStateMigrationPipeline = require('../services/GameStateMigrationPipeline');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('GameStateMigrationPipeline upgrades legacy saves to the current schema metadata', () => {
  const raw = {
    playerId: 'legacy-save',
    resources: { food: 10, metal: 3 },
    eventQueue: null,
    taskProgress: {},
  };
  const original = clone(raw);

  const result = GameStateMigrationPipeline.migrateState(raw, { now: new Date('2026-06-08T00:00:00.000Z') });

  assert.equal(result.changed, true);
  assert.equal(result.fromVersion, 0);
  assert.equal(result.toVersion, GameStateMigrationPipeline.CURRENT_SCHEMA_VERSION);
  assert.deepEqual(result.appliedMigrations, ['initialize-save-schema-v1']);
  assert.equal(result.state.saveMetadata.schema, GameStateMigrationPipeline.SAVE_SCHEMA_NAME);
  assert.equal(result.state.saveMetadata.schemaVersion, 1);
  assert.deepEqual(result.state.saveMetadata.migrations, [{
    id: 'initialize-save-schema-v1',
    fromVersion: 0,
    toVersion: 1,
    migratedAt: '2026-06-08T00:00:00.000Z',
  }]);
  assert.equal(result.state.resources.iron, 3);
  assert.equal(result.state.resources.metal, 3);
  assert.deepEqual(result.state.eventQueue, []);
  assert.deepEqual(result.state.taskProgress.claimed, {});
  assert.deepEqual(raw, original);
});

test('GameStateMigrationPipeline keeps current saves idempotent', () => {
  const current = {
    playerId: 'current-save',
    resources: { food: 10, iron: 2, metal: 2 },
    saveMetadata: GameStateMigrationPipeline.createSaveMetadata({
      schemaVersion: GameStateMigrationPipeline.CURRENT_SCHEMA_VERSION,
      migrations: [{ id: 'initialize-save-schema-v1', fromVersion: 0, toVersion: 1, migratedAt: '2026-06-08T00:00:00.000Z' }],
    }),
  };

  const result = GameStateMigrationPipeline.migrateState(current);

  assert.equal(result.changed, false);
  assert.equal(result.fromVersion, 1);
  assert.equal(result.toVersion, 1);
  assert.deepEqual(result.appliedMigrations, []);
  assert.deepEqual(result.state.saveMetadata.migrations, current.saveMetadata.migrations);
});

test('GameStateMigrationPipeline supports custom ordered migrations', () => {
  const pipeline = GameStateMigrationPipeline.createPipeline([
    {
      id: 'v0-to-v1',
      fromVersion: 0,
      toVersion: 1,
      apply(state) {
        state.first = true;
      },
    },
    {
      id: 'v1-to-v2',
      fromVersion: 1,
      toVersion: 2,
      apply(state) {
        state.second = state.first === true;
      },
    },
  ], { currentSchemaVersion: 2 });

  const result = pipeline.migrateState({ playerId: 'custom-pipeline' }, { now: '2026-06-08T01:00:00.000Z' });

  assert.equal(result.toVersion, 2);
  assert.deepEqual(result.appliedMigrations, ['v0-to-v1', 'v1-to-v2']);
  assert.equal(result.state.first, true);
  assert.equal(result.state.second, true);
  assert.equal(result.state.saveMetadata.schemaVersion, 2);
  assert.deepEqual(result.state.saveMetadata.migrations.map((entry) => entry.id), ['v0-to-v1', 'v1-to-v2']);
});

test('GameStateMigrationPipeline fails loudly when a schema step is missing', () => {
  const pipeline = GameStateMigrationPipeline.createPipeline([
    {
      id: 'v1-to-v2',
      fromVersion: 1,
      toVersion: 2,
      apply(state) {
        state.second = true;
      },
    },
  ], { currentSchemaVersion: 2 });

  assert.throws(
    () => pipeline.migrateState({ playerId: 'missing-step' }),
    /Missing game state migration from schema version 0 to 2/,
  );
});

test('GameStateMigrationPipeline preserves future schema saves without downgrading', () => {
  const future = {
    playerId: 'future-save',
    saveMetadata: { schema: 'game-state-save', schemaVersion: 99, migrations: [] },
    resources: { food: 1 },
  };

  const result = GameStateMigrationPipeline.migrateState(future);

  assert.equal(result.changed, false);
  assert.equal(result.futureSchema, true);
  assert.equal(result.toVersion, 99);
  assert.equal(result.state.saveMetadata.schemaVersion, 99);
  assert.deepEqual(result.state.resources, { food: 1 });
});
