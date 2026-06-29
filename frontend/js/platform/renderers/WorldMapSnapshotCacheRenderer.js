(function (global) {
  class WorldMapSnapshotCacheRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
    }

    get ctx() {
      return this.host?.ctx || null;
    }

    get worldTileStaticCache() {
      return this.host?.worldTileStaticCache || null;
    }

    get worldTileStaticCacheLayout() {
      return this.host?.worldTileStaticCacheLayout || null;
    }

    get worldTileStaticCacheLayoutKind() {
      return this.host?.worldTileStaticCacheLayoutKind || '';
    }

    get worldTileStaticChunkCaches() {
      return this.host?.worldTileStaticChunkCaches || null;
    }

    get worldTileWaterChunkCaches() {
      return this.host?.worldTileWaterChunkCaches || null;
    }

    drawWorldTileLayerCache(...args) {
      return this.host?.drawWorldTileLayerCache?.(...args) || false;
    }

    getWorldTileWaterFrameCache(...args) {
      return this.host?.getWorldTileWaterFrameCache?.(...args) || null;
    }

    getWorldTileWaterAnimationFrameIndex(...args) {
      return this.host?.getWorldTileWaterAnimationFrameIndex?.(...args) || 0;
    }

    getWorldTileRenderEntries(...args) {
      return this.host?.getWorldTileRenderEntries?.(...args) || [];
    }

    renderWorldTileFogMask(...args) {
      return this.host?.renderWorldTileFogMask?.(...args) || false;
    }

    getWorldMapCachePolicy() {
      return global.WorldMapRendererDependencyRegistry?.getRendererDependency?.('worldMapCachePolicy')
        || this.host?.constructor?.getWorldMapCachePolicy?.()
        || null;
    }

    renderWorldTileSnapshotChunkCacheMap(cacheMap = null, viewport = {}, frame = {}) {
      if (!cacheMap?.size) return false;
      let rendered = false;
      const cachePolicy = this.getWorldMapCachePolicy();
      cacheMap.forEach((work) => {
        const layout = cachePolicy?.getWorldTileSnapshotChunkDrawLayout
          ? cachePolicy.getWorldTileSnapshotChunkDrawLayout(work, viewport)
          : null;
        const chunkFrame = work?.frame;
        const fallbackLayout = layout || (work?.canvas && chunkFrame ? {
          kind: 'chunk',
          frame: chunkFrame,
          drawX: (Number(viewport.originX) || 0) + (Number(viewport.panX) || 0) + (Number(chunkFrame.x) || 0),
          drawY: (Number(viewport.originY) || 0) + (Number(viewport.panY) || 0) + (Number(chunkFrame.y) || 0),
        } : null);
        if (!fallbackLayout) return;
        if (cachePolicy?.intersectsFrame) {
          if (!cachePolicy.intersectsFrame(fallbackLayout, frame)) return;
        } else {
          const drawRight = fallbackLayout.drawX + (Number(chunkFrame.width) || 0);
          const drawBottom = fallbackLayout.drawY + (Number(chunkFrame.height) || 0);
          if (
            fallbackLayout.drawX > frame.x + frame.width
            || drawRight < frame.x
            || fallbackLayout.drawY > frame.y + frame.height
            || drawBottom < frame.y
          ) return;
        }
        if (this.drawWorldTileLayerCache(work, fallbackLayout, frame)) rendered = true;
      });
      return rendered;
    }

    getWorldTileSnapshotDrawLayout(cachedLayout = {}, viewport = {}) {
      const cachePolicy = this.getWorldMapCachePolicy();
      if (cachePolicy?.getWorldTileSnapshotDrawLayout) {
        return cachePolicy.getWorldTileSnapshotDrawLayout(cachedLayout, viewport);
      }
      if (!cachedLayout?.frame) return null;
      return {
        ...cachedLayout,
        drawX: (Number(viewport.originX) || 0) + (Number(viewport.panX) || 0) + (Number(cachedLayout.frame.x) || 0),
        drawY: (Number(viewport.originY) || 0) + (Number(viewport.panY) || 0) + (Number(cachedLayout.frame.y) || 0),
      };
    }

    renderWorldTileSnapshotLayerCache(work = null, cachedLayout = null, viewport = {}, frame = {}) {
      if (!work?.canvas || !cachedLayout?.frame) return false;
      const drawLayout = this.getWorldTileSnapshotDrawLayout(cachedLayout, viewport);
      return drawLayout ? this.drawWorldTileLayerCache(work, drawLayout, frame) : false;
    }

    renderWorldTileSnapshotFogMask(tileMapView = {}, viewport = {}, frame = {}) {
      const entries = this.getWorldTileRenderEntries(tileMapView, viewport, frame, tileMapView.geometry || viewport.geometry || {});
      this.renderWorldTileFogMask(tileMapView, viewport, frame, entries);
      return true;
    }

    renderWorldTileSnapshotCache(tileMapView = {}, viewport = {}, frame = {}) {
      if (!this.ctx || typeof this.ctx.drawImage !== 'function') return false;
      let rendered = false;
      if (this.worldTileStaticCache?.canvas && this.worldTileStaticCacheLayout?.frame) {
        const waterWork = this.getWorldTileWaterFrameCache();
        if (waterWork?.canvas) {
          rendered = this.renderWorldTileSnapshotLayerCache(
            waterWork,
            this.worldTileStaticCacheLayout,
            viewport,
            frame,
          ) || rendered;
        }
        rendered = this.renderWorldTileSnapshotLayerCache(
          this.worldTileStaticCache,
          this.worldTileStaticCacheLayout,
          viewport,
          frame,
        ) || rendered;
        if (rendered) this.renderWorldTileSnapshotFogMask(tileMapView, viewport, frame);
        return rendered;
      }
      if (this.worldTileStaticCacheLayoutKind !== 'chunks' || !this.worldTileStaticChunkCaches?.size) return false;
      const frameIndex = this.getWorldTileWaterAnimationFrameIndex();
      const renderedWater = this.renderWorldTileSnapshotChunkCacheMap(
        new Map(Array.from(this.worldTileWaterChunkCaches || [])
          .filter(([key]) => String(key).endsWith(`:${frameIndex}`))),
        viewport,
        frame,
      );
      const renderedStatic = this.renderWorldTileSnapshotChunkCacheMap(this.worldTileStaticChunkCaches, viewport, frame);
      rendered = renderedWater || renderedStatic;
      if (rendered) this.renderWorldTileSnapshotFogMask(tileMapView, viewport, frame);
      return rendered;
    }
  }

  global.WorldMapSnapshotCacheRenderer = WorldMapSnapshotCacheRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapSnapshotCacheRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
