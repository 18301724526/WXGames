const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ConfigPipeline = require('../services/config/ConfigPipeline');

test('ConfigPipeline builds a current snapshot for registered config families', () => {
  const snapshot = ConfigPipeline.buildCurrentSnapshot({ generatedAt: '2026-06-11T00:00:00.000Z' });
  const ids = snapshot.registries.map((registry) => registry.id).sort();

  assert.equal(snapshot.schema, ConfigPipeline.SNAPSHOT_SCHEMA);
  assert.equal(snapshot.validation.success, true);
  assert.deepEqual(ids, [
    'battle-config',
    'building-config',
    'era-config',
    'game-config',
    'task-definitions',
    'tech-tree-config',
  ]);
  assert.equal(snapshot.registryCount, ids.length);
  snapshot.registries.forEach((registry) => {
    assert.match(registry.contentHash, /^[a-f0-9]{12}$/);
    assert.equal(Number.isInteger(registry.schemaVersion), true);
  });
});

test('ConfigPipeline compares snapshots and enforces required version bumps', () => {
  const baseline = {
    schema: ConfigPipeline.SNAPSHOT_SCHEMA,
    registries: [{
      id: 'unit-config',
      schema: 'unit-config-registry',
      schemaVersion: 1,
      version: '1.0.0',
      contentHash: 'aaaaaaaaaaaa',
      entryCount: 1,
      entryIds: ['a'],
    }],
  };
  const current = {
    schema: ConfigPipeline.SNAPSHOT_SCHEMA,
    validation: { success: true, errors: [], warnings: [] },
    registries: [{
      ...baseline.registries[0],
      version: '1.0.1',
      contentHash: 'bbbbbbbbbbbb',
      entryCount: 2,
      entryIds: ['a', 'b'],
    }],
  };

  const report = ConfigPipeline.buildPipelineReport({
    baselineSnapshot: baseline,
    currentSnapshot: current,
    generatedAt: '2026-06-11T00:00:00.000Z',
  });

  assert.equal(report.success, false);
  assert.equal(report.comparison.changedRegistries.length, 1);
  assert.equal(report.comparison.changedRegistries[0].recommendation.level, 'minor');
  assert.equal(report.errors.some((error) => error.includes('expected >= 1.1.0')), true);
});

test('ConfigPipeline accepts unchanged snapshots and writes baseline files', () => {
  const snapshot = {
    schema: ConfigPipeline.SNAPSHOT_SCHEMA,
    generatedAt: '2026-06-11T00:00:00.000Z',
    validation: { success: true, errors: [], warnings: [] },
    registries: [{
      id: 'unit-config',
      schema: 'unit-config-registry',
      schemaVersion: 1,
      version: '1.0.0',
      contentHash: 'aaaaaaaaaaaa',
      entryCount: 1,
      entryIds: ['a'],
    }],
  };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wxgame-config-pipeline-'));
  const filePath = path.join(dir, 'snapshot.json');

  ConfigPipeline.writeSnapshot(filePath, snapshot);
  const loaded = ConfigPipeline.readSnapshot(filePath);
  const comparison = ConfigPipeline.compareSnapshots(loaded, snapshot);

  assert.deepEqual(loaded.registries[0].entryIds, ['a']);
  assert.equal(comparison.success, true);
  assert.deepEqual(comparison.changedRegistries, []);
});

test('ConfigPipeline permits only registry retirements declared with a reason', () => {
  const retained = {
    id: 'unit-config',
    schema: 'unit-config-registry',
    schemaVersion: 1,
    version: '1.0.0',
    contentHash: 'aaaaaaaaaaaa',
    entryCount: 1,
    entryIds: ['a'],
  };
  const removed = {
    id: 'legacy-config',
    schema: 'legacy-config-registry',
    schemaVersion: 1,
    version: '1.0.0',
    contentHash: 'bbbbbbbbbbbb',
    entryCount: 1,
    entryIds: ['legacy'],
  };
  const baseline = { schema: ConfigPipeline.SNAPSHOT_SCHEMA, registries: [retained, removed] };
  const current = {
    schema: ConfigPipeline.SNAPSHOT_SCHEMA,
    validation: { success: true, errors: [], warnings: [] },
    registries: [retained],
  };

  const blocked = ConfigPipeline.compareSnapshots(baseline, current);
  assert.equal(blocked.success, false);
  assert.deepEqual(blocked.retiredRegistries, []);

  const declared = ConfigPipeline.compareSnapshots(baseline, current, {
    declaredRegistryRetirements: [{ id: 'legacy-config', reason: 'legacy feature removed' }],
  });
  assert.equal(declared.success, true);
  assert.deepEqual(declared.retiredRegistries, [{
    id: 'legacy-config',
    reason: 'legacy feature removed',
  }]);
  assert.equal(declared.warnings[0], 'legacy-config: registry retired (legacy feature removed)');

  const missingReason = ConfigPipeline.compareSnapshots(baseline, current, {
    declaredRegistryRetirements: [{ id: 'legacy-config' }],
  });
  assert.equal(missingReason.success, false);
});

test('ConfigPipeline reports loader failures as validation errors', () => {
  const reports = ConfigPipeline.collectRegistryReports({
    loaders: [{
      id: 'broken-config',
      load() {
        throw new Error('broken loader');
      },
    }],
  });
  const snapshot = ConfigPipeline.createSnapshot(reports, { generatedAt: '2026-06-11T00:00:00.000Z' });

  assert.equal(snapshot.validation.success, false);
  assert.equal(snapshot.validation.errors[0], 'broken-config: broken loader');
});

test('ConfigPipeline task registry snapshot does not depend on runtime release gate', () => {
  const previousGate = process.env.CONFIG_RELEASE_GATE;
  const previousNodeEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    process.env.CONFIG_RELEASE_GATE = 'required';
    const snapshot = ConfigPipeline.buildCurrentSnapshot({ generatedAt: '2026-06-11T00:00:00.000Z' });
    const taskRegistry = snapshot.registries.find((registry) => registry.id === 'task-definitions');

    assert.equal(snapshot.validation.success, true);
    assert.equal(taskRegistry.entryCount, 6);
  } finally {
    if (previousGate === undefined) delete process.env.CONFIG_RELEASE_GATE;
    else process.env.CONFIG_RELEASE_GATE = previousGate;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});
