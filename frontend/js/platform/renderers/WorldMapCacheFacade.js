(function (global) {
  class WorldMapCacheFacade {
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

    getWorldMapLayerCacheStore() {
      return this.host?.constructor?.getWorldMapLayerCacheStore?.() || null;
    }

    getWorldTileStaticCacheKey(tileMapView = {}, viewport = {}, frame = {}, entries = [], uiState = {}, options = {}) {
      const cachePolicy = this.getWorldMapCachePolicy();
      if (cachePolicy?.getWorldTileStaticCacheKey) {
        return cachePolicy.getWorldTileStaticCacheKey(tileMapView, viewport, frame, entries, uiState, options);
      }
      const scale = Number(viewport.scale) || 1;
      const selectedSiteId = uiState.selectedSiteId || '';
      const entrySignature = entries.map(({ tile = {}, center = {}, drawRect = {} }) => [
        tile.id,
        tile.terrain,
        tile.terrainAsset,
        (tile.templateAssets || []).map((asset) => `${asset.key}:${asset.asset}:${asset.waterKind || ''}`).join(','),
        tile.feature?.asset || '',
        tile.feature?.key || '',
        tile.site?.id || '',
        tile.site?.art || '',
        tile.site?.owner || '',
        tile.site?.name || tile.site?.title || '',
        tile.site?.scale || '',
        tile.site?.offset?.x || 0,
        tile.site?.offset?.y || 0,
        Math.round((Number(center.x) || 0) * 10) / 10,
        Math.round((Number(center.y) || 0) * 10) / 10,
        Math.round((Number(drawRect.x) || 0) * 10) / 10,
        Math.round((Number(drawRect.y) || 0) * 10) / 10,
      ].join('|')).join(';');
      return [
        options.kind || 'world',
        tileMapView.signature || '',
        tileMapView.version || '',
        tileMapView.seed || '',
        selectedSiteId,
        Math.round(frame.x),
        Math.round(frame.y),
        Math.round(frame.width),
        Math.round(frame.height),
        Math.round(scale * 1000),
        Math.round((Number(options.cacheScale) || 1) * 1000),
        entrySignature,
      ].join('::');
    }

    getWorldTileLayerCacheContext(cacheName, width, height, cacheScale = 1) {
      const cacheStore = this.getWorldMapLayerCacheStore();
      if (cacheStore?.getLayerCacheContext) {
        return cacheStore.getLayerCacheContext(this.host, cacheName, width, height, cacheScale, {
          createCanvas: (pixelWidth, pixelHeight) => this.createTileWorkCanvas(pixelWidth, pixelHeight),
        });
      }
      const localW = Math.max(1, Math.ceil(Number(width) || 1));
      const localH = Math.max(1, Math.ceil(Number(height) || 1));
      const scale = Math.max(1, Number(cacheScale) || 1);
      const pixelW = Math.max(1, Math.ceil(localW * scale));
      const pixelH = Math.max(1, Math.ceil(localH * scale));
      const cached = this.host?.[cacheName];
      if (cached?.canvas && cached?.ctx) {
        if (cached.canvas.width !== pixelW) cached.canvas.width = pixelW;
        if (cached.canvas.height !== pixelH) cached.canvas.height = pixelH;
        cached.width = localW;
        cached.height = localH;
        cached.pixelWidth = pixelW;
        cached.pixelHeight = pixelH;
        cached.scale = scale;
        return cached;
      }
      const canvas = this.createTileWorkCanvas(pixelW, pixelH);
      const ctx = canvas?.getContext?.('2d') || null;
      if (!canvas || !ctx || !this.host) return null;
      this.host[cacheName] = {
        canvas,
        ctx,
        width: localW,
        height: localH,
        pixelWidth: pixelW,
        pixelHeight: pixelH,
        scale,
      };
      return this.host[cacheName];
    }

    getWorldTileStaticCacheContext(width, height, cacheScale = 1) {
      return this.getWorldTileLayerCacheContext('worldTileStaticCache', width, height, cacheScale);
    }

    getWorldTileScoutRouteCacheContext(width, height, cacheScale = 1) {
      return this.getWorldTileLayerCacheContext('worldTileScoutRouteCache', width, height, cacheScale);
    }

    getWorldTileWaterLayerCacheContext(width, height, cacheScale = 1) {
      return this.getWorldTileLayerCacheContext('worldTileWaterLayerCache', width, height, cacheScale);
    }

    createWorldTileLayerWork(width, height, cacheScale = 1) {
      const cacheStore = this.getWorldMapLayerCacheStore();
      if (cacheStore?.createLayerWork) {
        return cacheStore.createLayerWork(width, height, cacheScale, {
          createCanvas: (pixelWidth, pixelHeight) => this.createTileWorkCanvas(pixelWidth, pixelHeight),
        });
      }
      const localW = Math.max(1, Math.ceil(Number(width) || 1));
      const localH = Math.max(1, Math.ceil(Number(height) || 1));
      const scale = Math.max(1, Number(cacheScale) || 1);
      const pixelW = Math.max(1, Math.ceil(localW * scale));
      const pixelH = Math.max(1, Math.ceil(localH * scale));
      const canvas = this.createTileWorkCanvas(pixelW, pixelH);
      const ctx = canvas?.getContext?.('2d') || null;
      if (!canvas || !ctx) return null;
      return {
        canvas,
        ctx,
        width: localW,
        height: localH,
        pixelWidth: pixelW,
        pixelHeight: pixelH,
        scale,
      };
    }

    drawWorldTileLayerCache(work, layout = {}, clipFrame = null) {
      const cacheStore = this.getWorldMapLayerCacheStore();
      if (cacheStore?.drawLayerCache) {
        return cacheStore.drawLayerCache(this.ctx, work, layout, clipFrame);
      }
      if (!work?.canvas || !layout?.frame || typeof this.ctx?.drawImage !== 'function') return false;
      const drawX = Number(layout.drawX) || 0;
      const drawY = Number(layout.drawY) || 0;
      const frameWidth = Math.max(1, Number(layout.frame.width) || 1);
      const frameHeight = Math.max(1, Number(layout.frame.height) || 1);
      const clip = clipFrame || { x: drawX, y: drawY, width: frameWidth, height: frameHeight };
      const clipX = Number(clip.x) || 0;
      const clipY = Number(clip.y) || 0;
      const clipWidth = Math.max(0, Number(clip.width) || 0);
      const clipHeight = Math.max(0, Number(clip.height) || 0);
      const visibleX = Math.max(drawX, clipX);
      const visibleY = Math.max(drawY, clipY);
      const visibleRight = Math.min(drawX + frameWidth, clipX + clipWidth);
      const visibleBottom = Math.min(drawY + frameHeight, clipY + clipHeight);
      const visibleWidth = Math.max(0, visibleRight - visibleX);
      const visibleHeight = Math.max(0, visibleBottom - visibleY);
      if (visibleWidth <= 0 || visibleHeight <= 0) return true;
      const scale = Math.max(1, Number(work.scale) || 1);
      const sourceX = Math.max(0, (visibleX - drawX) * scale);
      const sourceY = Math.max(0, (visibleY - drawY) * scale);
      const sourceWidth = Math.min(
        Math.max(1, visibleWidth * scale),
        Math.max(1, (Number(work.canvas.width) || sourceX + visibleWidth * scale) - sourceX),
      );
      const sourceHeight = Math.min(
        Math.max(1, visibleHeight * scale),
        Math.max(1, (Number(work.canvas.height) || sourceY + visibleHeight * scale) - sourceY),
      );
      this.ctx.drawImage(
        work.canvas,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        visibleX,
        visibleY,
        sourceWidth / scale,
        sourceHeight / scale,
      );
      return true;
    }

    resolveWorldTileStaticCacheLayout(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      const geometry = tileMapView.geometry || {};
      const cacheScale = this.getWorldTileStaticCacheScale();
      const pixelBudget = this.getWorldTileStaticCachePixelBudget();
      const worldLayout = this.getWorldTileStaticCacheLayout(tileMapView, viewport, geometry);
      const chunkLayouts = this.getWorldTileStaticChunkLayouts(tileMapView, viewport, frame, geometry);
      const viewportLayout = this.getWorldTileStaticViewportCacheLayout(tileMapView, viewport, frame, entries);
      const cachePolicy = this.getWorldMapCachePolicy();
      if (cachePolicy?.resolveWorldTileStaticCacheLayout) {
        return cachePolicy.resolveWorldTileStaticCacheLayout({
          worldLayout,
          chunkLayouts,
          viewportLayout,
          cacheScale,
          pixelBudget,
          fastDragActive: this.worldTileFastDragActive,
        });
      }
      if (!worldLayout) return null;
      const worldPixels = worldLayout.frame.width * worldLayout.frame.height * cacheScale * cacheScale;
      if (worldPixels <= pixelBudget) return worldLayout;
      if (chunkLayouts.length) return { kind: 'chunks', layouts: chunkLayouts };
      if (this.worldTileFastDragActive) return null;
      if (!viewportLayout) return null;
      const viewportPixels = viewportLayout.frame.width * viewportLayout.frame.height * cacheScale * cacheScale;
      return viewportPixels <= pixelBudget ? viewportLayout : null;
    }

    getWorldTileScoutRouteCacheKey(tileMapView = {}, viewport = {}, frame = {}, options = {}) {
      const cachePolicy = this.getWorldMapCachePolicy();
      if (cachePolicy?.getWorldTileScoutRouteCacheKey) {
        return cachePolicy.getWorldTileScoutRouteCacheKey(tileMapView, viewport, frame, options);
      }
      const scale = Number(viewport.scale) || 1;
      const scoutSignature = (tileMapView.activeScouts || []).map((mission) => [
        mission.id || '',
        mission.status || '',
        (mission.route || []).map((step) => [
          step.tileId || '',
          step.q ?? '',
          step.r ?? '',
          step.step ?? '',
          step.revealed ? 1 : 0,
        ].join(',')).join('|'),
      ].join(':')).join(';');
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
        Math.round((Number(viewport.originX) || 0) * 10) / 10,
        Math.round((Number(viewport.originY) || 0) * 10) / 10,
        Math.round((Number(viewport.panX) || 0) * 10) / 10,
        Math.round((Number(viewport.panY) || 0) * 10) / 10,
        scoutSignature,
      ].join('::');
    }
  }

  global.WorldMapCacheFacade = WorldMapCacheFacade;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapCacheFacade;
})(typeof window !== 'undefined' ? window : globalThis);
