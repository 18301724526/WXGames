const SkillGeneratorRandomAuthority = require('./SkillGeneratorRandomAuthority');
const { hashText } = require('../../../shared/signatureHash');

function round2(value) {
  return Math.round(value * 100) / 100;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function resolveRandomSource(randomSource = null, options = {}) {
  return typeof randomSource === 'function'
    ? randomSource
    : SkillGeneratorRandomAuthority.createFallbackRandomSource(options);
}

function rollUnit(randomSource = null, options = {}) {
  const source = resolveRandomSource(randomSource, options);
  const value = Number(source());
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(0.999999, value));
}

function pick(list, randomSource = null, options = {}) {
  if (!Array.isArray(list) || !list.length) return null;
  return list[Math.floor(rollUnit(randomSource, options) * list.length)];
}

function sanitizeText(value, fallback = '') {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

function createSeedRandom(seed) {
  let state = hashText(seed) || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

module.exports = {
  clone,
  createSeedRandom,
  hashText,
  pick,
  resolveRandomSource,
  rollUnit,
  round2,
  sanitizeText,
};
