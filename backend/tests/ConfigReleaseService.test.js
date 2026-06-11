const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ConfigPipeline = require('../services/config/ConfigPipeline');
const ConfigReleaseService = require('../services/config/ConfigReleaseService');

function createSnapshot(overrides = {}) {
  const entryIds = overrides.entryIds || ['alpha'];
  return {
    schema: ConfigPipeline.SNAPSHOT_SCHEMA,
    generatedAt: overrides.generatedAt || '2026-06-11T00:00:00.000Z',
    registryCount: 1,
    validation: { success: true, errors: [], warnings: [] },
    registries: [{
      id: 'unit-config',
      schema: 'unit-config-registry',
      schemaVersion: 1,
      version: overrides.version || '1.0.0',
      contentHash: overrides.contentHash || 'aaaaaaaaaaaa',
      entryCount: entryIds.length,
      entryIds,
      source: 'unit-test',
    }],
  };
}

function createTempPaths() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wxgame-config-release-'));
  return {
    dir,
    historyPath: path.join(dir, 'configReleases.json'),
    activePath: path.join(dir, 'configActiveRelease.json'),
  };
}

test('ConfigReleaseService defaults production release state into deploy state backup scope', () => {
  assert.equal(
    ConfigReleaseService.getDefaultReleaseDataDir({ NODE_ENV: 'production' }),
    '/opt/wxgame-workspace/.wxgame/config-release',
  );
  assert.equal(
    ConfigReleaseService.getDefaultHistoryPath({ NODE_ENV: 'production' }),
    '/opt/wxgame-workspace/.wxgame/config-release/configReleases.json',
  );
  assert.equal(
    ConfigReleaseService.getDefaultActivePath({
      NODE_ENV: 'production',
      DEPLOY_STATE_DIR: '/tmp/wxgame-state',
    }),
    '/tmp/wxgame-state/config-release/configActiveRelease.json',
  );
  assert.equal(
    ConfigReleaseService.getDefaultReleaseDataDir({ NODE_ENV: 'test' }),
    path.join(__dirname, '..', '..', 'data', 'config-release'),
  );
});

test('ConfigReleaseService previews a candidate release against active baseline', () => {
  const paths = createTempPaths();
  const first = createSnapshot();
  const second = createSnapshot({
    version: '1.1.0',
    contentHash: 'bbbbbbbbbbbb',
    entryIds: ['alpha', 'beta'],
  });

  const publish = ConfigReleaseService.publishRelease(
    { snapshot: first, source: 'unit:first' },
    { ...paths, operator: 'codexqa', now: new Date('2026-06-11T00:00:00Z') },
  );
  const preview = ConfigReleaseService.previewRelease(
    { snapshot: second, source: 'unit:second' },
    { ...paths, operator: 'codexqa', now: new Date('2026-06-11T00:01:00Z') },
  );

  assert.equal(publish.success, true);
  assert.equal(preview.success, true);
  assert.equal(preview.candidate.action, 'preview');
  assert.equal(preview.candidate.comparison.changedCount, 1);
  assert.deepEqual(preview.candidate.comparison.changedRegistryIds, ['unit-config']);
  assert.equal(preview.report.baseline.registryCount, 1);
});

test('ConfigReleaseService publishes release history and active release pointer', () => {
  const paths = createTempPaths();
  const snapshot = createSnapshot();
  const result = ConfigReleaseService.publishRelease(
    { snapshot, source: 'unit:publish' },
    { ...paths, operator: 'codexqa', now: new Date('2026-06-11T00:00:00Z') },
  );
  const history = ConfigReleaseService.loadReleaseHistory(paths);
  const active = ConfigReleaseService.getActiveRelease({ ...paths, includeSnapshot: true });

  assert.equal(result.success, true);
  assert.equal(result.release.action, 'publish');
  assert.equal(result.release.operator, 'codexqa');
  assert.equal(result.release.snapshotHash, result.activeRelease.release.snapshotHash);
  assert.equal(history.releases.length, 1);
  assert.equal(history.releases[0].snapshot, undefined);
  assert.equal(active.release.action, 'publish');
  assert.equal(active.release.snapshot.registries[0].id, 'unit-config');
});

test('ConfigReleaseService rolls back active release to a previous audited snapshot', () => {
  const paths = createTempPaths();
  const first = createSnapshot();
  const second = createSnapshot({
    version: '1.1.0',
    contentHash: 'bbbbbbbbbbbb',
    entryIds: ['alpha', 'beta'],
  });
  const firstPublish = ConfigReleaseService.publishRelease(
    { snapshot: first, source: 'unit:first' },
    { ...paths, operator: 'codexqa', now: new Date('2026-06-11T00:00:00Z') },
  );
  const secondPublish = ConfigReleaseService.publishRelease(
    { snapshot: second, source: 'unit:second' },
    { ...paths, operator: 'codexqa', now: new Date('2026-06-11T00:01:00Z') },
  );
  const rollback = ConfigReleaseService.rollbackRelease(
    firstPublish.release.id,
    { ...paths, operator: 'codexqa', now: new Date('2026-06-11T00:02:00Z') },
  );
  const active = ConfigReleaseService.getActiveRelease({ ...paths, includeSnapshot: true });
  const history = ConfigReleaseService.loadReleaseHistory({ ...paths, limit: 5 });

  assert.equal(secondPublish.success, true);
  assert.equal(rollback.success, true);
  assert.equal(rollback.release.action, 'rollback');
  assert.equal(rollback.release.rollbackTargetReleaseId, firstPublish.release.id);
  assert.equal(rollback.release.rollbackFromReleaseId, secondPublish.release.id);
  assert.equal(active.release.action, 'rollback');
  assert.equal(active.release.snapshot.registries[0].version, '1.0.0');
  assert.equal(history.releases.length, 3);
});

test('ConfigReleaseService rejects invalid publish snapshots without writing history', () => {
  const paths = createTempPaths();
  const result = ConfigReleaseService.publishRelease(
    { snapshot: { schema: 'broken', registries: [] }, source: 'broken' },
    { ...paths, operator: 'codexqa', now: new Date('2026-06-11T00:00:00Z') },
  );
  const history = ConfigReleaseService.loadReleaseHistory(paths);
  const active = ConfigReleaseService.getActiveRelease(paths);

  assert.equal(result.success, false);
  assert.equal(result.error, 'CONFIG_RELEASE_VALIDATION_FAILED');
  assert.equal(result.errors.some((error) => error.includes('snapshot schema')), true);
  assert.equal(history.releases.length, 0);
  assert.equal(active.release, null);
});

test('ConfigReleaseService reports unpublished runtime status without failing current validation', () => {
  const paths = createTempPaths();
  const status = ConfigReleaseService.getRuntimeStatus({
    ...paths,
    currentSnapshot: createSnapshot(),
    now: new Date('2026-06-11T00:00:00Z'),
  });

  assert.equal(status.schema, ConfigReleaseService.RUNTIME_STATUS_SCHEMA);
  assert.equal(status.status, 'unpublished');
  assert.equal(status.success, true);
  assert.equal(status.matchesCurrent, false);
  assert.equal(status.activeRelease, null);
});

test('ConfigReleaseService reports matched and drifted runtime active release states', () => {
  const paths = createTempPaths();
  const first = createSnapshot();
  const second = createSnapshot({
    version: '1.1.0',
    contentHash: 'bbbbbbbbbbbb',
    entryIds: ['alpha', 'beta'],
  });
  const publish = ConfigReleaseService.publishRelease(
    { snapshot: first, source: 'unit:first' },
    { ...paths, operator: 'codexqa', now: new Date('2026-06-11T00:00:00Z') },
  );
  const matched = ConfigReleaseService.getRuntimeStatus({
    ...paths,
    currentSnapshot: first,
    now: new Date('2026-06-11T00:01:00Z'),
  });
  const drift = ConfigReleaseService.getRuntimeStatus({
    ...paths,
    currentSnapshot: second,
    now: new Date('2026-06-11T00:02:00Z'),
  });

  assert.equal(publish.success, true);
  assert.equal(matched.status, 'matched');
  assert.equal(matched.matchesCurrent, true);
  assert.equal(matched.activeRelease.id, publish.release.id);
  assert.equal(drift.status, 'drift');
  assert.equal(drift.matchesCurrent, false);
  assert.equal(drift.drift.changedCount, 1);
  assert.deepEqual(drift.drift.changedRegistryIds, ['unit-config']);
});

test('ConfigReleaseService resolves runtime release gate policy from environment', () => {
  const productionDefault = ConfigReleaseService.resolveRuntimeGatePolicy({
    NODE_ENV: 'production',
  });
  const developmentDefault = ConfigReleaseService.resolveRuntimeGatePolicy({
    NODE_ENV: 'development',
  });
  const explicitWarn = ConfigReleaseService.resolveRuntimeGatePolicy({
    NODE_ENV: 'production',
    CONFIG_RELEASE_GATE: 'warn',
  });
  const explicitOff = ConfigReleaseService.resolveRuntimeGatePolicy({
    NODE_ENV: 'production',
    CONFIG_RELEASE_GATE: 'off',
  });
  const legacyFlag = ConfigReleaseService.resolveRuntimeGatePolicy({
    NODE_ENV: 'development',
    REQUIRE_CONFIG_ACTIVE_RELEASE: '1',
  });

  assert.equal(productionDefault.schema, ConfigReleaseService.RUNTIME_GATE_POLICY_SCHEMA);
  assert.equal(productionDefault.mode, 'required');
  assert.equal(productionDefault.required, true);
  assert.equal(developmentDefault.mode, 'warn');
  assert.equal(developmentDefault.required, false);
  assert.equal(explicitWarn.mode, 'warn');
  assert.equal(explicitWarn.required, false);
  assert.equal(explicitOff.mode, 'off');
  assert.equal(explicitOff.required, false);
  assert.equal(legacyFlag.mode, 'required');
  assert.equal(legacyFlag.source, 'REQUIRE_CONFIG_ACTIVE_RELEASE');
});

test('ConfigReleaseService production runtime gate rejects unpublished or drifted releases', () => {
  const unpublishedPaths = createTempPaths();
  const current = createSnapshot();
  const driftPaths = createTempPaths();
  const older = createSnapshot({
    version: '0.9.0',
    contentHash: 'cccccccccccc',
    entryIds: ['alpha'],
  });
  const driftCurrent = createSnapshot({
    version: '1.1.0',
    contentHash: 'dddddddddddd',
    entryIds: ['alpha', 'beta'],
  });
  const publish = ConfigReleaseService.publishRelease(
    { snapshot: older, source: 'unit:old' },
    { ...driftPaths, operator: 'codexqa', now: new Date('2026-06-11T00:00:00Z') },
  );

  assert.equal(publish.success, true);
  assert.throws(
    () => ConfigReleaseService.assertRuntimeReleaseReady({
      ...unpublishedPaths,
      env: { NODE_ENV: 'production' },
      currentSnapshot: current,
      now: new Date('2026-06-11T00:01:00Z'),
    }),
    (error) => {
      assert.equal(error.code, 'CONFIG_RUNTIME_RELEASE_GATE_FAILED');
      assert.equal(error.gate.runtimeStatus.status, 'unpublished');
      return true;
    },
  );
  assert.throws(
    () => ConfigReleaseService.assertRuntimeReleaseReady({
      ...driftPaths,
      env: { NODE_ENV: 'production' },
      currentSnapshot: driftCurrent,
      now: new Date('2026-06-11T00:02:00Z'),
    }),
    (error) => {
      assert.equal(error.code, 'CONFIG_RUNTIME_RELEASE_GATE_FAILED');
      assert.equal(error.gate.runtimeStatus.status, 'drift');
      return true;
    },
  );
});

test('ConfigReleaseService runtime gate passes matched releases and observes in warn/off modes', () => {
  const paths = createTempPaths();
  const snapshot = createSnapshot();
  const publish = ConfigReleaseService.publishRelease(
    { snapshot, source: 'unit:publish' },
    { ...paths, operator: 'codexqa', now: new Date('2026-06-11T00:00:00Z') },
  );
  const matched = ConfigReleaseService.assertRuntimeReleaseReady({
    ...paths,
    env: { NODE_ENV: 'production' },
    currentSnapshot: snapshot,
    now: new Date('2026-06-11T00:01:00Z'),
  });
  const warnOnly = ConfigReleaseService.assertRuntimeReleaseReady({
    ...createTempPaths(),
    env: { NODE_ENV: 'production', CONFIG_RELEASE_GATE: 'warn' },
    currentSnapshot: snapshot,
    now: new Date('2026-06-11T00:02:00Z'),
  });
  const offOnly = ConfigReleaseService.assertRuntimeReleaseReady({
    ...createTempPaths(),
    env: { NODE_ENV: 'production', CONFIG_RELEASE_GATE: 'off' },
    currentSnapshot: snapshot,
    now: new Date('2026-06-11T00:03:00Z'),
  });

  assert.equal(publish.success, true);
  assert.equal(matched.schema, ConfigReleaseService.RUNTIME_GATE_SCHEMA);
  assert.equal(matched.ready, true);
  assert.equal(matched.policy.required, true);
  assert.equal(matched.runtimeStatus.status, 'matched');
  assert.equal(warnOnly.ready, false);
  assert.equal(warnOnly.policy.mode, 'warn');
  assert.equal(warnOnly.runtimeStatus.status, 'unpublished');
  assert.equal(offOnly.ready, false);
  assert.equal(offOnly.policy.mode, 'off');
  assert.equal(offOnly.runtimeStatus.status, 'unpublished');
});
