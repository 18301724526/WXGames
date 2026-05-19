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
      this.onError = null;
    }

    async fetchNow() {
      if (this.fetching) return;
      this.fetching = true;
      try {
        const data = await this.api.getState();
        if (this.onState) this.onState(data);
        return data;
      } catch (error) {
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
