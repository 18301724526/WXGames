const crypto = require('node:crypto');

const { isPlainObject } = require('../../../shared/objectUtils');

const DEFAULT_VERSION = '0.1.0';
const DEFAULT_SCHEMA_VERSION = 1;
const DEFAULT_HASH_LENGTH = 12;

function sanitizeText(value, fallback = '') {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (value === undefined || value === null) return fallback;
  return String(value).trim() || fallback;
}

function isValidVersion(value) {
  const text = sanitizeText(value);
  return /^v?\d+(?:\.\d+){0,2}$/i.test(text);
}

function normalizeVersion(value, fallback = DEFAULT_VERSION) {
  const text = sanitizeText(value);
  const fallbackText = isValidVersion(fallback) ? sanitizeText(fallback) : DEFAULT_VERSION;
  const source = isValidVersion(text) ? text : fallbackText;
  const match = source.replace(/^v/i, '').match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  if (!match) return DEFAULT_VERSION;
  return match
    .slice(1)
    .filter((part) => part !== undefined)
    .map((part) => String(Number(part)))
    .join('.');
}

function getVersionParts(value) {
  const normalized = normalizeVersion(value, '0.0.0');
  const parts = normalized.split('.').map((part) => Number(part));
  while (parts.length < 3) parts.push(0);
  return parts.slice(0, 3);
}

function compareVersions(beforeVersion, afterVersion) {
  const before = getVersionParts(beforeVersion);
  const after = getVersionParts(afterVersion);
  for (let index = 0; index < 3; index += 1) {
    if (after[index] > before[index]) return 1;
    if (after[index] < before[index]) return -1;
  }
  return 0;
}

function normalizeSchemaVersion(value, fallback = DEFAULT_SCHEMA_VERSION) {
  const number = Number(value);
  if (Number.isInteger(number) && number >= 1) return number;
  return fallback;
}

function sortForStableJson(value) {
  if (Array.isArray(value)) return value.map((item) => sortForStableJson(item));
  if (!isPlainObject(value)) return value;
  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      if (value[key] !== undefined) result[key] = sortForStableJson(value[key]);
      return result;
    }, {});
}

function stableStringify(value) {
  return JSON.stringify(sortForStableJson(value));
}

function createStableContentHash(value, options = {}) {
  const length = Math.max(8, Math.min(40, Number(options.length) || DEFAULT_HASH_LENGTH));
  return crypto
    .createHash('sha1')
    .update(stableStringify(value))
    .digest('hex')
    .slice(0, length);
}

function getEntryId(entry, sourceKey, options = {}) {
  const entryIdKey = sanitizeText(options.entryIdKey, 'id');
  if (isPlainObject(entry)) return sanitizeText(entry[entryIdKey], sanitizeText(sourceKey));
  return sanitizeText(sourceKey);
}

function getRegistryEntries(input = {}, options = {}) {
  const source = input.entries ?? options.entries ?? [];
  if (Array.isArray(source)) {
    return source.map((entry, index) => ({
      id: getEntryId(entry, null, options),
      sourceKey: null,
      index,
      value: entry,
    }));
  }
  if (isPlainObject(source)) {
    return Object.entries(source).map(([sourceKey, entry], index) => ({
      id: getEntryId(entry, sourceKey, options),
      sourceKey,
      index,
      value: entry,
    }));
  }
  return [];
}

function createRegistryMetadata(input = {}, options = {}) {
  const entries = getRegistryEntries(input, options);
  const id = sanitizeText(input.id ?? input.registryId ?? options.id ?? options.registryId, 'registry');
  const schema = sanitizeText(input.schema ?? options.schema, id);
  const schemaVersion = normalizeSchemaVersion(input.schemaVersion ?? options.schemaVersion);
  const version = normalizeVersion(input.version ?? options.version, options.fallbackVersion || DEFAULT_VERSION);
  const content = input.content ?? options.content ?? entries
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id) || a.index - b.index)
    .map((entry) => entry.value);
  const entryIds = entries
    .map((entry) => entry.id)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  return {
    id,
    schema,
    schemaVersion,
    version,
    contentHash: createStableContentHash(content, options),
    entryCount: entries.length,
    entryIds,
    source: sanitizeText(input.source ?? options.source),
  };
}

function validateRegistry(input = {}, options = {}) {
  const entries = getRegistryEntries(input, options);
  const metadata = createRegistryMetadata(input, options);
  const errors = [];
  const warnings = [];
  const rawId = input.id ?? input.registryId ?? options.id ?? options.registryId;
  const rawSchema = input.schema ?? options.schema;
  const rawSchemaVersion = input.schemaVersion ?? options.schemaVersion;
  const rawVersion = input.version ?? options.version;

  if (!sanitizeText(rawId)) errors.push('registry id is required');
  if (!sanitizeText(rawSchema)) errors.push('registry schema is required');
  if (rawSchemaVersion !== undefined && normalizeSchemaVersion(rawSchemaVersion, 0) <= 0) {
    errors.push('schemaVersion must be an integer greater than 0');
  }
  if (options.requireVersion && !sanitizeText(rawVersion)) {
    errors.push('registry version is required');
  } else if (sanitizeText(rawVersion) && !isValidVersion(rawVersion)) {
    errors.push(`registry version is invalid: ${sanitizeText(rawVersion)}`);
  }

  const seen = new Map();
  entries.forEach((entry) => {
    const label = entry.sourceKey || `entry-${entry.index + 1}`;
    if (!entry.id) {
      errors.push(`${label}: entry id is required`);
      return;
    }
    if (seen.has(entry.id)) {
      errors.push(`${label}: duplicate entry id ${entry.id}`);
    }
    seen.set(entry.id, entry);
    if (options.requireObjectKeyMatch && entry.sourceKey && entry.id !== entry.sourceKey) {
      errors.push(`${label}: entry id must match object key`);
    }
  });

  if (entries.length === 0 && options.requireEntries) {
    errors.push('registry entries are required');
  }
  if (!errors.length && entries.length === 0) {
    warnings.push('registry has no entries');
  }

  return {
    success: errors.length === 0,
    metadata,
    errors,
    warnings,
  };
}

function normalizeComparisonMetadata(value = {}, options = {}) {
  if (value.metadata) return normalizeComparisonMetadata(value.metadata, options);
  if (value.contentHash && value.version) {
    return {
      id: sanitizeText(value.id ?? options.id, 'registry'),
      schema: sanitizeText(value.schema ?? options.schema, 'registry'),
      schemaVersion: normalizeSchemaVersion(value.schemaVersion ?? options.schemaVersion),
      version: normalizeVersion(value.version),
      contentHash: sanitizeText(value.contentHash),
      entryCount: Number(value.entryCount) || 0,
      entryIds: Array.isArray(value.entryIds) ? [...value.entryIds].sort((a, b) => a.localeCompare(b)) : [],
    };
  }
  return createRegistryMetadata(value, options);
}

function compareRegistryVersions(before = {}, after = {}, options = {}) {
  const beforeMetadata = normalizeComparisonMetadata(before, options);
  const afterMetadata = normalizeComparisonMetadata(after, options);
  const versionComparison = compareVersions(beforeMetadata.version, afterMetadata.version);
  const beforeIds = new Set(beforeMetadata.entryIds || []);
  const afterIds = new Set(afterMetadata.entryIds || []);
  const addedEntryIds = [...afterIds].filter((id) => !beforeIds.has(id)).sort((a, b) => a.localeCompare(b));
  const removedEntryIds = [...beforeIds].filter((id) => !afterIds.has(id)).sort((a, b) => a.localeCompare(b));

  return {
    before: beforeMetadata,
    after: afterMetadata,
    versionChanged: beforeMetadata.version !== afterMetadata.version,
    contentChanged: beforeMetadata.contentHash !== afterMetadata.contentHash,
    schemaChanged: beforeMetadata.schema !== afterMetadata.schema
      || beforeMetadata.schemaVersion !== afterMetadata.schemaVersion,
    direction: versionComparison > 0 ? 'upgrade' : (versionComparison < 0 ? 'downgrade' : 'equal'),
    addedEntryIds,
    removedEntryIds,
  };
}

function toSemverString(parts) {
  return parts.map((part) => String(Math.max(0, Math.floor(Number(part) || 0)))).join('.');
}

function bumpVersion(value, level) {
  const parts = getVersionParts(value);
  if (level === 'major') return toSemverString([parts[0] + 1, 0, 0]);
  if (level === 'minor') return toSemverString([parts[0], parts[1] + 1, 0]);
  if (level === 'patch') return toSemverString([parts[0], parts[1], parts[2] + 1]);
  return toSemverString(parts);
}

function recommendVersionBump(before = {}, after = {}, options = {}) {
  const comparison = compareRegistryVersions(before, after, options);
  let level = 'none';
  let reason = 'content unchanged';
  if (comparison.schemaChanged || comparison.removedEntryIds.length > 0 || options.breakingChange) {
    level = 'major';
    reason = comparison.schemaChanged ? 'schema changed' : 'registry removed entries';
  } else if (comparison.contentChanged || comparison.addedEntryIds.length > 0) {
    level = 'minor';
    reason = comparison.addedEntryIds.length > 0 ? 'registry added entries' : 'registry content changed';
  }
  const recommendedVersion = level === 'none'
    ? comparison.after.version
    : bumpVersion(comparison.before.version, level);
  return {
    level,
    reason,
    recommendedVersion,
    versionSatisfies: level === 'none'
      ? true
      : compareVersions(recommendedVersion, comparison.after.version) >= 0,
    comparison,
  };
}

module.exports = {
  compareRegistryVersions,
  createRegistryMetadata,
  createStableContentHash,
  normalizeVersion,
  recommendVersionBump,
  stableStringify,
  validateRegistry,
};
