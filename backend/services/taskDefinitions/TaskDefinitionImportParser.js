const XLSX = require('xlsx');
const { sanitizeText } = require('./TaskDefinitionShared');

const MAX_XLSX_BYTES = 256 * 1024;
const MAX_XLSX_ROWS = 500;
const MAX_XLSX_COLUMNS = 80;
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function parseJsonPayload(payload = {}) {
  if (payload.definitions && typeof payload.definitions === 'object') return payload.definitions;
  const text = payload.contentBase64
    ? Buffer.from(payload.contentBase64, 'base64').toString('utf8')
    : sanitizeText(payload.content);
  return JSON.parse(text);
}

function assertSafeBase64(contentBase64) {
  const text = sanitizeText(contentBase64);
  if (!text || !/^[A-Za-z0-9+/=\s]+$/.test(text)) {
    throw new Error('xlsx content must be base64 encoded');
  }
  return Buffer.from(text, 'base64');
}

function assertSafeCell(cell) {
  if (!cell || typeof cell !== 'object') return;
  if (cell.f || cell.F || cell.D) {
    throw new Error('xlsx formulas are not allowed in task definition imports');
  }
}

function assertSafeKey(key) {
  const normalized = String(key || '').trim().toLowerCase();
  if (DANGEROUS_KEYS.has(normalized)) {
    throw new Error(`xlsx column is not allowed: ${key}`);
  }
}

function assertSafeWorksheet(sheet) {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
  const rowCount = range.e.r - range.s.r + 1;
  const columnCount = range.e.c - range.s.c + 1;
  if (rowCount > MAX_XLSX_ROWS) throw new Error(`xlsx row limit exceeded: ${rowCount}/${MAX_XLSX_ROWS}`);
  if (columnCount > MAX_XLSX_COLUMNS) throw new Error(`xlsx column limit exceeded: ${columnCount}/${MAX_XLSX_COLUMNS}`);
  for (const [cellAddress, cell] of Object.entries(sheet)) {
    if (cellAddress.startsWith('!')) continue;
    assertSafeCell(cell);
  }
}

function sanitizeRows(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map((header) => {
    const key = sanitizeText(header).slice(0, 120);
    assertSafeKey(key);
    return key;
  });
  return rows.slice(1).map((row) => {
    const safeRow = {};
    headers.forEach((key, index) => {
      if (!key) return;
      const value = row[index] ?? '';
      safeRow[key] = typeof value === 'string' ? sanitizeText(value).slice(0, 4096) : value;
    });
    return safeRow;
  });
}

function rowsFromWorkbookBuffer(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error('xlsx content must be a buffer');
  if (buffer.length > MAX_XLSX_BYTES) throw new Error(`xlsx file too large: ${buffer.length}/${MAX_XLSX_BYTES}`);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  if (workbook.SheetNames.length > 1) throw new Error('xlsx imports must contain exactly one worksheet');
  const sheet = workbook.Sheets[sheetName];
  assertSafeWorksheet(sheet);
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: false });
  return sanitizeRows(rows);
}

function parseImportPayload(payload = {}) {
  const fileName = sanitizeText(payload.fileName).toLowerCase();
  const format = sanitizeText(payload.format).toLowerCase();
  if (format === 'xlsx' || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const buffer = assertSafeBase64(payload.contentBase64);
    return { version: sanitizeText(payload.version, '0.1.0'), tasks: rowsFromWorkbookBuffer(buffer) };
  }
  return parseJsonPayload(payload);
}

module.exports = {
  parseImportPayload,
  parseJsonPayload,
  rowsFromWorkbookBuffer,
  MAX_XLSX_BYTES,
  MAX_XLSX_COLUMNS,
  MAX_XLSX_ROWS,
};
