(function (global) {
  class BuildingController {
    constructor(options) {
      this.container = options.container;
      this.api = options.api;
      this.onSuccess = options.onSuccess;
      this.onError = options.onError;
      this.onBusy = options.onBusy;
    }

    bind() {
      if (!this.container || this.container.dataset.bound === 'true') return;
      this.container.dataset.bound = 'true';
      this.container.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-building-id]');
        if (!button || button.disabled) return;
        const buildingId = button.dataset.buildingId;
        const action = button.dataset.action;
        button.disabled = true;
        button.classList.add('is-loading');
        this.onBusy && this.onBusy(true);
        try {
          const result = action === 'upgrade' ? await this.api.upgrade(buildingId) : await this.api.build(buildingId);
          this.onSuccess && this.onSuccess(result, action, buildingId);
        } catch (error) {
          this.onError && this.onError(error, action, buildingId);
        } finally {
          button.classList.remove('is-loading');
          this.onBusy && this.onBusy(false);
        }
      });
    }
  }

  global.BuildingController = BuildingController;
  if (typeof module !== 'undefined' && module.exports) module.exports = BuildingController;
})(typeof window !== 'undefined' ? window : globalThis);
