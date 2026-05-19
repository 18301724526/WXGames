(function (global) {
  class BuildingController {
    constructor(options) {
      this.actionAdapter = options.actionAdapter;
      this.api = options.api;
      this.onSuccess = options.onSuccess;
      this.onError = options.onError;
      this.onBusy = options.onBusy;
    }

    bind() {
      this.actionAdapter?.bindClick?.((action) => this.handleAction(action));
    }

    async handleAction({ buildingId, action, button }) {
      if (!buildingId) return;
      this.actionAdapter?.setLoading?.(button, true);
      this.onBusy && this.onBusy(true);
      try {
        const result = action === 'upgrade' ? await this.api.upgrade(buildingId) : await this.api.build(buildingId);
        this.onSuccess && this.onSuccess(result, action, buildingId);
      } catch (error) {
        this.onError && this.onError(error, action, buildingId);
      } finally {
        this.actionAdapter?.setLoading?.(button, false);
        this.onBusy && this.onBusy(false);
      }
    }
  }

  global.BuildingController = BuildingController;
  if (typeof module !== 'undefined' && module.exports) module.exports = BuildingController;
})(typeof window !== 'undefined' ? window : globalThis);
