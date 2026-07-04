(function (global) {
  const SignatureHash = (() => {
    if (global.SignatureHash) return global.SignatureHash;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../shared/SignatureHash');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const TileCoord = (() => {
    if (global.TileCoord) return global.TileCoord;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/foundation/TileCoord');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

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
    worldMarchRoutePolicy: getRendererDependency('worldMarchRoutePolicy'),
    unitSpriteManifest: getRendererDependency('unitSpriteManifest'),
    worldMapRenderState: getRendererDependency('worldMapRenderState'),
    worldMapCacheState: getRendererDependency('worldMapCacheState'),
    worldActorCanvasRenderer: getRendererDependency('worldActorCanvasRenderer'),
    worldMarchHudCanvasRenderer: getRendererDependency('worldMarchHudCanvasRenderer'),
    tutorialIntroUnitRenderer: getRendererDependency('tutorialIntroUnitRenderer'),
    worldMapRendererCompositionFactory: getRendererDependency('worldMapRendererCompositionFactory'),
    worldMapLayoutModel: getRendererDependency('worldMapLayoutModel'),
    worldMapHitTargetModel: getRendererDependency('worldMapHitTargetModel'),
    worldMapCachePolicy: getRendererDependency('worldMapCachePolicy'),
    worldMapLayerCacheStore: getRendererDependency('worldMapLayerCacheStore'),
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
    worldMapTileMapRenderer: getRendererDependency('worldMapTileMapRenderer'),
    worldMapActorHudRenderer: getRendererDependency('worldMapActorHudRenderer'),
  });

  class WorldMapCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.worldMapRenderState = options.worldMapRenderState
        || options.host?.worldMapRenderState
        || sharedDependencies.worldMapRenderState?.createWorldMapRenderState?.()
        || null;
      this.worldMapCacheState = options.worldMapCacheState
        || options.host?.worldMapCacheState
        || sharedDependencies.worldMapCacheState?.createWorldMapCacheState?.()
        || null;
      const rendererHost = options.host || null;
      const CompositionFactory = options.worldMapRendererCompositionFactoryClass || sharedDependencies.worldMapRendererCompositionFactory;
      const composition = options.worldMapRendererComposition
        || (CompositionFactory?.create ? CompositionFactory.create({
          renderer: this,
          rendererHost,
          options,
          dependencies: sharedDependencies,
          worldMapRenderState: this.worldMapRenderState,
          worldMapCacheState: this.worldMapCacheState,
        }) : {});
      Object.assign(this, composition);
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



    static getWorldMapHitTargetModel() {
      return sharedDependencies.worldMapHitTargetModel || null;
    }


    static getWorldMapCachePolicy() {
      return sharedDependencies.worldMapCachePolicy || null;
    }

    static getWorldMapLayerCacheStore() {
      return sharedDependencies.worldMapLayerCacheStore || null;
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

    static getWorldMarchRoutePolicy() {
      return sharedDependencies.worldMarchRoutePolicy || null;
    }

    static getTutorialIntroUnitRenderer() {
      return sharedDependencies.tutorialIntroUnitRenderer || null;
    }

    render(tileMapView = {}, x = 0, y = 0, width = 0, height = 0, uiState = {}, options = {}) {
      return this.renderWorldTileMap(tileMapView, x, y, width, height, uiState, options);
    }

    get ctx() {
      return this.host?.ctx || null;
    }

    withRenderCtx(ctx, callback) {
      if (typeof this.host?.withRenderCtx === 'function') return this.host.withRenderCtx(ctx, callback);
      return callback?.();
    }

    get canvas() {
      return this.host?.canvas || null;
    }

    get width() {
      // Host chain may not expose width on every composition path (the overlay
      // render reads this.width directly, unlike render() which takes it as a param);
      // fall back to the live canvas logical width so coords never go non-finite.
      return Number(this.host?.width) || Number(this.canvas?.clientWidth) || Number(this.canvas?.width) || 0;
    }

    get height() {
      return Number(this.host?.height) || Number(this.canvas?.clientHeight) || Number(this.canvas?.height) || 0;
    }

    get bottomSafeArea() {
      return Number(this.host?.bottomSafeArea) || 12;
    }

    get viewportOffsetX() {
      return Number(this.host?.viewportOffsetX) || 0;
    }

    get viewportOffsetY() {
      return Number(this.host?.viewportOffsetY) || 0;
    }

    get viewportWidth() {
      return Number(this.host?.viewportWidth) || 0;
    }

    get viewportHeight() {
      return Number(this.host?.viewportHeight) || 0;
    }

    get pixelRatio() {
      return Number(this.host?.pixelRatio) || 1;
    }

    get epochNowMs() {
      return this.host?.epochNowMs;
    }

    get serverNowMs() {
      return this.host?.serverNowMs;
    }

    get nowEpochMs() {
      return this.host?.nowEpochMs;
    }

    get worldClock() {
      return this.host?.worldClock || null;
    }

    get lastRenderOptions() {
      return this.host?.lastRenderOptions || null;
    }

    get presenter() {
      return this.host?.presenter || null;
    }

    get worldTileFastDragActive() {
      return Boolean(this.worldMapCacheState?.worldTileFastDragActive);
    }

    set worldTileFastDragActive(value) {
      if (this.worldMapCacheState) this.worldMapCacheState.worldTileFastDragActive = Boolean(value);
    }

    get worldTileStaticCache() {
      return this.worldMapCacheState?.worldTileStaticCache || null;
    }

    set worldTileStaticCache(value) {
      if (this.worldMapCacheState) this.worldMapCacheState.worldTileStaticCache = value || null;
    }

    get worldTileStaticCacheKey() {
      return this.worldMapCacheState?.worldTileStaticCacheKey || '';
    }

    set worldTileStaticCacheKey(value) {
      if (this.worldMapCacheState) this.worldMapCacheState.worldTileStaticCacheKey = value || '';
    }

    get worldTileStaticCacheLayoutKind() {
      return this.worldMapCacheState?.worldTileStaticCacheLayoutKind || '';
    }

    set worldTileStaticCacheLayoutKind(value) {
      if (this.worldMapCacheState) this.worldMapCacheState.worldTileStaticCacheLayoutKind = value || '';
    }

    get worldTileStaticCacheLayout() {
      return this.worldMapCacheState?.worldTileStaticCacheLayout || null;
    }

    set worldTileStaticCacheLayout(value) {
      if (this.worldMapCacheState) this.worldMapCacheState.worldTileStaticCacheLayout = value || null;
    }

    get worldTileStaticChunkCaches() {
      return this.worldMapCacheState?.worldTileStaticChunkCaches || null;
    }

    get worldTileStaticChunkCacheTick() {
      return Number(this.worldMapCacheState?.worldTileStaticChunkCacheTick) || 0;
    }

    set worldTileStaticChunkCacheTick(value) {
      if (this.worldMapCacheState) this.worldMapCacheState.worldTileStaticChunkCacheTick = Number(value) || 0;
    }

    get worldTileWaterLayerCache() {
      return this.worldMapCacheState?.worldTileWaterLayerCache || null;
    }

    set worldTileWaterLayerCache(value) {
      if (this.worldMapCacheState) this.worldMapCacheState.worldTileWaterLayerCache = value || null;
    }

    get worldTileWaterLayerCacheKey() {
      return this.worldMapCacheState?.worldTileWaterLayerCacheKey || '';
    }

    set worldTileWaterLayerCacheKey(value) {
      if (this.worldMapCacheState) this.worldMapCacheState.worldTileWaterLayerCacheKey = value || '';
    }

    get worldTileWaterFrameCaches() {
      return this.worldMapCacheState?.worldTileWaterFrameCaches || null;
    }

    get worldTileWaterChunkCaches() {
      return this.worldMapCacheState?.worldTileWaterChunkCaches || null;
    }

    get worldTileWaterChunkCacheTick() {
      return Number(this.worldMapCacheState?.worldTileWaterChunkCacheTick) || 0;
    }

    set worldTileWaterChunkCacheTick(value) {
      if (this.worldMapCacheState) this.worldMapCacheState.worldTileWaterChunkCacheTick = Number(value) || 0;
    }

    get worldTileWaterTimeOverride() {
      return this.worldMapRenderState?.worldTileWaterTimeOverride ?? null;
    }

    set worldTileWaterTimeOverride(value) {
      if (this.worldMapRenderState) this.worldMapRenderState.worldTileWaterTimeOverride = value ?? null;
    }

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

    get lastWorldActorOverlayDiag() {
      return this.worldMapRenderState?.lastWorldActorOverlayDiag || null;
    }

    set lastWorldActorOverlayDiag(value) {
      if (this.worldMapRenderState) this.worldMapRenderState.lastWorldActorOverlayDiag = value || null;
    }

    get lastWorldMapLayerRenderResult() {
      return this.worldMapRenderState?.lastWorldMapLayerRenderResult || null;
    }

    set lastWorldMapLayerRenderResult(value) {
      if (this.worldMapRenderState) this.worldMapRenderState.lastWorldMapLayerRenderResult = value || null;
    }

    addHitTarget(rect, action) {
      return this.host?.addHitTarget?.(rect, action);
    }

    createGradient(...args) {
      return this.host?.createGradient?.(...args) ?? args[5] ?? '#000';
    }

    drawPanel(...args) {
      return this.host?.drawPanel?.(...args);
    }

    drawButton(...args) {
      return this.host?.drawButton?.(...args);
    }

    drawText(...args) {
      return this.host?.drawText?.(...args);
    }

    truncateText(text, maxWidth, options = {}) {
      return this.host?.truncateText?.(text, maxWidth, options) ?? String(text ?? '');
    }

    withSuppressedHitTargets(callback) {
      if (typeof this.host?.withSuppressedHitTargets === 'function') return this.host.withSuppressedHitTargets(callback);
      return callback?.();
    }

    getAsset(assetPath) {
      return this.host?.getAsset?.(assetPath) || null;
    }

    analyzeAssetAlphaBounds(assetPath) {
      return this.host?.analyzeAssetAlphaBounds?.(assetPath) || null;
    }

    getWorldTileTemplateMetrics(template = {}) {
      return this.host?.getWorldTileTemplateMetrics?.(template) || null;
    }

    createTileWorkCanvas(width, height) {
      return this.host?.createTileWorkCanvas?.(width, height) || null;
    }

    getWorldTileTemplateMask(assetPath = '') {
      return this.host?.getWorldTileTemplateMask?.(assetPath) || null;
    }

    drawWorldTileDryTemplate(tile = {}, drawRect = {}) {
      return this.host?.drawWorldTileDryTemplate?.(tile, drawRect) || false;
    }

    drawWorldTileBase(tile = {}, center = {}, drawRect = {}, viewport = {}) {
      return this.host?.drawWorldTileBase?.(tile, center, drawRect, viewport) || false;
    }

    drawWorldTileWater(tile = {}, center = {}, drawRect = {}, viewport = {}, options = {}) {
      return this.host?.drawWorldTileWater?.(tile, center, drawRect, viewport, options) || false;
    }

    getNow() {
      return this.host?.getNow?.() ?? Date.now();
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



    get ctx() {
      return this.host?.ctx;
    }

    drawIsoDiamond(cx, cy, width, height, options = {}) {
      if (!this.ctx) return false;
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
      return true;
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
        shore: 'rgba(35, 87, 120, 0.94)',
      };
      return fills[terrain] || fills.plains;
    }

    hashString(input) {
      return SignatureHash.hashString(input);
    }

    random01(seed, q, r, salt) {
      return this.hashString(`${seed || 'scout-tile-v1'}|${q}|${r}|${salt}`) / 4294967295;
    }


    getWorldMapLayoutModel() {
      return this.constructor.getWorldMapLayoutModel?.()
        || null;
    }

    getTileMapGeometry() {
      return this.constructor.getTileMapGeometry?.()
        || null;
    }

    getTileMapAssetManifest() {
      return this.constructor.getTileMapAssetManifest?.()
        || {};
    }

    normalizeTileCoord(tile = {}) {
      const helper = this.getTileMapGeometry();
      if (helper?.normalizeCoord) return helper.normalizeCoord(tile);
      return TileCoord.normalizeCoord(tile);
    }

    analyzeAssetAlphaBounds(assetPath = '') {
      return this.host?.analyzeAssetAlphaBounds?.(assetPath) || null;
    }

    getWorldTileTemplateBaseAsset(tile = {}) {
      return this.host?.getWorldTileTemplateBaseAsset?.(tile) || null;
    }

    getWorldTileTemplateMetrics(template = {}) {
      return this.host?.getWorldTileTemplateMetrics?.(template) || null;
    }

    getWorldTileStaticChunkCacheScale() {
      return this.host?.getWorldTileStaticChunkCacheScale?.() || 1;
    }

    getWorldTileStaticCachePixelBudget() {
      return this.host?.getWorldTileStaticCachePixelBudget?.() || 16000000;
    }

    getWorldTileStaticChunkSize() {
      return this.host?.getWorldTileStaticChunkSize?.() || 1024;
    }

    getWorldTileDragCachePanRange() {
      return this.host?.getWorldTileDragCachePanRange?.() || 180;
    }

    getWorldTileScreenCenter(tile = {}, viewport = {}, geometry = {}) {
      const layoutModel = this.getWorldMapLayoutModel();
      if (layoutModel?.getWorldTileScreenCenter) {
        return layoutModel.getWorldTileScreenCenter(tile, viewport, geometry, {
          tileMapGeometry: this.getTileMapGeometry(),
        });
      }
      const helper = this.getTileMapGeometry();
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
      const layoutModel = this.getWorldMapLayoutModel();
      if (layoutModel?.getWorldTileDrawRect) {
        return layoutModel.getWorldTileDrawRect(center, scale, geometry, {
          tileMapGeometry: this.getTileMapGeometry(),
        });
      }
      const helper = this.getTileMapGeometry();
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

    getWorldOverlayAnchor(tile = {}, viewport = {}, geometry = {}, targetKey = '', explicitOffset = null, centerOverride = null) {
      const layoutModel = this.getWorldMapLayoutModel();
      if (layoutModel?.getWorldOverlayAnchor) {
        return layoutModel.getWorldOverlayAnchor(tile, viewport, geometry, targetKey, explicitOffset, centerOverride, {
          tileMapGeometry: this.getTileMapGeometry(),
          tileMapAssetManifest: this.getTileMapAssetManifest(),
        });
      }
      const manifest = this.getTileMapAssetManifest();
      const center = centerOverride || this.getWorldTileScreenCenter(tile, viewport, geometry);
      const offset = explicitOffset || manifest.getOverlayOffset?.(targetKey) || { x: 0, y: 0 };
      const scale = Number(viewport.scale) || 1;
      return {
        x: center.x + (Number(offset.x) || 0) * scale,
        y: center.y + (Number(offset.y) || 0) * scale,
      };
    }

    getWorldTileSiteLayout(tile = {}, viewport = {}, geometry = {}, tileWidth = 192, tileHeight = 96, center = null) {
      const layoutModel = this.getWorldMapLayoutModel();
      if (layoutModel?.getWorldTileSiteLayout) {
        return layoutModel.getWorldTileSiteLayout(tile, viewport, geometry, tileWidth, tileHeight, center, {
          analyzeAssetAlphaBounds: (assetPath) => this.analyzeAssetAlphaBounds(assetPath),
          tileMapGeometry: this.getTileMapGeometry(),
          tileMapAssetManifest: this.getTileMapAssetManifest(),
        });
      }
      const site = tile.site || null;
      if (!site?.art) return null;
      const metrics = this.analyzeAssetAlphaBounds(site.art);
      if (!metrics) return null;
      const targetKey = site.overlayKey || this.getTileMapAssetManifest().getSiteOverlayKey?.(site.type) || `site:${site.type || 'town'}`;
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

    getWorldTileEntitySignature(tileMapView = {}) {
      const layoutModel = this.getWorldMapLayoutModel();
      if (layoutModel?.getWorldTileEntitySignature) {
        return layoutModel.getWorldTileEntitySignature(tileMapView);
      }
      const tiles = Array.isArray(tileMapView.tiles) ? tileMapView.tiles : [];
      let hash = SignatureHash.FNV_OFFSET_BASIS;
      const push = (value) => {
        hash = SignatureHash.foldString(hash, String(value ?? ''));
        hash ^= 31;
        hash = Math.imul(hash, SignatureHash.FNV_PRIME);
      };
      for (let index = 0; index < tiles.length; index += 1) {
        const tile = tiles[index] || {};
        const coord = this.normalizeTileCoord(tile);
        push(coord.tileId);
        push(tile.terrain || '');
        push(tile.terrainAsset || '');
        push(tile.water?.kind || '');
        push(tile.water?.asset || '');
        push((Array.isArray(tile.templateAssets) ? tile.templateAssets : [])
          .map((asset = {}) => `${asset.key || ''}:${asset.asset || ''}:${asset.type || ''}`)
          .join(','));
        push(tile.siteId || '');
        push(tile.site?.id || '');
        push(tile.site?.art || '');
        push(tile.site?.owner || '');
        push(tile.site?.status || '');
        push(tile.site?.name || tile.site?.title || '');
        push(tile.site?.scale || '');
        push(tile.site?.offset?.x || 0);
        push(tile.site?.offset?.y || 0);
        push(tile.feature?.key || '');
        push(tile.feature?.asset || '');
        push(tile.feature?.scale || '');
        push(tile.feature?.offset?.x || 0);
        push(tile.feature?.offset?.y || 0);
        push(tile.visibility || '');
        push(tile.discovered === false ? 0 : 1);
        push(tile.visible === false ? 0 : 1);
      }
      return `${tiles.length}:${(hash >>> 0).toString(36)}`;
    }

    getWorldTileRenderEntries(tileMapView = {}, viewport = {}, frame = {}, geometry = {}) {
      const layoutModel = this.getWorldMapLayoutModel();
      if (layoutModel?.getWorldTileRenderEntries && layoutModel?.getWorldTileRenderEntriesCacheKey) {
        const cacheKey = layoutModel.getWorldTileRenderEntriesCacheKey(tileMapView, viewport, frame);
        if (this.worldTileVisibleEntriesCache?.key === cacheKey) return this.worldTileVisibleEntriesCache.entries;
        const entries = layoutModel.getWorldTileRenderEntries(tileMapView, viewport, frame, geometry, {
          tileMapGeometry: this.getTileMapGeometry(),
          localEntries: this.getWorldTileLocalEntries(tileMapView, viewport, geometry),
        });
        this.worldTileVisibleEntriesCache = { key: cacheKey, entries };
        return entries;
      }
      const tiles = Array.isArray(tileMapView.tiles) ? tileMapView.tiles : [];
      const scale = Number(viewport.scale) || 1;
      const worldOrigin = this.normalizeTileCoord(viewport.worldOrigin || viewport.originCoord || viewport.renderOrigin || tileMapView.origin || tileMapView.worldOrigin || {});
      const cacheKey = [
        tileMapView.signature || '',
        tileMapView.version || '',
        tileMapView.seed || '',
        tiles.length,
        this.getWorldTileEntitySignature(tileMapView),
        worldOrigin.tileId,
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
      const layoutModel = this.getWorldMapLayoutModel();
      if (layoutModel?.getWorldTileLocalEntries && layoutModel?.getWorldTileLocalEntriesCacheKey) {
        const cacheKey = layoutModel.getWorldTileLocalEntriesCacheKey(tileMapView, viewport, geometry);
        if (this.worldTileLocalEntriesCache?.key === cacheKey) return this.worldTileLocalEntriesCache.entries;
        const entries = layoutModel.getWorldTileLocalEntries(tileMapView, viewport, geometry, {
          tileMapGeometry: this.getTileMapGeometry(),
        });
        this.worldTileLocalEntriesCache = { key: cacheKey, entries };
        return entries;
      }
      const tiles = Array.isArray(tileMapView.tiles) ? tileMapView.tiles : [];
      const scale = Number(viewport.scale) || 1;
      const worldOrigin = this.normalizeTileCoord(viewport.worldOrigin || viewport.originCoord || viewport.renderOrigin || tileMapView.origin || tileMapView.worldOrigin || {});
      const cacheKey = [
        tileMapView.signature || '',
        tileMapView.version || '',
        tileMapView.seed || '',
        tiles.length,
        this.getWorldTileEntitySignature(tileMapView),
        worldOrigin.tileId,
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
        worldOrigin: viewport.worldOrigin || viewport.originCoord || viewport.renderOrigin || tileMapView.origin || tileMapView.worldOrigin || undefined,
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

    getWorldTileRenderedDiamondCenter(tile = {}, drawRect = {}) {
      const baseTemplate = this.getWorldTileTemplateBaseAsset(tile);
      const assetPath = baseTemplate?.asset || tile.terrainAsset || '';
      const metrics = this.getWorldTileTemplateMetrics(baseTemplate || { asset: assetPath });
      const rectX = Number(drawRect.x) || 0;
      const rectY = Number(drawRect.y) || 0;
      const rectW = Number(drawRect.width) || 0;
      const rectH = Number(drawRect.height) || 0;
      if (metrics && rectW > 0 && rectH > 0) {
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

    getWorldTileStaticCacheLayout(tileMapView = {}, viewport = {}, geometry = {}) {
      const layoutModel = this.getWorldMapLayoutModel();
      if (layoutModel?.getWorldTileStaticCacheLayout) {
        return layoutModel.getWorldTileStaticCacheLayout(tileMapView, viewport, geometry, {
          tileMapGeometry: this.getTileMapGeometry(),
          entries: this.getWorldTileLocalEntries(tileMapView, viewport, geometry),
        });
      }
      const entries = this.getWorldTileLocalEntries(tileMapView, viewport, geometry);
      if (!entries.length) return null;
      const padding = this.getWorldTileAtlasFramePadding(geometry, viewport);
      const minX = Math.min(...entries.map((entry) => entry.drawRect.x)) - padding;
      const minY = Math.min(...entries.map((entry) => entry.drawRect.y)) - padding;
      const maxX = Math.max(...entries.map((entry) => entry.drawRect.x + entry.drawRect.width)) + padding;
      const maxY = Math.max(...entries.map((entry) => entry.drawRect.y + entry.drawRect.height)) + padding;
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
      const layoutModel = this.getWorldMapLayoutModel();
      if (layoutModel?.getWorldTileStaticViewportCacheLayout) {
        return layoutModel.getWorldTileStaticViewportCacheLayout(tileMapView, viewport, frame, entries);
      }
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

    getWorldTileAtlasFramePadding(geometry = {}, viewport = {}) {
      const layoutModel = this.getWorldMapLayoutModel();
      if (layoutModel?.getWorldTileAtlasFramePadding) {
        return layoutModel.getWorldTileAtlasFramePadding(geometry, viewport);
      }
      const scale = Number(viewport.scale) || 1;
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      return Math.max(tileWidth * 1.2, tileHeight * 2.2, 96);
    }

    getWorldTileStaticChunkLayouts(tileMapView = {}, viewport = {}, frame = {}, geometry = {}) {
      const layoutModel = this.getWorldMapLayoutModel();
      if (layoutModel?.getWorldTileStaticChunkLayouts) {
        const localEntries = this.getWorldTileLocalEntries(tileMapView, viewport, geometry);
        return layoutModel.getWorldTileStaticChunkLayouts(tileMapView, viewport, frame, geometry, {
          tileMapGeometry: this.getTileMapGeometry(),
          localEntries,
          atlasLayout: this.getWorldTileStaticCacheLayout(tileMapView, viewport, geometry),
          padding: this.getWorldTileAtlasFramePadding(geometry, viewport),
          cacheScale: this.getWorldTileStaticChunkCacheScale(),
          pixelBudget: this.getWorldTileStaticCachePixelBudget(),
          chunkSize: this.getWorldTileStaticChunkSize(),
        });
      }
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

    getWorldTileStaticDragCacheLayout(tileMapView = {}, viewport = {}, frame = {}, geometry = {}) {
      const layoutModel = this.getWorldMapLayoutModel();
      if (layoutModel?.getWorldTileStaticDragCacheLayout) {
        return layoutModel.getWorldTileStaticDragCacheLayout(tileMapView, viewport, frame, geometry, {
          tileMapGeometry: this.getTileMapGeometry(),
          localEntries: this.getWorldTileLocalEntries(tileMapView, viewport, geometry),
          panRange: this.getWorldTileDragCachePanRange(),
        });
      }
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


    getWorldMapHitTargetModel() {
      return this.constructor.getWorldMapHitTargetModel?.()
        || null;
    }

    getWorldMarchRoutePolicy() {
      return this.constructor.getWorldMarchRoutePolicy?.()
        || null;
    }

    evaluateMarchTarget(state = {}, tile = {}, tileMapView = {}) {
      const policy = this.getWorldMarchRoutePolicy();
      if (!policy?.evaluateMarchTarget) return null;
      return policy.evaluateMarchTarget(state || {}, tile, { tileMapView });
    }

    normalizeTileCoord(tile = {}) {
      const helper = this.getTileMapGeometry();
      if (helper?.normalizeCoord) return helper.normalizeCoord(tile);
      return TileCoord.normalizeCoord(tile);
    }

    registerHitTargets(targets = []) {
      if (!Array.isArray(targets) || !targets.length) return false;
      targets.forEach((target) => this.addHitTarget(target.rect, target.action));
      return true;
    }

    addWorldTileSiteHitTargets(tileMapView = {}, viewport = {}, entries = [], uiState = {}) {
      const hitTargetModel = this.getWorldMapHitTargetModel();
      if (hitTargetModel?.createWorldTileSiteHitTargets) {
        const targets = hitTargetModel.createWorldTileSiteHitTargets(tileMapView, viewport, entries, {
          layoutModel: this.getWorldMapLayoutModel(),
          analyzeAssetAlphaBounds: (assetPath) => this.analyzeAssetAlphaBounds(assetPath),
          tileMapGeometry: this.getTileMapGeometry(),
          tileMapAssetManifest: this.getTileMapAssetManifest(),
          uiState,
        });
        return this.registerHitTargets(targets);
      }
      const geometry = tileMapView.geometry || {};
      const scale = Number(viewport.scale) || 1;
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      const targets = [];
      entries.filter(({ tile }) => tile?.site).forEach(({ tile, center }) => {
        const layout = this.getWorldTileSiteLayout(tile, viewport, geometry, tileWidth, tileHeight, center);
        if (!layout) return;
        const coord = this.normalizeTileCoord(tile);
        targets.push({
          rect: layout.hitRect,
          action: {
            type: 'openWorldSite',
            siteId: layout.site.id,
            tileId: coord.tileId,
            inputSurface: 'worldMap',
          },
        });
      });
      return this.registerHitTargets(targets);
    }

    addWorldMarchTileHitTargets(tileMapView = {}, viewport = {}, frame = {}, options = {}) {
      const state = options.state || {};
      const hitTargetModel = this.getWorldMapHitTargetModel();
      if (hitTargetModel?.createWorldMarchTileHitTargets) {
        const targets = hitTargetModel.createWorldMarchTileHitTargets(tileMapView, viewport, frame, {
          layoutModel: this.getWorldMapLayoutModel(),
          tileMapGeometry: this.getTileMapGeometry(),
          evaluateMarchTarget: (tile, view) => this.evaluateMarchTarget(state, tile, view),
        });
        return this.registerHitTargets(targets);
      }
      if (!Array.isArray(tileMapView.tiles) || !tileMapView.tiles.length) return false;
      const geometry = tileMapView.geometry || {};
      const targets = [];
      (tileMapView.tiles || []).forEach((tile) => {
        const coord = this.normalizeTileCoord(tile);
        const center = this.getWorldTileScreenCenter(tile, viewport, geometry);
        if (
          center.x < frame.x - 48
          || center.x > frame.x + frame.width + 48
          || center.y < frame.y - 32
          || center.y > frame.y + frame.height + 32
        ) return;
        const tileWidth = (Number(geometry.tileWidth) || 192) * (Number(viewport.scale) || 1) * 0.86;
        const tileHeight = (Number(geometry.tileHeight) || 96) * (Number(viewport.scale) || 1) * 0.86;
        const marchCheck = this.evaluateMarchTarget(state, tile, tileMapView);
        const marchDisabled = marchCheck?.canMarch === false;
        targets.push({
          rect: {
            x: center.x - tileWidth / 2,
            y: center.y - tileHeight / 2,
            width: tileWidth,
            height: tileHeight,
          },
          action: {
            type: 'selectWorldMarchTarget',
            tileId: coord.tileId,
            targetQ: coord.q,
            targetR: coord.r,
            known: tile.visibility !== 'unknown' && tile.discovered !== false,
            terrain: tile.terrain || '',
            terrainLabel: tile.terrainLabel || tile.terrain || '',
            marchDisabled,
            marchDisabledReason: marchDisabled ? (marchCheck.reason || 'EXPLORE_ROUTE_BLOCKED') : '',
            background: true,
            inputSurface: 'worldMap',
          },
        });
      });
      return this.registerHitTargets(targets);
    }


    getWorldMapCachePolicy() {
      return this.constructor.getWorldMapCachePolicy?.()
        || null;
    }

    getWorldMapLayerCacheStore() {
      return this.constructor.getWorldMapLayerCacheStore?.()
        || null;
    }

    getWorldTileStaticCacheKey(tileMapView = {}, viewport = {}, frame = {}, entries = [], uiState = {}, options = {}) {
      const cachePolicy = this.getWorldMapCachePolicy();
      if (cachePolicy?.getWorldTileStaticCacheKey) {
        return cachePolicy.getWorldTileStaticCacheKey(tileMapView, viewport, frame, entries, uiState, options);
      }
      const scale = Number(viewport.scale) || 1;
      const selectedSiteId = uiState.selectedSiteId || '';
      const entrySignature = entries.map(({ tile = {}, center = {}, drawRect = {} }) => {
        const coord = this.normalizeTileCoord(tile);
        return [
          coord.tileId,
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
          Math.round((Number(center.x) || 0) * 10) / 10,
          Math.round((Number(center.y) || 0) * 10) / 10,
          Math.round((Number(drawRect.x) || 0) * 10) / 10,
          Math.round((Number(drawRect.y) || 0) * 10) / 10,
        ].join('|');
      }).join(';');
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

    getWorldTileLayerCacheContext(cacheName, width, height, cacheScale = 1) {
      const cacheStore = this.getWorldMapLayerCacheStore();
      if (cacheStore?.getLayerCacheContext) {
        return cacheStore.getLayerCacheContext(this.worldMapCacheState, cacheName, width, height, cacheScale, {
          createCanvas: (pixelWidth, pixelHeight) => this.createTileWorkCanvas(pixelWidth, pixelHeight),
        });
      }
      const localW = Math.max(1, Math.ceil(Number(width) || 1));
      const localH = Math.max(1, Math.ceil(Number(height) || 1));
      const scale = Math.max(1, Number(cacheScale) || 1);
      const pixelW = Math.max(1, Math.ceil(localW * scale));
      const pixelH = Math.max(1, Math.ceil(localH * scale));
      const cached = this.worldMapCacheState?.[cacheName];
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
      if (!canvas || !ctx || !this.worldMapCacheState) return null;
      this.worldMapCacheState[cacheName] = {
        canvas,
        ctx,
        width: localW,
        height: localH,
        pixelWidth: pixelW,
        pixelHeight: pixelH,
        scale,
      };
      return this.worldMapCacheState[cacheName];
    }

    getWorldTileStaticCacheContext(width, height, cacheScale = 1) {
      return this.getWorldTileLayerCacheContext('worldTileStaticCache', width, height, cacheScale);
    }

    getWorldTileWaterLayerCacheContext(width, height, cacheScale = 1) {
      return this.getWorldTileLayerCacheContext('worldTileWaterLayerCache', width, height, cacheScale);
    }

    createWorldTileLayerWork(width, height, cacheScale = 1) {
      const cacheStore = this.getWorldMapLayerCacheStore();
      if (cacheStore?.createLayerWork) {
        return cacheStore.createLayerWork(width, height, cacheScale, {
          createCanvas: (pixelWidth, pixelHeight) => this.createTileWorkCanvas(pixelWidth, pixelHeight),
        });
      }
      const localW = Math.max(1, Math.ceil(Number(width) || 1));
      const localH = Math.max(1, Math.ceil(Number(height) || 1));
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
      const cacheStore = this.getWorldMapLayerCacheStore();
      if (cacheStore?.drawLayerCache) {
        return cacheStore.drawLayerCache(this.ctx, work, layout, clipFrame);
      }
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
      if (visibleWidth <= 0 || visibleHeight <= 0) return false;
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

    resolveWorldTileStaticCacheLayout(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      const geometry = tileMapView.geometry || {};
      const cacheScale = this.getWorldTileStaticCacheScale();
      const pixelBudget = this.getWorldTileStaticCachePixelBudget();
      const worldLayout = this.getWorldTileStaticCacheLayout(tileMapView, viewport, geometry);
      const chunkLayouts = this.getWorldTileStaticChunkLayouts(tileMapView, viewport, frame, geometry);
      const viewportLayout = this.getWorldTileStaticViewportCacheLayout(tileMapView, viewport, frame, entries);
      const cachePolicy = this.getWorldMapCachePolicy();
      if (cachePolicy?.resolveWorldTileStaticCacheLayout) {
        return cachePolicy.resolveWorldTileStaticCacheLayout({
          worldLayout,
          chunkLayouts,
          viewportLayout,
          cacheScale,
          pixelBudget,
          fastDragActive: this.worldTileFastDragActive,
        });
      }
      if (!worldLayout) return null;
      const worldPixels = worldLayout.frame.width * worldLayout.frame.height * cacheScale * cacheScale;
      if (worldPixels <= pixelBudget) return worldLayout;
      if (chunkLayouts.length) return { kind: 'chunks', layouts: chunkLayouts };
      if (this.worldTileFastDragActive) return null;
      if (!viewportLayout) return null;
      const viewportPixels = viewportLayout.frame.width * viewportLayout.frame.height * cacheScale * cacheScale;
      return viewportPixels <= pixelBudget ? viewportLayout : null;
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

    drawWorldTileSite(tile = {}, viewport = {}, geometry = {}, tileWidth = 192, tileHeight = 96, uiState = {}, options = {}) {
      if (!this.worldMapStaticEntryRenderer?.drawWorldTileSite) return false;
      return this.worldMapStaticEntryRenderer.drawWorldTileSite(tile, viewport, geometry, tileWidth, tileHeight, uiState, options);
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

    addWorldMapDragHitTarget(x = 0, y = 0, width = 0, height = 0) {
      if (!this.worldMapTileMapRenderer?.addWorldMapDragHitTarget) return false;
      return this.worldMapTileMapRenderer.addWorldMapDragHitTarget(x, y, width, height);
    }

    renderWorldScoutRoutes(tileMapView = {}, viewport = {}, actors = []) {
      if (!this.worldMapScoutRenderer?.renderWorldScoutRoutes) return false;
      return this.worldMapScoutRenderer.renderWorldScoutRoutes(tileMapView, viewport, actors);
    }

    renderWorldScoutUnits(tileMapView = {}, viewport = {}, options = {}) {
      if (!this.worldMapActorHudRenderer?.renderWorldScoutUnits) return false;
      return this.worldMapActorHudRenderer.renderWorldScoutUnits(tileMapView, viewport, options);
    }

    renderWorldActors(actors = [], viewport = {}, geometry = {}, options = {}) {
      if (!this.worldMapActorHudRenderer?.renderWorldActors) return false;
      return this.worldMapActorHudRenderer.renderWorldActors(actors, viewport, geometry, options);
    }

    addWorldActorHitTargets(actors = [], viewport = {}, geometry = {}) {
      if (!this.worldMapActorHudRenderer?.addWorldActorHitTargets) return false;
      return this.worldMapActorHudRenderer.addWorldActorHitTargets(actors, viewport, geometry);
    }

    renderWorldMarchHud(state = {}, uiState = {}, actors = [], viewport = {}, geometry = {}, frame = {}, targetPicker = null) {
      if (!this.worldMapActorHudRenderer?.renderWorldMarchHud) return false;
      return this.worldMapActorHudRenderer.renderWorldMarchHud(state, uiState, actors, viewport, geometry, frame, targetPicker);
    }

    renderWorldMapActorLayer(state = {}, options = {}) {
      const target = this.worldActorLayerRenderer && this.worldActorLayerRenderer !== this
        ? this.worldActorLayerRenderer
        : this;
      const targetCtx = target?.ctx || target?.worldMapLayerRenderer?.ctx || null;
      const terrainCtx = this.ctx || this.host?.ctx || null;
      if (target !== this && terrainCtx && targetCtx && terrainCtx === targetCtx) {
        return false;
      }
      const layerContext = options.worldMapRuntimeContext
        || this.lastWorldTileMapContext
        || target.lastWorldTileMapContext
        || null;
      if (target !== this) {
        target.worldMapRenderState = this.worldMapRenderState;
        if (target.worldMapLayerRenderer) {
          target.worldMapLayerRenderer.worldMapRenderState = this.worldMapRenderState;
        }
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
      if (this.worldMapActorHudRenderer?.host !== this && typeof this.worldMapActorHudRenderer?.getEpochNowMs === 'function') {
        return this.worldMapActorHudRenderer.getEpochNowMs();
      }
      const WorldTime = this.constructor.getWorldTime?.();
      return WorldTime?.getEpochNowMs?.(this) ?? Date.now();
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


    get pixelRatio() {
      return Number(this.host?.pixelRatio) || 1;
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

    getWorldTileDragCachePanRange() {
      return 180;
    }

    getWorldTileStaticCacheScale() {
      return Math.max(1, Number(this.pixelRatio) || 1);
    }

    getWorldTileStaticCachePixelBudget() {
      return 16000000;
    }

  }

  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapCanvasRenderer;
  else global.WorldMapCanvasRenderer = WorldMapCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
