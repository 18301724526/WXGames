(function (global) {
  const WORLD_MAP_FACADE_METHODS = Object.freeze([
    ['getWorldTileScreenCenter', { x: 0, y: 0 }],
    ['getWorldTileDrawRect', { x: 0, y: 0, width: 0, height: 0 }],
    ['drawIsoDiamond', false],
    ['getFallbackTerrainFill', 'rgba(90, 122, 70, 0.9)'],
    ['hashString', 0],
    ['random01', 0],
    ['getWorldOverlayAnchor', { x: 0, y: 0 }],
    ['getWorldTileImageAspect', 1],
    ['drawWorldOverlayShadow', false],
    ['drawWorldOverlayAsset', false],
    ['drawWorldTerrainFeature', false],
    ['drawWorldTileFeature', false],
    ['getWorldTileSiteLayout', null],
    ['drawWorldTileSite', false],
    ['getWorldTileRenderEntries', []],
    ['getWorldTileLocalEntries', []],
    ['getWorldTileKey', ''],
    ['getWorldTileRenderedDiamondCenter', { x: 0, y: 0 }],
    ['getWorldTileFogRevealEntries', []],
    ['getWorldTileStaticCacheLayout', null],
    ['getWorldTileStaticViewportCacheLayout', null],
    ['getWorldTileStaticChunkSize', 512],
    ['getWorldTileStaticChunkCacheLimit', 12],
    ['getWorldTileStaticChunkCacheScale', 1],
    ['getWorldTileAtlasFramePadding', 0],
    ['getWorldTileStaticChunkLayouts', []],
    ['getWorldTileDragCachePanRange', 0],
    ['getWorldTileStaticDragCacheLayout', null],
    ['getWorldTileStaticCacheKey', ''],
    ['renderWorldTileFogMask', false],
    ['getWorldTileStaticCacheScale', 1],
    ['getWorldTileStaticCachePixelBudget', 0],
    ['getWorldTileLayerCacheContext', null],
    ['getWorldTileStaticCacheContext', null],
    ['getWorldTileScoutRouteCacheContext', null],
    ['getWorldTileWaterLayerCacheContext', null],
    ['createWorldTileLayerWork', false],
    ['drawWorldTileLayerCache', false],
    ['getWorldTileFastDragCompositeSignature', ''],
    ['renderWorldTileFastDragComposite', false],
    ['updateWorldTileFastDragComposite', false],
    ['resolveWorldTileStaticCacheLayout', undefined],
    ['getWorldTileStaticChunkCacheKey', ''],
    ['pruneWorldTileStaticChunkCaches', false],
    ['renderWorldTileStaticChunk', false],
    ['renderWorldTileStaticChunks', false],
    ['getWorldTileWaterChunkCacheKey', ''],
    ['pruneWorldTileWaterChunkCaches', false],
    ['getWorldTileWaterChunkFrameCacheId', ''],
    ['renderWorldTileWaterChunk', false],
    ['renderWorldTileWaterChunkFrames', false],
    ['renderWorldTileWaterChunks', false],
    ['renderWorldTileSnapshotChunkCacheMap', false],
    ['getWorldTileSnapshotDrawLayout', null],
    ['renderWorldTileSnapshotLayerCache', false],
    ['renderWorldTileSnapshotCache', false],
    ['renderWorldTileStaticLayer', false],
    ['getWorldTileScoutRouteCacheKey', ''],
    ['renderWorldScoutRouteLayer', false],
    ['getWorldTileWaterAnimationFps', 8],
    ['getWorldTileWaterAnimationFrameCount', 1],
    ['getWorldTileWaterAnimationFrameMs', 125],
    ['getWorldTileWaterTimeMs', 0],
    ['getWorldTileWaterAnimationFrame', 0],
    ['getWorldTileWaterAnimationFrameIndex', 0],
    ['getWorldTileWaterFrameTimeMs', 0],
    ['getWorldTileWaterLayerCacheKey', ''],
    ['resolveWorldTileWaterLayerCacheLayout', undefined],
    ['renderWorldTileWaterFrameCache', false],
    ['getWorldTileWaterFrameCache', null],
    ['renderWorldTileWaterFrameCaches', false],
    ['renderWorldTileWaterLayer', false],
    ['renderWorldTileStaticEntries', false],
    ['renderWorldTileWaterEntries', false],
    ['addWorldMapDragHitTarget', false],
    ['addWorldMarchTileHitTargets', false],
    ['addWorldTileSiteHitTargets', false],
    ['renderWorldScoutRoutes', false],
    ['renderWorldTileMap', false],
    ['renderMilitaryWorldView', false],
    ['renderWorldSiteAction', false],
    ['renderWorldExpeditionConfig', false],
    ['renderWorldSiteModal', false],
    ['renderWorldCityCommandLegacyOverlay', false],
    ['getWorldCityCommandAnchor', null],
    ['getWorldSiteCanvasAnchor', null],
    ['getWorldCityCommandButtonAction', { type: 'territoryAction', disabled: true }],
    ['drawWorldCityCommandPrimaryButton', false],
    ['drawWorldCityCommandSideButton', false],
    ['renderWorldCityCommandOverlay', false],
  ]);

  function cloneFallback(fallback) {
    if (Array.isArray(fallback)) return fallback.slice();
    if (fallback && typeof fallback === 'object') return { ...fallback };
    return fallback;
  }

  function defineFacadeMethod(proto, method, fallback) {
    Object.defineProperty(proto, method, {
      configurable: true,
      writable: true,
      value: function (...args) {
        const result = this.delegateWorldMapRenderer(method, args);
        return result === undefined ? cloneFallback(fallback) : result;
      },
    });
  }

  function installWorldMapFacade(RendererClass) {
    const proto = RendererClass?.prototype;
    if (!proto) return RendererClass;
    Object.defineProperty(proto, 'delegateWorldMapRenderer', {
      configurable: true,
      writable: true,
      value(method, args = []) {
        const renderer = this.worldMapRenderer;
        if (!renderer || typeof renderer[method] !== 'function') return undefined;
        return renderer[method](...Array.from(args));
      },
    });
    WORLD_MAP_FACADE_METHODS.forEach(([method, fallback]) => {
      defineFacadeMethod(proto, method, fallback);
    });
    return RendererClass;
  }

  const api = {
    WORLD_MAP_FACADE_METHODS,
    installWorldMapFacade,
  };

  global.CanvasWorldMapFacade = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
