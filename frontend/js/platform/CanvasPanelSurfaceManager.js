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

  function getPanelActionContextAdapter() {
    if (global.CanvasPanelActionContextAdapter) return global.CanvasPanelActionContextAdapter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./CanvasPanelActionContextAdapter');
      } catch (_error) {
        return null;
      }
    }
    return null;
  }

  const BAND_RANK = Object.freeze({
    panel: 10,
    dialog: 20,
  });

  function incrementCompatibilityCounter(name = '') {
    const counters = global.__panelRefactorCounters || global.__PANEL_REFACTOR_COUNTERS__ || null;
    if (!counters || !name) return false;
    counters[name] = (Number(counters[name]) || 0) + 1;
    return true;
  }

  class CanvasPanelSurfaceManager {
    constructor(options = {}) {
      this.host = options.host || null;
      this.registry = options.registry || CanvasPanelRegistry || null;
      this.baseHitTargetsByPanel = new Map();
    }

    getPanelEntry(panelKey = '') {
      return this.registry?.get?.(panelKey) || null;
    }

    getPanel(panelKey = '') {
      const entry = this.getPanelEntry(panelKey);
      return entry?.module || entry || null;
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

    getRegistryKeys() {
      return typeof this.registry?.keys === 'function' ? this.registry.keys() : [];
    }

    ensurePanelOptions(options = {}) {
      if (options.context) return options;
      const buildPanelActionContext = getPanelActionContextAdapter();
      const context = typeof buildPanelActionContext === 'function'
        ? buildPanelActionContext(this.host)
        : null;
      return context ? { ...options, context } : options;
    }

    captureBaseHitTargets(panelKey = '') {
      const key = String(panelKey || '');
      if (!key || this.baseHitTargetsByPanel.has(key)) return;
      const targets = this.getRenderer()?.hitTargets;
      this.baseHitTargetsByPanel.set(key, Array.isArray(targets) ? targets.slice() : []);
      incrementCompatibilityCounter('panelSurface.baseHitTargetsSnapshot.count');
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

    restoreAllBaseHitTargets() {
      let restored = false;
      Array.from(this.baseHitTargetsByPanel.keys()).forEach((panelKey) => {
        restored = this.restoreBaseHitTargets(panelKey) || restored;
      });
      return restored;
    }

    isPanelOpen(panelKey = '', options = {}) {
      const entry = this.getPanelEntry(panelKey);
      return this.isEntryOpen(entry, options);
    }

    isEntryOpen(entry = null, options = {}) {
      const panel = entry?.module || entry || null;
      const handler = entry?.isOpen || panel?.isOpen;
      const panelOptions = this.ensurePanelOptions(options);
      if (typeof handler === 'function') return handler.call(entry?.isOpen ? entry : panel, this.host, panelOptions) !== false;
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
      incrementCompatibilityCounter('panelSurface.syncAfterBaseRender.count');
      const panelOptions = this.ensurePanelOptions(options);
      const registryKeys = this.getRegistryKeys();
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
            ? panel.isOpen(this.host, panelOptions) !== false
            : this.baseHitTargetsByPanel.has(panelKey);
          if (!open) return;
          this.baseHitTargetsByPanel.delete(panelKey);
          refreshed = this.refreshPanelSurface(panelKey, panelOptions) || refreshed;
        });
      } finally {
        this.syncingOpenPanelSurfaces = false;
      }
      return refreshed;
    }

    openPanel(panelKey = '', options = {}) {
      const entry = this.getPanelEntry(panelKey);
      const panel = entry?.module || entry || null;
      const handler = entry?.open || panel?.open;
      if (typeof handler !== 'function') return false;
      const panelOptions = this.ensurePanelOptions(options);
      const handled = handler.call(entry?.open ? entry : panel, this.host, panelOptions) !== false;
      if (handled && panelOptions.render !== false) this.projectModalLayer({ ...panelOptions, requestedPanelKey: panelKey });
      return handled;
    }

    closePanel(panelKey = '', options = {}) {
      const entry = this.getPanelEntry(panelKey);
      const panel = entry?.module || entry || null;
      const handler = entry?.close || panel?.close;
      if (typeof handler !== 'function') return false;
      const panelOptions = this.ensurePanelOptions(options);
      const handled = handler.call(entry?.close ? entry : panel, this.host, panelOptions) !== false;
      if (handled && panelOptions.render !== false) this.projectModalLayer({ ...panelOptions, requestedPanelKey: panelKey });
      return handled;
    }

    runPanelAction(panelKey = '', actionName = '', action = {}, options = {}) {
      const entry = this.getPanelEntry(panelKey);
      const panel = entry?.module || entry || null;
      const entryHandler = entry?.actions?.[actionName];
      const handler = entryHandler || panel?.actions?.[actionName] || panel?.[actionName];
      if (typeof handler !== 'function') return false;
      const panelOptions = this.ensurePanelOptions(options);
      const handled = handler.call(entryHandler ? entry : panel, this.host, action, panelOptions) !== false;
      if (handled && panelOptions.render !== false) this.projectModalLayer({ ...panelOptions, requestedPanelKey: panelKey });
      return handled;
    }

    getBandRank(entry = {}) {
      return BAND_RANK[entry?.band] ?? 100;
    }

    comparePanelEntries(left = {}, right = {}) {
      const bandDelta = this.getBandRank(left) - this.getBandRank(right);
      if (bandDelta) return bandDelta;
      const priorityDelta = (Number(left.renderPriority) || 0) - (Number(right.renderPriority) || 0);
      if (priorityDelta) return priorityDelta;
      return String(left.key || '').localeCompare(String(right.key || ''));
    }

    getOpenPanelEntries(options = {}) {
      const panelKeys = new Set(this.getRegistryKeys());
      const requestedPanelKey = options.requestedPanelKey
        || options.descriptor?.panelKey
        || options.action?.panelKey
        || '';
      if (requestedPanelKey) panelKeys.add(String(requestedPanelKey));
      return Array.from(panelKeys)
        .map((panelKey) => {
          const entry = this.getPanelEntry(panelKey);
          return entry && !entry.key ? { key: panelKey, module: entry } : entry;
        })
        .filter((entry) => entry?.key && this.isEntryOpen(entry, options))
        .sort((left, right) => this.comparePanelEntries(left, right));
    }

    addModalBackgroundHitTarget(entry = {}, renderer = null) {
      if (!renderer || typeof renderer.addHitTarget !== 'function') return false;
      if (entry.closesOnOutsideClick === false && entry.blocksBaseHitTargets !== true) return false;
      const width = Math.max(0, Number(renderer.width) || 0);
      const height = Math.max(0, Number(renderer.height) || 0);
      if (!width || !height) return false;
      renderer.addHitTarget(
        { x: 0, y: 0, width, height },
        {
          type: 'panelOutsideClick',
          panelKey: entry.key,
          background: true,
        },
      );
      return true;
    }

    renderPanel(panelKey = '', renderer = null, state = {}, options = {}) {
      const entry = this.getPanelEntry(panelKey);
      const panel = entry?.module || entry || null;
      const handler = entry?.render || panel?.render;
      if (typeof handler !== 'function') return false;
      const panelOptions = this.ensurePanelOptions(options);
      handler.call(entry?.render ? entry : panel, renderer, state, panelOptions);
      if (panelOptions.projectingModal) {
        this.addModalBackgroundHitTarget(entry?.key ? entry : { ...entry, key: panelKey }, renderer);
      }
      return true;
    }

    projectModalLayer(options = {}) {
      const panelOptions = this.ensurePanelOptions(options);
      const surfaceHost = this.getSurfaceHost();
      const entries = this.getOpenPanelEntries(panelOptions);
      if (!entries.length) {
        const requestedPanelKey = panelOptions.requestedPanelKey
          || panelOptions.descriptor?.panelKey
          || panelOptions.action?.panelKey
          || '';
        this.clearPanelSurface(requestedPanelKey, panelOptions);
        this.restoreAllBaseHitTargets();
        return true;
      }
      this.captureBaseHitTargets(entries[0].key);
      if (typeof surfaceHost?.renderPanelOverlaySurface !== 'function') return false;
      let handled = true;
      entries.forEach((entry, index) => {
        try {
          const rendered = surfaceHost.renderPanelOverlaySurface(entry.key, this, {
            ...panelOptions,
            state: this.getState(panelOptions),
            clear: index === 0,
            projectingModal: true,
            panelEntry: entry,
          }) !== false;
          handled = rendered && handled;
        } catch (error) {
          panelOptions.context?.log?.(error);
          handled = false;
        }
      });
      return handled;
    }

    refreshPanelSurface(_panelKey = '', options = {}) {
      const panelKey = String(_panelKey || '');
      const panelOptions = this.ensurePanelOptions(options);
      incrementCompatibilityCounter('panelSurface.refreshAlias.count');
      return this.projectModalLayer({ ...panelOptions, requestedPanelKey: panelKey });
    }

    clearPanelSurface(_panelKey = '', options = {}) {
      const panelKey = String(_panelKey || '');
      const panelOptions = this.ensurePanelOptions(options);
      const surfaceHost = this.getSurfaceHost();
      const cleared = typeof surfaceHost?.clearPanelOverlaySurface === 'function'
        ? surfaceHost.clearPanelOverlaySurface(panelKey, this, panelOptions) !== false
        : false;
      this.restoreBaseHitTargets(panelKey);
      return cleared;
    }
  }

  global.CanvasPanelSurfaceManager = CanvasPanelSurfaceManager;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasPanelSurfaceManager;
})(typeof window !== 'undefined' ? window : globalThis);
