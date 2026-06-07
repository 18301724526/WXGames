(function (global) {
  class WorldFogCanvasRenderer {
    constructor(options = {}) {
      this.ctx = options.ctx || null;
      this.canvas = options.canvas || null;
      this.pixelRatio = options.pixelRatio || 1;
      this.width = options.width || 390;
      this.height = options.height || 844;
      this.viewportOffsetX = options.viewportOffsetX || 0;
      this.viewportOffsetY = options.viewportOffsetY || 0;
      this.viewportWidth = options.viewportWidth || this.width;
      this.viewportHeight = options.viewportHeight || this.height;
      this.cache = null;
    }

    setMetrics(metrics = {}) {
      this.width = Math.max(1, Number(metrics.width) || this.width || 1);
      this.height = Math.max(1, Number(metrics.height) || this.height || 1);
      this.pixelRatio = Math.max(1, Number(metrics.pixelRatio) || this.pixelRatio || 1);
      this.viewportOffsetX = Math.max(0, Number(metrics.viewportOffsetX) || 0);
      this.viewportOffsetY = Math.max(0, Number(metrics.viewportOffsetY) || 0);
      this.viewportWidth = Math.max(1, Number(metrics.viewportWidth) || this.viewportWidth || this.width);
      this.viewportHeight = Math.max(1, Number(metrics.viewportHeight) || this.viewportHeight || this.height);
      return this;
    }

    clear() {
      if (!this.ctx) return false;
      this.ctx.clearRect?.(0, 0, this.width, this.height);
      return true;
    }

    isKnownTile(tile = {}) {
      if (!tile || typeof tile !== 'object') return false;
      if (tile.discovered === false || tile.visible === false) return false;
      return tile.visibility !== 'unknown';
    }

    getKnownEntries(entries = []) {
      return (Array.isArray(entries) ? entries : []).filter((entry) => this.isKnownTile(entry?.tile));
    }

    getTilePoint(entry = {}, viewport = {}, geometry = {}) {
      const center = entry.center || {};
      const drawRect = entry.drawRect || {};
      const scale = Math.max(0.05, Number(viewport.scale) || 1);
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      const cx = Number(center.x);
      const cy = Number(center.y);
      if (Number.isFinite(cx) && Number.isFinite(cy)) {
        return {
          x: cx,
          y: cy,
          halfW: tileWidth * 0.5,
          halfH: tileHeight * 0.5,
        };
      }
      const x = Number(drawRect.x) || 0;
      const y = Number(drawRect.y) || 0;
      const width = Number(drawRect.width) || tileWidth;
      const height = Number(drawRect.height) || tileHeight;
      return {
        x: x + width * 0.5,
        y: y + height * 0.5,
        halfW: width * 0.5,
        halfH: height * 0.35,
      };
    }

    drawTileDiamond(ctx, entry = {}, viewport = {}, geometry = {}, frame = {}) {
      const point = this.getTilePoint(entry, viewport, geometry);
      const x = point.x - (Number(frame.x) || 0);
      const y = point.y - (Number(frame.y) || 0);
      ctx.moveTo?.(x, y - point.halfH);
      ctx.lineTo?.(x + point.halfW, y);
      ctx.lineTo?.(x, y + point.halfH);
      ctx.lineTo?.(x - point.halfW, y);
      ctx.closePath?.();
    }

    getCacheContext(width, height, cacheScale = 1) {
      const localW = Math.max(1, Math.ceil(width));
      const localH = Math.max(1, Math.ceil(height));
      const scale = Math.max(1, Number(cacheScale) || 1);
      const pixelW = Math.max(1, Math.ceil(localW * scale));
      const pixelH = Math.max(1, Math.ceil(localH * scale));
      if (!this.cache?.canvas || !this.cache?.ctx) {
        const canvas = this.canvas?.ownerDocument?.createElement?.('canvas')
          || global.document?.createElement?.('canvas')
          || null;
        const ctx = canvas?.getContext?.('2d') || null;
        if (!canvas || !ctx) return null;
        this.cache = { canvas, ctx, width: localW, height: localH, pixelWidth: pixelW, pixelHeight: pixelH, scale };
      }
      const cache = this.cache;
      if (cache.canvas.width !== pixelW) cache.canvas.width = pixelW;
      if (cache.canvas.height !== pixelH) cache.canvas.height = pixelH;
      cache.width = localW;
      cache.height = localH;
      cache.pixelWidth = pixelW;
      cache.pixelHeight = pixelH;
      cache.scale = scale;
      return cache;
    }

    renderWorldFog(tileMapContext = {}) {
      if (!this.ctx || typeof this.ctx.drawImage !== 'function') return false;
      const { tileMapView = {}, viewport = {}, frame = {}, entries = [] } = tileMapContext || {};
      const width = Math.max(1, Math.ceil(Number(frame.width) || 1));
      const height = Math.max(1, Math.ceil(Number(frame.height) || 1));
      const work = this.getCacheContext(width, height, Math.max(1, Number(this.pixelRatio) || 1));
      if (!work?.canvas || !work?.ctx) return false;
      const geometry = tileMapView.geometry || viewport.geometry || {};
      const knownEntries = this.getKnownEntries(entries);
      const ctx = work.ctx;
      ctx.setTransform?.(1, 0, 0, 1, 0, 0);
      ctx.clearRect?.(0, 0, work.pixelWidth || work.canvas.width, work.pixelHeight || work.canvas.height);
      ctx.setTransform?.(work.scale || 1, 0, 0, work.scale || 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
      ctx.fillRect?.(0, 0, width, height);
      if (knownEntries.length) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath?.();
        knownEntries.forEach((entry) => this.drawTileDiamond(ctx, entry, viewport, geometry, frame));
        ctx.fillStyle = 'rgba(0, 0, 0, 1)';
        ctx.fill?.();

        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath?.();
        knownEntries.forEach((entry) => this.drawTileDiamond(ctx, entry, viewport, geometry, frame));
        ctx.strokeStyle = 'rgba(92, 128, 112, 0.22)';
        ctx.lineWidth = 1.5;
        ctx.stroke?.();
      }
      ctx.globalCompositeOperation = 'source-over';
      this.clear();
      this.ctx.save?.();
      this.ctx.beginPath?.();
      this.ctx.rect?.(Number(frame.x) || 0, Number(frame.y) || 0, width, height);
      this.ctx.clip?.();
      this.ctx.drawImage(
        work.canvas,
        0,
        0,
        work.pixelWidth || work.canvas.width,
        work.pixelHeight || work.canvas.height,
        Number(frame.x) || 0,
        Number(frame.y) || 0,
        width,
        height,
      );
      this.ctx.restore?.();
      return true;
    }
  }

  global.WorldFogCanvasRenderer = WorldFogCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldFogCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
