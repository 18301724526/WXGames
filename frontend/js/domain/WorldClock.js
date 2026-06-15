(function (global) {
  const EPOCH_SECONDS_THRESHOLD = 1000000000;
  const EPOCH_MILLISECONDS_THRESHOLD = 1000000000000;

  function toNumber(value, fallback = Number.NaN) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function toEpochMs(value, fallback = Number.NaN) {
    if (value === null || value === undefined || value === '') return fallback;
    if (value instanceof Date) {
      const stamp = value.getTime();
      return Number.isFinite(stamp) ? stamp : fallback;
    }
    if (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) {
      const number = Number(value);
      if (Number.isFinite(number)) {
        if (Math.abs(number) >= EPOCH_MILLISECONDS_THRESHOLD) return number;
        if (Math.abs(number) >= EPOCH_SECONDS_THRESHOLD) return number * 1000;
      }
    }
    const stamp = new Date(value).getTime();
    return Number.isFinite(stamp) ? stamp : fallback;
  }

  function getMonotonicNow(runtime = null) {
    const perfNow = runtime?.performance?.now?.() ?? global.performance?.now?.();
    if (Number.isFinite(Number(perfNow))) return Number(perfNow);
    return Date.now();
  }

  class WorldClock {
    constructor(options = {}) {
      this.runtime = options.runtime || null;
      this.serverEpochAtSyncMs = Number.NaN;
      this.clientMonoAtSyncMs = Number.NaN;
      this.lastSyncedAtEpochMs = Number.NaN;
      this.update(options);
    }

    nowMonoMs() {
      return getMonotonicNow(this.runtime);
    }

    update(options = {}) {
      const serverEpochMs = toEpochMs(
        options.serverTime
          ?? options.serverNowMs
          ?? options.epochNowMs
          ?? options.nowEpochMs,
        Number.NaN,
      );
      if (!Number.isFinite(serverEpochMs)) return false;
      const clientMonoMs = Number.isFinite(Number(options.clientMonoMs))
        ? Number(options.clientMonoMs)
        : this.nowMonoMs();
      this.serverEpochAtSyncMs = serverEpochMs;
      this.clientMonoAtSyncMs = clientMonoMs;
      this.lastSyncedAtEpochMs = Date.now();
      return true;
    }

    updateFromPayload(payload = {}) {
      if (!payload || typeof payload !== 'object') return false;
      return this.update({
        serverTime: payload.serverTime
          ?? payload.authority?.serverTime
          ?? payload.authority?.command?.serverTime
          ?? payload.timeline?.serverTime
          ?? payload.details?.serverTime
          ?? payload.details?.timeline?.serverTime
          ?? payload.gameState?.serverTime
          ?? payload.state?.serverTime,
        serverNowMs: payload.nowMs
          ?? payload.timeline?.nowMs
          ?? payload.details?.timeline?.nowMs
          ?? payload.gameState?.nowMs
          ?? payload.state?.nowMs,
      });
    }

    isSynced() {
      return Number.isFinite(this.serverEpochAtSyncMs)
        && Number.isFinite(this.clientMonoAtSyncMs);
    }

    getEpochNowMs(fallback = Date.now()) {
      if (!this.isSynced()) return toEpochMs(fallback, Date.now());
      const elapsedMs = Math.max(0, this.nowMonoMs() - this.clientMonoAtSyncMs);
      return this.serverEpochAtSyncMs + elapsedMs;
    }

    getOffsetMs() {
      if (!this.isSynced()) return 0;
      return this.getEpochNowMs() - Date.now();
    }

    static getShared(options = {}) {
      const current = global.__WorldClockShared;
      if (current instanceof WorldClock) {
        if (options.runtime && current.runtime !== options.runtime) current.runtime = options.runtime;
        current.update(options);
        return current;
      }
      const clock = new WorldClock(options);
      global.__WorldClockShared = clock;
      return clock;
    }

    static getClock(source = {}) {
      return source?.worldClock
        || source?.host?.worldClock
        || source?.runtime?.worldClock
        || global.__WorldClockShared
        || null;
    }

    static getEpochNowMs(source = {}, fallback = Date.now()) {
      const clock = WorldClock.getClock(source);
      if (
        clock
        && typeof clock.getEpochNowMs === 'function'
        && (typeof clock.isSynced !== 'function' || clock.isSynced())
      ) {
        return clock.getEpochNowMs(fallback);
      }
      const parsedFallback = toEpochMs(fallback, Number.NaN);
      if (Number.isFinite(parsedFallback)) return parsedFallback;
      return arguments.length >= 2 ? Number.NaN : Date.now();
    }

    static sync(source = {}, payload = {}) {
      const clock = WorldClock.getClock(source)
        || WorldClock.getShared({ runtime: source?.runtime || source });
      const synced = clock.updateFromPayload(payload);
      if (source && typeof source === 'object' && !source.worldClock) source.worldClock = clock;
      return synced;
    }
  }

  const api = {
    EPOCH_MILLISECONDS_THRESHOLD,
    EPOCH_SECONDS_THRESHOLD,
    WorldClock,
    getEpochNowMs: WorldClock.getEpochNowMs,
    getShared: WorldClock.getShared,
    sync: WorldClock.sync,
    toEpochMs,
    toNumber,
  };

  global.WorldClock = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
