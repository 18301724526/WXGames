(function (global) {
  class MiniGameApp {
    constructor(options = {}) {
      this.runtime = options.runtime || null;
      if (!this.runtime) throw new Error('MiniGame runtime is required');
      this.presenter = options.presenter || null;
      this.config = options.config || {};
      const ApiClass = options.apiClass || null;
      const RendererClass = options.rendererClass || null;
      this.api = options.api || (ApiClass ? new ApiClass(
        options.apiBase || this.config.API_BASE || '/api',
        this.runtime.getStorage('token'),
        { transport: this.runtime },
      ) : null);
      if (!this.api) throw new Error('MiniGame API is required');
      this.renderer = options.renderer || (RendererClass ? new RendererClass({
        runtime: this.runtime,
        presenter: this.presenter,
      }) : null);
      if (!this.renderer) throw new Error('MiniGame renderer is required');
      if (typeof this.renderer.setAssetsChangedHandler === 'function') {
        this.renderer.setAssetsChangedHandler(() => this.render());
      }
      this.syncIntervalMs = options.syncIntervalMs || this.config.SYNC_INTERVAL_MS || 2000;
      this.state = options.initialState || {
        resources: {},
        population: {},
        currentEra: 0,
        softGuide: null,
      };
      this.activeTab = options.activeTab || 'resources';
      this.militaryView = options.militaryView || this.state.militaryView || 'army';
      this.showResourceDetails = false;
      this.showCitySwitcher = false;
      this.buildingOffset = 0;
      this.activeEventId = null;
      this.naming = {
        visible: false,
        view: null,
        prompt: null,
        inputValue: '',
        submitting: false,
      };
      this.territoryUiState = {
        selectedSiteId: '',
        worldPanX: 0,
        worldPanY: 0,
        expeditionConfigSiteId: '',
        expeditionTroopType: '',
        expeditionLeader: '',
        expeditionSoldiers: '',
      };
      this.log = options.log || (() => {});
      this.timer = null;
      this.tapDisposer = null;
    }

    applyState(payload = {}) {
      this.state = payload.gameState || payload.state || this.state;
      if (payload.token) {
        this.api.setToken(payload.token);
        this.runtime.setStorage('token', payload.token);
      }
      this.render();
    }

    render() {
      this.renderer.render(this.state, {
        activeTab: this.activeTab,
        showResourceDetails: this.showResourceDetails,
        showCitySwitcher: this.showCitySwitcher,
        buildingOffset: this.buildingOffset,
        activeEventId: this.activeEventId,
        territoryUiState: this.territoryUiState,
        naming: this.naming,
      });
    }

    openNaming(prompt = {}) {
      const view = this.presenter.buildNamingPromptViewState(prompt);
      this.naming = {
        visible: true,
        view,
        prompt,
        inputValue: '',
        submitting: false,
      };
      this.showResourceDetails = false;
      this.showCitySwitcher = false;
      this.activeEventId = null;
      this.render();
    }

    closeNaming() {
      this.naming = {
        visible: false,
        view: null,
        prompt: null,
        inputValue: '',
        submitting: false,
      };
      this.render();
    }

    async requestNamingInput() {
      if (!this.naming.visible || typeof this.runtime.requestTextInput !== 'function') return;
      const view = this.naming.view || {};
      const value = await this.runtime.requestTextInput({
        title: view.title || '命名',
        message: view.message || '',
        placeholder: view.placeholder || '',
        value: this.naming.inputValue || '',
        maxLength: view.maxLength || 12,
      });
      if (value === null || value === undefined || !this.naming.visible) return;
      this.naming.inputValue = String(value).trim().slice(0, Number(view.maxLength) || 12);
      this.render();
    }

    submitNaming() {
      const prompt = this.naming.prompt || {};
      const name = String(this.naming.inputValue || '').trim();
      if (!prompt.type || !name) return;
      this.naming.submitting = true;
      this.render();
      this.runAction(() => (
        prompt.type === 'polity'
          ? this.api.renamePolity(name)
          : this.api.renameCity(prompt.territoryId, name)
      )).then(() => {
        this.closeNaming();
      });
    }

    async syncOnce() {
      const data = await this.api.getState();
      this.applyState(data);
      return data;
    }

    async runAction(callback) {
      try {
        const data = await callback();
        if (data) this.applyState(data);
        return data;
      } catch (error) {
        this.log(error.payload?.message || error.message || '操作失败');
        return null;
      }
    }

    switchTab(tab) {
      this.activeTab = tab || 'resources';
      this.buildingOffset = 0;
      this.activeEventId = null;
      this.render();
    }

    getSelectedSite() {
      return (this.state.territoryState?.territories || []).find((site) => site.id === this.territoryUiState.selectedSiteId) || null;
    }

    getExpeditionSoldiers(site = this.getSelectedSite()) {
      const recommended = Math.max(1, Number(site?.recommendedSoldiers) || Number(site?.defense) || 1);
      return Math.max(1, Number(this.territoryUiState.expeditionSoldiers) || recommended);
    }

    handleTap(point) {
      const action = this.renderer.getHitTarget(point);
      if (!action || action.disabled) return;
      if (action.type === 'switchTab') {
        this.showResourceDetails = false;
        this.showCitySwitcher = false;
        this.activeEventId = null;
        this.switchTab(action.tab);
        return;
      }
      if (action.type === 'openResourceDetails') {
        this.showResourceDetails = true;
        this.showCitySwitcher = false;
        this.activeEventId = null;
        this.render();
        return;
      }
      if (action.type === 'closeResourceDetails') {
        this.showResourceDetails = false;
        this.render();
        return;
      }
      if (action.type === 'openCitySwitcher') {
        this.showCitySwitcher = !this.showCitySwitcher;
        this.showResourceDetails = false;
        this.activeEventId = null;
        this.render();
        return;
      }
      if (action.type === 'closeCitySwitcher') {
        this.showCitySwitcher = false;
        this.render();
        return;
      }
      if (action.type === 'selectCity') {
        this.showCitySwitcher = false;
        this.activeEventId = null;
        this.runAction(() => this.api.switchCity(action.cityId));
        return;
      }
      if (action.type === 'blockCanvasModal') {
        return;
      }
      if (action.type === 'requestNamingInput') {
        this.requestNamingInput();
        return;
      }
      if (action.type === 'closeNaming') {
        this.closeNaming();
        return;
      }
      if (action.type === 'submitNaming') {
        this.submitNaming();
        return;
      }
      if (action.type === 'assignJob') {
        this.runAction(() => this.api.assignJob(action.job, action.delta));
        return;
      }
      if (action.type === 'scrollBuildings') {
        this.buildingOffset = Math.max(0, this.buildingOffset + (Number(action.delta) || 0));
        this.render();
        return;
      }
      if (action.type === 'buildBuilding') {
        this.runAction(() => this.api.build(action.buildingId));
        return;
      }
      if (action.type === 'upgradeBuilding') {
        this.runAction(() => this.api.upgrade(action.buildingId));
        return;
      }
      if (action.type === 'advanceEra') {
        this.runAction(() => this.api.advanceEra());
        return;
      }
      if (action.type === 'switchMilitaryView') {
        this.militaryView = action.view || 'army';
        this.state = { ...this.state, militaryView: this.militaryView };
        this.render();
        return;
      }
      if (action.type === 'openEvent') {
        const event = (this.state.eventQueue || []).find((item) => item.id === action.eventId);
        if (!event) return;
        this.activeEventId = event.id;
        this.showResourceDetails = false;
        this.showCitySwitcher = false;
        this.render();
        return;
      }
      if (action.type === 'closeEvent') {
        this.activeEventId = null;
        this.render();
        return;
      }
      if (action.type === 'claimEvent') {
        this.activeEventId = null;
        this.runAction(() => this.api.claimEvent(action.eventId, action.optionId));
        return;
      }
      if (action.type === 'scoutTerritory') {
        this.runAction(() => this.api.scoutTerritory(action.value));
        return;
      }
      if (action.type === 'claimScout') {
        this.runAction(() => this.api.claimScout(action.value));
        return;
      }
      if (action.type === 'openWorldSite') {
        this.territoryUiState.selectedSiteId = action.siteId || '';
        this.render();
        return;
      }
      if (action.type === 'closeWorldSite') {
        this.territoryUiState.selectedSiteId = '';
        this.territoryUiState.expeditionConfigSiteId = '';
        this.territoryUiState.expeditionSoldiers = '';
        this.render();
        return;
      }
      if (action.type === 'resetWorldPan') {
        this.territoryUiState.worldPanX = 0;
        this.territoryUiState.worldPanY = 0;
        this.render();
        return;
      }
      if (action.type === 'changeExpeditionSoldiers') {
        this.territoryUiState.expeditionConfigSiteId = action.siteId || this.territoryUiState.expeditionConfigSiteId;
        this.territoryUiState.expeditionSoldiers = String(Math.max(1, Math.floor(Number(action.value) || 1)));
        this.render();
        return;
      }
      if (action.type === 'territoryAction') {
        if (action.action === 'open-expedition') {
          const site = (this.state.territoryState?.territories || []).find((item) => item.id === action.territoryId);
          this.territoryUiState.expeditionConfigSiteId = action.territoryId || '';
          this.territoryUiState.expeditionSoldiers = String(Math.max(1, Number(site?.recommendedSoldiers) || Number(site?.defense) || 1));
          this.render();
          return;
        }
        if (action.action === 'close-expedition') {
          this.territoryUiState.expeditionConfigSiteId = '';
          this.territoryUiState.expeditionSoldiers = '';
          this.render();
          return;
        }
        if (action.action === 'conquer') {
          this.runAction(() => this.api.startConquest(action.territoryId, { soldiers: 1 }));
          return;
        }
        if (action.action === 'launch-expedition') {
          this.runAction(() => this.api.startConquest(action.territoryId, {
            troopType: this.territoryUiState.expeditionTroopType || 'unavailable',
            leader: this.territoryUiState.expeditionLeader || 'unavailable',
            soldiers: this.getExpeditionSoldiers(),
          }));
          return;
        }
        if (action.action === 'claim') {
          this.runAction(() => this.api.claimConquest(action.territoryId));
          return;
        }
        if (action.action === 'manage-city') {
          this.territoryUiState.selectedSiteId = '';
          this.runAction(() => this.api.switchCity(action.territoryId));
          return;
        }
        if (action.action === 'rename-city') {
          const site = (this.state.territoryState?.territories || []).find((item) => item.id === action.territoryId) || {};
          this.openNaming({
            type: 'city',
            territoryId: action.territoryId,
            title: '为这座城市命名',
            message: `当前名称：${site.cityName || site.naturalName || '未命名城市'}`,
          });
        }
      }
    }

    start() {
      this.render();
      this.syncOnce().catch(() => {});
      if (this.timer) return;
      if (!this.tapDisposer && this.runtime && typeof this.runtime.onTap === 'function') {
        this.tapDisposer = this.runtime.onTap((point) => this.handleTap(point));
      }
      this.timer = this.runtime.setInterval(() => {
        this.syncOnce().catch(() => {});
      }, this.syncIntervalMs);
    }

    stop() {
      if (!this.timer) return;
      this.runtime.clearInterval(this.timer);
      this.timer = null;
      if (this.tapDisposer) {
        this.tapDisposer();
        this.tapDisposer = null;
      }
    }
  }

  global.MiniGameApp = MiniGameApp;
  if (typeof module !== 'undefined' && module.exports) module.exports = MiniGameApp;
})(typeof window !== 'undefined' ? window : globalThis);
