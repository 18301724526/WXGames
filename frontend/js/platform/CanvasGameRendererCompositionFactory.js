(function (global) {
  const CHILD_RENDERER_SPECS = Object.freeze([
    { property: 'surfaceRenderer', classOption: 'surfaceRendererClass', dependencyKey: 'canvasSurfaceRenderer', globalName: 'CanvasSurfaceRenderer', requirePath: './renderers/CanvasSurfaceRenderer' },
    { property: 'assetRenderer', classOption: 'assetRendererClass', dependencyKey: 'canvasAssetRenderer', globalName: 'CanvasAssetRenderer', requirePath: './renderers/CanvasAssetRenderer' },
    { property: 'worldTileWaterRenderer', classOption: 'worldTileWaterRendererClass', dependencyKey: 'worldTileWaterCanvasRenderer', globalName: 'WorldTileWaterCanvasRenderer', requirePath: './renderers/WorldTileWaterCanvasRenderer' },
    { property: 'worldMapRenderer', classOption: 'worldMapRendererClass', dependencyKey: 'worldMapCanvasRenderer', globalName: 'WorldMapCanvasRenderer', requirePath: './renderers/WorldMapCanvasRenderer' },
    { property: 'worldMapLayerRenderer', classOption: 'worldMapLayerRendererClass', dependencyKey: 'worldMapLayerCanvasRenderer', globalName: 'WorldMapLayerCanvasRenderer', requirePath: './renderers/WorldMapLayerCanvasRenderer' },
    { property: 'famousRenderer', classOption: 'famousRendererClass', dependencyKey: 'famousCanvasRenderer', globalName: 'FamousCanvasRenderer', requirePath: './renderers/FamousCanvasRenderer' },
    { property: 'techRenderer', classOption: 'techRendererClass', dependencyKey: 'techCanvasRenderer', globalName: 'TechCanvasRenderer', requirePath: './renderers/TechCanvasRenderer' },
    { property: 'battleRenderer', classOption: 'battleRendererClass', dependencyKey: 'battleCanvasRenderer', globalName: 'BattleCanvasRenderer', requirePath: './renderers/BattleCanvasRenderer' },
    { property: 'buildingRenderer', classOption: 'buildingRendererClass', dependencyKey: 'buildingCanvasRenderer', globalName: 'BuildingCanvasRenderer', requirePath: './renderers/BuildingCanvasRenderer' },
    { property: 'eventRenderer', classOption: 'eventRendererClass', dependencyKey: 'eventCanvasRenderer', globalName: 'EventCanvasRenderer', requirePath: './renderers/EventCanvasRenderer' },
    { property: 'captureRenderer', classOption: 'captureRendererClass', dependencyKey: 'captureCanvasRenderer', globalName: 'CaptureCanvasRenderer', requirePath: './renderers/CaptureCanvasRenderer' },
    { property: 'civilizationRenderer', classOption: 'civilizationRendererClass', dependencyKey: 'civilizationCanvasRenderer', globalName: 'CivilizationCanvasRenderer', requirePath: './renderers/CivilizationCanvasRenderer' },
    { property: 'militaryRenderer', classOption: 'militaryRendererClass', dependencyKey: 'militaryCanvasRenderer', globalName: 'MilitaryCanvasRenderer', requirePath: './renderers/MilitaryCanvasRenderer' },
    { property: 'armyFormationEditorRenderer', classOption: 'armyFormationEditorRendererClass', dependencyKey: 'armyFormationEditorCanvasRenderer', globalName: 'ArmyFormationEditorCanvasRenderer', requirePath: './renderers/ArmyFormationEditorCanvasRenderer' },
    { property: 'guideTaskRenderer', classOption: 'guideTaskRendererClass', dependencyKey: 'guideTaskCanvasRenderer', globalName: 'GuideTaskCanvasRenderer', requirePath: './renderers/GuideTaskCanvasRenderer' },
    { property: 'resourceTopBarRenderer', classOption: 'resourceTopBarRendererClass', dependencyKey: 'resourceTopBarCanvasRenderer', globalName: 'ResourceTopBarCanvasRenderer', requirePath: './renderers/ResourceTopBarCanvasRenderer' },
    { property: 'cityPeopleRenderer', classOption: 'cityPeopleRendererClass', dependencyKey: 'cityPeopleCanvasRenderer', globalName: 'CityPeopleCanvasRenderer', requirePath: './renderers/CityPeopleCanvasRenderer' },
    { property: 'systemRenderer', classOption: 'systemRendererClass', dependencyKey: 'systemCanvasRenderer', globalName: 'SystemCanvasRenderer', requirePath: './renderers/SystemCanvasRenderer' },
    { property: 'cityRenderer', classOption: 'cityRendererClass', dependencyKey: 'cityCanvasRenderer', globalName: 'CityCanvasRenderer', requirePath: './renderers/CityCanvasRenderer' },
    { property: 'overlayRenderer', classOption: 'overlayRendererClass', dependencyKey: 'overlayCanvasRenderer', globalName: 'OverlayCanvasRenderer', requirePath: './renderers/OverlayCanvasRenderer' },
    { property: 'advisorRenderer', classOption: 'advisorRendererClass', dependencyKey: 'advisorCanvasRenderer', globalName: 'AdvisorCanvasRenderer', requirePath: './renderers/AdvisorCanvasRenderer' },
    { property: 'mapCommandRenderer', classOption: 'mapCommandRendererClass', dependencyKey: 'mapCommandCanvasRenderer', globalName: 'MapCommandCanvasRenderer', requirePath: './renderers/MapCommandCanvasRenderer' },
    { property: 'tabBarRenderer', classOption: 'tabBarRendererClass', dependencyKey: 'tabBarCanvasRenderer', globalName: 'TabBarCanvasRenderer', requirePath: './renderers/TabBarCanvasRenderer' },
    { property: 'hudTabPageRenderer', classOption: 'hudTabPageRendererClass', dependencyKey: 'hudTabPageCanvasRenderer', globalName: 'HudTabPageCanvasRenderer', requirePath: './renderers/HudTabPageCanvasRenderer' },
    { property: 'hudOverlayRenderer', classOption: 'hudOverlayRendererClass', dependencyKey: 'hudOverlayCanvasRenderer', globalName: 'HudOverlayCanvasRenderer', requirePath: './renderers/HudOverlayCanvasRenderer' },
    { property: 'frameRenderer', classOption: 'frameRendererClass', dependencyKey: 'canvasFrameRenderer', globalName: 'CanvasFrameRenderer', requirePath: './renderers/CanvasFrameRenderer' },
  ]);

  const DRAWING_SURFACE_RENDERER_PROPERTIES = new Set([
    'advisorRenderer',
    'resourceTopBarRenderer',
    'guideTaskRenderer',
    'civilizationRenderer',
    'militaryRenderer',
    'techRenderer',
    'cityRenderer',
    'systemRenderer',
    'battleRenderer',
    'eventRenderer',
    'captureRenderer',
    'buildingRenderer',
    'overlayRenderer',
    'mapCommandRenderer',
    'cityPeopleRenderer',
    'armyFormationEditorRenderer',
  ]);

  const SURFACE_STATE_RENDERER_PROPERTIES = new Set([
    'surfaceRenderer',
    'famousRenderer',
  ]);

  const WORLD_MAP_RENDER_STATE_RENDERER_PROPERTIES = new Set([
    'worldMapRenderer',
    'worldMapLayerRenderer',
  ]);

  const WORLD_MAP_CACHE_STATE_RENDERER_PROPERTIES = new Set([
    'assetRenderer',
    'worldTileWaterRenderer',
    'worldMapRenderer',
    'worldMapLayerRenderer',
  ]);

  function resolveSharedDependency(spec) {
    if (global[spec.globalName]) return global[spec.globalName];
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require(spec.requirePath);
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  const SHARED_DEPENDENCIES = CHILD_RENDERER_SPECS.reduce((dependencies, spec) => {
    dependencies[spec.dependencyKey] = resolveSharedDependency(spec);
    return dependencies;
  }, Object.create(null));

  class CanvasGameRendererCompositionFactory {
    constructor(options = {}) {
      this.host = options.host || null;
      this.options = options.options || {};
      this.dependencies = options.dependencies || SHARED_DEPENDENCIES;
    }

    getDependency(spec) {
      return this.dependencies[spec.dependencyKey] || null;
    }

    getRendererClass(spec) {
      return this.options[spec.classOption] || this.getDependency(spec);
    }

    createRenderer(spec) {
      if (this.options[spec.property]) return this.options[spec.property];
      const RendererClass = this.getRendererClass(spec);
      if (!RendererClass) return null;
      const extraOptions = {
        ...(DRAWING_SURFACE_RENDERER_PROPERTIES.has(spec.property)
          ? { drawingSurface: this.host }
          : {}),
        ...(SURFACE_STATE_RENDERER_PROPERTIES.has(spec.property)
          ? { surfaceState: this.host?.surfaceState || null }
          : {}),
        ...(WORLD_MAP_RENDER_STATE_RENDERER_PROPERTIES.has(spec.property)
          ? { worldMapRenderState: this.host?.worldMapRenderState || null }
          : {}),
        ...(WORLD_MAP_CACHE_STATE_RENDERER_PROPERTIES.has(spec.property)
          ? { worldMapCacheState: this.host?.worldMapCacheState || null }
          : {}),
        ...(spec.property === 'techRenderer'
          ? { techRenderState: this.host?.techRenderState || null }
          : {}),
      };
      return new RendererClass({ host: this.host, ...extraOptions });
    }

    createComposition() {
      const rendererMap = Object.create(null);
      const rendererKeys = CanvasGameRendererCompositionFactory.getChildRendererKeys();
      CHILD_RENDERER_SPECS.forEach((spec) => {
        rendererMap[spec.property] = this.createRenderer(spec);
      });
      if (
        rendererMap.hudOverlayRenderer &&
        rendererMap.frameRenderer &&
        !rendererMap.hudOverlayRenderer.mapHomeOverlayRenderer
      ) {
        rendererMap.hudOverlayRenderer.mapHomeOverlayRenderer = rendererMap.frameRenderer;
      }
      return {
        rendererMap,
        rendererKeys,
        renderers: rendererKeys.map((key) => rendererMap[key]).filter(Boolean),
      };
    }

    static create(options = {}) {
      return new CanvasGameRendererCompositionFactory(options).createComposition();
    }

    static getChildRendererSpecs() {
      return CHILD_RENDERER_SPECS.slice();
    }

    static getChildRendererKeys() {
      return CHILD_RENDERER_SPECS.map((spec) => spec.property);
    }

    static getChildRenderers(host, rendererKeys = null) {
      const keys = Array.isArray(rendererKeys) && rendererKeys.length
        ? rendererKeys
        : CanvasGameRendererCompositionFactory.getChildRendererKeys();
      return keys.map((key) => host?.[key]).filter(Boolean);
    }

    static syncChildRendererPresenter(host, renderer) {
      if (!renderer || (typeof renderer !== 'object' && typeof renderer !== 'function')) return false;
      try {
        Object.defineProperty(renderer, 'presenter', {
          configurable: true,
          enumerable: false,
          writable: true,
          value: host?.presenter || null,
        });
        return true;
      } catch (error) {
        try {
          renderer.presenter = host?.presenter || null;
          return true;
        } catch (assignError) {
          return false;
        }
      }
    }

    static syncChildRendererPresenters(host, rendererKeys = null) {
      return CanvasGameRendererCompositionFactory
        .getChildRenderers(host, rendererKeys)
        .map((renderer) => CanvasGameRendererCompositionFactory.syncChildRendererPresenter(host, renderer));
    }
  }

  global.CanvasGameRendererCompositionFactory = CanvasGameRendererCompositionFactory;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasGameRendererCompositionFactory;
})(typeof window !== 'undefined' ? window : globalThis);
