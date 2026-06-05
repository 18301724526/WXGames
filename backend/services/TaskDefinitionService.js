const fs = require('node:fs');
const path = require('node:path');

const TaskDefinitionImportReporter = require('./TaskDefinitionImportReporter');
const TaskDefinitionImportHistory = require('./TaskDefinitionImportHistory');
const Shared = require('./taskDefinitions/TaskDefinitionShared');
const ImportParser = require('./taskDefinitions/TaskDefinitionImportParser');
const Normalizer = require('./taskDefinitions/TaskDefinitionNormalizer');
const RewardResolver = require('./taskDefinitions/TaskDefinitionRewardResolver');
const TemplateBuilder = require('./taskDefinitions/TaskDefinitionTemplateBuilder');

const DEFAULT_DEFINITIONS_PATH = path.join(__dirname, '..', 'config', 'defaultTaskDefinitions.json');
const RUNTIME_DEFINITIONS_PATH = process.env.TASK_DEFINITIONS_PATH
  || path.join(__dirname, '..', '..', 'data', 'taskDefinitions.json');

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadDefinitions(options = {}) {
  const runtimePath = options.runtimePath || RUNTIME_DEFINITIONS_PATH;
  const defaultPath = options.defaultPath || DEFAULT_DEFINITIONS_PATH;
  const sourcePath = fs.existsSync(runtimePath) ? runtimePath : defaultPath;
  return Normalizer.normalizeDefinitions(readJsonFile(sourcePath), { source: sourcePath });
}

function safeLoadDefinitions(options = {}) {
  try {
    return loadDefinitions(options);
  } catch (error) {
    return Normalizer.normalizeDefinitions({ version: 'empty', tasks: [] }, { ...options, source: 'empty' });
  }
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
    const beforeDefinitions = safeLoadDefinitions(options);
    const raw = ImportParser.parseImportPayload(payload);
    const definitions = Normalizer.normalizeDefinitions(raw, {
      ...options,
      source: Shared.sanitizeText(payload.fileName || options.source, 'upload'),
    });
    const report = buildReport('preview', beforeDefinitions, definitions, definitions.errors, payload, options);
    return { success: definitions.errors.length === 0, definitions, errors: definitions.errors, report };
  } catch (error) {
    return { success: false, errors: [error.message], definitions: null, report: null };
  }
}

function saveDefinitions(runtimePath, definitions) {
  fs.mkdirSync(path.dirname(runtimePath), { recursive: true });
  fs.writeFileSync(runtimePath, `${JSON.stringify(definitions, null, 2)}\n`, 'utf8');
}

function importDefinitions(payload = {}, options = {}) {
  const beforeDefinitions = safeLoadDefinitions(options);
  const preview = previewImport(payload, options);
  if (!preview.success) return preview;
  const runtimePath = options.runtimePath || RUNTIME_DEFINITIONS_PATH;
  const definitions = {
    ...preview.definitions,
    importedAt: Shared.nowIso(options.now),
    importedBy: Shared.sanitizeText(options.importedBy, 'system'),
    source: Shared.sanitizeText(payload.fileName || options.source, 'upload'),
  };
  saveDefinitions(runtimePath, definitions);
  const report = buildReport('import', beforeDefinitions, definitions, [], payload, options);
  const importRecord = TaskDefinitionImportHistory.appendImportRecord(report, definitions, {
    ...options,
    runtimePath,
  });
  return { success: true, definitions, errors: [], report, importRecord };
}

function getImportHistory(options = {}) {
  return TaskDefinitionImportHistory.loadImportHistory(options);
}

function rollbackImport(importId, options = {}) {
  const runtimePath = options.runtimePath || RUNTIME_DEFINITIONS_PATH;
  const record = TaskDefinitionImportHistory.findImportRecord(importId, { ...options, runtimePath });
  if (!record?.definitions) {
    return { success: false, error: 'IMPORT_RECORD_NOT_FOUND', message: '导入记录不存在' };
  }
  const beforeDefinitions = safeLoadDefinitions({ ...options, runtimePath });
  const definitions = {
    ...record.definitions,
    importedAt: Shared.nowIso(options.now),
    importedBy: Shared.sanitizeText(options.importedBy, 'system'),
    source: `rollback:${record.id}`,
  };
  saveDefinitions(runtimePath, definitions);
  const report = buildReport('rollback', beforeDefinitions, definitions, [], { fileName: definitions.source }, options);
  const importRecord = TaskDefinitionImportHistory.appendImportRecord(report, definitions, {
    ...options,
    runtimePath,
  });
  return { success: true, definitions, errors: [], report, importRecord };
}

function buildTemplateWorkbookBuffer() {
  return TemplateBuilder.buildTemplateWorkbookBuffer(loadDefinitions());
}

module.exports = {
  CATEGORY_IDS: Shared.CATEGORY_IDS,
  RESOURCE_KEYS: Shared.RESOURCE_KEYS,
  DEFAULT_DEFINITIONS_PATH,
  RUNTIME_DEFINITIONS_PATH,
  normalizeCategory: Shared.normalizeCategory,
  normalizeDefinitions: Normalizer.normalizeDefinitions,
  parseImportPayload: ImportParser.parseImportPayload,
  previewImport,
  importDefinitions,
  getImportHistory,
  rollbackImport,
  loadDefinitions,
  resolveRewardResources: RewardResolver.resolveRewardResources,
  buildTemplateWorkbookBuffer,
};
