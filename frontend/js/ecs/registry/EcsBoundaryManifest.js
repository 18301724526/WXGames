'use strict';

const MANIFEST_VERSION = 'ecs-boundary-manifest-v1';
const BATCH = '6A. Snapshot Boundary Scaffold';

function freezeList(values) {
  return Object.freeze(Array.from(values));
}

function freezeRecord(record) {
  return Object.freeze({ ...record });
}

const OWNER_ROLES = freezeList([
  'externalEcsCore',
  'componentSchema',
  'system',
  'mode',
  'adapter',
  'registry',
  'bridge',
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
  'TutorialFocus',
  'CommandIntent',
  'Animation',
  'Snapshot',
]);

const MODE_KEYS = freezeList([
  'boot',
  'city',
  'worldMap',
  'techTree',
  'formationEditor',
  'battle',
  'modal:naming',
  'modal:event',
  'modal:rewardReveal',
  'modal:confirmDialog',
  'modal:targetPicker',
  'modal:blockingPanel',
  'tutorial',
  'debug',
]);

const SNAPSHOT_KEYS = freezeList([
  'ShellSnapshot',
  'WorldMapSnapshot',
  'CitySnapshot',
  'TechSnapshot',
  'FormationSnapshot',
  'BattleSnapshot',
  'TutorialSnapshot',
  'DebugSnapshot',
  'RendererSnapshot',
]);

const BRIDGE_LIFECYCLE_POLICY = freezeRecord({
  maxLifetimeBatches: 2,
  maxLifetimeDays: 14,
  allowedWork: freezeList(['forwardLegacyPublicCalls', 'readOnlyFieldMirror', 'bootCompatibility']),
  forbiddenWork: freezeList([
    'newBusinessBranches',
    'newSourceOfTruthFields',
    'newModeDecisions',
    'newRendererAuthority',
  ]),
  extensionRequiredFields: freezeList(['reason', 'newRetirementDate', 'owner', 'blockingGuard']),
});

const RUNTIME_LOADING_POLICY = freezeRecord({
  core: 'node-commonjs-architecture-boundary-only',
  registry: 'node-commonjs-architecture-boundary-only',
  approvedRuntimeSurfaces: freezeList(['frontend/js/ecs/runtime/EcsModeRuntimeBundle.js']),
  forbiddenRuntimeSurfaces: freezeList([
    'frontend/js/ecs/core/**',
    'frontend/js/ecs/registry/**',
    'frontend/js/ecs/mode/**',
    'frontend/js/ecs/input/**',
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

  if (manifest.bridgeLifecyclePolicy?.maxLifetimeBatches !== 2) {
    errors.push('bridgeLifecyclePolicy.maxLifetimeBatches must stay at 2');
  }
  if (manifest.bridgeLifecyclePolicy?.maxLifetimeDays !== 14) {
    errors.push('bridgeLifecyclePolicy.maxLifetimeDays must stay at 14');
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
  bridgeLifecyclePolicy: BRIDGE_LIFECYCLE_POLICY,
  validate: validateEcsBoundaryManifest,
});

module.exports = EcsBoundaryManifest;
