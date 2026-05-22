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
      this.rewardReveal = null;
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
      const DispatcherCtor = global.CanvasActionDispatcher;
      this.actionDispatcher = options.actionDispatcher || (DispatcherCtor ? new DispatcherCtor() : null);
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
        rewardReveal: this.rewardReveal,
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

    handleDrag(phase, point = {}) {
      if (this.activeTab !== 'military' || this.militaryView !== 'world') return;
      const x = Number(point.x) || 0;
      const y = Number(point.y) || 0;
      if (phase === 'start') {
        this.dragStart = {
          x,
          y,
          panX: Number(this.territoryUiState.worldPanX) || 0,
          panY: Number(this.territoryUiState.worldPanY) || 0,
        };
        return;
      }
      if (phase === 'move') {
        const dx = Number(point.dx ?? point.deltaX);
        const dy = Number(point.dy ?? point.deltaY);
        if (Number.isFinite(dx) && Number.isFinite(dy)) {
          this.territoryUiState.worldPanX += dx;
          this.territoryUiState.worldPanY += dy;
        } else if (this.dragStart) {
          this.territoryUiState.worldPanX = this.dragStart.panX + x - this.dragStart.x;
          this.territoryUiState.worldPanY = this.dragStart.panY + y - this.dragStart.y;
        }
        this.render();
        return;
      }
      if (phase === 'end' || phase === 'cancel') {
        this.dragStart = null;
      }
    }

    async handleTap(point) {
      const action = this.renderer.getHitTarget(point);
      if (!action || action.disabled) return;

      // Try sync dispatcher first
      if (this.actionDispatcher?.canHandle?.(action)) {
        this.actionDispatcher.handle(action, {
          resetForTabSwitch: () => {
            this.showResourceDetails = false;
            this.showCitySwitcher = false;
            this.activeEventId = null;
          },
          switchTab: (tab) => {
            this.switchTab(tab);
            return true;
          },
          openResourceDetails: () => {
            this.showResourceDetails = true;
            this.showCitySwitcher = false;
            this.activeEventId = null;
            return true;
          },
          closeResourceDetails: () => {
            this.showResourceDetails = false;
            return true;
          },
          openCitySwitcher: () => {
            this.showCitySwitcher = !this.showCitySwitcher;
            this.showResourceDetails = false;
            this.activeEventId = null;
            return true;
          },
          closeCitySwitcher: () => {
            this.showCitySwitcher = false;
            return true;
          },
          closeRewardReveal: () => {
            this.rewardReveal = null;
            return true;
          },
          openEvent: () => {
            const eventData = (this.state.eventQueue || []).find((item) => item.id === action.eventId);
            if (!eventData) return false;
            this.activeEventId = action.eventId;
            this.showResourceDetails = false;
            this.showCitySwitcher = false;
            return true;
          },
          closeEvent: () => {
            this.activeEventId = null;
            return true;
          },
          openWorldSite: () => {
            this.territoryUiState.selectedSiteId = action.siteId || '';
            return true;
          },
          closeWorldSite: () => {
            this.territoryUiState.selectedSiteId = '';
            this.territoryUiState.expeditionConfigSiteId = '';
            this.territoryUiState.expeditionSoldiers = '';
            return true;
          },
          resetWorldPan: () => {
            this.territoryUiState.worldPanX = 0;
            this.territoryUiState.worldPanY = 0;
            return true;
          },
          changeExpeditionSoldiers: () => {
            this.territoryUiState.expeditionConfigSiteId = action.siteId || this.territoryUiState.expeditionConfigSiteId;
            this.territoryUiState.expeditionSoldiers = String(Math.max(1, Math.floor(Number(action.value) || 1)));
            return true;
          },
          render: (dispatchAction) => {
            if (dispatchAction?.type !== 'switchTab') this.render();
          },
        });
        return;
      }

      // Try async dispatcher
      if (this.actionDispatcher?.canHandleAsync?.(action)) {
        const result = await this.actionDispatcher.handleAsync(action, {
          selectCity: async (a) => {
            this.showCitySwitcher = false;
            this.activeEventId = null;
            await this.runAction(() => this.api.switchCity(a.cityId));
            return true;
          },
          assignJob: async (a) => {
            await this.runAction(() => this.api.assignJob(a.job, a.delta));
            return true;
          },
          buildBuilding: async (a) => {
            await this.runAction(() => this.api.build(a.buildingId));
            return true;
          },
          upgradeBuilding: async (a) => {
            await this.runAction(() => this.api.upgrade(a.buildingId));
            return true;
          },
          advanceEra: async () => {
            await this.runAction(() => this.api.advanceEra());
            return true;
          },
          claimEvent: async (a) => {
            this.activeEventId = null;
            await this.runAction(() => this.api.claimEvent(a.eventId, a.optionId));
            return true;
          },
          claimGuideTaskReward: async (a) => {
            const result = await this.runAction(() => this.api.claimGuideTaskReward(a.taskId));
            this.rewardReveal = result?.rewardReveal || null;
            return true;
          },
          scoutTerritory: async (a) => {
            await this.runAction(() => this.api.scoutTerritory(a.value));
            return true;
          },
          claimScout: async (a) => {
            await this.runAction(() => this.api.claimScout(a.value));
            return true;
          },
          requestNamingInput: async () => {
            this.requestNamingInput();
            return true;
          },
          closeNaming: async () => {
            this.closeNaming();
            return true;
          },
          submitNaming: async () => {
            this.submitNaming();
            return true;
          },
          scrollBuildings: async (a) => {
            this.buildingOffset = Math.max(0, this.buildingOffset + (Number(a.delta) || 0));
            return true;
          },
          switchMilitaryView: async (a) => {
            this.militaryView = a.view || 'army';
            this.state = { ...this.state, militaryView: this.militaryView };
            return true;
          },
          openExpedition: async (a) => {
            const site = (this.state.territoryState?.territories || []).find((item) => item.id === a.territoryId);
            this.territoryUiState.expeditionConfigSiteId = a.territoryId || '';
            this.territoryUiState.expeditionSoldiers = String(Math.max(1, Number(site?.recommendedSoldiers) || Number(site?.defense) || 1));
            return true;
          },
          closeExpedition: async () => {
            this.territoryUiState.expeditionConfigSiteId = '';
            this.territoryUiState.expeditionSoldiers = '';
            return true;
          },
          conquer: async (a) => {
            await this.runAction(() => this.api.startConquest(a.territoryId, { soldiers: 1 }));
            return true;
          },
          launchExpedition: async (a) => {
            await this.runAction(() => this.api.startConquest(a.territoryId, {
              troopType: this.territoryUiState.expeditionTroopType || 'unavailable',
              leader: this.territoryUiState.expeditionLeader || 'unavailable',
              soldiers: this.getExpeditionSoldiers(),
            }));
            return true;
          },
          claimConquest: async (a) => {
            await this.runAction(() => this.api.claimConquest(a.territoryId));
            return true;
          },
          manageCity: async (a) => {
            this.territoryUiState.selectedSiteId = '';
            await this.runAction(() => this.api.switchCity(a.territoryId));
            return true;
          },
          renameCity: async (a) => {
            const site = (this.state.territoryState?.territories || []).find((item) => item.id === a.territoryId) || {};
            this.openNaming({
              type: 'city',
              territoryId: a.territoryId,
              title: '为这座城市命名',
              message: `当前名称：${site.cityName || site.naturalName || '未命名城市'}`,
            });
            return true;
          },
          render: (dispatchAction) => {
            if (dispatchAction?.type !== 'switchTab') this.render();
          },
        });
        if (result.handled) return;
      }

      if (action.type === 'blockCanvasModal') {
        return;
      }
    }

    start() {
      this.render();
      this.syncOnce().catch(() => {});
      if (this.timer) return;
      if (!this.tapDisposer && this.runtime && typeof this.runtime.onTap === 'function') {
        this.tapDisposer = this.runtime.onTap((point) => this.handleTap(point));
      }
      if (!this.dragDisposer && this.runtime && typeof this.runtime.onDrag === 'function') {
        this.dragDisposer = this.runtime.onDrag((phase, point) => this.handleDrag(phase, point));
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
