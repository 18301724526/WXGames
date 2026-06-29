(function (global) {
  const SharedTileCoord = (() => {
    if (global.TileCoord) return global.TileCoord;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/foundation/TileCoord');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  function round(value, precision = 1) {
    const factor = Math.max(1, Number(precision) || 1);
    return Math.round((Number(value) || 0) * factor) / factor;
  }

  function normalizeTileCoord(tile = {}) {
    return SharedTileCoord.normalizeCoord(tile);
  }

  function getFramePixels(layout = {}, cacheScale = 1) {
    const frame = layout.frame || layout;
    const width = Math.max(0, Number(frame.width) || 0);
    const height = Math.max(0, Number(frame.height) || 0);
    const scale = Math.max(0.05, Number(cacheScale) || 1);
    return width * height * scale * scale;
  }

  function getEntrySignature(entries = [], options = {}) {
    const includeWater = Boolean(options.includeWater);
    const filteredEntries = includeWater
      ? entries.filter(({ tile }) => tile?.water?.kind && tile?.water?.asset)
      : entries;
    return filteredEntries.map(({ tile = {}, center = {}, drawRect = {} }) => {
      const coord = normalizeTileCoord(tile);
      const templateAssets = Array.isArray(tile.templateAssets) ? tile.templateAssets : [];
      const common = [
        coord.tileId,
        tile.terrain,
        tile.terrainAsset,
        templateAssets.map((asset) => `${asset.key}:${asset.asset}:${asset.waterKind || ''}`).join(','),
      ];
      if (includeWater) {
        common.push(
          tile.water?.kind || '',
          tile.water?.asset || '',
        );
      } else {
        common.push(
          tile.feature?.asset || '',
          tile.feature?.key || '',
          tile.site?.id || '',
          tile.site?.art || '',
          tile.site?.owner || '',
          tile.site?.name || tile.site?.title || '',
          tile.site?.scale || '',
          tile.site?.offset?.x || 0,
          tile.site?.offset?.y || 0,
        );
      }
      common.push(
        round(center.x, 10),
        round(center.y, 10),
        round(drawRect.x, 10),
        round(drawRect.y, 10),
      );
      return common.join('|');
    }).join(';');
  }

  function getWorldTileStaticCacheKey(tileMapView = {}, viewport = {}, frame = {}, entries = [], uiState = {}, options = {}) {
    const scale = Number(viewport.scale) || 1;
    return [
      options.kind || 'world',
      tileMapView.signature || '',
      tileMapView.version || '',
      tileMapView.seed || '',
      uiState.selectedSiteId || '',
      Math.round(frame.x),
      Math.round(frame.y),
      Math.round(frame.width),
      Math.round(frame.height),
      Math.round(scale * 1000),
      Math.round((Number(options.cacheScale) || 1) * 1000),
      getEntrySignature(entries, { includeWater: false }),
    ].join('::');
  }

  function getWorldTileStaticChunkCacheKey(tileMapView = {}, viewport = {}, layout = {}, uiState = {}, options = {}) {
    return getWorldTileStaticCacheKey(tileMapView, viewport, layout.frame, layout.entries, uiState, {
      ...options,
      kind: `chunk:${layout.chunkX},${layout.chunkY}`,
    });
  }

  function getWorldTileWaterLayerCacheKey(tileMapView = {}, viewport = {}, frame = {}, entries = [], options = {}) {
    const scale = Number(viewport.scale) || 1;
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
      options.frameIndex ?? 0,
      getEntrySignature(entries, { includeWater: true }),
    ].join('::');
  }

  function getWorldTileWaterChunkCacheKey(tileMapView = {}, viewport = {}, layout = {}, waterEntries = [], options = {}) {
    return getWorldTileWaterLayerCacheKey(tileMapView, viewport, layout.frame, waterEntries, {
      ...options,
      kind: `water-chunk:${layout.chunkX},${layout.chunkY}`,
    });
  }

  function getWorldTileWaterChunkFrameCacheId(layout = {}, frameIndex = 0) {
    return `${layout.chunkX},${layout.chunkY}:${frameIndex}`;
  }

  function getWorldTileSnapshotDrawLayout(cachedLayout = {}, viewport = {}) {
    if (!cachedLayout?.frame) return null;
    return {
      ...cachedLayout,
      drawX: (Number(viewport.originX) || 0) + (Number(viewport.panX) || 0) + (Number(cachedLayout.frame.x) || 0),
      drawY: (Number(viewport.originY) || 0) + (Number(viewport.panY) || 0) + (Number(cachedLayout.frame.y) || 0),
    };
  }

  function getWorldTileSnapshotChunkDrawLayout(work = {}, viewport = {}) {
    const chunkFrame = work?.frame;
    if (!work?.canvas || !chunkFrame) return null;
    return {
      kind: 'chunk',
      frame: chunkFrame,
      drawX: (Number(viewport.originX) || 0) + (Number(viewport.panX) || 0) + (Number(chunkFrame.x) || 0),
      drawY: (Number(viewport.originY) || 0) + (Number(viewport.panY) || 0) + (Number(chunkFrame.y) || 0),
    };
  }

  function intersectsFrame(layout = {}, frame = {}) {
    const layoutFrame = layout.frame || {};
    const drawX = Number(layout.drawX) || 0;
    const drawY = Number(layout.drawY) || 0;
    const drawRight = drawX + (Number(layoutFrame.width) || 0);
    const drawBottom = drawY + (Number(layoutFrame.height) || 0);
    const frameX = Number(frame.x) || 0;
    const frameY = Number(frame.y) || 0;
    const frameRight = frameX + (Number(frame.width) || 0);
    const frameBottom = frameY + (Number(frame.height) || 0);
    return !(drawX > frameRight || drawRight < frameX || drawY > frameBottom || drawBottom < frameY);
  }

  function resolveWorldTileStaticCacheLayout(input = {}) {
    const {
      worldLayout = null,
      chunkLayouts = [],
      viewportLayout = null,
      cacheScale = 1,
      pixelBudget = 16000000,
      fastDragActive = false,
    } = input;
    if (!worldLayout) return null;
    if (getFramePixels(worldLayout, cacheScale) <= pixelBudget) return worldLayout;
    if (Array.isArray(chunkLayouts) && chunkLayouts.length) return { kind: 'chunks', layouts: chunkLayouts };
    if (fastDragActive) return null;
    if (!viewportLayout) return null;
    return getFramePixels(viewportLayout, cacheScale) <= pixelBudget ? viewportLayout : null;
  }

  function getPrunableCacheKeys(cacheMap = null, activeKeys = new Set(), limit = 32) {
    const safeLimit = Math.max(1, Number(limit) || 32);
    if (!cacheMap?.size || cacheMap.size <= safeLimit) return [];
    const staleEntries = Array.from(cacheMap.entries())
      .filter(([key]) => !activeKeys.has(key))
      .sort((a, b) => (Number(a[1]?.lastUsedAt) || 0) - (Number(b[1]?.lastUsedAt) || 0));
    const keys = [];
    let projectedSize = cacheMap.size;
    while (projectedSize > safeLimit && staleEntries.length) {
      const [key] = staleEntries.shift();
      keys.push(key);
      projectedSize -= 1;
    }
    return keys;
  }

  const api = {
    round,
    getFramePixels,
    getEntrySignature,
    getWorldTileStaticCacheKey,
    getWorldTileStaticChunkCacheKey,
    getWorldTileWaterLayerCacheKey,
    getWorldTileWaterChunkCacheKey,
    getWorldTileWaterChunkFrameCacheId,
    getWorldTileSnapshotDrawLayout,
    getWorldTileSnapshotChunkDrawLayout,
    intersectsFrame,
    resolveWorldTileStaticCacheLayout,
    getPrunableCacheKeys,
  };

  global.WorldMapCachePolicy = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
