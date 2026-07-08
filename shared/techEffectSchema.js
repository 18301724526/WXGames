// techEffectSchema — the ONE effect-type schema for the Civ-style tech redesign (docs/design/06).
// A tech node's effects are a list of TYPED effects (up from today's single `unlockedBuildings` key), and
// this module is the single authority for what a valid effect looks like + how to describe it. PURE
// (constants + validation, no IO); shared front/back so the client renders the same effect list it
// validates. The fold from researched-nodes → a live effects snapshot lives in techEffectResolver.js.
//
// Single source: every "what can this effect be / mean" question is answered here; no other module
// re-derives effect legality or its i18n key.
//
// op semantics (resolves doc-06 review gap #7 — the mul ambiguity): `mul` values are ADDITIVE deltas to a
// base-1 multiplier, matching BuildingEffectCalculator's `effects.xMultiplier += bonus` stacking. So two
// +0.2 `mul` effects yield a ×1.4 multiplier (1 + 0.2 + 0.2), NOT ×1.44 compounding. `add` accumulates a
// flat base. `flag` just adds `target` to a set. This is documented so designers filling the table know a
// +0.2 mul is "+20% additive", not "×1.2 compounding".

const EFFECT_TYPES = Object.freeze({
  UNLOCK_BUILDING: 'unlockBuilding',
  UNLOCK_UNIT: 'unlockUnit',
  RESOURCE_OUTPUT: 'resourceOutput',
  GLOBAL_OUTPUT: 'globalOutput',
  COMBAT_MODIFIER: 'combatModifier',
  ABILITY_UNLOCK: 'abilityUnlock',
  DIPLOMACY_MODIFIER: 'diplomacyModifier',
  POPULATION_BONUS: 'populationBonus',
  TECH_RATE_BONUS: 'techRateBonus',
});

const OPS = Object.freeze({ ADD: 'add', MUL: 'mul', FLAG: 'flag' });

const RESOURCE_TARGETS = Object.freeze(['food', 'wood', 'stone', 'iron', 'knowledge']);
const POPULATION_TARGETS = Object.freeze(['cap', 'growth']);

// Per-type contract: which ops are legal, whether a target/value is required, and (for enumerable
// targets) the allowed target set. `flag` effects carry no value; `add`/`mul` require a numeric value.
const TYPE_RULES = Object.freeze({
  [EFFECT_TYPES.UNLOCK_BUILDING]: { ops: ['flag'], targetRequired: true, valueRequired: false },
  [EFFECT_TYPES.UNLOCK_UNIT]: { ops: ['flag'], targetRequired: true, valueRequired: false },
  [EFFECT_TYPES.RESOURCE_OUTPUT]: { ops: ['add', 'mul'], targetRequired: true, valueRequired: true, targets: RESOURCE_TARGETS },
  [EFFECT_TYPES.GLOBAL_OUTPUT]: { ops: ['mul'], targetRequired: false, valueRequired: true },
  [EFFECT_TYPES.COMBAT_MODIFIER]: { ops: ['add', 'mul'], targetRequired: true, valueRequired: true },
  [EFFECT_TYPES.ABILITY_UNLOCK]: { ops: ['flag'], targetRequired: true, valueRequired: false },
  [EFFECT_TYPES.DIPLOMACY_MODIFIER]: { ops: ['add'], targetRequired: true, valueRequired: true },
  [EFFECT_TYPES.POPULATION_BONUS]: { ops: ['add', 'mul'], targetRequired: true, valueRequired: true, targets: POPULATION_TARGETS },
  [EFFECT_TYPES.TECH_RATE_BONUS]: { ops: ['mul'], targetRequired: false, valueRequired: true },
});

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

// Validate a single typed effect. Returns { ok:true } or { ok:false, error }.
function validateEffect(effect) {
  if (!effect || typeof effect !== 'object') return { ok: false, error: 'effect must be an object' };
  const rule = TYPE_RULES[effect.type];
  if (!rule) return { ok: false, error: `unknown effect type: ${effect.type}` };
  if (!rule.ops.includes(effect.op)) return { ok: false, error: `op ${effect.op} not allowed for ${effect.type}` };
  if (rule.targetRequired && !effect.target) return { ok: false, error: `${effect.type} requires a target` };
  if (rule.targets && effect.target && !rule.targets.includes(effect.target)) {
    return { ok: false, error: `${effect.type} target must be one of ${rule.targets.join('/')}` };
  }
  if (rule.valueRequired && !isFiniteNumber(effect.value)) return { ok: false, error: `${effect.type} requires a numeric value` };
  if (effect.op === OPS.FLAG && effect.value != null && !isFiniteNumber(effect.value)) {
    return { ok: false, error: 'flag effects carry no numeric value' };
  }
  return { ok: true };
}

// Canonicalize a typed effect (string target, numeric value for non-flag). Returns null if invalid.
function normalizeEffect(effect) {
  const check = validateEffect(effect);
  if (!check.ok) return null;
  const out = { type: effect.type, op: effect.op };
  if (effect.target != null) out.target = String(effect.target);
  if (effect.op !== OPS.FLAG) out.value = Number(effect.value);
  if (effect.params && typeof effect.params === 'object') out.params = { ...effect.params };
  return out;
}

// i18n key + interpolation params for rendering an effect (client uses t(key, params)). Chinese text is
// NEVER baked here — only a stable key + numbers (MEMORY i18n conventions).
function describeEffectKey(effect) {
  const e = effect || {};
  const key = `tech.effect.${e.type}${e.op && e.op !== OPS.FLAG ? `.${e.op}` : ''}`;
  const params = {};
  if (e.target != null) params.target = String(e.target);
  if (e.op !== OPS.FLAG && isFiniteNumber(e.value)) {
    params.value = e.value;
    params.percent = Math.round(e.value * 100);
  }
  return { key, params };
}

module.exports = {
  EFFECT_TYPES,
  OPS,
  RESOURCE_TARGETS,
  POPULATION_TARGETS,
  TYPE_RULES,
  validateEffect,
  normalizeEffect,
  describeEffectKey,
};
