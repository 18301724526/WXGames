(function (global) {
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

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizeTileCoord(tile = {}) {
    const helper = getTileMapGeometry();
    if (helper?.normalizeCoord) return helper.normalizeCoord(tile);
    const q = Math.floor(toNumber(tile.x !== undefined ? tile.x : tile.q, 0));
    const r = Math.floor(toNumber(tile.y !== undefined ? tile.y : tile.r, 0));
    return {
      x: q,
      y: r,
      q,
      r,
      tileId: `tile_${q}_${r}`,
    };
  }

  function getTileMapGeometry(options = {}) {
    return options.tileMapGeometry || sharedTileMapGeometry || null;
  }

  function getTileMapAssetManifest(options = {}) {
    return options.tileMapAssetManifest || global.TileMapAssetManifest || {};
  }

  function getWorldTileScreenCenter(tile = {}, viewport = {}, geometry = {}, options = {}) {
    const helper = getTileMapGeometry(options);
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

  function getWorldTileDrawRect(center = {}, scale = 1, geometry = {}, options = {}) {
    const helper = getTileMapGeometry(options);
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

  function getWorldOverlayAnchor(tile = {}, viewport = {}, geometry = {}, targetKey = '', explicitOffset = null, centerOverride = null, options = {}) {
    const manifest = getTileMapAssetManifest(options);
    const center = centerOverride || getWorldTileScreenCenter(tile, viewport, geometry, options);
    const offset = explicitOffset || manifest.getOverlayOffset?.(targetKey) || { x: 0, y: 0 };
    const scale = Number(viewport.scale) || 1;
    return {
      x: center.x + (Number(offset.x) || 0) * scale,
      y: center.y + (Number(offset.y) || 0) * scale,
    };
  }

  function getWorldTileSiteLayout(tile = {}, viewport = {}, geometry = {}, tileWidth = 192, tileHeight = 96, center = null, options = {}) {
    const site = tile.site || null;
    if (!site?.id) return null;
    const metrics = site.art && typeof options.analyzeAssetAlphaBounds === 'function'
      ? options.analyzeAssetAlphaBounds(site.art)
      : null;
    const resolvedMetrics = metrics || {
      x: 0,
      y: 0,
      width: 96,
      height: 88,
      sourceWidth: 96,
      sourceHeight: 88,
      fallback: true,
    };
    const manifest = getTileMapAssetManifest(options);
    const targetKey = site.overlayKey || manifest.getSiteOverlayKey?.(site.type) || `site:${site.type || 'town'}`;
    const anchor = getWorldOverlayAnchor(tile, viewport, geometry, targetKey, site.offset, center, options);
    const drawW = tileWidth * (Number(site.scale) || 0.46);
    const drawH = drawW * (resolvedMetrics.height / Math.max(1, resolvedMetrics.width));
    const baseX = anchor.x;
    const baseY = anchor.y - tileHeight * 0.16;
    const drawX = baseX - drawW * 0.5;
    const drawY = baseY - drawH * 0.86;
    return {
      site,
      metrics: resolvedMetrics,
      baseX,
      baseY,
      drawX,
      drawY,
      drawW,
      drawH,
      hitRect: { x: drawX - 8, y: drawY - 8, width: drawW + 16, height: drawH + 26 },
    };
  }

  function hashSignatureParts(parts = []) {
    let hash = 2166136261;
    for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
      const text = String(parts[partIndex] ?? '');
      for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      hash ^= 31;
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function getWorldTileEntitySignature(tileMapView = {}) {
    const tiles = Array.isArray(tileMapView.tiles) ? tileMapView.tiles : [];
    const parts = [];
    for (let index = 0; index < tiles.length; index += 1) {
      const tile = tiles[index] || {};
      const coord = normalizeTileCoord(tile);
      parts.push(
        coord.tileId,
        tile.terrain || '',
        tile.terrainAsset || '',
        tile.water?.kind || '',
        tile.water?.asset || '',
        (Array.isArray(tile.templateAssets) ? tile.templateAssets : [])
          .map((asset = {}) => `${asset.key || ''}:${asset.asset || ''}:${asset.type || ''}`)
          .join(','),
        tile.siteId || '',
        tile.site?.id || '',
        tile.site?.art || '',
        tile.site?.owner || '',
        tile.site?.status || '',
        tile.site?.name || tile.site?.title || '',
        tile.site?.scale || '',
        tile.site?.offset?.x || 0,
        tile.site?.offset?.y || 0,
        tile.feature?.key || '',
        tile.feature?.asset || '',
        tile.feature?.scale || '',
        tile.feature?.offset?.x || 0,
        tile.feature?.offset?.y || 0,
        tile.visibility || '',
        tile.discovered === false ? 0 : 1,
        tile.visible === false ? 0 : 1,
      );
    }
    return `${tiles.length}:${hashSignatureParts(parts)}`;
  }

  function getWorldTileLocalEntriesCacheKey(tileMapView = {}, viewport = {}, geometry = {}) {
    const tiles = Array.isArray(tileMapView.tiles) ? tileMapView.tiles : [];
    const scale = Number(viewport.scale) || 1;
    return [
      tileMapView.signature || '',
      tileMapView.version || '',
      tileMapView.seed || '',
      tiles.length,
      getWorldTileEntitySignature(tileMapView),
      Math.round(scale * 1000),
      Number(geometry.tileWidth) || 192,
      Number(geometry.tileHeight) || 96,
      Number(geometry.stepX) || 96,
      Number(geometry.stepY) || 48,
      Number.isFinite(Number(geometry.anchorY)) ? Number(geometry.anchorY) : 0.5,
    ].join('::');
  }

  function getWorldTileLocalViewport(viewport = {}) {
    return {
      ...viewport,
      originX: 0,
      originY: 0,
      panX: 0,
      panY: 0,
    };
  }

  function getWorldTileLocalEntries(tileMapView = {}, viewport = {}, geometry = {}, options = {}) {
    const tiles = Array.isArray(tileMapView.tiles) ? tileMapView.tiles : [];
    const scale = Number(viewport.scale) || 1;
    const localViewport = getWorldTileLocalViewport(viewport);
    const entries = new Array(tiles.length);
    for (let index = 0; index < tiles.length; index += 1) {
      const tile = tiles[index];
      const center = getWorldTileScreenCenter(tile, localViewport, geometry, options);
      const drawRect = getWorldTileDrawRect(center, scale, geometry, options);
      entries[index] = { tile, center, drawRect, inView: true };
    }
    return entries;
  }

  function getWorldTileRenderEntriesCacheKey(tileMapView = {}, viewport = {}, frame = {}) {
    const tiles = Array.isArray(tileMapView.tiles) ? tileMapView.tiles : [];
    const scale = Number(viewport.scale) || 1;
    return [
      tileMapView.signature || '',
      tileMapView.version || '',
      tileMapView.seed || '',
      tiles.length,
      getWorldTileEntitySignature(tileMapView),
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
  }

  function getWorldTileRenderEntries(tileMapView = {}, viewport = {}, frame = {}, geometry = {}, options = {}) {
    const scale = Number(viewport.scale) || 1;
    const drawProbe = getWorldTileDrawRect({ x: 0, y: 0 }, scale, geometry, options);
    const tileDrawWidth = drawProbe.width;
    const tileDrawHeight = drawProbe.height;
    const offsetX = (Number(viewport.originX) || 0) + (Number(viewport.panX) || 0);
    const offsetY = (Number(viewport.originY) || 0) + (Number(viewport.panY) || 0);
    const localEntries = Array.isArray(options.localEntries)
      ? options.localEntries
      : getWorldTileLocalEntries(tileMapView, viewport, geometry, options);
    const entries = [];
    const frameX = Number(frame.x) || 0;
    const frameY = Number(frame.y) || 0;
    const frameRight = frameX + (Number(frame.width) || 0);
    const frameBottom = frameY + (Number(frame.height) || 0);
    for (let index = 0; index < localEntries.length; index += 1) {
      const entry = localEntries[index];
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
      const inView = drawRect.x < frameRight + tileDrawWidth
        && drawRect.x + drawRect.width > frameX - tileDrawWidth
        && drawRect.y < frameBottom + tileDrawHeight
        && drawRect.y + drawRect.height > frameY - tileDrawHeight;
      if (inView) entries.push({ tile: entry.tile, center, drawRect, inView });
    }
    return entries;
  }

  function getWorldTileAtlasFramePadding(geometry = {}, viewport = {}) {
    const scale = Number(viewport.scale) || 1;
    const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
    const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
    return Math.max(tileWidth * 1.2, tileHeight * 2.2, 96);
  }

  function getWorldTileStaticCacheLayout(tileMapView = {}, viewport = {}, geometry = {}, options = {}) {
    const entries = Array.isArray(options.entries)
      ? options.entries
      : getWorldTileLocalEntries(tileMapView, viewport, geometry, options);
    if (!entries.length) return null;
    const padding = Number.isFinite(Number(options.padding))
      ? Number(options.padding)
      : getWorldTileAtlasFramePadding(geometry, viewport);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let index = 0; index < entries.length; index += 1) {
      const drawRect = entries[index].drawRect || {};
      minX = Math.min(minX, drawRect.x);
      minY = Math.min(minY, drawRect.y);
      maxX = Math.max(maxX, drawRect.x + drawRect.width);
      maxY = Math.max(maxY, drawRect.y + drawRect.height);
    }
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    const frame = {
      x: Math.floor(minX),
      y: Math.floor(minY),
      width: Math.max(1, Math.ceil(maxX - minX)),
      height: Math.max(1, Math.ceil(maxY - minY)),
    };
    return {
      kind: 'world',
      frame,
      entries,
      renderViewport: getWorldTileLocalViewport(viewport),
      drawX: viewport.originX + (Number(viewport.panX) || 0) + frame.x,
      drawY: viewport.originY + (Number(viewport.panY) || 0) + frame.y,
    };
  }

  function getWorldTileStaticViewportCacheLayout(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
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

  function getIntersectingEntries(entries = [], frame = {}) {
    const result = [];
    const frameX = Number(frame.x) || 0;
    const frameY = Number(frame.y) || 0;
    const frameRight = frameX + (Number(frame.width) || 0);
    const frameBottom = frameY + (Number(frame.height) || 0);
    for (let index = 0; index < entries.length; index += 1) {
      const drawRect = entries[index].drawRect || {};
      if (
        drawRect.x < frameRight
        && drawRect.x + drawRect.width > frameX
        && drawRect.y < frameBottom
        && drawRect.y + drawRect.height > frameY
      ) {
        result.push(entries[index]);
      }
    }
    return result;
  }

  function getWorldTileStaticChunkLayouts(tileMapView = {}, viewport = {}, frame = {}, geometry = {}, options = {}) {
    const localEntries = Array.isArray(options.localEntries)
      ? options.localEntries
      : getWorldTileLocalEntries(tileMapView, viewport, geometry, options);
    if (!localEntries.length) return [];
    const cacheScale = Math.max(0.05, Number(options.cacheScale) || 1);
    const pixelBudget = Math.max(1, Number(options.pixelBudget) || 1024 * 1024);
    const atlasLayout = options.atlasLayout || getWorldTileStaticCacheLayout(tileMapView, viewport, geometry, {
      ...options,
      entries: localEntries,
    });
    if (!atlasLayout?.frame) return [];
    const padding = Number.isFinite(Number(options.padding))
      ? Number(options.padding)
      : getWorldTileAtlasFramePadding(geometry, viewport);
    const chunkBleed = Math.max(padding, 128);
    const originX = Number(viewport.originX) || 0;
    const originY = Number(viewport.originY) || 0;
    const panX = Number(viewport.panX) || 0;
    const panY = Number(viewport.panY) || 0;
    const maxBudgetChunkSize = Math.floor(Math.sqrt(pixelBudget) / cacheScale);
    const chunkSize = Math.max(256, Math.min(
      Number(options.chunkSize) || 1024,
      maxBudgetChunkSize || 1024,
    ));
    const localFrame = atlasLayout.frame;
    const minChunkX = Math.floor(localFrame.x / chunkSize);
    const maxChunkX = Math.floor((localFrame.x + localFrame.width - 1) / chunkSize);
    const minChunkY = Math.floor(localFrame.y / chunkSize);
    const maxChunkY = Math.floor((localFrame.y + localFrame.height - 1) / chunkSize);
    const localViewport = getWorldTileLocalViewport(viewport);
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
        const chunkEntries = getIntersectingEntries(localEntries, expandedChunkFrame);
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

  function getWorldTileStaticDragCacheLayout(tileMapView = {}, viewport = {}, frame = {}, geometry = {}, options = {}) {
    const localEntries = Array.isArray(options.localEntries)
      ? options.localEntries
      : getWorldTileLocalEntries(tileMapView, viewport, geometry, options);
    if (!localEntries.length) return null;
    const scale = Number(viewport.scale) || 1;
    const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
    const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
    const padding = Math.max(tileWidth * 1.2, tileHeight * 2.2, 96);
    const panRange = Math.max(0, Number(options.panRange) || 0);
    const originX = Number(viewport.originX) || 0;
    const originY = Number(viewport.originY) || 0;
    const localFrame = {
      x: Math.floor((Number(frame.x) || 0) - originX - panRange - padding),
      y: Math.floor((Number(frame.y) || 0) - originY - panRange - padding),
      width: Math.max(1, Math.ceil((Number(frame.width) || 1) + (panRange + padding) * 2)),
      height: Math.max(1, Math.ceil((Number(frame.height) || 1) + (panRange + padding) * 2)),
    };
    const entries = getIntersectingEntries(localEntries, localFrame);
    if (!entries.length) return null;
    return {
      kind: 'drag',
      frame: localFrame,
      entries,
      renderViewport: getWorldTileLocalViewport(viewport),
      drawX: viewport.originX + (Number(viewport.panX) || 0) + localFrame.x,
      drawY: viewport.originY + (Number(viewport.panY) || 0) + localFrame.y,
    };
  }

  const api = {
    getWorldTileScreenCenter,
    getWorldTileDrawRect,
    getWorldOverlayAnchor,
    getWorldTileSiteLayout,
    hashSignatureParts,
    getWorldTileEntitySignature,
    getWorldTileLocalEntriesCacheKey,
    getWorldTileRenderEntriesCacheKey,
    getWorldTileLocalViewport,
    getWorldTileLocalEntries,
    getWorldTileRenderEntries,
    getWorldTileAtlasFramePadding,
    getWorldTileStaticCacheLayout,
    getWorldTileStaticViewportCacheLayout,
    getWorldTileStaticChunkLayouts,
    getWorldTileStaticDragCacheLayout,
  };

  global.WorldMapLayoutModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
