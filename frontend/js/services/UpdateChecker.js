(function (global) {
  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

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
        now: options.scheduler?.now || (() => Date.now()),
      };
      this.timer = null;
      this.currentDeploymentId = null;
      this.currentVersion = '';
      this.prompting = false;
      this.failureCount = 0;
      this.backoffBaseMs = Math.max(0, toNumber(options.backoffBaseMs, this.intervalMs));
      this.backoffMaxMs = Math.max(this.backoffBaseMs, toNumber(options.backoffMaxMs, Math.max(this.intervalMs, 60000)));
      this.nextAllowedAt = 0;
      this.trace = options.trace || null;
      this.onDeployFailure = options.onDeployFailure || (() => {});
      this.lastDeployFailureSignature = '';
    }

    async fetchVersion() {
      if (!this.api || typeof this.api.getVersion !== 'function') return null;
      return this.api.getVersion();
    }

    getBackoffMs(failureCount = this.failureCount) {
      if (this.backoffBaseMs <= 0) return 0;
      const exponent = Math.max(0, Number(failureCount || 1) - 1);
      const delayMs = this.backoffBaseMs * (2 ** exponent);
      return Math.min(this.backoffMaxMs, delayMs);
    }

    updateBackoffWindow() {
      const nowMs = toNumber(this.scheduler.now?.(), Date.now());
      const delayMs = this.getBackoffMs();
      this.nextAllowedAt = delayMs > 0 ? nowMs + delayMs : 0;
      return this.nextAllowedAt;
    }

    canCheckNow(nowMs = toNumber(this.scheduler.now?.(), Date.now())) {
      return !this.nextAllowedAt || nowMs >= this.nextAllowedAt;
    }

    async start() {
      this.trace?.mark?.('version:watch:start', {
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
      if (!options.initialize && !this.canCheckNow()) return null;
      try {
        const result = await this.check(options);
        this.failureCount = 0;
        this.nextAllowedAt = 0;
        return result;
      } catch (error) {
        this.failureCount += 1;
        this.updateBackoffWindow();
        this.trace?.phaseFail?.('version:check', error, {
          initialize: Boolean(options.initialize),
          failureCount: this.failureCount,
          nextAllowedAt: this.nextAllowedAt,
        });
        this.onError(error);
        return null;
      }
    }

    async check(options = {}) {
      const trace = this.trace;
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
      const deployStatus = version?.deployStatus || null;
      if (deployStatus?.status === 'failed') {
        const signature = [
          deployStatus.targetCommit || '',
          deployStatus.stage || '',
          deployStatus.updatedAt || '',
          deployStatus.exitCode ?? '',
          deployStatus.error?.message || '',
        ].join('|');
        if (signature && signature !== this.lastDeployFailureSignature) {
          this.lastDeployFailureSignature = signature;
          this.onLog({
            type: 'deployFailed',
            version,
            deploymentId: nextDeploymentId,
            deployStatus,
          });
          this.onDeployFailure(version, deployStatus);
        }
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
