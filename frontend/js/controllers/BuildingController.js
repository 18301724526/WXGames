(function (global) {
  class BuildingController {
    constructor(options) {
      this.api = options.api;
      this.onSuccess = options.onSuccess;
      this.onError = options.onError;
      this.onBusy = options.onBusy;
      this.busy = false;
    }

    async handleAction({ buildingId, action }) {
      if (!buildingId) return;
      if (this.busy) return;
      this.busy = true;
      this.onBusy && this.onBusy(true);
      try {
        const result = action === 'upgrade' ? await this.api.upgrade(buildingId) : await this.api.build(buildingId);
        this.onSuccess && this.onSuccess(result, action, buildingId);
      } catch (error) {
        this.onError && this.onError(error, action, buildingId);
      } finally {
        this.busy = false;
        this.onBusy && this.onBusy(false);
      }
    }
  }

  global.BuildingController = BuildingController;
  if (typeof module !== 'undefined' && module.exports) module.exports = BuildingController;
})(typeof window !== 'undefined' ? window : globalThis);
