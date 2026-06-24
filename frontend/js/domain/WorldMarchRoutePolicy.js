(function (global) {
  const WorldMarchCore = (() => {
    if (global.WorldMarchCore) return global.WorldMarchCore;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../../shared/worldMarchCore');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  // C-LAYER rules: the single place the "can I march onto this tile" rule lives.
  const WorldMarchPassability = (() => {
    if (global.WorldMarchPassability) return global.WorldMarchPassability;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../../shared/worldMarchPassability');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const MAX_MANUAL_ROUTE_LENGTH = 16;

  function normalizeCoord(coord = {}, fallback = {}) {
    if (WorldMarchCore?.normalizeCoord) return WorldMarchCore.normalizeCoord(coord, fallback);
    const q = Math.floor(Number(coord.q ?? coord.x ?? fallback.q ?? fallback.x ?? 0));
    const r = Math.floor(Number(coord.r ?? coord.y ?? fallback.r ?? fallback.y ?? 0));
    return { q, r, tileId: `tile_${q}_${r}` };
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

  // Thin wrapper — the rule lives ONLY in shared/worldMarchPassability (C). No
  // local terrain comparison: if C is unavailable we report "not blocked" rather
  // than re-deriving the rule here (a second copy is exactly what we forbid).
  function isRouteTerrainBlocked(tile = null) {
    if (!WorldMarchPassability?.isTileMarchable) return false;
    return !WorldMarchPassability.isTileMarchable(tile?.terrain, null);
  }

  // D-LAYER: the frontend terrain oracle. It only knows DISCOVERED tiles; fog
  // tiles report 'unknown' so the shared rule treats them optimistically and the
  // authoritative backend settles them.
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
    // The passability DECISION lives in shared/worldMarchPassability (C). This
    // A/B layer only injects the frontend terrain oracle (D) and consumes the
    // verdict — no terrain rule of its own.
    const verdict = WorldMarchPassability.evaluateMarch({
      origin,
      target: coord,
      getTileTerrain: frontendTerrainOracle(knownTiles),
      unit: options.unit || null,
      maxLength: options.maxLength || MAX_MANUAL_ROUTE_LENGTH,
      worldWidth: options.worldWidth || 1024,
      worldHeight: options.worldHeight || 1024,
      wrapping: options.wrapping !== false,
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
