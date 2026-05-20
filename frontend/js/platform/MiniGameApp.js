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
      this.renderer.render(this.state, { activeTab: this.activeTab });
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
      this.render();
    }

    handleTap(point) {
      const action = this.renderer.getHitTarget(point);
      if (!action || action.disabled) return;
      if (action.type === 'switchTab') {
        this.switchTab(action.tab);
        return;
      }
      if (action.type === 'assignJob') {
        this.runAction(() => this.api.assignJob(action.job, action.delta));
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
      if (action.type === 'openEvent') {
        const event = (this.state.eventQueue || []).find((item) => item.id === action.eventId);
        const option = event?.options?.[0];
        if (event && option) this.runAction(() => this.api.claimEvent(event.id, option.id));
        return;
      }
      if (action.type === 'scoutTerritory') {
        this.runAction(() => this.api.scoutTerritory(action.value));
        return;
      }
      if (action.type === 'claimScout') {
        this.runAction(() => this.api.claimScout(action.value));
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
