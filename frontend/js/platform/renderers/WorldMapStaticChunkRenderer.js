(function (global) {
  class WorldMapStaticChunkRenderer {
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

    get worldTileStaticChunkCaches() {
      return this.worldMapCacheState?.worldTileStaticChunkCaches || new Map();
    }

    get worldTileStaticChunkCacheTick() {
      return Number(this.worldMapCacheState?.worldTileStaticChunkCacheTick) || 0;
    }

    set worldTileStaticChunkCacheTick(value) {
      if (this.worldMapCacheState) this.worldMapCacheState.worldTileStaticChunkCacheTick = Number(value) || 0;
    }

    get worldTileStaticCacheLayoutKind() {
      return this.worldMapCacheState?.worldTileStaticCacheLayoutKind || '';
    }

    set worldTileStaticCacheLayoutKind(value) {
      if (this.worldMapCacheState) this.worldMapCacheState.worldTileStaticCacheLayoutKind = value || '';
    }

    createTileWorkCanvas(...args) {
      return this.host?.createTileWorkCanvas?.(...args) || null;
    }

    getWorldTileStaticChunkCacheLimit(...args) {
      return this.host?.getWorldTileStaticChunkCacheLimit?.(...args) || 32;
    }

    getWorldTileStaticChunkCacheScale(...args) {
      return this.host?.getWorldTileStaticChunkCacheScale?.(...args) || 1;
    }

    getWorldTileStaticCacheKey(...args) {
      return this.host?.getWorldTileStaticCacheKey?.(...args) || '';
    }

    withSuppressedHitTargets(callback) {
      if (typeof this.host?.withSuppressedHitTargets === 'function') return this.host.withSuppressedHitTargets(callback);
      return callback?.();
    }

    renderWorldTileStaticEntries(...args) {
      return this.host?.renderWorldTileStaticEntries?.(...args) || false;
    }

    drawWorldTileLayerCache(...args) {
      return this.host?.drawWorldTileLayerCache?.(...args) || false;
    }

    getWorldMapCachePolicy() {
      return global.WorldMapRendererDependencyRegistry?.getRendererDependency?.('worldMapCachePolicy')
        || this.host?.constructor?.getWorldMapCachePolicy?.()
        || null;
    }

    getWorldTileStaticChunkCacheKey(tileMapView = {}, viewport = {}, layout = {}, uiState = {}, options = {}) {
      const cachePolicy = this.getWorldMapCachePolicy();
      if (cachePolicy?.getWorldTileStaticChunkCacheKey) {
        return cachePolicy.getWorldTileStaticChunkCacheKey(tileMapView, viewport, layout, uiState, options);
      }
      return this.getWorldTileStaticCacheKey(tileMapView, viewport, layout.frame, layout.entries, uiState, {
        ...options,
        kind: `chunk:${layout.chunkX},${layout.chunkY}`,
      });
    }

    pruneWorldTileStaticChunkCaches(activeKeys = new Set()) {
      const limit = Math.max(1, Number(this.getWorldTileStaticChunkCacheLimit()) || 32);
      if (!this.worldTileStaticChunkCaches || this.worldTileStaticChunkCaches.size <= limit) return false;
      const cachePolicy = this.getWorldMapCachePolicy();
      const prunableKeys = cachePolicy?.getPrunableCacheKeys
        ? cachePolicy.getPrunableCacheKeys(this.worldTileStaticChunkCaches, activeKeys, limit)
        : null;
      if (prunableKeys) {
        prunableKeys.forEach((key) => this.worldTileStaticChunkCaches.delete(key));
        return prunableKeys.length > 0;
      }
      const staleEntries = Array.from(this.worldTileStaticChunkCaches.entries())
        .filter(([key]) => !activeKeys.has(key))
        .sort((a, b) => (Number(a[1]?.lastUsedAt) || 0) - (Number(b[1]?.lastUsedAt) || 0));
      let pruned = false;
      while (this.worldTileStaticChunkCaches.size > limit && staleEntries.length) {
        const [key] = staleEntries.shift();
        this.worldTileStaticChunkCaches.delete(key);
        pruned = true;
      }
      return pruned;
    }

    getStaticChunkWork(layout = {}, cacheScale = 1) {
      const chunkKey = `${layout.chunkX},${layout.chunkY}`;
      let work = this.worldTileStaticChunkCaches.get(chunkKey);
      const width = Math.max(1, Number(layout.frame.width) || 1);
      const height = Math.max(1, Number(layout.frame.height) || 1);
      const pixelW = Math.max(1, Math.ceil(width * cacheScale));
      const pixelH = Math.max(1, Math.ceil(height * cacheScale));
      if (!work?.canvas || !work?.ctx) {
        const canvas = this.createTileWorkCanvas(pixelW, pixelH);
        const ctx = canvas?.getContext?.('2d') || null;
        if (!canvas || !ctx) return null;
        work = { canvas, ctx };
        this.worldTileStaticChunkCaches.set(chunkKey, work);
      }
      if (work.canvas.width !== pixelW) work.canvas.width = pixelW;
      if (work.canvas.height !== pixelH) work.canvas.height = pixelH;
      work.width = width;
      work.height = height;
      work.pixelWidth = pixelW;
      work.pixelHeight = pixelH;
      work.scale = cacheScale;
      work.chunkX = layout.chunkX;
      work.chunkY = layout.chunkY;
      work.frame = { ...layout.frame };
      return work;
    }

    withStaticChunkContext(work = {}, layout = {}, callback = null) {
      if (!work?.ctx || !layout?.frame || typeof callback !== 'function') return false;
      // The chunk bake draws through host-resolved renderers, so the work ctx must be
      // scoped on the ctx owner for the duration of the bake.
      return this.withRenderCtx(work.ctx, () => {
        work.ctx.setTransform?.(1, 0, 0, 1, 0, 0);
        work.ctx.clearRect?.(0, 0, work.pixelWidth || work.width, work.pixelHeight || work.height);
        work.ctx.setTransform?.(work.scale || 1, 0, 0, work.scale || 1, 0, 0);
        work.ctx.globalAlpha = 1;
        work.ctx.globalCompositeOperation = 'source-over';
        work.ctx.save?.();
        try {
          work.ctx.translate?.(-layout.frame.x, -layout.frame.y);
          return callback(work);
        } finally {
          work.ctx.restore?.();
        }
      });
    }

    renderStaticChunkEntriesIntoCache(tileMapView = {}, layout = {}, uiState = {}) {
      return this.withStaticChunkContext(layout.work, layout, () => {
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
    }

    renderWorldTileStaticChunk(tileMapView = {}, layout = {}, uiState = {}, cacheScale = 1) {
      const hasEntries = Array.isArray(layout.entries) && layout.entries.length > 0;
      if (!layout?.frame || !hasEntries) return false;
      const work = this.getStaticChunkWork(layout, cacheScale);
      if (!work) return false;
      const cacheKey = this.getWorldTileStaticChunkCacheKey(tileMapView, layout.renderViewport, layout, uiState, { cacheScale });
      if (cacheKey !== work.key) {
        if (!this.renderStaticChunkEntriesIntoCache(tileMapView, { ...layout, work }, uiState)) return false;
        work.key = cacheKey;
      }
      work.lastUsedAt = ++this.worldTileStaticChunkCacheTick;
      return true;
    }

    renderWorldTileStaticChunks(tileMapView = {}, chunkLayouts = [], frame = {}, uiState = {}) {
      const cacheScale = this.getWorldTileStaticChunkCacheScale();
      const activeKeys = new Set(chunkLayouts.map((layout) => `${layout.chunkX},${layout.chunkY}`));
      this.worldTileStaticCacheLayoutKind = 'chunks';
      let rendered = false;
      chunkLayouts.forEach((layout) => {
        if (this.renderWorldTileStaticChunk(tileMapView, layout, uiState, cacheScale)) {
          this.drawWorldTileLayerCache(this.worldTileStaticChunkCaches.get(`${layout.chunkX},${layout.chunkY}`), layout, frame);
          rendered = true;
        }
      });
      this.pruneWorldTileStaticChunkCaches(activeKeys);
      return rendered;
    }
  }

  global.WorldMapStaticChunkRenderer = WorldMapStaticChunkRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapStaticChunkRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
