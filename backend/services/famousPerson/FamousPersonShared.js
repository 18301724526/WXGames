function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function rollUnit(randomSource = null) {
  const value = Number(typeof randomSource === 'function' ? randomSource() : 0);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(0.999999, value));
}

function pick(list, randomSource = null) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[Math.floor(rollUnit(randomSource) * list.length)];
}

function hashText(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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

function toInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
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
