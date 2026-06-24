(function (global) {
  const CORE_FACADE_METHODS = Object.freeze({
    delegateSurfaceRenderer(method, args = []) {
      const renderer = this.surfaceRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...Array.from(args));
    },

    hasSurfaceRendererMethod(method) {
      const renderer = this.surfaceRenderer;
      return Boolean(renderer && typeof renderer[method] === 'function');
    },

    getLayout(...args) {
      const result = this.delegateSurfaceRenderer('getLayout', args);
      if (result !== undefined) return result;
      const contentWidth = Math.min(this.maxContentWidth, Math.max(300, this.width - this.edgePadding * 2));
      const contentX = Math.max(this.edgePadding, Math.floor((this.width - contentWidth) / 2));
      return { contentX, contentWidth, contentRight: contentX + contentWidth };
    },

    createGradient(...args) {
      const result = this.delegateSurfaceRenderer('createGradient', args);
      return result === undefined ? (args[5] || '#000') : result;
    },

    createRadialGradient(...args) {
      const result = this.delegateSurfaceRenderer('createRadialGradient', args);
      return result === undefined ? (args[7] || '#000') : result;
    },

    roundRectPath(...args) {
      return this.delegateSurfaceRenderer('roundRectPath', args);
    },

    createImage() {
      return null;
    },

    delegateAssetRenderer(method, args = []) {
      const renderer = this.assetRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...Array.from(args));
    },

    hasAssetRendererMethod(method) {
      const renderer = this.assetRenderer;
      return Boolean(renderer && typeof renderer[method] === 'function');
    },

    preloadAssets(...args) {
      const result = this.delegateAssetRenderer('preloadAssets', args);
      if (result !== undefined) return result;
      const paths = Array.from(new Set((args[0] || this.getPreloadAssetPaths() || []).filter(Boolean)));
      args[1]?.({ total: paths.length, completed: paths.length, loaded: 0, failed: paths.length, percentage: 100 });
      return Promise.resolve({ total: paths.length, completed: paths.length, loaded: 0, failed: paths.length, percentage: 100 });
    },

    scheduleWorldTileCachePrewarm(...args) {
      const result = this.delegateAssetRenderer('scheduleWorldTileCachePrewarm', args);
      return result === undefined
        ? { total: 0, candidateTotal: 0, scheduled: false, metrics: 0, masks: 0, dryTemplates: 0 }
        : result;
    },

    isWorldTilePrewarmMetricAssetPath(...args) {
      const result = this.delegateAssetRenderer('isWorldTilePrewarmMetricAssetPath', args);
      return result === undefined ? false : result;
    },

    isWorldTileTemplateAssetPath(...args) {
      const result = this.delegateAssetRenderer('isWorldTileTemplateAssetPath', args);
      return result === undefined ? false : result;
    },

    isWorldTileWaterTemplateAssetPath(...args) {
      const result = this.delegateAssetRenderer('isWorldTileWaterTemplateAssetPath', args);
      return result === undefined ? false : result;
    },

    prewarmWorldTileCaches(...args) {
      const result = this.delegateAssetRenderer('prewarmWorldTileCaches', args);
      return result === undefined ? { total: 0, metrics: 0, masks: 0, dryTemplates: 0 } : result;
    },

    prewarmWorldTileCachesForLoading(...args) {
      const result = this.delegateAssetRenderer('prewarmWorldTileCachesForLoading', args);
      return result === undefined
        ? Promise.resolve({ total: 0, candidateTotal: 0, completed: 0, percentage: 100, metrics: 0, masks: 0, dryTemplates: 0 })
        : result;
    },

    getAsset(...args) {
      const result = this.delegateAssetRenderer('getAsset', args);
      return result === undefined ? null : result;
    },

    setHitTargets(...args) {
      if (this.hasSurfaceRendererMethod('setHitTargets')) {
        this.hitTargets = args[0] || [];
        return this.delegateSurfaceRenderer('setHitTargets', args);
      }
      this.hitTargets = args[0] || [];
      return undefined;
    },

    addHitTarget(...args) {
      if (this.hasSurfaceRendererMethod('addHitTarget')) {
        const result = this.delegateSurfaceRenderer('addHitTarget', args);
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
      const result = this.delegateSurfaceRenderer('getHitTarget', args);
      return result === undefined ? null : result;
    },

    containsPoint(...args) {
      const result = this.delegateSurfaceRenderer('containsPoint', args);
      return result === undefined ? false : result;
    },

    setHoverPoint(...args) {
      const result = this.delegateSurfaceRenderer('setHoverPoint', args);
      return result === undefined ? false : result;
    },

    delegateFamousRenderer(method, args = []) {
      const renderer = this.famousRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...Array.from(args));
    },

    isSameFamousSkillTooltipAction(...args) {
      const result = this.delegateFamousRenderer('isSameFamousSkillTooltipAction', args);
      return result === undefined ? false : result;
    },

    clearFamousSkillTooltip(...args) {
      const result = this.delegateFamousRenderer('clearFamousSkillTooltip', args);
      if (result !== undefined) return result;
      const changed = Boolean(this.hoverPoint || this.activeFamousSkillTooltip || this.pinnedFamousSkillTooltip);
      this.hoverPoint = null;
      this.activeFamousSkillTooltip = null;
      this.pinnedFamousSkillTooltip = null;
      return changed;
    },

    setPinnedFamousSkillTooltip(...args) {
      const result = this.delegateFamousRenderer('setPinnedFamousSkillTooltip', args);
      return result === undefined ? this.clearFamousSkillTooltip() : result;
    },

    getFamousSkillTooltipAction(...args) {
      const result = this.delegateFamousRenderer('getFamousSkillTooltipAction', args);
      return result === undefined ? null : result;
    },

    isAllowedUnderTutorialShield(...args) {
      const result = this.delegateSurfaceRenderer('isAllowedUnderTutorialShield', args);
      return result === undefined ? false : result;
    },

    matchesTutorialShieldAllowedAction(...args) {
      const result = this.delegateSurfaceRenderer('matchesTutorialShieldAllowedAction', args);
      return result === undefined ? false : result;
    },

    matchesCurrentTutorialIntroAction(...args) {
      const result = this.delegateSurfaceRenderer('matchesCurrentTutorialIntroAction', args);
      return result === undefined ? false : result;
    },

    withSuppressedHitTargets(...args) {
      if (this.hasSurfaceRendererMethod('withSuppressedHitTargets')) {
        return this.delegateSurfaceRenderer('withSuppressedHitTargets', args);
      }
      return args[0]?.();
    },

    withSlideClip(...args) {
      if (this.hasSurfaceRendererMethod('withSlideClip')) {
        return this.delegateSurfaceRenderer('withSlideClip', args);
      }
      return args[5]?.();
    },

    withTranslatedClip(...args) {
      if (this.hasSurfaceRendererMethod('withTranslatedClip')) {
        return this.delegateSurfaceRenderer('withTranslatedClip', args);
      }
      return args[6]?.();
    },

    withTransformedClip(...args) {
      if (this.hasSurfaceRendererMethod('withTransformedClip')) {
        return this.delegateSurfaceRenderer('withTransformedClip', args);
      }
      return args[7]?.();
    },

    setAssetsChangedHandler(...args) {
      const result = this.delegateAssetRenderer('setAssetsChangedHandler', args);
      if (result !== undefined || this.hasAssetRendererMethod('setAssetsChangedHandler')) return result;
      this.assetsChangedHandler = typeof args[0] === 'function' ? args[0] : null;
      return undefined;
    },

    handleAssetsChanged(...args) {
      const result = this.delegateAssetRenderer('handleAssetsChanged', args);
      if (result !== undefined || this.hasAssetRendererMethod('handleAssetsChanged')) return result;
      this.invalidateWorldTileCaches();
      if (this.assetsChangedHandler) this.assetsChangedHandler();
      return undefined;
    },

    invalidateWorldTileCaches(...args) {
      const result = this.delegateAssetRenderer('invalidateWorldTileCaches', args);
      if (result !== undefined || this.hasAssetRendererMethod('invalidateWorldTileCaches')) return result;
      this.invalidateWorldTileViewCache();
      return undefined;
    },

    hasPreparedWorldTileSnapshotCache(...args) {
      const result = this.delegateAssetRenderer('hasPreparedWorldTileSnapshotCache', args);
      return result === undefined ? false : result;
    },

    invalidateWorldTileViewCache(...args) {
      const result = this.delegateAssetRenderer('invalidateWorldTileViewCache', args);
      if (result !== undefined || this.hasAssetRendererMethod('invalidateWorldTileViewCache')) return result;
      this.worldTileViewCache = null;
      this.worldTileVisibleEntriesCache = null;
      this.worldTileLocalEntriesCache = null;
      return undefined;
    },

    drawAsset(...args) {
      const result = this.delegateAssetRenderer('drawAsset', args);
      return result === undefined ? false : result;
    },

    drawAssetClipped(...args) {
      const result = this.delegateAssetRenderer('drawAssetClipped', args);
      return result === undefined ? false : result;
    },

    getFallbackAssetMetrics(...args) {
      const result = this.delegateAssetRenderer('getFallbackAssetMetrics', args);
      if (result !== undefined) return result;
      const [image] = args;
      const width = Number(image?.naturalWidth || image?.width || 1) || 1;
      const height = Number(image?.naturalHeight || image?.height || 1) || 1;
      return { x: 0, y: 0, width, height, sourceWidth: width, sourceHeight: height };
    },

    isOpaquePixel(...args) {
      const result = this.delegateAssetRenderer('isOpaquePixel', args);
      return result === undefined ? false : result;
    },

    isWorldTileTemplateWaterPixel(...args) {
      const result = this.delegateAssetRenderer('isWorldTileTemplateWaterPixel', args);
      return result === undefined ? false : result;
    },

    measurePixelBounds(...args) {
      const result = this.delegateAssetRenderer('measurePixelBounds', args);
      return result === undefined ? null : result;
    },

    analyzeAssetAlphaBounds(...args) {
      const result = this.delegateAssetRenderer('analyzeAssetAlphaBounds', args);
      return result === undefined ? this.getFallbackAssetMetrics(null) : result;
    },

    getIsoTileSourceRect(...args) {
      const result = this.delegateAssetRenderer('getIsoTileSourceRect', args);
      return result === undefined ? null : result;
    },

    getWorldTileTemplateMetrics(...args) {
      const result = this.delegateAssetRenderer('getWorldTileTemplateMetrics', args);
      return result === undefined ? null : result;
    },

    drawTileAsset(...args) {
      const result = this.delegateAssetRenderer('drawTileAsset', args);
      return result === undefined ? false : result;
    },

    getTemplateCanvasFactory(...args) {
      const result = this.delegateAssetRenderer('getTemplateCanvasFactory', args);
      return result === undefined ? null : result;
    },

    createTileWorkCanvas(...args) {
      const result = this.delegateAssetRenderer('createTileWorkCanvas', args);
      return result === undefined ? null : result;
    },

    delegateWorldTileWaterRenderer(method, args = []) {
      const renderer = this.worldTileWaterRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...Array.from(args));
    },

    isInsideTemplateDiamond(...args) {
      const result = this.delegateWorldTileWaterRenderer('isInsideTemplateDiamond', args);
      if (result !== undefined) return result;
      const [x, y, metrics] = args;
      const centerX = metrics.x + metrics.width * 0.5;
      const centerY = metrics.y + metrics.height * 0.5;
      const halfW = metrics.width * 0.5;
      const halfH = metrics.height * 0.5;
      return Math.abs(x - centerX) / Math.max(1, halfW) + Math.abs(y - centerY) / Math.max(1, halfH) <= 1.03;
    },

    createWorldTileColorWaterMask(...args) {
      const result = this.delegateWorldTileWaterRenderer('createWorldTileColorWaterMask', args);
      return result === undefined ? null : result;
    },

    createWorldTileTransparentWaterMask(...args) {
      const result = this.delegateWorldTileWaterRenderer('createWorldTileTransparentWaterMask', args);
      return result === undefined ? null : result;
    },

    getWorldTileTemplateMask(...args) {
      const result = this.delegateWorldTileWaterRenderer('getWorldTileTemplateMask', args);
      return result === undefined ? null : result;
    },

    getWorldTileDryTemplateCanvas(...args) {
      const result = this.delegateWorldTileWaterRenderer('getWorldTileDryTemplateCanvas', args);
      return result === undefined ? null : result;
    },

    drawCanvasClipped(...args) {
      const result = this.delegateAssetRenderer('drawCanvasClipped', args);
      return result === undefined ? false : result;
    },

    getWorldTileCompositeContext(...args) {
      const result = this.delegateWorldTileWaterRenderer('getWorldTileCompositeContext', args);
      return result === undefined ? null : result;
    },

    drawWorldTileTemplateSource(...args) {
      const result = this.delegateWorldTileWaterRenderer('drawWorldTileTemplateSource', args);
      return result === undefined ? false : result;
    },

    drawWorldTileDryTemplate(...args) {
      const result = this.delegateWorldTileWaterRenderer('drawWorldTileDryTemplate', args);
      return result === undefined ? false : result;
    },

    getWorldTileTemplateBaseAsset(...args) {
      const result = this.delegateWorldTileWaterRenderer('getWorldTileTemplateBaseAsset', args);
      return result === undefined ? null : result;
    },

    getWorldTileWaterTemplateAssets(...args) {
      const result = this.delegateWorldTileWaterRenderer('getWorldTileWaterTemplateAssets', args);
      return result === undefined ? [] : result;
    },

    getWorldTileWaterWorkContext(...args) {
      const result = this.delegateWorldTileWaterRenderer('getWorldTileWaterWorkContext', args);
      return result === undefined ? null : result;
    },

    positiveModulo(...args) {
      const result = this.delegateWorldTileWaterRenderer('positiveModulo', args);
      if (result !== undefined) return result;
      const [value, size] = args;
      return ((value % size) + size) % size;
    },

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
    },

    fillWorldTileWaterTexture(...args) {
      const result = this.delegateWorldTileWaterRenderer('fillWorldTileWaterTexture', args);
      return result === undefined ? false : result;
    },

    drawWorldTileWaterDiamond(...args) {
      const result = this.delegateWorldTileWaterRenderer('drawWorldTileWaterDiamond', args);
      return result === undefined ? false : result;
    },

    drawWorldTileWaterLayer(...args) {
      const result = this.delegateWorldTileWaterRenderer('drawWorldTileWaterLayer', args);
      return result === undefined ? false : result;
    },

    drawWorldTileWater(...args) {
      const result = this.delegateWorldTileWaterRenderer('drawWorldTileWater', args);
      return result === undefined ? false : result;
    },

    isWorldTileMapWaterAnimated(...args) {
      const result = this.delegateWorldTileWaterRenderer('isWorldTileMapWaterAnimated', args);
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
      const result = this.delegateWorldTileWaterRenderer('drawWorldTileBase', arguments);
      if (result !== undefined) return result;
      const baseTemplate = this.getWorldTileTemplateBaseAsset(tile);
      const baseAsset = baseTemplate?.asset || tile.terrainAsset || '';
      const hasWater = Boolean(tile.water?.kind && tile.water?.asset && baseTemplate?.asset);
      const drawnWater = hasWater ? this.drawWorldTileWater(tile, center, drawRect, viewport) : false;
      if (drawnWater) return true;
      return this.drawTileAsset(baseAsset, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
    },

    drawCoverAsset(...args) {
      const result = this.delegateAssetRenderer('drawCoverAsset', args);
      return result === undefined ? false : result;
    },

    drawFamousPortraitLayer(...args) {
      const result = this.delegateFamousRenderer('drawFamousPortraitLayer', args);
      return result === undefined ? false : result;
    },

    drawFamousPortrait(...args) {
      const result = this.delegateFamousRenderer('drawFamousPortrait', args);
      return result === undefined ? false : result;
    },

    drawFamousAttributeRadar(...args) {
      const result = this.delegateFamousRenderer('drawFamousAttributeRadar', args);
      return result === undefined ? undefined : result;
    },

    drawFamousAttributePointControls(...args) {
      const result = this.delegateFamousRenderer('drawFamousAttributePointControls', args);
      return result === undefined ? 0 : result;
    },

    getFamousQualityStyle(...args) {
      const result = this.delegateFamousRenderer('getFamousQualityStyle', args);
      return result === undefined ? { fill: 'rgba(43, 43, 42, 0.96)', stroke: '#d9d8cf', inset: 'rgba(255, 255, 255, 0.18)', glow: 'rgba(255, 255, 255, 0.1)', text: '#eeeee8' } : result;
    },

    drawFamousAvatarCard(...args) {
      const result = this.delegateFamousRenderer('drawFamousAvatarCard', args);
      return result === undefined ? undefined : result;
    },

    renderFamousRosterGrid(...args) {
      const result = this.delegateFamousRenderer('renderFamousRosterGrid', args);
      return result === undefined ? { nextY: args[2] || 0, pageInfo: { index: 0, pages: 1 } } : result;
    },

    renderFamousPersonDetail(...args) {
      const result = this.delegateFamousRenderer('renderFamousPersonDetail', args);
      return result === undefined ? undefined : result;
    },
  });

  function installCoreFacades(RendererClass) {
    const proto = RendererClass?.prototype;
    if (!proto) return RendererClass;
    Object.entries(CORE_FACADE_METHODS).forEach(([method, value]) => {
      Object.defineProperty(proto, method, {
        configurable: true,
        writable: true,
        value,
      });
    });
    return RendererClass;
  }

  const api = {
    CORE_FACADE_METHODS,
    installCoreFacades,
  };

  global.CanvasGameRendererCoreFacades = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
