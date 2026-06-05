const XLSX = require('xlsx');
const { sanitizeText } = require('./TaskDefinitionShared');

function parseJsonPayload(payload = {}) {
  if (payload.definitions && typeof payload.definitions === 'object') return payload.definitions;
  const text = payload.contentBase64
    ? Buffer.from(payload.contentBase64, 'base64').toString('utf8')
    : sanitizeText(payload.content);
  return JSON.parse(text);
}

function rowsFromWorkbookBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false });
}

function parseImportPayload(payload = {}) {
  const fileName = sanitizeText(payload.fileName).toLowerCase();
  const format = sanitizeText(payload.format).toLowerCase();
  if (format === 'xlsx' || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const buffer = Buffer.from(sanitizeText(payload.contentBase64), 'base64');
    return { version: sanitizeText(payload.version, '0.1.0'), tasks: rowsFromWorkbookBuffer(buffer) };
  }
  return parseJsonPayload(payload);
}

module.exports = {
  parseImportPayload,
  parseJsonPayload,
  rowsFromWorkbookBuffer,
};
