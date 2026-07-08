// relationshipCore — pure rules for the person<->person RELATIONSHIP NETWORK (docs/design/03,
// decisions in 08). A relationship is a DIRECTED, SPARSE edge stored ON the person
// (person.relationships: [{toPersonId, affinity -100..100, kind, meetCount, lastInteractAt, flags}]).
// The whole network is the union of all person.relationships — there is NO global matrix/graph copy;
// any "graph" view is a query over the edges. Edges exist only between people who have MET (bounded
// per person). affinity drifts toward the two people's 相性(compat) setpoint, modulated by
// personality; kind is derived from affinity thresholds (normal axis) OR event-set flags (special
// states: 义兄弟/恋慕/主従/宿敌, which never auto-dissolve — only events transition them).
//
// PURE: config (relationship_tuning), compat (from personalityCore.compatScore), and personality
// behaviour mults are passed in by the caller. Deterministic. Same rules on server/worker/tests.

const KIND = Object.freeze({
  STRANGER: 'stranger',
  ACQUAINTANCE: 'acquaintance',
  FRIEND: 'friend',
  ENEMY: 'enemy',
  SWORN: 'sworn',
  ROMANCE: 'romance',
  LORD_BOND: 'lord_bond',
  NEMESIS: 'nemesis',
});
// A special-state flag pins the kind and blocks affinity-driven auto demotion.
const FLAG_KIND = Object.freeze({ sworn: KIND.SWORN, romance: KIND.ROMANCE, lord_bond: KIND.LORD_BOND, rival_declared: KIND.NEMESIS });
const SPECIAL_FLAGS = Object.freeze(Object.keys(FLAG_KIND));
const DAY_MS = 24 * 60 * 60 * 1000;

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function clampAffinity(value) {
  return Math.max(-100, Math.min(100, Math.round(toNumber(value, 0))));
}
function cfgVal(cfg, key, fallback) {
  const v = cfg && typeof cfg === 'object' ? cfg[key] : undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeFlags(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((f) => SPECIAL_FLAGS.includes(f));
}

function normalizeEdge(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    toPersonId: String(src.toPersonId || ''),
    affinity: clampAffinity(src.affinity),
    kind: typeof src.kind === 'string' ? src.kind : KIND.ACQUAINTANCE,
    meetCount: Math.max(0, Math.floor(toNumber(src.meetCount, 0))),
    lastInteractAt: Math.max(0, Math.floor(toNumber(src.lastInteractAt, 0))),
    flags: normalizeFlags(src.flags),
  };
}

function topSpecialFlag(flags) {
  // priority: nemesis > sworn > romance > lord_bond (a betrayal-declared rivalry overrides bonds)
  for (const f of ['rival_declared', 'sworn', 'romance', 'lord_bond']) {
    if (flags.includes(f)) return f;
  }
  return null;
}

// Resolve an edge's kind: a special flag pins it; otherwise the affinity axis (with a meetCount gate
// for friendship and a hysteresis band so a kind doesn't flicker at the boundary).
function resolveKind(edge, cfg) {
  const e = normalizeEdge(edge);
  const flag = topSpecialFlag(e.flags);
  if (flag) return FLAG_KIND[flag];
  const friendAt = cfgVal(cfg, 'friendAt', 40);
  const friendMeets = cfgVal(cfg, 'friendMeets', 3);
  const enemyAt = cfgVal(cfg, 'enemyAt', -40);
  const h = cfgVal(cfg, 'hysteresis', 8);
  // demote-hysteresis: keep friend/enemy until affinity crosses the band inward.
  if (e.kind === KIND.FRIEND && e.affinity >= friendAt - h && e.meetCount >= friendMeets) return KIND.FRIEND;
  if (e.kind === KIND.ENEMY && e.affinity <= enemyAt + h) return KIND.ENEMY;
  if (e.affinity >= friendAt && e.meetCount >= friendMeets) return KIND.FRIEND;
  if (e.affinity <= enemyAt) return KIND.ENEMY;
  return KIND.ACQUAINTANCE;
}

function withResolvedKind(edge, cfg) {
  const e = normalizeEdge(edge);
  e.kind = resolveKind(e, cfg);
  return e;
}

// New-edge starting affinity: a fraction of the two people's compat setpoint (they don't instantly
// feel their full destiny — it grows through interaction).
function initialAffinity(compat, cfg) {
  return clampAffinity(toNumber(compat, 0) * cfgVal(cfg, 'initialFactor', 0.3));
}

// affinity drifts toward the compat setpoint at driftRate, scaled by a personality drift mult, plus
// any event delta. This is the per-interaction step (called on a meet or an event).
function driftAffinity(affinity, compat, driftMult, eventDelta, cfg) {
  const a = clampAffinity(affinity);
  const setpoint = clampAffinity(compat);
  const rate = Math.max(0, cfgVal(cfg, 'driftRate', 0.1)) * Math.max(0, toNumber(driftMult, 1));
  const drift = (setpoint - a) * rate;
  return clampAffinity(a + drift + toNumber(eventDelta, 0));
}

// Idle decay: an edge not interacted with for `elapsedMs` bleeds affinity toward 0 (special-flag
// edges do NOT decay — sworn brothers stay sworn).
function decayEdge(edge, nowMs, cfg) {
  const e = normalizeEdge(edge);
  if (topSpecialFlag(e.flags)) return e;
  const days = Math.max(0, (toNumber(nowMs, 0) - e.lastInteractAt) / DAY_MS);
  if (days < 1 || e.affinity === 0) return e;
  const decay = cfgVal(cfg, 'decayPerDay', 3) * days;
  e.affinity = e.affinity > 0 ? Math.max(0, e.affinity - decay) : Math.min(0, e.affinity + decay);
  e.affinity = clampAffinity(e.affinity);
  return e;
}

// Build a new acquaintance edge or touch an existing one (meetCount++, drift toward compat). Returns
// {edges, edge} with the edge's kind resolved. Enforces the per-person cap by evicting the weakest
// non-special edge when full.
function meet(edges, toPersonId, compat, driftMult, nowMs, cfg) {
  const list = Array.isArray(edges) ? edges.map(normalizeEdge) : [];
  const id = String(toPersonId || '');
  const now = Math.max(0, Math.floor(toNumber(nowMs, 0)));
  let edge = list.find((e) => e.toPersonId === id);
  if (!edge) {
    edge = {
      toPersonId: id,
      affinity: initialAffinity(compat, cfg),
      kind: KIND.ACQUAINTANCE,
      meetCount: 1,
      lastInteractAt: now,
      flags: [],
    };
    list.push(edge);
    evictOverCap(list, cfg);
  } else {
    edge.meetCount += 1;
    edge.affinity = driftAffinity(edge.affinity, compat, driftMult, 0, cfg);
    edge.lastInteractAt = now;
  }
  edge.kind = resolveKind(edge, cfg);
  return { edges: list, edge };
}

// Evict the weakest edge in place when over the per-person cap: never a special-flag edge; pick the
// smallest |affinity|, tie-broken by oldest lastInteractAt.
function evictOverCap(edges, cfg) {
  const cap = Math.max(1, Math.floor(cfgVal(cfg, 'maxEdgesPerPerson', 64)));
  if (edges.length <= cap) return edges;
  let worstIdx = -1;
  let worstScore = Infinity;
  for (let i = 0; i < edges.length; i += 1) {
    if (topSpecialFlag(edges[i].flags)) continue;
    const score = Math.abs(edges[i].affinity) * 1e13 + edges[i].lastInteractAt;
    if (score < worstScore) {
      worstScore = score;
      worstIdx = i;
    }
  }
  if (worstIdx >= 0) edges.splice(worstIdx, 1);
  return edges;
}

// Apply a relationship EVENT to an edge (special-state transitions). Events are the ONLY way special
// states form or dissolve (affinity drift never sets/clears a flag).
function applyRelationEvent(edge, eventType, cfg) {
  const e = normalizeEdge(edge);
  const add = (flag) => { if (!e.flags.includes(flag)) e.flags.push(flag); };
  const remove = (flag) => { e.flags = e.flags.filter((f) => f !== flag); };
  switch (eventType) {
    case 'swear': add('sworn'); e.affinity = clampAffinity(Math.max(e.affinity, cfgVal(cfg, 'swornAt', 80))); break;
    case 'romance': add('romance'); e.affinity = clampAffinity(Math.max(e.affinity, cfgVal(cfg, 'swornAt', 80))); break;
    case 'lord_bond': add('lord_bond'); break;
    case 'betray': remove('sworn'); remove('lord_bond'); add('rival_declared'); e.affinity = clampAffinity(Math.min(e.affinity, cfgVal(cfg, 'nemesisAt', -80))); break;
    case 'nemesis': add('rival_declared'); e.affinity = clampAffinity(Math.min(e.affinity, cfgVal(cfg, 'nemesisAt', -80))); break;
    case 'reconcile': remove('rival_declared'); e.affinity = clampAffinity(Math.max(e.affinity, 0)); break;
    default: break;
  }
  e.kind = resolveKind(e, cfg);
  return e;
}

// ②b 招降 modifier from the captured person's relationships toward the recruiting faction: friends
// (+bonus) and sworn brothers (+bigger) already in the faction make recruitment easier; a nemesis in
// the faction makes it harder. `inFactionKind(toPersonId)` returns the relationship kind of that
// person if they belong to the recruiter's faction, else null. Returns a success-rate delta.
function recruitModifier(capturedEdges, inFactionKind, cfg) {
  const edges = Array.isArray(capturedEdges) ? capturedEdges.map(normalizeEdge) : [];
  let best = 0;
  let nemesis = false;
  for (const e of edges) {
    const kind = inFactionKind ? inFactionKind(e.toPersonId) : null;
    if (!kind) continue;
    if (kind === KIND.SWORN || kind === KIND.ROMANCE) best = Math.max(best, cfgVal(cfg, 'recruitSwornBonus', 0.4));
    else if (kind === KIND.FRIEND) best = Math.max(best, cfgVal(cfg, 'recruitFriendBonus', 0.25));
    if (kind === KIND.NEMESIS) nemesis = true;
  }
  return best + (nemesis ? cfgVal(cfg, 'recruitNemesisPenalty', -0.3) : 0);
}

module.exports = {
  KIND,
  SPECIAL_FLAGS,
  normalizeEdge,
  resolveKind,
  withResolvedKind,
  initialAffinity,
  driftAffinity,
  decayEdge,
  meet,
  evictOverCap,
  applyRelationEvent,
  recruitModifier,
};
