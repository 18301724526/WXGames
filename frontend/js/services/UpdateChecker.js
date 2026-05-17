(function (global) {
  class UpdateChecker {
    constructor(options = {}) {
      this.api = options.api;
      this.intervalMs = options.intervalMs || 30000;
      this.onUpdate = options.onUpdate || (() => {});
      this.timer = null;
      this.currentDeploymentId = null;
      this.prompting = false;
    }

    async fetchVersion() {
      if (!this.api || typeof this.api.getVersion !== 'function') return null;
      return this.api.getVersion();
    }

    async start() {
      await this.check({ initialize: true }).catch(() => {});
      if (this.timer) return;
      this.timer = global.setInterval(() => {
        this.check().catch(() => {});
      }, this.intervalMs);
    }

    stop() {
      if (!this.timer) return;
      global.clearInterval(this.timer);
      this.timer = null;
    }

    async check(options = {}) {
      const version = await this.fetchVersion();
      const nextDeploymentId = version?.deploymentId;
      if (!nextDeploymentId) return null;
      if (!this.currentDeploymentId || options.initialize) {
        this.currentDeploymentId = nextDeploymentId;
        return version;
      }
      if (nextDeploymentId !== this.currentDeploymentId && !this.prompting) {
        this.prompting = true;
        this.stop();
        this.onUpdate(version, this.currentDeploymentId);
      }
      return version;
    }
  }

  global.UpdateChecker = UpdateChecker;
  if (typeof module !== 'undefined' && module.exports) module.exports = UpdateChecker;
})(typeof window !== 'undefined' ? window : globalThis);
