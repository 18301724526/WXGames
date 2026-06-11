const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ConfigRegistryContract = require('../services/config/ConfigRegistryContract');
const ConfigReleaseService = require('../services/config/ConfigReleaseService');
const ConfigRuntimeLoader = require('../services/config/ConfigRuntimeLoader');

function createTempPaths() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wxgame-config-runtime-'));
  return {
    dir,
    historyPath: path.join(dir, 'configReleases.json'),
    activePath: path.join(dir, 'configActiveRelease.json'),
  };
}

function createLoader(overrides = {}) {
  const payload = overrides.payload || {
    rows: [{ id: 'alpha', value: 1 }],
  };
  const entries = overrides.entries || payload.rows;
  const metadata = ConfigRegistryContract.createRegistryMetadata({
    id: overrides.id || 'unit-config',
    schema: overrides.schema || 'unit-config-registry',
    schemaVersion: overrides.schemaVersion || 1,
    version: overrides.version || '1.0.0',
    source: overrides.source || 'unit-config.json',
    entries,
    content: payload,
  });
  return {
    id: metadata.id,
    load(options = {}) {
      return {
        metadata,
        validation: {
          success: true,
          errors: [],
          warnings: [],
        },
        sourcePath: metadata.source,
        payload: options.includePayload ? payload : undefined,
      };
    },
  };
}

test('ConfigRuntimeLoader builds a gated payload bundle from the active release', () => {
  const paths = createTempPaths();
  const loaders = [createLoader()];
  const snapshot = require('../services/config/ConfigPipeline').buildCurrentSnapshot({
    loaders,
    generatedAt: '2026-06-11T00:00:00.000Z',
  });
  const publish = ConfigReleaseService.publishRelease(
    { snapshot, source: 'unit:publish' },
    {
      ...paths,
      loaders,
      operator: 'codexqa',
      now: new Date('2026-06-11T00:00:00Z'),
    },
  );
  const bundle = ConfigRuntimeLoader.buildRuntimeBundle({
    ...paths,
    loaders,
    env: { NODE_ENV: 'production' },
    now: new Date('2026-06-11T00:01:00Z'),
  });

  assert.equal(publish.success, true);
  assert.equal(bundle.schema, ConfigRuntimeLoader.RUNTIME_BUNDLE_SCHEMA);
  assert.equal(bundle.success, true);
  assert.equal(bundle.status, 'ready');
  assert.equal(bundle.gate.ready, true);
  assert.equal(bundle.release.id, publish.release.id);
  assert.equal(bundle.registries.length, 1);
  assert.equal(bundle.payloadIncluded, true);
  assert.deepEqual(bundle.payload['unit-config'].rows, [{ id: 'alpha', value: 1 }]);
});

test('ConfigRuntimeLoader reports observe-only waiting state without loading payload', () => {
  const status = ConfigRuntimeLoader.getRuntimeLoaderStatus({
    ...createTempPaths(),
    loaders: [createLoader()],
    env: { NODE_ENV: 'development' },
    now: new Date('2026-06-11T00:00:00Z'),
  });

  assert.equal(status.schema, ConfigRuntimeLoader.RUNTIME_LOADER_STATUS_SCHEMA);
  assert.equal(status.success, true);
  assert.equal(status.ready, false);
  assert.equal(status.payloadIncluded, false);
  assert.equal(status.gate.policy.mode, 'warn');
  assert.equal(status.gate.runtimeStatus.status, 'unpublished');
});

test('ConfigRuntimeLoader reports production gate failures as loader errors', () => {
  const status = ConfigRuntimeLoader.getRuntimeLoaderStatus({
    ...createTempPaths(),
    loaders: [createLoader()],
    env: { NODE_ENV: 'production' },
    now: new Date('2026-06-11T00:00:00Z'),
  });

  assert.equal(status.success, false);
  assert.equal(status.status, 'error');
  assert.equal(status.ready, false);
  assert.equal(status.payloadIncluded, false);
  assert.equal(status.gate.runtimeStatus.status, 'unpublished');
  assert.equal(status.errors.some((error) => error.includes('Config runtime release gate failed')), true);
});

test('ConfigRuntimeLoader rejects payload hash drift after a matching release changes', () => {
  const paths = createTempPaths();
  const publishLoaders = [createLoader()];
  const runtimeLoaders = [createLoader({
    payload: { rows: [{ id: 'alpha', value: 2 }] },
  })];
  const snapshot = require('../services/config/ConfigPipeline').buildCurrentSnapshot({
    loaders: publishLoaders,
    generatedAt: '2026-06-11T00:00:00.000Z',
  });
  const publish = ConfigReleaseService.publishRelease(
    { snapshot, source: 'unit:publish' },
    {
      ...paths,
      loaders: publishLoaders,
      operator: 'codexqa',
      now: new Date('2026-06-11T00:00:00Z'),
    },
  );
  const bundle = ConfigRuntimeLoader.buildRuntimeBundle({
    ...paths,
    loaders: runtimeLoaders,
    currentSnapshot: snapshot,
    env: { NODE_ENV: 'production' },
    now: new Date('2026-06-11T00:01:00Z'),
  });

  assert.equal(publish.success, true);
  assert.equal(bundle.success, false);
  assert.equal(bundle.status, 'error');
  assert.equal(bundle.payloadIncluded, false);
  assert.equal(bundle.errors.some((error) => error.includes('payload hash')), true);
});
