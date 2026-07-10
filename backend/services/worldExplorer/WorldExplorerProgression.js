const WorldMapService = require('../WorldMapService');
const WorldMarchCore = require('../../../shared/worldMarchCore');
const {
  EXPLORE_REVEAL_RADIUS,
  TUTORIAL_FIRST_SITE_GRANT_KEY,
  toInteger,
} = require('./WorldExplorerShared');
const {
  normalizeMissions,
} = require('./WorldExplorerMissionNormalizer');
const { manualAdvance } = require('../tutorial/TutorialProgression');
const WorldExplorerTrace = require('./WorldExplorerTrace');
const { TutorialFlowConfig } = require('../config/GameplayConfigRuntime');
const SharedTutorialFlowConfig = require('../../../shared/tutorialFlowConfig');
const MilitaryService = require('../MilitaryService');
const FormationStrengthService = require('../military/FormationStrengthService');
const WorldMarchVerification = require('./WorldMarchVerification');
const WorldCombatEncounterService = require('../worldCombat/WorldCombatEncounterService');
const { materializeDiscoveredNeutralCity } = require('../worldCity/WorldCityPlayerDiscovery');

function getTutorialSteps() {
  return TutorialFlowConfig.TUTORIAL_STEPS;
}

function getTileIdentity(tile = {}) {
  if (!tile || typeof tile !== 'object') return '';
  const rawQ = tile.q ?? tile.x;
  const rawR = tile.r ?? tile.y;
  if (rawQ === undefined || rawR === undefined) return '';
  return WorldMapService.getTileId(toInteger(rawQ, 0), toInteger(rawR, 0));
}

function getTileIdentities(tiles = []) {
  return (Array.isArray(tiles) ? tiles : [])
    .map(getTileIdentity)
    .filter(Boolean);
}

function summarizeStep(step = {}) {
  if (!step || typeof step !== 'object') return null;
  const q = Number(step.q || 0);
  const r = Number(step.r || 0);
  return {
    q,
    r,
    tileId: WorldMapService.getTileId(q, r),
    step: Number(step.step || 0),
    revealed: Boolean(step.revealed),
    revealedAt: step.revealedAt || null,
  };
}

function summarizeMission(mission = {}) {
  const route = Array.isArray(mission.route) ? mission.route : [];
  const revealedTileIds = Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds : [];
  return {
    id: mission.id || '',
    mode: mission.mode || '',
    status: mission.status || '',
    routeCount: route.length,
    nextStep: summarizeStep(route.find((step) => !step.revealed)),
    revealedTileCount: revealedTileIds.length,
    revealedTileIds: revealedTileIds.slice(0, 8),
    startedAt: mission.startedAt || '',
    nextStepAt: mission.nextStepAt || '',
    completesAt: mission.completesAt || '',
  };
}

function getPlannedTileById(mission) {
  return new Map((mission.plannedTiles || []).map((tile) => [WorldMapService.getTileId(tile.q, tile.r), tile]));
}

function isAtHomeOrigin(mission = {}) {
  const position = mission.position || {};
  const home = mission.homeOrigin || mission.origin || {};
  return WorldMapService.getCanonicalTileId(position.q ?? position.x, position.r ?? position.y)
    === WorldMapService.getCanonicalTileId(home.q ?? home.x, home.r ?? home.y);
}

function settleReturnedFormationSnapshot(gameState = {}, mission = {}, now = new Date()) {
  if (!mission.formationSnapshot || FormationStrengthService.isSnapshotSettled(mission.formationSnapshot)) return false;
  if (mission.status !== 'idle' || !isAtHomeOrigin(mission)) return false;
  const settlement = MilitaryService.settleFormationSnapshot(gameState, mission.formationSnapshot, {
    cityId: mission.formation?.cityId,
    slot: mission.formation?.slot,
    now,
  });
  if (!settlement.success) return false;
  mission.formationSnapshot = settlement.snapshot;
  return true;
}

// A pre-placed shared-world city is DISCOVERABLE by vision iff it is neutral and not owned by any
// player (§4-3/§6-R-guard: discovery is separate from ownership). A player-occupied or AI-owned
// territory sitting on a revealed coord must NOT be re-bound as a fresh discovery — that is exactly
// the case the materialize-step occupy guard (:130-132) protects, and this predicate keeps the generic
// pass from ever touching an owned/occupied territory (owner !== 'neutral' or an ownerPlayerId is set).
function isDiscoverableNeutralCity(territory = {}) {
  return Boolean(
    territory
    && typeof territory === 'object'
    && territory.id
    && territory.owner === 'neutral'
    && !territory.ownerPlayerId,
  );
}

// Has the tutorial's referenced first city been materialized for this player? The companion city is a
// regular world city, so discovery here means its tile carries the site id in the player's world map.
function isTutorialFirstCityDiscovered(gameState = {}) {
  const grant = gameState.tutorial?.grants?.[TUTORIAL_FIRST_SITE_GRANT_KEY];
  const siteId = grant?.siteId || '';
  if (!siteId) return false;
  return (Array.isArray(gameState.worldMap?.tiles) ? gameState.worldMap.tiles : [])
    .some((tile) => tile && tile.siteId === siteId);
}

// Generic march-vision → discovery pass (docs/design/10 §3.4). For every coord that JUST entered the
// mission's reveal area, look for a PRE-PLACED neutral city there — first in the player's own
// gameState.territories (a city already discovered earlier), then in the shared projection
// (planningContext.sharedWorldTerritories, fed the FULL neutral-city set by S3). When one is found and
// its tile is not yet bound to it, flip it to a discovered, on-map neutral city:
//   1. push the raw city into gameState.territories (so normalizeTerritory can re-derive garrison /
//      capitalDistance / battleTarget — §4-4, we author only position+owner+type+status+names);
//   2. bindSiteToTile with visibility 'scouted' (NOT 'controlled' — a neutral city is discovered, not
//      owned — §6-R-guard) so the tile carries the siteId and the S3 client DTO gate reveals it;
//   3. record a PERSISTENT 'city' vision source (§6-R-fog) so the fog keeps the tile revealed after the
//      army marches on — the passing unit's 'unit' source decays, a 'city' source does not.
// Idempotent (§6-R-idem): if the tile at the coord is already bound to this city's id, skip it — no
// duplicate push, no re-record, safe to run on every tick AND action write. Matches reveal coords to
// cities via canonical/wrapped tile ids (getCanonicalTileId) throughout, so a seam-adjacent city
// discovers consistently (§6-R-radius). Returns the tiles newly discovered this pass so the caller can
// flow them into newlyRevealedTiles / mission.revealedTileIds.
function discoverPrePlacedCitiesInVision(gameState, revealCoords = [], now = new Date(), options = {}) {
  const coords = Array.isArray(revealCoords) ? revealCoords : [];
  if (!coords.length) return [];
  const planningContext = options.planningContext || {};
  // Canonical id set for the revealed coords — canonical (wrapped) so a seam-adjacent reveal at display
  // (-1,0) matches a city stored at canonical (1023,0): the SAME physical tile (§6-R-radius). Raw tile
  // ids would miss it; the fog + tile store both key on canonical, so we do too.
  const revealCanonicalIds = new Set(coords
    .map((coord) => WorldMapService.getCanonicalTileId(coord.q ?? coord.x, coord.r ?? coord.y))
    .filter(Boolean));
  // Candidate pre-placed cities: the shared projection feeds the full neutral-city set, then the
  // player's own territories provide cities already materialized earlier. Only neutral, not-owned cities
  // are discoverable — an owned/AI territory on the coord is skipped, preserving the occupy-guard intent
  // for ownership (§6-R-guard). Own entries are added LAST so an existing city is not re-pushed from the
  // shared copy.
  const candidates = new Map();
  (Array.isArray(planningContext.sharedWorldTerritories) ? planningContext.sharedWorldTerritories : [])
    .forEach((territory) => {
      if (isDiscoverableNeutralCity(territory)) candidates.set(territory.id, territory);
    });
  (Array.isArray(gameState.territories) ? gameState.territories : [])
    .forEach((territory) => {
      if (isDiscoverableNeutralCity(territory)) candidates.set(territory.id, territory);
    });
  const discovered = [];
  for (const city of candidates.values()) {
    const q = toInteger(city.x ?? city.q, 0);
    const r = toInteger(city.y ?? city.r, 0);
    const canonicalId = WorldMapService.getCanonicalTileId(q, r);
    // Only discover cities whose tile JUST entered this step's reveal area.
    if (!revealCanonicalIds.has(canonicalId)) continue;
    // Idempotency (§6-R-idem): if a tile at this coord already points at this city, discovery is done.
    // Match the tile by canonical id so a seam-adjacent city matches the tile it was bound to.
    const existingTile = (Array.isArray(gameState.worldMap?.tiles) ? gameState.worldMap.tiles : [])
      .find((tile) => WorldMapService.getCanonicalTileId(tile.q ?? tile.x, tile.r ?? tile.y) === canonicalId) || null;
    if (existingTile && existingTile.siteId === city.id) continue;
    // Ensure the raw city lives in gameState.territories so normalizeTerritory derives its garrison
    // (§4-4). Author only position+owner+type+status+names; never hand-author derived fields.
    const materialized = materializeDiscoveredNeutralCity(gameState, city, now);
    if (materialized?.tile) discovered.push({ city, tile: materialized.tile });
  }
  if (discovered.length) {
    WorldExplorerTrace.log('progression:discoverPrePlacedCitiesInVision', {
      revealTileCount: revealCanonicalIds.size,
      discoveredCount: discovered.length,
      cityIds: discovered.map(({ city }) => city.id),
    });
  }
  return discovered;
}

function revealCoordinate(gameState, mission, coord, now = new Date()) {
  const planned = getPlannedTileById(mission).get(WorldMapService.getTileId(coord.q, coord.r));
  const overrides = planned
    ? {
      terrain: planned.terrain,
      riverPorts: planned.riverPorts,
      oceanTemplates: planned.oceanTemplates,
      transitionKey: planned.transitionKey,
      generatedAt: planned.generatedAt,
      visibility: 'scouted',
      generationContext: planned.generationContext,
    }
    : { visibility: 'scouted' };
  const tile = WorldMapService.revealTile(gameState, coord.q, coord.r, now, overrides);
  WorldExplorerTrace.log('progression:revealCoordinate', {
    missionId: mission.id || '',
    coord: {
      q: coord.q,
      r: coord.r,
      tileId: WorldMapService.getTileId(coord.q, coord.r),
    },
    hadPlannedTile: Boolean(planned),
    tile: tile ? {
      id: tile.id,
      q: tile.q,
      r: tile.r,
      terrain: tile.terrain,
      visibility: tile.visibility,
      discovered: tile.discovered !== false,
      visible: tile.visible !== false,
      siteId: tile.siteId || null,
    } : null,
  });
  return tile;
}

function revealStep(gameState, mission, step, now = new Date(), options = {}) {
  const coords = EXPLORE_REVEAL_RADIUS > 0
    ? WorldMapService.getRevealArea(step.q, step.r, EXPLORE_REVEAL_RADIUS)
    : [{ q: step.q, r: step.r }];
  const plannedTiles = getPlannedTileById(mission);
  const revealedTiles = WorldMapService.revealTiles(gameState, coords, now, {
    overrides: (coord) => {
      const planned = plannedTiles.get(WorldMapService.getTileId(coord.q, coord.r));
      return planned
        ? {
          terrain: planned.terrain,
          riverPorts: planned.riverPorts,
          oceanTemplates: planned.oceanTemplates,
          transitionKey: planned.transitionKey,
          generatedAt: planned.generatedAt,
          visibility: 'scouted',
          generationContext: planned.generationContext,
        }
        : { visibility: 'scouted' };
    },
  });
  // March-vision → discovery: any neutral world city whose tile just entered vision is materialized
  // through the same player-discovery helper. Orthogonal to the occupy guard: this pass only ever touches
  // neutral, not-owned cities (§6-R-guard).
  const discovered = discoverPrePlacedCitiesInVision(gameState, coords, now, {
    planningContext: options.planningContext,
  });
  WorldExplorerTrace.log('progression:revealStep', {
    missionId: mission.id || '',
    step: summarizeStep(step),
    revealRadius: EXPLORE_REVEAL_RADIUS,
    coordCount: coords.length,
    revealedTileIds: getTileIdentities(revealedTiles).slice(0, 12),
    discoveredCityCount: discovered.length,
  });
  if (!discovered.length) return revealedTiles;
  const byId = new Map(revealedTiles.map((tile) => [getTileIdentity(tile), tile]).filter(([id]) => id));
  // Flow newly-discovered city tiles into the returned set so the caller adds them to
  // newlyRevealedTiles / mission.revealedTileIds and the client sees them.
  discovered.forEach(({ tile }) => {
    const tileId = getTileIdentity(tile);
    if (tileId) byId.set(tileId, tile);
  });
  return [...byId.values()];
}

// The guided-explore tutorial advance fires firstCityDiscovered off the ACTUAL march-vision discovery of
// the pre-placed tutorial city (S5) — its tile is now bound to the grant's siteId (the S4/S5 discovery
// pass ran this tick). It must CONVERGE, not fire once: the completion tick's write can lose a revision
// race, leaving the step stranded at scoutExploreStarted while the city is already discovered on the map.
// Re-evaluating on every pass — mission active OR idle — with manualAdvance (monotonic + idempotent) makes
// that stranded state self-heal on the next tick (§6-R-tutorial-convergence). No route-revealed gate: the
// player marches to a target they picked, and the city can enter vision mid-route (before the final step),
// so discovery — not "whole route revealed" — is the trigger.
function advanceTutorialAfterGuidedExplore(gameState, TUTORIAL_STEPS) {
  if (!SharedTutorialFlowConfig.stepEquals(gameState.tutorial?.currentStep, TUTORIAL_STEPS.scoutExploreStarted)) return;
  if (!isTutorialFirstCityDiscovered(gameState)) return;
  gameState.tutorial = manualAdvance(gameState.tutorial, TUTORIAL_STEPS.firstCityDiscovered);
}

function advanceExploreMissions(gameState, now = new Date(), options = {}) {
  const TUTORIAL_STEPS = getTutorialSteps();
  gameState.exploreMissions = normalizeMissions(gameState.exploreMissions);
  const nowMs = now.getTime();
  const newlyRevealedTiles = [];
  for (const mission of gameState.exploreMissions) {
    if (mission.status === 'idle') {
      settleReturnedFormationSnapshot(gameState, mission, now);
      continue;
    }
    if (mission.status !== 'active') continue;
    const stepDurationMs = WorldMarchCore.getMissionStepDurationMs(mission);
    let nextStepAtMs = WorldMarchCore.toTimestamp(mission.nextStepAt, nowMs);
    WorldExplorerTrace.log('progression:advanceMission:begin', {
      now: now.toISOString(),
      nowMs,
      nextStepAtMs,
      mission: summarizeMission(mission),
    });
    while (nextStepAtMs <= nowMs) {
      const step = mission.route.find((item) => !item.revealed);
      if (!step) break;
      const previousPosition = WorldMarchCore.getConfirmedPosition(mission);
      const revealedTiles = revealStep(gameState, mission, step, now, {
        planningContext: options.planningContext,
      });
      WorldMapService.recordVisionPath?.(gameState, previousPosition, step, now, { kind: 'unit' });
      step.revealed = true;
      step.revealedAt = now.toISOString();
      mission.position = WorldMarchCore.normalizeCoord(step);
      newlyRevealedTiles.push(...revealedTiles);
      mission.revealedTileIds = Array.from(new Set([
        ...(mission.revealedTileIds || []),
        ...getTileIdentities(revealedTiles),
      ]));
      nextStepAtMs += stepDurationMs;
    }
    mission.nextStepAt = new Date(nextStepAtMs).toISOString();
    if (mission.route.every((step) => step.revealed)) {
      mission.status = 'idle';
      mission.completedAt = mission.completedAt || now.toISOString();
      mission.nextStepAt = null;
      WorldCombatEncounterService.resolveMissionArrival(gameState, mission, now, {
        worldEncounterRepo: options.worldEncounterRepo,
        sharedWorldEncounters: options.sharedWorldEncounters || options.planningContext?.sharedWorldEncounters,
        stageEncounter: options.stageEncounter,
      });
      settleReturnedFormationSnapshot(gameState, mission, now);
    }
    WorldExplorerTrace.log('progression:advanceMission:after', {
      mission: summarizeMission(mission),
      newlyRevealedCount: newlyRevealedTiles.length,
      newlyRevealedIds: getTileIdentities(newlyRevealedTiles).slice(0, 12),
    });
  }
  // Convergent tutorial advance: after every mission pass (active/idle/none), fire firstCityDiscovered
  // iff the pre-placed tutorial city is now discovered on the map (§6-R-tutorial-convergence). Running it
  // once per tick outside the per-mission loop makes it self-heal a stranded scoutExploreStarted step even
  // if the mission has already been cleaned up.
  advanceTutorialAfterGuidedExplore(gameState, TUTORIAL_STEPS);
  // Offline safety net: force-settle any mission that has sat 'engaged' on an enemy tile
  // longer than the fallback window (a player who never opened the interactive battle).
  // Runs every tick/heartbeat that advances missions; defers to an open interactive
  // session so it never double-settles a fight the player is actively playing.
  if (options.resolveEngagedTimeouts !== false) {
    WorldCombatEncounterService.resolveEngagedTimeouts(gameState, now, {
      worldEncounterRepo: options.worldEncounterRepo,
      sharedWorldEncounters: options.sharedWorldEncounters || options.planningContext?.sharedWorldEncounters,
      stageEncounter: options.stageEncounter,
    });
  }
  if (options.marchVerification?.enabled === true) {
    WorldMarchVerification.verifyMissions(gameState, now, options.marchVerification);
  }
  return newlyRevealedTiles;
}

function normalizeExploreState(gameState, now = new Date(), options = {}) {
  WorldMapService.ensureWorldMap(gameState, now);
  gameState.exploreMissions = normalizeMissions(gameState.exploreMissions);
  advanceExploreMissions(gameState, now, {
    planningContext: options.planningContext,
    worldEncounterRepo: options.worldEncounterRepo,
    sharedWorldEncounters: options.sharedWorldEncounters || options.planningContext?.sharedWorldEncounters,
    marchVerification: options.marchVerification,
    resolveEngagedTimeouts: options.resolveEngagedTimeouts,
    stageEncounter: options.stageEncounter,
  });
  return gameState.exploreMissions;
}

module.exports = {
  getPlannedTileById,
  revealCoordinate,
  revealStep,
  advanceExploreMissions,
  normalizeExploreState,
};
