(function (global) {
  class TerritoryController {
    constructor(options = {}) {
      this.container = options.container;
      this.api = options.api;
      this.getState = options.getState || (() => ({}));
      this.onStateApplied = options.onStateApplied || (() => {});
      this.onFloatingText = options.onFloatingText || (() => {});
      this.onLog = options.onLog || (() => {});
    }

    bind() {
      if (!this.container || this.container.dataset.bound === 'true') return;
      this.container.dataset.bound = 'true';
      this.container.addEventListener('click', (event) => {
        const button = event.target.closest('[data-territory-action]');
        if (!button || button.disabled) return;
        this.handleAction(button).catch((error) => {
          this.onLog(`❌ ${error.payload?.message || error.message}`);
        });
      });
    }

    async handleAction(button) {
      const territoryId = button.dataset.territoryId;
      const action = button.dataset.territoryAction;
      button.disabled = true;
      button.classList.add('is-loading');
      try {
        let result;
        if (action === 'scout') result = await this.api.scoutTerritory(territoryId);
        if (action === 'conquer') result = await this.api.startConquest(territoryId, Number(button.dataset.soldiers) || 1);
        if (action === 'claim') result = await this.api.claimConquest(territoryId);
        if (action === 'rename-city') {
          const territory = (this.getState().territoryState?.territories || []).find((item) => item.id === territoryId);
          const name = global.prompt('为这座城市命名', territory?.cityName || territory?.naturalName || '');
          if (!name) return;
          result = await this.api.renameCity(territoryId, name);
        }
        if (result) {
          this.onStateApplied(result);
          this.onFloatingText(result.message || '疆域已更新');
          this.onLog(`✅ ${result.message || '疆域已更新'}`);
        }
      } finally {
        button.classList.remove('is-loading');
      }
    }
  }

  global.TerritoryController = TerritoryController;
  if (typeof module !== 'undefined' && module.exports) module.exports = TerritoryController;
})(typeof window !== 'undefined' ? window : globalThis);
