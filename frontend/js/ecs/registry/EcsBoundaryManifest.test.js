const test = require('node:test');
const assert = require('node:assert/strict');

const EcsBoundaryManifest = require('./EcsBoundaryManifest');

test('EcsBoundaryManifest declares the reviewed Batch 2 owner vocabulary', () => {
  assert.equal(EcsBoundaryManifest.version, 'ecs-boundary-manifest-v1');
  assert.deepEqual(EcsBoundaryManifest.runtimeLoading, {
    core: 'node-commonjs-architecture-boundary-only',
    registry: 'node-commonjs-architecture-boundary-only',
    approvedRuntimeSurfaces: ['frontend/js/ecs/runtime/EcsModeRuntimeBundle.js'],
    approvedRuntimeSurfaceDirs: [
      'frontend/js/ecs/debug/**',
      'frontend/js/ecs/foundation/**',
      'frontend/js/ecs/input/**',
      'frontend/js/ecs/projection/**',
      'frontend/js/ecs/resource/**',
      'frontend/js/ecs/system/**',
    ],
    forbiddenRuntimeSurfaces: [
      'frontend/js/ecs/core/**',
      'frontend/js/ecs/registry/**',
      'frontend/js/ecs/mode/**',
      'frontend/js/ecs/owner/**',
      'frontend/js/ecs/snapshot/**',
    ],
  });
  assert.deepEqual(EcsBoundaryManifest.ownerRoles, [
    'externalEcsCore',
    'componentSchema',
    'system',
    'mode',
    'adapter',
    'registry',
  ]);
});

test('EcsBoundaryManifest includes required component families and modes', () => {
  ['Auth', 'Network', 'Transition', 'Formation', 'Modal', 'Fog'].forEach((family) => {
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

test('EcsBoundaryManifest locks snapshot keys and retires bridge owner policy', () => {
  assert.deepEqual(EcsBoundaryManifest.snapshotKeys, [
    'ShellSnapshot',
    'WorldMapSnapshot',
    'CitySnapshot',
    'TechSnapshot',
    'FormationSnapshot',
    'BattleSnapshot',
    'FogSnapshot',
    'TutorialSnapshot',
    'DebugSnapshot',
    'RendererSnapshot',
  ]);
  assert.equal(
    Object.prototype.hasOwnProperty.call(EcsBoundaryManifest, 'bridgeLifecyclePolicy'),
    false,
  );
  assert.equal(EcsBoundaryManifest.ownerRoles.includes('bridge'), false);
});

test('EcsBoundaryManifest validates duplicate-free registry facts', () => {
  assert.deepEqual(EcsBoundaryManifest.validate(), { ok: true, errors: [] });
  assert.deepEqual(
    EcsBoundaryManifest.validate({
      ...EcsBoundaryManifest,
      modeKeys: ['city', 'city'],
      ownerRoles: [...EcsBoundaryManifest.ownerRoles, 'bridge'],
      bridgeLifecyclePolicy: { maxLifetimeBatches: 9, maxLifetimeDays: 99 },
    }),
    {
      ok: false,
      errors: [
        'modeKeys contains duplicate key: city',
        'bridgeLifecyclePolicy is retired; bridge is not an ECS owner role',
        'ownerRoles must not include retired bridge',
      ],
    },
  );
});
