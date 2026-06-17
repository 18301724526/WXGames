(function (global) {
  const sharedDependencyRegistry = (() => {
    if (global.WorldMapRendererDependencyRegistry) return global.WorldMapRendererDependencyRegistry;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldMapRendererDependencyRegistry');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const dependencyRegistry = sharedDependencyRegistry?.createRegistry
    ? sharedDependencyRegistry.createRegistry({ global })
    : null;

  function getRendererDependency(key, fallback = null) {
    if (!dependencyRegistry?.getOrFallback) return fallback;
    return dependencyRegistry.getOrFallback(key, fallback);
  }

  const sharedDependencies = Object.freeze({
    tileMapAssetManifest: getRendererDependency('tileMapAssetManifest'),
    tileMapGeometry: getRendererDependency('tileMapGeometry'),
    worldTime: getRendererDependency('worldTime'),
    unitSpriteManifest: getRendererDependency('unitSpriteManifest'),
    worldActorCanvasRenderer: getRendererDependency('worldActorCanvasRenderer'),
    worldMarchHudCanvasRenderer: getRendererDependency('worldMarchHudCanvasRenderer'),
    tutorialIntroUnitRenderer: getRendererDependency('tutorialIntroUnitRenderer'),
    worldMapRendererHostBridge: getRendererDependency('worldMapRendererHostBridge'),
    worldMapRendererCompositionFactory: getRendererDependency('worldMapRendererCompositionFactory'),
    worldMapLayoutModel: getRendererDependency('worldMapLayoutModel'),
    worldMapLayoutFacade: getRendererDependency('worldMapLayoutFacade'),
    worldMapRenderUtilityFacade: getRendererDependency('worldMapRenderUtilityFacade'),
    worldMapHitTargetModel: getRendererDependency('worldMapHitTargetModel'),
    worldMapHitTargetFacade: getRendererDependency('worldMapHitTargetFacade'),
    worldMapCachePolicy: getRendererDependency('worldMapCachePolicy'),
    worldMapLayerCacheStore: getRendererDependency('worldMapLayerCacheStore'),
    worldMapCacheFacade: getRendererDependency('worldMapCacheFacade'),
    worldMapCacheConfigFacade: getRendererDependency('worldMapCacheConfigFacade'),
    worldMapStaticLayerRenderer: getRendererDependency('worldMapStaticLayerRenderer'),
    worldMapStaticEntryRenderer: getRendererDependency('worldMapStaticEntryRenderer'),
    worldMapStaticChunkRenderer: getRendererDependency('worldMapStaticChunkRenderer'),
    worldMapWaterLayerRenderer: getRendererDependency('worldMapWaterLayerRenderer'),
    worldMapWaterEntryRenderer: getRendererDependency('worldMapWaterEntryRenderer'),
    worldMapSnapshotCacheRenderer: getRendererDependency('worldMapSnapshotCacheRenderer'),
    worldMapFastDragCompositeRenderer: getRendererDependency('worldMapFastDragCompositeRenderer'),
    worldMapScoutRenderer: getRendererDependency('worldMapScoutRenderer'),
    worldMapSiteOverlayRenderer: getRendererDependency('worldMapSiteOverlayRenderer'),
    worldMapMilitaryViewRenderer: getRendererDependency('worldMapMilitaryViewRenderer'),
    worldMapFogMaskContextRenderer: getRendererDependency('worldMapFogMaskContextRenderer'),
    worldMapTileMapRenderer: getRendererDependency('worldMapTileMapRenderer'),
    worldMapActorHudRenderer: getRendererDependency('worldMapActorHudRenderer'),
  });

  class WorldMapCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      const HostBridge = options.worldMapRendererHostBridgeClass || sharedDependencies.worldMapRendererHostBridge;
      const proxy = HostBridge?.createProxy ? HostBridge.createProxy(this) : this;
      const rendererHost = options.host || null;
      const CompositionFactory = options.worldMapRendererCompositionFactoryClass || sharedDependencies.worldMapRendererCompositionFactory;
      const composition = options.worldMapRendererComposition
        || (CompositionFactory?.create ? CompositionFactory.create({
          renderer: proxy,
          rendererHost,
          options,
          dependencies: sharedDependencies,
        }) : {});
      Object.assign(this, composition);
      return proxy;
    }

    static getTileMapAssetManifest() {
      return sharedDependencies.tileMapAssetManifest || {};
    }

    static getTileMapGeometry() {
      return sharedDependencies.tileMapGeometry || null;
    }

    static getWorldMapLayoutModel() {
      return sharedDependencies.worldMapLayoutModel || null;
    }

    static getWorldMapRendererCompositionFactory() {
      return sharedDependencies.worldMapRendererCompositionFactory || null;
    }

    static getWorldMapRendererHostBridge() {
      return sharedDependencies.worldMapRendererHostBridge || null;
    }

    static getWorldMapLayoutFacade() {
      return sharedDependencies.worldMapLayoutFacade || null;
    }

    static getWorldMapRenderUtilityFacade() {
      return sharedDependencies.worldMapRenderUtilityFacade || null;
    }

    static getWorldMapHitTargetModel() {
      return sharedDependencies.worldMapHitTargetModel || null;
    }

    static getWorldMapHitTargetFacade() {
      return sharedDependencies.worldMapHitTargetFacade || null;
    }

    static getWorldMapCachePolicy() {
      return sharedDependencies.worldMapCachePolicy || null;
    }

    static getWorldMapLayerCacheStore() {
      return sharedDependencies.worldMapLayerCacheStore || null;
    }

    static getWorldMapCacheFacade() {
      return sharedDependencies.worldMapCacheFacade || null;
    }

    static getWorldMapCacheConfigFacade() {
      return sharedDependencies.worldMapCacheConfigFacade || null;
    }

    static getWorldMapStaticLayerRenderer() {
      return sharedDependencies.worldMapStaticLayerRenderer || null;
    }

    static getWorldMapStaticEntryRenderer() {
      return sharedDependencies.worldMapStaticEntryRenderer || null;
    }

    static getWorldMapStaticChunkRenderer() {
      return sharedDependencies.worldMapStaticChunkRenderer || null;
    }

    static getWorldMapWaterLayerRenderer() {
      return sharedDependencies.worldMapWaterLayerRenderer || null;
    }

    static getWorldMapWaterEntryRenderer() {
      return sharedDependencies.worldMapWaterEntryRenderer || null;
    }

    static getWorldMapSnapshotCacheRenderer() {
      return sharedDependencies.worldMapSnapshotCacheRenderer || null;
    }

    static getWorldMapFastDragCompositeRenderer() {
      return sharedDependencies.worldMapFastDragCompositeRenderer || null;
    }

    static getWorldMapScoutRenderer() {
      return sharedDependencies.worldMapScoutRenderer || null;
    }

    static getWorldMapSiteOverlayRenderer() {
      return sharedDependencies.worldMapSiteOverlayRenderer || null;
    }

    static getWorldMapMilitaryViewRenderer() {
      return sharedDependencies.worldMapMilitaryViewRenderer || null;
    }

    static getWorldMapFogMaskContextRenderer() {
      return sharedDependencies.worldMapFogMaskContextRenderer || null;
    }

    static getWorldMapTileMapRenderer() {
      return sharedDependencies.worldMapTileMapRenderer || null;
    }

    static getWorldMapActorHudRenderer() {
      return sharedDependencies.worldMapActorHudRenderer || null;
    }

    static getUnitSpriteManifest() {
      return sharedDependencies.unitSpriteManifest || null;
    }

    static getWorldTime() {
      return sharedDependencies.worldTime || null;
    }

    static getTutorialIntroUnitRenderer() {
      return sharedDependencies.tutorialIntroUnitRenderer || null;
    }

    render(tileMapView = {}, x = 0, y = 0, width = 0, height = 0, uiState = {}, options = {}) {
      return this.renderWorldTileMap(tileMapView, x, y, width, height, uiState, options);
    }

    getWorldSiteDialogPresenter() {
      if (!this.worldMapSiteOverlayRenderer?.getWorldSiteDialogPresenter) return this.presenter || this.host?.presenter || null;
      return this.worldMapSiteOverlayRenderer.getWorldSiteDialogPresenter();
    }

    buildWorldSiteDialogViewState(territories = [], territoryState = {}, uiState = {}) {
      if (!this.worldMapSiteOverlayRenderer?.buildWorldSiteDialogViewState) {
        return this.buildFallbackWorldSiteDialogViewState(territories, territoryState, uiState);
      }
      return this.worldMapSiteOverlayRenderer.buildWorldSiteDialogViewState(territories, territoryState, uiState);
    }

    buildFallbackWorldSiteDialogViewState(territories = [], territoryState = {}, uiState = {}) {
      if (!this.worldMapSiteOverlayRenderer?.buildFallbackWorldSiteDialogViewState) {
        const selectedSiteId = uiState.selectedSiteId || '';
        const view = { selectedSiteId, showModal: false, details: [] };
        return { ...view, signature: JSON.stringify(view) };
      }
      return this.worldMapSiteOverlayRenderer.buildFallbackWorldSiteDialogViewState(territories, territoryState, uiState);
    }

    getWorldTileScreenCenter(tile = {}, viewport = {}, geometry = {}) {
      if (!this.worldMapLayoutFacade?.getWorldTileScreenCenter) return { x: 0, y: 0 };
      return this.worldMapLayoutFacade.getWorldTileScreenCenter(tile, viewport, geometry);
    }
    getWorldTileDrawRect(center = {}, scale = 1, geometry = {}) {
      if (!this.worldMapLayoutFacade?.getWorldTileDrawRect) return { x: 0, y: 0, width: 0, height: 0 };
      return this.worldMapLayoutFacade.getWorldTileDrawRect(center, scale, geometry);
    }
    drawIsoDiamond(cx, cy, width, height, options = {}) {
      if (!this.worldMapRenderUtilityFacade?.drawIsoDiamond) return false;
      return this.worldMapRenderUtilityFacade.drawIsoDiamond(cx, cy, width, height, options);
    }

    getFallbackTerrainFill(terrain = 'plains') {
      if (!this.worldMapRenderUtilityFacade?.getFallbackTerrainFill) return 'rgba(90, 122, 70, 0.9)';
      return this.worldMapRenderUtilityFacade.getFallbackTerrainFill(terrain);
    }

    hashString(input) {
      if (!this.worldMapRenderUtilityFacade?.hashString) return 0;
      return this.worldMapRenderUtilityFacade.hashString(input);
    }

    random01(seed, q, r, salt) {
      if (!this.worldMapRenderUtilityFacade?.random01) return 0;
      return this.worldMapRenderUtilityFacade.random01(seed, q, r, salt);
    }

    getWorldOverlayAnchor(tile = {}, viewport = {}, geometry = {}, targetKey = '', explicitOffset = null, centerOverride = null) {
      if (!this.worldMapLayoutFacade?.getWorldOverlayAnchor) return { x: 0, y: 0 };
      return this.worldMapLayoutFacade.getWorldOverlayAnchor(tile, viewport, geometry, targetKey, explicitOffset, centerOverride);
    }
    getWorldTileImageAspect(assetPath = '') {
      if (!this.worldMapStaticEntryRenderer?.getWorldTileImageAspect) return 1;
      return this.worldMapStaticEntryRenderer.getWorldTileImageAspect(assetPath);
    }

    drawWorldOverlayShadow(baseX, baseY, drawW, drawH, profile = {}) {
      if (!this.worldMapStaticEntryRenderer?.drawWorldOverlayShadow) return false;
      return this.worldMapStaticEntryRenderer.drawWorldOverlayShadow(baseX, baseY, drawW, drawH, profile);
    }

    drawWorldOverlayAsset(assetPath = '', metrics, x, y, width, height, alpha = 1) {
      if (!this.worldMapStaticEntryRenderer?.drawWorldOverlayAsset) return false;
      return this.worldMapStaticEntryRenderer.drawWorldOverlayAsset(assetPath, metrics, x, y, width, height, alpha);
    }

    drawWorldTerrainFeature(tile = {}, viewport = {}, geometry = {}, tileWidth = 192, tileHeight = 96) {
      if (!this.worldMapStaticEntryRenderer?.drawWorldTerrainFeature) return false;
      return this.worldMapStaticEntryRenderer.drawWorldTerrainFeature(tile, viewport, geometry, tileWidth, tileHeight);
    }

    drawWorldTileFeature(tile = {}, viewport = {}, geometry = {}, tileWidth = 192, tileHeight = 96) {
      if (!this.worldMapStaticEntryRenderer?.drawWorldTileFeature) return false;
      return this.worldMapStaticEntryRenderer.drawWorldTileFeature(tile, viewport, geometry, tileWidth, tileHeight);
    }

    getWorldTileSiteLayout(tile = {}, viewport = {}, geometry = {}, tileWidth = 192, tileHeight = 96, center = null) {
      if (!this.worldMapLayoutFacade?.getWorldTileSiteLayout) return null;
      return this.worldMapLayoutFacade.getWorldTileSiteLayout(tile, viewport, geometry, tileWidth, tileHeight, center);
    }
    drawWorldTileSite(tile = {}, viewport = {}, geometry = {}, tileWidth = 192, tileHeight = 96, uiState = {}, options = {}) {
      if (!this.worldMapStaticEntryRenderer?.drawWorldTileSite) return false;
      return this.worldMapStaticEntryRenderer.drawWorldTileSite(tile, viewport, geometry, tileWidth, tileHeight, uiState, options);
    }

    getWorldTileRenderEntries(tileMapView = {}, viewport = {}, frame = {}, geometry = {}) {
      if (!this.worldMapLayoutFacade?.getWorldTileRenderEntries) return [];
      return this.worldMapLayoutFacade.getWorldTileRenderEntries(tileMapView, viewport, frame, geometry);
    }
    getWorldTileLocalEntries(tileMapView = {}, viewport = {}, geometry = {}) {
      if (!this.worldMapLayoutFacade?.getWorldTileLocalEntries) return [];
      return this.worldMapLayoutFacade.getWorldTileLocalEntries(tileMapView, viewport, geometry);
    }
    getWorldTileRenderedDiamondCenter(tile = {}, drawRect = {}) {
      if (!this.worldMapLayoutFacade?.getWorldTileRenderedDiamondCenter) {
        return {
          x: (Number(drawRect.x) || 0) + (Number(drawRect.width) || 0) * 0.5,
          y: (Number(drawRect.y) || 0) + (Number(drawRect.height) || 0) * 0.5,
        };
      }
      return this.worldMapLayoutFacade.getWorldTileRenderedDiamondCenter(tile, drawRect);
    }
    getWorldTileStaticCacheLayout(tileMapView = {}, viewport = {}, geometry = {}) {
      if (!this.worldMapLayoutFacade?.getWorldTileStaticCacheLayout) return null;
      return this.worldMapLayoutFacade.getWorldTileStaticCacheLayout(tileMapView, viewport, geometry);
    }
    getWorldTileStaticViewportCacheLayout(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      if (!this.worldMapLayoutFacade?.getWorldTileStaticViewportCacheLayout) return null;
      return this.worldMapLayoutFacade.getWorldTileStaticViewportCacheLayout(tileMapView, viewport, frame, entries);
    }
    getWorldTileStaticChunkSize() {
      if (!this.worldMapCacheConfigFacade?.getWorldTileStaticChunkSize) return 1024;
      return this.worldMapCacheConfigFacade.getWorldTileStaticChunkSize();
    }

    getWorldTileStaticChunkCacheLimit() {
      if (!this.worldMapCacheConfigFacade?.getWorldTileStaticChunkCacheLimit) return 32;
      return this.worldMapCacheConfigFacade.getWorldTileStaticChunkCacheLimit();
    }

    getWorldTileStaticChunkCacheScale() {
      if (!this.worldMapCacheConfigFacade?.getWorldTileStaticChunkCacheScale) return 1;
      return this.worldMapCacheConfigFacade.getWorldTileStaticChunkCacheScale();
    }

    getWorldTileAtlasFramePadding(geometry = {}, viewport = {}) {
      if (!this.worldMapLayoutFacade?.getWorldTileAtlasFramePadding) return 0;
      return this.worldMapLayoutFacade.getWorldTileAtlasFramePadding(geometry, viewport);
    }
    getWorldTileStaticChunkLayouts(tileMapView = {}, viewport = {}, frame = {}, geometry = {}) {
      if (!this.worldMapLayoutFacade?.getWorldTileStaticChunkLayouts) return [];
      return this.worldMapLayoutFacade.getWorldTileStaticChunkLayouts(tileMapView, viewport, frame, geometry);
    }
    getWorldTileDragCachePanRange() {
      if (!this.worldMapCacheConfigFacade?.getWorldTileDragCachePanRange) return 180;
      return this.worldMapCacheConfigFacade.getWorldTileDragCachePanRange();
    }

    getWorldTileStaticDragCacheLayout(tileMapView = {}, viewport = {}, frame = {}, geometry = {}) {
      if (!this.worldMapLayoutFacade?.getWorldTileStaticDragCacheLayout) return null;
      return this.worldMapLayoutFacade.getWorldTileStaticDragCacheLayout(tileMapView, viewport, frame, geometry);
    }
    getWorldTileStaticCacheKey(tileMapView = {}, viewport = {}, frame = {}, entries = [], uiState = {}, options = {}) {
      if (!this.worldMapCacheFacade?.getWorldTileStaticCacheKey) return '';
      return this.worldMapCacheFacade.getWorldTileStaticCacheKey(tileMapView, viewport, frame, entries, uiState, options);
    }

    renderWorldTileFogMask(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      if (!this.worldMapFogMaskContextRenderer?.renderWorldTileFogMask) return false;
      return this.worldMapFogMaskContextRenderer.renderWorldTileFogMask(tileMapView, viewport, frame, entries);
    }

    getWorldTileStaticCacheScale() {
      if (!this.worldMapCacheConfigFacade?.getWorldTileStaticCacheScale) return Math.max(1, Number(this.pixelRatio) || 1);
      return this.worldMapCacheConfigFacade.getWorldTileStaticCacheScale();
    }

    getWorldTileStaticCachePixelBudget() {
      if (!this.worldMapCacheConfigFacade?.getWorldTileStaticCachePixelBudget) return 16000000;
      return this.worldMapCacheConfigFacade.getWorldTileStaticCachePixelBudget();
    }

    getWorldTileLayerCacheContext(cacheName, width, height, cacheScale = 1) {
      if (!this.worldMapCacheFacade?.getWorldTileLayerCacheContext) return null;
      return this.worldMapCacheFacade.getWorldTileLayerCacheContext(cacheName, width, height, cacheScale);
    }

    getWorldTileStaticCacheContext(width, height, cacheScale = 1) {
      return this.getWorldTileLayerCacheContext('worldTileStaticCache', width, height, cacheScale);
    }

    getWorldTileWaterLayerCacheContext(width, height, cacheScale = 1) {
      return this.getWorldTileLayerCacheContext('worldTileWaterLayerCache', width, height, cacheScale);
    }

    createWorldTileLayerWork(width, height, cacheScale = 1) {
      if (!this.worldMapCacheFacade?.createWorldTileLayerWork) return null;
      return this.worldMapCacheFacade.createWorldTileLayerWork(width, height, cacheScale);
    }

    drawWorldTileLayerCache(work, layout = {}, clipFrame = null) {
      if (!this.worldMapCacheFacade?.drawWorldTileLayerCache) return false;
      return this.worldMapCacheFacade.drawWorldTileLayerCache(work, layout, clipFrame);
    }

    getWorldTileFastDragCompositeSignature() {
      if (!this.worldMapFastDragCompositeRenderer?.getWorldTileFastDragCompositeSignature) return '';
      return this.worldMapFastDragCompositeRenderer.getWorldTileFastDragCompositeSignature();
    }

    renderWorldTileFastDragComposite(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      if (!this.worldMapFastDragCompositeRenderer?.renderWorldTileFastDragComposite) return false;
      return this.worldMapFastDragCompositeRenderer.renderWorldTileFastDragComposite(tileMapView, viewport, frame, entries);
    }

    updateWorldTileFastDragComposite(layout = null, frame = null) {
      if (!this.worldMapFastDragCompositeRenderer?.updateWorldTileFastDragComposite) return false;
      return this.worldMapFastDragCompositeRenderer.updateWorldTileFastDragComposite(layout, frame);
    }

    resolveWorldTileStaticCacheLayout(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      if (!this.worldMapCacheFacade?.resolveWorldTileStaticCacheLayout) return null;
      return this.worldMapCacheFacade.resolveWorldTileStaticCacheLayout(tileMapView, viewport, frame, entries);
    }

    getWorldTileStaticChunkCacheKey(tileMapView = {}, viewport = {}, layout = {}, uiState = {}, options = {}) {
      if (!this.worldMapStaticChunkRenderer?.getWorldTileStaticChunkCacheKey) return '';
      return this.worldMapStaticChunkRenderer.getWorldTileStaticChunkCacheKey(tileMapView, viewport, layout, uiState, options);
    }

    pruneWorldTileStaticChunkCaches(activeKeys = new Set()) {
      if (!this.worldMapStaticChunkRenderer?.pruneWorldTileStaticChunkCaches) return false;
      return this.worldMapStaticChunkRenderer.pruneWorldTileStaticChunkCaches(activeKeys);
    }

    renderWorldTileStaticChunk(tileMapView = {}, layout = {}, uiState = {}, cacheScale = 1) {
      if (!this.worldMapStaticChunkRenderer?.renderWorldTileStaticChunk) return false;
      return this.worldMapStaticChunkRenderer.renderWorldTileStaticChunk(tileMapView, layout, uiState, cacheScale);
    }

    renderWorldTileStaticChunks(tileMapView = {}, chunkLayouts = [], frame = {}, uiState = {}) {
      if (!this.worldMapStaticChunkRenderer?.renderWorldTileStaticChunks) return false;
      return this.worldMapStaticChunkRenderer.renderWorldTileStaticChunks(tileMapView, chunkLayouts, frame, uiState);
    }

    getWorldTileWaterChunkCacheKey(tileMapView = {}, viewport = {}, layout = {}, waterEntries = [], options = {}) {
      if (!this.worldMapWaterLayerRenderer?.getWorldTileWaterChunkCacheKey) return '';
      return this.worldMapWaterLayerRenderer.getWorldTileWaterChunkCacheKey(tileMapView, viewport, layout, waterEntries, options);
    }

    pruneWorldTileWaterChunkCaches(activeKeys = new Set()) {
      if (!this.worldMapWaterLayerRenderer?.pruneWorldTileWaterChunkCaches) return false;
      return this.worldMapWaterLayerRenderer.pruneWorldTileWaterChunkCaches(activeKeys);
    }

    getWorldTileWaterChunkFrameCacheId(layout = {}, frameIndex = 0) {
      if (!this.worldMapWaterLayerRenderer?.getWorldTileWaterChunkFrameCacheId) return '';
      return this.worldMapWaterLayerRenderer.getWorldTileWaterChunkFrameCacheId(layout, frameIndex);
    }

    renderWorldTileWaterChunk(tileMapView = {}, layout = {}, cacheScale = 1, frameIndex = this.getWorldTileWaterAnimationFrameIndex()) {
      if (!this.worldMapWaterLayerRenderer?.renderWorldTileWaterChunk) return false;
      return this.worldMapWaterLayerRenderer.renderWorldTileWaterChunk(tileMapView, layout, cacheScale, frameIndex);
    }

    renderWorldTileWaterChunkFrames(tileMapView = {}, layout = {}, cacheScale = 1) {
      if (!this.worldMapWaterLayerRenderer?.renderWorldTileWaterChunkFrames) return false;
      return this.worldMapWaterLayerRenderer.renderWorldTileWaterChunkFrames(tileMapView, layout, cacheScale);
    }

    renderWorldTileWaterChunks(tileMapView = {}, chunkLayouts = [], frame = {}) {
      if (!this.worldMapWaterLayerRenderer?.renderWorldTileWaterChunks) return false;
      return this.worldMapWaterLayerRenderer.renderWorldTileWaterChunks(tileMapView, chunkLayouts, frame);
    }

    renderWorldTileSnapshotChunkCacheMap(cacheMap = null, viewport = {}, frame = {}) {
      if (!this.worldMapSnapshotCacheRenderer?.renderWorldTileSnapshotChunkCacheMap) return false;
      return this.worldMapSnapshotCacheRenderer.renderWorldTileSnapshotChunkCacheMap(cacheMap, viewport, frame);
    }

    getWorldTileSnapshotDrawLayout(cachedLayout = {}, viewport = {}) {
      if (!this.worldMapSnapshotCacheRenderer?.getWorldTileSnapshotDrawLayout) return null;
      return this.worldMapSnapshotCacheRenderer.getWorldTileSnapshotDrawLayout(cachedLayout, viewport);
    }

    renderWorldTileSnapshotLayerCache(work = null, cachedLayout = null, viewport = {}, frame = {}) {
      if (!this.worldMapSnapshotCacheRenderer?.renderWorldTileSnapshotLayerCache) return false;
      return this.worldMapSnapshotCacheRenderer.renderWorldTileSnapshotLayerCache(work, cachedLayout, viewport, frame);
    }

    renderWorldTileSnapshotCache(tileMapView = {}, viewport = {}, frame = {}) {
      if (!this.worldMapSnapshotCacheRenderer?.renderWorldTileSnapshotCache) return false;
      return this.worldMapSnapshotCacheRenderer.renderWorldTileSnapshotCache(tileMapView, viewport, frame);
    }

    renderWorldTileStaticLayer(tileMapView = {}, viewport = {}, frame = {}, entries = [], uiState = {}) {
      if (!this.worldMapStaticLayerRenderer?.renderWorldTileStaticLayer) return false;
      return this.worldMapStaticLayerRenderer.renderWorldTileStaticLayer(tileMapView, viewport, frame, entries, uiState);
    }

    getWorldTileWaterAnimationFps() {
      if (!this.worldMapWaterLayerRenderer?.getWorldTileWaterAnimationFps) return 8;
      return this.worldMapWaterLayerRenderer.getWorldTileWaterAnimationFps();
    }

    getWorldTileWaterAnimationFrameCount() {
      if (!this.worldMapWaterLayerRenderer?.getWorldTileWaterAnimationFrameCount) return 8;
      return this.worldMapWaterLayerRenderer.getWorldTileWaterAnimationFrameCount();
    }

    getWorldTileWaterAnimationFrameMs() {
      if (!this.worldMapWaterLayerRenderer?.getWorldTileWaterAnimationFrameMs) return 125;
      return this.worldMapWaterLayerRenderer.getWorldTileWaterAnimationFrameMs();
    }

    getWorldTileWaterTimeMs() {
      if (!this.worldMapWaterLayerRenderer?.getWorldTileWaterTimeMs) return this.getNow();
      return this.worldMapWaterLayerRenderer.getWorldTileWaterTimeMs();
    }

    getWorldTileWaterAnimationFrame(timeMs = this.getWorldTileWaterTimeMs()) {
      if (!this.worldMapWaterLayerRenderer?.getWorldTileWaterAnimationFrame) return 0;
      return this.worldMapWaterLayerRenderer.getWorldTileWaterAnimationFrame(timeMs);
    }

    getWorldTileWaterAnimationFrameIndex(timeMs = this.getWorldTileWaterTimeMs()) {
      if (!this.worldMapWaterLayerRenderer?.getWorldTileWaterAnimationFrameIndex) return 0;
      return this.worldMapWaterLayerRenderer.getWorldTileWaterAnimationFrameIndex(timeMs);
    }

    getWorldTileWaterFrameTimeMs(frameIndex = 0) {
      if (!this.worldMapWaterLayerRenderer?.getWorldTileWaterFrameTimeMs) return 0;
      return this.worldMapWaterLayerRenderer.getWorldTileWaterFrameTimeMs(frameIndex);
    }

    getWorldTileWaterLayerCacheKey(tileMapView = {}, viewport = {}, frame = {}, entries = [], options = {}) {
      if (!this.worldMapWaterLayerRenderer?.getWorldTileWaterLayerCacheKey) return '';
      return this.worldMapWaterLayerRenderer.getWorldTileWaterLayerCacheKey(tileMapView, viewport, frame, entries, options);
    }

    resolveWorldTileWaterLayerCacheLayout(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      if (!this.worldMapWaterLayerRenderer?.resolveWorldTileWaterLayerCacheLayout) return undefined;
      return this.worldMapWaterLayerRenderer.resolveWorldTileWaterLayerCacheLayout(tileMapView, viewport, frame, entries);
    }

    renderWorldTileWaterFrameCache(tileMapView = {}, layout = {}, waterEntries = [], cacheScale = 1, frameIndex = 0, cacheMap = this.worldTileWaterFrameCaches, cacheId = frameIndex, kind = layout.kind || 'world') {
      if (!this.worldMapWaterLayerRenderer?.renderWorldTileWaterFrameCache) return null;
      return this.worldMapWaterLayerRenderer.renderWorldTileWaterFrameCache(tileMapView, layout, waterEntries, cacheScale, frameIndex, cacheMap, cacheId, kind);
    }

    getWorldTileWaterFrameCache(frameIndex = this.getWorldTileWaterAnimationFrameIndex()) {
      if (!this.worldMapWaterLayerRenderer?.getWorldTileWaterFrameCache) return null;
      return this.worldMapWaterLayerRenderer.getWorldTileWaterFrameCache(frameIndex);
    }

    renderWorldTileWaterFrameCaches(tileMapView = {}, layout = {}, waterEntries = [], cacheScale = 1) {
      if (!this.worldMapWaterLayerRenderer?.renderWorldTileWaterFrameCaches) return false;
      return this.worldMapWaterLayerRenderer.renderWorldTileWaterFrameCaches(tileMapView, layout, waterEntries, cacheScale);
    }

    renderWorldTileWaterLayer(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      if (!this.worldMapWaterLayerRenderer?.renderWorldTileWaterLayer) return false;
      return this.worldMapWaterLayerRenderer.renderWorldTileWaterLayer(tileMapView, viewport, frame, entries);
    }

    renderWorldTileStaticEntries(tileMapView = {}, viewport = {}, frame = {}, entries = [], uiState = {}, options = {}) {
      if (!this.worldMapStaticEntryRenderer?.renderWorldTileStaticEntries) return false;
      return this.worldMapStaticEntryRenderer.renderWorldTileStaticEntries(tileMapView, viewport, frame, entries, uiState, options);
    }

    renderWorldTileWaterEntries(tileMapView = {}, viewport = {}, entries = [], waterTimeMs = null) {
      if (!this.worldMapWaterEntryRenderer?.renderWorldTileWaterEntries) return false;
      return this.worldMapWaterEntryRenderer.renderWorldTileWaterEntries(tileMapView, viewport, entries, waterTimeMs);
    }

    addWorldTileSiteHitTargets(tileMapView = {}, viewport = {}, entries = [], uiState = {}) {
      if (!this.worldMapHitTargetFacade?.addWorldTileSiteHitTargets) return false;
      return this.worldMapHitTargetFacade.addWorldTileSiteHitTargets(tileMapView, viewport, entries, uiState);
    }

    addWorldMapDragHitTarget(x = 0, y = 0, width = 0, height = 0) {
      if (!this.worldMapTileMapRenderer?.addWorldMapDragHitTarget) return false;
      return this.worldMapTileMapRenderer.addWorldMapDragHitTarget(x, y, width, height);
    }

    renderWorldScoutRoutes(tileMapView = {}, viewport = {}, actors = []) {
      if (!this.worldMapScoutRenderer?.renderWorldScoutRoutes) return false;
      return this.worldMapScoutRenderer.renderWorldScoutRoutes(tileMapView, viewport, actors);
    }

    renderWorldScoutUnits(tileMapView = {}, viewport = {}) {
      if (!this.worldMapActorHudRenderer?.renderWorldScoutUnits) return false;
      return this.worldMapActorHudRenderer.renderWorldScoutUnits(tileMapView, viewport);
    }

    renderWorldActors(actors = [], viewport = {}, geometry = {}) {
      if (!this.worldMapActorHudRenderer?.renderWorldActors) return false;
      return this.worldMapActorHudRenderer.renderWorldActors(actors, viewport, geometry);
    }

    addWorldActorHitTargets(actors = [], viewport = {}, geometry = {}) {
      if (!this.worldMapActorHudRenderer?.addWorldActorHitTargets) return false;
      return this.worldMapActorHudRenderer.addWorldActorHitTargets(actors, viewport, geometry);
    }

    renderWorldMarchHud(state = {}, uiState = {}, actors = [], viewport = {}, geometry = {}, frame = {}) {
      if (!this.worldMapActorHudRenderer?.renderWorldMarchHud) return false;
      return this.worldMapActorHudRenderer.renderWorldMarchHud(state, uiState, actors, viewport, geometry, frame);
    }

    renderWorldMapActorLayer(state = {}, options = {}) {
      const target = this.worldActorLayerRenderer && this.worldActorLayerRenderer !== this
        ? this.worldActorLayerRenderer
        : this;
      const layerContext = options.worldMapRuntimeContext
        || this.lastWorldTileMapContext
        || target.lastWorldTileMapContext
        || null;
      if (target !== this) {
        target.lastWorldTileMapContext = layerContext;
        target.lastGameState = state;
        target.lastWorldMarchState = state;
      }
      if (target?.worldMapLayerRenderer?.renderWorldMapActorLayer) {
        return target.worldMapLayerRenderer.renderWorldMapActorLayer(state, {
          ...options,
          worldMapRuntimeContext: layerContext,
        });
      }
      return false;
    }

    getNearestWorldTileAtPoint(point = {}, tileMapView = {}, viewport = {}) {
      if (!this.worldMapActorHudRenderer?.getNearestWorldTileAtPoint) return null;
      return this.worldMapActorHudRenderer.getNearestWorldTileAtPoint(point, tileMapView, viewport);
    }

    getEpochNowMs() {
      if (!this.worldMapActorHudRenderer?.getEpochNowMs) return Date.now();
      return this.worldMapActorHudRenderer.getEpochNowMs();
    }

    addWorldMarchTileHitTargets(tileMapView = {}, viewport = {}, frame = {}) {
      if (!this.worldMapHitTargetFacade?.addWorldMarchTileHitTargets) return false;
      return this.worldMapHitTargetFacade.addWorldMarchTileHitTargets(tileMapView, viewport, frame);
    }

    renderWorldTileMap(tileMapView = {}, x, y, width, height, uiState = {}, options = {}) {
      if (!this.worldMapTileMapRenderer?.renderWorldTileMap) return false;
      return this.worldMapTileMapRenderer.renderWorldTileMap(tileMapView, x, y, width, height, uiState, options);
    }

    renderMilitaryWorldView(state = {}, x, y, width, height, options = {}) {
      if (!this.worldMapMilitaryViewRenderer?.renderMilitaryWorldView) return false;
      return this.worldMapMilitaryViewRenderer.renderMilitaryWorldView(state, x, y, width, height, options);
    }

    renderWorldSiteAction(actionView = {}, x, y, width) {
      if (!this.worldMapSiteOverlayRenderer?.renderWorldSiteAction) return y;
      return this.worldMapSiteOverlayRenderer.renderWorldSiteAction(actionView, x, y, width);
    }

    renderWorldExpeditionConfig(config = {}, x, y, width) {
      if (!this.worldMapSiteOverlayRenderer?.renderWorldExpeditionConfig) return y;
      return this.worldMapSiteOverlayRenderer.renderWorldExpeditionConfig(config, x, y, width);
    }

    renderWorldSiteModal(state = {}, options = {}) {
      if (!this.worldMapSiteOverlayRenderer?.renderWorldSiteModal) return false;
      return this.worldMapSiteOverlayRenderer.renderWorldSiteModal(state, options);
    }

    getWorldCityCommandAnchor(detail = {}, territories = [], state = {}, options = {}) {
      if (!this.worldMapSiteOverlayRenderer?.getWorldCityCommandAnchor) return null;
      return this.worldMapSiteOverlayRenderer.getWorldCityCommandAnchor(detail, territories, state, options);
    }

    getWorldSiteCanvasAnchor(siteId = '', state = {}, options = {}) {
      if (!this.worldMapSiteOverlayRenderer?.getWorldSiteCanvasAnchor) return null;
      return this.worldMapSiteOverlayRenderer.getWorldSiteCanvasAnchor(siteId, state, options);
    }

    getWorldCityCommandButtonAction(button = {}) {
      if (!this.worldMapSiteOverlayRenderer?.getWorldCityCommandButtonAction) {
        return {
          type: 'territoryAction',
          territoryId: button.territoryId,
          cityId: button.territoryId,
          tab: undefined,
          disabled: button.disabled || !button.action,
        };
      }
      return this.worldMapSiteOverlayRenderer.getWorldCityCommandButtonAction(button);
    }

    drawWorldCityCommandPrimaryButton(button = {}, x, y, size) {
      if (!this.worldMapSiteOverlayRenderer?.drawWorldCityCommandPrimaryButton) return false;
      return this.worldMapSiteOverlayRenderer.drawWorldCityCommandPrimaryButton(button, x, y, size);
    }

    drawWorldCityCommandSideButton(button = {}, x, y, width, height) {
      if (!this.worldMapSiteOverlayRenderer?.drawWorldCityCommandSideButton) return false;
      return this.worldMapSiteOverlayRenderer.drawWorldCityCommandSideButton(button, x, y, width, height);
    }

    renderWorldCityCommandOverlay(detail = {}, territories = [], state = {}, options = {}) {
      if (!this.worldMapSiteOverlayRenderer?.renderWorldCityCommandOverlay) return false;
      return this.worldMapSiteOverlayRenderer.renderWorldCityCommandOverlay(detail, territories, state, options);
    }

  }

  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapCanvasRenderer;
  else global.WorldMapCanvasRenderer = WorldMapCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
