// diplomacyCore — pure rules for FACTION<->FACTION diplomacy (docs/design/04, decisions in 08).
// Any two factions have a directed 好感度(favorability -100..100, each side independent) and a
// SYMMETRIC relation state: neutral / friendly / allied / hostile / nemesis. The symmetric state is
// driven by mutualFav = min(favAtoB, favBtoA) crossing thresholds (with hysteresis), plus ACTIONS
// (declare war / propose+accept alliance / break / sue for peace) that override favorability.
// Player and AI factions use the SAME model.
//
// Single source (see doc 04): favorability edges are directed + stored per side; the symmetric
// state/treaties are written by ONE command (mirrored to both edges) — this core only computes the
// NEXT state/delta; the service does the paired write. PURE: all numbers come from the passed-in
// config rows (diplomacy_tuning); no hardcoded thresholds.

const STATE = Object.freeze({
  NEUTRAL: 'neutral',
  FRIENDLY: 'friendly',
  ALLIED: 'allied',
  HOSTILE: 'hostile',
  NEMESIS: 'nemesis',
});
const STATES = Object.freeze(Object.values(STATE));

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function cfgVal(cfg, key, fallback) {
  const v = cfg && typeof cfg === 'object' ? cfg[key] : undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
// Clamp favorability to [-100, 100] WITHOUT rounding: favorability accumulates fractional per-tick drift
// (doc 04 §3.2/§5 — 累加后 clamp, moves ~1 point every few dozen ticks). Rounding here would discard any
// |drift| < 0.5/tick and freeze the passive-drift subsystem, so display rounding (if ever needed) belongs
// in the DTO layer, not in the stored value.
function clampFavorability(value) {
  return Math.max(-100, Math.min(100, toNumber(value, 0)));
}
function normalizeState(state) {
  return STATES.includes(state) ? state : STATE.NEUTRAL;
}
function mutualFavorability(favAtoB, favBtoA) {
  return Math.min(clampFavorability(favAtoB), clampFavorability(favBtoA));
}

function normalizeEdge(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    favorability: clampFavorability(src.favorability),
    state: normalizeState(src.state),
    nemesisStreak: Math.max(0, Math.floor(toNumber(src.nemesisStreak, 0))),
    treaties: src.treaties && typeof src.treaties === 'object' ? { ...src.treaties } : {},
  };
}

// Passive (favorability-driven) symmetric transition + nemesis sustain counter. `allied` is only
// entered/left by actions, so passive leaves it alone. Returns { state, nemesisStreak }.
function passiveTransition(state, mutualFav, nemesisStreak, cfg) {
  const s = normalizeState(state);
  const fav = clampFavorability(mutualFav);
  const nemesisAt = cfgVal(cfg, 'nemesisAt', -80);
  let streak = fav <= nemesisAt ? Math.max(0, Math.floor(toNumber(nemesisStreak, 0))) + 1 : 0;
  const friendlyAt = cfgVal(cfg, 'friendlyAt', 40);
  const friendlyExit = cfgVal(cfg, 'friendlyExit', 25);
  const hostileAt = cfgVal(cfg, 'hostileAt', -40);
  const hostileExit = cfgVal(cfg, 'hostileExit', -25);
  const nemesisTicks = cfgVal(cfg, 'nemesisTicks', 20);
  let next = s;
  if (s === STATE.NEUTRAL) {
    if (fav >= friendlyAt) next = STATE.FRIENDLY;
    else if (fav <= hostileAt) next = STATE.HOSTILE;
  } else if (s === STATE.FRIENDLY) {
    if (fav < friendlyExit) next = STATE.NEUTRAL;
  } else if (s === STATE.HOSTILE) {
    if (fav > hostileExit) next = STATE.NEUTRAL;
    else if (streak >= nemesisTicks) next = STATE.NEMESIS;
  } else if (s === STATE.NEMESIS) {
    if (fav > hostileExit) { next = STATE.NEUTRAL; streak = 0; }
  }
  return { state: next, nemesisStreak: streak };
}

// Active transition from a diplomacy ACTION. Returns the new state, or null if the action is invalid
// in the current state (caller rejects). ctx: { theirFavorabilityToUs } for alliance acceptance.
function actionTransition(state, action, ctx, cfg) {
  const s = normalizeState(state);
  const c = ctx && typeof ctx === 'object' ? ctx : {};
  switch (action) {
    case 'declareWar':
      return s === STATE.ALLIED || s === STATE.HOSTILE || s === STATE.NEMESIS ? (s === STATE.ALLIED ? STATE.HOSTILE : null) : STATE.HOSTILE;
    case 'acceptAlliance':
      // both sides must be at least friendly-ish; the proposer's side checks the other's favorability.
      if (s === STATE.HOSTILE || s === STATE.NEMESIS) return null;
      return clampFavorability(c.theirFavorabilityToUs) >= cfgVal(cfg, 'allyProposeMinFav', 50) ? STATE.ALLIED : null;
    case 'breakAlliance':
      return s === STATE.ALLIED ? STATE.NEUTRAL : null;
    case 'sueForPeace':
      return s === STATE.HOSTILE || s === STATE.NEMESIS ? STATE.NEUTRAL : null;
    default:
      return null;
  }
}

// Immediate favorability delta an action inflicts (usually on the TARGET's favorability toward the
// actor). Betraying an ally is far worse than an honest declaration of war.
function actionFavorabilityDelta(action, cfg) {
  switch (action) {
    case 'gift': return cfgVal(cfg, 'actGiftFav', 8);
    case 'declareWar': return cfgVal(cfg, 'actDeclareWarFav', -50);
    case 'betrayAlliance': return cfgVal(cfg, 'actBetrayAllyFav', -70);
    case 'sueForPeace': return cfgVal(cfg, 'actSueForPeaceFav', 10);
    default: return 0;
  }
}

// Per-tick natural favorability drift for one directed edge: decays toward 0, nudged by shared
// enemies (+), border pressure (-), and the two rulers' 相性 compat (+/-). ctx: {sharedEnemies,
// bordering(bool), rulerCompat(-100..100)}.
function favorabilityDrift(edge, ctx, cfg) {
  const e = normalizeEdge(edge);
  const c = ctx && typeof ctx === 'object' ? ctx : {};
  let delta = 0;
  // decay toward neutral
  const decay = cfgVal(cfg, 'driftToNeutralPerTick', 0.5);
  if (e.favorability > 0) delta -= Math.min(decay, e.favorability);
  else if (e.favorability < 0) delta += Math.min(decay, -e.favorability);
  delta += Math.max(0, Math.floor(toNumber(c.sharedEnemies, 0))) * cfgVal(cfg, 'sharedEnemyBonusPerTick', 0.4);
  if (c.bordering) delta += cfgVal(cfg, 'borderPressurePerTick', -0.3);
  delta += clampFavorability(c.rulerCompat) * cfgVal(cfg, 'rulerCompatScale', 0.02);
  return delta;
}

// Effects of a state are COMPUTED, never stored: who can attack whom, shared vision, mutual defence
// eligibility (optional participation — the ally may refuse, doc 04), trade.
function stateEffects(state) {
  const s = normalizeState(state);
  return {
    canAttack: s === STATE.HOSTILE || s === STATE.NEMESIS || s === STATE.NEUTRAL,
    sharedVision: s === STATE.ALLIED,
    mutualDefenseEligible: s === STATE.ALLIED, // eligible to be ASKED; participation is optional
    tradeAllowed: s === STATE.FRIENDLY || s === STATE.ALLIED,
    atWar: s === STATE.HOSTILE || s === STATE.NEMESIS,
  };
}

function canAttack(state) {
  return stateEffects(state).canAttack;
}

module.exports = {
  STATE,
  STATES,
  clampFavorability,
  mutualFavorability,
  normalizeEdge,
  passiveTransition,
  actionTransition,
  actionFavorabilityDelta,
  favorabilityDrift,
  stateEffects,
  canAttack,
};
