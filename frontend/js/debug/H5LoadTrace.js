(function (global) {
  const DEFAULT_PROGRESS_STEP = 10;
  const DEFAULT_SLOW_API_MS = 1000;

  function safeNow(runtime = global) {
    const perfNow = runtime?.performance?.now?.();
    return Number.isFinite(perfNow) ? perfNow : Date.now();
  }

  function toBooleanFlag(value, fallback = true) {
    if (value === true || value === '1' || value === 'true' || value === 'on') return true;
    if (value === false || value === '0' || value === 'false' || value === 'off') return false;
    return fallback;
  }

  function readRuntimeFlag(runtime = global) {
    try {
      const params = new URL(runtime.location?.href || '').searchParams;
      const queryValue = params.get('loadTrace') || params.get('h5LoadTrace');
      if (queryValue !== null) return toBooleanFlag(queryValue, true);
    } catch (_) {}
    try {
      const storageValue = runtime.localStorage?.getItem?.('h5LoadTrace');
      if (storageValue !== null && storageValue !== undefined) return toBooleanFlag(storageValue, true);
    } catch (_) {}
    return true;
  }

  function formatDuration(ms) {
    const value = Math.max(0, Math.round(Number(ms) || 0));
    return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${value}ms`;
  }

  function clampPercentage(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(100, Math.round(number)));
  }

  class H5LoadTrace {
    constructor(options = {}) {
      this.runtime = options.runtime || global;
      this.console = options.console || this.runtime.console || console;
      this.now = typeof options.now === 'function' ? options.now : () => safeNow(this.runtime);
      this.enabled = options.enabled !== undefined ? Boolean(options.enabled) : readRuntimeFlag(this.runtime);
      this.progressStep = Math.max(1, Number(options.progressStep) || DEFAULT_PROGRESS_STEP);
      this.slowApiMs = Math.max(0, Number(options.slowApiMs) || DEFAULT_SLOW_API_MS);
      this.startedAt = this.now();
      this.readyAt = 0;
      this.phaseStarts = new Map();
      this.progressByPhase = new Map();
      this.apiSeq = 0;
      this.loggedBoot = false;
    }

    isEnabled() {
      return this.enabled !== false;
    }

    isBootActive() {
      return !this.readyAt;
    }

    getElapsedMs() {
      return Math.max(0, this.now() - this.startedAt);
    }

    buildPayload(detail = {}) {
      const elapsedMs = Math.round(this.getElapsedMs());
      return {
        atMs: elapsedMs,
        at: formatDuration(elapsedMs),
        ...detail,
      };
    }

    write(level, event, detail = {}) {
      if (!this.isEnabled()) return null;
      const writer = this.console?.[level] || this.console?.log;
      if (typeof writer !== 'function') return null;
      const payload = this.buildPayload(detail);
      writer.call(this.console, `[H5LoadTrace] ${event}`, payload);
      return payload;
    }

    boot(detail = {}) {
      if (this.loggedBoot) return null;
      this.loggedBoot = true;
      return this.write('info', 'boot', detail);
    }

    mark(event, detail = {}) {
      if (!this.isBootActive() && !detail.forceLog) return null;
      return this.write('info', event, detail);
    }

    warn(event, detail = {}) {
      return this.write('warn', event, detail);
    }

    error(event, detail = {}) {
      return this.write('error', event, detail);
    }

    phaseStart(name, detail = {}) {
      const startedAt = this.now();
      this.phaseStarts.set(name, startedAt);
      if (!this.isBootActive() && !detail.forceLog) return null;
      return this.write('info', 'phase:start', {
        phase: name,
        ...detail,
      });
    }

    phaseEnd(name, detail = {}) {
      const endedAt = this.now();
      const startedAt = this.phaseStarts.get(name);
      this.phaseStarts.delete(name);
      const durationMs = Number.isFinite(startedAt) ? Math.round(endedAt - startedAt) : 0;
      const shouldLog = this.isBootActive() || durationMs >= this.slowApiMs || detail.forceLog;
      if (!shouldLog) return null;
      return this.write(durationMs >= this.slowApiMs ? 'warn' : 'info', 'phase:end', {
        phase: name,
        durationMs,
        duration: formatDuration(durationMs),
        ...detail,
      });
    }

    phaseFail(name, error, detail = {}) {
      const endedAt = this.now();
      const startedAt = this.phaseStarts.get(name);
      this.phaseStarts.delete(name);
      const durationMs = Number.isFinite(startedAt) ? Math.round(endedAt - startedAt) : 0;
      return this.write('error', 'phase:fail', {
        phase: name,
        durationMs,
        duration: formatDuration(durationMs),
        error: error?.message || String(error || ''),
        ...detail,
      });
    }

    progress(phase, progress = {}) {
      if (!this.isEnabled()) return null;
      const percentage = clampPercentage(progress.percentage);
      const completed = Math.max(0, Number(progress.completed) || 0);
      const total = Math.max(0, Number(progress.total) || 0);
      const status = progress.status || '';
      const previous = this.progressByPhase.get(phase) || null;
      const importantStatus = status === 'start' || status === 'error' || status === 'failed' || percentage >= 100;
      const crossedStep = !previous
        || percentage - previous.percentage >= this.progressStep
        || Math.floor(percentage / this.progressStep) > Math.floor(previous.percentage / this.progressStep);
      const completedJump = previous && completed - previous.completed >= 10;
      if (!importantStatus && !crossedStep && !completedJump) return null;
      const payload = {
        phase,
        percentage,
        completed,
        total,
        loaded: Math.max(0, Number(progress.loaded) || 0),
        failed: Math.max(0, Number(progress.failed) || 0),
        assetPath: progress.assetPath || '',
        status,
      };
      this.progressByPhase.set(phase, { percentage, completed });
      const level = payload.failed > 0 || status === 'error' || status === 'failed' ? 'warn' : 'info';
      return this.write(level, 'progress', payload);
    }

    apiStart(method, path, url, detail = {}) {
      const span = {
        id: ++this.apiSeq,
        startedAt: this.now(),
        method,
        path,
        url,
      };
      if (this.isBootActive() || detail.forceLog) {
        this.write('info', 'api:start', {
          id: span.id,
          method,
          path,
          url,
          ...detail,
        });
      }
      return span;
    }

    apiEnd(span = {}, detail = {}) {
      const startedAt = Number.isFinite(Number(span.startedAt)) ? Number(span.startedAt) : this.now();
      const durationMs = Math.round(this.now() - startedAt);
      const shouldLog = this.isBootActive() || durationMs >= this.slowApiMs || detail.forceLog;
      if (!shouldLog) return null;
      return this.write(durationMs >= this.slowApiMs ? 'warn' : 'info', 'api:end', {
        id: span.id,
        method: span.method,
        path: span.path,
        url: span.url,
        durationMs,
        duration: formatDuration(durationMs),
        ...detail,
      });
    }

    apiFail(span = {}, error, detail = {}) {
      const startedAt = Number.isFinite(Number(span.startedAt)) ? Number(span.startedAt) : this.now();
      const durationMs = Math.round(this.now() - startedAt);
      return this.write('error', 'api:fail', {
        id: span.id,
        method: span.method,
        path: span.path,
        url: span.url,
        durationMs,
        duration: formatDuration(durationMs),
        error: error?.message || String(error || ''),
        ...detail,
      });
    }

    ready(detail = {}) {
      if (this.readyAt) return null;
      this.readyAt = this.now();
      const durationMs = Math.round(this.readyAt - this.startedAt);
      return this.write('info', 'boot:ready', {
        durationMs,
        duration: formatDuration(durationMs),
        ...detail,
      });
    }

    summarizePayload(payload = {}) {
      if (!payload || typeof payload !== 'object') return {};
      const gameState = payload.gameState || payload.state || payload;
      const territoryState = gameState.territoryState || {};
      const worldMap = territoryState.worldMap || gameState.worldMap || {};
      const worldExplorerState = gameState.worldExplorerState || {};
      return {
        keys: Object.keys(payload).slice(0, 12),
        hasGameState: Boolean(payload.gameState || payload.state),
        playerId: gameState.playerId || '',
        worldMapTiles: Array.isArray(worldMap.tiles) ? worldMap.tiles.length : 0,
        missions: Array.isArray(worldExplorerState.missions) ? worldExplorerState.missions.length : 0,
        activeMission: worldExplorerState.activeMission?.id || '',
      };
    }
  }

  const existing = global.H5LoadTrace;
  if (!existing || typeof existing.mark !== 'function') {
    global.H5LoadTrace = new H5LoadTrace({ runtime: global });
    global.H5LoadTrace.boot({
      href: global.location?.href || '',
      userAgent: global.navigator?.userAgent || '',
    });
  }
  global.H5LoadTraceClass = H5LoadTrace;
  if (typeof module !== 'undefined' && module.exports) module.exports = H5LoadTrace;
})(typeof window !== 'undefined' ? window : globalThis);
