(function (global) {
  class TerritoryController {
    constructor(options = {}) {
      this.container = options.container;
      this.scoutContainer = options.scoutContainer;
      this.api = options.api;
      this.getState = options.getState || (() => ({}));
      this.onStateApplied = options.onStateApplied || (() => {});
      this.onFloatingText = options.onFloatingText || (() => {});
      this.onLog = options.onLog || (() => {});
    }

    bind() {
      if (this.container && this.container.dataset.bound !== 'true') {
        this.container.dataset.bound = 'true';
        this.container.addEventListener('click', (event) => {
          const button = event.target.closest('[data-territory-action]');
          if (!button || button.disabled) return;
          this.handleAction(button).catch((error) => {
            this.onLog(`❌ ${error.payload?.message || error.message}`);
          });
        });
      }
      if (this.scoutContainer && this.scoutContainer.dataset.bound !== 'true') {
        this.scoutContainer.dataset.bound = 'true';
        this.scoutContainer.addEventListener('click', (event) => {
          const button = event.target.closest('[data-scout-direction], [data-scout-claim]');
          if (!button || button.disabled) return;
          this.handleScoutAction(button).catch((error) => {
            this.onLog(`❌ ${error.payload?.message || error.message}`);
          });
        });
      }
    }

    async runButton(button, callback) {
      button.disabled = true;
      button.classList.add('is-loading');
      try {
        const result = await callback();
        if (result) {
          this.onStateApplied(result);
          this.onFloatingText(result.message || '疆域已更新');
          this.onLog(`✅ ${result.message || '疆域已更新'}`);
        }
      } finally {
        button.classList.remove('is-loading');
      }
    }

    async handleScoutAction(button) {
      if (button.dataset.scoutDirection) {
        await this.runButton(button, () => this.api.scoutTerritory(button.dataset.scoutDirection));
        return;
      }
      if (button.dataset.scoutClaim) {
        await this.runButton(button, () => this.api.claimScout(button.dataset.scoutClaim));
      }
    }

    async handleAction(button) {
      const territoryId = button.dataset.territoryId;
      const action = button.dataset.territoryAction;
      await this.runButton(button, async () => {
        if (action === 'conquer') return this.api.startConquest(territoryId, Number(button.dataset.soldiers) || 1);
        if (action === 'claim') return this.api.claimConquest(territoryId);
        if (action === 'rename-city') {
          const territory = (this.getState().territoryState?.territories || []).find((item) => item.id === territoryId);
          const name = global.prompt('为这座城市命名', territory?.cityName || territory?.naturalName || '');
          if (!name) return null;
          return this.api.renameCity(territoryId, name);
        }
        return null;
      });
    }
  }

  global.TerritoryController = TerritoryController;
  if (typeof module !== 'undefined' && module.exports) module.exports = TerritoryController;
})(typeof window !== 'undefined' ? window : globalThis);
