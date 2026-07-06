// Single source for the pre-placed neutral-city world layer (march-discovery refactor, task #53 S2).
//
// A pure constant module — NOT registered with the config pipeline (mirrors WorldCampConfig: it
// carries no runtime state and no gameState reads). WorldCitySpawner consumes these tables to
// deterministically lay out neutral cities in the ONE shared canonical world so every player sees
// the SAME cities. Unlike camps (which key off the player capital and store per-player), cities key
// off a fixed WORLD anchor and belong to the shared store — see docs/design/10 §3.1/§4/§6-R3.
//
// Design intent (docs/design/10-march-discovery-refactor.md §3.1):
//   - Distance-banded placement: cities sit at Chebyshev distance > safeRadius from the WORLD anchor
//     so normalizeTerritory's garrison band (garrison.json: safe ≤3 undefended, near/frontier/deep
//     defended) makes them ATTACKABLE conquest targets, not frictionless settlements. Anything inside
//     the safe band would be an undefended settlement, so placement never emits below minRing.
//   - The city archetype (scale + site type) is chosen by ring band, so difficulty/reward scale with
//     distance is a pure function of placement, not extra per-tile config — same shape as camps.
//   - Attackability is DERIVED, never authored: this module (and WorldCitySpawner) only pick
//     position + owner + type + status + scale + names. normalizeTerritory re-derives
//     capitalDistance/garrison/defenderLeader/battleTarget every load (docs/design/10 §4-4).
//   - Removal is a rollback: nothing here mutates state; if WorldCitySpawner is never called this
//     module is inert.
//
// Bands below are aligned to the garrison config table (config/generated/garrison.json) so the ring a
// city lands in resolves to the intended defended band. They are the CITY LAYOUT knobs (how many /
// how far / how spaced), NOT the garrison strength (that is garrison.json, read downstream). Keeping
// them here keeps the planner free of magic numbers (docs/design/10 §4-1).

// City archetypes, ordered nearest → farthest. getArchetypeForRing() selects by ring band, so the
// ring→archetype mapping stays here (single source) rather than being re-derived by callers. `type`
// MUST be a key in TerritoryConstants.SITE_ART (capital/city/outpost/town/camp/ruins) — validated by
// tests — because normalizeTerritory falls back to 'outpost' for any unknown type and SITE_ART drives
// the site art. `scale` feeds the garrison soldier count (garrison.json soldiersPerScale) downstream.
const CITY_ARCHETYPES = Object.freeze([
  Object.freeze({
    key: 'frontier_town',
    // A modest town just past the safe band — the first attackable neutral city a marching army meets.
    // Lands in the garrison `near` band (4-8): lightly defended, high capture chance.
    type: 'town',
    scale: 1,
    nameKey: 'world.city.frontier_town',
    naturalNames: Object.freeze(['河湾村镇', '石阶小城', '谷口集落', '渡口镇']),
  }),
  Object.freeze({
    key: 'city_state',
    // A walled city-state deeper out — garrison `frontier` band (9-16): a real garrison to beat.
    type: 'city',
    scale: 2,
    nameKey: 'world.city.city_state',
    naturalNames: Object.freeze(['河湾城邦', '高墙城邑', '石桥城邦', '山口自治城']),
  }),
  Object.freeze({
    key: 'deep_stronghold',
    // Far-flung stronghold — garrison `deep` band (17+): heaviest garrison, best reward.
    type: 'city',
    scale: 3,
    nameKey: 'world.city.deep_stronghold',
    naturalNames: Object.freeze(['边陲雄城', '远疆坚城', '孤悬要塞', '绝域城邦']),
  }),
]);

// Placement parameters. All distances are Chebyshev rings measured from the WORLD anchor coordinate
// (docs/design/10 §6-R3 — NOT any one player's capital, so the shared layout is identical for all
// players). safeRadiusFromAnchor mirrors the garrison `safe` band (maxDistance 3): cities never sit in
// or below it, guaranteeing every placed city is a defended (attackable) band per garrison.json.
const PLACEMENT = Object.freeze({
  // The garrison `safe` band is maxDistance 3 (undefended). A city inside it would be a frictionless
  // settlement, not a conquest target — so the first ring a city may occupy is safeRadius + 1 = 4,
  // which is the first ring of the garrison `near` band.
  safeRadiusFromAnchor: 3,
  minRingFromAnchor: 4,
  maxRingFromAnchor: 20,
  // Per-tile spawn threshold: roll01(...) < densityRoll ⇒ candidate. Kept low so cities stay sparse
  // (a scattering of neutral targets across the map, not a dense grid).
  densityRoll: 0.1,
  // Hard cap on placed cities regardless of how many candidates the rings produce.
  maxCities: 12,
  // Minimum Chebyshev spacing between any two cities, so they do not clump on one tile cluster.
  minSpacing: 3,
});

// Ring → archetype band. Bands are inclusive lower bounds walked farthest-first so a far ring resolves
// to the strongest archetype whose band it reaches. The band cutoffs mirror garrison.json's near
// (≤8) / frontier (≤16) / deep (17+) so the site scale matches the defended band it will resolve to.
// Rings below the first band fall back to the nearest archetype (defensive; placement never emits a
// ring below minRingFromAnchor).
const RING_ARCHETYPE_BANDS = Object.freeze([
  Object.freeze({ minRing: 17, key: 'deep_stronghold' }),
  Object.freeze({ minRing: 9, key: 'city_state' }),
  Object.freeze({ minRing: 0, key: 'frontier_town' }),
]);

function getArchetypeByKey(key) {
  return CITY_ARCHETYPES.find((archetype) => archetype.key === key) || CITY_ARCHETYPES[0];
}

function getArchetypeForRing(ring) {
  const safeRing = Number.isFinite(Number(ring)) ? Math.floor(Number(ring)) : 0;
  const band =
    RING_ARCHETYPE_BANDS.find((entry) => safeRing >= entry.minRing) ||
    RING_ARCHETYPE_BANDS[RING_ARCHETYPE_BANDS.length - 1];
  return getArchetypeByKey(band.key);
}

module.exports = {
  CITY_ARCHETYPES,
  PLACEMENT,
  RING_ARCHETYPE_BANDS,
  getArchetypeByKey,
  getArchetypeForRing,
};
