(function (global) {
  class WorldMapLayoutFacade {
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

    getWorldMapLayoutModel() {
      return this.host?.constructor?.getWorldMapLayoutModel?.() || null;
    }

    getTileMapGeometry() {
      return this.host?.constructor?.getTileMapGeometry?.() || null;
    }

    getTileMapAssetManifest() {
      return this.host?.constructor?.getTileMapAssetManifest?.() || {};
    }

    normalizeTileCoord(tile = {}) {
      const helper = this.getTileMapGeometry();
      if (helper?.normalizeCoord) return helper.normalizeCoord(tile);
      const toInteger = (value, fallback = 0) => {
        const number = Number(value);
        return Number.isFinite(number) ? Math.floor(number) : fallback;
      };
      const q = toInteger(tile.x !== undefined ? tile.x : tile.q, 0);
      const r = toInteger(tile.y !== undefined ? tile.y : tile.r, 0);
      return {
        x: q,
        y: r,
        q,
        r,
        tileId: `tile_${q}_${r}`,
      };
    }

    getWorldTileScreenCenter(tile = {}, viewport = {}, geometry = {}) {
      const layoutModel = this.getWorldMapLayoutModel();
      if (layoutModel?.getWorldTileScreenCenter) {
        return layoutModel.getWorldTileScreenCenter(tile, viewport, geometry, {
          tileMapGeometry: this.getTileMapGeometry(),
        });
      }
      const helper = this.getTileMapGeometry();
      if (helper?.getTileScreenCenter) return helper.getTileScreenCenter(tile, viewport, geometry);
      const stepX = Number(geometry.stepX) || 96;
      const stepY = Number(geometry.stepY) || 48;
      const q = Number(tile.q) || 0;
      const r = Number(tile.r) || 0;
      return {
        x: viewport.originX + viewport.panX + (q - r) * stepX * viewport.scale,
        y: viewport.originY + viewport.panY + (q + r) * stepY * viewport.scale,
      };
    }

    getWorldTileDrawRect(center = {}, scale = 1, geometry = {}) {
      const layoutModel = this.getWorldMapLayoutModel();
      if (layoutModel?.getWorldTileDrawRect) {
        return layoutModel.getWorldTileDrawRect(center, scale, geometry, {
          tileMapGeometry: this.getTileMapGeometry(),
        });
      }
      const helper = this.getTileMapGeometry();
      if (helper?.getTileDrawRect) return helper.getTileDrawRect(center, scale, geometry);
      const tileWidth = (Number(geometry.tileWidth) || 192) + 3;
      const tileHeight = (Number(geometry.tileHeight) || 96) + 1.5;
      const anchorY = Number.isFinite(Number(geometry.anchorY)) ? Number(geometry.anchorY) : 0.5;
      return {
        x: center.x - tileWidth * scale * 0.5,
        y: center.y - tileHeight * scale * anchorY,
        width: tileWidth * scale,
        height: tileHeight * scale,
      };
    }

    getWorldOverlayAnchor(tile = {}, viewport = {}, geometry = {}, targetKey = '', explicitOffset = null, centerOverride = null) {
      const layoutModel = this.getWorldMapLayoutModel();
      if (layoutModel?.getWorldOverlayAnchor) {
        return layoutModel.getWorldOverlayAnchor(tile, viewport, geometry, targetKey, explicitOffset, centerOverride, {
          tileMapGeometry: this.getTileMapGeometry(),
          tileMapAssetManifest: this.getTileMapAssetManifest(),
        });
      }
      const manifest = this.getTileMapAssetManifest();
      const center = centerOverride || this.getWorldTileScreenCenter(tile, viewport, geometry);
      const offset = explicitOffset || manifest.getOverlayOffset?.(targetKey) || { x: 0, y: 0 };
      const scale = Number(viewport.scale) || 1;
      return {
        x: center.x + (Number(offset.x) || 0) * scale,
        y: center.y + (Number(offset.y) || 0) * scale,
      };
    }

    getWorldTileSiteLayout(tile = {}, viewport = {}, geometry = {}, tileWidth = 192, tileHeight = 96, center = null) {
      const layoutModel = this.getWorldMapLayoutModel();
      if (layoutModel?.getWorldTileSiteLayout) {
        return layoutModel.getWorldTileSiteLayout(tile, viewport, geometry, tileWidth, tileHeight, center, {
          analyzeAssetAlphaBounds: (assetPath) => this.analyzeAssetAlphaBounds(assetPath),
          tileMapGeometry: this.getTileMapGeometry(),
          tileMapAssetManifest: this.getTileMapAssetManifest(),
        });
      }
      const site = tile.site || null;
      if (!site?.art) return null;
      const metrics = this.analyzeAssetAlphaBounds(site.art);
      if (!metrics) return null;
      const targetKey = site.overlayKey || this.getTileMapAssetManifest().getSiteOverlayKey?.(site.type) || `site:${site.type || 'town'}`;
      const anchor = this.getWorldOverlayAnchor(tile, viewport, geometry, targetKey, site.offset, center);
      const drawW = tileWidth * (Number(site.scale) || 0.46);
      const drawH = drawW * (metrics.height / Math.max(1, metrics.width));
      const baseX = anchor.x;
      const baseY = anchor.y - tileHeight * 0.16;
      const drawX = baseX - drawW * 0.5;
      const drawY = baseY - drawH * 0.86;
      return {
        site,
        metrics,
        baseX,
        baseY,
        drawX,
        drawY,
        drawW,
        drawH,
        hitRect: { x: drawX - 8, y: drawY - 8, width: drawW + 16, height: drawH + 26 },
      };
    }

    getWorldTileEntitySignature(tileMapView = {}) {
      const layoutModel = this.getWorldMapLayoutModel();
      if (layoutModel?.getWorldTileEntitySignature) {
        return layoutModel.getWorldTileEntitySignature(tileMapView);
      }
      const tiles = Array.isArray(tileMapView.tiles) ? tileMapView.tiles : [];
      let hash = 2166136261;
      const push = (value) => {
        const text = String(value ?? '');
        for (let index = 0; index < text.length; index += 1) {
          hash ^= text.charCodeAt(index);
          hash = Math.imul(hash, 16777619);
        }
        hash ^= 31;
        hash = Math.imul(hash, 16777619);
      };
      for (let index = 0; index < tiles.length; index += 1) {
        const tile = tiles[index] || {};
        const coord = this.normalizeTileCoord(tile);
        push(coord.tileId);
        push(tile.terrain || '');
        push(tile.terrainAsset || '');
        push(tile.water?.kind || '');
        push(tile.water?.asset || '');
        push((Array.isArray(tile.templateAssets) ? tile.templateAssets : [])
          .map((asset = {}) => `${asset.key || ''}:${asset.asset || ''}:${asset.type || ''}`)
          .join(','));
        push(tile.siteId || '');
        push(tile.site?.id || '');
        push(tile.site?.art || '');
        push(tile.site?.owner || '');
        push(tile.site?.status || '');
        push(tile.site?.name || tile.site?.title || '');
        push(tile.site?.scale || '');
        push(tile.site?.offset?.x || 0);
        push(tile.site?.offset?.y || 0);
        push(tile.feature?.key || '');
        push(tile.feature?.asset || '');
        push(tile.feature?.scale || '');
        push(tile.feature?.offset?.x || 0);
        push(tile.feature?.offset?.y || 0);
        push(tile.visibility || '');
        push(tile.discovered === false ? 0 : 1);
        push(tile.visible === false ? 0 : 1);
      }
      return `${tiles.length}:${(hash >>> 0).toString(36)}`;
    }

    getWorldTileRenderEntries(tileMapView = {}, viewport = {}, frame = {}, geometry = {}) {
      const layoutModel = this.getWorldMapLayoutModel();
      if (layoutModel?.getWorldTileRenderEntries && layoutModel?.getWorldTileRenderEntriesCacheKey) {
        const cacheKey = layoutModel.getWorldTileRenderEntriesCacheKey(tileMapView, viewport, frame);
        if (this.worldTileVisibleEntriesCache?.key === cacheKey) return this.worldTileVisibleEntriesCache.entries;
        const entries = layoutModel.getWorldTileRenderEntries(tileMapView, viewport, frame, geometry, {
          tileMapGeometry: this.getTileMapGeometry(),
          localEntries: this.getWorldTileLocalEntries(tileMapView, viewport, geometry),
        });
        this.worldTileVisibleEntriesCache = { key: cacheKey, entries };
        return entries;
      }
      const tiles = Array.isArray(tileMapView.tiles) ? tileMapView.tiles : [];
      const scale = Number(viewport.scale) || 1;
      const worldOrigin = this.normalizeTileCoord(viewport.worldOrigin || viewport.originCoord || viewport.renderOrigin || tileMapView.origin || tileMapView.worldOrigin || {});
      const cacheKey = [
        tileMapView.signature || '',
        tileMapView.version || '',
        tileMapView.seed || '',
        tiles.length,
        this.getWorldTileEntitySignature(tileMapView),
        worldOrigin.tileId,
        Math.round((Number(viewport.originX) || 0) * 10) / 10,
        Math.round((Number(viewport.originY) || 0) * 10) / 10,
        Math.round((Number(viewport.panX) || 0) * 10) / 10,
        Math.round((Number(viewport.panY) || 0) * 10) / 10,
        Math.round(scale * 1000),
        Math.round((Number(frame.x) || 0) * 10) / 10,
        Math.round((Number(frame.y) || 0) * 10) / 10,
        Math.round((Number(frame.width) || 0) * 10) / 10,
        Math.round((Number(frame.height) || 0) * 10) / 10,
      ].join('::');
      if (this.worldTileVisibleEntriesCache?.key === cacheKey) return this.worldTileVisibleEntriesCache.entries;
      const drawProbe = this.getWorldTileDrawRect({ x: 0, y: 0 }, scale, geometry);
      const tileDrawWidth = drawProbe.width;
      const tileDrawHeight = drawProbe.height;
      const offsetX = (Number(viewport.originX) || 0) + (Number(viewport.panX) || 0);
      const offsetY = (Number(viewport.originY) || 0) + (Number(viewport.panY) || 0);
      const localEntries = this.getWorldTileLocalEntries(tileMapView, viewport, geometry);
      const entries = localEntries.map((entry) => {
        const center = {
          x: entry.center.x + offsetX,
          y: entry.center.y + offsetY,
        };
        const drawRect = {
          x: entry.drawRect.x + offsetX,
          y: entry.drawRect.y + offsetY,
          width: entry.drawRect.width,
          height: entry.drawRect.height,
        };
        const inView = drawRect.x < frame.x + frame.width + tileDrawWidth
          && drawRect.x + drawRect.width > frame.x - tileDrawWidth
          && drawRect.y < frame.y + frame.height + tileDrawHeight
          && drawRect.y + drawRect.height > frame.y - tileDrawHeight;
        return { tile: entry.tile, center, drawRect, inView };
      }).filter((entry) => entry.inView);
      this.worldTileVisibleEntriesCache = { key: cacheKey, entries };
      return entries;
    }

    getWorldTileLocalEntries(tileMapView = {}, viewport = {}, geometry = {}) {
      const layoutModel = this.getWorldMapLayoutModel();
      if (layoutModel?.getWorldTileLocalEntries && layoutModel?.getWorldTileLocalEntriesCacheKey) {
        const cacheKey = layoutModel.getWorldTileLocalEntriesCacheKey(tileMapView, viewport, geometry);
        if (this.worldTileLocalEntriesCache?.key === cacheKey) return this.worldTileLocalEntriesCache.entries;
        const entries = layoutModel.getWorldTileLocalEntries(tileMapView, viewport, geometry, {
          tileMapGeometry: this.getTileMapGeometry(),
        });
        this.worldTileLocalEntriesCache = { key: cacheKey, entries };
        return entries;
      }
      const tiles = Array.isArray(tileMapView.tiles) ? tileMapView.tiles : [];
      const scale = Number(viewport.scale) || 1;
      const worldOrigin = this.normalizeTileCoord(viewport.worldOrigin || viewport.originCoord || viewport.renderOrigin || tileMapView.origin || tileMapView.worldOrigin || {});
      const cacheKey = [
        tileMapView.signature || '',
        tileMapView.version || '',
        tileMapView.seed || '',
        tiles.length,
        this.getWorldTileEntitySignature(tileMapView),
        worldOrigin.tileId,
        Math.round(scale * 1000),
        Number(geometry.tileWidth) || 192,
        Number(geometry.tileHeight) || 96,
        Number(geometry.stepX) || 96,
        Number(geometry.stepY) || 48,
        Number.isFinite(Number(geometry.anchorY)) ? Number(geometry.anchorY) : 0.5,
      ].join('::');
      if (this.worldTileLocalEntriesCache?.key === cacheKey) return this.worldTileLocalEntriesCache.entries;
      const localViewport = {
        ...viewport,
        worldOrigin: viewport.worldOrigin || viewport.originCoord || viewport.renderOrigin || tileMapView.origin || tileMapView.worldOrigin || undefined,
        originX: 0,
        originY: 0,
        panX: 0,
        panY: 0,
      };
      const entries = tiles.map((tile) => {
        const center = this.getWorldTileScreenCenter(tile, localViewport, geometry);
        const drawRect = this.getWorldTileDrawRect(center, scale, geometry);
        return { tile, center, drawRect, inView: true };
      });
      this.worldTileLocalEntriesCache = { key: cacheKey, entries };
      return entries;
    }

    getWorldTileRenderedDiamondCenter(tile = {}, drawRect = {}) {
      const baseTemplate = this.getWorldTileTemplateBaseAsset(tile);
      const assetPath = baseTemplate?.asset || tile.terrainAsset || '';
      const metrics = this.getWorldTileTemplateMetrics(baseTemplate || { asset: assetPath });
      const rectX = Number(drawRect.x) || 0;
      const rectY = Number(drawRect.y) || 0;
      const rectW = Number(drawRect.width) || 0;
      const rectH = Number(drawRect.height) || 0;
      if (metrics && rectW > 0 && rectH > 0) {
        return {
          x: rectX + rectW * 0.5,
          y: rectY + rectH * 0.5,
        };
      }
      return {
        x: rectX + rectW * 0.5,
        y: rectY + rectH * 0.5,
      };
    }

    getWorldTileStaticCacheLayout(tileMapView = {}, viewport = {}, geometry = {}) {
      const layoutModel = this.getWorldMapLayoutModel();
      if (layoutModel?.getWorldTileStaticCacheLayout) {
        return layoutModel.getWorldTileStaticCacheLayout(tileMapView, viewport, geometry, {
          tileMapGeometry: this.getTileMapGeometry(),
          entries: this.getWorldTileLocalEntries(tileMapView, viewport, geometry),
        });
      }
      const entries = this.getWorldTileLocalEntries(tileMapView, viewport, geometry);
      if (!entries.length) return null;
      const padding = this.getWorldTileAtlasFramePadding(geometry, viewport);
      const minX = Math.min(...entries.map((entry) => entry.drawRect.x)) - padding;
      const minY = Math.min(...entries.map((entry) => entry.drawRect.y)) - padding;
      const maxX = Math.max(...entries.map((entry) => entry.drawRect.x + entry.drawRect.width)) + padding;
      const maxY = Math.max(...entries.map((entry) => entry.drawRect.y + entry.drawRect.height)) + padding;
      const frame = {
        x: Math.floor(minX),
        y: Math.floor(minY),
        width: Math.max(1, Math.ceil(maxX - minX)),
        height: Math.max(1, Math.ceil(maxY - minY)),
      };
      const localViewport = {
        ...viewport,
        originX: 0,
        originY: 0,
        panX: 0,
        panY: 0,
      };
      return {
        kind: 'world',
        frame,
        entries,
        renderViewport: localViewport,
        drawX: viewport.originX + (Number(viewport.panX) || 0) + frame.x,
        drawY: viewport.originY + (Number(viewport.panY) || 0) + frame.y,
      };
    }

    getWorldTileStaticViewportCacheLayout(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      const layoutModel = this.getWorldMapLayoutModel();
      if (layoutModel?.getWorldTileStaticViewportCacheLayout) {
        return layoutModel.getWorldTileStaticViewportCacheLayout(tileMapView, viewport, frame, entries);
      }
      if (!entries.length) return null;
      const padding = 2;
      const localFrame = {
        x: Math.floor((Number(frame.x) || 0) - padding),
        y: Math.floor((Number(frame.y) || 0) - padding),
        width: Math.max(1, Math.ceil((Number(frame.width) || 1) + padding * 2)),
        height: Math.max(1, Math.ceil((Number(frame.height) || 1) + padding * 2)),
      };
      return {
        kind: 'viewport',
        frame: localFrame,
        entries,
        renderViewport: viewport,
        drawX: localFrame.x,
        drawY: localFrame.y,
      };
    }

    getWorldTileAtlasFramePadding(geometry = {}, viewport = {}) {
      const layoutModel = this.getWorldMapLayoutModel();
      if (layoutModel?.getWorldTileAtlasFramePadding) {
        return layoutModel.getWorldTileAtlasFramePadding(geometry, viewport);
      }
      const scale = Number(viewport.scale) || 1;
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      return Math.max(tileWidth * 1.2, tileHeight * 2.2, 96);
    }

    getWorldTileStaticChunkLayouts(tileMapView = {}, viewport = {}, frame = {}, geometry = {}) {
      const layoutModel = this.getWorldMapLayoutModel();
      if (layoutModel?.getWorldTileStaticChunkLayouts) {
        const localEntries = this.getWorldTileLocalEntries(tileMapView, viewport, geometry);
        return layoutModel.getWorldTileStaticChunkLayouts(tileMapView, viewport, frame, geometry, {
          tileMapGeometry: this.getTileMapGeometry(),
          localEntries,
          atlasLayout: this.getWorldTileStaticCacheLayout(tileMapView, viewport, geometry),
          padding: this.getWorldTileAtlasFramePadding(geometry, viewport),
          cacheScale: this.getWorldTileStaticChunkCacheScale(),
          pixelBudget: this.getWorldTileStaticCachePixelBudget(),
          chunkSize: this.getWorldTileStaticChunkSize(),
        });
      }
      const localEntries = this.getWorldTileLocalEntries(tileMapView, viewport, geometry);
      if (!localEntries.length) return [];
      const cacheScale = this.getWorldTileStaticChunkCacheScale();
      const pixelBudget = this.getWorldTileStaticCachePixelBudget();
      const atlasLayout = this.getWorldTileStaticCacheLayout(tileMapView, viewport, geometry);
      if (!atlasLayout?.frame) return [];
      const padding = this.getWorldTileAtlasFramePadding(geometry, viewport);
      const chunkBleed = Math.max(padding, 128);
      const originX = Number(viewport.originX) || 0;
      const originY = Number(viewport.originY) || 0;
      const panX = Number(viewport.panX) || 0;
      const panY = Number(viewport.panY) || 0;
      const maxBudgetChunkSize = Math.floor(Math.sqrt(Math.max(1, pixelBudget)) / Math.max(1, cacheScale));
      const chunkSize = Math.max(256, Math.min(
        Number(this.getWorldTileStaticChunkSize()) || 1024,
        maxBudgetChunkSize || 1024,
      ));
      const localFrame = atlasLayout.frame;
      const minChunkX = Math.floor(localFrame.x / chunkSize);
      const maxChunkX = Math.floor((localFrame.x + localFrame.width - 1) / chunkSize);
      const minChunkY = Math.floor(localFrame.y / chunkSize);
      const maxChunkY = Math.floor((localFrame.y + localFrame.height - 1) / chunkSize);
      const localViewport = {
        ...viewport,
        originX: 0,
        originY: 0,
        panX: 0,
        panY: 0,
      };
      const layouts = [];
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY += 1) {
        for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1) {
          const chunkFrame = {
            x: chunkX * chunkSize,
            y: chunkY * chunkSize,
            width: chunkSize,
            height: chunkSize,
          };
          const expandedChunkFrame = {
            x: chunkFrame.x - chunkBleed,
            y: chunkFrame.y - chunkBleed,
            width: chunkFrame.width + chunkBleed * 2,
            height: chunkFrame.height + chunkBleed * 2,
          };
          const chunkEntries = localEntries.filter((entry) => (
            entry.drawRect.x < expandedChunkFrame.x + expandedChunkFrame.width
            && entry.drawRect.x + entry.drawRect.width > expandedChunkFrame.x
            && entry.drawRect.y < expandedChunkFrame.y + expandedChunkFrame.height
            && entry.drawRect.y + entry.drawRect.height > expandedChunkFrame.y
          ));
          if (!chunkEntries.length) continue;
          layouts.push({
            kind: 'chunk',
            chunkX,
            chunkY,
            frame: chunkFrame,
            entries: chunkEntries,
            renderViewport: localViewport,
            drawX: originX + panX + chunkFrame.x,
            drawY: originY + panY + chunkFrame.y,
          });
        }
      }
      return layouts;
    }

    getWorldTileStaticDragCacheLayout(tileMapView = {}, viewport = {}, frame = {}, geometry = {}) {
      const layoutModel = this.getWorldMapLayoutModel();
      if (layoutModel?.getWorldTileStaticDragCacheLayout) {
        return layoutModel.getWorldTileStaticDragCacheLayout(tileMapView, viewport, frame, geometry, {
          tileMapGeometry: this.getTileMapGeometry(),
          localEntries: this.getWorldTileLocalEntries(tileMapView, viewport, geometry),
          panRange: this.getWorldTileDragCachePanRange(),
        });
      }
      const localEntries = this.getWorldTileLocalEntries(tileMapView, viewport, geometry);
      if (!localEntries.length) return null;
      const scale = Number(viewport.scale) || 1;
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      const padding = Math.max(tileWidth * 1.2, tileHeight * 2.2, 96);
      const panRange = Math.max(0, Number(this.getWorldTileDragCachePanRange()) || 0);
      const originX = Number(viewport.originX) || 0;
      const originY = Number(viewport.originY) || 0;
      const localFrame = {
        x: Math.floor((Number(frame.x) || 0) - originX - panRange - padding),
        y: Math.floor((Number(frame.y) || 0) - originY - panRange - padding),
        width: Math.max(1, Math.ceil((Number(frame.width) || 1) + (panRange + padding) * 2)),
        height: Math.max(1, Math.ceil((Number(frame.height) || 1) + (panRange + padding) * 2)),
      };
      const entries = localEntries.filter((entry) => (
        entry.drawRect.x < localFrame.x + localFrame.width
        && entry.drawRect.x + entry.drawRect.width > localFrame.x
        && entry.drawRect.y < localFrame.y + localFrame.height
        && entry.drawRect.y + entry.drawRect.height > localFrame.y
      ));
      if (!entries.length) return null;
      const localViewport = {
        ...viewport,
        originX: 0,
        originY: 0,
        panX: 0,
        panY: 0,
      };
      return {
        kind: 'drag',
        frame: localFrame,
        entries,
        renderViewport: localViewport,
        drawX: viewport.originX + (Number(viewport.panX) || 0) + localFrame.x,
        drawY: viewport.originY + (Number(viewport.panY) || 0) + localFrame.y,
      };
    }
  }

  global.WorldMapLayoutFacade = WorldMapLayoutFacade;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapLayoutFacade;
})(typeof window !== 'undefined' ? window : globalThis);
