const DEFAULT_INTERVAL_MS = 5000;
const DEFAULT_ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const DEFAULT_ACTIVE_LIMIT = 25;
const DEFAULT_SLOW_TICK_MS = 1500;

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveInteger(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const number = Math.floor(toNumber(value, fallback));
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.min(number, max);
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

class WorldWorkerService {
  constructor(options = {}) {
    this.repository = options.repository;
    this.gameStateService = options.gameStateService || {};
    this.cityService = options.cityService || {};
    this.territoryService = options.territoryService || {};
    this.eventService = options.eventService || {};
    this.now = options.now || (() => new Date());
    this.monotonicNow = options.monotonicNow || (() => Date.now());
    this.intervalMs = positiveInteger(options.intervalMs, DEFAULT_INTERVAL_MS);
    this.activeWindowMs = positiveInteger(options.activeWindowMs, DEFAULT_ACTIVE_WINDOW_MS);
    this.activeLimit = positiveInteger(options.activeLimit, DEFAULT_ACTIVE_LIMIT, 1000);
    this.slowTickMs = positiveInteger(options.slowTickMs, DEFAULT_SLOW_TICK_MS);
    this.running = false;
    this.timer = null;
    this.lastSummary = null;
  }

  getNow() {
    const now = this.now();
    return now instanceof Date ? now : new Date(now);
  }

  getRecentlyActive(now) {
    if (!this.repository || typeof this.repository.findRecentlyActive !== 'function') return [];
    const activeSince = new Date(now.getTime() - this.activeWindowMs).toISOString();
    return this.repository.findRecentlyActive(activeSince, this.activeLimit);
  }

  advanceState(rawState, now) {
    const advanced = typeof this.gameStateService.advanceRuntimeState === 'function'
      ? this.gameStateService.advanceRuntimeState(rawState, now, { advanceWorldAi: false })
      : rawState;
    if (typeof this.cityService.advanceAllCities === 'function') {
      this.cityService.advanceAllCities(advanced, Math.floor(this.intervalMs / 1000));
    }
    this.territoryService.updateMissionReadiness?.(advanced);
    this.eventService.cleanupRuntimeState?.(advanced);
    this.eventService.maybeGenerateRegularEvent?.(advanced);
    this.eventService.maybeGenerateThreatEvent?.(advanced);
    advanced.updatedAt = now.toISOString();
    if (typeof this.repository?.save === 'function') this.repository.save(advanced);
    return advanced;
  }

  tickOnce() {
    if (this.running) {
      return {
        schema: 'world-worker-tick-summary-v1',
        skipped: true,
        reason: 'already-running',
        processedCount: 0,
        generatedAt: toIso(this.getNow()),
      };
    }
    this.running = true;
    const startedAtMs = this.monotonicNow();
    const now = this.getNow();
    const errors = [];
    let processedCount = 0;
    try {
      const gameStates = this.getRecentlyActive(now);
      for (const rawState of gameStates) {
        try {
          this.advanceState(rawState, now);
          processedCount += 1;
        } catch (error) {
          errors.push({
            playerId: rawState?.playerId || '',
            message: error?.message || String(error || ''),
          });
        }
      }
    } finally {
      this.running = false;
    }
    const durationMs = Math.max(0, this.monotonicNow() - startedAtMs);
    const summary = {
      schema: 'world-worker-tick-summary-v1',
      generatedAt: now.toISOString(),
      intervalMs: this.intervalMs,
      activeWindowMs: this.activeWindowMs,
      activeLimit: this.activeLimit,
      processedCount,
      errorCount: errors.length,
      errors,
      durationMs,
      slow: durationMs >= this.slowTickMs,
    };
    this.lastSummary = summary;
    return summary;
  }

  start() {
    this.stop();
    this.timer = setInterval(() => {
      const summary = this.tickOnce();
      if (summary.skipped) return;
      if (summary.errorCount || summary.slow) {
        const method = summary.errorCount ? 'error' : 'warn';
        console[method]('[world-worker] tick summary', summary);
      }
    }, this.intervalMs);
    return this.timer;
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  getStatus() {
    return {
      schema: 'world-worker-status-v1',
      running: this.running,
      intervalMs: this.intervalMs,
      activeWindowMs: this.activeWindowMs,
      activeLimit: this.activeLimit,
      lastSummary: this.lastSummary,
    };
  }
}

module.exports = WorldWorkerService;
