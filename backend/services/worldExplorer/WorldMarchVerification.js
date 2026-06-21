const WorldMarchCore = require('../../../shared/worldMarchCore');

const DEFAULT_JITTER_THRESHOLD_TILES = 0.75;
const DEFAULT_DRIFT_THRESHOLD_TILES = 2;
const MAX_REPORT_AGE_MS = 30000;

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toTimestamp(value, fallback = Number.NaN) {
  return WorldMarchCore.toTimestamp(value, fallback);
}

function normalizeContinuousCoord(coord = {}, fallback = {}) {
  const source = coord && typeof coord === 'object' ? coord : {};
  const base = fallback && typeof fallback === 'object' ? fallback : {};
  const q = toNumber(source.q ?? source.x, base.q ?? base.x ?? 0);
  const r = toNumber(source.r ?? source.y, base.r ?? base.y ?? 0);
  return {
    q,
    r,
    tileId: WorldMarchCore.tileId(q, r),
  };
}

function coordDistanceTiles(a = {}, b = {}) {
  const aq = toNumber(a.q ?? a.x, 0);
  const ar = toNumber(a.r ?? a.y, 0);
  const bq = toNumber(b.q ?? b.x, 0);
  const br = toNumber(b.r ?? b.y, 0);
  return Math.max(Math.abs(aq - bq), Math.abs(ar - br));
}

function getActiveReport(reports = {}, missionId = '') {
  if (!missionId || !reports || typeof reports !== 'object') return null;
  const report = reports[missionId];
  return report && typeof report === 'object' ? report : null;
}

function sanitizeReport(report = {}, receivedAt = new Date()) {
  if (!report || typeof report !== 'object') return null;
  const missionId = String(report.missionId || report.id || '').slice(0, 120);
  if (!missionId) return null;
  const clientTimeMs = toTimestamp(report.clientTime ?? report.clientTimeMs, Number.NaN);
  const position = normalizeContinuousCoord(report.position || report.current || {});
  if (!Number.isFinite(position.q) || !Number.isFinite(position.r)) return null;
  const receivedAtIso = receivedAt instanceof Date
    ? receivedAt.toISOString()
    : new Date(receivedAt || Date.now()).toISOString();
  return {
    schema: 'world-march-client-report-v1',
    missionId,
    clientTime: Number.isFinite(clientTimeMs) ? new Date(clientTimeMs).toISOString() : null,
    receivedAt: receivedAtIso,
    position,
  };
}

function sanitizeReportBatch(input = {}, receivedAt = new Date()) {
  const sourceReports = Array.isArray(input?.missions)
    ? input.missions
    : Array.isArray(input?.reports)
      ? input.reports
      : [];
  const reports = {};
  sourceReports
    .slice(0, 12)
    .map((report) => sanitizeReport(report, receivedAt))
    .filter(Boolean)
    .forEach((report) => {
      reports[report.missionId] = report;
    });
  return {
    schema: 'world-march-client-report-batch-v1',
    receivedAt: receivedAt instanceof Date ? receivedAt.toISOString() : new Date(receivedAt || Date.now()).toISOString(),
    missions: reports,
  };
}

function getThresholds(options = {}) {
  const jitterThresholdTiles = Math.max(0, toNumber(
    options.jitterThresholdTiles ?? options.smallDriftThresholdTiles,
    DEFAULT_JITTER_THRESHOLD_TILES,
  ));
  const driftThresholdTiles = Math.max(
    jitterThresholdTiles,
    toNumber(options.driftThresholdTiles ?? options.largeDriftThresholdTiles, DEFAULT_DRIFT_THRESHOLD_TILES),
  );
  return { jitterThresholdTiles, driftThresholdTiles };
}

function verifyMission(mission = {}, report = null, now = new Date(), options = {}) {
  const nowMs = now instanceof Date ? now.getTime() : toTimestamp(now, Date.now());
  if (!mission || mission.status !== 'active' || !report) return null;
  const reportReceivedAtMs = toTimestamp(report.receivedAt, Number.NaN);
  if (Number.isFinite(reportReceivedAtMs) && nowMs - reportReceivedAtMs > MAX_REPORT_AGE_MS) {
    return {
      schema: 'world-march-verification-v1',
      missionId: mission.id || '',
      status: 'stale-report',
      severity: 'none',
      checkedAt: new Date(nowMs).toISOString(),
    };
  }
  const { jitterThresholdTiles, driftThresholdTiles } = getThresholds(options);
  const authority = WorldMarchCore.computeMarchState(mission, nowMs);
  const clientPosition = normalizeContinuousCoord(report.position || {}, authority.position || mission.position || mission.origin || {});
  const diffTiles = coordDistanceTiles(clientPosition, authority.position);
  const severity = diffTiles >= driftThresholdTiles
    ? 'large'
    : diffTiles > jitterThresholdTiles
      ? 'jitter'
      : 'none';
  return {
    schema: 'world-march-verification-v1',
    missionId: mission.id || '',
    status: severity === 'large' ? 'pullback-required' : 'aligned',
    severity,
    checkedAt: new Date(nowMs).toISOString(),
    diffTiles,
    thresholdTiles: {
      jitter: jitterThresholdTiles,
      large: driftThresholdTiles,
    },
    authorityPosition: authority.position,
    clientPosition,
  };
}

function verifyMissions(gameState = {}, now = new Date(), options = {}) {
  const reportState = gameState.worldMarchClientReports || {};
  const reports = reportState.missions || {};
  const results = [];
  (Array.isArray(gameState.exploreMissions) ? gameState.exploreMissions : [])
    .filter((mission) => mission?.status === 'active')
    .forEach((mission) => {
      const result = verifyMission(mission, getActiveReport(reports, mission.id), now, options);
      if (result) results.push(result);
    });
  const summary = {
    schema: 'world-march-verification-summary-v1',
    checkedAt: now instanceof Date ? now.toISOString() : new Date(now || Date.now()).toISOString(),
    status: results.some((result) => result.severity === 'large')
      ? 'pullback'
      : results.some((result) => result.severity === 'jitter')
        ? 'aligned'
        : 'ok',
    results,
  };
  gameState.worldMarchVerification = summary;
  return summary;
}

module.exports = {
  coordDistanceTiles,
  sanitizeReport,
  sanitizeReportBatch,
  verifyMission,
  verifyMissions,
};
