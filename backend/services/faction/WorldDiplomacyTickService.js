// WorldDiplomacyTickService — advance faction diplomacy by one tick (docs/design/04; phase 3). For every
// faction PAIR it composes the drift context — shared enemies (a third faction both are hostile toward),
// shared borders (injected predicate; real territory adjacency arrives with territory.ownerFactionId,
// phase 1.3), and the two rulers' 相性 (personalityCore.compatScore over their personalities) — then calls
// the single diplomacy writer (FactionDiplomacyService.advanceEdge), so favorability drifts and passive
// state transitions apply consistently. NOT yet wired into WorldWorkerService — this is the testable tick
// logic; the wiring supplies the faction id list + ruler lookup + border predicate from world state.
//
// Single source: diplomacy state is written ONLY through FactionDiplomacyService; this service computes
// the drift inputs from the faction/person registries and never stores derived values. Config injected.

const diplomacyCore = require('../../../shared/faction/diplomacyCore');
const personalityCore = require('../../../shared/person/personalityCore');

const HOSTILE_STATES = new Set([diplomacyCore.STATE.HOSTILE, diplomacyCore.STATE.NEMESIS]);

function axesOf(person) {
  return person && person.personality ? person.personality.axes : null;
}

function createWorldDiplomacyTickService(deps = {}) {
  const diplomacyService = deps.diplomacyService || null;
  const personalityTuning = deps.personalityTuning || null;

  // How many OTHER factions are both `a` and `b` currently hostile toward — a common-enemy bond.
  // Dedups its input so a repeated id can't double-count a single shared enemy.
  function sharedEnemyCount(a, b, factionIds) {
    if (!diplomacyService) return 0;
    let count = 0;
    for (const x of new Set(Array.isArray(factionIds) ? factionIds : [])) {
      if (x === a || x === b) continue;
      if (HOSTILE_STATES.has(diplomacyService.state(a, x)) && HOSTILE_STATES.has(diplomacyService.state(b, x))) count += 1;
    }
    return count;
  }

  // The two rulers' 相性 in -100..100 (0 when either ruler/personality is unknown). rulerOf(factionId)
  // returns the faction's ruler person (or null).
  function rulerCompat(a, b, rulerOf, pTuning) {
    if (typeof rulerOf !== 'function') return 0;
    const axesA = axesOf(rulerOf(a));
    const axesB = axesOf(rulerOf(b));
    if (!axesA || !axesB) return 0;
    return personalityCore.compatScore(axesA, axesB, pTuning || personalityTuning);
  }

  // The (symmetric) drift context for a pair: shared enemies, border pressure, ruler compat.
  function driftContext(a, b, opts = {}) {
    const factionIds = Array.isArray(opts.factionIds) ? opts.factionIds : [];
    const bordering = typeof opts.bordering === 'function' ? !!opts.bordering(a, b) : false;
    return {
      sharedEnemies: sharedEnemyCount(a, b, factionIds),
      bordering,
      rulerCompat: rulerCompat(a, b, opts.rulerOf, opts.personalityTuning),
    };
  }

  // Advance every unordered faction pair once. opts: {factionIds, now, bordering(a,b), rulerOf(id),
  // personalityTuning}. Returns the number of pairs advanced.
  function advanceAll(opts = {}) {
    if (!diplomacyService) return 0;
    // Dedup so a repeated id can't create a self-pair or advance the same edge twice.
    const ids = Array.isArray(opts.factionIds) ? [...new Set(opts.factionIds.filter(Boolean))] : [];
    let pairs = 0;
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = ids[i];
        const b = ids[j];
        const ctx = driftContext(a, b, { ...opts, factionIds: ids });
        // context is symmetric, so both directions share it.
        diplomacyService.advanceEdge(a, b, ctx, ctx, opts.now || null);
        pairs += 1;
      }
    }
    return pairs;
  }

  return { sharedEnemyCount, rulerCompat, driftContext, advanceAll };
}

module.exports = { createWorldDiplomacyTickService };
