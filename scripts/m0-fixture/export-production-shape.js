'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE_SCHEMA = 'wxgame-production-shape-fixture-v1';
const FIXTURE_METADATA_SCHEMA = 'wxgame-production-shape-fixture-metadata-v1';
const CHECKSUM_SCHEMA = 'wxgame-production-shape-checksum-v1';
const CHECKSUM_RULE_VERSION = 'm0-production-shape-checksum-v1';
const SANITIZATION_SCHEMA = 'wxgame-production-shape-sanitization-v1';
const DEFAULT_SOURCE_DB = '/root/wxgame-test/backend/civilization.db';
const DEFAULT_RUNTIME_BACKEND_DIR = '/root/wxgame-test/backend';
const DEFAULT_FIXTURE_PATH = path.join(
  PROJECT_ROOT,
  'tmp',
  'm0-fixture',
  'production-shape.fixture.json',
);
const DEFAULT_METADATA_PATH = path.join(
  PROJECT_ROOT,
  'docs',
  'architecture',
  'm0',
  'production-shape-fixture-metadata.json',
);

const EXCLUDED_TABLES = Object.freeze(['codex_db_write_probe']);
const VOLATILE_TIME_FIELDS = Object.freeze([
  'advancedAt',
  'appliedAt',
  'at',
  'builtAt',
  'capturedAt',
  'checkedAt',
  'claimedAt',
  'completedAt',
  'completesAt',
  'createdAt',
  'discoveredAt',
  'durationMs',
  'expiredAt',
  'expiresAt',
  'finishedAt',
  'firstDiscoveredAt',
  'foughtAt',
  'foundedAt',
  'generatedAt',
  'grantedAt',
  'importedAt',
  'issuedAt',
  'joinedAt',
  'lastActiveAt',
  'lastAdvancedAt',
  'lastAppliedAt',
  'lastAt',
  'lastEventAt',
  'lastGeneratedAt',
  'lastScoutedAt',
  'lockedAt',
  'migratedAt',
  'nextAt',
  'nextStepAt',
  'occupiedAt',
  'receivedAt',
  'resolvedAt',
  'respawnAt',
  'revealedAt',
  'scoutedAt',
  'serverTime',
  'settledAt',
  'since',
  'startedAt',
  'timestamp',
  'updatedAt',
  'upgradedAt',
  'woundedUntil',
]);
const VOLATILE_TIME_FIELD_SET = new Set(
  VOLATILE_TIME_FIELDS.map((field) => field.toLowerCase()),
);

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\b/g;
const BEARER_PATTERN = /\bBearer\s+([A-Za-z0-9._~+/-]{8,}=*)/gi;
const QUERY_SECRET_PATTERN = /\b(?:access_token|refresh_token|token|api_key|apikey|password|secret)=([^&\s"'<>]+)/gi;

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(String(left), 'utf8'), Buffer.from(String(right), 'utf8'));
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .sort(compareUtf8)
    .reduce((result, key) => {
      result[key] = sortObject(value[key]);
      return result;
    }, {});
}

function stableJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(sortObject(value), null, 2)}\n`, 'utf8');
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function isWithinRoot(candidatePath, rootPath) {
  const relative = path.relative(rootPath, candidatePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertCliArtifactPath(candidatePath, label) {
  const resolved = path.resolve(candidatePath);
  const allowedRoots = [
    path.join(PROJECT_ROOT, 'tmp'),
    path.join(PROJECT_ROOT, 'docs', 'architecture', 'm0'),
  ];
  if (!allowedRoots.some((root) => isWithinRoot(resolved, root))) {
    throw new Error(`${label} must stay under tmp/ or docs/architecture/m0/: ${resolved}`);
  }
  return resolved;
}

function writeStableJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, stableJsonBytes(value));
}

function loadDatabaseConstructor(options = {}) {
  if (typeof options.Database === 'function') return options.Database;
  const backendDirs = [
    options.backendDir,
    process.env.M0_FIXTURE_BACKEND_DIR,
    path.join(PROJECT_ROOT, 'backend'),
    DEFAULT_RUNTIME_BACKEND_DIR,
    '/opt/wxgame-workspace/backend',
  ].filter(Boolean);
  const errors = [];
  for (const backendDir of [...new Set(backendDirs)]) {
    try {
      return require(path.join(backendDir, 'node_modules', 'better-sqlite3'));
    } catch (error) {
      errors.push(`${backendDir}: ${error.message}`);
    }
  }
  try {
    return require('better-sqlite3');
  } catch (error) {
    errors.push(`module lookup: ${error.message}`);
  }
  throw new Error(`Unable to load better-sqlite3 (${errors.join('; ')})`);
}

function parseJsonContainer(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const isContainer =
    (trimmed.startsWith('{') && trimmed.endsWith('}'))
    || (trimmed.startsWith('[') && trimmed.endsWith(']'));
  if (!isContainer) return null;
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    return null;
  }
}

function classifySensitiveKey(key) {
  const compact = String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!compact) return '';
  if (
    /(?:token|password|passwd|secret|credential|authorization|apikey|accesskey|refreshkey|privatekey|cookie)/.test(
      compact,
    )
  ) {
    return 'secret';
  }
  if (/(?:email|mailaddress)$/.test(compact)) return 'email';
  if (/(?:deviceid|devicefingerprint|browserfingerprint)$/.test(compact)) return 'device';
  if (/(?:username|accountname|displayname|nickname|realname|loginname|playername)$/.test(compact)) {
    return 'username';
  }
  if (
    /^(?:playerid|ownerplayerid|userid|accountid|firstdiscoveredby|discoveredby|claimedby)$/.test(
      compact,
    )
  ) {
    return 'identity';
  }
  if (/^(?:ip|ipaddress|clientip|remoteip)$/.test(compact)) return 'ip';
  if (/^(?:phone|phonenumber|mobile|mobilephone)$/.test(compact)) return 'phone';
  return '';
}

function aliasValue(kind, rawValue) {
  const value = String(rawValue ?? '');
  if (!value) return value;
  const digest = sha256Hex(Buffer.from(`${kind}\0${value}`, 'utf8')).slice(0, 16);
  return `m0_${kind}_${digest}`;
}

function addSensitiveValue(collection, kind, rawValue) {
  const value = String(rawValue ?? '');
  if (!kind || !value) return;
  const kinds = collection.get(value) || new Set();
  kinds.add(kind);
  collection.set(value, kinds);
}

function collectPatternValues(text, collection) {
  for (const match of String(text).matchAll(new RegExp(EMAIL_PATTERN.source, EMAIL_PATTERN.flags))) {
    addSensitiveValue(collection, 'email', match[0]);
  }
  for (const match of String(text).matchAll(new RegExp(JWT_PATTERN.source, JWT_PATTERN.flags))) {
    addSensitiveValue(collection, 'secret', match[0]);
  }
  for (const match of String(text).matchAll(new RegExp(BEARER_PATTERN.source, BEARER_PATTERN.flags))) {
    addSensitiveValue(collection, 'secret', match[1]);
  }
  for (const match of String(text).matchAll(
    new RegExp(QUERY_SECRET_PATTERN.source, QUERY_SECRET_PATTERN.flags),
  )) {
    addSensitiveValue(collection, 'secret', match[1]);
  }
}

function collectSensitiveValues(value, key, collection) {
  if (Buffer.isBuffer(value) || value == null) return;
  if (Array.isArray(value)) {
    value.forEach((entry) => collectSensitiveValues(entry, key, collection));
    return;
  }
  if (typeof value === 'object') {
    Object.entries(value).forEach(([childKey, childValue]) => {
      collectSensitiveValues(childValue, childKey, collection);
    });
    return;
  }
  if (typeof value !== 'string') return;
  const kind = classifySensitiveKey(key);
  if (kind) addSensitiveValue(collection, kind, value);
  collectPatternValues(value, collection);
  const parsed = parseJsonContainer(value);
  if (parsed !== null) collectSensitiveValues(parsed, key, collection);
}

function chooseSensitiveKind(kinds) {
  const priority = ['secret', 'email', 'identity', 'username', 'device', 'phone', 'ip'];
  return priority.find((kind) => kinds.has(kind)) || [...kinds].sort(compareUtf8)[0];
}

function buildReplacementEntries(collection) {
  return [...collection.entries()]
    .map(([raw, kinds]) => {
      const kind = chooseSensitiveKind(kinds);
      return { raw, replacement: aliasValue(kind, raw) };
    })
    .sort((left, right) => right.raw.length - left.raw.length || compareUtf8(left.raw, right.raw));
}

function sanitizeFreeText(value, replacements) {
  let output = String(value);
  for (const { raw, replacement } of replacements) {
    if (raw.length >= 4 && output.includes(raw)) output = output.split(raw).join(replacement);
  }
  output = output.replace(new RegExp(EMAIL_PATTERN.source, EMAIL_PATTERN.flags), (email) => (
    aliasValue('email', email)
  ));
  output = output.replace(new RegExp(JWT_PATTERN.source, JWT_PATTERN.flags), (token) => (
    aliasValue('secret', token)
  ));
  output = output.replace(new RegExp(BEARER_PATTERN.source, BEARER_PATTERN.flags), (_, token) => (
    `credential_redacted_${sha256Hex(Buffer.from(token, 'utf8')).slice(0, 12)}`
  ));
  output = output.replace(
    new RegExp(QUERY_SECRET_PATTERN.source, QUERY_SECRET_PATTERN.flags),
    (_, secret) => `credential_redacted_${sha256Hex(Buffer.from(secret, 'utf8')).slice(0, 12)}`,
  );
  return output;
}

function sanitizeBlob(value) {
  const source = Buffer.from(value);
  if (source.length === 0) return source;
  const digest = crypto.createHash('sha256').update(source).digest();
  const output = Buffer.alloc(source.length);
  for (let index = 0; index < output.length; index += 1) output[index] = digest[index % digest.length];
  return output;
}

function sanitizeValue(value, key, replacements) {
  if (value == null) return value;
  if (Buffer.isBuffer(value)) return sanitizeBlob(value);
  if (Array.isArray(value)) return value.map((entry) => sanitizeValue(entry, key, replacements));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitizeValue(childValue, childKey, replacements),
      ]),
    );
  }
  if (typeof value !== 'string') return value;
  const kind = classifySensitiveKey(key);
  if (kind && value) return aliasValue(kind, value);
  const parsed = parseJsonContainer(value);
  if (parsed !== null) {
    return JSON.stringify(sortObject(sanitizeValue(parsed, key, replacements)));
  }
  return sanitizeFreeText(value, replacements);
}

function encodeSqlValue(value) {
  if (Buffer.isBuffer(value)) return { $sqliteBlob: value.toString('base64') };
  if (typeof value === 'bigint') return { $sqliteInteger: value.toString() };
  return value;
}

function decodeSqlValue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  if (Object.keys(value).length === 1 && typeof value.$sqliteBlob === 'string') {
    return Buffer.from(value.$sqliteBlob, 'base64');
  }
  if (Object.keys(value).length === 1 && typeof value.$sqliteInteger === 'string') {
    return BigInt(value.$sqliteInteger);
  }
  return value;
}

function primaryKeyColumns(columns) {
  return columns
    .filter((column) => Number(column.pk) > 0)
    .sort((left, right) => Number(left.pk) - Number(right.pk))
    .map((column) => column.name);
}

function sqliteValueTypeRank(value) {
  if (value == null) return 0;
  if (typeof value === 'number' || typeof value === 'bigint') return 1;
  if (typeof value === 'string') return 2;
  if (Buffer.isBuffer(value)) return 3;
  return 4;
}

function compareSqliteValues(leftValue, rightValue) {
  const left = decodeSqlValue(leftValue);
  const right = decodeSqlValue(rightValue);
  const leftRank = sqliteValueTypeRank(left);
  const rightRank = sqliteValueTypeRank(right);
  if (leftRank !== rightRank) return leftRank - rightRank;
  if (left == null && right == null) return 0;
  if (leftRank === 1) {
    if (
      (typeof left === 'bigint' || typeof right === 'bigint')
      && Number.isInteger(Number(left))
      && Number.isInteger(Number(right))
    ) {
      const leftInteger = BigInt(left);
      const rightInteger = BigInt(right);
      return leftInteger < rightInteger ? -1 : leftInteger > rightInteger ? 1 : 0;
    }
    return Number(left) - Number(right);
  }
  if (leftRank === 2) return compareUtf8(left, right);
  if (leftRank === 3) return Buffer.compare(left, right);
  return compareUtf8(stableJsonBytes(left), stableJsonBytes(right));
}

function sortRows(rows, table) {
  const keys = table.primaryKey.length > 0
    ? table.primaryKey
    : table.columns.map((column) => column.name);
  return [...rows].sort((left, right) => {
    for (const key of keys) {
      const comparison = compareSqliteValues(left[key], right[key]);
      if (comparison !== 0) return comparison;
    }
    return compareUtf8(stableJsonBytes(left), stableJsonBytes(right));
  });
}

function captureDatabaseShape(db, options = {}) {
  const excludedTables = new Set(options.excludedTables || EXCLUDED_TABLES);
  db.pragma('query_only = ON');
  db.exec('BEGIN DEFERRED');
  try {
    const tableRecords = db.prepare(`
      SELECT name, sql
      FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL
      ORDER BY name
    `).all().filter((table) => !excludedTables.has(table.name));
    const tables = tableRecords.map((tableRecord) => {
      const columns = db.prepare(`PRAGMA table_info(${quoteIdentifier(tableRecord.name)})`).all()
        .map(({ cid, name, type, notnull, dflt_value: defaultValue, pk }) => ({
          cid,
          name,
          type,
          notnull,
          defaultValue,
          pk,
        }));
      const selectedColumns = columns.map((column) => quoteIdentifier(column.name)).join(', ');
      const rows = selectedColumns
        ? db.prepare(`SELECT ${selectedColumns} FROM ${quoteIdentifier(tableRecord.name)}`).all()
        : [];
      return {
        name: tableRecord.name,
        createSql: tableRecord.sql,
        columns,
        primaryKey: primaryKeyColumns(columns),
        rows,
      };
    });
    const schemaObjects = db.prepare(`
      SELECT type, name, tbl_name AS tableName, sql
      FROM sqlite_master
      WHERE type IN ('index', 'trigger', 'view') AND sql IS NOT NULL
      ORDER BY type, name
    `).all().filter((object) => !excludedTables.has(object.tableName));
    db.exec('COMMIT');
    return { tables, schemaObjects };
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch (_) {
      // The original database error is authoritative when rollback also fails.
    }
    throw error;
  }
}

function sanitizeDatabaseShape(rawShape) {
  const sensitiveValues = new Map();
  rawShape.tables.forEach((table) => {
    table.rows.forEach((row) => {
      Object.entries(row).forEach(([key, value]) => {
        collectSensitiveValues(value, key, sensitiveValues);
      });
    });
  });
  const replacements = buildReplacementEntries(sensitiveValues);
  const tables = rawShape.tables.map((table) => {
    const sanitizedRows = table.rows.map((row) => Object.fromEntries(
      table.columns.map((column) => [
        column.name,
        encodeSqlValue(sanitizeValue(row[column.name], column.name, replacements)),
      ]),
    ));
    const result = {
      name: table.name,
      createSql: table.createSql,
      columns: table.columns,
      primaryKey: table.primaryKey,
      excludedChecksumColumns: table.columns
        .map((column) => column.name)
        .filter((name) => VOLATILE_TIME_FIELD_SET.has(name.toLowerCase()))
        .sort(compareUtf8),
      rows: [],
    };
    result.rows = sortRows(sanitizedRows, result);
    return result;
  }).sort((left, right) => compareUtf8(left.name, right.name));
  return {
    sensitiveValues,
    fixture: {
      schema: FIXTURE_SCHEMA,
      checksumRuleVersion: CHECKSUM_RULE_VERSION,
      sourceShape: {
        tableCount: tables.length,
        rowCount: tables.reduce((total, table) => total + table.rows.length, 0),
        excludedTables: [...EXCLUDED_TABLES].sort(compareUtf8),
      },
      schemaObjects: [...rawShape.schemaObjects].sort((left, right) => (
        compareUtf8(`${left.type}\0${left.name}`, `${right.type}\0${right.name}`)
      )),
      tables,
      sanitization: {
        schema: SANITIZATION_SCHEMA,
        strategy: 'deterministic-domain-separated-aliases',
        sourceSensitiveValueCount: sensitiveValues.size,
      },
    },
  };
}

function isVolatileTimeField(key) {
  return VOLATILE_TIME_FIELD_SET.has(String(key).toLowerCase());
}

function normalizeNestedChecksumValue(value) {
  if (Array.isArray(value)) return value.map(normalizeNestedChecksumValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .filter((key) => !isVolatileTimeField(key))
    .sort(compareUtf8)
    .reduce((result, key) => {
      result[key] = normalizeNestedChecksumValue(value[key]);
      return result;
    }, {});
}

function normalizeChecksumCell(value) {
  if (typeof value !== 'string') return value;
  const parsed = parseJsonContainer(value);
  if (parsed === null) return value;
  return { $canonicalJson: normalizeNestedChecksumValue(parsed) };
}

function buildChecksumDocument(fixture) {
  if (!fixture || fixture.schema !== FIXTURE_SCHEMA) {
    throw new Error(`Unsupported production-shape fixture schema: ${fixture?.schema || 'missing'}`);
  }
  const tables = [...fixture.tables]
    .sort((left, right) => compareUtf8(left.name, right.name))
    .map((table) => {
      const participatingColumns = table.columns
        .map((column) => column.name)
        .filter((name) => !isVolatileTimeField(name));
      const rows = sortRows(table.rows, table).map((row) => (
        participatingColumns.map((column) => normalizeChecksumCell(row[column]))
      ));
      return {
        name: table.name,
        createSql: table.createSql,
        columns: table.columns,
        primaryKey: table.primaryKey,
        participatingColumns,
        excludedColumns: table.columns
          .map((column) => column.name)
          .filter(isVolatileTimeField)
          .sort(compareUtf8),
        rowCount: table.rows.length,
        rows,
      };
    });
  return {
    schema: CHECKSUM_SCHEMA,
    ruleVersion: CHECKSUM_RULE_VERSION,
    ordering: 'table-name-utf8-byte-order, then declared-primary-key',
    volatileTimeFields: [...VOLATILE_TIME_FIELDS].sort(compareUtf8),
    schemaObjects: [...fixture.schemaObjects].sort((left, right) => (
      compareUtf8(`${left.type}\0${left.name}`, `${right.type}\0${right.name}`)
    )),
    tables,
  };
}

function checksumFixture(fixture) {
  const document = buildChecksumDocument(fixture);
  return {
    schema: CHECKSUM_SCHEMA,
    ruleVersion: CHECKSUM_RULE_VERSION,
    checksum: sha256Hex(stableJsonBytes(document)),
    tableCount: document.tables.length,
    rowCount: document.tables.reduce((total, table) => total + table.rowCount, 0),
  };
}

function fixtureFromRawShape(rawShape) {
  const tables = rawShape.tables.map((table) => {
    const result = {
      name: table.name,
      createSql: table.createSql,
      columns: table.columns,
      primaryKey: table.primaryKey,
      excludedChecksumColumns: table.columns
        .map((column) => column.name)
        .filter(isVolatileTimeField)
        .sort(compareUtf8),
      rows: table.rows.map((row) => Object.fromEntries(
        table.columns.map((column) => [column.name, encodeSqlValue(row[column.name])]),
      )),
    };
    result.rows = sortRows(result.rows, result);
    return result;
  }).sort((left, right) => compareUtf8(left.name, right.name));
  return {
    schema: FIXTURE_SCHEMA,
    checksumRuleVersion: CHECKSUM_RULE_VERSION,
    sourceShape: {
      tableCount: tables.length,
      rowCount: tables.reduce((total, table) => total + table.rows.length, 0),
      excludedTables: [...EXCLUDED_TABLES].sort(compareUtf8),
    },
    schemaObjects: rawShape.schemaObjects,
    tables,
    sanitization: null,
  };
}

function checksumDatabase(dbPath, options = {}) {
  const Database = loadDatabaseConstructor(options);
  const db = new Database(path.resolve(dbPath), { readonly: true, fileMustExist: true });
  try {
    return checksumFixture(fixtureFromRawShape(captureDatabaseShape(db, options)));
  } finally {
    db.close();
  }
}

function collectFixtureScalarStrings(value, output = []) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectFixtureScalarStrings(entry, output));
    return output;
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string') {
      output.push(value);
      const parsed = parseJsonContainer(value);
      if (parsed !== null) collectFixtureScalarStrings(parsed, output);
    }
    return output;
  }
  Object.values(value).forEach((entry) => collectFixtureScalarStrings(entry, output));
  return output;
}

function assertSanitizedFixture(fixture, sensitiveValues = new Map()) {
  const rowPayload = fixture.tables.map((table) => table.rows);
  const serializedRows = JSON.stringify(rowPayload);
  const scalarValues = new Set(collectFixtureScalarStrings(rowPayload));
  const leakedValues = [...sensitiveValues.keys()].filter((raw) => (
    raw.length >= 4 && (scalarValues.has(raw) || (raw.length >= 8 && serializedRows.includes(raw)))
  ));
  const patternLeaks = {
    email: (serializedRows.match(new RegExp(EMAIL_PATTERN.source, EMAIL_PATTERN.flags)) || []).length,
    jwt: (serializedRows.match(new RegExp(JWT_PATTERN.source, JWT_PATTERN.flags)) || []).length,
    bearer: (serializedRows.match(new RegExp(BEARER_PATTERN.source, BEARER_PATTERN.flags)) || []).length,
    querySecret: (
      serializedRows.match(new RegExp(QUERY_SECRET_PATTERN.source, QUERY_SECRET_PATTERN.flags)) || []
    ).length,
  };
  if (leakedValues.length > 0 || Object.values(patternLeaks).some((count) => count > 0)) {
    throw new Error(
      `Sanitization assertion failed: rawLeaks=${leakedValues.length} patternLeaks=${JSON.stringify(patternLeaks)}`,
    );
  }
  return {
    rawSensitiveValueLeaks: 0,
    emailPatternLeaks: 0,
    jwtPatternLeaks: 0,
    bearerPatternLeaks: 0,
    querySecretPatternLeaks: 0,
  };
}

function exportProductionShape(options = {}) {
  const sourceDbPath = path.resolve(options.sourceDbPath || DEFAULT_SOURCE_DB);
  const Database = loadDatabaseConstructor(options);
  const db = new Database(sourceDbPath, { readonly: true, fileMustExist: true });
  let rawShape;
  try {
    rawShape = captureDatabaseShape(db, options);
  } finally {
    db.close();
  }
  const { fixture, sensitiveValues } = sanitizeDatabaseShape(rawShape);
  const sanitizationAssertions = assertSanitizedFixture(fixture, sensitiveValues);
  fixture.sanitization.assertions = sanitizationAssertions;
  const checksum = checksumFixture(fixture);
  const outputPath = path.resolve(options.outputPath || DEFAULT_FIXTURE_PATH);
  writeStableJson(outputPath, fixture);
  const metadata = {
    schema: FIXTURE_METADATA_SCHEMA,
    fixtureSchema: FIXTURE_SCHEMA,
    source: {
      label: options.sourceLabel || 'wsl:wxgame-test',
      access: 'sqlite-readonly-snapshot',
    },
    artifact: {
      path: path.relative(PROJECT_ROOT, outputPath).replace(/\\/g, '/'),
      byteLength: fs.statSync(outputPath).size,
    },
    checksum,
    checksumRule: {
      version: CHECKSUM_RULE_VERSION,
      tableOrdering: 'UTF-8 byte order',
      rowOrdering: 'declared primary key; all columns when no primary key exists',
      excludedVolatileTimeFields: [...VOLATILE_TIME_FIELDS].sort(compareUtf8),
    },
    sanitization: fixture.sanitization,
    excludedInstrumentationTables: [...EXCLUDED_TABLES].sort(compareUtf8),
    tables: fixture.tables.map((table) => ({
      name: table.name,
      rowCount: table.rows.length,
      primaryKey: table.primaryKey,
      excludedChecksumColumns: table.excludedChecksumColumns,
    })),
  };
  const metadataPath = path.resolve(options.metadataPath || DEFAULT_METADATA_PATH);
  writeStableJson(metadataPath, metadata);
  return { fixture, metadata, outputPath, metadataPath, checksum };
}

function materializeFixture(fixture, outputDbPath, options = {}) {
  if (!fixture || fixture.schema !== FIXTURE_SCHEMA) {
    throw new Error(`Unsupported production-shape fixture schema: ${fixture?.schema || 'missing'}`);
  }
  const Database = loadDatabaseConstructor(options);
  const resolved = path.resolve(outputDbPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    fs.rmSync(`${resolved}${suffix}`, { force: true });
  }
  const db = new Database(resolved);
  try {
    db.pragma('journal_mode = DELETE');
    db.pragma('foreign_keys = OFF');
    for (const table of fixture.tables) db.exec(table.createSql);
    const insertAll = db.transaction(() => {
      for (const table of fixture.tables) {
        if (table.columns.length === 0 || table.rows.length === 0) continue;
        const names = table.columns.map((column) => column.name);
        const insert = db.prepare(
          `INSERT INTO ${quoteIdentifier(table.name)} (${names.map(quoteIdentifier).join(', ')}) `
          + `VALUES (${names.map(() => '?').join(', ')})`,
        );
        for (const row of table.rows) insert.run(names.map((name) => decodeSqlValue(row[name])));
      }
    });
    insertAll();
    const objectOrder = { index: 0, trigger: 1, view: 2 };
    [...fixture.schemaObjects]
      .sort((left, right) => (
        (objectOrder[left.type] ?? 99) - (objectOrder[right.type] ?? 99)
        || compareUtf8(left.name, right.name)
      ))
      .forEach((object) => db.exec(object.sql));
    const integrity = db.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') throw new Error(`Materialized fixture failed integrity_check: ${integrity}`);
  } finally {
    db.close();
  }
  return {
    outputDbPath: resolved,
    tableCount: fixture.tables.length,
    rowCount: fixture.tables.reduce((total, table) => total + table.rows.length, 0),
  };
}

function readFixture(fixturePath) {
  const fixture = JSON.parse(fs.readFileSync(path.resolve(fixturePath), 'utf8'));
  if (fixture.schema !== FIXTURE_SCHEMA) {
    throw new Error(`Unsupported production-shape fixture schema: ${fixture.schema || 'missing'}`);
  }
  return fixture;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) throw new Error(`Unexpected argument: ${argument}`);
    const equalsIndex = argument.indexOf('=');
    if (equalsIndex > 2) {
      args[argument.slice(2, equalsIndex)] = argument.slice(equalsIndex + 1);
      continue;
    }
    const key = argument.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    args[key] = value;
    index += 1;
  }
  return args;
}

function runCli(argv = process.argv.slice(2)) {
  const command = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'export';
  const args = parseArgs(command === 'export' && argv[0]?.startsWith('--') ? argv : argv.slice(1));
  const backendDir = args['backend-dir'];
  if (command === 'export') {
    const outputPath = assertCliArtifactPath(args.output || DEFAULT_FIXTURE_PATH, 'fixture output');
    const metadataPath = assertCliArtifactPath(
      args['metadata-output'] || DEFAULT_METADATA_PATH,
      'fixture metadata output',
    );
    const result = exportProductionShape({
      sourceDbPath: args['source-db'] || DEFAULT_SOURCE_DB,
      sourceLabel: args['source-label'],
      outputPath,
      metadataPath,
      backendDir,
    });
    return {
      schema: FIXTURE_METADATA_SCHEMA,
      fixturePath: result.outputPath,
      metadataPath: result.metadataPath,
      ...result.checksum,
      sanitization: result.fixture.sanitization.assertions,
    };
  }
  if (command === 'checksum-fixture') {
    const fixturePath = assertCliArtifactPath(args.fixture || DEFAULT_FIXTURE_PATH, 'fixture input');
    return checksumFixture(readFixture(fixturePath));
  }
  if (command === 'assert-fixture') {
    const fixturePath = assertCliArtifactPath(args.fixture || DEFAULT_FIXTURE_PATH, 'fixture input');
    return { schema: SANITIZATION_SCHEMA, ...assertSanitizedFixture(readFixture(fixturePath)) };
  }
  if (command === 'checksum-db') {
    if (!args.db) throw new Error('checksum-db requires --db');
    return checksumDatabase(args.db, { backendDir });
  }
  if (command === 'materialize') {
    const fixturePath = assertCliArtifactPath(args.fixture || DEFAULT_FIXTURE_PATH, 'fixture input');
    const outputDbPath = assertCliArtifactPath(
      args['output-db'] || path.join(PROJECT_ROOT, 'tmp', 'm0-fixture', 'materialized', 'civilization.db'),
      'materialized database output',
    );
    return materializeFixture(readFixture(fixturePath), outputDbPath, { backendDir });
  }
  throw new Error(`Unknown command: ${command}`);
}

if (require.main === module) {
  try {
    console.log(JSON.stringify(runCli()));
  } catch (error) {
    console.error(`[m0-fixture] FAILED ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  CHECKSUM_RULE_VERSION,
  CHECKSUM_SCHEMA,
  DEFAULT_FIXTURE_PATH,
  DEFAULT_METADATA_PATH,
  EXCLUDED_TABLES,
  FIXTURE_METADATA_SCHEMA,
  FIXTURE_SCHEMA,
  PROJECT_ROOT,
  SANITIZATION_SCHEMA,
  VOLATILE_TIME_FIELDS,
  assertSanitizedFixture,
  buildChecksumDocument,
  captureDatabaseShape,
  checksumDatabase,
  checksumFixture,
  classifySensitiveKey,
  exportProductionShape,
  fixtureFromRawShape,
  loadDatabaseConstructor,
  materializeFixture,
  parseArgs,
  readFixture,
  runCli,
  sanitizeDatabaseShape,
  stableJsonBytes,
};
