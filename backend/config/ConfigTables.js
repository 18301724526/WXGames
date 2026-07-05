// ConfigTables — runtime accessor for the Excel-authored config tables.
//
// Designers edit config/tables/<table>.xlsx; `node scripts/build-config-tables.js` converts them
// to backend/config/generated/<table>.json (committed, freshness-gated in architecture-smoke).
// This loader reads those generated files. Fail-safe: a missing/broken table reads as empty so a
// bad table never crashes the server (the freshness gate catches staleness in CI instead).
const fs = require('node:fs');
const path = require('node:path');

const GENERATED_DIR = path.join(__dirname, 'generated');
const cache = new Map();

function loadTable(table) {
  const key = String(table || '');
  if (cache.has(key)) return cache.get(key);
  const file = path.join(GENERATED_DIR, `${key}.json`);
  let payload = { schema: 'config-table-v1', table: key, rows: [], idField: null };
  try {
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (parsed && Array.isArray(parsed.rows)) payload = parsed;
    }
  } catch (_error) {
    // fail-safe: leave the empty payload
  }
  cache.set(key, payload);
  return payload;
}

function getTable(table) {
  return loadTable(table);
}

function getRows(table) {
  return loadTable(table).rows || [];
}

function getIdField(table) {
  return loadTable(table).idField || null;
}

// Find a single row by its id-column value (the table's first field). Returns null if absent.
function getById(table, id) {
  const idField = getIdField(table);
  if (!idField) return null;
  return getRows(table).find((row) => String(row[idField]) === String(id)) || null;
}

function listTables() {
  try {
    return fs.readdirSync(GENERATED_DIR)
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.replace(/\.json$/, ''))
      .sort();
  } catch (_error) {
    return [];
  }
}

// Test/hot-reload seam.
function clearCache() {
  cache.clear();
}

module.exports = {
  GENERATED_DIR,
  clearCache,
  getById,
  getIdField,
  getRows,
  getTable,
  listTables,
};
