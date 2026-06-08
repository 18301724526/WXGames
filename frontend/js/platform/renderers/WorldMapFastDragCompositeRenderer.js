(function (global) {
  class WorldMapFastDragCompositeRenderer {
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

    getWorldTileFastDragCompositeSignature() {
      return [
        this.worldTileStaticCacheKey || '',
        this.worldTileScoutRouteCacheKey || '',
        this.worldTileWaterLayerCacheKey || '',
      ].join('::');
    }

    renderWorldTileFastDragComposite(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      if (!this.worldTileFastDragComposite?.work || !this.worldTileFastDragComposite?.layout) return false;
      if (this.worldTileFastDragComposite.signature !== this.getWorldTileFastDragCompositeSignature()) return false;
      const layout = this.resolveWorldTileStaticCacheLayout(tileMapView, viewport, frame, entries);
      if (!layout || layout.kind === 'chunks') return false;
      const cachedLayout = this.worldTileFastDragComposite.layout;
      const drawLayout = {
        ...cachedLayout,
        drawX: layout.drawX,
        drawY: layout.drawY,
      };
      return this.drawWorldTileLayerCache(this.worldTileFastDragComposite.work, drawLayout, frame);
    }

    withFastDragCompositeContext(work = {}, callback = null) {
      if (!work?.ctx || typeof callback !== 'function') return false;
      const previousCtx = this.ctx;
      this.ctx = work.ctx;
      try {
        work.ctx.setTransform?.(1, 0, 0, 1, 0, 0);
        work.ctx.clearRect?.(0, 0, work.pixelWidth || work.width, work.pixelHeight || work.height);
        work.ctx.setTransform?.(work.scale || 1, 0, 0, work.scale || 1, 0, 0);
        work.ctx.globalAlpha = 1;
        work.ctx.globalCompositeOperation = 'source-over';
        return callback(work);
      } finally {
        this.ctx = previousCtx;
      }
    }

    updateWorldTileFastDragComposite(layout = null, frame = null) {
      if (!layout?.frame || !this.worldTileStaticCache?.canvas) return false;
      const signature = this.getWorldTileFastDragCompositeSignature();
      if (!signature.trim()) return false;
      const width = Math.max(1, Number(layout.frame.width) || 1);
      const height = Math.max(1, Number(layout.frame.height) || 1);
      const cacheScale = this.getWorldTileStaticCacheScale();
      const work = this.getWorldTileLayerCacheContext('worldTileFastDragCompositeCache', width, height, cacheScale);
      if (!work) return false;
      const rendered = this.withFastDragCompositeContext(work, () => {
        const localFrame = {
          x: 0,
          y: 0,
          width,
          height,
        };
        const localLayout = {
          ...layout,
          drawX: 0,
          drawY: 0,
        };
        this.drawWorldTileLayerCache(this.worldTileScoutRouteCache, localLayout, localFrame);
        this.drawWorldTileLayerCache(this.worldTileWaterLayerCache, localLayout, localFrame);
        this.drawWorldTileLayerCache(this.worldTileStaticCache, localLayout, localFrame);
        return true;
      });
      if (!rendered) return false;
      this.worldTileFastDragComposite = {
        signature,
        layout: { ...layout },
        work,
      };
      return true;
    }
  }

  global.WorldMapFastDragCompositeRenderer = WorldMapFastDragCompositeRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapFastDragCompositeRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
