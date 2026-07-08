const path = require('node:path');

const GameplayConfigRuntime = require('./config/GameplayConfigRuntime');
const TaskDefinitionImportReporter = require('./TaskDefinitionImportReporter');
const Shared = require('./taskDefinitions/TaskDefinitionShared');
const ImportParser = require('./taskDefinitions/TaskDefinitionImportParser');
const Normalizer = require('./taskDefinitions/TaskDefinitionNormalizer');
const RewardResolver = require('./taskDefinitions/TaskDefinitionRewardResolver');
const TemplateBuilder = require('./taskDefinitions/TaskDefinitionTemplateBuilder');

const DEFAULT_DEFINITIONS_PATH = path.join(__dirname, '..', 'config', 'defaultTaskDefinitions.json');
const TASK_DEFINITIONS_RUNTIME_SOURCE = 'active-release-bundle:task-definitions';

function createSourceOverrideError(sourceKey) {
  const error = new Error(`Task definitions must be loaded from the active config release bundle; ${sourceKey} is not supported.`);
  error.code = 'TASK_DEFINITIONS_SOURCE_OVERRIDE_DISABLED';
  error.sourceKey = sourceKey;
  return error;
}

function assertNoSourceOverride(options = {}) {
  ['runtimePath', 'sourcePath', 'defaultPath'].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(options, key)) {
      throw createSourceOverrideError(key);
    }
  });
}

function createRuntimeNotReadyError(status = null) {
  const errors = [
    ...(status?.errors || []),
    ...(status?.loaderStatus?.errors || []),
    ...(status?.loaderStatus?.warnings || []),
  ].filter(Boolean);
  const message = errors[0]
    || 'Task definitions runtime bundle is not ready; publish a matching config release before serving live tasks.';
  const error = new Error(message);
  error.code = 'TASK_DEFINITIONS_RUNTIME_NOT_READY';
  error.runtimeStatus = status;
  return error;
}

function resolveRuntimeSource() {
  const status = GameplayConfigRuntime.getRuntimeConfigStatus();
  const releaseId = status?.release?.id;
  return releaseId ? `active-release-bundle:${releaseId}:task-definitions` : TASK_DEFINITIONS_RUNTIME_SOURCE;
}

function loadDefinitions(options = {}) {
  assertNoSourceOverride(options);
  let payload = null;
  try {
    payload = GameplayConfigRuntime.getTaskDefinitionsPayload();
  } catch (error) {
    throw createRuntimeNotReadyError({
      errors: [error.message],
      loaderStatus: error.loaderStatus || null,
    });
  }
  if (!payload) throw createRuntimeNotReadyError(GameplayConfigRuntime.getRuntimeConfigStatus());
  const source = resolveRuntimeSource();
  return Normalizer.normalizeDefinitions({ ...payload, source }, { source });
}

function buildReport(action, beforeDefinitions, definitions, errors, payload, options = {}) {
  return TaskDefinitionImportReporter.buildImportReport({
    beforeDefinitions,
    afterDefinitions: definitions,
    errors,
    importedAt: definitions.importedAt,
    importedBy: definitions.importedBy,
    source: definitions.source || Shared.sanitizeText(payload.fileName || options.source, 'upload'),
    action,
  });
}

function previewImport(payload = {}, options = {}) {
  try {
    const beforeDefinitions = loadDefinitions();
    const raw = ImportParser.parseImportPayload(payload);
    const definitions = Normalizer.normalizeDefinitions(raw, {
      ...options,
      source: Shared.sanitizeText(payload.fileName || options.source, 'upload'),
    });
    const report = buildReport('preview', beforeDefinitions, definitions, definitions.errors, payload, options);
    return { success: definitions.errors.length === 0, definitions, errors: definitions.errors, report };
  } catch (error) {
    return {
      success: false,
      error: error.code || 'TASK_DEFINITION_PREVIEW_FAILED',
      errors: [error.message],
      definitions: null,
      report: null,
    };
  }
}

function buildTemplateWorkbookBuffer() {
  return TemplateBuilder.buildTemplateWorkbookBuffer(loadDefinitions());
}

function getDefinitionsSummary() {
  try {
    const definitions = loadDefinitions();
    return {
      schema: 'task-definitions-runtime-summary-v1',
      success: true,
      source: definitions.source,
      version: definitions.version,
      hash: definitions.hash,
      taskCount: definitions.tasks.length,
      mainTaskCount: definitions.summary?.byCategory?.main || 0,
      errors: definitions.errors || [],
      registryErrors: definitions.registryErrors || [],
      registryWarnings: definitions.registryWarnings || [],
    };
  } catch (error) {
    return {
      schema: 'task-definitions-runtime-summary-v1',
      success: false,
      source: TASK_DEFINITIONS_RUNTIME_SOURCE,
      error: error.code || 'TASK_DEFINITIONS_RUNTIME_ERROR',
      errors: [error.message],
      runtimeStatus: error.runtimeStatus || null,
    };
  }
}

module.exports = {
  CATEGORY_IDS: Shared.CATEGORY_IDS,
  RESOURCE_KEYS: Shared.RESOURCE_KEYS,
  DEFAULT_DEFINITIONS_PATH,
  TASK_DEFINITIONS_RUNTIME_SOURCE,
  normalizeCategory: Shared.normalizeCategory,
  normalizeDefinitions: Normalizer.normalizeDefinitions,
  parseImportPayload: ImportParser.parseImportPayload,
  previewImport,
  loadDefinitions,
  getDefinitionsSummary,
  resolveRewardResources: RewardResolver.resolveRewardResources,
  buildTemplateWorkbookBuffer,
};
