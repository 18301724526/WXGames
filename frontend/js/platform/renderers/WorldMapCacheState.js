(function (global) {
  function ensureMap(value = null) {
    return value instanceof Map ? value : new Map();
  }

  function createWorldMapCacheState(initial = {}) {
    return {
      worldTileFastDragActive: Boolean(initial.worldTileFastDragActive),
      worldTileStaticCache: initial.worldTileStaticCache || null,
      worldTileStaticCacheKey: initial.worldTileStaticCacheKey || '',
      worldTileStaticCacheLayoutKind: initial.worldTileStaticCacheLayoutKind || '',
      worldTileStaticCacheLayout: initial.worldTileStaticCacheLayout || null,
      worldTileStaticChunkCaches: ensureMap(initial.worldTileStaticChunkCaches),
      worldTileStaticChunkCacheTick: Number(initial.worldTileStaticChunkCacheTick) || 0,
      worldTileWaterLayerCache: initial.worldTileWaterLayerCache || null,
      worldTileWaterLayerCacheKey: initial.worldTileWaterLayerCacheKey || '',
      worldTileWaterFrameCaches: ensureMap(initial.worldTileWaterFrameCaches),
      worldTileWaterChunkCaches: ensureMap(initial.worldTileWaterChunkCaches),
      worldTileWaterChunkCacheTick: Number(initial.worldTileWaterChunkCacheTick) || 0,
      worldTileMaskCache: ensureMap(initial.worldTileMaskCache),
      worldTileMaskMetricsCache: ensureMap(initial.worldTileMaskMetricsCache),
      worldTileDryCompositeCache: ensureMap(initial.worldTileDryCompositeCache),
      worldTileFastDragComposite: initial.worldTileFastDragComposite || null,
      worldTileFastDragCompositeCache: initial.worldTileFastDragCompositeCache || null,
      worldTileCompositeCanvas: initial.worldTileCompositeCanvas || null,
      worldTileCompositeCtx: initial.worldTileCompositeCtx || null,
      worldTileWaterCanvas: initial.worldTileWaterCanvas || null,
      worldTileWaterCtx: initial.worldTileWaterCtx || null,
      worldTileViewCache: initial.worldTileViewCache || null,
      worldTileVisibleEntriesCache: initial.worldTileVisibleEntriesCache || null,
      worldTileLocalEntriesCache: initial.worldTileLocalEntriesCache || null,
      assetsChangedHandler: typeof initial.assetsChangedHandler === 'function'
        ? initial.assetsChangedHandler
        : null,
      worldTileCachePrewarmTask: initial.worldTileCachePrewarmTask || null,
    };
  }

  const api = {
    createWorldMapCacheState,
  };

  global.WorldMapCacheState = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
