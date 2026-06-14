(function (global) {
  const sharedTileCoord = (() => {
    if (global.TileCoord) return global.TileCoord;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../domain/TileCoord');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function toInteger(value, fallback = 0) {
    return Math.floor(toNumber(value, fallback));
  }

  function tileId(x, y) {
    if (sharedTileCoord?.tileId) return sharedTileCoord.tileId(x, y);
    return `tile_${toInteger(x)}_${toInteger(y)}`;
  }

  function normalizeCoord(coord = {}, fallback = {}) {
    if (sharedTileCoord?.normalizeCoord) return sharedTileCoord.normalizeCoord(coord, fallback);
    const fallbackX = toInteger(fallback.x !== undefined ? fallback.x : fallback.q, 0);
    const fallbackY = toInteger(fallback.y !== undefined ? fallback.y : fallback.r, 0);
    const x = toInteger(coord.x !== undefined ? coord.x : coord.q, fallbackX);
    const y = toInteger(coord.y !== undefined ? coord.y : coord.r, fallbackY);
    return { q: x, r: y, tileId: tileId(x, y) };
  }

  function summarizeCoord(coord = {}, fallback = {}) {
    const normalized = normalizeCoord(coord, fallback);
    return {
      q: normalized.q,
      r: normalized.r,
      tileId: normalized.tileId,
    };
  }

  function summarizeRouteCoord(coord = {}) {
    const normalized = summarizeCoord(coord);
    return {
      q: normalized.q,
      r: normalized.r,
      step: toInteger(coord.step),
      tileId: normalized.tileId,
      kind: coord.kind === 'branch' ? 'branch' : (coord.kind || ''),
      revealed: Boolean(coord.revealed),
    };
  }

  function summarizeTile(tile = {}) {
    const coord = summarizeCoord(tile);
    return {
      id: coord.tileId,
      q: coord.q,
      r: coord.r,
      terrain: tile.terrain,
      discovered: tile.discovered !== false,
      visible: tile.visible !== false,
      siteId: tile.siteId || null,
      riverPorts: tile.riverPorts || [],
      oceanTemplates: tile.oceanTemplates || [],
      transitionKey: tile.transitionKey || '',
    };
  }

  function summarizeSite(site = {}) {
    const coord = summarizeCoord(site);
    return {
      id: site.id,
      q: coord.q,
      r: coord.r,
      tileId: coord.tileId,
      status: site.status,
      owner: site.owner,
      type: site.type,
      art: site.art,
      name: site.cityName || site.naturalName,
    };
  }

  function summarizeMission(mission = {}) {
    return {
      id: mission.id,
      status: mission.status,
      position: mission.position ? summarizeCoord(mission.position) : null,
      route: (mission.route || []).map(summarizeRouteCoord),
      revealArea: (mission.revealArea || []).map(summarizeRouteCoord),
      revealedTileIds: mission.revealedTileIds || [],
      actionPointsRemaining: mission.actionPointsRemaining,
    };
  }

  function summarizePlannedSite(plannedSite = {}) {
    const rawSite = plannedSite.site && typeof plannedSite.site === 'object' ? plannedSite.site : null;
    const coord = summarizeCoord(plannedSite, rawSite || {});
    const siteCoord = rawSite ? summarizeCoord(rawSite) : null;
    return {
      tileId: coord.tileId,
      q: coord.q,
      r: coord.r,
      siteId: plannedSite.siteId || rawSite?.id || null,
      materialized: Boolean(plannedSite.materialized),
      revealedAt: plannedSite.revealedAt || '',
      site: rawSite ? {
        id: rawSite.id,
        q: siteCoord.q,
        r: siteCoord.r,
        tileId: siteCoord.tileId,
        status: rawSite.status,
        owner: rawSite.owner,
        type: rawSite.type,
        art: rawSite.art,
        name: rawSite.cityName || rawSite.naturalName,
      } : null,
    };
  }

  function summarizeExplorerMission(mission = {}) {
    return {
      id: mission.id,
      status: mission.status,
      position: mission.position ? summarizeCoord(mission.position) : null,
      route: (mission.route || []).map(summarizeRouteCoord),
      plannedTiles: (mission.plannedTiles || []).map(summarizeTile),
      plannedSites: (mission.plannedSites || []).map(summarizePlannedSite),
      revealedTileIds: mission.revealedTileIds || [],
    };
  }

  function getMapDataSignature(state = {}, options = {}) {
    const territoryState = state?.territoryState || {};
    const worldExplorerState = state?.worldExplorerState || {};
    const presenter = options.presenter || null;
    if (typeof presenter?.getWorldTileMapSignature === 'function') {
      return presenter.getWorldTileMapSignature(territoryState, worldExplorerState, options);
    }
    const worldMap = territoryState.worldMap || {};
    const tiles = Array.isArray(worldMap.tiles) ? worldMap.tiles : [];
    const sites = Array.isArray(territoryState.territories) ? territoryState.territories : [];
    const missions = Array.isArray(territoryState.scoutMissions) ? territoryState.scoutMissions : [];
    return JSON.stringify({
      version: worldMap.version || 0,
      seed: worldMap.seed || '',
      tiles: tiles.map(summarizeTile),
      sites: sites.map(summarizeSite),
      missions: missions.map(summarizeMission),
      explorerMissions: [
        worldExplorerState.activeMission,
        ...(Array.isArray(worldExplorerState.idleMissions) ? worldExplorerState.idleMissions : []),
      ].filter(Boolean).map(summarizeExplorerMission),
    });
  }

  function getSignatureSyncResult(previousSignature = '', nextSignature = '') {
    const changed = nextSignature !== previousSignature;
    const hadPreviousSignature = Boolean(previousSignature);
    return {
      signature: nextSignature,
      changed,
      hadPreviousSignature,
      shouldInvalidateBake: Boolean(changed && hadPreviousSignature),
    };
  }

  function isMapBakeDirty(runtimeState = {}, state = {}, options = {}) {
    if (!runtimeState.hasBakedMapLayer || runtimeState.mapBakeDirty) return true;
    return getMapDataSignature(state, options) !== (runtimeState.lastMapDataSignature || '');
  }

  const WorldMapRuntimeBakePolicy = Object.freeze({
    getMapDataSignature,
    getSignatureSyncResult,
    isMapBakeDirty,
    normalizeCoord,
    summarizeCoord,
    summarizeExplorerMission,
    summarizeMission,
    summarizePlannedSite,
    summarizeRouteCoord,
    summarizeSite,
    summarizeTile,
  });

  global.WorldMapRuntimeBakePolicy = WorldMapRuntimeBakePolicy;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapRuntimeBakePolicy;
})(typeof window !== 'undefined' ? window : globalThis);
