// Deterministic, idempotent generator for the "wild camp" world-combat content layer
// (P0 slice 1a). Pure planning (planCamps) + a single side-effecting seeder
// (seedCampEncounters) that folds the plan into gameState.worldCombat.encounters.
//
// Determinism contract: planCamps is a pure function of (seed, capitalCoord, opts). The
// world seed and capital never change mid-game, so the SAME seed always produces the
// SAME camps (same ids, coords, garrisons) — that is what makes seedCampEncounters safe
// to call on every normalize without duplicating or drifting.
//
// Rollback contract: if seedCampEncounters is never called, only the legacy single stub
// remains. Nothing here mutates battle state; camp encounters are ordinary encounters
// carrying three extra passthrough fields (campArchetypeKey / lootTable /
// respawnCooldownMs) that legacy readers ignore.

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

function collectOccupiedTileIds(gameState = {}, existingEncounters = []) {
  const occupied = new Set();
  const capital = getCapitalCoordSafe(gameState);
  occupied.add(WorldMapService.getTileId(capital.q, capital.r));
  (Array.isArray(gameState.territories) ? gameState.territories : []).forEach((territory) => {
    if (!territory || typeof territory !== 'object') return;
    const q = toInteger(territory.q ?? territory.x, null);
    const r = toInteger(territory.r ?? territory.y, null);
    if (q === null || r === null) return;
    occupied.add(WorldMapService.getTileId(q, r));
  });
  // Do NOT add existing camp/encounter tiles here: a camp keeps its own tile across
  // respawns, so treating it as "occupied" would (harmlessly) skip re-planning it, but
  // we rely on the id-merge below for idempotency instead. Non-camp encounters (the
  // legacy stub) still get their tile reserved so a camp never lands on top of it.
  existingEncounters.forEach((encounter) => {
    if (!encounter || encounter.kind !== 'hostileForce') return;
    if (String(encounter.campArchetypeKey || '')) return; // skip camps (id-merge owns them)
    const tileId = encounter.tileId || WorldMapService.getTileId(encounter.q, encounter.r);
    if (tileId) occupied.add(tileId);
  });
  return occupied;
}

function getCapitalCoordSafe(gameState = {}) {
  const capital =
    (Array.isArray(gameState.territories) ? gameState.territories : []).find(
      (territory) => territory?.id === 'capital',
    ) || {};
  const origin = gameState.worldMap?.origin || {};
  return {
    q: toInteger(capital.q ?? capital.x ?? origin.q ?? origin.x, 0),
    r: toInteger(capital.r ?? capital.y ?? origin.r ?? origin.y, 0),
  };
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

function hasAnyCamp(encounters = []) {
  return encounters.some((encounter) => encounter && encounter.campArchetypeKey);
}

// Idempotent, deterministic, ONE-TIME lay-down. Folds the planned camps into
// gameState.worldCombat.encounters WITHOUT overwriting the live progress of any camp
// that already exists. Once ANY camp is present the seeding is considered done and no
// new camps are added — so re-normalizing (including via the read-only client
// projection) never grows the camp set, even if the world seed appears to change on a
// re-materialized worldMap. The initial lay-down happens the first time a state carries
// zero camps (the canonical normalize path). Returns the mutated encounter array.
function seedCampEncounters(gameState = {}, now = new Date()) {
  const worldCombat =
    gameState.worldCombat && typeof gameState.worldCombat === 'object'
      ? gameState.worldCombat
      : (gameState.worldCombat = {});
  const encounters = Array.isArray(worldCombat.encounters) ? worldCombat.encounters : [];
  worldCombat.encounters = encounters;
  // Already laid down: keep the existing camps exactly as they are (progress + coords).
  if (hasAnyCamp(encounters)) return encounters;
  const seed = gameState.worldMap?.seed;
  const capital = getCapitalCoordSafe(gameState);
  const occupiedTileIds = collectOccupiedTileIds(gameState, encounters);
  const specs = planCamps(seed, capital, { occupiedTileIds });
  const existingIds = new Set(encounters.map((encounter) => encounter && encounter.id));
  specs.forEach((spec) => {
    if (existingIds.has(spec.id)) return; // keep live progress — never overwrite.
    encounters.push(campSpecToEncounter(spec, now));
    existingIds.add(spec.id);
  });
  return encounters;
}

module.exports = {
  CAMP_PLACEMENT_SALT,
  campId,
  planCamps,
  seedCampEncounters,
  campSpecToEncounter,
  collectOccupiedTileIds,
  hasAnyCamp,
};
