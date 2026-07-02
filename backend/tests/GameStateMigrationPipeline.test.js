const test = require('node:test');
const assert = require('node:assert/strict');

const GameStateMigrationPipeline = require('../services/GameStateMigrationPipeline');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('GameStateMigrationPipeline upgrades schema-0 saves to the current schema metadata', () => {
  const raw = {
    playerId: 'schema-0-save',
    resources: { food: 10, metal: 3 },
    buildings: { barracks: 1 },
    military: { soldiers: 3 },
    eventQueue: null,
    taskProgress: {},
  };
  const original = clone(raw);

  const result = GameStateMigrationPipeline.migrateState(raw, { now: new Date('2026-06-08T00:00:00.000Z') });

  assert.equal(result.changed, true);
  assert.equal(result.fromVersion, 0);
  assert.equal(result.toVersion, GameStateMigrationPipeline.CURRENT_SCHEMA_VERSION);
  assert.deepEqual(result.appliedMigrations, [
    'initialize-save-schema-v1',
    'initialize-city-source-v2',
    'upgrade-stored-skill-effects-v3',
    'upgrade-territory-source-v4',
  ]);
  assert.equal(result.state.saveMetadata.schema, GameStateMigrationPipeline.SAVE_SCHEMA_NAME);
  assert.equal(result.state.saveMetadata.schemaVersion, GameStateMigrationPipeline.CURRENT_SCHEMA_VERSION);
  assert.deepEqual(result.state.saveMetadata.migrations.map((entry) => entry.id), [
    'initialize-save-schema-v1',
    'initialize-city-source-v2',
    'upgrade-stored-skill-effects-v3',
    'upgrade-territory-source-v4',
  ]);
  assert.equal(result.state.resources.iron, 3);
  assert.equal(result.state.resources.metal, 3);
  assert.equal(result.state.buildings.barracks.level, 1);
  assert.equal(result.state.military.soldiers, 300);
  assert.equal(result.state.cities.capital.military.soldiers, 300);
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
      migrations: [
        { id: 'initialize-save-schema-v1', fromVersion: 0, toVersion: 1, migratedAt: '2026-06-08T00:00:00.000Z' },
        { id: 'initialize-city-source-v2', fromVersion: 1, toVersion: 2, migratedAt: '2026-06-08T00:00:00.000Z' },
      ],
    }),
  };

  const result = GameStateMigrationPipeline.migrateState(current);

  assert.equal(result.changed, false);
  assert.equal(result.fromVersion, GameStateMigrationPipeline.CURRENT_SCHEMA_VERSION);
  assert.equal(result.toVersion, GameStateMigrationPipeline.CURRENT_SCHEMA_VERSION);
  assert.deepEqual(result.appliedMigrations, []);
  assert.deepEqual(result.state.saveMetadata.migrations, current.saveMetadata.migrations);
});

test('GameStateMigrationPipeline upgrades retired skill and territory save shapes at schema boundary', () => {
  const raw = {
    playerId: 'schema-boundary-upgrade',
    saveMetadata: GameStateMigrationPipeline.createSaveMetadata({
      schemaVersion: 2,
      migrations: [
        { id: 'initialize-save-schema-v1', fromVersion: 0, toVersion: 1, migratedAt: '2026-06-08T00:00:00.000Z' },
        { id: 'initialize-city-source-v2', fromVersion: 1, toVersion: 2, migratedAt: '2026-06-08T00:00:00.000Z' },
      ],
    }),
    famousPeople: [{
      id: 'fp-retired-skill',
      archetype: 'vanguard',
      abilityArchetype: 'vanguard',
      quality: 'good',
      source: { type: 'seek', seed: 'fp-retired-skill' },
      abilityKit: {
        archetype: 'vanguard',
        quality: 'good',
        abilities: [{
          id: 'active-retired',
          type: 'battle',
          kind: 'active',
          slot: 'activeSkill',
          effects: [{ key: 'combo', chance: 0.22 }],
        }],
      },
      skills: [{
        id: 'active-retired',
        type: 'battle',
        effects: [{ key: 'combo', chance: 0.22 }],
      }],
    }],
    territories: [
      { id: 'river_plain', status: 'scouted', naturalName: 'River Plain' },
    ],
    warMissions: [{
      id: 'stored-scout',
      kind: 'scout',
      direction: 'e',
      originX: 0,
      originY: 0,
      targetX: 1,
      targetY: 0,
      route: [{ q: 1, r: 0, step: 1 }],
      revealAreaSource: 'legacy-route',
    }],
  };

  const result = GameStateMigrationPipeline.migrateState(raw, { now: new Date('2026-06-08T00:00:00.000Z') });

  assert.deepEqual(result.appliedMigrations, [
    'upgrade-stored-skill-effects-v3',
    'upgrade-territory-source-v4',
  ]);
  assert.equal(result.state.famousPeople[0].abilityKit.abilities[0].effects[0].key, 'secondHit');
  assert.equal(result.state.famousPeople[0].skills[0].effects[0].key, 'secondHit');
  assert.equal(result.state.territories[0].id, 'river_plain');
  assert.equal(result.state.territories[0].x, 1);
  assert.equal(result.state.territories[0].status, 'discovered');
  assert.equal(result.state.warMissions[0].revealAreaSource, 'stored-route-v1');
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
