(function (global) {
  class H5CanvasAppShell {
    constructor(options = {}) {
      this.runtime = options.runtime || null;
      this.renderer = options.renderer || null;
      this.presenter = options.presenter || null;
      this.previewEnabled = Boolean(options.previewEnabled);
      this.inputEnabled = Boolean(options.inputEnabled);
      this.onAction = typeof options.onAction === 'function' ? options.onAction : null;
      this.mounted = false;
      this.lastGame = null;
      this.resizeDisposer = null;
      this.tapDisposer = null;
      this.showSettings = false;
      this.showLogs = false;
      this.showResourceDetails = false;
      this.showCitySwitcher = false;
      this.showAdvisor = false;
      this.buildingOffset = 0;
      this.activeEventId = null;
      this.territoryUiState = {};
      this.naming = {
        visible: false,
        view: null,
        inputValue: '',
        submitting: false,
      };
    }

    createRenderer(canvas) {
      if (this.renderer || !canvas) return this.renderer;
      const RendererCtor = global.H5CanvasGameRenderer;
      if (!RendererCtor) return null;
      this.renderer = new RendererCtor({
        canvas,
        presenter: this.presenter,
        pixelRatio: this.runtime?.pixelRatio,
        width: this.runtime?.width,
        height: this.runtime?.height,
        h5Runtime: this.runtime,
      });
      return this.renderer;
    }

    mount(game) {
      if (this.mounted) return false;
      if (!this.runtime || typeof this.runtime.ensureCanvas !== 'function') return false;
      const canvas = this.runtime.ensureCanvas();
      if (!canvas) return false;
      this.createRenderer(canvas);
      this.mounted = true;
      this.lastGame = game || null;
      if (this.runtime?.onResize && !this.resizeDisposer) {
        this.resizeDisposer = this.runtime.onResize((size) => this.handleResize(size));
      }
      this.bindInput();
      this.renderReadOnly(game?.state, game?.state?.currentTab || 'resources');
      return true;
    }

    bindInput() {
      if (!this.inputEnabled || !this.runtime?.onTap || this.tapDisposer) return false;
      this.tapDisposer = this.runtime.onTap((point, event) => this.handleTap(point, event));
      return true;
    }

    handleTap(point, event) {
      if (!this.inputEnabled || !this.renderer || typeof this.renderer.getHitTarget !== 'function') return false;
      const action = this.renderer.getHitTarget(point);
      if (!action || action.disabled) return false;
      const handled = this.handleAction(action, event);
      if (handled && event?.preventDefault) event.preventDefault();
      if (handled && event?.stopPropagation) event.stopPropagation();
      return handled;
    }

    getCanvasTarget(type) {
      if (!this.renderer || !Array.isArray(this.renderer.hitTargets)) return null;
      const target = this.renderer.hitTargets.find((item) => item.action?.type === type);
      if (!target) return null;
      return {
        getBoundingClientRect: () => ({
          left: target.x,
          top: target.y,
          width: target.width,
          height: target.height,
          right: target.x + target.width,
          bottom: target.y + target.height,
        }),
        scrollIntoView() {},
      };
    }

    getTutorialTarget(key) {
      if (key === 'btn-advance-era') return this.getCanvasTarget('advanceEra');
      return null;
    }

    openNaming(view = {}) {
      this.naming = {
        visible: true,
        view,
        inputValue: '',
        submitting: false,
      };
      this.showSettings = false;
      this.showLogs = false;
      this.showResourceDetails = false;
      this.showCitySwitcher = false;
      this.showAdvisor = false;
      this.activeEventId = null;
      this.renderReadOnly(this.lastGame?.state, this.lastGame?.state?.currentTab || 'resources');
      return true;
    }

    closeNaming() {
      this.naming = {
        visible: false,
        view: null,
        inputValue: '',
        submitting: false,
      };
      this.renderReadOnly(this.lastGame?.state, this.lastGame?.state?.currentTab || 'resources');
      return true;
    }

    getNamingName() {
      return String(this.naming?.inputValue || '').trim();
    }

    setNamingSubmitting(isSubmitting) {
      this.naming = {
        ...this.naming,
        submitting: Boolean(isSubmitting),
      };
      this.renderReadOnly(this.lastGame?.state, this.lastGame?.state?.currentTab || 'resources');
    }

    requestNamingInput() {
      if (!this.naming?.visible) return false;
      const view = this.naming.view || {};
      const currentValue = this.naming.inputValue || '';
      if (!this.runtime || typeof this.runtime.requestTextInput !== 'function') return false;
      Promise.resolve(this.runtime.requestTextInput({
        title: view.title || '命名',
        message: view.message || '',
        placeholder: view.placeholder || '',
        value: currentValue,
        maxLength: view.maxLength || 12,
      })).then((value) => {
        if (value === null || value === undefined || !this.naming?.visible) return;
        const maxLength = Number(view.maxLength) || 12;
        this.naming = {
          ...this.naming,
          inputValue: String(value).trim().slice(0, maxLength),
        };
        this.renderReadOnly(this.lastGame?.state, this.lastGame?.state?.currentTab || 'resources');
      }).catch(() => {});
      return true;
    }

    handleAction(action, event) {
      if (action.type === 'requestNamingInput') {
        return this.requestNamingInput();
      }
      if (action.type === 'closeNaming') {
        return this.closeNaming();
      }
      if (action.type === 'submitNaming') {
        if (!this.onAction) return false;
        const name = this.getNamingName();
        if (!name) return false;
        return this.onAction({ ...action, name }, event) !== false;
      }
      if (action.type === 'openSettings') {
        this.showSettings = true;
        this.showLogs = false;
        this.showResourceDetails = false;
        this.showCitySwitcher = false;
        this.showAdvisor = false;
        this.activeEventId = null;
        this.renderReadOnly(this.lastGame?.state, this.lastGame?.state?.currentTab || 'resources');
        return true;
      }
      if (action.type === 'closeSettings') {
        this.showSettings = false;
        this.renderReadOnly(this.lastGame?.state, this.lastGame?.state?.currentTab || 'resources');
        return true;
      }
      if (action.type === 'openLogs') {
        this.showLogs = true;
        this.showSettings = false;
        this.showResourceDetails = false;
        this.showCitySwitcher = false;
        this.showAdvisor = false;
        this.activeEventId = null;
        this.renderReadOnly(this.lastGame?.state, this.lastGame?.state?.currentTab || 'resources');
        return true;
      }
      if (action.type === 'closeLogs') {
        this.showLogs = false;
        this.renderReadOnly(this.lastGame?.state, this.lastGame?.state?.currentTab || 'resources');
        return true;
      }
      if (action.type === 'openResourceDetails') {
        this.showResourceDetails = true;
        this.showSettings = false;
        this.showLogs = false;
        this.showCitySwitcher = false;
        this.showAdvisor = false;
        this.activeEventId = null;
        this.renderReadOnly(this.lastGame?.state, this.lastGame?.state?.currentTab || 'resources');
        return true;
      }
      if (action.type === 'closeResourceDetails') {
        this.showResourceDetails = false;
        this.renderReadOnly(this.lastGame?.state, this.lastGame?.state?.currentTab || 'resources');
        return true;
      }
      if (action.type === 'openCitySwitcher') {
        this.showCitySwitcher = !this.showCitySwitcher;
        this.showSettings = false;
        this.showLogs = false;
        this.showResourceDetails = false;
        this.showAdvisor = false;
        this.activeEventId = null;
        this.renderReadOnly(this.lastGame?.state, this.lastGame?.state?.currentTab || 'resources');
        return true;
      }
      if (action.type === 'closeCitySwitcher') {
        this.showCitySwitcher = false;
        this.renderReadOnly(this.lastGame?.state, this.lastGame?.state?.currentTab || 'resources');
        return true;
      }
      if (action.type === 'selectCity') {
        this.showCitySwitcher = false;
        this.activeEventId = null;
        this.renderReadOnly(this.lastGame?.state, this.lastGame?.state?.currentTab || 'resources');
      }
      if (action.type === 'switchTab') {
        this.buildingOffset = 0;
        this.activeEventId = null;
      }
      if (action.type === 'scrollBuildings') {
        this.buildingOffset = Math.max(0, this.buildingOffset + (Number(action.delta) || 0));
        this.renderReadOnly(this.lastGame?.state, this.lastGame?.state?.currentTab || 'resources');
        return true;
      }
      if (action.type === 'openAdvisor') {
        const view = this.presenter?.buildAdvisorViewState?.(this.lastGame?.state?.softGuide);
        if (view?.hidden || !view?.activeAdvisor) return false;
        this.showAdvisor = true;
        this.showSettings = false;
        this.showLogs = false;
        this.showResourceDetails = false;
        this.showCitySwitcher = false;
        this.activeEventId = null;
        this.renderReadOnly(this.lastGame?.state, this.lastGame?.state?.currentTab || 'resources');
        return true;
      }
      if (action.type === 'closeAdvisor') {
        this.showAdvisor = false;
        this.renderReadOnly(this.lastGame?.state, this.lastGame?.state?.currentTab || 'resources');
        return true;
      }
      if (action.type === 'goToAdvisorTarget') {
        this.showAdvisor = false;
        this.activeEventId = null;
        this.renderReadOnly(this.lastGame?.state, this.lastGame?.state?.currentTab || 'resources');
      }
      if (action.type === 'openEvent') {
        const eventData = (this.lastGame?.state?.eventQueue || []).find((item) => item.id === action.eventId);
        if (!eventData) return false;
        this.activeEventId = action.eventId;
        this.showSettings = false;
        this.showLogs = false;
        this.showResourceDetails = false;
        this.showCitySwitcher = false;
        this.showAdvisor = false;
        this.lastGame?.eventController?.open?.(action.eventId);
        this.renderReadOnly(this.lastGame?.state, this.lastGame?.state?.currentTab || 'events');
        return true;
      }
      if (action.type === 'closeEvent') {
        this.activeEventId = null;
        this.lastGame?.eventController?.close?.();
        this.renderReadOnly(this.lastGame?.state, this.lastGame?.state?.currentTab || 'events');
        return true;
      }
      if (action.type === 'claimEvent') {
        if (!this.onAction) return false;
        const handled = this.onAction(action, event) !== false;
        if (handled) {
          this.activeEventId = null;
          this.lastGame?.eventController?.close?.();
          this.renderReadOnly(this.lastGame?.state, this.lastGame?.state?.currentTab || 'events');
        }
        return handled;
      }
      if (action.type === 'advanceEra') {
        if (!this.onAction) return false;
        return this.onAction(action, event) !== false;
      }
      if (action.type === 'switchMilitaryView') {
        if (!this.onAction) return false;
        return this.onAction(action, event) !== false;
      }
      if (action.type === 'scoutTerritory' || action.type === 'claimScout') {
        if (!this.onAction) return false;
        return this.onAction(action, event) !== false;
      }
      if (
        action.type === 'openWorldSite'
        || action.type === 'closeWorldSite'
        || action.type === 'resetWorldPan'
        || action.type === 'territoryAction'
        || action.type === 'changeExpeditionSoldiers'
      ) {
        if (!this.onAction) return false;
        return this.onAction(action, event) !== false;
      }
      if (action.type === 'blockCanvasModal') {
        return true;
      }
      if (action.type === 'resetGame' || action.type === 'logout' || action.type === 'clearLogs') {
        this.showSettings = false;
        this.showLogs = false;
        this.showResourceDetails = false;
        this.showCitySwitcher = false;
        this.showAdvisor = false;
        this.activeEventId = null;
      }
      if (this.onAction) return this.onAction(action, event) !== false;
      if (action.type === 'switchTab' && this.lastGame?.switchTab) {
        this.lastGame.switchTab(action.tab);
        return true;
      }
      return false;
    }

    setInputEnabled(enabled) {
      this.inputEnabled = Boolean(enabled);
      if (!this.inputEnabled && this.tapDisposer) {
        this.tapDisposer();
        this.tapDisposer = null;
      }
      if (this.inputEnabled) this.bindInput();
    }

    handleResize(size) {
      if (!this.renderer) return;
      this.renderer.width = size.width;
      this.renderer.height = size.height;
      this.renderer.pixelRatio = size.pixelRatio;
      this.renderReadOnly(this.lastGame?.state, this.lastGame?.state?.currentTab || 'resources');
    }

    renderReadOnly(state, activeTab = 'resources') {
      if (!this.previewEnabled || !this.renderer || !state) return false;
      this.renderer.render(state, {
        activeTab,
        mode: 'hud',
        showSettings: this.showSettings,
        showLogs: this.showLogs,
        showResourceDetails: this.showResourceDetails,
        showCitySwitcher: this.showCitySwitcher,
        showAdvisor: this.showAdvisor,
        logs: this.lastGame?.requestLogs || [],
        tutorial: this.lastGame?.tutorialController?.state || this.lastGame?.tutorial || {},
        buildingOffset: this.buildingOffset,
        activeEventId: this.activeEventId,
        territoryUiState: this.lastGame?.territoryController?.getUiState?.() || this.territoryUiState || {},
        naming: this.naming,
      });
      return true;
    }

    static mount(game, options = {}) {
      const RuntimeCtor = options.Runtime || global.H5CanvasRuntime;
      const runtime = options.canvasRuntime
        || (options.runtime?.ensureCanvas ? options.runtime : null)
        || (RuntimeCtor ? new RuntimeCtor(options) : null);
      const shell = new H5CanvasAppShell({
        runtime,
        renderer: options.renderer,
        presenter: options.presenter,
        previewEnabled: options.previewEnabled,
        inputEnabled: options.inputEnabled,
        onAction: options.onAction,
      });
      const mounted = shell.mount(game);
      return mounted ? shell : null;
    }
  }

  global.H5CanvasAppShell = H5CanvasAppShell;
  if (typeof module !== 'undefined' && module.exports) module.exports = H5CanvasAppShell;
})(typeof window !== 'undefined' ? window : globalThis);
