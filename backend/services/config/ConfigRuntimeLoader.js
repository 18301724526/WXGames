const ConfigPipeline = require('./ConfigPipeline');
const ConfigReleaseService = require('./ConfigReleaseService');
const ConfigRegistryContract = require('./ConfigRegistryContract');

const RUNTIME_BUNDLE_SCHEMA = 'config-runtime-bundle-v1';
const RUNTIME_LOADER_STATUS_SCHEMA = 'config-runtime-loader-status-v1';

function nowIso(now = new Date()) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function summarizeRegistry(registry = {}) {
  return {
    id: registry.id,
    schema: registry.schema,
    schemaVersion: registry.schemaVersion,
    version: registry.version,
    contentHash: registry.contentHash,
    entryCount: registry.entryCount,
    source: registry.source,
  };
}

function getPayloadRegistryReports(options = {}) {
  return ConfigPipeline.collectRegistryReports({
    ...options,
    includePayload: true,
  });
}

function buildPayloadMap(registryReports = []) {
  return registryReports.reduce((result, report) => {
    result[report.id] = clone(report.payload);
    return result;
  }, {});
}

function validatePayloadHashes(snapshot = {}, registryReports = []) {
  const reportsById = new Map(registryReports.map((report) => [report.id, report]));
  const errors = [];
  const warnings = [];
  const registries = Array.isArray(snapshot.registries) ? snapshot.registries : [];

  registries.forEach((registry) => {
    const report = reportsById.get(registry.id);
    if (!report) {
      errors.push(`${registry.id}: payload loader missing`);
      return;
    }
    if (report.validation?.success !== true) {
      (report.validation?.errors || ['payload registry validation failed'])
        .forEach((error) => errors.push(`${registry.id}: ${error}`));
    }
    (report.validation?.warnings || []).forEach((warning) => warnings.push(`${registry.id}: ${warning}`));
    if (report.metadata?.contentHash !== registry.contentHash) {
      errors.push(`${registry.id}: payload hash ${report.metadata?.contentHash || 'missing'} does not match active release hash ${registry.contentHash || 'missing'}`);
    }
  });

  registryReports
    .filter((report) => !registries.some((registry) => registry.id === report.id))
    .forEach((report) => warnings.push(`${report.id}: payload loader is not present in active release snapshot`));

  return {
    success: errors.length === 0,
    errors,
    warnings,
  };
}

function buildRuntimeBundle(options = {}) {
  const gate = ConfigReleaseService.assertRuntimeReleaseReady(options);
  if (!gate.ready) {
    return {
      schema: RUNTIME_BUNDLE_SCHEMA,
      generatedAt: nowIso(options.now),
      success: false,
      status: gate.runtimeStatus.status,
      gate,
      release: gate.runtimeStatus.activeRelease,
      registries: [],
      payloadIncluded: false,
      payload: {},
      errors: [],
      warnings: ['runtime release gate is not matched; bundle payload was not loaded'],
    };
  }

  const active = ConfigReleaseService.getActiveRelease({
    ...options,
    includeSnapshot: true,
  });
  const snapshot = active.release?.snapshot || {};
  const registryReports = getPayloadRegistryReports(options);
  const payloadValidation = validatePayloadHashes(snapshot, registryReports);

  return {
    schema: RUNTIME_BUNDLE_SCHEMA,
    generatedAt: nowIso(options.now),
    success: payloadValidation.success,
    status: payloadValidation.success ? 'ready' : 'error',
    gate,
    release: active.release ? {
      id: active.release.id,
      action: active.release.action,
      createdAt: active.release.createdAt,
      operator: active.release.operator,
      source: active.release.source,
      snapshotHash: active.release.snapshotHash,
      registryCount: active.release.registryCount,
    } : null,
    registries: (snapshot.registries || []).map(summarizeRegistry),
    payloadIncluded: payloadValidation.success,
    payload: payloadValidation.success ? buildPayloadMap(registryReports) : {},
    errors: payloadValidation.errors,
    warnings: payloadValidation.warnings,
  };
}

function getRuntimeLoaderStatus(options = {}) {
  try {
    const gate = ConfigReleaseService.assertRuntimeReleaseReady(options);
    if (!gate.ready) {
      return {
        schema: RUNTIME_LOADER_STATUS_SCHEMA,
        generatedAt: nowIso(options.now),
        success: true,
        status: 'gate-open-observe-only',
        ready: false,
        gate,
        release: gate.runtimeStatus.activeRelease,
        payloadIncluded: false,
        registryCount: 0,
        errors: [],
        warnings: ['runtime release gate is not matched; payload loader is waiting for an active matched release'],
      };
    }
    const bundle = buildRuntimeBundle(options);
    return {
      schema: RUNTIME_LOADER_STATUS_SCHEMA,
      generatedAt: bundle.generatedAt,
      success: bundle.success,
      status: bundle.status,
      ready: bundle.success,
      gate: bundle.gate,
      release: bundle.release,
      payloadIncluded: bundle.payloadIncluded,
      registryCount: bundle.registries.length,
      errors: bundle.errors,
      warnings: bundle.warnings,
    };
  } catch (error) {
    return {
      schema: RUNTIME_LOADER_STATUS_SCHEMA,
      generatedAt: nowIso(options.now),
      success: false,
      status: 'error',
      ready: false,
      gate: error.gate || null,
      release: error.gate?.runtimeStatus?.activeRelease || null,
      payloadIncluded: false,
      registryCount: 0,
      errors: [error?.message || String(error || '')],
      warnings: [],
    };
  }
}

module.exports = {
  RUNTIME_BUNDLE_SCHEMA,
  RUNTIME_LOADER_STATUS_SCHEMA,
  buildRuntimeBundle,
  getRuntimeLoaderStatus,
  validatePayloadHashes,
  createStablePayloadHash: ConfigRegistryContract.createStableContentHash,
};
