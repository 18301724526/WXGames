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
      try {
        return require('../../../../shared/worldMarchCore');
      } catch (_error) {
        return null;
      }
    }
    return null;
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

  function hasCoordPair(source = {}) {
    if (!source || typeof source !== 'object') return false;
    const hasX = source.x !== undefined || source.q !== undefined;
    const hasY = source.y !== undefined || source.r !== undefined;
    return hasX && hasY;
  }

  function addTileAlias(aliases, value, canonicalId) {
    if (!value || !canonicalId) return;
    const alias = String(value);
    const ids = aliases.get(alias) || new Set();
    ids.add(String(canonicalId));
    aliases.set(alias, ids);
  }

  function createRouteTileAliasMap(route = []) {
    const aliases = new Map();
    (Array.isArray(route) ? route : []).forEach((step) => {
      if (!hasCoordPair(step)) return;
      const normalized = normalizeCoord(step);
      addTileAlias(aliases, normalized.tileId, normalized.tileId);
      addTileAlias(aliases, step.tileId, normalized.tileId);
      addTileAlias(aliases, step.id, normalized.tileId);
    });
    return aliases;
  }

  function getMissionPath(mission = {}) {
    if (WorldMarchCore?.getMissionPath) return WorldMarchCore.getMissionPath(mission);
    const origin = normalizeCoord(mission.origin || {});
    const route = normalizeRoute(mission.route);
    if (!route.length && mission.status === STATUS_IDLE) {
      return [
        origin,
        normalizeCoord(mission.position || mission.target || mission.origin || {}, origin),
      ];
    }
    return [origin, ...route];
  }

  function getMissionStepDurationMs(mission = {}) {
    if (WorldMarchCore?.getMissionStepDurationMs)
      return WorldMarchCore.getMissionStepDurationMs(mission);
    return Math.max(
      1000,
      toInteger(
        mission.stepDurationMs,
        Math.max(1, toNumber(mission.stepDurationSeconds, 10)) * 1000,
      ),
    );
  }

  function getMissionDurationMs(mission = {}) {
    if (WorldMarchCore?.getMissionDurationMs) return WorldMarchCore.getMissionDurationMs(mission);
    const route = normalizeRoute(mission.route);
    const stepDurationMs = getMissionStepDurationMs(mission);
    return Math.max(stepDurationMs, route.length * stepDurationMs);
  }

  function getMissionProgress(mission = {}, nowMs = Date.now()) {
    if (WorldMarchCore?.getMissionProgress)
      return WorldMarchCore.getMissionProgress(mission, nowMs);
    const route = normalizeRoute(mission.route);
    if (!route.length) {
      return { progress: 0, segmentIndex: 0, segmentProgress: 0, elapsedMs: 0, durationMs: 0 };
    }
    if (mission.status === STATUS_IDLE) {
      const durationMs = getMissionDurationMs(mission);
      return {
        progress: 1,
        segmentIndex: Math.max(0, route.length - 1),
        segmentProgress: 1,
        elapsedMs: durationMs,
        durationMs,
      };
    }
    const startedAtMs = toTimestamp(mission.startedAt, Number(nowMs) || Date.now());
    const durationMs = getMissionDurationMs(mission);
    const elapsedMs = Math.max(0, toNumber(nowMs, Date.now()) - startedAtMs);
    const progress = Math.max(0, Math.min(1, elapsedMs / durationMs));
    const scaled = progress * route.length;
    const segmentIndex = Math.min(Math.max(0, route.length - 1), Math.floor(scaled));
    const segmentProgress = progress >= 1 ? 1 : Math.max(0, Math.min(1, scaled - segmentIndex));
    return { progress, segmentIndex, segmentProgress, elapsedMs, durationMs };
  }

  function isExpiredActiveMission(mission = {}, nowMs = Date.now()) {
    if (WorldMarchCore?.isExpiredActiveMission)
      return WorldMarchCore.isExpiredActiveMission(mission, nowMs);
    if (!mission || mission.status !== STATUS_ACTIVE) return false;
    const completesAtMs = toTimestamp(mission.completesAt, Number.NaN);
    return Number.isFinite(completesAtMs) && completesAtMs <= toNumber(nowMs, Date.now());
  }

  function getEffectiveMissionStatus(mission = {}, nowMs = Date.now()) {
    if (WorldMarchCore?.getEffectiveMissionStatus)
      return WorldMarchCore.getEffectiveMissionStatus(mission, nowMs);
    if (isExpiredActiveMission(mission, nowMs)) return STATUS_IDLE;
    return mission.status || '';
  }

  function getArrivalKind(status = '') {
    if (WorldMarchCore?.getArrivalKind) return WorldMarchCore.getArrivalKind(status);
    if (status === STATUS_IDLE) return ARRIVAL_IDLE;
    return ARRIVAL_NONE;
  }

  function getRouteStepRevealTimeMs(mission = {}, step = {}) {
    if (WorldMarchCore?.getRouteStepRevealTimeMs)
      return WorldMarchCore.getRouteStepRevealTimeMs(mission, step);
    const startedAtMs = toTimestamp(mission.startedAt, Number.NaN);
    if (!Number.isFinite(startedAtMs)) return Number.NaN;
    const stepIndex = Math.max(1, toInteger(step.step, 1));
    return startedAtMs + getMissionStepDurationMs(mission) * stepIndex;
  }

  function isRouteStepTimeRevealed(mission = {}, step = {}, nowMs = Date.now()) {
    if (WorldMarchCore?.isRouteStepTimeRevealed)
      return WorldMarchCore.isRouteStepTimeRevealed(mission, step, nowMs);
    const revealAtMs = getRouteStepRevealTimeMs(mission, step);
    return Number.isFinite(revealAtMs) && revealAtMs <= toNumber(nowMs, Date.now());
  }

  function createRevealedTileSet(mission = {}) {
    const routeAliases = createRouteTileAliasMap(mission.route);
    const revealed = new Set();
    (Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds : [])
      .filter(Boolean)
      .forEach((id) => {
        const aliases = routeAliases.get(String(id));
        if (aliases) {
          aliases.forEach((canonicalId) => revealed.add(canonicalId));
          return;
        }
        revealed.add(String(id));
      });
    return revealed;
  }

  function isRouteStepRevealed(
    mission = {},
    step = {},
    nowMs = Date.now(),
    revealedTileIds = null,
  ) {
    if (WorldMarchCore?.isRouteStepRevealed)
      return WorldMarchCore.isRouteStepRevealed(mission, step, nowMs, revealedTileIds);
    if (!step) return false;
    if (step.revealed) return true;
    const status = getEffectiveMissionStatus(mission, nowMs);
    if (status === STATUS_IDLE) return true;
    if (mission.status === STATUS_ACTIVE && isRouteStepTimeRevealed(mission, step, nowMs))
      return true;
    if (step.routeRevealedExplicit) return false;
    const id = step.tileId || tileId(step.q, step.r);
    const revealedSet = revealedTileIds || createRevealedTileSet(mission);
    if (revealedSet.has(id)) return true;
    if (mission.status !== STATUS_ACTIVE) return false;
    return false;
  }

  function deriveMissionForTime(mission = {}, options = {}) {
    if (!mission || typeof mission !== 'object') return null;
    const nowMs = toNumber(options.nowMs, Date.now());
    if (WorldMarchCore?.deriveMissionForTime) {
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
    const route = normalizeRoute(mission.route);
    const revealedSet = createRevealedTileSet(mission);
    const revealedRoute = route.map((step) => {
      const revealed = isRouteStepRevealed(mission, step, nowMs, revealedSet);
      const revealAtMs = getRouteStepRevealTimeMs(mission, step);
      return {
        ...step,
        revealed,
        revealedAt:
          step.revealedAt ||
          (revealed
            ? new Date(Number.isFinite(revealAtMs) ? revealAtMs : nowMs).toISOString()
            : null),
      };
    });
    const revealedTileIds = Array.from(
      new Set([
        ...revealedSet,
        ...revealedRoute
          .filter((step) => step.revealed)
          .map((step) => step.tileId || tileId(step.q, step.r)),
      ]),
    );
    const status = getEffectiveMissionStatus(mission, nowMs);
    const lastRevealed = [...revealedRoute].reverse().find((step) => step.revealed) || null;
    const nextUnrevealed = revealedRoute.find((step) => !step.revealed) || null;
    const nextStepAtMs = nextUnrevealed
      ? getRouteStepRevealTimeMs(mission, nextUnrevealed)
      : Number.NaN;
    const nextStepAt =
      Number.isFinite(nextStepAtMs) && status === STATUS_ACTIVE
        ? new Date(nextStepAtMs).toISOString()
        : null;
    const routeTarget = route.length ? route[route.length - 1] : null;
    const target = normalizeCoord(
      mission.target || routeTarget,
      routeTarget || mission.position || mission.origin || {},
    );
    const positionSource =
      status === STATUS_IDLE
        ? mission.status === STATUS_IDLE
          ? mission.position || target
          : target
        : lastRevealed || mission.position || mission.origin || target;
    const derived = {
      ...mission,
      status,
      route: revealedRoute,
      revealedTileIds,
      position: normalizeCoord(positionSource, target),
      nextStepAt,
      remainingSeconds: getRemainingSeconds({ ...mission, status, nextStepAt }, nowMs),
    };
    const trace = global.WorldMarchTrace;
    if (trace?.enabled?.()) {
      const position = normalizeCoord(positionSource, target);
      const nextStep = nextUnrevealed
        ? {
            tileId: nextUnrevealed.tileId || tileId(nextUnrevealed.q, nextUnrevealed.r),
            step: nextUnrevealed.step,
            revealAt: Number.isFinite(nextStepAtMs) ? new Date(nextStepAtMs).toISOString() : null,
          }
        : null;
      trace.logDedup?.(
        'ecs:deriveMissionForTime',
        [
          mission.id || '',
          status,
          revealedTileIds.length,
          position.tileId,
          nextStep?.tileId || '',
          Math.floor(nowMs / 10000),
        ].join('|'),
        {
          nowMs,
          mission: trace.summarizeMission?.(derived),
          nextStep,
        },
      );
    }
    return derived;
  }

  function lerp(a, b, t) {
    return toNumber(a) + (toNumber(b) - toNumber(a)) * Math.max(0, Math.min(1, toNumber(t)));
  }

  function getCurrentCoord(mission = {}, nowMs = Date.now()) {
    if (WorldMarchCore?.getCurrentCoord) return WorldMarchCore.getCurrentCoord(mission, nowMs);
    const path = getMissionPath(mission);
    if (path.length <= 1) return path[0] || normalizeCoord({});
    const progress = getMissionProgress(mission, nowMs);
    const from = path[progress.segmentIndex] || path[0];
    const to = path[progress.segmentIndex + 1] || path[path.length - 1];
    return {
      q: lerp(from.q, to.q, progress.segmentProgress),
      r: lerp(from.r, to.r, progress.segmentProgress),
      fromTileId: from.tileId,
      toTileId: to.tileId,
      segmentIndex: progress.segmentIndex,
      segmentProgress: progress.segmentProgress,
      progress: progress.progress,
    };
  }

  function getRouteRenderAheadTileId(mission = {}, nowMs = Date.now()) {
    if (WorldMarchCore?.getRouteRenderAheadTileId)
      return WorldMarchCore.getRouteRenderAheadTileId(mission, nowMs);
    if (!mission || mission.status !== STATUS_ACTIVE) return null;
    const route = normalizeRoute(mission.route);
    if (!route.length) return null;
    const progress = getMissionProgress(mission, nowMs);
    const step = route[Math.max(0, Math.min(route.length - 1, progress.segmentIndex))];
    return step?.tileId || null;
  }

  function getRouteRenderReadyTileIds(mission = {}, nowMs = Date.now()) {
    if (WorldMarchCore?.getRouteRenderReadyTileIds)
      return WorldMarchCore.getRouteRenderReadyTileIds(mission, nowMs);
    return getRouteRenderRevealSources(mission, nowMs)
      .filter((source) => toNumber(source.strength, 0) > 0)
      .map((source) => source.tileId)
      .filter(Boolean);
  }

  function appendRouteRevealSource(
    sources = [],
    coord = {},
    strength = 1,
    source = 'routeHistory',
  ) {
    const normalized = normalizeCoord(coord);
    if (!normalized.tileId) return sources;
    const nextStrength = Math.max(0, Math.min(1, toNumber(strength, 0)));
    const existing = sources.find((item) => item.tileId === normalized.tileId);
    if (existing) {
      existing.strength = Math.max(existing.strength, nextStrength);
      return sources;
    }
    sources.push({
      q: normalized.q,
      r: normalized.r,
      tileId: normalized.tileId,
      strength: nextStrength,
      source,
    });
    return sources;
  }

  function getRouteRenderRevealSources(mission = {}, nowMs = Date.now()) {
    if (WorldMarchCore?.getRouteRenderRevealSources)
      return WorldMarchCore.getRouteRenderRevealSources(mission, nowMs);
    if (!mission) return [];
    const route = normalizeRoute(mission.route);
    const revealedSet = createRevealedTileSet(mission);
    const sources = [];
    route.forEach((step) => {
      if (step.revealed || revealedSet.has(step.tileId))
        appendRouteRevealSource(sources, step, 1, 'backendReveal');
    });
    if (mission.status !== STATUS_ACTIVE) return sources;
    if (!route.length) return sources;
    const progress = getMissionProgress(mission, nowMs);
    const completedCount = Math.max(0, Math.min(route.length, progress.segmentIndex));
    route.slice(0, completedCount).forEach((step) => appendRouteRevealSource(sources, step, 1));
    const frontierStep = route[progress.segmentIndex];
    const frontierStrength = Math.max(0, Math.min(1, toNumber(progress.segmentProgress, 0)));
    if (frontierStep && frontierStrength > 0) {
      appendRouteRevealSource(
        sources,
        frontierStep,
        frontierStrength,
        frontierStrength >= 1 ? 'routeHistory' : 'routeFrontier',
      );
    }
    return sources;
  }

  function getRouteRenderRevealSignature(mission = {}, nowMs = Date.now()) {
    if (WorldMarchCore?.getRouteRenderRevealSignature)
      return WorldMarchCore.getRouteRenderRevealSignature(mission, nowMs);
    const progress = getMissionProgress(mission, nowMs);
    const sources = getRouteRenderRevealSources(mission, nowMs);
    let hash = SignatureHash.FNV_OFFSET_BASIS;
    sources.forEach((source) => {
      const text = [
        source.tileId || '',
        Math.round(Math.max(0, Math.min(1, toNumber(source.strength, 0))) * 1000),
      ].join(':');
      hash = hashStep(hash, text);
    });
    return [
      sources.length,
      progress.segmentIndex,
      Math.round(toNumber(progress.segmentProgress, 0) * 1000),
      (hash >>> 0).toString(36),
    ].join(':');
  }

  function chooseStopTile(mission = {}, nowMs = Date.now()) {
    if (WorldMarchCore?.chooseStopTile) return WorldMarchCore.chooseStopTile(mission, nowMs);
    const path = getMissionPath(mission);
    if (path.length <= 1) return path[0] || normalizeCoord({});
    const progress = getMissionProgress(mission, nowMs);
    const from = path[progress.segmentIndex] || path[0];
    const to = path[progress.segmentIndex + 1] || path[path.length - 1];
    return progress.segmentProgress >= 0.5 ? to : from;
  }

  function getRemainingSeconds(mission = {}, nowMs = Date.now()) {
    if (WorldMarchCore?.getRemainingSeconds)
      return WorldMarchCore.getRemainingSeconds(mission, nowMs);
    if (!mission || mission.status === STATUS_IDLE) return 0;
    if (WorldTime?.getRemainingSeconds) {
      return WorldTime.getRemainingSeconds(mission, nowMs);
    }
    const completesAtMs = toTimestamp(mission.completesAt, 0);
    if (completesAtMs)
      return Math.max(0, Math.ceil((completesAtMs - toNumber(nowMs, Date.now())) / 1000));
    const progress = getMissionProgress(mission, nowMs);
    return Math.max(0, Math.ceil((progress.durationMs - progress.elapsedMs) / 1000));
  }

  function getTravelRemainingSeconds(mission = {}, nowMs = Date.now()) {
    if (WorldMarchCore?.getTravelRemainingSeconds)
      return WorldMarchCore.getTravelRemainingSeconds(mission, nowMs);
    if (!mission || mission.status === STATUS_IDLE) return 0;
    const progress = getMissionProgress(mission, nowMs);
    return Math.max(0, Math.ceil((progress.durationMs - progress.elapsedMs) / 1000));
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
      renderRevealSources: getRouteRenderRevealSources(mission, nowMs),
      renderRevealSignature: getRouteRenderRevealSignature(mission, nowMs),
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
    const renderRevealSources = getRouteRenderRevealSources(source, nowMs);
    const renderRevealSignature = getRouteRenderRevealSignature(source, nowMs);
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
      renderRevealSources,
      renderRevealSignature,
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
      renderRevealSources: Array.isArray(row.renderRevealSources) ? row.renderRevealSources : [],
      renderRevealSignature: row.renderRevealSignature || '',
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
      hash = hashStep(hash, mission.renderRevealSignature);
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
