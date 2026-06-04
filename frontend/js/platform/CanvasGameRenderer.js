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
      const FamousRendererClass = options.famousRendererClass || SharedFamousCanvasRenderer;
      this.famousRenderer = options.famousRenderer || (FamousRendererClass ? new FamousRendererClass({ host: this }) : null);
      const TechRendererClass = options.techRendererClass || SharedTechCanvasRenderer;
      this.techRenderer = options.techRenderer || (TechRendererClass ? new TechRendererClass({ host: this }) : null);
      const BattleRendererClass = options.battleRendererClass || SharedBattleCanvasRenderer;
      this.battleRenderer = options.battleRenderer || (BattleRendererClass ? new BattleRendererClass({ host: this }) : null);
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

    renderTopBar(state = {}, options = {}) {
      if (options.isMapHome) return this.renderMapHomeTopBar(state);
      if (!this.presenter) return 84;
      const layout = this.getLayout();
      const resourceView = this.presenter.buildResourceViewState(state);
      const cityView = this.presenter.buildCitySwitcherViewState ? this.presenter.buildCitySwitcherViewState(state) : { hidden: true };
      const advisorView = this.presenter.buildAdvisorViewState ? this.presenter.buildAdvisorViewState(state.softGuide) : { hidden: true };
      const populationScale = resourceView.text?.populationValue
        ?? (typeof this.presenter.toDisplayPopulation === 'function'
          ? this.presenter.toDisplayPopulation(state.population?.total ?? state.totalPop)
          : (Number(state.population?.total ?? state.totalPop) || 0) * 100);
      const populationStatus = resourceView.text?.populationStatus || '';
      const x = layout.contentX;
      const y = 12;
      const width = layout.contentWidth;
      const barPaddingX = 14;
      const statusTop = y + 10;
      const statusHeight = 38;
      const resourceTop = y + 56;
      const resourceHeight = 62;
      const cityTop = y + 126;
      const cityHeight = 32;
      const barHeight = cityView.hidden ? 128 : 166;

      this.drawPanel(x, y, width, barHeight, {
        fill: this.createGradient(
          x, y, x + width, y + barHeight,
          [
            [0, 'rgba(73, 50, 31, 0.9)'],
            [1, 'rgba(34, 25, 18, 0.9)'],
          ],
          'rgba(48, 35, 25, 0.92)',
        ),
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 12,
        inset: 'rgba(255, 232, 185, 0.12)',
      });

      this.drawAsset('assets/art/icon-fire-cutout.webp', x + barPaddingX, statusTop + 4, 30, 30);
      this.drawText(state.currentEraName || '原始时代', x + barPaddingX + 36, statusTop + 13, { size: 14, bold: true, color: '#d78332', baseline: 'middle' });
      this.drawText(
        populationStatus || `人口：${populationScale}`,
        x + barPaddingX + 36,
        statusTop + 31,
        {
          size: populationStatus ? 9 : 10,
          bold: Boolean(populationStatus),
          color: populationStatus ? '#ffd98a' : 'rgba(234, 234, 234, 0.72)',
          baseline: 'middle',
        },
      );

      const actionDefs = [];
      if (!advisorView.hidden) actionDefs.push({ label: '顾问', width: 62 });
      actionDefs.push({ label: '日志', width: 44 });
      actionDefs.push({ label: '设置', width: 44 });
      let cursor = x + width - barPaddingX;
      actionDefs.slice().reverse().forEach((action, index) => {
        cursor -= action.width;
        const actionY = statusTop + 1;
        const actionHeight = action.label === '顾问' ? statusHeight : 36;
        this.drawButton(cursor, actionY, action.width, actionHeight, action.label, { size: 12, bold: true, active: false, radius: 18 });
        if (action.label === '顾问') {
          this.drawText('谋', cursor + 14, statusTop + 20, { size: 12, bold: true, color: '#f0b45b', baseline: 'middle', align: 'center' });
          this.drawText('●', cursor + action.width - 10, statusTop + 20, { size: 7, color: '#74d3a0', baseline: 'middle', align: 'center' });
          this.addHitTarget({ x: cursor, y: actionY, width: action.width, height: actionHeight }, { type: 'openAdvisor' });
        } else if (action.label === '日志') {
          this.addHitTarget({ x: cursor, y: actionY, width: action.width, height: actionHeight }, { type: 'openLogs' });
        } else if (action.label === '设置') {
          this.addHitTarget({ x: cursor, y: actionY, width: action.width, height: actionHeight }, { type: 'openSettings' });
        }
        if (index < actionDefs.length - 1) cursor -= 6;
      });

      const resources = [
        { label: '木材', value: resourceView.text.woodValue, rate: resourceView.text.woodRate, icon: 'assets/art/icon-wood-cutout.webp' },
        { label: '铁矿', value: resourceView.text.ironValue, rate: resourceView.text.ironRate, icon: 'assets/art/icon-iron-cutout.webp' },
        { label: '石料', value: resourceView.text.stoneValue, rate: resourceView.text.stoneRate, icon: 'assets/art/icon-stone-cutout.webp' },
        { label: '粮食', value: resourceView.text.foodValue, rate: resourceView.text.foodRate, icon: 'assets/art/icon-food-cutout.webp' },
        { label: '知识', value: resourceView.text.knowledgeValue, rate: resourceView.text.knowledgeRate, icon: 'assets/art/icon-knowledge-cutout.webp' },
      ];
      const compactResources = resources.length >= 5;
      const gap = compactResources ? 4 : 8;
      const resourceX = x + barPaddingX;
      const resourceWidth = width - barPaddingX * 2;
      const itemWidth = (resourceWidth - gap * (resources.length - 1)) / resources.length;
      const itemY = resourceTop;
      resources.forEach((resource, index) => {
        const itemX = resourceX + index * (itemWidth + gap);
        const iconSize = compactResources ? 30 : 30;
        const valueSize = compactResources ? 11 : 16;
        const rateSize = compactResources ? 9 : 10;
        const labelSize = compactResources ? 8 : 10;
        const textWidth = Math.max(24, itemWidth - 2);
        if (compactResources) {
          const centerX = itemX + itemWidth / 2;
          const iconX = centerX - iconSize / 2;
          this.drawAsset(resource.icon, iconX, itemY, iconSize, iconSize);
          this.drawText(resource.label, centerX, itemY + 31, { size: labelSize, color: '#cbbd96', align: 'center' });
          this.drawText(this.truncateText(resource.value, textWidth, { size: valueSize, bold: true }), centerX, itemY + 41, {
            size: valueSize,
            bold: true,
            color: '#74d3a0',
            align: 'center',
          });
          this.drawText(this.truncateText(resource.rate, textWidth, { size: rateSize }), centerX, itemY + 52, {
            size: rateSize,
            color: '#a0a0a0',
            align: 'center',
          });
        } else {
          const iconX = itemX + 4;
          const valueX = itemX + 41;
          const wideTextWidth = Math.max(18, itemWidth - (valueX - itemX));
          this.drawAsset(resource.icon, iconX, itemY + 3, iconSize, iconSize);
          this.drawText(resource.label, iconX + iconSize / 2, itemY + 32, { size: labelSize, color: '#cbbd96', align: 'center' });
          this.drawText(this.truncateText(resource.value, wideTextWidth, { size: valueSize, bold: true }), valueX, itemY + 8, { size: valueSize, bold: true, color: '#74d3a0' });
          this.drawText(this.truncateText(resource.rate, wideTextWidth, { size: rateSize }), valueX, itemY + 29, { size: rateSize, color: '#a0a0a0' });
        }
        this.addHitTarget({ x: itemX, y: itemY, width: itemWidth, height: resourceHeight }, { type: 'openResourceDetails' });
      });

      if (!cityView.hidden) {
        const triggerWidth = Math.min(190, width * 0.64);
        const triggerX = x + Math.floor((width - triggerWidth) / 2) - 8;
        const triggerY = cityTop;
        this.drawPanel(triggerX, triggerY - 5, triggerWidth, 9, {
          fill: 'rgba(93, 63, 35, 0.88)',
          stroke: 'rgba(255, 225, 177, 0.14)',
          radius: 5,
        });
        this.drawButton(triggerX, triggerY, triggerWidth, cityHeight, cityView.activeCityName || '首都', { size: 13, bold: true, active: true, radius: 8 });
        this.drawText('▾', triggerX + triggerWidth - 18, triggerY + 17, {
          size: 14,
          bold: true,
          color: '#ffd994',
          baseline: 'middle',
          align: 'center',
        });
        this.addHitTarget({ x: triggerX, y: triggerY, width: triggerWidth, height: cityHeight }, { type: 'openCitySwitcher' });
      }

      return y + barHeight + 12;
    }

    renderMapHomeTopBar(state = {}) {
      if (!this.presenter) return 72;
      const layout = this.getLayout();
      const resourceView = this.presenter.buildResourceViewState(state);
      const text = resourceView.text || {};
      const x = 0;
      const y = 0;
      const width = this.width;
      const height = 72;
      if (this.ctx) {
        this.ctx.fillStyle = this.createGradient(
          x, y, x, y + height,
          [
            [0, 'rgba(46, 37, 25, 0.86)'],
            [1, 'rgba(19, 18, 14, 0.88)'],
          ],
          'rgba(32, 26, 19, 0.86)',
        );
        this.ctx.fillRect(x, y, width, height);
        this.ctx.fillStyle = 'rgba(255, 231, 184, 0.06)';
        this.ctx.fillRect(0, 0, width, 1);
        this.ctx.fillStyle = 'rgba(255, 226, 177, 0.16)';
        this.ctx.fillRect(0, height - 1, width, 1);
      }
      const resources = [
        { label: '粮食', value: text.foodValue ?? '0', icon: 'assets/art/icon-food-cutout.webp' },
        { label: '木材', value: text.woodValue ?? '0', icon: 'assets/art/icon-wood-cutout.webp' },
        { label: '石料', value: text.stoneValue ?? '0', icon: 'assets/art/icon-stone-cutout.webp' },
        { label: '铁矿', value: text.ironValue ?? '0', icon: 'assets/art/icon-iron-cutout.webp' },
        { label: '知识', value: text.knowledgeValue ?? '0', icon: 'assets/art/icon-knowledge-cutout.webp' },
        { label: '人口', value: text.populationValue ?? this.presenter.toDisplayPopulation?.(state.population?.total ?? state.totalPop) ?? '0', icon: 'assets/art/icon-population-cutout.webp' },
      ];
      const contentX = layout.contentX;
      const contentWidth = layout.contentWidth;
      const gap = 3;
      const itemWidth = Math.max(42, Math.floor((contentWidth - 16 - gap * (resources.length - 1)) / resources.length));
      const itemY = y + 8;
      resources.forEach((resource, index) => {
        const itemX = contentX + 8 + index * (itemWidth + gap);
        const iconSize = 14;
        const centerX = itemX + itemWidth / 2;
        this.drawAsset(resource.icon, centerX - iconSize / 2, itemY + 5, iconSize, iconSize);
        this.drawText(resource.label, centerX, itemY + 23, {
          size: 8,
          bold: true,
          color: '#cbbd96',
          align: 'center',
        });
        this.drawText(this.truncateText(String(resource.value), itemWidth - 4, { size: 9, bold: true }), centerX, itemY + 40, {
          size: 9,
          bold: true,
          color: '#d5ffe8',
          align: 'center',
        });
        this.addHitTarget({ x: itemX, y: itemY, width: itemWidth, height: 42 }, { type: 'openResourceDetails' });
      });
      return 72;
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

    renderGuidebookPanel(state = {}, options = {}) {
      if (!this.presenter || typeof this.presenter.buildGuidebookViewState !== 'function') return;
      const view = this.presenter.buildGuidebookViewState(state, { activeTab: options.activeGuidebookTab });
      const layout = this.getLayout();
      const panelWidth = Math.min(372, layout.contentWidth - 10);
      const panelHeight = Math.min(510, Math.max(390, this.height - 210));
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(76, (this.height - panelHeight) / 2 - 10);

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeGuidebook' });
      if (this.ctx) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
        this.ctx.fillRect(0, 0, this.width, this.height);
      }
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(38, 51, 42, 0.99)'],
            [1, 'rgba(19, 20, 16, 0.99)'],
          ],
          'rgba(30, 36, 29, 0.99)',
        ),
        stroke: 'rgba(116, 211, 160, 0.28)',
        radius: 14,
        inset: 'rgba(116, 211, 160, 0.08)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      const closeSize = 28;
      const closeX = x + panelWidth - closeSize - 10;
      const closeY = y + 10;
      this.drawText(view.title || '攻略', x + 18, y + 18, { size: 18, bold: true, color: '#d5ffe8' });
      this.drawText(this.truncateText(view.subtitle || '', panelWidth - 76, { size: 12 }), x + 18, y + 44, {
        size: 12,
        color: '#9ccfaf',
      });
      this.drawButton(closeX, closeY, closeSize, closeSize, 'x', { size: 14, radius: 7 });
      this.addHitTarget({ x: closeX, y: closeY, width: closeSize, height: closeSize }, { type: 'closeGuidebook' });

      const tabs = Array.isArray(view.categories) ? view.categories : [];
      const tabY = y + 74;
      const tabGap = 5;
      const tabWidth = Math.max(52, (panelWidth - 28 - tabGap * Math.max(0, tabs.length - 1)) / Math.max(1, tabs.length));
      tabs.slice(0, 5).forEach((tab, index) => {
        const tabX = x + 14 + index * (tabWidth + tabGap);
        this.drawButton(tabX, tabY, tabWidth, 32, tab.label, {
          size: 11,
          bold: tab.isActive,
          active: tab.isActive,
          radius: 8,
        });
        this.addHitTarget({ x: tabX, y: tabY, width: tabWidth, height: 32 }, { type: 'switchGuidebookTab', tab: tab.id });
      });

      const contentX = x + 14;
      const contentY = tabY + 46;
      const contentWidth = panelWidth - 28;
      const contentHeight = y + panelHeight - contentY - 18;
      this.drawPanel(contentX, contentY, contentWidth, contentHeight, {
        fill: 'rgba(18, 24, 20, 0.64)',
        stroke: 'rgba(116, 211, 160, 0.16)',
        radius: 10,
      });

      const active = view.activeCategory || {};
      this.drawText(active.title || '城市规划', contentX + 14, contentY + 16, {
        size: 15,
        bold: true,
        color: '#d5ffe8',
      });
      let cursorY = contentY + 46;
      const lines = Array.isArray(active.lines) ? active.lines : [];
      lines.slice(0, 4).forEach((line) => {
        const wrapped = this.wrapTextLimit(line, contentWidth - 28, 2, { size: 12 });
        this.drawTextLines(wrapped, contentX + 14, cursorY, {
          size: 12,
          color: '#c5d8c9',
          lineHeight: 17,
        });
        cursorY += wrapped.length * 17 + 10;
      });

      if (active.id === 'planning' && view.planning) {
        const planningY = Math.min(cursorY + 2, contentY + contentHeight - 96);
        const planningHeight = Math.max(76, contentY + contentHeight - planningY - 12);
        this.drawPanel(contentX + 12, planningY, contentWidth - 24, planningHeight, {
          fill: 'rgba(36, 50, 41, 0.72)',
          stroke: 'rgba(116, 211, 160, 0.18)',
          radius: 9,
        });
        this.drawText(`地理：${view.planning.terrainLabel}`, contentX + 26, planningY + 16, {
          size: 12,
          bold: true,
          color: '#fff1cf',
        });
        this.drawText(`${view.planning.text.habitabilityStatus || '宜居度平稳'} · ${view.planning.text.populationGrowthStatus || '人口成长平稳'}`, contentX + 26, planningY + 36, {
          size: 12,
          bold: true,
          color: '#74d3a0',
        });
        this.drawTextLines(this.wrapTextLimit(view.planning.text.note, contentWidth - 52, 2, { size: 11 }), contentX + 26, planningY + 58, {
          size: 11,
          color: '#c5d8c9',
          lineHeight: 15,
        });
      }
    }

    renderTaskCenterPanel(state = {}, options = {}) {
      if (!this.presenter || typeof this.presenter.buildTaskCenterViewState !== 'function') return;
      const view = this.presenter.buildTaskCenterViewState(state, { activeTab: options.activeTaskCenterTab });
      const layout = this.getLayout();
      const panelWidth = Math.min(372, layout.contentWidth - 10);
      const panelHeight = Math.min(540, Math.max(390, this.height - 188));
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(72, (this.height - panelHeight) / 2 - 14);

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeTaskCenter' });
      if (this.ctx) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
        this.ctx.fillRect(0, 0, this.width, this.height);
      }
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(53, 39, 25, 0.99)'],
            [1, 'rgba(21, 18, 14, 0.99)'],
          ],
          'rgba(35, 27, 20, 0.99)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 14,
        inset: 'rgba(255, 231, 184, 0.1)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      const closeSize = 28;
      const closeX = x + panelWidth - closeSize - 10;
      const closeY = y + 10;
      this.drawText('任务', x + 18, y + 18, { size: 18, bold: true, color: '#ffe6b5' });
      this.drawText(`${view.summary?.claimableCount || 0} 个可领取`, x + 18, y + 44, { size: 12, color: '#cbbd96' });
      this.drawButton(closeX, closeY, closeSize, closeSize, 'x', { size: 14, radius: 7 });
      this.addHitTarget({ x: closeX, y: closeY, width: closeSize, height: closeSize }, { type: 'closeTaskCenter' });

      const tabs = Array.isArray(view.tabs) ? view.tabs : [];
      const tabY = y + 72;
      const tabGap = 5;
      const tabWidth = Math.max(54, (panelWidth - 28 - tabGap * Math.max(0, tabs.length - 1)) / Math.max(1, tabs.length));
      tabs.forEach((tab, index) => {
        const tabX = x + 14 + index * (tabWidth + tabGap);
        this.drawButton(tabX, tabY, tabWidth, 34, tab.label, {
          size: 12,
          bold: tab.isActive,
          active: tab.isActive,
          radius: 8,
        });
        if (Number(tab.badge) > 0) {
          this.drawPanel(tabX + tabWidth - 18, tabY - 5, 20, 18, {
            fill: '#e94560',
            stroke: 'rgba(255, 255, 255, 0.18)',
            radius: 9,
          });
          this.drawText(String(tab.badge), tabX + tabWidth - 8, tabY + 4, {
            size: 9,
            bold: true,
            color: '#fff',
            baseline: 'middle',
            align: 'center',
          });
        }
        this.addHitTarget(
          { x: tabX, y: tabY, width: tabWidth, height: 34 },
          { type: 'switchTaskCenterTab', tab: tab.id },
        );
      });

      const listX = x + 14;
      const listY = tabY + 48;
      const listWidth = panelWidth - 28;
      const listBottom = y + panelHeight - 18;
      const tasks = Array.isArray(view.activeCategory?.tasks) ? view.activeCategory.tasks : [];
      if (!tasks.length) {
        this.drawPanel(listX, listY, listWidth, listBottom - listY, {
          fill: 'rgba(23, 18, 13, 0.38)',
          stroke: 'rgba(255, 226, 177, 0.1)',
          radius: 10,
        });
        this.drawText(view.activeCategory?.emptyText || '暂无任务', listX + listWidth / 2, listY + 72, {
          size: 14,
          color: '#aeb0b8',
          align: 'center',
        });
        return;
      }

      const itemGap = 10;
      const itemHeight = 104;
      tasks.slice(0, 4).forEach((task, index) => {
        const itemY = listY + index * (itemHeight + itemGap);
        if (itemY + itemHeight > listBottom) return;
        const claimable = task.status === 'claimable' && !task.claimed;
        const completed = task.status === 'completed';
        const buttonWidth = 78;
        const buttonHeight = 34;
        const buttonX = listX + listWidth - buttonWidth - 12;
        const buttonY = itemY + itemHeight - buttonHeight - 12;
        const buttonAction = task.action || (
          claimable
            ? { type: 'claimTaskReward', taskId: task.id, category: task.category || view.activeTab }
            : { type: 'goToGuideTaskTarget', taskId: task.id, target: task.target }
        );
        const buttonDisabled = completed || (!claimable && !task.target && buttonAction.type !== 'goToGuideTaskTarget');
        this.drawPanel(listX, itemY, listWidth, itemHeight, {
          fill: completed ? 'rgba(21, 25, 22, 0.66)' : (claimable ? 'rgba(64, 49, 27, 0.82)' : 'rgba(27, 22, 17, 0.74)'),
          stroke: completed ? 'rgba(116, 211, 160, 0.18)' : (claimable ? 'rgba(247, 215, 116, 0.42)' : 'rgba(255, 226, 177, 0.12)'),
          radius: 10,
          inset: 'rgba(255, 231, 184, 0.05)',
        });
        this.drawText(this.truncateText(task.title || '任务', listWidth - 26, { size: 14, bold: true }), listX + 12, itemY + 10, {
          size: 14,
          bold: true,
          color: completed ? '#aec9b8' : '#fff1cf',
        });
        const desc = task.description || task.rewardText || '';
        this.drawTextLines(this.wrapTextLimit(desc, listWidth - 104, 2, { size: 11 }), listX + 12, itemY + 34, {
          size: 11,
          color: completed ? '#8ba494' : '#cbbd96',
          lineHeight: 15,
        });
        this.drawText(this.truncateText(task.rewardText || '无奖励', listWidth - buttonWidth - 34, { size: 12, bold: true }), listX + 12, itemY + 76, {
          size: 12,
          bold: true,
          color: completed ? '#79c79b' : (claimable ? '#ffd98a' : '#74d3a0'),
        });
        this.drawButton(buttonX, buttonY, buttonWidth, buttonHeight, task.actionLabel || (completed ? '已完成' : (claimable ? '领取' : '前往')), {
          disabled: buttonDisabled,
          active: !buttonDisabled,
          size: 12,
          bold: !buttonDisabled,
          radius: 9,
        });
        this.addHitTarget(
          { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight },
          { ...buttonAction, disabled: buttonDisabled },
        );
      });
    }

    renderCitySwitcherMenu(state = {}) {
      if (!this.presenter || typeof this.presenter.buildCitySwitcherViewState !== 'function') return;
      const view = this.presenter.buildCitySwitcherViewState(state);
      if (view.hidden) return;

      const options = Array.isArray(view.options) ? view.options : [];
      const layout = this.getLayout();
      const panelWidth = Math.min(260, layout.contentWidth - 44);
      const x = (this.width - panelWidth) / 2;
      const y = 194;
      const itemHeight = 50;
      const visibleCount = Math.min(options.length, 5);
      const panelHeight = Math.max(56, 18 + visibleCount * itemHeight);

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeCitySwitcher' });
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(45, 32, 21, 0.98)'],
            [1, 'rgba(23, 18, 13, 0.98)'],
          ],
          'rgba(35, 26, 19, 0.98)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 10,
        inset: 'rgba(255, 238, 203, 0.12)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      if (!options.length) {
        this.drawText('暂无城市', x + panelWidth / 2, y + 23, {
          size: 13,
          color: '#cbbd96',
          align: 'center',
        });
        return;
      }

      options.slice(0, visibleCount).forEach((city, index) => {
        const itemX = x + 9;
        const itemY = y + 9 + index * itemHeight;
        const itemWidth = panelWidth - 18;
        const active = Boolean(city.isActive);
        this.drawPanel(itemX, itemY, itemWidth, 43, {
          fill: active
            ? 'rgba(126, 81, 39, 0.92)'
            : 'rgba(45, 34, 24, 0.82)',
          stroke: active
            ? 'rgba(240, 180, 91, 0.6)'
            : 'rgba(255, 226, 177, 0.12)',
          radius: 8,
        });
        if (active) {
          this.drawPanel(itemX, itemY, 4, 43, {
            fill: '#f0b45b',
            stroke: '#f0b45b',
            radius: 2,
          });
        }
        this.drawText(city.name || '未命名城市', itemX + 12, itemY + 8, {
          size: 13,
          bold: true,
          color: '#fff1cf',
        });
        this.drawText(city.tag || '', itemX + itemWidth - 12, itemY + 8, {
          size: 11,
          bold: true,
          color: '#f0b45b',
          align: 'right',
        });
        this.drawText(city.metaText || '', itemX + 12, itemY + 26, {
          size: 11,
          color: 'rgba(234, 234, 234, 0.66)',
        });
        this.addHitTarget(
          { x: itemX, y: itemY, width: itemWidth, height: 43 },
          active || !city.id
            ? { type: 'blockCanvasModal' }
            : { type: 'selectCity', cityId: city.id },
        );
      });
    }

    renderPopulation(state = {}, startY = 84) {
      if (!this.presenter || typeof this.presenter.buildPopulationViewState !== 'function') return startY + 180;
      const view = this.presenter.buildPopulationViewState(state);
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      const y = startY;
      const panelHeight = 304;
      const jobRowHeight = 42;
      const jobRowGap = 8;
      this.drawPanel(x, y, width, panelHeight, {
        fill: this.createGradient(
          x, y, x + width, y + panelHeight,
          [
            [0, 'rgba(61, 43, 28, 0.94)'],
            [1, 'rgba(24, 19, 14, 0.94)'],
          ],
          'rgba(43, 31, 22, 0.94)',
        ),
        stroke: 'rgba(255, 226, 177, 0.18)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.1)',
      });

      this.drawLine(x + 10, y + 6, x + width - 10, y + 6, { color: 'rgba(240, 180, 91, 0.34)', width: 2 });
      this.drawLine(x + 10, y + panelHeight - 6, x + width - 10, y + panelHeight - 6, { color: 'rgba(240, 180, 91, 0.34)', width: 2 });
      this.drawIconCard(x + 14, y + 14, 38, 38, 'assets/art/icon-population-cutout.webp');
      this.drawText(view.text.title || '人才分配', x + 62, y + 20, { size: 15, bold: true, color: '#ffe6b5' });
      this.drawText(view.text.subtitle || '核心岗位', x + 62, y + 40, { size: 11, color: 'rgba(234, 234, 234, 0.58)' });
      const policyButtonWidth = 58;
      const policyButtonHeight = 28;
      const policyButtonX = x + width - policyButtonWidth - 14;
      const policyButtonY = y + 18;
      this.drawButton(policyButtonX, policyButtonY, policyButtonWidth, policyButtonHeight, '方针', {
        size: 12,
        bold: true,
        active: true,
        radius: 8,
      });
      this.addHitTarget(
        { x: policyButtonX, y: policyButtonY, width: policyButtonWidth, height: policyButtonHeight },
        { type: 'openTalentPolicy' },
      );
      this.drawLine(x + 16, y + 56, x + width - 16, y + 56, { color: 'rgba(255, 226, 177, 0.18)', width: 1 });

      const stats = [
        { icon: 'assets/art/icon-population-cutout.webp', label: '人才', value: String(view.text.total), color: '#74d3a0' },
        { icon: 'assets/art/icon-population-cutout.webp', label: '待分配人才', value: String(view.text.unassigned), color: '#74d3a0' },
        { icon: 'assets/art/icon-happiness-cutout.webp', label: '幸福度', value: `${state.happiness || 100}%`, color: '#f9ca24' },
      ];
      const statWidth = Math.floor((width - 28) / 3);
      stats.forEach((stat, index) => {
        const statX = x + 6 + index * statWidth;
        const statY = y + 64;
        this.drawAsset(stat.icon, statX + 8, statY + 7, 18, 18);
        if (index > 0) this.drawLine(statX, statY + 4, statX, statY + 36, { color: 'rgba(255, 226, 177, 0.1)' });
        this.drawText(stat.label, statX + 30, statY + 4, { size: 10, color: 'rgba(234, 234, 234, 0.64)' });
        this.drawText(stat.value, statX + 30, statY + 18, { size: 13, bold: true, color: stat.color });
      });

      const planning = view.planning || {};
      const planningY = y + 106;
      this.drawPanel(x + 7, planningY, width - 14, 42, {
        fill: 'rgba(24, 36, 29, 0.72)',
        stroke: 'rgba(116, 211, 160, 0.16)',
        radius: 8,
        inset: 'rgba(116, 211, 160, 0.05)',
      });
      this.drawText(`地理 ${planning.terrainLabel || '平原'}`, x + 20, planningY + 12, {
        size: 11,
        bold: true,
        color: '#d5ffe8',
      });
      this.drawText(`${planning.text?.habitabilityStatus || '宜居度平稳'} · ${planning.text?.populationGrowthStatus || '人口成长平稳'}`, x + width - 20, planningY + 12, {
        size: 11,
        bold: true,
        color: '#74d3a0',
        align: 'right',
      });
      this.drawText(this.truncateText(planning.text?.note || '保持建筑搭配，会让城市更稳定。', width - 40, { size: 10 }), x + 20, planningY + 27, {
        size: 10,
        color: 'rgba(234, 234, 234, 0.62)',
      });

      const jobs = view.jobs.filter((job) => job.visible);
      jobs.forEach((job, index) => {
        const rowY = y + 156 + index * (jobRowHeight + jobRowGap);
        const jobLabel = { farmer: '农民', scholar: '学者', craftsman: '工匠' }[job.id] || job.id;
        const desc = { farmer: '生产食物', scholar: '口耳相传', craftsman: '钻研技艺' }[job.id] || '';
        const icon = { farmer: 'assets/art/icon-farmer-cutout.webp', scholar: 'assets/art/icon-scholar-cutout.webp', craftsman: 'assets/art/icon-craftsman-cutout.webp' }[job.id];
        const jobPanelX = x + 7;
        const jobPanelRight = x + width - 7;
        const jobPanelInset = 8;
        this.drawPanel(jobPanelX, rowY, width - 14, jobRowHeight, {
          fill: this.createGradient(
            jobPanelX, rowY, jobPanelRight, rowY + jobRowHeight,
            [
              [0, 'rgba(74, 52, 34, 0.86)'],
              [1, 'rgba(28, 22, 16, 0.84)'],
            ],
            'rgba(52, 38, 27, 0.84)',
          ),
          stroke: 'rgba(255, 226, 177, 0.14)',
          radius: 9,
          inset: 'rgba(255, 231, 184, 0.08)',
        });
        this.drawAsset(icon, jobPanelX + jobPanelInset, rowY + 9, 24, 24);
        this.drawText(jobLabel, x + 48, rowY + 8, { size: 13, bold: true, color: '#fff1cf' });
        this.drawText(desc, x + 48, rowY + 26, { size: 10, color: 'rgba(234, 234, 234, 0.58)' });
        const controlGap = 6;
        const controlButtonWidth = 22;
        const countWidth = 40;
        const controlGroupWidth = controlButtonWidth * 2 + countWidth + controlGap * 2;
        const minusX = jobPanelRight - jobPanelInset - controlGroupWidth;
        const countX = minusX + controlButtonWidth + controlGap;
        const plusX = countX + countWidth + controlGap;
        const controlY = rowY + 10;
        this.drawButton(minusX, controlY, controlButtonWidth, 22, '-', { disabled: !job.canDecrease, size: 13, radius: 6 });
        this.drawPanel(countX, rowY + 9, 40, 24, { fill: 'rgba(11, 18, 14, 0.38)', stroke: 'rgba(116, 211, 160, 0.24)', radius: 8, inset: 'rgba(116, 211, 160, 0.08)' });
        this.drawText(job.count, countX + 20, rowY + 21, { size: 14, bold: true, color: '#74d3a0', baseline: 'middle', align: 'center' });
        this.drawButton(plusX, controlY, controlButtonWidth, 22, '+', { disabled: !job.canIncrease, size: 13, radius: 6 });
        this.addHitTarget({ x: minusX, y: controlY, width: controlButtonWidth, height: 22 }, { type: 'assignJob', job: job.id, delta: -1, disabled: !job.canDecrease });
        this.addHitTarget({ x: plusX, y: controlY, width: controlButtonWidth, height: 22 }, { type: 'assignJob', job: job.id, delta: 1, disabled: !job.canIncrease });
      });
      return y + panelHeight + 12;
    }

    renderHomeFeatureGrid(state = {}, startY = 400, options = {}) {
      if (!this.presenter || typeof this.presenter.buildHomeFeatureViewState !== 'function') return startY;
      const view = this.presenter.buildHomeFeatureViewState(state);
      const entries = Array.isArray(view.entries) ? view.entries : [];
      if (!entries.length) return startY;
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      const tabsTop = this.height - 60 - this.bottomSafeArea;
      const maxBottom = Number(options.maxBottom) || tabsTop - 8;
      const y = startY;
      const panelHeight = Math.min(146, Math.max(106, maxBottom - y));
      if (panelHeight < 86) return startY;
      this.drawPanel(x, y, width, panelHeight, {
        fill: this.createGradient(
          x, y, x + width, y + panelHeight,
          [
            [0, 'rgba(44, 35, 25, 0.9)'],
            [1, 'rgba(20, 18, 14, 0.9)'],
          ],
          'rgba(32, 26, 20, 0.9)',
        ),
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.07)',
      });
      this.drawText(view.title || '功能', x + 16, y + 12, { size: 14, bold: true, color: '#ffe6b5' });
      this.drawText(this.truncateText(view.subtitle || '', width - 92, { size: 10 }), x + 16, y + 32, {
        size: 10,
        color: 'rgba(234, 234, 234, 0.58)',
      });

      const top = y + 52;
      const availableHeight = Math.max(42, y + panelHeight - top - 12);
      const visibleEntries = entries.slice(0, 4);
      const gap = 8;
      const itemWidth = Math.floor((width - 28 - gap * (visibleEntries.length - 1)) / Math.max(1, visibleEntries.length));
      const itemHeight = Math.min(76, availableHeight);
      visibleEntries.forEach((entry, index) => {
        const itemX = x + 14 + index * (itemWidth + gap);
        const itemY = top;
        const disabled = Boolean(entry.disabled || entry.action?.disabled);
        const active = Boolean(entry.badge);
        this.drawPanel(itemX, itemY, itemWidth, itemHeight, {
          fill: active ? 'rgba(76, 50, 30, 0.86)' : 'rgba(27, 23, 18, 0.72)',
          stroke: active ? 'rgba(240, 180, 91, 0.48)' : 'rgba(255, 226, 177, 0.12)',
          radius: 8,
          inset: active ? 'rgba(255, 231, 184, 0.1)' : 'rgba(255, 231, 184, 0.04)',
        });
        const previousAlpha = typeof this.ctx?.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
        if (typeof this.ctx?.globalAlpha === 'number') this.ctx.globalAlpha = disabled ? 0.45 : previousAlpha;
        const iconSize = 34;
        this.drawAsset(entry.icon, itemX + itemWidth / 2 - iconSize / 2, itemY + 7, iconSize, iconSize);
        if (typeof this.ctx?.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
        this.drawText(this.truncateText(entry.label || '', itemWidth - 12, { size: 12, bold: true }), itemX + itemWidth / 2, itemY + 44, {
          size: 12,
          bold: true,
          color: disabled ? '#777' : '#fff1cf',
          align: 'center',
        });
        this.drawText(this.truncateText(entry.statusText || '', itemWidth - 10, { size: 9 }), itemX + itemWidth / 2, itemY + 61, {
          size: 9,
          color: disabled ? '#666' : '#aeb0b8',
          align: 'center',
        });
        if (entry.badge > 0) {
          const badgeText = entry.badge > 9 ? '9+' : String(entry.badge);
          this.drawPanel(itemX + itemWidth - 23, itemY + 4, 22, 18, {
            fill: '#e94560',
            stroke: 'rgba(255, 255, 255, 0.16)',
            radius: 9,
          });
          this.drawText(badgeText, itemX + itemWidth - 12, itemY + 13, {
            size: 9,
            bold: true,
            color: '#fff',
            baseline: 'middle',
            align: 'center',
          });
        }
        this.addHitTarget(
          { x: itemX, y: itemY, width: itemWidth, height: itemHeight },
          { ...(entry.action || { type: 'blockCanvasModal' }), disabled },
        );
      });
      return y + panelHeight + 12;
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

    renderArmyFormationEditor(state = {}, options = {}) {
      if (!this.presenter || typeof this.presenter.buildMilitaryViewState !== 'function') return;
      const editor = options.armyFormationEditor || {};
      if (!editor.open) return;
      const view = this.presenter.buildMilitaryViewState(state);
      const slot = Math.max(1, Math.min(3, Number(editor.slot) || 1));
      const formation = (view.formations || []).find((item) => Number(item.slot) === slot)
        || { slot, cityId: view.formationMeta?.cityId || state.activeCityId || 'capital', name: `部队${slot}`, members: [], memberIds: [], maxMembers: 5 };
      const allPeople = Array.isArray(view.formationPeople) ? view.formationPeople : [];
      const memberIds = Array.isArray(editor.memberIds) ? editor.memberIds : formation.memberIds || [];
      const selectedIds = new Set(memberIds);
      const peopleById = new Map(allPeople.map((person) => [person.id, person]));
      const selectedMembers = memberIds.map((personId) => peopleById.get(personId)).filter(Boolean);
      const maxMembers = formation.maxMembers || view.formationMeta?.maxMembers || 5;
      const layout = this.getLayout();
      const panelWidth = Math.min(390, layout.contentWidth - 10);
      const panelHeight = Math.min(570, Math.max(470, this.height - 132));
      const x = Math.floor((this.width - panelWidth) / 2);
      const y = Math.max(54, Math.floor((this.height - panelHeight) / 2));
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeArmyFormationEditor', background: true });
      if (this.ctx) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
        this.ctx.fillRect(0, 0, this.width, this.height);
      }
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(50, 38, 26, 0.99)'],
            [1, 'rgba(20, 18, 14, 0.99)'],
          ],
          'rgba(34, 27, 20, 0.99)',
        ),
        stroke: 'rgba(255, 226, 177, 0.26)',
        radius: 12,
        inset: 'rgba(255, 231, 184, 0.09)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      const closeSize = 28;
      this.drawText(`${formation.name || `部队${slot}`}编队`, x + 18, y + 16, { size: 18, bold: true, color: '#ffe6b5' });
      this.drawText(`已选 ${selectedIds.size}/${maxMembers} · 第一位为主将`, x + 18, y + 43, { size: 12, color: '#cbbd96' });
      this.drawButton(x + panelWidth - closeSize - 10, y + 10, closeSize, closeSize, 'x', { size: 14, radius: 7 });
      this.addHitTarget({ x: x + panelWidth - closeSize - 10, y: y + 10, width: closeSize, height: closeSize }, { type: 'closeArmyFormationEditor' });

      const innerX = x + 14;
      const innerWidth = panelWidth - 28;
      const summaryY = y + 72;
      this.drawPanel(innerX, summaryY, innerWidth, 78, {
        fill: 'rgba(24, 21, 17, 0.64)',
        stroke: 'rgba(240, 180, 91, 0.18)',
        radius: 8,
      });
      const slotSize = 48;
      const slotGap = Math.max(5, Math.min(10, (innerWidth - slotSize * maxMembers - 18) / Math.max(1, maxMembers - 1)));
      const selectedStartX = innerX + 10;
      for (let index = 0; index < maxMembers; index += 1) {
        const member = selectedMembers[index] || null;
        const slotX = selectedStartX + index * (slotSize + slotGap);
        this.renderArmyFormationPortrait(member, slotX, summaryY + 12, slotSize, slotSize, { radius: 5, scale: 1.34 });
        this.drawText(index === 0 ? '主' : '副', slotX + slotSize / 2, summaryY + 67, {
          size: 9,
          color: member ? '#ffe6b5' : 'rgba(255, 230, 181, 0.46)',
          align: 'center',
        });
      }

      const listTop = summaryY + 94;
      this.drawText('名人列表', innerX, listTop, { size: 13, bold: true, color: '#ffe6b5' });
      const pageSize = Math.max(3, Math.min(5, Math.floor((panelHeight - 244) / 58)));
      const pages = Math.max(1, Math.ceil(allPeople.length / pageSize));
      const page = Math.max(0, Math.min(pages - 1, Number(editor.page) || 0));
      const listY = listTop + 22;
      const rowHeight = 54;
      if (!allPeople.length) {
        this.drawPanel(innerX, listY, innerWidth, 88, {
          fill: 'rgba(27, 23, 18, 0.62)',
          stroke: 'rgba(255, 226, 177, 0.1)',
          radius: 8,
        });
        this.drawTextLines(this.wrapTextLimit('暂无可编入的名人。先在名人入口接纳名人后，再回来编队。', innerWidth - 28, 3, { size: 12 }), innerX + 14, listY + 18, {
          size: 12,
          color: '#aeb0b8',
          lineHeight: 18,
        });
      } else {
        allPeople.slice(page * pageSize, page * pageSize + pageSize).forEach((person, index) => {
          const rowY = listY + index * (rowHeight + 6);
          const selected = selectedIds.has(person.id);
          const disabled = !selected && selectedIds.size >= maxMembers;
          this.drawPanel(innerX, rowY, innerWidth, rowHeight, {
            fill: selected ? 'rgba(61, 49, 31, 0.92)' : 'rgba(31, 27, 22, 0.78)',
            stroke: selected ? 'rgba(116, 211, 160, 0.38)' : 'rgba(255, 226, 177, 0.12)',
            radius: 8,
            inset: selected ? 'rgba(116, 211, 160, 0.06)' : 'rgba(255, 231, 184, 0.04)',
          });
          this.renderArmyFormationPortrait(person, innerX + 9, rowY + 7, 40, 40, { radius: 5, scale: 1.34 });
          const nameWidth = innerWidth - 132;
          this.drawText(this.truncateText(person.name || '无名', nameWidth, { size: 13, bold: true }), innerX + 58, rowY + 9, {
            size: 13,
            bold: true,
            color: disabled ? '#8d8f99' : '#fff1cf',
          });
          this.drawText(this.truncateText(`${person.qualityLabel || ''} · ${person.roleText || person.title || ''}`, nameWidth, { size: 10 }), innerX + 58, rowY + 30, {
            size: 10,
            color: disabled ? 'rgba(174, 176, 184, 0.48)' : '#cbbd96',
          });
          this.drawButton(innerX + innerWidth - 64, rowY + 12, 50, 30, selected ? '移除' : '加入', {
            size: 11,
            radius: 7,
            active: selected,
            disabled,
          });
          this.addHitTarget(
            { x: innerX, y: rowY, width: innerWidth, height: rowHeight },
            disabled ? { type: 'blockCanvasModal' } : { type: 'toggleArmyFormationMember', personId: person.id },
          );
        });
      }

      const bottomY = y + panelHeight - 50;
      const pageButtonWidth = 72;
      this.drawButton(innerX, bottomY, pageButtonWidth, 34, '上一页', { size: 11, radius: 8, disabled: page <= 0 });
      this.addHitTarget({ x: innerX, y: bottomY, width: pageButtonWidth, height: 34 }, page <= 0 ? { type: 'blockCanvasModal' } : { type: 'changeArmyFormationPage', delta: -1 });
      this.drawText(`${page + 1}/${pages}`, innerX + pageButtonWidth + 34, bottomY + 17, {
        size: 11,
        color: '#cbbd96',
        align: 'center',
        baseline: 'middle',
      });
      this.drawButton(innerX + pageButtonWidth + 58, bottomY, pageButtonWidth, 34, '下一页', { size: 11, radius: 8, disabled: page >= pages - 1 });
      this.addHitTarget({ x: innerX + pageButtonWidth + 58, y: bottomY, width: pageButtonWidth, height: 34 }, page >= pages - 1 ? { type: 'blockCanvasModal' } : { type: 'changeArmyFormationPage', delta: 1 });
      const saveX = x + panelWidth - 104;
      this.drawButton(saveX, bottomY, 88, 34, '保存', {
        size: 12,
        bold: true,
        radius: 8,
        active: true,
        disabled: Boolean(editor.saving),
      });
      this.addHitTarget({ x: saveX, y: bottomY, width: 88, height: 34 }, editor.saving ? { type: 'blockCanvasModal' } : { type: 'saveArmyFormation' });
    }

    renderBuildings(state = {}, startY = 210, panelHeight = 310, options = {}) {
      if (!this.presenter) return;
      const view = this.presenter.buildBuildingViewState(state, state.tutorial || {}, state.buildingDefinitions || {}, {
        activeCategory: options.activeBuildingCategory || 'all',
      });
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      const panelBottom = startY + panelHeight;
      this.drawPanel(x, startY, width, panelHeight, {
        fill: this.createGradient(
          x, startY, x + width, panelBottom,
          [
            [0, 'rgba(54, 40, 28, 0.94)'],
            [1, 'rgba(24, 19, 14, 0.94)'],
          ],
          'rgba(37, 29, 21, 0.92)',
        ),
        stroke: 'rgba(255, 226, 177, 0.18)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.1)',
      });
      this.drawIconCard(x + 14, startY + 14, 38, 38, 'assets/art/building-house-cutout.png');
      this.drawText('建筑', x + 62, startY + 17, { size: 15, bold: true, color: '#ffe6b5' });
      this.drawText('建造与升级', x + 62, startY + 38, { size: 11, color: 'rgba(234, 234, 234, 0.58)' });
      this.drawLine(x + 16, startY + 60, x + width - 16, startY + 60, { color: 'rgba(255, 226, 177, 0.18)', width: 1 });
      const categoryTabs = Array.isArray(view.categoryTabs) ? view.categoryTabs : [];
      const categoryRowHeight = categoryTabs.length > 1 ? 32 : 0;
      if (categoryRowHeight) {
        this.drawBuildingCategoryTabs(categoryTabs, x + 14, startY + 68, width - 28);
      }
      if (view.isEmpty) {
        this.drawText(view.emptyText, x + width / 2, startY + 104 + categoryRowHeight, { color: '#cbbd96', size: 13, align: 'center' });
        return;
      }
      const rowHeight = 174;
      const rowGap = 8;
      const firstRowY = startY + 76 + categoryRowHeight;
      let visibleCount = Math.max(1, Math.floor((panelBottom - firstRowY - 8) / (rowHeight + rowGap)));
      let offset = Math.max(0, Number(options.offset) || 0);
      let maxOffset = Math.max(0, view.cards.length - visibleCount);
      if (view.cards.length > visibleCount || offset > 0) {
        visibleCount = Math.max(1, Math.floor((panelBottom - firstRowY - 42) / (rowHeight + rowGap)));
        maxOffset = Math.max(0, view.cards.length - visibleCount);
      }
      const pageCount = Math.max(1, Math.ceil(view.cards.length / visibleCount));
      const pageIndex = Math.min(Math.max(0, offset), pageCount - 1);
      offset = pageIndex * visibleCount;
      const visibleCards = view.cards.slice(offset, offset + visibleCount);
      const pendingAction = options.pendingBuildingAction || null;
      const drawCards = (cards, cardOffset = offset) => {
        cards.forEach((card, index) => {
          const y = firstRowY + index * (rowHeight + rowGap);
          const actionType = card.button.action === 'upgrade' ? 'upgrade' : 'build';
          const pendingMatches = Boolean(pendingAction
            && pendingAction.buildingId === card.id
            && pendingAction.action === actionType);
          const pendingActive = Boolean(pendingAction && pendingAction.buildingId);
          const isActionDisabled = Boolean(card.button.disabled || pendingActive);
          const buttonLabel = pendingMatches
            ? (actionType === 'upgrade' ? '升级中' : '建造中')
            : card.button.label;
          const isMuted = Boolean(card.isMuted || card.button.disabled);
          this.drawPanel(x + 10, y, width - 20, rowHeight, {
            fill: isMuted
              ? 'rgba(35, 31, 27, 0.78)'
              : this.createGradient(
                x + 10, y, x + width - 10, y + rowHeight,
                [
                  [0, 'rgba(79, 57, 38, 0.88)'],
                  [1, 'rgba(28, 22, 16, 0.86)'],
                ],
                'rgba(48, 36, 26, 0.86)',
              ),
            stroke: isMuted ? 'rgba(255, 226, 177, 0.1)' : 'rgba(255, 226, 177, 0.16)',
            radius: 8,
            inset: 'rgba(255, 231, 184, 0.07)',
          });
          if (card.art) this.drawAsset(card.art, x + 20, y + 14, 46, 46, isMuted ? 0.62 : 1);
          else this.drawText(card.icon || '', x + 43, y + 37, { size: 24, align: 'center', baseline: 'middle' });

          const textX = x + 76;
          const actionWidth = Math.min(128, Math.max(104, width - 238));
          const buttonX = x + width - actionWidth - 22;
          const textWidth = Math.max(112, buttonX - textX - 12);
          this.drawText(card.name, textX, y + 10, { size: 13, bold: true, color: '#fff1cf' });
          this.drawText(card.metaText || card.levelText, textX, y + 29, { size: 11, color: 'rgba(234, 234, 234, 0.62)' });

          this.drawBuildingInfoLine(card.currentEffectText || '当前效果：无', textX, y + 58, textWidth, { tone: 'current' });
          this.drawBuildingInfoLine(card.nextEffectText || '下一级效果：无', textX, y + 77, x + width - 98, { tone: 'next' });
          this.drawBuildingInfoLine(card.maintenanceText || '维护所需：无', textX, y + 96, x + width - 98, { tone: 'maintenance' });
          this.drawBuildingInfoLine(card.cityImpactText || '城市影响：宜居压力平稳', textX, y + 115, x + width - 98, { tone: 'impact' });

          this.drawBuildingCostChips(card.cost, buttonX, y + 9, actionWidth, 44, {
            muted: isMuted,
            resources: state.resources || {},
          });
          this.drawText(card.costTitle || '升级所需', buttonX, y + 58, {
            size: 10,
            bold: true,
            color: 'rgba(255, 226, 177, 0.68)',
          });
          this.drawBuildingActionButton(buttonX, y + rowHeight - 36, actionWidth, 26, buttonLabel, card.cost, { disabled: isActionDisabled });
          this.addHitTarget(
            { x: buttonX, y: y + rowHeight - 36, width: actionWidth, height: 26 },
            { type: card.button.action === 'upgrade' ? 'upgradeBuilding' : 'buildBuilding', buildingId: card.id, disabled: isActionDisabled },
          );
        });
      };
      const cardsBottom = firstRowY + visibleCount * (rowHeight + rowGap) - rowGap;
      const transition = this.getTransitionFrame(options.buildingTransition);
      if (transition && Number(options.buildingTransition?.toOffset) === pageIndex) {
        const fromPage = Math.min(Math.max(0, Number(options.buildingTransition.fromOffset) || 0), pageCount - 1);
        const fromOffset = fromPage * visibleCount;
        const oldCards = view.cards.slice(fromOffset, fromOffset + visibleCount);
        const travel = width + 24;
        this.withSlideClip(x, firstRowY - 4, width, Math.max(rowHeight, cardsBottom - firstRowY + 8), -transition.direction * travel * transition.eased, () => {
          this.withSuppressedHitTargets(() => drawCards(oldCards, fromOffset));
        });
        this.withSlideClip(x, firstRowY - 4, width, Math.max(rowHeight, cardsBottom - firstRowY + 8), transition.direction * travel * (1 - transition.eased), () => {
          drawCards(visibleCards, offset);
        });
      } else {
        drawCards(visibleCards, offset);
      }
      if (view.cards.length > visibleCount) {
        const pagerY = panelBottom - 32;
        const buttonWidth = 68;
        const gap = 8;
        const prevX = x + width / 2 - buttonWidth - gap - 42;
        const nextX = x + width / 2 + 42 + gap;
        const canPrev = pageIndex > 0;
        const canNext = pageIndex < pageCount - 1;
        const currentPage = pageIndex + 1;
        this.drawButton(prevX, pagerY, buttonWidth, 24, '上一页', { disabled: !canPrev, size: 11, radius: 7 });
        this.drawText(`${currentPage}/${pageCount}`, x + width / 2, pagerY + 12, {
          size: 10,
          color: 'rgba(234, 234, 234, 0.62)',
          baseline: 'middle',
          align: 'center',
        });
        this.drawButton(nextX, pagerY, buttonWidth, 24, '下一页', { disabled: !canNext, size: 11, radius: 7 });
        this.addHitTarget({ x: prevX, y: pagerY, width: buttonWidth, height: 24 }, { type: 'scrollBuildings', delta: -1, disabled: !canPrev });
        this.addHitTarget({ x: nextX, y: pagerY, width: buttonWidth, height: 24 }, { type: 'scrollBuildings', delta: 1, disabled: !canNext });
      }
    }

    drawBuildingCategoryTabs(tabs = [], x, y, width) {
      if (!this.ctx || !Array.isArray(tabs) || tabs.length <= 1) return;
      const gap = 5;
      const height = 26;
      const items = tabs.filter((tab) => tab && tab.id && tab.count > 0);
      if (items.length <= 1) return;
      const rawWidths = items.map((tab) => {
        const label = String(tab.label || tab.id);
        return Math.max(42, this.measureTextWidth(label, { size: 11, bold: Boolean(tab.active) }) + 22);
      });
      const totalGap = gap * Math.max(0, items.length - 1);
      const rawTotal = rawWidths.reduce((sum, value) => sum + value, 0) + totalGap;
      const scale = rawTotal > width ? Math.max(0.72, (width - totalGap) / Math.max(1, rawTotal - totalGap)) : 1;
      let cursorX = x;
      items.forEach((tab, index) => {
        const remainingItems = items.length - index - 1;
        const remainingGap = remainingItems * gap;
        const tabWidth = Math.max(36, Math.floor(rawWidths[index] * scale));
        const actualWidth = Math.max(36, Math.min(tabWidth, x + width - cursorX - remainingGap));
        const active = Boolean(tab.active);
        this.drawButton(cursorX, y, actualWidth, height, this.truncateText(tab.label || tab.id, Math.max(18, actualWidth - 12), {
          size: 11,
          bold: active,
        }), {
          active,
          size: 11,
          bold: active,
          radius: 13,
        });
        this.addHitTarget(
          { x: cursorX, y, width: actualWidth, height },
          { type: 'selectBuildingCategory', category: tab.id, disabled: active },
        );
        cursorX += actualWidth + gap;
      });
    }

    drawBuildingInfoLine(text, x, y, width, options = {}) {
      const palette = {
        current: '#f6e8c8',
        next: '#d5ffe8',
        maintenance: '#cbbd96',
        impact: '#f1c27d',
      };
      const content = this.truncateText(text || '', width, { size: 10, bold: options.tone === 'next' });
      this.drawText(content, x, y, {
        size: 10,
        bold: options.tone === 'next',
        color: palette[options.tone] || '#cbbd96',
      });
    }

    drawBuildingPlanningBadges(badges = [], x, y, width, options = {}) {
      const items = Array.isArray(badges) ? badges.slice(0, 3) : [];
      if (!items.length) return;
      const gap = 4;
      const rowGap = 3;
      const height = 17;
      const maxRows = 2;
      let cursorX = x;
      let cursorY = y;
      let row = 0;
      const palette = {
        maintenance: {
          fill: 'rgba(44, 62, 80, 0.52)',
          stroke: 'rgba(129, 178, 154, 0.24)',
          color: '#b7d4c2',
        },
        pressure: {
          fill: 'rgba(88, 58, 34, 0.52)',
          stroke: 'rgba(240, 180, 91, 0.26)',
          color: '#f1c27d',
        },
        scale: {
          fill: 'rgba(48, 68, 48, 0.5)',
          stroke: 'rgba(116, 211, 160, 0.24)',
          color: '#9ddfb5',
        },
      };
      items.forEach((badge) => {
        const style = palette[badge.type] || palette.maintenance;
        const rawLabel = String(badge.label || '');
        if (!rawLabel) return;
        let available = x + width - cursorX;
        let label = this.truncateText(rawLabel, Math.min(82, available - 12), { size: 9, bold: true });
        let badgeWidth = Math.min(88, Math.max(38, this.measureTextWidth(label, { size: 9, bold: true }) + 12));
        if (badgeWidth > available && row < maxRows - 1) {
          row += 1;
          cursorX = x;
          cursorY += height + rowGap;
          available = width;
          label = this.truncateText(rawLabel, Math.min(82, available - 12), { size: 9, bold: true });
          badgeWidth = Math.min(88, Math.max(38, this.measureTextWidth(label, { size: 9, bold: true }) + 12));
        }
        if (available < 34) return;
        this.drawPanel(cursorX, cursorY, badgeWidth, height, {
          fill: options.muted ? 'rgba(45, 42, 38, 0.46)' : style.fill,
          stroke: options.muted ? 'rgba(255, 226, 177, 0.08)' : style.stroke,
          radius: 6,
        });
        this.drawText(label, cursorX + badgeWidth / 2, cursorY + height / 2, {
          size: 9,
          bold: true,
          color: options.muted ? '#8d8f99' : style.color,
          align: 'center',
          baseline: 'middle',
        });
        cursorX += badgeWidth + gap;
      });
    }

    resourceShortName(resource) {
      return {
        food: '食物',
        wood: '木材',
        iron: '铁矿',
        knowledge: '知识',
        stone: '石料',
        metal: '铁矿',
      }[resource] || resource;
    }

    resourceIconPath(resource) {
      return {
        food: 'assets/art/icon-food-cutout.webp',
        wood: 'assets/art/icon-wood-cutout.webp',
        iron: 'assets/art/icon-iron-cutout.webp',
        knowledge: 'assets/art/icon-knowledge-cutout.webp',
        stone: 'assets/art/icon-stone-cutout.webp',
        metal: 'assets/art/icon-iron-cutout.webp',
        soldier: 'assets/art/icon-soldier-cutout.webp',
      }[resource] || '';
    }

    buildingCostResourceAliases(resource) {
      return resource === 'iron' ? ['iron', 'metal'] : [resource];
    }

    formatBuildingCostAmount(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return String(value ?? 0);
      const sign = number < 0 ? '-' : '';
      const abs = Math.abs(number);
      if (abs < 1000) return String(Math.floor(number));
      const units = [
        { value: 1_000_000_000_000, suffix: 'T' },
        { value: 1_000_000_000, suffix: 'G' },
        { value: 1_000_000, suffix: 'M' },
        { value: 1_000, suffix: 'k' },
      ];
      const unit = units.find((item) => abs >= item.value) || units[units.length - 1];
      const scaled = Math.floor((abs / unit.value) * 10) / 10;
      return `${sign}${String(scaled.toFixed(1)).replace(/\.0$/, '')}${unit.suffix}`;
    }

    getBuildingCostSlot(cost = {}, resource) {
      const aliases = this.buildingCostResourceAliases(resource);
      const parts = Array.isArray(cost?.parts) ? cost.parts : [];
      const matches = parts.filter((part) => aliases.includes(part?.resource));
      if (!matches.length) {
        return { resource, value: 0, text: '0', present: false };
      }
      if (matches.length === 1) {
        const match = matches[0];
        const value = Number(match.value) || 0;
        return {
          resource,
          value,
          text: String(match.text ?? this.formatBuildingCostAmount(value)),
          present: true,
        };
      }
      const total = matches.reduce((sum, part) => sum + (Number(part.value) || 0), 0);
      return {
        resource,
        value: total,
        text: this.formatBuildingCostAmount(total),
        present: total > 0,
      };
    }

    getOwnedBuildingResource(resources = {}, resource) {
      const aliases = this.buildingCostResourceAliases(resource);
      const key = aliases.find((alias) => resources?.[alias] !== undefined);
      return Number(key ? resources[key] : 0) || 0;
    }

    drawBuildingActionButton(x, y, width, height, label, cost = {}, options = {}) {
      const knowledge = this.getBuildingCostSlot(cost, 'knowledge');
      if (cost?.isMax || !knowledge.present || knowledge.value <= 0) {
        this.drawButton(x, y, width, height, label, { disabled: options.disabled, size: 12, radius: 8 });
        return;
      }
      this.drawPanel(x, y, width, height, {
        fill: options.disabled ? 'rgba(60, 52, 46, 0.72)' : 'rgba(50, 35, 22, 0.94)',
        stroke: 'rgba(240, 180, 91, 0.32)',
        radius: 8,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      const amountText = this.truncateText(String(knowledge.text), Math.max(20, width * 0.32), { size: 10, bold: true });
      const amountWidth = this.measureTextWidth(amountText, { size: 10, bold: true });
      const iconSize = 13;
      const gap = 4;
      const labelMaxWidth = Math.max(28, width - amountWidth - iconSize - gap * 2 - 12);
      const labelText = this.truncateText(label, labelMaxWidth, { size: 11, bold: true });
      const labelWidth = this.measureTextWidth(labelText, { size: 11, bold: true });
      const groupWidth = labelWidth + gap + iconSize + 2 + amountWidth;
      const startX = x + Math.max(7, (width - groupWidth) / 2);
      const centerY = y + height / 2;
      const textColor = options.disabled ? '#8d8f99' : '#f6e8c8';
      this.drawText(labelText, startX, centerY, {
        color: textColor,
        size: 11,
        bold: true,
        baseline: 'middle',
      });
      const iconX = startX + labelWidth + gap;
      const iconY = y + (height - iconSize) / 2;
      if (!this.drawAsset(this.resourceIconPath('knowledge'), iconX, iconY, iconSize, iconSize, options.disabled ? 0.52 : 1)) {
        this.drawText('\u77e5', iconX + iconSize / 2, centerY, {
          color: textColor,
          size: 9,
          bold: true,
          align: 'center',
          baseline: 'middle',
        });
      }
      this.drawText(amountText, iconX + iconSize + 2, centerY, {
        color: textColor,
        size: 10,
        bold: true,
        baseline: 'middle',
      });
    }

    drawBuildingCostChips(cost = {}, x, y, width, height, options = {}) {
      if (cost?.isMax) {
        const text = cost?.text || '\u5df2\u6ee1\u7ea7';
        const fill = cost?.isMax ? 'rgba(60, 52, 46, 0.48)' : 'rgba(116, 211, 160, 0.12)';
        const stroke = cost?.isMax ? 'rgba(255, 226, 177, 0.1)' : 'rgba(116, 211, 160, 0.26)';
        this.drawPanel(x, y + 7, width, 24, { fill, stroke, radius: 7 });
        this.drawText(this.truncateText(text, width - 14, { size: 10, bold: true }), x + width / 2, y + 19, {
          size: 10,
          bold: true,
          color: cost?.isMax ? '#a0a0a0' : '#74d3a0',
          align: 'center',
          baseline: 'middle',
        });
        return;
      }

      const gap = 4;
      const chipHeight = 18;
      const chipColumns = 2;
      const chipWidth = Math.floor((width - gap * (chipColumns - 1)) / chipColumns);
      ['wood', 'iron', 'stone', 'food'].forEach((resource, index) => {
        const part = this.getBuildingCostSlot(cost, resource);
        const col = index % chipColumns;
        const row = Math.floor(index / chipColumns);
        const chipX = x + col * (chipWidth + gap);
        const chipY = y + row * (chipHeight + gap);
        const required = Number(part.value) || 0;
        const owned = this.getOwnedBuildingResource(options.resources || {}, resource);
        const insufficient = part.present && required > 0 && owned < required;
        const fill = insufficient
          ? 'rgba(116, 47, 39, 0.58)'
          : (part.present ? 'rgba(40, 48, 34, 0.62)' : 'rgba(50, 44, 36, 0.42)');
        const stroke = insufficient
          ? 'rgba(235, 116, 100, 0.46)'
          : (part.present ? 'rgba(116, 211, 160, 0.24)' : 'rgba(255, 226, 177, 0.12)');
        const textColor = insufficient ? '#ffb0a5' : (part.present ? '#f6e8c8' : '#9a927e');
        this.drawPanel(chipX, chipY, chipWidth, chipHeight, { fill, stroke, radius: 6, inset: 'rgba(255, 255, 255, 0.04)' });
        const iconPath = this.resourceIconPath(resource);
        if (!this.drawAsset(iconPath, chipX + 4, chipY + 3, 12, 12, options.muted || !part.present ? 0.5 : 1)) {
          this.drawText(this.resourceShortName(resource), chipX + 8, chipY + 9, {
            size: 8,
            bold: true,
            color: textColor,
            align: 'center',
            baseline: 'middle',
          });
        }
        const valueText = this.truncateText(String(part.text ?? required), chipWidth - 21, { size: 10, bold: true });
        this.drawText(valueText, chipX + 19, chipY + 9, {
          size: 10,
          bold: true,
          color: textColor,
          baseline: 'middle',
        });
      });
    }

    eventRowColor(tone) {
      return {
        reward: '#74d3a0',
        cost: '#f7d774',
        penalty: '#ff9aa2',
        requirement: '#ffd98a',
        time: '#f7d774',
        neutral: '#cbbd96',
      }[tone] || '#cbbd96';
    }

    drawEventDetailRow(row, x, y, width, options = {}) {
      if (!row) return 0;
      const size = options.size || 11;
      const lineHeight = options.lineHeight || 15;
      const maxLines = options.maxLines || 1;
      const labelWidth = options.labelWidth || 38;
      const label = row.label ? `${row.label}:` : '';
      this.drawText(label, x, y, {
        size,
        bold: true,
        color: this.eventRowColor(row.tone),
      });
      const textX = x + labelWidth;
      const textWidth = Math.max(24, width - labelWidth);
      if (Array.isArray(row.parts) && row.parts.length) {
        this.drawEventParts(row.parts, textX, y - 2, textWidth, { size, lineHeight, color: options.color || '#cbbd96' });
        return lineHeight;
      }
      const lines = this.wrapTextLimit(row.text || '', textWidth, maxLines, { size });
      this.drawTextLines(lines, textX, y, {
        size,
        color: row.empty ? 'rgba(203, 189, 150, 0.58)' : (options.color || '#cbbd96'),
        lineHeight,
      });
      return Math.max(lineHeight, lines.length * lineHeight);
    }

    drawEventParts(parts = [], x, y, width, options = {}) {
      const size = options.size || 10;
      const iconSize = Math.max(11, size + 2);
      const gap = 4;
      let cursorX = x;
      const baselineY = y + iconSize / 2;
      parts.forEach((part, index) => {
        if (cursorX > x + width - 8) return;
        if (index > 0) cursorX += gap + 2;
        if (part.type === 'resource') {
          const iconPath = this.resourceIconPath(part.resource);
          if (iconPath && this.drawAsset(iconPath, cursorX, y, iconSize, iconSize)) {
            cursorX += iconSize + 2;
          } else {
            const fallback = this.resourceShortName(part.resource).slice(0, 1);
            this.drawText(fallback, cursorX + iconSize / 2, baselineY, {
              size: Math.max(8, size - 1),
              bold: true,
              color: options.color || '#cbbd96',
              align: 'center',
              baseline: 'middle',
            });
            cursorX += iconSize + 2;
          }
        }
        const text = this.truncateText(part.text || '', Math.max(12, x + width - cursorX), { size, bold: true });
        this.drawText(text, cursorX, baselineY, {
          size,
          bold: part.type === 'resource',
          color: options.color || '#cbbd96',
          baseline: 'middle',
        });
        cursorX += this.measureTextWidth(text, { size, bold: part.type === 'resource' });
      });
    }

    renderEvents(state = {}, startY = 210, panelHeight = 310) {
      if (!this.presenter) return;
      const view = this.presenter.buildEventViewState(state);
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      this.drawPanel(x, startY, width, panelHeight, {
        fill: 'rgba(37, 29, 21, 0.88)',
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.renderSectionHeader(`待处理事件${view.badge.hidden ? '' : ` ${view.badge.text}`}`, x + 14, startY + 14, '');
      this.drawAsset('assets/art/icon-event-cutout.webp', x + width - 42, startY + 9, 24, 24, 0.9);
      const contentX = x + 12;
      const contentWidth = width - 24;
      const pendingTop = startY + 44;
      const historyTitleY = Math.max(pendingTop + 92, Math.min(startY + panelHeight - 128, pendingTop + 250));
      const cardHeight = 78;
      const cardGap = 8;
      const maxPendingCards = Math.max(1, Math.floor((historyTitleY - pendingTop - 10) / (cardHeight + cardGap)));

      if (view.pending.isEmpty) {
        this.drawPanel(contentX, pendingTop, contentWidth, 54, {
          fill: 'rgba(28, 22, 16, 0.58)',
          stroke: 'rgba(255, 226, 177, 0.1)',
          radius: 8,
        });
        this.drawText(view.pending.emptyText, x + width / 2, pendingTop + 27, {
          color: '#cbbd96',
          size: 13,
          baseline: 'middle',
          align: 'center',
        });
      } else {
        view.pending.cards.slice(0, maxPendingCards).forEach((card, index) => {
          const y = pendingTop + index * (cardHeight + cardGap);
          const isThreat = Boolean(card.classState?.['is-threat']);
          const isSpecial = Boolean(card.classState?.['is-special']);
          this.drawPanel(contentX, y, contentWidth, cardHeight, {
            fill: isThreat ? 'rgba(58, 28, 28, 0.84)' : 'rgba(28, 22, 16, 0.84)',
            stroke: isThreat
              ? 'rgba(233, 69, 96, 0.5)'
              : (isSpecial ? 'rgba(247, 215, 116, 0.48)' : 'rgba(255, 226, 177, 0.12)'),
            radius: 8,
          });
          const iconAsset = card.iconAsset || 'assets/art/icon-event-cutout.webp';
          const iconSize = 34;
          const iconX = contentX + 10;
          const iconY = y + 10;
          this.drawAsset(iconAsset, iconX, iconY, iconSize, iconSize);
          const textX = iconX + iconSize + 9;
          const textWidth = Math.max(120, contentX + contentWidth - textX - 12);
          const title = this.truncateText(card.title, textWidth, { size: 14, bold: true });
          const descriptionLines = this.wrapTextLimit(card.description, textWidth, 2, { size: 11 });
          const hint = this.truncateText(card.hint, textWidth, { size: 11 });
          this.drawText(title, textX, y + 8, { size: 14, bold: true });
          this.drawTextLines(descriptionLines, textX, y + 29, {
            color: '#aeb0b8',
            size: 11,
            lineHeight: 15,
          });
          this.drawText(hint, textX, y + cardHeight - 20, {
            color: isThreat ? '#ff9aa2' : '#f7d774',
            size: 11,
          });
          this.addHitTarget({ x: contentX, y, width: contentWidth, height: cardHeight }, { type: 'openEvent', eventId: card.id });
        });
        if (view.pending.cards.length > maxPendingCards) {
          this.drawText(`还有 ${view.pending.cards.length - maxPendingCards} 个事件`, x + width - 14, historyTitleY - 20, {
            color: 'rgba(234, 234, 234, 0.56)',
            size: 11,
            align: 'right',
          });
        }
      }

      this.drawLine(x + 14, historyTitleY - 8, x + width - 14, historyTitleY - 8, {
        color: 'rgba(240, 180, 91, 0.18)',
      });
      this.renderSectionHeader('最近事件', x + 14, historyTitleY, '');
      if (view.history.isEmpty) {
        this.drawText(view.history.emptyText, x + 14, historyTitleY + 30, { color: '#cbbd96', size: 12 });
      } else {
        const historyTop = historyTitleY + 30;
        const maxHistoryItems = Math.max(1, Math.floor((startY + panelHeight - historyTop - 10) / 38));
        view.history.items.slice(0, maxHistoryItems).forEach((item, index) => {
          const y = historyTop + index * 38;
          const isThreat = item.className === 'threat';
          this.drawPanel(contentX, y, contentWidth, 30, {
            fill: 'rgba(28, 22, 16, 0.58)',
            stroke: isThreat ? 'rgba(233, 69, 96, 0.3)' : 'rgba(116, 211, 160, 0.24)',
            radius: 7,
          });
          this.drawAsset(item.iconAsset || 'assets/art/icon-event-cutout.webp', x + 16, y + 6, 18, 18);
          this.drawText(item.title, x + 48, y + 7, { size: 12, bold: true, color: '#f6e8c8' });
          this.drawText(item.result, x + width - 24, y + 7, {
            size: 11,
            color: isThreat ? '#ff9aa2' : '#74d3a0',
            align: 'right',
          });
        });
      }
    }

    renderEventModal(state = {}, activeEventId = null) {
      if (!this.presenter || !activeEventId) return;
      const eventData = (state.eventQueue || []).find((item) => item.id === activeEventId);
      if (!eventData) return;
      const view = this.presenter.buildEventModalViewState(eventData);
      if (!view.showModal) return;

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeEvent' });
      if (this.ctx) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.46)';
        this.ctx.fillRect(0, 0, this.width, this.height);
      }

      const layout = this.getLayout();
      const panelWidth = Math.min(360, layout.contentWidth - 16);
      const options = view.options.length ? view.options : [{
        id: view.claimButton.optionId,
        label: view.claimButton.label,
        preview: view.text.reward,
        rows: [{ label: '奖励', text: view.text.reward, tone: 'reward' }],
      }];
      const optionCount = Math.max(1, options.length);
      const panelHeight = Math.min(this.height - 96, Math.max(382, 270 + optionCount * 126));
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(48, (this.height - panelHeight) / 2 - 8);
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(54, 39, 26, 0.98)'],
            [1, 'rgba(22, 18, 13, 0.98)'],
          ],
          'rgba(36, 28, 20, 0.98)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 14,
        inset: 'rgba(255, 231, 184, 0.1)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      const closeSize = 28;
      const closeX = x + panelWidth - closeSize - 10;
      const closeY = y + 10;
      this.drawButton(closeX, closeY, closeSize, closeSize, 'x', { size: 14, radius: 7 });
      this.addHitTarget({ x: closeX, y: closeY, width: closeSize, height: closeSize }, { type: 'closeEvent' });

      const descX = x + 18;
      const descWidth = panelWidth - 36;
      const modalIconSize = 30;
      const titleWidth = panelWidth - 112;
      const titleLines = this.wrapTextLimit(view.text.title, titleWidth, 2, { size: 17, bold: true });
      const titleY = y + 22;
      this.drawAsset(view.iconAsset || 'assets/art/icon-event-cutout.webp', descX, y + 17, modalIconSize, modalIconSize);
      this.drawTextLines(titleLines, descX + modalIconSize + 10, titleY, {
        size: 17,
        bold: true,
        color: '#ffe6b5',
        lineHeight: 21,
      });

      const descY = titleY + Math.max(24, titleLines.length * 21) + 10;
      const descHeight = 80;
      const descLines = this.wrapTextLimit(view.text.description, descWidth - 24, 4, { size: 13 });
      this.drawPanel(descX, descY, descWidth, descHeight, {
        fill: 'rgba(23, 18, 13, 0.36)',
        stroke: 'rgba(255, 226, 177, 0.1)',
        radius: 9,
      });
      this.drawTextLines(descLines, descX + 12, descY + 10, {
        size: 13,
        color: '#cbbd96',
        lineHeight: 16,
      });

      const metaRows = Array.isArray(view.metaRows) && view.metaRows.length
        ? view.metaRows
        : [{ label: optionCount > 1 ? '选项' : '奖励', text: view.text.reward, tone: optionCount > 1 ? 'neutral' : 'reward' }];
      const metaY = descY + descHeight + 8;
      const metaHeight = Math.min(54, 12 + metaRows.slice(0, 2).length * 18);
      this.drawPanel(descX, metaY, descWidth, metaHeight, {
        fill: 'rgba(23, 18, 13, 0.48)',
        stroke: 'rgba(255, 226, 177, 0.12)',
        radius: 9,
      });
      metaRows.slice(0, 2).forEach((row, index) => {
        this.drawEventDetailRow(row, descX + 12, metaY + 8 + index * 18, descWidth - 24, {
          size: 11,
          lineHeight: 15,
          labelWidth: 38,
          maxLines: 1,
        });
      });

      const laterY = y + panelHeight - 42;
      const optionTop = metaY + metaHeight + 12;
      const optionGap = 8;
      const optionAreaHeight = Math.max(72, laterY - optionTop - 12);
      const roomyHeight = optionCount >= 4 ? 112 : 126;
      const optionHeight = Math.max(106, Math.min(roomyHeight, Math.floor((optionAreaHeight - (optionCount - 1) * optionGap) / optionCount)));
      const visibleCount = Math.max(1, Math.min(optionCount, Math.floor((optionAreaHeight + optionGap) / (optionHeight + optionGap))));
      options.slice(0, visibleCount).forEach((option, index) => {
        const optionY = optionTop + index * (optionHeight + optionGap);
        this.drawPanel(descX, optionY, descWidth, optionHeight, {
          fill: this.createGradient(
            descX, optionY, descX + descWidth, optionY + optionHeight,
            [
              [0, 'rgba(74, 52, 32, 0.96)'],
              [1, 'rgba(36, 27, 19, 0.96)'],
            ],
            'rgba(58, 42, 28, 0.96)',
          ),
          stroke: 'rgba(247, 215, 116, 0.5)',
          radius: 9,
          inset: 'rgba(255, 231, 184, 0.12)',
        });
        const label = this.truncateText(option.label || '处理事件', descWidth - 24, { size: 13, bold: true });
        this.drawText(label, descX + 12, optionY + 9, {
          size: 13,
          bold: true,
          color: '#f6e8c8',
        });
        const rows = Array.isArray(option.rows) && option.rows.length
          ? option.rows
          : [{ label: '结果', text: option.preview || '', tone: 'neutral' }];
        const maxRows = Math.max(1, Math.floor((optionHeight - 30) / 16));
        rows.slice(0, maxRows).forEach((row, rowIndex) => {
          this.drawEventDetailRow(row, descX + 12, optionY + 30 + rowIndex * 16, descWidth - 24, {
            size: 10,
            lineHeight: 15,
            labelWidth: 36,
            maxLines: rows.length === 1 && maxRows > 1 ? 2 : 1,
          });
        });
        this.addHitTarget({ x: descX, y: optionY, width: descWidth, height: optionHeight }, {
          type: 'claimEvent',
          eventId: eventData.id,
          optionId: option.id,
        });
      });

      if (visibleCount < optionCount) {
        this.drawText(`还有 ${optionCount - visibleCount} 个选项未显示`, descX + descWidth - 2, laterY - 10, {
          size: 10,
          color: 'rgba(234, 234, 234, 0.56)',
          align: 'right',
        });
      }
      this.drawButton(descX, laterY, descWidth, 30, '稍后查看', { size: 12, radius: 8 });
      this.addHitTarget({ x: descX, y: laterY, width: descWidth, height: 30 }, { type: 'closeEvent' });
    }

    renderCivilization(state = {}, startY = 210, panelHeight = 420, options = {}) {
      if (!this.presenter || typeof this.presenter.buildCivilizationViewState !== 'function') return;
      const view = this.presenter.buildCivilizationViewState(
        state,
        options.tutorial || state.tutorial || {},
        { canOpenCivilizationTab: options.canOpenCivilizationTab !== false },
      );
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      const panelBottom = startY + panelHeight;
      const compact = panelHeight < 430;
      const sectionGap = compact ? 8 : 10;
      const overviewX = x + 12;
      const overviewY = startY + 12;
      const overviewWidth = width - 24;
      const overviewHeight = panelHeight < 390 ? 128 : (panelHeight < 500 ? 136 : 148);
      const eraY = overviewY + overviewHeight + sectionGap;
      const innerBottom = panelBottom - 12;
      const availableAfterOverview = Math.max(0, innerBottom - eraY);
      const minEraHeight = compact ? 188 : 214;
      const canShowFeature = availableAfterOverview >= minEraHeight + sectionGap + 64;
      const eraHeight = canShowFeature
        ? Math.min(compact ? 244 : 300, Math.max(minEraHeight, Math.floor((availableAfterOverview - sectionGap) * 0.72)))
        : Math.max(168, availableAfterOverview);
      const featureY = eraY + eraHeight + sectionGap;
      const featureHeight = canShowFeature ? Math.max(58, innerBottom - featureY) : 0;

      this.drawPanel(x, startY, width, panelHeight, {
        fill: 'rgba(37, 29, 21, 0.88)',
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.08)',
      });

      this.drawPanel(overviewX, overviewY, overviewWidth, overviewHeight, {
        fill: this.createGradient(
          overviewX, overviewY, overviewX, overviewY + overviewHeight,
          [
            [0, 'rgba(54, 40, 28, 0.92)'],
            [1, 'rgba(28, 22, 17, 0.9)'],
          ],
          'rgba(44, 32, 23, 0.9)',
        ),
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.drawAsset('assets/art/icon-fire-cutout.webp', overviewX + 12, overviewY + 12, 32, 32);
      this.drawText(view.text.eraName, overviewX + 50, overviewY + 19, { size: 16, bold: true, color: '#f0b45b' });
      this.drawText(view.text.civOverviewDay, overviewX + overviewWidth - 12, overviewY + 20, {
        size: 12,
        color: '#a0a0a0',
        align: 'right',
      });
      this.drawLine(overviewX + 12, overviewY + 54, overviewX + overviewWidth - 12, overviewY + 54, {
        color: 'rgba(255, 226, 177, 0.14)',
      });

      const stats = [
        { label: '人口', value: view.text.civOverviewPop, icon: 'assets/art/icon-population-cutout.webp' },
        { label: '建筑', value: view.text.civOverviewBuildings, icon: 'assets/art/building-house-cutout.png' },
        { label: '科技', value: view.text.civOverviewTechs, icon: 'assets/art/icon-science-cutout.webp' },
        { label: '幸福度', value: view.text.civOverviewHappiness, icon: 'assets/art/icon-happiness-cutout.webp' },
      ];
      const compactOverview = overviewHeight < 140;
      const statGap = 8;
      const statLeft = overviewX + 12;
      const statRight = overviewX + overviewWidth - 12;
      const statWidth = Math.floor((statRight - statLeft - statGap) / 2);
      const statTop = overviewY + (compactOverview ? 58 : 62);
      const statBottom = overviewY + overviewHeight - 8;
      const statRowGap = compactOverview ? 5 : 7;
      const statHeight = Math.floor((statBottom - statTop - statRowGap) / 2);
      const statIconSize = compactOverview ? 20 : 26;
      stats.forEach((item, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const statX = col === 0 ? statLeft : statRight - statWidth;
        const statY = row === 0 ? statTop : statBottom - statHeight;
        this.drawPanel(statX, statY, statWidth, statHeight, {
          fill: 'rgba(63, 47, 32, 0.82)',
          stroke: 'rgba(255, 226, 177, 0.1)',
          radius: 8,
        });
        this.drawAsset(item.icon, statX + 8, statY + (statHeight - statIconSize) / 2, statIconSize, statIconSize);
        this.drawText(item.label, statX + 34, statY + (compactOverview ? 3 : 6), { size: compactOverview ? 9 : 10, color: '#a0a0a0' });
        this.drawText(String(item.value), statX + 34, statY + (compactOverview ? 16 : 21), { size: compactOverview ? 12 : 14, bold: true, color: '#74d3a0' });
      });

      const eraX = x + 12;
      const eraWidth = width - 24;
      this.drawPanel(eraX, eraY, eraWidth, eraHeight, {
        fill: this.createGradient(
          eraX, eraY, eraX, eraY + eraHeight,
          [
            [0, 'rgba(54, 40, 28, 0.92)'],
            [1, 'rgba(28, 22, 17, 0.9)'],
          ],
          'rgba(44, 32, 23, 0.9)',
        ),
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.renderSectionHeader('时代进阶', eraX + 12, eraY + 14, '🔥');
      this.drawAsset('assets/art/icon-food-cutout.webp', eraX + eraWidth / 2 - 42, eraY + 40, 38, 38);
      this.drawText(this.truncateText(view.text.eraTargetName, eraWidth - 112, { size: 15, bold: true }), eraX + eraWidth / 2 + 4, eraY + 59, {
        size: 15,
        bold: true,
        color: '#f6e8c8',
        baseline: 'middle',
      });
      this.drawProgressBar(eraX + 12, eraY + 84, eraWidth - 24, 10, view.progress.percentage);
      this.drawText(this.truncateText(view.text.eraProgressText, eraWidth - 32, { size: 11 }), eraX + eraWidth / 2, eraY + 102, {
        size: 11,
        color: '#a0a0a0',
        align: 'center',
      });

      const conditions = view.conditions || [];
      const buttonY = eraY + eraHeight - 42;
      const conditionTop = eraY + 114;
      const conditionRowHeight = 22;
      const conditionRowGap = 5;
      const conditionRows = Math.max(
        0,
        Math.floor((buttonY - conditionTop - conditionRowHeight - 2) / (conditionRowHeight + conditionRowGap)) + 1,
      );
      const conditionWidth = Math.floor((eraWidth - 32) / 2);
      conditions.slice(0, Math.min(4, conditionRows * 2)).forEach((condition, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const itemX = eraX + 12 + col * (conditionWidth + 8);
        const itemY = conditionTop + row * (conditionRowHeight + conditionRowGap);
        this.drawPanel(itemX, itemY, conditionWidth, conditionRowHeight, {
          fill: 'rgba(63, 47, 32, 0.62)',
          stroke: condition.met ? 'rgba(78, 204, 163, 0.3)' : 'rgba(233, 69, 96, 0.15)',
          radius: 7,
        });
        this.drawText(condition.met ? '✓' : '•', itemX + 9, itemY + 11, {
          size: 12,
          bold: true,
          color: condition.met ? '#4ecca3' : '#d6b16e',
          baseline: 'middle',
        });
        this.drawText(this.truncateText(condition.name, conditionWidth - 52, { size: 11, bold: true }), itemX + 24, itemY + 6, {
          size: 11,
          bold: true,
          color: '#f6e8c8',
        });
        this.drawText(condition.progressText, itemX + conditionWidth - 8, itemY + 6, {
          size: 10,
          color: condition.met ? '#4ecca3' : '#a0a0a0',
          align: 'right',
        });
      });

      const advanceLabel = this.truncateText(view.text.advanceLabel, eraWidth - 52, { size: 13, bold: true });
      this.drawButton(eraX + 12, buttonY, eraWidth - 24, 32, advanceLabel, {
        disabled: view.advanceButton.disabled,
        bold: true,
        radius: 8,
        active: !view.advanceButton.disabled,
      });
      this.addHitTarget(
        { x: eraX + 12, y: buttonY, width: eraWidth - 24, height: 32 },
        { type: 'advanceEra', disabled: view.advanceButton.disabled },
      );

      if (featureHeight > 0) {
        this.drawPanel(x + 12, featureY, width - 24, featureHeight, {
          fill: 'rgba(37, 29, 21, 0.82)',
          stroke: 'rgba(255, 226, 177, 0.12)',
          radius: 10,
        });
        this.renderSectionHeader('当前时代特性', x + 26, featureY + 14, '✓');
        const featureLineLimit = Math.max(1, Math.floor((featureHeight - 44) / 18));
        const featureLines = this.wrapTextLimit(view.text.featureDescription, width - 58, featureLineLimit, { size: 12 });
        this.drawTextLines(featureLines, x + 26, featureY + 44, {
          size: 12,
          color: '#f6e8c8',
          lineHeight: 18,
        });
      }
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

    renderMilitarySubTabs(nav = {}, x, y, width) {
      const labels = { army: '军队', scout: '侦察', world: '世界' };
      const tabs = nav.views || [];
      const gap = 6;
      const tabWidth = (width - gap * Math.max(0, tabs.length - 1)) / Math.max(1, tabs.length);
      tabs.forEach((tab, index) => {
        const tabX = x + index * (tabWidth + gap);
        this.drawButton(tabX, y, tabWidth, 34, labels[tab.id] || tab.id, {
          size: 12,
          bold: true,
          radius: 9,
          disabled: tab.disabled,
          active: tab.isActive,
        });
        this.addHitTarget({ x: tabX, y, width: tabWidth, height: 34 }, {
          type: 'switchMilitaryView',
          view: tab.id,
          disabled: tab.disabled,
        });
      });
      return y + 46;
    }

    renderMilitaryArmyView(view = {}, x, y, width, height) {
      const formations = Array.isArray(view.formations) ? view.formations : [];
      const hasFormationSpace = height >= 250;
      const formationHeight = hasFormationSpace ? Math.min(158, Math.max(132, Math.floor(height * 0.43))) : 0;
      const cardHeight = Math.min(150, Math.max(104, height - formationHeight - (hasFormationSpace ? 30 : 18)));
      this.drawPanel(x, y, width, cardHeight, {
        fill: 'rgba(28, 22, 17, 0.78)',
        stroke: 'rgba(255, 226, 177, 0.12)',
        radius: 10,
      });
      this.drawAsset('assets/art/icon-soldier-cutout.webp', x + 16, y + 24, 58, 72);
      const textX = x + 88;
      this.drawText('军队状态', textX, y + 16, { size: 14, bold: true, color: '#f6e8c8' });
      this.drawText(`士兵 ${view.text?.soldierCount || '0/0'}`, textX, y + 42, { size: 18, bold: true, color: '#74d3a0' });
      this.drawText(`防御 ${view.text?.militaryDefense ?? 0}`, textX, y + 68, { size: 12, color: '#cbbd96' });
      this.drawText(`可用 ${view.text?.availableSoldierCount ?? 0} · 出征中 ${view.text?.soldiersOnMission ?? 0}`, textX, y + 88, {
        size: 12,
        color: '#aeb0b8',
      });
      const progressY = y + cardHeight - 38;
      this.drawText(view.text?.soldierTrainingText || '等待兵营', x + 16, progressY - 18, { size: 12, color: '#cbbd96' });
      this.drawProgressBar(x + 16, progressY, width - 32, 12, parseFloat(view.training?.progressWidth || '0'));
      if (!hasFormationSpace) return;
      this.renderArmyFormationStrip(
        formations,
        x,
        y + cardHeight + 12,
        width,
        formationHeight,
        view.formationMeta || {},
      );
    }

    renderArmyFormationPortrait(person = null, x, y, width, height, options = {}) {
      const radius = options.radius ?? 6;
      if (person) {
        const drawn = this.drawFamousPortrait(person, x, y, Math.min(width, height), {
          frameWidth: width,
          frameHeight: height,
          radius,
          scale: options.scale || 1.35,
          offsetY: options.offsetY ?? 0.16,
          fill: options.fill || 'rgba(70, 49, 33, 0.92)',
          stroke: options.stroke || 'rgba(240, 180, 91, 0.34)',
        });
        if (!drawn) {
          this.drawPanel(x, y, width, height, {
            fill: 'rgba(70, 49, 33, 0.92)',
            stroke: 'rgba(240, 180, 91, 0.34)',
            radius,
          });
          this.drawText(String(person.name || '将').slice(0, 1), x + width / 2, y + height / 2, {
            size: Math.max(13, Math.min(20, width * 0.44)),
            bold: true,
            color: '#ffe6b5',
            align: 'center',
            baseline: 'middle',
          });
        }
        return;
      }
      this.drawPanel(x, y, width, height, {
        fill: options.fill || 'rgba(22, 20, 17, 0.58)',
        stroke: options.stroke || 'rgba(255, 226, 177, 0.13)',
        radius,
      });
      this.drawText('+', x + width / 2, y + height / 2 - 1, {
        size: Math.max(12, Math.min(18, width * 0.45)),
        color: 'rgba(255, 230, 181, 0.58)',
        align: 'center',
        baseline: 'middle',
      });
    }

    renderArmyFormationCard(formation = {}, x, y, width, height, index = 0) {
      const members = Array.isArray(formation.members) ? formation.members : [];
      const leader = members[0] || null;
      const active = members.length > 0;
      this.drawPanel(x, y, width, height, {
        fill: active ? 'rgba(55, 40, 29, 0.92)' : 'rgba(38, 33, 28, 0.86)',
        stroke: active ? 'rgba(240, 180, 91, 0.34)' : 'rgba(255, 226, 177, 0.14)',
        radius: 7,
        inset: active ? 'rgba(255, 231, 184, 0.08)' : 'rgba(255, 231, 184, 0.04)',
      });
      const title = formation.name || `部队${index + 1}`;
      this.drawText(this.truncateText(title, width - 16, { size: 12, bold: true }), x + width / 2, y + 9, {
        size: 12,
        bold: true,
        color: '#fff1cf',
        align: 'center',
      });
      const innerPad = 8;
      const leaderSize = Math.min(58, Math.max(34, Math.min(height - 66, width * 0.4)));
      const leaderX = x + innerPad;
      const leaderY = y + 28;
      this.renderArmyFormationPortrait(leader, leaderX, leaderY, leaderSize, leaderSize, { radius: 5, scale: 1.42 });
      if (leader) {
        this.drawText(this.truncateText(leader.name || '主将', leaderSize + 10, { size: 9, bold: true }), leaderX + leaderSize / 2, leaderY + leaderSize + 10, {
          size: 9,
          bold: true,
          color: '#ffe6b5',
          align: 'center',
        });
      } else {
        this.drawText('主将', leaderX + leaderSize / 2, leaderY + leaderSize + 10, {
          size: 9,
          color: 'rgba(255, 230, 181, 0.58)',
          align: 'center',
        });
      }
      const smallGap = 3;
      const smallAreaWidth = Math.max(24, width - leaderSize - innerPad * 3);
      const smallSize = Math.max(18, Math.min(32, Math.floor((smallAreaWidth - smallGap) / 2)));
      const smallStartX = x + width - innerPad - smallSize * 2 - smallGap;
      const smallStartY = leaderY + 2;
      [0, 1, 2, 3].forEach((smallIndex) => {
        const col = smallIndex % 2;
        const row = Math.floor(smallIndex / 2);
        this.renderArmyFormationPortrait(
          members[smallIndex + 1] || null,
          smallStartX + col * (smallSize + smallGap),
          smallStartY + row * (smallSize + smallGap),
          smallSize,
          smallSize,
          { radius: 4, scale: 1.32 },
        );
      });
      const countText = `${members.length}/${formation.maxMembers || 5}`;
      this.drawText(countText, x + width - 10, y + height - 24, {
        size: 10,
        bold: true,
        color: active ? '#74d3a0' : '#cbbd96',
        align: 'right',
      });
      this.drawText(active ? '点击调整' : '点击编制', x + width / 2, y + height - 24, {
        size: 10,
        color: active ? '#f0b45b' : 'rgba(234, 234, 234, 0.64)',
        align: 'center',
      });
      this.addHitTarget(
        { x, y, width, height },
        { type: 'openArmyFormation', cityId: formation.cityId, slot: formation.slot || index + 1 },
      );
    }

    renderArmyFormationStrip(formations = [], x, y, width, height, meta = {}) {
      this.drawText('编队', x + 2, y + 2, { size: 14, bold: true, color: '#ffe6b5' });
      this.drawText(meta.summary || '3 支部队 · 每队最多 5 名名人', x + 48, y + 4, { size: 10, color: '#cbbd96' });
      const cardGap = 8;
      const cardY = y + 24;
      const cardHeight = Math.max(108, height - 26);
      const cardWidth = Math.floor((width - cardGap * 2) / 3);
      [0, 1, 2].forEach((index) => {
        const cardX = x + index * (cardWidth + cardGap);
        const finalCardWidth = index === 2 ? x + width - cardX : cardWidth;
        this.renderArmyFormationCard(
          formations[index] || { slot: index + 1, cityId: meta.cityId, name: `部队${index + 1}`, members: [], maxMembers: meta.maxMembers || 5 },
          cardX,
          cardY,
          finalCardWidth,
          cardHeight,
          index,
        );
      });
    }

    getScoutButtonTone(cell = {}) {
      if (cell.status === 'ready') return { fill: 'rgba(40, 84, 62, 0.72)', stroke: 'rgba(116, 211, 160, 0.42)' };
      if (cell.status === 'active') return { fill: 'rgba(75, 58, 37, 0.66)', stroke: 'rgba(240, 180, 91, 0.28)' };
      if (cell.status === 'locked') return { fill: 'rgba(42, 40, 39, 0.62)', stroke: 'rgba(255, 255, 255, 0.08)' };
      return { fill: 'rgba(63, 47, 32, 0.78)', stroke: 'rgba(240, 180, 91, 0.25)' };
    }

    renderMilitaryScoutView(scout = {}, x, y, width, height) {
      this.drawPanel(x, y, width, height, {
        fill: 'rgba(28, 22, 17, 0.78)',
        stroke: 'rgba(255, 226, 177, 0.12)',
        radius: 10,
      });
      const statusLines = this.wrapTextLimit(scout.statusText || '', width - 28, 2, { size: 12 });
      this.drawTextLines(statusLines, x + 14, y + 14, { size: 12, color: '#cbbd96', lineHeight: 16 });

      const gridTop = y + 56;
      const reportReserve = Math.min(126, Math.max(86, height * 0.26));
      const gridSize = Math.min(width - 28, Math.max(190, Math.min(height - 82 - reportReserve, 286)));
      const gridX = x + (width - gridSize) / 2;
      this.drawPanel(gridX, gridTop, gridSize, gridSize, {
        fill: 'rgba(18, 16, 13, 0.38)',
        stroke: 'rgba(240, 180, 91, 0.16)',
        radius: 18,
      });
      const order = ['nw', 'n', 'ne', 'w', 'center', 'e', 'sw', 's', 'se'];
      const cellsById = new Map((scout.cells || []).map((cell) => [cell.id || cell.type, cell]));
      const cellGap = 7;
      const cellSize = (gridSize - 28 - cellGap * 2) / 3;
      order.forEach((id, index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const cellX = gridX + 14 + col * (cellSize + cellGap);
        const cellY = gridTop + 14 + row * (cellSize + cellGap);
        const cell = id === 'center'
          ? { type: 'center', label: '城', subLabel: '本城' }
          : cellsById.get(id);
        if (!cell) return;
        if (cell.type === 'center') {
          this.drawPanel(cellX, cellY, cellSize, cellSize, {
            fill: 'rgba(75, 49, 25, 0.82)',
            stroke: 'rgba(240, 180, 91, 0.38)',
            radius: Math.min(22, cellSize / 2),
            inset: 'rgba(255, 231, 184, 0.12)',
          });
          this.drawText(cell.label || '城', cellX + cellSize / 2, cellY + cellSize / 2 - 7, {
            size: 18,
            bold: true,
            color: '#f0b45b',
            baseline: 'middle',
            align: 'center',
          });
          this.drawText(cell.subLabel || '本城', cellX + cellSize / 2, cellY + cellSize / 2 + 14, {
            size: 10,
            color: '#a0a0a0',
            baseline: 'middle',
            align: 'center',
          });
          return;
        }
        const tone = this.getScoutButtonTone(cell);
        this.drawPanel(cellX, cellY, cellSize, cellSize, {
          fill: tone.fill,
          stroke: tone.stroke,
          radius: 12,
          inset: 'rgba(255, 231, 184, 0.05)',
        });
        this.drawText(cell.label, cellX + cellSize / 2, cellY + cellSize / 2 - 8, {
          size: 13,
          bold: true,
          color: '#f6e8c8',
          baseline: 'middle',
          align: 'center',
        });
        this.drawText(cell.actionText, cellX + cellSize / 2, cellY + cellSize / 2 + 12, {
          size: 10,
          color: cell.status === 'ready' ? '#74d3a0' : '#aeb0b8',
          baseline: 'middle',
          align: 'center',
        });
        this.addHitTarget({ x: cellX, y: cellY, width: cellSize, height: cellSize }, {
          type: cell.action === 'claim' ? 'claimScout' : 'scoutTerritory',
          value: cell.actionValue,
          direction: cell.action === 'scout' ? cell.actionValue : undefined,
          missionId: cell.action === 'claim' ? cell.actionValue : undefined,
          disabled: cell.disabled || !cell.action,
        });
      });

      const reportsY = gridTop + gridSize + 18;
      if (reportsY < y + height - 42) {
        this.renderWorldReports(scout.reports || scout.scoutReports || [], x + 14, reportsY, width - 28, y + height - reportsY - 10);
      }
    }

    renderWorldReports(reports = [], x, y, width, maxHeight) {
      this.drawText('侦察报告', x, y, { size: 13, bold: true, color: '#f6e8c8' });
      if (!reports.length) {
        this.drawTextLines(this.wrapTextLimit('暂无侦察报告。派出侦察队后，外部世界会从这里开始显现。', width, 2, { size: 11 }), x, y + 24, {
          size: 11,
          color: '#aeb0b8',
          lineHeight: 15,
        });
        return;
      }
      let cursorY = y + 24;
      reports.slice().reverse().slice(0, Math.max(1, Math.floor(maxHeight / 54))).forEach((report) => {
        this.drawPanel(x, cursorY, width, 48, {
          fill: 'rgba(0, 0, 0, 0.16)',
          stroke: 'rgba(240, 180, 91, 0.18)',
          radius: 9,
        });
        this.drawText(this.truncateText(report.title || '侦察报告', width - 20, { size: 12, bold: true }), x + 10, cursorY + 8, {
          size: 12,
          bold: true,
          color: '#f6e8c8',
        });
        this.drawText(this.truncateText(report.text || '', width - 20, { size: 11 }), x + 10, cursorY + 27, {
          size: 11,
          color: '#aeb0b8',
        });
        cursorY += 56;
      });
    }

    getWorldTileScreenCenter(tile = {}, viewport = {}, geometry = {}) {
      const helper = this.constructor.getTileMapGeometry();
      if (helper?.getTileScreenCenter) return helper.getTileScreenCenter(tile, viewport, geometry);
      const stepX = Number(geometry.stepX) || 96;
      const stepY = Number(geometry.stepY) || 48;
      const q = Number(tile.q) || 0;
      const r = Number(tile.r) || 0;
      return {
        x: viewport.originX + viewport.panX + (q - r) * stepX * viewport.scale,
        y: viewport.originY + viewport.panY + (q + r) * stepY * viewport.scale,
      };
    }

    getWorldTileDrawRect(center = {}, scale = 1, geometry = {}) {
      const helper = this.constructor.getTileMapGeometry();
      if (helper?.getTileDrawRect) return helper.getTileDrawRect(center, scale, geometry);
      const tileWidth = (Number(geometry.tileWidth) || 192) + 3;
      const tileHeight = (Number(geometry.tileHeight) || 96) + 1.5;
      const anchorY = Number.isFinite(Number(geometry.anchorY)) ? Number(geometry.anchorY) : 0.5;
      return {
        x: center.x - tileWidth * scale * 0.5,
        y: center.y - tileHeight * scale * anchorY,
        width: tileWidth * scale,
        height: tileHeight * scale,
      };
    }

    drawIsoDiamond(cx, cy, width, height, options = {}) {
      if (!this.ctx) return;
      this.ctx.fillStyle = options.fill || 'rgba(71, 97, 67, 0.72)';
      this.ctx.strokeStyle = options.stroke || 'rgba(255, 226, 177, 0.14)';
      this.ctx.lineWidth = options.width || 1;
      this.ctx.beginPath();
      this.ctx.moveTo(cx, cy - height * 0.5);
      this.ctx.lineTo(cx + width * 0.5, cy);
      this.ctx.lineTo(cx, cy + height * 0.5);
      this.ctx.lineTo(cx - width * 0.5, cy);
      if (typeof this.ctx.closePath === 'function') this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
    }

    getFallbackTerrainFill(terrain = 'plains') {
      const fills = {
        capital: 'rgba(98, 124, 76, 0.94)',
        plains: 'rgba(90, 122, 70, 0.9)',
        forest: 'rgba(45, 91, 63, 0.94)',
        hills: 'rgba(126, 114, 75, 0.92)',
        mountain: 'rgba(104, 104, 96, 0.94)',
        waste: 'rgba(112, 96, 78, 0.9)',
        desert: 'rgba(165, 132, 78, 0.9)',
        river: 'rgba(54, 116, 139, 0.92)',
        ocean: 'rgba(35, 87, 120, 0.94)',
      };
      return fills[terrain] || fills.plains;
    }

    hashString(input) {
      let hash = 2166136261;
      const text = String(input);
      for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return hash >>> 0;
    }

    random01(seed, q, r, salt) {
      return this.hashString(`${seed || 'scout-tile-v1'}|${q}|${r}|${salt}`) / 4294967295;
    }

    getWorldOverlayAnchor(tile = {}, viewport = {}, geometry = {}, targetKey = '', explicitOffset = null, centerOverride = null) {
      const manifest = this.constructor.getTileMapAssetManifest();
      const center = centerOverride || this.getWorldTileScreenCenter(tile, viewport, geometry);
      const offset = explicitOffset || manifest.getOverlayOffset?.(targetKey) || { x: 0, y: 0 };
      const scale = Number(viewport.scale) || 1;
      return {
        x: center.x + (Number(offset.x) || 0) * scale,
        y: center.y + (Number(offset.y) || 0) * scale,
      };
    }

    getWorldTileImageAspect(assetPath = '') {
      const metrics = this.analyzeAssetAlphaBounds(assetPath);
      return (metrics?.height || 1) / Math.max(1, metrics?.width || 1);
    }

    drawWorldOverlayShadow(baseX, baseY, drawW, drawH, profile = {}) {
      if (!this.ctx?.beginPath || !this.ctx?.ellipse || !this.ctx?.fill) return;
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      const previousFill = this.ctx.fillStyle;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = Number(profile.alpha) || 0.34;
      this.ctx.fillStyle = profile.fill || 'rgba(4, 6, 5, 0.62)';
      this.ctx.beginPath();
      this.ctx.ellipse(
        baseX,
        baseY + drawH * (Number(profile.yRatio) || 0.03),
        drawW * (Number(profile.rx) || 0.36),
        drawH * (Number(profile.ry) || 0.12),
        0,
        0,
        Math.PI * 2,
      );
      this.ctx.fill();
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      this.ctx.fillStyle = previousFill;
    }

    drawWorldOverlayAsset(assetPath = '', metrics, x, y, width, height, alpha = 1) {
      const image = this.getAsset(assetPath);
      if (!image || !metrics || typeof this.ctx.drawImage !== 'function') return false;
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = alpha;
      this.ctx.drawImage(image, metrics.x, metrics.y, metrics.width, metrics.height, x, y, width, height);
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      return true;
    }

    drawWorldTerrainFeature(tile = {}, viewport = {}, geometry = {}, tileWidth = 192, tileHeight = 96) {
      const manifest = this.constructor.getTileMapAssetManifest();
      const terrainAsset = manifest.getTerrainAsset?.(tile.terrain) || manifest.terrain?.[tile.terrain] || null;
      const assetPath = terrainAsset?.sourceTerrainPath || terrainAsset?.path || '';
      if (!assetPath || tile.feature?.asset || ['plains', 'capital', 'river', 'desert', 'ocean'].includes(tile.terrain)) return false;
      const profileByTerrain = {
        hills: { chance: 0.42, scale: 0.5, alpha: 0.66, lift: 0.08, squash: 0.68 },
        waste: { chance: 0.32, scale: 0.48, alpha: 0.58, lift: 0.06, squash: 0.7 },
      };
      const profile = profileByTerrain[tile.terrain];
      if (!profile) return false;
      const seed = viewport.seed || 'scout-tile-v1';
      const q = Number(tile.q) || 0;
      const r = Number(tile.r) || 0;
      if (this.random01(seed, q, r, 'terrain-feature-visible') > profile.chance) return false;
      const image = this.getAsset(assetPath);
      if (!image || typeof this.ctx.drawImage !== 'function') return false;
      const targetKey = terrainAsset.overlayKey || `terrain:${tile.terrain}`;
      const anchor = this.getWorldOverlayAnchor(tile, viewport, geometry, targetKey, null);
      const scale = Number(viewport.scale) || 1;
      const size = Math.max(tileWidth, tileHeight);
      const jitterX = (this.random01(seed, q, r, 'terrain-feature-x') - 0.5) * (Number(geometry.stepX) || 96) * scale * 0.34;
      const jitterY = (this.random01(seed, q, r, 'terrain-feature-y') - 0.5) * (Number(geometry.stepY) || 48) * scale * 0.46;
      const drawW = size * profile.scale;
      const drawH = drawW * profile.squash;
      const drawX = anchor.x - drawW * 0.5 + jitterX;
      const drawY = anchor.y - size * profile.lift - drawH * 0.5 + jitterY;
      const sourceWidth = Number(image.naturalWidth || image.width || 1);
      const sourceHeight = Number(image.naturalHeight || image.height || 1);
      const sourceSize = Math.min(sourceWidth, sourceHeight);
      const sourceW = Math.floor(sourceSize * 0.36);
      const sourceH = Math.floor(sourceSize * 0.26);
      const sourceX = Math.floor(sourceWidth * 0.5 - sourceW * 0.5);
      const sourceY = Math.floor(sourceHeight * 0.52 - sourceH * 0.5);
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = profile.alpha;
      this.ctx.save?.();
      this.ctx.beginPath?.();
      this.ctx.ellipse?.(
        anchor.x + jitterX,
        anchor.y - size * profile.lift + jitterY,
        drawW * 0.48,
        drawH * 0.48,
        (this.random01(seed, q, r, 'terrain-feature-rot') - 0.5) * 0.36,
        0,
        Math.PI * 2,
      );
      this.ctx.clip?.();
      this.ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, drawX, drawY, drawW, drawH);
      this.ctx.restore?.();
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      return true;
    }

    drawWorldTileFeature(tile = {}, viewport = {}, geometry = {}, tileWidth = 192, tileHeight = 96) {
      const feature = tile.feature || {};
      if (!feature.asset) return false;
      const scale = Number(viewport.scale) || 1;
      const seed = viewport.seed || 'scout-tile-v1';
      const metrics = this.analyzeAssetAlphaBounds(feature.asset);
      if (!metrics) return false;
      const targetKey = feature.overlayKey || `feature:${feature.key || ''}`;
      const anchor = this.getWorldOverlayAnchor(tile, viewport, geometry, targetKey, feature.offset);
      const q = Number(tile.q) || 0;
      const r = Number(tile.r) || 0;
      if (feature.key === 'treeCluster') {
        if (this.random01(seed, q, r, 'tree-feature-visible') > 0.82) return false;
        const count = this.random01(seed, q, r, 'tree-feature-count') > 0.68 ? 2 : 1;
        for (let index = 0; index < count; index += 1) {
          const jitterX = (this.random01(seed, q, r, `tree-feature-x-${index}`) - 0.5) * (Number(geometry.stepX) || 96) * scale * 0.62;
          const jitterY = (this.random01(seed, q, r, `tree-feature-y-${index}`) - 0.5) * (Number(geometry.stepY) || 48) * scale * 0.42;
          const treeScale = (0.38 + this.random01(seed, q, r, `tree-feature-scale-${index}`) * 0.13) * (count > 1 ? 0.82 : 1);
          const drawW = tileWidth * treeScale;
          const drawH = drawW * (metrics.height / Math.max(1, metrics.width));
          const baseX = anchor.x + jitterX;
          const baseY = anchor.y + tileHeight * 0.1 + jitterY;
          this.drawWorldOverlayShadow(baseX, baseY, drawW, drawH, {
            alpha: 0.3,
            fill: 'rgba(3, 7, 4, 0.58)',
            rx: 0.34,
            ry: 0.09,
          });
          this.drawWorldOverlayAsset(feature.asset, metrics, baseX - drawW * 0.5, baseY - drawH * 0.9, drawW, drawH, 1);
        }
        return true;
      }
      if (feature.key === 'mountainRidge') {
        const neighbors = Number(tile.mountainNeighbors) || 0;
        const visibleChance = neighbors >= 2 ? 0.98 : 0.78;
        if (this.random01(seed, q, r, 'mountain-feature-visible') > visibleChance) return false;
        const jitterX = (this.random01(seed, q, r, 'mountain-feature-x') - 0.5) * (Number(geometry.stepX) || 96) * scale * 0.28;
        const jitterY = (this.random01(seed, q, r, 'mountain-feature-y') - 0.5) * (Number(geometry.stepY) || 48) * scale * 0.2;
        const mountainScale = (neighbors >= 2 ? 1.02 : 0.86) + this.random01(seed, q, r, 'mountain-feature-scale') * 0.12;
        const drawW = tileWidth * mountainScale;
        const drawH = drawW * (metrics.height / Math.max(1, metrics.width));
        const baseX = anchor.x + jitterX;
        const baseY = anchor.y + tileHeight * 0.18 + jitterY;
        this.drawWorldOverlayShadow(baseX, baseY, drawW, drawH, {
          alpha: 0.34,
          fill: 'rgba(5, 5, 4, 0.62)',
          rx: 0.42,
          ry: 0.1,
          yRatio: 0.02,
        });
        return this.drawWorldOverlayAsset(feature.asset, metrics, baseX - drawW * 0.5, baseY - drawH * 0.82, drawW, drawH, 1);
      }
      const drawW = tileWidth * (Number(feature.scale) || 0.5);
      const drawH = drawW * this.getWorldTileImageAspect(feature.asset);
      return this.drawWorldOverlayAsset(feature.asset, metrics, anchor.x - drawW * 0.5, anchor.y - drawH * 0.5, drawW, drawH, 0.92);
    }

    getWorldTileSiteLayout(tile = {}, viewport = {}, geometry = {}, tileWidth = 192, tileHeight = 96, center = null) {
      const site = tile.site || null;
      if (!site?.art) return null;
      const metrics = this.analyzeAssetAlphaBounds(site.art);
      if (!metrics) return null;
      const targetKey = site.overlayKey || this.constructor.getTileMapAssetManifest().getSiteOverlayKey?.(site.type) || `site:${site.type || 'town'}`;
      const anchor = this.getWorldOverlayAnchor(tile, viewport, geometry, targetKey, site.offset, center);
      const drawW = tileWidth * (Number(site.scale) || 0.46);
      const drawH = drawW * (metrics.height / Math.max(1, metrics.width));
      const baseX = anchor.x;
      const baseY = anchor.y - tileHeight * 0.16;
      const drawX = baseX - drawW * 0.5;
      const drawY = baseY - drawH * 0.86;
      return {
        site,
        metrics,
        baseX,
        baseY,
        drawX,
        drawY,
        drawW,
        drawH,
        hitRect: { x: drawX - 8, y: drawY - 8, width: drawW + 16, height: drawH + 26 },
      };
    }

    drawWorldTileSite(tile = {}, viewport = {}, geometry = {}, tileWidth = 192, tileHeight = 96, uiState = {}, options = {}) {
      const layout = this.getWorldTileSiteLayout(tile, viewport, geometry, tileWidth, tileHeight, options.center);
      if (!layout) return false;
      const {
        site,
        metrics,
        baseX,
        baseY,
        drawX,
        drawY,
        drawW,
        drawH,
      } = layout;
      const selected = uiState.selectedSiteId === site.id;
      if (selected) {
        this.drawIsoDiamond(baseX, baseY, drawW * 1.16, Math.max(18, drawH * 0.32), {
          fill: 'rgba(116, 211, 160, 0.16)',
          stroke: 'rgba(116, 211, 160, 0.72)',
          width: 2,
        });
      }
      this.drawWorldOverlayShadow(baseX, baseY, drawW, drawH, {
        alpha: 0.34,
        fill: 'rgba(4, 6, 5, 0.62)',
        rx: 0.36,
        ry: 0.12,
      });
      const drawn = this.drawWorldOverlayAsset(site.art, metrics, drawX, drawY, drawW, drawH, 1);
      if (!drawn) {
        this.drawText(site.owner === 'player' ? 'P' : 'N', baseX, baseY - drawH * 0.42, {
          size: 15,
          color: site.owner === 'player' ? '#74d3a0' : '#f0b45b',
          align: 'center',
          baseline: 'middle',
        });
      }
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = 0.82;
      this.ctx.fillStyle = site.owner === 'player'
        ? '#7fdca0'
        : site.owner === 'neutral'
          ? '#e8edf1'
          : '#f0c45f';
      this.ctx.beginPath?.();
      this.ctx.arc?.(drawX + drawW * 0.78, drawY + drawH * 0.78, Math.max(3, drawW * 0.035), 0, Math.PI * 2);
      this.ctx.fill?.();
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      this.drawText(this.truncateText(site.name || site.title || 'Site', 74, { size: 9 }), baseX, drawY + drawH + 11, {
        size: 9,
        color: '#f6e8c8',
        align: 'center',
      });
      if (options.addHitTarget !== false) {
        this.addHitTarget(layout.hitRect, {
          type: 'openWorldSite',
          siteId: site.id,
          tileId: tile.id,
        });
      }
      return true;
    }

    getWorldTileRenderEntries(tileMapView = {}, viewport = {}, frame = {}, geometry = {}) {
      const tiles = Array.isArray(tileMapView.tiles) ? tileMapView.tiles : [];
      const scale = Number(viewport.scale) || 1;
      const cacheKey = [
        tileMapView.signature || '',
        tileMapView.version || '',
        tileMapView.seed || '',
        tiles.length,
        Math.round((Number(viewport.originX) || 0) * 10) / 10,
        Math.round((Number(viewport.originY) || 0) * 10) / 10,
        Math.round((Number(viewport.panX) || 0) * 10) / 10,
        Math.round((Number(viewport.panY) || 0) * 10) / 10,
        Math.round(scale * 1000),
        Math.round((Number(frame.x) || 0) * 10) / 10,
        Math.round((Number(frame.y) || 0) * 10) / 10,
        Math.round((Number(frame.width) || 0) * 10) / 10,
        Math.round((Number(frame.height) || 0) * 10) / 10,
      ].join('::');
      if (this.worldTileVisibleEntriesCache?.key === cacheKey) return this.worldTileVisibleEntriesCache.entries;
      const drawProbe = this.getWorldTileDrawRect({ x: 0, y: 0 }, scale, geometry);
      const tileDrawWidth = drawProbe.width;
      const tileDrawHeight = drawProbe.height;
      const offsetX = (Number(viewport.originX) || 0) + (Number(viewport.panX) || 0);
      const offsetY = (Number(viewport.originY) || 0) + (Number(viewport.panY) || 0);
      const localEntries = this.getWorldTileLocalEntries(tileMapView, viewport, geometry);
      const entries = localEntries.map((entry) => {
        const center = {
          x: entry.center.x + offsetX,
          y: entry.center.y + offsetY,
        };
        const drawRect = {
          x: entry.drawRect.x + offsetX,
          y: entry.drawRect.y + offsetY,
          width: entry.drawRect.width,
          height: entry.drawRect.height,
        };
        const inView = drawRect.x < frame.x + frame.width + tileDrawWidth
          && drawRect.x + drawRect.width > frame.x - tileDrawWidth
          && drawRect.y < frame.y + frame.height + tileDrawHeight
          && drawRect.y + drawRect.height > frame.y - tileDrawHeight;
        return { tile: entry.tile, center, drawRect, inView };
      }).filter((entry) => entry.inView);
      this.worldTileVisibleEntriesCache = { key: cacheKey, entries };
      return entries;
    }

    getWorldTileLocalEntries(tileMapView = {}, viewport = {}, geometry = {}) {
      const tiles = Array.isArray(tileMapView.tiles) ? tileMapView.tiles : [];
      const scale = Number(viewport.scale) || 1;
      const cacheKey = [
        tileMapView.signature || '',
        tileMapView.version || '',
        tileMapView.seed || '',
        tiles.length,
        Math.round(scale * 1000),
        Number(geometry.tileWidth) || 192,
        Number(geometry.tileHeight) || 96,
        Number(geometry.stepX) || 96,
        Number(geometry.stepY) || 48,
        Number.isFinite(Number(geometry.anchorY)) ? Number(geometry.anchorY) : 0.5,
      ].join('::');
      if (this.worldTileLocalEntriesCache?.key === cacheKey) return this.worldTileLocalEntriesCache.entries;
      const localViewport = {
        ...viewport,
        originX: 0,
        originY: 0,
        panX: 0,
        panY: 0,
      };
      const entries = tiles.map((tile) => {
        const center = this.getWorldTileScreenCenter(tile, localViewport, geometry);
        const drawRect = this.getWorldTileDrawRect(center, scale, geometry);
        return { tile, center, drawRect, inView: true };
      });
      this.worldTileLocalEntriesCache = { key: cacheKey, entries };
      return entries;
    }

    getWorldTileKey(tile = {}) {
      return `${Number(tile.q) || 0},${Number(tile.r) || 0}`;
    }

    getWorldTileRenderedDiamondCenter(tile = {}, drawRect = {}) {
      const baseTemplate = this.getWorldTileTemplateBaseAsset(tile);
      const assetPath = baseTemplate?.asset || tile.terrainAsset || '';
      const metrics = this.getWorldTileTemplateMetrics(baseTemplate || { asset: assetPath });
      const rectX = Number(drawRect.x) || 0;
      const rectY = Number(drawRect.y) || 0;
      const rectW = Number(drawRect.width) || 0;
      const rectH = Number(drawRect.height) || 0;
      if (metrics && rectW > 0 && rectH > 0) {
        // Tile-map assets are alpha-clipped before being stretched into drawRect.
        return {
          x: rectX + rectW * 0.5,
          y: rectY + rectH * 0.5,
        };
      }
      return {
        x: rectX + rectW * 0.5,
        y: rectY + rectH * 0.5,
      };
    }

    getWorldTileFogRevealEntries(entries = []) {
      if (!Array.isArray(entries) || entries.length <= 1) return entries || [];
      const keySet = new Set(entries.map(({ tile }) => this.getWorldTileKey(tile)));
      const offsets = [
        { q: -1, r: -1 }, { q: 0, r: -1 }, { q: 1, r: -1 },
        { q: -1, r: 0 }, { q: 1, r: 0 },
        { q: -1, r: 1 }, { q: 0, r: 1 }, { q: 1, r: 1 },
      ];
      const innerEntries = entries.filter(({ tile }) => {
        const q = Number(tile?.q) || 0;
        const r = Number(tile?.r) || 0;
        return offsets.every((offset) => keySet.has(`${q + offset.q},${r + offset.r}`));
      });
      return innerEntries.length ? innerEntries : entries;
    }

    getWorldTileStaticCacheLayout(tileMapView = {}, viewport = {}, geometry = {}) {
      const entries = this.getWorldTileLocalEntries(tileMapView, viewport, geometry);
      if (!entries.length) return null;
      const frameEntries = entries;
      const padding = this.getWorldTileAtlasFramePadding(geometry, viewport);
      const minX = Math.min(...frameEntries.map((entry) => entry.drawRect.x)) - padding;
      const minY = Math.min(...frameEntries.map((entry) => entry.drawRect.y)) - padding;
      const maxX = Math.max(...frameEntries.map((entry) => entry.drawRect.x + entry.drawRect.width)) + padding;
      const maxY = Math.max(...frameEntries.map((entry) => entry.drawRect.y + entry.drawRect.height)) + padding;
      const frame = {
        x: Math.floor(minX),
        y: Math.floor(minY),
        width: Math.max(1, Math.ceil(maxX - minX)),
        height: Math.max(1, Math.ceil(maxY - minY)),
      };
      const localViewport = {
        ...viewport,
        originX: 0,
        originY: 0,
        panX: 0,
        panY: 0,
      };
      return {
        kind: 'world',
        frame,
        entries,
        renderViewport: localViewport,
        drawX: viewport.originX + (Number(viewport.panX) || 0) + frame.x,
        drawY: viewport.originY + (Number(viewport.panY) || 0) + frame.y,
      };
    }

    getWorldTileStaticViewportCacheLayout(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      if (!entries.length) return null;
      const padding = 2;
      const localFrame = {
        x: Math.floor((Number(frame.x) || 0) - padding),
        y: Math.floor((Number(frame.y) || 0) - padding),
        width: Math.max(1, Math.ceil((Number(frame.width) || 1) + padding * 2)),
        height: Math.max(1, Math.ceil((Number(frame.height) || 1) + padding * 2)),
      };
      return {
        kind: 'viewport',
        frame: localFrame,
        entries,
        renderViewport: viewport,
        drawX: localFrame.x,
        drawY: localFrame.y,
      };
    }

    getWorldTileStaticChunkSize() {
      return 1024;
    }

    getWorldTileStaticChunkCacheLimit() {
      return 32;
    }

    getWorldTileStaticChunkCacheScale() {
      return 1;
    }

    getWorldTileAtlasFramePadding(geometry = {}, viewport = {}) {
      const scale = Number(viewport.scale) || 1;
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      return Math.max(tileWidth * 1.2, tileHeight * 2.2, 96);
    }

    getWorldTileStaticChunkLayouts(tileMapView = {}, viewport = {}, frame = {}, geometry = {}) {
      const localEntries = this.getWorldTileLocalEntries(tileMapView, viewport, geometry);
      if (!localEntries.length) return [];
      const cacheScale = this.getWorldTileStaticChunkCacheScale();
      const pixelBudget = this.getWorldTileStaticCachePixelBudget();
      const atlasLayout = this.getWorldTileStaticCacheLayout(tileMapView, viewport, geometry);
      if (!atlasLayout?.frame) return [];
      const padding = this.getWorldTileAtlasFramePadding(geometry, viewport);
      const chunkBleed = Math.max(padding, 128);
      const originX = Number(viewport.originX) || 0;
      const originY = Number(viewport.originY) || 0;
      const panX = Number(viewport.panX) || 0;
      const panY = Number(viewport.panY) || 0;
      const maxBudgetChunkSize = Math.floor(Math.sqrt(Math.max(1, pixelBudget)) / Math.max(1, cacheScale));
      const chunkSize = Math.max(256, Math.min(
        Number(this.getWorldTileStaticChunkSize()) || 1024,
        maxBudgetChunkSize || 1024,
      ));
      const localFrame = atlasLayout.frame;
      const minChunkX = Math.floor(localFrame.x / chunkSize);
      const maxChunkX = Math.floor((localFrame.x + localFrame.width - 1) / chunkSize);
      const minChunkY = Math.floor(localFrame.y / chunkSize);
      const maxChunkY = Math.floor((localFrame.y + localFrame.height - 1) / chunkSize);
      const localViewport = {
        ...viewport,
        originX: 0,
        originY: 0,
        panX: 0,
        panY: 0,
      };
      const layouts = [];
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY += 1) {
        for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1) {
          const chunkFrame = {
            x: chunkX * chunkSize,
            y: chunkY * chunkSize,
            width: chunkSize,
            height: chunkSize,
          };
          const expandedChunkFrame = {
            x: chunkFrame.x - chunkBleed,
            y: chunkFrame.y - chunkBleed,
            width: chunkFrame.width + chunkBleed * 2,
            height: chunkFrame.height + chunkBleed * 2,
          };
          const chunkEntries = localEntries.filter((entry) => (
            entry.drawRect.x < expandedChunkFrame.x + expandedChunkFrame.width
            && entry.drawRect.x + entry.drawRect.width > expandedChunkFrame.x
            && entry.drawRect.y < expandedChunkFrame.y + expandedChunkFrame.height
            && entry.drawRect.y + entry.drawRect.height > expandedChunkFrame.y
          ));
          if (!chunkEntries.length) continue;
          layouts.push({
            kind: 'chunk',
            chunkX,
            chunkY,
            frame: chunkFrame,
            entries: chunkEntries,
            renderViewport: localViewport,
            drawX: originX + panX + chunkFrame.x,
            drawY: originY + panY + chunkFrame.y,
          });
        }
      }
      return layouts;
    }

    getWorldTileDragCachePanRange() {
      return 180;
    }

    getWorldTileStaticDragCacheLayout(tileMapView = {}, viewport = {}, frame = {}, geometry = {}) {
      const localEntries = this.getWorldTileLocalEntries(tileMapView, viewport, geometry);
      if (!localEntries.length) return null;
      const scale = Number(viewport.scale) || 1;
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      const padding = Math.max(tileWidth * 1.2, tileHeight * 2.2, 96);
      const panRange = Math.max(0, Number(this.getWorldTileDragCachePanRange()) || 0);
      const originX = Number(viewport.originX) || 0;
      const originY = Number(viewport.originY) || 0;
      const localFrame = {
        x: Math.floor((Number(frame.x) || 0) - originX - panRange - padding),
        y: Math.floor((Number(frame.y) || 0) - originY - panRange - padding),
        width: Math.max(1, Math.ceil((Number(frame.width) || 1) + (panRange + padding) * 2)),
        height: Math.max(1, Math.ceil((Number(frame.height) || 1) + (panRange + padding) * 2)),
      };
      const entries = localEntries.filter((entry) => (
        entry.drawRect.x < localFrame.x + localFrame.width
        && entry.drawRect.x + entry.drawRect.width > localFrame.x
        && entry.drawRect.y < localFrame.y + localFrame.height
        && entry.drawRect.y + entry.drawRect.height > localFrame.y
      ));
      if (!entries.length) return null;
      const localViewport = {
        ...viewport,
        originX: 0,
        originY: 0,
        panX: 0,
        panY: 0,
      };
      return {
        kind: 'drag',
        frame: localFrame,
        entries,
        renderViewport: localViewport,
        drawX: viewport.originX + (Number(viewport.panX) || 0) + localFrame.x,
        drawY: viewport.originY + (Number(viewport.panY) || 0) + localFrame.y,
      };
    }

    getWorldTileStaticCacheKey(tileMapView = {}, viewport = {}, frame = {}, entries = [], uiState = {}, options = {}) {
      const scale = Number(viewport.scale) || 1;
      const selectedSiteId = uiState.selectedSiteId || '';
      const entrySignature = entries.map(({ tile, center, drawRect }) => [
        tile.id,
        tile.terrain,
        tile.terrainAsset,
        (tile.templateAssets || []).map((asset) => `${asset.key}:${asset.asset}:${asset.waterKind || ''}`).join(','),
        tile.feature?.asset || '',
        tile.feature?.key || '',
        tile.site?.id || '',
        tile.site?.art || '',
        tile.site?.owner || '',
        tile.site?.name || tile.site?.title || '',
        tile.site?.scale || '',
        tile.site?.offset?.x || 0,
        tile.site?.offset?.y || 0,
        Math.round(center.x * 10) / 10,
        Math.round(center.y * 10) / 10,
        Math.round(drawRect.x * 10) / 10,
        Math.round(drawRect.y * 10) / 10,
      ].join('|')).join(';');
      return [
        options.kind || 'world',
        tileMapView.signature || '',
        tileMapView.version || '',
        tileMapView.seed || '',
        selectedSiteId,
        Math.round(frame.x),
        Math.round(frame.y),
        Math.round(frame.width),
        Math.round(frame.height),
        Math.round(scale * 1000),
        Math.round((Number(options.cacheScale) || 1) * 1000),
        entrySignature,
      ].join('::');
    }

    renderWorldTileFogMask(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      if (!this.ctx || typeof this.ctx.drawImage !== 'function') return;
      const knownEntries = this.getWorldTileFogRevealEntries(Array.isArray(entries) ? entries : []);
      const geometry = tileMapView.geometry || viewport.geometry || {};
      const scale = Number(viewport.scale) || 1;
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      const width = Math.max(1, Math.ceil(Number(frame.width) || 1));
      const height = Math.max(1, Math.ceil(Number(frame.height) || 1));
      const cacheScale = Math.max(1, Number(this.pixelRatio) || 1);
      const work = this.getWorldTileLayerCacheContext('worldTileFogMaskCache', width, height, cacheScale);
      if (!work?.canvas || !work?.ctx) return;
      const readNumber = (value, fallback = 0) => {
        const next = Number(value);
        return Number.isFinite(next) ? next : fallback;
      };
      const ctx = work.ctx;
      ctx.setTransform?.(1, 0, 0, 1, 0, 0);
      ctx.clearRect?.(0, 0, work.pixelWidth || work.canvas.width, work.pixelHeight || work.canvas.height);
      ctx.setTransform?.(work.scale || 1, 0, 0, work.scale || 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000000';
      ctx.fillRect?.(0, 0, width, height);
      if (knownEntries.length) {
        const minX = Math.min(...knownEntries.map((entry) => readNumber(entry.drawRect?.x, readNumber(entry.center?.x))));
        const minY = Math.min(...knownEntries.map((entry) => readNumber(entry.drawRect?.y, readNumber(entry.center?.y))));
        const maxX = Math.max(...knownEntries.map((entry) => (
          readNumber(entry.drawRect?.x, readNumber(entry.center?.x))
          + readNumber(entry.drawRect?.width, tileWidth)
        )));
        const maxY = Math.max(...knownEntries.map((entry) => (
          readNumber(entry.drawRect?.y, readNumber(entry.center?.y))
          + readNumber(entry.drawRect?.height, tileHeight)
        )));
        const centerX = (minX + maxX) * 0.5;
        const centerY = (minY + maxY) * 0.5;
        const radiusX = Math.max(tileWidth * 1.05, (maxX - minX) * 0.5 + tileWidth * 0.28);
        const radiusY = Math.max(tileHeight * 1.35, (maxY - minY) * 0.5 + tileHeight * 0.42);
        const radius = Math.max(radiusX, radiusY, 1);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.save?.();
        ctx.translate?.(centerX - (Number(frame.x) || 0), centerY - (Number(frame.y) || 0));
        ctx.scale?.(radiusX / radius, radiusY / radius);
        const gradient = typeof ctx.createRadialGradient === 'function'
          ? ctx.createRadialGradient(0, 0, Math.max(4, radius * 0.42), 0, 0, radius)
          : 'rgba(0, 0, 0, 1)';
        if (gradient?.addColorStop) {
          [
            [0, 'rgba(0, 0, 0, 1)'],
            [0.54, 'rgba(0, 0, 0, 1)'],
            [0.86, 'rgba(0, 0, 0, 0.5)'],
            [1, 'rgba(0, 0, 0, 0)'],
          ].forEach(([offset, color]) => gradient.addColorStop(offset, color));
        }
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc?.(0, 0, radius, 0, Math.PI * 2);
        ctx.fill?.();
        ctx.restore?.();
      }
      ctx.globalCompositeOperation = 'source-over';
      this.ctx.drawImage(
        work.canvas,
        0,
        0,
        work.pixelWidth || work.canvas.width,
        work.pixelHeight || work.canvas.height,
        Number(frame.x) || 0,
        Number(frame.y) || 0,
        width,
        height,
      );
    }

    getWorldTileStaticCacheScale() {
      return Math.max(1, Number(this.pixelRatio) || 1);
    }

    getWorldTileStaticCachePixelBudget() {
      return 16000000;
    }

    getWorldTileLayerCacheContext(cacheName, width, height, cacheScale = 1) {
      const localW = Math.max(1, Math.ceil(width));
      const localH = Math.max(1, Math.ceil(height));
      const scale = Math.max(1, Number(cacheScale) || 1);
      const pixelW = Math.max(1, Math.ceil(localW * scale));
      const pixelH = Math.max(1, Math.ceil(localH * scale));
      const cached = this[cacheName];
      if (cached?.canvas && cached?.ctx) {
        if (cached.canvas.width !== pixelW) cached.canvas.width = pixelW;
        if (cached.canvas.height !== pixelH) cached.canvas.height = pixelH;
        cached.width = localW;
        cached.height = localH;
        cached.pixelWidth = pixelW;
        cached.pixelHeight = pixelH;
        cached.scale = scale;
        return cached;
      }
      const canvas = this.createTileWorkCanvas(pixelW, pixelH);
      const ctx = canvas?.getContext?.('2d') || null;
      if (!canvas || !ctx) return null;
      this[cacheName] = {
        canvas,
        ctx,
        width: localW,
        height: localH,
        pixelWidth: pixelW,
        pixelHeight: pixelH,
        scale,
      };
      return this[cacheName];
    }

    getWorldTileStaticCacheContext(width, height, cacheScale = 1) {
      return this.getWorldTileLayerCacheContext('worldTileStaticCache', width, height, cacheScale);
    }

    getWorldTileScoutRouteCacheContext(width, height, cacheScale = 1) {
      return this.getWorldTileLayerCacheContext('worldTileScoutRouteCache', width, height, cacheScale);
    }

    getWorldTileWaterLayerCacheContext(width, height, cacheScale = 1) {
      return this.getWorldTileLayerCacheContext('worldTileWaterLayerCache', width, height, cacheScale);
    }

    createWorldTileLayerWork(width, height, cacheScale = 1) {
      const localW = Math.max(1, Math.ceil(width));
      const localH = Math.max(1, Math.ceil(height));
      const scale = Math.max(1, Number(cacheScale) || 1);
      const pixelW = Math.max(1, Math.ceil(localW * scale));
      const pixelH = Math.max(1, Math.ceil(localH * scale));
      const canvas = this.createTileWorkCanvas(pixelW, pixelH);
      const ctx = canvas?.getContext?.('2d') || null;
      if (!canvas || !ctx) return null;
      return {
        canvas,
        ctx,
        width: localW,
        height: localH,
        pixelWidth: pixelW,
        pixelHeight: pixelH,
        scale,
      };
    }

    drawWorldTileLayerCache(work, layout = {}, clipFrame = null) {
      if (!work?.canvas || !layout?.frame || typeof this.ctx?.drawImage !== 'function') return false;
      const drawX = Number(layout.drawX) || 0;
      const drawY = Number(layout.drawY) || 0;
      const frameWidth = Math.max(1, Number(layout.frame.width) || 1);
      const frameHeight = Math.max(1, Number(layout.frame.height) || 1);
      const clip = clipFrame || { x: drawX, y: drawY, width: frameWidth, height: frameHeight };
      const clipX = Number(clip.x) || 0;
      const clipY = Number(clip.y) || 0;
      const clipWidth = Math.max(0, Number(clip.width) || 0);
      const clipHeight = Math.max(0, Number(clip.height) || 0);
      const visibleX = Math.max(drawX, clipX);
      const visibleY = Math.max(drawY, clipY);
      const visibleRight = Math.min(drawX + frameWidth, clipX + clipWidth);
      const visibleBottom = Math.min(drawY + frameHeight, clipY + clipHeight);
      const visibleWidth = Math.max(0, visibleRight - visibleX);
      const visibleHeight = Math.max(0, visibleBottom - visibleY);
      if (visibleWidth <= 0 || visibleHeight <= 0) return true;
      const scale = Math.max(1, Number(work.scale) || 1);
      const sourceX = Math.max(0, (visibleX - drawX) * scale);
      const sourceY = Math.max(0, (visibleY - drawY) * scale);
      const sourceWidth = Math.min(
        Math.max(1, visibleWidth * scale),
        Math.max(1, (Number(work.canvas.width) || sourceX + visibleWidth * scale) - sourceX),
      );
      const sourceHeight = Math.min(
        Math.max(1, visibleHeight * scale),
        Math.max(1, (Number(work.canvas.height) || sourceY + visibleHeight * scale) - sourceY),
      );
      this.ctx.drawImage(
        work.canvas,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        visibleX,
        visibleY,
        sourceWidth / scale,
        sourceHeight / scale,
      );
      return true;
    }

    getWorldTileFastDragCompositeSignature() {
      return [
        this.worldTileStaticCacheKey || '',
        this.worldTileScoutRouteCacheKey || '',
        this.worldTileWaterLayerCacheKey || '',
      ].join('::');
    }

    renderWorldTileFastDragComposite(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      if (!this.worldTileFastDragComposite?.work || !this.worldTileFastDragComposite?.layout) return false;
      if (this.worldTileFastDragComposite.signature !== this.getWorldTileFastDragCompositeSignature()) return false;
      const layout = this.resolveWorldTileStaticCacheLayout(tileMapView, viewport, frame, entries);
      if (!layout || layout.kind === 'chunks') return false;
      const cachedLayout = this.worldTileFastDragComposite.layout;
      const drawLayout = {
        ...cachedLayout,
        drawX: layout.drawX,
        drawY: layout.drawY,
      };
      return this.drawWorldTileLayerCache(this.worldTileFastDragComposite.work, drawLayout, frame);
    }

    updateWorldTileFastDragComposite(layout = null, frame = null) {
      if (!layout?.frame || !this.worldTileStaticCache?.canvas) return false;
      const signature = this.getWorldTileFastDragCompositeSignature();
      if (!signature.trim()) return false;
      const width = Math.max(1, Number(layout.frame.width) || 1);
      const height = Math.max(1, Number(layout.frame.height) || 1);
      const cacheScale = this.getWorldTileStaticCacheScale();
      const work = this.getWorldTileLayerCacheContext('worldTileFastDragCompositeCache', width, height, cacheScale);
      if (!work) return false;
      const previousCtx = this.ctx;
      this.ctx = work.ctx;
      try {
        work.ctx.setTransform?.(1, 0, 0, 1, 0, 0);
        work.ctx.clearRect?.(0, 0, work.pixelWidth || work.width, work.pixelHeight || work.height);
        work.ctx.setTransform?.(work.scale || 1, 0, 0, work.scale || 1, 0, 0);
        work.ctx.globalAlpha = 1;
        work.ctx.globalCompositeOperation = 'source-over';
        const localFrame = {
          x: 0,
          y: 0,
          width,
          height,
        };
        const localLayout = {
          ...layout,
          drawX: 0,
          drawY: 0,
        };
        this.drawWorldTileLayerCache(this.worldTileScoutRouteCache, localLayout, localFrame);
        this.drawWorldTileLayerCache(this.worldTileWaterLayerCache, localLayout, localFrame);
        this.drawWorldTileLayerCache(this.worldTileStaticCache, localLayout, localFrame);
        this.worldTileFastDragComposite = {
          signature,
          layout: { ...layout },
          work,
        };
        return true;
      } finally {
        this.ctx = previousCtx;
      }
    }

    resolveWorldTileStaticCacheLayout(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      const geometry = tileMapView.geometry || {};
      const cacheScale = this.getWorldTileStaticCacheScale();
      const pixelBudget = this.getWorldTileStaticCachePixelBudget();
      const worldLayout = this.getWorldTileStaticCacheLayout(tileMapView, viewport, geometry);
      if (!worldLayout) return null;
      const worldPixels = worldLayout.frame.width * worldLayout.frame.height * cacheScale * cacheScale;
      if (worldPixels <= pixelBudget) return worldLayout;
      const chunkLayouts = this.getWorldTileStaticChunkLayouts(tileMapView, viewport, frame, geometry);
      if (chunkLayouts.length) return { kind: 'chunks', layouts: chunkLayouts };
      if (this.worldTileFastDragActive) return null;
      const viewportLayout = this.getWorldTileStaticViewportCacheLayout(tileMapView, viewport, frame, entries);
      if (!viewportLayout) return null;
      const viewportPixels = viewportLayout.frame.width * viewportLayout.frame.height * cacheScale * cacheScale;
      return viewportPixels <= pixelBudget ? viewportLayout : null;
    }

    getWorldTileStaticChunkCacheKey(tileMapView = {}, viewport = {}, layout = {}, uiState = {}, options = {}) {
      return this.getWorldTileStaticCacheKey(tileMapView, viewport, layout.frame, layout.entries, uiState, {
        ...options,
        kind: `chunk:${layout.chunkX},${layout.chunkY}`,
      });
    }

    pruneWorldTileStaticChunkCaches(activeKeys = new Set()) {
      const limit = Math.max(1, Number(this.getWorldTileStaticChunkCacheLimit()) || 32);
      if (!this.worldTileStaticChunkCaches || this.worldTileStaticChunkCaches.size <= limit) return false;
      const staleEntries = Array.from(this.worldTileStaticChunkCaches.entries())
        .filter(([key]) => !activeKeys.has(key))
        .sort((a, b) => (Number(a[1]?.lastUsedAt) || 0) - (Number(b[1]?.lastUsedAt) || 0));
      let pruned = false;
      while (this.worldTileStaticChunkCaches.size > limit && staleEntries.length) {
        const [key] = staleEntries.shift();
        this.worldTileStaticChunkCaches.delete(key);
        pruned = true;
      }
      return pruned;
    }

    renderWorldTileStaticChunk(tileMapView = {}, layout = {}, uiState = {}, cacheScale = 1) {
      const hasEntries = Array.isArray(layout.entries) && layout.entries.length > 0;
      if (!layout?.frame || !hasEntries) return false;
      const chunkKey = `${layout.chunkX},${layout.chunkY}`;
      let work = this.worldTileStaticChunkCaches.get(chunkKey);
      const width = Math.max(1, Number(layout.frame.width) || 1);
      const height = Math.max(1, Number(layout.frame.height) || 1);
      const pixelW = Math.max(1, Math.ceil(width * cacheScale));
      const pixelH = Math.max(1, Math.ceil(height * cacheScale));
      if (!work?.canvas || !work?.ctx) {
        const canvas = this.createTileWorkCanvas(pixelW, pixelH);
        const ctx = canvas?.getContext?.('2d') || null;
        if (!canvas || !ctx) return false;
        work = { canvas, ctx };
        this.worldTileStaticChunkCaches.set(chunkKey, work);
      }
      if (work.canvas.width !== pixelW) work.canvas.width = pixelW;
      if (work.canvas.height !== pixelH) work.canvas.height = pixelH;
      work.width = width;
      work.height = height;
      work.pixelWidth = pixelW;
      work.pixelHeight = pixelH;
      work.scale = cacheScale;
      work.chunkX = layout.chunkX;
      work.chunkY = layout.chunkY;
      work.frame = { ...layout.frame };
      const cacheKey = this.getWorldTileStaticChunkCacheKey(tileMapView, layout.renderViewport, layout, uiState, { cacheScale });
      if (cacheKey !== work.key) {
        const previousCtx = this.ctx;
        this.ctx = work.ctx;
        try {
          work.ctx.setTransform?.(1, 0, 0, 1, 0, 0);
          work.ctx.clearRect?.(0, 0, work.pixelWidth || work.width, work.pixelHeight || work.height);
          work.ctx.setTransform?.(work.scale || 1, 0, 0, work.scale || 1, 0, 0);
          work.ctx.globalAlpha = 1;
          work.ctx.globalCompositeOperation = 'source-over';
          work.ctx.save?.();
          work.ctx.translate?.(-layout.frame.x, -layout.frame.y);
          this.withSuppressedHitTargets(() => {
            this.renderWorldTileStaticEntries(tileMapView, layout.renderViewport, layout.frame, layout.entries, uiState, {
              addHitTargets: false,
            });
          });
          work.ctx.restore?.();
          work.key = cacheKey;
        } finally {
          this.ctx = previousCtx;
        }
      }
      work.lastUsedAt = ++this.worldTileStaticChunkCacheTick;
      return true;
    }

    renderWorldTileStaticChunks(tileMapView = {}, chunkLayouts = [], frame = {}, uiState = {}) {
      const cacheScale = this.getWorldTileStaticChunkCacheScale();
      const activeKeys = new Set(chunkLayouts.map((layout) => `${layout.chunkX},${layout.chunkY}`));
      this.worldTileStaticCacheLayoutKind = 'chunks';
      let rendered = false;
      chunkLayouts.forEach((layout) => {
        if (this.renderWorldTileStaticChunk(tileMapView, layout, uiState, cacheScale)) {
          this.drawWorldTileLayerCache(this.worldTileStaticChunkCaches.get(`${layout.chunkX},${layout.chunkY}`), layout, frame);
          rendered = true;
        }
      });
      this.pruneWorldTileStaticChunkCaches(activeKeys);
      return rendered;
    }

    getWorldTileWaterChunkCacheKey(tileMapView = {}, viewport = {}, layout = {}, waterEntries = [], options = {}) {
      return this.getWorldTileWaterLayerCacheKey(tileMapView, viewport, layout.frame, waterEntries, {
        ...options,
        kind: `water-chunk:${layout.chunkX},${layout.chunkY}`,
      });
    }

    pruneWorldTileWaterChunkCaches(activeKeys = new Set()) {
      const frameCount = Math.max(1, Number(this.getWorldTileWaterAnimationFrameCount()) || 1);
      const limit = Math.max(1, Number(this.getWorldTileStaticChunkCacheLimit()) || 32) * frameCount;
      if (!this.worldTileWaterChunkCaches || this.worldTileWaterChunkCaches.size <= limit) return false;
      const staleEntries = Array.from(this.worldTileWaterChunkCaches.entries())
        .filter(([key]) => !activeKeys.has(key))
        .sort((a, b) => (Number(a[1]?.lastUsedAt) || 0) - (Number(b[1]?.lastUsedAt) || 0));
      let pruned = false;
      while (this.worldTileWaterChunkCaches.size > limit && staleEntries.length) {
        const [key] = staleEntries.shift();
        this.worldTileWaterChunkCaches.delete(key);
        pruned = true;
      }
      return pruned;
    }

    getWorldTileWaterChunkFrameCacheId(layout = {}, frameIndex = 0) {
      return `${layout.chunkX},${layout.chunkY}:${frameIndex}`;
    }

    renderWorldTileWaterChunk(tileMapView = {}, layout = {}, cacheScale = 1, frameIndex = this.getWorldTileWaterAnimationFrameIndex()) {
      if (!layout?.frame || !Array.isArray(layout.entries) || !layout.entries.length) return false;
      const waterEntries = layout.entries.filter(({ tile }) => tile.water?.kind && tile.water?.asset);
      if (!waterEntries.length) return false;
      const cacheId = this.getWorldTileWaterChunkFrameCacheId(layout, frameIndex);
      const work = this.renderWorldTileWaterFrameCache(
        tileMapView,
        layout,
        waterEntries,
        cacheScale,
        frameIndex,
        this.worldTileWaterChunkCaches,
        cacheId,
        `water-chunk:${layout.chunkX},${layout.chunkY}`,
      );
      if (!work) return false;
      work.chunkX = layout.chunkX;
      work.chunkY = layout.chunkY;
      work.lastUsedAt = ++this.worldTileWaterChunkCacheTick;
      return true;
    }

    renderWorldTileWaterChunkFrames(tileMapView = {}, layout = {}, cacheScale = 1) {
      const frameCount = Math.max(1, Number(this.getWorldTileWaterAnimationFrameCount()) || 1);
      let rendered = false;
      for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        if (this.renderWorldTileWaterChunk(tileMapView, layout, cacheScale, frameIndex)) rendered = true;
      }
      return rendered;
    }

    renderWorldTileWaterChunks(tileMapView = {}, chunkLayouts = [], frame = {}) {
      const cacheScale = this.getWorldTileStaticChunkCacheScale();
      const activeKeys = new Set();
      const frameIndex = this.getWorldTileWaterAnimationFrameIndex();
      const frameCount = Math.max(1, Number(this.getWorldTileWaterAnimationFrameCount()) || 1);
      let rendered = false;
      chunkLayouts.forEach((layout) => {
        const waterEntries = (layout.entries || []).filter(({ tile }) => tile.water?.kind && tile.water?.asset);
        if (!waterEntries.length) return;
        for (let index = 0; index < frameCount; index += 1) {
          activeKeys.add(this.getWorldTileWaterChunkFrameCacheId(layout, index));
        }
        if (!this.worldTileFastDragActive) this.renderWorldTileWaterChunkFrames(tileMapView, layout, cacheScale);
        const cacheId = this.getWorldTileWaterChunkFrameCacheId(layout, frameIndex);
        const work = this.worldTileWaterChunkCaches.get(cacheId);
        if (work?.canvas) {
          this.drawWorldTileLayerCache(work, layout, frame);
          rendered = true;
        }
      });
      this.pruneWorldTileWaterChunkCaches(activeKeys);
      return rendered;
    }

    renderWorldTileSnapshotChunkCacheMap(cacheMap = null, viewport = {}, frame = {}) {
      if (!cacheMap?.size) return false;
      let rendered = false;
      cacheMap.forEach((work) => {
        const chunkFrame = work?.frame;
        if (!work?.canvas || !chunkFrame) return;
        const layout = {
          kind: 'chunk',
          frame: chunkFrame,
          drawX: (Number(viewport.originX) || 0) + (Number(viewport.panX) || 0) + (Number(chunkFrame.x) || 0),
          drawY: (Number(viewport.originY) || 0) + (Number(viewport.panY) || 0) + (Number(chunkFrame.y) || 0),
        };
        const drawRight = layout.drawX + (Number(chunkFrame.width) || 0);
        const drawBottom = layout.drawY + (Number(chunkFrame.height) || 0);
        if (
          layout.drawX > frame.x + frame.width
          || drawRight < frame.x
          || layout.drawY > frame.y + frame.height
          || drawBottom < frame.y
        ) return;
        if (this.drawWorldTileLayerCache(work, layout, frame)) rendered = true;
      });
      return rendered;
    }

    getWorldTileSnapshotDrawLayout(cachedLayout = {}, viewport = {}) {
      if (!cachedLayout?.frame) return null;
      return {
        ...cachedLayout,
        drawX: (Number(viewport.originX) || 0) + (Number(viewport.panX) || 0) + (Number(cachedLayout.frame.x) || 0),
        drawY: (Number(viewport.originY) || 0) + (Number(viewport.panY) || 0) + (Number(cachedLayout.frame.y) || 0),
      };
    }

    renderWorldTileSnapshotLayerCache(work = null, cachedLayout = null, viewport = {}, frame = {}) {
      if (!work?.canvas || !cachedLayout?.frame) return false;
      const drawLayout = this.getWorldTileSnapshotDrawLayout(cachedLayout, viewport);
      return drawLayout ? this.drawWorldTileLayerCache(work, drawLayout, frame) : false;
    }

    renderWorldTileSnapshotCache(tileMapView = {}, viewport = {}, frame = {}) {
      if (!this.ctx || typeof this.ctx.drawImage !== 'function') return false;
      let rendered = false;
      const renderFogMask = () => {
        const entries = this.getWorldTileRenderEntries(tileMapView, viewport, frame, tileMapView.geometry || viewport.geometry || {});
        this.renderWorldTileFogMask(tileMapView, viewport, frame, entries);
      };
      if (this.worldTileStaticCache?.canvas && this.worldTileStaticCacheLayout?.frame) {
        const waterWork = this.getWorldTileWaterFrameCache();
        if (waterWork?.canvas) {
          rendered = this.renderWorldTileSnapshotLayerCache(
            waterWork,
            this.worldTileStaticCacheLayout,
            viewport,
            frame,
          ) || rendered;
        }
        rendered = this.renderWorldTileSnapshotLayerCache(
          this.worldTileStaticCache,
          this.worldTileStaticCacheLayout,
          viewport,
          frame,
        ) || rendered;
        if (this.worldTileScoutRouteCache?.canvas && this.worldTileScoutRouteCacheLayout?.frame) {
          rendered = this.renderWorldTileSnapshotLayerCache(
            this.worldTileScoutRouteCache,
            this.worldTileScoutRouteCacheLayout,
            viewport,
            frame,
          ) || rendered;
        }
        if (rendered) renderFogMask();
        return rendered;
      }
      if (this.worldTileStaticCacheLayoutKind !== 'chunks' || !this.worldTileStaticChunkCaches?.size) return false;
      const frameIndex = this.getWorldTileWaterAnimationFrameIndex();
      const renderedWater = this.renderWorldTileSnapshotChunkCacheMap(
        new Map(Array.from(this.worldTileWaterChunkCaches || [])
          .filter(([key]) => String(key).endsWith(`:${frameIndex}`))),
        viewport,
        frame,
      );
      const renderedStatic = this.renderWorldTileSnapshotChunkCacheMap(this.worldTileStaticChunkCaches, viewport, frame);
      rendered = renderedWater || renderedStatic;
      if (rendered) renderFogMask();
      return rendered;
    }

    renderWorldTileStaticLayer(tileMapView = {}, viewport = {}, frame = {}, entries = [], uiState = {}) {
      const layout = this.resolveWorldTileStaticCacheLayout(tileMapView, viewport, frame, entries);
      if (!layout) return false;
      if (layout.kind === 'chunks') return this.renderWorldTileStaticChunks(tileMapView, layout.layouts, frame, uiState);
      if (this.worldTileFastDragActive && this.worldTileStaticCacheKey && this.worldTileStaticCache?.canvas) {
        return this.drawWorldTileLayerCache(this.worldTileStaticCache, layout, frame);
      }
      const cacheScale = this.getWorldTileStaticCacheScale();
      const work = this.getWorldTileStaticCacheContext(layout.frame.width, layout.frame.height, cacheScale);
      if (!work) return false;
      const cacheKey = this.getWorldTileStaticCacheKey(tileMapView, layout.renderViewport, layout.frame, layout.entries, uiState, {
        kind: layout.kind,
        cacheScale,
      });
      if (cacheKey !== this.worldTileStaticCacheKey) {
        const previousCtx = this.ctx;
        this.ctx = work.ctx;
        try {
          work.ctx.setTransform?.(1, 0, 0, 1, 0, 0);
          work.ctx.clearRect?.(0, 0, work.pixelWidth || work.width, work.pixelHeight || work.height);
          work.ctx.setTransform?.(work.scale || 1, 0, 0, work.scale || 1, 0, 0);
          work.ctx.globalAlpha = 1;
          work.ctx.globalCompositeOperation = 'source-over';
          work.ctx.save?.();
          work.ctx.translate?.(-layout.frame.x, -layout.frame.y);
          this.withSuppressedHitTargets(() => {
            this.renderWorldTileStaticEntries(tileMapView, layout.renderViewport, layout.frame, layout.entries, uiState, {
              addHitTargets: false,
            });
          });
          work.ctx.restore?.();
          this.worldTileStaticCacheKey = cacheKey;
          this.worldTileStaticCacheLayoutKind = layout.kind || '';
          this.worldTileStaticCacheLayout = { ...layout, frame: { ...layout.frame } };
        } finally {
          this.ctx = previousCtx;
        }
      }
      return this.drawWorldTileLayerCache(work, layout, frame);
    }

    getWorldTileScoutRouteCacheKey(tileMapView = {}, viewport = {}, frame = {}, options = {}) {
      const scale = Number(viewport.scale) || 1;
      const scoutSignature = (tileMapView.activeScouts || []).map((mission) => [
        mission.id || '',
        mission.status || '',
        (mission.route || []).map((step) => [
          step.tileId || '',
          step.q ?? '',
          step.r ?? '',
          step.step ?? '',
          step.revealed ? 1 : 0,
        ].join(',')).join('|'),
      ].join(':')).join(';');
      return [
        options.kind || 'world',
        tileMapView.signature || '',
        tileMapView.version || '',
        tileMapView.seed || '',
        Math.round(frame.x),
        Math.round(frame.y),
        Math.round(frame.width),
        Math.round(frame.height),
        Math.round(scale * 1000),
        Math.round((Number(options.cacheScale) || 1) * 1000),
        Math.round((Number(viewport.originX) || 0) * 10) / 10,
        Math.round((Number(viewport.originY) || 0) * 10) / 10,
        Math.round((Number(viewport.panX) || 0) * 10) / 10,
        Math.round((Number(viewport.panY) || 0) * 10) / 10,
        scoutSignature,
      ].join('::');
    }

    renderWorldScoutRouteLayer(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      if (!Array.isArray(tileMapView.activeScouts) || !tileMapView.activeScouts.length) return true;
      const layout = this.resolveWorldTileStaticCacheLayout(tileMapView, viewport, frame, entries);
      if (!layout) return false;
      if (layout.kind === 'chunks') return false;
      if (this.worldTileFastDragActive && this.worldTileScoutRouteCacheKey && this.worldTileScoutRouteCache?.canvas) {
        return this.drawWorldTileLayerCache(this.worldTileScoutRouteCache, layout, frame);
      }
      const cacheScale = this.getWorldTileStaticCacheScale();
      const work = this.getWorldTileScoutRouteCacheContext(layout.frame.width, layout.frame.height, cacheScale);
      if (!work) return false;
      const cacheKey = this.getWorldTileScoutRouteCacheKey(tileMapView, layout.renderViewport, layout.frame, {
        kind: layout.kind,
        cacheScale,
      });
      if (cacheKey !== this.worldTileScoutRouteCacheKey) {
        const previousCtx = this.ctx;
        this.ctx = work.ctx;
        try {
          work.ctx.setTransform?.(1, 0, 0, 1, 0, 0);
          work.ctx.clearRect?.(0, 0, work.pixelWidth || work.width, work.pixelHeight || work.height);
          work.ctx.setTransform?.(work.scale || 1, 0, 0, work.scale || 1, 0, 0);
          work.ctx.globalAlpha = 1;
          work.ctx.globalCompositeOperation = 'source-over';
          work.ctx.save?.();
          work.ctx.translate?.(-(Number(layout.frame.x) || 0), -(Number(layout.frame.y) || 0));
          this.renderWorldScoutRoutes(tileMapView, layout.renderViewport);
          work.ctx.restore?.();
          this.worldTileScoutRouteCacheKey = cacheKey;
          this.worldTileScoutRouteCacheLayout = { ...layout, frame: { ...layout.frame } };
        } finally {
          this.ctx = previousCtx;
        }
      }
      return this.drawWorldTileLayerCache(work, layout, frame);
    }

    getWorldTileWaterAnimationFps() {
      return 8;
    }

    getWorldTileWaterAnimationFrameCount() {
      return 8;
    }

    getWorldTileWaterAnimationFrameMs() {
      return Math.max(16, Math.round(1000 / Math.max(1, this.getWorldTileWaterAnimationFps())));
    }

    getWorldTileWaterTimeMs() {
      return this.worldTileWaterTimeOverride !== null
        && this.worldTileWaterTimeOverride !== undefined
        && Number.isFinite(Number(this.worldTileWaterTimeOverride))
        ? Number(this.worldTileWaterTimeOverride)
        : this.getNow();
    }

    getWorldTileWaterAnimationFrame(timeMs = this.getWorldTileWaterTimeMs()) {
      return Math.floor((Math.max(0, Number(timeMs) || 0) / 1000) * this.getWorldTileWaterAnimationFps());
    }

    getWorldTileWaterAnimationFrameIndex(timeMs = this.getWorldTileWaterTimeMs()) {
      const frameCount = Math.max(1, Number(this.getWorldTileWaterAnimationFrameCount()) || 1);
      const frame = this.getWorldTileWaterAnimationFrame(timeMs);
      return ((frame % frameCount) + frameCount) % frameCount;
    }

    getWorldTileWaterFrameTimeMs(frameIndex = 0) {
      const safeFrame = Math.max(0, Number(frameIndex) || 0);
      return safeFrame * this.getWorldTileWaterAnimationFrameMs();
    }

    getWorldTileWaterLayerCacheKey(tileMapView = {}, viewport = {}, frame = {}, entries = [], options = {}) {
      const scale = Number(viewport.scale) || 1;
      const entrySignature = entries
        .filter(({ tile }) => tile.water?.kind && tile.water?.asset)
        .map(({ tile, center, drawRect }) => [
          tile.id,
          tile.water?.kind || '',
          tile.water?.asset || '',
          (tile.templateAssets || []).map((asset) => `${asset.key}:${asset.asset}:${asset.waterKind || ''}`).join(','),
          Math.round(center.x * 10) / 10,
          Math.round(center.y * 10) / 10,
          Math.round(drawRect.x * 10) / 10,
          Math.round(drawRect.y * 10) / 10,
        ].join('|'))
        .join(';');
      return [
        options.kind || 'world',
        tileMapView.signature || '',
        tileMapView.version || '',
        tileMapView.seed || '',
        Math.round(frame.x),
        Math.round(frame.y),
        Math.round(frame.width),
        Math.round(frame.height),
        Math.round(scale * 1000),
        Math.round((Number(options.cacheScale) || 1) * 1000),
        options.frameIndex ?? this.getWorldTileWaterAnimationFrameIndex(),
        entrySignature,
      ].join('::');
    }

    resolveWorldTileWaterLayerCacheLayout(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      return this.resolveWorldTileStaticCacheLayout(tileMapView, viewport, frame, entries);
    }

    renderWorldTileWaterFrameCache(tileMapView = {}, layout = {}, waterEntries = [], cacheScale = 1, frameIndex = 0, cacheMap = this.worldTileWaterFrameCaches, cacheId = frameIndex, kind = layout.kind || 'world') {
      if (!layout?.frame || !Array.isArray(waterEntries) || !waterEntries.length || !cacheMap) return null;
      const width = Math.max(1, Number(layout.frame.width) || 1);
      const height = Math.max(1, Number(layout.frame.height) || 1);
      let work = cacheMap.get(cacheId);
      const pixelW = Math.max(1, Math.ceil(width * cacheScale));
      const pixelH = Math.max(1, Math.ceil(height * cacheScale));
      if (!work?.canvas || !work?.ctx || work.canvas.width !== pixelW || work.canvas.height !== pixelH) {
        work = this.createWorldTileLayerWork(width, height, cacheScale);
        if (!work) return null;
        cacheMap.set(cacheId, work);
      }
      work.width = width;
      work.height = height;
      work.pixelWidth = pixelW;
      work.pixelHeight = pixelH;
      work.scale = cacheScale;
      work.frame = { ...layout.frame };
      work.frameIndex = frameIndex;
      const cacheKey = this.getWorldTileWaterLayerCacheKey(tileMapView, layout.renderViewport, layout.frame, waterEntries, {
        kind,
        cacheScale,
        frameIndex,
      });
      if (cacheKey !== work.key) {
        const previousCtx = this.ctx;
        this.ctx = work.ctx;
        try {
          work.ctx.setTransform?.(1, 0, 0, 1, 0, 0);
          work.ctx.clearRect?.(0, 0, work.pixelWidth || work.width, work.pixelHeight || work.height);
          work.ctx.setTransform?.(work.scale || 1, 0, 0, work.scale || 1, 0, 0);
          work.ctx.globalAlpha = 1;
          work.ctx.globalCompositeOperation = 'source-over';
          work.ctx.save?.();
          work.ctx.translate?.(-(Number(layout.frame.x) || 0), -(Number(layout.frame.y) || 0));
          this.renderWorldTileWaterEntries(
            tileMapView,
            layout.renderViewport,
            waterEntries,
            this.getWorldTileWaterFrameTimeMs(frameIndex),
          );
          work.ctx.restore?.();
          work.key = cacheKey;
        } finally {
          this.ctx = previousCtx;
        }
      }
      return work;
    }

    getWorldTileWaterFrameCache(frameIndex = this.getWorldTileWaterAnimationFrameIndex()) {
      return this.worldTileWaterFrameCaches?.get?.(frameIndex) || null;
    }

    renderWorldTileWaterFrameCaches(tileMapView = {}, layout = {}, waterEntries = [], cacheScale = 1) {
      const frameCount = Math.max(1, Number(this.getWorldTileWaterAnimationFrameCount()) || 1);
      let rendered = false;
      for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        const work = this.renderWorldTileWaterFrameCache(
          tileMapView,
          layout,
          waterEntries,
          cacheScale,
          frameIndex,
          this.worldTileWaterFrameCaches,
          frameIndex,
          layout.kind || 'world',
        );
        if (work) rendered = true;
      }
      return rendered;
    }

    renderWorldTileWaterLayer(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      const layout = this.resolveWorldTileWaterLayerCacheLayout(tileMapView, viewport, frame, entries);
      if (!layout) return false;
      if (layout.kind === 'chunks') return this.renderWorldTileWaterChunks(tileMapView, layout.layouts, frame);
      const waterEntries = layout.entries.filter(({ tile }) => tile.water?.kind && tile.water?.asset);
      if (!waterEntries.length) return true;
      const cacheScale = this.getWorldTileStaticCacheScale();
      const frameIndex = this.getWorldTileWaterAnimationFrameIndex();
      if (!this.worldTileFastDragActive && !this.renderWorldTileWaterFrameCaches(tileMapView, layout, waterEntries, cacheScale)) {
        return false;
      }
      const work = this.getWorldTileWaterFrameCache(frameIndex);
      if (!work?.canvas) return false;
      this.worldTileWaterLayerCache = work;
      this.worldTileWaterLayerCacheKey = work.key || '';
      return this.drawWorldTileLayerCache(work, layout, frame);
    }

    renderWorldTileStaticEntries(tileMapView = {}, viewport = {}, frame = {}, entries = [], uiState = {}, options = {}) {
      const geometry = tileMapView.geometry || {};
      const scale = Number(viewport.scale) || 1;
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      entries.forEach(({ tile, center, drawRect }) => {
        const selected = uiState.selectedSiteId && tile.site?.id === uiState.selectedSiteId;
        if (tile.water?.kind && tile.water?.asset) {
          this.drawWorldTileDryTemplate(tile, drawRect);
        } else if (!this.drawWorldTileBase(tile, center, drawRect, viewport)) {
          this.drawIsoDiamond(center.x, center.y, tileWidth, tileHeight, {
            fill: this.getFallbackTerrainFill(tile.terrain),
            stroke: selected ? 'rgba(116, 211, 160, 0.78)' : 'rgba(255, 226, 177, 0.14)',
          });
        }
        if (selected) {
          this.drawIsoDiamond(center.x, center.y, tileWidth * 1.04, tileHeight * 1.04, {
            fill: 'rgba(0, 0, 0, 0)',
            stroke: 'rgba(116, 211, 160, 0.86)',
            width: 2,
          });
        }
        this.drawWorldTerrainFeature(tile, viewport, geometry, tileWidth, tileHeight);
        if (tile.feature?.asset) this.drawWorldTileFeature(tile, viewport, geometry, tileWidth, tileHeight);
      });
      entries.filter(({ tile }) => tile.site).forEach(({ tile, center }) => {
        this.drawWorldTileSite(tile, viewport, geometry, tileWidth, tileHeight, uiState, {
          center,
          addHitTarget: options.addHitTargets !== false,
        });
      });
    }

    renderWorldTileWaterEntries(tileMapView = {}, viewport = {}, entries = [], waterTimeMs = null) {
      entries.forEach(({ tile, center, drawRect }) => {
        if (!tile.water?.kind || !tile.water?.asset) return;
        this.drawWorldTileWater(tile, center, drawRect, viewport, { drawDryTemplate: false, waterTimeMs });
      });
    }

    addWorldTileSiteHitTargets(tileMapView = {}, viewport = {}, entries = [], uiState = {}) {
      const geometry = tileMapView.geometry || {};
      const scale = Number(viewport.scale) || 1;
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      entries.filter(({ tile }) => tile.site).forEach(({ tile, center }) => {
        const layout = this.getWorldTileSiteLayout(tile, viewport, geometry, tileWidth, tileHeight, center);
        if (!layout) return;
        this.addHitTarget(layout.hitRect, {
          type: 'openWorldSite',
          siteId: layout.site.id,
          tileId: tile.id,
        });
      });
    }

    renderWorldScoutRoutes(tileMapView = {}, viewport = {}) {
      const geometry = tileMapView.geometry || {};
      (tileMapView.activeScouts || []).forEach((mission) => {
        const points = (mission.route || []).map((step) => this.getWorldTileScreenCenter(step, viewport, geometry));
        if (points.length >= 2) {
          this.drawPolyline(points, {
            color: mission.status === 'ready' ? 'rgba(116, 211, 160, 0.72)' : 'rgba(240, 180, 91, 0.78)',
            width: 2,
          });
        }
        points.forEach((point, index) => {
          const step = mission.route[index] || {};
          const fill = step.revealed ? 'rgba(116, 211, 160, 0.84)' : 'rgba(240, 180, 91, 0.52)';
          this.drawPanel(point.x - 4, point.y - 4, 8, 8, {
            fill,
            stroke: 'rgba(11, 18, 14, 0.54)',
            radius: 4,
          });
        });
      });
    }

    renderWorldTileMap(tileMapView = {}, x, y, width, height, uiState = {}, options = {}) {
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
      const hitTargetsOnly = Boolean(options.hitTargetsOnly);
      const snapshotOnly = Boolean(options.snapshotOnly);
      const previousFastDragActive = this.worldTileFastDragActive;
      this.worldTileFastDragActive = Boolean(options.fastDrag);

      try {
        if (!hitTargetsOnly && options.frameless && this.ctx?.fillRect) {
          this.ctx.fillStyle = 'rgba(20, 26, 23, 0.92)';
          this.ctx.fillRect(x, y, width, height);
        } else if (!hitTargetsOnly) {
          this.drawPanel(x, y, width, height, {
            fill: this.createGradient(
              x, y, x, y + height,
              [
                [0, 'rgba(30, 43, 45, 0.88)'],
                [1, 'rgba(18, 17, 14, 0.94)'],
              ],
              'rgba(25, 31, 30, 0.92)',
            ),
            stroke: 'rgba(240, 180, 91, 0.18)',
            radius: 8,
            inset: 'rgba(255, 231, 184, 0.06)',
          });
        }
        this.addHitTarget({ x, y, width, height }, { type: 'worldMapDrag', background: true });
        if (!hitTargetsOnly && snapshotOnly) {
          this.ctx.save();
          this.ctx.beginPath();
          this.ctx.rect(x + 1, y + 1, width - 2, height - 2);
          this.ctx.clip();
          const renderedSnapshot = this.renderWorldTileSnapshotCache(tileMapView, viewport, frame);
          this.ctx.restore();
          if (renderedSnapshot) return;
          return;
        }
        const visibleEntries = this.getWorldTileRenderEntries(tileMapView, viewport, frame, geometry);
        if (hitTargetsOnly) {
          this.addWorldTileSiteHitTargets(tileMapView, viewport, visibleEntries, uiState);
          return;
        }

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(x + 1, y + 1, width - 2, height - 2);
        this.ctx.clip();

        if (!this.renderWorldScoutRouteLayer(tileMapView, viewport, frame, visibleEntries)) {
          this.renderWorldScoutRoutes(tileMapView, viewport);
        }
        if (!this.renderWorldTileWaterLayer(tileMapView, viewport, frame, visibleEntries)) {
          this.renderWorldTileWaterEntries(tileMapView, viewport, visibleEntries, this.getWorldTileWaterTimeMs());
        }
        if (!this.renderWorldTileStaticLayer(tileMapView, viewport, frame, visibleEntries, uiState)) {
          this.renderWorldTileStaticEntries(tileMapView, viewport, frame, visibleEntries, uiState, {
            addHitTargets: false,
          });
        }
        this.renderWorldTileFogMask(tileMapView, viewport, frame, visibleEntries);
        this.addWorldTileSiteHitTargets(tileMapView, viewport, visibleEntries, uiState);

        this.ctx.restore();
      } finally {
        this.worldTileFastDragActive = previousFastDragActive;
      }
    }

    renderMilitaryWorldView(state = {}, x, y, width, height, options = {}) {
      const territoryState = state.territoryState || {};
      const uiState = options.territoryUiState || {};
      const skipWorldMapLayer = Boolean(options.skipWorldMapLayer);
      const summary = this.presenter.buildTerritorySummaryViewState(territoryState);
      this.drawPanel(x, y, width, height, {
        fill: 'rgba(28, 22, 17, 0.78)',
        stroke: 'rgba(255, 226, 177, 0.12)',
        radius: 10,
      });
      this.drawText(summary.text?.polityName || '未命名势力', x + 14, y + 13, { size: 14, bold: true, color: '#f0b45b' });
      this.drawText(summary.text?.territoryCount || '0/0 已控制', x + width - 14, y + 15, {
        size: 11,
        color: '#74d3a0',
        align: 'right',
      });
      const tileMapView = this.resolveWorldTileMapView(territoryState, uiState, options);
      if (tileMapView?.tiles?.length) {
        if (this.isWorldTileMapWaterAnimated(tileMapView)) {
          uiState.tileMapWaterAnimated = true;
        }
        const mapX = x + 12;
        const mapY = y + 46;
        const mapW = width - 24;
        const mapH = Math.max(160, height - 58);
        this.renderWorldTileMap(tileMapView, mapX, mapY, mapW, mapH, uiState, {
          hitTargetsOnly: skipWorldMapLayer,
        });
        if (skipWorldMapLayer && this.ctx?.clearRect) this.ctx.clearRect(mapX, mapY, mapW, mapH);
        const resetW = 76;
        this.drawButton(mapX + mapW - resetW - 8, mapY + 8, resetW, 28, '回到本城', { size: 11, radius: 8 });
        this.addHitTarget({ x: mapX + mapW - resetW - 8, y: mapY + 8, width: resetW, height: 28 }, { type: 'resetWorldPan' });
        this.drawText(`${tileMapView.tiles.length} tiles`, mapX + 12, mapY + mapH - 14, {
          size: 10,
          color: 'rgba(246, 232, 200, 0.68)',
        });
        return;
      }

      const territories = territoryState.territories || [];
      if (!territories.length) {
        this.drawTextLines(this.wrapTextLimit('派出侦察队后，外部世界将在这里逐步显现。', width - 40, 3, { size: 13 }), x + 20, y + 70, {
          size: 13,
          color: '#cbbd96',
          lineHeight: 18,
        });
        return;
      }

      const radarView = this.presenter.buildWorldRadarViewState(territories, {
        panX: uiState.worldPanX || 0,
        panY: uiState.worldPanY || 0,
      });
      const radarSize = Math.min(width - 24, Math.max(260, Math.min(height - 68, 520)));
      const radarX = x + (width - radarSize) / 2;
      const radarY = y + 46;
      this.drawPanel(radarX, radarY, radarSize, radarSize, {
        fill: this.createGradient(
          radarX, radarY, radarX + radarSize, radarY + radarSize,
          [
            [0, 'rgba(39, 56, 42, 0.78)'],
            [1, 'rgba(18, 16, 13, 0.9)'],
          ],
          'rgba(24, 30, 24, 0.86)',
        ),
        stroke: 'rgba(240, 180, 91, 0.22)',
        radius: radarSize / 2,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.addHitTarget({ x: radarX, y: radarY, width: radarSize, height: radarSize }, { type: 'worldRadarDrag', background: true });
      this.drawLine(radarX + radarSize / 2, radarY + 12, radarX + radarSize / 2, radarY + radarSize - 12, {
        color: 'rgba(240, 180, 91, 0.16)',
      });
      this.drawLine(radarX + 12, radarY + radarSize / 2, radarX + radarSize - 12, radarY + radarSize / 2, {
        color: 'rgba(240, 180, 91, 0.16)',
      });
      this.drawText('N', radarX + radarSize / 2, radarY + 12, { size: 10, color: '#d6b16e', align: 'center' });
      this.drawText('S', radarX + radarSize / 2, radarY + radarSize - 22, { size: 10, color: '#d6b16e', align: 'center' });
      this.drawText('W', radarX + 12, radarY + radarSize / 2 - 5, { size: 10, color: '#d6b16e' });
      this.drawText('E', radarX + radarSize - 18, radarY + radarSize / 2 - 5, { size: 10, color: '#d6b16e' });

      const panX = radarView.pan?.x || 0;
      const panY = radarView.pan?.y || 0;

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(radarX + radarSize / 2, radarY + radarSize / 2, radarSize / 2 - 2, 0, Math.PI * 2);
      this.ctx.clip();

      radarView.sites.forEach((site) => {
        const left = Math.max(8, Math.min(92, Number(site.position?.left) || 50));
        const top = Math.max(8, Math.min(92, Number(site.position?.top) || 50));
        const siteX = radarX + radarSize * left / 100 - 18 + panX;
        const siteY = radarY + radarSize * top / 100 - 18 + panY;
        const isSelected = uiState.selectedSiteId === site.id;
        this.drawPanel(siteX, siteY, 36, 36, {
          fill: isSelected ? 'rgba(116, 211, 160, 0.3)' : 'rgba(42, 35, 24, 0.86)',
          stroke: isSelected ? 'rgba(116, 211, 160, 0.76)' : 'rgba(240, 180, 91, 0.3)',
          radius: 18,
          inset: 'rgba(255, 231, 184, 0.08)',
        });
        if (!this.drawAsset(site.art, siteX + 5, siteY + 5, 26, 26)) {
          this.drawText('●', siteX + 18, siteY + 18, {
            size: 14,
            color: site.owner === 'player' ? '#74d3a0' : '#f0b45b',
            baseline: 'middle',
            align: 'center',
          });
        }
        this.drawText(this.truncateText(site.name || site.title || '地点', 64, { size: 9 }), siteX + 18, siteY + 39, {
          size: 9,
          color: '#eaeaea',
          align: 'center',
        });
        this.addHitTarget({ x: siteX - 6, y: siteY - 6, width: 48, height: 54 }, { type: 'openWorldSite', siteId: site.id });
      });

      this.ctx.restore();

      const resetW = 76;
      this.drawButton(radarX + radarSize - resetW - 8, radarY + 8, resetW, 28, '回到本城', { size: 11, radius: 14 });
      this.addHitTarget({ x: radarX + radarSize - resetW - 8, y: radarY + 8, width: resetW, height: 28 }, { type: 'resetWorldPan' });
    }

    renderWorldSiteAction(actionView = {}, x, y, width) {
      const buttons = actionView.buttons || [];
      if (!buttons.length) return y;
      if (actionView.kind === 'city-command') {
        const primary = buttons.find((button) => button.action === 'enter-city') || buttons[0];
        const sideButtons = buttons.filter((button) => button !== primary).slice(0, 5);
        const primarySize = 74;
        const primaryX = x + Math.max(8, Math.floor(width * 0.26));
        const primaryY = y + 12;
        this.drawPanel(primaryX, primaryY, primarySize, primarySize, {
          fill: this.createGradient(
            primaryX, primaryY, primaryX, primaryY + primarySize,
            [
              [0, 'rgba(191, 90, 55, 0.98)'],
              [1, 'rgba(99, 35, 24, 0.98)'],
            ],
            'rgba(146, 56, 38, 0.98)',
          ),
          stroke: 'rgba(255, 218, 142, 0.86)',
          radius: primarySize / 2,
          inset: 'rgba(255, 248, 210, 0.22)',
        });
        this.drawText(primary.label || '入城', primaryX + primarySize / 2, primaryY + primarySize / 2, {
          size: 20,
          bold: true,
          color: '#ffe6b5',
          baseline: 'middle',
          align: 'center',
        });
        this.addHitTarget({ x: primaryX, y: primaryY, width: primarySize, height: primarySize }, {
          type: 'enterCity',
          territoryId: primary.territoryId,
          cityId: primary.territoryId,
          disabled: primary.disabled || !primary.action,
        });

        const commandX = Math.min(x + width - 116, primaryX + primarySize + 20);
        const commandY = y;
        sideButtons.forEach((button, index) => {
          const buttonY = commandY + index * 38;
          const type = button.action === 'rename-city'
            ? 'renameCity'
            : (button.action === 'labor-city' ? 'enterCity' : 'territoryAction');
          this.drawButton(commandX, buttonY, 108, 32, button.label, {
            size: 13,
            radius: 8,
            disabled: button.disabled || !button.action,
            active: !button.secondary && !button.disabled,
          });
          this.addHitTarget({ x: commandX, y: buttonY, width: 108, height: 32 }, {
            type,
            territoryId: button.territoryId,
            cityId: button.territoryId,
            tab: button.action === 'labor-city' ? 'people' : undefined,
            disabled: button.disabled || !button.action,
          });
        });
        return y + Math.max(primarySize + 18, sideButtons.length * 38 + 4);
      }
      const gap = 8;
      const buttonWidth = Math.max(72, (width - gap * (buttons.length - 1)) / Math.max(1, buttons.length));
      buttons.forEach((button, index) => {
        const buttonX = x + index * (buttonWidth + gap);
        this.drawButton(buttonX, y, buttonWidth, 34, button.label, {
          size: 12,
          radius: 8,
          disabled: button.disabled || !button.action,
          active: !button.secondary && !button.disabled && Boolean(button.action),
        });
        this.addHitTarget({ x: buttonX, y, width: buttonWidth, height: 34 }, {
          type: button.action === 'conquer' ? 'conquer' :
               button.action === 'launch-expedition' ? 'launchExpedition' :
               button.action === 'claim' ? 'claimConquest' :
               button.action === 'enter-battle' ? 'enterBattleScene' :
               button.action === 'enter-city' ? 'enterCity' :
               button.action === 'labor-city' ? 'enterCity' :
               button.action === 'manage-city' ? 'manageCity' :
               button.action === 'rename-city' ? 'renameCity' :
               button.action === 'open-expedition' ? 'openExpedition' :
               button.action === 'close-expedition' ? 'closeExpedition' : 'territoryAction',
          territoryId: button.territoryId,
          cityId: button.territoryId,
          tab: button.action === 'labor-city' ? 'people' : undefined,
          disabled: button.disabled || !button.action,
        });
      });
      return y + 44;
    }

    renderWorldExpeditionConfig(config = {}, x, y, width) {
      if (!config) return y;
      this.drawPanel(x, y, width, 136, {
        fill: 'rgba(0, 0, 0, 0.16)',
        stroke: 'rgba(240, 180, 91, 0.16)',
        radius: 9,
      });
      const leaderOptions = config.fields?.leader?.options || [];
      const activeLeader = leaderOptions.find((option) => option.value === config.fields?.leader?.value) || leaderOptions[0] || null;
      this.drawText(`领队 ${activeLeader?.label || '暂无可出征名人'}`, x + 12, y + 12, { size: 12, bold: true, color: '#f6e8c8' });
      const leaderY = y + 34;
      const leaderButtonWidth = Math.max(82, Math.min(118, (width - 24 - 8 * Math.max(0, leaderOptions.length - 1)) / Math.max(1, Math.min(3, leaderOptions.length || 1))));
      leaderOptions.slice(0, 3).forEach((option, index) => {
        const buttonX = x + 12 + index * (leaderButtonWidth + 8);
        const active = option.value === config.fields?.leader?.value;
        this.drawButton(buttonX, leaderY, leaderButtonWidth, 26, this.truncateText(option.label, leaderButtonWidth - 12, { size: 10 }), {
          size: 10,
          radius: 7,
          active,
          disabled: false,
        });
        this.addHitTarget({ x: buttonX, y: leaderY, width: leaderButtonWidth, height: 26 }, {
          type: 'changeExpeditionLeader',
          siteId: config.siteId,
          value: option.value,
          disabled: false,
        });
      });
      this.drawText(`出征数量 ${config.fields?.soldiers?.value || 1}`, x + 12, y + 70, { size: 12, bold: true, color: '#f6e8c8' });
      this.drawText(config.note || '', x + 12, y + 92, { size: 10, color: '#aeb0b8' });
      const value = Number(config.fields?.soldiers?.value) || 1;
      const controlsY = y + 112;
      this.drawButton(x + 12, controlsY, 34, 28, '-', { size: 14, radius: 7, disabled: value <= 1 });
      this.drawButton(x + width - 46, controlsY, 34, 28, '+', { size: 14, radius: 7 });
      this.drawButton(x + width - 132, controlsY, 78, 28, config.buttons?.launch?.label || '出发', {
        size: 12,
        radius: 7,
        disabled: config.disabled,
        active: !config.disabled,
      });
      this.addHitTarget({ x: x + 12, y: controlsY, width: 34, height: 28 }, {
        type: 'changeExpeditionSoldiers',
        siteId: config.siteId,
        delta: -1,
        value: Math.max(1, value - 1),
        disabled: value <= 1,
      });
      this.addHitTarget({ x: x + width - 46, y: controlsY, width: 34, height: 28 }, {
        type: 'changeExpeditionSoldiers',
        siteId: config.siteId,
        delta: 1,
        value: value + 1,
      });
      this.addHitTarget({ x: x + width - 132, y: controlsY, width: 78, height: 28 }, {
        type: 'launchExpedition',
        territoryId: config.siteId,
        disabled: config.disabled,
      });
      return y + 148;
    }

    renderWorldSiteModal(state = {}, options = {}) {
      if (!this.presenter || typeof this.presenter.buildWorldSiteDialogViewState !== 'function') return;
      const territoryState = state.territoryState || {};
      const territories = territoryState.territories || [];
      const uiState = options.territoryUiState || {};
      const view = this.presenter.buildWorldSiteDialogViewState(territories, territoryState, uiState);
      if (!view.showModal) return;
      const detail = view.details.find((item) => item.id === view.selectedSiteId);
      if (!detail) return;
      if (detail.action?.kind === 'city-command') {
        this.renderWorldCityCommandOverlay(detail, territories, state, options);
        return;
      }

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeWorldSite' });
      const layout = this.getLayout();
      const panelWidth = Math.min(layout.contentWidth - 24, 360);
      const panelHeight = Math.min(500, this.height - 150);
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(72, (this.height - panelHeight) / 2 - 12);
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(54, 39, 26, 0.98)'],
            [1, 'rgba(22, 18, 13, 0.98)'],
          ],
          'rgba(36, 28, 20, 0.98)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 14,
        inset: 'rgba(255, 231, 184, 0.1)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });
      const closeSize = 28;
      this.drawButton(x + panelWidth - closeSize - 10, y + 10, closeSize, closeSize, '×', { size: 16, radius: 7 });
      this.addHitTarget({ x: x + panelWidth - closeSize - 10, y: y + 10, width: closeSize, height: closeSize }, { type: 'closeWorldSite' });

      const selectedSite = territories.find((site) => site.id === detail.id) || {};
      this.drawAsset(selectedSite.art, x + 16, y + 20, 58, 58);
      this.drawText(this.truncateText(detail.text.name || '地点', panelWidth - 112, { size: 17, bold: true }), x + 84, y + 22, {
        size: 17,
        bold: true,
        color: '#ffe6b5',
      });
      this.drawText(`${detail.text.status} · ${detail.text.owner}`, x + 84, y + 50, { size: 11, color: '#aeb0b8' });
      this.drawText(`${detail.text.distance} · ${detail.text.scale} · ${detail.text.threat}`, x + 84, y + 68, { size: 11, color: '#aeb0b8' });
      let cursorY = y + 94;
      const summaryLines = this.wrapTextLimit(detail.text.summary || '无', panelWidth - 32, 3, { size: 12 });
      this.drawTextLines(summaryLines, x + 16, cursorY, { size: 12, color: '#f6e8c8', lineHeight: 17 });
      cursorY += summaryLines.length * 17 + 12;
      this.drawText(`${detail.text.defense} · ${detail.text.soldiers}`, x + 16, cursorY, { size: 12, color: '#74d3a0' });
      cursorY += 22;
      if (detail.text.defenderLeader) {
        this.drawText(detail.text.defenderLeader, x + 16, cursorY, { size: 11, color: '#ffba8a' });
        cursorY += 18;
      }
      if (detail.text.defenderSkill) {
        this.drawText(detail.text.defenderSkill, x + 16, cursorY, { size: 11, color: '#d6b16e' });
        cursorY += 18;
      }
      if (detail.text.march) {
        this.drawText(detail.text.march, x + 16, cursorY, { size: 11, color: '#d6b16e' });
        cursorY += 20;
      }
      if (detail.text.note) {
        this.drawText(detail.text.note, x + 16, cursorY, { size: 11, color: '#d6b16e' });
        cursorY += 20;
      }
      if (Array.isArray(detail.text.battleReport) && detail.text.battleReport.length) {
        detail.text.battleReport.slice(0, 4).forEach((line) => {
          const lines = this.wrapTextLimit(line, panelWidth - 32, 1, { size: 11 });
          this.drawTextLines(lines, x + 16, cursorY, { size: 11, color: '#f0b45b', lineHeight: 15 });
          cursorY += lines.length * 15 + 3;
        });
        cursorY += 6;
      }
      if (detail.action?.hint) {
        const hintLines = this.wrapTextLimit(detail.action.hint, panelWidth - 32, 2, { size: 11 });
        this.drawTextLines(hintLines, x + 16, cursorY, { size: 11, color: '#aeb0b8', lineHeight: 15 });
        cursorY += hintLines.length * 15 + 10;
      }
      cursorY = this.renderWorldSiteAction(detail.action, x + 16, cursorY, panelWidth - 32);
      if (detail.action?.expeditionConfig) {
        this.renderWorldExpeditionConfig(detail.action.expeditionConfig, x + 16, cursorY, panelWidth - 32);
      }
    }

    renderWorldCityCommandLegacyOverlay(detail = {}, territories = [], state = {}, options = {}) {
      const selectedSite = territories.find((site) => site.id === detail.id) || {};
      const layout = this.getLayout();
      const panelWidth = Math.min(layout.contentWidth - 18, 372);
      const panelHeight = 232;
      const x = Math.floor((this.width - panelWidth) / 2);
      const dockTop = this.height - 64;
      const y = Math.max(this.getTopBarBottom(state, { isMapHome: true }) + 12, dockTop - panelHeight - 14);

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeWorldSite', background: true });
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(41, 34, 25, 0.72)'],
            [1, 'rgba(18, 16, 13, 0.9)'],
          ],
          'rgba(28, 24, 18, 0.86)',
        ),
        stroke: 'rgba(255, 226, 177, 0.26)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      const closeSize = 26;
      this.drawButton(x + panelWidth - closeSize - 8, y + 8, closeSize, closeSize, 'x', { size: 13, radius: 7 });
      this.addHitTarget({ x: x + panelWidth - closeSize - 8, y: y + 8, width: closeSize, height: closeSize }, { type: 'closeWorldSite' });

      const iconSize = 46;
      this.drawAsset(selectedSite.art || 'assets/art/world-site-city-cutout.png', x + 14, y + 16, iconSize, iconSize);
      const title = detail.text?.name || selectedSite.cityName || selectedSite.naturalName || '城市';
      this.drawText(this.truncateText(title, panelWidth - 118, { size: 17, bold: true }), x + 70, y + 17, {
        size: 17,
        bold: true,
        color: '#ffe6b5',
      });
      this.drawText(`${detail.text?.status || '已占领'} · ${detail.text?.owner || '我方'}`, x + 70, y + 42, {
        size: 11,
        color: '#74d3a0',
      });
      this.drawText(this.truncateText(detail.text?.summary || detail.text?.scale || '城市可进入管理。', panelWidth - 36, { size: 11 }), x + 14, y + 76, {
        size: 11,
        color: '#d8c7a2',
      });
      if (detail.action?.hint) {
        this.drawText(this.truncateText(detail.action.hint, panelWidth - 36, { size: 10 }), x + 14, y + 96, {
          size: 10,
          color: 'rgba(234, 234, 234, 0.58)',
        });
      }
      this.renderWorldSiteAction(detail.action, x + 12, y + 118, panelWidth - 24);
    }

    getWorldCityCommandAnchor(detail = {}, territories = [], state = {}, options = {}) {
      const territoryState = state.territoryState || {};
      const uiState = options.territoryUiState || {};
      const tileMapView = this.resolveWorldTileMapView(territoryState, uiState, options);
      if (!tileMapView?.tiles?.length) return null;
      const selectedSite = territories.find((site) => site.id === detail.id) || {};
      const selectedTile = tileMapView.tiles.find((tile) => (
        tile?.site?.id === detail.id
        || tile?.siteId === detail.id
        || selectedSite.id && (tile?.siteId === selectedSite.id || tile?.site?.id === selectedSite.id)
      ));
      if (!selectedTile) return null;
      const topBarBottom = options.topBarBottom ?? this.getTopBarBottom(state, { isMapHome: true });
      const layout = this.getWorldMapLayerLayout(state, topBarBottom, { isMapHome: true });
      if (!layout?.map) return null;
      const geometry = tileMapView.geometry || {};
      const offsetX = Number(this.viewportOffsetX) || 0;
      const offsetY = Number(this.viewportOffsetY) || 0;
      const visibleWidth = Number(this.viewportWidth) || Math.max(1, this.width - offsetX * 2);
      const visibleHeight = Number(this.viewportHeight) || Math.max(1, this.height - offsetY * 2);
      const visibleMapY = Math.max(0, topBarBottom ?? 84);
      const visibleMapH = Math.max(160, visibleHeight - 64 - visibleMapY);
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
      const projectedCenter = this.getWorldTileScreenCenter(selectedTile, viewport, geometry);
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      const frame = {
        x: Number(layout.map.x) || 0,
        y: Number(layout.map.y) || 0,
        width: Number(layout.map.width) || this.width,
        height: Number(layout.map.height) || this.height,
      };
      const entries = this.getWorldTileRenderEntries(tileMapView, viewport, frame, geometry);
      const selectedEntry = entries.find(({ tile }) => (
        tile?.id === selectedTile.id
        || tile?.site?.id === detail.id
        || tile?.siteId === detail.id
      ));
      const center = selectedEntry
        ? this.getWorldTileRenderedDiamondCenter(selectedEntry.tile, selectedEntry.drawRect)
        : projectedCenter;
      const siteLayout = this.getWorldTileSiteLayout(selectedTile, viewport, geometry, tileWidth, tileHeight, projectedCenter);
      if (!siteLayout) return null;
      return {
        map: layout.map,
        site: siteLayout.site || selectedSite,
        siteLayout,
        tileCenter: center,
        tileWidth,
        tileHeight,
        anchorX: center.x,
        anchorY: center.y,
        titleY: center.y - Math.max(34, tileHeight * 0.48),
      };
    }

    getWorldSiteCanvasAnchor(siteId = '', state = {}, options = {}) {
      if (!siteId) return null;
      const territoryState = state.territoryState || {};
      const territories = territoryState.territories || [];
      const tileMapView = this.resolveWorldTileMapView(territoryState, options.territoryUiState || {}, options);
      if (!tileMapView?.tiles?.length) return null;
      const selectedSite = territories.find((site) => site.id === siteId) || {};
      const selectedTile = tileMapView.tiles.find((tile) => (
        tile?.site?.id === siteId
        || tile?.siteId === siteId
        || selectedSite.id && (tile?.siteId === selectedSite.id || tile?.site?.id === selectedSite.id)
      ));
      if (!selectedTile) return null;
      const topBarBottom = options.topBarBottom ?? this.getTopBarBottom(state, { isMapHome: true });
      const geometry = tileMapView.geometry || {};
      const offsetX = Number(this.viewportOffsetX) || 0;
      const offsetY = Number(this.viewportOffsetY) || 0;
      const visibleWidth = Number(this.viewportWidth) || Math.max(1, this.width - offsetX * 2);
      const visibleHeight = Number(this.viewportHeight) || Math.max(1, this.height - offsetY * 2);
      const visibleMapY = Math.max(0, topBarBottom ?? 84);
      const visibleMapH = Math.max(160, visibleHeight - 64 - visibleMapY);
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
      const projectedCenter = this.getWorldTileScreenCenter(selectedTile, viewport, geometry);
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      const siteLayout = this.getWorldTileSiteLayout(selectedTile, viewport, geometry, tileWidth, tileHeight, projectedCenter);
      if (!siteLayout) return null;
      return {
        ...siteLayout,
        site: siteLayout.site || selectedSite,
        tile: selectedTile,
        center: projectedCenter,
      };
    }

    getWorldCityCommandButtonAction(button = {}) {
      return {
        type: button.action === 'rename-city'
          ? 'renameCity'
          : (button.action === 'labor-city' ? 'enterCity' :
            button.action === 'enter-city' ? 'enterCity' : 'territoryAction'),
        territoryId: button.territoryId,
        cityId: button.territoryId,
        tab: button.action === 'labor-city' ? 'people' : undefined,
        disabled: button.disabled || !button.action,
      };
    }

    drawWorldCityCommandPrimaryButton(button = {}, x, y, size) {
      this.drawPanel(x, y, size, size, {
        fill: button.disabled || !button.action
          ? 'rgba(60, 52, 46, 0.78)'
          : this.createGradient(
            x, y, x, y + size,
            [
              [0, 'rgba(214, 113, 66, 0.98)'],
              [0.58, 'rgba(163, 58, 39, 0.98)'],
              [1, 'rgba(92, 30, 23, 0.98)'],
            ],
            'rgba(155, 54, 38, 0.98)',
          ),
        stroke: button.disabled || !button.action ? 'rgba(240, 180, 91, 0.28)' : 'rgba(255, 225, 150, 0.9)',
        radius: size / 2,
        inset: button.disabled || !button.action ? 'rgba(255, 231, 184, 0.08)' : 'rgba(255, 248, 210, 0.24)',
      });
      this.drawText(button.label || '入城', x + size / 2, y + size / 2, {
        size: Math.max(13, Math.floor(size * 0.27)),
        bold: true,
        color: button.disabled || !button.action ? '#8d8f99' : '#ffe6b5',
        baseline: 'middle',
        align: 'center',
      });
    }

    drawWorldCityCommandSideButton(button = {}, x, y, width, height) {
      const active = !button.secondary && !button.disabled && Boolean(button.action);
      this.drawPanel(x, y, width, height, {
        fill: button.disabled || !button.action
          ? 'rgba(44, 39, 34, 0.72)'
          : this.createGradient(
            x, y, x, y + height,
            [
              [0, active ? 'rgba(79, 55, 35, 0.96)' : 'rgba(49, 39, 28, 0.94)'],
              [1, active ? 'rgba(37, 25, 18, 0.98)' : 'rgba(29, 24, 20, 0.96)'],
            ],
            'rgba(42, 31, 23, 0.96)',
          ),
        stroke: active ? 'rgba(255, 214, 138, 0.62)' : 'rgba(240, 180, 91, 0.26)',
        radius: 5,
        inset: active ? 'rgba(255, 231, 184, 0.12)' : 'rgba(255, 231, 184, 0.06)',
      });
      this.drawText(this.truncateText(button.label || '', width - 12, { size: 12, bold: active }), x + width / 2, y + height / 2, {
        size: 12,
        bold: active,
        color: button.disabled || !button.action ? '#8d8f99' : '#f6e8c8',
        baseline: 'middle',
        align: 'center',
      });
    }

    renderWorldCityCommandOverlay(detail = {}, territories = [], state = {}, options = {}) {
      const selectedSite = territories.find((site) => site.id === detail.id) || {};
      const buttons = detail.action?.buttons || [];
      if (!buttons.length) return;
      const primary = buttons.find((button) => button.action === 'enter-city') || buttons[0];
      const renameButton = buttons.find((button) => button.action === 'rename-city') || null;
      const sideButtons = buttons.filter((button) => (
        button !== primary
        && button.action !== 'labor-city'
        && button.action !== 'rename-city'
      )).slice(0, 5);
      const anchor = this.getWorldCityCommandAnchor(detail, territories, state, options);
      if (!anchor) {
        const width = Math.min(this.getLayout().contentWidth - 24, 320);
        const x = Math.max(12, (this.width - width) / 2);
        const y = Math.max(this.getTopBarBottom(state, { isMapHome: true }) + 16, this.height - 260);
        this.renderWorldSiteAction({ ...detail.action, buttons: [primary, ...sideButtons] }, x, y, width);
        return;
      }

      const topLimit = Math.max(4, Number(anchor.map?.y) || this.getTopBarBottom(state, { isMapHome: true }) || 84);
      const bottomLimit = Math.max(topLimit + 120, Math.min(this.height - 66 - this.bottomSafeArea, (Number(anchor.map?.y) || 0) + (Number(anchor.map?.height) || this.height)));
      const primarySize = Math.max(41, Math.min(52, (Number(anchor.siteLayout?.drawW) || 110) * 0.5));
      const sideWidth = Math.min(88, Math.max(73, this.width * 0.2));
      const sideHeight = 27;
      const sideGap = 5;
      const sideTotalHeight = sideButtons.length * sideHeight + Math.max(0, sideButtons.length - 1) * sideGap;
      const clusterHeight = Math.max(primarySize, sideTotalHeight || primarySize);
      const hudLift = clusterHeight / 3;
      const gap = 8;
      const clusterWidth = primarySize + gap + (sideButtons.length ? sideWidth : 0);
      const preferRight = anchor.anchorX + clusterWidth * 0.5 + 8 <= this.width;
      const sideOnRight = preferRight || anchor.anchorX - clusterWidth * 0.5 - 8 < 0;
      const primaryXRaw = anchor.anchorX - primarySize * 0.5;
      const primaryYRaw = anchor.anchorY - hudLift - primarySize * 0.5;
      const minPrimaryX = sideOnRight ? 8 : sideWidth + gap + 8;
      const maxPrimaryX = sideOnRight ? this.width - clusterWidth - 8 : this.width - primarySize - 8;
      const primaryX = Math.max(minPrimaryX, Math.min(primaryXRaw, Math.max(minPrimaryX, maxPrimaryX)));
      const primaryY = Math.max(topLimit + 38, Math.min(primaryYRaw, bottomLimit - primarySize - 8));
      const sideX = sideOnRight ? primaryX + primarySize + gap : primaryX - sideWidth - gap;
      const sideYRaw = primaryY + (primarySize - sideTotalHeight) / 2;
      const sideY = Math.max(topLimit + 8, Math.min(sideYRaw, bottomLimit - sideTotalHeight - 8));
      const title = detail.text?.name || selectedSite.cityName || selectedSite.naturalName || '城市';
      const renameWidth = renameButton ? 38 : 0;
      const titleWidth = this.measureTextWidth(title, { size: 12, bold: true });
      const badgeWidth = Math.min(190, Math.max(98, titleWidth + renameWidth + 30));
      const badgeX = Math.max(8, Math.min(anchor.anchorX - badgeWidth / 2, this.width - badgeWidth - 8));
      const titleGap = Math.max(9, primarySize * 0.22);
      const badgeYRaw = Math.min(anchor.titleY - 25 - hudLift, Math.min(primaryY, sideY) - 24 - titleGap);
      const badgeY = Math.max(topLimit + 6, Math.min(badgeYRaw, bottomLimit - 30));

      this.drawPanel(badgeX, badgeY, badgeWidth, 24, {
        fill: 'rgba(18, 16, 13, 0.78)',
        stroke: 'rgba(116, 211, 160, 0.42)',
        radius: 6,
        inset: 'rgba(255, 231, 184, 0.06)',
      });
      const titleMaxWidth = badgeWidth - renameWidth - 22;
      this.drawText(this.truncateText(title, titleMaxWidth, { size: 12, bold: true }), badgeX + 12 + titleMaxWidth / 2, badgeY + 12, {
        size: 12,
        bold: true,
        color: '#ffe6b5',
        baseline: 'middle',
        align: 'center',
      });
      if (renameButton) {
        const renameX = badgeX + badgeWidth - renameWidth - 7;
        const renameY = badgeY + 4;
        this.drawText('改名', renameX + renameWidth / 2, badgeY + 12, {
          size: 10,
          color: renameButton.disabled || !renameButton.action ? '#8d8f99' : '#74d3a0',
          baseline: 'middle',
          align: 'center',
        });
        this.addHitTarget({ x: renameX - 4, y: renameY - 4, width: renameWidth + 8, height: 24 }, this.getWorldCityCommandButtonAction(renameButton));
      }

      this.drawCircle(anchor.anchorX, anchor.anchorY - hudLift, Math.max(12, primarySize * 0.32), {
        fill: 'rgba(116, 211, 160, 0.08)',
        stroke: 'rgba(116, 211, 160, 0.42)',
        width: 2,
      });
      this.drawWorldCityCommandPrimaryButton(primary, primaryX, primaryY, primarySize);
      this.addHitTarget({ x: primaryX, y: primaryY, width: primarySize, height: primarySize }, this.getWorldCityCommandButtonAction(primary));

      sideButtons.forEach((button, index) => {
        const buttonY = sideY + index * (sideHeight + sideGap);
        this.drawWorldCityCommandSideButton(button, sideX, buttonY, sideWidth, sideHeight);
        this.addHitTarget({ x: sideX, y: buttonY, width: sideWidth, height: sideHeight }, this.getWorldCityCommandButtonAction(button));
      });
    }

    renderTutorialIntro(state = {}, options = {}) {
      const intro = options.tutorialIntro || null;
      if (!intro?.active || !this.ctx) {
        this.disposeTutorialAdvisorSpine();
        return false;
      }
      const target = this.resolveTutorialIntroTarget(intro, state, options);
      if (!target) {
        this.disposeTutorialAdvisorSpine();
        return false;
      }
      if (intro.step === 'march') {
        this.disposeTutorialAdvisorSpine();
        this.renderTutorialIntroMarch(intro, target);
        return true;
      }
      const message = intro.messages?.[intro.step] || '';
      this.renderTutorialIntroSpotlight(target, message, {
        showAdvisor: true,
        advisorName: intro.advisorName || '谋士',
      });
      return true;
    }

    disposeTutorialAdvisorSpine() {
      const existing = this.tutorialAdvisorSpine;
      if (!existing) return false;
      existing.player?.dispose?.();
      existing.player?.stop?.();
      this.tutorialAdvisorSpine = null;
      this.h5Runtime?.setLayerVisible?.('tutorialSpine', false);
      return true;
    }

    resolveTutorialIntroTarget(intro = {}, state = {}, options = {}) {
      const capitalCityId = intro.capitalCityId || state.cityState?.capitalCityId || 'capital';
      if (intro.step === 'enter') {
        const target = this.findHitTarget('enterCity', (action) => {
          const cityId = action.cityId || action.territoryId || action.siteId || '';
          return !cityId || cityId === capitalCityId;
        });
        if (target) return this.inflateRect(target, 10);
        return null;
      }
      const hitTarget = this.findHitTarget('openWorldSite', (action) => action.siteId === capitalCityId);
      if (hitTarget) return this.inflateRect(hitTarget, intro.step === 'march' ? 0 : 12);
      const anchor = this.getWorldSiteCanvasAnchor(capitalCityId, state, options);
      if (!anchor) return null;
      return this.inflateRect(anchor.hitRect, intro.step === 'march' ? 0 : 12);
    }

    findHitTarget(type = '', predicate = null) {
      if (!Array.isArray(this.hitTargets)) return null;
      for (let index = this.hitTargets.length - 1; index >= 0; index -= 1) {
        const target = this.hitTargets[index];
        const action = target?.action || {};
        if (action.type !== type) continue;
        if (typeof predicate === 'function' && !predicate(action)) continue;
        return target;
      }
      return null;
    }

    inflateRect(rect = {}, padding = 0) {
      const pad = Number(padding) || 0;
      const x = Number(rect.x ?? rect.left) || 0;
      const y = Number(rect.y ?? rect.top) || 0;
      const width = Number(rect.width) || 0;
      const height = Number(rect.height) || 0;
      return {
        x: x - pad,
        y: y - pad,
        width: width + pad * 2,
        height: height + pad * 2,
        action: rect.action || null,
      };
    }

    renderTutorialIntroMarch(intro = {}, target = {}) {
      this.addHitTarget(
        { x: 0, y: 0, width: this.width, height: this.height },
        { type: 'blockCanvasModal' },
      );
      const now = this.getNow();
      const startedAt = Number(intro.startedAt) || now;
      const duration = Math.max(1, Number(intro.marchDurationMs) || 2400);
      const progress = Math.max(0, Math.min(1, (now - startedAt) / duration));
      const eased = this.easeOutCubic(progress);
      const targetX = target.x + target.width / 2;
      const targetY = target.y + target.height * 0.72;
      const startX = Math.max(18, targetX - Math.min(this.width * 0.46, 210));
      const startY = Math.min(this.height - 86, targetY + Math.min(this.height * 0.24, 128));
      const x = startX + (targetX - startX) * eased;
      const y = startY + (targetY - startY) * eased;

      this.ctx.save?.();
      this.ctx.strokeStyle = 'rgba(240, 180, 91, 0.44)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath?.();
      this.ctx.moveTo?.(startX, startY);
      this.ctx.quadraticCurveTo?.((startX + targetX) / 2, startY - 30, targetX, targetY);
      this.ctx.stroke?.();
      this.renderTutorialIntroUnit(x, y, 1 + eased * 0.16);
      this.ctx.restore?.();
    }

    renderTutorialIntroUnit(x, y, scale = 1) {
      const ctx = this.ctx;
      if (!ctx) return;
      const now = this.getNow();
      const leg = Math.sin(now / 90) * 4 * scale;
      ctx.save?.();
      ctx.translate?.(x, y);
      ctx.scale?.(scale, scale);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
      ctx.beginPath?.();
      ctx.ellipse?.(0, 10, 15, 6, -0.18, 0, Math.PI * 2);
      ctx.fill?.();
      ctx.fillStyle = '#f0cf8a';
      ctx.strokeStyle = 'rgba(45, 31, 22, 0.92)';
      ctx.lineWidth = 2;
      ctx.beginPath?.();
      ctx.arc?.(0, -20, 7, 0, Math.PI * 2);
      ctx.fill?.();
      ctx.stroke?.();
      ctx.fillStyle = '#8c3d31';
      ctx.strokeStyle = 'rgba(48, 34, 22, 0.92)';
      ctx.lineWidth = 2;
      this.roundRectPath(-9, -12, 18, 23, 6);
      ctx.fill?.();
      ctx.stroke?.();
      ctx.strokeStyle = '#2c2318';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath?.();
      ctx.moveTo?.(-5, 10);
      ctx.lineTo?.(-7 + leg, 22);
      ctx.moveTo?.(5, 10);
      ctx.lineTo?.(7 - leg, 22);
      ctx.stroke?.();
      ctx.strokeStyle = '#d9bd73';
      ctx.lineWidth = 3;
      ctx.beginPath?.();
      ctx.moveTo?.(7, -7);
      ctx.lineTo?.(19, -14);
      ctx.stroke?.();
      ctx.restore?.();
    }

    renderTutorialIntroSpotlight(target = {}, message = '', options = {}) {
      const rect = this.normalizeRect(target);
      if (!rect) return false;
      const pulse = 0.5 + Math.sin(this.getNow() / 180) * 0.5;
      this.addTutorialShield(
        { left: rect.x, top: rect.y, width: rect.width, height: rect.height },
        { allowedAction: target.action || null },
      );
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
      this.ctx.fillRect(0, 0, this.width, rect.y);
      this.ctx.fillRect(0, rect.y + rect.height, this.width, Math.max(0, this.height - rect.y - rect.height));
      this.ctx.fillRect(0, rect.y, rect.x, rect.height);
      this.ctx.fillRect(rect.x + rect.width, rect.y, Math.max(0, this.width - rect.x - rect.width), rect.height);
      this.drawPanel(rect.x, rect.y, rect.width, rect.height, {
        fill: `rgba(255, 247, 214, ${0.06 + pulse * 0.04})`,
        stroke: `rgba(255, 215, 0, ${0.72 + pulse * 0.22})`,
        radius: 14,
        inset: 'rgba(255, 247, 214, 0.14)',
      });
      this.renderTutorialIntroFinger(rect.x + rect.width * 0.78, rect.y + rect.height * 0.88);
      if (options.showAdvisor) this.renderTutorialIntroDialogue(message, options.advisorName || '谋士');
      return true;
    }

    normalizeRect(rect = {}) {
      const x = Math.max(0, Math.min(this.width, Number(rect.x ?? rect.left) || 0));
      const y = Math.max(0, Math.min(this.height, Number(rect.y ?? rect.top) || 0));
      const width = Math.max(1, Math.min(this.width - x, Number(rect.width) || 0));
      const height = Math.max(1, Math.min(this.height - y, Number(rect.height) || 0));
      return { x, y, width, height };
    }

    renderTutorialIntroFinger(x, y) {
      const pulse = 0.5 + Math.sin(this.getNow() / 180) * 0.5;
      this.ctx.save?.();
      this.ctx.translate?.(x + pulse * 5, y - pulse * 7);
      this.ctx.rotate?.(-0.55);
      this.ctx.strokeStyle = `rgba(255, 226, 168, ${0.56 + pulse * 0.28})`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath?.();
      this.ctx.arc?.(0, 0, 18 + pulse * 8, 0, Math.PI * 2);
      this.ctx.stroke?.();
      this.ctx.fillStyle = 'rgba(255, 235, 183, 0.96)';
      this.ctx.strokeStyle = 'rgba(80, 52, 22, 0.72)';
      this.ctx.lineWidth = 2.2;
      this.ctx.lineJoin = 'round';
      this.ctx.lineCap = 'round';
      this.ctx.beginPath?.();
      this.ctx.moveTo?.(-5, -24);
      this.ctx.quadraticCurveTo?.(-1, -31, 6, -26);
      this.ctx.lineTo?.(12, -4);
      this.ctx.quadraticCurveTo?.(17, -9, 22, -5);
      this.ctx.quadraticCurveTo?.(26, -1, 22, 6);
      this.ctx.lineTo?.(16, 22);
      this.ctx.quadraticCurveTo?.(10, 31, -2, 29);
      this.ctx.lineTo?.(-15, 25);
      this.ctx.quadraticCurveTo?.(-22, 23, -19, 17);
      this.ctx.quadraticCurveTo?.(-15, 13, -8, 14);
      this.ctx.lineTo?.(-5, -24);
      this.ctx.closePath?.();
      this.ctx.fill?.();
      this.ctx.stroke?.();
      this.ctx.strokeStyle = 'rgba(128, 83, 34, 0.38)';
      this.ctx.lineWidth = 1.5;
      [
        [-1, -5, 3, 14],
        [6, -4, 9, 15],
        [13, 2, 12, 17],
      ].forEach((line) => {
        this.ctx.beginPath?.();
        this.ctx.moveTo?.(line[0], line[1]);
        this.ctx.lineTo?.(line[2], line[3]);
        this.ctx.stroke?.();
      });
      this.ctx.restore?.();
    }

    renderTutorialIntroDialogue(message = '', advisorName = '谋士') {
      const layout = this.getLayout();
      const panelW = Math.min(layout.contentWidth - 16, 360);
      const panelH = 136;
      const panelX = layout.contentX + Math.max(0, (layout.contentWidth - panelW) / 2);
      const panelY = Math.max(84, this.height - panelH - 76 - this.bottomSafeArea);
      const portraitW = Math.min(188, Math.max(134, layout.contentWidth * 0.42));
      const portraitH = Math.min(330, Math.max(248, this.height * 0.38));
      const portraitX = Math.max(layout.contentX - 72, panelX + 104 - portraitW);
      const portraitY = Math.max(48, panelY - portraitH + 44);

      this.drawPanel(panelX + 92, panelY, panelW - 92, panelH, {
        fill: 'rgba(23, 17, 12, 0.94)',
        stroke: 'rgba(246, 214, 147, 0.3)',
        radius: 8,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.renderTutorialIntroAdvisorPortrait(portraitX, portraitY, portraitW, portraitH);
      this.drawText(advisorName, panelX + 116, panelY + 24, {
        size: 14,
        bold: true,
        color: '#ffd98a',
      });
      const lines = this.wrapTextLimit(message, panelW - 138, 3, { size: 13 });
      this.drawTextLines(lines, panelX + 116, panelY + 46, {
        size: 13,
        color: '#f7ecd0',
        lineHeight: 18,
      });
    }

    renderTutorialIntroAdvisorPortrait(x, y, width, height) {
      if (this.renderTutorialAdvisorSpineLayer(x, y, width, height)) return true;
      const spineFrame = this.getTutorialAdvisorSpineFrame();
      if (spineFrame && typeof this.ctx.drawImage === 'function') {
        this.ctx.save?.();
        this.ctx.beginPath?.();
        this.ctx.rect?.(x, y, width, height);
        this.ctx.clip?.();
        this.drawTutorialAdvisorImageCover(spineFrame, 0, 0, spineFrame.width, spineFrame.height, x, y, width, height);
        this.ctx.restore?.();
        return true;
      }
      const image = this.getAsset('assets/art/spine/tutorial/advisor/tutorial_advisor.png');
      this.ctx.save?.();
      this.ctx.beginPath?.();
      this.ctx.rect?.(x, y, width, height);
      this.ctx.clip?.();
      if (image && typeof this.ctx.drawImage === 'function') {
        this.drawTutorialAdvisorImageCover(
          image,
          0,
          0,
          image.naturalWidth || image.width,
          Math.min(1120, image.naturalHeight || image.height),
          x,
          y,
          width,
          height,
        );
      } else {
        this.drawPanel(x + 8, y + 20, width - 16, height - 22, {
          fill: 'rgba(48, 37, 28, 0.92)',
          stroke: 'rgba(255, 218, 142, 0.28)',
          radius: 10,
        });
        this.drawText('谋士', x + width / 2, y + height / 2, {
          size: 15,
          bold: true,
          color: '#ffd98a',
          align: 'center',
          baseline: 'middle',
        });
      }
      this.ctx.restore?.();
      return false;
    }

    renderTutorialAdvisorSpineLayer(x, y, width, height) {
      const runtime = this.h5Runtime || null;
      if (!runtime?.ensureLayerCanvas || !global.SpineWebglPlayer?.isAvailable?.()) return false;
      const pixelRatio = Math.min(2, Math.max(1, Number(global.devicePixelRatio) || 1));
      const layerRect = {
        x: Math.max(-24, Math.floor(Number(x) || 0)),
        y: Math.max(0, Math.floor(Number(y) || 0)),
        width: Math.max(1, Math.ceil(Number(width) || 1)),
        height: Math.max(1, Math.ceil(Number(height) || 1)),
      };
      const canvas = runtime.ensureLayerCanvas('tutorialSpine', {
        contextType: 'webgl',
        zIndex: 1000,
        pixelRatio,
        rect: layerRect,
      });
      if (!canvas) return false;
      runtime.setLayerVisible?.('tutorialSpine', true);
      const metrics = runtime.getLayerMetrics?.('tutorialSpine') || {};
      const logicalWidth = metrics.width || layerRect.width;
      const logicalHeight = metrics.height || layerRect.height;
      const existing = this.tutorialAdvisorSpine;
      if (existing?.mode === 'layer' && existing?.player && existing.canvas === canvas) {
        return existing.player.status === 'ready' || existing.player.status === 'loading';
      }
      existing?.player?.dispose?.();
      const player = new global.SpineWebglPlayer({
        canvas,
        runtime: global,
        background: null,
        fitPadding: 1,
        targetFps: 60,
        logicalWidth,
        logicalHeight,
        maxDevicePixelRatio: pixelRatio,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        viewFocus: {
          centerX: 0,
          centerY: 1080,
          height: 900,
        },
        onError: () => {
          this.tutorialAdvisorSpineFailed = true;
          runtime.setLayerVisible?.('tutorialSpine', false);
        },
        onStatus: (event = {}) => {
          if (event.status === 'ready') this.handleAssetsChanged();
        },
      });
      this.tutorialAdvisorSpine = { canvas, player, mode: 'layer' };
      const loaded = player.load({
        assetBase: 'assets/art/spine/tutorial/advisor/',
        jsonFile: 'tutorial_advisor.json',
        atlasFile: 'tutorial_advisor.atlas',
        animationName: 'animation',
        loop: true,
        alpha: true,
        antialias: true,
        targetFps: 60,
        logicalWidth,
        logicalHeight,
        maxDevicePixelRatio: pixelRatio,
        preserveDrawingBuffer: false,
        viewFocus: {
          centerX: 0,
          centerY: 1080,
          height: 900,
        },
      });
      if (!loaded) {
        this.tutorialAdvisorSpineFailed = true;
        this.tutorialAdvisorSpine = null;
        runtime.setLayerVisible?.('tutorialSpine', false);
        return false;
      }
      return true;
    }

    drawTutorialAdvisorImageCover(image, sx, sy, sw, sh, dx, dy, dw, dh) {
      if (!image || typeof this.ctx?.drawImage !== 'function') return false;
      let sourceX = Number(sx) || 0;
      let sourceY = Number(sy) || 0;
      let sourceW = Math.max(1, Number(sw) || image.width || image.naturalWidth || 1);
      let sourceH = Math.max(1, Number(sh) || image.height || image.naturalHeight || 1);
      const targetW = Math.max(1, Number(dw) || 1);
      const targetH = Math.max(1, Number(dh) || 1);
      const sourceAspect = sourceW / sourceH;
      const targetAspect = targetW / targetH;
      if (sourceAspect > targetAspect) {
        const nextW = sourceH * targetAspect;
        sourceX += (sourceW - nextW) * 0.5;
        sourceW = nextW;
      } else if (sourceAspect < targetAspect) {
        const nextH = sourceW / targetAspect;
        sourceY += Math.max(0, (sourceH - nextH) * 0.08);
        sourceH = nextH;
      }
      this.ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, dx, dy, targetW, targetH);
      return true;
    }

    getTutorialAdvisorSpineFrame() {
      if (this.tutorialAdvisorSpineFailed) return null;
      const existing = this.tutorialAdvisorSpine;
      if (existing?.player?.status === 'ready' && existing.canvas) return existing.canvas;
      if (existing) return null;
      if (!global.SpineWebglPlayer?.isAvailable?.()) {
        this.tutorialAdvisorSpineFailed = true;
        return null;
      }
      const canvas = this.createTutorialSpineCanvas(288, 420);
      if (!canvas) {
        this.tutorialAdvisorSpineFailed = true;
        return null;
      }
      const player = new global.SpineWebglPlayer({
        canvas,
        runtime: global,
        background: null,
        fitPadding: 1,
        targetFps: 30,
        logicalWidth: 288,
        logicalHeight: 420,
        maxDevicePixelRatio: 1,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
        viewFocus: {
          centerX: 0,
          centerY: 1080,
          height: 900,
        },
        onError: () => {
          this.tutorialAdvisorSpineFailed = true;
        },
        onStatus: (event = {}) => {
          if (event.status === 'ready') this.handleAssetsChanged();
        },
      });
      this.tutorialAdvisorSpine = { canvas, player };
      const loaded = player.load({
        assetBase: 'assets/art/spine/tutorial/advisor/',
        jsonFile: 'tutorial_advisor.json',
        atlasFile: 'tutorial_advisor.atlas',
        animationName: 'animation',
        loop: true,
        alpha: true,
        antialias: false,
        targetFps: 30,
        logicalWidth: 288,
        logicalHeight: 420,
        maxDevicePixelRatio: 1,
        preserveDrawingBuffer: true,
        viewFocus: {
          centerX: 0,
          centerY: 1080,
          height: 900,
        },
      });
      if (!loaded) {
        this.tutorialAdvisorSpineFailed = true;
        this.tutorialAdvisorSpine = null;
      }
      return null;
    }

    renderMilitary(state = {}, startY = 210, panelHeight = 310, options = {}) {
      if (!this.presenter) return;
      const nav = this.presenter.buildMilitaryNavigationViewState(state);
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      this.drawPanel(x, startY, width, panelHeight, {
        fill: 'rgba(37, 29, 21, 0.88)',
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.renderSectionHeader('军事', x + 14, startY + 14, '🛡️');
      const contentTop = this.renderMilitarySubTabs(nav, x + 12, startY + 42, width - 24);
      const viewY = contentTop;
      const viewHeight = Math.max(120, startY + panelHeight - viewY - 12);
      if (nav.activeView === 'scout') {
        this.renderMilitaryScoutView(this.presenter.buildScoutControlViewState(state), x + 12, viewY, width - 24, viewHeight);
      } else if (nav.activeView === 'world') {
        this.renderMilitaryWorldView(state, x + 12, viewY, width - 24, viewHeight, options);
      } else {
        this.renderMilitaryArmyView(this.presenter.buildMilitaryViewState(state), x + 12, viewY, width - 24, viewHeight);
      }
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

    renderAdvisor(state = {}) {
      if (!this.presenter) return;
      const view = this.presenter.buildAdvisorViewState(state.softGuide);
      if (view.hidden || !view.activeAdvisor) return;
      const layout = this.getLayout();
      const width = layout.contentWidth;
      const x = layout.contentX;
      const y = this.height - 132 - this.bottomSafeArea;
      this.drawPanel(x, y, width, 44, {
        fill: 'rgba(42, 35, 24, 0.94)',
        stroke: 'rgba(240, 180, 91, 0.24)',
        radius: 10,
      });
      this.drawText('顾问', x + 12, y + 13, { color: '#ffd98a', size: 14, bold: true });
      this.drawText(view.activeAdvisor.message, x + 64, y + 13, { color: '#f6e8c8', size: 12 });
    }

    getMapHomeFloatingButtonLayout(slot = 0) {
      const layout = this.getLayout();
      const size = 48;
      const dockTop = this.height - 64;
      const x = layout.contentRight - size - 8;
      const gap = 10;
      const y = Math.max(82, dockTop - (slot + 1) * size - 14 - slot * gap);
      return { x, y, size };
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

    renderFloatingAdvisorButton(state = {}, options = {}) {
      const { x, y, size } = this.getMapHomeFloatingButtonLayout(0);
      const view = this.presenter?.buildAdvisorViewState?.(state.softGuide) || { hidden: true };
      const hasAdvice = Boolean(!view.hidden && view.activeAdvisor);
      this.drawPanel(x, y, size, size, {
        fill: hasAdvice ? 'rgba(82, 58, 34, 0.94)' : 'rgba(34, 31, 25, 0.82)',
        stroke: hasAdvice ? 'rgba(247, 215, 116, 0.56)' : 'rgba(255, 226, 177, 0.18)',
        radius: size / 2,
        inset: hasAdvice ? 'rgba(255, 231, 184, 0.16)' : 'rgba(255, 231, 184, 0.06)',
      });
      if (hasAdvice) {
        this.drawPanel(x + size - 15, y + 5, 10, 10, {
          fill: '#74d3a0',
          stroke: 'rgba(18, 16, 13, 0.72)',
          radius: 5,
        });
      }
      this.drawText('顾问', x + size / 2, y + 26, {
        size: 12,
        bold: true,
        color: hasAdvice ? '#f0b45b' : '#aeb0b8',
        baseline: 'middle',
        align: 'center',
      });
      this.addHitTarget({ x, y, width: size, height: size }, { type: 'openAdvisor' });
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

    getActiveCitySummary(state = {}) {
      const cityState = state.cityState || {};
      const cities = Array.isArray(cityState.cities) ? cityState.cities : [];
      const activeCityId = state.activeCityId || cityState.activeCityId || cityState.capitalCityId || 'capital';
      const city = cities.find((item) => item.id === activeCityId) || cities[0] || {};
      const territories = state.territoryState?.territories || [];
      const site = territories.find((item) => item.id === activeCityId) || {};
      return {
        id: activeCityId,
        name: city.name || site.cityName || site.naturalName || (activeCityId === 'capital' ? '首都' : '城市'),
        tag: city.isCapital || activeCityId === 'capital' ? '主城' : '分城',
        level: city.level || site.level || '',
        population: city.population || state.population || {},
        military: city.military || state.military || {},
        terrainLabel: city.planning?.terrainLabel || city.terrainLabel || site.terrainLabel || '平原',
      };
    }

    renderCityManagementPanel(state = {}, options = {}) {
      const layout = this.getLayout();
      const dockTop = this.height - 64;
      const top = Math.max(82, this.getTopBarBottom(state, { isMapHome: true }) + 8);
      const panelHeight = Math.max(360, dockTop - top - 10);
      const x = layout.contentX;
      const y = dockTop - panelHeight - 8;
      const width = layout.contentWidth;
      const city = this.getActiveCitySummary(state);
      const activeTab = ['buildings', 'people', 'military'].includes(options.activeCityManagementTab)
        ? options.activeCityManagementTab
        : 'buildings';

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeCityManagement', background: true });
      this.drawPanel(x, y, width, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(49, 40, 30, 0.97)'],
            [1, 'rgba(16, 15, 12, 0.98)'],
          ],
          'rgba(31, 26, 20, 0.97)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 12,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.addHitTarget({ x, y, width, height: panelHeight }, { type: 'blockCanvasModal' });

      const closeSize = 28;
      this.drawText(this.truncateText(city.name, width - 132, { size: 18, bold: true }), x + 16, y + 14, {
        size: 18,
        bold: true,
        color: '#ffe6b5',
      });
      const meta = `${city.tag}${city.level ? ` · ${city.level}级` : ''} · ${city.terrainLabel}`;
      this.drawText(meta, x + 16, y + 40, { size: 11, color: '#cbbd96' });
      this.drawButton(x + width - closeSize - 10, y + 10, closeSize, closeSize, 'x', { size: 14, radius: 7 });
      this.addHitTarget({ x: x + width - closeSize - 10, y: y + 10, width: closeSize, height: closeSize }, { type: 'closeCityManagement' });

      const tabs = [
        { id: 'buildings', label: '建设' },
        { id: 'people', label: '人才' },
        { id: 'military', label: '军事' },
      ];
      const tabY = y + 64;
      const gap = 6;
      const tabWidth = Math.floor((width - 32 - gap * (tabs.length - 1)) / tabs.length);
      tabs.forEach((tab, index) => {
        const tabX = x + 16 + index * (tabWidth + gap);
        const active = tab.id === activeTab;
        this.drawButton(tabX, tabY, tabWidth, 30, tab.label, { size: 12, bold: active, active, radius: 8 });
        this.addHitTarget({ x: tabX, y: tabY, width: tabWidth, height: 30 }, { type: 'switchCityManagementTab', tab: tab.id });
      });

      const contentTop = tabY + 40;
      const contentHeight = Math.max(180, panelHeight - (contentTop - y) - 12);
      if (activeTab === 'buildings') {
        this.renderBuildings(state, contentTop, contentHeight, {
          ...options,
          offset: options.buildingOffset,
          buildingTransition: options.buildingTransition,
          activeBuildingCategory: options.activeBuildingCategory,
        });
      } else if (activeTab === 'people') {
        this.renderPopulation(state, contentTop);
      } else {
        this.renderCityMilitaryPanel(state, city, x + 12, contentTop, width - 24, contentHeight);
      }
    }

    renderCityMilitaryPanel(state = {}, city = {}, x, y, width, height) {
      this.drawPanel(x, y, width, height, {
        fill: 'rgba(28, 24, 18, 0.76)',
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.05)',
      });
      const soldiers = Number(city.military?.soldiers ?? state.military?.soldiers ?? 0) || 0;
      const available = Number(state.territoryState?.availableSoldiers ?? soldiers) || 0;
      const compactFormation = height < 232;
      this.drawAsset('assets/art/icon-soldier-cutout.webp', x + 16, y + 18, 38, 38);
      this.drawText('驻军', x + 66, y + 17, { size: 16, bold: true, color: '#ffe6b5' });
      this.drawText(`当前兵力 ${soldiers} · 可调兵力 ${available}`, x + 66, y + 42, { size: 12, color: '#cbbd96' });
      const rows = [
        { label: '行军', note: '从本城发起部队行动', disabled: true },
        { label: '调动', note: '城市之间调配驻军', disabled: true },
        { label: '驻守', note: '设置防守与巡逻队列', disabled: true },
      ];
      const formationSectionHeight = compactFormation
        ? Math.min(80, Math.max(64, Math.floor(height * 0.34)))
        : Math.min(166, Math.max(132, Math.floor(height * 0.48)));
      const formationX = x + 12;
      const formationWidth = width - 24;
      const formationY = Math.max(y + 138, y + height - formationSectionHeight - 10);
      const rowTop = y + 72;
      const rowGap = 6;
      const rowAreaHeight = Math.max(72, formationY - rowTop - 8);
      const rowHeight = Math.max(26, Math.min(38, Math.floor((rowAreaHeight - rowGap * (rows.length - 1)) / rows.length)));
      rows.forEach((row, index) => {
        const rowY = rowTop + index * (rowHeight + rowGap);
        this.drawPanel(x + 12, rowY, width - 24, rowHeight, {
          fill: 'rgba(43, 35, 26, 0.82)',
          stroke: 'rgba(255, 226, 177, 0.12)',
          radius: 8,
        });
        this.drawText(row.label, x + 26, rowY + 7, { size: 13, bold: true, color: '#fff1cf' });
        this.drawText(row.note, x + 26, rowY + rowHeight - 13, { size: 9, color: 'rgba(234, 234, 234, 0.58)' });
        this.drawButton(x + width - 82, rowY + Math.max(4, (rowHeight - 24) / 2), 58, 24, '待开放', { size: 10, radius: 7, disabled: true });
      });

      const formationView = this.presenter?.buildMilitaryViewState?.({
        ...state,
        activeCityId: city.id || state.activeCityId,
        cityState: {
          ...(state.cityState || {}),
          activeCityId: city.id || state.cityState?.activeCityId,
        },
      }) || {};
      if (compactFormation) {
        const compactGap = 8;
        const compactCardY = formationY + 24;
        const compactCardHeight = Math.max(38, y + height - compactCardY - 8);
        const compactCardWidth = Math.floor((formationWidth - compactGap * 2) / 3);
        this.drawText('编队', formationX, formationY + 5, { size: 14, bold: true, color: '#ffe6b5' });
        this.drawText('每队最多 5 名名人', formationX + 44, formationY + 7, { size: 10, color: '#cbbd96' });
        (formationView.formations || [{}, {}, {}]).slice(0, 3).forEach((formation, index) => {
          const cardX = formationX + index * (compactCardWidth + compactGap);
          const cardWidth = index === 2 ? formationX + formationWidth - cardX : compactCardWidth;
          const count = Array.isArray(formation.members) ? formation.members.length : 0;
          this.drawPanel(cardX, compactCardY, cardWidth, compactCardHeight, {
            fill: count ? 'rgba(55, 40, 29, 0.92)' : 'rgba(38, 33, 28, 0.86)',
            stroke: count ? 'rgba(240, 180, 91, 0.34)' : 'rgba(255, 226, 177, 0.14)',
            radius: 7,
          });
          this.drawText(this.truncateText(formation.name || `部队${index + 1}`, cardWidth - 12, { size: 11, bold: true }), cardX + cardWidth / 2, compactCardY + 9, {
            size: 11,
            bold: true,
            color: '#fff1cf',
            align: 'center',
          });
          this.drawText(`${count}/${formation.maxMembers || 5}`, cardX + cardWidth / 2, compactCardY + compactCardHeight - 17, {
            size: 10,
            color: count ? '#74d3a0' : '#cbbd96',
            align: 'center',
          });
          this.addHitTarget(
            { x: cardX, y: compactCardY, width: cardWidth, height: compactCardHeight },
            { type: 'openArmyFormation', cityId: formation.cityId || city.id, slot: formation.slot || index + 1 },
          );
        });
        return;
      }
      this.renderArmyFormationStrip(
        formationView.formations || [],
        formationX,
        formationY,
        formationWidth,
        Math.max(132, y + height - formationY - 8),
        formationView.formationMeta || { cityId: city.id, maxMembers: 5 },
      );
    }

    renderSubcityListPanel(state = {}, options = {}) {
      if (!this.presenter || typeof this.presenter.buildCitySwitcherViewState !== 'function') return;
      const view = this.presenter.buildCitySwitcherViewState(state);
      const cities = (Array.isArray(view.options) ? view.options : []).filter((city) => city.id && city.id !== 'capital' && city.tag !== '主城' && city.tag !== '涓诲煄');
      const layout = this.getLayout();
      const panelWidth = Math.min(340, layout.contentWidth - 20);
      const itemHeight = 58;
      const visibleCount = Math.min(Math.max(1, cities.length), 6);
      const panelHeight = Math.max(142, 76 + visibleCount * itemHeight);
      const x = (this.width - panelWidth) / 2;
      const dockTop = this.height - 64;
      const y = Math.max(82, dockTop - panelHeight - 10);
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeSubcityList', background: true });
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(46, 37, 26, 0.98)'],
            [1, 'rgba(20, 17, 13, 0.98)'],
          ],
          'rgba(34, 26, 19, 0.98)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 12,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });
      const closeSize = 28;
      const closeX = x + panelWidth - closeSize - 10;
      const closeY = y + 10;
      this.drawText('分城管理', x + 16, y + 17, { size: 17, bold: true, color: '#ffe6b5' });
      this.drawText(`${cities.length} 座分城`, x + 16, y + 41, { size: 11, color: '#cbbd96' });
      this.drawButton(closeX, closeY, closeSize, closeSize, 'x', { size: 14, radius: 7 });
      this.addHitTarget({ x: closeX, y: closeY, width: closeSize, height: closeSize }, { type: 'closeSubcityList' });

      if (!cities.length) {
        this.drawText('暂无分城', x + panelWidth / 2, y + 96, {
          size: 14,
          color: '#cbbd96',
          align: 'center',
        });
        return;
      }
      cities.slice(0, visibleCount).forEach((city, index) => {
        const itemX = x + 12;
        const itemY = y + 64 + index * itemHeight;
        const itemWidth = panelWidth - 24;
        const active = Boolean(city.isActive);
        this.drawPanel(itemX, itemY, itemWidth, itemHeight - 8, {
          fill: active ? 'rgba(78, 61, 35, 0.92)' : 'rgba(32, 27, 20, 0.82)',
          stroke: active ? 'rgba(247, 215, 116, 0.5)' : 'rgba(255, 226, 177, 0.12)',
          radius: 9,
          inset: 'rgba(255, 231, 184, 0.05)',
        });
        this.drawAsset('assets/art/world-site-city-cutout.png', itemX + 10, itemY + 10, 30, 30);
        this.drawText(this.truncateText(city.name || '未命名分城', itemWidth - 108, { size: 14, bold: true }), itemX + 50, itemY + 9, {
          size: 14,
          bold: true,
          color: '#fff1cf',
        });
        this.drawText(this.truncateText(city.metaText || '', itemWidth - 108, { size: 10 }), itemX + 50, itemY + 30, {
          size: 10,
          color: 'rgba(234, 234, 234, 0.62)',
        });
        this.drawButton(itemX + itemWidth - 72, itemY + 11, 60, 28, active ? '当前' : '跳转', {
          size: 12,
          bold: !active,
          active: !active,
          radius: 8,
          disabled: active,
        });
        this.addHitTarget(
          { x: itemX, y: itemY, width: itemWidth, height: itemHeight - 8 },
          active ? { type: 'blockCanvasModal' } : { type: 'jumpToSubcity', cityId: city.id },
        );
      });
    }

    renderAdvisorPanel(state = {}) {
      if (!this.presenter || typeof this.presenter.buildAdvisorViewState !== 'function') return;
      const view = this.presenter.buildAdvisorViewState(state.softGuide);
      const hasAdvice = Boolean(!view.hidden && view.activeAdvisor);

      const layout = this.getLayout();
      const panelWidth = Math.min(340, layout.contentWidth - 28);
      const panelHeight = 276;
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(96, (this.height - panelHeight) / 2 - 18);
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeAdvisor' });

      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(54, 39, 26, 0.98)'],
            [1, 'rgba(22, 18, 13, 0.98)'],
          ],
          'rgba(36, 28, 20, 0.98)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 14,
        inset: 'rgba(255, 231, 184, 0.1)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      const closeSize = 28;
      const closeX = x + panelWidth - closeSize - 10;
      const closeY = y + 10;
      this.drawButton(closeX, closeY, closeSize, closeSize, '×', { size: 16, radius: 7 });
      this.addHitTarget({ x: closeX, y: closeY, width: closeSize, height: closeSize }, { type: 'closeAdvisor' });

      const portraitSize = 64;
      const portraitX = x + panelWidth / 2 - portraitSize / 2;
      const portraitY = y + 24;
      this.drawPanel(portraitX, portraitY, portraitSize, portraitSize, {
        fill: 'rgba(92, 63, 34, 0.92)',
        stroke: 'rgba(240, 180, 91, 0.42)',
        radius: portraitSize / 2,
        inset: 'rgba(255, 231, 184, 0.14)',
      });
      this.drawText('谋', x + panelWidth / 2, portraitY + portraitSize / 2, {
        size: 24,
        bold: true,
        color: '#ffe6b5',
        baseline: 'middle',
        align: 'center',
      });
      this.drawText('顾问建议', x + panelWidth / 2, y + 102, {
        size: 17,
        bold: true,
        color: '#ffe6b5',
        align: 'center',
      });

      const messageX = x + 18;
      const messageY = y + 132;
      const messageWidth = panelWidth - 36;
      const messageHeight = 72;
      this.drawPanel(messageX, messageY, messageWidth, messageHeight, {
        fill: 'rgba(23, 18, 13, 0.42)',
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.04)',
      });
      const message = hasAdvice
        ? (view.text?.message || view.activeAdvisor.message)
        : '当前暂无特别建议。保持资源增长、城市建设和地图侦察的节奏即可。';
      const lines = this.wrapText(message, messageWidth - 24, { size: 13 })
        .slice(0, 3);
      this.drawTextLines(lines, messageX + 12, messageY + 13, {
        size: 13,
        color: '#f6e8c8',
        lineHeight: 18,
      });

      const buttonY = y + panelHeight - 52;
      const buttonGap = 10;
      const buttonWidth = Math.floor((panelWidth - 36 - buttonGap) / 2);
      const goX = x + 18;
      const dismissX = goX + buttonWidth + buttonGap;
      this.drawButton(goX, buttonY, buttonWidth, 36, hasAdvice ? '前往处理' : '暂无目标', {
        size: 13,
        bold: true,
        radius: 9,
        disabled: !hasAdvice || Boolean(view.goButton?.disabled),
        active: hasAdvice && !view.goButton?.disabled,
      });
      this.drawButton(dismissX, buttonY, buttonWidth, 36, '稍后再说', { size: 13, radius: 9 });
      this.addHitTarget(
        { x: goX, y: buttonY, width: buttonWidth, height: 36 },
        { type: 'goToAdvisorTarget', disabled: !hasAdvice || Boolean(view.goButton?.disabled) },
      );
      this.addHitTarget({ x: dismissX, y: buttonY, width: buttonWidth, height: 36 }, { type: 'closeAdvisor' });
    }

    renderNamingModal(naming = {}) {
      if (!naming || !naming.visible || !naming.view) return;
      const view = naming.view || {};
      const inputValue = String(naming.inputValue || '');
      const isSubmitting = Boolean(naming.submitting);

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeNaming' });
      if (this.ctx) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.54)';
        this.ctx.fillRect(0, 0, this.width, this.height);
      }

      const layout = this.getLayout();
      const panelWidth = Math.min(360, layout.contentWidth - 16);
      const panelHeight = 286;
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(72, (this.height - panelHeight) / 2 - 12);
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(54, 39, 26, 0.98)'],
            [1, 'rgba(22, 18, 13, 0.98)'],
          ],
          'rgba(36, 28, 20, 0.98)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 14,
        inset: 'rgba(255, 231, 184, 0.1)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      const closeSize = 28;
      const closeX = x + panelWidth - closeSize - 10;
      const closeY = y + 10;
      this.drawButton(closeX, closeY, closeSize, closeSize, 'x', { size: 14, radius: 7 });
      this.addHitTarget({ x: closeX, y: closeY, width: closeSize, height: closeSize }, { type: 'closeNaming' });

      const iconSize = 58;
      const iconX = x + panelWidth / 2 - iconSize / 2;
      const iconY = y + 24;
      this.drawPanel(iconX, iconY, iconSize, iconSize, {
        fill: 'rgba(92, 63, 34, 0.92)',
        stroke: 'rgba(240, 180, 91, 0.42)',
        radius: iconSize / 2,
        inset: 'rgba(255, 231, 184, 0.14)',
      });
      this.drawText('城', x + panelWidth / 2, iconY + iconSize / 2, {
        size: 22,
        bold: true,
        color: '#ffe6b5',
        baseline: 'middle',
        align: 'center',
      });

      this.drawText(this.truncateText(view.title || '命名', panelWidth - 84, { size: 17, bold: true }), x + panelWidth / 2, y + 98, {
        size: 17,
        bold: true,
        color: '#ffe6b5',
        align: 'center',
      });

      const messageLines = this.wrapTextLimit(view.message || '', panelWidth - 48, 2, { size: 13 });
      this.drawTextLines(messageLines, x + 24, y + 128, {
        size: 13,
        color: '#cbbd96',
        lineHeight: 17,
      });

      const inputX = x + 18;
      const inputY = y + 174;
      const inputWidth = panelWidth - 36;
      const inputHeight = 42;
      this.drawPanel(inputX, inputY, inputWidth, inputHeight, {
        fill: 'rgba(23, 18, 13, 0.56)',
        stroke: 'rgba(116, 211, 160, 0.24)',
        radius: 9,
        inset: 'rgba(116, 211, 160, 0.08)',
      });
      const displayValue = inputValue || view.placeholder || '请输入名称';
      this.drawText(this.truncateText(displayValue, inputWidth - 24, { size: 14 }), inputX + 12, inputY + 21, {
        size: 14,
        color: inputValue ? '#f6e8c8' : 'rgba(234, 234, 234, 0.48)',
        baseline: 'middle',
      });
      this.addHitTarget({ x: inputX, y: inputY, width: inputWidth, height: inputHeight }, { type: 'requestNamingInput' });

      const buttonY = y + panelHeight - 52;
      const buttonGap = 10;
      const buttonWidth = Math.floor((panelWidth - 36 - buttonGap) / 2);
      const cancelX = x + 18;
      const submitX = cancelX + buttonWidth + buttonGap;
      this.drawButton(cancelX, buttonY, buttonWidth, 36, '取消', { size: 13, radius: 9 });
      this.drawButton(submitX, buttonY, buttonWidth, 36, isSubmitting ? '提交中' : '确定', {
        size: 13,
        bold: true,
        radius: 9,
        active: true,
        disabled: isSubmitting || !inputValue.trim(),
      });
      this.addHitTarget({ x: cancelX, y: buttonY, width: buttonWidth, height: 36 }, { type: 'closeNaming' });
      this.addHitTarget(
        { x: submitX, y: buttonY, width: buttonWidth, height: 36 },
        { type: 'submitNaming', disabled: isSubmitting || !inputValue.trim() },
      );
    }

    renderFloatingTexts(effects = []) {
      if (!Array.isArray(effects) || !effects.length) return;
      const layout = this.getLayout();
      const centerX = layout.contentX + layout.contentWidth / 2;
      effects.slice(0, 4).forEach((effect, index) => {
        const progress = Math.max(0, Math.min(1, Number(effect.progress) || 0));
        const previousAlpha = typeof this.ctx?.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
        if (this.ctx && typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = Math.max(0, 1 - progress);
        const y = 128 - progress * 58 - index * 22;
        const text = this.truncateText(effect.text || '', layout.contentWidth - 52, { size: 15, bold: true });
        const textWidth = Math.min(layout.contentWidth - 36, Math.max(96, this.measureTextWidth(text, { size: 15, bold: true }) + 28));
        this.drawPanel(centerX - textWidth / 2, y - 8, textWidth, 30, {
          fill: 'rgba(16, 20, 14, 0.62)',
          stroke: 'rgba(116, 211, 160, 0.24)',
          radius: 15,
          inset: 'rgba(116, 211, 160, 0.08)',
        });
        this.drawText(text, centerX, y + 7, {
          size: 15,
          bold: true,
          color: effect.color || '#74d3a0',
          baseline: 'middle',
          align: 'center',
        });
        if (this.ctx && typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      });
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

    renderTutorialHighlight(highlight = null) {
      if (!highlight || !highlight.rect || !this.presenter || !this.ctx) return;
      const now = this.getNow();
      const transition = highlight.transition || null;
      const rect = transition
        ? this.interpolateRect(
          transition.fromRect,
          transition.toRect || highlight.rect,
          (now - (Number(transition.startedAt) || now)) / Math.max(1, Number(transition.durationMs) || 260),
        )
        : highlight.rect;
      const pulse = 0.5 + Math.sin((now - (Number(highlight.pulseStartedAt) || now)) / 180) * 0.5;
      const view = this.presenter.buildTutorialHighlightViewState(rect, {
        innerWidth: this.width,
        innerHeight: this.height,
      });
      const overlay = {
        x: this.parsePixelValue(view.overlay.left),
        y: this.parsePixelValue(view.overlay.top),
        width: this.parsePixelValue(view.overlay.width),
        height: this.parsePixelValue(view.overlay.height),
      };
      const bubble = {
        x: this.parsePixelValue(view.bubble.left),
        y: this.parsePixelValue(view.bubble.top),
        width: 220,
        height: 72,
      };
      const pointer = {
        x: this.parsePixelValue(view.pointer.left),
        y: this.parsePixelValue(view.pointer.top),
      };
      this.addTutorialShield(transition?.toRect || highlight.rect || rect);

      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      this.ctx.fillRect(0, 0, this.width, overlay.y);
      this.ctx.fillRect(0, overlay.y + overlay.height, this.width, Math.max(0, this.height - overlay.y - overlay.height));
      this.ctx.fillRect(0, overlay.y, overlay.x, overlay.height);
      this.ctx.fillRect(overlay.x + overlay.width, overlay.y, Math.max(0, this.width - overlay.x - overlay.width), overlay.height);

      this.drawPanel(overlay.x, overlay.y, overlay.width, overlay.height, {
        fill: `rgba(255, 247, 214, ${0.07 + pulse * 0.04})`,
        stroke: `rgba(255, 215, 0, ${0.78 + pulse * 0.2})`,
        radius: 16,
        inset: 'rgba(255, 247, 214, 0.18)',
      });
      this.ctx.lineWidth = 3;
      this.roundRectPath(overlay.x, overlay.y, overlay.width, overlay.height, 16);
      this.ctx.strokeStyle = `rgba(255, 215, 0, ${0.78 + pulse * 0.2})`;
      this.ctx.stroke();
      this.ctx.lineWidth = 1;

      this.drawPanel(bubble.x, bubble.y, bubble.width, bubble.height, {
        fill: '#fff7d6',
        stroke: 'rgba(255, 215, 0, 0.38)',
        radius: 12,
        inset: 'rgba(255, 255, 255, 0.26)',
      });
      const messageLines = this.wrapTextLimit(highlight.message || '', bubble.width - 28, 3, { size: 13 });
      this.drawTextLines(messageLines, bubble.x + 14, bubble.y + 12, {
        size: 13,
        color: '#3b2f00',
        lineHeight: 19,
      });

      this.drawText('👇', pointer.x + 12, pointer.y + 13, {
        size: 24,
        baseline: 'middle',
        align: 'center',
      });
    }

    addTutorialShield(rect = {}, options = {}) {
      const x = Math.max(0, Math.min(this.width, Number(rect.left ?? rect.x) || 0));
      const y = Math.max(0, Math.min(this.height, Number(rect.top ?? rect.y) || 0));
      const width = Math.max(0, Math.min(this.width - x, Number(rect.width) || 0));
      const height = Math.max(0, Math.min(this.height - y, Number(rect.height) || 0));
      const right = Math.max(x, Math.min(this.width, x + width));
      const bottom = Math.max(y, Math.min(this.height, y + height));
      const block = { type: 'blockCanvasModal', allowedAction: options.allowedAction || null };
      [
        { x: 0, y: 0, width: this.width, height: y },
        { x: 0, y: bottom, width: this.width, height: Math.max(0, this.height - bottom) },
        { x: 0, y, width: x, height },
        { x: right, y, width: Math.max(0, this.width - right), height },
      ]
        .filter((item) => item.width > 0 && item.height > 0)
        .forEach((item) => this.addHitTarget(item, block));
    }

    drawRewardParticle(cx, cy, radius, angle, progress, index) {
      if (!this.ctx) return;
      const distance = radius * (0.44 + progress * 0.36 + (index % 3) * 0.04);
      const x = cx + Math.cos(angle) * distance;
      const y = cy + Math.sin(angle) * distance;
      const size = 2 + (index % 4);
      this.ctx.fillStyle = index % 2 ? 'rgba(255, 245, 190, 0.86)' : 'rgba(247, 215, 116, 0.78)';
      this.ctx.beginPath();
      this.ctx.arc(x, y, size, 0, Math.PI * 2);
      this.ctx.fill();
    }

    renderRewardReveal(reveal = null) {
      if (!reveal || !this.ctx) return;
      const now = this.getNow();
      const startedAt = Number(reveal.createdAt) || now;
      const progress = Math.max(0, Math.min(1, (now - startedAt) / 900));
      const pulse = 0.5 + Math.sin(now / 180) * 0.5;
      const layout = this.getLayout();
      const panelWidth = Math.min(340, layout.contentWidth - 22);
      const panelHeight = 254;
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(96, (this.height - panelHeight) / 2 - 14);
      const cx = x + panelWidth / 2;
      const glowY = y + 72;

      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeRewardReveal' });

      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      this.ctx.globalAlpha = 0.78;
      this.ctx.fillStyle = this.createGradient(
        cx - 86, glowY - 86, cx + 86, glowY + 86,
        [
          [0, 'rgba(255, 248, 189, 0.02)'],
          [0.5, `rgba(247, 215, 116, ${0.26 + pulse * 0.16})`],
          [1, 'rgba(255, 248, 189, 0.02)'],
        ],
        'rgba(247, 215, 116, 0.24)',
      );
      this.ctx.beginPath();
      this.ctx.arc(cx, glowY, 86 + pulse * 10, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = previousAlpha;

      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(69, 48, 26, 0.99)'],
            [0.52, 'rgba(33, 26, 18, 0.99)'],
            [1, 'rgba(20, 18, 14, 0.99)'],
          ],
          'rgba(35, 28, 20, 0.99)',
        ),
        stroke: 'rgba(247, 215, 116, 0.52)',
        radius: 14,
        inset: 'rgba(255, 245, 190, 0.12)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      const sweepWidth = 72;
      const sweepX = x - sweepWidth + (panelWidth + sweepWidth * 2) * progress;
      this.ctx.globalAlpha = 0.28;
      this.ctx.fillStyle = this.createGradient(
        sweepX, y, sweepX + sweepWidth, y,
        [
          [0, 'rgba(255, 255, 255, 0)'],
          [0.5, 'rgba(255, 255, 255, 0.82)'],
          [1, 'rgba(255, 255, 255, 0)'],
        ],
        'rgba(255, 255, 255, 0.28)',
      );
      this.ctx.fillRect(Math.max(x, sweepX), y + 1, Math.min(sweepWidth, x + panelWidth - sweepX), panelHeight - 2);
      this.ctx.globalAlpha = previousAlpha;

      for (let index = 0; index < 18; index += 1) {
        this.drawRewardParticle(cx, glowY, 94, (Math.PI * 2 * index) / 18 + now / 900, progress, index);
      }

      this.drawText(reveal.title || '获得奖励', cx, y + 30, {
        size: 20,
        bold: true,
        color: '#fff1cf',
        align: 'center',
      });
      this.drawText(reveal.subtitle || '', cx, y + 60, {
        size: 13,
        color: '#ffd98a',
        align: 'center',
      });

      const rewardText = reveal.rewardText || '';
      const rewardLines = this.wrapTextLimit(rewardText, panelWidth - 58, 3, { size: 15, bold: true });
      this.drawPanel(x + 22, y + 96, panelWidth - 44, 72, {
        fill: 'rgba(11, 18, 14, 0.42)',
        stroke: 'rgba(116, 211, 160, 0.28)',
        radius: 10,
        inset: 'rgba(116, 211, 160, 0.08)',
      });
      this.drawTextLines(rewardLines, x + 34, y + 111, {
        size: 15,
        bold: true,
        color: '#74d3a0',
        lineHeight: 22,
      });

      const buttonWidth = panelWidth - 44;
      const buttonY = y + panelHeight - 58;
      this.drawButton(x + 22, buttonY, buttonWidth, 40, '收下', {
        size: 14,
        bold: true,
        active: true,
        radius: 10,
      });
      this.addHitTarget({ x: x + 22, y: buttonY, width: buttonWidth, height: 40 }, { type: 'closeRewardReveal' });
    }

    renderLoginPanel(auth = {}) {
      const view = auth.view || {};
      if (!view.loginPanelVisible) return;
      const credentials = auth.credentials || {};
      this.setHitTargets([]);
      if (this.ctx) {
        this.ctx.fillStyle = '#14120f';
        this.ctx.fillRect(0, 0, this.width, this.height);
      }

      const layout = this.getLayout();
      const panelWidth = Math.min(360, layout.contentWidth - 12);
      const panelHeight = 344;
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(72, (this.height - panelHeight) / 2 - 8);
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(54, 39, 26, 0.98)'],
            [1, 'rgba(22, 18, 13, 0.98)'],
          ],
          'rgba(36, 28, 20, 0.98)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 14,
        inset: 'rgba(255, 231, 184, 0.1)',
      });

      const iconSize = 58;
      const iconX = x + panelWidth / 2 - iconSize / 2;
      const iconY = y + 24;
      this.drawPanel(iconX, iconY, iconSize, iconSize, {
        fill: 'rgba(92, 63, 34, 0.92)',
        stroke: 'rgba(240, 180, 91, 0.42)',
        radius: iconSize / 2,
        inset: 'rgba(255, 231, 184, 0.14)',
      });
      this.drawAsset('assets/art/icon-fire-cutout.webp', iconX + 12, iconY + 12, 34, 34);
      this.drawText('\u6587\u660e\u706b\u79cd', x + panelWidth / 2, y + 104, {
        size: 22,
        bold: true,
        color: '#ffe6b5',
        align: 'center',
      });

      const message = view.message || '';
      this.drawText(this.truncateText(message, panelWidth - 48, { size: 13 }), x + panelWidth / 2, y + 134, {
        size: 13,
        color: message ? '#e94560' : 'rgba(234, 234, 234, 0.42)',
        align: 'center',
      });

      const inputX = x + 24;
      const inputWidth = panelWidth - 48;
      const inputHeight = 42;
      const usernameY = y + 160;
      const passwordY = usernameY + 52;
      const drawInput = (fieldY, label, value, actionType, masked = false) => {
        this.drawPanel(inputX, fieldY, inputWidth, inputHeight, {
          fill: 'rgba(23, 18, 13, 0.56)',
          stroke: 'rgba(116, 211, 160, 0.24)',
          radius: 8,
          inset: 'rgba(116, 211, 160, 0.08)',
        });
        const displayValue = value
          ? (masked ? '\u2022'.repeat(Math.min(12, String(value).length)) : value)
          : label;
        this.drawText(this.truncateText(displayValue, inputWidth - 24, { size: 14 }), inputX + 12, fieldY + 21, {
          size: 14,
          color: value ? '#f6e8c8' : 'rgba(234, 234, 234, 0.48)',
          baseline: 'middle',
        });
        this.addHitTarget({ x: inputX, y: fieldY, width: inputWidth, height: inputHeight }, { type: actionType });
      };
      drawInput(usernameY, '\u7528\u6237\u540d', credentials.usernameValue || '', 'requestLoginUsername');
      drawInput(passwordY, '\u5bc6\u7801', credentials.passwordValue || '', 'requestLoginPassword', true);

      const rememberY = passwordY + 54;
      const checkboxSize = 18;
      this.drawPanel(inputX, rememberY, checkboxSize, checkboxSize, {
        fill: credentials.rememberPasswordChecked ? 'rgba(116, 211, 160, 0.68)' : 'rgba(23, 18, 13, 0.56)',
        stroke: 'rgba(116, 211, 160, 0.34)',
        radius: 5,
      });
      if (credentials.rememberPasswordChecked) {
        this.drawText('\u2713', inputX + checkboxSize / 2, rememberY + checkboxSize / 2, {
          size: 13,
          bold: true,
          color: '#0d1510',
          baseline: 'middle',
          align: 'center',
        });
      }
      this.drawText('\u8bb0\u4f4f\u5bc6\u7801', inputX + checkboxSize + 9, rememberY + checkboxSize / 2, {
        size: 13,
        color: '#cbbd96',
        baseline: 'middle',
      });
      this.addHitTarget({ x: inputX, y: rememberY - 6, width: 112, height: 32 }, { type: 'toggleRememberPassword' });

      const loginY = y + panelHeight - 58;
      this.drawButton(inputX, loginY, inputWidth, 40, '\u767b\u5f55', {
        size: 14,
        bold: true,
        radius: 9,
        active: true,
      });
      this.addHitTarget({ x: inputX, y: loginY, width: inputWidth, height: 40 }, { type: 'submitLogin' });
    }

    renderLoadingScreen(loading = {}) {
      if (!loading.visible) return;
      this.setHitTargets([]);
      if (this.ctx) {
        const hasBackground = this.drawCoverAsset('assets/art/civilization-bg.webp', 0, 0, this.width, this.height, 1);
        if (!hasBackground) {
          this.ctx.fillStyle = this.createGradient(
            0, 0, this.width, this.height,
            [
              [0, '#1c241b'],
              [0.48, '#44321f'],
              [1, '#11140f'],
            ],
            '#14120f',
          );
          this.ctx.fillRect(0, 0, this.width, this.height);
        }
        this.ctx.fillStyle = 'rgba(10, 10, 8, 0.42)';
        this.ctx.fillRect(0, 0, this.width, this.height);
      }

      const layout = this.getLayout();
      const panelWidth = Math.min(360, layout.contentWidth - 16);
      const panelHeight = 154;
      const x = Math.floor((this.width - panelWidth) / 2);
      const y = Math.floor(this.height * 0.56);
      const percentage = Math.max(0, Math.min(100, Number(loading.percentage) || 0));

      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(54, 39, 26, 0.92)'],
            [1, 'rgba(19, 17, 13, 0.94)'],
          ],
          'rgba(31, 25, 18, 0.94)',
        ),
        stroke: 'rgba(255, 226, 177, 0.3)',
        radius: 14,
        inset: 'rgba(255, 231, 184, 0.1)',
      });

      const iconSize = 52;
      const iconX = x + 22;
      const iconY = y + 24;
      this.drawPanel(iconX, iconY, iconSize, iconSize, {
        fill: 'rgba(92, 63, 34, 0.9)',
        stroke: 'rgba(240, 180, 91, 0.44)',
        radius: iconSize / 2,
        inset: 'rgba(255, 231, 184, 0.14)',
      });
      this.drawAsset('assets/art/icon-fire-cutout.webp', iconX + 10, iconY + 10, 32, 32);
      this.drawText('\u6587\u660e\u706b\u79cd', iconX + iconSize + 14, y + 31, {
        size: 19,
        bold: true,
        color: '#ffe6b5',
      });
      this.drawText(loading.message || '\u6b63\u5728\u6574\u7406\u8425\u5730\u8d44\u6e90', iconX + iconSize + 14, y + 58, {
        size: 12,
        color: '#cbbd96',
      });

      const barX = x + 22;
      const barY = y + 98;
      const barWidth = panelWidth - 44;
      this.drawProgressBar(barX, barY, barWidth, 16, percentage);
      this.drawText(`${Math.round(percentage)}%`, x + panelWidth / 2, barY + 28, {
        size: 12,
        bold: true,
        color: '#ffd98a',
        align: 'center',
      });
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'blockCanvasModal' });
    }

    renderNetworkOverlay(network = {}) {
      if (!network || network.status !== 'reconnecting') return false;
      const ctx = this.ctx;
      if (!ctx) return false;
      ctx.save?.();
      ctx.fillStyle = 'rgba(8, 10, 12, 0.46)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore?.();

      const panelWidth = Math.min(320, Math.max(240, this.width - 48));
      const panelHeight = 118;
      const x = Math.floor((this.width - panelWidth) / 2);
      const y = Math.floor((this.height - panelHeight) / 2);
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: 'rgba(20, 24, 26, 0.92)',
        stroke: 'rgba(255, 226, 177, 0.26)',
        radius: 12,
        inset: 'rgba(255, 255, 255, 0.06)',
      });

      const now = this.getNow();
      const cx = x + 44;
      const cy = y + 42;
      const radius = 16;
      if (ctx.beginPath && ctx.arc) {
        ctx.save?.();
        ctx.strokeStyle = 'rgba(255, 217, 138, 0.22)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#ffd98a';
        ctx.lineCap = 'round';
        const start = (now / 180) % (Math.PI * 2);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, start, start + Math.PI * 1.35);
        ctx.stroke();
        ctx.restore?.();
      }

      this.drawText('网络连接不稳定', x + 76, y + 28, {
        size: 15,
        bold: true,
        color: '#ffe6b5',
      });
      this.drawText('正在重连中', x + 76, y + 54, {
        size: 12,
        color: '#cbbd96',
      });
      const failText = Number(network.failureCount) > 0 ? `连续丢失 ${Number(network.failureCount)} 次心跳` : '';
      if (failText) {
        this.drawText(failText, x + panelWidth / 2, y + 88, {
          size: 11,
          color: 'rgba(234, 234, 234, 0.56)',
          align: 'center',
        });
      }
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'blockCanvasModal' });
      return true;
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

    renderSettingsPanel() {
      const layout = this.getLayout();
      const panelWidth = 200;
      const panelHeight = 120;
      const x = layout.contentRight - panelWidth - 8;
      const y = 62;

      // 绘制面板背景
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: 'rgba(42, 35, 24, 0.96)',
        stroke: 'rgba(255, 226, 177, 0.2)',
        radius: 10,
      });

      // 绘制标题
      this.drawText('设置', x + panelWidth / 2, y + 18, {
        size: 14,
        bold: true,
        color: '#ffd98a',
        align: 'center',
      });

      // 绘制分隔线
      if (this.ctx) {
        this.ctx.strokeStyle = 'rgba(255, 226, 177, 0.1)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(x + 10, y + 28);
        this.ctx.lineTo(x + panelWidth - 10, y + 28);
        this.ctx.stroke();
      }

      // 重置游戏按钮
      const btnHeight = 36;
      const btnY1 = y + 38;
      this.drawButton(x + 10, btnY1, panelWidth - 20, btnHeight, '重置游戏', {
        size: 12,
        radius: 8,
        active: false,
      });
      this.addHitTarget({ x: x + 10, y: btnY1, width: panelWidth - 20, height: btnHeight }, { type: 'resetGame' });

      // 退出登录按钮
      const btnY2 = btnY1 + btnHeight + 8;
      this.drawButton(x + 10, btnY2, panelWidth - 20, btnHeight, '退出登录', {
        size: 12,
        radius: 8,
        active: false,
      });
      this.addHitTarget({ x: x + 10, y: btnY2, width: panelWidth - 20, height: btnHeight }, { type: 'logout' });

      // 面板外部点击关闭
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeSettings', background: true });
    }

    renderLogsPanel(logs = []) {
      const layout = this.getLayout();
      const panelWidth = Math.min(360, layout.contentWidth - 24);
      const panelHeight = 420;
      const x = (this.width - panelWidth) / 2;
      const y = (this.height - panelHeight) / 2;

      // 绘制面板背景
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: 'rgba(42, 35, 24, 0.96)',
        stroke: 'rgba(255, 226, 177, 0.2)',
        radius: 12,
      });

      // 绘制标题
      this.drawText('📜 最近请求日志', x + panelWidth / 2, y + 22, {
        size: 16,
        bold: true,
        color: '#ffd98a',
        align: 'center',
      });

      // 绘制关闭按钮
      const closeBtnSize = 28;
      const closeBtnX = x + panelWidth - closeBtnSize - 10;
      const closeBtnY = y + 10;
      this.drawButton(closeBtnX, closeBtnY, closeBtnSize, closeBtnSize, '✕', {
        size: 14,
        radius: 6,
        active: false,
      });
      this.addHitTarget({ x: closeBtnX, y: closeBtnY, width: closeBtnSize, height: closeBtnSize }, { type: 'closeLogs' });

      // 绘制分隔线
      if (this.ctx) {
        this.ctx.strokeStyle = 'rgba(255, 226, 177, 0.1)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(x + 12, y + 42);
        this.ctx.lineTo(x + panelWidth - 12, y + 42);
        this.ctx.stroke();
      }

      // 日志列表区域
      const listX = x + 12;
      const listY = y + 52;
      const listWidth = panelWidth - 24;
      const listHeight = panelHeight - 110;

      // 绘制日志列表背景
      this.drawPanel(listX, listY, listWidth, listHeight, {
        fill: 'rgba(0, 0, 0, 0.2)',
        stroke: 'rgba(255, 255, 255, 0.05)',
        radius: 8,
      });

      // 绘制日志条目
      const itemHeight = 28;
      const maxItems = Math.floor(listHeight / itemHeight);
      const displayLogs = logs.slice(0, maxItems);

      if (displayLogs.length === 0) {
        this.drawText('暂无日志', listX + listWidth / 2, listY + listHeight / 2, {
          size: 12,
          color: '#888',
          align: 'center',
        });
      } else {
        displayLogs.forEach((log, index) => {
          const itemY = listY + 6 + index * itemHeight;
          const time = log.timestamp || '';
          const method = (log.method || '') + ' ' + (log.path || '');
          const status = log.statusCode || 0;
          const isOk = status >= 200 && status < 300;
          const statusColor = isOk ? '#74d3a0' : '#ff6b6b';

          // 时间
          this.drawText(time, listX + 8, itemY + 10, { size: 10, color: '#aaa' });
          // 方法
          this.drawText(method, listX + 70, itemY + 10, { size: 10, color: '#f6e8c8' });
          // 状态码
          this.drawText(String(status), listX + listWidth - 40, itemY + 10, { size: 10, color: statusColor });
        });
      }

      // 清空日志按钮
      const clearBtnY = y + panelHeight - 48;
      this.drawButton(x + 12, clearBtnY, panelWidth - 24, 36, '清空日志', {
        size: 12,
        radius: 8,
        active: false,
      });
      this.addHitTarget({ x: x + 12, y: clearBtnY, width: panelWidth - 24, height: 36 }, { type: 'clearLogs' });

      // 面板外部点击关闭
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeLogs', background: true });
    }

    renderResourceDetailsPanel(state = {}) {
      if (!this.presenter) return;
      const view = this.presenter.buildResourceViewState(state);
      const layout = this.getLayout();
      const panelWidth = Math.min(360, layout.contentWidth - 24);
      const resourceCount = 5;
      const panelHeight = 92 + resourceCount * 86;
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(76, (this.height - panelHeight) / 2 - 20);

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeResourceDetails' });

      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: 'rgba(42, 35, 24, 0.97)',
        stroke: 'rgba(255, 226, 177, 0.22)',
        radius: 12,
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      this.drawText('资源详情', x + panelWidth / 2, y + 22, {
        size: 16,
        bold: true,
        color: '#ffd98a',
        align: 'center',
      });

      const closeBtnSize = 28;
      const closeBtnX = x + panelWidth - closeBtnSize - 10;
      const closeBtnY = y + 10;
      this.drawButton(closeBtnX, closeBtnY, closeBtnSize, closeBtnSize, 'x', {
        size: 14,
        radius: 6,
      });
      this.addHitTarget({ x: closeBtnX, y: closeBtnY, width: closeBtnSize, height: closeBtnSize }, { type: 'closeResourceDetails' });

      const cards = [
        {
          label: '木材',
          icon: 'assets/art/icon-wood-cutout.webp',
          value: view.text.woodDetailValue,
          lines: [`产出 ${view.text.woodDetailRate}`],
        },
        {
          label: '铁矿',
          icon: 'assets/art/icon-iron-cutout.webp',
          value: view.text.ironDetailValue,
          lines: [`产出 ${view.text.ironDetailRate}`],
        },
        {
          label: '石料',
          icon: 'assets/art/icon-stone-cutout.webp',
          value: view.text.stoneDetailValue,
          lines: [`产出 ${view.text.stoneDetailRate}`],
        },
        {
          label: '粮食',
          icon: 'assets/art/icon-food-cutout.webp',
          value: view.text.foodDetailValue,
          lines: [
            `产出 ${view.text.foodOutputRate}`,
            `消耗 ${view.text.foodConsumptionRate}`,
            `净增长 ${view.text.foodNetRate}`,
          ],
        },
        {
          label: '知识',
          icon: 'assets/art/icon-knowledge-cutout.webp',
          value: view.text.knowledgeDetailValue,
          lines: [`产出 ${view.text.knowledgeDetailRate}`],
        },
      ];

      const cardX = x + 12;
      const cardWidth = panelWidth - 24;
      cards.forEach((card, index) => {
        const cardY = y + 56 + index * 86;
        this.drawPanel(cardX, cardY, cardWidth, 74, {
          fill: 'rgba(27, 22, 17, 0.74)',
          stroke: 'rgba(255, 226, 177, 0.12)',
          radius: 10,
        });
        this.drawAsset(card.icon, cardX + 12, cardY + 19, 34, 34);
        this.drawText(card.label, cardX + 58, cardY + 12, { size: 13, bold: true, color: '#f6e8c8' });
        this.drawText(String(card.value), cardX + cardWidth - 12, cardY + 12, {
          size: 18,
          bold: true,
          color: '#74d3a0',
          align: 'right',
        });
        this.drawTextLines(card.lines, cardX + 58, cardY + 36, { size: 11, color: '#aeb0b8', lineHeight: 16 });
      });

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
