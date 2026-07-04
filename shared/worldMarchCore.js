const STATUS_ACTIVE = 'active';
const STATUS_READY = 'ready';
const STATUS_IDLE = 'idle';
const STATUS_CANCELLED = 'cancelled';
const ARRIVAL_NONE = 'none';
const ARRIVAL_IDLE = 'idle';
const FINISHED_STATUSES = Object.freeze([STATUS_READY, STATUS_IDLE, STATUS_CANCELLED]);
// Single source for the manual-route length cap: the backend route planner, the DTO the
// server sends to clients, and the client-side march target policy must all agree.
const MAX_MANUAL_ROUTE_LENGTH = 16;
const EPOCH_MILLISECONDS_THRESHOLD = 1000000000000;

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
  if (value instanceof Date) {
    const stamp = value.getTime();
    return Number.isFinite(stamp) ? stamp : fallback;
  }
  if (
    typeof value === 'number' ||
    (typeof value === 'string' && value.trim() !== '' && /^-?\d+(\.\d+)?$/.test(value.trim()))
  ) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.abs(number) < EPOCH_MILLISECONDS_THRESHOLD ? number * 1000 : number;
  }
  const stamp = Date.parse(value);
  return Number.isFinite(stamp) ? stamp : fallback;
}

function tileId(q, r) {
  return `tile_${toInteger(q)}_${toInteger(r)}`;
}

function normalizeCoord(coord = {}, fallback = {}) {
  const source = coord && typeof coord === 'object' ? coord : {};
  const base = fallback && typeof fallback === 'object' ? fallback : {};
  const q = toInteger(source.x ?? source.q, base.x ?? base.q ?? 0);
  const r = toInteger(source.y ?? source.r, base.y ?? base.r ?? 0);
  return {
    q,
    r,
    tileId: tileId(q, r),
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

function getWrappedDelta(from = {}, to = {}, options = {}) {
  const start = normalizeCoord(from);
  const end = normalizeCoord(to, start);
  const width = toInteger(options.width ?? options.worldWidth, 0);
  const height = toInteger(options.height ?? options.worldHeight, 0);
  const wrapping = options.wrapping !== false;
  const wrapAxis = (delta, size) => {
    if (!wrapping || size <= 0 || Math.abs(delta) <= size / 2) return delta;
    const wrapped = delta > 0 ? delta - size : delta + size;
    return Math.abs(wrapped) < Math.abs(delta) ? wrapped : delta;
  };
  return {
    q: wrapAxis(end.q - start.q, width),
    r: wrapAxis(end.r - start.r, height),
  };
}

function buildLinearMarchRoute(origin = {}, target = {}, options = {}) {
  const start = normalizeCoord(origin);
  const end = normalizeCoord(target, start);
  const delta = getWrappedDelta(start, end, options);
  const distance = Math.max(Math.abs(delta.q), Math.abs(delta.r));
  const maxLength = toInteger(options.maxLength ?? options.maxManualRouteLength, 0);
  if (distance <= 0) {
    return { success: false, error: 'EXPLORE_TARGET_IS_ORIGIN', route: [], target: end };
  }
  if (maxLength > 0 && distance > maxLength) {
    return { success: false, error: 'EXPLORE_TARGET_TOO_FAR', route: [], target: end };
  }
  const route = [];
  let q = start.q;
  let r = start.r;
  let remainingQ = delta.q;
  let remainingR = delta.r;
  for (let step = 1; step <= distance; step += 1) {
    const stepQ = Math.sign(remainingQ);
    const stepR = Math.sign(remainingR);
    q += stepQ;
    r += stepR;
    remainingQ -= stepQ;
    remainingR -= stepR;
    const coord = normalizeCoord({ q, r });
    route.push({
      q: coord.q,
      r: coord.r,
      step,
      tileId: coord.tileId,
    });
  }
  const routeTarget = route.at(-1) || end;
  return {
    success: true,
    route,
    target: normalizeCoord(routeTarget, end),
    distance,
  };
}

function evaluateLinearMarchRoute(origin = {}, target = {}, options = {}) {
  const plan = buildLinearMarchRoute(origin, target, options);
  if (!plan.success) return plan;
  const canTraverse = typeof options.canTraverse === 'function' ? options.canTraverse : () => true;
  for (const step of plan.route) {
    if (!canTraverse(step)) {
      return {
        success: false,
        error: 'EXPLORE_ROUTE_BLOCKED',
        blockedStep: step,
        route: plan.route.slice(0, Math.max(0, step.step - 1)),
        target: plan.target,
      };
    }
  }
  return plan;
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
  const origin = normalizeCoord(mission.origin || mission.position || {});
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
  const fromMs = toInteger(mission.stepDurationMs, 0);
  if (fromMs > 0) return Math.max(1000, fromMs);
  return Math.max(1000, Math.floor(toNumber(mission.stepDurationSeconds, 10) * 1000));
}

function getMissionDurationMs(mission = {}) {
  const route = normalizeRoute(mission.route);
  const stepDurationMs = getMissionStepDurationMs(mission);
  return Math.max(stepDurationMs, route.length * stepDurationMs);
}

function isFinishedStatus(status = '') {
  return FINISHED_STATUSES.includes(status);
}

function clampUnit(value) {
  return Math.max(0, Math.min(1, toNumber(value)));
}

function getMissionProgress(mission = {}, nowMs = 0) {
  const route = normalizeRoute(mission.route);
  if (!route.length) {
    return { progress: 0, segmentIndex: 0, segmentProgress: 0, elapsedMs: 0, durationMs: 0 };
  }
  const durationMs = getMissionDurationMs(mission);
  if (isFinishedStatus(mission.status)) {
    return {
      progress: 1,
      segmentIndex: Math.max(0, route.length - 1),
      segmentProgress: 1,
      elapsedMs: durationMs,
      durationMs,
    };
  }
  const resolvedNowMs = toNumber(nowMs, 0);
  const startedAtMs = toTimestamp(mission.startedAt, resolvedNowMs);
  const elapsedMs = Math.max(0, resolvedNowMs - startedAtMs);
  const progress = clampUnit(elapsedMs / durationMs);
  const scaled = progress * route.length;
  const segmentIndex = Math.min(Math.max(0, route.length - 1), Math.floor(scaled));
  const segmentProgress = progress >= 1 ? 1 : clampUnit(scaled - segmentIndex);
  return { progress, segmentIndex, segmentProgress, elapsedMs, durationMs };
}

function isExpiredActiveMission(mission = {}, nowMs = 0) {
  if (!mission || mission.status !== STATUS_ACTIVE) return false;
  const completesAtMs = toTimestamp(mission.completesAt, Number.NaN);
  return Number.isFinite(completesAtMs) && completesAtMs <= toNumber(nowMs, 0);
}

function getEffectiveMissionStatus(mission = {}, nowMs = 0) {
  if (isExpiredActiveMission(mission, nowMs)) return STATUS_IDLE;
  return mission.status || '';
}

function getArrivalKind(status = '') {
  if (status === STATUS_IDLE) return ARRIVAL_IDLE;
  return ARRIVAL_NONE;
}

function getRouteStepRevealTimeMs(mission = {}, step = {}) {
  const startedAtMs = toTimestamp(mission.startedAt, Number.NaN);
  if (!Number.isFinite(startedAtMs)) return Number.NaN;
  const stepIndex = Math.max(1, toInteger(step.step, 1));
  return startedAtMs + getMissionStepDurationMs(mission) * stepIndex;
}

function isRouteStepTimeRevealed(mission = {}, step = {}, nowMs = 0) {
  const revealAtMs = getRouteStepRevealTimeMs(mission, step);
  return Number.isFinite(revealAtMs) && revealAtMs <= toNumber(nowMs, 0);
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

function isRouteStepRevealed(mission = {}, step = {}, nowMs = 0, revealedTileIds = null) {
  if (!step) return false;
  if (step.revealed) return true;
  const status = getEffectiveMissionStatus(mission, nowMs);
  if (isFinishedStatus(status)) return true;
  if (mission.status === STATUS_ACTIVE && isRouteStepTimeRevealed(mission, step, nowMs))
    return true;
  if (step.routeRevealedExplicit) return false;
  const id = step.tileId || tileId(step.q, step.r);
  const revealedSet = revealedTileIds || createRevealedTileSet(mission);
  if (revealedSet.has(id)) return true;
  if (mission.status !== STATUS_ACTIVE) return false;
  return false;
}

function getRemainingSeconds(mission = {}, nowMs = 0) {
  if (!mission || isFinishedStatus(mission.status)) return 0;
  const resolvedNowMs = toNumber(nowMs, 0);
  const nextStepAtMs = toTimestamp(mission.nextStepAt, Number.NaN);
  if (Number.isFinite(nextStepAtMs))
    return Math.max(0, Math.ceil((nextStepAtMs - resolvedNowMs) / 1000));
  const completesAtMs = toTimestamp(mission.completesAt, Number.NaN);
  if (Number.isFinite(completesAtMs))
    return Math.max(0, Math.ceil((completesAtMs - resolvedNowMs) / 1000));
  const progress = getMissionProgress(mission, resolvedNowMs);
  return Math.max(0, Math.ceil((progress.durationMs - progress.elapsedMs) / 1000));
}

function getTravelRemainingSeconds(mission = {}, nowMs = 0) {
  if (!mission || isFinishedStatus(mission.status)) return 0;
  const progress = getMissionProgress(mission, nowMs);
  return Math.max(0, Math.ceil((progress.durationMs - progress.elapsedMs) / 1000));
}

function deriveMissionForTime(mission = {}, options = {}) {
  if (!mission || typeof mission !== 'object') return null;
  const nowMs = toNumber(options.nowMs, 0);
  const route = normalizeRoute(mission.route);
  const revealedSet = createRevealedTileSet(mission);
  const revealedRoute = route.map((step) => {
    const revealed = isRouteStepRevealed(mission, step, nowMs, revealedSet);
    const revealAtMs = getRouteStepRevealTimeMs(mission, step);
    return {
      ...step,
      revealed,
      revealedAt: step.revealedAt || null,
      revealedAtMs: revealed ? (Number.isFinite(revealAtMs) ? revealAtMs : nowMs) : Number.NaN,
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
  const nextStepAt = mission.nextStepAt || null;
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
    nextStepAtMs:
      Number.isFinite(nextStepAtMs) && status === STATUS_ACTIVE ? nextStepAtMs : Number.NaN,
  };
  return {
    ...derived,
    remainingSeconds: getRemainingSeconds(derived, nowMs),
  };
}

function lerp(a, b, t) {
  return toNumber(a) + (toNumber(b) - toNumber(a)) * clampUnit(t);
}

function getCurrentCoord(mission = {}, nowMs = 0) {
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

function getRouteRenderAheadTileId(mission = {}, nowMs = 0) {
  if (!mission || mission.status !== STATUS_ACTIVE) return null;
  const route = normalizeRoute(mission.route);
  if (!route.length) return null;
  const progress = getMissionProgress(mission, nowMs);
  const step = route[Math.max(0, Math.min(route.length - 1, progress.segmentIndex))];
  return step?.tileId || null;
}

function getRouteRenderReadyTileIds(mission = {}, nowMs = 0) {
  return getRouteRenderRevealSources(mission, nowMs)
    .filter((source) => clampUnit(source.strength) > 0)
    .map((source) => source.tileId)
    .filter(Boolean);
}

function appendRouteRevealSource(sources = [], coord = {}, strength = 1, source = 'routeHistory') {
  const normalized = normalizeCoord(coord);
  if (!normalized.tileId) return sources;
  const nextStrength = clampUnit(strength);
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

function getRouteRenderRevealSources(mission = {}, nowMs = 0) {
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
  const frontierStrength = clampUnit(progress.segmentProgress);
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

function getRouteRenderRevealSignature(mission = {}, nowMs = 0) {
  const progress = getMissionProgress(mission, nowMs);
  const sources = getRouteRenderRevealSources(mission, nowMs);
  let hash = 2166136261;
  sources.forEach((source) => {
    const text = [source.tileId || '', Math.round(clampUnit(source.strength) * 1000)].join(':');
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
  });
  return [
    sources.length,
    progress.segmentIndex,
    Math.round(progress.segmentProgress * 1000),
    (hash >>> 0).toString(36),
  ].join(':');
}

function chooseStopTile(mission = {}, nowMs = 0) {
  const path = getMissionPath(mission);
  if (path.length <= 1) return path[0] || normalizeCoord({});
  const progress = getMissionProgress(mission, nowMs);
  const from = path[progress.segmentIndex] || path[0];
  const to = path[progress.segmentIndex + 1] || path[path.length - 1];
  return normalizeCoord(progress.segmentProgress >= 0.5 ? to : from);
}

function getConfirmedPosition(mission = {}) {
  const route = normalizeRoute(mission.route);
  const lastRevealed = [...route].reverse().find((step) => step.revealed);
  return normalizeCoord(mission.position || lastRevealed || mission.origin || {});
}

function computeMarchState(missionParams = {}, nowMs = 0) {
  const mission = deriveMissionForTime(missionParams, { nowMs }) || {};
  return {
    position: normalizeCoord(
      getCurrentCoord(mission, nowMs),
      mission.position || mission.target || mission.origin || {},
    ),
    revealedTileIds: Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds.slice() : [],
    route: Array.isArray(mission.route) ? mission.route.slice() : [],
    status: mission.status || '',
    progress: getMissionProgress(mission, nowMs),
    current: getCurrentCoord(mission, nowMs),
    stopTile: chooseStopTile(mission, nowMs),
    renderAheadTileId: getRouteRenderAheadTileId(mission, nowMs),
    renderReadyTileIds: getRouteRenderReadyTileIds(mission, nowMs),
    renderRevealSources: getRouteRenderRevealSources(mission, nowMs),
    renderRevealSignature: getRouteRenderRevealSignature(mission, nowMs),
    remainingSeconds: getRemainingSeconds(mission, nowMs),
    travelRemainingSeconds: getTravelRemainingSeconds(mission, nowMs),
  };
}

module.exports = {
  STATUS_ACTIVE,
  STATUS_READY,
  STATUS_IDLE,
  STATUS_CANCELLED,
  ARRIVAL_NONE,
  ARRIVAL_IDLE,
  FINISHED_STATUSES,
  MAX_MANUAL_ROUTE_LENGTH,
  toNumber,
  toInteger,
  toTimestamp,
  tileId,
  normalizeCoord,
  normalizeRoute,
  getWrappedDelta,
  buildLinearMarchRoute,
  evaluateLinearMarchRoute,
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
  getConfirmedPosition,
  getRemainingSeconds,
  getTravelRemainingSeconds,
  computeMarchState,
};
