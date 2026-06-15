(function (global) {
  const sharedWorldMarchSystem = (() => {
    if (global.WorldMarchSystem) return global.WorldMarchSystem;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/WorldMarchSystem');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const sharedWorldTime = (() => {
    if (global.WorldTime) return global.WorldTime;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/WorldTime');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const sharedTileCoord = (() => {
    if (global.TileCoord) return global.TileCoord;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/TileCoord');
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

  function getWorldTileId(q, r) {
    if (sharedTileCoord?.tileId) return sharedTileCoord.tileId(q, r);
    return `tile_${toInteger(q)}_${toInteger(r)}`;
  }

  function getEpochNowMs(options = {}) {
    const worldTime = options.worldTime || sharedWorldTime;
    return worldTime?.getEpochNowMs?.(options, Date.now()) ?? Date.now();
  }

  function normalizeCoord(coord = {}, fallback = {}) {
    const normalized = sharedTileCoord?.normalizeCoord
      ? sharedTileCoord.normalizeCoord(coord, fallback)
      : null;
    if (normalized) {
      return {
        q: normalized.q,
        r: normalized.r,
        tileId: normalized.tileId,
      };
    }
    const q = toInteger(coord.x !== undefined ? coord.x : coord.q, toInteger(fallback.x !== undefined ? fallback.x : fallback.q, 0));
    const r = toInteger(coord.y !== undefined ? coord.y : coord.r, toInteger(fallback.y !== undefined ? fallback.y : fallback.r, 0));
    return {
      q,
      r,
      tileId: getWorldTileId(q, r),
    };
  }

  function normalizeRouteStep(step = {}, index = 0) {
    const coord = normalizeCoord(step);
    return {
      q: coord.q,
      r: coord.r,
      step: toInteger(step.step, index + 1),
      tileId: coord.tileId,
      revealed: Boolean(step.revealed),
    };
  }

  function isCanonicalWorldTileId(id) {
    return /^tile_-?\d+_-?\d+$/.test(String(id || ''));
  }

  function getRevealAreaTileIds(center = {}, radius = 1) {
    const coord = normalizeCoord(center);
    const safeRadius = Math.max(0, toInteger(radius, 1));
    const ids = [];
    for (let dq = -safeRadius; dq <= safeRadius; dq += 1) {
      for (let dr = -safeRadius; dr <= safeRadius; dr += 1) {
        ids.push(getWorldTileId(coord.q + dq, coord.r + dr));
      }
    }
    return ids;
  }

  function normalizeRevealedTileIds(revealedTileIds = [], route = []) {
    const ids = new Set();
    (Array.isArray(revealedTileIds) ? revealedTileIds : [])
      .map(String)
      .filter(isCanonicalWorldTileId)
      .forEach((id) => ids.add(id));
    (Array.isArray(route) ? route : [])
      .filter((step) => step?.revealed)
      .map((step) => normalizeCoord(step).tileId)
      .filter(isCanonicalWorldTileId)
      .forEach((id) => ids.add(id));
    return [...ids].sort();
  }

  function normalizeWorldExplorerMission(mission = {}) {
    if (!mission || typeof mission !== 'object') return null;
    const route = (Array.isArray(mission.route) ? mission.route : []).map(normalizeRouteStep);
    if (!route.length) return null;
    return {
      id: mission.id || '',
      kind: 'worldExplore',
      direction: mission.mode || 'random',
      status: mission.status || '',
      origin: mission.origin && typeof mission.origin === 'object'
        ? normalizeCoord(mission.origin)
        : null,
      target: mission.target && typeof mission.target === 'object'
        ? normalizeCoord(mission.target)
        : null,
      position: mission.position && typeof mission.position === 'object'
        ? normalizeCoord(mission.position)
        : null,
      actionPoints: route.length,
      actionPointsRemaining: route.filter((step) => !step.revealed).length,
      route,
      revealArea: route,
      revealedTileIds: normalizeRevealedTileIds(mission.revealedTileIds, route),
      stepDurationMs: Math.max(1000, toInteger(
        mission.stepDurationMs,
        Math.max(1, toNumber(mission.stepDurationSeconds, 0)) * 1000,
      )),
      stepDurationSeconds: toInteger(mission.stepDurationSeconds, 0),
      startedAt: mission.startedAt || '',
      nextStepAt: mission.nextStepAt || '',
      completesAt: mission.completesAt || '',
      completedAt: mission.completedAt || '',
    };
  }

  function mergeWorldExplorerMissions(worldExplorerState = {}) {
    const fromList = Array.isArray(worldExplorerState.missions) ? worldExplorerState.missions : [];
    const fromSlots = [
      worldExplorerState.activeMission,
      ...(Array.isArray(worldExplorerState.idleMissions) ? worldExplorerState.idleMissions : []),
    ].filter(Boolean);
    const byId = new Map();
    [...fromList, ...fromSlots].forEach((mission) => {
      if (!mission || typeof mission !== 'object') return;
      const id = mission.id || `explore-${byId.size}`;
      const existing = byId.get(id);
      if (!existing) {
        byId.set(id, mission);
        return;
      }
      const keepRichArray = (key) => (
        Array.isArray(mission[key]) && mission[key].length
          ? mission[key]
          : (Array.isArray(existing[key]) ? existing[key] : mission[key])
      );
      byId.set(id, {
        ...existing,
        ...mission,
        route: keepRichArray('route'),
        plannedTiles: keepRichArray('plannedTiles'),
        plannedSites: keepRichArray('plannedSites'),
        revealedTileIds: keepRichArray('revealedTileIds'),
      });
    });
    return [...byId.values()];
  }

  function getWorldExplorerMissions(worldExplorerState = {}, options = {}) {
    const worldMarchSystem = options.worldMarchSystem || sharedWorldMarchSystem;
    const nowMs = getEpochNowMs(options);
    const missions = mergeWorldExplorerMissions(worldExplorerState).map((mission) => (
      worldMarchSystem?.deriveMissionForTime
        ? worldMarchSystem.deriveMissionForTime(mission, { nowMs })
        : mission
    )).filter(Boolean);
    global.WorldMarchTrace?.logDedup?.(
      'presenter:missions',
      missions.map((mission) => `${mission.id}:${mission.status}:${(mission.revealedTileIds || []).length}`).join(',') || 'none',
      {
        nowMs,
        missions: missions.map((mission) => global.WorldMarchTrace?.summarizeMission?.(mission)),
      },
    );
    return missions;
  }

  function getMissionRenderReadyTileIds(mission = {}, options = {}) {
    const worldMarchSystem = options.worldMarchSystem || sharedWorldMarchSystem;
    const nowMs = getEpochNowMs(options);
    const ids = new Set();
    (Array.isArray(mission.renderReadyTileIds) ? mission.renderReadyTileIds : [])
      .map(String)
      .filter(isCanonicalWorldTileId)
      .forEach((id) => ids.add(id));
    if (typeof worldMarchSystem?.getRouteRenderReadyTileIds === 'function') {
      worldMarchSystem.getRouteRenderReadyTileIds(mission, nowMs)
        .map(String)
        .filter(isCanonicalWorldTileId)
        .forEach((id) => ids.add(id));
    }
    const route = Array.isArray(mission.route) ? mission.route.map(normalizeRouteStep) : [];
    const renderReadyRouteIds = new Set(ids);
    route
      .filter((step) => renderReadyRouteIds.has(step.tileId))
      .forEach((step) => {
        getRevealAreaTileIds(step, 1)
          .filter(isCanonicalWorldTileId)
          .forEach((id) => ids.add(id));
      });
    return ids;
  }

  function getWorldExplorerPlannedTiles(worldExplorerState = {}, options = {}) {
    const byId = new Map();
    mergeWorldExplorerMissions(worldExplorerState).forEach((mission) => {
      const revealedTileIds = new Set((mission.revealedTileIds || []).map(String));
      const revealedRouteTileIds = new Set((Array.isArray(mission.route) ? mission.route : [])
        .filter((step) => step?.revealed)
        .map((step) => normalizeCoord(step).tileId));
      const renderReadyTileIds = getMissionRenderReadyTileIds(mission, options);
      (Array.isArray(mission.plannedTiles) ? mission.plannedTiles : []).forEach((tile) => {
        if (!tile || typeof tile !== 'object') return;
        const coord = normalizeCoord(tile);
        const q = coord.q;
        const r = coord.r;
        const id = coord.tileId;
        const isServerRevealed = revealedTileIds.has(id) || revealedRouteTileIds.has(id);
        const isRenderReady = renderReadyTileIds.has(id);
        if (!isServerRevealed && !isRenderReady) return;
        byId.set(id, {
          ...tile,
          id,
          q,
          r,
          visibility: tile.visibility || 'scouted',
          discovered: tile.discovered !== false,
          visible: tile.visible !== false,
          renderReady: isRenderReady,
          renderOnly: !isServerRevealed && isRenderReady,
        });
      });
    });
    const plannedTiles = [...byId.values()];
    global.WorldMarchTrace?.logDedup?.(
      'presenter:plannedTiles',
      plannedTiles.map((tile) => normalizeCoord(tile).tileId).join(',') || 'none',
      {
        plannedTiles: global.WorldMarchTrace?.summarizePlannedTiles?.(plannedTiles),
        source: global.WorldMarchTrace?.summarizeWorldExplorerState?.(worldExplorerState),
      },
    );
    return plannedTiles;
  }

  function getWorldExplorerPlannedSites(worldExplorerState = {}, options = {}) {
    const byId = new Map();
    void options;
    mergeWorldExplorerMissions(worldExplorerState).forEach((mission) => {
      const revealedTileIds = new Set((mission.revealedTileIds || []).map(String));
      const routeByTileId = new Map((Array.isArray(mission.route) ? mission.route : []).map((step) => [
        normalizeCoord(step).tileId,
        step,
      ]));
      (Array.isArray(mission.plannedSites) ? mission.plannedSites : []).forEach((plannedSite) => {
        if (!plannedSite || typeof plannedSite !== 'object') return;
        const rawSite = plannedSite.site && typeof plannedSite.site === 'object' ? plannedSite.site : null;
        const coord = normalizeCoord(plannedSite, rawSite || {});
        const q = coord.q;
        const r = coord.r;
        const tileId = coord.tileId;
        const routeStep = routeByTileId.get(tileId);
        if (!plannedSite.materialized && !plannedSite.revealedAt && !revealedTileIds.has(tileId) && !routeStep?.revealed) return;
        const id = plannedSite.siteId || rawSite?.id || `site_${q}_${r}`;
        byId.set(id, {
          ...(rawSite || {}),
          id,
          x: toInteger(rawSite?.x ?? q),
          y: toInteger(rawSite?.y ?? r),
          naturalName: rawSite?.naturalName || rawSite?.cityName || '绌哄煄',
          cityName: rawSite?.cityName || null,
          type: rawSite?.type || 'town',
          owner: rawSite?.owner || 'neutral',
          status: rawSite?.status || 'discovered',
          art: rawSite?.art || '',
        });
      });
    });
    const plannedSites = [...byId.values()];
    global.WorldMarchTrace?.logDedup?.(
      'presenter:plannedSites',
      plannedSites.map((site) => site.id || `site_${site.x}_${site.y}`).join(',') || 'none',
      {
        plannedSites: {
          count: plannedSites.length,
          ids: plannedSites.map((site) => site.id || `site_${site.x}_${site.y}`).slice(0, 8),
        },
        source: global.WorldMarchTrace?.summarizeWorldExplorerState?.(worldExplorerState),
      },
    );
    return plannedSites;
  }

  const WorldTileMapExplorerNormalizer = Object.freeze({
    toNumber,
    toInteger,
    getWorldTileId,
    getEpochNowMs,
    normalizeCoord,
    isCanonicalWorldTileId,
    getRevealAreaTileIds,
    normalizeRevealedTileIds,
    normalizeWorldExplorerMission,
    mergeWorldExplorerMissions,
    getWorldExplorerMissions,
    getMissionRenderReadyTileIds,
    getWorldExplorerPlannedTiles,
    getWorldExplorerPlannedSites,
  });

  global.WorldTileMapExplorerNormalizer = WorldTileMapExplorerNormalizer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldTileMapExplorerNormalizer;
})(typeof window !== 'undefined' ? window : globalThis);
