const WorldMapService = require('../WorldMapService');
const TerritoryService = require('../TerritoryService');
const { TutorialFlowConfig } = require('../config/GameplayConfigRuntime');
const WorldMarchPassability = require('../../../shared/worldMarchPassability');
const SharedTutorialFlowConfig = require('../../../shared/tutorialFlowConfig');
const WorldExplorerTrace = require('./WorldExplorerTrace');
const {
  MAX_MANUAL_ROUTE_LENGTH,
  TUTORIAL_FIRST_SITE_GRANT_KEY,
  toInteger,
  hashString,
  getCoordinateKey,
  getDistance,
} = require('./WorldExplorerShared');

const TUTORIAL_EMPTY_CITY_NAMES = [
  '\u6e05\u6cc9\u57ce',
  '\u77f3\u6e21\u9547',
  '\u9752\u6797\u57ce',
  '\u6cb3\u6e7e\u57ce',
];

function getTutorialSteps() {
  return TutorialFlowConfig.TUTORIAL_STEPS;
}

function getExploreOrigin(gameState) {
  const activeCityId = gameState?.activeCityId || 'capital';
  const city = gameState?.cities?.[activeCityId] || null;
  const territoryId = city?.territoryId || activeCityId;
  const territory = (gameState?.territories || []).find((item) => (
    item?.id === territoryId || item?.id === activeCityId
  )) || (gameState?.territories || []).find((item) => item?.id === 'capital') || {};
  return {
    q: toInteger(territory.x ?? territory.q, 0),
    r: toInteger(territory.y ?? territory.r, 0),
    cityId: city?.id || activeCityId,
    territoryId: territory.id || 'capital',
    name: city?.name || territory.cityName || territory.naturalName || 'capital',
  };
}

// D-LAYER: the backend terrain oracle. It knows every tile — a persisted tile if
// one exists, otherwise the seed-generated terrain — and is injected into the
// shared passability rule (C). It does no judging; it only returns terrain.
function backendTerrainOracle(seed, options = {}) {
  const gameState = options.gameState || null;
  const now = options.now || new Date();
  return (q, r) => {
    if (gameState) {
      const existing = getExistingWorldTileById(gameState, q, r, now);
      if (existing) return existing.terrain;
    }
    return WorldMapService.chooseTerrain(seed, q, r);
  };
}

function buildManualRoute(origin, target, seed = WorldMapService.DEFAULT_WORLD_SEED, options = {}) {
  const targetQ = toInteger(target?.q ?? target?.x, origin.q);
  const targetR = toInteger(target?.r ?? target?.y, origin.r);
  // The "can this army march onto / across these tiles" decision lives in ONE
  // place: shared/worldMarchPassability (C). Backend supplies the authoritative
  // terrain oracle; the rule, the verdict, and the trace come from C.
  const verdict = WorldMarchPassability.evaluateMarch({
    origin,
    target: { q: targetQ, r: targetR },
    getTileTerrain: backendTerrainOracle(seed, options),
    unit: options.unit || null,
    maxLength: MAX_MANUAL_ROUTE_LENGTH,
    worldWidth: WorldMapService.DEFAULT_WORLD_WIDTH,
    worldHeight: WorldMapService.DEFAULT_WORLD_HEIGHT,
    wrapping: WorldMapService.DEFAULT_WORLD_WRAPPING,
    axisAligned: true,
    trace: WorldExplorerTrace,
    corr: options.clientSequence || options.requestId || '',
  });

  // In-place combat: a formation standing on a hostile encounter tile attacks it
  // without travelling, so engage on the spot instead of rejecting as origin.
  if (verdict.reason === 'EXPLORE_TARGET_IS_ORIGIN') {
    if (options.combatEncounter) {
      return {
        success: true,
        inPlace: true,
        route: [{
          q: targetQ,
          r: targetR,
          step: 1,
          tileId: WorldMapService.getTileId(targetQ, targetR),
          revealed: false,
          revealedAt: null,
        }],
        target: { q: targetQ, r: targetR },
      };
    }
    return { success: false, error: 'EXPLORE_TARGET_IS_ORIGIN', message: 'Explore target is already the origin.' };
  }
  if (verdict.reason === 'EXPLORE_TARGET_TOO_FAR') {
    return { success: false, error: 'EXPLORE_TARGET_TOO_FAR', message: 'Explore target is too far.' };
  }
  if (!verdict.canMarch) {
    // Authoritative block: the straight route to the target crosses impassable
    // water. The client already hides the march button for tiles it can see are
    // blocked; this rejects the fog case it could not predict.
    return { success: false, error: 'EXPLORE_ROUTE_BLOCKED', message: '行军路线被水域阻断。' };
  }
  const route = verdict.route.map((step) => ({
    q: step.q,
    r: step.r,
    step: step.step,
    tileId: WorldMapService.getTileId(step.q, step.r),
    dir: step.dir,
    revealed: false,
    revealedAt: null,
  }));
  const routeTarget = route.at(-1) || { q: origin.q, r: origin.r };
  return { success: true, route, target: { q: routeTarget.q, r: routeTarget.r } };
}

// Thin wrapper kept for the public contract and other callers. The rule itself
// lives in shared/worldMarchPassability (C); this only supplies the backend D.
function canTraverseRouteTile(seed, q, r, options = {}) {
  const terrain = backendTerrainOracle(seed, options)(q, r);
  return WorldMarchPassability.isTileMarchable(terrain, options.unit || null);
}

function getStepDirection(from = {}, to = {}) {
  const delta = WorldMapService.getWrappedDelta(from, to);
  const vector = {
    q: Math.sign(toInteger(delta.q, 0)),
    r: Math.sign(toInteger(delta.r, 0)),
  };
  return Object.entries(WorldMapService.DIRECTION_VECTORS)
    .find(([, candidate]) => candidate.q === vector.q && candidate.r === vector.r)?.[0] || '';
}

function getEventEpoch(gameState = {}) {
  if (gameState.worldEventEpoch || gameState.eventEpoch) return String(gameState.worldEventEpoch || gameState.eventEpoch);
  return hashString(JSON.stringify({
    gameDay: gameState.gameDay || 0,
    regularEventState: gameState.regularEventState || null,
    threatEventState: gameState.threatEventState || null,
    activeBuffs: gameState.activeBuffs || [],
  })).toString(16);
}

function getNearbyGenerationState(gameState = {}, center = {}, radius = 8) {
  const centerQ = toInteger(center.q ?? center.x, 0);
  const centerR = toInteger(center.r ?? center.y, 0);
  const isNearby = (coord = {}) => (
    getDistance(centerQ, centerR, coord.x ?? coord.q, coord.y ?? coord.r) <= radius
  );
  return {
    currentEra: gameState.currentEra || 0,
    gameDay: gameState.gameDay || 0,
    territories: (gameState.territories || [])
      .filter(isNearby)
      .map((territory) => ({
        id: territory.id || '',
        x: territory.x ?? territory.q ?? 0,
        y: territory.y ?? territory.r ?? 0,
        owner: territory.owner || '',
        ownerPlayerId: territory.ownerPlayerId || '',
        status: territory.status || '',
        type: territory.type || '',
      }))
      .sort((a, b) => a.x - b.x || a.y - b.y || a.id.localeCompare(b.id)),
    worldAi: (gameState.worldAi?.explorers || [])
      .filter((explorer) => isNearby(explorer.position || {}))
      .map((explorer) => ({
        id: explorer.id || '',
        factionId: explorer.factionId || '',
        q: explorer.position?.q ?? explorer.position?.x ?? 0,
        r: explorer.position?.r ?? explorer.position?.y ?? 0,
      }))
      .sort((a, b) => a.q - b.q || a.r - b.r || a.id.localeCompare(b.id)),
  };
}

function getPlanningTerritories(gameState = {}, planningContext = {}) {
  const own = Array.isArray(gameState.territories) ? gameState.territories : [];
  const shared = Array.isArray(planningContext.sharedWorldTerritories)
    ? planningContext.sharedWorldTerritories
    : [];
  return [...own, ...shared].filter((territory) => territory && typeof territory === 'object');
}

function createGenerationContext(gameState = {}, step = {}, options = {}) {
  const origin = options.origin || getExploreOrigin(gameState);
  const target = options.target || step;
  const previous = options.previous || origin;
  const center = { q: toInteger(step.q, 0), r: toInteger(step.r, 0) };
  return {
    source: 'player-world-explore',
    playerId: gameState.playerId || '',
    mode: options.mode || 'unknown',
    direction: options.direction || getStepDirection(previous, step),
    origin: {
      q: toInteger(origin.q ?? origin.x, 0),
      r: toInteger(origin.r ?? origin.y, 0),
      cityId: origin.cityId || 'capital',
      territoryId: origin.territoryId || 'capital',
    },
    target: {
      q: toInteger(target.q ?? target.x, toInteger(step.q, 0)),
      r: toInteger(target.r ?? target.y, toInteger(step.r, 0)),
    },
    step: toInteger(step.step, 0),
    eventEpoch: getEventEpoch(gameState),
    nearbyStateHash: hashString(JSON.stringify(getNearbyGenerationState(gameState, center))).toString(16),
  };
}

function getExistingWorldTileById(gameState = {}, q = 0, r = 0, now = new Date()) {
  const worldMap = WorldMapService.ensureWorldMap(gameState, now);
  const canonicalId = WorldMapService.getCanonicalTileId(q, r);
  return (worldMap.tiles || []).find((tile) => (
    (tile.canonicalId || WorldMapService.getCanonicalTileId(tile.q, tile.r)) === canonicalId
  )) || null;
}

function getRouteFootprint(route = [], radius = 1) {
  const byId = new Map();
  (Array.isArray(route) ? route : []).forEach((step) => {
    WorldMapService.getRevealArea(step.q, step.r, radius).forEach((coord) => {
      const id = WorldMapService.getTileId(coord.q, coord.r);
      if (!byId.has(id)) {
        byId.set(id, {
          q: coord.q,
          r: coord.r,
          tileId: id,
          routeStep: step.step,
          sourceStep: {
            q: step.q,
            r: step.r,
            step: step.step,
          },
        });
      }
    });
  });
  return [...byId.values()];
}

function createPlannedTiles(gameState, route, now = new Date(), options = {}) {
  const worldMap = WorldMapService.ensureWorldMap(gameState, now);
  let previous = options.origin || getExploreOrigin(gameState);
  const footprint = getRouteFootprint(route, options.revealRadius ?? 1);
  return footprint.map((step) => {
    const existing = getExistingWorldTileById(gameState, step.q, step.r, now);
    if (existing) return existing;
    const tile = WorldMapService.createTile(worldMap.seed, step.q, step.r, now, {
      visibility: 'scouted',
      generationContext: createGenerationContext(gameState, step, {
        ...options,
        previous,
        target: options.target || step.sourceStep || step,
      }),
    });
    if (route.some((routeStep) => routeStep.q === step.q && routeStep.r === step.r)) previous = step;
    return tile;
  });
}

function shouldGuaranteeTutorialEmptyCity(gameState = {}) {
  const TUTORIAL_STEPS = getTutorialSteps();
  const tutorial = gameState.tutorial || {};
  if (tutorial.completed || tutorial.disabled) return false;
  const step = tutorial.currentStep;
  if (!SharedTutorialFlowConfig.stepAtLeast(step, TUTORIAL_STEPS.scoutFormationSaved)) return false;
  if (SharedTutorialFlowConfig.stepAtLeast(step, TUTORIAL_STEPS.firstCityDiscovered)) return false;
  return !tutorial.grants?.[TUTORIAL_FIRST_SITE_GRANT_KEY];
}

function pickTutorialCityName(gameState = {}, q = 0, r = 0) {
  const seed = hashString(`${gameState.playerId || 'tutorial'}|${q}|${r}|first-empty-city`);
  return TUTORIAL_EMPTY_CITY_NAMES[seed % TUTORIAL_EMPTY_CITY_NAMES.length];
}

function getPlanningTerrainForMapTerrain(mapTerrain = 'plains') {
  if (mapTerrain === 'forest') return 'forest';
  if (['hills', 'mountain', 'waste', 'desert'].includes(mapTerrain)) return 'hills';
  if (mapTerrain === 'river') return 'river';
  if (mapTerrain === 'ocean') return 'coast';
  return 'plains';
}

function createTutorialEmptyCitySite(gameState = {}, step = {}, plannedTile = {}, now = new Date()) {
  const q = toInteger(step.q, 0);
  const r = toInteger(step.r, 0);
  const siteId = `site_${q}_${r}`;
  const mapTerrain = plannedTile.terrain && !['ocean', 'river'].includes(plannedTile.terrain)
    ? plannedTile.terrain
    : 'plains';
  return {
    id: siteId,
    x: q,
    y: r,
    naturalName: pickTutorialCityName(gameState, q, r),
    cityName: null,
    type: 'town',
    terrain: getPlanningTerrainForMapTerrain(mapTerrain),
    mapTerrain,
    owner: 'neutral',
    status: 'discovered',
    scale: 2,
    threat: 0,
    defense: TerritoryService.MIN_EXPEDITION_SOLDIERS,
    recommendedSoldiers: TerritoryService.MIN_EXPEDITION_SOLDIERS,
    art: TerritoryService.SITE_ART.town,
    visualOffset: { x: 0, y: 0 },
    discoveredAt: now.toISOString(),
    occupiedAt: null,
    effects: { foodOutputMultiplier: 0.05 },
    summary: '\u4e00\u5ea7\u672a\u8bbe\u9632\u7684\u7a7a\u57ce\uff0c\u9002\u5408\u4f5c\u4e3a\u7b2c\u4e00\u5904\u5916\u90e8\u636e\u70b9\u3002',
    lastBattle: null,
    garrison: null,
    defenderLeader: null,
    battleTarget: null,
  };
}

function createTutorialPlannedSites(gameState, route = [], plannedTiles = [], now = new Date(), options = {}) {
  if (!shouldGuaranteeTutorialEmptyCity(gameState)) return [];
  const worldMap = WorldMapService.ensureWorldMap(gameState, now);
  const plannedById = new Map(plannedTiles.map((tile) => [WorldMapService.getTileId(tile.q, tile.r), tile]));
  const existingCoords = new Set(getPlanningTerritories(gameState, options.planningContext)
    .map((site) => getCoordinateKey(site.x ?? site.q, site.y ?? site.r)));
  const chosen = [...route].reverse().find((step) => {
    if (existingCoords.has(getCoordinateKey(step.q, step.r))) return false;
    const planned = plannedById.get(WorldMapService.getTileId(step.q, step.r)) || {};
    const terrain = planned.terrain || WorldMapService.chooseTerrain(worldMap.seed, step.q, step.r);
    return !['ocean', 'river'].includes(terrain);
  });
  if (!chosen) return [];
  const tileId = WorldMapService.getTileId(chosen.q, chosen.r);
  let plannedTile = plannedById.get(tileId);
  if (!plannedTile) {
    plannedTile = WorldMapService.createTile(worldMap.seed, chosen.q, chosen.r, now, {
      terrain: 'plains',
      visibility: 'scouted',
    });
  }
  if (['ocean', 'river'].includes(plannedTile.terrain)) {
    plannedTile.terrain = 'plains';
    plannedTile.riverPorts = [];
    plannedTile.oceanTemplates = [];
    plannedTile.transitionKey = '';
  }
  const site = createTutorialEmptyCitySite(gameState, chosen, plannedTile, now);
  return [{
    tileId,
    q: chosen.q,
    r: chosen.r,
    siteId: site.id,
    materialized: false,
    revealedAt: null,
    site,
  }];
}

module.exports = {
  getExploreOrigin,
  buildManualRoute,
  getEventEpoch,
  getNearbyGenerationState,
  getStepDirection,
  canTraverseRouteTile,
  createGenerationContext,
  getPlanningTerritories,
  getRouteFootprint,
  createPlannedTiles,
  shouldGuaranteeTutorialEmptyCity,
  pickTutorialCityName,
  getPlanningTerrainForMapTerrain,
  createTutorialEmptyCitySite,
  createTutorialPlannedSites,
};
