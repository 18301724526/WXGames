(function (global) {
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

    createWorldTileFogMaskContext(tileMapView = {}, viewport = {}, frame = {}, entries = [], options = {}) {
      const renderSnapshot = options.renderSnapshot || this.lastWorldTileMapContext?.renderSnapshot || null;
      const visibilityActors = Array.isArray(options.visibilityActors)
        ? options.visibilityActors
        : (Array.isArray(this.lastWorldTileMapContext?.visibilityActors)
          ? this.lastWorldTileMapContext.visibilityActors
          : (Array.isArray(options.actors)
            ? options.actors
            : (Array.isArray(this.lastWorldTileMapContext?.actors)
              ? this.lastWorldTileMapContext.actors
              : (Array.isArray(renderSnapshot?.actors) ? renderSnapshot.actors : []))));
      return {
        renderSnapshot,
        actors: Array.isArray(options.actors) ? options.actors : [],
        visibilityActors,
        tileMapView,
        viewport,
        geometry: tileMapView.geometry || viewport.geometry || {},
        frame,
        entries,
      };
    }

    renderWorldTileFogMask(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      const context = this.createWorldTileFogMaskContext(tileMapView, viewport, frame, entries);
      this.lastWorldFogContext = context;
      if (this.host && this.host !== this) this.host.lastWorldFogContext = context;
      return false;
    }
  }

  global.WorldMapFogMaskContextRenderer = WorldMapFogMaskContextRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapFogMaskContextRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
