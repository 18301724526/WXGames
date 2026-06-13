const test = require('node:test');
const assert = require('node:assert/strict');

const ObservabilityService = require('../services/ObservabilityService');

test('observability service records API latency, server errors, and action failures', () => {
  const service = new ObservabilityService({
    maxEvents: 10,
    slowRequestMs: 100,
    minRequestsForErrorRate: 2,
    errorRateWarning: 0.25,
    actionFailureWarning: 1,
    slowRequestWarning: 1,
  });

  service.recordApiRequest({
    method: 'GET',
    path: '/api/game/state',
    statusCode: 200,
    durationMs: 50,
  });
  service.recordApiRequest({
    method: 'POST',
    path: '/api/game/action',
    body: { action: 'build' },
    response: { success: false, error: 'INSUFFICIENT_RESOURCES' },
    statusCode: 400,
    durationMs: 120,
  });
  service.recordApiRequest({
    method: 'GET',
    path: '/api/admin/task-definitions',
    response: { error: 'EXPLODED' },
    statusCode: 500,
    durationMs: 250,
  });

  const snapshot = service.getSnapshot();

  assert.equal(snapshot.status, 'degraded');
  assert.equal(snapshot.totals.requestCount, 3);
  assert.equal(snapshot.totals.serverErrorCount, 1);
  assert.equal(snapshot.totals.actionFailureCount, 1);
  assert.equal(snapshot.totals.slowRequestCount, 2);
  assert.equal(snapshot.totals.performanceBudgetExceededCount, 0);
  assert.equal(snapshot.totals.p95DurationMs, 250);
  assert.equal(snapshot.statusCounts['500'], 1);
  assert.equal(snapshot.alerts.some((alert) => alert.code === 'SERVER_ERROR_RATE_HIGH'), true);
  assert.equal(snapshot.alerts.some((alert) => alert.code === 'ACTION_FAILURES_HIGH'), true);
  assert.equal(snapshot.paths.some((item) => item.path === '/api/game/action' && item.actionFailures === 1), true);
});

test('observability service keeps request ids for frontend/backend log comparison', () => {
  const service = new ObservabilityService({ maxEvents: 10 });

  service.recordApiRequest({
    method: 'POST',
    path: '/api/game/action',
    requestId: 'api-42',
    body: {
      action: 'startWorldMarch',
      clientRequestId: 'api-42',
      targetQ: 3,
      targetR: -2,
      formationSlot: 1,
    },
    response: { success: true },
    statusCode: 200,
    durationMs: 35,
  });

  const event = service.getSnapshot({ eventLimit: 1 }).recentEvents[0];

  assert.equal(event.requestId, 'api-42');
  assert.equal(event.action, 'startWorldMarch');
  assert.deepEqual(event.actionTarget, {
    requestId: 'api-42',
    targetQ: 3,
    targetR: -2,
    formationSlot: 1,
  });
});

test('observability service records performance capacity budget violations', () => {
  const service = new ObservabilityService({ maxEvents: 10 });

  service.recordApiRequest({
    method: 'POST',
    path: '/api/game/action',
    body: { action: 'debug', huge: 'x'.repeat(128) },
    response: { success: true, huge: 'x'.repeat(128) },
    statusCode: 200,
    durationMs: 250,
    performanceBudgets: {
      actionLatencyMs: 100,
      apiRequestBytes: 20,
      apiResponseBytes: 20,
    },
  });

  const snapshot = service.getSnapshot({ eventLimit: 5 });
  const event = snapshot.recentEvents[0];

  assert.equal(snapshot.status, 'degraded');
  assert.equal(snapshot.totals.performanceBudgetExceededCount, 1);
  assert.equal(snapshot.totals.totalPerformanceBudgetExceeded, 1);
  assert.equal(snapshot.alerts.some((alert) => alert.code === 'PERFORMANCE_BUDGET_EXCEEDED'), true);
  assert.equal(snapshot.paths.some((item) => item.path === '/api/game/action' && item.performanceBudgetExceeded === 1), true);
  assert.equal(event.performanceBudgetExceeded, true);
  assert.deepEqual(event.performanceBudget.failedKeys, [
    'api.action-latency',
    'api.request-bytes',
    'api.response-bytes',
  ]);
});

test('observability service keeps a bounded recent event window and health summary', () => {
  const service = new ObservabilityService({ maxEvents: 3, slowRequestMs: 1000 });

  service.recordApiRequest({ method: 'GET', path: '/a', statusCode: 200, durationMs: 10 });
  service.recordApiRequest({ method: 'GET', path: '/b', statusCode: 200, durationMs: 20 });
  service.recordApiRequest({ method: 'GET', path: '/c', statusCode: 200, durationMs: 30 });
  service.recordApiRequest({ method: 'GET', path: '/d', statusCode: 200, durationMs: 40 });

  const snapshot = service.getSnapshot({ eventLimit: 10 });
  const health = service.getHealthSummary();

  assert.equal(snapshot.totals.requestCount, 3);
  assert.equal(snapshot.totals.totalRequests, 4);
  assert.deepEqual(snapshot.recentEvents.map((event) => event.path), ['/b', '/c', '/d']);
  assert.equal(health.status, 'ok');
  assert.equal(health.recentRequestCount, 3);
  assert.equal(Array.isArray(health.alerts), true);
});

test('observability service records bounded frontend client failures separately', () => {
  const service = new ObservabilityService({
    maxEvents: 3,
    frontendLoadFailureWarning: 2,
  });

  service.recordClientEvent({
    type: 'frontend_load_failure',
    phase: 'assets:preload',
    error: 'preload exploded',
    href: 'https://example.test/wxgame',
  });
  service.recordClientEvent({
    type: 'frontend_asset_failure',
    phase: 'assets:preload',
    assetPath: 'assets/missing.png',
    status: 'error',
    failed: 1,
    total: 2,
  });
  service.recordClientEvent({
    type: 'frontend_load_failure',
    phase: 'state:first-sync',
    message: 'timeout',
  });
  service.recordClientEvent({
    type: 'frontend_asset_failure',
    phase: 'assets:preload',
    assetPath: 'assets/oldest-dropped.png',
    status: 'error',
  });

  const snapshot = service.getSnapshot({ eventLimit: 10 });
  const health = service.getHealthSummary();

  assert.equal(snapshot.status, 'degraded');
  assert.equal(snapshot.totals.requestCount, 0);
  assert.equal(snapshot.totals.clientEventCount, 3);
  assert.equal(snapshot.totals.totalClientEvents, 4);
  assert.equal(snapshot.totals.frontendLoadFailureCount, 3);
  assert.equal(snapshot.totals.frontendAssetFailureCount, 2);
  assert.equal(snapshot.clientEventTypeCounts.frontend_asset_failure, 2);
  assert.equal(snapshot.alerts.some((alert) => alert.code === 'FRONTEND_LOAD_FAILURES_HIGH'), true);
  assert.equal(snapshot.recentClientEvents[0].phase, 'assets:preload');
  assert.equal(health.recentClientEventCount, 3);
  assert.equal(health.frontendLoadFailureCount, 3);
});
