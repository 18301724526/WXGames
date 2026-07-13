'use strict';

const MANIFEST_VERSION = 'ecs-boundary-manifest-v1';
const BATCH = '6A. Snapshot Boundary Scaffold';

function freezeList(values) {
  return Object.freeze(Array.from(values));
}

function freezeRecord(record) {
  return Object.freeze({ ...record });
}

// Single source: the mode-key vocabulary lives in ModeKeys.js. Derive it here
// instead of re-typing the list so a new mode key cannot exist in one place only.
const EcsModeKeys = require('../mode/ModeKeys');

const OWNER_ROLES = freezeList([
  'externalEcsCore',
  'componentSchema',
  'system',
  'mode',
  'adapter',
  'registry',
]);

const COMPONENT_FAMILIES = freezeList([
  'Identity',
  'Position',
  'Mode',
  'Selection',
  'Camera',
  'Panel',
  'Modal',
  'Auth',
  'Network',
  'Transition',
  'Formation',
  'CommandIntent',
  'Animation',
  'Snapshot',
  'Fog',
]);

const MODE_KEYS = freezeList(EcsModeKeys.MODE_KEYS);

const SNAPSHOT_KEYS = freezeList([
  'ShellSnapshot',
  'WorldMapSnapshot',
  'CitySnapshot',
  'TechSnapshot',
  'FormationSnapshot',
  'BattleSnapshot',
  'FogSnapshot',
  'DebugSnapshot',
  'RendererSnapshot',
]);

const RUNTIME_LOADING_POLICY = freezeRecord({
  core: 'node-commonjs-architecture-boundary-only',
  registry: 'node-commonjs-architecture-boundary-only',
  approvedRuntimeSurfaces: freezeList(['frontend/js/ecs/runtime/EcsModeRuntimeBundle.js']),
  approvedRuntimeSurfaceDirs: freezeList([
    'frontend/js/ecs/debug/**',
    'frontend/js/ecs/foundation/**',
    'frontend/js/ecs/input/**',
    'frontend/js/ecs/projection/**',
    'frontend/js/ecs/resource/**',
    'frontend/js/ecs/system/**',
  ]),
  forbiddenRuntimeSurfaces: freezeList([
    'frontend/js/ecs/core/**',
    'frontend/js/ecs/registry/**',
    'frontend/js/ecs/mode/**',
    'frontend/js/ecs/owner/**',
    'frontend/js/ecs/snapshot/**',
  ]),
});

function findDuplicates(values = []) {
  const seen = Object.create(null);
  const duplicates = Object.create(null);
  values.forEach((value) => {
    if (seen[value]) duplicates[value] = true;
    seen[value] = true;
  });
  return Object.keys(duplicates).sort();
}

function validateEcsBoundaryManifest(manifest = EcsBoundaryManifest) {
  const errors = [];
  [
    ['ownerRoles', manifest.ownerRoles],
    ['componentFamilies', manifest.componentFamilies],
    ['modeKeys', manifest.modeKeys],
    ['snapshotKeys', manifest.snapshotKeys],
  ].forEach(([label, values]) => {
    if (!Array.isArray(values) || values.length === 0) {
      errors.push(`${label} must be a non-empty array`);
      return;
    }
    findDuplicates(values).forEach((duplicate) => {
      errors.push(`${label} contains duplicate key: ${duplicate}`);
    });
  });

  if (manifest.bridgeLifecyclePolicy !== undefined) {
    errors.push('bridgeLifecyclePolicy is retired; bridge is not an ECS owner role');
  }
  if (manifest.ownerRoles?.includes('bridge')) {
    errors.push('ownerRoles must not include retired bridge');
  }

  return Object.freeze({
    ok: errors.length === 0,
    errors: freezeList(errors),
  });
}

const EcsBoundaryManifest = freezeRecord({
  version: MANIFEST_VERSION,
  batch: BATCH,
  runtimeLoading: RUNTIME_LOADING_POLICY,
  ownerRoles: OWNER_ROLES,
  componentFamilies: COMPONENT_FAMILIES,
  modeKeys: MODE_KEYS,
  snapshotKeys: SNAPSHOT_KEYS,
  validate: validateEcsBoundaryManifest,
});

module.exports = EcsBoundaryManifest;
