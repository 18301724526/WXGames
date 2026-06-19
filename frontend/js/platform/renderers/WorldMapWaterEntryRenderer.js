(function (global) {
  class WorldMapWaterEntryRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
    }

    drawWorldTileWater(...args) {
      return this.host?.drawWorldTileWater?.(...args);
    }

    renderWorldTileWaterEntries(tileMapView = {}, viewport = {}, entries = [], waterTimeMs = null) {
      let rendered = false;
      entries.forEach(({ tile, center, drawRect }) => {
        if (!tile?.water?.kind || !tile.water?.asset) return;
        if (this.drawWorldTileWater(tile, center, drawRect, viewport, { drawDryTemplate: false, waterTimeMs })) {
          rendered = true;
        }
      });
      return rendered;
    }
  }

  global.WorldMapWaterEntryRenderer = WorldMapWaterEntryRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapWaterEntryRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
