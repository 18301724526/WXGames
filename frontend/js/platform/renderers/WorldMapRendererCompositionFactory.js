(function (global) {
  class WorldMapRendererCompositionFactory {
    constructor(options = {}) {
      this.renderer = options.renderer || null;
      this.rendererHost = options.rendererHost || null;
      this.options = options.options || {};
      this.dependencies = options.dependencies || {};
      this.worldMapRenderState = options.worldMapRenderState || this.options.worldMapRenderState || null;
      this.worldMapCacheState = options.worldMapCacheState || this.options.worldMapCacheState || null;
    }

    getDependency(key) {
      return this.dependencies[key] || null;
    }

    getClass(optionKey, dependencyKey) {
      return this.options[optionKey] || this.getDependency(dependencyKey);
    }

    createChildHost() {
      if (this.options.childHost) return this.options.childHost;
      return this.renderer || this.rendererHost || null;
    }

    createInstance(instanceOptionKey, classOptionKey, dependencyKey, childHost, extraOptions = null) {
      if (this.options[instanceOptionKey]) return this.options[instanceOptionKey];
      const RendererClass = this.getClass(classOptionKey, dependencyKey);
      if (!RendererClass) return null;
      return new RendererClass({
        host: childHost,
        worldMapRenderState: this.worldMapRenderState,
        worldMapCacheState: this.worldMapCacheState,
        ...(extraOptions || {}),
      });
    }

    createComposition() {
      const childHost = this.createChildHost();
      const worldActorRenderer = this.createInstance(
        'worldActorRenderer',
        'worldActorRendererClass',
        'worldActorCanvasRenderer',
        childHost,
      );
      const worldMarchHudRenderer = this.createInstance(
        'worldMarchHudRenderer',
        'worldMarchHudRendererClass',
        'worldMarchHudCanvasRenderer',
        childHost,
      );
      const worldMapActorHudRenderer = this.createInstance(
        'worldMapActorHudRenderer',
        'worldMapActorHudRendererClass',
        'worldMapActorHudRenderer',
        childHost,
        { worldActorRenderer, worldMarchHudRenderer },
      );

      return {
        childHost,
        worldActorRenderer,
        worldMarchHudRenderer,
        worldMapActorHudRenderer,
        worldMapStaticLayerRenderer: this.createInstance('worldMapStaticLayerRenderer', 'worldMapStaticLayerRendererClass', 'worldMapStaticLayerRenderer', childHost),
        worldMapStaticEntryRenderer: this.createInstance('worldMapStaticEntryRenderer', 'worldMapStaticEntryRendererClass', 'worldMapStaticEntryRenderer', childHost),
        worldMapStaticChunkRenderer: this.createInstance('worldMapStaticChunkRenderer', 'worldMapStaticChunkRendererClass', 'worldMapStaticChunkRenderer', childHost),
        worldMapWaterLayerRenderer: this.createInstance('worldMapWaterLayerRenderer', 'worldMapWaterLayerRendererClass', 'worldMapWaterLayerRenderer', childHost),
        worldMapWaterEntryRenderer: this.createInstance('worldMapWaterEntryRenderer', 'worldMapWaterEntryRendererClass', 'worldMapWaterEntryRenderer', childHost),
        worldMapSnapshotCacheRenderer: this.createInstance('worldMapSnapshotCacheRenderer', 'worldMapSnapshotCacheRendererClass', 'worldMapSnapshotCacheRenderer', childHost),
        worldMapFastDragCompositeRenderer: this.createInstance('worldMapFastDragCompositeRenderer', 'worldMapFastDragCompositeRendererClass', 'worldMapFastDragCompositeRenderer', childHost),
        worldMapScoutRenderer: this.createInstance('worldMapScoutRenderer', 'worldMapScoutRendererClass', 'worldMapScoutRenderer', childHost),
        worldMapSiteOverlayRenderer: this.createInstance('worldMapSiteOverlayRenderer', 'worldMapSiteOverlayRendererClass', 'worldMapSiteOverlayRenderer', childHost),
        worldMapMilitaryViewRenderer: this.createInstance('worldMapMilitaryViewRenderer', 'worldMapMilitaryViewRendererClass', 'worldMapMilitaryViewRenderer', childHost),
        worldMapTileMapRenderer: this.createInstance(
          'worldMapTileMapRenderer',
          'worldMapTileMapRendererClass',
          'worldMapTileMapRenderer',
          childHost,
          { worldActorRenderer },
        ),
      };
    }

    static create(options = {}) {
      return new WorldMapRendererCompositionFactory(options).createComposition();
    }
  }

  global.WorldMapRendererCompositionFactory = WorldMapRendererCompositionFactory;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapRendererCompositionFactory;
})(typeof window !== 'undefined' ? window : globalThis);
