(function (global) {
  const SignatureHash = (() => {
    if (global.SignatureHash) return global.SignatureHash;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../shared/SignatureHash');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const VisibilityModel = (() => {
    if (global.WorldMapVisibilityModel) return global.WorldMapVisibilityModel;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldMapVisibilityModel');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const WorldActorProjection = (() => {
    if (global.WorldActorProjection) return global.WorldActorProjection;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldActorProjection');
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

  function tileId(q, r) {
    return VisibilityModel.tileId(q, r);
  }

  function normalizeCoord(source = {}, fallback = {}) {
    return VisibilityModel.normalizeCoord(source, fallback);
  }

  function hashStep(hash, value) {
    return SignatureHash.hashStep(hash, value);
  }

  function createIndex() {
    return Object.create(null);
  }

  function normalizeTile(tile = {}, visibilitySnapshot = null) {
    const coord = normalizeCoord(tile);
    const visibilityLevel = VisibilityModel?.getLevel
      ? VisibilityModel.getLevel(visibilitySnapshot, coord.tileId)
      : 0;
    return {
      id: coord.tileId,
      q: coord.q,
      r: coord.r,
      terrain: tile.terrain || 'plains',
      siteId: tile.siteId || null,
      visibilityLevel,
      visibility: VisibilityModel?.levelName?.(visibilityLevel) || tile.visibility || 'unknown',
      discovered: visibilityLevel > 0 || tile.discovered !== false,
      riverPorts: Array.isArray(tile.riverPorts) ? tile.riverPorts.filter(Boolean) : [],
      oceanTemplates: Array.isArray(tile.oceanTemplates) ? tile.oceanTemplates.filter(Boolean) : [],
      transitionKey: typeof tile.transitionKey === 'string' ? tile.transitionKey : '',
    };
  }

  function normalizeSite(site = {}) {
    const coord = normalizeCoord(site);
    return {
      id: site.id || site.siteId || `site_${coord.q}_${coord.r}`,
      q: coord.q,
      r: coord.r,
      tileId: coord.tileId,
      type: site.type || 'town',
      status: site.status || '',
      owner: site.owner || '',
      name: site.cityName || site.naturalName || site.name || '',
      art: site.art || '',
      intelLevel: toInteger(site.intel?.level, site.owner === 'player' ? 4 : 1),
    };
  }

  function getMissionList(worldExplorerState = {}, extraMissions = []) {
    const result = [];
    const seen = new Set();
    const append = (mission) => {
      if (!mission || typeof mission !== 'object') return;
      const id = mission.id || `mission-${result.length}`;
      if (seen.has(id)) return;
      seen.add(id);
      result.push(mission);
    };
    (Array.isArray(extraMissions) ? extraMissions : []).forEach(append);
    (Array.isArray(worldExplorerState.missions) ? worldExplorerState.missions : []).forEach(append);
    append(worldExplorerState.activeMission);
    (Array.isArray(worldExplorerState.idleMissions) ? worldExplorerState.idleMissions : []).forEach(
      append,
    );
    return result;
  }

  function normalizeMission(mission = {}) {
    const origin = normalizeCoord(mission.origin || {});
    const target = normalizeCoord(mission.target || mission.route?.at?.(-1) || origin, origin);
    const position = normalizeCoord(mission.position || origin, origin);
    return {
      id: mission.id || '',
      kind: mission.kind || 'worldExplore',
      mode: mission.mode || '',
      status: mission.status || '',
      origin,
      target,
      position,
      routeLength: Array.isArray(mission.route) ? mission.route.length : 0,
      revealedCount: Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds.length : 0,
      formationCityId: mission.formation?.cityId || origin.cityId || 'capital',
      formationSlot: Math.max(1, toInteger(mission.formation?.slot, 1)),
    };
  }

  function normalizeActor(actor = {}) {
    const current = normalizeCoord(actor.current || actor.position || {});
    const missionId = actor.missionId || actor.id || '';
    return {
      id: missionId || `actor_${current.tileId}`,
      missionId,
      type: actor.type || 'scout',
      kind: actor.kind || '',
      status: actor.status || '',
      tileId: current.tileId,
      q: current.q,
      r: current.r,
      unitKey: actor.unitKey || 'scout_squad_default',
      animationId: actor.animationId || 'idle',
      remainingSeconds: Math.max(0, toInteger(actor.remainingSeconds, 0)),
      // Preserve the combat encounter linkage so clicking a hostile force
      // carries combatEncounterId through to startWorldMarch (otherwise the
      // attack is sent as a plain march and the backend rejects target==origin).
      ...(actor.combatTarget
        ? {
            combatTarget: actor.combatTarget,
            combatEncounterId: actor.combatTarget.encounterId,
          }
        : {}),
    };
  }

  function buildActors(worldExplorerState = {}, options = {}) {
    if (Array.isArray(options.actors)) return options.actors.map(normalizeActor);
    if (WorldActorProjection?.projectWorldActors)
      return WorldActorProjection.projectWorldActors(worldExplorerState, options).map(
        normalizeActor,
      );
    return [];
  }

  function buildIndex(items = []) {
    const index = createIndex();
    for (let i = 0; i < items.length; i += 1) index[items[i].id] = i;
    return index;
  }

  function createSnapshot(input = {}, options = {}) {
    const territoryState = input.territoryState || {};
    const worldMap = input.worldMap || territoryState.worldMap || {};
    const worldExplorerState = input.worldExplorerState || {};
    const visibility =
      input.visibilitySnapshot ||
      VisibilityModel?.createSnapshot?.(
        {
          territoryState,
          worldMap,
          worldExplorerState,
          missions: input.missions,
        },
        options,
      ) ||
      null;
    const rawTiles = Array.isArray(input.tiles)
      ? input.tiles
      : Array.isArray(worldMap.tiles)
        ? worldMap.tiles
        : [];
    const rawSites = Array.isArray(input.sites)
      ? input.sites
      : Array.isArray(territoryState.territories)
        ? territoryState.territories
        : [];
    const missions = getMissionList(worldExplorerState, input.missions).map(normalizeMission);
    const actors = buildActors(worldExplorerState, options);
    const tiles = new Array(rawTiles.length);
    for (let i = 0; i < rawTiles.length; i += 1) tiles[i] = normalizeTile(rawTiles[i], visibility);
    const sites = rawSites.map(normalizeSite);
    let hash = SignatureHash.FNV_OFFSET_BASIS;
    const feed = (items) => {
      for (let i = 0; i < items.length; i += 1) {
        hash = hashStep(hash, items[i].id);
        hash = hashStep(hash, items[i].status || items[i].terrain || items[i].tileId || '');
        hash = hashStep(
          hash,
          items[i].visibilityLevel ?? items[i].revealedCount ?? items[i].remainingSeconds ?? '',
        );
      }
    };
    feed(tiles);
    feed(sites);
    feed(missions);
    feed(actors);
    return {
      schema: 'world-map-entity-snapshot-v1',
      version: worldMap.version || input.version || 0,
      seed: worldMap.seed || input.seed || '',
      visibility,
      tiles,
      sites,
      missions,
      actors,
      indexById: {
        tiles: buildIndex(tiles),
        sites: buildIndex(sites),
        missions: buildIndex(missions),
        actors: buildIndex(actors),
      },
      counts: {
        tiles: tiles.length,
        sites: sites.length,
        missions: missions.length,
        actors: actors.length,
      },
      signature: `${worldMap.version || input.version || 0}:${tiles.length}:${sites.length}:${missions.length}:${actors.length}:${(hash >>> 0).toString(16)}`,
    };
  }

  function getEntity(snapshot = {}, kind = '', id = '') {
    const collection = snapshot[kind];
    const index = snapshot.indexById?.[kind]?.[String(id)];
    return Array.isArray(collection) && index !== undefined ? collection[index] : null;
  }

  const api = {
    createSnapshot,
    getEntity,
    normalizeActor,
    normalizeCoord,
    normalizeMission,
    normalizeSite,
    normalizeTile,
    tileId,
  };

  global.WorldMapEntitySnapshot = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
