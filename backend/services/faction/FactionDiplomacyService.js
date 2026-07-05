// FactionDiplomacyService — the ONLY writer of faction diplomacy, wrapping the pure diplomacyCore
// over the shared FactionDiplomacyRepository (docs/design/04, 08). Enforces the doc-04 single-source
// rules: favorability is DIRECTED (adjustFavorability writes one side); state/since are SYMMETRIC and
// change ONLY through applyStateChange, which mirrors both (A,B) and (B,A) rows in one command — so
// the two symmetric rows can never diverge (no pathological mirror; consistency by single write).
//
// Effects (canAttack / shared vision / mutual defense) are computed by diplomacyCore.stateEffects,
// never stored. Config (diplomacy_tuning) is injected. Numbers are never hardcoded here.

const diplomacyCore = require('../../../shared/faction/diplomacyCore');

function createFactionDiplomacyService(deps = {}) {
  const repo = deps.diplomacyRepo;
  const getConfig = typeof deps.getConfig === 'function' ? deps.getConfig : () => (deps.config || {});

  function getEdge(a, b) {
    return repo.getEdge(a, b);
  }

  function state(a, b) {
    return getEdge(a, b).state;
  }

  function mutualFavorability(a, b) {
    return diplomacyCore.mutualFavorability(getEdge(a, b).favorability, getEdge(b, a).favorability);
  }

  // DIRECTED: change only how `a` feels about `b`.
  function adjustFavorability(a, b, delta, now) {
    const edge = getEdge(a, b);
    const next = { ...edge, favorability: diplomacyCore.clampFavorability(edge.favorability + Number(delta || 0)) };
    return repo.upsertEdge(a, b, next, now);
  }

  // SYMMETRIC single-write command: set the relation state on BOTH ordered rows so they stay in
  // lockstep. This is the only place `state`/`since` are written.
  function applyStateChange(a, b, newState, now) {
    const ab = getEdge(a, b);
    const ba = getEdge(b, a);
    const resetStreak = newState !== diplomacyCore.STATE.NEMESIS ? 0 : Math.max(ab.nemesisStreak, ba.nemesisStreak);
    repo.upsertEdge(a, b, { ...ab, state: newState, nemesisStreak: resetStreak, since: now || null }, now);
    repo.upsertEdge(b, a, { ...ba, state: newState, nemesisStreak: resetStreak, since: now || null }, now);
    return newState;
  }

  // Per-tick: drift both directed favorabilities, then run the passive (mutualFav-driven) transition;
  // if the symmetric state should change, mirror it. ctxAtoB/ctxBtoA are the drift contexts
  // (sharedEnemies/bordering/rulerCompat) for each direction.
  function advanceEdge(a, b, ctxAtoB, ctxBtoA, now) {
    const cfg = getConfig();
    const ab0 = getEdge(a, b);
    const ba0 = getEdge(b, a);
    const ab = adjustFavorability(a, b, diplomacyCore.favorabilityDrift(ab0, ctxAtoB, cfg), now);
    adjustFavorability(b, a, diplomacyCore.favorabilityDrift(ba0, ctxBtoA, cfg), now);
    const mutual = diplomacyCore.mutualFavorability(ab.favorability, getEdge(b, a).favorability);
    const result = diplomacyCore.passiveTransition(ab.state, mutual, ab.nemesisStreak, cfg);
    // nemesisStreak drives a SYMMETRIC transition, so it must be stored symmetrically — mirror it onto
    // BOTH directed rows. Storing it on only (a,b) made progress toward NEMESIS argument-order-dependent:
    // alternating advanceEdge(a,b)/advanceEdge(b,a) would split the streak across two rows and never reach
    // the threshold. Mirroring keeps the pair's streak single-sourced regardless of call order.
    repo.upsertEdge(a, b, { ...getEdge(a, b), nemesisStreak: result.nemesisStreak }, now);
    repo.upsertEdge(b, a, { ...getEdge(b, a), nemesisStreak: result.nemesisStreak }, now);
    if (result.state !== ab.state) applyStateChange(a, b, result.state, now);
    return getEdge(a, b);
  }

  // Diplomacy ACTIONS. `a` is the actor. Returns { ok, state } — ok=false if invalid in the current
  // state (caller shows an error). The immediate favorability hit lands on the TARGET's view of the actor.
  function performAction(a, b, action, ctx, now) {
    const cfg = getConfig();
    const current = state(a, b);
    const nextState = diplomacyCore.actionTransition(current, action, ctx || {}, cfg);
    if (nextState === null) return { ok: false, state: current };
    applyStateChange(a, b, nextState, now);
    const favDelta = diplomacyCore.actionFavorabilityDelta(action === 'declareWar' && current === diplomacyCore.STATE.ALLIED ? 'betrayAlliance' : action, cfg);
    if (favDelta) adjustFavorability(b, a, favDelta, now); // target sours on the actor
    return { ok: true, state: nextState };
  }

  function effects(a, b) {
    return diplomacyCore.stateEffects(state(a, b));
  }
  function canAttack(a, b) {
    return diplomacyCore.canAttack(state(a, b));
  }

  return {
    getEdge,
    state,
    mutualFavorability,
    adjustFavorability,
    applyStateChange,
    advanceEdge,
    performAction,
    effects,
    canAttack,
  };
}

module.exports = { createFactionDiplomacyService };
