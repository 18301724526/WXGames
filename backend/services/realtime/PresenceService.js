const DEFAULT_ONLINE_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MIN_PERSIST_INTERVAL_MS = 60 * 1000;
const DEFAULT_MAX_ENTRIES = 20000;

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toPositiveInteger(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const number = Math.floor(toNumber(value, fallback));
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.min(number, max);
}

function nowMsFrom(value) {
  const stamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(stamp) ? stamp : Date.now();
}

class PresenceService {
  constructor(options = {}) {
    this.repository = options.repository || null;
    this.now = options.now || (() => new Date());
    this.onlineWindowMs = toPositiveInteger(options.onlineWindowMs, DEFAULT_ONLINE_WINDOW_MS);
    this.minPersistIntervalMs = toPositiveInteger(
      options.minPersistIntervalMs,
      DEFAULT_MIN_PERSIST_INTERVAL_MS,
    );
    this.maxEntries = toPositiveInteger(options.maxEntries, DEFAULT_MAX_ENTRIES);
    this.entries = new Map();
  }

  getNowMs() {
    return nowMsFrom(this.now());
  }

  getNowIso(nowMs = this.getNowMs()) {
    return new Date(nowMs).toISOString();
  }

  prune(nowMs = this.getNowMs()) {
    const cutoff = nowMs - this.onlineWindowMs;
    for (const [playerId, entry] of this.entries.entries()) {
      if (!entry || entry.lastSeenAtMs < cutoff) this.entries.delete(playerId);
    }
    if (this.entries.size <= this.maxEntries) return;
    const sorted = [...this.entries.entries()]
      .sort((left, right) => left[1].lastSeenAtMs - right[1].lastSeenAtMs);
    const removeCount = Math.max(0, sorted.length - this.maxEntries);
    for (let index = 0; index < removeCount; index += 1) {
      this.entries.delete(sorted[index][0]);
    }
  }

  shouldPersist(entry, nowMs) {
    if (!this.repository || typeof this.repository.touchPlayerActiveAt !== 'function') return false;
    if (!entry?.lastPersistedAtMs) {
      return nowMs - entry.firstSeenAtMs >= this.minPersistIntervalMs;
    }
    return nowMs - entry.lastPersistedAtMs >= this.minPersistIntervalMs;
  }

  recordHeartbeat(playerId, options = {}) {
    const normalizedPlayerId = String(playerId || '').trim();
    if (!normalizedPlayerId) {
      return {
        success: false,
        persisted: false,
        error: 'PLAYER_ID_REQUIRED',
      };
    }
    const nowMs = this.getNowMs();
    const existing = this.entries.get(normalizedPlayerId) || {
      playerId: normalizedPlayerId,
      firstSeenAtMs: nowMs,
      lastSeenAtMs: 0,
      lastPersistedAtMs: 0,
      heartbeatCount: 0,
    };
    const entry = {
      ...existing,
      lastSeenAtMs: nowMs,
      heartbeatCount: existing.heartbeatCount + 1,
      metadata: options.metadata || existing.metadata || null,
    };
    let persisted = false;
    if (this.shouldPersist(entry, nowMs)) {
      this.repository.touchPlayerActiveAt(normalizedPlayerId);
      entry.lastPersistedAtMs = nowMs;
      persisted = true;
    }
    this.entries.set(normalizedPlayerId, entry);
    this.prune(nowMs);
    return {
      success: true,
      schema: 'presence-heartbeat-v1',
      playerId: normalizedPlayerId,
      persisted,
      lastSeenAt: this.getNowIso(entry.lastSeenAtMs),
      heartbeatCount: entry.heartbeatCount,
    };
  }

  getOnlineSummary(options = {}) {
    const nowMs = this.getNowMs();
    this.prune(nowMs);
    const windowsSeconds = Array.isArray(options.windowsSeconds) && options.windowsSeconds.length
      ? options.windowsSeconds
      : [60, 600, 900];
    const windows = {};
    for (const seconds of windowsSeconds) {
      const normalizedSeconds = toPositiveInteger(seconds, 60, 24 * 60 * 60);
      const cutoff = nowMs - normalizedSeconds * 1000;
      windows[`last${normalizedSeconds}s`] = [...this.entries.values()]
        .filter((entry) => entry.lastSeenAtMs >= cutoff)
        .length;
    }
    const recentLimit = Math.max(0, Math.min(100, Math.floor(toNumber(options.recentLimit, 12))));
    const recentPlayers = [...this.entries.values()]
      .sort((left, right) => right.lastSeenAtMs - left.lastSeenAtMs)
      .slice(0, recentLimit)
      .map((entry) => ({
        playerId: entry.playerId,
        lastSeenAt: this.getNowIso(entry.lastSeenAtMs),
        heartbeatCount: entry.heartbeatCount,
      }));
    return {
      schema: 'presence-summary-v1',
      generatedAt: this.getNowIso(nowMs),
      totalOnline: this.entries.size,
      windows,
      recentPlayers,
      minPersistIntervalMs: this.minPersistIntervalMs,
      onlineWindowMs: this.onlineWindowMs,
    };
  }
}

module.exports = PresenceService;
