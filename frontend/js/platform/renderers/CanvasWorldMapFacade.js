(function (global) {
  const WORLD_MAP_FACADE_METHODS = Object.freeze({
    getWorldTileScreenCenter(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileScreenCenter === 'function'
          ? renderer.getWorldTileScreenCenter(...args)
          : undefined;
      return result === undefined ? { x: 0, y: 0 } : result;
    },

    getWorldTileDrawRect(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileDrawRect === 'function'
          ? renderer.getWorldTileDrawRect(...args)
          : undefined;
      return result === undefined ? { x: 0, y: 0, width: 0, height: 0 } : result;
    },

    drawIsoDiamond(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.drawIsoDiamond === 'function'
          ? renderer.drawIsoDiamond(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    getFallbackTerrainFill(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getFallbackTerrainFill === 'function'
          ? renderer.getFallbackTerrainFill(...args)
          : undefined;
      return result === undefined ? 'rgba(90, 122, 70, 0.9)' : result;
    },

    hashString(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.hashString === 'function' ? renderer.hashString(...args) : undefined;
      return result === undefined ? 0 : result;
    },

    random01(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.random01 === 'function' ? renderer.random01(...args) : undefined;
      return result === undefined ? 0 : result;
    },

    getWorldOverlayAnchor(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldOverlayAnchor === 'function'
          ? renderer.getWorldOverlayAnchor(...args)
          : undefined;
      return result === undefined ? { x: 0, y: 0 } : result;
    },

    getWorldTileImageAspect(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileImageAspect === 'function'
          ? renderer.getWorldTileImageAspect(...args)
          : undefined;
      return result === undefined ? 1 : result;
    },

    drawWorldOverlayShadow(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.drawWorldOverlayShadow === 'function'
          ? renderer.drawWorldOverlayShadow(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    drawWorldOverlayAsset(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.drawWorldOverlayAsset === 'function'
          ? renderer.drawWorldOverlayAsset(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    drawWorldTerrainFeature(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.drawWorldTerrainFeature === 'function'
          ? renderer.drawWorldTerrainFeature(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    drawWorldTileFeature(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.drawWorldTileFeature === 'function'
          ? renderer.drawWorldTileFeature(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    getWorldTileSiteLayout(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileSiteLayout === 'function'
          ? renderer.getWorldTileSiteLayout(...args)
          : undefined;
      return result === undefined ? null : result;
    },

    drawWorldTileSite(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.drawWorldTileSite === 'function'
          ? renderer.drawWorldTileSite(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    getWorldTileRenderEntries(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileRenderEntries === 'function'
          ? renderer.getWorldTileRenderEntries(...args)
          : undefined;
      return result === undefined ? [] : result;
    },

    getWorldTileLocalEntries(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileLocalEntries === 'function'
          ? renderer.getWorldTileLocalEntries(...args)
          : undefined;
      return result === undefined ? [] : result;
    },

    getWorldTileKey(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileKey === 'function'
          ? renderer.getWorldTileKey(...args)
          : undefined;
      return result === undefined ? '' : result;
    },

    getWorldTileRenderedDiamondCenter(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileRenderedDiamondCenter === 'function'
          ? renderer.getWorldTileRenderedDiamondCenter(...args)
          : undefined;
      return result === undefined ? { x: 0, y: 0 } : result;
    },

    getWorldTileStaticCacheLayout(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileStaticCacheLayout === 'function'
          ? renderer.getWorldTileStaticCacheLayout(...args)
          : undefined;
      return result === undefined ? null : result;
    },

    getWorldTileStaticViewportCacheLayout(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileStaticViewportCacheLayout === 'function'
          ? renderer.getWorldTileStaticViewportCacheLayout(...args)
          : undefined;
      return result === undefined ? null : result;
    },

    getWorldTileStaticChunkSize(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileStaticChunkSize === 'function'
          ? renderer.getWorldTileStaticChunkSize(...args)
          : undefined;
      return result === undefined ? 512 : result;
    },

    getWorldTileStaticChunkCacheLimit(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileStaticChunkCacheLimit === 'function'
          ? renderer.getWorldTileStaticChunkCacheLimit(...args)
          : undefined;
      return result === undefined ? 12 : result;
    },

    getWorldTileStaticChunkCacheScale(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileStaticChunkCacheScale === 'function'
          ? renderer.getWorldTileStaticChunkCacheScale(...args)
          : undefined;
      return result === undefined ? 1 : result;
    },

    getWorldTileAtlasFramePadding(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileAtlasFramePadding === 'function'
          ? renderer.getWorldTileAtlasFramePadding(...args)
          : undefined;
      return result === undefined ? 0 : result;
    },

    getWorldTileStaticChunkLayouts(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileStaticChunkLayouts === 'function'
          ? renderer.getWorldTileStaticChunkLayouts(...args)
          : undefined;
      return result === undefined ? [] : result;
    },

    getWorldTileDragCachePanRange(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileDragCachePanRange === 'function'
          ? renderer.getWorldTileDragCachePanRange(...args)
          : undefined;
      return result === undefined ? 0 : result;
    },

    getWorldTileStaticDragCacheLayout(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileStaticDragCacheLayout === 'function'
          ? renderer.getWorldTileStaticDragCacheLayout(...args)
          : undefined;
      return result === undefined ? null : result;
    },

    getWorldTileStaticCacheKey(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileStaticCacheKey === 'function'
          ? renderer.getWorldTileStaticCacheKey(...args)
          : undefined;
      return result === undefined ? '' : result;
    },

    getWorldTileStaticCacheScale(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileStaticCacheScale === 'function'
          ? renderer.getWorldTileStaticCacheScale(...args)
          : undefined;
      return result === undefined ? 1 : result;
    },

    getWorldTileStaticCachePixelBudget(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileStaticCachePixelBudget === 'function'
          ? renderer.getWorldTileStaticCachePixelBudget(...args)
          : undefined;
      return result === undefined ? 0 : result;
    },

    getWorldTileLayerCacheContext(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileLayerCacheContext === 'function'
          ? renderer.getWorldTileLayerCacheContext(...args)
          : undefined;
      return result === undefined ? null : result;
    },

    getWorldTileStaticCacheContext(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileStaticCacheContext === 'function'
          ? renderer.getWorldTileStaticCacheContext(...args)
          : undefined;
      return result === undefined ? null : result;
    },

    getWorldTileWaterLayerCacheContext(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileWaterLayerCacheContext === 'function'
          ? renderer.getWorldTileWaterLayerCacheContext(...args)
          : undefined;
      return result === undefined ? null : result;
    },

    createWorldTileLayerWork(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.createWorldTileLayerWork === 'function'
          ? renderer.createWorldTileLayerWork(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    drawWorldTileLayerCache(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.drawWorldTileLayerCache === 'function'
          ? renderer.drawWorldTileLayerCache(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    getWorldTileFastDragCompositeSignature(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileFastDragCompositeSignature === 'function'
          ? renderer.getWorldTileFastDragCompositeSignature(...args)
          : undefined;
      return result === undefined ? '' : result;
    },

    renderWorldTileFastDragComposite(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileFastDragComposite === 'function'
          ? renderer.renderWorldTileFastDragComposite(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    updateWorldTileFastDragComposite(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.updateWorldTileFastDragComposite === 'function'
          ? renderer.updateWorldTileFastDragComposite(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    resolveWorldTileStaticCacheLayout(...args) {
      const renderer = this.worldMapRenderer;
      return typeof renderer?.resolveWorldTileStaticCacheLayout === 'function'
        ? renderer.resolveWorldTileStaticCacheLayout(...args)
        : undefined;
    },

    getWorldTileStaticChunkCacheKey(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileStaticChunkCacheKey === 'function'
          ? renderer.getWorldTileStaticChunkCacheKey(...args)
          : undefined;
      return result === undefined ? '' : result;
    },

    pruneWorldTileStaticChunkCaches(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.pruneWorldTileStaticChunkCaches === 'function'
          ? renderer.pruneWorldTileStaticChunkCaches(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    renderWorldTileStaticChunk(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileStaticChunk === 'function'
          ? renderer.renderWorldTileStaticChunk(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    renderWorldTileStaticChunks(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileStaticChunks === 'function'
          ? renderer.renderWorldTileStaticChunks(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    getWorldTileWaterChunkCacheKey(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileWaterChunkCacheKey === 'function'
          ? renderer.getWorldTileWaterChunkCacheKey(...args)
          : undefined;
      return result === undefined ? '' : result;
    },

    pruneWorldTileWaterChunkCaches(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.pruneWorldTileWaterChunkCaches === 'function'
          ? renderer.pruneWorldTileWaterChunkCaches(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    getWorldTileWaterChunkFrameCacheId(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileWaterChunkFrameCacheId === 'function'
          ? renderer.getWorldTileWaterChunkFrameCacheId(...args)
          : undefined;
      return result === undefined ? '' : result;
    },

    renderWorldTileWaterChunk(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileWaterChunk === 'function'
          ? renderer.renderWorldTileWaterChunk(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    renderWorldTileWaterChunkFrames(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileWaterChunkFrames === 'function'
          ? renderer.renderWorldTileWaterChunkFrames(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    renderWorldTileWaterChunks(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileWaterChunks === 'function'
          ? renderer.renderWorldTileWaterChunks(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    renderWorldTileSnapshotChunkCacheMap(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileSnapshotChunkCacheMap === 'function'
          ? renderer.renderWorldTileSnapshotChunkCacheMap(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    getWorldTileSnapshotDrawLayout(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileSnapshotDrawLayout === 'function'
          ? renderer.getWorldTileSnapshotDrawLayout(...args)
          : undefined;
      return result === undefined ? null : result;
    },

    renderWorldTileSnapshotLayerCache(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileSnapshotLayerCache === 'function'
          ? renderer.renderWorldTileSnapshotLayerCache(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    renderWorldTileSnapshotCache(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileSnapshotCache === 'function'
          ? renderer.renderWorldTileSnapshotCache(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    renderWorldTileStaticLayer(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileStaticLayer === 'function'
          ? renderer.renderWorldTileStaticLayer(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    getWorldTileWaterAnimationFps(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileWaterAnimationFps === 'function'
          ? renderer.getWorldTileWaterAnimationFps(...args)
          : undefined;
      return result === undefined ? 8 : result;
    },

    getWorldTileWaterAnimationFrameCount(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileWaterAnimationFrameCount === 'function'
          ? renderer.getWorldTileWaterAnimationFrameCount(...args)
          : undefined;
      return result === undefined ? 1 : result;
    },

    getWorldTileWaterAnimationFrameMs(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileWaterAnimationFrameMs === 'function'
          ? renderer.getWorldTileWaterAnimationFrameMs(...args)
          : undefined;
      return result === undefined ? 125 : result;
    },

    getWorldTileWaterTimeMs(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileWaterTimeMs === 'function'
          ? renderer.getWorldTileWaterTimeMs(...args)
          : undefined;
      return result === undefined ? 0 : result;
    },

    getWorldTileWaterAnimationFrame(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileWaterAnimationFrame === 'function'
          ? renderer.getWorldTileWaterAnimationFrame(...args)
          : undefined;
      return result === undefined ? 0 : result;
    },

    getWorldTileWaterAnimationFrameIndex(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileWaterAnimationFrameIndex === 'function'
          ? renderer.getWorldTileWaterAnimationFrameIndex(...args)
          : undefined;
      return result === undefined ? 0 : result;
    },

    getWorldTileWaterFrameTimeMs(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileWaterFrameTimeMs === 'function'
          ? renderer.getWorldTileWaterFrameTimeMs(...args)
          : undefined;
      return result === undefined ? 0 : result;
    },

    getWorldTileWaterLayerCacheKey(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileWaterLayerCacheKey === 'function'
          ? renderer.getWorldTileWaterLayerCacheKey(...args)
          : undefined;
      return result === undefined ? '' : result;
    },

    resolveWorldTileWaterLayerCacheLayout(...args) {
      const renderer = this.worldMapRenderer;
      return typeof renderer?.resolveWorldTileWaterLayerCacheLayout === 'function'
        ? renderer.resolveWorldTileWaterLayerCacheLayout(...args)
        : undefined;
    },

    renderWorldTileWaterFrameCache(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileWaterFrameCache === 'function'
          ? renderer.renderWorldTileWaterFrameCache(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    getWorldTileWaterFrameCache(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileWaterFrameCache === 'function'
          ? renderer.getWorldTileWaterFrameCache(...args)
          : undefined;
      return result === undefined ? null : result;
    },

    renderWorldTileWaterFrameCaches(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileWaterFrameCaches === 'function'
          ? renderer.renderWorldTileWaterFrameCaches(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    renderWorldTileWaterLayer(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileWaterLayer === 'function'
          ? renderer.renderWorldTileWaterLayer(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    renderWorldTileStaticEntries(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileStaticEntries === 'function'
          ? renderer.renderWorldTileStaticEntries(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    renderWorldTileWaterEntries(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileWaterEntries === 'function'
          ? renderer.renderWorldTileWaterEntries(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    addWorldMapDragHitTarget(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.addWorldMapDragHitTarget === 'function'
          ? renderer.addWorldMapDragHitTarget(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    addWorldMarchTileHitTargets(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.addWorldMarchTileHitTargets === 'function'
          ? renderer.addWorldMarchTileHitTargets(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    addWorldTileSiteHitTargets(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.addWorldTileSiteHitTargets === 'function'
          ? renderer.addWorldTileSiteHitTargets(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    renderWorldActors(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldActors === 'function'
          ? renderer.renderWorldActors(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    addWorldActorHitTargets(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.addWorldActorHitTargets === 'function'
          ? renderer.addWorldActorHitTargets(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    renderWorldMarchHud(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldMarchHud === 'function'
          ? renderer.renderWorldMarchHud(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    renderWorldMapActorLayer(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldMapActorLayer === 'function'
          ? renderer.renderWorldMapActorLayer(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    renderWorldScoutRoutes(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldScoutRoutes === 'function'
          ? renderer.renderWorldScoutRoutes(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    getNearestWorldTileAtPoint(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getNearestWorldTileAtPoint === 'function'
          ? renderer.getNearestWorldTileAtPoint(...args)
          : undefined;
      return result === undefined ? null : result;
    },

    renderWorldTileMap(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileMap === 'function'
          ? renderer.renderWorldTileMap(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    renderMilitaryWorldView(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderMilitaryWorldView === 'function'
          ? renderer.renderMilitaryWorldView(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    renderWorldSiteAction(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldSiteAction === 'function'
          ? renderer.renderWorldSiteAction(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    renderWorldExpeditionConfig(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldExpeditionConfig === 'function'
          ? renderer.renderWorldExpeditionConfig(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    renderWorldSiteModal(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldSiteModal === 'function'
          ? renderer.renderWorldSiteModal(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    getWorldCityCommandAnchor(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldCityCommandAnchor === 'function'
          ? renderer.getWorldCityCommandAnchor(...args)
          : undefined;
      return result === undefined ? null : result;
    },

    getWorldSiteCanvasAnchor(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldSiteCanvasAnchor === 'function'
          ? renderer.getWorldSiteCanvasAnchor(...args)
          : undefined;
      return result === undefined ? null : result;
    },

    getWorldCityCommandButtonAction(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldCityCommandButtonAction === 'function'
          ? renderer.getWorldCityCommandButtonAction(...args)
          : undefined;
      return result === undefined ? { type: 'territoryAction', disabled: true } : result;
    },

    drawWorldCityCommandPrimaryButton(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.drawWorldCityCommandPrimaryButton === 'function'
          ? renderer.drawWorldCityCommandPrimaryButton(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    drawWorldCityCommandSideButton(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.drawWorldCityCommandSideButton === 'function'
          ? renderer.drawWorldCityCommandSideButton(...args)
          : undefined;
      return result === undefined ? false : result;
    },

    renderWorldCityCommandOverlay(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldCityCommandOverlay === 'function'
          ? renderer.renderWorldCityCommandOverlay(...args)
          : undefined;
      return result === undefined ? false : result;
    },
  });

  function installWorldMapFacade(RendererClass) {
    const proto = RendererClass?.prototype;
    if (!proto) return RendererClass;
    Object.defineProperties(proto, {
      getWorldTileScreenCenter: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileScreenCenter,
      },
      getWorldTileDrawRect: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileDrawRect,
      },
      drawIsoDiamond: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.drawIsoDiamond,
      },
      getFallbackTerrainFill: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getFallbackTerrainFill,
      },
      hashString: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.hashString,
      },
      random01: { configurable: true, writable: true, value: WORLD_MAP_FACADE_METHODS.random01 },
      getWorldOverlayAnchor: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldOverlayAnchor,
      },
      getWorldTileImageAspect: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileImageAspect,
      },
      drawWorldOverlayShadow: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.drawWorldOverlayShadow,
      },
      drawWorldOverlayAsset: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.drawWorldOverlayAsset,
      },
      drawWorldTerrainFeature: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.drawWorldTerrainFeature,
      },
      drawWorldTileFeature: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.drawWorldTileFeature,
      },
      getWorldTileSiteLayout: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileSiteLayout,
      },
      drawWorldTileSite: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.drawWorldTileSite,
      },
      getWorldTileRenderEntries: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileRenderEntries,
      },
      getWorldTileLocalEntries: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileLocalEntries,
      },
      getWorldTileKey: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileKey,
      },
      getWorldTileRenderedDiamondCenter: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileRenderedDiamondCenter,
      },
      getWorldTileStaticCacheLayout: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileStaticCacheLayout,
      },
      getWorldTileStaticViewportCacheLayout: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileStaticViewportCacheLayout,
      },
      getWorldTileStaticChunkSize: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileStaticChunkSize,
      },
      getWorldTileStaticChunkCacheLimit: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileStaticChunkCacheLimit,
      },
      getWorldTileStaticChunkCacheScale: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileStaticChunkCacheScale,
      },
      getWorldTileAtlasFramePadding: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileAtlasFramePadding,
      },
      getWorldTileStaticChunkLayouts: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileStaticChunkLayouts,
      },
      getWorldTileDragCachePanRange: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileDragCachePanRange,
      },
      getWorldTileStaticDragCacheLayout: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileStaticDragCacheLayout,
      },
      getWorldTileStaticCacheKey: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileStaticCacheKey,
      },
      getWorldTileStaticCacheScale: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileStaticCacheScale,
      },
      getWorldTileStaticCachePixelBudget: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileStaticCachePixelBudget,
      },
      getWorldTileLayerCacheContext: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileLayerCacheContext,
      },
      getWorldTileStaticCacheContext: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileStaticCacheContext,
      },
      getWorldTileWaterLayerCacheContext: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileWaterLayerCacheContext,
      },
      createWorldTileLayerWork: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.createWorldTileLayerWork,
      },
      drawWorldTileLayerCache: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.drawWorldTileLayerCache,
      },
      getWorldTileFastDragCompositeSignature: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileFastDragCompositeSignature,
      },
      renderWorldTileFastDragComposite: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.renderWorldTileFastDragComposite,
      },
      updateWorldTileFastDragComposite: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.updateWorldTileFastDragComposite,
      },
      resolveWorldTileStaticCacheLayout: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.resolveWorldTileStaticCacheLayout,
      },
      getWorldTileStaticChunkCacheKey: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileStaticChunkCacheKey,
      },
      pruneWorldTileStaticChunkCaches: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.pruneWorldTileStaticChunkCaches,
      },
      renderWorldTileStaticChunk: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.renderWorldTileStaticChunk,
      },
      renderWorldTileStaticChunks: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.renderWorldTileStaticChunks,
      },
      getWorldTileWaterChunkCacheKey: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileWaterChunkCacheKey,
      },
      pruneWorldTileWaterChunkCaches: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.pruneWorldTileWaterChunkCaches,
      },
      getWorldTileWaterChunkFrameCacheId: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileWaterChunkFrameCacheId,
      },
      renderWorldTileWaterChunk: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.renderWorldTileWaterChunk,
      },
      renderWorldTileWaterChunkFrames: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.renderWorldTileWaterChunkFrames,
      },
      renderWorldTileWaterChunks: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.renderWorldTileWaterChunks,
      },
      renderWorldTileSnapshotChunkCacheMap: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.renderWorldTileSnapshotChunkCacheMap,
      },
      getWorldTileSnapshotDrawLayout: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileSnapshotDrawLayout,
      },
      renderWorldTileSnapshotLayerCache: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.renderWorldTileSnapshotLayerCache,
      },
      renderWorldTileSnapshotCache: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.renderWorldTileSnapshotCache,
      },
      renderWorldTileStaticLayer: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.renderWorldTileStaticLayer,
      },
      getWorldTileWaterAnimationFps: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileWaterAnimationFps,
      },
      getWorldTileWaterAnimationFrameCount: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileWaterAnimationFrameCount,
      },
      getWorldTileWaterAnimationFrameMs: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileWaterAnimationFrameMs,
      },
      getWorldTileWaterTimeMs: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileWaterTimeMs,
      },
      getWorldTileWaterAnimationFrame: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileWaterAnimationFrame,
      },
      getWorldTileWaterAnimationFrameIndex: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileWaterAnimationFrameIndex,
      },
      getWorldTileWaterFrameTimeMs: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileWaterFrameTimeMs,
      },
      getWorldTileWaterLayerCacheKey: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileWaterLayerCacheKey,
      },
      resolveWorldTileWaterLayerCacheLayout: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.resolveWorldTileWaterLayerCacheLayout,
      },
      renderWorldTileWaterFrameCache: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.renderWorldTileWaterFrameCache,
      },
      getWorldTileWaterFrameCache: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldTileWaterFrameCache,
      },
      renderWorldTileWaterFrameCaches: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.renderWorldTileWaterFrameCaches,
      },
      renderWorldTileWaterLayer: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.renderWorldTileWaterLayer,
      },
      renderWorldTileStaticEntries: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.renderWorldTileStaticEntries,
      },
      renderWorldTileWaterEntries: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.renderWorldTileWaterEntries,
      },
      addWorldMapDragHitTarget: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.addWorldMapDragHitTarget,
      },
      addWorldMarchTileHitTargets: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.addWorldMarchTileHitTargets,
      },
      addWorldTileSiteHitTargets: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.addWorldTileSiteHitTargets,
      },
      renderWorldActors: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.renderWorldActors,
      },
      addWorldActorHitTargets: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.addWorldActorHitTargets,
      },
      renderWorldMarchHud: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.renderWorldMarchHud,
      },
      renderWorldMapActorLayer: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.renderWorldMapActorLayer,
      },
      renderWorldScoutRoutes: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.renderWorldScoutRoutes,
      },
      getNearestWorldTileAtPoint: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getNearestWorldTileAtPoint,
      },
      renderWorldTileMap: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.renderWorldTileMap,
      },
      renderMilitaryWorldView: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.renderMilitaryWorldView,
      },
      renderWorldSiteAction: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.renderWorldSiteAction,
      },
      renderWorldExpeditionConfig: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.renderWorldExpeditionConfig,
      },
      renderWorldSiteModal: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.renderWorldSiteModal,
      },
      getWorldCityCommandAnchor: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldCityCommandAnchor,
      },
      getWorldSiteCanvasAnchor: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldSiteCanvasAnchor,
      },
      getWorldCityCommandButtonAction: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.getWorldCityCommandButtonAction,
      },
      drawWorldCityCommandPrimaryButton: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.drawWorldCityCommandPrimaryButton,
      },
      drawWorldCityCommandSideButton: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.drawWorldCityCommandSideButton,
      },
      renderWorldCityCommandOverlay: {
        configurable: true,
        writable: true,
        value: WORLD_MAP_FACADE_METHODS.renderWorldCityCommandOverlay,
      },
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
