(function (global) {
  const WorldMarchCore = (() => {
    if (global.WorldMarchCore) return global.WorldMarchCore;
    if (typeof module !== 'undefined' && module.exports) {
      return require('../../../../shared/worldMarchCore');
    }
    throw new Error(
      'WorldMarchCore is required: load shared/worldMarchCore.js before WorldMarchRoutePolicy.js',
    );
  })();

  const WorldMarchPassability = (() => {
    if (global.WorldMarchPassability) return global.WorldMarchPassability;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../../../shared/worldMarchPassability');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

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
    if (!WorldMarchPassability?.isTileMarchable) return false;
    return !WorldMarchPassability.isTileMarchable(tile?.terrain, null);
  }

  function frontendTerrainOracle(knownTiles) {
    const unknown = WorldMarchPassability?.TERRAIN_UNKNOWN || 'unknown';
    return (q, r) => {
      const tile = knownTiles.get(getTileKey({ q, r }));
      return tile && tile.terrain ? tile.terrain : unknown;
    };
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

    if (!WorldMarchPassability?.evaluateMarch) {
      return {
        canMarch: true,
        reason: '',
        origin,
        target: coord,
        route: [],
        blockedStep: null,
        hasUnknownOnRoute: false,
      };
    }

    const verdict = WorldMarchPassability.evaluateMarch({
      origin,
      target: coord,
      getTileTerrain: frontendTerrainOracle(knownTiles),
      unit: options.unit || null,
      maxLength: options.maxLength || serverRouteCap || MAX_MANUAL_ROUTE_LENGTH,
      worldWidth: options.worldWidth || state.worldExplorerState?.worldWidth || 1024,
      worldHeight: options.worldHeight || state.worldExplorerState?.worldHeight || 1024,
      wrapping: options.wrapping !== undefined
        ? options.wrapping !== false
        : state.worldExplorerState?.worldWrapping !== false,
      axisAligned: true,
      trace: global.WorldMarchTrace,
      corr: options.corr || '',
    });
    return {
      canMarch: verdict.canMarch,
      reason: verdict.reason || '',
      blocked: verdict.blocked,
      blockedStep: verdict.blocked?.atTile || null,
      hasUnknownOnRoute: verdict.hasUnknownOnRoute,
      origin: verdict.origin,
      target: verdict.target,
      route: verdict.route || [],
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
