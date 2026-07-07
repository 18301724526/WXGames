// WorldExplorerTutorialCity — the ONE deterministic authority that PRE-PLACES the tutorial's first
// empty city (march-discovery refactor, task #53 S5; docs/design/10 §3.3).
//
// The old invent-city engine (WorldExplorerRoutePlanner.createTutorialPlannedSites &co) is DELETED: it
// invented a city ALONG whatever route the player happened to pick, truncated the march to it, and
// wrote the tutorial grant only at materialization time. This module replaces that with a
// PRE-PLACEMENT: a single deterministic neutral city near the player's explore origin, chosen at
// grant time (TutorialGrantService.grantScoutFamousPerson) and carried inside the tutorial grant
// (tutorial.grants.firstExploreEmptyCity). The city is discovered by MARCH VISION (the S4 generic pass,
// WorldExplorerProgression.discoverPrePlacedCitiesInVision), exactly like any other pre-placed city —
// no invention, no route truncation.
//
// SINGLE-SOURCE invariants (docs/design/10 §4):
//   §4-4 Attackability is DERIVED, never authored — this module authors ONLY position + owner + type +
//        status + scale + names. normalizeTerritory re-derives garrison/capitalDistance/battleTarget.
//   §4-6 The tutorial first-city grant is the ONE identity — the siteId set here is the single source
//        read by getTutorialFirstEmptyCityId / TerritoryAction.isTutorialFirstCity /
//        validateFirstCityGuideAction and the frontend getFirstExploreCityId mirrors.
//
// HIDDEN-until-discovered (§6-R2): the city is carried in the GRANT, not pushed into gameState.territories
// at grant time — so it is absent from the client map (which only projects gameState.territories +
// visibility-gated shared cities) until the march vision discovers it and the S4 pass binds its tile.

const WorldMapService = require('../WorldMapService');
const { isMarchBlockedTerrain } = require('../../../shared/worldMarchCore');
const { getExploreOrigin } = require('./WorldExplorerRoutePlanner');
const { TUTORIAL_FIRST_SITE_GRANT_KEY, toInteger } = require('./WorldExplorerShared');

// The tutorial city sits just OUTSIDE the safe band (so the march must actually reach it, and so the
// garrison bands make it an attackable — for the tutorial, safe/undefended — target) but close enough to
// the explore origin that the first guided march reaches it quickly. A fixed small ring keeps it near.
const TUTORIAL_CITY_MIN_RING = 1;
const TUTORIAL_CITY_MAX_RING = 4;

// Deterministic candidate order around the origin: prefer the +q axis first (a plains-forward first
// march), then the four axes, then the diagonals, expanding ring by ring. The first LAND tile wins.
// Same origin + same seed always names the same tile, so the tutorial layout is stable across reloads.
function candidateOffsets() {
  const offsets = [];
  for (let ring = TUTORIAL_CITY_MIN_RING; ring <= TUTORIAL_CITY_MAX_RING; ring += 1) {
    // Axis-forward candidates first (reachable by a straight axis-aligned march — no corner cutting).
    offsets.push({ dq: ring, dr: 0 });
    offsets.push({ dq: -ring, dr: 0 });
    offsets.push({ dq: 0, dr: ring });
    offsets.push({ dq: 0, dr: -ring });
    // Then the ring perimeter (diagonals + off-axis) in a fixed scan order.
    for (let dr = -ring; dr <= ring; dr += 1) {
      for (let dq = -ring; dq <= ring; dq += 1) {
        if (Math.max(Math.abs(dq), Math.abs(dr)) !== ring) continue;
        if (dr === 0 || dq === 0) continue; // axis candidates already pushed
        offsets.push({ dq, dr });
      }
    }
  }
  return offsets;
}

function isLandTile(seed, q, r) {
  const terrain = WorldMapService.chooseTerrain(seed, q, r) || 'plains';
  // Water and shore are unreachable / un-buildable for the tutorial city; keep it on solid land.
  if (isMarchBlockedTerrain(terrain)) return false;
  if (terrain === 'shore') return false;
  return true;
}

// Pure: choose the deterministic tile for the tutorial first city near the given origin. Returns
// { q, r, mapTerrain } for the first LAND tile in the deterministic candidate order, or null if the
// origin's neighbourhood is somehow all water (the caller then skips the grant, exactly as the old
// invent engine returned no plannedSites).
function chooseTutorialCityTile(seed, origin = {}) {
  const originQ = toInteger(origin.q ?? origin.x, 0);
  const originR = toInteger(origin.r ?? origin.y, 0);
  for (const { dq, dr } of candidateOffsets()) {
    const q = originQ + dq;
    const r = originR + dr;
    if (q === originQ && r === originR) continue;
    if (!isLandTile(seed, q, r)) continue;
    return { q, r, mapTerrain: WorldMapService.chooseTerrain(seed, q, r) || 'plains' };
  }
  return null;
}

// Build the minimal raw neutral-city territory for the tutorial first city (§4-4 — position + owner +
// type + status + scale + names ONLY; no garrison authoring). Mirrors the S4 pre-placed-city shape so
// the SAME discovery pass (discoverPrePlacedCitiesInVision) can flip it to on-map + garrisoned.
function buildTutorialCitySpec(tile = {}) {
  const q = toInteger(tile.q, 0);
  const r = toInteger(tile.r, 0);
  return {
    id: `site_${q}_${r}`,
    x: q,
    y: r,
    owner: 'neutral',
    type: 'town',
    status: 'discovered',
    scale: 2,
    naturalName: '无名空城', // 无名空城 — renamed by the player on occupation.
    mapTerrain: tile.mapTerrain || 'plains',
  };
}

// Compute the tutorial first-city grant record for a gameState whose explore origin is known. Returns
// null when no land tile is reachable (grant is then skipped). The grant carries the full city spec so
// the city stays HIDDEN (not in territories) until march vision discovers it.
function planTutorialFirstCityGrant(gameState = {}, now = new Date()) {
  const worldMap = WorldMapService.ensureWorldMap(gameState, now);
  const origin = getExploreOrigin(gameState);
  const tile = chooseTutorialCityTile(worldMap.seed, origin);
  if (!tile) return null;
  const city = buildTutorialCitySpec(tile);
  return {
    key: TUTORIAL_FIRST_SITE_GRANT_KEY,
    grant: {
      siteId: city.id,
      x: city.x,
      y: city.y,
      city,
      plannedAt: now.toISOString(),
    },
  };
}

module.exports = {
  TUTORIAL_CITY_MIN_RING,
  TUTORIAL_CITY_MAX_RING,
  chooseTutorialCityTile,
  buildTutorialCitySpec,
  planTutorialFirstCityGrant,
};
