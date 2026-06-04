(function (global) {
  const sharedFamousPortraitLayout = (() => {
    if (global.FamousPortraitLayout) return global.FamousPortraitLayout;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../config/FamousPortraitLayout');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const sharedTileMapManifest = (() => {
    if (global.TileMapAssetManifest) return global.TileMapAssetManifest;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../config/TileMapAssetManifest');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const sharedTileMapGeometry = (() => {
    if (global.TileMapGeometry) return global.TileMapGeometry;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../domain/TileMapGeometry');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedWorldMapCanvasRenderer = (() => {
    if (global.WorldMapCanvasRenderer) return global.WorldMapCanvasRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/WorldMapCanvasRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedCanvasSurfaceRenderer = (() => {
    if (global.CanvasSurfaceRenderer) return global.CanvasSurfaceRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/CanvasSurfaceRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedCanvasAssetRenderer = (() => {
    if (global.CanvasAssetRenderer) return global.CanvasAssetRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/CanvasAssetRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedWorldTileWaterCanvasRenderer = (() => {
    if (global.WorldTileWaterCanvasRenderer) return global.WorldTileWaterCanvasRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/WorldTileWaterCanvasRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedWorldMapLayerCanvasRenderer = (() => {
    if (global.WorldMapLayerCanvasRenderer) return global.WorldMapLayerCanvasRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/WorldMapLayerCanvasRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedFamousCanvasRenderer = (() => {
    if (global.FamousCanvasRenderer) return global.FamousCanvasRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/FamousCanvasRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedTechCanvasRenderer = (() => {
    if (global.TechCanvasRenderer) return global.TechCanvasRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/TechCanvasRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedBattleCanvasRenderer = (() => {
    if (global.BattleCanvasRenderer) return global.BattleCanvasRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/BattleCanvasRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedTutorialCanvasRenderer = (() => {
    if (global.TutorialCanvasRenderer) return global.TutorialCanvasRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/TutorialCanvasRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedBuildingCanvasRenderer = (() => {
    if (global.BuildingCanvasRenderer) return global.BuildingCanvasRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/BuildingCanvasRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedEventCanvasRenderer = (() => {
    if (global.EventCanvasRenderer) return global.EventCanvasRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/EventCanvasRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedCivilizationCanvasRenderer = (() => {
    if (global.CivilizationCanvasRenderer) return global.CivilizationCanvasRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/CivilizationCanvasRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedMilitaryCanvasRenderer = (() => {
    if (global.MilitaryCanvasRenderer) return global.MilitaryCanvasRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/MilitaryCanvasRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedArmyFormationEditorCanvasRenderer = (() => {
    if (global.ArmyFormationEditorCanvasRenderer) return global.ArmyFormationEditorCanvasRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/ArmyFormationEditorCanvasRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedGuideTaskCanvasRenderer = (() => {
    if (global.GuideTaskCanvasRenderer) return global.GuideTaskCanvasRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/GuideTaskCanvasRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedHomeCanvasRenderer = (() => {
    if (global.HomeCanvasRenderer) return global.HomeCanvasRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/HomeCanvasRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedSystemCanvasRenderer = (() => {
    if (global.SystemCanvasRenderer) return global.SystemCanvasRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/SystemCanvasRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedCityCanvasRenderer = (() => {
    if (global.CityCanvasRenderer) return global.CityCanvasRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/CityCanvasRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedOverlayCanvasRenderer = (() => {
    if (global.OverlayCanvasRenderer) return global.OverlayCanvasRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/OverlayCanvasRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedAdvisorCanvasRenderer = (() => {
    if (global.AdvisorCanvasRenderer) return global.AdvisorCanvasRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/AdvisorCanvasRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedMapCommandCanvasRenderer = (() => {
    if (global.MapCommandCanvasRenderer) return global.MapCommandCanvasRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/MapCommandCanvasRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedTabBarCanvasRenderer = (() => {
    if (global.TabBarCanvasRenderer) return global.TabBarCanvasRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/TabBarCanvasRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedHudTabPageCanvasRenderer = (() => {
    if (global.HudTabPageCanvasRenderer) return global.HudTabPageCanvasRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/HudTabPageCanvasRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedHudOverlayCanvasRenderer = (() => {
    if (global.HudOverlayCanvasRenderer) return global.HudOverlayCanvasRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/HudOverlayCanvasRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  class CanvasGameRenderer {
    constructor(options = {}) {
      this.presenter = options.presenter || null;
      this.ctx = options.ctx || null;
      this.canvas = options.canvas || null;
      this.pixelRatio = options.pixelRatio || 1;
      this.width = options.width || 390;
      this.height = options.height || 844;
      this.viewportOffsetX = Number(options.viewportOffsetX) || 0;
      this.viewportOffsetY = Number(options.viewportOffsetY) || 0;
      this.viewportWidth = Number(options.viewportWidth) || this.width;
      this.viewportHeight = Number(options.viewportHeight) || this.height;
      this.maxContentWidth = options.maxContentWidth || 480;
      this.edgePadding = options.edgePadding || 12;
      this.bottomSafeArea = options.bottomSafeArea || 12;
      this.assetCache = options.assetCache || new Map();
      this.assetMetricsCache = options.assetMetricsCache || new Map();
      this.worldTileMaskCache = options.worldTileMaskCache || new Map();
      this.worldTileMaskMetricsCache = options.worldTileMaskMetricsCache || new Map();
      this.worldTileDryCompositeCache = options.worldTileDryCompositeCache || new Map();
      this.worldTileCompositeCanvas = null;
      this.worldTileCompositeCtx = null;
      this.worldTileWaterCanvas = null;
      this.worldTileWaterCtx = null;
      this.worldTileStaticCache = null;
      this.worldTileStaticCacheKey = '';
      this.worldTileStaticCacheLayoutKind = '';
      this.worldTileStaticCacheLayout = null;
      this.worldTileStaticChunkCaches = new Map();
      this.worldTileStaticChunkCacheTick = 0;
      this.worldTileScoutRouteCache = null;
      this.worldTileScoutRouteCacheKey = '';
      this.worldTileScoutRouteCacheLayout = null;
      this.worldTileWaterLayerCache = null;
      this.worldTileWaterLayerCacheKey = '';
      this.worldTileWaterFrameCaches = new Map();
      this.worldTileWaterChunkCaches = new Map();
      this.worldTileWaterChunkCacheTick = 0;
      this.tutorialAdvisorSpine = null;
      this.tutorialAdvisorSpineFailed = false;
      this.worldTileViewCache = null;
      this.worldTileWaterTimeOverride = null;
      this.assetsChangedHandler = null;
      this.hitTargets = [];
      this.hoverPoint = null;
      this.famousSkillHitTargets = [];
      this.activeFamousSkillTooltip = null;
      this.pinnedFamousSkillTooltip = null;
      this.suppressHitTargets = false;
      this.frameNow = 0;
      this.fpsLastFrameAt = 0;
      this.fpsSamples = [];
      this.currentFps = 0;
      const SurfaceRendererClass = options.surfaceRendererClass || SharedCanvasSurfaceRenderer;
      this.surfaceRenderer = options.surfaceRenderer || (SurfaceRendererClass ? new SurfaceRendererClass({ host: this }) : null);
      const AssetRendererClass = options.assetRendererClass || SharedCanvasAssetRenderer;
      this.assetRenderer = options.assetRenderer || (AssetRendererClass ? new AssetRendererClass({ host: this }) : null);
      const WorldTileWaterRendererClass = options.worldTileWaterRendererClass || SharedWorldTileWaterCanvasRenderer;
      this.worldTileWaterRenderer = options.worldTileWaterRenderer || (WorldTileWaterRendererClass ? new WorldTileWaterRendererClass({ host: this }) : null);
      const WorldMapRendererClass = options.worldMapRendererClass || SharedWorldMapCanvasRenderer;
      this.worldMapRenderer = options.worldMapRenderer || (WorldMapRendererClass ? new WorldMapRendererClass({ host: this }) : null);
      const WorldMapLayerRendererClass = options.worldMapLayerRendererClass || SharedWorldMapLayerCanvasRenderer;
      this.worldMapLayerRenderer = options.worldMapLayerRenderer || (WorldMapLayerRendererClass ? new WorldMapLayerRendererClass({ host: this }) : null);
      const FamousRendererClass = options.famousRendererClass || SharedFamousCanvasRenderer;
      this.famousRenderer = options.famousRenderer || (FamousRendererClass ? new FamousRendererClass({ host: this }) : null);
      const TechRendererClass = options.techRendererClass || SharedTechCanvasRenderer;
      this.techRenderer = options.techRenderer || (TechRendererClass ? new TechRendererClass({ host: this }) : null);
      const BattleRendererClass = options.battleRendererClass || SharedBattleCanvasRenderer;
      this.battleRenderer = options.battleRenderer || (BattleRendererClass ? new BattleRendererClass({ host: this }) : null);
      const TutorialRendererClass = options.tutorialRendererClass || SharedTutorialCanvasRenderer;
      this.tutorialRenderer = options.tutorialRenderer || (TutorialRendererClass ? new TutorialRendererClass({ host: this }) : null);
      const BuildingRendererClass = options.buildingRendererClass || SharedBuildingCanvasRenderer;
      this.buildingRenderer = options.buildingRenderer || (BuildingRendererClass ? new BuildingRendererClass({ host: this }) : null);
      const EventRendererClass = options.eventRendererClass || SharedEventCanvasRenderer;
      this.eventRenderer = options.eventRenderer || (EventRendererClass ? new EventRendererClass({ host: this }) : null);
      const CivilizationRendererClass = options.civilizationRendererClass || SharedCivilizationCanvasRenderer;
      this.civilizationRenderer = options.civilizationRenderer || (CivilizationRendererClass ? new CivilizationRendererClass({ host: this }) : null);
      const MilitaryRendererClass = options.militaryRendererClass || SharedMilitaryCanvasRenderer;
      this.militaryRenderer = options.militaryRenderer || (MilitaryRendererClass ? new MilitaryRendererClass({ host: this }) : null);
      const ArmyFormationEditorRendererClass = options.armyFormationEditorRendererClass || SharedArmyFormationEditorCanvasRenderer;
      this.armyFormationEditorRenderer = options.armyFormationEditorRenderer || (ArmyFormationEditorRendererClass ? new ArmyFormationEditorRendererClass({ host: this }) : null);
      const GuideTaskRendererClass = options.guideTaskRendererClass || SharedGuideTaskCanvasRenderer;
      this.guideTaskRenderer = options.guideTaskRenderer || (GuideTaskRendererClass ? new GuideTaskRendererClass({ host: this }) : null);
      const HomeRendererClass = options.homeRendererClass || SharedHomeCanvasRenderer;
      this.homeRenderer = options.homeRenderer || (HomeRendererClass ? new HomeRendererClass({ host: this }) : null);
      const SystemRendererClass = options.systemRendererClass || SharedSystemCanvasRenderer;
      this.systemRenderer = options.systemRenderer || (SystemRendererClass ? new SystemRendererClass({ host: this }) : null);
      const CityRendererClass = options.cityRendererClass || SharedCityCanvasRenderer;
      this.cityRenderer = options.cityRenderer || (CityRendererClass ? new CityRendererClass({ host: this }) : null);
      const OverlayRendererClass = options.overlayRendererClass || SharedOverlayCanvasRenderer;
      this.overlayRenderer = options.overlayRenderer || (OverlayRendererClass ? new OverlayRendererClass({ host: this }) : null);
      const AdvisorRendererClass = options.advisorRendererClass || SharedAdvisorCanvasRenderer;
      this.advisorRenderer = options.advisorRenderer || (AdvisorRendererClass ? new AdvisorRendererClass({ host: this }) : null);
      const MapCommandRendererClass = options.mapCommandRendererClass || SharedMapCommandCanvasRenderer;
      this.mapCommandRenderer = options.mapCommandRenderer || (MapCommandRendererClass ? new MapCommandRendererClass({ host: this }) : null);
      const TabBarRendererClass = options.tabBarRendererClass || SharedTabBarCanvasRenderer;
      this.tabBarRenderer = options.tabBarRenderer || (TabBarRendererClass ? new TabBarRendererClass({ host: this }) : null);
      const HudTabPageRendererClass = options.hudTabPageRendererClass || SharedHudTabPageCanvasRenderer;
      this.hudTabPageRenderer = options.hudTabPageRenderer || (HudTabPageRendererClass ? new HudTabPageRendererClass({ host: this }) : null);
      const HudOverlayRendererClass = options.hudOverlayRendererClass || SharedHudOverlayCanvasRenderer;
      this.hudOverlayRenderer = options.hudOverlayRenderer || (HudOverlayRendererClass ? new HudOverlayRendererClass({ host: this }) : null);
      this.fpsLastPaintAt = 0;
      this.fpsLastPaintedValue = 0;
      this.showFpsOverlay = options.showFpsOverlay !== false;
      this.lastTechTreeScroll = null;
      if (this.ctx && typeof this.ctx.scale === 'function') this.ctx.scale(1, 1);
    }

    static getFamousPortraitLayerLayout() {
      return sharedFamousPortraitLayout || {};
    }

    static getTileMapAssetManifest() {
      return sharedTileMapManifest || {};
    }

    static getTileMapGeometry() {
      return sharedTileMapGeometry || null;
    }

    static getAssetRequestPath(assetPath) {
      if (!assetPath || typeof assetPath !== 'string') return assetPath;
      if (assetPath.startsWith('assets/art/battle/units/')) {
        const separator = assetPath.includes('?') ? '&' : '?';
        return `${assetPath}${separator}v=${encodeURIComponent(this.getBattleUnitAssetVersion())}`;
      }
      const layout = this.getFamousPortraitLayerLayout();
      const assetVersion = layout.assetVersion;
      if (!assetVersion) return assetPath;
      if (!assetPath.startsWith('assets/art/famous-person/layers/')) return assetPath;
      const separator = assetPath.includes('?') ? '&' : '?';
      return `${assetPath}${separator}v=${encodeURIComponent(assetVersion)}`;
    }

    static getBattleUnitAssetVersion() {
      return 'battle-units-split-v1-20260529';
    }

    static getBattleUnitFrameCount() {
      return 4;
    }

    static getBattleUnitKey(side = 'attacker') {
      return side === 'attacker' ? 'player' : 'enemy';
    }

    static getBattleUnitFramePath(unit = 'player', pose = 'idle', frameIndex = 0, rootPath = '') {
      const safeUnit = unit === 'enemy' ? 'enemy' : 'player';
      const safePose = ['idle', 'move', 'attack', 'die'].includes(pose) ? pose : 'idle';
      const count = this.getBattleUnitFrameCount();
      const index = Math.max(0, Math.min(count - 1, Math.floor(Number(frameIndex) || 0)));
      const file = `${String(index + 1).padStart(2, '0')}.png`;
      const root = rootPath && !String(rootPath).endsWith('.png')
        ? String(rootPath).replace(/\/+$/, '')
        : `assets/art/battle/units/${safeUnit}`;
      return `${root}/${safePose}/${file}`;
    }

    static getBattleUnitFramePaths() {
      const poses = ['idle', 'move', 'attack', 'die'];
      const paths = [];
      ['player', 'enemy'].forEach((unit) => {
        poses.forEach((pose) => {
          for (let index = 0; index < this.getBattleUnitFrameCount(); index += 1) {
            paths.push(this.getBattleUnitFramePath(unit, pose, index));
          }
        });
      });
      return paths;
    }

    static getPreloadAssetPaths() {
      return [
        'assets/art/civilization-bg.webp',
        'assets/art/icon-home-cutout.png',
        'assets/art/icon-fire-cutout.webp',
        'assets/art/icon-wood-cutout.webp',
        'assets/art/icon-iron-cutout.webp',
        'assets/art/icon-stone-cutout.webp',
        'assets/art/icon-food-cutout.webp',
        'assets/art/icon-knowledge-cutout.webp',
        'assets/art/icon-population-cutout.webp',
        'assets/art/icon-happiness-cutout.webp',
        'assets/art/icon-farmer-cutout.webp',
        'assets/art/icon-scholar-cutout.webp',
        'assets/art/icon-craftsman-cutout.webp',
        'assets/art/icon-science-cutout.webp',
        'assets/art/icon-soldier-cutout.webp',
        'assets/art/icon-event-cutout.webp',
        'assets/art/tech-agriculture-cutout.png',
        'assets/art/tech-livelihood-cutout.png',
        'assets/art/tech-administration-cutout.png',
        'assets/art/tech-knowledge-cutout.png',
        'assets/art/tech-culture-cutout.png',
        'assets/art/tech-engineering-cutout.png',
        'assets/art/tech-industry-cutout.png',
        'assets/art/tech-exploration-cutout.png',
        'assets/art/tech-trade-cutout.png',
        'assets/art/tech-military-cutout.png',
        'assets/art/building-house-cutout.png',
        'assets/art/building-farm-cutout.png',
        'assets/art/building-lumbermill-cutout.png',
        'assets/art/building-barracks-cutout.png',
        'assets/art/building-academy-cutout.png',
        'assets/art/building-workshop-cutout.png',
        'assets/art/building-temple-cutout.png',
        'assets/art/building-watchtower-cutout.png',
        'assets/art/world-site-camp-cutout.png',
        'assets/art/world-site-city-cutout.png',
        'assets/art/world-site-outpost-cutout.png',
        'assets/art/world-site-ruins-cutout.png',
        'assets/art/world-site-town-cutout.png',
        'assets/art/spine/tutorial/advisor/tutorial_advisor.png',
        'assets/art/battle/battlefield-forest-camp.png',
        ...(this.getTileMapAssetManifest().getPreloadAssetPaths?.() || []),
        ...this.getBattleUnitFramePaths(),
        ...Object.values(this.getFamousPortraitLayerLayout().layers || {})
          .map((layer) => layer?.file)
          .filter(Boolean)
          .map((file) => `assets/art/famous-person/layers/${file}`),
      ];
    }

    getPreloadAssetPaths() {
      return this.constructor.getPreloadAssetPaths();
    }

    setPresenter(presenter) {
      this.presenter = presenter;
    }

    delegateSurfaceRenderer(method, args = []) {
      const renderer = this.surfaceRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...Array.from(args));
    }

    hasSurfaceRendererMethod(method) {
      const renderer = this.surfaceRenderer;
      return Boolean(renderer && typeof renderer[method] === 'function');
    }

    getLayout(...args) {
      const result = this.delegateSurfaceRenderer('getLayout', args);
      if (result !== undefined) return result;
      const contentWidth = Math.min(this.maxContentWidth, Math.max(300, this.width - this.edgePadding * 2));
      const contentX = Math.max(this.edgePadding, Math.floor((this.width - contentWidth) / 2));
      return { contentX, contentWidth, contentRight: contentX + contentWidth };
    }

    createGradient(...args) {
      const result = this.delegateSurfaceRenderer('createGradient', args);
      return result === undefined ? (args[5] || '#000') : result;
    }

    createRadialGradient(...args) {
      const result = this.delegateSurfaceRenderer('createRadialGradient', args);
      return result === undefined ? (args[7] || '#000') : result;
    }

    roundRectPath(...args) {
      return this.delegateSurfaceRenderer('roundRectPath', args);
    }

    createImage(src) {
      return null;
    }

    delegateAssetRenderer(method, args = []) {
      const renderer = this.assetRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...Array.from(args));
    }

    hasAssetRendererMethod(method) {
      const renderer = this.assetRenderer;
      return Boolean(renderer && typeof renderer[method] === 'function');
    }

    preloadAssets(...args) {
      const result = this.delegateAssetRenderer('preloadAssets', args);
      if (result !== undefined) return result;
      const paths = Array.from(new Set((args[0] || this.getPreloadAssetPaths() || []).filter(Boolean)));
      args[1]?.({ total: paths.length, completed: paths.length, loaded: 0, failed: paths.length, percentage: 100 });
      return Promise.resolve({ total: paths.length, completed: paths.length, loaded: 0, failed: paths.length, percentage: 100 });
    }

    isWorldTilePrewarmMetricAssetPath(...args) {
      const result = this.delegateAssetRenderer('isWorldTilePrewarmMetricAssetPath', args);
      return result === undefined ? false : result;
    }

    isWorldTileTemplateAssetPath(...args) {
      const result = this.delegateAssetRenderer('isWorldTileTemplateAssetPath', args);
      return result === undefined ? false : result;
    }

    isWorldTileWaterTemplateAssetPath(...args) {
      const result = this.delegateAssetRenderer('isWorldTileWaterTemplateAssetPath', args);
      return result === undefined ? false : result;
    }

    prewarmWorldTileCaches(...args) {
      const result = this.delegateAssetRenderer('prewarmWorldTileCaches', args);
      return result === undefined ? { total: 0, metrics: 0, masks: 0, dryTemplates: 0 } : result;
    }

    getAsset(...args) {
      const result = this.delegateAssetRenderer('getAsset', args);
      return result === undefined ? null : result;
    }

    setHitTargets(...args) {
      if (this.hasSurfaceRendererMethod('setHitTargets')) {
        return this.delegateSurfaceRenderer('setHitTargets', args);
      }
      this.hitTargets = args[0] || [];
      return undefined;
    }

    addHitTarget(...args) {
      if (this.hasSurfaceRendererMethod('addHitTarget')) {
        return this.delegateSurfaceRenderer('addHitTarget', args);
      }
      const [rect, action] = args;
      if (this.suppressHitTargets) return undefined;
      if (!action || !rect) return;
      this.hitTargets.push({
        x: Number(rect.x) || 0,
        y: Number(rect.y) || 0,
        width: Number(rect.width) || 0,
        height: Number(rect.height) || 0,
        action,
      });
    }

    getHitTarget(...args) {
      const result = this.delegateSurfaceRenderer('getHitTarget', args);
      return result === undefined ? null : result;
    }

    containsPoint(...args) {
      const result = this.delegateSurfaceRenderer('containsPoint', args);
      return result === undefined ? false : result;
    }

    setHoverPoint(...args) {
      const result = this.delegateSurfaceRenderer('setHoverPoint', args);
      return result === undefined ? false : result;
    }

    delegateFamousRenderer(method, args = []) {
      const renderer = this.famousRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...Array.from(args));
    }

    isSameFamousSkillTooltipAction(...args) {
      const result = this.delegateFamousRenderer('isSameFamousSkillTooltipAction', args);
      return result === undefined ? false : result;
    }

    clearFamousSkillTooltip(...args) {
      const result = this.delegateFamousRenderer('clearFamousSkillTooltip', args);
      if (result !== undefined) return result;
      const changed = Boolean(this.hoverPoint || this.activeFamousSkillTooltip || this.pinnedFamousSkillTooltip);
      this.hoverPoint = null;
      this.activeFamousSkillTooltip = null;
      this.pinnedFamousSkillTooltip = null;
      return changed;
    }

    setPinnedFamousSkillTooltip(...args) {
      const result = this.delegateFamousRenderer('setPinnedFamousSkillTooltip', args);
      return result === undefined ? this.clearFamousSkillTooltip() : result;
    }

    getFamousSkillTooltipAction(...args) {
      const result = this.delegateFamousRenderer('getFamousSkillTooltipAction', args);
      return result === undefined ? null : result;
    }

    isAllowedUnderTutorialShield(...args) {
      const result = this.delegateSurfaceRenderer('isAllowedUnderTutorialShield', args);
      return result === undefined ? false : result;
    }

    matchesTutorialShieldAllowedAction(...args) {
      const result = this.delegateSurfaceRenderer('matchesTutorialShieldAllowedAction', args);
      return result === undefined ? false : result;
    }

    matchesCurrentTutorialIntroAction(...args) {
      const result = this.delegateSurfaceRenderer('matchesCurrentTutorialIntroAction', args);
      return result === undefined ? false : result;
    }

    withSuppressedHitTargets(...args) {
      const result = this.delegateSurfaceRenderer('withSuppressedHitTargets', args);
      return result === undefined ? args[0]?.() : result;
    }

    withSlideClip(...args) {
      const result = this.delegateSurfaceRenderer('withSlideClip', args);
      return result === undefined ? args[5]?.() : result;
    }

    withTranslatedClip(...args) {
      const result = this.delegateSurfaceRenderer('withTranslatedClip', args);
      return result === undefined ? args[6]?.() : result;
    }

    withTransformedClip(...args) {
      const result = this.delegateSurfaceRenderer('withTransformedClip', args);
      return result === undefined ? args[7]?.() : result;
    }

    setAssetsChangedHandler(...args) {
      const result = this.delegateAssetRenderer('setAssetsChangedHandler', args);
      if (result !== undefined || this.hasAssetRendererMethod('setAssetsChangedHandler')) return result;
      this.assetsChangedHandler = typeof args[0] === 'function' ? args[0] : null;
      return undefined;
    }

    handleAssetsChanged(...args) {
      const result = this.delegateAssetRenderer('handleAssetsChanged', args);
      if (result !== undefined || this.hasAssetRendererMethod('handleAssetsChanged')) return result;
      this.invalidateWorldTileCaches();
      if (this.assetsChangedHandler) this.assetsChangedHandler();
      return undefined;
    }

    invalidateWorldTileCaches(...args) {
      const result = this.delegateAssetRenderer('invalidateWorldTileCaches', args);
      if (result !== undefined || this.hasAssetRendererMethod('invalidateWorldTileCaches')) return result;
      this.invalidateWorldTileViewCache();
      return undefined;
    }

    hasPreparedWorldTileSnapshotCache(...args) {
      const result = this.delegateAssetRenderer('hasPreparedWorldTileSnapshotCache', args);
      return result === undefined ? false : result;
    }

    invalidateWorldTileViewCache(...args) {
      const result = this.delegateAssetRenderer('invalidateWorldTileViewCache', args);
      if (result !== undefined || this.hasAssetRendererMethod('invalidateWorldTileViewCache')) return result;
      this.worldTileViewCache = null;
      this.worldTileVisibleEntriesCache = null;
      this.worldTileLocalEntriesCache = null;
      return undefined;
    }

    drawAsset(...args) {
      const result = this.delegateAssetRenderer('drawAsset', args);
      return result === undefined ? false : result;
    }

    drawAssetClipped(...args) {
      const result = this.delegateAssetRenderer('drawAssetClipped', args);
      return result === undefined ? false : result;
    }

    getFallbackAssetMetrics(...args) {
      const result = this.delegateAssetRenderer('getFallbackAssetMetrics', args);
      if (result !== undefined) return result;
      const [image] = args;
      const width = Number(image?.naturalWidth || image?.width || 1) || 1;
      const height = Number(image?.naturalHeight || image?.height || 1) || 1;
      return { x: 0, y: 0, width, height, sourceWidth: width, sourceHeight: height };
    }

    isOpaquePixel(...args) {
      const result = this.delegateAssetRenderer('isOpaquePixel', args);
      return result === undefined ? false : result;
    }

    isWorldTileTemplateWaterPixel(...args) {
      const result = this.delegateAssetRenderer('isWorldTileTemplateWaterPixel', args);
      return result === undefined ? false : result;
    }

    measurePixelBounds(...args) {
      const result = this.delegateAssetRenderer('measurePixelBounds', args);
      return result === undefined ? null : result;
    }

    analyzeAssetAlphaBounds(...args) {
      const result = this.delegateAssetRenderer('analyzeAssetAlphaBounds', args);
      return result === undefined ? this.getFallbackAssetMetrics(null) : result;
    }

    getIsoTileSourceRect(...args) {
      const result = this.delegateAssetRenderer('getIsoTileSourceRect', args);
      return result === undefined ? null : result;
    }

    getWorldTileTemplateMetrics(...args) {
      const result = this.delegateAssetRenderer('getWorldTileTemplateMetrics', args);
      return result === undefined ? null : result;
    }

    drawTileAsset(...args) {
      const result = this.delegateAssetRenderer('drawTileAsset', args);
      return result === undefined ? false : result;
    }

    getTemplateCanvasFactory(...args) {
      const result = this.delegateAssetRenderer('getTemplateCanvasFactory', args);
      return result === undefined ? null : result;
    }

    createTileWorkCanvas(...args) {
      const result = this.delegateAssetRenderer('createTileWorkCanvas', args);
      return result === undefined ? null : result;
    }

    createTutorialSpineCanvas(...args) {
      const result = this.delegateAssetRenderer('createTutorialSpineCanvas', args);
      return result === undefined ? null : result;
    }

    delegateWorldTileWaterRenderer(method, args = []) {
      const renderer = this.worldTileWaterRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...Array.from(args));
    }

    isInsideTemplateDiamond(...args) {
      const result = this.delegateWorldTileWaterRenderer('isInsideTemplateDiamond', args);
      if (result !== undefined) return result;
      const [x, y, metrics] = args;
      const centerX = metrics.x + metrics.width * 0.5;
      const centerY = metrics.y + metrics.height * 0.5;
      const halfW = metrics.width * 0.5;
      const halfH = metrics.height * 0.5;
      return Math.abs(x - centerX) / Math.max(1, halfW) + Math.abs(y - centerY) / Math.max(1, halfH) <= 1.03;
    }

    createWorldTileColorWaterMask(...args) {
      const result = this.delegateWorldTileWaterRenderer('createWorldTileColorWaterMask', args);
      return result === undefined ? null : result;
    }

    createWorldTileTransparentWaterMask(...args) {
      const result = this.delegateWorldTileWaterRenderer('createWorldTileTransparentWaterMask', args);
      return result === undefined ? null : result;
    }

    getWorldTileTemplateMask(...args) {
      const result = this.delegateWorldTileWaterRenderer('getWorldTileTemplateMask', args);
      return result === undefined ? null : result;
    }

    getWorldTileDryTemplateCanvas(...args) {
      const result = this.delegateWorldTileWaterRenderer('getWorldTileDryTemplateCanvas', args);
      return result === undefined ? null : result;
    }

    drawCanvasClipped(...args) {
      const result = this.delegateAssetRenderer('drawCanvasClipped', args);
      return result === undefined ? false : result;
    }

    getWorldTileCompositeContext(...args) {
      const result = this.delegateWorldTileWaterRenderer('getWorldTileCompositeContext', args);
      return result === undefined ? null : result;
    }

    drawWorldTileTemplateSource(...args) {
      const result = this.delegateWorldTileWaterRenderer('drawWorldTileTemplateSource', args);
      return result === undefined ? false : result;
    }

    drawWorldTileDryTemplate(...args) {
      const result = this.delegateWorldTileWaterRenderer('drawWorldTileDryTemplate', args);
      return result === undefined ? false : result;
    }

    getWorldTileTemplateBaseAsset(...args) {
      const result = this.delegateWorldTileWaterRenderer('getWorldTileTemplateBaseAsset', args);
      return result === undefined ? null : result;
    }

    getWorldTileWaterTemplateAssets(...args) {
      const result = this.delegateWorldTileWaterRenderer('getWorldTileWaterTemplateAssets', args);
      return result === undefined ? [] : result;
    }

    getWorldTileWaterWorkContext(...args) {
      const result = this.delegateWorldTileWaterRenderer('getWorldTileWaterWorkContext', args);
      return result === undefined ? null : result;
    }

    positiveModulo(...args) {
      const result = this.delegateWorldTileWaterRenderer('positiveModulo', args);
      if (result !== undefined) return result;
      const [value, size] = args;
      return ((value % size) + size) % size;
    }

    getWorldTileMapPosition(...args) {
      const result = this.delegateWorldTileWaterRenderer('getWorldTileMapPosition', args);
      if (result !== undefined) return result;
      const [tile = {}, geometry = {}] = args;
      const helper = this.constructor.getTileMapGeometry();
      if (helper?.projectTile) return helper.projectTile(tile, geometry);
      const stepX = Number(geometry.stepX) || 96;
      const stepY = Number(geometry.stepY) || 48;
      const q = Number(tile.q) || 0;
      const r = Number(tile.r) || 0;
      return {
        x: (q - r) * stepX,
        y: (q + r) * stepY,
      };
    }

    fillWorldTileWaterTexture(...args) {
      const result = this.delegateWorldTileWaterRenderer('fillWorldTileWaterTexture', args);
      return result === undefined ? false : result;
    }

    drawWorldTileWaterDiamond(...args) {
      const result = this.delegateWorldTileWaterRenderer('drawWorldTileWaterDiamond', args);
      return result === undefined ? false : result;
    }

    drawWorldTileWaterLayer(...args) {
      const result = this.delegateWorldTileWaterRenderer('drawWorldTileWaterLayer', args);
      return result === undefined ? false : result;
    }

    drawWorldTileWater(...args) {
      const result = this.delegateWorldTileWaterRenderer('drawWorldTileWater', args);
      return result === undefined ? false : result;
    }

    isWorldTileMapWaterAnimated(...args) {
      const result = this.delegateWorldTileWaterRenderer('isWorldTileMapWaterAnimated', args);
      if (result !== undefined) return result;
      const [tileMapView = {}] = args;
      return (tileMapView.tiles || []).some((tile) => tile.water?.asset);
    }

    resolveWorldTileMapView(territoryState = {}, uiState = {}, options = {}) {
      if (!this.presenter?.buildWorldTileMapViewState) return null;
      const panX = Number(uiState.worldPanX) || 0;
      const panY = Number(uiState.worldPanY) || 0;
      const cached = this.worldTileViewCache;
      const canReuse = Boolean(options.reuseCachedWorldTileView
        && cached
        && cached.territoryState === territoryState);
      if (canReuse) {
        cached.view.pan = { x: panX, y: panY };
        return cached.view;
      }
      const view = this.presenter.buildWorldTileMapViewState(territoryState, { panX, panY });
      this.worldTileViewCache = {
        territoryState,
        signature: view?.signature || '',
        view,
      };
      return view;
    }

    drawWorldTileBase(tile = {}, center = {}, drawRect = {}, viewport = {}) {
      const result = this.delegateWorldTileWaterRenderer('drawWorldTileBase', arguments);
      if (result !== undefined) return result;
      const baseTemplate = this.getWorldTileTemplateBaseAsset(tile);
      const baseAsset = baseTemplate?.asset || tile.terrainAsset || '';
      const hasWater = Boolean(tile.water?.kind && tile.water?.asset && baseTemplate?.asset);
      const drawnWater = hasWater ? this.drawWorldTileWater(tile, center, drawRect, viewport) : false;
      if (drawnWater) return true;
      return this.drawTileAsset(baseAsset, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
    }

    drawCoverAsset(...args) {
      const result = this.delegateAssetRenderer('drawCoverAsset', args);
      return result === undefined ? false : result;
    }

    drawFamousPortraitLayer(...args) {
      const result = this.delegateFamousRenderer('drawFamousPortraitLayer', args);
      return result === undefined ? false : result;
    }

    drawFamousPortrait(...args) {
      const result = this.delegateFamousRenderer('drawFamousPortrait', args);
      return result === undefined ? false : result;
    }

    drawFamousAttributeRadar(...args) {
      const result = this.delegateFamousRenderer('drawFamousAttributeRadar', args);
      return result === undefined ? undefined : result;
    }

    drawFamousAttributePointControls(...args) {
      const result = this.delegateFamousRenderer('drawFamousAttributePointControls', args);
      return result === undefined ? 0 : result;
    }

    getFamousQualityStyle(...args) {
      const result = this.delegateFamousRenderer('getFamousQualityStyle', args);
      return result === undefined ? { fill: 'rgba(43, 43, 42, 0.96)', stroke: '#d9d8cf', inset: 'rgba(255, 255, 255, 0.18)', glow: 'rgba(255, 255, 255, 0.1)', text: '#eeeee8' } : result;
    }

    drawFamousAvatarCard(...args) {
      const result = this.delegateFamousRenderer('drawFamousAvatarCard', args);
      return result === undefined ? undefined : result;
    }

    renderFamousRosterGrid(...args) {
      const result = this.delegateFamousRenderer('renderFamousRosterGrid', args);
      return result === undefined ? { nextY: args[2] || 0, pageInfo: { index: 0, pages: 1 } } : result;
    }

    renderFamousPersonDetail(...args) {
      const result = this.delegateFamousRenderer('renderFamousPersonDetail', args);
      return result === undefined ? undefined : result;
    }

    delegateBattleRenderer(method, args = []) {
      const renderer = this.battleRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...Array.from(args));
    }

    getBattleUnitPose(...args) {
      const result = this.delegateBattleRenderer('getBattleUnitPose', args);
      return result === undefined ? 'idle' : result;
    }

    getBattleTurnSoldierCount(...args) {
      const result = this.delegateBattleRenderer('getBattleTurnSoldierCount', args);
      return result === undefined ? Number(args[3]) || 0 : result;
    }

    isBattleSideDefeatedByTurn(...args) {
      const result = this.delegateBattleRenderer('isBattleSideDefeatedByTurn', args);
      return result === undefined ? false : result;
    }

    getBattlePlaybackPhase(...args) {
      const result = this.delegateBattleRenderer('getBattlePlaybackPhase', args);
      return result === undefined ? { phase: 'ended', phaseProgress: 1 } : result;
    }

    getBattleEngagementProgress(...args) {
      const result = this.delegateBattleRenderer('getBattleEngagementProgress', args);
      return result === undefined ? 1 : result;
    }

    getBattleUnitFormationPosition(...args) {
      const result = this.delegateBattleRenderer('getBattleUnitFormationPosition', args);
      return result === undefined ? { x: 0, y: 0, col: 0, row: 0 } : result;
    }

    getBattleUnitEngagementPosition(...args) {
      const result = this.delegateBattleRenderer('getBattleUnitEngagementPosition', args);
      return result === undefined ? { x: 0, y: 0, scale: 0.21 } : result;
    }

    easeBattleUnitProgress(...args) {
      const result = this.delegateBattleRenderer('easeBattleUnitProgress', args);
      return result === undefined ? 0 : result;
    }

    getBattleUnitEngagementDelay(...args) {
      const result = this.delegateBattleRenderer('getBattleUnitEngagementDelay', args);
      return result === undefined ? 0 : result;
    }

    getBattleUnitEngagementRatio(...args) {
      const result = this.delegateBattleRenderer('getBattleUnitEngagementRatio', args);
      return result === undefined ? 1 : result;
    }

    getBattleUnitBattlefieldPosition(...args) {
      const result = this.delegateBattleRenderer('getBattleUnitBattlefieldPosition', args);
      return result === undefined ? { x: 0, y: 0, formation: {}, engaged: {}, ratio: 1 } : result;
    }

    getBattleUnitSpec(...args) {
      const result = this.delegateBattleRenderer('getBattleUnitSpec', args);
      return result === undefined ? { unit: 'player', root: 'assets/art/battle/units/player', frameCount: this.constructor.getBattleUnitFrameCount(), width: 500, height: 400 } : result;
    }

    getBattleFramePose(...args) {
      const result = this.delegateBattleRenderer('getBattleFramePose', args);
      return result === undefined ? 'idle' : result;
    }

    getBattleFrameIndex(...args) {
      const result = this.delegateBattleRenderer('getBattleFrameIndex', args);
      return result === undefined ? 0 : result;
    }

    getBattleFrameSpritePath(...args) {
      const result = this.delegateBattleRenderer('getBattleFrameSpritePath', args);
      return result === undefined ? this.constructor.getBattleUnitFramePath('player', 'idle', 0) : result;
    }

    getBattleSideSpritePath(...args) {
      const result = this.delegateBattleRenderer('getBattleSideSpritePath', args);
      return result === undefined ? 'assets/art/battle/units/player' : result;
    }

    drawBattleMapBackground(...args) {
      const result = this.delegateBattleRenderer('drawBattleMapBackground', args);
      return result === undefined ? undefined : result;
    }

    drawBattleSoldierFrame(...args) {
      const result = this.delegateBattleRenderer('drawBattleSoldierFrame', args);
      return result === undefined ? false : result;
    }

    drawBattleSoldierFallback(...args) {
      const result = this.delegateBattleRenderer('drawBattleSoldierFallback', args);
      return result === undefined ? undefined : result;
    }

    drawBattleSoldierSprite(...args) {
      const result = this.delegateBattleRenderer('drawBattleSoldierSprite', args);
      return result === undefined ? undefined : result;
    }

    drawBattleSoldier(...args) {
      const result = this.delegateBattleRenderer('drawBattleSoldier', args);
      return result === undefined ? undefined : result;
    }

    drawBattleArmy(...args) {
      const result = this.delegateBattleRenderer('drawBattleArmy', args);
      return result === undefined ? undefined : result;
    }

    getBattleStatusBadgeColors(...args) {
      const result = this.delegateBattleRenderer('getBattleStatusBadgeColors', args);
      return result === undefined ? undefined : result;
    }

    drawBattleSideState(...args) {
      const result = this.delegateBattleRenderer('drawBattleSideState', args);
      return result === undefined ? undefined : result;
    }

    drawBattleActionEffect(...args) {
      const result = this.delegateBattleRenderer('drawBattleActionEffect', args);
      return result === undefined ? undefined : result;
    }

    drawBattleSkillCutIn(...args) {
      const result = this.delegateBattleRenderer('drawBattleSkillCutIn', args);
      return result === undefined ? undefined : result;
    }

    getBattleTurnDamage(...args) {
      const result = this.delegateBattleRenderer('getBattleTurnDamage', args);
      return result === undefined ? undefined : result;
    }

    getBattleDamageFloatText(...args) {
      const result = this.delegateBattleRenderer('getBattleDamageFloatText', args);
      return result === undefined ? undefined : result;
    }

    drawBattleDamageFloat(...args) {
      const result = this.delegateBattleRenderer('drawBattleDamageFloat', args);
      return result === undefined ? undefined : result;
    }

    drawBattleStatusFloatingTexts(...args) {
      const result = this.delegateBattleRenderer('drawBattleStatusFloatingTexts', args);
      return result === undefined ? undefined : result;
    }

    drawBattleLeader(...args) {
      const result = this.delegateBattleRenderer('drawBattleLeader', args);
      return result === undefined ? undefined : result;
    }

    renderBattleSceneOverlay(...args) {
      const result = this.delegateBattleRenderer('renderBattleSceneOverlay', args);
      return result === undefined ? false : result;
    }

    clear(...args) {
      return this.delegateSurfaceRenderer('clear', args);
    }

    clearAll(...args) {
      return this.delegateSurfaceRenderer('clearAll', args);
    }

    drawText(...args) {
      return this.delegateSurfaceRenderer('drawText', args);
    }

    drawTextLines(...args) {
      return this.delegateSurfaceRenderer('drawTextLines', args);
    }

    wrapText(...args) {
      const result = this.delegateSurfaceRenderer('wrapText', args);
      return result === undefined ? [String(args[0] ?? '')].filter(Boolean) : result;
    }

    measureTextWidth(...args) {
      const result = this.delegateSurfaceRenderer('measureTextWidth', args);
      const [text, options = {}] = args;
      return result === undefined ? String(text ?? '').length * (options.size || 14) * 0.55 : result;
    }

    truncateText(...args) {
      const result = this.delegateSurfaceRenderer('truncateText', args);
      const [text, maxWidth, options = {}] = args;
      return result === undefined ? String(text ?? '').slice(0, Math.max(0, Number(maxWidth) || 0) || undefined) : result;
    }

    wrapTextLimit(...args) {
      const result = this.delegateSurfaceRenderer('wrapTextLimit', args);
      return result === undefined ? this.wrapText(args[0], args[1], args[3]).slice(0, Math.max(1, Number(args[2]) || 1)) : result;
    }

    drawLine(...args) {
      return this.delegateSurfaceRenderer('drawLine', args);
    }

    drawPolyline(...args) {
      return this.delegateSurfaceRenderer('drawPolyline', args);
    }

    drawCurvePath(...args) {
      return this.delegateSurfaceRenderer('drawCurvePath', args);
    }

    drawCircle(...args) {
      return this.delegateSurfaceRenderer('drawCircle', args);
    }

    beginFrame(...args) {
      const result = this.delegateSurfaceRenderer('beginFrame', args);
      return result === undefined ? Date.now() : result;
    }

    endFrame(...args) {
      return this.delegateSurfaceRenderer('endFrame', args);
    }

    getNow(...args) {
      const result = this.delegateSurfaceRenderer('getNow', args);
      return result === undefined ? (this.frameNow || Date.now()) : result;
    }

    updateFps(...args) {
      const result = this.delegateSurfaceRenderer('updateFps', args);
      return result === undefined ? this.currentFps : result;
    }

    renderFpsOverlay(...args) {
      return this.delegateSurfaceRenderer('renderFpsOverlay', args);
    }

    drawPanel(...args) {
      return this.delegateSurfaceRenderer('drawPanel', args);
    }

    drawButton(...args) {
      return this.delegateSurfaceRenderer('drawButton', args);
    }

    drawPrimaryActionButton(...args) {
      return this.delegateSurfaceRenderer('drawPrimaryActionButton', args);
    }

    drawProgressBar(...args) {
      return this.delegateSurfaceRenderer('drawProgressBar', args);
    }

    drawIconCard(...args) {
      return this.delegateSurfaceRenderer('drawIconCard', args);
    }

    renderSectionHeader(...args) {
      return this.delegateSurfaceRenderer('renderSectionHeader', args);
    }

    getTopBarBottom(...args) {
      const result = this.delegateSurfaceRenderer('getTopBarBottom', args);
      if (result !== undefined) return result;
      const [state = {}, options = {}] = args;
      if (options.isMapHome) return 72;
      if (!this.presenter) return 84;
      const cityView = this.presenter.buildCitySwitcherViewState ? this.presenter.buildCitySwitcherViewState(state) : { hidden: true };
      return 12 + (cityView.hidden ? 128 : 166) + 12;
    }

    delegateHomeRenderer(method, args = []) {
      const renderer = this.homeRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    }

    renderTopBar(...args) {
      const result = this.delegateHomeRenderer('renderTopBar', args);
      return result === undefined ? 84 : result;
    }

    renderMapHomeTopBar(...args) {
      const result = this.delegateHomeRenderer('renderMapHomeTopBar', args);
      return result === undefined ? 72 : result;
    }

    delegateGuideTaskRenderer(method, args = []) {
      const renderer = this.guideTaskRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    }

    renderGuideTasks(...args) {
      const result = this.delegateGuideTaskRenderer('renderGuideTasks', args);
      return result === undefined ? (args.length > 1 ? args[1] : 0) : result;
    }

    renderTaskCenterButton(...args) {
      return this.delegateGuideTaskRenderer('renderTaskCenterButton', args);
    }

    renderGuidebookButton(...args) {
      return this.delegateGuideTaskRenderer('renderGuidebookButton', args);
    }

    renderGuidebookPanel(...args) {
      const result = this.delegateGuideTaskRenderer('renderGuidebookPanel', args);
      return result === undefined ? false : result;
    }

    renderTaskCenterPanel(...args) {
      const result = this.delegateGuideTaskRenderer('renderTaskCenterPanel', args);
      return result === undefined ? false : result;
    }

    renderPopulation(...args) {
      const result = this.delegateHomeRenderer('renderPopulation', args);
      return result === undefined ? (Number(args[1]) || 84) + 180 : result;
    }

    renderHomeFeatureGrid(...args) {
      const result = this.delegateHomeRenderer('renderHomeFeatureGrid', args);
      return result === undefined ? (Number(args[1]) || 400) : result;
    }

    delegateSystemRenderer(method, args = []) {
      const renderer = this.systemRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    }

    renderLoginPanel(...args) {
      return this.delegateSystemRenderer('renderLoginPanel', args);
    }

    renderLoadingScreen(...args) {
      return this.delegateSystemRenderer('renderLoadingScreen', args);
    }

    renderNetworkOverlay(...args) {
      const result = this.delegateSystemRenderer('renderNetworkOverlay', args);
      return result === undefined ? false : result;
    }

    renderSettingsPanel(...args) {
      return this.delegateSystemRenderer('renderSettingsPanel', args);
    }

    renderLogsPanel(...args) {
      return this.delegateSystemRenderer('renderLogsPanel', args);
    }

    delegateCityRenderer(method, args = []) {
      const renderer = this.cityRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    }

    getActiveCitySummary(...args) {
      const result = this.delegateCityRenderer('getActiveCitySummary', args);
      return result === undefined ? {
        id: 'capital',
        name: '首都',
        tag: '主城',
        level: '',
        population: {},
        military: {},
        terrainLabel: '平原',
      } : result;
    }

    renderCitySwitcherMenu(...args) {
      return this.delegateCityRenderer('renderCitySwitcherMenu', args);
    }

    renderCityManagementPanel(...args) {
      return this.delegateCityRenderer('renderCityManagementPanel', args);
    }

    renderCityMilitaryPanel(...args) {
      return this.delegateCityRenderer('renderCityMilitaryPanel', args);
    }

    renderSubcityListPanel(...args) {
      return this.delegateCityRenderer('renderSubcityListPanel', args);
    }

    delegateOverlayRenderer(method, args = []) {
      const renderer = this.overlayRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    }

    renderNamingModal(...args) {
      return this.delegateOverlayRenderer('renderNamingModal', args);
    }

    renderFloatingTexts(...args) {
      return this.delegateOverlayRenderer('renderFloatingTexts', args);
    }

    drawRewardParticle(...args) {
      return this.delegateOverlayRenderer('drawRewardParticle', args);
    }

    renderRewardReveal(...args) {
      return this.delegateOverlayRenderer('renderRewardReveal', args);
    }

    renderResourceDetailsPanel(...args) {
      return this.delegateOverlayRenderer('renderResourceDetailsPanel', args);
    }

    delegateAdvisorRenderer(method, args = []) {
      const renderer = this.advisorRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    }

    renderAdvisor(...args) {
      return this.delegateAdvisorRenderer('renderAdvisor', args);
    }

    getMapHomeFloatingButtonLayout(...args) {
      const result = this.delegateAdvisorRenderer('getMapHomeFloatingButtonLayout', args);
      return result === undefined ? { x: 0, y: 0, size: 48 } : result;
    }

    renderFloatingAdvisorButton(...args) {
      return this.delegateAdvisorRenderer('renderFloatingAdvisorButton', args);
    }

    renderAdvisorPanel(...args) {
      return this.delegateAdvisorRenderer('renderAdvisorPanel', args);
    }

    renderFamousPersonItem(...args) {
      const result = this.delegateFamousRenderer('renderFamousPersonItem', args);
      return result === undefined ? args[2] || 0 : result;
    }

    renderFamousSkillTooltip(...args) {
      const result = this.delegateFamousRenderer('renderFamousSkillTooltip', args);
      return result === undefined ? undefined : result;
    }

    normalizeFamousPersonsPage(...args) {
      const result = this.delegateFamousRenderer('normalizeFamousPersonsPage', args);
      if (result !== undefined) return result;
      const total = args[0];
      const page = args[1];
      const pageSize = args[2];
      const pages = Math.max(1, Math.ceil(Math.max(0, Number(total) || 0) / Math.max(1, pageSize)));
      const index = Math.max(0, Math.min(pages - 1, Math.floor(Number(page) || 0)));
      return { index, pages };
    }

    renderFamousPersonsPager(...args) {
      const result = this.delegateFamousRenderer('renderFamousPersonsPager', args);
      return result === undefined ? undefined : result;
    }

    renderFamousPersonsPanel(...args) {
      const result = this.delegateFamousRenderer('renderFamousPersonsPanel', args);
      return result === undefined ? false : result;
    }

    renderTalentPolicyPanel(...args) {
      const result = this.delegateFamousRenderer('renderTalentPolicyPanel', args);
      return result === undefined ? false : result;
    }

    delegateArmyFormationEditorRenderer(method, args = []) {
      const renderer = this.armyFormationEditorRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    }

    renderArmyFormationEditor(...args) {
      return this.delegateArmyFormationEditorRenderer('renderArmyFormationEditor', args);
    }

    delegateBuildingRenderer(method, args = []) {
      const renderer = this.buildingRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    }

    renderBuildings(...args) {
      const result = this.delegateBuildingRenderer('renderBuildings', args);
      return result === undefined ? false : result;
    }

    drawBuildingCategoryTabs(...args) {
      const result = this.delegateBuildingRenderer('drawBuildingCategoryTabs', args);
      return result === undefined ? false : result;
    }

    drawBuildingInfoLine(...args) {
      const result = this.delegateBuildingRenderer('drawBuildingInfoLine', args);
      return result === undefined ? false : result;
    }

    drawBuildingPlanningBadges(...args) {
      const result = this.delegateBuildingRenderer('drawBuildingPlanningBadges', args);
      return result === undefined ? false : result;
    }

    resourceShortName(resource) {
      const result = this.delegateBuildingRenderer('resourceShortName', [resource]);
      return result === undefined ? resource : result;
    }

    resourceIconPath(resource) {
      const result = this.delegateBuildingRenderer('resourceIconPath', [resource]);
      return result === undefined ? '' : result;
    }

    buildingCostResourceAliases(resource) {
      const result = this.delegateBuildingRenderer('buildingCostResourceAliases', [resource]);
      return result === undefined ? [resource] : result;
    }

    formatBuildingCostAmount(value) {
      const result = this.delegateBuildingRenderer('formatBuildingCostAmount', [value]);
      return result === undefined ? String(value ?? 0) : result;
    }

    getBuildingCostSlot(...args) {
      const result = this.delegateBuildingRenderer('getBuildingCostSlot', args);
      return result === undefined ? { resource: args[1], value: 0, text: '0', present: false } : result;
    }

    getOwnedBuildingResource(...args) {
      const result = this.delegateBuildingRenderer('getOwnedBuildingResource', args);
      return result === undefined ? 0 : result;
    }

    drawBuildingActionButton(...args) {
      const result = this.delegateBuildingRenderer('drawBuildingActionButton', args);
      return result === undefined ? false : result;
    }

    drawBuildingCostChips(...args) {
      const result = this.delegateBuildingRenderer('drawBuildingCostChips', args);
      return result === undefined ? false : result;
    }

    delegateEventRenderer(method, args = []) {
      const renderer = this.eventRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    }

    eventRowColor(tone) {
      const result = this.delegateEventRenderer('eventRowColor', [tone]);
      return result === undefined ? '#cbbd96' : result;
    }

    drawEventDetailRow(...args) {
      const result = this.delegateEventRenderer('drawEventDetailRow', args);
      return result === undefined ? 0 : result;
    }

    drawEventParts(...args) {
      const result = this.delegateEventRenderer('drawEventParts', args);
      return result === undefined ? false : result;
    }

    renderEvents(...args) {
      const result = this.delegateEventRenderer('renderEvents', args);
      return result === undefined ? false : result;
    }

    renderEventModal(...args) {
      const result = this.delegateEventRenderer('renderEventModal', args);
      return result === undefined ? false : result;
    }

    delegateCivilizationRenderer(method, args = []) {
      const renderer = this.civilizationRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    }

    renderCivilization(...args) {
      return this.delegateCivilizationRenderer('renderCivilization', args);
    }

    delegateTechRenderer(method, args = []) {
      const renderer = this.techRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...Array.from(args));
    }

    getTechRouteCatalog() {
      return this.delegateTechRenderer('getTechRouteCatalog', arguments) || {};
    }

    getTechRouteMeta(route) {
      return this.delegateTechRenderer('getTechRouteMeta', arguments) || { lane: 0, label: route || 'route', color: '#f0b45b', icon: 'assets/art/icon-science-cutout.webp' };
    }

    getTechNodeRoutes(node = {}) {
      return this.delegateTechRenderer('getTechNodeRoutes', arguments) || [];
    }

    getTechNodeRouteLabel(node = {}) {
      return this.delegateTechRenderer('getTechNodeRouteLabel', arguments) || node.routeLabel || 'route';
    }

    getTechNodePrimaryRoute(node = {}) {
      return this.delegateTechRenderer('getTechNodePrimaryRoute', arguments) || node.route || '';
    }

    getTechNodeLane(node = {}) {
      const lane = this.delegateTechRenderer('getTechNodeLane', arguments);
      return Number.isFinite(Number(lane)) ? Number(lane) : 0;
    }

    drawTechRouteSegments(...args) {
      return this.delegateTechRenderer('drawTechRouteSegments', args);
    }

    getTechNodeColor(node = {}) {
      return this.delegateTechRenderer('getTechNodeColor', arguments) || { fill: 'rgba(45, 34, 24, 0.82)', stroke: 'rgba(255, 226, 177, 0.18)', accent: '#f0b45b', text: '#ddd0ad', muted: 'rgba(203, 189, 150, 0.58)' };
    }

    renderTechNode(...args) {
      return this.delegateTechRenderer('renderTechNode', args);
    }

    renderTechDetailPanel(...args) {
      return this.delegateTechRenderer('renderTechDetailPanel', args);
    }

    getTechDetailIcon(detail = {}) {
      return this.delegateTechRenderer('getTechDetailIcon', arguments) || 'assets/art/icon-science-cutout.webp';
    }

    renderTechDetailModal(...args) {
      return this.delegateTechRenderer('renderTechDetailModal', args);
    }

    getTechTreeLayout(view = {}, panel = {}, options = {}) {
      return this.delegateTechRenderer('getTechTreeLayout', arguments) || {
        nodes: [],
        eras: [],
        eraPositions: [],
        nodeRects: {},
        panX: Number(options.techTreePanX) || 0,
        panY: Number(options.techTreePanY) || 0,
        zoom: Math.max(0.65, Math.min(1.6, Number(options.techTreeZoom) || 1)),
        minPanX: 0,
        maxPanX: 0,
        minPanY: 0,
        maxPanY: 0,
        contentHeight: Number(panel.height) || 0,
        scaledContentWidth: Number(panel.width) || 0,
        scaledContentHeight: Number(panel.height) || 0,
        contentLeft: Number(panel.x) || 0,
        contentRight: (Number(panel.x) || 0) + (Number(panel.width) || 0),
        minContentY: Number(panel.y) || 0,
        maxContentY: (Number(panel.y) || 0) + (Number(panel.height) || 0),
        routeGuides: [],
        linkPaths: [],
        eraRailWidth: 0,
        eraRailX: 0,
        routeCatalog: {},
        laneToX: () => Number(panel.x) || 0,
        spineX: (Number(panel.x) || 0) + (Number(panel.width) || 0) / 2,
      };
    }

    renderTech(state = {}, startY = 210, panelHeight = 250, options = {}) {
      if (this.techRenderer && typeof this.techRenderer.render === 'function') {
        return this.techRenderer.render(state, startY, panelHeight, options);
      }
      return this.renderTechInternal(state, startY, panelHeight, options);
    }

    renderTechInternal(...args) {
      return this.delegateTechRenderer('renderTechInternal', args) || false;
    }

    delegateMilitaryRenderer(method, args = []) {
      const renderer = this.militaryRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    }

    renderMilitarySubTabs(...args) {
      const result = this.delegateMilitaryRenderer('renderMilitarySubTabs', args);
      return result === undefined ? 0 : result;
    }

    renderMilitaryArmyView(...args) {
      const result = this.delegateMilitaryRenderer('renderMilitaryArmyView', args);
      return result === undefined ? false : result;
    }

    renderArmyFormationPortrait(...args) {
      const result = this.delegateMilitaryRenderer('renderArmyFormationPortrait', args);
      return result === undefined ? false : result;
    }

    renderArmyFormationCard(...args) {
      const result = this.delegateMilitaryRenderer('renderArmyFormationCard', args);
      return result === undefined ? false : result;
    }

    renderArmyFormationStrip(...args) {
      const result = this.delegateMilitaryRenderer('renderArmyFormationStrip', args);
      return result === undefined ? false : result;
    }

    getScoutButtonTone(...args) {
      const result = this.delegateMilitaryRenderer('getScoutButtonTone', args);
      return result === undefined ? { fill: 'rgba(63, 47, 32, 0.78)', stroke: 'rgba(240, 180, 91, 0.25)' } : result;
    }

    renderMilitaryScoutView(...args) {
      const result = this.delegateMilitaryRenderer('renderMilitaryScoutView', args);
      return result === undefined ? false : result;
    }

    renderWorldReports(...args) {
      const result = this.delegateMilitaryRenderer('renderWorldReports', args);
      return result === undefined ? false : result;
    }

    delegateWorldMapRenderer(method, args = []) {
      const renderer = this.worldMapRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...Array.from(args));
    }

    getWorldTileScreenCenter(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileScreenCenter', args);
      return result === undefined ? { x: 0, y: 0 } : result;
    }

    getWorldTileDrawRect(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileDrawRect', args);
      return result === undefined ? { x: 0, y: 0, width: 0, height: 0 } : result;
    }

    drawIsoDiamond(...args) {
      const result = this.delegateWorldMapRenderer('drawIsoDiamond', args);
      return result === undefined ? false : result;
    }

    getFallbackTerrainFill(...args) {
      const result = this.delegateWorldMapRenderer('getFallbackTerrainFill', args);
      return result === undefined ? 'rgba(90, 122, 70, 0.9)' : result;
    }

    hashString(...args) {
      const result = this.delegateWorldMapRenderer('hashString', args);
      return result === undefined ? 0 : result;
    }

    random01(...args) {
      const result = this.delegateWorldMapRenderer('random01', args);
      return result === undefined ? 0 : result;
    }

    getWorldOverlayAnchor(...args) {
      const result = this.delegateWorldMapRenderer('getWorldOverlayAnchor', args);
      return result === undefined ? { x: 0, y: 0 } : result;
    }

    getWorldTileImageAspect(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileImageAspect', args);
      return result === undefined ? 1 : result;
    }

    drawWorldOverlayShadow(...args) {
      const result = this.delegateWorldMapRenderer('drawWorldOverlayShadow', args);
      return result === undefined ? false : result;
    }

    drawWorldOverlayAsset(...args) {
      const result = this.delegateWorldMapRenderer('drawWorldOverlayAsset', args);
      return result === undefined ? false : result;
    }

    drawWorldTerrainFeature(...args) {
      const result = this.delegateWorldMapRenderer('drawWorldTerrainFeature', args);
      return result === undefined ? false : result;
    }

    drawWorldTileFeature(...args) {
      const result = this.delegateWorldMapRenderer('drawWorldTileFeature', args);
      return result === undefined ? false : result;
    }

    getWorldTileSiteLayout(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileSiteLayout', args);
      return result === undefined ? null : result;
    }

    drawWorldTileSite(...args) {
      const result = this.delegateWorldMapRenderer('drawWorldTileSite', args);
      return result === undefined ? false : result;
    }

    getWorldTileRenderEntries(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileRenderEntries', args);
      return result === undefined ? [] : result;
    }

    getWorldTileLocalEntries(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileLocalEntries', args);
      return result === undefined ? [] : result;
    }

    getWorldTileKey(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileKey', args);
      return result === undefined ? '' : result;
    }

    getWorldTileRenderedDiamondCenter(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileRenderedDiamondCenter', args);
      return result === undefined ? { x: 0, y: 0 } : result;
    }

    getWorldTileFogRevealEntries(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileFogRevealEntries', args);
      return result === undefined ? [] : result;
    }

    getWorldTileStaticCacheLayout(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileStaticCacheLayout', args);
      return result === undefined ? null : result;
    }

    getWorldTileStaticViewportCacheLayout(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileStaticViewportCacheLayout', args);
      return result === undefined ? null : result;
    }

    getWorldTileStaticChunkSize(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileStaticChunkSize', args);
      return result === undefined ? 512 : result;
    }

    getWorldTileStaticChunkCacheLimit(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileStaticChunkCacheLimit', args);
      return result === undefined ? 12 : result;
    }

    getWorldTileStaticChunkCacheScale(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileStaticChunkCacheScale', args);
      return result === undefined ? 1 : result;
    }

    getWorldTileAtlasFramePadding(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileAtlasFramePadding', args);
      return result === undefined ? 0 : result;
    }

    getWorldTileStaticChunkLayouts(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileStaticChunkLayouts', args);
      return result === undefined ? [] : result;
    }

    getWorldTileDragCachePanRange(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileDragCachePanRange', args);
      return result === undefined ? 0 : result;
    }

    getWorldTileStaticDragCacheLayout(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileStaticDragCacheLayout', args);
      return result === undefined ? null : result;
    }

    getWorldTileStaticCacheKey(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileStaticCacheKey', args);
      return result === undefined ? '' : result;
    }

    renderWorldTileFogMask(...args) {
      const result = this.delegateWorldMapRenderer('renderWorldTileFogMask', args);
      return result === undefined ? false : result;
    }

    getWorldTileStaticCacheScale(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileStaticCacheScale', args);
      return result === undefined ? 1 : result;
    }

    getWorldTileStaticCachePixelBudget(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileStaticCachePixelBudget', args);
      return result === undefined ? 0 : result;
    }

    getWorldTileLayerCacheContext(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileLayerCacheContext', args);
      return result === undefined ? null : result;
    }

    getWorldTileStaticCacheContext(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileStaticCacheContext', args);
      return result === undefined ? null : result;
    }

    getWorldTileScoutRouteCacheContext(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileScoutRouteCacheContext', args);
      return result === undefined ? null : result;
    }

    getWorldTileWaterLayerCacheContext(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileWaterLayerCacheContext', args);
      return result === undefined ? null : result;
    }

    createWorldTileLayerWork(...args) {
      const result = this.delegateWorldMapRenderer('createWorldTileLayerWork', args);
      return result === undefined ? false : result;
    }

    drawWorldTileLayerCache(...args) {
      const result = this.delegateWorldMapRenderer('drawWorldTileLayerCache', args);
      return result === undefined ? false : result;
    }

    getWorldTileFastDragCompositeSignature(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileFastDragCompositeSignature', args);
      return result === undefined ? '' : result;
    }

    renderWorldTileFastDragComposite(...args) {
      const result = this.delegateWorldMapRenderer('renderWorldTileFastDragComposite', args);
      return result === undefined ? false : result;
    }

    updateWorldTileFastDragComposite(...args) {
      const result = this.delegateWorldMapRenderer('updateWorldTileFastDragComposite', args);
      return result === undefined ? false : result;
    }

    resolveWorldTileStaticCacheLayout(...args) {
      const result = this.delegateWorldMapRenderer('resolveWorldTileStaticCacheLayout', args);
      return result === undefined ? undefined : result;
    }

    getWorldTileStaticChunkCacheKey(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileStaticChunkCacheKey', args);
      return result === undefined ? '' : result;
    }

    pruneWorldTileStaticChunkCaches(...args) {
      const result = this.delegateWorldMapRenderer('pruneWorldTileStaticChunkCaches', args);
      return result === undefined ? false : result;
    }

    renderWorldTileStaticChunk(...args) {
      const result = this.delegateWorldMapRenderer('renderWorldTileStaticChunk', args);
      return result === undefined ? false : result;
    }

    renderWorldTileStaticChunks(...args) {
      const result = this.delegateWorldMapRenderer('renderWorldTileStaticChunks', args);
      return result === undefined ? false : result;
    }

    getWorldTileWaterChunkCacheKey(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileWaterChunkCacheKey', args);
      return result === undefined ? '' : result;
    }

    pruneWorldTileWaterChunkCaches(...args) {
      const result = this.delegateWorldMapRenderer('pruneWorldTileWaterChunkCaches', args);
      return result === undefined ? false : result;
    }

    getWorldTileWaterChunkFrameCacheId(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileWaterChunkFrameCacheId', args);
      return result === undefined ? '' : result;
    }

    renderWorldTileWaterChunk(...args) {
      const result = this.delegateWorldMapRenderer('renderWorldTileWaterChunk', args);
      return result === undefined ? false : result;
    }

    renderWorldTileWaterChunkFrames(...args) {
      const result = this.delegateWorldMapRenderer('renderWorldTileWaterChunkFrames', args);
      return result === undefined ? false : result;
    }

    renderWorldTileWaterChunks(...args) {
      const result = this.delegateWorldMapRenderer('renderWorldTileWaterChunks', args);
      return result === undefined ? false : result;
    }

    renderWorldTileSnapshotChunkCacheMap(...args) {
      const result = this.delegateWorldMapRenderer('renderWorldTileSnapshotChunkCacheMap', args);
      return result === undefined ? false : result;
    }

    getWorldTileSnapshotDrawLayout(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileSnapshotDrawLayout', args);
      return result === undefined ? null : result;
    }

    renderWorldTileSnapshotLayerCache(...args) {
      const result = this.delegateWorldMapRenderer('renderWorldTileSnapshotLayerCache', args);
      return result === undefined ? false : result;
    }

    renderWorldTileSnapshotCache(...args) {
      const result = this.delegateWorldMapRenderer('renderWorldTileSnapshotCache', args);
      return result === undefined ? false : result;
    }

    renderWorldTileStaticLayer(...args) {
      const result = this.delegateWorldMapRenderer('renderWorldTileStaticLayer', args);
      return result === undefined ? false : result;
    }

    getWorldTileScoutRouteCacheKey(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileScoutRouteCacheKey', args);
      return result === undefined ? '' : result;
    }

    renderWorldScoutRouteLayer(...args) {
      const result = this.delegateWorldMapRenderer('renderWorldScoutRouteLayer', args);
      return result === undefined ? false : result;
    }

    getWorldTileWaterAnimationFps(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileWaterAnimationFps', args);
      return result === undefined ? 8 : result;
    }

    getWorldTileWaterAnimationFrameCount(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileWaterAnimationFrameCount', args);
      return result === undefined ? 1 : result;
    }

    getWorldTileWaterAnimationFrameMs(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileWaterAnimationFrameMs', args);
      return result === undefined ? 125 : result;
    }

    getWorldTileWaterTimeMs(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileWaterTimeMs', args);
      return result === undefined ? 0 : result;
    }

    getWorldTileWaterAnimationFrame(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileWaterAnimationFrame', args);
      return result === undefined ? 0 : result;
    }

    getWorldTileWaterAnimationFrameIndex(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileWaterAnimationFrameIndex', args);
      return result === undefined ? 0 : result;
    }

    getWorldTileWaterFrameTimeMs(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileWaterFrameTimeMs', args);
      return result === undefined ? 0 : result;
    }

    getWorldTileWaterLayerCacheKey(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileWaterLayerCacheKey', args);
      return result === undefined ? '' : result;
    }

    resolveWorldTileWaterLayerCacheLayout(...args) {
      const result = this.delegateWorldMapRenderer('resolveWorldTileWaterLayerCacheLayout', args);
      return result === undefined ? undefined : result;
    }

    renderWorldTileWaterFrameCache(...args) {
      const result = this.delegateWorldMapRenderer('renderWorldTileWaterFrameCache', args);
      return result === undefined ? false : result;
    }

    getWorldTileWaterFrameCache(...args) {
      const result = this.delegateWorldMapRenderer('getWorldTileWaterFrameCache', args);
      return result === undefined ? null : result;
    }

    renderWorldTileWaterFrameCaches(...args) {
      const result = this.delegateWorldMapRenderer('renderWorldTileWaterFrameCaches', args);
      return result === undefined ? false : result;
    }

    renderWorldTileWaterLayer(...args) {
      const result = this.delegateWorldMapRenderer('renderWorldTileWaterLayer', args);
      return result === undefined ? false : result;
    }

    renderWorldTileStaticEntries(...args) {
      const result = this.delegateWorldMapRenderer('renderWorldTileStaticEntries', args);
      return result === undefined ? false : result;
    }

    renderWorldTileWaterEntries(...args) {
      const result = this.delegateWorldMapRenderer('renderWorldTileWaterEntries', args);
      return result === undefined ? false : result;
    }

    addWorldTileSiteHitTargets(...args) {
      const result = this.delegateWorldMapRenderer('addWorldTileSiteHitTargets', args);
      return result === undefined ? false : result;
    }

    renderWorldScoutRoutes(...args) {
      const result = this.delegateWorldMapRenderer('renderWorldScoutRoutes', args);
      return result === undefined ? false : result;
    }

    renderWorldTileMap(...args) {
      const result = this.delegateWorldMapRenderer('renderWorldTileMap', args);
      return result === undefined ? false : result;
    }

    renderMilitaryWorldView(...args) {
      const result = this.delegateWorldMapRenderer('renderMilitaryWorldView', args);
      return result === undefined ? false : result;
    }

    renderWorldSiteAction(...args) {
      const result = this.delegateWorldMapRenderer('renderWorldSiteAction', args);
      return result === undefined ? false : result;
    }

    renderWorldExpeditionConfig(...args) {
      const result = this.delegateWorldMapRenderer('renderWorldExpeditionConfig', args);
      return result === undefined ? false : result;
    }

    renderWorldSiteModal(...args) {
      const result = this.delegateWorldMapRenderer('renderWorldSiteModal', args);
      return result === undefined ? false : result;
    }

    renderWorldCityCommandLegacyOverlay(...args) {
      const result = this.delegateWorldMapRenderer('renderWorldCityCommandLegacyOverlay', args);
      return result === undefined ? false : result;
    }

    getWorldCityCommandAnchor(...args) {
      const result = this.delegateWorldMapRenderer('getWorldCityCommandAnchor', args);
      return result === undefined ? null : result;
    }

    getWorldSiteCanvasAnchor(...args) {
      const result = this.delegateWorldMapRenderer('getWorldSiteCanvasAnchor', args);
      return result === undefined ? null : result;
    }

    getWorldCityCommandButtonAction(...args) {
      const result = this.delegateWorldMapRenderer('getWorldCityCommandButtonAction', args);
      return result === undefined ? { type: 'territoryAction', disabled: true } : result;
    }

    drawWorldCityCommandPrimaryButton(...args) {
      const result = this.delegateWorldMapRenderer('drawWorldCityCommandPrimaryButton', args);
      return result === undefined ? false : result;
    }

    drawWorldCityCommandSideButton(...args) {
      const result = this.delegateWorldMapRenderer('drawWorldCityCommandSideButton', args);
      return result === undefined ? false : result;
    }

    renderWorldCityCommandOverlay(...args) {
      const result = this.delegateWorldMapRenderer('renderWorldCityCommandOverlay', args);
      return result === undefined ? false : result;
    }

    delegateTutorialRenderer(method, args = []) {
      const renderer = this.tutorialRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    }

    renderTutorialIntro(...args) {
      const result = this.delegateTutorialRenderer('renderTutorialIntro', args);
      return result === undefined ? false : result;
    }

    disposeTutorialAdvisorSpine(...args) {
      const result = this.delegateTutorialRenderer('disposeTutorialAdvisorSpine', args);
      return result === undefined ? false : result;
    }

    resolveTutorialIntroTarget(...args) {
      const result = this.delegateTutorialRenderer('resolveTutorialIntroTarget', args);
      return result === undefined ? null : result;
    }

    findHitTarget(...args) {
      const result = this.delegateTutorialRenderer('findHitTarget', args);
      return result === undefined ? null : result;
    }

    inflateRect(...args) {
      const result = this.delegateTutorialRenderer('inflateRect', args);
      return result === undefined ? { x: 0, y: 0, width: 0, height: 0, action: null } : result;
    }

    renderTutorialIntroMarch(...args) {
      const result = this.delegateTutorialRenderer('renderTutorialIntroMarch', args);
      return result === undefined ? false : result;
    }

    renderTutorialIntroUnit(...args) {
      const result = this.delegateTutorialRenderer('renderTutorialIntroUnit', args);
      return result === undefined ? false : result;
    }

    renderTutorialIntroSpotlight(...args) {
      const result = this.delegateTutorialRenderer('renderTutorialIntroSpotlight', args);
      return result === undefined ? false : result;
    }

    normalizeRect(...args) {
      const result = this.delegateTutorialRenderer('normalizeRect', args);
      return result === undefined ? null : result;
    }

    renderTutorialIntroFinger(...args) {
      const result = this.delegateTutorialRenderer('renderTutorialIntroFinger', args);
      return result === undefined ? false : result;
    }

    renderTutorialIntroDialogue(...args) {
      const result = this.delegateTutorialRenderer('renderTutorialIntroDialogue', args);
      return result === undefined ? false : result;
    }

    renderTutorialIntroAdvisorPortrait(...args) {
      const result = this.delegateTutorialRenderer('renderTutorialIntroAdvisorPortrait', args);
      return result === undefined ? false : result;
    }

    renderTutorialAdvisorSpineLayer(...args) {
      const result = this.delegateTutorialRenderer('renderTutorialAdvisorSpineLayer', args);
      return result === undefined ? false : result;
    }

    drawTutorialAdvisorImageCover(...args) {
      const result = this.delegateTutorialRenderer('drawTutorialAdvisorImageCover', args);
      return result === undefined ? false : result;
    }

    getTutorialAdvisorSpineFrame(...args) {
      const result = this.delegateTutorialRenderer('getTutorialAdvisorSpineFrame', args);
      return result === undefined ? null : result;
    }

    renderMilitary(...args) {
      const result = this.delegateMilitaryRenderer('renderMilitary', args);
      return result === undefined ? false : result;
    }

    delegateHudTabPageRenderer(method, args = []) {
      const renderer = this.hudTabPageRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    }

    renderMainPanel(...args) {
      return this.delegateHudTabPageRenderer('renderMainPanel', args);
    }

    renderHudTabPage(...args) {
      return this.delegateHudTabPageRenderer('renderHudTabPage', args);
    }

    renderHudTabPageWithTransition(...args) {
      return this.delegateHudTabPageRenderer('renderHudTabPageWithTransition', args);
    }
    delegateWorldMapLayerRenderer(method, args = []) {
      const renderer = this.worldMapLayerRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    }

    getWorldMapLayerLayout(...args) {
      const result = this.delegateWorldMapLayerRenderer('getWorldMapLayerLayout', args);
      return result === undefined ? null : result;
    }

    renderMapHomeWorldView(...args) {
      const result = this.delegateWorldMapLayerRenderer('renderMapHomeWorldView', args);
      return result === undefined ? false : result;
    }

    collectMapHomeWorldSiteHitTargets(...args) {
      const result = this.delegateWorldMapLayerRenderer('collectMapHomeWorldSiteHitTargets', args);
      return result === undefined ? false : result;
    }

    renderMapHomeExplorerHud(...args) {
      const result = this.delegateWorldMapLayerRenderer('renderMapHomeExplorerHud', args);
      return result === undefined ? false : result;
    }

    renderMapHomeEmptyWorld(...args) {
      const result = this.delegateWorldMapLayerRenderer('renderMapHomeEmptyWorld', args);
      return result === undefined ? false : result;
    }

    renderWorldMapLayer(...args) {
      const result = this.delegateWorldMapLayerRenderer('renderWorldMapLayer', args);
      return result === undefined ? false : result;
    }

    renderWorldMapSnapshotLayer(...args) {
      const result = this.delegateWorldMapLayerRenderer('renderWorldMapSnapshotLayer', args);
      return result === undefined ? false : result;
    }
    delegateMapCommandRenderer(method, args = []) {
      const renderer = this.mapCommandRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    }

    renderMapCommandDock(...args) {
      return this.delegateMapCommandRenderer('renderMapCommandDock', args);
    }

    renderFloatingSubcityButton(...args) {
      return this.delegateMapCommandRenderer('renderFloatingSubcityButton', args);
    }

    renderFloatingEventButton(...args) {
      return this.delegateMapCommandRenderer('renderFloatingEventButton', args);
    }

    renderMapCommandPanel(...args) {
      return this.delegateMapCommandRenderer('renderMapCommandPanel', args);
    }

    delegateTabBarRenderer(method, args = []) {
      const renderer = this.tabBarRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    }

    renderTabs(...args) {
      return this.delegateTabBarRenderer('renderTabs', args);
    }

    parsePixelValue(value) {
      if (typeof value === 'number') return value;
      const parsed = Number(String(value ?? '').replace('px', ''));
      return Number.isFinite(parsed) ? parsed : 0;
    }

    easeOutCubic(value) {
      const t = Math.max(0, Math.min(1, Number(value) || 0));
      return 1 - ((1 - t) ** 3);
    }

    getTransitionFrame(transition = null) {
      if (!transition) return null;
      const startedAt = Number(transition.startedAt);
      if (!Number.isFinite(startedAt)) return null;
      const durationMs = Math.max(1, Number(transition.durationMs) || 220);
      const progress = Math.max(0, Math.min(1, (this.getNow() - startedAt) / durationMs));
      if (progress >= 1) return null;
      return {
        progress,
        eased: this.easeOutCubic(progress),
        direction: Number(transition.direction) < 0 ? -1 : 1,
      };
    }

    interpolateRect(fromRect = {}, toRect = {}, progress = 1) {
      const eased = this.easeOutCubic(progress);
      const read = (rect, key, fallback = 0) => Number(rect?.[key] ?? fallback) || 0;
      const lerp = (from, to) => from + (to - from) * eased;
      const left = lerp(read(fromRect, 'left'), read(toRect, 'left'));
      const top = lerp(read(fromRect, 'top'), read(toRect, 'top'));
      const width = lerp(read(fromRect, 'width'), read(toRect, 'width'));
      const height = lerp(read(fromRect, 'height'), read(toRect, 'height'));
      return {
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
      };
    }

    renderTutorialHighlight(...args) {
      const result = this.delegateTutorialRenderer('renderTutorialHighlight', args);
      return result === undefined ? false : result;
    }

    addTutorialShield(...args) {
      const result = this.delegateTutorialRenderer('addTutorialShield', args);
      return result === undefined ? false : result;
    }

    delegateHudOverlayRenderer(method, args = []) {
      const renderer = this.hudOverlayRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    }

    renderHudOverlay(...args) {
      return this.delegateHudOverlayRenderer('renderHudOverlay', args);
    }

    render(state = {}, options = {}) {
      if (options.mode === 'hud') {
        this.renderHudOverlay(state, options);
        return;
      }
      const activeTab = options.activeTab || 'resources';
      this.beginFrame(options);
      this.setHitTargets([]);
      this.clear();
      if (options.auth?.view?.loginPanelVisible) {
        this.renderLoginPanel(options.auth);
        this.endFrame(options);
        return;
      }
      if (options.loading?.visible) {
        this.renderLoadingScreen(options.loading);
        this.endFrame(options);
        return;
      }
      if (options.battleScene?.visible) {
        this.renderBattleSceneOverlay(state, options);
        this.endFrame(options);
        return;
      }
      const topBarBottom = this.renderTopBar(state, options);
      if (options.isMapHome && activeTab === 'military') {
        if (options.skipWorldMapLayer) this.collectMapHomeWorldSiteHitTargets(state, topBarBottom, options);
        else this.renderMapHomeWorldView(state, topBarBottom, options);
        this.renderTabs(activeTab, state, options);
        this.renderMapHomeOverlays(state, options);
        this.renderTutorialIntro(state, options);
        this.renderTutorialHighlight(options.tutorialHighlight || null);
        this.renderFloatingTexts(options.floatingTexts || []);
        this.renderRewardReveal(options.rewardReveal || null);
        this.renderNetworkOverlay(options.network || null);
        this.endFrame(options);
        return;
      }
      const tabsTop = this.height - 60 - this.bottomSafeArea;
      const populationBottom = activeTab === 'resources'
        ? this.renderPopulation(state, topBarBottom)
        : topBarBottom;
      const homeFeatureBottom = activeTab === 'resources'
        ? this.renderHomeFeatureGrid(state, populationBottom, { maxBottom: tabsTop - 8 })
        : populationBottom;
      const panelTop = activeTab === 'resources' ? homeFeatureBottom : topBarBottom;
      const advisorOffset = this.presenter && typeof this.presenter.buildAdvisorViewState === 'function' && this.presenter.buildAdvisorViewState(state.softGuide).hidden ? 0 : 52;
      const availableHeight = Math.max(120, tabsTop - panelTop - 12 - advisorOffset);
      const transition = this.getTransitionFrame(options.pageTransition);
      const fromTab = options.pageTransition?.fromTab;
      const toTab = options.pageTransition?.toTab || activeTab;
      if (transition && fromTab && fromTab !== activeTab && toTab === activeTab && activeTab !== 'resources') {
        const travel = this.width + 24;
        this.withSlideClip(0, panelTop, this.width, Math.max(120, tabsTop - panelTop), -transition.direction * travel * transition.eased, () => {
          this.withSuppressedHitTargets(() => this.renderMainPanel(state, fromTab, panelTop, availableHeight, {
            ...options,
            buildingOffset: options.pageTransition.fromBuildingOffset ?? options.buildingOffset,
            buildingTransition: null,
          }));
        });
        this.withSlideClip(0, panelTop, this.width, Math.max(120, tabsTop - panelTop), transition.direction * travel * (1 - transition.eased), () => {
          this.renderMainPanel(state, activeTab, panelTop, availableHeight, options);
        });
      } else if (activeTab !== 'resources') this.renderMainPanel(state, activeTab, panelTop, availableHeight, options);
      this.renderAdvisor(state);
      this.renderTabs(activeTab, state, options);
      if (options.showResourceDetails) this.renderResourceDetailsPanel(state);
      if (options.showCitySwitcher) this.renderCitySwitcherMenu(state);
      if (options.showTaskCenter) this.renderTaskCenterPanel(state, options);
      if (options.showGuidebook) this.renderGuidebookPanel(state, options);
      if (options.showFamousPersons) this.renderFamousPersonsPanel(state, options);
      if (options.showTalentPolicy) this.renderTalentPolicyPanel(state, options);
      if (options.armyFormationEditor?.open) this.renderArmyFormationEditor(state, options);
      if (options.activeEventId) this.renderEventModal(state, options.activeEventId);
      if (activeTab === 'tech' && (options.techDetailOpen || state.techUiState?.detailOpen)) {
        const view = this.presenter?.buildTechViewState?.({
          ...state,
          techUiState: {
            ...(state.techUiState || {}),
            ...(options.selectedTechId ? { selectedTechId: options.selectedTechId } : {}),
          },
          ...(options.selectedTechId ? { selectedTechId: options.selectedTechId } : {}),
        });
        this.renderTechDetailModal(view?.detail);
      }
      if (activeTab === 'military') this.renderWorldSiteModal(state, options);
      if (options.naming) this.renderNamingModal(options.naming);
      this.renderTutorialHighlight(options.tutorialHighlight || null);
      this.renderFloatingTexts(options.floatingTexts || []);
      this.renderRewardReveal(options.rewardReveal || null);
      this.renderNetworkOverlay(options.network || null);
      this.endFrame(options);
    }

    renderMapHomeOverlays(state = {}, options = {}) {
      this.renderFloatingSubcityButton(state, options);
      this.renderFloatingEventButton(state, options);
      this.renderFloatingAdvisorButton(state, options);
      if (options.activeCommandPanel) this.renderMapCommandPanel(state, options);
      if (options.showSubcityList) this.renderSubcityListPanel(state, options);
      if (options.showCityManagement) this.renderCityManagementPanel(state, options);
      if (options.showResourceDetails) this.renderResourceDetailsPanel(state);
      if (options.showSettings) this.renderSettingsPanel();
      if (options.showCitySwitcher) this.renderCitySwitcherMenu(state);
      if (options.showAdvisor) this.renderAdvisorPanel(state);
      if (options.showTaskCenter) this.renderTaskCenterPanel(state, options);
      if (options.showGuidebook) this.renderGuidebookPanel(state, options);
      if (options.showFamousPersons) this.renderFamousPersonsPanel(state, options);
      if (options.showTalentPolicy) this.renderTalentPolicyPanel(state, options);
      if (options.armyFormationEditor?.open) this.renderArmyFormationEditor(state, options);
      if (options.activeEventId) this.renderEventModal(state, options.activeEventId);
      this.renderWorldSiteModal(state, options);
      if (options.naming) this.renderNamingModal(options.naming);
    }
  }

  global.CanvasGameRenderer = CanvasGameRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasGameRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
