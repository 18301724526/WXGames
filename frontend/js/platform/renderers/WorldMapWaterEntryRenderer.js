(function (global) {
  class WorldMapWaterEntryRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.renderCtx = null;
    }

    withRenderCtx(ctx = null, callback = null) {
      if (typeof callback !== 'function') return false;
      const previousCtx = this.renderCtx;
      this.renderCtx = ctx || null;
      try {
        return callback();
      } finally {
        this.renderCtx = previousCtx;
      }
    }

    drawWorldTileWater(...args) {
      const waterRenderer = this.host?.host?.worldTileWaterRenderer || this.host?.worldTileWaterRenderer || null;
      if (this.renderCtx && waterRenderer?.withRenderCtx) {
        return waterRenderer.withRenderCtx(this.renderCtx, () => this.host?.drawWorldTileWater?.(...args));
      }
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
