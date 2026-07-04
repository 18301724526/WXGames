(function (global) {
  const WorldMarchCore = (() => {
    if (global.WorldMarchCore) return global.WorldMarchCore;
    if (typeof module !== 'undefined' && module.exports) {
      return require('../../../../shared/worldMarchCore');
    }
    throw new Error(
      'WorldMarchCore is required: load WorldMarchCoreAdapter.js before WorldMarchRoutePolicy.js',
    );
  })();

  // Single source: shared/worldMarchCore owns the cap; the server also delivers its value
  // in the world-explorer DTO (maxManualRouteLength), which wins when present.
  const MAX_MANUAL_ROUTE_LENGTH = WorldMarchCore.MAX_MANUAL_ROUTE_LENGTH || 16;

  function normalizeCoord(coord = {}, fallback = {}) {
    return WorldMarchCore.normalizeCoord(coord, fallback);
  }

  function getTileKey(coord = {}) {
    return normalizeCoord(coord).tileId;
  }

  function getKnownTileMap(tileMapView = {}) {
    const map = new Map();
    (Array.isArray(tileMapView?.tiles) ? tileMapView.tiles : []).forEach((tile) => {
      if (!tile || typeof tile !== 'object') return;
      const coord = normalizeCoord(tile);
      if (Number.isFinite(Number(coord.q)) && Number.isFinite(Number(coord.r)))
        map.set(coord.tileId, tile);
    });
    return map;
  }

  function isRouteTerrainBlocked(tile = null) {
    // Single source: shared/worldMarchCore blocks ocean + river; shore stays passable.
    return WorldMarchCore.isMarchBlockedTerrain(tile?.terrain);
  }

  function getMarchOrigin(state = {}, options = {}) {
    const explicit = options.origin || options.marchOrigin || null;
    if (explicit) return normalizeCoord(explicit);
    const target = options.target || null;
    if (target?.missionId || target?.actorId) {
      const missionId = target.missionId || target.actorId;
      const missions =
        state.worldExplorerState?.missions || state.worldExplorerState?.exploreMissions || [];
      const mission =
        (Array.isArray(missions) ? missions : []).find(
          (item) => item?.id === missionId || item?.missionId === missionId,
        ) || null;
      if (mission)
        return normalizeCoord(mission.position || mission.target || mission.origin || {});
    }
    const activeCityId = state.activeCityId || state.cityState?.activeCityId || 'capital';
    const territories = state.territoryState?.territories || state.territories || [];
    const territory =
      (Array.isArray(territories) ? territories : []).find(
        (item) => item?.id === activeCityId || item?.territoryId === activeCityId,
      ) ||
      (Array.isArray(territories) ? territories : []).find((item) => item?.id === 'capital') ||
      null;
    const worldOrigin =
      state.territoryState?.worldMap?.origin || state.territoryState?.worldMap?.worldOrigin || null;
    return normalizeCoord(territory || worldOrigin || {});
  }

  function evaluateMarchTarget(state = {}, target = {}, options = {}) {
    const coord = normalizeCoord(target);
    const origin = getMarchOrigin(state, { ...options, target });
    const knownTiles = getKnownTileMap(options.tileMapView || state.territoryState?.worldMap || {});
    const serverRouteCap = Number(state.worldExplorerState?.maxManualRouteLength) || 0;
    const routeResult = WorldMarchCore.evaluateLinearMarchRoute(origin, coord, {
      maxLength: options.maxLength || serverRouteCap || MAX_MANUAL_ROUTE_LENGTH,
      width: options.worldWidth || 1024,
      height: options.worldHeight || 1024,
      wrapping: options.wrapping !== false,
      canTraverse: (step) => !isRouteTerrainBlocked(knownTiles.get(getTileKey(step))),
    });
    if (routeResult.success) {
      return { canMarch: true, reason: '', origin, target: coord, route: routeResult.route || [] };
    }
    return {
      canMarch: false,
      reason: routeResult.error || 'EXPLORE_ROUTE_BLOCKED',
      blockedStep: routeResult.blockedStep || null,
      origin,
      target: coord,
      route: routeResult.route || [],
    };
  }

  const api = Object.freeze({
    MAX_MANUAL_ROUTE_LENGTH,
    evaluateMarchTarget,
    getMarchOrigin,
    isRouteTerrainBlocked,
    normalizeCoord,
  });

  global.WorldMarchRoutePolicy = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
