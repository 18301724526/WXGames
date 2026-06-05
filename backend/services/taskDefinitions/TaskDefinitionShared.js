const CATEGORY_IDS = Object.freeze(['daily', 'main', 'season', 'challenge']);
const RESOURCE_KEYS = Object.freeze(['food', 'wood', 'knowledge', 'iron', 'stone', 'metal', 'soldiers']);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso(now = new Date()) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

function sanitizeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toBoolean(value, fallback = true) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on', 'enabled', 'enable', '启用', '是'].includes(text)) return true;
  if (['0', 'false', 'no', 'n', 'off', 'disabled', 'disable', '停用', '否'].includes(text)) return false;
  return fallback;
}

function addResources(target, source = {}) {
  for (const [key, value] of Object.entries(source || {})) {
    const amount = toNumber(value, 0);
    if (amount > 0) target[key] = Math.round(((target[key] || 0) + amount) * 1000) / 1000;
  }
  return target;
}

function parseJsonMaybe(value, fallback = null) {
  if (value && typeof value === 'object') return clone(value);
  const text = sanitizeText(value);
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch (error) {
    return { __parseError: error.message, __raw: text };
  }
}

function parseFormulaList(value) {
  if (Array.isArray(value)) return value.map((item) => sanitizeText(item)).filter(Boolean);
  return sanitizeText(value)
    .split(/[,+;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeCategory(category) {
  const value = sanitizeText(category, 'main');
  return CATEGORY_IDS.includes(value) ? value : 'main';
}

module.exports = {
  CATEGORY_IDS,
  RESOURCE_KEYS,
  addResources,
  clone,
  normalizeCategory,
  nowIso,
  parseFormulaList,
  parseJsonMaybe,
  sanitizeText,
  toBoolean,
  toNumber,
};
