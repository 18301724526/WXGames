const test = require('node:test');
const assert = require('node:assert/strict');

const EcsBoundaryManifest = require('./EcsBoundaryManifest');

test('EcsBoundaryManifest declares the reviewed Batch 2 owner vocabulary', () => {
  assert.equal(EcsBoundaryManifest.version, 'ecs-boundary-manifest-v1');
  assert.equal(EcsBoundaryManifest.runtimeLoading, 'node-commonjs-architecture-boundary-only');
  assert.deepEqual(EcsBoundaryManifest.ownerRoles, [
    'externalEcsCore',
    'componentSchema',
    'system',
    'mode',
    'adapter',
    'registry',
    'bridge',
  ]);
});

test('EcsBoundaryManifest includes required component families and modes', () => {
  ['Auth', 'Network', 'Transition', 'Formation', 'Modal'].forEach((family) => {
    assert.equal(EcsBoundaryManifest.componentFamilies.includes(family), true);
  });

  [
    'boot',
    'worldMap',
    'formationEditor',
    'modal:naming',
    'modal:event',
    'modal:rewardReveal',
    'modal:confirmDialog',
    'tutorial',
  ].forEach((mode) => {
    assert.equal(EcsBoundaryManifest.modeKeys.includes(mode), true);
  });
});

test('EcsBoundaryManifest locks snapshot keys and bridge lifecycle policy', () => {
  assert.deepEqual(EcsBoundaryManifest.snapshotKeys, [
    'ShellSnapshot',
    'WorldMapSnapshot',
    'CitySnapshot',
    'TechSnapshot',
    'FormationSnapshot',
    'BattleSnapshot',
    'TutorialSnapshot',
    'DebugSnapshot',
  ]);
  assert.equal(EcsBoundaryManifest.bridgeLifecyclePolicy.maxLifetimeBatches, 2);
  assert.equal(EcsBoundaryManifest.bridgeLifecyclePolicy.maxLifetimeDays, 14);
  assert.equal(
    EcsBoundaryManifest.bridgeLifecyclePolicy.forbiddenWork.includes('newModeDecisions'),
    true,
  );
});

test('EcsBoundaryManifest validates duplicate-free registry facts', () => {
  assert.deepEqual(EcsBoundaryManifest.validate(), { ok: true, errors: [] });
  assert.deepEqual(
    EcsBoundaryManifest.validate({
      ...EcsBoundaryManifest,
      modeKeys: ['city', 'city'],
      bridgeLifecyclePolicy: { maxLifetimeBatches: 9, maxLifetimeDays: 99 },
    }),
    {
      ok: false,
      errors: [
        'modeKeys contains duplicate key: city',
        'bridgeLifecyclePolicy.maxLifetimeBatches must stay at 2',
        'bridgeLifecyclePolicy.maxLifetimeDays must stay at 14',
      ],
    },
  );
});
