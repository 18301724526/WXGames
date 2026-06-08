(function (global) {
  function toTimestamp(value, fallback = Number.NaN) {
    if (value === null || value === undefined || value === '') return fallback;
    const stamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(stamp) ? stamp : fallback;
  }

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function collectActiveWorldExplorerMissions(state = {}) {
    const explorer = state?.worldExplorerState || state?.gameState?.worldExplorerState || {};
    const result = [];
    const seen = new Set();
    const append = (mission) => {
      if (!mission || typeof mission !== 'object' || mission.status !== 'active') return;
      const key = mission.id || `${mission.startedAt || ''}:${mission.completesAt || ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      result.push(mission);
    };
    append(explorer.activeMission);
    (Array.isArray(explorer.missions) ? explorer.missions : []).forEach(append);
    return result;
  }

  class GameStateSync {
    constructor(api, intervalMs, scheduler = {}) {
      this.api = api;
      this.intervalMs = intervalMs;
      this.scheduler = {
        setInterval: scheduler.setInterval || (() => ({ disabled: true })),
        clearInterval: scheduler.clearInterval || (() => {}),
        now: scheduler.now || (() => Date.now()),
      };
      this.timer = null;
      this.onState = null;
      this.onHeartbeat = null;
      this.onError = null;
      this.onConnectionState = null;
      this.getLocalState = typeof scheduler.getLocalState === 'function' ? scheduler.getLocalState : null;
      this.failureCount = 0;
      this.reconnecting = false;
      this.reconnectThreshold = Number(scheduler.reconnectThreshold || scheduler.reconnectThresholdCount) || 3;
      this.stateRefreshLeadTimeMs = Math.max(0, toNumber(scheduler.stateRefreshLeadTimeMs, 250));
      this.stateRefreshMinIntervalMs = Math.max(0, toNumber(scheduler.stateRefreshMinIntervalMs, 1000));
      this.lastStateRefreshAt = 0;
      this.refreshingState = false;
    }

    setStateProvider(getLocalState) {
      this.getLocalState = typeof getLocalState === 'function' ? getLocalState : null;
      return Boolean(this.getLocalState);
    }

    getNowMs(heartbeatData = {}) {
      const serverTimeMs = toTimestamp(heartbeatData.serverTime, Number.NaN);
      if (Number.isFinite(serverTimeMs)) return serverTimeMs;
      return toNumber(this.scheduler.now?.(), Date.now());
    }

    getAuthorityStateRefreshReason(state = {}, heartbeatData = {}) {
      const nowMs = this.getNowMs(heartbeatData);
      const dueAtThresholdMs = nowMs + this.stateRefreshLeadTimeMs;
      const missions = collectActiveWorldExplorerMissions(state);
      for (const mission of missions) {
        const nextStepAtMs = toTimestamp(mission.nextStepAt, Number.NaN);
        if (Number.isFinite(nextStepAtMs) && nextStepAtMs <= dueAtThresholdMs) {
          return {
            type: 'worldExplorerStepDue',
            missionId: mission.id || '',
            dueAt: new Date(nextStepAtMs).toISOString(),
          };
        }
        const completesAtMs = toTimestamp(mission.completesAt, Number.NaN);
        if (Number.isFinite(completesAtMs) && completesAtMs <= dueAtThresholdMs) {
          return {
            type: 'worldExplorerCompletionDue',
            missionId: mission.id || '',
            dueAt: new Date(completesAtMs).toISOString(),
          };
        }
      }
      return null;
    }

    async refreshAuthorityStateIfNeeded(heartbeatData = {}) {
      if (this.refreshingState || typeof this.api?.getState !== 'function' || typeof this.getLocalState !== 'function') {
        return null;
      }
      const reason = this.getAuthorityStateRefreshReason(this.getLocalState(), heartbeatData);
      if (!reason) return null;
      const nowMs = this.getNowMs(heartbeatData);
      if (this.lastStateRefreshAt && nowMs - this.lastStateRefreshAt < this.stateRefreshMinIntervalMs) return null;
      this.lastStateRefreshAt = nowMs;
      this.refreshingState = true;
      try {
        const data = await this.api.getState();
        if (this.onState) this.onState(data, reason);
        return data;
      } finally {
        this.refreshingState = false;
      }
    }

    async fetchNow() {
      if (this.fetching) return;
      this.fetching = true;
      try {
        if (typeof this.api?.heartbeat !== 'function') {
          throw new Error('GameStateSync requires a lightweight heartbeat endpoint');
        }
        const data = await this.api.heartbeat();
        this.failureCount = 0;
        if (this.reconnecting) {
          this.reconnecting = false;
          if (this.onConnectionState) this.onConnectionState({ status: 'online', failureCount: 0, data });
        }
        if (this.onHeartbeat) this.onHeartbeat(data);
        await this.refreshAuthorityStateIfNeeded(data);
        return data;
      } catch (error) {
        this.failureCount += 1;
        if (this.failureCount >= this.reconnectThreshold && !this.reconnecting) {
          this.reconnecting = true;
          if (this.onConnectionState) this.onConnectionState({ status: 'reconnecting', failureCount: this.failureCount, error });
        } else if (this.reconnecting && this.onConnectionState) {
          this.onConnectionState({ status: 'reconnecting', failureCount: this.failureCount, error });
        }
        if (this.onError) this.onError(error);
        throw error;
      } finally {
        this.fetching = false;
      }
    }

    start() {
      this.stop();
      this.timer = this.scheduler.setInterval(() => this.fetchNow().catch(() => {}), this.intervalMs);
    }

    setIntervalMs(intervalMs) {
      const nextInterval = Number(intervalMs) || this.intervalMs;
      if (nextInterval === this.intervalMs) return;
      const wasRunning = Boolean(this.timer);
      this.intervalMs = nextInterval;
      if (wasRunning) this.start();
    }

    stop() {
      if (this.timer) {
        this.scheduler.clearInterval(this.timer);
        this.timer = null;
      }
    }
  }

  global.GameStateSync = GameStateSync;
  if (typeof module !== 'undefined' && module.exports) module.exports = GameStateSync;
})(typeof window !== 'undefined' ? window : globalThis);
