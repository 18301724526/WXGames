(function (global) {
  class WorldMapRendererCompositionFactory {
    constructor(options = {}) {
      this.renderer = options.renderer || null;
      this.rendererHost = options.rendererHost || null;
      this.options = options.options || {};
      this.dependencies = options.dependencies || {};
    }

    getDependency(key) {
      return this.dependencies[key] || null;
    }

    getClass(optionKey, dependencyKey) {
      return this.options[optionKey] || this.getDependency(dependencyKey);
    }

    createChildHost() {
      if (this.options.childHost) return this.options.childHost;
      const renderer = this.renderer;
      const rendererHost = this.rendererHost;
      return new Proxy(Object.create(null), {
        get(_target, prop) {
          if (prop === 'constructor') return renderer?.constructor;
          if (renderer && prop in renderer) {
            const value = renderer[prop];
            return typeof value === 'function' ? value.bind(renderer) : value;
          }
          if (renderer && typeof prop === 'string' && prop.startsWith('worldTile')) return renderer[prop];
          if (rendererHost && prop in rendererHost) {
            const value = rendererHost[prop];
            return typeof value === 'function' ? value.bind(rendererHost) : value;
          }
          const value = renderer ? renderer[prop] : undefined;
          return typeof value === 'function' ? value.bind(renderer) : value;
        },
        set(_target, prop, value) {
          if (renderer && (prop in renderer || (typeof prop === 'string' && prop.startsWith('worldTile')))) {
            renderer[prop] = value;
            return true;
          }
          if (rendererHost && prop in rendererHost) {
            rendererHost[prop] = value;
            return true;
          }
          if (renderer) {
            renderer[prop] = value;
            return true;
          }
          return true;
        },
        has(_target, prop) {
          return Boolean(renderer && prop in renderer)
            || (typeof prop === 'string' && prop.startsWith('worldTile'))
            || Boolean(rendererHost && prop in rendererHost);
        },
      });
    }

    createInstance(instanceOptionKey, classOptionKey, dependencyKey, childHost, extraOptions = null) {
      if (this.options[instanceOptionKey]) return this.options[instanceOptionKey];
      const RendererClass = this.getClass(classOptionKey, dependencyKey);
      if (!RendererClass) return null;
      return new RendererClass({ host: childHost, ...(extraOptions || {}) });
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
        worldMapLayoutFacade: this.createInstance('worldMapLayoutFacade', 'worldMapLayoutFacadeClass', 'worldMapLayoutFacade', childHost),
        worldMapRenderUtilityFacade: this.createInstance('worldMapRenderUtilityFacade', 'worldMapRenderUtilityFacadeClass', 'worldMapRenderUtilityFacade', childHost),
        worldMapHitTargetFacade: this.createInstance('worldMapHitTargetFacade', 'worldMapHitTargetFacadeClass', 'worldMapHitTargetFacade', childHost),
        worldMapCacheFacade: this.createInstance('worldMapCacheFacade', 'worldMapCacheFacadeClass', 'worldMapCacheFacade', childHost),
        worldMapCacheConfigFacade: this.createInstance('worldMapCacheConfigFacade', 'worldMapCacheConfigFacadeClass', 'worldMapCacheConfigFacade', childHost),
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
        worldMapFogMaskContextRenderer: this.createInstance('worldMapFogMaskContextRenderer', 'worldMapFogMaskContextRendererClass', 'worldMapFogMaskContextRenderer', childHost),
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
