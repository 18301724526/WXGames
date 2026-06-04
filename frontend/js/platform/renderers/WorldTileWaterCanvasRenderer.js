(function (global) {
  const sharedTileMapManifest = (() => {
    if (global.TileMapAssetManifest) return global.TileMapAssetManifest;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../config/TileMapAssetManifest');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const sharedTileMapGeometry = (() => {
    if (global.TileMapGeometry) return global.TileMapGeometry;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/TileMapGeometry');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  class WorldTileWaterCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      return new Proxy(this, {
        get(target, prop, receiver) {
          const ownValue = Reflect.get(target, prop, receiver);
          if (ownValue !== undefined || prop in target) return ownValue;
          const host = target.host;
          if (host) {
            if (typeof prop === 'string' && prop.startsWith('worldTile')) return host[prop];
            if (prop in host) {
              const hostValue = host[prop];
              return typeof hostValue === 'function' ? hostValue.bind(host) : hostValue;
            }
          }
          return undefined;
        },
        set(target, prop, value, receiver) {
          if (prop === 'host' || prop in target) return Reflect.set(target, prop, value, receiver);
          const host = target.host;
          if (host) {
            if (typeof prop === 'string' && prop.startsWith('worldTile')) {
              host[prop] = value;
              return true;
            }
            if (prop in host) {
              host[prop] = value;
              return true;
            }
          }
          target[prop] = value;
          return true;
        },
      });
    }

    static getTileMapAssetManifest() {
      return sharedTileMapManifest || {};
    }

    static getTileMapGeometry() {
      return sharedTileMapGeometry || null;
    }

    getTileMapAssetManifest() {
      return this.host?.constructor?.getTileMapAssetManifest?.() || this.constructor.getTileMapAssetManifest();
    }

    getTileMapGeometry() {
      return this.host?.constructor?.getTileMapGeometry?.() || this.constructor.getTileMapGeometry();
    }

    getMapCache(name) {
      const existing = this[name];
      if (existing && typeof existing.get === 'function' && typeof existing.set === 'function') return existing;
      const cache = new Map();
      this[name] = cache;
      return cache;
    }

    isInsideTemplateDiamond(x, y, metrics) {
      const centerX = metrics.x + metrics.width * 0.5;
      const centerY = metrics.y + metrics.height * 0.5;
      const halfW = metrics.width * 0.5;
      const halfH = metrics.height * 0.5;
      return Math.abs(x - centerX) / Math.max(1, halfW) + Math.abs(y - centerY) / Math.max(1, halfH) <= 1.03;
    }

    createWorldTileColorWaterMask(assetPath, image, canvas, ctx, probeCtx, width, height) {
      probeCtx.drawImage(image, 0, 0);
      const source = probeCtx.getImageData(0, 0, width, height);
      const output = ctx.createImageData(width, height);
      for (let index = 0; index < source.data.length; index += 4) {
        if (!this.isWorldTileTemplateWaterPixel(source.data, index)) continue;
        output.data[index] = 255;
        output.data[index + 1] = 255;
        output.data[index + 2] = 255;
        output.data[index + 3] = Math.min(255, Math.round(source.data[index + 3] * 1.18));
      }
      ctx.putImageData(output, 0, 0);
      this.getMapCache('worldTileMaskMetricsCache').set(
        assetPath,
        this.measurePixelBounds(output.data, width, height, this.isOpaquePixel),
      );
      return canvas;
    }

    createWorldTileTransparentWaterMask(assetPath, image, canvas, ctx, probeCtx, width, height) {
      probeCtx.drawImage(image, 0, 0);
      const source = probeCtx.getImageData(0, 0, width, height);
      const manifest = this.getTileMapAssetManifest();
      const plains = manifest.getTerrainAsset?.('plains') || manifest.terrain?.plains;
      const terrainImage = plains?.path ? this.getAsset(plains.path) : null;
      let terrainData = null;
      if (terrainImage && Number(terrainImage.naturalWidth || terrainImage.width) === width && Number(terrainImage.naturalHeight || terrainImage.height) === height) {
        probeCtx.clearRect?.(0, 0, width, height);
        probeCtx.drawImage(terrainImage, 0, 0);
        terrainData = probeCtx.getImageData(0, 0, width, height).data;
      }
      const terrainBounds = this.measurePixelBounds(source.data, width, height, this.isOpaquePixel)
        || this.getFallbackAssetMetrics(image);
      const output = ctx.createImageData(width, height);
      for (let py = 0; py < height; py += 1) {
        for (let px = 0; px < width; px += 1) {
          const index = (py * width + px) * 4;
          const insideTerrain = terrainData ? terrainData[index + 3] > 32 : this.isInsideTemplateDiamond(px, py, terrainBounds);
          if (source.data[index + 3] > 8 || !insideTerrain) continue;
          output.data[index] = 255;
          output.data[index + 1] = 255;
          output.data[index + 2] = 255;
          output.data[index + 3] = 255;
        }
      }
      ctx.putImageData(output, 0, 0);
      this.getMapCache('worldTileMaskMetricsCache').set(
        assetPath,
        this.measurePixelBounds(output.data, width, height, this.isOpaquePixel),
      );
      return canvas;
    }

    getWorldTileTemplateMask(assetPath = '') {
      if (!assetPath) return null;
      const maskCache = this.getMapCache('worldTileMaskCache');
      const cached = maskCache.get(assetPath);
      if (cached !== undefined) return cached;
      const image = this.getAsset(assetPath);
      const width = Number(image?.naturalWidth || image?.width || 0);
      const height = Number(image?.naturalHeight || image?.height || 0);
      if (!image || !width || !height) return null;
      const canvas = this.createTileWorkCanvas(width, height);
      const probe = this.createTileWorkCanvas(width, height);
      const ctx = canvas?.getContext?.('2d', { willReadFrequently: true });
      const probeCtx = probe?.getContext?.('2d', { willReadFrequently: true });
      if (!canvas || !probe || !ctx || !probeCtx) {
        maskCache.set(assetPath, null);
        return null;
      }
      try {
        if (assetPath.includes('/river-template/') || assetPath.includes('/ocean-template/')) {
          this.createWorldTileTransparentWaterMask(assetPath, image, canvas, ctx, probeCtx, width, height);
        } else {
          this.createWorldTileColorWaterMask(assetPath, image, canvas, ctx, probeCtx, width, height);
        }
        maskCache.set(assetPath, canvas);
        return canvas;
      } catch (_) {
        maskCache.set(assetPath, null);
        this.getMapCache('worldTileMaskMetricsCache').set(assetPath, null);
        return null;
      }
    }

    getWorldTileDryTemplateCanvas(assetPath = '') {
      if (!assetPath) return null;
      const dryCache = this.getMapCache('worldTileDryCompositeCache');
      const cached = dryCache.get(assetPath);
      if (cached !== undefined) return cached;
      const image = this.getAsset(assetPath);
      const mask = this.getWorldTileTemplateMask(assetPath);
      const width = Number(image?.naturalWidth || image?.width || 0);
      const height = Number(image?.naturalHeight || image?.height || 0);
      if (!image || !mask || !width || !height) return null;
      const canvas = this.createTileWorkCanvas(width, height);
      const ctx = canvas?.getContext?.('2d');
      if (!canvas || !ctx) {
        dryCache.set(assetPath, null);
        return null;
      }
      try {
        ctx.drawImage(image, 0, 0);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(mask, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        dryCache.set(assetPath, canvas);
        return canvas;
      } catch (_) {
        dryCache.set(assetPath, null);
        return null;
      }
    }

    getWorldTileCompositeContext(width, height) {
      const localW = Math.max(1, Math.ceil(width));
      const localH = Math.max(1, Math.ceil(height));
      if (!this.worldTileCompositeCanvas) {
        this.worldTileCompositeCanvas = this.createTileWorkCanvas(localW, localH);
        this.worldTileCompositeCtx = this.worldTileCompositeCanvas?.getContext?.('2d') || null;
      }
      if (!this.worldTileCompositeCanvas || !this.worldTileCompositeCtx) return null;
      if (this.worldTileCompositeCanvas.width !== localW) this.worldTileCompositeCanvas.width = localW;
      if (this.worldTileCompositeCanvas.height !== localH) this.worldTileCompositeCanvas.height = localH;
      return {
        canvas: this.worldTileCompositeCanvas,
        ctx: this.worldTileCompositeCtx,
        width: localW,
        height: localH,
      };
    }

    drawWorldTileTemplateSource(sourceImage, sourceRect, drawRect) {
      if (!sourceImage || !sourceRect || typeof this.ctx.drawImage !== 'function') return false;
      this.ctx.drawImage(
        sourceImage,
        sourceRect.x,
        sourceRect.y,
        sourceRect.width,
        sourceRect.height,
        drawRect.x,
        drawRect.y,
        drawRect.width,
        drawRect.height,
      );
      return true;
    }

    drawWorldTileDryTemplate(tile = {}, drawRect = {}) {
      const baseTemplate = this.getWorldTileTemplateBaseAsset(tile);
      const baseAsset = baseTemplate?.asset || tile.terrainAsset || '';
      if (!baseAsset) return false;
      const templates = Array.isArray(tile.templateAssets) ? tile.templateAssets.filter((asset) => asset?.asset) : [];
      const dryCanvas = this.getWorldTileDryTemplateCanvas(baseAsset);
      const sourceRect = this.getWorldTileTemplateMetrics(baseTemplate || { asset: baseAsset });
      if (!sourceRect) return this.drawTileAsset(baseAsset, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
      if (dryCanvas && templates.length > 1) {
        const sourceWidth = sourceRect.sourceWidth || Number(dryCanvas.width) || 1;
        const sourceHeight = sourceRect.sourceHeight || Number(dryCanvas.height) || 1;
        const work = this.getWorldTileCompositeContext(sourceWidth, sourceHeight);
        if (work) {
          try {
            work.ctx.setTransform?.(1, 0, 0, 1, 0, 0);
            work.ctx.globalAlpha = 1;
            work.ctx.globalCompositeOperation = 'source-over';
            work.ctx.clearRect?.(0, 0, sourceWidth, sourceHeight);
            work.ctx.drawImage(dryCanvas, 0, 0);
            work.ctx.globalCompositeOperation = 'destination-out';
            templates.forEach((template) => {
              const mask = this.getWorldTileTemplateMask(template.asset);
              if (mask) work.ctx.drawImage(mask, 0, 0);
            });
            work.ctx.globalCompositeOperation = 'source-over';
            return this.drawWorldTileTemplateSource(work.canvas, sourceRect, drawRect);
          } catch (_) {
            return this.drawWorldTileTemplateSource(dryCanvas, sourceRect, drawRect);
          }
        }
      }
      if (dryCanvas) {
        return this.drawWorldTileTemplateSource(dryCanvas, sourceRect, drawRect);
      }
      return this.drawTileAsset(baseAsset, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
    }

    getWorldTileTemplateBaseAsset(tile = {}) {
      const templates = Array.isArray(tile.templateAssets) ? tile.templateAssets : [];
      return templates.find((asset) => asset.asset && /^river-mouth-/.test(asset.key || ''))
        || templates.find((asset) => asset.asset && !/tile-ocean-water-full\.png$/.test(asset.asset))
        || templates[0]
        || null;
    }

    getWorldTileWaterTemplateAssets(tile = {}) {
      const templates = Array.isArray(tile.templateAssets) ? tile.templateAssets.filter((asset) => asset?.asset) : [];
      if (!templates.length) return [];
      if (tile.water?.kind === 'ocean') {
        return templates.flatMap((asset) => {
          if (!/^river-mouth-/.test(asset.key || '')) return [asset];
          const manifest = this.getTileMapAssetManifest();
          const shore = manifest.getRiverMouthShoreEdgeAsset?.(asset.key);
          const river = manifest.getRiverMouthRiverTemplateAsset?.(asset.key);
          return [
            shore ? { key: asset.key, asset: shore.path, waterKind: 'ocean' } : null,
            river ? { key: asset.key, asset: river.path, waterKind: 'river' } : null,
          ].filter(Boolean);
        });
      }
      return templates;
    }

    getWorldTileWaterWorkContext(width, height) {
      const localW = Math.max(1, Math.ceil(width));
      const localH = Math.max(1, Math.ceil(height));
      if (!this.worldTileWaterCanvas) {
        this.worldTileWaterCanvas = this.createTileWorkCanvas(localW, localH);
        this.worldTileWaterCtx = this.worldTileWaterCanvas?.getContext?.('2d') || null;
      }
      if (!this.worldTileWaterCanvas || !this.worldTileWaterCtx) return null;
      if (this.worldTileWaterCanvas.width !== localW) this.worldTileWaterCanvas.width = localW;
      if (this.worldTileWaterCanvas.height !== localH) this.worldTileWaterCanvas.height = localH;
      return {
        canvas: this.worldTileWaterCanvas,
        ctx: this.worldTileWaterCtx,
        width: localW,
        height: localH,
      };
    }

    positiveModulo(value, size) {
      return ((value % size) + size) % size;
    }

    getWorldTileMapPosition(tile = {}, geometry = {}) {
      const helper = this.getTileMapGeometry();
      if (helper?.projectTile) return helper.projectTile(tile, geometry);
      const stepX = Number(geometry.stepX) || 96;
      const stepY = Number(geometry.stepY) || 48;
      const q = Number(tile.q) || 0;
      const r = Number(tile.r) || 0;
      return {
        x: (q - r) * stepX,
        y: (q + r) * stepY,
      };
    }

    fillWorldTileWaterTexture(targetCtx, texture, water = {}, tile = {}, drawRect = {}, viewport = {}, width = 1, height = 1, timeMs = null) {
      if (!targetCtx || !texture || typeof targetCtx.drawImage !== 'function') return false;
      const hasTimeMs = timeMs !== null && timeMs !== undefined && Number.isFinite(Number(timeMs));
      const resolvedTimeMs = hasTimeMs ? Number(timeMs) : this.getNow();
      const seconds = Math.max(0, resolvedTimeMs / 1000);
      const geometry = viewport.geometry || {};
      const scale = Number(viewport.scale) || 1;
      const tileW = Math.max(1, Number(texture.naturalWidth || texture.width || 1) * (Number(water.uvScale) || 1) * scale);
      const tileH = Math.max(1, Number(texture.naturalHeight || texture.height || 1) * (Number(water.uvScale) || 1) * scale);
      const phaseX = seconds * (Number(water.speedX) || 0) * scale;
      const phaseY = seconds * (Number(water.speedY) || 0) * scale;
      const position = this.getWorldTileMapPosition(tile, geometry);
      const tileWidth = Number(geometry.tileWidth) || 192;
      const tileHeight = Number(geometry.tileHeight) || 96;
      const anchorY = Number.isFinite(Number(geometry.anchorY)) ? Number(geometry.anchorY) : 0.5;
      const worldLeft = position.x - tileWidth * 0.5;
      const worldTop = position.y - tileHeight * anchorY;
      const startX = -this.positiveModulo(worldLeft * scale + phaseX, tileW);
      const startY = -this.positiveModulo(worldTop * scale + phaseY, tileH);
      for (let py = startY; py < height; py += tileH) {
        for (let px = startX; px < width; px += tileW) {
          targetCtx.drawImage(texture, px, py, tileW + 0.5, tileH + 0.5);
        }
      }
      return true;
    }

    drawWorldTileWaterDiamond(texture, water = {}, center = {}, drawRect = {}, viewport = {}, timeMs = null) {
      if (!texture || typeof this.ctx.drawImage !== 'function') return false;
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = Number(water.alpha) || 1;
      this.ctx.save?.();
      this.ctx.beginPath?.();
      this.ctx.moveTo?.(center.x, center.y - drawRect.height * 0.5);
      this.ctx.lineTo?.(center.x + drawRect.width * 0.5, center.y);
      this.ctx.lineTo?.(center.x, center.y + drawRect.height * 0.5);
      this.ctx.lineTo?.(center.x - drawRect.width * 0.5, center.y);
      if (typeof this.ctx.closePath === 'function') this.ctx.closePath();
      else this.ctx.lineTo?.(center.x, center.y - drawRect.height * 0.5);
      this.ctx.clip?.();
      const drawn = this.fillWorldTileWaterTexture(this.ctx, texture, water, viewport.tile || {}, drawRect, viewport, drawRect.width, drawRect.height, timeMs);
      this.ctx.restore?.();
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      return drawn;
    }

    drawWorldTileWaterLayer(template = {}, water = {}, texture, center = {}, drawRect = {}, viewport = {}, timeMs = null) {
      const mask = this.getWorldTileTemplateMask(template.asset);
      const sourceRect = this.getIsoTileSourceRect(template.asset);
      const work = mask && sourceRect ? this.getWorldTileWaterWorkContext(drawRect.width, drawRect.height) : null;
      if (!work) return this.drawWorldTileWaterDiamond(texture, water, center, drawRect, viewport, timeMs);
      try {
        work.ctx.setTransform?.(1, 0, 0, 1, 0, 0);
        work.ctx.globalAlpha = 1;
        work.ctx.globalCompositeOperation = 'source-over';
        work.ctx.clearRect?.(0, 0, work.width, work.height);
        if (!this.fillWorldTileWaterTexture(work.ctx, texture, water, viewport.tile || {}, drawRect, viewport, work.width, work.height, timeMs)) return false;
        work.ctx.globalCompositeOperation = 'destination-in';
        work.ctx.drawImage(
          mask,
          sourceRect.x,
          sourceRect.y,
          sourceRect.width,
          sourceRect.height,
          0,
          0,
          work.width,
          work.height,
        );
        work.ctx.globalCompositeOperation = 'source-over';
        const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
        if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = Number(water.alpha) || 1;
        this.ctx.drawImage(work.canvas, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
        if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
        return true;
      } catch (_) {
        return this.drawWorldTileWaterDiamond(texture, water, center, drawRect, viewport, timeMs);
      }
    }

    drawWorldTileWater(tile = {}, center = {}, drawRect = {}, viewport = {}, options = {}) {
      const templates = this.getWorldTileWaterTemplateAssets(tile);
      if (!templates.length) return false;
      const manifest = this.getTileMapAssetManifest();
      let drawn = false;
      const tileViewport = { ...viewport, tile };
      const hasWaterTimeMs = options.waterTimeMs !== null
        && options.waterTimeMs !== undefined
        && Number.isFinite(Number(options.waterTimeMs));
      const timeMs = hasWaterTimeMs ? Number(options.waterTimeMs) : this.getNow();
      templates.forEach((template) => {
        const waterKind = template.waterKind || tile.water?.kind;
        const water = waterKind ? manifest.getWaterAsset?.(waterKind) : null;
        if (!water?.path) return;
        const texture = this.getAsset(water.path);
        if (!texture || typeof this.ctx.drawImage !== 'function') return;
        if (this.drawWorldTileWaterLayer(template, water, texture, center, drawRect, tileViewport, timeMs)) drawn = true;
      });
      if (drawn && options.drawDryTemplate !== false) this.drawWorldTileDryTemplate(tile, drawRect);
      return drawn;
    }

    isWorldTileMapWaterAnimated(tileMapView = {}) {
      return (tileMapView.tiles || []).some((tile) => tile.water?.asset);
    }

    drawWorldTileBase(tile = {}, center = {}, drawRect = {}, viewport = {}) {
      const baseTemplate = this.getWorldTileTemplateBaseAsset(tile);
      const baseAsset = baseTemplate?.asset || tile.terrainAsset || '';
      const hasWater = Boolean(tile.water?.kind && tile.water?.asset && baseTemplate?.asset);
      const drawnWater = hasWater ? this.drawWorldTileWater(tile, center, drawRect, viewport) : false;
      if (drawnWater) return true;
      return this.drawTileAsset(baseAsset, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
    }
  }

  global.WorldTileWaterCanvasRenderer = WorldTileWaterCanvasRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorldTileWaterCanvasRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
