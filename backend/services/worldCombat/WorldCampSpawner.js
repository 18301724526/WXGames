// Deterministic generator for the shared "wild camp" world-combat content layer.
// Production persistence lives in WorldEncounterRepository: it calls the pure
// planCampsForActivitySources/campSpecToEncounter pair and stores the result in the
// world_encounters table. This module does not write player save state.
//
// Determinism contract: planning is a pure function of (seed, activity sources, opts).
// Activity sources snap to stable shared regions, so nearby players converge on the same
// camp rows instead of receiving private copies.
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

// Deterministic ring walk: for each ring band (near to far) walk the tiles of that ring in
// a fixed (dr outer, dq inner) order, so the candidate order — and therefore which camps
// win the spacing/band-budget races — is identical for the same seed. The ordered walk
// is what turns per-tile random rolls into a stable global layout.
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

function getBandCandidates(seed, activityRegion, band) {
  return iterateRingCoords(activityRegion, band.minRing, band.maxRing)
    .map((coord) => ({
      ...coord,
      roll: roll01(seed, coord.q, coord.r, CAMP_PLACEMENT_SALT),
    }))
    .sort((a, b) => a.ring - b.ring || a.roll - b.roll || a.q - b.q || a.r - b.r);
}

function toPositiveInteger(value, fallback = 1) {
  const number = toInteger(value, fallback);
  return number > 0 ? number : fallback;
}

function normalizeRingBand(rawBand = {}) {
  const minRing = Math.max(1, toInteger(rawBand.minRing, 1));
  const maxRing = Math.max(minRing, toInteger(rawBand.maxRing, minRing));
  const targetCamps = Math.max(0, toInteger(rawBand.targetCamps, 0));
  return { minRing, maxRing, targetCamps };
}

function resolveRingBands(opts = {}) {
  const sourceBands = Array.isArray(opts.ringBands)
    ? opts.ringBands
    : WorldCampConfig.PLACEMENT.ringBands;
  return (Array.isArray(sourceBands) ? sourceBands : [])
    .map(normalizeRingBand)
    .filter((band) => band.targetCamps > 0)
    .sort((a, b) => a.minRing - b.minRing || a.maxRing - b.maxRing);
}

function normalizeExistingCamps(existingCamps = []) {
  return (Array.isArray(existingCamps) ? existingCamps : [])
    .map((camp) => {
      const q = Number(camp?.q ?? camp?.x);
      const r = Number(camp?.r ?? camp?.y);
      if (!Number.isFinite(q) || !Number.isFinite(r)) return null;
      return {
        ...camp,
        q: Math.floor(q),
        r: Math.floor(r),
        tileId: camp.tileId || WorldMapService.getTileId(q, r),
      };
    })
    .filter(Boolean);
}

function resolveOptions(opts = {}) {
  const placement = WorldCampConfig.PLACEMENT;
  const clampInt = (value, fallback) =>
    Number.isFinite(Number(value)) ? Math.floor(Number(value)) : fallback;
  return {
    activityRegionSize: toPositiveInteger(opts.activityRegionSize, placement.activityRegionSize),
    safeRadiusFromActivity: clampInt(opts.safeRadiusFromActivity, placement.safeRadiusFromActivity),
    minSpacing: clampInt(opts.minSpacing, placement.minSpacing),
    ringBands: resolveRingBands(opts),
    // Optional terrain probe injection for tests; defaults to the live world seed rules.
    chooseTerrain:
      typeof opts.chooseTerrain === 'function'
        ? opts.chooseTerrain
        : (seed, q, r) => WorldMapService.chooseTerrain(seed, q, r),
    // Optional extra occupied tileIds (existing sites/encounters) to avoid.
    occupiedTileIds: opts.occupiedTileIds instanceof Set ? opts.occupiedTileIds : new Set(),
    existingCamps: normalizeExistingCamps(opts.existingCamps),
  };
}

function getActivityRegion(coord = {}, options = {}) {
  const regionSize = toPositiveInteger(options.activityRegionSize, WorldCampConfig.PLACEMENT.activityRegionSize);
  const q = toInteger(coord.q ?? coord.x, 0);
  const r = toInteger(coord.r ?? coord.y, 0);
  const regionQ = Math.round(q / regionSize);
  const regionR = Math.round(r / regionSize);
  return {
    id: `activity_${regionQ}_${regionR}`,
    q: regionQ * regionSize,
    r: regionR * regionSize,
    regionQ,
    regionR,
    sourceCount: 1,
  };
}

function normalizeActivitySources(activitySources = [], options = {}) {
  const sourceList = Array.isArray(activitySources) ? activitySources : [activitySources];
  const byRegion = new Map();
  for (const source of sourceList) {
    const region = getActivityRegion(source, options);
    const current = byRegion.get(region.id);
    if (current) {
      current.sourceCount += 1;
      continue;
    }
    byRegion.set(region.id, region);
  }
  return [...byRegion.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function countExistingInBand(activityRegion, band, existingCamps = []) {
  return existingCamps.filter((camp) => {
    const ring = chebyshev(camp.q - activityRegion.q, camp.r - activityRegion.r);
    return ring >= band.minRing && ring <= band.maxRing;
  }).length;
}

function canPlaceCamp(seed, coord, state, options) {
  const tileId = WorldMapService.getTileId(coord.q, coord.r);
  if (state.occupiedTileIds.has(tileId)) return false;
  const terrain = options.chooseTerrain(seed, coord.q, coord.r) || 'plains';
  if (isMarchBlockedTerrain(terrain)) return false;
  const tooClose = state.spacingCoords.some((camp) => chebyshev(camp.q - coord.q, camp.r - coord.r) < options.minSpacing);
  if (tooClose) return false;
  return { tileId, terrain };
}

function createCampSpec(activityRegion, coord, placement) {
  const archetype = WorldCampConfig.getArchetypeForRing(coord.ring);
  const soldiers = archetype.soldiersBase + archetype.soldiersPerRing * coord.ring;
  return {
    id: campId(coord.q, coord.r),
    q: coord.q,
    r: coord.r,
    tileId: placement.tileId,
    ring: coord.ring,
    archetypeKey: archetype.key,
    nameKey: archetype.nameKey,
    soldiers,
    quality: archetype.quality,
    threat: archetype.threatTier,
    lootTable: { ...archetype.lootTable },
    respawnCooldownMs: archetype.respawnCooldownMs,
    terrain: placement.terrain,
    activityRegionId: activityRegion.id,
    activityAnchor: { q: activityRegion.q, r: activityRegion.r },
    spawnSource: 'activity-region',
  };
}

function placeBandCamps(seed, activityRegion, band, state, options) {
  const existingCount = countExistingInBand(activityRegion, band, options.existingCamps);
  const targetCount = Math.max(0, band.targetCamps - existingCount);
  const placed = [];
  for (const coord of getBandCandidates(seed, activityRegion, band)) {
    if (placed.length >= targetCount) break;
    if (coord.ring <= options.safeRadiusFromActivity) continue;
    const placement = canPlaceCamp(seed, coord, state, options);
    if (!placement) continue;
    const spec = createCampSpec(activityRegion, coord, placement);
    placed.push(spec);
    state.occupiedTileIds.add(spec.tileId);
    state.spacingCoords.push(spec);
  }
  return placed;
}

// Pure: returns deterministic shared camp specs for stable activity regions. No gameState.
function planCampsForActivitySources(seed, activitySources = [], opts = {}) {
  const options = resolveOptions(opts);
  const activityRegions = normalizeActivitySources(activitySources, options);
  const state = {
    occupiedTileIds: new Set(options.occupiedTileIds),
    spacingCoords: [...options.existingCamps],
  };
  for (const camp of options.existingCamps) {
    state.occupiedTileIds.add(camp.tileId);
  }
  const placed = [];
  for (const activityRegion of activityRegions) {
    for (const band of options.ringBands) {
      placed.push(...placeBandCamps(seed, activityRegion, band, state, options));
    }
  }
  return placed;
}

// Compatibility wrapper for older call sites/tests that ask for camps around one anchor.
function planCamps(seed, anchorCoord = {}, opts = {}) {
  return planCampsForActivitySources(seed, [anchorCoord], { activityRegionSize: 1, ...opts });
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
    activityRegionId: spec.activityRegionId || null,
    activityAnchor: spec.activityAnchor || null,
    spawnSource: spec.spawnSource || 'activity-region',
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
  chebyshev,
  getActivityRegion,
  normalizeActivitySources,
  planCamps,
  planCampsForActivitySources,
  campSpecToEncounter,
};
