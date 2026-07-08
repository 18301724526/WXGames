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
      this.baseHitTargetsByPanel = new Map();
    }

    getPanel(panelKey = '') {
      return this.registry?.get?.(panelKey) || null;
    }

    getSurfaceHost() {
      const host = this.host || null;
      return host?.canvasShell || host?.lastGame?.canvasShell || host;
    }

    getRenderer() {
      const surfaceHost = this.getSurfaceHost();
      return surfaceHost?.renderer || this.host?.renderer || null;
    }

    getState(options = {}) {
      if (options.state) return options.state;
      const host = this.host || {};
      if (typeof host.getState === 'function') return host.getState();
      if (host.lastGame?.state) return host.lastGame.state;
      return host.state || null;
    }

    captureBaseHitTargets(panelKey = '') {
      const key = String(panelKey || '');
      if (!key || this.baseHitTargetsByPanel.has(key)) return;
      const targets = this.getRenderer()?.hitTargets;
      this.baseHitTargetsByPanel.set(key, Array.isArray(targets) ? targets.slice() : []);
    }

    restoreBaseHitTargets(panelKey = '') {
      const key = String(panelKey || '');
      if (!key || !this.baseHitTargetsByPanel.has(key)) return false;
      const renderer = this.getRenderer();
      const targets = this.baseHitTargetsByPanel.get(key) || [];
      this.baseHitTargetsByPanel.delete(key);
      if (typeof renderer?.setHitTargets === 'function') {
        renderer.setHitTargets(targets);
        return true;
      }
      if (renderer && typeof renderer === 'object') {
        renderer.hitTargets = targets;
        return true;
      }
      return false;
    }

    isPanelOpen(panelKey = '', options = {}) {
      const panel = this.getPanel(panelKey);
      if (typeof panel?.isOpen === 'function') return panel.isOpen(this.host, options) !== false;
      return true;
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
      if (handled) this.clearPanelSurface(panelKey, options);
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
      const panelKey = String(_panelKey || '');
      const surfaceHost = this.getSurfaceHost();
      if (!this.isPanelOpen(panelKey, options)) return this.clearPanelSurface(panelKey, options);
      this.captureBaseHitTargets(panelKey);
      if (typeof surfaceHost?.renderPanelOverlaySurface === 'function') {
        return surfaceHost.renderPanelOverlaySurface(panelKey, this, {
          ...options,
          state: this.getState(options),
        }) !== false;
      }
      return false;
    }

    clearPanelSurface(_panelKey = '', options = {}) {
      const panelKey = String(_panelKey || '');
      const surfaceHost = this.getSurfaceHost();
      const cleared = typeof surfaceHost?.clearPanelOverlaySurface === 'function'
        ? surfaceHost.clearPanelOverlaySurface(panelKey, this, options) !== false
        : false;
      this.restoreBaseHitTargets(panelKey);
      return cleared;
    }
  }

  global.CanvasPanelSurfaceManager = CanvasPanelSurfaceManager;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasPanelSurfaceManager;
})(typeof window !== 'undefined' ? window : globalThis);
