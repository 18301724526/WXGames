(function (global) {
  class WorldMapStaticLayerRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.worldMapCacheState = options.worldMapCacheState || this.host?.worldMapCacheState || null;
    }

    get ctx() {
      return this.host?.ctx || null;
    }

    withRenderCtx(ctx, callback) {
      if (typeof this.host?.withRenderCtx === 'function') return this.host.withRenderCtx(ctx, callback);
      return callback?.();
    }

    get worldTileFastDragActive() {
      return Boolean(this.worldMapCacheState?.worldTileFastDragActive);
    }

    get worldTileStaticCache() {
      return this.worldMapCacheState?.worldTileStaticCache || null;
    }

    set worldTileStaticCache(value) {
      if (this.worldMapCacheState) this.worldMapCacheState.worldTileStaticCache = value || null;
    }

    get worldTileStaticCacheKey() {
      return this.worldMapCacheState?.worldTileStaticCacheKey || '';
    }

    set worldTileStaticCacheKey(value) {
      if (this.worldMapCacheState) this.worldMapCacheState.worldTileStaticCacheKey = value || '';
    }

    get worldTileStaticCacheLayoutKind() {
      return this.worldMapCacheState?.worldTileStaticCacheLayoutKind || '';
    }

    set worldTileStaticCacheLayoutKind(value) {
      if (this.worldMapCacheState) this.worldMapCacheState.worldTileStaticCacheLayoutKind = value || '';
    }

    get worldTileStaticCacheLayout() {
      return this.worldMapCacheState?.worldTileStaticCacheLayout || null;
    }

    set worldTileStaticCacheLayout(value) {
      if (this.worldMapCacheState) this.worldMapCacheState.worldTileStaticCacheLayout = value || null;
    }

    resolveWorldTileStaticCacheLayout(...args) {
      return this.host?.resolveWorldTileStaticCacheLayout?.(...args) || null;
    }

    renderWorldTileStaticChunks(...args) {
      return this.host?.renderWorldTileStaticChunks?.(...args) || false;
    }

    getWorldTileStaticCacheScale(...args) {
      return this.host?.getWorldTileStaticCacheScale?.(...args) || 1;
    }

    getWorldTileStaticCacheContext(...args) {
      return this.host?.getWorldTileStaticCacheContext?.(...args) || null;
    }

    getWorldTileStaticCacheKey(...args) {
      return this.host?.getWorldTileStaticCacheKey?.(...args) || '';
    }

    drawWorldTileLayerCache(...args) {
      return this.host?.drawWorldTileLayerCache?.(...args) || false;
    }

    withSuppressedHitTargets(callback) {
      if (typeof this.host?.withSuppressedHitTargets === 'function') return this.host.withSuppressedHitTargets(callback);
      return callback?.();
    }

    renderWorldTileStaticEntries(...args) {
      return this.host?.renderWorldTileStaticEntries?.(...args) || false;
    }

    withCacheContext(work = {}, callback = null) {
      if (!work?.ctx || typeof callback !== 'function') return false;
      // The cache bake draws through host-resolved renderers, so the work ctx must be
      // scoped on the ctx owner for the duration of the bake.
      return this.withRenderCtx(work.ctx, () => {
        work.ctx.setTransform?.(1, 0, 0, 1, 0, 0);
        work.ctx.clearRect?.(0, 0, work.pixelWidth || work.width, work.pixelHeight || work.height);
        work.ctx.setTransform?.(work.scale || 1, 0, 0, work.scale || 1, 0, 0);
        work.ctx.globalAlpha = 1;
        work.ctx.globalCompositeOperation = 'source-over';
        work.ctx.save?.();
        try {
          return callback(work);
        } finally {
          work.ctx.restore?.();
        }
      });
    }

    renderStaticEntriesIntoCache(tileMapView = {}, layout = {}, uiState = {}) {
      const rendered = this.withCacheContext(layout.work, () => {
        layout.work.ctx.translate?.(-layout.frame.x, -layout.frame.y);
        this.withSuppressedHitTargets(() => {
          const entryRenderer = this.host?.worldMapStaticEntryRenderer || null;
          if (entryRenderer?.withRenderCtx) {
            entryRenderer.withRenderCtx(layout.work.ctx, () => {
              this.renderWorldTileStaticEntries(tileMapView, layout.renderViewport, layout.frame, layout.entries, uiState, {
                addHitTargets: false,
              });
            });
            return;
          }
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
