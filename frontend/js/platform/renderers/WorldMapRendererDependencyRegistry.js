(function (global) {
  function freezeDefinitions(definitions) {
    const frozen = {};
    Object.keys(definitions).forEach((key) => {
      frozen[key] = Object.freeze({ ...definitions[key] });
    });
    return Object.freeze(frozen);
  }

  const DEFINITIONS = freezeDefinitions({
    tileMapAssetManifest: { globalName: 'TileMapAssetManifest', modulePath: '../../config/TileMapAssetManifest' },
    tileMapGeometry: { globalName: 'TileMapGeometry', modulePath: '../../domain/TileMapGeometry' },
    worldTime: { globalName: 'WorldTime', modulePath: '../../domain/WorldTime' },
    unitSpriteManifest: { globalName: 'UnitSpriteManifest', modulePath: '../../config/UnitSpriteManifest' },
    worldActorCanvasRenderer: { globalName: 'WorldActorCanvasRenderer', modulePath: './WorldActorCanvasRenderer' },
    worldMarchHudCanvasRenderer: { globalName: 'WorldMarchHudCanvasRenderer', modulePath: './WorldMarchHudCanvasRenderer' },
    tutorialIntroUnitRenderer: { globalName: 'TutorialIntroUnitRenderer', modulePath: './TutorialIntroUnitRenderer' },
    worldMapRendererHostBridge: { globalName: 'WorldMapRendererHostBridge', modulePath: './WorldMapRendererHostBridge' },
    worldMapRendererCompositionFactory: { globalName: 'WorldMapRendererCompositionFactory', modulePath: './WorldMapRendererCompositionFactory' },
    worldMapLayoutModel: { globalName: 'WorldMapLayoutModel', modulePath: './WorldMapLayoutModel' },
    worldMapLayoutFacade: { globalName: 'WorldMapLayoutFacade', modulePath: './WorldMapLayoutFacade' },
    worldMapRenderUtilityFacade: { globalName: 'WorldMapRenderUtilityFacade', modulePath: './WorldMapRenderUtilityFacade' },
    worldMapHitTargetModel: { globalName: 'WorldMapHitTargetModel', modulePath: './WorldMapHitTargetModel' },
    worldMapHitTargetFacade: { globalName: 'WorldMapHitTargetFacade', modulePath: './WorldMapHitTargetFacade' },
    worldMapCachePolicy: { globalName: 'WorldMapCachePolicy', modulePath: './WorldMapCachePolicy' },
    worldMapLayerCacheStore: { globalName: 'WorldMapLayerCacheStore', modulePath: './WorldMapLayerCacheStore' },
    worldMapCacheFacade: { globalName: 'WorldMapCacheFacade', modulePath: './WorldMapCacheFacade' },
    worldMapCacheConfigFacade: { globalName: 'WorldMapCacheConfigFacade', modulePath: './WorldMapCacheConfigFacade' },
    worldMapStaticLayerRenderer: { globalName: 'WorldMapStaticLayerRenderer', modulePath: './WorldMapStaticLayerRenderer' },
    worldMapStaticEntryRenderer: { globalName: 'WorldMapStaticEntryRenderer', modulePath: './WorldMapStaticEntryRenderer' },
    worldMapStaticChunkRenderer: { globalName: 'WorldMapStaticChunkRenderer', modulePath: './WorldMapStaticChunkRenderer' },
    worldMapWaterLayerRenderer: { globalName: 'WorldMapWaterLayerRenderer', modulePath: './WorldMapWaterLayerRenderer' },
    worldMapWaterEntryRenderer: { globalName: 'WorldMapWaterEntryRenderer', modulePath: './WorldMapWaterEntryRenderer' },
    worldMapSnapshotCacheRenderer: { globalName: 'WorldMapSnapshotCacheRenderer', modulePath: './WorldMapSnapshotCacheRenderer' },
    worldMapFastDragCompositeRenderer: { globalName: 'WorldMapFastDragCompositeRenderer', modulePath: './WorldMapFastDragCompositeRenderer' },
    worldMapScoutRenderer: { globalName: 'WorldMapScoutRenderer', modulePath: './WorldMapScoutRenderer' },
    worldMapSiteOverlayRenderer: { globalName: 'WorldMapSiteOverlayRenderer', modulePath: './WorldMapSiteOverlayRenderer' },
    worldMapMilitaryViewRenderer: { globalName: 'WorldMapMilitaryViewRenderer', modulePath: './WorldMapMilitaryViewRenderer' },
    worldMapFogMaskContextRenderer: { globalName: 'WorldMapFogMaskContextRenderer', modulePath: './WorldMapFogMaskContextRenderer' },
    worldMapTileMapRenderer: { globalName: 'WorldMapTileMapRenderer', modulePath: './WorldMapTileMapRenderer' },
    worldMapActorHudRenderer: { globalName: 'WorldMapActorHudRenderer', modulePath: './WorldMapActorHudRenderer' },
  });

  function defaultRequireModule(modulePath) {
    if (typeof module === 'undefined' || !module.exports || typeof require !== 'function') return null;
    try {
      return require(modulePath);
    } catch (error) {
      return null;
    }
  }

  function resolveDependency(key, options = {}) {
    const definitions = options.definitions || DEFINITIONS;
    const definition = definitions[key];
    if (!definition) return null;
    const scope = options.global || global;
    if (scope && definition.globalName && scope[definition.globalName]) return scope[definition.globalName];
    const requireModule = options.requireModule || defaultRequireModule;
    if (!definition.modulePath || typeof requireModule !== 'function') return null;
    return requireModule(definition.modulePath) || null;
  }

  function createRegistry(options = {}) {
    const definitions = options.definitions || DEFINITIONS;
    const cache = Object.create(null);
    return Object.freeze({
      definitions,
      getDefinition(key) {
        return definitions[key] || null;
      },
      get(key) {
        if (!Object.prototype.hasOwnProperty.call(definitions, key)) return null;
        if (!cache[key]) cache[key] = resolveDependency(key, { ...options, definitions });
        return cache[key] || null;
      },
      getOrFallback(key, fallback = null) {
        return this.get(key) || fallback;
      },
    });
  }

  const defaultRegistry = createRegistry();
  const api = Object.freeze({
    DEFINITIONS,
    createRegistry,
    resolve: resolveDependency,
    get: defaultRegistry.get.bind(defaultRegistry),
    getOrFallback: defaultRegistry.getOrFallback.bind(defaultRegistry),
  });

  global.WorldMapRendererDependencyRegistry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
