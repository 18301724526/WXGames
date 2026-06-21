(function (global) {
  const sharedWorldMarchSystem = (() => {
    if (global.WorldMarchSystem) return global.WorldMarchSystem;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/WorldMarchSystem');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const sharedWorldClock = (() => {
    if (global.WorldClock) return global.WorldClock;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/WorldClock');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class WorldMapFogMaskContextRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
    }

    get lastWorldTileMapContext() {
      return this.host?.lastWorldTileMapContext;
    }

    get lastWorldFogContext() {
      return this.host?.lastWorldFogContext;
    }

    set lastWorldFogContext(value) {
      if (this.host) this.host.lastWorldFogContext = value;
    }

    getWorldTileFogNowMs(options = {}) {
      const optionNow = options.nowMs ?? options.epochNowMs ?? options.serverNowMs;
      const resolvedOptionNow = Number(optionNow);
      if (Number.isFinite(resolvedOptionNow)) return resolvedOptionNow;
      const clockNow = sharedWorldClock?.getEpochNowMs?.(options, Number.NaN);
      if (Number.isFinite(Number(clockNow))) return Number(clockNow);
      return typeof this.host?.getEpochNowMs === 'function' ? this.host.getEpochNowMs() : Number.NaN;
    }

    getWorldTileFogVisibilityActors(tileMapView = {}, renderSnapshot = null, options = {}) {
      const nowMs = this.getWorldTileFogNowMs(options);
      const explorerState = options.worldExplorerState || options.state?.worldExplorerState || null;
      const fromExplorer = explorerState && sharedWorldMarchSystem?.buildActors
        ? sharedWorldMarchSystem.buildActors(explorerState, { nowMs })
        : [];
      if (Array.isArray(fromExplorer) && fromExplorer.length) return fromExplorer;
      const fromActiveScouts = sharedWorldMarchSystem?.buildActors
        ? sharedWorldMarchSystem.buildActors({ missions: tileMapView.activeScouts || [] }, { nowMs })
        : [];
      if (Array.isArray(fromActiveScouts) && fromActiveScouts.length) return fromActiveScouts;
      return Array.isArray(renderSnapshot?.actors) ? renderSnapshot.actors : [];
    }

    createWorldTileFogMaskContext(tileMapView = {}, viewport = {}, frame = {}, entries = [], options = {}) {
      const renderSnapshot = options.renderSnapshot || this.lastWorldTileMapContext?.renderSnapshot || null;
      const liveVisibilityActors = this.getWorldTileFogVisibilityActors(tileMapView, renderSnapshot, options);
      const visibilityActors = Array.isArray(options.visibilityActors)
        ? options.visibilityActors
        : (Array.isArray(liveVisibilityActors) && liveVisibilityActors.length
          ? liveVisibilityActors
          : (Array.isArray(this.lastWorldTileMapContext?.visibilityActors)
            ? this.lastWorldTileMapContext.visibilityActors
            : (Array.isArray(this.lastWorldTileMapContext?.actors)
              ? this.lastWorldTileMapContext.actors
              : (Array.isArray(options.actors)
                ? options.actors
                : (Array.isArray(renderSnapshot?.actors) ? renderSnapshot.actors : [])))));
      return {
        renderSnapshot,
        actors: Array.isArray(options.actors) ? options.actors : [],
        visibilityActors,
        epochNowMs: this.getWorldTileFogNowMs(options),
        tileMapView,
        viewport,
        geometry: tileMapView.geometry || viewport.geometry || {},
        frame,
        entries,
      };
    }

    renderWorldTileFogMask(tileMapView = {}, viewport = {}, frame = {}, entries = [], options = {}) {
      const context = this.createWorldTileFogMaskContext(tileMapView, viewport, frame, entries, options);
      this.lastWorldFogContext = context;
      if (this.host && this.host !== this) this.host.lastWorldFogContext = context;
      return false;
    }
  }

  global.WorldMapFogMaskContextRenderer = WorldMapFogMaskContextRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapFogMaskContextRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
