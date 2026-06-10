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
      this.currentVersion = '';
      this.prompting = false;
    }

    async fetchVersion() {
      if (!this.api || typeof this.api.getVersion !== 'function') return null;
      return this.api.getVersion();
    }

    async start() {
      global.H5LoadTrace?.mark?.('version:watch:start', {
        intervalMs: this.intervalMs,
      });
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
        global.H5LoadTrace?.phaseFail?.('version:check', error, {
          initialize: Boolean(options.initialize),
        });
        this.onError(error);
        return null;
      }
    }

    async check(options = {}) {
      const trace = global.H5LoadTrace;
      trace?.phaseStart?.('version:check', {
        initialize: Boolean(options.initialize),
      });
      const version = await this.fetchVersion();
      const nextDeploymentId = version?.deploymentId;
      if (!nextDeploymentId) {
        trace?.phaseEnd?.('version:check', {
          initialize: Boolean(options.initialize),
          deploymentId: '',
        });
        return null;
      }
      if (!this.currentDeploymentId || options.initialize) {
        this.currentDeploymentId = nextDeploymentId;
        this.currentVersion = version?.version || '';
        this.onLog({
          type: 'initialized',
          version,
          deploymentId: nextDeploymentId,
        });
        trace?.phaseEnd?.('version:check', {
          initialize: Boolean(options.initialize),
          deploymentId: nextDeploymentId,
          version: this.currentVersion,
        });
        return version;
      }
      if (nextDeploymentId !== this.currentDeploymentId && !this.prompting) {
        const previousDeploymentId = this.currentDeploymentId;
        const previousVersion = this.currentVersion || '';
        const nextVersion = version?.version || '';
        this.currentDeploymentId = nextDeploymentId;
        this.currentVersion = nextVersion;
        this.prompting = true;
        this.stop();
        const updateVersion = {
          ...version,
          serverVersion: nextVersion,
          localVersion: previousVersion,
          previousVersion,
          serverDeploymentId: nextDeploymentId,
          localDeploymentId: previousDeploymentId,
        };
        this.onLog({
          type: 'updated',
          version: updateVersion,
          deploymentId: nextDeploymentId,
          previousDeploymentId,
        });
        trace?.phaseEnd?.('version:check', {
          initialize: Boolean(options.initialize),
          deploymentId: nextDeploymentId,
          previousDeploymentId,
          updated: true,
        });
        this.onUpdate(updateVersion, previousDeploymentId);
        return updateVersion;
      }
      this.onLog({
        type: 'unchanged',
        version,
        deploymentId: nextDeploymentId,
      });
      trace?.phaseEnd?.('version:check', {
        initialize: Boolean(options.initialize),
        deploymentId: nextDeploymentId,
        changed: false,
      });
      return version;
    }
  }

  global.UpdateChecker = UpdateChecker;
  if (typeof module !== 'undefined' && module.exports) module.exports = UpdateChecker;
})(typeof window !== 'undefined' ? window : globalThis);
