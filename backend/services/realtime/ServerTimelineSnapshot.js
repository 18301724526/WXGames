const WorldMapService = require('../WorldMapService');

const SCHEMA = 'server-timeline-snapshot-v1';

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toInteger(value, fallback = 0) {
  return Math.floor(toNumber(value, fallback));
}

function toTimestamp(value, fallback = Number.NaN) {
  if (value === null || value === undefined || value === '') return fallback;
  if (value instanceof Date) {
    const stamp = value.getTime();
    return Number.isFinite(stamp) ? stamp : fallback;
  }
  if (typeof value === 'number' || (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim()))) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.abs(number) < 1000000000000 ? number * 1000 : number;
  }
  const stamp = new Date(value).getTime();
  return Number.isFinite(stamp) ? stamp : fallback;
}

function getNowMs(now = new Date()) {
  return now instanceof Date ? now.getTime() : toTimestamp(now, Date.now());
}

function normalizeCoord(coord = {}, fallback = {}) {
  const source = coord && typeof coord === 'object' ? coord : {};
  const base = fallback && typeof fallback === 'object' ? fallback : {};
  const q = toInteger(source.q ?? source.x, base.q ?? 0);
  const r = toInteger(source.r ?? source.y, base.r ?? 0);
  return {
    q,
    r,
    tileId: source.tileId || WorldMapService.getTileId(q, r),
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
        revealedAt: step.revealedAt || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.step - b.step);
}

function getStepDurationMs(mission = {}) {
  const fromMs = toInteger(mission.stepDurationMs, 0);
  if (fromMs > 0) return Math.max(1000, fromMs);
  const fromSeconds = toNumber(mission.stepDurationSeconds, 10);
  return Math.max(1000, Math.floor(fromSeconds * 1000));
}

function getPath(mission = {}) {
  return [
    normalizeCoord(mission.origin || mission.position || {}),
    ...normalizeRoute(mission.route || []),
  ];
}

function getProgress(mission = {}, options = {}) {
  const route = normalizeRoute(mission.route || []);
  const stepDurationMs = getStepDurationMs(mission);
  const durationMs = Math.max(stepDurationMs, route.length * stepDurationMs);
  if (!route.length) {
    return {
      progress: 0,
      segmentIndex: 0,
      segmentProgress: 0,
      elapsedMs: 0,
      durationMs: 0,
    };
  }
  if (['ready', 'idle', 'cancelled'].includes(mission.status)) {
    return {
      progress: 1,
      segmentIndex: Math.max(0, route.length - 1),
      segmentProgress: 1,
      elapsedMs: durationMs,
      durationMs,
    };
  }
  const nowMs = toNumber(options.nowMs, getNowMs(options.now));
  const startedAtMs = toTimestamp(mission.startedAt, nowMs);
  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  const progress = Math.max(0, Math.min(1, elapsedMs / durationMs));
  const scaled = progress * route.length;
  return {
    progress,
    segmentIndex: Math.min(Math.max(0, route.length - 1), Math.floor(scaled)),
    segmentProgress: progress >= 1 ? 1 : Math.max(0, Math.min(1, scaled - Math.floor(scaled))),
    elapsedMs,
    durationMs,
  };
}

function getInterpolatedCoord(mission = {}, options = {}) {
  const path = getPath(mission);
  if (path.length <= 1) return path[0] || normalizeCoord({});
  const progress = getProgress(mission, options);
  const from = path[progress.segmentIndex] || path[0];
  const to = path[progress.segmentIndex + 1] || path[path.length - 1];
  const mix = progress.segmentProgress;
  return {
    q: toNumber(from.q) + (toNumber(to.q) - toNumber(from.q)) * mix,
    r: toNumber(from.r) + (toNumber(to.r) - toNumber(from.r)) * mix,
    fromTileId: from.tileId,
    toTileId: to.tileId,
    segmentIndex: progress.segmentIndex,
    segmentProgress: mix,
    progress: progress.progress,
  };
}

function getConfirmedPosition(mission = {}) {
  const route = normalizeRoute(mission.route || []);
  const lastRevealed = [...route].reverse().find((step) => step.revealed);
  return normalizeCoord(mission.position || lastRevealed || mission.origin || {});
}

function chooseStopTile(mission = {}, options = {}) {
  const path = getPath(mission);
  if (path.length <= 1) return path[0] || normalizeCoord({});
  const progress = getProgress(mission, options);
  const from = path[progress.segmentIndex] || path[0];
  const to = path[progress.segmentIndex + 1] || path[path.length - 1];
  return normalizeCoord(progress.segmentProgress >= 0.5 ? to : from);
}

function createMissionSnapshot(mission = {}, options = {}) {
  const nowMs = toNumber(options.nowMs, getNowMs(options.now));
  const route = normalizeRoute(mission.route || []);
  const progress = getProgress(mission, { ...options, nowMs });
  const current = getInterpolatedCoord(mission, { ...options, nowMs });
  const confirmedPosition = getConfirmedPosition(mission);
  const stopTile = chooseStopTile(mission, { ...options, nowMs });
  return {
    schema: SCHEMA,
    serverTime: new Date(nowMs).toISOString(),
    nowMs,
    scope: 'world-explorer-mission',
    missionId: mission.id || '',
    mode: mission.mode || '',
    status: mission.status || '',
    startedAt: mission.startedAt || null,
    nextStepAt: mission.nextStepAt || null,
    completesAt: mission.completesAt || null,
    stepDurationMs: getStepDurationMs(mission),
    routeLength: route.length,
    confirmedPosition,
    current,
    stopTile,
    progress,
    interpolation: {
      authority: 'server',
      clientMayInterpolate: true,
      fromTileId: current.fromTileId || confirmedPosition.tileId,
      toTileId: current.toTileId || stopTile.tileId,
      progress: progress.progress,
      segmentProgress: progress.segmentProgress,
    },
  };
}

module.exports = {
  SCHEMA,
  toNumber,
  toInteger,
  toTimestamp,
  normalizeCoord,
  normalizeRoute,
  getStepDurationMs,
  getPath,
  getProgress,
  getInterpolatedCoord,
  getConfirmedPosition,
  chooseStopTile,
  createMissionSnapshot,
};
