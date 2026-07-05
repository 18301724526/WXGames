(function (global) {
  // MarchCommandBuilder -- pure construction of optimistic world-march commands.
  //
  // Every function here is a pure function of its arguments: it reads the supplied
  // game `state` snapshot and a plain `ctx` ({ nowMs, sequence, config }) and returns
  // new plain objects. It NEVER touches a host, a store, the network, or the DOM.
  // The orchestrator (state/optimistic/index.js) supplies nowMs/sequence/config and
  // applies the results (registering the pending descriptor, writing host.state,
  // rendering). This module is the single home for the march geometry/mission helpers
  // shared by the reconciler and the orchestrator.
  const WorldMarchCore = (() => {
    if (global.WorldMarchCore) return global.WorldMarchCore;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../../../shared/worldMarchCore');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const DEFAULT_STEP_DURATION_MS = 10000;
  const DEFAULT_RECONCILE_THRESHOLD_TILES = 0.75;

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function toInteger(value, fallback = 0) {
    const number = toNumber(value, fallback);
    return Number.isFinite(number) ? Math.floor(number) : fallback;
  }

  function tileId(q, r) {
    return WorldMarchCore.tileId(q, r);
  }

  function normalizeCoord(coord = {}, fallback = {}) {
    return WorldMarchCore.normalizeCoord(coord, fallback);
  }

  function clonePlain(value) {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(clonePlain);
    const output = {};
    Object.entries(value).forEach(([key, next]) => {
      if (typeof next !== 'function') output[key] = clonePlain(next);
    });
    return output;
  }

  function toIso(ms) {
    return new Date(Math.max(0, Math.floor(toNumber(ms, 0)))).toISOString();
  }

  function getStepDurationMs(config = {}, explorer = {}) {
    const configured = toInteger(
      config.WORLD_MARCH_STEP_DURATION_MS ??
        config.worldMarchStepDurationMs ??
        explorer.stepDurationMs,
      0,
    );
    if (configured > 0) return Math.max(1000, configured);
    const seconds = toNumber(explorer.stepDurationSeconds, DEFAULT_STEP_DURATION_MS / 1000);
    return Math.max(1000, Math.floor(seconds * 1000));
  }

  function getReconcileThresholdTiles(config = {}, fallbackTiles) {
    return Math.max(
      0,
      toNumber(
        config.WORLD_MARCH_RECONCILE_THRESHOLD_TILES ??
          config.worldMarchReconcileThresholdTiles ??
          fallbackTiles,
        DEFAULT_RECONCILE_THRESHOLD_TILES,
      ),
    );
  }

  function getMissionList(explorer = {}) {
    const result = [];
    const seen = new Set();
    const append = (mission) => {
      if (!mission || typeof mission !== 'object') return;
      const id = mission.id || `mission-${result.length}`;
      if (seen.has(id)) return;
      seen.add(id);
      result.push(mission.id ? mission : { ...mission, id });
    };
    (Array.isArray(explorer.missions) ? explorer.missions : []).forEach(append);
    append(explorer.activeMission);
    (Array.isArray(explorer.idleMissions) ? explorer.idleMissions : []).forEach(append);
    return result;
  }

  function getFormationKey(formation = {}) {
    return `${formation?.cityId || 'capital'}:${Math.max(1, toInteger(formation?.slot, 1))}`;
  }

  function getMissionFormationKey(mission = {}) {
    return getFormationKey(mission.formation || {});
  }

  function getRouteSignature(route = []) {
    return (Array.isArray(route) ? route : [])
      .map((step) => {
        const coord = normalizeCoord(step);
        return `${coord.q}:${coord.r}`;
      })
      .join('|');
  }

  function isSameRoute(a = {}, b = {}) {
    return getRouteSignature(a.route) === getRouteSignature(b.route);
  }

  function coordDistanceTiles(a = {}, b = {}) {
    const aq = toNumber(a.q ?? a.x, 0);
    const ar = toNumber(a.r ?? a.y, 0);
    const bq = toNumber(b.q ?? b.x, 0);
    const br = toNumber(b.r ?? b.y, 0);
    return Math.max(Math.abs(aq - bq), Math.abs(ar - br));
  }

  function getCurrentCoord(mission = {}, nowMs = 0) {
    if (WorldMarchCore?.getCurrentCoord) return WorldMarchCore.getCurrentCoord(mission, nowMs);
    return normalizeCoord(mission.position || mission.origin || mission.target || {});
  }

  function chooseStopTile(mission = {}, nowMs = 0) {
    if (WorldMarchCore?.chooseStopTile) return WorldMarchCore.chooseStopTile(mission, nowMs);
    return normalizeCoord(mission.position || mission.origin || mission.target || {});
  }

  function rebuildExplorer(baseExplorer = {}, missions = []) {
    const cleanMissions = [];
    const seen = new Set();
    (Array.isArray(missions) ? missions : []).forEach((mission) => {
      if (!mission || typeof mission !== 'object') return;
      const id = mission.id || `mission-${cleanMissions.length}`;
      if (seen.has(id)) return;
      seen.add(id);
      cleanMissions.push(mission.id ? mission : { ...mission, id });
    });
    const activeMission = cleanMissions.find((mission) => mission.status === 'active') || null;
    const idleMissions = cleanMissions.filter((mission) => mission.status === 'idle');
    const busyFormations = cleanMissions
      .filter((mission) => mission.status === 'active')
      .map((mission) => ({
        cityId: mission.formation?.cityId || mission.origin?.cityId || 'capital',
        slot: Math.max(1, toInteger(mission.formation?.slot, 1)),
        missionId: mission.id || '',
        status: mission.status || 'active',
      }));
    return {
      ...(baseExplorer || {}),
      missions: cleanMissions,
      activeMission,
      idleMissions,
      busyFormations,
    };
  }

  function getActiveCityId(state = {}, options = {}) {
    return (
      options.cityId ||
      state.activeCityId ||
      state.cityState?.activeCityId ||
      state.cityState?.capitalCityId ||
      'capital'
    );
  }

  function findTerritoryCoord(state = {}, cityId = 'capital') {
    const territoryState = state.territoryState || {};
    const territories = [
      ...(Array.isArray(territoryState.territories) ? territoryState.territories : []),
      ...(Array.isArray(state.territories) ? state.territories : []),
    ];
    const city =
      state.cities?.[cityId] ||
      (Array.isArray(state.cityState?.cities)
        ? state.cityState.cities.find((item) => item?.id === cityId)
        : null) ||
      null;
    const territoryId = city?.territoryId || cityId;
    const territory =
      territories.find((item) => item?.id === territoryId || item?.id === cityId) ||
      territories.find(
        (item) => item?.id === state.cityState?.capitalCityId || item?.id === 'capital',
      ) ||
      null;
    if (territory) {
      return {
        q: toInteger(territory.q ?? territory.x, 0),
        r: toInteger(territory.r ?? territory.y, 0),
        cityId,
        territoryId: territory.id || territoryId || cityId,
      };
    }
    const tiles = Array.isArray(territoryState.worldMap?.tiles)
      ? territoryState.worldMap.tiles
      : [];
    const tile =
      tiles.find((item) => item?.siteId === territoryId || item?.siteId === cityId) ||
      tiles.find(
        (item) => item?.siteId === state.cityState?.capitalCityId || item?.siteId === 'capital',
      ) ||
      null;
    if (tile) {
      return {
        q: toInteger(tile.q ?? tile.x, 0),
        r: toInteger(tile.r ?? tile.y, 0),
        cityId,
        territoryId: tile.siteId || territoryId || cityId,
      };
    }
    const origin = territoryState.worldMap?.origin || {};
    return {
      q: toInteger(origin.q ?? origin.x, 0),
      r: toInteger(origin.r ?? origin.y, 0),
      cityId,
      territoryId: cityId,
    };
  }

  function findIdleMissionForFormation(explorer = {}, formation = {}) {
    const key = getFormationKey(formation);
    return (
      getMissionList(explorer).find(
        (mission) => mission?.status === 'idle' && getMissionFormationKey(mission) === key,
      ) || null
    );
  }

  function getExplicitMissionId(options = {}) {
    return String(options.missionId || options.actorId || '').trim();
  }

  function findMissionById(explorer = {}, missionId = '') {
    if (!missionId) return null;
    return getMissionList(explorer).find((mission) => mission.id === missionId) || null;
  }

  function resolveStartOrigin(state = {}, formation = {}, mission = null, nowMs = 0) {
    if (mission) {
      return normalizeCoord(
        getCurrentCoord(mission, nowMs) ||
          mission.position ||
          mission.target ||
          mission.origin ||
          {},
      );
    }
    const explorer = state.worldExplorerState || {};
    const idleMission = findIdleMissionForFormation(explorer, formation);
    if (idleMission) {
      return normalizeCoord(idleMission.position || idleMission.target || idleMission.origin || {});
    }
    return normalizeCoord(
      findTerritoryCoord(state, formation.cityId || state.activeCityId || 'capital'),
    );
  }

  // Single source of truth for optimistic march geometry. Delegates to the shared march core's
  // axis-aligned builder with the SAME options the server's WorldExplorerRoutePlanner.buildManualRoute
  // and the client's WorldMarchRoutePolicy preview use, so the optimistically-drawn route is
  // identical (same q,r staircase, same route signature) to the authoritative route the server
  // returns. Previously this reimplemented a DIAGONAL stepping loop; once the server switched to
  // grid-axis (staircase) routes it diverged, and the reconciler rubber-banded the marching unit
  // between the two — the classic two-sources-of-truth bug.
  function buildLinearRoute(origin = {}, target = {}, maxLength = 0) {
    const start = normalizeCoord(origin);
    const end = normalizeCoord(target, start);
    const cap = Math.max(0, toInteger(maxLength, 0)) || WorldMarchCore.MAX_MANUAL_ROUTE_LENGTH || 16;
    const result = WorldMarchCore.evaluateLinearMarchRoute(start, end, {
      axisAligned: true,
      maxLength: cap,
      width: 1024,
      height: 1024,
      wrapping: true,
    });
    if (!result || result.success !== true || !Array.isArray(result.route)) return [];
    return result.route.map((step) => ({
      q: step.q,
      r: step.r,
      step: step.step,
      tileId: step.tileId || tileId(step.q, step.r),
      dir: step.dir,
      revealed: false,
      revealedAt: null,
    }));
  }

  function makeMissionTiming(route = [], nowMs = 0, stepDurationMs = DEFAULT_STEP_DURATION_MS) {
    const startedAt = toIso(nowMs);
    if (!route.length) {
      return {
        startedAt,
        nextStepAt: null,
        completesAt: startedAt,
        completedAt: startedAt,
      };
    }
    return {
      startedAt,
      nextStepAt: toIso(nowMs + stepDurationMs),
      completesAt: toIso(nowMs + stepDurationMs * route.length),
      completedAt: null,
    };
  }

  function getPlannedTiles(route = []) {
    return (Array.isArray(route) ? route : []).map((step) => ({
      id: step.tileId || tileId(step.q, step.r),
      tileId: step.tileId || tileId(step.q, step.r),
      q: step.q,
      r: step.r,
      visibility: 'scouted',
      optimistic: true,
    }));
  }

  function applyOptimisticMission(explorer = {}, mission = {}, previousId = '') {
    const missions = getMissionList(explorer).filter(
      (item) => item.id !== mission.id && (!previousId || item.id !== previousId),
    );
    missions.push(mission);
    return rebuildExplorer(explorer, missions);
  }

  // buildStart -- pure. Returns { pending, mission, nextExplorer } or null when no
  // route can be built. `ctx` = { nowMs, sequence, config }. The orchestrator owns
  // nowMs/sequence/config resolution and applies nextExplorer + pending.
  function buildStart(state = {}, options = {}, ctx = {}) {
    const explorer = state.worldExplorerState || {};
    const nowMs = toNumber(ctx.nowMs, 0);
    const config = ctx.config || {};
    const formation = {
      cityId: options.cityId || getActiveCityId(state, options),
      slot: Math.max(1, toInteger(options.formationSlot ?? options.slot, 1)),
    };
    const explicitMissionId = getExplicitMissionId(options);
    const idleMission = explicitMissionId
      ? findMissionById(explorer, explicitMissionId)
      : findIdleMissionForFormation(explorer, formation);
    if (explicitMissionId && !idleMission) return null;
    const origin = resolveStartOrigin(state, formation, idleMission, nowMs);
    const target = normalizeCoord(
      {
        q: options.targetQ ?? options.q ?? options.x,
        r: options.targetR ?? options.r ?? options.y,
      },
      origin,
    );
    const route = buildLinearRoute(origin, target, explorer.maxManualRouteLength || 0);
    if (!route.length) return null;
    const stepDurationMs = getStepDurationMs(config, explorer);
    const pendingId = `optimistic_manual_${nowMs}_${toInteger(ctx.sequence, 0)}`;
    const missionId = idleMission?.id || pendingId;
    const mission = {
      id: missionId,
      kind: 'worldExplore',
      mode: 'manual',
      status: 'active',
      origin,
      homeOrigin: normalizeCoord(idleMission?.homeOrigin || origin, origin),
      target: route.at(-1) || target,
      route,
      plannedTiles: getPlannedTiles(route),
      plannedSites: [],
      formation: {
        ...formation,
        ...(idleMission?.formation || {}),
      },
      formationSnapshot: idleMission?.formationSnapshot || null,
      position: origin,
      revealedTileIds: [],
      stepDurationSeconds: Math.floor(stepDurationMs / 1000),
      stepDurationMs,
      ...makeMissionTiming(route, nowMs, stepDurationMs),
      _optimistic: {
        pending: true,
        pendingId,
        action: 'startWorldMarch',
      },
    };
    const pending = {
      pendingId,
      missionId,
      explicitMissionId,
      action: 'startWorldMarch',
      previousExplorer: clonePlain(explorer),
      formation,
      routeSignature: getRouteSignature(route),
      target,
      createdAtMs: nowMs,
    };
    const nextExplorer = applyOptimisticMission(explorer, mission, idleMission?.id || '');
    return { pending, mission, nextExplorer };
  }

  // buildReturn -- pure. Returns { pending, mission, nextExplorer } or null when the
  // mission cannot be found. `ctx` = { nowMs, config }.
  function buildReturn(state = {}, missionId = '', options = {}, ctx = {}) {
    const explorer = state.worldExplorerState || {};
    const mission = getMissionList(explorer).find((item) => item.id === missionId) || null;
    if (!mission) return null;
    const nowMs = toNumber(ctx.nowMs, 0);
    const config = ctx.config || {};
    const stepDurationMs = getStepDurationMs(config, explorer);
    const routeOrigin = normalizeCoord(
      options.origin ||
        chooseStopTile(mission, nowMs) ||
        getCurrentCoord(mission, nowMs) ||
        mission.position ||
        mission.origin,
    );
    const homeOrigin = normalizeCoord(
      mission.homeOrigin || mission.origin || routeOrigin,
      routeOrigin,
    );
    const route = buildLinearRoute(routeOrigin, homeOrigin, explorer.maxManualRouteLength || 0);
    const nextMission = {
      ...clonePlain(mission),
      id: mission.id,
      status: route.length ? 'active' : 'idle',
      origin: routeOrigin,
      homeOrigin,
      target: route.at(-1) || homeOrigin,
      route,
      plannedTiles: getPlannedTiles(route),
      plannedSites: [],
      position: route.length ? routeOrigin : homeOrigin,
      revealedTileIds: [],
      stepDurationSeconds: Math.floor(stepDurationMs / 1000),
      stepDurationMs,
      ...makeMissionTiming(route, nowMs, stepDurationMs),
      _optimistic: {
        pending: true,
        pendingId: mission.id,
        action: 'returnWorldMarch',
      },
    };
    const pending = {
      pendingId: mission.id,
      missionId: mission.id,
      action: 'returnWorldMarch',
      previousExplorer: clonePlain(explorer),
      formation: clonePlain(mission.formation || {}),
      routeSignature: getRouteSignature(route),
      target: homeOrigin,
      createdAtMs: nowMs,
    };
    const nextExplorer = applyOptimisticMission(explorer, nextMission, mission.id);
    return { pending, mission: nextMission, nextExplorer };
  }

  const api = Object.freeze({
    DEFAULT_STEP_DURATION_MS,
    DEFAULT_RECONCILE_THRESHOLD_TILES,
    applyOptimisticMission,
    buildLinearRoute,
    buildReturn,
    buildStart,
    chooseStopTile,
    clonePlain,
    coordDistanceTiles,
    findIdleMissionForFormation,
    findMissionById,
    findTerritoryCoord,
    getActiveCityId,
    getCurrentCoord,
    getExplicitMissionId,
    getFormationKey,
    getMissionFormationKey,
    getMissionList,
    getPlannedTiles,
    getReconcileThresholdTiles,
    getRouteSignature,
    getStepDurationMs,
    isSameRoute,
    makeMissionTiming,
    normalizeCoord,
    rebuildExplorer,
    resolveStartOrigin,
    tileId,
    toInteger,
    toIso,
    toNumber,
  });

  global.MarchCommandBuilder = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
