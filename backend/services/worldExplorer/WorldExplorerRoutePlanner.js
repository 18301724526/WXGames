const WorldMapService = require('../WorldMapService');
const WorldMarchCore = require('../../../shared/worldMarchCore');
const {
  MAX_MANUAL_ROUTE_LENGTH,
  toInteger,
  hashString,
  getDistance,
} = require('./WorldExplorerShared');

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

function buildManualRoute(origin, target, seed = WorldMapService.DEFAULT_WORLD_SEED, options = {}) {
  const targetQ = toInteger(target?.q ?? target?.x, origin.q);
  const targetR = toInteger(target?.r ?? target?.y, origin.r);
  const routeResult = WorldMarchCore.evaluateLinearMarchRoute(origin, { q: targetQ, r: targetR }, {
    // Armies march the four grid-axis directions only (no diagonal corner-cutting); the
    // client's WorldMarchRoutePolicy previews with the same axisAligned flag so its route
    // matches this authoritative one byte-for-byte.
    axisAligned: true,
    maxLength: MAX_MANUAL_ROUTE_LENGTH,
    // Route world-bounds are single-source (WorldMapConstants via WorldMapService); the same three
    // values are delivered to the client in the world-explorer DTO so the client's optimistic route
    // and preview run this exact computation with identical inputs — no divergence.
    width: WorldMapService.DEFAULT_WORLD_WIDTH,
    height: WorldMapService.DEFAULT_WORLD_HEIGHT,
    wrapping: WorldMapService.DEFAULT_WORLD_WRAPPING,
    canTraverse: (step) => canTraverseRouteTile(seed, step.q, step.r, options),
  });
  if (routeResult.error === 'EXPLORE_TARGET_IS_ORIGIN') {
    // A formation already standing on a hostile encounter tile attacks it in
    // place: there is no travel, so engage on the spot via a single-step route
    // instead of rejecting the march as targeting its own origin.
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
    return { success: false, error: 'EXPLORE_TARGET_IS_ORIGIN', message: '目标就是部队当前位置。' };
  }
  if (routeResult.error === 'EXPLORE_TARGET_TOO_FAR') {
    return { success: false, error: 'EXPLORE_TARGET_TOO_FAR', message: '目标太远，无法行军。' };
  }
  if (routeResult.error === 'EXPLORE_ROUTE_BLOCKED') {
    return { success: false, error: 'EXPLORE_ROUTE_BLOCKED', message: '行军路线被水域阻断。' };
  }
  const route = (routeResult.route || []).map((step) => ({
    q: step.q,
    r: step.r,
    step: step.step,
    tileId: WorldMapService.getTileId(step.q, step.r),
    revealed: false,
    revealedAt: null,
  }));
  const routeTarget = route.at(-1) || { q: origin.q, r: origin.r };
  return { success: true, route, target: { q: routeTarget.q, r: routeTarget.r } };
}

function canTraverseRouteTile(seed, q, r, options = {}) {
  const gameState = options.gameState || null;
  if (gameState) {
    const existing = getExistingWorldTileById(gameState, q, r, options.now || new Date());
    if (existing) return !WorldMarchCore.isMarchBlockedTerrain(existing.terrain);
  }
  return !WorldMarchCore.isMarchBlockedTerrain(WorldMapService.chooseTerrain(seed, q, r));
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

module.exports = {
  getExploreOrigin,
  buildManualRoute,
  getEventEpoch,
  getNearbyGenerationState,
  getStepDirection,
  canTraverseRouteTile,
  createGenerationContext,
  getRouteFootprint,
  createPlannedTiles,
};
