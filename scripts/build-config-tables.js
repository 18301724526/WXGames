#!/usr/bin/env node
// Config-table pipeline: designer-editable Excel (.xlsx) -> game-consumable JSON.
//
//   node scripts/build-config-tables.js --scaffold  # create missing config/tables/<t>.xlsx from schemas
//   node scripts/build-config-tables.js             # config/tables/*.xlsx -> config/generated/<t>.json
//   node scripts/build-config-tables.js --check      # fail if committed JSON is stale (deploy gate)
//
// The .xlsx are the editable DATA; config/tables/table-schemas.js is the STRUCTURE contract (fields,
// types, docs) and seed rows. config/generated/*.json is what the backend config layer loads.
const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('../backend/node_modules/xlsx');
const { TABLES } = require('../config/tables/table-schemas');

const REPO_ROOT = path.resolve(__dirname, '..');
const TABLES_DIR = path.join(REPO_ROOT, 'config', 'tables');
// Generated JSON lives under backend/ so it deploys with (and is required by) the backend runtime.
const GENERATED_DIR = path.join(REPO_ROOT, 'backend', 'config', 'generated');
const DATA_SHEET = 'data';
const DOC_SHEET = '字段说明';

function xlsxPath(table) {
  return path.join(TABLES_DIR, `${table}.xlsx`);
}
function jsonPath(table) {
  return path.join(GENERATED_DIR, `${table}.json`);
}

function coerce(type, raw) {
  const empty = raw === undefined || raw === null || raw === '';
  switch (type) {
    case 'int': return empty ? 0 : Math.trunc(Number(raw));
    case 'float': return empty ? 0 : Number(raw);
    case 'bool': {
      if (typeof raw === 'boolean') return raw;
      const v = String(raw).trim().toLowerCase();
      return v === 'true' || v === '1' || v === 'yes' || v === '是';
    }
    case 'csv': return empty ? [] : String(raw).split(',').map((s) => s.trim()).filter((s) => s !== '');
    case 'json': return empty ? null : JSON.parse(String(raw));
    case 'string':
    default: return empty ? '' : String(raw);
  }
}

// --- scaffold: schema -> .xlsx (data sheet + 字段说明 sheet) -----------------------------------
function scaffold() {
  fs.mkdirSync(TABLES_DIR, { recursive: true });
  const created = [];
  for (const def of TABLES) {
    const file = xlsxPath(def.table);
    if (fs.existsSync(file)) continue;
    const keys = def.fields.map((f) => f.key);
    const dataAoa = [keys, ...def.rows.map((row) => keys.map((k) => {
      const value = row[k];
      const field = def.fields.find((f) => f.key === k);
      return field?.type === 'csv' && Array.isArray(value) ? value.join(',')
        : field?.type === 'json' && value != null ? JSON.stringify(value)
          : value;
    }))];
    const docAoa = [['字段', '类型', '含义', '填什么', '作用'],
      ...def.fields.map((f) => [f.key, f.type, f.label, f.fill, f.effect])];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dataAoa), DATA_SHEET);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(docAoa), DOC_SHEET);
    XLSX.writeFile(wb, file);
    created.push(def.table);
  }
  return created;
}

// --- build: .xlsx -> normalized JSON payload (in memory) --------------------------------------
function buildTable(def) {
  const file = xlsxPath(def.table);
  if (!fs.existsSync(file)) throw new Error(`missing table workbook: config/tables/${def.table}.xlsx (run --scaffold)`);
  const wb = XLSX.readFile(file);
  const sheet = wb.Sheets[DATA_SHEET] || wb.Sheets[wb.SheetNames.find((n) => n !== DOC_SHEET)];
  if (!sheet) throw new Error(`config/tables/${def.table}.xlsx has no '${DATA_SHEET}' sheet`);
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
  const headers = (aoa[0] || []).map((h) => String(h).trim());
  for (const field of def.fields) {
    if (!headers.includes(field.key)) throw new Error(`config/tables/${def.table}.xlsx missing column '${field.key}'`);
  }
  const rows = aoa.slice(1)
    .filter((r) => Array.isArray(r) && r.some((c) => c !== undefined && c !== null && c !== ''))
    .map((r) => {
      const row = {};
      for (const field of def.fields) row[field.key] = coerce(field.type, r[headers.indexOf(field.key)]);
      return row;
    });
  return {
    schema: 'config-table-v1',
    table: def.table,
    description: def.description,
    generatedFrom: `config/tables/${def.table}.xlsx`,
    idField: def.fields[0]?.key || null,
    rows,
  };
}

function serialize(payload) {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function build() {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  const written = [];
  for (const def of TABLES) {
    fs.writeFileSync(jsonPath(def.table), serialize(buildTable(def)), 'utf8');
    written.push(def.table);
  }
  return written;
}

function check() {
  const stale = [];
  for (const def of TABLES) {
    const fresh = serialize(buildTable(def));
    const file = jsonPath(def.table);
    const committed = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (committed !== fresh) stale.push(def.table);
  }
  return stale;
}

function main() {
  const arg = process.argv[2] || '';
  try {
    if (arg === '--scaffold') {
      const created = scaffold();
      process.stdout.write(`[config-tables] scaffolded: ${created.length ? created.join(', ') : '(none missing)'}\n`);
      return;
    }
    if (arg === '--check') {
      const stale = check();
      if (stale.length) {
        process.stderr.write(`[config-tables] STALE generated JSON for: ${stale.join(', ')} — run 'node scripts/build-config-tables.js' and commit config/generated/\n`);
        process.exit(1);
      }
      process.stdout.write(`[config-tables] check passed: ${TABLES.length} table(s) fresh\n`);
      return;
    }
    const written = build();
    process.stdout.write(`[config-tables] built ${written.length} table(s) -> config/generated/: ${written.join(', ')}\n`);
  } catch (error) {
    process.stderr.write(`[config-tables] failed: ${error.message}\n`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { buildTable, check, coerce, scaffold, TABLES_DIR, GENERATED_DIR };
