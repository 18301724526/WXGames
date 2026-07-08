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

    // A base-surface render (full frame or hud overlay) resets the renderer's
    // single shared hitTargets pool to base targets, which silently drops any
    // open panel's targets: the panel visuals live on the untouched panelOverlay
    // layer, so the panel still looks open while taps fall through to the HUD
    // underneath. Hosts call this right after such a render. Each open panel
    // re-snapshots the fresh base targets and repaints its overlay surface in
    // the same task, so panel targets stay authoritative while the panel is
    // open and closePanel restores the latest base targets instead of the
    // open-time snapshot.
    syncOpenPanelSurfacesAfterBaseRender(options = {}) {
      if (this.syncingOpenPanelSurfaces) return false;
      const registryKeys = typeof this.registry?.keys === 'function' ? this.registry.keys() : [];
      const panelKeys = new Set([...registryKeys, ...this.baseHitTargetsByPanel.keys()]);
      let refreshed = false;
      this.syncingOpenPanelSurfaces = true;
      try {
        panelKeys.forEach((panelKey) => {
          const panel = this.getPanel(panelKey);
          if (!panel) return;
          // Panels that cannot report open state only count as open while this
          // manager tracks them (isPanelOpen's permissive default would repaint
          // every registered panel on every frame).
          const open = typeof panel.isOpen === 'function'
            ? panel.isOpen(this.host, options) !== false
            : this.baseHitTargetsByPanel.has(panelKey);
          if (!open) return;
          this.baseHitTargetsByPanel.delete(panelKey);
          refreshed = this.refreshPanelSurface(panelKey, options) || refreshed;
        });
      } finally {
        this.syncingOpenPanelSurfaces = false;
      }
      return refreshed;
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
