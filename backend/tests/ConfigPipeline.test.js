const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ConfigPipeline = require('../services/config/ConfigPipeline');

test('ConfigPipeline builds a current snapshot for registered config domains', () => {
  const snapshot = ConfigPipeline.buildCurrentSnapshot({ generatedAt: '2026-06-11T00:00:00.000Z' });
  const ids = snapshot.registries.map((registry) => registry.id).sort();

  assert.equal(snapshot.schema, ConfigPipeline.SNAPSHOT_SCHEMA);
  assert.equal(snapshot.validation.success, true);
  assert.equal(snapshot.registryCount >= 7, true);
  assert.equal(ids.includes('building-config'), true);
  assert.equal(ids.includes('task-definitions'), true);
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
