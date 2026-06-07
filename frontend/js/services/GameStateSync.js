(function (global) {
  class GameStateSync {
    constructor(api, intervalMs, scheduler = {}) {
      this.api = api;
      this.intervalMs = intervalMs;
      this.scheduler = {
        setInterval: scheduler.setInterval || (() => ({ disabled: true })),
        clearInterval: scheduler.clearInterval || (() => {}),
      };
      this.timer = null;
      this.onState = null;
      this.onHeartbeat = null;
      this.onError = null;
      this.onConnectionState = null;
      this.failureCount = 0;
      this.reconnecting = false;
      this.reconnectThreshold = Number(scheduler.reconnectThreshold || scheduler.reconnectThresholdCount) || 3;
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
