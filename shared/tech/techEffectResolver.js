// techEffectResolver — the ONE place that folds a faction's researched tech nodes into a live effects
// snapshot (docs/design/06 §4.1). PURE + deterministic: given the researched node ids + the node
// definitions, it returns the aggregated effects. Nothing here is stored — callers re-resolve every time
// (today's `getUnlockedBuildings` flatMap generalized). No other module may re-derive "what this faction
// unlocked / how much bonus" from `researched`.
//
// Compatibility: today's 38 nodes carry the LEGACY object shape `effects: { unlockedBuildings,
// resourceEntrances }`. This resolver reads both that legacy object AND the new typed-effect array
// (techEffectSchema), so T1 is a zero-behavior-change slice. `resourceEntrances` was always pure display
// text (no numeric effect); it is preserved on the snapshot as `resourceEntrances` (display-only) so the
// DTO keeps rendering it — it is NOT turned into a numeric bonus (doc-06 review gap #5).
//
// op semantics: `mul` values are ADDITIVE deltas to a base-1 multiplier (see techEffectSchema header), so
// the snapshot stores the SUM of deltas; the aggregator later does `effects.xMultiplier += snapshot.x`.

const schema = require('../techEffectSchema');

function emptySnapshot() {
  return {
    unlockedBuildings: [],
    unlockedUnits: [],
    abilities: [],
    resourceEntrances: [], // display-only legacy text
    resourceOutput: {}, // { [res]: { mul, add } } only for touched resources
    globalOutputMul: 0, // additive delta to a base-1 global multiplier
    combat: {}, // { [target]: { mul, add } }
    diplomacy: {}, // { [target]: add-accumulated }
    population: {}, // { cap|growth: { mul, add } }
    techRateMul: 0, // additive delta to a base-1 tech-rate multiplier
  };
}

function pushUnique(arr, value) {
  const v = String(value);
  if (v && !arr.includes(v)) arr.push(v);
}
function slot(map, key) {
  if (!map[key]) map[key] = { mul: 0, add: 0 };
  return map[key];
}

// Turn a legacy `effects` OBJECT into typed effects, returning { typed:[], resourceEntrances:[] }.
function fromLegacy(effectsObj) {
  const typed = [];
  const resourceEntrances = [];
  const buildings = Array.isArray(effectsObj.unlockedBuildings) ? effectsObj.unlockedBuildings : [];
  for (const b of buildings) typed.push({ type: schema.EFFECT_TYPES.UNLOCK_BUILDING, op: schema.OPS.FLAG, target: b });
  const entrances = Array.isArray(effectsObj.resourceEntrances) ? effectsObj.resourceEntrances : [];
  for (const r of entrances) resourceEntrances.push(String(r));
  return { typed, resourceEntrances };
}

// Extract the typed effect list + display entrances for a node, handling both shapes.
function nodeEffects(node) {
  const eff = node && node.effects;
  if (Array.isArray(eff)) return { typed: eff, resourceEntrances: [] };
  if (eff && typeof eff === 'object') return fromLegacy(eff);
  return { typed: [], resourceEntrances: [] };
}

function applyEffect(snap, effect) {
  const e = schema.normalizeEffect(effect);
  if (!e) return; // invalid effect is ignored fail-closed (never corrupts the snapshot)
  const T = schema.EFFECT_TYPES;
  switch (e.type) {
    case T.UNLOCK_BUILDING: pushUnique(snap.unlockedBuildings, e.target); break;
    case T.UNLOCK_UNIT: pushUnique(snap.unlockedUnits, e.target); break;
    case T.ABILITY_UNLOCK: pushUnique(snap.abilities, e.target); break;
    case T.RESOURCE_OUTPUT: { const s = slot(snap.resourceOutput, e.target); s[e.op === schema.OPS.MUL ? 'mul' : 'add'] += e.value; break; }
    case T.GLOBAL_OUTPUT: snap.globalOutputMul += e.value; break;
    case T.COMBAT_MODIFIER: { const s = slot(snap.combat, e.target); s[e.op === schema.OPS.MUL ? 'mul' : 'add'] += e.value; break; }
    case T.DIPLOMACY_MODIFIER: snap.diplomacy[e.target] = (snap.diplomacy[e.target] || 0) + e.value; break;
    case T.POPULATION_BONUS: { const s = slot(snap.population, e.target); s[e.op === schema.OPS.MUL ? 'mul' : 'add'] += e.value; break; }
    case T.TECH_RATE_BONUS: snap.techRateMul += e.value; break;
    default: break;
  }
}

// Build a node lookup from either an array of node defs or a map keyed by id.
function toLookup(nodeDefs) {
  if (Array.isArray(nodeDefs)) {
    const map = {};
    for (const n of nodeDefs) if (n && n.id != null) map[String(n.id)] = n;
    return map;
  }
  return nodeDefs && typeof nodeDefs === 'object' ? nodeDefs : {};
}

// Normalize the researched input: accepts an array of ids, or the `researched` map { [id]: {...} }.
function toResearchedIds(researched) {
  if (Array.isArray(researched)) return researched.map(String);
  if (researched && typeof researched === 'object') return Object.keys(researched);
  return [];
}

// resolve(researched, nodeDefs) -> effects snapshot. `researched` = id array or the researched map;
// `nodeDefs` = array of node defs or a map keyed by id. Deterministic; arrays sorted for stability.
function resolve(researched, nodeDefs) {
  const snap = emptySnapshot();
  const lookup = toLookup(nodeDefs);
  const ids = toResearchedIds(researched);
  for (const id of ids) {
    const node = lookup[String(id)];
    if (!node) continue;
    const { typed, resourceEntrances } = nodeEffects(node);
    for (const eff of typed) applyEffect(snap, eff);
    for (const r of resourceEntrances) pushUnique(snap.resourceEntrances, r);
  }
  snap.unlockedBuildings.sort();
  snap.unlockedUnits.sort();
  snap.abilities.sort();
  snap.resourceEntrances.sort();
  return snap;
}

// Thin compatibility helper: today's getUnlockedBuildings generalized to the resolver (doc-06 §4.1).
function getUnlockedBuildings(researched, nodeDefs) {
  return resolve(researched, nodeDefs).unlockedBuildings;
}

module.exports = { resolve, getUnlockedBuildings, emptySnapshot };
