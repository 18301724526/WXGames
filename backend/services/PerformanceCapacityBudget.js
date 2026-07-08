const { toNonNegativeInteger } = require('../../shared/numberUtils');

const DEFAULT_BUDGETS = Object.freeze({
  apiLatencyMs: 1500,
  actionLatencyMs: 1000,
  apiRequestBytes: 256 * 1024,
  apiResponseBytes: 768 * 1024,
  saveStateBytes: 2 * 1024 * 1024,
  worldMapTiles: 5000,
  worldMapWindowTiles: 1200,
  worldMapChunkTiles: 1024,
  activeWorldMapChunks: 64,
  actors: 500,
  missions: 1000,
  commandClientInputBytes: 2048,
  commandReplaySummaryBytes: 4096,
});

function readCount(source = {}, keys = []) {
  for (const key of keys) {
    const value = source?.counts?.[key] ?? source?.[key]?.length ?? source?.[key];
    if (Number.isFinite(Number(value))) return toNonNegativeInteger(value);
  }
  return 0;
}

function getSerializableSizeBytes(value) {
  try {
    return JSON.stringify(value || {}).length;
  } catch (_) {
    return Infinity;
  }
}

function createCheck(key, ok, actual, budget, detail = '') {
  return Object.freeze({
    key,
    ok: ok === true,
    actual,
    budget,
    detail,
  });
}

function createReport(checks = [], meta = {}) {
  const failed = checks.filter((check) => !check.ok);
  return Object.freeze({
    ok: failed.length === 0,
    failedKeys: Object.freeze(failed.map((check) => check.key)),
    checks: Object.freeze(checks),
    meta: Object.freeze({ ...(meta || {}) }),
  });
}

function combineReports(reports = [], meta = {}) {
  const checks = [];
  (Array.isArray(reports) ? reports : []).forEach((report) => {
    checks.push(...(report?.checks || []));
  });
  return createReport(checks, meta);
}

function assertReport(report, message = 'Performance capacity budget exceeded') {
  if (report?.ok) return report;
  const failed = (report?.checks || [])
    .filter((check) => !check.ok)
    .map((check) => `${check.key} actual=${check.actual} budget=${check.budget}`)
    .join('; ');
  throw new Error(`${message}: ${failed}`);
}

function normalizeBudgets(budgets = {}) {
  return Object.freeze({
    ...DEFAULT_BUDGETS,
    ...(budgets || {}),
  });
}

function isActionRequest(input = {}) {
  const path = String(input.path || input.url || '');
  return path === '/api/game/action'
    || path === '/api/game/tasks/claim'
    || Boolean(input.action || input.body?.action);
}

function checkApiRequest(input = {}, budgets = DEFAULT_BUDGETS) {
  const resolvedBudgets = normalizeBudgets(budgets);
  const durationMs = toNonNegativeInteger(input.durationMs ?? input.duration);
  const requestBytes = Number.isFinite(Number(input.requestBytes))
    ? toNonNegativeInteger(input.requestBytes)
    : getSerializableSizeBytes(input.body || {});
  const responseBytes = Number.isFinite(Number(input.responseBytes))
    ? toNonNegativeInteger(input.responseBytes)
    : getSerializableSizeBytes(input.response || {});
  const actionRequest = isActionRequest(input);
  const latencyBudget = actionRequest ? resolvedBudgets.actionLatencyMs : resolvedBudgets.apiLatencyMs;
  const latencyKey = actionRequest ? 'api.action-latency' : 'api.latency';

  return createReport([
    createCheck(latencyKey, durationMs <= latencyBudget, durationMs, latencyBudget),
    createCheck('api.request-bytes', requestBytes <= resolvedBudgets.apiRequestBytes, requestBytes, resolvedBudgets.apiRequestBytes),
    createCheck('api.response-bytes', responseBytes <= resolvedBudgets.apiResponseBytes, responseBytes, resolvedBudgets.apiResponseBytes),
  ], {
    scope: 'api',
    method: String(input.method || 'GET').toUpperCase(),
    path: String(input.path || input.url || 'unknown'),
    actionRequest,
  });
}

function checkSaveState(state = {}, budgets = DEFAULT_BUDGETS) {
  const resolvedBudgets = normalizeBudgets(budgets);
  const worldMap = state?.worldMap || {};
  const tileCount = readCount(worldMap, ['tiles']);
  const missionCount = readCount(state, ['exploreMissions']) + readCount(state, ['warMissions']);
  const saveBytes = getSerializableSizeBytes(state);

  return createReport([
    createCheck('save.serializable-size', saveBytes <= resolvedBudgets.saveStateBytes, saveBytes, resolvedBudgets.saveStateBytes),
    createCheck('save.world-map-tiles', tileCount <= resolvedBudgets.worldMapTiles, tileCount, resolvedBudgets.worldMapTiles),
    createCheck('save.mission-count', missionCount <= resolvedBudgets.missions, missionCount, resolvedBudgets.missions),
  ], {
    scope: 'save',
    playerId: String(state?.playerId || ''),
    revision: toNonNegativeInteger(state?.revision),
  });
}

function getChunkTileCount(chunk = {}) {
  return readCount(chunk, ['tiles', 'entries', 'visibleEntries'])
    || toNonNegativeInteger(chunk.tileCount ?? chunk.entryCount ?? 0);
}

function checkWorldMapWindow(input = {}, budgets = DEFAULT_BUDGETS) {
  const resolvedBudgets = normalizeBudgets(budgets);
  const chunks = Array.isArray(input.chunks) ? input.chunks : [];
  const windowTiles = readCount(input, ['visibleTiles', 'visibleEntries', 'tiles']);
  const activeChunks = readCount(input, ['activeChunks', 'chunks']) || chunks.length;
  const largestChunkTiles = chunks.reduce((max, chunk) => Math.max(max, getChunkTileCount(chunk)), 0);

  return createReport([
    createCheck('world-window.tile-count', windowTiles <= resolvedBudgets.worldMapWindowTiles, windowTiles, resolvedBudgets.worldMapWindowTiles),
    createCheck('world-window.active-chunks', activeChunks <= resolvedBudgets.activeWorldMapChunks, activeChunks, resolvedBudgets.activeWorldMapChunks),
    createCheck('world-window.chunk-tile-count', largestChunkTiles <= resolvedBudgets.worldMapChunkTiles, largestChunkTiles, resolvedBudgets.worldMapChunkTiles),
  ], {
    scope: 'world-window',
    signature: String(input.signature || ''),
  });
}

function hasForbiddenKeyDeep(value = {}, keys = [], allowedPaths = new Set(), path = []) {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, item]) => {
    const nextPath = [...path, key];
    const pathText = nextPath.join('.');
    if (keys.includes(key) && !allowedPaths.has(pathText)) return true;
    return hasForbiddenKeyDeep(item, keys, allowedPaths, nextPath);
  });
}

function checkCommandEvidence(input = {}, budgets = DEFAULT_BUDGETS) {
  const resolvedBudgets = normalizeBudgets(budgets);
  const clientInput = input.clientInput || input.clientInputIntent || {};
  const replaySummary = input.replaySummary || input.summary || {};
  const clientInputBytes = getSerializableSizeBytes(clientInput);
  const replaySummaryBytes = getSerializableSizeBytes(replaySummary);
  const rendererKeys = ['renderer', 'rendererCache', 'rendererPayload', 'context', 'event', 'nativeEvent'];
  const heavyClientKeys = ['tiles', 'tileMapView', 'targets', 'hitTargets', 'visibleEntries'];
  const heavyReplayKeys = ['timeline', 'aoi', 'response', 'gameState', 'worldMap', 'tiles', 'route'];
  const allowedClientHeavyPaths = new Set(['picking.counts.targets']);

  return createReport([
    createCheck(
      'command-evidence.client-input-bytes',
      clientInputBytes <= resolvedBudgets.commandClientInputBytes,
      clientInputBytes,
      resolvedBudgets.commandClientInputBytes,
    ),
    createCheck(
      'command-evidence.replay-summary-bytes',
      replaySummaryBytes <= resolvedBudgets.commandReplaySummaryBytes,
      replaySummaryBytes,
      resolvedBudgets.commandReplaySummaryBytes,
    ),
    createCheck(
      'command-evidence.no-renderer-payload',
      !hasForbiddenKeyDeep(clientInput, rendererKeys)
        && !hasForbiddenKeyDeep(clientInput, heavyClientKeys, allowedClientHeavyPaths),
      0,
      0,
    ),
    createCheck(
      'command-evidence.no-heavy-authority-payload',
      !hasForbiddenKeyDeep(replaySummary, heavyReplayKeys),
      0,
      0,
    ),
  ], {
    scope: 'command-evidence',
    requestId: String(input.requestId || replaySummary.requestId || ''),
    action: String(input.action || replaySummary.action || ''),
  });
}

function summarizeReport(report = {}) {
  const failedChecks = (report.checks || []).filter((check) => !check.ok);
  return Object.freeze({
    ok: report.ok === true,
    failedKeys: Object.freeze([...(report.failedKeys || [])]),
    failedChecks: Object.freeze(failedChecks.map((check) => Object.freeze({
      key: check.key,
      actual: check.actual,
      budget: check.budget,
    }))),
    checkedAt: new Date().toISOString(),
    meta: Object.freeze({ ...(report.meta || {}) }),
  });
}

module.exports = {
  DEFAULT_BUDGETS,
  assertReport,
  checkApiRequest,
  checkCommandEvidence,
  checkSaveState,
  checkWorldMapWindow,
  combineReports,
  createCheck,
  createReport,
  getSerializableSizeBytes,
  normalizeBudgets,
  summarizeReport,
};
