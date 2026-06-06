function round2(value) {
  return Math.round(value * 100) / 100;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function rollUnit(randomSource = Math.random) {
  const value = Number(randomSource());
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(0.999999, value));
}

function pick(list, randomSource = Math.random) {
  if (!Array.isArray(list) || !list.length) return null;
  return list[Math.floor(rollUnit(randomSource) * list.length)];
}

function sanitizeText(value, fallback = '') {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
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

module.exports = {
  clone,
  createSeedRandom,
  hashText,
  pick,
  rollUnit,
  round2,
  sanitizeText,
};
