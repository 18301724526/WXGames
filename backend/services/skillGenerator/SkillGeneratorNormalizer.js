const {
  ARCHETYPE_CATEGORIES,
  CIVIL_EFFECTS,
  EFFECT_LABELS,
  FIRST_BATCH_BATTLE_EFFECTS,
  GENERATOR_VERSION,
  QUALITY_BUDGETS,
  QUALITY_LABELS,
  SCOUT_EFFECTS,
} = require('./SkillGeneratorConstants');
const {
  rollUnit,
  round2,
  sanitizeText,
} = require('./SkillGeneratorShared');

function normalizeQuality(value) {
  return Object.prototype.hasOwnProperty.call(QUALITY_BUDGETS, value) ? value : 'common';
}

function getQualityLabel(value) {
  return QUALITY_LABELS[normalizeQuality(value)];
}

function rollQuality(randomSource = null) {
  const roll = rollUnit(randomSource);
  if (roll < 0.324) return 'common';
  if (roll < 0.584) return 'good';
  if (roll < 0.944) return 'great';
  return 'legendary';
}

function normalizeAbilityArchetype(value, fallback = 'vanguard') {
  return Object.prototype.hasOwnProperty.call(ARCHETYPE_CATEGORIES, value) ? value : fallback;
}

function getAbilityMeta(abilityArchetype) {
  return ARCHETYPE_CATEGORIES[normalizeAbilityArchetype(abilityArchetype)] || ARCHETYPE_CATEGORIES.vanguard;
}

function getDefaultEffectPool(category) {
  if (category === 'civil') return [...CIVIL_EFFECTS];
  if (category === 'hybrid') return [...SCOUT_EFFECTS];
  return [...FIRST_BATCH_BATTLE_EFFECTS];
}

function normalizeEffectPool(pool, category) {
  const allowed = new Set(getDefaultEffectPool(category));
  const requested = Array.isArray(pool)
    ? pool.map(String).filter((key) => allowed.has(key))
    : [];
  const unique = [...new Set(requested)];
  return unique.length ? unique : getDefaultEffectPool(category);
}

function createGeneratorInput(options = {}, abilityArchetype, quality, meta) {
  const source = sanitizeText(options.source, 'seek');
  const seed = sanitizeText(options.seed, `${source}:${abilityArchetype}:${quality}`);
  return {
    quality,
    archetype: abilityArchetype,
    source,
    seed,
    availableEffectPool: normalizeEffectPool(options.availableEffectPool, meta.category),
    generatorVersion: GENERATOR_VERSION,
  };
}

function normalizeGeneratorInput(raw = {}, fallback = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const abilityArchetype = normalizeAbilityArchetype(source.archetype || fallback.abilityArchetype || fallback.archetype);
  const quality = normalizeQuality(source.quality || fallback.quality);
  const meta = getAbilityMeta(abilityArchetype);
  return {
    quality,
    archetype: abilityArchetype,
    source: sanitizeText(source.source || fallback.source, 'seek'),
    seed: sanitizeText(source.seed || fallback.seed, `${source.source || fallback.source || 'seek'}:${abilityArchetype}:${quality}`),
    availableEffectPool: normalizeEffectPool(source.availableEffectPool || fallback.availableEffectPool, meta.category),
    generatorVersion: GENERATOR_VERSION,
  };
}

function normalizeEffect(raw = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const key = raw.key;
  if (!key || !EFFECT_LABELS[key]) return null;
  if (key === 'secondHit') {
    const multiplier = Number(raw.multiplier ?? raw.value ?? raw.chance);
    return {
      key,
      multiplier: Number.isFinite(multiplier) ? round2(Math.max(0.18, Math.min(0.36, multiplier))) : 0.3,
    };
  }
  if (key === 'firstStrike') {
    const value = Number(raw.value ?? raw.chance);
    return {
      key,
      value: Number.isFinite(value) ? round2(Math.max(0.16, Math.min(0.32, value))) : 0.22,
    };
  }
  if (key === 'attributeBonus') {
    const value = Number(raw.value);
    return {
      key,
      attribute: raw.attribute || raw.keyAttribute || 'command',
      value: Number.isFinite(value) && Math.abs(value) >= 1 ? Math.round(value) : 5,
    };
  }
  if (key === 'armorBreak') {
    const value = Number(raw.value);
    return {
      key,
      value: Number.isFinite(value) ? round2(Math.max(0.06, Math.min(0.3, value))) : 0.12,
      turns: Math.max(1, Math.floor(Number(raw.turns ?? raw.duration) || 2)),
      maxStacks: Math.max(1, Math.min(3, Math.floor(Number(raw.maxStacks) || 3))),
    };
  }
  if (key === 'burn' || key === 'poison') {
    const value = Number(raw.value);
    return {
      key,
      value: Number.isFinite(value) ? round2(Math.max(0.06, Math.min(0.3, value))) : 0.12,
      turns: Math.max(1, Math.floor(Number(raw.turns ?? raw.duration) || 2)),
      maxStacks: Math.max(1, Math.min(3, Math.floor(Number(raw.maxStacks) || 3))),
    };
  }
  return {
    ...raw,
    key,
  };
}

function isKnownEffect(effect = {}) {
  return Boolean(normalizeEffect(effect));
}

module.exports = {
  createGeneratorInput,
  getAbilityMeta,
  getDefaultEffectPool,
  getQualityLabel,
  isKnownEffect,
  normalizeAbilityArchetype,
  normalizeEffect,
  normalizeEffectPool,
  normalizeGeneratorInput,
  normalizeQuality,
  rollQuality,
};
