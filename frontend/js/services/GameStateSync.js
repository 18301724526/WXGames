(function (global) {
  class GameStateSync {
    constructor(api, intervalMs) {
      this.api = api;
      this.intervalMs = intervalMs;
      this.timer = null;
      this.onState = null;
      this.onError = null;
    }

    async fetchNow() {
      try {
        const data = await this.api.getState();
        if (this.onState) this.onState(data);
        return data;
      } catch (error) {
        if (this.onError) this.onError(error);
        throw error;
      }
    }

    start() {
      this.stop();
      this.timer = setInterval(() => this.fetchNow().catch(() => {}), this.intervalMs);
    }

    stop() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }
  }

  global.GameStateSync = GameStateSync;
  if (typeof module !== 'undefined' && module.exports) module.exports = GameStateSync;
})(typeof window !== 'undefined' ? window : globalThis);
