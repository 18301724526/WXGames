(function (global) {
  const sharedFamousPortraitLayout = (() => {
    if (global.FamousPortraitLayout) return global.FamousPortraitLayout;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../config/FamousPortraitLayout');
      } catch (_error) {
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
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const sharedTileMapGeometry = (() => {
    if (global.TileMapGeometry) return global.TileMapGeometry;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../ecs/foundation/TileMapGeometry');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../ecs/resource/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  function t(key, params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
  }

  function battleUnitSpecFallback(host) {
    return {
      unit: 'player',
      root: 'assets/art/battle/units/player',
      frameCount: host?.constructor?.getBattleUnitFrameCount?.() || 4,
      width: 500,
      height: 400,
    };
  }

  function battleFrameSpritePathFallback(host) {
    const pathFactory = host?.constructor?.getBattleUnitFramePath;
    return typeof pathFactory === 'function'
      ? pathFactory.call(host.constructor, 'player', 'idle', 0)
      : 'assets/art/battle/units/player/idle/01.png';
  }

  const SharedCanvasGameRendererCompositionFactory = (() => {
    if (global.CanvasGameRendererCompositionFactory) return global.CanvasGameRendererCompositionFactory;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./CanvasGameRendererCompositionFactory');
      } catch (_error) {
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
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const SharedCanvasSurfaceState = (() => {
    if (global.CanvasSurfaceState) return global.CanvasSurfaceState;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/CanvasSurfaceState');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  const SharedHitTargetManager = (() => {
    if (global.HitTargetManager) return global.HitTargetManager;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./HitTargetManager');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  const SharedWorldTileMapCacheCoordinator = (() => {
    if (global.WorldTileMapCacheCoordinator) return global.WorldTileMapCacheCoordinator;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldTileMapCacheCoordinator');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  const SharedWorldMapRenderState = (() => {
    if (global.WorldMapRenderState) return global.WorldMapRenderState;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/WorldMapRenderState');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  const SharedWorldMapCacheState = (() => {
    if (global.WorldMapCacheState) return global.WorldMapCacheState;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/WorldMapCacheState');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  function createSurfaceState() {
    if (typeof SharedCanvasSurfaceState?.createCanvasSurfaceState !== 'function') {
      throw new Error('CanvasSurfaceState is required before CanvasGameRenderer');
    }
    return SharedCanvasSurfaceState.createCanvasSurfaceState();
  }

  function createHitTargetManager(host) {
    if (typeof SharedHitTargetManager !== 'function') {
      throw new Error('HitTargetManager is required before CanvasGameRenderer');
    }
    return new SharedHitTargetManager({ host });
  }

  function createWorldMapRenderState() {
    if (typeof SharedWorldMapRenderState?.createWorldMapRenderState !== 'function') {
      throw new Error('WorldMapRenderState is required before CanvasGameRenderer');
    }
    return SharedWorldMapRenderState.createWorldMapRenderState();
  }

  function createWorldMapCacheState(initial = {}) {
    if (typeof SharedWorldMapCacheState?.createWorldMapCacheState !== 'function') {
      throw new Error('WorldMapCacheState is required before CanvasGameRenderer');
    }
    return SharedWorldMapCacheState.createWorldMapCacheState(initial);
  }

  function createWorldTileMapCacheCoordinator(host) {
    if (typeof SharedWorldTileMapCacheCoordinator !== 'function') {
      throw new Error('WorldTileMapCacheCoordinator is required before CanvasGameRenderer');
    }
    return new SharedWorldTileMapCacheCoordinator({ host });
  }

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
      this.tutorialAdvisorSpine = null;
      this.tutorialAdvisorSpineFailed = false;
      this.surfaceState = createSurfaceState();
      this.hitTargetManager = createHitTargetManager(this);
      this.worldMapRenderState = options.worldMapRenderState || createWorldMapRenderState();
      this.worldMapCacheState = options.worldMapCacheState || createWorldMapCacheState(options);
      this.worldTileMapCacheCoordinator = createWorldTileMapCacheCoordinator(this);
      this.techRenderState = options.techRenderState || { lastTechTreeScroll: null };
      const composition = SharedCanvasGameRendererCompositionFactory?.create
        ? SharedCanvasGameRendererCompositionFactory.create({ host: this, options })
        : { rendererMap: {}, rendererKeys: [] };
      Object.assign(this, composition.rendererMap || {});
      this.childRendererKeys = composition.rendererKeys || [];
      this.syncChildRendererPresenters();
      this.showFpsOverlay = options.showFpsOverlay !== false;
      if (this.ctx && typeof this.ctx.scale === 'function') this.ctx.scale(1, 1);
    }

    get hitTargets() {
      return this.hitTargetManager.readHitTargets();
    }

    set hitTargets(value) {
      this.hitTargetManager.writeHitTargets(value);
    }

    get hoverPoint() { return SharedCanvasSurfaceState.getHoverPoint(this.surfaceState); }
    set hoverPoint(value) { SharedCanvasSurfaceState.setHoverPoint(this.surfaceState, value); }

    get famousSkillHitTargets() {
      return this.hitTargetManager.readFamousSkillHitTargets();
    }

    set famousSkillHitTargets(value) {
      this.hitTargetManager.writeFamousSkillHitTargets(value);
    }

    get activeFamousSkillTooltip() { return this.surfaceState.activeFamousSkillTooltip || null; }
    set activeFamousSkillTooltip(value) {
      SharedCanvasSurfaceState.setFamousSkillTooltips(this.surfaceState, { active: value });
    }

    get pinnedFamousSkillTooltip() { return this.surfaceState.pinnedFamousSkillTooltip || null; }
    set pinnedFamousSkillTooltip(value) {
      SharedCanvasSurfaceState.setFamousSkillTooltips(this.surfaceState, { pinned: value });
    }

    get worldTileFastDragActive() { return this.worldTileMapCacheCoordinator.worldTileFastDragActive; }
    set worldTileFastDragActive(value) { this.worldTileMapCacheCoordinator.worldTileFastDragActive = value; }
    get worldTileStaticCache() { return this.worldTileMapCacheCoordinator.worldTileStaticCache; }
    set worldTileStaticCache(value) { this.worldTileMapCacheCoordinator.worldTileStaticCache = value; }
    get worldTileStaticCacheKey() { return this.worldTileMapCacheCoordinator.worldTileStaticCacheKey; }
    set worldTileStaticCacheKey(value) { this.worldTileMapCacheCoordinator.worldTileStaticCacheKey = value; }
    get worldTileStaticCacheLayoutKind() { return this.worldTileMapCacheCoordinator.worldTileStaticCacheLayoutKind; }
    set worldTileStaticCacheLayoutKind(value) { this.worldTileMapCacheCoordinator.worldTileStaticCacheLayoutKind = value; }
    get worldTileStaticCacheLayout() { return this.worldTileMapCacheCoordinator.worldTileStaticCacheLayout; }
    set worldTileStaticCacheLayout(value) { this.worldTileMapCacheCoordinator.worldTileStaticCacheLayout = value; }
    get worldTileStaticChunkCaches() { return this.worldTileMapCacheCoordinator.worldTileStaticChunkCaches; }
    get worldTileStaticChunkCacheTick() { return this.worldTileMapCacheCoordinator.worldTileStaticChunkCacheTick; }
    set worldTileStaticChunkCacheTick(value) { this.worldTileMapCacheCoordinator.worldTileStaticChunkCacheTick = value; }
    get worldTileWaterLayerCache() { return this.worldTileMapCacheCoordinator.worldTileWaterLayerCache; }
    set worldTileWaterLayerCache(value) { this.worldTileMapCacheCoordinator.worldTileWaterLayerCache = value; }
    get worldTileWaterLayerCacheKey() { return this.worldTileMapCacheCoordinator.worldTileWaterLayerCacheKey; }
    set worldTileWaterLayerCacheKey(value) { this.worldTileMapCacheCoordinator.worldTileWaterLayerCacheKey = value; }
    get worldTileWaterFrameCaches() { return this.worldTileMapCacheCoordinator.worldTileWaterFrameCaches; }
    get worldTileWaterChunkCaches() { return this.worldTileMapCacheCoordinator.worldTileWaterChunkCaches; }
    get worldTileWaterChunkCacheTick() { return this.worldTileMapCacheCoordinator.worldTileWaterChunkCacheTick; }
    set worldTileWaterChunkCacheTick(value) { this.worldTileMapCacheCoordinator.worldTileWaterChunkCacheTick = value; }
    get worldTileMaskCache() { return this.worldTileMapCacheCoordinator.worldTileMaskCache; }
    get worldTileMaskMetricsCache() { return this.worldTileMapCacheCoordinator.worldTileMaskMetricsCache; }
    get worldTileDryCompositeCache() { return this.worldTileMapCacheCoordinator.worldTileDryCompositeCache; }
    get worldTileFastDragComposite() { return this.worldTileMapCacheCoordinator.worldTileFastDragComposite; }
    set worldTileFastDragComposite(value) { this.worldTileMapCacheCoordinator.worldTileFastDragComposite = value; }
    get worldTileFastDragCompositeCache() { return this.worldTileMapCacheCoordinator.worldTileFastDragCompositeCache; }
    set worldTileFastDragCompositeCache(value) { this.worldTileMapCacheCoordinator.worldTileFastDragCompositeCache = value; }
    get worldTileCompositeCanvas() { return this.worldTileMapCacheCoordinator.worldTileCompositeCanvas; }
    set worldTileCompositeCanvas(value) { this.worldTileMapCacheCoordinator.worldTileCompositeCanvas = value; }
    get worldTileCompositeCtx() { return this.worldTileMapCacheCoordinator.worldTileCompositeCtx; }
    set worldTileCompositeCtx(value) { this.worldTileMapCacheCoordinator.worldTileCompositeCtx = value; }
    get worldTileWaterCanvas() { return this.worldTileMapCacheCoordinator.worldTileWaterCanvas; }
    set worldTileWaterCanvas(value) { this.worldTileMapCacheCoordinator.worldTileWaterCanvas = value; }
    get worldTileWaterCtx() { return this.worldTileMapCacheCoordinator.worldTileWaterCtx; }
    set worldTileWaterCtx(value) { this.worldTileMapCacheCoordinator.worldTileWaterCtx = value; }
    get worldTileViewCache() { return this.worldTileMapCacheCoordinator.worldTileViewCache; }
    set worldTileViewCache(value) { this.worldTileMapCacheCoordinator.worldTileViewCache = value; }
    get worldTileVisibleEntriesCache() { return this.worldTileMapCacheCoordinator.worldTileVisibleEntriesCache; }
    set worldTileVisibleEntriesCache(value) { this.worldTileMapCacheCoordinator.worldTileVisibleEntriesCache = value; }
    get worldTileLocalEntriesCache() { return this.worldTileMapCacheCoordinator.worldTileLocalEntriesCache; }
    set worldTileLocalEntriesCache(value) { this.worldTileMapCacheCoordinator.worldTileLocalEntriesCache = value; }
    get assetsChangedHandler() { return this.worldTileMapCacheCoordinator.assetsChangedHandler; }
    set assetsChangedHandler(value) { this.worldTileMapCacheCoordinator.assetsChangedHandler = value; }
    get worldTileCachePrewarmTask() { return this.worldTileMapCacheCoordinator.worldTileCachePrewarmTask; }
    set worldTileCachePrewarmTask(value) { this.worldTileMapCacheCoordinator.worldTileCachePrewarmTask = value; }
    get lastTechTreeScroll() { return this.techRenderState?.lastTechTreeScroll || null; }
    set lastTechTreeScroll(value) {
      if (this.techRenderState) this.techRenderState.lastTechTreeScroll = value || null;
    }

    get suppressHitTargets() { return this.hitTargetManager.readSuppressHitTargets(); }
    set suppressHitTargets(value) { this.hitTargetManager.writeSuppressHitTargets(value); }

    get frameNow() { return Number(this.surfaceState.frameNow) || 0; }
    set frameNow(value) { this.surfaceState.frameNow = Number(value) || 0; }

    get fpsLastFrameAt() { return Number(this.surfaceState.fpsLastFrameAt) || 0; }
    set fpsLastFrameAt(value) { this.surfaceState.fpsLastFrameAt = Number(value) || 0; }

    get fpsLastPaintAt() { return Number(this.surfaceState.fpsLastPaintAt) || 0; }
    set fpsLastPaintAt(value) { this.surfaceState.fpsLastPaintAt = Number(value) || 0; }

    get fpsLastPaintedValue() { return Number(this.surfaceState.fpsLastPaintedValue) || 0; }
    set fpsLastPaintedValue(value) { this.surfaceState.fpsLastPaintedValue = Number(value) || 0; }

    get fpsSamples() {
      if (!Array.isArray(this.surfaceState.fpsSamples)) this.surfaceState.fpsSamples = [];
      return this.surfaceState.fpsSamples;
    }

    set fpsSamples(value) {
      this.surfaceState.fpsSamples = Array.isArray(value) ? value : [];
    }

    get currentFps() { return Number(this.surfaceState.currentFps) || 0; }
    set currentFps(value) { this.surfaceState.currentFps = Number(value) || 0; }

    get lastWorldTileMapContext() {
      return this.worldMapRenderState?.lastWorldTileMapContext || null;
    }

    set lastWorldTileMapContext(value) {
      if (this.worldMapRenderState) this.worldMapRenderState.lastWorldTileMapContext = value || null;
    }

    get lastMapHomeWorldHudContext() {
      return this.worldMapRenderState?.lastMapHomeWorldHudContext || null;
    }

    set lastMapHomeWorldHudContext(value) {
      if (this.worldMapRenderState) this.worldMapRenderState.lastMapHomeWorldHudContext = value || null;
    }

    get lastWorldMapLayerRenderResult() {
      return this.worldMapRenderState?.lastWorldMapLayerRenderResult || null;
    }

    set lastWorldMapLayerRenderResult(value) {
      if (this.worldMapRenderState) this.worldMapRenderState.lastWorldMapLayerRenderResult = value || null;
    }

    get lastWorldActorOverlayDiag() {
      return this.worldMapRenderState?.lastWorldActorOverlayDiag || null;
    }

    set lastWorldActorOverlayDiag(value) {
      if (this.worldMapRenderState) this.worldMapRenderState.lastWorldActorOverlayDiag = value || null;
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


    getLayout(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.getLayout === 'function'
        ? renderer.getLayout(...args)
        : undefined;
      if (result !== undefined) return result;
      const contentWidth = Math.min(this.maxContentWidth, Math.max(300, this.width - this.edgePadding * 2));
      const contentX = Math.max(this.edgePadding, Math.floor((this.width - contentWidth) / 2));
      return { contentX, contentWidth, contentRight: contentX + contentWidth };
    }

    createGradient(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.createGradient === 'function'
        ? renderer.createGradient(...args)
        : undefined;
      return result === undefined ? (args[5] || '#000') : result;
    }

    createRadialGradient(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.createRadialGradient === 'function'
        ? renderer.createRadialGradient(...args)
        : undefined;
      return result === undefined ? (args[7] || '#000') : result;
    }

    roundRectPath(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.roundRectPath === 'function'
        ? renderer.roundRectPath(...args)
        : undefined;
    }

    createImage() {
      return null;
    }

    preloadAssets(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.preloadAssets === 'function'
        ? renderer.preloadAssets(...args)
        : undefined;
      if (result !== undefined) return result;
      const paths = Array.from(new Set((args[0] || this.getPreloadAssetPaths() || []).filter(Boolean)));
      args[1]?.({ total: paths.length, completed: paths.length, loaded: 0, failed: paths.length, percentage: 100 });
      return Promise.resolve({ total: paths.length, completed: paths.length, loaded: 0, failed: paths.length, percentage: 100 });
    }

    scheduleWorldTileCachePrewarm(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.scheduleWorldTileCachePrewarm === 'function'
        ? renderer.scheduleWorldTileCachePrewarm(...args)
        : undefined;
      return result === undefined
        ? { total: 0, candidateTotal: 0, scheduled: false, metrics: 0, masks: 0, dryTemplates: 0 }
        : result;
    }

    isWorldTilePrewarmMetricAssetPath(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.isWorldTilePrewarmMetricAssetPath === 'function'
        ? renderer.isWorldTilePrewarmMetricAssetPath(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    isWorldTileTemplateAssetPath(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.isWorldTileTemplateAssetPath === 'function'
        ? renderer.isWorldTileTemplateAssetPath(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    isWorldTileWaterTemplateAssetPath(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.isWorldTileWaterTemplateAssetPath === 'function'
        ? renderer.isWorldTileWaterTemplateAssetPath(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    prewarmWorldTileCaches(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.prewarmWorldTileCaches === 'function'
        ? renderer.prewarmWorldTileCaches(...args)
        : undefined;
      return result === undefined ? { total: 0, metrics: 0, masks: 0, dryTemplates: 0 } : result;
    }

    prewarmWorldTileCachesForLoading(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.prewarmWorldTileCachesForLoading === 'function'
        ? renderer.prewarmWorldTileCachesForLoading(...args)
        : undefined;
      return result === undefined
        ? Promise.resolve({ total: 0, candidateTotal: 0, completed: 0, percentage: 100, metrics: 0, masks: 0, dryTemplates: 0 })
        : result;
    }

    getAsset(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.getAsset === 'function'
        ? renderer.getAsset(...args)
        : undefined;
      return result === undefined ? null : result;
    }

    setHitTargets(...args) {
      return this.hitTargetManager.setHitTargets(...args);
    }

    addHitTarget(...args) {
      return this.hitTargetManager.addHitTarget(...args);
    }

    appendWorldMapRuntimeHitTargets(targets = []) {
      return this.hitTargetManager.appendWorldMapRuntimeHitTargets(targets);
    }

    getHitTarget(...args) {
      return this.hitTargetManager.getHitTarget(...args);
    }

    containsPoint(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.containsPoint === 'function'
        ? renderer.containsPoint(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    setHoverPoint(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.setHoverPoint === 'function'
        ? renderer.setHoverPoint(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    isSameFamousSkillTooltipAction(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.isSameFamousSkillTooltipAction === 'function'
        ? renderer.isSameFamousSkillTooltipAction(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    clearFamousSkillTooltip(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.clearFamousSkillTooltip === 'function'
        ? renderer.clearFamousSkillTooltip(...args)
        : undefined;
      if (result !== undefined) return result;
      return SharedCanvasSurfaceState.clearFamousSkillTooltips(this.surfaceState);
    }

    setPinnedFamousSkillTooltip(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.setPinnedFamousSkillTooltip === 'function'
        ? renderer.setPinnedFamousSkillTooltip(...args)
        : undefined;
      return result === undefined ? this.clearFamousSkillTooltip() : result;
    }

    getFamousSkillTooltipAction(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.getFamousSkillTooltipAction === 'function'
        ? renderer.getFamousSkillTooltipAction(...args)
        : undefined;
      return result === undefined ? null : result;
    }

    isAllowedUnderTutorialShield(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.isAllowedUnderTutorialShield === 'function'
        ? renderer.isAllowedUnderTutorialShield(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    matchesTutorialShieldAllowedAction(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.matchesTutorialShieldAllowedAction === 'function'
        ? renderer.matchesTutorialShieldAllowedAction(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    matchesCurrentTutorialIntroAction(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.matchesCurrentTutorialIntroAction === 'function'
        ? renderer.matchesCurrentTutorialIntroAction(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    withSuppressedHitTargets(...args) {
      return this.hitTargetManager.withSuppressedHitTargets(...args);
    }

    withSlideClip(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.withSlideClip === 'function'
        ? renderer.withSlideClip(...args)
        : args[5]?.();
    }

    withTranslatedClip(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.withTranslatedClip === 'function'
        ? renderer.withTranslatedClip(...args)
        : args[6]?.();
    }

    withTransformedClip(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.withTransformedClip === 'function'
        ? renderer.withTransformedClip(...args)
        : args[7]?.();
    }

    setAssetsChangedHandler(...args) {
      return this.worldTileMapCacheCoordinator.setAssetsChangedHandler(...args);
    }

    handleAssetsChanged(...args) {
      return this.worldTileMapCacheCoordinator.handleAssetsChanged(...args);
    }

    invalidateWorldTileCaches(...args) {
      return this.worldTileMapCacheCoordinator.invalidateWorldTileCaches(...args);
    }

    hasPreparedWorldTileSnapshotCache(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.hasPreparedWorldTileSnapshotCache === 'function'
        ? renderer.hasPreparedWorldTileSnapshotCache(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    invalidateWorldTileViewCache(...args) {
      return this.worldTileMapCacheCoordinator.invalidateWorldTileViewCache(...args);
    }

    drawAsset(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.drawAsset === 'function'
        ? renderer.drawAsset(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    drawAssetClipped(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.drawAssetClipped === 'function'
        ? renderer.drawAssetClipped(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    getFallbackAssetMetrics(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.getFallbackAssetMetrics === 'function'
        ? renderer.getFallbackAssetMetrics(...args)
        : undefined;
      if (result !== undefined) return result;
      const [image] = args;
      const width = Number(image?.naturalWidth || image?.width || 1) || 1;
      const height = Number(image?.naturalHeight || image?.height || 1) || 1;
      return { x: 0, y: 0, width, height, sourceWidth: width, sourceHeight: height };
    }

    isOpaquePixel(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.isOpaquePixel === 'function'
        ? renderer.isOpaquePixel(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    isWorldTileTemplateWaterPixel(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.isWorldTileTemplateWaterPixel === 'function'
        ? renderer.isWorldTileTemplateWaterPixel(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    measurePixelBounds(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.measurePixelBounds === 'function'
        ? renderer.measurePixelBounds(...args)
        : undefined;
      return result === undefined ? null : result;
    }

    analyzeAssetAlphaBounds(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.analyzeAssetAlphaBounds === 'function'
        ? renderer.analyzeAssetAlphaBounds(...args)
        : undefined;
      return result === undefined ? this.getFallbackAssetMetrics(null) : result;
    }

    getIsoTileSourceRect(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.getIsoTileSourceRect === 'function'
        ? renderer.getIsoTileSourceRect(...args)
        : undefined;
      return result === undefined ? null : result;
    }

    getWorldTileTemplateMetrics(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.getWorldTileTemplateMetrics === 'function'
        ? renderer.getWorldTileTemplateMetrics(...args)
        : undefined;
      return result === undefined ? null : result;
    }

    drawTileAsset(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.drawTileAsset === 'function'
        ? renderer.drawTileAsset(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    getTemplateCanvasFactory(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.getTemplateCanvasFactory === 'function'
        ? renderer.getTemplateCanvasFactory(...args)
        : undefined;
      return result === undefined ? null : result;
    }

    createTileWorkCanvas(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.createTileWorkCanvas === 'function'
        ? renderer.createTileWorkCanvas(...args)
        : undefined;
      return result === undefined ? null : result;
    }

    isInsideTemplateDiamond(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.isInsideTemplateDiamond === 'function'
        ? renderer.isInsideTemplateDiamond(...args)
        : undefined;
      if (result !== undefined) return result;
      const [x, y, metrics] = args;
      const centerX = metrics.x + metrics.width * 0.5;
      const centerY = metrics.y + metrics.height * 0.5;
      const halfW = metrics.width * 0.5;
      const halfH = metrics.height * 0.5;
      return Math.abs(x - centerX) / Math.max(1, halfW) + Math.abs(y - centerY) / Math.max(1, halfH) <= 1.03;
    }

    createWorldTileColorWaterMask(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.createWorldTileColorWaterMask === 'function'
        ? renderer.createWorldTileColorWaterMask(...args)
        : undefined;
      return result === undefined ? null : result;
    }

    createWorldTileTransparentWaterMask(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.createWorldTileTransparentWaterMask === 'function'
        ? renderer.createWorldTileTransparentWaterMask(...args)
        : undefined;
      return result === undefined ? null : result;
    }

    getWorldTileTemplateMask(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.getWorldTileTemplateMask === 'function'
        ? renderer.getWorldTileTemplateMask(...args)
        : undefined;
      return result === undefined ? null : result;
    }

    getWorldTileDryTemplateCanvas(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.getWorldTileDryTemplateCanvas === 'function'
        ? renderer.getWorldTileDryTemplateCanvas(...args)
        : undefined;
      return result === undefined ? null : result;
    }

    drawCanvasClipped(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.drawCanvasClipped === 'function'
        ? renderer.drawCanvasClipped(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    getWorldTileCompositeContext(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.getWorldTileCompositeContext === 'function'
        ? renderer.getWorldTileCompositeContext(...args)
        : undefined;
      return result === undefined ? null : result;
    }

    drawWorldTileTemplateSource(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.drawWorldTileTemplateSource === 'function'
        ? renderer.drawWorldTileTemplateSource(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    drawWorldTileDryTemplate(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.drawWorldTileDryTemplate === 'function'
        ? renderer.drawWorldTileDryTemplate(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    getWorldTileTemplateBaseAsset(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.getWorldTileTemplateBaseAsset === 'function'
        ? renderer.getWorldTileTemplateBaseAsset(...args)
        : undefined;
      return result === undefined ? null : result;
    }

    getWorldTileWaterTemplateAssets(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.getWorldTileWaterTemplateAssets === 'function'
        ? renderer.getWorldTileWaterTemplateAssets(...args)
        : undefined;
      return result === undefined ? [] : result;
    }

    getWorldTileWaterWorkContext(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.getWorldTileWaterWorkContext === 'function'
        ? renderer.getWorldTileWaterWorkContext(...args)
        : undefined;
      return result === undefined ? null : result;
    }

    positiveModulo(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.positiveModulo === 'function'
        ? renderer.positiveModulo(...args)
        : undefined;
      if (result !== undefined) return result;
      const [value, size] = args;
      return ((value % size) + size) % size;
    }

    getWorldTileMapPosition(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.getWorldTileMapPosition === 'function'
        ? renderer.getWorldTileMapPosition(...args)
        : undefined;
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
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.fillWorldTileWaterTexture === 'function'
        ? renderer.fillWorldTileWaterTexture(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    drawWorldTileWaterDiamond(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.drawWorldTileWaterDiamond === 'function'
        ? renderer.drawWorldTileWaterDiamond(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    drawWorldTileWaterLayer(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.drawWorldTileWaterLayer === 'function'
        ? renderer.drawWorldTileWaterLayer(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    drawWorldTileWater(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.drawWorldTileWater === 'function'
        ? renderer.drawWorldTileWater(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    isWorldTileMapWaterAnimated(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.isWorldTileMapWaterAnimated === 'function'
        ? renderer.isWorldTileMapWaterAnimated(...args)
        : undefined;
      if (result !== undefined) return result;
      const [tileMapView = {}] = args;
      return (tileMapView.tiles || []).some((tile) => tile.water?.asset);
    }

    getWorldTileMapFallbackSignature(...args) {
      return this.worldTileMapCacheCoordinator.getWorldTileMapFallbackSignature(...args);
    }

    resolveWorldTileMapView(...args) {
      return this.worldTileMapCacheCoordinator.resolveWorldTileMapView(...args);
    }

    drawWorldTileBase(tile = {}, center = {}, drawRect = {}, viewport = {}) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.drawWorldTileBase === 'function'
        ? renderer.drawWorldTileBase(tile, center, drawRect, viewport)
        : undefined;
      if (result !== undefined) return result;
      const baseTemplate = this.getWorldTileTemplateBaseAsset(tile);
      const baseAsset = baseTemplate?.asset || tile.terrainAsset || '';
      const hasWater = Boolean(tile.water?.kind && tile.water?.asset && baseTemplate?.asset);
      const drawnWater = hasWater ? this.drawWorldTileWater(tile, center, drawRect, viewport) : false;
      if (drawnWater) return true;
      return this.drawTileAsset(baseAsset, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
    }

    drawCoverAsset(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.drawCoverAsset === 'function'
        ? renderer.drawCoverAsset(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    drawFamousPortraitLayer(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.drawFamousPortraitLayer === 'function'
        ? renderer.drawFamousPortraitLayer(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    drawFamousPortrait(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.drawFamousPortrait === 'function'
        ? renderer.drawFamousPortrait(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    drawFamousAttributeRadar(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.drawFamousAttributeRadar === 'function'
        ? renderer.drawFamousAttributeRadar(...args)
        : undefined;
      return result === undefined ? undefined : result;
    }

    drawFamousAttributePointControls(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.drawFamousAttributePointControls === 'function'
        ? renderer.drawFamousAttributePointControls(...args)
        : undefined;
      return result === undefined ? 0 : result;
    }

    getFamousQualityStyle(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.getFamousQualityStyle === 'function'
        ? renderer.getFamousQualityStyle(...args)
        : undefined;
      return result === undefined ? { fill: 'rgba(43, 43, 42, 0.96)', stroke: '#d9d8cf', inset: 'rgba(255, 255, 255, 0.18)', glow: 'rgba(255, 255, 255, 0.1)', text: '#eeeee8' } : result;
    }

    drawFamousAvatarCard(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.drawFamousAvatarCard === 'function'
        ? renderer.drawFamousAvatarCard(...args)
        : undefined;
      return result === undefined ? undefined : result;
    }

    renderFamousRosterGrid(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.renderFamousRosterGrid === 'function'
        ? renderer.renderFamousRosterGrid(...args)
        : undefined;
      return result === undefined ? { nextY: args[2] || 0, pageInfo: { index: 0, pages: 1 } } : result;
    }

    renderFamousPersonDetail(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.renderFamousPersonDetail === 'function'
        ? renderer.renderFamousPersonDetail(...args)
        : undefined;
      return result === undefined ? undefined : result;
    }

    clear(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.clear === 'function'
        ? renderer.clear(...args)
        : undefined;
    }

    clearAll(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.clearAll === 'function'
        ? renderer.clearAll(...args)
        : undefined;
    }

    drawText(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.drawText === 'function'
        ? renderer.drawText(...args)
        : undefined;
    }

    drawTextLines(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.drawTextLines === 'function'
        ? renderer.drawTextLines(...args)
        : undefined;
    }

    wrapText(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.wrapText === 'function'
        ? renderer.wrapText(...args)
        : undefined;
      return result === undefined ? [String(args[0] ?? '')].filter(Boolean) : result;
    }

    measureTextWidth(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.measureTextWidth === 'function'
        ? renderer.measureTextWidth(...args)
        : undefined;
      const [text, options = {}] = args;
      return result === undefined ? String(text ?? '').length * (options.size || 14) * 0.55 : result;
    }

    truncateText(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.truncateText === 'function'
        ? renderer.truncateText(...args)
        : undefined;
      const [text, maxWidth] = args;
      return result === undefined ? String(text ?? '').slice(0, Math.max(0, Number(maxWidth) || 0) || undefined) : result;
    }

    wrapTextLimit(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.wrapTextLimit === 'function'
        ? renderer.wrapTextLimit(...args)
        : undefined;
      return result === undefined ? this.wrapText(args[0], args[1], args[3]).slice(0, Math.max(1, Number(args[2]) || 1)) : result;
    }

    drawLine(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.drawLine === 'function'
        ? renderer.drawLine(...args)
        : undefined;
    }

    drawPolyline(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.drawPolyline === 'function'
        ? renderer.drawPolyline(...args)
        : undefined;
    }

    drawCurvePath(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.drawCurvePath === 'function'
        ? renderer.drawCurvePath(...args)
        : undefined;
    }

    drawCircle(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.drawCircle === 'function'
        ? renderer.drawCircle(...args)
        : undefined;
    }

    beginFrame(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.beginFrame === 'function'
        ? renderer.beginFrame(...args)
        : undefined;
      return result === undefined ? Date.now() : result;
    }

    endFrame(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.endFrame === 'function'
        ? renderer.endFrame(...args)
        : undefined;
    }

    getNow(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.getNow === 'function'
        ? renderer.getNow(...args)
        : undefined;
      return result === undefined ? (this.frameNow || Date.now()) : result;
    }

    updateFps(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.updateFps === 'function'
        ? renderer.updateFps(...args)
        : undefined;
      return result === undefined ? this.currentFps : result;
    }

    renderFpsOverlay(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.renderFpsOverlay === 'function'
        ? renderer.renderFpsOverlay(...args)
        : undefined;
    }

    drawPanel(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.drawPanel === 'function'
        ? renderer.drawPanel(...args)
        : undefined;
    }

    drawButton(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.drawButton === 'function'
        ? renderer.drawButton(...args)
        : undefined;
    }

    drawPrimaryActionButton(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.drawPrimaryActionButton === 'function'
        ? renderer.drawPrimaryActionButton(...args)
        : undefined;
    }

    drawProgressBar(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.drawProgressBar === 'function'
        ? renderer.drawProgressBar(...args)
        : undefined;
    }

    drawIconCard(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.drawIconCard === 'function'
        ? renderer.drawIconCard(...args)
        : undefined;
    }

    renderSectionHeader(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.renderSectionHeader === 'function'
        ? renderer.renderSectionHeader(...args)
        : undefined;
    }

    getTopBarBottom(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.getTopBarBottom === 'function'
        ? renderer.getTopBarBottom(...args)
        : undefined;
      if (result !== undefined) return result;
      const [state = {}, options = {}] = args;
      if (options.isMapHome) return 72;
      if (!this.presenter) return 84;
      const cityView = this.presenter.buildCitySwitcherViewState ? this.presenter.buildCitySwitcherViewState(state) : { hidden: true };
      return 12 + (cityView.hidden ? 128 : 166) + 12;
    }

    renderTopBar(...args) {
      const renderer = this.resourceTopBarRenderer;
      const result = typeof renderer?.renderTopBar === 'function'
        ? renderer.renderTopBar(...args)
        : undefined;
      return result === undefined ? 84 : result;
    }

    renderMapHomeTopBar(...args) {
      const renderer = this.resourceTopBarRenderer;
      const result = typeof renderer?.renderMapHomeTopBar === 'function'
        ? renderer.renderMapHomeTopBar(...args)
        : undefined;
      return result === undefined ? 72 : result;
    }

    renderGuideTasks(...args) {
      const renderer = this.guideTaskRenderer;
      const result = typeof renderer?.renderGuideTasks === 'function'
        ? renderer.renderGuideTasks(...args)
        : undefined;
      return result === undefined ? (args.length > 1 ? args[1] : 0) : result;
    }

    renderTaskCenterButton(...args) {
      const renderer = this.guideTaskRenderer;
      return typeof renderer?.renderTaskCenterButton === 'function'
        ? renderer.renderTaskCenterButton(...args)
        : undefined;
    }

    renderGuidebookButton(...args) {
      const renderer = this.guideTaskRenderer;
      return typeof renderer?.renderGuidebookButton === 'function'
        ? renderer.renderGuidebookButton(...args)
        : undefined;
    }

    renderGuidebookPanel(...args) {
      const renderer = this.guideTaskRenderer;
      const result = typeof renderer?.renderGuidebookPanel === 'function'
        ? renderer.renderGuidebookPanel(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderTaskCenterPanel(...args) {
      const renderer = this.guideTaskRenderer;
      const result = typeof renderer?.renderTaskCenterPanel === 'function'
        ? renderer.renderTaskCenterPanel(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderPopulation(...args) {
      const renderer = this.cityPeopleRenderer;
      const result = renderer && typeof renderer.renderPopulation === 'function'
        ? renderer.renderPopulation(...args)
        : undefined;
      return result === undefined ? (Number(args[1]) || 84) + 180 : result;
    }

    renderLoginPanel(...args) {
      const renderer = this.systemRenderer;
      return typeof renderer?.renderLoginPanel === 'function'
        ? renderer.renderLoginPanel(...args)
        : undefined;
    }

    renderLoadingScreen(...args) {
      const renderer = this.systemRenderer;
      return typeof renderer?.renderLoadingScreen === 'function'
        ? renderer.renderLoadingScreen(...args)
        : undefined;
    }

    renderNetworkOverlay(...args) {
      const renderer = this.systemRenderer;
      const result = typeof renderer?.renderNetworkOverlay === 'function'
        ? renderer.renderNetworkOverlay(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderSettingsPanel(...args) {
      const renderer = this.systemRenderer;
      return typeof renderer?.renderSettingsPanel === 'function'
        ? renderer.renderSettingsPanel(...args)
        : undefined;
    }

    renderConfirmDialog(...args) {
      const renderer = this.systemRenderer;
      const result = typeof renderer?.renderConfirmDialog === 'function'
        ? renderer.renderConfirmDialog(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderLogsPanel(...args) {
      const renderer = this.systemRenderer;
      return typeof renderer?.renderLogsPanel === 'function'
        ? renderer.renderLogsPanel(...args)
        : undefined;
    }

    getActiveCitySummary(...args) {
      const renderer = this.cityRenderer;
      const result = typeof renderer?.getActiveCitySummary === 'function'
        ? renderer.getActiveCitySummary(...args)
        : undefined;
      return result === undefined ? {
        id: 'capital',
        name: t('city.capitalName'),
        tag: t('home.city.main'),
        level: '',
        population: {},
        military: {},
        terrainLabel: t('home.planning.terrain.plains'),
      } : result;
    }

    renderCitySwitcherMenu(...args) {
      const renderer = this.cityRenderer;
      return typeof renderer?.renderCitySwitcherMenu === 'function'
        ? renderer.renderCitySwitcherMenu(...args)
        : undefined;
    }

    renderCityManagementPanel(...args) {
      const renderer = this.cityRenderer;
      return typeof renderer?.renderCityManagementPanel === 'function'
        ? renderer.renderCityManagementPanel(...args)
        : undefined;
    }

    renderCityMilitaryPanel(...args) {
      const renderer = this.cityRenderer;
      return typeof renderer?.renderCityMilitaryPanel === 'function'
        ? renderer.renderCityMilitaryPanel(...args)
        : undefined;
    }

    renderSubcityListPanel(...args) {
      const renderer = this.cityRenderer;
      return typeof renderer?.renderSubcityListPanel === 'function'
        ? renderer.renderSubcityListPanel(...args)
        : undefined;
    }

    renderNamingModal(...args) {
      const renderer = this.overlayRenderer;
      return typeof renderer?.renderNamingModal === 'function'
        ? renderer.renderNamingModal(...args)
        : undefined;
    }

    renderFloatingTexts(...args) {
      const renderer = this.overlayRenderer;
      return typeof renderer?.renderFloatingTexts === 'function'
        ? renderer.renderFloatingTexts(...args)
        : undefined;
    }

    drawRewardParticle(...args) {
      const renderer = this.overlayRenderer;
      return typeof renderer?.drawRewardParticle === 'function'
        ? renderer.drawRewardParticle(...args)
        : undefined;
    }

    renderRewardReveal(...args) {
      const renderer = this.overlayRenderer;
      return typeof renderer?.renderRewardReveal === 'function'
        ? renderer.renderRewardReveal(...args)
        : undefined;
    }

    renderResourceDetailsPanel(...args) {
      const renderer = this.overlayRenderer;
      return typeof renderer?.renderResourceDetailsPanel === 'function'
        ? renderer.renderResourceDetailsPanel(...args)
        : undefined;
    }

    renderAdvisor(...args) {
      const renderer = this.advisorRenderer;
      return typeof renderer?.renderAdvisor === 'function'
        ? renderer.renderAdvisor(...args)
        : undefined;
    }

    getMapHomeFloatingButtonLayout(...args) {
      const renderer = this.advisorRenderer;
      const result = typeof renderer?.getMapHomeFloatingButtonLayout === 'function'
        ? renderer.getMapHomeFloatingButtonLayout(...args)
        : undefined;
      return result === undefined ? { x: 0, y: 0, size: 48 } : result;
    }

    renderFloatingAdvisorButton(...args) {
      const renderer = this.advisorRenderer;
      return typeof renderer?.renderFloatingAdvisorButton === 'function'
        ? renderer.renderFloatingAdvisorButton(...args)
        : undefined;
    }

    renderAdvisorPanel(...args) {
      const renderer = this.advisorRenderer;
      return typeof renderer?.renderAdvisorPanel === 'function'
        ? renderer.renderAdvisorPanel(...args)
        : undefined;
    }

    renderFamousPersonItem(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.renderFamousPersonItem === 'function'
        ? renderer.renderFamousPersonItem(...args)
        : undefined;
      return result === undefined ? args[2] || 0 : result;
    }

    renderFamousSkillTooltip(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.renderFamousSkillTooltip === 'function'
        ? renderer.renderFamousSkillTooltip(...args)
        : undefined;
      return result === undefined ? undefined : result;
    }

    normalizeFamousPersonsPage(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.normalizeFamousPersonsPage === 'function'
        ? renderer.normalizeFamousPersonsPage(...args)
        : undefined;
      if (result !== undefined) return result;
      const total = args[0];
      const page = args[1];
      const pageSize = args[2];
      const pages = Math.max(1, Math.ceil(Math.max(0, Number(total) || 0) / Math.max(1, pageSize)));
      const index = Math.max(0, Math.min(pages - 1, Math.floor(Number(page) || 0)));
      return { index, pages };
    }

    renderFamousPersonsPager(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.renderFamousPersonsPager === 'function'
        ? renderer.renderFamousPersonsPager(...args)
        : undefined;
      return result === undefined ? undefined : result;
    }

    renderFamousPersonsPanel(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.renderFamousPersonsPanel === 'function'
        ? renderer.renderFamousPersonsPanel(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderArmyFormationEditor(...args) {
      const renderer = this.armyFormationEditorRenderer;
      return typeof renderer?.renderArmyFormationEditor === 'function'
        ? renderer.renderArmyFormationEditor(...args)
        : undefined;
    }

    renderBuildings(...args) {
      const renderer = this.buildingRenderer;
      const result = typeof renderer?.renderBuildings === 'function'
        ? renderer.renderBuildings(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    drawBuildingCategoryTabs(...args) {
      const renderer = this.buildingRenderer;
      const result = typeof renderer?.drawBuildingCategoryTabs === 'function'
        ? renderer.drawBuildingCategoryTabs(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    drawBuildingInfoLine(...args) {
      const renderer = this.buildingRenderer;
      const result = typeof renderer?.drawBuildingInfoLine === 'function'
        ? renderer.drawBuildingInfoLine(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    drawBuildingPlanningBadges(...args) {
      const renderer = this.buildingRenderer;
      const result = typeof renderer?.drawBuildingPlanningBadges === 'function'
        ? renderer.drawBuildingPlanningBadges(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    resourceShortName(resource) {
      const renderer = this.buildingRenderer;
      const result = typeof renderer?.resourceShortName === 'function'
        ? renderer.resourceShortName(resource)
        : undefined;
      return result === undefined ? resource : result;
    }

    resourceIconPath(resource) {
      const renderer = this.buildingRenderer;
      const result = typeof renderer?.resourceIconPath === 'function'
        ? renderer.resourceIconPath(resource)
        : undefined;
      return result === undefined ? '' : result;
    }

    buildingCostResourceAliases(resource) {
      const renderer = this.buildingRenderer;
      const result = typeof renderer?.buildingCostResourceAliases === 'function'
        ? renderer.buildingCostResourceAliases(resource)
        : undefined;
      return result === undefined ? [resource] : result;
    }

    formatBuildingCostAmount(value) {
      const renderer = this.buildingRenderer;
      const result = typeof renderer?.formatBuildingCostAmount === 'function'
        ? renderer.formatBuildingCostAmount(value)
        : undefined;
      return result === undefined ? String(value ?? 0) : result;
    }

    getBuildingCostSlot(...args) {
      const renderer = this.buildingRenderer;
      const result = typeof renderer?.getBuildingCostSlot === 'function'
        ? renderer.getBuildingCostSlot(...args)
        : undefined;
      return result === undefined ? { resource: args[1], value: 0, text: '0', present: false } : result;
    }

    getOwnedBuildingResource(...args) {
      const renderer = this.buildingRenderer;
      const result = typeof renderer?.getOwnedBuildingResource === 'function'
        ? renderer.getOwnedBuildingResource(...args)
        : undefined;
      return result === undefined ? 0 : result;
    }

    drawBuildingActionButton(...args) {
      const renderer = this.buildingRenderer;
      const result = typeof renderer?.drawBuildingActionButton === 'function'
        ? renderer.drawBuildingActionButton(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    drawBuildingCostChips(...args) {
      const renderer = this.buildingRenderer;
      const result = typeof renderer?.drawBuildingCostChips === 'function'
        ? renderer.drawBuildingCostChips(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    eventRowColor(tone) {
      const renderer = this.eventRenderer;
      const result = typeof renderer?.eventRowColor === 'function'
        ? renderer.eventRowColor(tone)
        : undefined;
      return result === undefined ? '#cbbd96' : result;
    }

    drawEventDetailRow(...args) {
      const renderer = this.eventRenderer;
      const result = typeof renderer?.drawEventDetailRow === 'function'
        ? renderer.drawEventDetailRow(...args)
        : undefined;
      return result === undefined ? 0 : result;
    }

    drawEventParts(...args) {
      const renderer = this.eventRenderer;
      const result = typeof renderer?.drawEventParts === 'function'
        ? renderer.drawEventParts(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderEvents(...args) {
      const renderer = this.eventRenderer;
      const result = typeof renderer?.renderEvents === 'function'
        ? renderer.renderEvents(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderEventModal(...args) {
      const renderer = this.eventRenderer;
      const result = typeof renderer?.renderEventModal === 'function'
        ? renderer.renderEventModal(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderCivilization(...args) {
      const renderer = this.civilizationRenderer;
      return typeof renderer?.renderCivilization === 'function'
        ? renderer.renderCivilization(...args)
        : undefined;
    }

    getTechRouteCatalog() {
      const renderer = this.techRenderer;
      return typeof renderer?.getTechRouteCatalog === 'function'
        ? renderer.getTechRouteCatalog(...arguments) || {}
        : {};
    }

    getTechRouteMeta(route) {
      const renderer = this.techRenderer;
      return typeof renderer?.getTechRouteMeta === 'function'
        ? renderer.getTechRouteMeta(...arguments) || { lane: 0, label: route || 'route', color: '#f0b45b', icon: 'assets/art/icon-science-cutout.webp' }
        : { lane: 0, label: route || 'route', color: '#f0b45b', icon: 'assets/art/icon-science-cutout.webp' };
    }

    getTechNodeRoutes() {
      const renderer = this.techRenderer;
      return typeof renderer?.getTechNodeRoutes === 'function'
        ? renderer.getTechNodeRoutes(...arguments) || []
        : [];
    }

    getTechNodeRouteLabel(node = {}) {
      const renderer = this.techRenderer;
      return typeof renderer?.getTechNodeRouteLabel === 'function'
        ? renderer.getTechNodeRouteLabel(...arguments) || node.routeLabel || 'route'
        : node.routeLabel || 'route';
    }

    getTechNodePrimaryRoute(node = {}) {
      const renderer = this.techRenderer;
      return typeof renderer?.getTechNodePrimaryRoute === 'function'
        ? renderer.getTechNodePrimaryRoute(...arguments) || node.route || ''
        : node.route || '';
    }

    getTechNodeLane() {
      const renderer = this.techRenderer;
      const lane = typeof renderer?.getTechNodeLane === 'function'
        ? renderer.getTechNodeLane(...arguments)
        : undefined;
      return Number.isFinite(Number(lane)) ? Number(lane) : 0;
    }

    drawTechRouteSegments(...args) {
      const renderer = this.techRenderer;
      return typeof renderer?.drawTechRouteSegments === 'function'
        ? renderer.drawTechRouteSegments(...args)
        : undefined;
    }

    getTechNodeColor() {
      const renderer = this.techRenderer;
      return typeof renderer?.getTechNodeColor === 'function'
        ? renderer.getTechNodeColor(...arguments) || { fill: 'rgba(45, 34, 24, 0.82)', stroke: 'rgba(255, 226, 177, 0.18)', accent: '#f0b45b', text: '#ddd0ad', muted: 'rgba(203, 189, 150, 0.58)' }
        : { fill: 'rgba(45, 34, 24, 0.82)', stroke: 'rgba(255, 226, 177, 0.18)', accent: '#f0b45b', text: '#ddd0ad', muted: 'rgba(203, 189, 150, 0.58)' };
    }

    renderTechNode(...args) {
      const renderer = this.techRenderer;
      return typeof renderer?.renderTechNode === 'function'
        ? renderer.renderTechNode(...args)
        : undefined;
    }

    renderTechDetailPanel(...args) {
      const renderer = this.techRenderer;
      return typeof renderer?.renderTechDetailPanel === 'function'
        ? renderer.renderTechDetailPanel(...args)
        : undefined;
    }

    getTechDetailIcon() {
      const renderer = this.techRenderer;
      return typeof renderer?.getTechDetailIcon === 'function'
        ? renderer.getTechDetailIcon(...arguments) || 'assets/art/icon-science-cutout.webp'
        : 'assets/art/icon-science-cutout.webp';
    }

    renderTechDetailModal(...args) {
      const renderer = this.techRenderer;
      return typeof renderer?.renderTechDetailModal === 'function'
        ? renderer.renderTechDetailModal(...args)
        : undefined;
    }

    getTechTreeLayout(_view = {}, panel = {}, options = {}) {
      const renderer = this.techRenderer;
      const result = typeof renderer?.getTechTreeLayout === 'function'
        ? renderer.getTechTreeLayout(...arguments)
        : undefined;
      return result || {
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
      const renderer = this.techRenderer;
      return typeof renderer?.renderTechInternal === 'function'
        ? renderer.renderTechInternal(...args) || false
        : false;
    }

    renderMilitarySubTabs(...args) {
      const renderer = this.militaryRenderer;
      const result = typeof renderer?.renderMilitarySubTabs === 'function'
        ? renderer.renderMilitarySubTabs(...args)
        : undefined;
      return result === undefined ? 0 : result;
    }

    renderMilitaryArmyView(...args) {
      const renderer = this.militaryRenderer;
      const result = typeof renderer?.renderMilitaryArmyView === 'function'
        ? renderer.renderMilitaryArmyView(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderArmyFormationPortrait(...args) {
      const renderer = this.militaryRenderer;
      const result = typeof renderer?.renderArmyFormationPortrait === 'function'
        ? renderer.renderArmyFormationPortrait(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderArmyFormationCard(...args) {
      const renderer = this.militaryRenderer;
      const result = typeof renderer?.renderArmyFormationCard === 'function'
        ? renderer.renderArmyFormationCard(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderArmyFormationStrip(...args) {
      const renderer = this.militaryRenderer;
      const result = typeof renderer?.renderArmyFormationStrip === 'function'
        ? renderer.renderArmyFormationStrip(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    getScoutButtonTone(...args) {
      const renderer = this.militaryRenderer;
      const result = typeof renderer?.getScoutButtonTone === 'function'
        ? renderer.getScoutButtonTone(...args)
        : undefined;
      return result === undefined ? { fill: 'rgba(63, 47, 32, 0.78)', stroke: 'rgba(240, 180, 91, 0.25)' } : result;
    }

    renderMilitaryScoutView(...args) {
      const renderer = this.militaryRenderer;
      const result = typeof renderer?.renderMilitaryScoutView === 'function'
        ? renderer.renderMilitaryScoutView(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderWorldReports(...args) {
      const renderer = this.militaryRenderer;
      const result = typeof renderer?.renderWorldReports === 'function'
        ? renderer.renderWorldReports(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderTutorialIntro(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.renderTutorialIntro === 'function'
        ? renderer.renderTutorialIntro(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    disposeTutorialAdvisorSpine(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.disposeTutorialAdvisorSpine === 'function'
        ? renderer.disposeTutorialAdvisorSpine(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    resolveTutorialIntroTarget(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.resolveTutorialIntroTarget === 'function'
        ? renderer.resolveTutorialIntroTarget(...args)
        : undefined;
      return result === undefined ? null : result;
    }

    findHitTarget(...args) {
      return this.hitTargetManager.findHitTarget(...args);
    }

    inflateRect(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.inflateRect === 'function'
        ? renderer.inflateRect(...args)
        : undefined;
      return result === undefined ? { x: 0, y: 0, width: 0, height: 0, action: null } : result;
    }

    renderTutorialIntroMarch(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.renderTutorialIntroMarch === 'function'
        ? renderer.renderTutorialIntroMarch(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderTutorialIntroUnit(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.renderTutorialIntroUnit === 'function'
        ? renderer.renderTutorialIntroUnit(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderTutorialIntroSpotlight(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.renderTutorialIntroSpotlight === 'function'
        ? renderer.renderTutorialIntroSpotlight(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    normalizeRect(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.normalizeRect === 'function'
        ? renderer.normalizeRect(...args)
        : undefined;
      return result === undefined ? null : result;
    }

    renderTutorialIntroFinger(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.renderTutorialIntroFinger === 'function'
        ? renderer.renderTutorialIntroFinger(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderTutorialIntroDialogue(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.renderTutorialIntroDialogue === 'function'
        ? renderer.renderTutorialIntroDialogue(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderTutorialAdvisorDialogue(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.renderTutorialAdvisorDialogue === 'function'
        ? renderer.renderTutorialAdvisorDialogue(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    clearTutorialAdvisorDialogue(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.clearTutorialAdvisorDialogue === 'function'
        ? renderer.clearTutorialAdvisorDialogue(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderTutorialIntroAdvisorPortrait(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.renderTutorialIntroAdvisorPortrait === 'function'
        ? renderer.renderTutorialIntroAdvisorPortrait(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderTutorialAdvisorSpineLayer(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.renderTutorialAdvisorSpineLayer === 'function'
        ? renderer.renderTutorialAdvisorSpineLayer(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    drawTutorialAdvisorImageCover(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.drawTutorialAdvisorImageCover === 'function'
        ? renderer.drawTutorialAdvisorImageCover(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderMilitary(...args) {
      const renderer = this.militaryRenderer;
      const result = typeof renderer?.renderMilitary === 'function'
        ? renderer.renderMilitary(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderMainPanel(...args) {
      const renderer = this.hudTabPageRenderer;
      return typeof renderer?.renderMainPanel === 'function'
        ? renderer.renderMainPanel(...args)
        : undefined;
    }

    renderHudTabPage(...args) {
      const renderer = this.hudTabPageRenderer;
      return typeof renderer?.renderHudTabPage === 'function'
        ? renderer.renderHudTabPage(...args)
        : undefined;
    }

    renderHudTabPageWithTransition(...args) {
      const renderer = this.hudTabPageRenderer;
      return typeof renderer?.renderHudTabPageWithTransition === 'function'
        ? renderer.renderHudTabPageWithTransition(...args)
        : undefined;
    }

    getWorldMapLayerLayout(...args) {
      const renderer = this.worldMapLayerRenderer;
      const result = typeof renderer?.getWorldMapLayerLayout === 'function'
        ? renderer.getWorldMapLayerLayout(...args)
        : undefined;
      return result === undefined ? null : result;
    }

    renderMapHomeWorldView(...args) {
      const renderer = this.worldMapLayerRenderer;
      const result = typeof renderer?.renderMapHomeWorldView === 'function'
        ? renderer.renderMapHomeWorldView(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    collectMapHomeWorldSiteHitTargets(...args) {
      const renderer = this.worldMapLayerRenderer;
      const result = typeof renderer?.collectMapHomeWorldSiteHitTargets === 'function'
        ? renderer.collectMapHomeWorldSiteHitTargets(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderMapHomeEmptyWorld(...args) {
      const renderer = this.worldMapLayerRenderer;
      const result = typeof renderer?.renderMapHomeEmptyWorld === 'function'
        ? renderer.renderMapHomeEmptyWorld(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderWorldMapLayer(...args) {
      const renderer = this.worldMapLayerRenderer;
      const result = typeof renderer?.renderWorldMapLayer === 'function'
        ? renderer.renderWorldMapLayer(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderWorldMapSnapshotLayer(...args) {
      const renderer = this.worldMapLayerRenderer;
      const result = typeof renderer?.renderWorldMapSnapshotLayer === 'function'
        ? renderer.renderWorldMapSnapshotLayer(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderMapCommandDock(...args) {
      const renderer = this.mapCommandRenderer;
      return typeof renderer?.renderMapCommandDock === 'function'
        ? renderer.renderMapCommandDock(...args)
        : undefined;
    }

    renderFloatingSubcityButton(...args) {
      const renderer = this.mapCommandRenderer;
      return typeof renderer?.renderFloatingSubcityButton === 'function'
        ? renderer.renderFloatingSubcityButton(...args)
        : undefined;
    }

    renderFloatingEventButton(...args) {
      const renderer = this.mapCommandRenderer;
      return typeof renderer?.renderFloatingEventButton === 'function'
        ? renderer.renderFloatingEventButton(...args)
        : undefined;
    }

    renderMapCommandPanel(...args) {
      const renderer = this.mapCommandRenderer;
      return typeof renderer?.renderMapCommandPanel === 'function'
        ? renderer.renderMapCommandPanel(...args)
        : undefined;
    }

    renderTabs(...args) {
      const renderer = this.tabBarRenderer;
      return typeof renderer?.renderTabs === 'function' ? renderer.renderTabs(...args) : undefined;
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
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.renderTutorialHighlight === 'function'
        ? renderer.renderTutorialHighlight(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    addTutorialShield(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.addTutorialShield === 'function'
        ? renderer.addTutorialShield(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderHudOverlay(...args) {
      const renderer = this.hudOverlayRenderer;
      if (!renderer || typeof renderer.renderHudOverlay !== 'function') return undefined;
      return renderer.renderHudOverlay(...args);
    }

    render(state = {}, options = {}) {
      const renderer = this.frameRenderer;
      if (renderer) {
        return typeof renderer.render === 'function' ? renderer.render(...arguments) : undefined;
      }
      if (options.mode === 'hud') return this.renderHudOverlay(state, options);
      this.beginFrame(options);
      this.setHitTargets([]);
      this.clear();
      this.renderTopBar(state, options);
      this.renderTabs(options.activeTab || 'resources', state, options);
      this.endFrame(options);
      return undefined;
    }

    renderMapHomeOverlays() {
      const renderer = this.frameRenderer;
      if (!renderer || typeof renderer.renderMapHomeOverlays !== 'function') return undefined;
      return renderer.renderMapHomeOverlays(...arguments);
    }

    renderMapHomeExplorerHud(...args) {
      const renderer = this.frameRenderer;
      if (!renderer || typeof renderer.renderMapHomeExplorerHud !== 'function') return false;
      return renderer.renderMapHomeExplorerHud(...args);
    }

    renderCanvasDebugResetButton(...args) {
      const renderer = this.frameRenderer;
      if (!renderer || typeof renderer.renderCanvasDebugResetButton !== 'function') return false;
      return renderer.renderCanvasDebugResetButton(...args);
    }

    getWorldTileScreenCenter(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileScreenCenter === 'function'
          ? renderer.getWorldTileScreenCenter(...args)
          : undefined;
      return result === undefined ? { x: 0, y: 0 } : result;
    }

    getWorldTileDrawRect(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileDrawRect === 'function'
          ? renderer.getWorldTileDrawRect(...args)
          : undefined;
      return result === undefined ? { x: 0, y: 0, width: 0, height: 0 } : result;
    }

    drawIsoDiamond(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.drawIsoDiamond === 'function'
          ? renderer.drawIsoDiamond(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    getFallbackTerrainFill(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getFallbackTerrainFill === 'function'
          ? renderer.getFallbackTerrainFill(...args)
          : undefined;
      return result === undefined ? 'rgba(90, 122, 70, 0.9)' : result;
    }

    hashString(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.hashString === 'function' ? renderer.hashString(...args) : undefined;
      return result === undefined ? 0 : result;
    }

    random01(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.random01 === 'function' ? renderer.random01(...args) : undefined;
      return result === undefined ? 0 : result;
    }

    getWorldOverlayAnchor(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldOverlayAnchor === 'function'
          ? renderer.getWorldOverlayAnchor(...args)
          : undefined;
      return result === undefined ? { x: 0, y: 0 } : result;
    }

    getWorldTileImageAspect(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileImageAspect === 'function'
          ? renderer.getWorldTileImageAspect(...args)
          : undefined;
      return result === undefined ? 1 : result;
    }

    drawWorldOverlayShadow(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.drawWorldOverlayShadow === 'function'
          ? renderer.drawWorldOverlayShadow(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    drawWorldOverlayAsset(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.drawWorldOverlayAsset === 'function'
          ? renderer.drawWorldOverlayAsset(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    drawWorldTerrainFeature(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.drawWorldTerrainFeature === 'function'
          ? renderer.drawWorldTerrainFeature(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    drawWorldTileFeature(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.drawWorldTileFeature === 'function'
          ? renderer.drawWorldTileFeature(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    getWorldTileSiteLayout(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileSiteLayout === 'function'
          ? renderer.getWorldTileSiteLayout(...args)
          : undefined;
      return result === undefined ? null : result;
    }

    drawWorldTileSite(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.drawWorldTileSite === 'function'
          ? renderer.drawWorldTileSite(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    getWorldTileRenderEntries(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileRenderEntries === 'function'
          ? renderer.getWorldTileRenderEntries(...args)
          : undefined;
      return result === undefined ? [] : result;
    }

    getWorldTileLocalEntries(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileLocalEntries === 'function'
          ? renderer.getWorldTileLocalEntries(...args)
          : undefined;
      return result === undefined ? [] : result;
    }

    getWorldTileKey(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileKey === 'function'
          ? renderer.getWorldTileKey(...args)
          : undefined;
      return result === undefined ? '' : result;
    }

    getWorldTileRenderedDiamondCenter(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileRenderedDiamondCenter === 'function'
          ? renderer.getWorldTileRenderedDiamondCenter(...args)
          : undefined;
      return result === undefined ? { x: 0, y: 0 } : result;
    }

    getWorldTileStaticCacheLayout(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileStaticCacheLayout === 'function'
          ? renderer.getWorldTileStaticCacheLayout(...args)
          : undefined;
      return result === undefined ? null : result;
    }

    getWorldTileStaticViewportCacheLayout(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileStaticViewportCacheLayout === 'function'
          ? renderer.getWorldTileStaticViewportCacheLayout(...args)
          : undefined;
      return result === undefined ? null : result;
    }

    getWorldTileStaticChunkSize(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileStaticChunkSize === 'function'
          ? renderer.getWorldTileStaticChunkSize(...args)
          : undefined;
      return result === undefined ? 512 : result;
    }

    getWorldTileStaticChunkCacheLimit(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileStaticChunkCacheLimit === 'function'
          ? renderer.getWorldTileStaticChunkCacheLimit(...args)
          : undefined;
      return result === undefined ? 12 : result;
    }

    getWorldTileStaticChunkCacheScale(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileStaticChunkCacheScale === 'function'
          ? renderer.getWorldTileStaticChunkCacheScale(...args)
          : undefined;
      return result === undefined ? 1 : result;
    }

    getWorldTileAtlasFramePadding(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileAtlasFramePadding === 'function'
          ? renderer.getWorldTileAtlasFramePadding(...args)
          : undefined;
      return result === undefined ? 0 : result;
    }

    getWorldTileStaticChunkLayouts(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileStaticChunkLayouts === 'function'
          ? renderer.getWorldTileStaticChunkLayouts(...args)
          : undefined;
      return result === undefined ? [] : result;
    }

    getWorldTileDragCachePanRange(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileDragCachePanRange === 'function'
          ? renderer.getWorldTileDragCachePanRange(...args)
          : undefined;
      return result === undefined ? 0 : result;
    }

    getWorldTileStaticDragCacheLayout(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileStaticDragCacheLayout === 'function'
          ? renderer.getWorldTileStaticDragCacheLayout(...args)
          : undefined;
      return result === undefined ? null : result;
    }

    getWorldTileStaticCacheKey(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileStaticCacheKey === 'function'
          ? renderer.getWorldTileStaticCacheKey(...args)
          : undefined;
      return result === undefined ? '' : result;
    }

    getWorldTileStaticCacheScale(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileStaticCacheScale === 'function'
          ? renderer.getWorldTileStaticCacheScale(...args)
          : undefined;
      return result === undefined ? 1 : result;
    }

    getWorldTileStaticCachePixelBudget(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileStaticCachePixelBudget === 'function'
          ? renderer.getWorldTileStaticCachePixelBudget(...args)
          : undefined;
      return result === undefined ? 0 : result;
    }

    getWorldTileLayerCacheContext(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileLayerCacheContext === 'function'
          ? renderer.getWorldTileLayerCacheContext(...args)
          : undefined;
      return result === undefined ? null : result;
    }

    getWorldTileStaticCacheContext(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileStaticCacheContext === 'function'
          ? renderer.getWorldTileStaticCacheContext(...args)
          : undefined;
      return result === undefined ? null : result;
    }

    getWorldTileWaterLayerCacheContext(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileWaterLayerCacheContext === 'function'
          ? renderer.getWorldTileWaterLayerCacheContext(...args)
          : undefined;
      return result === undefined ? null : result;
    }

    createWorldTileLayerWork(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.createWorldTileLayerWork === 'function'
          ? renderer.createWorldTileLayerWork(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    drawWorldTileLayerCache(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.drawWorldTileLayerCache === 'function'
          ? renderer.drawWorldTileLayerCache(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    getWorldTileFastDragCompositeSignature(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileFastDragCompositeSignature === 'function'
          ? renderer.getWorldTileFastDragCompositeSignature(...args)
          : undefined;
      return result === undefined ? '' : result;
    }

    renderWorldTileFastDragComposite(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileFastDragComposite === 'function'
          ? renderer.renderWorldTileFastDragComposite(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    updateWorldTileFastDragComposite(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.updateWorldTileFastDragComposite === 'function'
          ? renderer.updateWorldTileFastDragComposite(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    resolveWorldTileStaticCacheLayout(...args) {
      const renderer = this.worldMapRenderer;
      return typeof renderer?.resolveWorldTileStaticCacheLayout === 'function'
        ? renderer.resolveWorldTileStaticCacheLayout(...args)
        : undefined;
    }

    getWorldTileStaticChunkCacheKey(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileStaticChunkCacheKey === 'function'
          ? renderer.getWorldTileStaticChunkCacheKey(...args)
          : undefined;
      return result === undefined ? '' : result;
    }

    pruneWorldTileStaticChunkCaches(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.pruneWorldTileStaticChunkCaches === 'function'
          ? renderer.pruneWorldTileStaticChunkCaches(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    renderWorldTileStaticChunk(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileStaticChunk === 'function'
          ? renderer.renderWorldTileStaticChunk(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    renderWorldTileStaticChunks(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileStaticChunks === 'function'
          ? renderer.renderWorldTileStaticChunks(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    getWorldTileWaterChunkCacheKey(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileWaterChunkCacheKey === 'function'
          ? renderer.getWorldTileWaterChunkCacheKey(...args)
          : undefined;
      return result === undefined ? '' : result;
    }

    pruneWorldTileWaterChunkCaches(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.pruneWorldTileWaterChunkCaches === 'function'
          ? renderer.pruneWorldTileWaterChunkCaches(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    getWorldTileWaterChunkFrameCacheId(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileWaterChunkFrameCacheId === 'function'
          ? renderer.getWorldTileWaterChunkFrameCacheId(...args)
          : undefined;
      return result === undefined ? '' : result;
    }

    renderWorldTileWaterChunk(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileWaterChunk === 'function'
          ? renderer.renderWorldTileWaterChunk(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    renderWorldTileWaterChunkFrames(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileWaterChunkFrames === 'function'
          ? renderer.renderWorldTileWaterChunkFrames(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    renderWorldTileWaterChunks(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileWaterChunks === 'function'
          ? renderer.renderWorldTileWaterChunks(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    renderWorldTileSnapshotChunkCacheMap(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileSnapshotChunkCacheMap === 'function'
          ? renderer.renderWorldTileSnapshotChunkCacheMap(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    getWorldTileSnapshotDrawLayout(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileSnapshotDrawLayout === 'function'
          ? renderer.getWorldTileSnapshotDrawLayout(...args)
          : undefined;
      return result === undefined ? null : result;
    }

    renderWorldTileSnapshotLayerCache(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileSnapshotLayerCache === 'function'
          ? renderer.renderWorldTileSnapshotLayerCache(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    renderWorldTileSnapshotCache(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileSnapshotCache === 'function'
          ? renderer.renderWorldTileSnapshotCache(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    renderWorldTileStaticLayer(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileStaticLayer === 'function'
          ? renderer.renderWorldTileStaticLayer(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    getWorldTileWaterAnimationFps(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileWaterAnimationFps === 'function'
          ? renderer.getWorldTileWaterAnimationFps(...args)
          : undefined;
      return result === undefined ? 8 : result;
    }

    getWorldTileWaterAnimationFrameCount(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileWaterAnimationFrameCount === 'function'
          ? renderer.getWorldTileWaterAnimationFrameCount(...args)
          : undefined;
      return result === undefined ? 1 : result;
    }

    getWorldTileWaterAnimationFrameMs(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileWaterAnimationFrameMs === 'function'
          ? renderer.getWorldTileWaterAnimationFrameMs(...args)
          : undefined;
      return result === undefined ? 125 : result;
    }

    getWorldTileWaterTimeMs(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileWaterTimeMs === 'function'
          ? renderer.getWorldTileWaterTimeMs(...args)
          : undefined;
      return result === undefined ? 0 : result;
    }

    getWorldTileWaterAnimationFrame(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileWaterAnimationFrame === 'function'
          ? renderer.getWorldTileWaterAnimationFrame(...args)
          : undefined;
      return result === undefined ? 0 : result;
    }

    getWorldTileWaterAnimationFrameIndex(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileWaterAnimationFrameIndex === 'function'
          ? renderer.getWorldTileWaterAnimationFrameIndex(...args)
          : undefined;
      return result === undefined ? 0 : result;
    }

    getWorldTileWaterFrameTimeMs(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileWaterFrameTimeMs === 'function'
          ? renderer.getWorldTileWaterFrameTimeMs(...args)
          : undefined;
      return result === undefined ? 0 : result;
    }

    getWorldTileWaterLayerCacheKey(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileWaterLayerCacheKey === 'function'
          ? renderer.getWorldTileWaterLayerCacheKey(...args)
          : undefined;
      return result === undefined ? '' : result;
    }

    resolveWorldTileWaterLayerCacheLayout(...args) {
      const renderer = this.worldMapRenderer;
      return typeof renderer?.resolveWorldTileWaterLayerCacheLayout === 'function'
        ? renderer.resolveWorldTileWaterLayerCacheLayout(...args)
        : undefined;
    }

    renderWorldTileWaterFrameCache(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileWaterFrameCache === 'function'
          ? renderer.renderWorldTileWaterFrameCache(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    getWorldTileWaterFrameCache(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldTileWaterFrameCache === 'function'
          ? renderer.getWorldTileWaterFrameCache(...args)
          : undefined;
      return result === undefined ? null : result;
    }

    renderWorldTileWaterFrameCaches(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileWaterFrameCaches === 'function'
          ? renderer.renderWorldTileWaterFrameCaches(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    renderWorldTileWaterLayer(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileWaterLayer === 'function'
          ? renderer.renderWorldTileWaterLayer(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    renderWorldTileStaticEntries(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileStaticEntries === 'function'
          ? renderer.renderWorldTileStaticEntries(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    renderWorldTileWaterEntries(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileWaterEntries === 'function'
          ? renderer.renderWorldTileWaterEntries(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    addWorldMapDragHitTarget(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.addWorldMapDragHitTarget === 'function'
          ? renderer.addWorldMapDragHitTarget(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    addWorldMarchTileHitTargets(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.addWorldMarchTileHitTargets === 'function'
          ? renderer.addWorldMarchTileHitTargets(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    addWorldTileSiteHitTargets(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.addWorldTileSiteHitTargets === 'function'
          ? renderer.addWorldTileSiteHitTargets(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    renderWorldActors(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldActors === 'function'
          ? renderer.renderWorldActors(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    addWorldActorHitTargets(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.addWorldActorHitTargets === 'function'
          ? renderer.addWorldActorHitTargets(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    renderWorldMarchHud(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldMarchHud === 'function'
          ? renderer.renderWorldMarchHud(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    renderWorldMapActorLayer(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldMapActorLayer === 'function'
          ? renderer.renderWorldMapActorLayer(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    renderWorldScoutRoutes(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldScoutRoutes === 'function'
          ? renderer.renderWorldScoutRoutes(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    getNearestWorldTileAtPoint(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getNearestWorldTileAtPoint === 'function'
          ? renderer.getNearestWorldTileAtPoint(...args)
          : undefined;
      return result === undefined ? null : result;
    }

    renderWorldTileMap(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldTileMap === 'function'
          ? renderer.renderWorldTileMap(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    renderMilitaryWorldView(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderMilitaryWorldView === 'function'
          ? renderer.renderMilitaryWorldView(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    renderWorldSiteAction(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldSiteAction === 'function'
          ? renderer.renderWorldSiteAction(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    renderWorldExpeditionConfig(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldExpeditionConfig === 'function'
          ? renderer.renderWorldExpeditionConfig(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    renderWorldSiteModal(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldSiteModal === 'function'
          ? renderer.renderWorldSiteModal(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    getWorldCityCommandAnchor(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldCityCommandAnchor === 'function'
          ? renderer.getWorldCityCommandAnchor(...args)
          : undefined;
      return result === undefined ? null : result;
    }

    getWorldSiteCanvasAnchor(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldSiteCanvasAnchor === 'function'
          ? renderer.getWorldSiteCanvasAnchor(...args)
          : undefined;
      return result === undefined ? null : result;
    }

    getWorldCityCommandButtonAction(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.getWorldCityCommandButtonAction === 'function'
          ? renderer.getWorldCityCommandButtonAction(...args)
          : undefined;
      return result === undefined ? { type: 'territoryAction', disabled: true } : result;
    }

    drawWorldCityCommandPrimaryButton(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.drawWorldCityCommandPrimaryButton === 'function'
          ? renderer.drawWorldCityCommandPrimaryButton(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    drawWorldCityCommandSideButton(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.drawWorldCityCommandSideButton === 'function'
          ? renderer.drawWorldCityCommandSideButton(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    renderWorldCityCommandOverlay(...args) {
      const renderer = this.worldMapRenderer;
      const result =
        typeof renderer?.renderWorldCityCommandOverlay === 'function'
          ? renderer.renderWorldCityCommandOverlay(...args)
          : undefined;
      return result === undefined ? false : result;
    }

    getBattleUnitPose(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattleUnitPose === 'function'
        ? renderer.getBattleUnitPose(...args)
        : undefined;
      return result === undefined ? 'idle' : result;
    }

    getBattleTurnSoldierCount(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattleTurnSoldierCount === 'function'
        ? renderer.getBattleTurnSoldierCount(...args)
        : undefined;
      return result === undefined ? Number(args[3]) || 0 : result;
    }

    isBattleSideDefeatedByTurn(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.isBattleSideDefeatedByTurn === 'function'
        ? renderer.isBattleSideDefeatedByTurn(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    getBattlePlaybackPhase(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattlePlaybackPhase === 'function'
        ? renderer.getBattlePlaybackPhase(...args)
        : undefined;
      return result === undefined ? { phase: 'ended', phaseProgress: 1 } : result;
    }

    getBattleEngagementProgress(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattleEngagementProgress === 'function'
        ? renderer.getBattleEngagementProgress(...args)
        : undefined;
      return result === undefined ? 1 : result;
    }

    getBattleUnitFormationPosition(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattleUnitFormationPosition === 'function'
        ? renderer.getBattleUnitFormationPosition(...args)
        : undefined;
      return result === undefined ? { x: 0, y: 0, col: 0, row: 0 } : result;
    }

    getBattleUnitEngagementPosition(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattleUnitEngagementPosition === 'function'
        ? renderer.getBattleUnitEngagementPosition(...args)
        : undefined;
      return result === undefined ? { x: 0, y: 0, scale: 0.21 } : result;
    }

    easeBattleUnitProgress(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.easeBattleUnitProgress === 'function'
        ? renderer.easeBattleUnitProgress(...args)
        : undefined;
      return result === undefined ? 0 : result;
    }

    getBattleUnitEngagementDelay(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattleUnitEngagementDelay === 'function'
        ? renderer.getBattleUnitEngagementDelay(...args)
        : undefined;
      return result === undefined ? 0 : result;
    }

    getBattleUnitEngagementRatio(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattleUnitEngagementRatio === 'function'
        ? renderer.getBattleUnitEngagementRatio(...args)
        : undefined;
      return result === undefined ? 1 : result;
    }

    getBattleUnitBattlefieldPosition(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattleUnitBattlefieldPosition === 'function'
        ? renderer.getBattleUnitBattlefieldPosition(...args)
        : undefined;
      return result === undefined
        ? { x: 0, y: 0, formation: {}, engaged: {}, ratio: 1 }
        : result;
    }

    getBattleUnitSpec(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattleUnitSpec === 'function'
        ? renderer.getBattleUnitSpec(...args)
        : undefined;
      return result === undefined ? battleUnitSpecFallback(this) : result;
    }

    getBattleFramePose(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattleFramePose === 'function'
        ? renderer.getBattleFramePose(...args)
        : undefined;
      return result === undefined ? 'idle' : result;
    }

    getBattleFrameIndex(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattleFrameIndex === 'function'
        ? renderer.getBattleFrameIndex(...args)
        : undefined;
      return result === undefined ? 0 : result;
    }

    getBattleFrameSpritePath(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattleFrameSpritePath === 'function'
        ? renderer.getBattleFrameSpritePath(...args)
        : undefined;
      return result === undefined ? battleFrameSpritePathFallback(this) : result;
    }

    getBattleSideSpritePath(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattleSideSpritePath === 'function'
        ? renderer.getBattleSideSpritePath(...args)
        : undefined;
      return result === undefined ? 'assets/art/battle/units/player' : result;
    }

    drawBattleMapBackground(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.drawBattleMapBackground === 'function'
        ? renderer.drawBattleMapBackground(...args)
        : undefined;
    }

    drawBattleSoldierFrame(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.drawBattleSoldierFrame === 'function'
        ? renderer.drawBattleSoldierFrame(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    drawBattleSoldierFallback(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.drawBattleSoldierFallback === 'function'
        ? renderer.drawBattleSoldierFallback(...args)
        : undefined;
    }

    drawBattleSoldierSprite(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.drawBattleSoldierSprite === 'function'
        ? renderer.drawBattleSoldierSprite(...args)
        : undefined;
    }

    drawBattleSoldier(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.drawBattleSoldier === 'function'
        ? renderer.drawBattleSoldier(...args)
        : undefined;
    }

    drawBattleArmy(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.drawBattleArmy === 'function'
        ? renderer.drawBattleArmy(...args)
        : undefined;
    }

    getBattleStatusBadgeColors(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.getBattleStatusBadgeColors === 'function'
        ? renderer.getBattleStatusBadgeColors(...args)
        : undefined;
    }

    drawBattleSideState(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.drawBattleSideState === 'function'
        ? renderer.drawBattleSideState(...args)
        : undefined;
    }

    drawBattleActionEffect(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.drawBattleActionEffect === 'function'
        ? renderer.drawBattleActionEffect(...args)
        : undefined;
    }

    drawBattleSkillCutIn(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.drawBattleSkillCutIn === 'function'
        ? renderer.drawBattleSkillCutIn(...args)
        : undefined;
    }

    getBattleTurnDamage(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.getBattleTurnDamage === 'function'
        ? renderer.getBattleTurnDamage(...args)
        : undefined;
    }

    getBattleDamageFloatText(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.getBattleDamageFloatText === 'function'
        ? renderer.getBattleDamageFloatText(...args)
        : undefined;
    }

    drawBattleDamageFloat(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.drawBattleDamageFloat === 'function'
        ? renderer.drawBattleDamageFloat(...args)
        : undefined;
    }

    drawBattleStatusFloatingTexts(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.drawBattleStatusFloatingTexts === 'function'
        ? renderer.drawBattleStatusFloatingTexts(...args)
        : undefined;
    }

    drawBattleLeader(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.drawBattleLeader === 'function'
        ? renderer.drawBattleLeader(...args)
        : undefined;
    }

    renderBattleSceneOverlay(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.renderBattleSceneOverlay === 'function'
        ? renderer.renderBattleSceneOverlay(...args)
        : undefined;
      return result === undefined ? false : result;
    }

    renderEntityBattleOverlay(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.renderEntityBattleOverlay === 'function'
        ? renderer.renderEntityBattleOverlay(...args)
        : undefined;
      return result === undefined ? false : result;
    }

  }

  global.CanvasGameRenderer = CanvasGameRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasGameRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
