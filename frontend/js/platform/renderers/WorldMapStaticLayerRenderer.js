(function (global) {
  class WorldMapStaticLayerRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      const HostBridge = global.WorldMapRendererHostBridge || (typeof require !== 'undefined' ? require('./WorldMapRendererHostBridge') : null);
      return HostBridge ? HostBridge.createProxy(this) : this;
    }

    withCacheContext(work = {}, callback = null) {
      if (!work?.ctx || typeof callback !== 'function') return false;
      const previousCtx = this.ctx;
      this.ctx = work.ctx;
      try {
        work.ctx.setTransform?.(1, 0, 0, 1, 0, 0);
        work.ctx.clearRect?.(0, 0, work.pixelWidth || work.width, work.pixelHeight || work.height);
        work.ctx.setTransform?.(work.scale || 1, 0, 0, work.scale || 1, 0, 0);
        work.ctx.globalAlpha = 1;
        work.ctx.globalCompositeOperation = 'source-over';
        work.ctx.save?.();
        return callback(work);
      } finally {
        work.ctx.restore?.();
        this.ctx = previousCtx;
      }
    }

    renderStaticEntriesIntoCache(tileMapView = {}, layout = {}, uiState = {}) {
      const rendered = this.withCacheContext(layout.work, () => {
        layout.work.ctx.translate?.(-layout.frame.x, -layout.frame.y);
        this.withSuppressedHitTargets?.(() => {
          this.renderWorldTileStaticEntries(tileMapView, layout.renderViewport, layout.frame, layout.entries, uiState, {
            addHitTargets: false,
          });
        });
        return true;
      });
      return Boolean(rendered);
    }

    renderWorldTileStaticLayer(tileMapView = {}, viewport = {}, frame = {}, entries = [], uiState = {}) {
      const layout = this.resolveWorldTileStaticCacheLayout(tileMapView, viewport, frame, entries);
      if (!layout) return false;
      if (layout.kind === 'chunks') return this.renderWorldTileStaticChunks(tileMapView, layout.layouts, frame, uiState);
      if (this.worldTileFastDragActive && this.worldTileStaticCacheKey && this.worldTileStaticCache?.canvas) {
        return this.drawWorldTileLayerCache(this.worldTileStaticCache, layout, frame);
      }
      const cacheScale = this.getWorldTileStaticCacheScale();
      const work = this.getWorldTileStaticCacheContext(layout.frame.width, layout.frame.height, cacheScale);
      if (!work) return false;
      const cacheKey = this.getWorldTileStaticCacheKey(tileMapView, layout.renderViewport, layout.frame, layout.entries, uiState, {
        kind: layout.kind,
        cacheScale,
      });
      if (cacheKey !== this.worldTileStaticCacheKey) {
        if (!this.renderStaticEntriesIntoCache(tileMapView, { ...layout, work }, uiState)) return false;
        this.worldTileStaticCacheKey = cacheKey;
        this.worldTileStaticCacheLayoutKind = layout.kind || '';
        this.worldTileStaticCacheLayout = { ...layout, frame: { ...layout.frame } };
      }
      return this.drawWorldTileLayerCache(work, layout, frame);
    }

  }

  global.WorldMapStaticLayerRenderer = WorldMapStaticLayerRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapStaticLayerRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
