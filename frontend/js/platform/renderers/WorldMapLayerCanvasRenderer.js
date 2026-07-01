(function (global) {
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/resource/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const SharedWorldMapRenderSnapshot = (() => {
    if (global.WorldMapRenderSnapshot) return global.WorldMapRenderSnapshot;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/projection/WorldMapRenderSnapshot');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const SharedWorldTime = (() => {
    if (global.WorldTime) return global.WorldTime;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/foundation/WorldTime');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  var WorldActorLayerManager = global.WorldActorLayerManager;
  if (typeof module !== 'undefined' && module.exports && !WorldActorLayerManager) {
    WorldActorLayerManager = require('./WorldActorLayerManager');
  }

  var WorldMapCacheCoordinator = global.WorldMapCacheCoordinator;
  if (typeof module !== 'undefined' && module.exports && !WorldMapCacheCoordinator) {
    WorldMapCacheCoordinator = require('./WorldMapCacheCoordinator');
  }

  var WorldMapHitTargetCollector = global.WorldMapHitTargetCollector;
  if (typeof module !== 'undefined' && module.exports && !WorldMapHitTargetCollector) {
    WorldMapHitTargetCollector = require('./WorldMapHitTargetCollector');
  }

  class WorldMapLayerCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.injectedWorldActorRenderer = options.worldActorRenderer || null;
    }

    get ctx() {
      return this.host?.ctx || null;
    }

    set ctx(value) {
      if (this.host) this.host.ctx = value || null;
    }

    get width() {
      return Number(this.host?.width) || 0;
    }

    get height() {
      return Number(this.host?.height) || 0;
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

    get lastGame() {
      return this.host?.lastGame || null;
    }

    get worldMapRenderer() {
      return this.host?.worldMapRenderer || null;
    }

    get worldMapLayerRenderer() {
      return this.host?.worldMapLayerRenderer || null;
    }

    get worldActorRenderer() {
      return this.host?.worldActorRenderer || null;
    }

    get worldActorLayerRenderer() {
      return this.host?.worldActorLayerRenderer || null;
    }

    get lastWorldTileMapContext() {
      return this.host?.lastWorldTileMapContext || null;
    }

    set lastWorldTileMapContext(value) {
      if (this.host) this.host.lastWorldTileMapContext = value || null;
    }

    get lastMapHomeWorldHudContext() {
      return this.host?.lastMapHomeWorldHudContext || null;
    }

    set lastMapHomeWorldHudContext(value) {
      if (this.host) this.host.lastMapHomeWorldHudContext = value || null;
    }

    get lastWorldActorOverlayDiag() {
      return this.host?.lastWorldActorOverlayDiag || null;
    }

    set lastWorldActorOverlayDiag(value) {
      if (this.host) this.host.lastWorldActorOverlayDiag = value || null;
    }

    get lastWorldActorOverlayDiagLogAt() {
      return this.host?.lastWorldActorOverlayDiagLogAt;
    }

    set lastWorldActorOverlayDiagLogAt(value) {
      if (this.host) this.host.lastWorldActorOverlayDiagLogAt = value;
    }

    get __worldActorOverlayDelegated() {
      return this.host?.__worldActorOverlayDelegated;
    }

    set __worldActorOverlayDelegated(value) {
      if (this.host) this.host.__worldActorOverlayDelegated = value;
    }

    get __worldActorOverlayActiveDiag() {
      return this.host?.__worldActorOverlayActiveDiag || null;
    }

    set __worldActorOverlayActiveDiag(value) {
      if (this.host) this.host.__worldActorOverlayActiveDiag = value || null;
    }

    get worldTileWaterTimeOverride() {
      return this.host?.worldTileWaterTimeOverride ?? null;
    }

    set worldTileWaterTimeOverride(value) {
      if (this.host) this.host.worldTileWaterTimeOverride = value ?? null;
    }

    get lastWorldMapLayerRenderResult() {
      return this.host?.lastWorldMapLayerRenderResult || null;
    }

    set lastWorldMapLayerRenderResult(value) {
      if (this.host) this.host.lastWorldMapLayerRenderResult = value || null;
    }

    addHitTarget(...args) {
      return this.host?.addHitTarget?.(...args);
    }

    addWorldActorHitTargets(...args) {
      return this.host?.addWorldActorHitTargets?.(...args) || false;
    }

    addWorldMapDragHitTarget(...args) {
      return this.host?.addWorldMapDragHitTarget?.(...args) || false;
    }

    addWorldMarchTileHitTargets(...args) {
      return this.host?.addWorldMarchTileHitTargets?.(...args) || false;
    }

    addWorldTileSiteHitTargets(...args) {
      return this.host?.addWorldTileSiteHitTargets?.(...args) || false;
    }

    beginFrame(...args) {
      return this.host?.beginFrame?.(...args);
    }

    clearAll(...args) {
      return this.host?.clearAll?.(...args);
    }

    createGradient(...args) {
      return this.host?.createGradient?.(...args) ?? args[5] ?? '#000';
    }

    drawButton(...args) {
      return this.host?.drawButton?.(...args);
    }

    drawCircle(...args) {
      return this.host?.drawCircle?.(...args);
    }

    drawPanel(...args) {
      return this.host?.drawPanel?.(...args);
    }

    drawText(...args) {
      return this.host?.drawText?.(...args);
    }

    endFrame(...args) {
      return this.host?.endFrame?.(...args);
    }

    getLayout(...args) {
      return this.host?.getLayout?.(...args) || { contentX: 0, contentWidth: this.width || 0, contentRight: this.width || 0 };
    }

    getWorldTileLayerCacheContext(...args) {
      return this.host?.getWorldTileLayerCacheContext?.(...args) || null;
    }

    getWorldTileRenderEntries(...args) {
      return this.host?.getWorldTileRenderEntries?.(...args) || [];
    }

    isWorldTileMapWaterAnimated(...args) {
      return this.host?.isWorldTileMapWaterAnimated?.(...args) || false;
    }

    renderMilitaryWorldView(...args) {
      return this.host?.renderMilitaryWorldView?.(...args) || false;
    }

    renderWorldActors(...args) {
      return this.host?.renderWorldActors?.(...args) || false;
    }

    renderWorldScoutRoutes(...args) {
      return this.host?.renderWorldScoutRoutes?.(...args) || false;
    }

    renderWorldTileMap(...args) {
      return this.host?.renderWorldTileMap?.(...args) || false;
    }

    renderWorldTileSnapshotCache(...args) {
      return this.host?.renderWorldTileSnapshotCache?.(...args) || false;
    }

    resolveWorldTileMapView(...args) {
      return this.host?.resolveWorldTileMapView?.(...args) || null;
    }

    setHitTargets(...args) {
      return this.host?.setHitTargets?.(...args);
    }

    withSuppressedHitTargets(callback) {
      if (typeof this.host?.withSuppressedHitTargets === 'function') return this.host.withSuppressedHitTargets(callback);
      return callback?.();
    }

    buildMilitaryNavigationViewState(state = {}) {
      if (this.presenter && typeof this.presenter.buildMilitaryNavigationViewState === 'function') {
        return this.presenter.buildMilitaryNavigationViewState(state);
      }
      const activeView = ['army', 'scout', 'world'].includes(state.militaryView) ? state.militaryView : 'army';
      return {
        activeView,
        locked: false,
        views: ['army', 'scout', 'world'].map((id) => ({
          id,
          isActive: id === activeView,
          disabled: false,
          isLocked: false,
          title: '',
          ariaSelected: String(id === activeView),
        })),
      };
    }

    getWorldMapLayerLayout(state = {}, topBarBottom = null, options = {}) {
      const nav = this.buildMilitaryNavigationViewState(state);
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
      const tileMapView = this.resolveWorldTileMapView(territoryState, uiState, {
        ...options,
        worldExplorerState: state.worldExplorerState || {},
      });
      if (!tileMapView?.tiles?.length) {
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
        ...options,
        state,
        hitTargetsOnly: Boolean(options.skipWorldMapLayer),
        frameless: true,
        fastDrag: Boolean(options.reuseCachedWorldTileView),
        scaleBasisWidth: visibleWidth,
        scaleBasisHeight: visibleMapH,
        originX: offsetX + visibleWidth * 0.5,
        originY: offsetY + visibleMapY + visibleMapH * 0.42,
      });
      return true;
    }

    getEpochNowMs() {
      return SharedWorldTime?.getEpochNowMs?.(this) ?? Date.now();
    }

    t(key = '', params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
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
      const message = options.loading?.message || this.t('world.map.loading.default');
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
      this.drawText(this.t('world.map.loading.syncHint'), x + panelWidth / 2, y + 52, {
        size: 11,
        color: '#cbbd96',
        align: 'center',
      });
      this.addHitTarget({ x: map.x, y: map.y, width: map.width, height: map.height }, { type: 'blockCanvasModal' });
      return true;
    }

    renderWorldMapLayer(state = {}, options = {}) {
      if (!this.presenter || !this.ctx) return false;
      this.setWorldMapLayerRenderResult({ rendered: false, reason: 'notReady' });
      const stateSummary = global.CodexWorldMapDiag?.summarizeState?.(state) || null;
      global.CodexWorldMapDiag?.logChanged?.('renderer:worldMapLayer:start', {
        activeTab: options.activeTab || '',
        isMapHome: Boolean(options.isMapHome),
        snapshotOnly: Boolean(options.snapshotOnly),
        collectHitTargets: options.collectHitTargets,
        tileCount: stateSummary?.worldMap?.tileCount || 0,
        mapVersion: stateSummary?.worldMap?.version || 0,
        currentTab: stateSummary?.currentTab || '',
        militaryView: stateSummary?.militaryView || '',
      }, {
        options: {
          activeTab: options.activeTab,
          isMapHome: options.isMapHome,
          snapshotOnly: options.snapshotOnly,
          collectHitTargets: options.collectHitTargets,
        },
        state: stateSummary,
      });
      const layout = this.getWorldMapLayerLayout(state, options.topBarBottom, options);
      if (!layout) {
        this.setWorldMapLayerRenderResult({ rendered: false, reason: 'noLayout' });
        global.CodexWorldMapDiag?.logChanged?.('renderer:worldMapLayer:noLayout', {
          activeTab: options.activeTab || '',
          isMapHome: Boolean(options.isMapHome),
          currentTab: stateSummary?.currentTab || '',
          militaryView: stateSummary?.militaryView || '',
        });
        return false;
      }
      const territoryState = state.territoryState || {};
      const uiState = options.territoryUiState || {};
      const tileMapView = this.resolveWorldTileMapView(territoryState, uiState, {
        ...options,
        worldExplorerState: state.worldExplorerState || {},
      });
      const rawWorldMapSummary = global.CodexWorldMapDiag?.summarizeWorldMap?.(territoryState) || null;
      const tileMapViewSummary = {
        hasTileMapView: Boolean(tileMapView),
        tileCount: Array.isArray(tileMapView?.tiles) ? tileMapView.tiles.length : 0,
        plannedTileCount: Array.isArray(tileMapView?.plannedTiles) ? tileMapView.plannedTiles.length : 0,
        siteCount: Array.isArray(tileMapView?.sites) ? tileMapView.sites.length : 0,
        version: tileMapView?.version || 0,
        origin: tileMapView?.origin || tileMapView?.worldOrigin || null,
      };
      global.CodexWorldMapDiag?.logChanged?.('renderer:worldMapLayer:tileMapView', {
        rawTileCount: rawWorldMapSummary?.tileCount || 0,
        rawVersion: rawWorldMapSummary?.version || 0,
        viewTileCount: tileMapViewSummary.tileCount,
        viewPlannedTileCount: tileMapViewSummary.plannedTileCount,
        viewSiteCount: tileMapViewSummary.siteCount,
        viewVersion: tileMapViewSummary.version,
        currentTab: stateSummary?.currentTab || '',
        militaryView: stateSummary?.militaryView || '',
      }, {
        rawWorldMap: rawWorldMapSummary,
        tileMapView: tileMapViewSummary,
      });
      if (!this.hasRenderableWorldTileMap(tileMapView)) {
        const preserved = this.shouldPreserveWorldMapLayerOnEmpty(state, options);
        this.setWorldMapLayerRenderResult({
          rendered: preserved,
          preserved,
          reason: preserved ? 'preservedOnEmptyTiles' : 'emptyTiles',
        });
        const lastRenderableContext = this.getLastRenderableWorldMapContext?.();
        global.CodexWorldMapDiag?.logChanged?.('renderer:worldMapLayer:empty', {
          preserved,
          reason: this.lastWorldMapLayerRenderResult?.reason || '',
          rawTileCount: rawWorldMapSummary?.tileCount || 0,
          viewTileCount: tileMapViewSummary.tileCount,
          lastRenderableContextTiles: Array.isArray(lastRenderableContext?.tileMapView?.tiles)
            ? lastRenderableContext.tileMapView.tiles.length
            : null,
        }, {
          preserved,
          renderResult: global.CodexWorldMapDiag?.summarizeRenderResult?.(this.lastWorldMapLayerRenderResult) || null,
          lastRenderableContextTiles: Array.isArray(lastRenderableContext?.tileMapView?.tiles)
            ? lastRenderableContext.tileMapView.tiles.length
            : null,
        });
        return preserved;
      }
      this.beginFrame(options);
      this.setHitTargets([]);
      this.clearAll();
      if (this.isWorldTileMapWaterAnimated(tileMapView)) uiState.tileMapWaterAnimated = true;
      this.worldTileWaterTimeOverride = options.waterTimeMs !== null
        && options.waterTimeMs !== undefined
        && Number.isFinite(Number(options.waterTimeMs))
        ? Number(options.waterTimeMs)
        : null;
      const drawWorldMap = () => {
        this.renderWorldTileMap(tileMapView, layout.map.x, layout.map.y, layout.map.width, layout.map.height, uiState, {
          ...options,
          state,
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
      this.setWorldMapLayerRenderResult({ rendered: true, drewFrame: true, reason: 'drawn' });
      global.CodexWorldMapDiag?.logChanged?.('renderer:worldMapLayer:drawn', {
        tileCount: Array.isArray(tileMapView?.tiles) ? tileMapView.tiles.length : 0,
        hitTargetCount: Array.isArray(this.hitTargets) ? this.hitTargets.length : 0,
        reason: this.lastWorldMapLayerRenderResult?.reason || '',
      }, {
        tileCount: Array.isArray(tileMapView?.tiles) ? tileMapView.tiles.length : 0,
        hitTargetCount: Array.isArray(this.hitTargets) ? this.hitTargets.length : 0,
        renderResult: global.CodexWorldMapDiag?.summarizeRenderResult?.(this.lastWorldMapLayerRenderResult) || null,
      });
      return true;
    }

    renderWorldMapSnapshotLayer(state = {}, options = {}) {
      if (!this.presenter || !this.ctx || typeof this.ctx.drawImage !== 'function') return false;
      this.setWorldMapLayerRenderResult({ rendered: false, reason: 'notReady' });
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
        this.setWorldMapLayerRenderResult({ rendered: true, drewFrame: true, reason: 'snapshotDrawn' });
        return true;
      }
      const layout = this.getWorldMapLayerLayout(state, options.topBarBottom, options);
      if (!layout) {
        this.setWorldMapLayerRenderResult({ rendered: false, reason: 'noLayout' });
        return false;
      }
      const territoryState = state.territoryState || {};
      const uiState = options.territoryUiState || {};
      const tileMapView = this.resolveWorldTileMapView(territoryState, uiState, {
        ...options,
        worldExplorerState: state.worldExplorerState || {},
      });
      if (!this.hasRenderableWorldTileMap(tileMapView)) {
        const preserved = this.shouldPreserveWorldMapLayerOnEmpty(state, options);
        this.setWorldMapLayerRenderResult({
          rendered: preserved,
          preserved,
          reason: preserved ? 'preservedOnEmptyTiles' : 'emptyTiles',
        });
        return preserved;
      }
      this.beginFrame(options);
      this.setHitTargets([]);
      this.clearAll();
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
        worldOrigin: tileMapView.origin || tileMapView.worldOrigin || { q: 0, r: 0 },
      };
      const frame = { x: x + 1, y: y + 1, width: width - 2, height: height - 2 };
      const renderSnapshot = SharedWorldMapRenderSnapshot?.createSnapshot
        ? SharedWorldMapRenderSnapshot.createSnapshot({
          tileMapView,
          x,
          y,
          width,
          height,
          uiState,
        }, {
          ...options,
          frame,
          geometry,
          viewport,
          nowMs: options.nowMs ?? options.epochNowMs ?? options.serverNowMs,
        })
        : null;
      const freshVisibilityActors = this.buildFreshWorldMapActors(state, options);
      const context = {
        actors: [],
        visibilityActors: freshVisibilityActors.length
          ? freshVisibilityActors
          : (Array.isArray(renderSnapshot?.actors) ? renderSnapshot.actors : []),
        frame,
        geometry,
        renderSnapshot,
        tileMapView,
        uiState,
        viewport,
      };
      this.publishWorldMapSnapshotLayerContext(context);
      const visibleEntries = this.getWorldTileRenderEntries(tileMapView, viewport, frame, geometry);
      context.entries = visibleEntries;
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
      this.setWorldMapLayerRenderResult({
        rendered: Boolean(renderedSnapshot),
        drewFrame: Boolean(renderedSnapshot),
        reason: renderedSnapshot ? 'snapshotDrawn' : 'snapshotMiss',
      });
      return renderedSnapshot;
    }
  }

  WorldActorLayerManager?.install?.(WorldMapLayerCanvasRenderer);
  WorldMapCacheCoordinator?.install?.(WorldMapLayerCanvasRenderer);
  WorldMapHitTargetCollector?.install?.(WorldMapLayerCanvasRenderer);

  global.WorldMapLayerCanvasRenderer = WorldMapLayerCanvasRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorldMapLayerCanvasRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
