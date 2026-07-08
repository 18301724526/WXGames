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
          blocksBaseHitTargets: entry.blocksBaseHitTargets === true,
          closesOnOutsideClick: entry.closesOnOutsideClick !== false,
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
        return true;
      }
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
      return cleared;
    }
  }

  global.CanvasPanelSurfaceManager = CanvasPanelSurfaceManager;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasPanelSurfaceManager;
})(typeof window !== 'undefined' ? window : globalThis);
