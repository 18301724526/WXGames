const {
  DEFAULT_WORLD_SEED,
} = require('./WorldMapConstants');
const { hashString } = require('../../../shared/signatureHash');

const SCHEMA = 'world-map-generation-authority-v1';
const AUTHORITY = 'server';
const SCOPE = 'worldMap';
const DEFAULT_ACTION = 'materialize';
const DETERMINISTIC_MODE = 'seeded-hash';
const HASH_SCALE = 4294967295;

function sanitizeText(value, fallback = '') {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (value === undefined || value === null) return fallback;
  return String(value).trim() || fallback;
}

function normalizeStableKey(value, fallback = 0) {
  if (Number.isFinite(Number(value))) return Math.floor(Number(value));
  return sanitizeText(value, fallback);
}

function normalizeSeed(seed, fallback = DEFAULT_WORLD_SEED) {
  return sanitizeText(seed, fallback);
}

function normalizeRollInput(input = {}) {
  return {
    seed: normalizeSeed(input.seed),
    q: normalizeStableKey(input.q, 0),
    r: normalizeStableKey(input.r, 0),
    salt: sanitizeText(input.salt, DEFAULT_ACTION),
    action: sanitizeText(input.action, DEFAULT_ACTION),
    subjectId: sanitizeText(input.subjectId),
  };
}

function createGenerationScope(input = {}) {
  const normalized = normalizeRollInput(input);
  return Object.freeze({
    schema: SCHEMA,
    authority: AUTHORITY,
    scope: SCOPE,
    mode: DETERMINISTIC_MODE,
    action: normalized.action,
    subjectId: normalized.subjectId,
    seed: normalized.seed,
    q: normalized.q,
    r: normalized.r,
    salt: normalized.salt,
  });
}

function createRollId(roll) {
  return hashString([
    roll.schema,
    roll.authority,
    roll.scope,
    roll.mode,
    roll.action,
    roll.subjectId,
    roll.seed,
    roll.q,
    roll.r,
    roll.salt,
    roll.value,
  ].join('|')).toString(16).padStart(8, '0');
}

function createDeterministicRoll(input = {}) {
  const scope = createGenerationScope(input);
  const value = hashString(`${scope.seed}|${scope.q}|${scope.r}|${scope.salt}`) / HASH_SCALE;
  const roll = {
    ...scope,
    value,
  };
  return {
    ...roll,
    rollId: createRollId(roll),
  };
}

function roll01(seed, q, r, salt, options = {}) {
  return createDeterministicRoll({
    seed,
    q,
    r,
    salt,
    action: options.action,
    subjectId: options.subjectId,
  }).value;
}

function createWorldMapGenerationMetadata(seed = DEFAULT_WORLD_SEED, options = {}) {
  const scope = createGenerationScope({
    seed,
    action: sanitizeText(options.action, 'worldMaterialization'),
    subjectId: sanitizeText(options.subjectId, 'world-map'),
    salt: sanitizeText(options.salt, 'world-map'),
  });
  return {
    schema: scope.schema,
    authority: scope.authority,
    scope: scope.scope,
    mode: scope.mode,
    action: scope.action,
    subjectId: scope.subjectId,
    seed: scope.seed,
  };
}

module.exports = {
  AUTHORITY,
  DEFAULT_ACTION,
  DETERMINISTIC_MODE,
  SCOPE,
  HASH_SCALE,
  SCHEMA,
  createDeterministicRoll,
  createGenerationScope,
  createRollId,
  createWorldMapGenerationMetadata,
  hashString,
  normalizeSeed,
  roll01,
};
