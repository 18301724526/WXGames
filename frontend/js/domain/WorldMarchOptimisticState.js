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

  const SLOW_SYNC_MESSAGE =
    '\u7f51\u7edc\u8fde\u63a5\u7f13\u6162\uff0c\u6b63\u5728\u5c1d\u8bd5\u540c\u6b65';
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
    if (WorldMarchCore?.tileId) return WorldMarchCore.tileId(q, r);
    return `tile_${toInteger(q)}_${toInteger(r)}`;
  }

  function normalizeCoord(coord = {}, fallback = {}) {
    if (WorldMarchCore?.normalizeCoord) return WorldMarchCore.normalizeCoord(coord, fallback);
    const source = coord && typeof coord === 'object' ? coord : {};
    const base = fallback && typeof fallback === 'object' ? fallback : {};
    const q = toInteger(source.q ?? source.x, base.q ?? base.x ?? 0);
    const r = toInteger(source.r ?? source.y, base.r ?? base.y ?? 0);
    return { q, r, tileId: tileId(q, r) };
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

  function getNowMs(host = {}) {
    const worldNow = host.getWorldEpochNowMs?.();
    if (Number.isFinite(Number(worldNow))) return Number(worldNow);
    const runtimeNow = host.runtime?.now?.();
    if (Number.isFinite(Number(runtimeNow))) return Number(runtimeNow);
    const schedulerNow = host.scheduler?.now?.();
    if (Number.isFinite(Number(schedulerNow))) return Number(schedulerNow);
    return Date.now();
  }

  function toIso(ms) {
    return new Date(Math.max(0, Math.floor(toNumber(ms, 0)))).toISOString();
  }

  function getStepDurationMs(host = {}, explorer = {}) {
    const configured = toInteger(
      host.config?.WORLD_MARCH_STEP_DURATION_MS ??
        host.config?.worldMarchStepDurationMs ??
        explorer.stepDurationMs,
      0,
    );
    if (configured > 0) return Math.max(1000, configured);
    const seconds = toNumber(explorer.stepDurationSeconds, DEFAULT_STEP_DURATION_MS / 1000);
    return Math.max(1000, Math.floor(seconds * 1000));
  }

  function getReconcileThresholdTiles(host = {}) {
    return Math.max(
      0,
      toNumber(
        host.config?.WORLD_MARCH_RECONCILE_THRESHOLD_TILES ??
          host.config?.worldMarchReconcileThresholdTiles ??
          host.worldMarchOptimistic?.thresholdTiles,
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

  function ensureStore(host = {}) {
    if (!host || typeof host !== 'object')
      return { sequence: 0, pending: Object.create(null), aliases: Object.create(null) };
    if (!host.worldMarchOptimistic || typeof host.worldMarchOptimistic !== 'object') {
      host.worldMarchOptimistic = {
        sequence: 0,
        pending: Object.create(null),
        aliases: Object.create(null),
        thresholdTiles: getReconcileThresholdTiles(host),
      };
    }
    if (!host.worldMarchOptimistic.pending) host.worldMarchOptimistic.pending = Object.create(null);
    if (!host.worldMarchOptimistic.aliases) host.worldMarchOptimistic.aliases = Object.create(null);
    return host.worldMarchOptimistic;
  }

  function getState(host = {}) {
    return host.lastGame?.state || host.state || {};
  }

  function getExplorer(host = {}) {
    return getState(host).worldExplorerState || {};
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

  function setExplorer(host = {}, explorer = {}) {
    if (!host || typeof host !== 'object') return false;
    const currentState = getState(host);
    const nextState = {
      ...(currentState || {}),
      worldExplorerState: explorer,
    };
    if (host.lastGame && host.lastGame !== host && typeof host.lastGame === 'object') {
      host.lastGame.state = nextState;
    }
    host.state = nextState;
    if (host.stateManager && typeof host.stateManager === 'object') {
      host.stateManager.state = {
        ...(host.stateManager.state || {}),
        ...nextState,
      };
    }
    if (host.canvasShell && typeof host.canvasShell === 'object') {
      host.canvasShell.state = nextState;
    }
    return true;
  }

  function requestImmediateRender(host = {}, options = {}) {
    const tab = host.state?.currentTab || host.getActiveTab?.() || host.activeTab || 'military';
    if (typeof host.renderCanvasSurface === 'function') {
      host.renderCanvasSurface(tab);
    } else if (typeof host.render === 'function') {
      host.render();
    }
    const epochNowMs = options.epochNowMs ?? getNowMs(host);
    host.updateWorldActorAnimationLoop?.({ force: true, state: host.state, epochNowMs });
    host.requestWorldActorAnimationFrame?.({ force: true, state: host.state, epochNowMs });
    host.canvasShell?.requestWorldMapRenderAnimationFrame?.({
      force: true,
      invalidateWorldTileView: false,
    });
    return true;
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

  function resolveStartOrigin(host = {}, formation = {}, mission = null, nowMs = 0) {
    if (mission) {
      return normalizeCoord(
        getCurrentCoord(mission, nowMs) ||
          mission.position ||
          mission.target ||
          mission.origin ||
          {},
      );
    }
    const state = getState(host);
    const explorer = state.worldExplorerState || {};
    const idleMission = findIdleMissionForFormation(explorer, formation);
    if (idleMission) {
      return normalizeCoord(idleMission.position || idleMission.target || idleMission.origin || {});
    }
    return normalizeCoord(
      findTerritoryCoord(state, formation.cityId || state.activeCityId || 'capital'),
    );
  }

  function buildLinearRoute(origin = {}, target = {}, maxLength = 0) {
    const start = normalizeCoord(origin);
    const end = normalizeCoord(target, start);
    const distance = Math.max(Math.abs(end.q - start.q), Math.abs(end.r - start.r));
    const limit = Math.max(0, toInteger(maxLength, distance));
    if (distance <= 0 || (limit > 0 && distance > limit)) return [];
    const route = [];
    let q = start.q;
    let r = start.r;
    let remainingQ = end.q - start.q;
    let remainingR = end.r - start.r;
    for (let step = 1; step <= distance; step += 1) {
      const stepQ = Math.sign(remainingQ);
      const stepR = Math.sign(remainingR);
      q += stepQ;
      r += stepR;
      remainingQ -= stepQ;
      remainingR -= stepR;
      route.push({
        q,
        r,
        step,
        tileId: tileId(q, r),
        revealed: false,
        revealedAt: null,
      });
    }
    return route;
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

  function applyOptimisticMission(host = {}, mission = {}, previousId = '') {
    const explorer = getExplorer(host);
    const missions = getMissionList(explorer).filter(
      (item) => item.id !== mission.id && (!previousId || item.id !== previousId),
    );
    missions.push(mission);
    const nextExplorer = rebuildExplorer(explorer, missions);
    setExplorer(host, nextExplorer);
    return nextExplorer;
  }

  function registerPending(host = {}, pending = {}) {
    const store = ensureStore(host);
    store.pending[pending.pendingId] = pending;
    if (pending.missionId && pending.missionId !== pending.pendingId) {
      store.aliases[pending.missionId] = pending.pendingId;
    }
    return pending;
  }

  function beginStart(host = {}, options = {}) {
    const state = getState(host);
    const explorer = state.worldExplorerState || {};
    const nowMs = getNowMs(host);
    const store = ensureStore(host);
    const formation = {
      cityId: options.cityId || getActiveCityId(state, options),
      slot: Math.max(1, toInteger(options.formationSlot ?? options.slot, 1)),
    };
    const explicitMissionId = getExplicitMissionId(options);
    const idleMission = explicitMissionId
      ? findMissionById(explorer, explicitMissionId)
      : findIdleMissionForFormation(explorer, formation);
    if (explicitMissionId && !idleMission) return null;
    const origin = resolveStartOrigin(host, formation, idleMission, nowMs);
    const target = normalizeCoord(
      {
        q: options.targetQ ?? options.q ?? options.x,
        r: options.targetR ?? options.r ?? options.y,
      },
      origin,
    );
    const route = buildLinearRoute(origin, target, explorer.maxManualRouteLength || 0);
    if (!route.length) return null;
    const stepDurationMs = getStepDurationMs(host, explorer);
    const pendingId = `optimistic_manual_${nowMs}_${++store.sequence}`;
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
    const pending = registerPending(host, {
      pendingId,
      missionId,
      explicitMissionId,
      action: 'startWorldMarch',
      previousExplorer: clonePlain(explorer),
      formation,
      routeSignature: getRouteSignature(route),
      target,
      createdAtMs: nowMs,
    });
    applyOptimisticMission(host, mission, idleMission?.id || '');
    requestImmediateRender(host, { epochNowMs: nowMs });
    return { ...pending, mission };
  }

  function beginReturn(host = {}, missionId = '', options = {}) {
    const explorer = getExplorer(host);
    const mission = getMissionList(explorer).find((item) => item.id === missionId) || null;
    if (!mission) return null;
    const nowMs = getNowMs(host);
    const stepDurationMs = getStepDurationMs(host, explorer);
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
    const pending = registerPending(host, {
      pendingId: mission.id,
      missionId: mission.id,
      action: 'returnWorldMarch',
      previousExplorer: clonePlain(explorer),
      formation: clonePlain(mission.formation || {}),
      routeSignature: getRouteSignature(route),
      target: homeOrigin,
      createdAtMs: nowMs,
    });
    applyOptimisticMission(host, nextMission, mission.id);
    requestImmediateRender(host, { epochNowMs: nowMs });
    return { ...pending, mission: nextMission };
  }

  function removePending(host = {}, pendingId = '') {
    const store = ensureStore(host);
    const pending = store.pending[pendingId] || store.pending[store.aliases[pendingId]] || null;
    if (!pending) return false;
    delete store.pending[pending.pendingId];
    Object.entries(store.aliases).forEach(([alias, id]) => {
      if (id === pending.pendingId || alias === pending.pendingId) delete store.aliases[alias];
    });
    return true;
  }

  function rollback(host = {}, pendingRef = '', options = {}) {
    const store = ensureStore(host);
    const pendingId =
      typeof pendingRef === 'string'
        ? store.aliases[pendingRef] || pendingRef
        : pendingRef?.pendingId;
    const pending = store.pending[pendingId] || null;
    if (!pending) return false;
    const previousExplorer = clonePlain(pending.previousExplorer || {});
    setExplorer(host, previousExplorer);
    removePending(host, pending.pendingId);
    if (options.render !== false) requestImmediateRender(host);
    return true;
  }

  function matchPendingAuthority(pending = {}, authorityMissions = []) {
    const idMatch = authorityMissions.find((mission) => mission.id === pending.missionId);
    if (pending.explicitMissionId) return idMatch || null;
    return (
      idMatch ||
      authorityMissions.find(
        (mission) =>
          getMissionFormationKey(mission) === getFormationKey(pending.formation) &&
          (!pending.routeSignature || getRouteSignature(mission.route) === pending.routeSignature),
      ) ||
      authorityMissions.find(
        (mission) =>
          getMissionFormationKey(mission) === getFormationKey(pending.formation) &&
          coordDistanceTiles(mission.target || {}, pending.target || {}) <= 0,
      )
    );
  }

  function markSlowSync(host = {}, detail = {}) {
    if (!host || typeof host !== 'object') return false;
    host.networkState = {
      ...(host.networkState || {}),
      status: 'reconnecting',
      failureCount: Math.max(1, toInteger(host.networkState?.failureCount, 0)),
      message: SLOW_SYNC_MESSAGE,
      worldMarchReconciliation: {
        slow: true,
        ...detail,
      },
    };
    if (host.canvasShell?.setNetworkState) host.canvasShell.setNetworkState(host.networkState);
    else host.canvasShell && (host.canvasShell.networkState = host.networkState);
    return true;
  }

  function mergeAuthorityIntoLocal(localMission = {}, authorityMission = {}, pending = null) {
    return {
      ...clonePlain(authorityMission),
      ...clonePlain(localMission),
      id: authorityMission.id || localMission.id,
      formation: clonePlain(authorityMission.formation || localMission.formation || {}),
      formationSnapshot: clonePlain(
        authorityMission.formationSnapshot || localMission.formationSnapshot || null,
      ),
      plannedTiles: clonePlain(authorityMission.plannedTiles || localMission.plannedTiles || []),
      plannedSites: clonePlain(authorityMission.plannedSites || localMission.plannedSites || []),
      _optimistic: {
        ...(localMission._optimistic || {}),
        pending: Boolean(pending),
        pendingId: pending?.pendingId || localMission._optimistic?.pendingId || '',
        authorityId: authorityMission.id || '',
        reconciled: true,
      },
    };
  }

  function reconcileWorldExplorerState(host = {}, serverExplorer = {}, options = {}) {
    if (!serverExplorer || typeof serverExplorer !== 'object') return serverExplorer;
    const nowMs = options.epochNowMs ?? getNowMs(host);
    const threshold = getReconcileThresholdTiles(host);
    const store = ensureStore(host);
    const localExplorer = getExplorer(host);
    const localMissions = getMissionList(localExplorer);
    const serverMissions = getMissionList(serverExplorer).map(clonePlain);
    const byServerId = new Map(serverMissions.map((mission) => [mission.id, mission]));
    const usedServerIds = new Set();
    const nextMissions = serverMissions.slice();

    const replaceServerMission = (serverMission = {}, nextMission = {}) => {
      const index = nextMissions.findIndex((mission) => mission.id === serverMission.id);
      if (index >= 0) nextMissions[index] = nextMission;
      else nextMissions.push(nextMission);
      usedServerIds.add(serverMission.id);
    };

    Object.values(store.pending || {}).forEach((pending) => {
      const localMission =
        localMissions.find(
          (mission) =>
            mission.id === pending.missionId ||
            mission.id === pending.pendingId ||
            mission._optimistic?.pendingId === pending.pendingId,
        ) || null;
      const authorityMission = matchPendingAuthority(pending, serverMissions);
      if (!localMission) return;
      if (!authorityMission) {
        nextMissions.push(clonePlain(localMission));
        return;
      }
      store.aliases[authorityMission.id] = pending.pendingId;
      pending.authorityId = authorityMission.id;
      if (pending.action === 'returnWorldMarch' && !isSameRoute(localMission, authorityMission)) {
        replaceServerMission(authorityMission, {
          ...authorityMission,
          _optimistic: {
            pending: false,
            pendingId: pending.pendingId,
            action: pending.action,
            authorityId: authorityMission.id,
            reconciled: true,
          },
        });
        return;
      }
      const localCurrent = getCurrentCoord(localMission, nowMs);
      const authorityCurrent = getCurrentCoord(authorityMission, nowMs);
      const diffTiles = coordDistanceTiles(localCurrent, authorityCurrent);
      if (isSameRoute(localMission, authorityMission) && diffTiles <= threshold) {
        replaceServerMission(
          authorityMission,
          mergeAuthorityIntoLocal(localMission, authorityMission, pending),
        );
        return;
      }
      markSlowSync(host, {
        missionId: authorityMission.id || localMission.id || '',
        diffTiles,
        threshold,
      });
      replaceServerMission(authorityMission, {
        ...authorityMission,
        _optimistic: {
          pending: false,
          pendingId: pending.pendingId,
          action: pending.action,
          authorityId: authorityMission.id,
          pullback: true,
          diffTiles,
        },
      });
    });

    localMissions.forEach((localMission) => {
      const serverMission = byServerId.get(localMission.id);
      if (!serverMission || usedServerIds.has(serverMission.id)) return;
      if (!isSameRoute(localMission, serverMission)) return;
      const localCurrent = getCurrentCoord(localMission, nowMs);
      const authorityCurrent = getCurrentCoord(serverMission, nowMs);
      const diffTiles = coordDistanceTiles(localCurrent, authorityCurrent);
      if (diffTiles <= threshold) {
        replaceServerMission(
          serverMission,
          mergeAuthorityIntoLocal(localMission, serverMission, null),
        );
      } else {
        markSlowSync(host, {
          missionId: serverMission.id || localMission.id || '',
          diffTiles,
          threshold,
        });
      }
    });

    return rebuildExplorer(serverExplorer, nextMissions);
  }

  function reconcileState(host = {}, serverState = {}, options = {}) {
    if (!serverState || typeof serverState !== 'object' || !serverState.worldExplorerState)
      return serverState;
    const worldExplorerState = reconcileWorldExplorerState(
      host,
      serverState.worldExplorerState,
      options,
    );
    return {
      ...serverState,
      worldExplorerState,
    };
  }

  function buildClientReport(host = {}, options = {}) {
    const state = options.state || getState(host);
    const explorer = state.worldExplorerState || {};
    const nowMs = options.epochNowMs ?? getNowMs(host);
    const missions = getMissionList(explorer)
      .filter((mission) => mission?.status === 'active')
      .slice(0, 12)
      .map((mission) => {
        const current = getCurrentCoord(mission, nowMs);
        return {
          missionId: mission.id || '',
          clientTime: toIso(nowMs),
          position: {
            q: toNumber(current.q ?? current.x, 0),
            r: toNumber(current.r ?? current.y, 0),
            tileId: tileId(current.q ?? current.x, current.r ?? current.y),
          },
        };
      })
      .filter((mission) => mission.missionId);
    if (!missions.length) return null;
    return {
      schema: 'world-march-client-report-batch-v1',
      clientTime: toIso(nowMs),
      missions,
    };
  }

  function complete(host = {}, pendingRef = '') {
    return removePending(
      host,
      typeof pendingRef === 'string'
        ? pendingRef
        : pendingRef?.pendingId || pendingRef?.missionId || '',
    );
  }

  const api = {
    SLOW_SYNC_MESSAGE,
    buildClientReport,
    beginReturn,
    beginStart,
    buildLinearRoute,
    complete,
    coordDistanceTiles,
    ensureStore,
    getMissionList,
    getReconcileThresholdTiles,
    normalizeCoord,
    reconcileState,
    reconcileWorldExplorerState,
    requestImmediateRender,
    rollback,
  };

  global.WorldMarchOptimisticState = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
