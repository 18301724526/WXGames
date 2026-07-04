(function (global) {
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../resource/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  function t(key, params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
  }
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

  const WorldTime = (() => {
    if (global.WorldTime) return global.WorldTime;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../foundation/WorldTime');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const TileCoord = (() => {
    if (global.TileCoord) return global.TileCoord;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../foundation/TileCoord');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const WorldMarchCore = (() => {
    if (global.WorldMarchCore) return global.WorldMarchCore;
    if (typeof module !== 'undefined' && module.exports) {
      return require('../../../../shared/worldMarchCore');
    }
    throw new Error(
      'WorldMarchCore is required: load WorldMarchCoreAdapter.js before WorldMarchProgressSnapshot.js',
    );
  })();

  const STATUS_ACTIVE = 'active';
  const STATUS_IDLE = 'idle';
  const ARRIVAL_NONE = 'none';
  const ARRIVAL_IDLE = 'idle';

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function toInteger(value, fallback = 0) {
    const number = toNumber(value, fallback);
    return Number.isFinite(number) ? Math.floor(number) : fallback;
  }

  function toTimestamp(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    const epochMs = WorldTime?.toEpochMs?.(value, Number.NaN);
    if (Number.isFinite(epochMs)) return epochMs;
    const stamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(stamp) ? stamp : fallback;
  }

  function tileId(q, r) {
    return TileCoord.tileId(q, r);
  }

  function normalizeCoord(coord = {}, fallback = {}) {
    const normalized = TileCoord.normalizeCoord(coord, fallback);
    return {
      q: normalized.x,
      r: normalized.y,
      tileId: normalized.tileId,
    };
  }

  function normalizeRoute(route = []) {
    return (Array.isArray(route) ? route : [])
      .map((step, index) => {
        if (!step || typeof step !== 'object') return null;
        return {
          ...normalizeCoord(step),
          step: Math.max(1, toInteger(step.step, index + 1)),
          revealed: Boolean(step.revealed),
          routeRevealedExplicit: Object.prototype.hasOwnProperty.call(step, 'revealed'),
          revealedAt: step.revealedAt || null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.step - b.step);
  }

  function getMissionPath(mission = {}) {
    return WorldMarchCore.getMissionPath(mission);
  }

  function getMissionStepDurationMs(mission = {}) {
    return WorldMarchCore.getMissionStepDurationMs(mission);
  }

  function getMissionDurationMs(mission = {}) {
    return WorldMarchCore.getMissionDurationMs(mission);
  }

  function getMissionProgress(mission = {}, nowMs = Date.now()) {
    return WorldMarchCore.getMissionProgress(mission, nowMs);
  }

  function isExpiredActiveMission(mission = {}, nowMs = Date.now()) {
    return WorldMarchCore.isExpiredActiveMission(mission, nowMs);
  }

  function getEffectiveMissionStatus(mission = {}, nowMs = Date.now()) {
    return WorldMarchCore.getEffectiveMissionStatus(mission, nowMs);
  }

  function getArrivalKind(status = '') {
    return WorldMarchCore.getArrivalKind(status);
  }

  function getRouteStepRevealTimeMs(mission = {}, step = {}) {
    return WorldMarchCore.getRouteStepRevealTimeMs(mission, step);
  }

  function isRouteStepTimeRevealed(mission = {}, step = {}, nowMs = Date.now()) {
    return WorldMarchCore.isRouteStepTimeRevealed(mission, step, nowMs);
  }

  function isRouteStepRevealed(
    mission = {},
    step = {},
    nowMs = Date.now(),
    revealedTileIds = null,
  ) {
    return WorldMarchCore.isRouteStepRevealed(mission, step, nowMs, revealedTileIds);
  }

  function deriveMissionForTime(mission = {}, options = {}) {
    if (!mission || typeof mission !== 'object') return null;
    const nowMs = toNumber(options.nowMs, Date.now());
    const coreDerived = WorldMarchCore.deriveMissionForTime(mission, { nowMs });
    if (!coreDerived) return null;
    const route = (Array.isArray(coreDerived.route) ? coreDerived.route : []).map((step) => {
      const revealAtMs = toNumber(step.revealedAtMs, Number.NaN);
      const { revealedAtMs, ...rest } = step;
      return {
        ...rest,
        revealedAt:
          rest.revealedAt ||
          (rest.revealed && Number.isFinite(revealAtMs)
            ? new Date(revealAtMs).toISOString()
            : null),
      };
    });
    const nextStepAtMs = toNumber(coreDerived.nextStepAtMs, Number.NaN);
    return {
      ...coreDerived,
      route,
      nextStepAt:
        Number.isFinite(nextStepAtMs) && coreDerived.status === STATUS_ACTIVE
          ? new Date(nextStepAtMs).toISOString()
          : null,
    };
  }

  function getCurrentCoord(mission = {}, nowMs = Date.now()) {
    return WorldMarchCore.getCurrentCoord(mission, nowMs);
  }

  function getRouteRenderAheadTileId(mission = {}, nowMs = Date.now()) {
    return WorldMarchCore.getRouteRenderAheadTileId(mission, nowMs);
  }

  function getRouteRenderReadyTileIds(mission = {}, nowMs = Date.now()) {
    return WorldMarchCore.getRouteRenderReadyTileIds(mission, nowMs);
  }

  function getRouteRenderRevealSources(mission = {}, nowMs = Date.now()) {
    return WorldMarchCore.getRouteRenderRevealSources(mission, nowMs);
  }

  function getRouteRenderRevealSignature(mission = {}, nowMs = Date.now()) {
    return WorldMarchCore.getRouteRenderRevealSignature(mission, nowMs);
  }

  function chooseStopTile(mission = {}, nowMs = Date.now()) {
    return WorldMarchCore.chooseStopTile(mission, nowMs);
  }

  function getRemainingSeconds(mission = {}, nowMs = Date.now()) {
    return WorldMarchCore.getRemainingSeconds(mission, nowMs);
  }

  function getTravelRemainingSeconds(mission = {}, nowMs = Date.now()) {
    return WorldMarchCore.getTravelRemainingSeconds(mission, nowMs);
  }

  function getFormationLabel(formation = {}, fallbackSlot = 1) {
    const slot = Math.max(1, toInteger(formation.slot, fallbackSlot));
    return formation.name || t('military.formation.default', { slot });
  }

  function normalizeFormation(formation = {}, origin = {}) {
    return {
      cityId: formation.cityId || origin.cityId || 'capital',
      slot: Math.max(1, toInteger(formation.slot, 1)),
      memberIds: Array.isArray(formation.memberIds) ? formation.memberIds.map(String) : [],
      label: getFormationLabel(formation, formation.slot || 1),
    };
  }

  function buildActorFromMission(mission = {}, options = {}) {
    if (!mission) return null;
    const nowMs = toNumber(options.nowMs, Date.now());
    const status = getEffectiveMissionStatus(mission, nowMs);
    if (![STATUS_ACTIVE, STATUS_IDLE].includes(status)) return null;
    const route = normalizeRoute(mission.route);
    if (!route.length && status !== STATUS_IDLE) return null;
    const effectiveMission = status === mission.status ? mission : { ...mission, status };
    const origin = normalizeCoord(mission.origin || {});
    const routeTarget = route.length ? route[route.length - 1] : null;
    const target = normalizeCoord(
      mission.target || mission.position || routeTarget || origin,
      routeTarget || mission.position || origin,
    );
    const idlePosition = mission.status === STATUS_IDLE ? mission.position || target : target;
    const current =
      status === STATUS_IDLE
        ? normalizeCoord(idlePosition, target)
        : getCurrentCoord(effectiveMission, nowMs);
    const stopTile = chooseStopTile(effectiveMission, nowMs);
    const formation = mission.formation || {};
    return {
      id: mission.id || '',
      missionId: mission.id || '',
      type: 'scout',
      status,
      unitKey: mission.unitKey || 'scout_squad_default',
      animationId: status === STATUS_IDLE ? 'idle' : 'move',
      origin,
      target,
      current,
      stopTile,
      route,
      renderAheadTileId: getRouteRenderAheadTileId(mission, nowMs),
      renderReadyTileIds: getRouteRenderReadyTileIds(mission, nowMs),
      formation: normalizeFormation(formation, origin),
      progress: getMissionProgress(effectiveMission, nowMs),
      remainingSeconds: getRemainingSeconds(effectiveMission, nowMs),
      travelRemainingSeconds: getTravelRemainingSeconds(effectiveMission, nowMs),
    };
  }

  function getMissionList(input = {}, extraMissions = []) {
    const worldExplorerState = input?.worldExplorerState || input || {};
    const result = [];
    const seen = new Set();
    const append = (mission) => {
      if (!mission || typeof mission !== 'object') return;
      const id = mission.id || `mission-${result.length}`;
      if (seen.has(id)) return;
      seen.add(id);
      result.push(mission.id ? mission : { ...mission, id });
    };
    (Array.isArray(extraMissions) ? extraMissions : []).forEach(append);
    (Array.isArray(worldExplorerState.missions) ? worldExplorerState.missions : []).forEach(append);
    append(worldExplorerState.activeMission);
    (Array.isArray(worldExplorerState.idleMissions) ? worldExplorerState.idleMissions : []).forEach(
      append,
    );
    return result;
  }

  function hasActiveMission(input = {}, options = {}) {
    const nowMs = toTimestamp(options.nowMs ?? options.epochNowMs, Date.now());
    return getMissionList(input, options.missions || input.missions).some(
      (mission) => getEffectiveMissionStatus(mission, nowMs) === STATUS_ACTIVE,
    );
  }

  function normalizeMissionProgress(mission = {}, options = {}) {
    const nowMs = toNumber(options.nowMs, Date.now());
    const id = String(mission.id || options.id || `mission-${toInteger(options.index, 0)}`);
    const source = mission.id ? mission : { ...mission, id };
    const status = getEffectiveMissionStatus(source, nowMs);
    const effectiveMission = status === source.status ? source : { ...source, status };
    const route = normalizeRoute(source.route);
    const origin = normalizeCoord(source.origin || {});
    const homeOrigin = normalizeCoord(source.homeOrigin || source.origin || {}, origin);
    const routeTarget = route.length ? route[route.length - 1] : null;
    const target = normalizeCoord(
      source.target || routeTarget || source.position || origin,
      routeTarget || source.position || origin,
    );
    const isRouteBackedIdle = status === STATUS_IDLE && route.length > 0;
    const idlePositionSource =
      source.status === STATUS_IDLE
        ? source.position || (isRouteBackedIdle ? target : source.origin) || target
        : target;
    const position =
      status === STATUS_IDLE
        ? normalizeCoord(idlePositionSource, target)
        : normalizeCoord(source.position || source.origin || target, target);
    const progress = getMissionProgress(effectiveMission, nowMs);
    const current = status === STATUS_IDLE ? position : getCurrentCoord(effectiveMission, nowMs);
    const stopTile = chooseStopTile(effectiveMission, nowMs);
    const renderAheadTileId = getRouteRenderAheadTileId(source, nowMs);
    const renderReadyTileIds = getRouteRenderReadyTileIds(source, nowMs);
    const remainingSeconds = getRemainingSeconds(effectiveMission, nowMs);
    const travelRemainingSeconds = getTravelRemainingSeconds(effectiveMission, nowMs);
    const arrivalKind = getArrivalKind(status);
    return {
      id,
      kind: source.kind || 'worldExplore',
      mode: source.mode || '',
      status,
      rawStatus: source.status || '',
      unitKey: source.unitKey || 'scout_squad_default',
      origin,
      homeOrigin,
      target,
      position,
      current,
      stopTile,
      renderAheadTileId,
      renderReadyTileIds,
      route,
      routeLength: route.length,
      revealedCount: Array.isArray(source.revealedTileIds)
        ? source.revealedTileIds.length
        : route.filter((step) => step.revealed).length,
      progress,
      remainingSeconds,
      travelRemainingSeconds,
      nextStepAt: source.nextStepAt || null,
      nextStepAtMs: toTimestamp(source.nextStepAt, Number.NaN),
      startedAt: source.startedAt || null,
      startedAtMs: toTimestamp(source.startedAt, Number.NaN),
      completesAt: source.completesAt || null,
      completesAtMs: toTimestamp(source.completesAt, Number.NaN),
      completedAt: source.completedAt || null,
      completedAtMs: toTimestamp(source.completedAt, Number.NaN),
      arrivalKind,
      arrived: arrivalKind !== ARRIVAL_NONE,
      actorId:
        [STATUS_ACTIVE, STATUS_IDLE].includes(status) && (route.length || status === STATUS_IDLE)
          ? id
          : '',
      formation: normalizeFormation(source.formation || {}, origin),
      formationSnapshot:
        source.formationSnapshot && typeof source.formationSnapshot === 'object'
          ? JSON.parse(JSON.stringify(source.formationSnapshot))
          : null,
    };
  }

  function buildActorFromProgress(row = {}) {
    if (!row || ![STATUS_ACTIVE, STATUS_IDLE].includes(row.status)) return null;
    if (row.status !== STATUS_IDLE && !row.routeLength) return null;
    return {
      id: row.id || '',
      missionId: row.id || '',
      type: 'scout',
      status: row.status,
      unitKey: row.unitKey || 'scout_squad_default',
      animationId: row.status === STATUS_IDLE ? 'idle' : 'move',
      origin: row.origin,
      target: row.target,
      current: row.status === STATUS_IDLE ? row.current || row.position || row.target : row.current,
      stopTile: row.stopTile,
      renderAheadTileId: row.renderAheadTileId || null,
      renderReadyTileIds: Array.isArray(row.renderReadyTileIds) ? row.renderReadyTileIds : [],
      route: row.route,
      formation: row.formation,
      formationSnapshot: row.formationSnapshot || null,
      progress: row.progress,
      remainingSeconds: row.remainingSeconds,
      travelRemainingSeconds: row.travelRemainingSeconds,
    };
  }

  function buildArrivalFromProgress(row = {}) {
    if (!row || row.arrivalKind === ARRIVAL_NONE) return null;
    return {
      id: row.id || '',
      missionId: row.id || '',
      kind: row.kind || 'worldExplore',
      mode: row.mode || '',
      status: row.status || '',
      arrivalKind: row.arrivalKind,
      target: row.target,
      stopTile: row.stopTile,
      remainingSeconds: 0,
      travelRemainingSeconds: 0,
      completedAt: row.completedAt || null,
      completedAtMs: row.completedAtMs,
      claimable: false,
      parked: row.arrivalKind === ARRIVAL_IDLE,
    };
  }

  function buildActors(worldExplorerState = {}, options = {}) {
    const snapshot = createSnapshot(worldExplorerState, options);
    return snapshot.actors;
  }

  function hashStep(hash, value) {
    return SignatureHash.hashStep(hash, value);
  }

  function buildIndex(items = []) {
    const index = Object.create(null);
    for (let i = 0; i < items.length; i += 1) index[items[i].id] = i;
    return index;
  }

  function createSnapshot(input = {}, options = {}) {
    const nowMs = toTimestamp(options.nowMs ?? input.nowMs ?? input.epochNowMs, Date.now());
    const missionsRaw = getMissionList(input, options.missions || input.missions);
    const missions = new Array(missionsRaw.length);
    const actors = [];
    const arrivals = [];
    const counts = { missions: missionsRaw.length, actors: 0, arrivals: 0, active: 0, idle: 0 };
    let hash = SignatureHash.FNV_OFFSET_BASIS;
    for (let i = 0; i < missionsRaw.length; i += 1) {
      const mission = normalizeMissionProgress(missionsRaw[i], { ...options, nowMs, index: i });
      missions[i] = mission;
      if (mission.status === STATUS_ACTIVE) counts.active += 1;
      if (mission.status === STATUS_IDLE) counts.idle += 1;
      const actor = buildActorFromProgress(mission);
      if (actor) actors.push(actor);
      const arrival = buildArrivalFromProgress(mission);
      if (arrival) arrivals.push(arrival);
      hash = hashStep(hash, mission.id);
      hash = hashStep(hash, mission.status);
      hash = hashStep(hash, mission.mode);
      hash = hashStep(hash, mission.arrivalKind);
      hash = hashStep(hash, Math.round(mission.progress.progress * 10000));
      hash = hashStep(hash, Math.round(toNumber(mission.current?.q) * 1000));
      hash = hashStep(hash, Math.round(toNumber(mission.current?.r) * 1000));
      hash = hashStep(hash, mission.remainingSeconds);
    }
    counts.actors = actors.length;
    counts.arrivals = arrivals.length;
    const timeBucketMs = Math.max(1, toInteger(options.signatureTimeBucketMs, 1000));
    return {
      schema: 'world-march-progress-snapshot-v1',
      nowMs,
      timeBucket: Math.floor(nowMs / timeBucketMs),
      missions,
      actors,
      arrivals,
      indexById: {
        missions: buildIndex(missions),
        actors: buildIndex(actors),
        arrivals: buildIndex(arrivals),
      },
      counts,
      signature: `${Math.floor(nowMs / timeBucketMs)}:${missions.length}:${actors.length}:${arrivals.length}:${(hash >>> 0).toString(16)}`,
    };
  }

  function getById(snapshot = {}, kind = '', id = '') {
    const collection = snapshot[kind];
    const index = snapshot.indexById?.[kind]?.[String(id)];
    return Array.isArray(collection) && index !== undefined ? collection[index] : null;
  }

  function getMission(snapshot = {}, id = '') {
    return getById(snapshot, 'missions', id);
  }

  function getActor(snapshot = {}, id = '') {
    return getById(snapshot, 'actors', id);
  }

  function getArrival(snapshot = {}, id = '') {
    return getById(snapshot, 'arrivals', id);
  }

  function getArrivals(snapshot = {}) {
    return Array.isArray(snapshot.arrivals) ? snapshot.arrivals : [];
  }

  function toSerializable(snapshot = {}) {
    return {
      schema: snapshot.schema || 'world-march-progress-snapshot-v1',
      nowMs: snapshot.nowMs || 0,
      timeBucket: snapshot.timeBucket || 0,
      missions: Array.isArray(snapshot.missions) ? snapshot.missions : [],
      actors: Array.isArray(snapshot.actors) ? snapshot.actors : [],
      arrivals: Array.isArray(snapshot.arrivals) ? snapshot.arrivals : [],
      counts: snapshot.counts || { missions: 0, actors: 0, arrivals: 0, active: 0, idle: 0 },
      signature: snapshot.signature || '',
    };
  }

  const api = {
    STATUS_ACTIVE,
    STATUS_IDLE,
    ARRIVAL_NONE,
    ARRIVAL_IDLE,
    toNumber,
    toInteger,
    toTimestamp,
    tileId,
    normalizeCoord,
    normalizeRoute,
    getMissionPath,
    getMissionDurationMs,
    getMissionStepDurationMs,
    getMissionProgress,
    isExpiredActiveMission,
    getEffectiveMissionStatus,
    getArrivalKind,
    getRouteStepRevealTimeMs,
    isRouteStepTimeRevealed,
    isRouteStepRevealed,
    deriveMissionForTime,
    getCurrentCoord,
    getRouteRenderAheadTileId,
    getRouteRenderReadyTileIds,
    getRouteRenderRevealSources,
    getRouteRenderRevealSignature,
    chooseStopTile,
    getRemainingSeconds,
    getTravelRemainingSeconds,
    getFormationLabel,
    hasActiveMission,
    normalizeMissionProgress,
    buildActorFromMission,
    buildActorFromProgress,
    buildActors,
    buildArrivalFromProgress,
    createSnapshot,
    getMission,
    getActor,
    getArrival,
    getArrivals,
    toSerializable,
  };

  global.WorldMarchProgressSnapshot = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
