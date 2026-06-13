const DEFAULT_MAX_EVENTS = 200;
const DEFAULT_SLOW_REQUEST_MS = 1500;
const DEFAULT_ERROR_RATE_WARNING = 0.1;
const DEFAULT_MIN_REQUESTS_FOR_ERROR_RATE = 10;
const DEFAULT_ACTION_FAILURE_WARNING = 3;
const DEFAULT_SLOW_REQUEST_WARNING = 5;
const DEFAULT_FRONTEND_LOAD_FAILURE_WARNING = 3;

const PerformanceCapacityBudget = require('./PerformanceCapacityBudget');

const FRONTEND_LOAD_FAILURE_TYPES = new Set([
  'frontend_load_failure',
  'frontend_asset_failure',
]);

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function responseCode(response) {
  if (!response || typeof response !== 'object') return '';
  return String(response.error || response.code || '');
}

function cleanText(value, maxLength = 256) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

function cleanNumber(value) {
  return Math.max(0, Math.round(toNumber(value, 0)));
}

function summarizeOperationTarget(body = {}) {
  if (!body || typeof body !== 'object') return {};
  const target = {
    requestId: cleanText(body.clientRequestId || body.requestId, 120),
    target: cleanText(body.target || body.territoryId || body.cityId || body.missionId, 120),
    targetQ: body.targetQ ?? body.q ?? body.x ?? undefined,
    targetR: body.targetR ?? body.r ?? body.y ?? undefined,
    formationSlot: body.formationSlot ?? body.slot ?? undefined,
  };
  Object.keys(target).forEach((key) => {
    if (target[key] === '' || target[key] === undefined || target[key] === null) delete target[key];
  });
  return target;
}

class ObservabilityService {
  constructor(options = {}) {
    this.startedAt = new Date().toISOString();
    this.maxEvents = Math.max(1, Math.floor(toNumber(options.maxEvents, DEFAULT_MAX_EVENTS)));
    this.thresholds = {
      slowRequestMs: Math.max(1, toNumber(options.slowRequestMs, DEFAULT_SLOW_REQUEST_MS)),
      errorRateWarning: Math.max(0, toNumber(options.errorRateWarning, DEFAULT_ERROR_RATE_WARNING)),
      minRequestsForErrorRate: Math.max(1, Math.floor(toNumber(options.minRequestsForErrorRate, DEFAULT_MIN_REQUESTS_FOR_ERROR_RATE))),
      actionFailureWarning: Math.max(1, Math.floor(toNumber(options.actionFailureWarning, DEFAULT_ACTION_FAILURE_WARNING))),
      slowRequestWarning: Math.max(1, Math.floor(toNumber(options.slowRequestWarning, DEFAULT_SLOW_REQUEST_WARNING))),
      frontendLoadFailureWarning: Math.max(1, Math.floor(toNumber(options.frontendLoadFailureWarning, DEFAULT_FRONTEND_LOAD_FAILURE_WARNING))),
    };
    this.events = [];
    this.clientEvents = [];
    this.totalRequests = 0;
    this.totalPerformanceBudgetExceeded = 0;
    this.totalClientEvents = 0;
    this.statusCounts = new Map();
    this.clientEventTypeCounts = new Map();
    this.pathStats = new Map();
  }

  recordApiRequest(input = {}) {
    const statusCode = Math.max(0, Math.floor(toNumber(input.statusCode, 0)));
    const durationMs = Math.max(0, Math.round(toNumber(input.durationMs ?? input.duration, 0)));
    const path = String(input.path || input.url || 'unknown');
    const method = String(input.method || 'GET').toUpperCase();
    const body = input.body && typeof input.body === 'object' ? input.body : {};
    const response = input.response && typeof input.response === 'object' ? input.response : {};
    const action = String(input.action || body.action || (path === '/api/game/tasks/claim' ? 'claimTaskReward' : ''));
    const isActionPath = path === '/api/game/action' || path === '/api/game/tasks/claim';
    const actionFailure = Boolean(isActionPath && (statusCode >= 400 || response.success === false));
    const performanceBudget = PerformanceCapacityBudget.summarizeReport(
      PerformanceCapacityBudget.checkApiRequest({
        method,
        path,
        body,
        response,
        statusCode,
        durationMs,
        requestBytes: input.requestBytes,
        responseBytes: input.responseBytes,
        action,
      }, input.performanceBudgets),
    );
    const event = {
      at: input.timestamp || new Date().toISOString(),
      requestId: cleanText(input.requestId || body.clientRequestId || body.requestId, 120) || undefined,
      method,
      path,
      statusCode,
      durationMs,
      slow: durationMs >= this.thresholds.slowRequestMs,
      httpFailure: statusCode >= 400,
      serverError: statusCode >= 500,
      action: action || undefined,
      actionTarget: summarizeOperationTarget(body),
      actionFailure,
      code: responseCode(response) || undefined,
      performanceBudget,
      performanceBudgetExceeded: !performanceBudget.ok,
    };

    this.totalRequests += 1;
    if (event.performanceBudgetExceeded) this.totalPerformanceBudgetExceeded += 1;
    this.statusCounts.set(String(statusCode), (this.statusCounts.get(String(statusCode)) || 0) + 1);
    this.updatePathStats(event);
    this.events.push(event);
    if (this.events.length > this.maxEvents) this.events.splice(0, this.events.length - this.maxEvents);
    return event;
  }

  updatePathStats(event) {
    const key = `${event.method} ${event.path}`;
    const stats = this.pathStats.get(key) || {
      method: event.method,
      path: event.path,
      count: 0,
      failures: 0,
      serverErrors: 0,
      actionFailures: 0,
      slowRequests: 0,
      performanceBudgetExceeded: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
      lastStatusCode: 0,
      lastSeenAt: '',
    };
    stats.count += 1;
    stats.failures += event.httpFailure ? 1 : 0;
    stats.serverErrors += event.serverError ? 1 : 0;
    stats.actionFailures += event.actionFailure ? 1 : 0;
    stats.slowRequests += event.slow ? 1 : 0;
    stats.performanceBudgetExceeded += event.performanceBudgetExceeded ? 1 : 0;
    stats.totalDurationMs += event.durationMs;
    stats.maxDurationMs = Math.max(stats.maxDurationMs, event.durationMs);
    stats.lastStatusCode = event.statusCode;
    stats.lastSeenAt = event.at;
    this.pathStats.set(key, stats);
  }

  recordClientEvent(input = {}) {
    const event = {
      at: cleanText(input.timestamp || input.at, 64) || new Date().toISOString(),
      type: cleanText(input.type || 'frontend_load_failure', 64),
      severity: cleanText(input.severity || 'warning', 24),
      source: cleanText(input.source, 80),
      phase: cleanText(input.phase, 120),
      status: cleanText(input.status, 48),
      assetPath: cleanText(input.assetPath, 320),
      message: cleanText(input.message, 500),
      error: cleanText(input.error || input.message, 500),
      href: cleanText(input.href, 512),
      userAgent: cleanText(input.userAgent, 320),
      requestId: cleanText(input.requestId, 120),
      durationMs: cleanNumber(input.durationMs),
      atMs: cleanNumber(input.atMs),
      completed: cleanNumber(input.completed),
      total: cleanNumber(input.total),
      loaded: cleanNumber(input.loaded),
      failed: cleanNumber(input.failed),
    };
    Object.keys(event).forEach((key) => {
      if (event[key] === '') delete event[key];
    });

    this.totalClientEvents += 1;
    this.clientEventTypeCounts.set(event.type, (this.clientEventTypeCounts.get(event.type) || 0) + 1);
    this.clientEvents.push(event);
    if (this.clientEvents.length > this.maxEvents) {
      this.clientEvents.splice(0, this.clientEvents.length - this.maxEvents);
    }
    return event;
  }

  getAlerts(recent, totals, recentClientEvents = []) {
    const alerts = [];
    if (totals.requestCount >= this.thresholds.minRequestsForErrorRate
      && totals.serverErrorRate >= this.thresholds.errorRateWarning) {
      alerts.push({
        code: 'SERVER_ERROR_RATE_HIGH',
        severity: 'warning',
        message: `Recent 5xx error rate ${round(totals.serverErrorRate * 100, 1)}%`,
      });
    }
    if (totals.slowRequestCount >= this.thresholds.slowRequestWarning) {
      alerts.push({
        code: 'SLOW_REQUESTS_HIGH',
        severity: 'warning',
        message: `Recent slow request count ${totals.slowRequestCount}`,
      });
    }
    if (totals.actionFailureCount >= this.thresholds.actionFailureWarning) {
      alerts.push({
        code: 'ACTION_FAILURES_HIGH',
        severity: 'warning',
        message: `Recent action failure count ${totals.actionFailureCount}`,
      });
    }
    if (totals.frontendLoadFailureCount >= this.thresholds.frontendLoadFailureWarning) {
      alerts.push({
        code: 'FRONTEND_LOAD_FAILURES_HIGH',
        severity: 'warning',
        message: `Recent frontend load failure count ${totals.frontendLoadFailureCount}`,
      });
    }
    if (totals.performanceBudgetExceededCount > 0) {
      alerts.push({
        code: 'PERFORMANCE_BUDGET_EXCEEDED',
        severity: 'warning',
        message: `Recent performance budget exceeded count ${totals.performanceBudgetExceededCount}`,
      });
    }
    const lastServerError = [...recent].reverse().find((event) => event.serverError);
    if (lastServerError) {
      alerts.push({
        code: 'LAST_SERVER_ERROR',
        severity: 'info',
        message: `${lastServerError.method} ${lastServerError.path} returned ${lastServerError.statusCode}`,
      });
    }
    const lastClientFailure = [...recentClientEvents].reverse()
      .find((event) => FRONTEND_LOAD_FAILURE_TYPES.has(event.type));
    if (lastClientFailure) {
      alerts.push({
        code: 'LAST_FRONTEND_LOAD_FAILURE',
        severity: 'info',
        message: `${lastClientFailure.type} ${lastClientFailure.phase || lastClientFailure.source || ''}`.trim(),
      });
    }
    return alerts;
  }

  getSnapshot(options = {}) {
    const recent = this.events.slice();
    const recentClientEvents = this.clientEvents.slice();
    const requestCount = recent.length;
    const durations = recent.map((event) => event.durationMs);
    const serverErrorCount = recent.filter((event) => event.serverError).length;
    const failureCount = recent.filter((event) => event.httpFailure).length;
    const slowRequestCount = recent.filter((event) => event.slow).length;
    const actionFailureCount = recent.filter((event) => event.actionFailure).length;
    const frontendLoadFailureCount = recentClientEvents
      .filter((event) => FRONTEND_LOAD_FAILURE_TYPES.has(event.type)).length;
    const frontendAssetFailureCount = recentClientEvents
      .filter((event) => event.type === 'frontend_asset_failure').length;
    const performanceBudgetExceededCount = recent.filter((event) => event.performanceBudgetExceeded).length;
    const totals = {
      requestCount,
      totalRequests: this.totalRequests,
      totalPerformanceBudgetExceeded: this.totalPerformanceBudgetExceeded,
      clientEventCount: recentClientEvents.length,
      totalClientEvents: this.totalClientEvents,
      failureCount,
      serverErrorCount,
      actionFailureCount,
      slowRequestCount,
      performanceBudgetExceededCount,
      frontendLoadFailureCount,
      frontendAssetFailureCount,
      serverErrorRate: requestCount ? round(serverErrorCount / requestCount) : 0,
      failureRate: requestCount ? round(failureCount / requestCount) : 0,
      avgDurationMs: requestCount ? Math.round(durations.reduce((sum, value) => sum + value, 0) / requestCount) : 0,
      p95DurationMs: percentile(durations, 0.95),
      maxDurationMs: durations.length ? Math.max(...durations) : 0,
    };
    const alerts = this.getAlerts(recent, totals, recentClientEvents);
    const paths = Array.from(this.pathStats.values())
      .map((stats) => ({
        ...stats,
        avgDurationMs: stats.count ? Math.round(stats.totalDurationMs / stats.count) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, Math.max(1, Math.floor(toNumber(options.pathLimit, 20))));
    return {
      status: alerts.some((alert) => alert.severity === 'warning') ? 'degraded' : 'ok',
      startedAt: this.startedAt,
      generatedAt: new Date().toISOString(),
      thresholds: { ...this.thresholds },
      totals,
      statusCounts: Object.fromEntries(this.statusCounts),
      clientEventTypeCounts: Object.fromEntries(this.clientEventTypeCounts),
      paths,
      alerts,
      recentEvents: recent.slice(-Math.max(0, Math.floor(toNumber(options.eventLimit, 20)))),
      recentClientEvents: recentClientEvents.slice(-Math.max(0, Math.floor(toNumber(options.eventLimit, 20)))),
    };
  }

  getHealthSummary() {
    const snapshot = this.getSnapshot({ pathLimit: 5, eventLimit: 0 });
    return {
      status: snapshot.status,
      recentRequestCount: snapshot.totals.requestCount,
      recentServerErrorRate: snapshot.totals.serverErrorRate,
      recentP95DurationMs: snapshot.totals.p95DurationMs,
      slowRequestCount: snapshot.totals.slowRequestCount,
      actionFailureCount: snapshot.totals.actionFailureCount,
      performanceBudgetExceededCount: snapshot.totals.performanceBudgetExceededCount,
      recentClientEventCount: snapshot.totals.clientEventCount,
      frontendLoadFailureCount: snapshot.totals.frontendLoadFailureCount,
      frontendAssetFailureCount: snapshot.totals.frontendAssetFailureCount,
      alerts: snapshot.alerts.map((alert) => alert.code),
    };
  }
}

module.exports = ObservabilityService;
