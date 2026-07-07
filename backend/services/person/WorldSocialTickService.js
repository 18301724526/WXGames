// WorldSocialTickService — advance the world's relationship graph by one tick (docs/design/02, 03; phase 3).
// PURE orchestration over a set of people: sociable people (their nature's meetRateMult) meet others, so
// directed edges build / strengthen toward each pair's 相性 setpoint (relationshipCore.meet over
// personalityCore.compatScore), and idle edges decay (relationshipCore.decayEdge). Returns the UPDATED
// people plus the meets and the kind-threshold crossings (became_friend / became_enemy) so the caller can
// persist them (WorldPeopleRepository + player roster) and raise events (好友来投 / 结义 / 反目 via
// EventService). NOT yet wired into WorldWorkerService — this is the testable tick logic; the persistence +
// event wiring is a later integration slice.
//
// Single source: edges live ON each person (relationshipCore); compat is DERIVED from personality axes
// every time (never stored). All randomness comes from an injected seeded PRNG so a tick is deterministic.

const personalityCore = require('../../../shared/person/personalityCore');
const relationshipCore = require('../../../shared/person/relationshipCore');

function axesOf(person) {
  return person && person.personality ? person.personality.axes : null;
}
function natureOf(person) {
  return person && person.personality ? person.personality.nature : null;
}

// Weighted index pick over `weights` using a [0,1) roll; falls back to uniform when the total is 0.
function weightedPick(weights, roll) {
  const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
  if (total <= 0) return Math.min(weights.length - 1, Math.floor(roll * weights.length));
  let target = roll * total;
  for (let i = 0; i < weights.length; i += 1) {
    target -= Math.max(0, weights[i]);
    if (target < 0) return i;
  }
  return weights.length - 1;
}

function kindRank(kind) {
  // Coarse friend/neutral/enemy bucket for detecting a meaningful crossing.
  if (kind === relationshipCore.KIND.FRIEND || kind === relationshipCore.KIND.SWORN
    || kind === relationshipCore.KIND.ROMANCE || kind === relationshipCore.KIND.LORD_BOND) return 1;
  if (kind === relationshipCore.KIND.ENEMY || kind === relationshipCore.KIND.NEMESIS) return -1;
  return 0;
}

function createWorldSocialTickService(deps = {}) {
  const natures = deps.natures || null;

  // Decay every edge of every person toward 0 for idle time (special-flag edges never decay). Mutates
  // the passed clones in place.
  function decayAll(people, nowMs, relTuning) {
    for (const p of people) {
      if (!Array.isArray(p.relationships)) continue;
      p.relationships = p.relationships.map((e) => relationshipCore.decayEdge(e, nowMs, relTuning));
    }
  }

  // Run `meetPairs` weighted meetings. A initiator is drawn weighted by meetRateMult (sociable natures go
  // out more); B is drawn uniformly among the others. Both sides get their directed edge updated with the
  // SAME (symmetric) compat but their OWN drift multiplier. Records crossings when the coarse bucket flips.
  function advanceRelationships(inputPeople, opts = {}) {
    const src = Array.isArray(inputPeople) ? inputPeople : [];
    // Work on clones so the input is never mutated; edges arrays are copied per person.
    const people = src.filter((p) => p && p.id).map((p) => ({ ...p, relationships: Array.isArray(p.relationships) ? [...p.relationships] : [] }));
    const meets = [];
    const crossings = [];
    if (people.length < 2) return { people, meets, crossings };

    const prng = typeof opts.prng === 'function' ? opts.prng : personalityCore.makePrng('social-tick');
    const meetPairs = Math.max(0, Math.floor(opts.meetPairs != null ? opts.meetPairs : 3));
    const nowMs = Math.max(0, Math.floor(opts.nowMs || 0));
    const pTuning = opts.personalityTuning || null;
    const relTuning = opts.relTuning || null;
    const natureRows = opts.natures || natures;

    if (opts.decay) decayAll(people, nowMs, relTuning);

    const meetWeights = people.map((p) => personalityCore.behaviorMult(natureOf(p), 'meetRateMult', natureRows, 1));

    for (let i = 0; i < meetPairs; i += 1) {
      const ai = weightedPick(meetWeights, prng());
      let bi = Math.floor(prng() * (people.length - 1));
      if (bi >= ai) bi += 1; // skip self → uniform over the others
      const a = people[ai];
      const b = people[bi];
      const axesA = axesOf(a);
      const axesB = axesOf(b);
      if (!axesA || !axesB) continue;
      const compat = personalityCore.compatScore(axesA, axesB, pTuning);
      const beforeA = edgeKind(a.relationships, b.id);
      const beforeB = edgeKind(b.relationships, a.id);
      a.relationships = relationshipCore.meet(a.relationships, b.id, compat, personalityCore.behaviorMult(natureOf(a), 'loyaltyDriftMult', natureRows, 1), nowMs, relTuning).edges;
      b.relationships = relationshipCore.meet(b.relationships, a.id, compat, personalityCore.behaviorMult(natureOf(b), 'loyaltyDriftMult', natureRows, 1), nowMs, relTuning).edges;
      meets.push({ from: a.id, to: b.id, compat });
      recordCrossing(crossings, a.id, b.id, beforeA, edgeKind(a.relationships, b.id));
      recordCrossing(crossings, b.id, a.id, beforeB, edgeKind(b.relationships, a.id));
    }
    return { people, meets, crossings };
  }

  return { advanceRelationships, decayAll };
}

function edgeKind(edges, toId) {
  const e = Array.isArray(edges) ? edges.find((x) => x && x.toPersonId === toId) : null;
  return e ? e.kind : relationshipCore.KIND.STRANGER;
}

function recordCrossing(out, from, to, beforeKind, afterKind) {
  const before = kindRank(beforeKind);
  const after = kindRank(afterKind);
  if (after === before) return;
  if (after === 1) out.push({ type: 'became_friend', from, to, kind: afterKind });
  else if (after === -1) out.push({ type: 'became_enemy', from, to, kind: afterKind });
}

module.exports = { createWorldSocialTickService, weightedPick };
