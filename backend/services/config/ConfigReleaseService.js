const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ConfigPipeline = require('./ConfigPipeline');
const { clone } = require('../../../shared/objectUtils');
const { nowIso } = require('../../../shared/timeUtils');

const RELEASE_HISTORY_SCHEMA = 'config-release-history-v1';
const RELEASE_RECORD_SCHEMA = 'config-release-record-v1';
const ACTIVE_RELEASE_SCHEMA = 'config-active-release-v1';
const RUNTIME_STATUS_SCHEMA = 'config-runtime-status-v1';
const RUNTIME_GATE_POLICY_SCHEMA = 'config-runtime-gate-policy-v1';
const RUNTIME_GATE_SCHEMA = 'config-runtime-gate-v1';
const DEFAULT_RUNTIME_STATE_DIR = '/opt/wxgame-workspace/.wxgame';
const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const LOCAL_DEFAULT_DATA_DIR = path.join(REPO_ROOT, 'data', 'config-release');

function joinRuntimePath(basePath, ...parts) {
  return String(basePath || '').startsWith('/')
    ? path.posix.join(basePath, ...parts)
    : path.join(basePath, ...parts);
}

function sanitizeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function stableStringify(value) {
  if (value === undefined) return '';
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function createHash(value, length = 12) {
  return crypto
    .createHash('sha1')
    .update(stableStringify(value))
    .digest('hex')
    .slice(0, Math.max(8, Math.min(40, Number(length) || 12)));
}

function uniqueStrings(values = []) {
  return Array.from(new Set(values.filter((value) => value !== undefined && value !== null)));
}

function normalizeRuntimeGateMode(value) {
  const text = sanitizeText(value).toLowerCase();
  if (!text) return null;
  if (['required', 'require', 'enforce', 'enforced', 'strict', 'true', '1', 'yes'].includes(text)) {
    return 'required';
  }
  if (['warn', 'warning', 'audit', 'audit-only', 'observe', 'observe-only'].includes(text)) {
    return 'warn';
  }
  if (['off', 'disabled', 'disable', 'false', '0', 'no'].includes(text)) {
    return 'off';
  }
  return null;
}

function normalizeBooleanFlag(value) {
  if (value === undefined || value === null) return null;
  const text = sanitizeText(value).toLowerCase();
  if (!text) return null;
  if (['true', '1', 'yes', 'y', 'on'].includes(text)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(text)) return false;
  return null;
}

function getDefaultReleaseDataDir(env = process.env) {
  const configuredStateDir = sanitizeText(env.WXGAME_DEPLOY_STATE_DIR || env.DEPLOY_STATE_DIR);
  if (configuredStateDir) return joinRuntimePath(configuredStateDir, 'config-release');
  const nodeEnv = sanitizeText(env.NODE_ENV, 'development').toLowerCase();
  if (nodeEnv === 'production') return joinRuntimePath(DEFAULT_RUNTIME_STATE_DIR, 'config-release');
  return LOCAL_DEFAULT_DATA_DIR;
}

function getDefaultHistoryPath(env = process.env) {
  return joinRuntimePath(getDefaultReleaseDataDir(env), 'configReleases.json');
}

function getDefaultActivePath(env = process.env) {
  return joinRuntimePath(getDefaultReleaseDataDir(env), 'configActiveRelease.json');
}

const DEFAULT_HISTORY_PATH = getDefaultHistoryPath();
const DEFAULT_ACTIVE_PATH = getDefaultActivePath();

function getHistoryPath(options = {}) {
  const env = options.env || process.env;
  return options.historyPath || env.CONFIG_RELEASE_HISTORY_PATH || getDefaultHistoryPath(env);
}

function getActivePath(options = {}) {
  const env = options.env || process.env;
  return options.activePath || env.CONFIG_ACTIVE_RELEASE_PATH || getDefaultActivePath(env);
}

function readJsonFile(filePath, fallback) {
  if (!filePath || !fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readHistoryFile(historyPath) {
  const parsed = readJsonFile(historyPath, { schema: RELEASE_HISTORY_SCHEMA, releases: [] });
  return {
    schema: parsed.schema || RELEASE_HISTORY_SCHEMA,
    releases: Array.isArray(parsed.releases) ? parsed.releases : [],
  };
}

function createReleaseId(record = {}) {
  const timestamp = sanitizeText(record.createdAt, new Date().toISOString())
    .replace(/[^0-9a-z]+/gi, '')
    .slice(0, 20);
  const digest = createHash({
    action: record.action,
    operator: record.operator,
    source: record.source,
    snapshotHash: record.snapshotHash,
    rollbackTargetReleaseId: record.rollbackTargetReleaseId,
  }, 8);
  return `${timestamp}-${sanitizeText(record.snapshotHash, 'nosnapshot')}-${digest}`;
}

function summarizeComparison(comparison = null) {
  if (!comparison) return null;
  const changedRegistries = Array.isArray(comparison.changedRegistries)
    ? comparison.changedRegistries
    : [];
  const retiredRegistries = Array.isArray(comparison.retiredRegistries)
    ? comparison.retiredRegistries
    : [];
  return {
    success: comparison.success === true,
    changedCount: changedRegistries.length,
    addedCount: Array.isArray(comparison.addedRegistryIds) ? comparison.addedRegistryIds.length : 0,
    removedCount: Array.isArray(comparison.removedRegistryIds) ? comparison.removedRegistryIds.length : 0,
    unchangedCount: Array.isArray(comparison.unchangedRegistryIds) ? comparison.unchangedRegistryIds.length : 0,
    changedRegistryIds: changedRegistries.map((entry) => entry.id).filter(Boolean),
    addedRegistryIds: Array.isArray(comparison.addedRegistryIds) ? comparison.addedRegistryIds : [],
    removedRegistryIds: Array.isArray(comparison.removedRegistryIds) ? comparison.removedRegistryIds : [],
    retiredRegistryIds: retiredRegistries.map((entry) => entry.id).filter(Boolean),
    retiredRegistries,
  };
}

function summarizeSnapshot(snapshot = {}) {
  return {
    schema: snapshot.schema || '',
    generatedAt: snapshot.generatedAt || '',
    registryCount: Array.isArray(snapshot.registries) ? snapshot.registries.length : Number(snapshot.registryCount) || 0,
    validation: {
      success: snapshot.validation?.success === true,
      errors: Array.isArray(snapshot.validation?.errors) ? snapshot.validation.errors : [],
      warnings: Array.isArray(snapshot.validation?.warnings) ? snapshot.validation.warnings : [],
    },
  };
}

function validateSnapshot(snapshot = {}) {
  const errors = [];
  const warnings = [];
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    errors.push('snapshot must be an object');
    return { success: false, errors, warnings };
  }
  if (snapshot.schema !== ConfigPipeline.SNAPSHOT_SCHEMA) {
    errors.push(`snapshot schema must be ${ConfigPipeline.SNAPSHOT_SCHEMA}`);
  }
  if (!Array.isArray(snapshot.registries)) {
    errors.push('snapshot registries must be an array');
  }
  if (snapshot.validation?.success !== true) {
    (snapshot.validation?.errors || ['snapshot validation failed']).forEach((error) => errors.push(error));
  }
  (snapshot.validation?.warnings || []).forEach((warning) => warnings.push(warning));
  return { success: errors.length === 0, errors, warnings };
}

function snapshotForReport(snapshot = {}, validation = validateSnapshot(snapshot)) {
  if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
    return {
      ...snapshot,
      registries: Array.isArray(snapshot.registries) ? snapshot.registries : [],
      validation: snapshot.validation || {
        success: validation.success,
        errors: validation.errors,
        warnings: validation.warnings,
      },
    };
  }
  return {
    schema: '',
    generatedAt: '',
    registryCount: 0,
    validation,
    registries: [],
  };
}

function publicRecord(record = {}, includeSnapshot = false, includeReport = false) {
  const result = {
    schema: record.schema || RELEASE_RECORD_SCHEMA,
    id: record.id,
    action: record.action,
    createdAt: record.createdAt,
    operator: record.operator,
    source: record.source,
    snapshotHash: record.snapshotHash,
    registryCount: record.registryCount,
    validation: record.validation || { success: false, errors: [], warnings: [] },
    comparison: record.comparison || null,
    rollbackTargetReleaseId: record.rollbackTargetReleaseId || null,
    rollbackFromReleaseId: record.rollbackFromReleaseId || null,
  };
  if (includeSnapshot) result.snapshot = record.snapshot;
  if (includeReport) result.report = record.report;
  return result;
}

function publicActiveReleaseSummary(record = {}) {
  if (!record) return null;
  return {
    id: record.id,
    action: record.action,
    createdAt: record.createdAt,
    operator: record.operator,
    source: record.source,
    snapshotHash: record.snapshotHash,
    registryCount: record.registryCount,
  };
}

function loadReleaseHistory(options = {}) {
  const history = readHistoryFile(getHistoryPath(options));
  const releases = history.releases
    .slice()
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, Math.max(1, Number(options.limit) || 20))
    .map((record) => publicRecord(record, Boolean(options.includeSnapshot), Boolean(options.includeReport)));
  return { schema: RELEASE_HISTORY_SCHEMA, releases };
}

function appendReleaseRecord(record = {}, options = {}) {
  const historyPath = getHistoryPath(options);
  const history = readHistoryFile(historyPath);
  history.releases.push(record);
  const maxRecords = Math.max(1, Number(options.maxRecords) || 50);
  history.releases = history.releases
    .slice()
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, maxRecords);
  writeJsonFile(historyPath, { schema: RELEASE_HISTORY_SCHEMA, releases: history.releases });
  return publicRecord(record, true, true);
}

function findReleaseRecord(releaseId, options = {}) {
  const history = readHistoryFile(getHistoryPath(options));
  return history.releases.find((record) => record.id === releaseId) || null;
}

function readActiveReleaseFile(activePath) {
  return readJsonFile(activePath, null);
}

function getActiveRelease(options = {}) {
  const active = readActiveReleaseFile(getActivePath(options));
  if (!active?.release) {
    return { schema: ACTIVE_RELEASE_SCHEMA, release: null };
  }
  return {
    schema: ACTIVE_RELEASE_SCHEMA,
    updatedAt: active.updatedAt,
    release: publicRecord(active.release, Boolean(options.includeSnapshot), Boolean(options.includeReport)),
  };
}

function getRuntimeStatus(options = {}) {
  try {
    const generatedAt = nowIso(options.now);
    const current = options.currentSnapshot
      ? clone(options.currentSnapshot)
      : ConfigPipeline.buildCurrentSnapshot({
        ...options,
        generatedAt,
      });
    const activeRecord = Object.prototype.hasOwnProperty.call(options, 'activeRecord')
      ? options.activeRecord
      : readActiveReleaseFile(getActivePath(options))?.release;
    const currentValidation = validateSnapshot(current);

    if (!activeRecord) {
      return {
        schema: RUNTIME_STATUS_SCHEMA,
        generatedAt,
        mode: 'audit-only',
        status: 'unpublished',
        success: currentValidation.success,
        matchesCurrent: false,
        errors: currentValidation.errors,
        warnings: currentValidation.warnings,
        activeRelease: null,
        current: summarizeSnapshot(current),
        drift: null,
      };
    }

    const activeSnapshot = activeRecord.snapshot || null;
    const activeValidation = validateSnapshot(activeSnapshot);
    const comparison = activeSnapshot && currentValidation.success && activeValidation.success
      ? ConfigPipeline.compareSnapshots(activeSnapshot, current)
      : null;
    const comparisonSummary = summarizeComparison(comparison);
    const hasDiff = Boolean(comparisonSummary && (
      comparisonSummary.changedCount > 0
      || comparisonSummary.addedCount > 0
      || comparisonSummary.removedCount > 0
    ));
    const errors = uniqueStrings([
      ...currentValidation.errors,
      ...activeValidation.errors.map((error) => `active release: ${error}`),
      ...(comparison?.errors || []),
    ]);
    const warnings = uniqueStrings([
      ...currentValidation.warnings,
      ...activeValidation.warnings.map((warning) => `active release: ${warning}`),
      ...(comparison?.warnings || []),
    ]);
    const status = errors.length
      ? 'error'
      : (hasDiff ? 'drift' : 'matched');

    return {
      schema: RUNTIME_STATUS_SCHEMA,
      generatedAt,
      mode: 'audit-only',
      status,
      success: status !== 'error',
      matchesCurrent: status === 'matched',
      errors,
      warnings,
      activeRelease: publicActiveReleaseSummary(activeRecord),
      current: summarizeSnapshot(current),
      drift: comparisonSummary ? {
        ...comparisonSummary,
        matchesCurrent: status === 'matched',
      } : null,
    };
  } catch (error) {
    return {
      schema: RUNTIME_STATUS_SCHEMA,
      generatedAt: nowIso(options.now),
      mode: 'audit-only',
      status: 'error',
      success: false,
      matchesCurrent: false,
      errors: [error?.message || String(error || '')],
      warnings: [],
      activeRelease: null,
      current: null,
      drift: null,
    };
  }
}

function resolveRuntimeGatePolicy(env = process.env, options = {}) {
  const nodeEnv = sanitizeText(options.nodeEnv || env.NODE_ENV, 'development').toLowerCase();
  const explicitMode = normalizeRuntimeGateMode(
    options.mode
      || options.configReleaseGate
      || env.CONFIG_RELEASE_GATE,
  );
  const requireFlag = normalizeBooleanFlag(
    options.requireActiveRelease
      ?? env.REQUIRE_CONFIG_ACTIVE_RELEASE,
  );
  const mode = explicitMode
    || (requireFlag === true ? 'required' : null)
    || (requireFlag === false ? 'off' : null)
    || (nodeEnv === 'production' ? 'required' : 'warn');

  return {
    schema: RUNTIME_GATE_POLICY_SCHEMA,
    mode,
    required: mode === 'required',
    nodeEnv,
    source: explicitMode
      ? 'CONFIG_RELEASE_GATE'
      : (requireFlag !== null ? 'REQUIRE_CONFIG_ACTIVE_RELEASE' : 'NODE_ENV'),
  };
}

function createRuntimeGateError(runtimeStatus = {}, policy = {}) {
  const status = sanitizeText(runtimeStatus.status, 'unknown');
  const activeRelease = runtimeStatus.activeRelease?.id || 'none';
  const error = new Error(
    `Config runtime release gate failed: status=${status}, activeRelease=${activeRelease}. `
      + 'Publish a matching config release or set CONFIG_RELEASE_GATE=warn/off for non-production diagnostics.',
  );
  error.code = 'CONFIG_RUNTIME_RELEASE_GATE_FAILED';
  error.policy = policy;
  error.runtimeStatus = runtimeStatus;
  return error;
}

function assertRuntimeReleaseReady(options = {}) {
  const policy = resolveRuntimeGatePolicy(options.env || process.env, options.policy || options);
  const runtimeStatus = getRuntimeStatus(options);
  const gate = {
    schema: RUNTIME_GATE_SCHEMA,
    generatedAt: runtimeStatus.generatedAt || nowIso(options.now),
    policy,
    ready: runtimeStatus.status === 'matched',
    runtimeStatus,
    error: null,
  };
  if (policy.required && !gate.ready) {
    const error = createRuntimeGateError(runtimeStatus, policy);
    gate.error = {
      code: error.code,
      message: error.message,
    };
    error.gate = gate;
    throw error;
  }
  return gate;
}

function writeActiveRelease(record = {}, options = {}) {
  const payload = {
    schema: ACTIVE_RELEASE_SCHEMA,
    updatedAt: record.createdAt,
    releaseId: record.id,
    release: record,
  };
  writeJsonFile(getActivePath(options), payload);
  return getActiveRelease({ ...options, includeSnapshot: true, includeReport: true });
}

function resolveOperator(options = {}) {
  return sanitizeText(options.operator || options.importedBy || options.username, 'system');
}

function resolveSource(payload = {}, options = {}) {
  return sanitizeText(payload.source || payload.fileName || options.source, 'current-config');
}

function resolveSnapshot(payload = {}, options = {}) {
  if (payload.snapshot) return clone(payload.snapshot);
  if (options.currentSnapshot) return clone(options.currentSnapshot);
  return ConfigPipeline.buildCurrentSnapshot({
    ...options,
    generatedAt: nowIso(options.now),
  });
}

function resolveBaselineSnapshot(payload = {}, options = {}) {
  if (payload.baselineSnapshot) return clone(payload.baselineSnapshot);
  if (options.baselineSnapshot) return clone(options.baselineSnapshot);
  if (payload.baselinePath || options.baselinePath) {
    return ConfigPipeline.readSnapshot(path.resolve(payload.baselinePath || options.baselinePath));
  }
  const active = readActiveReleaseFile(getActivePath(options));
  return active?.release?.snapshot ? clone(active.release.snapshot) : null;
}

function buildPreviewReport(payload = {}, options = {}) {
  const rawCurrent = resolveSnapshot(payload, options);
  const snapshotValidation = validateSnapshot(rawCurrent);
  const current = snapshotForReport(rawCurrent, snapshotValidation);
  const baseline = resolveBaselineSnapshot(payload, options);
  const report = ConfigPipeline.buildPipelineReport({
    ...options,
    currentSnapshot: current,
    baselineSnapshot: baseline,
    generatedAt: nowIso(options.now),
  });
  const errors = uniqueStrings([...snapshotValidation.errors, ...report.errors]);
  const warnings = uniqueStrings([...snapshotValidation.warnings, ...report.warnings]);
  return {
    ...report,
    success: errors.length === 0,
    errors,
    warnings,
    current,
    baseline: baseline ? summarizeSnapshot(baseline) : null,
  };
}

function previewRelease(payload = {}, options = {}) {
  const report = buildPreviewReport(payload, options);
  return {
    success: report.success,
    errors: report.errors,
    warnings: report.warnings,
    candidate: {
      action: 'preview',
      createdAt: nowIso(options.now),
      operator: resolveOperator(options),
      source: resolveSource(payload, options),
      snapshotHash: createHash(report.current),
      registryCount: Array.isArray(report.current.registries) ? report.current.registries.length : 0,
      validation: {
        success: report.success,
        errors: report.errors,
        warnings: report.warnings,
      },
      comparison: summarizeComparison(report.comparison),
    },
    report,
  };
}

function buildReleaseRecord(action, report, payload = {}, options = {}) {
  const createdAt = nowIso(options.now);
  const snapshot = clone(report.current);
  const record = {
    schema: RELEASE_RECORD_SCHEMA,
    action,
    createdAt,
    operator: resolveOperator(options),
    source: resolveSource(payload, options),
    snapshotHash: createHash(snapshot),
    registryCount: Array.isArray(snapshot.registries) ? snapshot.registries.length : 0,
    validation: {
      success: report.success,
      errors: report.errors,
      warnings: report.warnings,
    },
    comparison: summarizeComparison(report.comparison),
    report: {
      schema: report.schema,
      generatedAt: report.generatedAt,
      success: report.success,
      errors: report.errors,
      warnings: report.warnings,
      baseline: report.baseline,
      comparison: report.comparison,
    },
    snapshot,
  };
  record.id = createReleaseId(record);
  return record;
}

function publishRelease(payload = {}, options = {}) {
  const preview = previewRelease(payload, options);
  if (!preview.success) {
    return {
      success: false,
      error: 'CONFIG_RELEASE_VALIDATION_FAILED',
      errors: preview.errors,
      warnings: preview.warnings,
      preview,
    };
  }
  const record = buildReleaseRecord('publish', preview.report, payload, options);
  const release = appendReleaseRecord(record, options);
  const activeRelease = writeActiveRelease(record, options);
  return { success: true, release, activeRelease, report: preview.report };
}

function buildRollbackReport(targetRecord = {}, options = {}) {
  const targetSnapshot = clone(targetRecord.snapshot);
  const validation = validateSnapshot(targetSnapshot);
  const active = readActiveReleaseFile(getActivePath(options));
  const activeSnapshot = active?.release?.snapshot || null;
  const comparison = activeSnapshot ? ConfigPipeline.compareSnapshots(activeSnapshot, targetSnapshot) : null;
  const comparisonWarnings = [
    ...(comparison?.errors || []).map((error) => `rollback comparison: ${error}`),
    ...(comparison?.warnings || []),
  ];
  return {
    schema: 'config-release-rollback-report-v1',
    generatedAt: nowIso(options.now),
    success: validation.success,
    errors: validation.errors,
    warnings: [...validation.warnings, ...comparisonWarnings],
    current: targetSnapshot,
    baseline: activeSnapshot ? summarizeSnapshot(activeSnapshot) : null,
    comparison,
    rollbackTargetReleaseId: targetRecord.id,
    rollbackFromReleaseId: active?.release?.id || null,
  };
}

function rollbackRelease(releaseId, options = {}) {
  const targetRecord = findReleaseRecord(releaseId, options);
  if (!targetRecord?.snapshot) {
    return {
      success: false,
      error: 'CONFIG_RELEASE_NOT_FOUND',
      message: 'Config release record was not found.',
    };
  }
  const report = buildRollbackReport(targetRecord, options);
  if (!report.success) {
    return {
      success: false,
      error: 'CONFIG_RELEASE_ROLLBACK_VALIDATION_FAILED',
      errors: report.errors,
      warnings: report.warnings,
      report,
    };
  }
  const record = buildReleaseRecord('rollback', report, {
    source: `rollback:${targetRecord.id}`,
  }, options);
  record.rollbackTargetReleaseId = targetRecord.id;
  record.rollbackFromReleaseId = report.rollbackFromReleaseId;
  record.id = createReleaseId(record);
  const release = appendReleaseRecord(record, options);
  const activeRelease = writeActiveRelease(record, options);
  return { success: true, release, activeRelease, report };
}

module.exports = {
  ACTIVE_RELEASE_SCHEMA,
  DEFAULT_ACTIVE_PATH,
  DEFAULT_HISTORY_PATH,
  DEFAULT_RUNTIME_STATE_DIR,
  RELEASE_HISTORY_SCHEMA,
  RELEASE_RECORD_SCHEMA,
  RUNTIME_GATE_POLICY_SCHEMA,
  RUNTIME_GATE_SCHEMA,
  RUNTIME_STATUS_SCHEMA,
  appendReleaseRecord,
  assertRuntimeReleaseReady,
  findReleaseRecord,
  getDefaultActivePath,
  getDefaultHistoryPath,
  getDefaultReleaseDataDir,
  getActivePath,
  getActiveRelease,
  getHistoryPath,
  getRuntimeStatus,
  loadReleaseHistory,
  previewRelease,
  publishRelease,
  resolveRuntimeGatePolicy,
  rollbackRelease,
  validateSnapshot,
};
