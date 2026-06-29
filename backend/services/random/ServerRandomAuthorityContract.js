const crypto = require('node:crypto');

const SCHEMA = 'server-random-authority-v1';
const AUTHORITY = 'server';
const DEFAULT_SCOPE = 'gameplay';
const DEFAULT_ACTION = 'roll';
const RANDOM_SCALE = 1_000_000;
const MAX_UNIT_ROLL = 0.999999;

function sanitizeText(value, fallback = '') {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (value === undefined || value === null) return fallback;
  return String(value).trim() || fallback;
}

function normalizeUnitRoll(value, fallback = 0) {
  const number = Number(value);
  const fallbackNumber = Number(fallback);
  const normalized = Number.isFinite(number)
    ? number
    : (Number.isFinite(fallbackNumber) ? fallbackNumber : 0);
  return Math.max(0, Math.min(MAX_UNIT_ROLL, normalized));
}

function readEntropy(randomSource) {
  if (typeof randomSource === 'function') return randomSource();
  if (randomSource && typeof randomSource.next === 'function') return randomSource.next();
  return crypto.randomInt(0, RANDOM_SCALE) / RANDOM_SCALE;
}

function getServerTimeIso(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  return Number.isNaN(now.getTime()) ? new Date(0).toISOString() : now.toISOString();
}

function createScope(input = {}, options = {}) {
  return Object.freeze({
    schema: SCHEMA,
    authority: AUTHORITY,
    scope: sanitizeText(input.scope ?? options.scope, DEFAULT_SCOPE),
    action: sanitizeText(input.action ?? options.action, DEFAULT_ACTION),
    subjectId: sanitizeText(input.subjectId ?? options.subjectId),
    seed: sanitizeText(input.seed ?? options.seed),
    sequence: Math.max(0, Math.floor(Number(input.sequence ?? options.sequence) || 0)),
    serverTime: getServerTimeIso(input.now ? { now: input.now } : options),
  });
}

function createRollId(roll) {
  return crypto
    .createHash('sha1')
    .update([
      roll.schema,
      roll.scope,
      roll.action,
      roll.subjectId,
      roll.seed,
      roll.sequence,
      roll.serverTime,
      roll.value,
    ].join('|'))
    .digest('hex')
    .slice(0, 16);
}

function createRoll(input = {}, options = {}) {
  const scope = createScope(input, options);
  const roll = {
    ...scope,
    value: normalizeUnitRoll(readEntropy(options.randomSource), options.fallback),
  };
  return {
    ...roll,
    rollId: createRollId(roll),
  };
}

function createRandomSource(input = {}, options = {}) {
  let sequence = Math.max(0, Math.floor(Number(input.sequence ?? options.sequence) || 0));
  const source = () => {
    const roll = createRoll({ ...input, sequence }, options);
    sequence += 1;
    return roll.value;
  };
  Object.defineProperty(source, 'authorityScope', {
    value: createScope(input, options),
    enumerable: false,
  });
  return source;
}

function rollChance(chance, input = {}, options = {}) {
  const threshold = Math.max(0, Math.min(1, Number(chance) || 0));
  const roll = createRoll(input, options);
  return {
    success: roll.value < threshold,
    threshold,
    roll,
  };
}

module.exports = {
  AUTHORITY,
  DEFAULT_ACTION,
  DEFAULT_SCOPE,
  MAX_UNIT_ROLL,
  RANDOM_SCALE,
  SCHEMA,
  createRandomSource,
  createRoll,
  createRollId,
  createScope,
  normalizeUnitRoll,
  rollChance,
};
