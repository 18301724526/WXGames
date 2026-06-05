const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function sanitizeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function defaultHistoryPath(runtimePath) {
  const basePath = runtimePath || path.join(__dirname, '..', '..', 'data', 'taskDefinitions.json');
  return path.join(path.dirname(basePath), 'taskDefinitionImports.json');
}

function getHistoryPath(options = {}) {
  return options.historyPath
    || process.env.TASK_DEFINITIONS_IMPORT_HISTORY_PATH
    || defaultHistoryPath(options.runtimePath);
}

function createImportId(report = {}) {
  const timestamp = sanitizeText(report.importedAt, new Date().toISOString())
    .replace(/[^0-9a-z]+/gi, '')
    .slice(0, 20);
  const digest = crypto
    .createHash('sha1')
    .update(JSON.stringify(report))
    .digest('hex')
    .slice(0, 8);
  return `${timestamp}-${sanitizeText(report.hash, 'nohash')}-${digest}`;
}

function readHistoryFile(historyPath) {
  if (!historyPath || !fs.existsSync(historyPath)) return { imports: [] };
  const parsed = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  return { imports: Array.isArray(parsed.imports) ? parsed.imports : [] };
}

function writeHistoryFile(historyPath, history) {
  fs.mkdirSync(path.dirname(historyPath), { recursive: true });
  fs.writeFileSync(historyPath, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
}

function publicRecord(record = {}, includeDefinitions = false) {
  const result = {
    id: record.id,
    action: record.action || 'import',
    importedAt: record.importedAt,
    importedBy: record.importedBy,
    source: record.source,
    version: record.version,
    hash: record.hash,
    summary: record.summary || {},
    validation: record.validation || { success: true, errors: [] },
    diff: record.diff || {},
  };
  if (includeDefinitions) result.definitions = record.definitions;
  return result;
}

function loadImportHistory(options = {}) {
  const historyPath = getHistoryPath(options);
  const history = readHistoryFile(historyPath);
  const imports = history.imports
    .slice()
    .sort((a, b) => String(b.importedAt || '').localeCompare(String(a.importedAt || '')))
    .slice(0, Math.max(1, Number(options.limit) || 20))
    .map((record) => publicRecord(record, Boolean(options.includeDefinitions)));
  return { imports };
}

function appendImportRecord(report = {}, definitions = {}, options = {}) {
  const historyPath = getHistoryPath(options);
  const history = readHistoryFile(historyPath);
  const record = {
    id: createImportId(report),
    ...report,
    definitions,
  };
  history.imports.push(record);
  const maxRecords = Math.max(1, Number(options.maxRecords) || 50);
  history.imports = history.imports
    .slice()
    .sort((a, b) => String(b.importedAt || '').localeCompare(String(a.importedAt || '')))
    .slice(0, maxRecords);
  writeHistoryFile(historyPath, history);
  return publicRecord(record, true);
}

function findImportRecord(importId, options = {}) {
  const historyPath = getHistoryPath(options);
  const history = readHistoryFile(historyPath);
  return history.imports.find((record) => record.id === importId) || null;
}

module.exports = {
  appendImportRecord,
  findImportRecord,
  getHistoryPath,
  loadImportHistory,
};
