(function (global) {
  class WorldMapStaticChunkRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      return new Proxy(this, {
        get(target, prop, receiver) {
          const ownValue = Reflect.get(target, prop, receiver);
          if (ownValue !== undefined || prop in target) return ownValue;
          const host = target.host;
          if (host && prop in host) {
            const hostValue = host[prop];
            return typeof hostValue === 'function' ? hostValue.bind(host) : hostValue;
          }
          return undefined;
        },
        set(target, prop, value, receiver) {
          if (prop === 'host' || prop in target) return Reflect.set(target, prop, value, receiver);
          const host = target.host;
          if (host) {
            host[prop] = value;
            return true;
          }
          target[prop] = value;
          return true;
        },
      });
    }

    getWorldMapCachePolicy() {
      return this.host?.constructor?.getWorldMapCachePolicy?.() || null;
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
      const previousCtx = this.ctx;
      this.ctx = work.ctx;
      try {
        work.ctx.setTransform?.(1, 0, 0, 1, 0, 0);
        work.ctx.clearRect?.(0, 0, work.pixelWidth || work.width, work.pixelHeight || work.height);
        work.ctx.setTransform?.(work.scale || 1, 0, 0, work.scale || 1, 0, 0);
        work.ctx.globalAlpha = 1;
        work.ctx.globalCompositeOperation = 'source-over';
        work.ctx.save?.();
        work.ctx.translate?.(-layout.frame.x, -layout.frame.y);
        return callback(work);
      } finally {
        work.ctx.restore?.();
        this.ctx = previousCtx;
      }
    }

    renderStaticChunkEntriesIntoCache(tileMapView = {}, layout = {}, uiState = {}) {
      return this.withStaticChunkContext(layout.work, layout, () => {
        this.withSuppressedHitTargets(() => {
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
