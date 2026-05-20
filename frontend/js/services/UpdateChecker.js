(function (global) {
  class UpdateChecker {
    constructor(options = {}) {
      this.api = options.api;
      this.intervalMs = options.intervalMs || 30000;
      this.onUpdate = options.onUpdate || (() => {});
      this.onError = options.onError || (() => {});
      this.onLog = options.onLog || (() => {});
      this.scheduler = {
        setInterval: options.scheduler?.setInterval || (() => ({ disabled: true })),
        clearInterval: options.scheduler?.clearInterval || (() => {}),
      };
      this.timer = null;
      this.currentDeploymentId = null;
      this.prompting = false;
    }

    async fetchVersion() {
      if (!this.api || typeof this.api.getVersion !== 'function') return null;
      return this.api.getVersion();
    }

    async start() {
      await this.safeCheck({ initialize: true });
      if (this.timer) return;
      this.timer = this.scheduler.setInterval(() => {
        this.safeCheck();
      }, this.intervalMs);
    }

    stop() {
      if (!this.timer) return;
      this.scheduler.clearInterval(this.timer);
      this.timer = null;
    }

    async safeCheck(options = {}) {
      try {
        return await this.check(options);
      } catch (error) {
        this.onError(error);
        return null;
      }
    }

    async check(options = {}) {
      const version = await this.fetchVersion();
      const nextDeploymentId = version?.deploymentId;
      if (!nextDeploymentId) return null;
      if (!this.currentDeploymentId || options.initialize) {
        this.currentDeploymentId = nextDeploymentId;
        this.onLog({
          type: 'initialized',
          version,
          deploymentId: nextDeploymentId,
        });
        return version;
      }
      if (nextDeploymentId !== this.currentDeploymentId && !this.prompting) {
        const previousDeploymentId = this.currentDeploymentId;
        this.currentDeploymentId = nextDeploymentId;
        this.prompting = true;
        this.stop();
        this.onLog({
          type: 'updated',
          version,
          deploymentId: nextDeploymentId,
          previousDeploymentId,
        });
        this.onUpdate(version, previousDeploymentId);
        return version;
      }
      this.onLog({
        type: 'unchanged',
        version,
        deploymentId: nextDeploymentId,
      });
      return version;
    }
  }

  global.UpdateChecker = UpdateChecker;
  if (typeof module !== 'undefined' && module.exports) module.exports = UpdateChecker;
})(typeof window !== 'undefined' ? window : globalThis);
