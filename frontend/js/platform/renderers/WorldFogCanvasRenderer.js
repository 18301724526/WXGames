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
      this.maskCache = null;
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

    getTileKey(tile = {}) {
      const q = Math.floor(Number(tile.q ?? tile.x) || 0);
      const r = Math.floor(Number(tile.r ?? tile.y) || 0);
      return `${q},${r}`;
    }

    getTileScreenCenter(tile = {}, viewport = {}, geometry = {}) {
      const scale = Math.max(0.05, Number(viewport.scale) || 1);
      const stepX = Number(geometry.stepX) || (Number(geometry.tileWidth) || 192) * 0.5;
      const stepY = Number(geometry.stepY) || (Number(geometry.tileHeight) || 96) * 0.5;
      const q = Number(tile.q ?? tile.x) || 0;
      const r = Number(tile.r ?? tile.y) || 0;
      return {
        x: (Number(viewport.originX) || 0) + (Number(viewport.panX) || 0) + (q - r) * stepX * scale,
        y: (Number(viewport.originY) || 0) + (Number(viewport.panY) || 0) + (q + r) * stepY * scale,
      };
    }

    getTileDrawRect(center = {}, viewport = {}, geometry = {}) {
      const scale = Math.max(0.05, Number(viewport.scale) || 1);
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      const anchorY = Number.isFinite(Number(geometry.anchorY)) ? Number(geometry.anchorY) : 0.5;
      return {
        x: (Number(center.x) || 0) - tileWidth * 0.5,
        y: (Number(center.y) || 0) - tileHeight * anchorY,
        width: tileWidth,
        height: tileHeight,
      };
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

    normalizeEntry(tile = {}, viewport = {}, geometry = {}) {
      const center = this.getTileScreenCenter(tile, viewport, geometry);
      const drawRect = this.getTileDrawRect(center, viewport, geometry);
      return { tile, center, drawRect, inView: true };
    }

    getFogEntries(tileMapView = {}, entries = [], viewport = {}, geometry = {}) {
      const entryByKey = new Map();
      (Array.isArray(entries) ? entries : []).forEach((entry) => {
        if (!entry?.tile) return;
        entryByKey.set(this.getTileKey(entry.tile), entry);
      });
      (Array.isArray(tileMapView.tiles) ? tileMapView.tiles : []).forEach((tile) => {
        if (!tile) return;
        const key = this.getTileKey(tile);
        if (!entryByKey.has(key)) entryByKey.set(key, this.normalizeEntry(tile, viewport, geometry));
      });
      return [...entryByKey.values()];
    }

    getTileDiamondPoints(entry = {}, viewport = {}, geometry = {}, frame = {}) {
      const point = this.getTilePoint(entry, viewport, geometry);
      const x = point.x - (Number(frame.x) || 0);
      const y = point.y - (Number(frame.y) || 0);
      return [
        { x, y: y - point.halfH },
        { x: x + point.halfW, y },
        { x, y: y + point.halfH },
        { x: x - point.halfW, y },
      ];
    }

    drawTileDiamond(ctx, entry = {}, viewport = {}, geometry = {}, frame = {}) {
      const points = this.getTileDiamondPoints(entry, viewport, geometry, frame);
      if (!points.length) return;
      ctx.moveTo?.(points[0].x, points[0].y);
      points.slice(1).forEach((point) => ctx.lineTo?.(point.x, point.y));
      ctx.closePath?.();
    }

    traceKnownRegion(ctx, entries = [], viewport = {}, geometry = {}, frame = {}) {
      entries.forEach((entry) => {
        this.drawTileDiamond(ctx, entry, viewport, geometry, frame);
      });
    }

    getTileBoundaryNeighborKey(tile = {}, edgeIndex = 0) {
      const q = Math.floor(Number(tile.q ?? tile.x) || 0);
      const r = Math.floor(Number(tile.r ?? tile.y) || 0);
      const neighbors = [
        [q, r - 1],
        [q + 1, r],
        [q, r + 1],
        [q - 1, r],
      ];
      const neighbor = neighbors[Math.max(0, Math.min(neighbors.length - 1, edgeIndex))] || neighbors[0];
      return `${neighbor[0]},${neighbor[1]}`;
    }

    getKnownBoundaryEdges(entries = [], viewport = {}, geometry = {}, frame = {}) {
      const knownEntries = this.getKnownEntries(entries);
      const knownKeys = new Set(knownEntries.map((entry) => this.getTileKey(entry.tile)));
      const edges = [];
      knownEntries.forEach((entry) => {
        const points = this.getTileDiamondPoints(entry, viewport, geometry, frame);
        if (points.length < 4) return;
        for (let edgeIndex = 0; edgeIndex < 4; edgeIndex += 1) {
          if (knownKeys.has(this.getTileBoundaryNeighborKey(entry.tile, edgeIndex))) continue;
          edges.push({
            from: points[edgeIndex],
            to: points[(edgeIndex + 1) % points.length],
          });
        }
      });
      return edges;
    }

    getBoundaryFogWidth(viewport = {}, geometry = {}) {
      const scale = Math.max(0.05, Number(viewport.scale) || 1);
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      return Math.max(10, tileHeight * 0.32);
    }

    drawKnownBoundaryVeil(ctx, entries = [], viewport = {}, geometry = {}, frame = {}) {
      const edges = this.getKnownBoundaryEdges(entries, viewport, geometry, frame);
      if (!edges.length) return false;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.beginPath?.();
      edges.forEach((edge) => {
        ctx.moveTo?.(edge.from.x, edge.from.y);
        ctx.lineTo?.(edge.to.x, edge.to.y);
      });
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(3, 8, 7, 0.52)';
      ctx.lineWidth = this.getBoundaryFogWidth(viewport, geometry);
      ctx.stroke?.();
      ctx.beginPath?.();
      edges.forEach((edge) => {
        ctx.moveTo?.(edge.from.x, edge.from.y);
        ctx.lineTo?.(edge.to.x, edge.to.y);
      });
      ctx.strokeStyle = 'rgba(55, 76, 62, 0.16)';
      ctx.lineWidth = Math.max(2, this.getBoundaryFogWidth(viewport, geometry) * 0.42);
      ctx.stroke?.();
      return true;
    }

    hashNoise(x = 0, y = 0, seed = '') {
      let hash = 2166136261;
      const text = `${seed}:${Math.floor(x)}:${Math.floor(y)}`;
      for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return ((hash >>> 0) % 10000) / 10000;
    }

    getMaskScale(width = 1, height = 1) {
      const longest = Math.max(1, Number(width) || 1, Number(height) || 1);
      return Math.max(0.18, Math.min(0.42, 320 / longest));
    }

    getMaskContext(width, height, maskScale = 0.25) {
      const localW = Math.max(1, Math.ceil(width));
      const localH = Math.max(1, Math.ceil(height));
      const scale = Math.max(0.05, Number(maskScale) || 0.25);
      const pixelW = Math.max(1, Math.ceil(localW * scale));
      const pixelH = Math.max(1, Math.ceil(localH * scale));
      if (!this.maskCache?.canvas || !this.maskCache?.ctx) {
        const canvas = this.canvas?.ownerDocument?.createElement?.('canvas')
          || global.document?.createElement?.('canvas')
          || null;
        const ctx = canvas?.getContext?.('2d') || null;
        if (!canvas || !ctx) return null;
        this.maskCache = { canvas, ctx, width: localW, height: localH, pixelWidth: pixelW, pixelHeight: pixelH, scale };
      }
      const cache = this.maskCache;
      if (cache.canvas.width !== pixelW) cache.canvas.width = pixelW;
      if (cache.canvas.height !== pixelH) cache.canvas.height = pixelH;
      cache.width = localW;
      cache.height = localH;
      cache.pixelWidth = pixelW;
      cache.pixelHeight = pixelH;
      cache.scale = scale;
      return cache;
    }

    drawFogTexture(ctx, width = 1, height = 1, seed = '') {
      const step = 42;
      for (let y = -step; y < height + step; y += step) {
        for (let x = -step; x < width + step; x += step) {
          const noise = this.hashNoise(x, y, seed);
          const drift = (noise - 0.5) * step * 0.8;
          const alpha = 0.035 + noise * 0.075;
          ctx.fillStyle = `rgba(28, 45, 38, ${alpha.toFixed(3)})`;
          ctx.fillRect?.(x + drift, y + step * 0.25, step * (1.8 + noise), Math.max(10, step * 0.38));
          if (noise > 0.62) {
            ctx.fillStyle = `rgba(125, 155, 130, ${(0.015 + noise * 0.025).toFixed(3)})`;
            ctx.fillRect?.(x - step * 0.35, y + drift * 0.35, step * (0.8 + noise), Math.max(4, step * 0.16));
          }
        }
      }
    }

    renderLowResFogMask(mask = null, context = {}) {
      if (!mask?.ctx || !mask?.canvas) return false;
      const {
        tileMapView = {},
        viewport = {},
        frame = {},
        geometry = {},
        knownEntries = [],
      } = context;
      const width = Math.max(1, Math.ceil(Number(frame.width) || mask.width || 1));
      const height = Math.max(1, Math.ceil(Number(frame.height) || mask.height || 1));
      const ctx = mask.ctx;
      ctx.setTransform?.(1, 0, 0, 1, 0, 0);
      ctx.clearRect?.(0, 0, mask.pixelWidth || mask.canvas.width, mask.pixelHeight || mask.canvas.height);
      ctx.setTransform?.(mask.scale || 1, 0, 0, mask.scale || 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.91)';
      ctx.fillRect?.(0, 0, width, height);
      this.drawFogTexture(ctx, width, height, tileMapView.seed || viewport.seed || 'world-fog');
      if (knownEntries.length) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath?.();
        this.traceKnownRegion(ctx, knownEntries, viewport, geometry, frame);
        ctx.fillStyle = 'rgba(0, 0, 0, 1)';
        ctx.fill?.();
        this.drawKnownBoundaryVeil(ctx, knownEntries, viewport, geometry, frame);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      return true;
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
      const fogEntries = this.getFogEntries(tileMapView, entries, viewport, geometry);
      const knownEntries = this.getKnownEntries(fogEntries);
      const mask = this.getMaskContext(width, height, this.getMaskScale(width, height));
      if (!mask || !this.renderLowResFogMask(mask, { tileMapView, viewport, frame, geometry, knownEntries })) return false;
      const ctx = work.ctx;
      ctx.setTransform?.(1, 0, 0, 1, 0, 0);
      ctx.clearRect?.(0, 0, work.pixelWidth || work.canvas.width, work.pixelHeight || work.canvas.height);
      ctx.setTransform?.(work.scale || 1, 0, 0, work.scale || 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      if ('imageSmoothingEnabled' in ctx) ctx.imageSmoothingEnabled = true;
      ctx.drawImage?.(
        mask.canvas,
        0,
        0,
        mask.pixelWidth || mask.canvas.width,
        mask.pixelHeight || mask.canvas.height,
        0,
        0,
        width,
        height,
      );
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
