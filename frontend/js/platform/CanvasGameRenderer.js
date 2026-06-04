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
      const WorldMapRendererClass = options.worldMapRendererClass || SharedWorldMapCanvasRenderer;
      this.worldMapRenderer = options.worldMapRenderer || (WorldMapRendererClass ? new WorldMapRendererClass({ host: this }) : null);
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

    getLayout() {
      const contentWidth = Math.min(this.maxContentWidth, Math.max(300, this.width - this.edgePadding * 2));
      const contentX = Math.max(this.edgePadding, Math.floor((this.width - contentWidth) / 2));
      return {
        contentX,
        contentWidth,
        contentRight: contentX + contentWidth,
      };
    }

    createGradient(x0, y0, x1, y1, stops = [], fallback = '#000') {
      if (!this.ctx || typeof this.ctx.createLinearGradient !== 'function') return fallback;
      const gradient = this.ctx.createLinearGradient(x0, y0, x1, y1);
      stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
      return gradient;
    }

    createRadialGradient(x0, y0, r0, x1, y1, r1, stops = [], fallback = '#000') {
      if (!this.ctx || typeof this.ctx.createRadialGradient !== 'function') return fallback;
      const gradient = this.ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
      stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
      return gradient;
    }

    roundRectPath(x, y, width, height, radius = 8) {
      if (!this.ctx) return;
      this.ctx.beginPath();
      if (typeof this.ctx.roundRect === 'function') {
        this.ctx.roundRect(x, y, width, height, radius);
      } else {
        this.ctx.rect(x, y, width, height);
      }
    }

    createImage(src) {
      return null;
    }

    preloadAssets(assetPaths = this.getPreloadAssetPaths(), onProgress = null) {
      const paths = Array.from(new Set((assetPaths || []).filter(Boolean)));
      const total = paths.length;
      const report = typeof onProgress === 'function' ? onProgress : null;
      if (!total) {
        report?.({ total: 0, completed: 0, loaded: 0, failed: 0, percentage: 100 });
        return Promise.resolve({ total: 0, completed: 0, loaded: 0, failed: 0, percentage: 100 });
      }

      let completed = 0;
      let loaded = 0;
      let failed = 0;
      const notify = (assetPath, status) => {
        const percentage = Math.round((completed / total) * 100);
        report?.({ total, completed, loaded, failed, percentage, assetPath, status });
      };

      return new Promise((resolve) => {
        const settle = (assetPath, status) => {
          completed += 1;
          if (status === 'loaded') loaded += 1;
          else failed += 1;
          notify(assetPath, status);
          if (completed >= total) {
            this.prewarmWorldTileCaches(paths);
            resolve({ total, completed, loaded, failed, percentage: 100 });
          }
        };

        notify('', 'start');
        paths.forEach((assetPath) => {
          const cached = this.assetCache.get(assetPath);
          if (cached?.status === 'loaded') {
            settle(assetPath, 'loaded');
            return;
          }
          if (cached?.status === 'error') {
            settle(assetPath, 'error');
            return;
          }

          const image = cached?.image || this.createImage(assetPath);
          if (!image) {
            this.assetCache.set(assetPath, { status: 'error', image: null });
            settle(assetPath, 'error');
            return;
          }

          const record = cached || { status: 'loading', image };
          if (!cached) this.assetCache.set(assetPath, record);
          const previousOnload = image.onload;
          const previousOnerror = image.onerror;
          let settled = false;
          const complete = (status, handler, event) => {
            if (settled) return;
            settled = true;
            record.status = status;
            if (status === 'loaded') this.handleAssetsChanged();
            if (typeof handler === 'function') handler.call(image, event);
            settle(assetPath, status);
          };
          image.onload = (event) => complete('loaded', previousOnload, event);
          image.onerror = (event) => complete('error', previousOnerror, event);
          const requestPath = this.constructor.getAssetRequestPath(assetPath);
          if (!cached) image.src = requestPath;
          else if (!image.src) image.src = requestPath;
        });
      });
    }

    isWorldTilePrewarmMetricAssetPath(assetPath = '') {
      const path = String(assetPath || '');
      return path.startsWith('assets/art/tile-map/')
        || path.startsWith('assets/art/world-site-');
    }

    isWorldTileTemplateAssetPath(assetPath = '') {
      return /^assets\/art\/tile-map\/(?:river-template|ocean-template|transition-template)\//.test(String(assetPath || ''));
    }

    isWorldTileWaterTemplateAssetPath(assetPath = '') {
      return /^assets\/art\/tile-map\/(?:river-template|ocean-template)\//.test(String(assetPath || ''));
    }

    prewarmWorldTileCaches(assetPaths = this.getPreloadAssetPaths()) {
      const paths = Array.from(new Set((assetPaths || []).filter(Boolean)));
      const result = { total: paths.length, metrics: 0, masks: 0, dryTemplates: 0 };
      paths.forEach((assetPath) => {
        const cached = this.assetCache.get(assetPath);
        if (cached?.status !== 'loaded') return;
        if (this.isWorldTilePrewarmMetricAssetPath(assetPath) && !this.assetMetricsCache.has(assetPath)) {
          if (this.analyzeAssetAlphaBounds(assetPath)) result.metrics += 1;
        }
        if (!this.isWorldTileTemplateAssetPath(assetPath)) return;
        const hadMask = this.worldTileMaskCache.has(assetPath);
        const mask = this.getWorldTileTemplateMask(assetPath);
        if (mask && !hadMask) result.masks += 1;
        if (!this.isWorldTileWaterTemplateAssetPath(assetPath)) return;
        const hadDryTemplate = this.worldTileDryCompositeCache.has(assetPath);
        const dryTemplate = this.getWorldTileDryTemplateCanvas(assetPath);
        if (dryTemplate && !hadDryTemplate) result.dryTemplates += 1;
      });
      return result;
    }

    getAsset(assetPath) {
      if (!assetPath) return null;
      const cached = this.assetCache.get(assetPath);
      if (cached) return cached.status === 'loaded' ? cached.image : null;

      const image = this.createImage(assetPath);
      if (!image) {
        this.assetCache.set(assetPath, { status: 'error', image: null });
        return null;
      }

      const record = { status: 'loading', image };
      this.assetCache.set(assetPath, record);
      image.onload = () => {
        record.status = 'loaded';
        this.handleAssetsChanged();
      };
      image.onerror = () => {
        record.status = 'error';
      };
      image.src = this.constructor.getAssetRequestPath(assetPath);
      return null;
    }

    setHitTargets(targets = []) {
      this.hitTargets = targets;
    }

    addHitTarget(rect, action) {
      if (this.suppressHitTargets) return;
      if (!action || !rect) return;
      this.hitTargets.push({
        x: Number(rect.x) || 0,
        y: Number(rect.y) || 0,
        width: Number(rect.width) || 0,
        height: Number(rect.height) || 0,
        action,
      });
    }

    getHitTarget(point = {}) {
      const x = Number(point.x);
      const y = Number(point.y);
      let backgroundAction = null;
      let tutorialShieldAction = null;
      const tutorialAllowedActions = [];
      for (let index = this.hitTargets.length - 1; index >= 0; index -= 1) {
        const target = this.hitTargets[index];
        if (
          x >= target.x
          && x <= target.x + target.width
          && y >= target.y
          && y <= target.y + target.height
        ) {
          if (target.action?.type === 'blockCanvasModal') {
            tutorialShieldAction = target.action;
            if (target.action.allowedAction) tutorialAllowedActions.push(target.action.allowedAction);
          } else if (tutorialShieldAction && !this.isAllowedUnderTutorialShield(target.action)) {
            return (
              tutorialAllowedActions.some((allowed) => this.matchesTutorialShieldAllowedAction(target.action, allowed))
              || this.matchesCurrentTutorialIntroAction(target.action)
            )
              ? target.action
              : tutorialShieldAction;
          } else if (target.action?.background) {
            backgroundAction = target.action;
          } else {
            return target.action;
          }
        }
      }
      if (tutorialShieldAction) return tutorialShieldAction;
      return backgroundAction;
    }

    containsPoint(rect = {}, point = {}) {
      const x = Number(point.x);
      const y = Number(point.y);
      return Number.isFinite(x)
        && Number.isFinite(y)
        && x >= Number(rect.x)
        && x <= Number(rect.x) + Number(rect.width)
        && y >= Number(rect.y)
        && y <= Number(rect.y) + Number(rect.height);
    }

    setHoverPoint(point = null) {
      if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) {
        this.hoverPoint = null;
        return false;
      }
      this.hoverPoint = { x: Number(point.x), y: Number(point.y) };
      return true;
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

    isAllowedUnderTutorialShield(action = {}) {
      if (action.type === 'goToGuideTaskTarget') return true;
      if (action.type === 'openTaskCenter') {
        return action.source === 'taskIcon';
      }
      if (action.type === 'claimTaskReward' || action.type === 'claimGuideTaskReward') {
        return (action.category || 'main') === 'main';
      }
      return false;
    }

    matchesTutorialShieldAllowedAction(action = {}, allowed = null) {
      if (!action?.type || !allowed?.type || action.type !== allowed.type) return false;
      const getId = (item = {}) => item.cityId || item.territoryId || item.siteId || item.targetId || '';
      const allowedId = getId(allowed);
      const actionId = getId(action);
      return !allowedId || !actionId || allowedId === actionId;
    }

    matchesCurrentTutorialIntroAction(action = {}) {
      const intro = this.lastRenderOptions?.tutorialIntro || null;
      if (!intro?.active || !action?.type) return false;
      const capitalCityId = intro.capitalCityId || 'capital';
      const actionId = action.cityId || action.territoryId || action.siteId || '';
      if (intro.step === 'city') {
        return action.type === 'openWorldSite' && (!actionId || actionId === capitalCityId);
      }
      if (intro.step === 'enter') {
        return action.type === 'enterCity' && (!actionId || actionId === capitalCityId);
      }
      return false;
    }

    withSuppressedHitTargets(callback) {
      const previous = this.suppressHitTargets;
      this.suppressHitTargets = true;
      try {
        return callback?.();
      } finally {
        this.suppressHitTargets = previous;
      }
    }

    withSlideClip(x, y, width, height, offsetX, callback) {
      return this.withTranslatedClip(x, y, width, height, offsetX, 0, callback);
    }

    withTranslatedClip(x, y, width, height, offsetX = 0, offsetY = 0, callback) {
      if (!this.ctx || typeof callback !== 'function') return callback?.();
      const canClip = typeof this.ctx.save === 'function'
        && typeof this.ctx.restore === 'function'
        && typeof this.ctx.beginPath === 'function'
        && typeof this.ctx.rect === 'function'
        && typeof this.ctx.clip === 'function';
      if (!canClip) return callback();
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(x, y, width, height);
      this.ctx.clip();
      if (typeof this.ctx.translate === 'function') this.ctx.translate(offsetX, offsetY);
      try {
        return callback();
      } finally {
        this.ctx.restore();
      }
    }

    withTransformedClip(x, y, width, height, offsetX = 0, offsetY = 0, scale = 1, callback) {
      if (!this.ctx || typeof callback !== 'function') return callback?.();
      const canClip = typeof this.ctx.save === 'function'
        && typeof this.ctx.restore === 'function'
        && typeof this.ctx.beginPath === 'function'
        && typeof this.ctx.rect === 'function'
        && typeof this.ctx.clip === 'function';
      if (!canClip) return callback();
      const safeScale = Math.max(0.01, Number(scale) || 1);
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(x, y, width, height);
      this.ctx.clip();
      if (typeof this.ctx.translate === 'function') this.ctx.translate(x + offsetX, y + offsetY);
      if (typeof this.ctx.scale === 'function') this.ctx.scale(safeScale, safeScale);
      if (typeof this.ctx.translate === 'function') this.ctx.translate(-x, -y);
      try {
        return callback();
      } finally {
        this.ctx.restore();
      }
    }

    setAssetsChangedHandler(handler) {
      this.assetsChangedHandler = typeof handler === 'function' ? handler : null;
    }

    handleAssetsChanged() {
      this.invalidateWorldTileCaches();
      if (this.assetsChangedHandler) this.assetsChangedHandler();
    }

    invalidateWorldTileCaches() {
      this.worldTileStaticCache = null;
      this.worldTileStaticCacheKey = '';
      this.worldTileStaticCacheLayoutKind = '';
      this.worldTileStaticCacheLayout = null;
      this.worldTileStaticChunkCaches?.clear?.();
      this.worldTileStaticChunkCacheTick = 0;
      this.worldTileScoutRouteCache = null;
      this.worldTileScoutRouteCacheKey = '';
      this.worldTileScoutRouteCacheLayout = null;
      this.worldTileWaterLayerCache = null;
      this.worldTileWaterLayerCacheKey = '';
      this.worldTileWaterFrameCaches?.clear?.();
      this.worldTileWaterChunkCaches?.clear?.();
      this.worldTileWaterChunkCacheTick = 0;
      this.worldTileFastDragComposite = null;
      this.worldTileFastDragCompositeCache = null;
      this.invalidateWorldTileViewCache();
    }

    hasPreparedWorldTileSnapshotCache() {
      return Boolean(
        (this.worldTileStaticCache?.canvas && this.worldTileStaticCacheLayout?.frame)
        || (this.worldTileStaticCacheLayoutKind === 'chunks' && this.worldTileStaticChunkCaches?.size),
      );
    }

    invalidateWorldTileViewCache() {
      this.worldTileViewCache = null;
      this.worldTileVisibleEntriesCache = null;
      this.worldTileLocalEntriesCache = null;
    }

    drawAsset(assetPath, x, y, width, height, alpha = 1) {
      const image = this.getAsset(assetPath);
      if (!image || typeof this.ctx.drawImage !== 'function') return false;
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = alpha;
      this.ctx.drawImage(image, x, y, width, height);
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      return true;
    }

    drawAssetClipped(assetPath, sourceRect, x, y, width, height, alpha = 1) {
      const image = this.getAsset(assetPath);
      if (!image || typeof this.ctx.drawImage !== 'function') return false;
      const sourceWidth = Number(image.naturalWidth || image.width || 0);
      const sourceHeight = Number(image.naturalHeight || image.height || 0);
      const sx = Math.max(0, Number(sourceRect?.x) || 0);
      const sy = Math.max(0, Number(sourceRect?.y) || 0);
      const sw = Math.max(1, Number(sourceRect?.width) || sourceWidth || 1);
      const sh = Math.max(1, Number(sourceRect?.height) || sourceHeight || 1);
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = alpha;
      this.ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      return true;
    }

    getFallbackAssetMetrics(image) {
      const width = Number(image?.naturalWidth || image?.width || 1) || 1;
      const height = Number(image?.naturalHeight || image?.height || 1) || 1;
      return { x: 0, y: 0, width, height, sourceWidth: width, sourceHeight: height };
    }

    isOpaquePixel(data, index) {
      return data[index + 3] > 8;
    }

    isWorldTileTemplateWaterPixel(data, index) {
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const alpha = data[index + 3];
      if (alpha <= 56 || blue <= 70) return false;
      return blue > red + 12 && blue > green - 3 && (green > red + 18 || blue > 112);
    }

    measurePixelBounds(data, width, height, predicate) {
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      let count = 0;
      for (let py = 0; py < height; py += 1) {
        for (let px = 0; px < width; px += 1) {
          const index = (py * width + px) * 4;
          if (!predicate(data, index)) continue;
          count += 1;
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        }
      }
      if (maxX < minX || maxY < minY) return null;
      return {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        count,
        sourceWidth: width,
        sourceHeight: height,
      };
    }

    analyzeAssetAlphaBounds(assetPath = '') {
      if (!assetPath) return null;
      const cached = this.assetMetricsCache.get(assetPath);
      if (cached) return cached;
      const image = this.getAsset(assetPath);
      const fallback = this.getFallbackAssetMetrics(image);
      if (!image) return fallback;
      const canvas = this.createTileWorkCanvas(fallback.sourceWidth, fallback.sourceHeight);
      const ctx = canvas?.getContext?.('2d', { willReadFrequently: true });
      if (!canvas || !ctx) {
        this.assetMetricsCache.set(assetPath, fallback);
        return fallback;
      }
      try {
        ctx.clearRect?.(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const metrics = this.measurePixelBounds(data, canvas.width, canvas.height, this.isOpaquePixel) || fallback;
        this.assetMetricsCache.set(assetPath, metrics);
        return metrics;
      } catch (_) {
        this.assetMetricsCache.set(assetPath, fallback);
        return fallback;
      }
    }

    getIsoTileSourceRect(assetPath = '') {
      return this.getWorldTileTemplateMetrics({ asset: assetPath });
    }

    getWorldTileTemplateMetrics(template = {}) {
      const assetPath = typeof template === 'string' ? template : template.asset;
      if (!assetPath || !String(assetPath).startsWith('assets/art/tile-map/')) return null;
      if (String(assetPath).includes('/ocean-template/') || String(assetPath).includes('/transition-template/')) {
        const manifest = this.constructor.getTileMapAssetManifest();
        const plains = manifest.getTerrainAsset?.('plains') || manifest.terrain?.plains;
        if (plains?.path) return this.analyzeAssetAlphaBounds(plains.path);
      }
      return this.analyzeAssetAlphaBounds(assetPath);
    }

    drawTileAsset(assetPath, x, y, width, height, alpha = 1) {
      const sourceRect = this.getIsoTileSourceRect(assetPath);
      if (sourceRect) return this.drawAssetClipped(assetPath, sourceRect, x, y, width, height, alpha);
      return this.drawAsset(assetPath, x, y, width, height, alpha);
    }

    getTemplateCanvasFactory() {
      const doc = this.canvas?.ownerDocument || (typeof document !== 'undefined' ? document : null);
      if (doc?.createElement) return () => doc.createElement('canvas');
      if (typeof global.OffscreenCanvas === 'function') return (width = 1, height = 1) => new global.OffscreenCanvas(width, height);
      if (typeof OffscreenCanvas === 'function') return (width = 1, height = 1) => new OffscreenCanvas(width, height);
      return null;
    }

    createTileWorkCanvas(width, height) {
      const factory = this.getTemplateCanvasFactory();
      if (!factory) return null;
      const canvas = factory(width, height);
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }

    createTutorialSpineCanvas(width, height) {
      const safeWidth = Math.max(1, Math.floor(Number(width) || 1));
      const safeHeight = Math.max(1, Math.floor(Number(height) || 1));
      let canvas = null;
      if (typeof global.OffscreenCanvas === 'function') {
        try {
          canvas = new global.OffscreenCanvas(safeWidth, safeHeight);
        } catch (_) {
          canvas = null;
        }
      }
      if (!canvas && typeof OffscreenCanvas === 'function') {
        try {
          canvas = new OffscreenCanvas(safeWidth, safeHeight);
        } catch (_) {
          canvas = null;
        }
      }
      if (!canvas) {
        const doc = this.canvas?.ownerDocument || (typeof document !== 'undefined' ? document : null);
        if (doc?.createElement) canvas = doc.createElement('canvas');
      }
      if (!canvas) return null;
      canvas.width = safeWidth;
      canvas.height = safeHeight;
      if (typeof canvas.addEventListener !== 'function') canvas.addEventListener = () => {};
      if (typeof canvas.removeEventListener !== 'function') canvas.removeEventListener = () => {};
      return canvas;
    }

    isInsideTemplateDiamond(x, y, metrics) {
      const centerX = metrics.x + metrics.width * 0.5;
      const centerY = metrics.y + metrics.height * 0.5;
      const halfW = metrics.width * 0.5;
      const halfH = metrics.height * 0.5;
      return Math.abs(x - centerX) / Math.max(1, halfW) + Math.abs(y - centerY) / Math.max(1, halfH) <= 1.03;
    }

    createWorldTileColorWaterMask(assetPath, image, canvas, ctx, probeCtx, width, height) {
      probeCtx.drawImage(image, 0, 0);
      const source = probeCtx.getImageData(0, 0, width, height);
      const output = ctx.createImageData(width, height);
      for (let index = 0; index < source.data.length; index += 4) {
        if (!this.isWorldTileTemplateWaterPixel(source.data, index)) continue;
        output.data[index] = 255;
        output.data[index + 1] = 255;
        output.data[index + 2] = 255;
        output.data[index + 3] = Math.min(255, Math.round(source.data[index + 3] * 1.18));
      }
      ctx.putImageData(output, 0, 0);
      this.worldTileMaskMetricsCache.set(assetPath, this.measurePixelBounds(output.data, width, height, this.isOpaquePixel));
      return canvas;
    }

    createWorldTileTransparentWaterMask(assetPath, image, canvas, ctx, probeCtx, width, height) {
      probeCtx.drawImage(image, 0, 0);
      const source = probeCtx.getImageData(0, 0, width, height);
      const manifest = this.constructor.getTileMapAssetManifest();
      const plains = manifest.getTerrainAsset?.('plains') || manifest.terrain?.plains;
      const terrainImage = plains?.path ? this.getAsset(plains.path) : null;
      let terrainData = null;
      if (terrainImage && Number(terrainImage.naturalWidth || terrainImage.width) === width && Number(terrainImage.naturalHeight || terrainImage.height) === height) {
        probeCtx.clearRect?.(0, 0, width, height);
        probeCtx.drawImage(terrainImage, 0, 0);
        terrainData = probeCtx.getImageData(0, 0, width, height).data;
      }
      const terrainBounds = this.measurePixelBounds(source.data, width, height, this.isOpaquePixel)
        || this.getFallbackAssetMetrics(image);
      const output = ctx.createImageData(width, height);
      for (let py = 0; py < height; py += 1) {
        for (let px = 0; px < width; px += 1) {
          const index = (py * width + px) * 4;
          const insideTerrain = terrainData ? terrainData[index + 3] > 32 : this.isInsideTemplateDiamond(px, py, terrainBounds);
          if (source.data[index + 3] > 8 || !insideTerrain) continue;
          output.data[index] = 255;
          output.data[index + 1] = 255;
          output.data[index + 2] = 255;
          output.data[index + 3] = 255;
        }
      }
      ctx.putImageData(output, 0, 0);
      this.worldTileMaskMetricsCache.set(assetPath, this.measurePixelBounds(output.data, width, height, this.isOpaquePixel));
      return canvas;
    }

    getWorldTileTemplateMask(assetPath = '') {
      if (!assetPath) return null;
      const cached = this.worldTileMaskCache.get(assetPath);
      if (cached !== undefined) return cached;
      const image = this.getAsset(assetPath);
      const width = Number(image?.naturalWidth || image?.width || 0);
      const height = Number(image?.naturalHeight || image?.height || 0);
      if (!image || !width || !height) return null;
      const canvas = this.createTileWorkCanvas(width, height);
      const probe = this.createTileWorkCanvas(width, height);
      const ctx = canvas?.getContext?.('2d', { willReadFrequently: true });
      const probeCtx = probe?.getContext?.('2d', { willReadFrequently: true });
      if (!canvas || !probe || !ctx || !probeCtx) {
        this.worldTileMaskCache.set(assetPath, null);
        return null;
      }
      try {
        if (assetPath.includes('/river-template/') || assetPath.includes('/ocean-template/')) {
          this.createWorldTileTransparentWaterMask(assetPath, image, canvas, ctx, probeCtx, width, height);
        } else {
          this.createWorldTileColorWaterMask(assetPath, image, canvas, ctx, probeCtx, width, height);
        }
        this.worldTileMaskCache.set(assetPath, canvas);
        return canvas;
      } catch (_) {
        this.worldTileMaskCache.set(assetPath, null);
        this.worldTileMaskMetricsCache.set(assetPath, null);
        return null;
      }
    }

    getWorldTileDryTemplateCanvas(assetPath = '') {
      if (!assetPath) return null;
      const cached = this.worldTileDryCompositeCache.get(assetPath);
      if (cached !== undefined) return cached;
      const image = this.getAsset(assetPath);
      const mask = this.getWorldTileTemplateMask(assetPath);
      const width = Number(image?.naturalWidth || image?.width || 0);
      const height = Number(image?.naturalHeight || image?.height || 0);
      if (!image || !mask || !width || !height) return null;
      const canvas = this.createTileWorkCanvas(width, height);
      const ctx = canvas?.getContext?.('2d');
      if (!canvas || !ctx) {
        this.worldTileDryCompositeCache.set(assetPath, null);
        return null;
      }
      try {
        ctx.drawImage(image, 0, 0);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(mask, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        this.worldTileDryCompositeCache.set(assetPath, canvas);
        return canvas;
      } catch (_) {
        this.worldTileDryCompositeCache.set(assetPath, null);
        return null;
      }
    }

    drawCanvasClipped(sourceCanvas, sourceRect, x, y, width, height, alpha = 1) {
      if (!sourceCanvas || typeof this.ctx.drawImage !== 'function') return false;
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = alpha;
      this.ctx.drawImage(
        sourceCanvas,
        Number(sourceRect?.x) || 0,
        Number(sourceRect?.y) || 0,
        Number(sourceRect?.width) || Number(sourceCanvas.width) || 1,
        Number(sourceRect?.height) || Number(sourceCanvas.height) || 1,
        x,
        y,
        width,
        height,
      );
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      return true;
    }

    getWorldTileCompositeContext(width, height) {
      const localW = Math.max(1, Math.ceil(width));
      const localH = Math.max(1, Math.ceil(height));
      if (!this.worldTileCompositeCanvas) {
        this.worldTileCompositeCanvas = this.createTileWorkCanvas(localW, localH);
        this.worldTileCompositeCtx = this.worldTileCompositeCanvas?.getContext?.('2d') || null;
      }
      if (!this.worldTileCompositeCanvas || !this.worldTileCompositeCtx) return null;
      if (this.worldTileCompositeCanvas.width !== localW) this.worldTileCompositeCanvas.width = localW;
      if (this.worldTileCompositeCanvas.height !== localH) this.worldTileCompositeCanvas.height = localH;
      return {
        canvas: this.worldTileCompositeCanvas,
        ctx: this.worldTileCompositeCtx,
        width: localW,
        height: localH,
      };
    }

    drawWorldTileTemplateSource(sourceImage, sourceRect, drawRect) {
      if (!sourceImage || !sourceRect || typeof this.ctx.drawImage !== 'function') return false;
      this.ctx.drawImage(
        sourceImage,
        sourceRect.x,
        sourceRect.y,
        sourceRect.width,
        sourceRect.height,
        drawRect.x,
        drawRect.y,
        drawRect.width,
        drawRect.height,
      );
      return true;
    }

    drawWorldTileDryTemplate(tile = {}, drawRect = {}) {
      const baseTemplate = this.getWorldTileTemplateBaseAsset(tile);
      const baseAsset = baseTemplate?.asset || tile.terrainAsset || '';
      if (!baseAsset) return false;
      const templates = Array.isArray(tile.templateAssets) ? tile.templateAssets.filter((asset) => asset?.asset) : [];
      const dryCanvas = this.getWorldTileDryTemplateCanvas(baseAsset);
      const sourceRect = this.getWorldTileTemplateMetrics(baseTemplate || { asset: baseAsset });
      if (!sourceRect) return this.drawTileAsset(baseAsset, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
      if (dryCanvas && templates.length > 1) {
        const sourceWidth = sourceRect.sourceWidth || Number(dryCanvas.width) || 1;
        const sourceHeight = sourceRect.sourceHeight || Number(dryCanvas.height) || 1;
        const work = this.getWorldTileCompositeContext(sourceWidth, sourceHeight);
        if (work) {
          try {
            work.ctx.setTransform?.(1, 0, 0, 1, 0, 0);
            work.ctx.globalAlpha = 1;
            work.ctx.globalCompositeOperation = 'source-over';
            work.ctx.clearRect?.(0, 0, sourceWidth, sourceHeight);
            work.ctx.drawImage(dryCanvas, 0, 0);
            work.ctx.globalCompositeOperation = 'destination-out';
            templates.forEach((template) => {
              const mask = this.getWorldTileTemplateMask(template.asset);
              if (mask) work.ctx.drawImage(mask, 0, 0);
            });
            work.ctx.globalCompositeOperation = 'source-over';
            return this.drawWorldTileTemplateSource(work.canvas, sourceRect, drawRect);
          } catch (_) {
            return this.drawWorldTileTemplateSource(dryCanvas, sourceRect, drawRect);
          }
        }
      }
      if (dryCanvas) {
        return this.drawWorldTileTemplateSource(dryCanvas, sourceRect, drawRect);
      }
      return this.drawTileAsset(baseAsset, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
    }

    getWorldTileTemplateBaseAsset(tile = {}) {
      const templates = Array.isArray(tile.templateAssets) ? tile.templateAssets : [];
      return templates.find((asset) => asset.asset && /^river-mouth-/.test(asset.key || ''))
        || templates.find((asset) => asset.asset && !/tile-ocean-water-full\.png$/.test(asset.asset))
        || templates[0]
        || null;
    }

    getWorldTileWaterTemplateAssets(tile = {}) {
      const templates = Array.isArray(tile.templateAssets) ? tile.templateAssets.filter((asset) => asset?.asset) : [];
      if (!templates.length) return [];
      if (tile.water?.kind === 'ocean') {
        return templates.flatMap((asset) => {
          if (!/^river-mouth-/.test(asset.key || '')) return [asset];
          const manifest = this.constructor.getTileMapAssetManifest();
          const shore = manifest.getRiverMouthShoreEdgeAsset?.(asset.key);
          const river = manifest.getRiverMouthRiverTemplateAsset?.(asset.key);
          return [
            shore ? { key: asset.key, asset: shore.path, waterKind: 'ocean' } : null,
            river ? { key: asset.key, asset: river.path, waterKind: 'river' } : null,
          ].filter(Boolean);
        });
      }
      return templates;
    }

    getWorldTileWaterWorkContext(width, height) {
      const localW = Math.max(1, Math.ceil(width));
      const localH = Math.max(1, Math.ceil(height));
      if (!this.worldTileWaterCanvas) {
        this.worldTileWaterCanvas = this.createTileWorkCanvas(localW, localH);
        this.worldTileWaterCtx = this.worldTileWaterCanvas?.getContext?.('2d') || null;
      }
      if (!this.worldTileWaterCanvas || !this.worldTileWaterCtx) return null;
      if (this.worldTileWaterCanvas.width !== localW) this.worldTileWaterCanvas.width = localW;
      if (this.worldTileWaterCanvas.height !== localH) this.worldTileWaterCanvas.height = localH;
      return {
        canvas: this.worldTileWaterCanvas,
        ctx: this.worldTileWaterCtx,
        width: localW,
        height: localH,
      };
    }

    positiveModulo(value, size) {
      return ((value % size) + size) % size;
    }

    getWorldTileMapPosition(tile = {}, geometry = {}) {
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

    fillWorldTileWaterTexture(targetCtx, texture, water = {}, tile = {}, drawRect = {}, viewport = {}, width = 1, height = 1, timeMs = null) {
      if (!targetCtx || !texture || typeof targetCtx.drawImage !== 'function') return false;
      const hasTimeMs = timeMs !== null && timeMs !== undefined && Number.isFinite(Number(timeMs));
      const resolvedTimeMs = hasTimeMs ? Number(timeMs) : this.getNow();
      const seconds = Math.max(0, resolvedTimeMs / 1000);
      const geometry = viewport.geometry || {};
      const scale = Number(viewport.scale) || 1;
      const tileW = Math.max(1, Number(texture.naturalWidth || texture.width || 1) * (Number(water.uvScale) || 1) * (Number(viewport.scale) || 1));
      const tileH = Math.max(1, Number(texture.naturalHeight || texture.height || 1) * (Number(water.uvScale) || 1) * (Number(viewport.scale) || 1));
      const phaseX = seconds * (Number(water.speedX) || 0) * scale;
      const phaseY = seconds * (Number(water.speedY) || 0) * scale;
      const position = this.getWorldTileMapPosition(tile, geometry);
      const tileWidth = Number(geometry.tileWidth) || 192;
      const tileHeight = Number(geometry.tileHeight) || 96;
      const anchorY = Number.isFinite(Number(geometry.anchorY)) ? Number(geometry.anchorY) : 0.5;
      const worldLeft = position.x - tileWidth * 0.5;
      const worldTop = position.y - tileHeight * anchorY;
      const startX = -this.positiveModulo(worldLeft * scale + phaseX, tileW);
      const startY = -this.positiveModulo(worldTop * scale + phaseY, tileH);
      for (let py = startY; py < height; py += tileH) {
        for (let px = startX; px < width; px += tileW) {
          targetCtx.drawImage(texture, px, py, tileW + 0.5, tileH + 0.5);
        }
      }
      return true;
    }

    drawWorldTileWaterDiamond(texture, water = {}, center = {}, drawRect = {}, viewport = {}, timeMs = null) {
      if (!texture || typeof this.ctx.drawImage !== 'function') return false;
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = Number(water.alpha) || 1;
      this.ctx.save?.();
      this.ctx.beginPath?.();
      this.ctx.moveTo?.(center.x, center.y - drawRect.height * 0.5);
      this.ctx.lineTo?.(center.x + drawRect.width * 0.5, center.y);
      this.ctx.lineTo?.(center.x, center.y + drawRect.height * 0.5);
      this.ctx.lineTo?.(center.x - drawRect.width * 0.5, center.y);
      if (typeof this.ctx.closePath === 'function') this.ctx.closePath();
      else this.ctx.lineTo?.(center.x, center.y - drawRect.height * 0.5);
      this.ctx.clip?.();
      const drawn = this.fillWorldTileWaterTexture(this.ctx, texture, water, viewport.tile || {}, drawRect, viewport, drawRect.width, drawRect.height, timeMs);
      this.ctx.restore?.();
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      return drawn;
    }

    drawWorldTileWaterLayer(template = {}, water = {}, texture, center = {}, drawRect = {}, viewport = {}, timeMs = null) {
      const mask = this.getWorldTileTemplateMask(template.asset);
      const sourceRect = this.getIsoTileSourceRect(template.asset);
      const work = mask && sourceRect ? this.getWorldTileWaterWorkContext(drawRect.width, drawRect.height) : null;
      if (!work) return this.drawWorldTileWaterDiamond(texture, water, center, drawRect, viewport, timeMs);
      try {
        work.ctx.setTransform?.(1, 0, 0, 1, 0, 0);
        work.ctx.globalAlpha = 1;
        work.ctx.globalCompositeOperation = 'source-over';
        work.ctx.clearRect?.(0, 0, work.width, work.height);
        if (!this.fillWorldTileWaterTexture(work.ctx, texture, water, viewport.tile || {}, drawRect, viewport, work.width, work.height, timeMs)) return false;
        work.ctx.globalCompositeOperation = 'destination-in';
        work.ctx.drawImage(
          mask,
          sourceRect.x,
          sourceRect.y,
          sourceRect.width,
          sourceRect.height,
          0,
          0,
          work.width,
          work.height,
        );
        work.ctx.globalCompositeOperation = 'source-over';
        const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
        if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = Number(water.alpha) || 1;
        this.ctx.drawImage(work.canvas, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
        if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
        return true;
      } catch (_) {
        return this.drawWorldTileWaterDiamond(texture, water, center, drawRect, viewport, timeMs);
      }
    }

    drawWorldTileWater(tile = {}, center = {}, drawRect = {}, viewport = {}, options = {}) {
      const templates = this.getWorldTileWaterTemplateAssets(tile);
      if (!templates.length) return false;
      const manifest = this.constructor.getTileMapAssetManifest();
      let drawn = false;
      const tileViewport = { ...viewport, tile };
      const hasWaterTimeMs = options.waterTimeMs !== null
        && options.waterTimeMs !== undefined
        && Number.isFinite(Number(options.waterTimeMs));
      const timeMs = hasWaterTimeMs ? Number(options.waterTimeMs) : this.getNow();
      templates.forEach((template) => {
        const waterKind = template.waterKind || tile.water?.kind;
        const water = waterKind ? manifest.getWaterAsset?.(waterKind) : null;
        if (!water?.path) return;
        const texture = this.getAsset(water.path);
        if (!texture || typeof this.ctx.drawImage !== 'function') return;
        if (this.drawWorldTileWaterLayer(template, water, texture, center, drawRect, tileViewport, timeMs)) drawn = true;
      });
      if (drawn && options.drawDryTemplate !== false) this.drawWorldTileDryTemplate(tile, drawRect);
      return drawn;
    }

    isWorldTileMapWaterAnimated(tileMapView = {}) {
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
      const baseTemplate = this.getWorldTileTemplateBaseAsset(tile);
      const baseAsset = baseTemplate?.asset || tile.terrainAsset || '';
      const hasWater = Boolean(tile.water?.kind && tile.water?.asset && baseTemplate?.asset);
      const drawnWater = hasWater ? this.drawWorldTileWater(tile, center, drawRect, viewport) : false;
      if (drawnWater) return true;
      return this.drawTileAsset(baseAsset, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
    }

    drawCoverAsset(assetPath, x, y, width, height, alpha = 1) {
      const image = this.getAsset(assetPath);
      if (!image || typeof this.ctx.drawImage !== 'function') return false;
      const sourceWidth = Number(image.naturalWidth || image.width);
      const sourceHeight = Number(image.naturalHeight || image.height);
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = alpha;
      if (sourceWidth > 0 && sourceHeight > 0) {
        const sourceRatio = sourceWidth / sourceHeight;
        const targetRatio = width / height;
        let sx = 0;
        let sy = 0;
        let sw = sourceWidth;
        let sh = sourceHeight;
        if (sourceRatio > targetRatio) {
          sw = sourceHeight * targetRatio;
          sx = (sourceWidth - sw) / 2;
        } else {
          sh = sourceWidth / targetRatio;
          sy = (sourceHeight - sh) / 2;
        }
        this.ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
      } else {
        this.ctx.drawImage(image, x, y, width, height);
      }
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      return true;
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

    clear() {
      if (!this.ctx) return;
      // For HUD overlay mode: only clear the HUD regions we actually draw to.
      // The DOM game UI shows through the transparent canvas background.
      // Top bar and migrated Canvas-owned pages.
      // Bottom tabs: y height-72 to height
      const hudTopY = 0;
      const hudBottomY = Math.max(0, this.height - 72);
      this.ctx.clearRect(0, hudTopY, this.width, hudBottomY - hudTopY);
      this.ctx.clearRect(0, hudBottomY, this.width, this.height - hudBottomY);
      // Optional: draw a subtle top bar backing if needed, but keep transparent for DOM
    }

    clearAll() {
      if (!this.ctx || typeof this.ctx.clearRect !== 'function') return;
      this.ctx.clearRect(0, 0, this.width, this.height);
    }

    drawText(text, x, y, options = {}) {
      if (!this.ctx) return;
      this.ctx.fillStyle = options.color || '#f6e8c8';
      this.ctx.font = `${options.bold ? '700 ' : ''}${options.size || 14}px ${options.fontFamily || 'sans-serif'}`;
      this.ctx.textBaseline = options.baseline || 'top';
      this.ctx.textAlign = options.align || 'left';
      this.ctx.fillText(String(text ?? ''), x, y);
      this.ctx.textAlign = 'left';
    }

    drawTextLines(lines = [], x, y, options = {}) {
      const lineHeight = options.lineHeight || 18;
      lines.forEach((line, index) => {
        this.drawText(line, x, y + index * lineHeight, options);
      });
    }

    wrapText(text, maxWidth, options = {}) {
      const content = String(text ?? '');
      if (!content) return [];
      if (!this.ctx || typeof this.ctx.measureText !== 'function') return [content];
      const previousFont = this.ctx.font;
      this.ctx.font = `${options.bold ? '700 ' : ''}${options.size || 14}px ${options.fontFamily || 'sans-serif'}`;
      const lines = [];
      content.split('\n').forEach((rawLine) => {
        let buffer = '';
        Array.from(rawLine).forEach((char) => {
          const next = `${buffer}${char}`;
          if (buffer && this.ctx.measureText(next).width > maxWidth) {
            lines.push(buffer);
            buffer = char;
          } else {
            buffer = next;
          }
        });
        if (buffer || rawLine === '') lines.push(buffer);
      });
      this.ctx.font = previousFont;
      return lines;
    }

    measureTextWidth(text, options = {}) {
      const content = String(text ?? '');
      if (!this.ctx || typeof this.ctx.measureText !== 'function') return content.length * (options.size || 14) * 0.55;
      const previousFont = this.ctx.font;
      this.ctx.font = `${options.bold ? '700 ' : ''}${options.size || 14}px ${options.fontFamily || 'sans-serif'}`;
      const width = this.ctx.measureText(content).width;
      this.ctx.font = previousFont;
      return width;
    }

    truncateText(text, maxWidth, options = {}) {
      const content = String(text ?? '');
      if (!content || this.measureTextWidth(content, options) <= maxWidth) return content;
      const ellipsis = '...';
      let buffer = '';
      Array.from(content).some((char) => {
        const next = `${buffer}${char}`;
        if (this.measureTextWidth(`${next}${ellipsis}`, options) > maxWidth) return true;
        buffer = next;
        return false;
      });
      return buffer ? `${buffer}${ellipsis}` : ellipsis;
    }

    wrapTextLimit(text, maxWidth, maxLines, options = {}) {
      const limit = Math.max(1, Number(maxLines) || 1);
      const lines = this.wrapText(text, maxWidth, options);
      if (lines.length <= limit) return lines;
      const visible = lines.slice(0, limit);
      visible[visible.length - 1] = this.truncateText(`${visible[visible.length - 1]}...`, maxWidth, options);
      return visible;
    }

    drawLine(x1, y1, x2, y2, options = {}) {
      if (!this.ctx) return;
      this.ctx.strokeStyle = options.color || 'rgba(232, 199, 128, 0.28)';
      this.ctx.lineWidth = options.width || 1;
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
    }

    drawPolyline(points = [], options = {}) {
      if (!this.ctx || points.length < 2) return;
      this.ctx.strokeStyle = options.color || 'rgba(232, 199, 128, 0.28)';
      this.ctx.lineWidth = options.width || 1;
      this.ctx.beginPath();
      this.ctx.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach((point) => this.ctx.lineTo(point.x, point.y));
      this.ctx.stroke();
    }

    drawCurvePath(path = {}, options = {}) {
      if (!this.ctx || !path.start || !path.end) return;
      const previousLineCap = this.ctx.lineCap;
      const previousLineJoin = this.ctx.lineJoin;
      this.ctx.strokeStyle = options.color || 'rgba(232, 199, 128, 0.28)';
      this.ctx.lineWidth = options.width || 1;
      this.ctx.lineCap = options.lineCap || 'round';
      this.ctx.lineJoin = options.lineJoin || 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(path.start.x, path.start.y);
      if (typeof this.ctx.bezierCurveTo === 'function' && path.c1 && path.c2) {
        this.ctx.bezierCurveTo(path.c1.x, path.c1.y, path.c2.x, path.c2.y, path.end.x, path.end.y);
      } else {
        this.ctx.lineTo(path.end.x, path.end.y);
      }
      this.ctx.stroke();
      if (previousLineCap !== undefined) this.ctx.lineCap = previousLineCap;
      if (previousLineJoin !== undefined) this.ctx.lineJoin = previousLineJoin;
    }

    drawCircle(x, y, radius, options = {}) {
      if (!this.ctx || typeof this.ctx.arc !== 'function') return;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      if (options.fill) {
        this.ctx.fillStyle = options.fill;
        this.ctx.fill();
      }
      if (options.stroke) {
        this.ctx.strokeStyle = options.stroke;
        this.ctx.lineWidth = options.width || 1;
        this.ctx.stroke();
      }
    }

    beginFrame(options = {}) {
      const optionNow = Number(options.now);
      const now = Number.isFinite(optionNow) ? optionNow : Date.now();
      this.frameNow = now;
      this.lastRenderOptions = options || {};
      this.famousSkillHitTargets = [];
      this.activeFamousSkillTooltip = null;
      this.updateFps(now);
      return now;
    }

    endFrame(options = {}) {
      this.renderFpsOverlay(options);
      this.frameNow = 0;
    }

    getNow() {
      return this.frameNow || Date.now();
    }

    updateFps(now = Date.now()) {
      const timestamp = Number(now);
      if (!Number.isFinite(timestamp)) return this.currentFps;
      if (!this.fpsLastFrameAt) {
        this.fpsLastFrameAt = timestamp;
        this.fpsLastPaintAt = timestamp;
        return this.currentFps;
      }
      const delta = Math.max(4, timestamp - this.fpsLastFrameAt);
      this.fpsLastFrameAt = timestamp;
      if (delta > 250) return this.currentFps;
      const fps = Math.min(120, 1000 / delta);
      this.fpsSamples.push(fps);
      if (this.fpsSamples.length > 30) this.fpsSamples.shift();
      const average = this.fpsSamples.reduce((sum, value) => sum + value, 0) / this.fpsSamples.length;
      this.currentFps = Math.round(average >= 58 && average <= 64 ? 60 : average);
      return this.currentFps;
    }

    renderFpsOverlay(options = {}) {
      if (!this.showFpsOverlay || options.showFpsOverlay === false || !this.ctx) return;
      const now = this.getNow();
      if (!this.fpsLastPaintAt || now - this.fpsLastPaintAt >= 180 || (!this.fpsLastPaintedValue && this.currentFps)) {
        this.fpsLastPaintAt = now;
        this.fpsLastPaintedValue = Math.max(0, Math.round(Number(options.fps ?? this.currentFps) || 0));
      }
      const fps = this.fpsLastPaintedValue;
      const label = fps ? `FPS ${fps}` : 'FPS --';
      const width = Math.max(66, Math.min(84, Math.ceil(this.measureTextWidth(label, { size: 11, bold: true }) + 18)));
      const color = fps >= 55 ? '#74d3a0' : (fps >= 30 ? '#ffd98a' : '#ff6b6b');
      this.drawPanel(8, 8, width, 22, {
        fill: 'rgba(11, 18, 14, 0.72)',
        stroke: 'rgba(255, 226, 177, 0.16)',
        radius: 6,
        inset: 'rgba(255, 255, 255, 0.03)',
      });
      this.drawText(label, 17, 19, {
        size: 11,
        bold: true,
        color,
        baseline: 'middle',
      });
    }

    drawPanel(x, y, width, height, options = {}) {
      if (!this.ctx) return;
      this.ctx.fillStyle = options.fill || 'rgba(37, 29, 21, 0.88)';
      this.ctx.strokeStyle = options.stroke || 'rgba(255, 226, 177, 0.14)';
      this.ctx.lineWidth = 1;
      const radius = options.radius || 8;
      this.roundRectPath(x, y, width, height, radius);
      this.ctx.fill();
      this.ctx.stroke();
      if (options.inset) {
        this.ctx.strokeStyle = options.inset;
        this.roundRectPath(x + 1, y + 1, width - 2, height - 2, Math.max(2, radius - 1));
        this.ctx.stroke();
      }
    }

    drawButton(x, y, width, height, label, options = {}) {
      if (!this.ctx) return;
      this.drawPanel(x, y, width, height, {
        fill: options.disabled
          ? 'rgba(60, 52, 46, 0.72)'
          : (options.active ? 'rgba(113, 86, 58, 0.98)' : 'rgba(50, 35, 22, 0.94)'),
        stroke: options.active ? 'rgba(240, 180, 91, 0.78)' : 'rgba(240, 180, 91, 0.32)',
        radius: options.radius || 8,
        inset: options.active ? 'rgba(255, 231, 184, 0.14)' : 'rgba(255, 231, 184, 0.08)',
      });
      this.drawText(label, x + width / 2, y + height / 2, {
        color: options.disabled ? '#8d8f99' : '#f6e8c8',
        size: options.size || 13,
        bold: Boolean(options.bold),
        baseline: 'middle',
        align: 'center',
      });
    }

    drawPrimaryActionButton(x, y, width, height, label, options = {}) {
      if (!this.ctx) return;
      const disabled = Boolean(options.disabled);
      const radius = options.radius || Math.min(10, Math.floor(height / 2));
      const fill = disabled
        ? 'rgba(60, 52, 46, 0.72)'
        : this.createGradient(
          x, y, x, y + height,
          [
            [0, 'rgba(247, 202, 104, 0.98)'],
            [1, 'rgba(176, 92, 39, 0.98)'],
          ],
          'rgba(214, 137, 58, 0.98)',
        );
      this.drawPanel(x, y, width, height, {
        fill,
        stroke: disabled ? 'rgba(240, 180, 91, 0.22)' : 'rgba(255, 235, 166, 0.82)',
        radius,
        inset: disabled ? 'rgba(255, 231, 184, 0.06)' : 'rgba(255, 252, 218, 0.22)',
      });
      if (!disabled) {
        this.drawLine(x + 9, y + 4, x + width - 9, y + 4, { color: 'rgba(255, 255, 220, 0.5)' });
        this.drawLine(x + 10, y + height - 3, x + width - 10, y + height - 3, { color: 'rgba(80, 36, 18, 0.28)' });
      }
      this.drawText(label, x + width / 2, y + height / 2, {
        color: disabled ? '#8d8f99' : '#24170e',
        size: options.size || 13,
        bold: true,
        baseline: 'middle',
        align: 'center',
      });
    }

    drawProgressBar(x, y, width, height, percentage) {
      if (!this.ctx) return;
      this.drawPanel(x, y, width, height, {
        fill: 'rgba(11, 18, 14, 0.38)',
        stroke: 'rgba(255, 226, 177, 0.16)',
        radius: height / 2,
      });
      const fillWidth = Math.max(0, Math.min(width, width * (Number(percentage) || 0) / 100));
      if (fillWidth <= 0) return;
      this.ctx.fillStyle = this.createGradient(
        x, y, x + fillWidth, y,
        [
          [0, '#d78332'],
          [1, '#f0b45b'],
        ],
        '#d8a94f',
      );
      this.roundRectPath(x, y, fillWidth, height, height / 2);
      this.ctx.fill();
    }

    drawIconCard(x, y, width, height, assetPath, options = {}) {
      if (!this.ctx) return;
      this.drawPanel(x, y, width, height, {
        fill: options.fill || 'rgba(96, 67, 39, 0.88)',
        stroke: options.stroke || 'rgba(255, 226, 177, 0.18)',
        radius: options.radius || 8,
        inset: 'rgba(255, 238, 203, 0.12)',
      });
      this.drawAsset(
        assetPath,
        x + (width - (options.iconWidth || 28)) / 2,
        y + (height - (options.iconHeight || 28)) / 2,
        options.iconWidth || 28,
        options.iconHeight || 28,
      );
    }

    renderSectionHeader(title, x, y, icon = '') {
      this.drawText(`${icon ? `${icon} ` : ''}${title}`, x, y, { size: 15, bold: true, color: '#eaeaea' });
    }

    getTopBarBottom(state = {}, options = {}) {
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

    renderGuideTasks(state = {}, startY = 0) {
      return startY;
      const guideTasks = state.guideTasks || {};
      const tasks = Array.isArray(guideTasks.tasks) ? guideTasks.tasks : [];
      if (!guideTasks.visible || !tasks.length) return startY;

      const task = tasks[0];
      const layout = this.getLayout();
      const x = layout.contentX;
      const y = startY;
      const width = layout.contentWidth;
      const height = 72;
      const buttonWidth = 82;
      const buttonHeight = 34;
      const buttonX = x + width - buttonWidth - 14;
      const buttonY = y + 19;
      const canClaim = task.status === 'claimable' && !task.claimed;
      const canGo = !canClaim && Boolean(task.target);
      const buttonDisabled = !canClaim && !canGo;

      this.drawPanel(x, y, width, height, {
        fill: this.createGradient(
          x, y, x + width, y + height,
          [
            [0, 'rgba(57, 44, 28, 0.96)'],
            [1, 'rgba(23, 20, 15, 0.96)'],
          ],
          'rgba(38, 30, 22, 0.96)',
        ),
        stroke: canClaim ? 'rgba(247, 215, 116, 0.56)' : 'rgba(240, 180, 91, 0.22)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.1)',
      });

      this.drawPanel(x + 12, y + 12, 42, 20, {
        fill: canClaim ? 'rgba(247, 215, 116, 0.22)' : 'rgba(116, 211, 160, 0.16)',
        stroke: canClaim ? 'rgba(247, 215, 116, 0.42)' : 'rgba(116, 211, 160, 0.28)',
        radius: 6,
      });
      this.drawText('主线', x + 33, y + 22, {
        size: 11,
        bold: true,
        color: canClaim ? '#ffd98a' : '#74d3a0',
        baseline: 'middle',
        align: 'center',
      });

      const textX = x + 64;
      const textWidth = Math.max(96, buttonX - textX - 12);
      this.drawText(this.truncateText(task.title || '主线任务', textWidth, { size: 14, bold: true }), textX, y + 10, {
        size: 14,
        bold: true,
        color: '#fff1cf',
      });
      const desc = canClaim
        ? '任务已完成，前往任务列表领取奖励'
        : (task.description || task.rewardText || '');
      const lines = this.wrapTextLimit(desc, textWidth, 2, { size: 11 });
      this.drawTextLines(lines, textX, y + 31, {
        size: 11,
        color: canClaim ? '#ffd98a' : '#cbbd96',
        lineHeight: 15,
      });

      const buttonLabel = canClaim ? (task.actionLabel || '任务') : (task.actionLabel || '前往');
      const buttonAction = task.action || (
        canClaim
          ? { type: 'openTaskCenter', tab: 'main', taskId: task.id, target: 'task-center-main-claim', source: 'taskIcon' }
          : { type: 'goToGuideTaskTarget', taskId: task.id, target: task.target }
      );
      const hitAction = buttonAction.type === 'openTaskCenter'
        ? { ...buttonAction, source: buttonAction.source || 'taskIcon' }
        : buttonAction;
      this.drawButton(buttonX, buttonY, buttonWidth, buttonHeight, buttonLabel, {
        disabled: buttonDisabled,
        active: canClaim || canGo,
        size: 12,
        bold: canClaim || canGo,
        radius: 9,
      });
      this.addHitTarget(
        { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight },
        { ...hitAction, disabled: buttonDisabled },
      );

      return y + height + 10;
    }

    renderTaskCenterButton(state = {}) {
      return;
      if (!this.presenter || typeof this.presenter.buildTaskCenterViewState !== 'function') return;
      const view = this.presenter.buildTaskCenterViewState(state);
      const layout = this.getLayout();
      const size = 48;
      const x = layout.contentRight - size - 10;
      const y = this.height - 58 - this.bottomSafeArea - size - 10;
      const badge = Number(view.summary?.claimableCount) || 0;

      this.drawPanel(x, y, size, size, {
        fill: this.createGradient(
          x, y, x, y + size,
          [
            [0, 'rgba(96, 67, 39, 0.96)'],
            [1, 'rgba(35, 25, 17, 0.96)'],
          ],
          'rgba(60, 42, 26, 0.96)',
        ),
        stroke: badge > 0 ? 'rgba(247, 215, 116, 0.72)' : 'rgba(255, 226, 177, 0.2)',
        radius: 12,
        inset: 'rgba(255, 231, 184, 0.12)',
      });
      this.drawText('\u4efb\u52a1', x + size / 2, y + size / 2 + 1, {
        size: 14,
        bold: true,
        color: '#ffe6b5',
        baseline: 'middle',
        align: 'center',
      });
      if (badge > 0) {
        const badgeText = badge > 9 ? '9+' : String(badge);
        this.drawPanel(x + size - 18, y - 5, 22, 20, {
          fill: '#e94560',
          stroke: 'rgba(255, 255, 255, 0.18)',
          radius: 10,
        });
        this.drawText(badgeText, x + size - 7, y + 5, {
          size: 10,
          bold: true,
          color: '#fff',
          baseline: 'middle',
          align: 'center',
        });
      }
      this.addHitTarget({ x, y, width: size, height: size }, { type: 'openTaskCenter', source: 'taskIcon' });
    }

    renderGuidebookButton(state = {}) {
      return;
      if (!this.presenter || typeof this.presenter.buildGuidebookViewState !== 'function') return;
      const layout = this.getLayout();
      const size = 44;
      const x = layout.contentRight - size - 12;
      const taskY = this.height - 58 - this.bottomSafeArea - 48 - 10;
      const y = taskY - size - 8;
      if (y < 178) return;
      this.drawPanel(x, y, size, size, {
        fill: this.createGradient(
          x, y, x, y + size,
          [
            [0, 'rgba(50, 76, 66, 0.96)'],
            [1, 'rgba(25, 33, 29, 0.96)'],
          ],
          'rgba(37, 54, 47, 0.96)',
        ),
        stroke: 'rgba(116, 211, 160, 0.32)',
        radius: 11,
        inset: 'rgba(116, 211, 160, 0.1)',
      });
      this.drawText('略', x + size / 2, y + 17, {
        size: 15,
        bold: true,
        color: '#d5ffe8',
        baseline: 'middle',
        align: 'center',
      });
      this.drawText('攻略', x + size / 2, y + 31, {
        size: 10,
        bold: true,
        color: '#8fd8af',
        baseline: 'middle',
        align: 'center',
      });
      this.addHitTarget({ x, y, width: size, height: size }, { type: 'openGuidebook', source: 'homeFeature' });
    }

    delegateGuideTaskRenderer(method, args = []) {
      const renderer = this.guideTaskRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
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

    renderMainPanel(state = {}, activeTab = 'resources', startY = 210, availableHeight = 310, options = {}) {
      if (activeTab === 'buildings') this.renderBuildings(state, startY, availableHeight, {
        offset: options.buildingOffset,
        buildingTransition: options.buildingTransition,
        activeBuildingCategory: options.activeBuildingCategory,
      });
      else if (activeTab === 'events') this.renderEvents(state, startY, availableHeight);
      else if (activeTab === 'tech') this.renderTech(state, startY, availableHeight, options);
      else if (activeTab === 'civilization') this.renderCivilization(state, startY, availableHeight, options);
      else if (activeTab === 'military') this.renderMilitary(state, startY, availableHeight, options);
    }

    renderHudTabPage(state = {}, activeTab = 'resources', topBarBottom = 84, options = {}) {
      const offsetY = Number(this.viewportOffsetY) || 0;
      const viewportBottom = this.height - Math.max(0, offsetY);
      const tabsTop = viewportBottom - 60 - this.bottomSafeArea;
      if (options.isMapHome && activeTab === 'military') {
        if (!options.skipWorldMapLayer) this.renderMapHomeWorldView(state, topBarBottom, options);
        return;
      }
      if (activeTab === 'resources') {
        const populationBottom = this.renderPopulation(state, topBarBottom);
        this.renderHomeFeatureGrid(state, populationBottom, { maxBottom: tabsTop - 8 });
      } else if (activeTab === 'buildings') {
        const availableHeight = Math.max(180, tabsTop - topBarBottom - 12);
        this.renderBuildings(
          { ...state, tutorial: options.tutorial || state.tutorial || {} },
          topBarBottom,
          availableHeight,
          {
            offset: options.buildingOffset,
            buildingTransition: options.buildingTransition,
            activeBuildingCategory: options.activeBuildingCategory,
          },
        );
      } else if (activeTab === 'events') {
        const availableHeight = Math.max(180, tabsTop - topBarBottom - 12);
        this.renderEvents(state, topBarBottom, availableHeight);
      } else if (activeTab === 'tech') {
        const availableHeight = Math.max(180, tabsTop - topBarBottom - 12);
        this.renderTech(state, topBarBottom, availableHeight, options);
      } else if (activeTab === 'civilization') {
        const availableHeight = Math.max(260, tabsTop - topBarBottom - 12);
        this.renderCivilization(
          state,
          topBarBottom,
          availableHeight,
          { tutorial: options.tutorial || state.tutorial || {} },
        );
      } else if (activeTab === 'military') {
        const availableHeight = Math.max(360, tabsTop - topBarBottom - 12);
        this.renderMilitary(state, topBarBottom, availableHeight, options);
      }
    }

    renderHudTabPageWithTransition(state = {}, activeTab = 'resources', topBarBottom = 84, options = {}) {
      const pageTransition = options.pageTransition || null;
      const transition = this.getTransitionFrame(pageTransition);
      const fromTab = pageTransition?.fromTab;
      const toTab = pageTransition?.toTab || activeTab;
      if (!transition || !fromTab || fromTab === activeTab || toTab !== activeTab) {
        this.renderHudTabPage(state, activeTab, topBarBottom, options);
        return;
      }
      const tabsTop = this.height - 60 - this.bottomSafeArea;
      const clipY = topBarBottom;
      const clipHeight = Math.max(120, tabsTop - clipY);
      const travel = this.width + 24;
      this.withSlideClip(0, clipY, this.width, clipHeight, -transition.direction * travel * transition.eased, () => {
        this.withSuppressedHitTargets(() => this.renderHudTabPage(state, fromTab, topBarBottom, {
          ...options,
          buildingOffset: pageTransition.fromBuildingOffset ?? options.buildingOffset,
          buildingTransition: null,
        }));
      });
      this.withSlideClip(0, clipY, this.width, clipHeight, transition.direction * travel * (1 - transition.eased), () => {
        this.renderHudTabPage(state, activeTab, topBarBottom, options);
      });
    }

    getWorldMapLayerLayout(state = {}, topBarBottom = null, options = {}) {
      if (!this.presenter || typeof this.presenter.buildMilitaryNavigationViewState !== 'function') return null;
      const nav = this.presenter.buildMilitaryNavigationViewState(state);
      if (nav.activeView !== 'world') return null;
      const layout = this.getLayout();
      const offsetX = Number(this.viewportOffsetX) || 0;
      const offsetY = Number(this.viewportOffsetY) || 0;
      const viewportBottom = this.height - Math.max(0, offsetY);
      const tabsTop = viewportBottom - 60 - this.bottomSafeArea;
      if (options.isMapHome) {
        const mapX = 0;
        const mapY = Math.max(0, topBarBottom ?? 84);
        const mapW = this.width;
        const mapBottom = this.height - 64;
        const mapH = Math.max(160, mapBottom - mapY);
        return {
          nav,
          panel: {
            x: mapX,
            y: mapY,
            width: mapW,
            height: mapH,
          },
          world: {
            x: mapX,
            y: mapY,
            width: mapW,
            height: mapH,
          },
          map: {
            x: mapX,
            y: mapY,
            width: mapW,
            height: mapH,
          },
        };
      }
      const panelTop = topBarBottom ?? 84;
      const panelHeight = Math.max(360, tabsTop - panelTop - 12);
      const panelX = layout.contentX;
      const panelWidth = layout.contentWidth;
      const worldX = panelX + 12;
      const worldY = panelTop + 88;
      const worldW = panelWidth - 24;
      const worldH = Math.max(120, panelTop + panelHeight - worldY - 12);
      return {
        nav,
        panel: {
          x: panelX,
          y: panelTop,
          width: panelWidth,
          height: panelHeight,
        },
        world: {
          x: worldX,
          y: worldY,
          width: worldW,
          height: worldH,
        },
        map: {
          x: worldX + 12,
          y: worldY + 46,
          width: worldW - 24,
          height: Math.max(160, worldH - 58),
        },
      };
    }

    renderMapHomeWorldView(state = {}, topBarBottom = 84, options = {}) {
      const layout = this.getWorldMapLayerLayout(state, topBarBottom, { isMapHome: true });
      if (!layout) return false;
      const territoryState = state.territoryState || {};
      const uiState = options.territoryUiState || {};
      const tileMapView = this.resolveWorldTileMapView(territoryState, uiState, options);
      if (!tileMapView?.tiles?.length) {
        if (Array.isArray(territoryState.territories) && territoryState.territories.length > 0) {
          this.renderMilitaryWorldView(state, layout.map.x, layout.map.y, layout.map.width, layout.map.height, {
            ...options,
            isMapHome: true,
          });
          return true;
        }
        this.renderMapHomeEmptyWorld(layout, topBarBottom, options);
        return true;
      }
      if (this.isWorldTileMapWaterAnimated(tileMapView)) uiState.tileMapWaterAnimated = true;
      const offsetX = Number(this.viewportOffsetX) || 0;
      const offsetY = Number(this.viewportOffsetY) || 0;
      const visibleWidth = Number(this.viewportWidth) || Math.max(1, this.width - offsetX * 2);
      const visibleHeight = Number(this.viewportHeight) || Math.max(1, this.height - offsetY * 2);
      const visibleMapY = Math.max(0, topBarBottom ?? 84);
      const visibleMapH = Math.max(160, visibleHeight - 64 - visibleMapY);
      this.renderWorldTileMap(tileMapView, layout.map.x, layout.map.y, layout.map.width, layout.map.height, uiState, {
        hitTargetsOnly: Boolean(options.skipWorldMapLayer),
        frameless: true,
        fastDrag: Boolean(options.reuseCachedWorldTileView),
        scaleBasisWidth: visibleWidth,
        scaleBasisHeight: visibleMapH,
        originX: offsetX + visibleWidth * 0.5,
        originY: offsetY + visibleMapY + visibleMapH * 0.42,
      });
      const resetW = 76;
      const resetH = 28;
      const resetX = Math.max(8, layout.map.x + layout.map.width - resetW - 12);
      const resetY = Math.max(layout.map.y + 10, topBarBottom + 10);
      this.drawButton(resetX, resetY, resetW, resetH, '回到本城', { size: 11, radius: 8 });
      this.addHitTarget({ x: resetX, y: resetY, width: resetW, height: resetH }, { type: 'resetWorldPan' });
      this.renderMapHomeExplorerHud(state, layout, topBarBottom);
      return true;
    }

    collectMapHomeWorldSiteHitTargets(state = {}, topBarBottom = 84, options = {}) {
      const layout = this.getWorldMapLayerLayout(state, topBarBottom, { isMapHome: true });
      if (!layout) return false;
      const territoryState = state.territoryState || {};
      const uiState = options.territoryUiState || {};
      const tileMapView = this.resolveWorldTileMapView(territoryState, uiState, options);
      if (!tileMapView?.tiles?.length) return false;
      const offsetX = Number(this.viewportOffsetX) || 0;
      const offsetY = Number(this.viewportOffsetY) || 0;
      const visibleWidth = Number(this.viewportWidth) || Math.max(1, this.width - offsetX * 2);
      const visibleHeight = Number(this.viewportHeight) || Math.max(1, this.height - offsetY * 2);
      const visibleMapY = Math.max(0, topBarBottom ?? 84);
      const visibleMapH = Math.max(160, visibleHeight - 64 - visibleMapY);
      const geometry = tileMapView.geometry || {};
      const scale = Math.max(0.38, Math.min(0.78, Math.min(visibleWidth / 520, visibleMapH / 420)));
      const viewport = {
        originX: offsetX + visibleWidth * 0.5,
        originY: offsetY + visibleMapY + visibleMapH * 0.42,
        panX: Number(tileMapView.pan?.x) || 0,
        panY: Number(tileMapView.pan?.y) || 0,
        scale,
        seed: tileMapView.seed || 'scout-tile-v1',
        geometry,
      };
      const frame = {
        x: layout.map.x + 1,
        y: layout.map.y + 1,
        width: layout.map.width - 2,
        height: layout.map.height - 2,
      };
      const visibleEntries = this.getWorldTileRenderEntries(tileMapView, viewport, frame, geometry);
      this.addWorldTileSiteHitTargets(tileMapView, viewport, visibleEntries, uiState);
      return true;
    }

    renderMapHomeExplorerHud(state = {}, layout = {}, topBarBottom = 84) {
      const explorer = state.worldExplorerState || {};
      const active = explorer.activeMission || null;
      const ready = Array.isArray(explorer.readyMissions) ? explorer.readyMissions[0] : null;
      const map = layout.map || { x: 0, y: topBarBottom, width: this.width };
      const width = Math.min(184, Math.max(132, map.width - 24));
      const height = active || ready ? 48 : 34;
      const x = Math.max(8, map.x + 12);
      const y = Math.max(map.y + 10, topBarBottom + 10);
      this.drawPanel(x, y, width, height, {
        fill: 'rgba(19, 18, 14, 0.78)',
        stroke: 'rgba(255, 226, 177, 0.18)',
        radius: 8,
        inset: 'rgba(255, 231, 184, 0.06)',
      });
      if (ready) {
        this.drawText('探索队已返回', x + 12, y + 14, { size: 11, bold: true, color: '#ffe6b5' });
        const buttonW = 58;
        const buttonH = 24;
        const buttonX = x + width - buttonW - 8;
        const buttonY = y + 12;
        this.drawButton(buttonX, buttonY, buttonW, buttonH, '归队', { size: 11, radius: 7 });
        this.addHitTarget({ x: buttonX, y: buttonY, width: buttonW, height: buttonH }, { type: 'claimExplore', missionId: ready.id });
        return true;
      }
      if (active) {
        const route = Array.isArray(active.route) ? active.route : [];
        const done = route.filter((step) => step.revealed).length;
        const total = Math.max(1, route.length || active.revealedTileIds?.length || 1);
        this.drawText(`探索中 ${done}/${total}`, x + 12, y + 14, { size: 11, bold: true, color: '#ffe6b5' });
        this.drawText(`${Math.max(0, Number(active.remainingSeconds) || 0)}s`, x + width - 12, y + 14, {
          size: 11,
          color: '#f0b45b',
          align: 'right',
        });
        const barX = x + 12;
        const barY = y + 32;
        const barW = width - 24;
        const progress = Math.max(0, Math.min(1, done / total));
        this.ctx.fillStyle = 'rgba(255, 226, 177, 0.14)';
        this.ctx.fillRect(barX, barY, barW, 4);
        this.ctx.fillStyle = '#74d3a0';
        this.ctx.fillRect(barX, barY, Math.max(3, barW * progress), 4);
        return true;
      }
      this.drawText('探索队', x + 12, y + 12, { size: 11, bold: true, color: '#ffe6b5' });
      const buttonW = 64;
      const buttonH = 24;
      const buttonX = x + width - buttonW - 8;
      const buttonY = y + 5;
      this.drawButton(buttonX, buttonY, buttonW, buttonH, '探索', { size: 11, radius: 7 });
      this.addHitTarget({ x: buttonX, y: buttonY, width: buttonW, height: buttonH }, {
        type: 'startExplore',
        mode: 'random',
        routeLength: explorer.randomRouteLength || 8,
      });
      return true;
    }

    renderMapHomeEmptyWorld(layout = {}, topBarBottom = 84, options = {}) {
      const map = layout.map || { x: 0, y: topBarBottom, width: this.width, height: Math.max(160, this.height - topBarBottom - 64) };
      if (this.ctx) {
        this.ctx.fillStyle = this.createGradient(
          map.x,
          map.y,
          map.x,
          map.y + map.height,
          [
            [0, '#202920'],
            [0.55, '#18251f'],
            [1, '#111816'],
          ],
          '#18251f',
        );
        this.ctx.fillRect(map.x, map.y, map.width, map.height);
        this.ctx.strokeStyle = 'rgba(255, 226, 177, 0.08)';
        this.ctx.lineWidth = 1;
        const grid = 34;
        for (let x = map.x - (map.x % grid); x < map.x + map.width; x += grid) {
          this.ctx.beginPath();
          this.ctx.moveTo(x, map.y);
          this.ctx.lineTo(x, map.y + map.height);
          this.ctx.stroke();
        }
        for (let y = map.y - (map.y % grid); y < map.y + map.height; y += grid) {
          this.ctx.beginPath();
          this.ctx.moveTo(map.x, y);
          this.ctx.lineTo(map.x + map.width, y);
          this.ctx.stroke();
        }
      }
      const message = options.loading?.message || '\u6b63\u5728\u6574\u7406\u5927\u5730\u56fe';
      const panelWidth = Math.min(260, map.width - 36);
      const panelHeight = 86;
      const x = map.x + (map.width - panelWidth) / 2;
      const y = map.y + Math.max(76, map.height * 0.36 - panelHeight / 2);
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: 'rgba(20, 24, 18, 0.82)',
        stroke: 'rgba(255, 226, 177, 0.18)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.05)',
      });
      this.drawText(message, x + panelWidth / 2, y + 24, {
        size: 14,
        bold: true,
        color: '#ffe6b5',
        align: 'center',
      });
      this.drawText('\u5730\u56fe\u6570\u636e\u540c\u6b65\u540e\u4f1a\u81ea\u52a8\u663e\u793a', x + panelWidth / 2, y + 52, {
        size: 11,
        color: '#cbbd96',
        align: 'center',
      });
      this.addHitTarget({ x: map.x, y: map.y, width: map.width, height: map.height }, { type: 'blockCanvasModal' });
      return true;
    }

    renderWorldMapLayer(state = {}, options = {}) {
      if (!this.presenter || !this.ctx) return false;
      this.beginFrame(options);
      this.setHitTargets([]);
      this.clearAll();
      const layout = this.getWorldMapLayerLayout(state, options.topBarBottom, options);
      if (!layout) {
        this.endFrame({ ...options, showFpsOverlay: false });
        return false;
      }
      const territoryState = state.territoryState || {};
      const uiState = options.territoryUiState || {};
      const tileMapView = this.resolveWorldTileMapView(territoryState, uiState, options);
      if (!tileMapView?.tiles?.length) {
        this.endFrame({ ...options, showFpsOverlay: false });
        return false;
      }
      if (this.isWorldTileMapWaterAnimated(tileMapView)) uiState.tileMapWaterAnimated = true;
      this.worldTileWaterTimeOverride = options.waterTimeMs !== null
        && options.waterTimeMs !== undefined
        && Number.isFinite(Number(options.waterTimeMs))
        ? Number(options.waterTimeMs)
        : null;
      const drawWorldMap = () => {
        this.renderWorldTileMap(tileMapView, layout.map.x, layout.map.y, layout.map.width, layout.map.height, uiState, {
          frameless: Boolean(options.isMapHome),
          fastDrag: Boolean(options.reuseCachedWorldTileView),
          snapshotOnly: Boolean(options.snapshotOnly),
        });
      };
      try {
        if (options.collectHitTargets) drawWorldMap();
        else this.withSuppressedHitTargets(drawWorldMap);
      } finally {
        this.worldTileWaterTimeOverride = null;
      }
      this.endFrame({ ...options, showFpsOverlay: false });
      return true;
    }

    renderWorldMapSnapshotLayer(state = {}, options = {}) {
      if (!this.presenter || !this.ctx || typeof this.ctx.drawImage !== 'function') return false;
      if (options.preserveOnMiss && !options.__snapshotBackbuffer) {
        const cacheScale = Math.max(1, Number(this.pixelRatio) || 1);
        const work = this.getWorldTileLayerCacheContext('worldTileSnapshotLayerBackbuffer', this.width, this.height, cacheScale);
        if (!work?.canvas || !work?.ctx) return false;
        const previousCtx = this.ctx;
        this.ctx = work.ctx;
        try {
          work.ctx.setTransform?.(1, 0, 0, 1, 0, 0);
          work.ctx.clearRect?.(0, 0, work.pixelWidth || work.canvas.width, work.pixelHeight || work.canvas.height);
          work.ctx.setTransform?.(cacheScale, 0, 0, cacheScale, 0, 0);
          const rendered = this.renderWorldMapSnapshotLayer(state, {
            ...options,
            preserveOnMiss: false,
            __snapshotBackbuffer: true,
          });
          if (!rendered) return false;
        } finally {
          this.ctx = previousCtx;
        }
        this.ctx.drawImage(
          work.canvas,
          0,
          0,
          work.pixelWidth || work.canvas.width,
          work.pixelHeight || work.canvas.height,
          0,
          0,
          work.width || this.width,
          work.height || this.height,
        );
        return true;
      }
      this.beginFrame(options);
      this.setHitTargets([]);
      this.clearAll();
      const layout = this.getWorldMapLayerLayout(state, options.topBarBottom, options);
      if (!layout) {
        this.endFrame({ ...options, showFpsOverlay: false });
        return false;
      }
      const territoryState = state.territoryState || {};
      const uiState = options.territoryUiState || {};
      const tileMapView = this.resolveWorldTileMapView(territoryState, uiState, options);
      if (!tileMapView?.tiles?.length) {
        this.endFrame({ ...options, showFpsOverlay: false });
        return false;
      }
      const x = layout.map.x;
      const y = layout.map.y;
      const width = layout.map.width;
      const height = layout.map.height;
      const geometry = tileMapView.geometry || {};
      const scaleBasisWidth = Number(options.scaleBasisWidth) || width;
      const scaleBasisHeight = Number(options.scaleBasisHeight) || height;
      const originX = options.originX !== undefined ? Number(options.originX) : x + width * 0.5;
      const originY = options.originY !== undefined ? Number(options.originY) : y + height * 0.42;
      const scale = Math.max(0.38, Math.min(0.78, Math.min(scaleBasisWidth / 520, scaleBasisHeight / 420)));
      const viewport = {
        originX: Number.isFinite(originX) ? originX : x + width * 0.5,
        originY: Number.isFinite(originY) ? originY : y + height * 0.42,
        panX: Number(tileMapView.pan?.x) || 0,
        panY: Number(tileMapView.pan?.y) || 0,
        scale,
        seed: tileMapView.seed || 'scout-tile-v1',
        geometry,
      };
      const frame = { x: x + 1, y: y + 1, width: width - 2, height: height - 2 };
      this.worldTileWaterTimeOverride = options.waterTimeMs !== null
        && options.waterTimeMs !== undefined
        && Number.isFinite(Number(options.waterTimeMs))
        ? Number(options.waterTimeMs)
        : null;
      let renderedSnapshot = false;
      try {
        if (options.frameless && this.ctx?.fillRect) {
          this.ctx.fillStyle = 'rgba(20, 26, 23, 0.92)';
          this.ctx.fillRect(x, y, width, height);
        }
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(x + 1, y + 1, width - 2, height - 2);
        this.ctx.clip();
        renderedSnapshot = this.renderWorldTileSnapshotCache(tileMapView, viewport, frame);
        this.ctx.restore();
      } finally {
        this.worldTileWaterTimeOverride = null;
      }
      this.endFrame({ ...options, showFpsOverlay: false });
      return renderedSnapshot;
    }

    renderTabs(activeTab = 'resources', state = {}, options = {}) {
      if (options.isMapHome) {
        this.renderMapCommandDock(state, options);
        return;
      }
      const visualActiveTab = options.isMapHome ? 'resources' : activeTab;
      const tabs = [
        ['resources', '主页', 'assets/art/icon-home-cutout.png'],
        ['tech', '科技', 'assets/art/icon-knowledge-cutout.webp'],
        ['events', '事件', 'assets/art/icon-event-cutout.webp'],
        ['famousPersons', '名人', 'assets/art/icon-scholar-cutout.webp'],
        ['civilization', '文明', 'assets/art/icon-fire-cutout.webp'],
      ];
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      const tabBarHeight = 58;
      const y = this.height - tabBarHeight;
      const eventBadge = this.presenter && typeof this.presenter.buildEventViewState === 'function'
        ? this.presenter.buildEventViewState(state).badge
        : { hidden: true };
      const lockById = new Map((options.tabLocks || []).map((item) => [item.id, item]));
      this.drawPanel(x, y, width, tabBarHeight, {
        fill: this.createGradient(
          x, y, x, y + tabBarHeight,
          [
            [0, 'rgba(47, 35, 25, 0.92)'],
            [1, 'rgba(23, 18, 13, 0.96)'],
          ],
          'rgba(34, 25, 18, 0.94)',
        ),
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 0,
      });
      const tabWidth = width / tabs.length;
      tabs.forEach(([id, label, icon], index) => {
        const tabX = x + index * tabWidth;
        const isActionTab = id === 'famousPersons';
        const isActive = isActionTab ? Boolean(options.showFamousPersons) : id === visualActiveTab;
        const lock = lockById.get(id) || { disabled: false, isLocked: false };
        const isLocked = Boolean(lock.disabled || lock.isLocked);
        if (isActive && this.ctx) {
          this.ctx.fillStyle = this.createGradient(
            tabX + tabWidth * 0.2, y, tabX + tabWidth * 0.8, y,
            [
              [0, '#d78332'],
              [1, '#f0b45b'],
            ],
            '#d78332',
          );
          this.ctx.fillRect(tabX + tabWidth * 0.2, y, tabWidth * 0.6, 3);
        }
        const previousAlpha = typeof this.ctx?.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
        if (typeof this.ctx?.globalAlpha === 'number') this.ctx.globalAlpha = isLocked ? 0.38 : previousAlpha;
        this.drawAsset(icon, tabX + tabWidth / 2 - (isActive ? 16 : 14), y + 7 - (isActive ? 2 : 0), isActive ? 32 : 28, isActive ? 32 : 28);
        if (typeof this.ctx?.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
        this.drawText(label, tabX + tabWidth / 2, y + 38, {
          size: 10,
          color: isLocked ? '#666' : (isActive ? '#d78332' : '#a0a0a0'),
          align: 'center',
          bold: isActive,
        });
        if (id === 'events' && !eventBadge.hidden) {
          const badgeX = tabX + tabWidth / 2 + 10;
          const badgeY = y + 6;
          this.drawPanel(badgeX, badgeY, 18, 18, {
            fill: '#e94560',
            stroke: 'rgba(255, 255, 255, 0.16)',
            radius: 9,
          });
          this.drawText(eventBadge.text, badgeX + 9, badgeY + 9, {
            size: 10,
            bold: true,
            color: '#fff',
            baseline: 'middle',
            align: 'center',
          });
        }
        this.addHitTarget(
          { x: tabX, y, width: tabWidth, height: tabBarHeight },
          isActionTab ? { type: 'openFamousPersons', disabled: isLocked } : { type: 'switchTab', tab: id, disabled: isLocked },
        );
      });
    }

    renderMapCommandDock(state = {}, options = {}) {
      const layout = this.getLayout();
      const x = 0;
      const width = this.width;
      const dockHeight = 64;
      const y = this.height - dockHeight;
      const activePanel = options.activeCommandPanel || '';
      if (this.ctx) {
        this.ctx.fillStyle = this.createGradient(
          x, y, x, y + dockHeight,
          [
            [0, 'rgba(44, 35, 25, 0.88)'],
            [1, 'rgba(18, 16, 13, 0.96)'],
          ],
          'rgba(30, 24, 18, 0.94)',
        );
        this.ctx.fillRect(x, y, width, dockHeight);
        this.ctx.fillStyle = 'rgba(255, 226, 177, 0.16)';
        this.ctx.fillRect(0, y, width, 1);
        this.ctx.fillStyle = 'rgba(255, 231, 184, 0.04)';
        this.ctx.fillRect(0, y + 1, width, 1);
      }
      const items = [
        { id: 'tech', label: '科技', icon: 'assets/art/icon-knowledge-cutout.webp', action: { type: 'openCommandPanel', panel: 'tech' } },
        { id: 'civilization', label: '文明', icon: 'assets/art/icon-fire-cutout.webp', action: { type: 'openCommandPanel', panel: 'civilization' } },
        { id: 'famousPersons', label: '名人', icon: 'assets/art/icon-scholar-cutout.webp', action: { type: 'openFamousPersons' } },
        { id: 'tasks', label: '任务', icon: 'assets/art/icon-event-cutout.webp', action: { type: 'openTaskCenter', tab: 'main', source: 'taskIcon' } },
        { id: 'settings', label: '设置', glyph: '⚙', action: { type: 'openSettings' } },
      ];
      const contentX = layout.contentX;
      const contentWidth = layout.contentWidth;
      const itemWidth = contentWidth / items.length;
      items.forEach((item, index) => {
        const itemX = contentX + index * itemWidth;
        const active = activePanel === item.id
          || (item.id === 'tasks' && options.showTaskCenter)
          || (item.id === 'famousPersons' && options.showFamousPersons)
          || (item.id === 'settings' && options.showSettings);
        if (active && this.ctx) {
          this.ctx.fillStyle = '#f0b45b';
          this.ctx.fillRect(itemX + itemWidth * 0.22, y, itemWidth * 0.56, 3);
        }
        const iconSize = active ? 30 : 26;
        const iconX = itemX + itemWidth / 2 - iconSize / 2;
        const iconY = y + 8 - (active ? 1 : 0);
        const previousAlpha = typeof this.ctx?.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
        if (typeof this.ctx?.globalAlpha === 'number') this.ctx.globalAlpha = item.disabled ? 0.38 : previousAlpha;
        if (!item.icon || !this.drawAsset(item.icon, iconX, iconY, iconSize, iconSize)) {
          this.drawText(item.glyph || item.label.slice(0, 1), itemX + itemWidth / 2, iconY + iconSize / 2, {
            size: item.glyph ? 18 : 14,
            bold: true,
            color: active ? '#ffe6b5' : '#cbbd96',
            baseline: 'middle',
            align: 'center',
          });
        }
        if (typeof this.ctx?.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
        this.drawText(this.truncateText(item.label, itemWidth - 4, { size: 10, bold: active }), itemX + itemWidth / 2, y + 43, {
          size: 10,
          bold: active,
          color: active ? '#f0b45b' : '#cbbd96',
          align: 'center',
        });
        this.addHitTarget({ x: itemX, y, width: itemWidth, height: dockHeight }, item.action);
      });
    }

    renderFloatingSubcityButton(state = {}, options = {}) {
      const { x, y, size } = this.getMapHomeFloatingButtonLayout(2);
      const active = Boolean(options.showSubcityList);
      this.drawPanel(x, y, size, size, {
        fill: active ? 'rgba(82, 58, 34, 0.94)' : 'rgba(34, 31, 25, 0.82)',
        stroke: active ? 'rgba(247, 215, 116, 0.56)' : 'rgba(255, 226, 177, 0.18)',
        radius: size / 2,
        inset: active ? 'rgba(255, 231, 184, 0.16)' : 'rgba(255, 231, 184, 0.06)',
      });
      this.drawText('分城', x + size / 2, y + 26, {
        size: 12,
        bold: true,
        color: active ? '#f0b45b' : '#aeb0b8',
        baseline: 'middle',
        align: 'center',
      });
      this.addHitTarget({ x, y, width: size, height: size }, { type: 'openSubcityList' });
    }

    renderFloatingEventButton(state = {}, options = {}) {
      const { x, y, size } = this.getMapHomeFloatingButtonLayout(1);
      const active = options.activeCommandPanel === 'events';
      this.drawPanel(x, y, size, size, {
        fill: active ? 'rgba(82, 58, 34, 0.94)' : 'rgba(34, 31, 25, 0.82)',
        stroke: active ? 'rgba(247, 215, 116, 0.56)' : 'rgba(255, 226, 177, 0.18)',
        radius: size / 2,
        inset: active ? 'rgba(255, 231, 184, 0.16)' : 'rgba(255, 231, 184, 0.06)',
      });
      this.drawText('事件', x + size / 2, y + 26, {
        size: 12,
        bold: true,
        color: active ? '#f0b45b' : '#aeb0b8',
        baseline: 'middle',
        align: 'center',
      });
      this.addHitTarget({ x, y, width: size, height: size }, { type: 'openCommandPanel', panel: 'events' });
    }

    renderMapCommandPanel(state = {}, options = {}) {
      const panel = options.activeCommandPanel || '';
      if (!panel) return;
      const layout = this.getLayout();
      const dockTop = this.height - 64;
      const top = Math.max(82, this.getTopBarBottom(state, { isMapHome: true }) + 8);
      const height = Math.max(220, dockTop - top - 12);
      const panelHeight = Math.min(height, panel === 'capital' ? 392 : 470);
      const y = dockTop - panelHeight - 10;
      const x = layout.contentX;
      const width = layout.contentWidth;
      const titleByPanel = {
        capital: '首都',
        buildings: '建设',
        military: '军事',
        tech: '科技',
        civilization: '文明',
        events: '事件',
      };
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeCommandPanel', background: true });
      this.drawPanel(x, y, width, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(50, 39, 27, 0.96)'],
            [1, 'rgba(19, 17, 13, 0.97)'],
          ],
          'rgba(34, 27, 20, 0.96)',
        ),
        stroke: 'rgba(255, 226, 177, 0.22)',
        radius: 12,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.addHitTarget({ x, y, width, height: panelHeight }, { type: 'blockCanvasModal' });
      const closeSize = 28;
      const closeX = x + width - closeSize - 10;
      const closeY = y + 10;
      this.drawText(titleByPanel[panel] || '面板', x + 16, y + 16, { size: 17, bold: true, color: '#ffe6b5' });
      this.drawButton(closeX, closeY, closeSize, closeSize, 'x', { size: 14, radius: 7 });
      this.addHitTarget({ x: closeX, y: closeY, width: closeSize, height: closeSize }, { type: 'closeCommandPanel' });

      const contentTop = y + 50;
      const contentHeight = Math.max(120, panelHeight - 62);
      if (panel === 'capital') {
        const populationBottom = this.renderPopulation(state, contentTop);
        this.renderHomeFeatureGrid(state, populationBottom, { maxBottom: y + panelHeight - 10 });
      } else {
        const panelTab = panel === 'military' ? 'military' : panel;
        const renderState = panelTab === 'military'
          ? { ...state, militaryView: state.militaryView === 'world' ? 'army' : (state.militaryView || 'army') }
          : state;
        this.renderMainPanel(renderState, panelTab, contentTop, contentHeight, {
          ...options,
          activeBuildingCategory: options.activeBuildingCategory,
          buildingOffset: options.buildingOffset,
          buildingTransition: options.buildingTransition,
        });
      }
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

    renderHudOverlay(state = {}, options = {}) {
      const activeTab = options.activeTab || 'resources';
      this.beginFrame(options);
      this.setHitTargets([]);
      if (!options.preserveCanvas) this.clear();
      if (options.auth?.view?.loginPanelVisible) {
        if (options.preserveCanvas) this.clear();
        this.renderLoginPanel(options.auth);
        this.endFrame(options);
        return;
      }
      if (options.loading?.visible) {
        if (options.preserveCanvas) this.clear();
        this.renderLoadingScreen(options.loading);
        this.endFrame(options);
        return;
      }
      if (options.battleScene?.visible) {
        if (options.preserveCanvas) this.clear();
        this.renderBattleSceneOverlay(state, options);
        this.endFrame(options);
        return;
      }
      const topBarBottom = this.renderTopBar(state, options);
      this.renderHudTabPageWithTransition(state, activeTab, topBarBottom, options);
      if (options.isMapHome && activeTab === 'military' && options.skipWorldMapLayer) {
        this.collectMapHomeWorldSiteHitTargets(state, topBarBottom, options);
      }
      this.renderTabs(activeTab, state, options);
      if (options.isMapHome && activeTab === 'military') {
        this.renderMapHomeOverlays(state, options);
        this.renderTutorialIntro(state, options);
        this.renderTutorialHighlight(options.tutorialHighlight || null);
        this.renderFloatingTexts(options.floatingTexts || []);
        this.renderRewardReveal(options.rewardReveal || null);
        this.renderNetworkOverlay(options.network || null);
        this.endFrame(options);
        return;
      }
      if (options.showResourceDetails) {
        this.renderResourceDetailsPanel(state);
      }
      if (options.showSettings) {
        this.renderSettingsPanel();
      }
      if (options.showLogs) {
        this.renderLogsPanel(options.logs || []);
      }
      if (options.showCitySwitcher) {
        this.renderCitySwitcherMenu(state);
      }
      if (options.showAdvisor) {
        this.renderAdvisorPanel(state);
      }
      if (options.showTaskCenter) {
        this.renderTaskCenterPanel(state, options);
      }
      if (options.showGuidebook) {
        this.renderGuidebookPanel(state, options);
      }
      if (options.showFamousPersons) {
        this.renderFamousPersonsPanel(state, options);
      }
      if (options.showTalentPolicy) {
        this.renderTalentPolicyPanel(state, options);
      }
      if (options.armyFormationEditor?.open) {
        this.renderArmyFormationEditor(state, options);
      }
      if (options.activeEventId) {
        this.renderEventModal(state, options.activeEventId);
      }
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
      if (activeTab === 'military') {
        this.renderWorldSiteModal(state, options);
      }
      if (options.naming) {
        this.renderNamingModal(options.naming);
      }
      this.renderTutorialHighlight(options.tutorialHighlight || null);
      this.renderFloatingTexts(options.floatingTexts || []);
      this.renderRewardReveal(options.rewardReveal || null);
      this.renderNetworkOverlay(options.network || null);
      this.endFrame(options);
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
