const WorldMarchCore = require('../../../shared/worldMarchCore');

const SCHEMA = 'server-timeline-snapshot-v1';
const {
  toNumber,
  toInteger,
  toTimestamp,
  normalizeCoord,
  normalizeRoute,
  getMissionStepDurationMs: getStepDurationMs,
  getMissionPath: getPath,
  getMissionProgress: getProgressForNowMs,
  getCurrentCoord: getInterpolatedCoordForNowMs,
  getConfirmedPosition,
  chooseStopTile: chooseStopTileForNowMs,
} = WorldMarchCore;

function getNowMs(now = new Date()) {
  return now instanceof Date ? now.getTime() : toTimestamp(now, Date.now());
}

function getProgress(mission = {}, options = {}) {
  const nowMs = toNumber(options.nowMs, getNowMs(options.now));
  return getProgressForNowMs(mission, nowMs);
}

function getInterpolatedCoord(mission = {}, options = {}) {
  const nowMs = toNumber(options.nowMs, getNowMs(options.now));
  return getInterpolatedCoordForNowMs(mission, nowMs);
}

function chooseStopTile(mission = {}, options = {}) {
  const nowMs = toNumber(options.nowMs, getNowMs(options.now));
  return chooseStopTileForNowMs(mission, nowMs);
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
