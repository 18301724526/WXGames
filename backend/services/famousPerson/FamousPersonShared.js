const { hashText } = require('../../../shared/signatureHash');
const { toInteger } = require('../../../shared/numberUtils');
const { clone } = require('../../../shared/objectUtils');

function rollUnit(randomSource = null) {
  const value = Number(typeof randomSource === 'function' ? randomSource() : 0);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(0.999999, value));
}

function pick(list, randomSource = null) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[Math.floor(rollUnit(randomSource) * list.length)];
}

function createSeedRandom(seed) {
  let state = hashText(seed) || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

function sanitizeText(value, fallback = '') {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

function roundToNearestTen(value) {
  return Math.max(10, Math.round((Number(value) || 0) / 10) * 10);
}

module.exports = {
  clone,
  createSeedRandom,
  hashText,
  pick,
  rollUnit,
  roundToNearestTen,
  sanitizeText,
  toInteger,
};
