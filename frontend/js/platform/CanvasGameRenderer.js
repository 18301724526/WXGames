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

  const SharedCanvasWorldMapFacade = (() => {
    if (global.CanvasWorldMapFacade) return global.CanvasWorldMapFacade;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/CanvasWorldMapFacade');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedCanvasGameRendererCompositionFactory = (() => {
    if (global.CanvasGameRendererCompositionFactory) return global.CanvasGameRendererCompositionFactory;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./CanvasGameRendererCompositionFactory');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedCanvasGameRendererCoreFacades = (() => {
    if (global.CanvasGameRendererCoreFacades) return global.CanvasGameRendererCoreFacades;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./CanvasGameRendererCoreFacades');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedCanvasGameRendererPageFacades = (() => {
    if (global.CanvasGameRendererPageFacades) return global.CanvasGameRendererPageFacades;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./CanvasGameRendererPageFacades');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedCanvasPreloadAssetManifest = (() => {
    if (global.CanvasPreloadAssetManifest) return global.CanvasPreloadAssetManifest;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/CanvasPreloadAssetManifest');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedCanvasBattleFacade = (() => {
    if (global.CanvasBattleFacade) return global.CanvasBattleFacade;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/CanvasBattleFacade');
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
      this.loadTrace = options.loadTrace || null;
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
      const composition = SharedCanvasGameRendererCompositionFactory?.create
        ? SharedCanvasGameRendererCompositionFactory.create({ host: this, options })
        : { rendererMap: {}, rendererKeys: [] };
      Object.assign(this, composition.rendererMap || {});
      this.childRendererKeys = composition.rendererKeys || [];
      this.syncChildRendererPresenters();
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
      if (SharedCanvasPreloadAssetManifest?.getPreloadAssetPaths) {
        return SharedCanvasPreloadAssetManifest.getPreloadAssetPaths({
          rendererClass: this,
          tileMapManifest: this.getTileMapAssetManifest(),
          famousPortraitLayout: this.getFamousPortraitLayerLayout(),
        });
      }
      return [
        'assets/art/civilization-bg.webp',
        'assets/art/icon-home-cutout.png',
        'assets/art/battle/battlefield-forest-camp.png',
        ...this.getBattleUnitFramePaths(),
      ];
    }

    getPreloadAssetPaths() {
      return this.constructor.getPreloadAssetPaths();
    }

    setPresenter(presenter) {
      this.presenter = presenter;
      this.syncChildRendererPresenters();
    }

    getChildRenderers() {
      if (SharedCanvasGameRendererCompositionFactory?.getChildRenderers) {
        return SharedCanvasGameRendererCompositionFactory.getChildRenderers(this, this.childRendererKeys);
      }
      return [];
    }

    syncChildRendererPresenter(renderer) {
      if (SharedCanvasGameRendererCompositionFactory?.syncChildRendererPresenter) {
        return SharedCanvasGameRendererCompositionFactory.syncChildRendererPresenter(this, renderer);
      }
      return false;
    }

    syncChildRendererPresenters() {
      if (SharedCanvasGameRendererCompositionFactory?.syncChildRendererPresenters) {
        SharedCanvasGameRendererCompositionFactory.syncChildRendererPresenters(this, this.childRendererKeys);
        return;
      }
      this.getChildRenderers().forEach((renderer) => this.syncChildRendererPresenter(renderer));
    }

  }

  if (SharedCanvasGameRendererCoreFacades?.installCoreFacades) {
    SharedCanvasGameRendererCoreFacades.installCoreFacades(CanvasGameRenderer);
  }
  if (SharedCanvasGameRendererPageFacades?.installPageFacades) {
    SharedCanvasGameRendererPageFacades.installPageFacades(CanvasGameRenderer);
  }
  if (SharedCanvasWorldMapFacade?.installWorldMapFacade) {
    SharedCanvasWorldMapFacade.installWorldMapFacade(CanvasGameRenderer);
  }
  if (SharedCanvasBattleFacade?.installBattleFacade) {
    SharedCanvasBattleFacade.installBattleFacade(CanvasGameRenderer);
  }

  global.CanvasGameRenderer = CanvasGameRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasGameRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
