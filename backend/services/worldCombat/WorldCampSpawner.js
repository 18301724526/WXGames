// Deterministic generator for the shared "wild camp" world-combat content layer.
// Production persistence lives in WorldEncounterRepository: it calls the pure
// planCamps/campSpecToEncounter pair once per shared world and stores the result in the
// world_encounters table. This module does not write player save state.
//
// Determinism contract: planCamps is a pure function of (seed, anchorCoord, opts).
// The world seed and anchor never change mid-game, so the same inputs always produce
// the same camps (ids, coords, garrisons). Repository seeding relies on that
// idempotency.
//
// Nothing here mutates battle progress; camp encounters are ordinary shared encounters
// carrying three extra passthrough fields (campArchetypeKey / lootTable /
// respawnCooldownMs).

const WorldMapService = require('../WorldMapService');
const { roll01 } = require('../worldMap/WorldMapGenerationAuthority');
const { isMarchBlockedTerrain } = require('../../../shared/worldMarchCore');
const { toInteger } = require('../../../shared/numberUtils');
const WorldCampConfig = require('../../config/WorldCampConfig');

const CAMP_PLACEMENT_SALT = 'camp-place';

function chebyshev(dq, dr) {
  return Math.max(Math.abs(dq), Math.abs(dr));
}

function campId(q, r) {
  return `camp_${toInteger(q, 0)}_${toInteger(r, 0)}`;
}

// Deterministic ring walk: for each ring band (near→far) walk the tiles of that ring in
// a fixed (dr outer, dq inner) order, so the candidate order — and therefore which camps
// win the minSpacing/maxCamps races — is identical for the same seed. The ordered walk
// is what turns per-tile random rolls into a stable global layout.
function iterateRingCoords(capital, minRing, maxRing) {
  const coords = [];
  for (let ring = minRing; ring <= maxRing; ring += 1) {
    for (let dr = -ring; dr <= ring; dr += 1) {
      for (let dq = -ring; dq <= ring; dq += 1) {
        if (chebyshev(dq, dr) !== ring) continue; // ring perimeter only
        coords.push({ q: capital.q + dq, r: capital.r + dr, ring });
      }
    }
  }
  return coords;
}

function resolveOptions(opts = {}) {
  const placement = WorldCampConfig.PLACEMENT;
  const clampInt = (value, fallback) =>
    Number.isFinite(Number(value)) ? Math.floor(Number(value)) : fallback;
  const clampNum = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
  return {
    safeRadiusFromCapital: clampInt(opts.safeRadiusFromCapital, placement.safeRadiusFromCapital),
    minRingFromCapital: clampInt(opts.minRingFromCapital, placement.minRingFromCapital),
    maxRingFromCapital: clampInt(opts.maxRingFromCapital, placement.maxRingFromCapital),
    densityRoll: clampNum(opts.densityRoll, placement.densityRoll),
    maxCamps: clampInt(opts.maxCamps, placement.maxCamps),
    minSpacing: clampInt(opts.minSpacing, placement.minSpacing),
    // Optional terrain probe injection for tests; defaults to the live world seed rules.
    chooseTerrain:
      typeof opts.chooseTerrain === 'function'
        ? opts.chooseTerrain
        : (seed, q, r) => WorldMapService.chooseTerrain(seed, q, r),
    // Optional extra occupied tileIds (existing sites/encounters) to avoid.
    occupiedTileIds: opts.occupiedTileIds instanceof Set ? opts.occupiedTileIds : new Set(),
  };
}

// Pure: returns the deterministic camp spec array for this seed + capital. No gameState.
function planCamps(seed, capitalCoord = {}, opts = {}) {
  const capital = {
    q: toInteger(capitalCoord.q ?? capitalCoord.x, 0),
    r: toInteger(capitalCoord.r ?? capitalCoord.y, 0),
  };
  const options = resolveOptions(opts);
  const minRing = Math.max(1, options.minRingFromCapital);
  const maxRing = Math.max(minRing, options.maxRingFromCapital);
  const placed = [];

  for (const coord of iterateRingCoords(capital, minRing, maxRing)) {
    if (placed.length >= options.maxCamps) break;
    const { q, r, ring } = coord;
    // Inside the safe ring: never a camp (reuses the spawn safe-ring concept).
    if (ring <= options.safeRadiusFromCapital) continue;
    // Density gate — deterministic per-tile roll.
    if (roll01(seed, q, r, CAMP_PLACEMENT_SALT) >= options.densityRoll) continue;
    // Avoid water (camps cannot sit on a tile a land unit cannot march onto).
    const terrain = options.chooseTerrain(seed, q, r) || 'plains';
    if (isMarchBlockedTerrain(terrain)) continue;
    const tileId = WorldMapService.getTileId(q, r);
    // Avoid the capital tile and any pre-occupied tile (existing sites/encounters).
    if (options.occupiedTileIds.has(tileId)) continue;
    // Minimum Chebyshev spacing from every already-placed camp.
    const tooClose = placed.some((camp) => chebyshev(camp.q - q, camp.r - r) < options.minSpacing);
    if (tooClose) continue;

    const archetype = WorldCampConfig.getArchetypeForRing(ring);
    const soldiers = archetype.soldiersBase + archetype.soldiersPerRing * ring;
    placed.push({
      id: campId(q, r),
      q,
      r,
      tileId,
      ring,
      archetypeKey: archetype.key,
      nameKey: archetype.nameKey,
      soldiers,
      quality: archetype.quality,
      threat: archetype.threatTier,
      lootTable: { ...archetype.lootTable },
      respawnCooldownMs: archetype.respawnCooldownMs,
      terrain,
    });
  }
  return placed;
}

// Convert a camp spec into the WorldCombatEncounterService encounter contract, plus the
// three camp passthrough fields. Kept minimal — normalizeEncounter fills defaults and
// builds the defender leader, so this only needs the identifying + tuning fields.
function campSpecToEncounter(spec, now = new Date()) {
  const createdAt = now.toISOString();
  return {
    id: spec.id,
    kind: 'hostileForce',
    status: 'active',
    nameKey: spec.nameKey,
    q: spec.q,
    r: spec.r,
    tileId: spec.tileId,
    terrain: spec.terrain,
    unitKey: `hostile_camp_${spec.archetypeKey}`,
    createdAt,
    updatedAt: createdAt,
    campArchetypeKey: spec.archetypeKey,
    lootTable: { ...spec.lootTable },
    respawnCooldownMs: spec.respawnCooldownMs,
    respawnAt: null,
    defender: {
      id: `${spec.id}_defender`,
      owner: 'hostile',
      soldiers: spec.soldiers,
      // Original garrison, retained so a cooldown respawn restores the exact starting
      // strength without needing to re-derive the ring from the capital coord.
      baseSoldiers: spec.soldiers,
      quality: spec.quality,
      threat: spec.threat,
      scale: 1,
      leader: null,
    },
    battleReport: null,
    resolvedAt: null,
    resolvedByMissionId: null,
  };
}

module.exports = {
  CAMP_PLACEMENT_SALT,
  campId,
  planCamps,
  campSpecToEncounter,
};
