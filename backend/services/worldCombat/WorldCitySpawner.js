// WorldCitySpawner — the ONE deterministic authority that lays out pre-placed NEUTRAL cities in the
// single shared canonical world (march-discovery refactor, task #53 S2; docs/design/10 §3.1).
//
// Shape copied from WorldCampSpawner.planCamps (deterministic ring-walk + per-tile roll gate), with
// two deliberate changes (docs/design/10 §2.1 "the one thing NOT to copy" + §6-R3):
//   1. ANCHOR: camps key off the PLAYER capital (which spawns off world-origin, on a ring). A SHARED
//      city layout must key off a FIXED WORLD anchor (e.g. worldMap.origin) so every player sees the
//      SAME cities. planCities takes worldAnchor as a param — never a player capital.
//   2. OUTPUT: camps emit worldCombat encounters stored per-player. Cities emit MINIMAL RAW TERRITORY
//      objects destined for the shared store (S3 wires storage; S4 wires vision discovery). This slice
//      is PURE + additive — no live wiring.
//
// SINGLE-SOURCE invariants this module holds (docs/design/10 §4):
//   §4-1 One placement authority — this is it; no second city generator.
//   §4-4 Attackability is DERIVED, never authored — planCities authors ONLY position + owner + type
//        + status + scale + names. It MUST NOT author garrison/defenderLeader/capitalDistance/
//        battleTarget: normalizeTerritory (TerritoryStateNormalizer) re-derives all four on every
//        load, so hand-authored values would silently drift. A test asserts the raw city has NO
//        garrison field.
//   §4-5 Idempotent seeding — planCitiesForState is an ensure*-style, id-keyed, never-re-push helper
//        mirroring seedCampEncounters' hasAny short-circuit (pure here: it returns the merged array,
//        no live wiring). Distance banding guarantees every placed city is >safeRadius from the anchor,
//        i.e. in a DEFENDED garrison band (garrison.json) — an attackable conquest target, not a
//        frictionless settlement.

const WorldMapService = require('../WorldMapService');
const { roll01 } = require('../worldMap/WorldMapGenerationAuthority');
const { isMarchBlockedTerrain } = require('../../../shared/worldMarchCore');
const { toInteger } = require('../../../shared/numberUtils');
const WorldCityConfig = require('../../config/WorldCityConfig');

const CITY_PLACEMENT_SALT = 'city-place';
const CITY_NAME_SALT = 'city-name';

function chebyshev(dq, dr) {
  return Math.max(Math.abs(dq), Math.abs(dr));
}

function cityId(q, r) {
  return `site_${toInteger(q, 0)}_${toInteger(r, 0)}`;
}

// Deterministic ring walk: for each ring band (near→far) walk the tiles of that ring in a fixed
// (dr outer, dq inner) order, so the candidate order — and therefore which cities win the
// minSpacing/maxCities races — is identical for the same seed + anchor. The ordered walk is what turns
// per-tile random rolls into a stable global layout. (Same shape as WorldCampSpawner.iterateRingCoords.)
function iterateRingCoords(anchor, minRing, maxRing) {
  const coords = [];
  for (let ring = minRing; ring <= maxRing; ring += 1) {
    for (let dr = -ring; dr <= ring; dr += 1) {
      for (let dq = -ring; dq <= ring; dq += 1) {
        if (chebyshev(dq, dr) !== ring) continue; // ring perimeter only
        coords.push({ q: anchor.q + dq, r: anchor.r + dr, ring });
      }
    }
  }
  return coords;
}

function resolveOptions(opts = {}) {
  const placement = WorldCityConfig.PLACEMENT;
  const clampInt = (value, fallback) =>
    Number.isFinite(Number(value)) ? Math.floor(Number(value)) : fallback;
  const clampNum = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
  return {
    safeRadiusFromAnchor: clampInt(opts.safeRadiusFromAnchor, placement.safeRadiusFromAnchor),
    minRingFromAnchor: clampInt(opts.minRingFromAnchor, placement.minRingFromAnchor),
    maxRingFromAnchor: clampInt(opts.maxRingFromAnchor, placement.maxRingFromAnchor),
    densityRoll: clampNum(opts.densityRoll, placement.densityRoll),
    maxCities: clampInt(opts.maxCities, placement.maxCities),
    minSpacing: clampInt(opts.minSpacing, placement.minSpacing),
    // Optional terrain probe injection for tests; defaults to the live world seed rules.
    chooseTerrain:
      typeof opts.chooseTerrain === 'function'
        ? opts.chooseTerrain
        : (seed, q, r) => WorldMapService.chooseTerrain(seed, q, r),
    // Optional extra occupied tileIds (existing sites/spawns/AI capitals) to avoid.
    occupiedTileIds: opts.occupiedTileIds instanceof Set ? opts.occupiedTileIds : new Set(),
  };
}

function normalizeAnchor(worldAnchor = {}) {
  return {
    q: toInteger(worldAnchor.q ?? worldAnchor.x, 0),
    r: toInteger(worldAnchor.r ?? worldAnchor.y, 0),
  };
}

// Deterministic natural-name pick for a city tile — same seed+coord always names it the same, so the
// shared world is stable. Uses a distinct salt from placement so name choice does not perturb the
// placement rolls.
function pickNaturalName(seed, q, r, archetype) {
  const pool = Array.isArray(archetype.naturalNames) ? archetype.naturalNames : [];
  if (!pool.length) return '未知地点';
  const roll = roll01(seed, q, r, CITY_NAME_SALT);
  const index = Math.min(pool.length - 1, Math.floor(roll * pool.length));
  return pool[index];
}

// Pure: returns the deterministic RAW-territory spec array for this worldSeed + worldAnchor. No
// gameState. Each entry is a minimal raw territory (docs/design/10 §2.2/§3.1) — position + owner +
// type + status + scale + names ONLY. NO garrison/defenderLeader/capitalDistance/battleTarget:
// normalizeTerritory re-derives those downstream (§4-4).
function planCities(worldSeed, worldAnchor = {}, opts = {}) {
  const anchor = normalizeAnchor(worldAnchor);
  const options = resolveOptions(opts);
  const safeRadius = Math.max(0, options.safeRadiusFromAnchor);
  // A city inside the safe band would be an undefended settlement, not a conquest target — so the
  // first eligible ring is safeRadius + 1 regardless of a mis-tuned minRing.
  const minRing = Math.max(safeRadius + 1, options.minRingFromAnchor);
  const maxRing = Math.max(minRing, options.maxRingFromAnchor);
  const placed = [];

  for (const coord of iterateRingCoords(anchor, minRing, maxRing)) {
    if (placed.length >= options.maxCities) break;
    const { q, r, ring } = coord;
    // Inside the safe ring: never a city (would be an undefended settlement, garrison.json `safe`).
    if (ring <= safeRadius) continue;
    // Density gate — deterministic per-tile roll.
    if (roll01(worldSeed, q, r, CITY_PLACEMENT_SALT) >= options.densityRoll) continue;
    // Avoid water (a city cannot sit on a tile a land unit cannot march onto).
    const terrain = options.chooseTerrain(worldSeed, q, r) || 'plains';
    if (isMarchBlockedTerrain(terrain)) continue;
    const tileId = WorldMapService.getTileId(q, r);
    // Avoid any pre-occupied tile (existing sites, player spawns, AI capitals — §6-R3).
    if (options.occupiedTileIds.has(tileId)) continue;
    // Minimum Chebyshev spacing from every already-placed city.
    const tooClose = placed.some((city) => chebyshev(city.q - q, city.r - r) < options.minSpacing);
    if (tooClose) continue;

    const archetype = WorldCityConfig.getArchetypeForRing(ring);
    // Minimal RAW territory. Field names match what TerritoryStateNormalizer.normalizeTerritory reads
    // (id/x/y/owner/type/status/naturalName/scale/mapTerrain). Deliberately NO garrison authoring.
    placed.push({
      id: cityId(q, r),
      // q/r/ring/tileId/archetypeKey are placement metadata (not consumed by normalizeTerritory, which
      // reads x/y); kept for the seeder + tests + downstream shared-store storage (S3).
      q,
      r,
      ring,
      tileId,
      archetypeKey: archetype.key,
      x: q,
      y: r,
      owner: 'neutral',
      type: archetype.type,
      status: 'discovered',
      scale: archetype.scale,
      naturalName: pickNaturalName(worldSeed, q, r, archetype),
      nameKey: archetype.nameKey,
      mapTerrain: terrain,
    });
  }
  return placed;
}

// Strip placement metadata → the exact raw-territory shape to push into gameState.territories /
// the shared store. What normalizeTerritory consumes, nothing more.
function toRawTerritory(spec) {
  return {
    id: spec.id,
    x: spec.x,
    y: spec.y,
    owner: spec.owner,
    type: spec.type,
    status: spec.status,
    scale: spec.scale,
    naturalName: spec.naturalName,
    mapTerrain: spec.mapTerrain,
  };
}

function hasAnyPlannedCity(territories = []) {
  return (Array.isArray(territories) ? territories : []).some(
    (territory) => territory && typeof territory.id === 'string' && territory.id.startsWith('site_'),
  );
}

// Idempotent, deterministic, ONE-TIME lay-down (PURE — returns the merged raw-territory array; no
// gameState mutation, no live wiring; S3 wires it into the shared store). Folds the planned cities into
// an existing territory list WITHOUT overwriting any city already present (id-keyed, never re-push),
// mirroring seedCampEncounters' hasAny short-circuit (docs/design/10 §4-5). Safe to call on every
// normalize (init/load/tick) — the count stays stable.
function planCitiesForState(worldSeed, worldAnchor, existingTerritories = [], opts = {}) {
  const territories = Array.isArray(existingTerritories) ? [...existingTerritories] : [];
  // Already laid down: keep the existing cities exactly as they are.
  if (hasAnyPlannedCity(territories)) return territories;
  const specs = planCities(worldSeed, worldAnchor, opts);
  const existingIds = new Set(territories.map((territory) => territory && territory.id));
  specs.forEach((spec) => {
    if (existingIds.has(spec.id)) return; // never overwrite an existing entry.
    territories.push(toRawTerritory(spec));
    existingIds.add(spec.id);
  });
  return territories;
}

module.exports = {
  CITY_PLACEMENT_SALT,
  CITY_NAME_SALT,
  cityId,
  planCities,
  planCitiesForState,
  toRawTerritory,
  hasAnyPlannedCity,
};
