(function (global) {
  const TileCoord = (() => {
    if (global.TileCoord) return global.TileCoord;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/foundation/TileCoord');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class WorldMapWaterLayerRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.worldMapRenderState = options.worldMapRenderState || this.host?.worldMapRenderState || null;
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

    get worldTileWaterLayerCache() {
      return this.worldMapCacheState?.worldTileWaterLayerCache || null;
    }

    set worldTileWaterLayerCache(value) {
      if (this.worldMapCacheState) this.worldMapCacheState.worldTileWaterLayerCache = value || null;
    }

    get worldTileWaterLayerCacheKey() {
      return this.worldMapCacheState?.worldTileWaterLayerCacheKey || '';
    }

    set worldTileWaterLayerCacheKey(value) {
      if (this.worldMapCacheState) this.worldMapCacheState.worldTileWaterLayerCacheKey = value || '';
    }

    get worldTileWaterFrameCaches() {
      return this.worldMapCacheState?.worldTileWaterFrameCaches || null;
    }

    get worldTileWaterChunkCaches() {
      return this.worldMapCacheState?.worldTileWaterChunkCaches || null;
    }

    get worldTileWaterChunkCacheTick() {
      return Number(this.worldMapCacheState?.worldTileWaterChunkCacheTick) || 0;
    }

    set worldTileWaterChunkCacheTick(value) {
      if (this.worldMapCacheState) this.worldMapCacheState.worldTileWaterChunkCacheTick = Number(value) || 0;
    }

    get worldTileWaterTimeOverride() {
      return this.worldMapRenderState?.worldTileWaterTimeOverride ?? null;
    }

    getNow() {
      return this.host?.getNow?.() ?? Date.now();
    }

    getWorldTileStaticChunkCacheLimit(...args) {
      return this.host?.getWorldTileStaticChunkCacheLimit?.(...args) || 32;
    }

    getWorldTileStaticCacheScale(...args) {
      return this.host?.getWorldTileStaticCacheScale?.(...args) || 1;
    }

    getWorldTileStaticChunkCacheScale(...args) {
      return this.host?.getWorldTileStaticChunkCacheScale?.(...args) || 1;
    }

    resolveWorldTileStaticCacheLayout(...args) {
      return this.host?.resolveWorldTileStaticCacheLayout?.(...args) || null;
    }

    createWorldTileLayerWork(...args) {
      return this.host?.createWorldTileLayerWork?.(...args) || null;
    }

    renderWorldTileWaterEntries(...args) {
      return this.host?.renderWorldTileWaterEntries?.(...args) || false;
    }

    drawWorldTileLayerCache(...args) {
      return this.host?.drawWorldTileLayerCache?.(...args) || false;
    }

    getWorldMapCachePolicy() {
      return global.WorldMapRendererDependencyRegistry?.getRendererDependency?.('worldMapCachePolicy')
        || this.host?.constructor?.getWorldMapCachePolicy?.()
        || null;
    }

    getWaterEntries(entries = []) {
      return (Array.isArray(entries) ? entries : []).filter(({ tile }) => tile?.water?.kind && tile?.water?.asset);
    }

    normalizeTileCoord(tile = {}) {
      return TileCoord.normalizeCoord(tile);
    }

    getWorldTileWaterChunkCacheKey(tileMapView = {}, viewport = {}, layout = {}, waterEntries = [], options = {}) {
      const cachePolicy = this.getWorldMapCachePolicy();
      if (cachePolicy?.getWorldTileWaterChunkCacheKey) {
        return cachePolicy.getWorldTileWaterChunkCacheKey(tileMapView, viewport, layout, waterEntries, options);
      }
      return this.getWorldTileWaterLayerCacheKey(tileMapView, viewport, layout.frame, waterEntries, {
        ...options,
        kind: `water-chunk:${layout.chunkX},${layout.chunkY}`,
      });
    }

    pruneWorldTileWaterChunkCaches(activeKeys = new Set()) {
      const frameCount = Math.max(1, Number(this.getWorldTileWaterAnimationFrameCount()) || 1);
      const limit = Math.max(1, Number(this.getWorldTileStaticChunkCacheLimit?.()) || 32) * frameCount;
      if (!this.worldTileWaterChunkCaches || this.worldTileWaterChunkCaches.size <= limit) return false;
      const cachePolicy = this.getWorldMapCachePolicy();
      const prunableKeys = cachePolicy?.getPrunableCacheKeys
        ? cachePolicy.getPrunableCacheKeys(this.worldTileWaterChunkCaches, activeKeys, limit)
        : null;
      if (prunableKeys) {
        prunableKeys.forEach((key) => this.worldTileWaterChunkCaches.delete(key));
        return prunableKeys.length > 0;
      }
      const staleEntries = Array.from(this.worldTileWaterChunkCaches.entries())
        .filter(([key]) => !activeKeys.has(key))
        .sort((a, b) => (Number(a[1]?.lastUsedAt) || 0) - (Number(b[1]?.lastUsedAt) || 0));
      let pruned = false;
      while (this.worldTileWaterChunkCaches.size > limit && staleEntries.length) {
        const [key] = staleEntries.shift();
        this.worldTileWaterChunkCaches.delete(key);
        pruned = true;
      }
      return pruned;
    }

    getWorldTileWaterChunkFrameCacheId(layout = {}, frameIndex = 0) {
      const cachePolicy = this.getWorldMapCachePolicy();
      if (cachePolicy?.getWorldTileWaterChunkFrameCacheId) {
        return cachePolicy.getWorldTileWaterChunkFrameCacheId(layout, frameIndex);
      }
      return `${layout.chunkX},${layout.chunkY}:${frameIndex}`;
    }

    renderWorldTileWaterChunk(tileMapView = {}, layout = {}, cacheScale = 1, frameIndex = this.getWorldTileWaterAnimationFrameIndex()) {
      if (!layout?.frame || !Array.isArray(layout.entries) || !layout.entries.length) return false;
      const waterEntries = this.getWaterEntries(layout.entries);
      if (!waterEntries.length) return false;
      const cacheId = this.getWorldTileWaterChunkFrameCacheId(layout, frameIndex);
      const work = this.renderWorldTileWaterFrameCache(
        tileMapView,
        layout,
        waterEntries,
        cacheScale,
        frameIndex,
        this.worldTileWaterChunkCaches,
        cacheId,
        `water-chunk:${layout.chunkX},${layout.chunkY}`,
      );
      if (!work) return false;
      work.chunkX = layout.chunkX;
      work.chunkY = layout.chunkY;
      work.lastUsedAt = ++this.worldTileWaterChunkCacheTick;
      return true;
    }

    renderWorldTileWaterChunkFrames(tileMapView = {}, layout = {}, cacheScale = 1) {
      const frameCount = Math.max(1, Number(this.getWorldTileWaterAnimationFrameCount()) || 1);
      let rendered = false;
      for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        if (this.renderWorldTileWaterChunk(tileMapView, layout, cacheScale, frameIndex)) rendered = true;
      }
      return rendered;
    }

    renderWorldTileWaterChunks(tileMapView = {}, chunkLayouts = [], frame = {}) {
      const cacheScale = this.getWorldTileStaticChunkCacheScale();
      const activeKeys = new Set();
      const frameIndex = this.getWorldTileWaterAnimationFrameIndex();
      const frameCount = Math.max(1, Number(this.getWorldTileWaterAnimationFrameCount()) || 1);
      let rendered = false;
      chunkLayouts.forEach((layout) => {
        const waterEntries = this.getWaterEntries(layout.entries || []);
        if (!waterEntries.length) return;
        for (let index = 0; index < frameCount; index += 1) {
          activeKeys.add(this.getWorldTileWaterChunkFrameCacheId(layout, index));
        }
        if (!this.worldTileFastDragActive) this.renderWorldTileWaterChunkFrames(tileMapView, layout, cacheScale);
        const cacheId = this.getWorldTileWaterChunkFrameCacheId(layout, frameIndex);
        const work = this.worldTileWaterChunkCaches.get(cacheId);
        if (work?.canvas) {
          this.drawWorldTileLayerCache(work, layout, frame);
          rendered = true;
        }
      });
      this.pruneWorldTileWaterChunkCaches(activeKeys);
      return rendered;
    }

    getWorldTileWaterAnimationFps() {
      return 8;
    }

    getWorldTileWaterAnimationFrameCount() {
      return 8;
    }

    getWorldTileWaterAnimationFrameMs() {
      return Math.max(16, Math.round(1000 / Math.max(1, this.getWorldTileWaterAnimationFps())));
    }

    getWorldTileWaterTimeMs() {
      return this.worldTileWaterTimeOverride !== null
        && this.worldTileWaterTimeOverride !== undefined
        && Number.isFinite(Number(this.worldTileWaterTimeOverride))
        ? Number(this.worldTileWaterTimeOverride)
        : this.getNow();
    }

    getWorldTileWaterAnimationFrame(timeMs = this.getWorldTileWaterTimeMs()) {
      return Math.floor((Math.max(0, Number(timeMs) || 0) / 1000) * this.getWorldTileWaterAnimationFps());
    }

    getWorldTileWaterAnimationFrameIndex(timeMs = this.getWorldTileWaterTimeMs()) {
      const frameCount = Math.max(1, Number(this.getWorldTileWaterAnimationFrameCount()) || 1);
      const frame = this.getWorldTileWaterAnimationFrame(timeMs);
      return ((frame % frameCount) + frameCount) % frameCount;
    }

    getWorldTileWaterFrameTimeMs(frameIndex = 0) {
      const safeFrame = Math.max(0, Number(frameIndex) || 0);
      return safeFrame * this.getWorldTileWaterAnimationFrameMs();
    }

    getWorldTileWaterLayerCacheKey(tileMapView = {}, viewport = {}, frame = {}, entries = [], options = {}) {
      const cachePolicy = this.getWorldMapCachePolicy();
      if (cachePolicy?.getWorldTileWaterLayerCacheKey) {
        return cachePolicy.getWorldTileWaterLayerCacheKey(tileMapView, viewport, frame, entries, {
          ...options,
          frameIndex: options.frameIndex ?? this.getWorldTileWaterAnimationFrameIndex(),
        });
      }
      const scale = Number(viewport.scale) || 1;
      const entrySignature = this.getWaterEntries(entries)
        .map(({ tile, center, drawRect }) => {
          const coord = this.normalizeTileCoord(tile);
          return [
            coord.tileId,
            tile.water?.kind || '',
            tile.water?.asset || '',
            (tile.templateAssets || []).map((asset) => `${asset.key}:${asset.asset}:${asset.waterKind || ''}`).join(','),
            Math.round(center.x * 10) / 10,
            Math.round(center.y * 10) / 10,
            Math.round(drawRect.x * 10) / 10,
            Math.round(drawRect.y * 10) / 10,
          ].join('|');
        })
        .join(';');
      return [
        options.kind || 'world',
        tileMapView.signature || '',
        tileMapView.version || '',
        tileMapView.seed || '',
        Math.round(frame.x),
        Math.round(frame.y),
        Math.round(frame.width),
        Math.round(frame.height),
        Math.round(scale * 1000),
        Math.round((Number(options.cacheScale) || 1) * 1000),
        options.frameIndex ?? this.getWorldTileWaterAnimationFrameIndex(),
        entrySignature,
      ].join('::');
    }

    resolveWorldTileWaterLayerCacheLayout(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      return this.resolveWorldTileStaticCacheLayout(tileMapView, viewport, frame, entries);
    }

    withWaterFrameCacheContext(work = {}, layout = {}, callback = null) {
      if (!work?.ctx || !layout?.frame || typeof callback !== 'function') return false;
      // The water frame bake draws through host-resolved renderers, so the work ctx must
      // be scoped on the ctx owner for the duration of the bake.
      return this.withRenderCtx(work.ctx, () => {
        work.ctx.setTransform?.(1, 0, 0, 1, 0, 0);
        work.ctx.clearRect?.(0, 0, work.pixelWidth || work.width, work.pixelHeight || work.height);
        work.ctx.setTransform?.(work.scale || 1, 0, 0, work.scale || 1, 0, 0);
        work.ctx.globalAlpha = 1;
        work.ctx.globalCompositeOperation = 'source-over';
        work.ctx.save?.();
        try {
          work.ctx.translate?.(-(Number(layout.frame.x) || 0), -(Number(layout.frame.y) || 0));
          return callback(work);
        } finally {
          work.ctx.restore?.();
        }
      });
    }

    renderWaterEntriesIntoFrameCache(tileMapView = {}, layout = {}, waterEntries = [], frameIndex = 0) {
      return this.withWaterFrameCacheContext(layout.work, layout, () => {
        const waterEntryRenderer = this.host?.worldMapWaterEntryRenderer || null;
        if (waterEntryRenderer?.withRenderCtx) {
          waterEntryRenderer.withRenderCtx(layout.work.ctx, () => {
            this.renderWorldTileWaterEntries(
              tileMapView,
              layout.renderViewport,
              waterEntries,
              this.getWorldTileWaterFrameTimeMs(frameIndex),
            );
          });
        } else {
          this.renderWorldTileWaterEntries(
            tileMapView,
            layout.renderViewport,
            waterEntries,
            this.getWorldTileWaterFrameTimeMs(frameIndex),
          );
        }
        return true;
      });
    }

    renderWorldTileWaterFrameCache(tileMapView = {}, layout = {}, waterEntries = [], cacheScale = 1, frameIndex = 0, cacheMap = this.worldTileWaterFrameCaches, cacheId = frameIndex, kind = layout.kind || 'world') {
      if (!layout?.frame || !Array.isArray(waterEntries) || !waterEntries.length || !cacheMap) return null;
      const width = Math.max(1, Number(layout.frame.width) || 1);
      const height = Math.max(1, Number(layout.frame.height) || 1);
      let work = cacheMap.get(cacheId);
      const pixelW = Math.max(1, Math.ceil(width * cacheScale));
      const pixelH = Math.max(1, Math.ceil(height * cacheScale));
      if (!work?.canvas || !work?.ctx || work.canvas.width !== pixelW || work.canvas.height !== pixelH) {
        work = this.createWorldTileLayerWork(width, height, cacheScale);
        if (!work) return null;
        cacheMap.set(cacheId, work);
      }
      work.width = width;
      work.height = height;
      work.pixelWidth = pixelW;
      work.pixelHeight = pixelH;
      work.scale = cacheScale;
      work.frame = { ...layout.frame };
      work.frameIndex = frameIndex;
      const cacheKey = this.getWorldTileWaterLayerCacheKey(tileMapView, layout.renderViewport, layout.frame, waterEntries, {
        kind,
        cacheScale,
        frameIndex,
      });
      if (cacheKey !== work.key) {
        if (!this.renderWaterEntriesIntoFrameCache(tileMapView, { ...layout, work }, waterEntries, frameIndex)) return null;
        work.key = cacheKey;
      }
      return work;
    }

    getWorldTileWaterFrameCache(frameIndex = this.getWorldTileWaterAnimationFrameIndex()) {
      return this.worldTileWaterFrameCaches?.get?.(frameIndex) || null;
    }

    renderWorldTileWaterFrameCaches(tileMapView = {}, layout = {}, waterEntries = [], cacheScale = 1) {
      const frameCount = Math.max(1, Number(this.getWorldTileWaterAnimationFrameCount()) || 1);
      let rendered = false;
      for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        const work = this.renderWorldTileWaterFrameCache(
          tileMapView,
          layout,
          waterEntries,
          cacheScale,
          frameIndex,
          this.worldTileWaterFrameCaches,
          frameIndex,
          layout.kind || 'world',
        );
        if (work) rendered = true;
      }
      return rendered;
    }

    renderWorldTileWaterLayer(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      const layout = this.resolveWorldTileWaterLayerCacheLayout(tileMapView, viewport, frame, entries);
      if (!layout) return false;
      if (layout.kind === 'chunks') return this.renderWorldTileWaterChunks(tileMapView, layout.layouts, frame);
      const waterEntries = this.getWaterEntries(layout.entries);
      if (!waterEntries.length) return true;
      const cacheScale = this.getWorldTileStaticCacheScale();
      const frameIndex = this.getWorldTileWaterAnimationFrameIndex();
      if (!this.worldTileFastDragActive && !this.renderWorldTileWaterFrameCaches(tileMapView, layout, waterEntries, cacheScale)) {
        return false;
      }
      const work = this.getWorldTileWaterFrameCache(frameIndex);
      if (!work?.canvas) return false;
      this.worldTileWaterLayerCache = work;
      this.worldTileWaterLayerCacheKey = work.key || '';
      return this.drawWorldTileLayerCache(work, layout, frame);
    }
  }

  global.WorldMapWaterLayerRenderer = WorldMapWaterLayerRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapWaterLayerRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
