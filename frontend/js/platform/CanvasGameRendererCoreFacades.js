(function (global) {
  const CORE_FACADE_METHODS = Object.freeze({
    getLayout(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.getLayout === 'function'
        ? renderer.getLayout(...args)
        : undefined;
      if (result !== undefined) return result;
      const contentWidth = Math.min(this.maxContentWidth, Math.max(300, this.width - this.edgePadding * 2));
      const contentX = Math.max(this.edgePadding, Math.floor((this.width - contentWidth) / 2));
      return { contentX, contentWidth, contentRight: contentX + contentWidth };
    },

    createGradient(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.createGradient === 'function'
        ? renderer.createGradient(...args)
        : undefined;
      return result === undefined ? (args[5] || '#000') : result;
    },

    createRadialGradient(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.createRadialGradient === 'function'
        ? renderer.createRadialGradient(...args)
        : undefined;
      return result === undefined ? (args[7] || '#000') : result;
    },

    roundRectPath(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.roundRectPath === 'function'
        ? renderer.roundRectPath(...args)
        : undefined;
    },

    createImage() {
      return null;
    },

    preloadAssets(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.preloadAssets === 'function'
        ? renderer.preloadAssets(...args)
        : undefined;
      if (result !== undefined) return result;
      const paths = Array.from(new Set((args[0] || this.getPreloadAssetPaths() || []).filter(Boolean)));
      args[1]?.({ total: paths.length, completed: paths.length, loaded: 0, failed: paths.length, percentage: 100 });
      return Promise.resolve({ total: paths.length, completed: paths.length, loaded: 0, failed: paths.length, percentage: 100 });
    },

    scheduleWorldTileCachePrewarm(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.scheduleWorldTileCachePrewarm === 'function'
        ? renderer.scheduleWorldTileCachePrewarm(...args)
        : undefined;
      return result === undefined
        ? { total: 0, candidateTotal: 0, scheduled: false, metrics: 0, masks: 0, dryTemplates: 0 }
        : result;
    },

    isWorldTilePrewarmMetricAssetPath(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.isWorldTilePrewarmMetricAssetPath === 'function'
        ? renderer.isWorldTilePrewarmMetricAssetPath(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    isWorldTileTemplateAssetPath(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.isWorldTileTemplateAssetPath === 'function'
        ? renderer.isWorldTileTemplateAssetPath(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    isWorldTileWaterTemplateAssetPath(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.isWorldTileWaterTemplateAssetPath === 'function'
        ? renderer.isWorldTileWaterTemplateAssetPath(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    prewarmWorldTileCaches(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.prewarmWorldTileCaches === 'function'
        ? renderer.prewarmWorldTileCaches(...args)
        : undefined;
      return result === undefined ? { total: 0, metrics: 0, masks: 0, dryTemplates: 0 } : result;
    },

    prewarmWorldTileCachesForLoading(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.prewarmWorldTileCachesForLoading === 'function'
        ? renderer.prewarmWorldTileCachesForLoading(...args)
        : undefined;
      return result === undefined
        ? Promise.resolve({ total: 0, candidateTotal: 0, completed: 0, percentage: 100, metrics: 0, masks: 0, dryTemplates: 0 })
        : result;
    },

    getAsset(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.getAsset === 'function'
        ? renderer.getAsset(...args)
        : undefined;
      return result === undefined ? null : result;
    },

    setHitTargets(...args) {
      this.hitTargets = args[0] || [];
      const renderer = this.surfaceRenderer;
      return typeof renderer?.setHitTargets === 'function'
        ? renderer.setHitTargets(...args)
        : undefined;
    },

    addHitTarget(...args) {
      const renderer = this.surfaceRenderer;
      if (typeof renderer?.addHitTarget === 'function') {
        const result = renderer.addHitTarget(...args);
        if (this.surfaceRenderer?.hitTargets && this.hitTargets !== this.surfaceRenderer.hitTargets) {
          this.hitTargets = this.surfaceRenderer.hitTargets;
        }
        return result;
      }
      const [rect, action] = args;
      if (this.suppressHitTargets) return undefined;
      if (!action || !rect) return undefined;
      this.hitTargets.push({
        x: Number(rect.x) || 0,
        y: Number(rect.y) || 0,
        width: Number(rect.width) || 0,
        height: Number(rect.height) || 0,
        action,
      });
      return undefined;
    },

    appendWorldMapRuntimeHitTargets(targets = []) {
      if (!Array.isArray(targets) || !targets.length) return false;
      targets.forEach((target) => {
        this.addHitTarget({
          x: target.x,
          y: target.y,
          width: target.width,
          height: target.height,
        }, target.action);
      });
      return true;
    },

    getHitTarget(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.getHitTarget === 'function'
        ? renderer.getHitTarget(...args)
        : undefined;
      return result === undefined ? null : result;
    },

    containsPoint(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.containsPoint === 'function'
        ? renderer.containsPoint(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    setHoverPoint(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.setHoverPoint === 'function'
        ? renderer.setHoverPoint(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    isSameFamousSkillTooltipAction(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.isSameFamousSkillTooltipAction === 'function'
        ? renderer.isSameFamousSkillTooltipAction(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    clearFamousSkillTooltip(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.clearFamousSkillTooltip === 'function'
        ? renderer.clearFamousSkillTooltip(...args)
        : undefined;
      if (result !== undefined) return result;
      const changed = Boolean(this.hoverPoint || this.activeFamousSkillTooltip || this.pinnedFamousSkillTooltip);
      this.hoverPoint = null;
      this.activeFamousSkillTooltip = null;
      this.pinnedFamousSkillTooltip = null;
      return changed;
    },

    setPinnedFamousSkillTooltip(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.setPinnedFamousSkillTooltip === 'function'
        ? renderer.setPinnedFamousSkillTooltip(...args)
        : undefined;
      return result === undefined ? this.clearFamousSkillTooltip() : result;
    },

    getFamousSkillTooltipAction(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.getFamousSkillTooltipAction === 'function'
        ? renderer.getFamousSkillTooltipAction(...args)
        : undefined;
      return result === undefined ? null : result;
    },

    isAllowedUnderTutorialShield(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.isAllowedUnderTutorialShield === 'function'
        ? renderer.isAllowedUnderTutorialShield(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    matchesTutorialShieldAllowedAction(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.matchesTutorialShieldAllowedAction === 'function'
        ? renderer.matchesTutorialShieldAllowedAction(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    matchesCurrentTutorialIntroAction(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.matchesCurrentTutorialIntroAction === 'function'
        ? renderer.matchesCurrentTutorialIntroAction(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    withSuppressedHitTargets(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.withSuppressedHitTargets === 'function'
        ? renderer.withSuppressedHitTargets(...args)
        : args[0]?.();
    },

    withSlideClip(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.withSlideClip === 'function'
        ? renderer.withSlideClip(...args)
        : args[5]?.();
    },

    withTranslatedClip(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.withTranslatedClip === 'function'
        ? renderer.withTranslatedClip(...args)
        : args[6]?.();
    },

    withTransformedClip(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.withTransformedClip === 'function'
        ? renderer.withTransformedClip(...args)
        : args[7]?.();
    },

    setAssetsChangedHandler(...args) {
      const renderer = this.assetRenderer;
      if (typeof renderer?.setAssetsChangedHandler === 'function') {
        return renderer.setAssetsChangedHandler(...args);
      }
      this.assetsChangedHandler = typeof args[0] === 'function' ? args[0] : null;
      return undefined;
    },

    handleAssetsChanged(...args) {
      const renderer = this.assetRenderer;
      if (typeof renderer?.handleAssetsChanged === 'function') {
        return renderer.handleAssetsChanged(...args);
      }
      this.invalidateWorldTileCaches();
      if (this.assetsChangedHandler) this.assetsChangedHandler();
      return undefined;
    },

    invalidateWorldTileCaches(...args) {
      const renderer = this.assetRenderer;
      if (typeof renderer?.invalidateWorldTileCaches === 'function') {
        return renderer.invalidateWorldTileCaches(...args);
      }
      this.invalidateWorldTileViewCache();
      return undefined;
    },

    hasPreparedWorldTileSnapshotCache(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.hasPreparedWorldTileSnapshotCache === 'function'
        ? renderer.hasPreparedWorldTileSnapshotCache(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    invalidateWorldTileViewCache(...args) {
      const renderer = this.assetRenderer;
      if (typeof renderer?.invalidateWorldTileViewCache === 'function') {
        return renderer.invalidateWorldTileViewCache(...args);
      }
      this.worldTileViewCache = null;
      this.worldTileVisibleEntriesCache = null;
      this.worldTileLocalEntriesCache = null;
      return undefined;
    },

    drawAsset(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.drawAsset === 'function'
        ? renderer.drawAsset(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    drawAssetClipped(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.drawAssetClipped === 'function'
        ? renderer.drawAssetClipped(...args)
        : undefined;
      return result === undefined ? false : result;
    },

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
    },

    isOpaquePixel(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.isOpaquePixel === 'function'
        ? renderer.isOpaquePixel(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    isWorldTileTemplateWaterPixel(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.isWorldTileTemplateWaterPixel === 'function'
        ? renderer.isWorldTileTemplateWaterPixel(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    measurePixelBounds(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.measurePixelBounds === 'function'
        ? renderer.measurePixelBounds(...args)
        : undefined;
      return result === undefined ? null : result;
    },

    analyzeAssetAlphaBounds(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.analyzeAssetAlphaBounds === 'function'
        ? renderer.analyzeAssetAlphaBounds(...args)
        : undefined;
      return result === undefined ? this.getFallbackAssetMetrics(null) : result;
    },

    getIsoTileSourceRect(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.getIsoTileSourceRect === 'function'
        ? renderer.getIsoTileSourceRect(...args)
        : undefined;
      return result === undefined ? null : result;
    },

    getWorldTileTemplateMetrics(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.getWorldTileTemplateMetrics === 'function'
        ? renderer.getWorldTileTemplateMetrics(...args)
        : undefined;
      return result === undefined ? null : result;
    },

    drawTileAsset(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.drawTileAsset === 'function'
        ? renderer.drawTileAsset(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    getTemplateCanvasFactory(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.getTemplateCanvasFactory === 'function'
        ? renderer.getTemplateCanvasFactory(...args)
        : undefined;
      return result === undefined ? null : result;
    },

    createTileWorkCanvas(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.createTileWorkCanvas === 'function'
        ? renderer.createTileWorkCanvas(...args)
        : undefined;
      return result === undefined ? null : result;
    },

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
    },

    createWorldTileColorWaterMask(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.createWorldTileColorWaterMask === 'function'
        ? renderer.createWorldTileColorWaterMask(...args)
        : undefined;
      return result === undefined ? null : result;
    },

    createWorldTileTransparentWaterMask(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.createWorldTileTransparentWaterMask === 'function'
        ? renderer.createWorldTileTransparentWaterMask(...args)
        : undefined;
      return result === undefined ? null : result;
    },

    getWorldTileTemplateMask(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.getWorldTileTemplateMask === 'function'
        ? renderer.getWorldTileTemplateMask(...args)
        : undefined;
      return result === undefined ? null : result;
    },

    getWorldTileDryTemplateCanvas(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.getWorldTileDryTemplateCanvas === 'function'
        ? renderer.getWorldTileDryTemplateCanvas(...args)
        : undefined;
      return result === undefined ? null : result;
    },

    drawCanvasClipped(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.drawCanvasClipped === 'function'
        ? renderer.drawCanvasClipped(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    getWorldTileCompositeContext(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.getWorldTileCompositeContext === 'function'
        ? renderer.getWorldTileCompositeContext(...args)
        : undefined;
      return result === undefined ? null : result;
    },

    drawWorldTileTemplateSource(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.drawWorldTileTemplateSource === 'function'
        ? renderer.drawWorldTileTemplateSource(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    drawWorldTileDryTemplate(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.drawWorldTileDryTemplate === 'function'
        ? renderer.drawWorldTileDryTemplate(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    getWorldTileTemplateBaseAsset(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.getWorldTileTemplateBaseAsset === 'function'
        ? renderer.getWorldTileTemplateBaseAsset(...args)
        : undefined;
      return result === undefined ? null : result;
    },

    getWorldTileWaterTemplateAssets(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.getWorldTileWaterTemplateAssets === 'function'
        ? renderer.getWorldTileWaterTemplateAssets(...args)
        : undefined;
      return result === undefined ? [] : result;
    },

    getWorldTileWaterWorkContext(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.getWorldTileWaterWorkContext === 'function'
        ? renderer.getWorldTileWaterWorkContext(...args)
        : undefined;
      return result === undefined ? null : result;
    },

    positiveModulo(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.positiveModulo === 'function'
        ? renderer.positiveModulo(...args)
        : undefined;
      if (result !== undefined) return result;
      const [value, size] = args;
      return ((value % size) + size) % size;
    },

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
    },

    fillWorldTileWaterTexture(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.fillWorldTileWaterTexture === 'function'
        ? renderer.fillWorldTileWaterTexture(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    drawWorldTileWaterDiamond(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.drawWorldTileWaterDiamond === 'function'
        ? renderer.drawWorldTileWaterDiamond(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    drawWorldTileWaterLayer(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.drawWorldTileWaterLayer === 'function'
        ? renderer.drawWorldTileWaterLayer(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    drawWorldTileWater(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.drawWorldTileWater === 'function'
        ? renderer.drawWorldTileWater(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    isWorldTileMapWaterAnimated(...args) {
      const renderer = this.worldTileWaterRenderer;
      const result = typeof renderer?.isWorldTileMapWaterAnimated === 'function'
        ? renderer.isWorldTileMapWaterAnimated(...args)
        : undefined;
      if (result !== undefined) return result;
      const [tileMapView = {}] = args;
      return (tileMapView.tiles || []).some((tile) => tile.water?.asset);
    },

    getWorldTileMapFallbackSignature(territoryState = {}, worldExplorerState = {}) {
      const worldMap = territoryState.worldMap || {};
      const tiles = Array.isArray(worldMap.tiles) ? worldMap.tiles : [];
      const territories = Array.isArray(territoryState.territories) ? territoryState.territories : [];
      const explorerMissions = [
        worldExplorerState.activeMission,
        ...(Array.isArray(worldExplorerState.idleMissions) ? worldExplorerState.idleMissions : []),
        ...(Array.isArray(worldExplorerState.missions) ? worldExplorerState.missions : []),
      ].filter(Boolean);
      return JSON.stringify({
        version: worldMap.version || 0,
        seed: worldMap.seed || '',
        tiles: tiles.map((tile) => ({
          id: tile.id,
          q: tile.q,
          r: tile.r,
          terrain: tile.terrain,
          visibility: tile.visibility || '',
          discovered: tile.discovered !== false,
          visible: tile.visible !== false,
          siteId: tile.siteId || null,
        })),
        territories: territories.map((site) => ({
          id: site.id,
          x: site.x ?? site.q,
          y: site.y ?? site.r,
          status: site.status,
          owner: site.owner,
          type: site.type,
          art: site.art,
          name: site.cityName || site.naturalName,
        })),
        explorerMissions: explorerMissions.map((mission) => ({
          id: mission.id,
          status: mission.status,
          position: mission.position || null,
          revealedTileIds: mission.revealedTileIds || [],
          plannedTiles: (mission.plannedTiles || []).map((tile) => ({
            id: tile.id,
            q: tile.q,
            r: tile.r,
            terrain: tile.terrain,
            visibility: tile.visibility || '',
            siteId: tile.siteId || null,
          })),
          plannedSites: (mission.plannedSites || []).map((site) => ({
            tileId: site.tileId || '',
            q: site.q,
            r: site.r,
            siteId: site.siteId || site.site?.id || null,
            materialized: Boolean(site.materialized),
            site: site.site ? {
              id: site.site.id,
              x: site.site.x,
              y: site.site.y,
              status: site.site.status,
              owner: site.site.owner,
              type: site.site.type,
              art: site.site.art,
              name: site.site.cityName || site.site.naturalName,
            } : null,
          })),
        })),
      });
    },

    resolveWorldTileMapView(territoryState = {}, uiState = {}, options = {}) {
      if (!this.presenter?.buildWorldTileMapViewState) return null;
      const panX = Number(uiState.worldPanX) || 0;
      const panY = Number(uiState.worldPanY) || 0;
      const worldExplorerState = options.worldExplorerState || {};
      const viewOptions = {
        panX,
        panY,
        worldExplorerState,
        epochNowMs: options.epochNowMs,
        serverNowMs: options.serverNowMs,
      };
      const currentSignature = typeof this.presenter.getWorldTileMapSignature === 'function'
        ? String(this.presenter.getWorldTileMapSignature(territoryState, worldExplorerState, viewOptions) ?? '')
        : this.getWorldTileMapFallbackSignature(territoryState, worldExplorerState);
      const cached = this.worldTileViewCache;
      const canReuse = Boolean(options.reuseCachedWorldTileView
        && cached
        && cached.territoryState === territoryState
        && cached.signature === currentSignature);
      if (canReuse) {
        cached.view.pan = { x: panX, y: panY };
        return cached.view;
      }
      const view = this.presenter.buildWorldTileMapViewState(territoryState, viewOptions);
      this.worldTileViewCache = {
        territoryState,
        worldExplorerState,
        signature: currentSignature || view?.signature || '',
        view,
      };
      return view;
    },

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
    },

    drawCoverAsset(...args) {
      const renderer = this.assetRenderer;
      const result = typeof renderer?.drawCoverAsset === 'function'
        ? renderer.drawCoverAsset(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    drawFamousPortraitLayer(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.drawFamousPortraitLayer === 'function'
        ? renderer.drawFamousPortraitLayer(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    drawFamousPortrait(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.drawFamousPortrait === 'function'
        ? renderer.drawFamousPortrait(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    drawFamousAttributeRadar(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.drawFamousAttributeRadar === 'function'
        ? renderer.drawFamousAttributeRadar(...args)
        : undefined;
      return result === undefined ? undefined : result;
    },

    drawFamousAttributePointControls(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.drawFamousAttributePointControls === 'function'
        ? renderer.drawFamousAttributePointControls(...args)
        : undefined;
      return result === undefined ? 0 : result;
    },

    getFamousQualityStyle(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.getFamousQualityStyle === 'function'
        ? renderer.getFamousQualityStyle(...args)
        : undefined;
      return result === undefined ? { fill: 'rgba(43, 43, 42, 0.96)', stroke: '#d9d8cf', inset: 'rgba(255, 255, 255, 0.18)', glow: 'rgba(255, 255, 255, 0.1)', text: '#eeeee8' } : result;
    },

    drawFamousAvatarCard(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.drawFamousAvatarCard === 'function'
        ? renderer.drawFamousAvatarCard(...args)
        : undefined;
      return result === undefined ? undefined : result;
    },

    renderFamousRosterGrid(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.renderFamousRosterGrid === 'function'
        ? renderer.renderFamousRosterGrid(...args)
        : undefined;
      return result === undefined ? { nextY: args[2] || 0, pageInfo: { index: 0, pages: 1 } } : result;
    },

    renderFamousPersonDetail(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.renderFamousPersonDetail === 'function'
        ? renderer.renderFamousPersonDetail(...args)
        : undefined;
      return result === undefined ? undefined : result;
    },
  });

  function installCoreFacades(RendererClass) {
    const proto = RendererClass?.prototype;
    if (!proto) return RendererClass;
    const facadeDescriptors = {};
    for (const facadeMethodName of Object.keys(CORE_FACADE_METHODS)) {
      facadeDescriptors[facadeMethodName] = {
        configurable: true,
        writable: true,
        value: CORE_FACADE_METHODS[facadeMethodName],
      };
    }
    Object.defineProperties(proto, facadeDescriptors);
    return RendererClass;
  }

  const api = {
    CORE_FACADE_METHODS,
    installCoreFacades,
  };

  global.CanvasGameRendererCoreFacades = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
