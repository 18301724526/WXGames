(function (global) {
  const CanvasPanelRegistry = (() => {
    if (global.CanvasPanelRegistry) return global.CanvasPanelRegistry;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./panels/CanvasPanelRegistry');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class CanvasPanelSurfaceManager {
    constructor(options = {}) {
      this.host = options.host || null;
      this.registry = options.registry || CanvasPanelRegistry || null;
    }

    getPanel(panelKey = '') {
      return this.registry?.get?.(panelKey) || null;
    }

    openPanel(panelKey = '', options = {}) {
      const panel = this.getPanel(panelKey);
      if (!panel?.open) return false;
      const handled = panel.open(this.host, options) !== false;
      if (handled && options.render !== false) this.refreshPanelSurface(panelKey, options);
      return handled;
    }

    closePanel(panelKey = '', options = {}) {
      const panel = this.getPanel(panelKey);
      if (!panel?.close) return false;
      const handled = panel.close(this.host, options) !== false;
      if (handled && options.render !== false) this.refreshPanelSurface(panelKey, options);
      return handled;
    }

    runPanelAction(panelKey = '', actionName = '', action = {}, options = {}) {
      const panel = this.getPanel(panelKey);
      const handler = panel?.[actionName];
      if (typeof handler !== 'function') return false;
      const handled = handler.call(panel, this.host, action, options) !== false;
      if (handled && options.render !== false) this.refreshPanelSurface(panelKey, options);
      return handled;
    }

    renderPanel(panelKey = '', renderer = null, state = {}, options = {}) {
      const panel = this.getPanel(panelKey);
      if (!panel?.render) return false;
      panel.render(renderer, state, options);
      return true;
    }

    refreshPanelSurface(_panelKey = '', options = {}) {
      const host = this.host || {};
      const state = options.state || host.state || host.lastGame?.state || null;
      const activeTab = options.activeTab || state?.currentTab || host.getActiveTab?.() || 'resources';
      if (typeof host.canvasShell?.renderPanelSurface === 'function') {
        return host.canvasShell.renderPanelSurface(state, activeTab, options) !== false;
      }
      if (host.lastGame && typeof host.renderPanelSurface === 'function') {
        return host.renderPanelSurface(state, activeTab, options) !== false;
      }
      if (typeof host.renderPanelSurface === 'function') {
        return host.renderPanelSurface(activeTab, options) !== false;
      }
      return false;
    }
  }

  global.CanvasPanelSurfaceManager = CanvasPanelSurfaceManager;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasPanelSurfaceManager;
})(typeof window !== 'undefined' ? window : globalThis);
