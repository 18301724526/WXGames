(function (global) {
  const SignatureHash = (() => {
    if (global.SignatureHash) return global.SignatureHash;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../shared/SignatureHash');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const sharedTileCoord = (() => {
    if (global.TileCoord) return global.TileCoord;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../domain/TileCoord');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const sharedWorldMarchSystem = (() => {
    if (global.WorldMarchSystem) return global.WorldMarchSystem;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../domain/WorldMarchSystem');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const sharedWorldClock = (() => {
    if (global.WorldClock) return global.WorldClock;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../domain/WorldClock');
      } catch (_error) {
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

  function hasCoordPair(source = {}) {
    if (!source || typeof source !== 'object') return false;
    const hasQ = source.x !== undefined || source.q !== undefined;
    const hasR = source.y !== undefined || source.r !== undefined;
    return hasQ && hasR;
  }

  function addTileAlias(aliases, value, canonicalId) {
    if (!value || !canonicalId) return;
    const alias = String(value);
    const ids = aliases.get(alias) || new Set();
    ids.add(String(canonicalId));
    aliases.set(alias, ids);
  }

  function addCoordAliases(aliases, source = {}, fallback = {}) {
    if (!source || typeof source !== 'object') return;
    if (!hasCoordPair(source) && !hasCoordPair(fallback)) return;
    const normalized = summarizeCoord(source, fallback);
    addTileAlias(aliases, normalized.tileId, normalized.tileId);
    addTileAlias(aliases, source.tileId, normalized.tileId);
    addTileAlias(aliases, source.id, normalized.tileId);
  }

  function createMissionTileAliasMap(mission = {}) {
    const aliases = new Map();
    (Array.isArray(mission.route) ? mission.route : []).forEach((step) => addCoordAliases(aliases, step));
    (Array.isArray(mission.revealArea) ? mission.revealArea : []).forEach((step) => addCoordAliases(aliases, step));
    (Array.isArray(mission.plannedTiles) ? mission.plannedTiles : []).forEach((tile) => addCoordAliases(aliases, tile));
    (Array.isArray(mission.plannedSites) ? mission.plannedSites : []).forEach((site) => {
      const rawSite = site?.site && typeof site.site === 'object' ? site.site : {};
      addCoordAliases(aliases, site, rawSite);
    });
    return aliases;
  }

  function summarizeRevealedTileIds(mission = {}) {
    const aliases = createMissionTileAliasMap(mission);
    const ids = [];
    const seen = new Set();
    const addId = (id) => {
      if (!id) return;
      const value = String(id);
      if (seen.has(value)) return;
      seen.add(value);
      ids.push(value);
    };
    (Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds : [])
      .filter(Boolean)
      .forEach((id) => {
        const canonicalIds = aliases.get(String(id));
        if (canonicalIds) {
          canonicalIds.forEach(addId);
          return;
        }
        addId(id);
      });
    return ids;
  }

  function summarizeRenderReveal(mission = {}, options = {}) {
    const nowMs = options.nowMs
      ?? options.epochNowMs
      ?? options.serverNowMs
      ?? sharedWorldClock?.getEpochNowMs?.(options, Number.NaN);
    if (mission.renderRevealSignature) return mission.renderRevealSignature;
    if (sharedWorldMarchSystem?.getRouteRenderRevealSignature) {
      return sharedWorldMarchSystem.getRouteRenderRevealSignature(mission, nowMs);
    }
    const sources = Array.isArray(mission.renderRevealSources) ? mission.renderRevealSources : [];
    if (!sources.length) return '';
    let hash = SignatureHash.FNV_OFFSET_BASIS;
    sources.forEach((source) => {
      const text = [
        source.tileId || '',
        Math.round(toNumber(source.strength, 1) * 1000),
      ].join(':');
      hash = SignatureHash.hashStep(hash, text);
    });
    return `${sources.length}:${(hash >>> 0).toString(36)}`;
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
      revealedTileIds: summarizeRevealedTileIds(mission),
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

  function summarizeExplorerMission(mission = {}, options = {}) {
    return {
      id: mission.id,
      status: mission.status,
      position: mission.position ? summarizeCoord(mission.position) : null,
      route: (mission.route || []).map(summarizeRouteCoord),
      plannedTiles: (mission.plannedTiles || []).map(summarizeTile),
      plannedSites: (mission.plannedSites || []).map(summarizePlannedSite),
      revealedTileIds: summarizeRevealedTileIds(mission),
      renderReveal: summarizeRenderReveal(mission, options),
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
      origin: summarizeCoord(worldMap.origin || {}),
      tiles: tiles.map(summarizeTile),
      sites: sites.map(summarizeSite),
      missions: missions.map(summarizeMission),
      explorerMissions: [
        worldExplorerState.activeMission,
        ...(Array.isArray(worldExplorerState.idleMissions) ? worldExplorerState.idleMissions : []),
      ].filter(Boolean).map((mission) => summarizeExplorerMission(mission, options)),
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
    summarizeRenderReveal,
    summarizeMission,
    summarizePlannedSite,
    summarizeRouteCoord,
    summarizeSite,
    summarizeTile,
  });

  global.WorldMapRuntimeBakePolicy = WorldMapRuntimeBakePolicy;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapRuntimeBakePolicy;
})(typeof window !== 'undefined' ? window : globalThis);
