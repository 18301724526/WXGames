const test = require('node:test');
const assert = require('node:assert/strict');

const ConfigRegistryContract = require('../services/config/ConfigRegistryContract');
const BuildingConfig = require('../config/BuildingConfig');
const BattleConfig = require('../config/BattleConfig');
const EraConfig = require('../config/EraConfig');
const GameConfig = require('../config/GameConfig');
const TechTreeConfig = require('../config/TechTreeConfig');
const TutorialFlowConfig = require('../config/TutorialFlowConfig');
const TaskDefinitionNormalizer = require('../services/taskDefinitions/TaskDefinitionNormalizer');

test('ConfigRegistryContract creates stable metadata independent of object key order', () => {
  const before = ConfigRegistryContract.createRegistryMetadata({
    id: 'unit-registry',
    schema: 'unit-schema',
    schemaVersion: 1,
    version: 'v1.2',
    entries: {
      b: { id: 'b', value: 2 },
      a: { id: 'a', value: 1 },
    },
  });
  const after = ConfigRegistryContract.createRegistryMetadata({
    id: 'unit-registry',
    schema: 'unit-schema',
    schemaVersion: 1,
    version: '1.2',
    entries: {
      a: { value: 1, id: 'a' },
      b: { value: 2, id: 'b' },
    },
  });

  assert.equal(before.version, '1.2');
  assert.equal(before.contentHash, after.contentHash);
  assert.deepEqual(before.entryIds, ['a', 'b']);
});

test('ConfigRegistryContract rejects missing, duplicate, and mismatched entry ids', () => {
  const duplicate = ConfigRegistryContract.validateRegistry({
    id: 'duplicate-registry',
    schema: 'duplicate-schema',
    version: '1.0.0',
    entries: [
      { id: 'same', value: 1 },
      { id: 'same', value: 2 },
      { value: 3 },
    ],
  }, {
    requireEntries: true,
    requireVersion: true,
  });
  const mismatchedKey = ConfigRegistryContract.validateRegistry({
    id: 'keyed-registry',
    schema: 'keyed-schema',
    version: '1.0.0',
    entries: {
      house: { id: 'wrong-house' },
    },
  }, {
    requireObjectKeyMatch: true,
  });

  assert.equal(duplicate.success, false);
  assert.equal(duplicate.errors.some((error) => error.includes('duplicate entry id same')), true);
  assert.equal(duplicate.errors.some((error) => error.includes('entry id is required')), true);
  assert.equal(mismatchedKey.success, false);
  assert.equal(mismatchedKey.errors.some((error) => error.includes('entry id must match object key')), true);
});

test('ConfigRegistryContract recommends minor bumps for content additions and major bumps for breaking changes', () => {
  const before = {
    id: 'task-definitions',
    schema: 'task-definition-registry',
    schemaVersion: 1,
    version: '1.4.0',
    entries: [{ id: 'task_a', title: 'A' }],
  };
  const added = {
    ...before,
    version: '1.5.0',
    entries: [
      { id: 'task_a', title: 'A' },
      { id: 'task_b', title: 'B' },
    ],
  };
  const removedWithoutMajor = {
    ...before,
    version: '1.5.0',
    entries: [],
  };
  const schemaChangedWithoutMajor = {
    ...before,
    schemaVersion: 2,
    version: '1.5.0',
  };

  const addition = ConfigRegistryContract.recommendVersionBump(before, added);
  const removal = ConfigRegistryContract.recommendVersionBump(before, removedWithoutMajor);
  const schemaChange = ConfigRegistryContract.recommendVersionBump(before, schemaChangedWithoutMajor);

  assert.equal(addition.level, 'minor');
  assert.equal(addition.recommendedVersion, '1.5.0');
  assert.equal(addition.versionSatisfies, true);
  assert.deepEqual(addition.comparison.addedEntryIds, ['task_b']);
  assert.equal(removal.level, 'major');
  assert.equal(removal.recommendedVersion, '2.0.0');
  assert.equal(removal.versionSatisfies, false);
  assert.equal(schemaChange.level, 'major');
  assert.equal(schemaChange.reason, 'schema changed');
});

test('TaskDefinitionNormalizer exposes config registry metadata while preserving legacy fields', () => {
  const definitions = TaskDefinitionNormalizer.normalizeDefinitions({
    version: '0.2',
    tasks: [
      { id: 'task_two', title: 'Two', category: 'main', sortOrder: 2 },
      { id: 'task_one', title: 'One', category: 'main', sortOrder: 1 },
    ],
  }, {
    source: 'unit-task-source',
  });

  assert.equal(definitions.version, '0.2');
  assert.match(definitions.hash, /^[a-f0-9]{12}$/);
  assert.equal(definitions.registry.id, 'task-definitions');
  assert.equal(definitions.registry.schema, 'task-definition-registry');
  assert.equal(definitions.registry.version, definitions.version);
  assert.equal(definitions.registry.entryCount, 2);
  assert.deepEqual(definitions.registry.entryIds, ['task_one', 'task_two']);
  assert.equal(definitions.registry.source, 'unit-task-source');
  assert.deepEqual(definitions.registryErrors, []);
});

test('BuildingConfig exposes registry metadata and validation without changing gameplay accessors', () => {
  const metadata = BuildingConfig.getRegistryMetadata();
  const validation = BuildingConfig.validateRegistry();

  assert.equal(metadata.id, 'building-config');
  assert.equal(metadata.schema, 'building-config-registry');
  assert.equal(metadata.version, BuildingConfig.getVersion());
  assert.equal(metadata.entryCount, Object.keys(BuildingConfig.getAllBuildings()).length);
  assert.equal(metadata.entryIds.includes('house'), true);
  assert.equal(validation.success, true);
  assert.deepEqual(validation.errors, []);
  assert.deepEqual(BuildingConfig.getBuildCost('house'), { food: 30 });
});

function assertConfigRegistry(moduleApi, expected) {
  const metadata = moduleApi.getRegistryMetadata();
  const validation = moduleApi.validateRegistry();

  assert.equal(metadata.id, expected.id);
  assert.equal(metadata.schema, expected.schema);
  assert.equal(metadata.version, moduleApi.getVersion());
  assert.equal(metadata.source, moduleApi.getSourcePath());
  assert.equal(metadata.entryCount >= expected.minEntries, true);
  assert.match(metadata.contentHash, /^[a-f0-9]{12}$/);
  expected.entryIds.forEach((entryId) => {
    assert.equal(metadata.entryIds.includes(entryId), true, `${expected.id} missing entry ${entryId}`);
  });
  assert.equal(validation.success, true);
  assert.deepEqual(validation.errors, []);
}

test('Core config families expose registry metadata and validation', () => {
  assertConfigRegistry(GameConfig, {
    id: 'game-config',
    schema: 'game-config-registry',
    minEntries: 2,
    entryIds: ['population', 'resources'],
  });
  assertConfigRegistry(EraConfig, {
    id: 'era-config',
    schema: 'era-config-registry',
    minEntries: EraConfig.ERA_NAMES.length,
    entryIds: ['era:0', 'era:1'],
  });
  assertConfigRegistry(TutorialFlowConfig, {
    id: 'tutorial-flow-config',
    schema: 'tutorial-flow-config-registry',
    minEntries: Object.keys(TutorialFlowConfig.TUTORIAL_STEPS).length,
    entryIds: ['step:initial', 'step:completed', 'clientGate:36'],
  });
  assertConfigRegistry(BattleConfig, {
    id: 'battle-config',
    schema: 'battle-config-registry',
    minEntries: 5,
    entryIds: ['rules', 'fallbackLeader', 'defenderProfilesByOwner'],
  });
  assertConfigRegistry(TechTreeConfig, {
    id: 'tech-tree-config',
    schema: 'tech-tree-config-registry',
    minEntries: TechTreeConfig.TECHS.length,
    entryIds: ['farming_field_rotation', 'classical_workshop_guilds'],
  });
});
