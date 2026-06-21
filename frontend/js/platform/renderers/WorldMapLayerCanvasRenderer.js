(function (global) {
  const SharedWorldMapRenderSnapshot = (() => {
    if (global.WorldMapRenderSnapshot) return global.WorldMapRenderSnapshot;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/WorldMapRenderSnapshot');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedWorldTime = (() => {
    if (global.WorldTime) return global.WorldTime;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/WorldTime');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedWorldMarchSystem = (() => {
    if (global.WorldMarchSystem) return global.WorldMarchSystem;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/WorldMarchSystem');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const WORLD_ACTOR_OVERLAY_DIAG_LOG_INTERVAL_MS = 1000;
  function getWorldActorOverlayCanvasIdStore() {
    if (typeof WeakMap !== 'function') return null;
    if (!global.__worldActorOverlayDiagCanvasIds) {
      global.__worldActorOverlayDiagCanvasIds = new WeakMap();
      global.__worldActorOverlayDiagCanvasIdSeq = 0;
    }
    return global.__worldActorOverlayDiagCanvasIds;
  }

  function getWorldActorOverlayCanvasId(ctx = null) {
    const canvas = ctx?.canvas || null;
    if (!canvas) return '';
    const existing = canvas._layerName
      || canvas.dataset?.canvasLayer
      || canvas.id
      || '';
    if (existing) return existing;
    const canvasIds = getWorldActorOverlayCanvasIdStore();
    if (!canvasIds) return '';
    if (!canvasIds.has(canvas)) {
      global.__worldActorOverlayDiagCanvasIdSeq = (Number(global.__worldActorOverlayDiagCanvasIdSeq) || 0) + 1;
      canvasIds.set(canvas, `canvas#${global.__worldActorOverlayDiagCanvasIdSeq}`);
    }
    return canvasIds.get(canvas);
  }

  function cloneWorldActorOverlayFrame(frame = null) {
    if (!frame) return null;
    return {
      x: Number(frame.x),
      y: Number(frame.y),
      width: Number(frame.width),
      height: Number(frame.height),
    };
  }

  function doesClearCoverWorldActorFrame(clearRect = null, drawFrame = null) {
    if (!clearRect || !drawFrame) return false;
    const clearX = Number(clearRect.x);
    const clearY = Number(clearRect.y);
    const clearW = Number(clearRect.w);
    const clearH = Number(clearRect.h);
    const frameX = Number(drawFrame.x);
    const frameY = Number(drawFrame.y);
    const frameW = Number(drawFrame.width);
    const frameH = Number(drawFrame.height);
    if (![clearX, clearY, clearW, clearH, frameX, frameY, frameW, frameH].every(Number.isFinite)) return false;
    return clearX <= frameX
      && clearY <= frameY
      && clearX + clearW >= frameX + frameW
      && clearY + clearH >= frameY + frameH;
  }

  class WorldMapLayerCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.injectedWorldActorRenderer = options.worldActorRenderer || null;
      return new Proxy(this, {
        get(target, prop, receiver) {
          const ownValue = Reflect.get(target, prop, receiver);
          if (ownValue !== undefined || prop in target) return ownValue;
          const host = target.host;
          if (host && prop in host) {
            const hostValue = host[prop];
            return typeof hostValue === 'function' ? hostValue.bind(host) : hostValue;
          }
          return undefined;
        },
        set(target, prop, value, receiver) {
          if (prop === 'host' || prop in target) return Reflect.set(target, prop, value);
          if (target.host && prop in target.host) {
            target.host[prop] = value;
            return true;
          }
          target[prop] = value;
          return true;
        },
      });
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

    collectMapHomeWorldSiteHitTargets(state = {}, topBarBottom = 84, options = {}) {
      const layout = this.getWorldMapLayerLayout(state, topBarBottom, { isMapHome: true });
      if (!layout) return false;
      const territoryState = state.territoryState || {};
      const uiState = options.territoryUiState || {};
      const tileMapView = this.resolveWorldTileMapView(territoryState, uiState, {
        ...options,
        worldExplorerState: state.worldExplorerState || {},
      });
      if (!tileMapView?.tiles?.length) return true;
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
        worldOrigin: tileMapView.origin || tileMapView.worldOrigin || { q: 0, r: 0 },
      };
      const frame = {
        x: layout.map.x + 1,
        y: layout.map.y + 1,
        width: layout.map.width - 2,
        height: layout.map.height - 2,
      };
      const visibleEntries = this.getWorldTileRenderEntries(tileMapView, viewport, frame, geometry);
      if (options.collectHitTargets !== false) {
        this.addWorldMapDragHitTarget?.(layout.map.x, layout.map.y, layout.map.width, layout.map.height);
        this.addWorldMarchTileHitTargets?.(tileMapView, viewport, frame);
        this.addWorldTileSiteHitTargets(tileMapView, viewport, visibleEntries, uiState);
      }
      const lastContext = options.worldMapRuntimeContext
        || this.lastWorldTileMapContext
        || this.worldMapRenderer?.lastWorldTileMapContext
        || null;
      const contextActors = this.getWorldMapContextActors(state, lastContext, lastContext?.renderSnapshot || null);
      const actors = this.resolveWorldMapActors(state, contextActors, options);
      this.lastMapHomeWorldHudContext = {
        actors,
        frame,
        viewportOffsetX: Number(this.viewportOffsetX) || 0,
        viewportOffsetY: Number(this.viewportOffsetY) || 0,
        geometry,
        renderSnapshot: lastContext?.renderSnapshot || null,
        tileMapView,
        uiState,
        viewport,
      };
      if (this.host && this.host !== this) {
        this.host.lastMapHomeWorldHudContext = this.lastMapHomeWorldHudContext;
      }
      return true;
    }

    getWorldMapActorLayerContext(state = {}, options = {}) {
      const context = options.worldMapRuntimeContext
        || this.lastWorldTileMapContext
        || this.worldMapRenderer?.lastWorldTileMapContext
        || this.worldMapLayerRenderer?.lastWorldTileMapContext
        || null;
      if (!context?.tileMapView || !context?.viewport || !context?.frame) return null;
      const renderSnapshot = context.renderSnapshot || null;
      const uiState = options.territoryUiState || context.uiState || renderSnapshot?.ui || {};
      const contextActors = this.getWorldMapContextActors(state, context, renderSnapshot);
      const actors = this.resolveWorldMapActors(state, contextActors, options);
      return {
        actors,
        frame: context.frame || renderSnapshot?.frame || {},
        viewportOffsetX: Number(context.viewportOffsetX ?? this.viewportOffsetX) || 0,
        viewportOffsetY: Number(context.viewportOffsetY ?? this.viewportOffsetY) || 0,
        geometry: context.geometry || renderSnapshot?.geometry || context.tileMapView?.geometry || {},
        renderSnapshot,
        tileMapView: context.tileMapView,
        uiState,
        viewport: context.viewport || renderSnapshot?.viewport || {},
      };
    }

    hasWorldExplorerMissions(state = {}) {
      return this.getWorldExplorerMissionIds(state).size > 0;
    }

    getWorldExplorerMissionIds(state = {}) {
      const explorer = state.worldExplorerState || {};
      const ids = new Set();
      const append = (mission) => {
        if (mission?.id) ids.add(String(mission.id));
      };
      (Array.isArray(explorer.missions) ? explorer.missions : []).forEach(append);
      append(explorer.activeMission);
      (Array.isArray(explorer.idleMissions) ? explorer.idleMissions : []).forEach(append);
      return ids;
    }

    hasWorldExplorerState(state = {}) {
      return Boolean(state && state.worldExplorerState && typeof state.worldExplorerState === 'object');
    }

    getWorldMapContextActors(state = {}, context = null, renderSnapshot = null) {
      const contextActors = Array.isArray(context?.actors) ? context.actors : null;
      if (contextActors && (contextActors.length || this.hasWorldExplorerState(state))) return contextActors;
      if (this.hasWorldExplorerState(state)) return [];
      if (Array.isArray(context?.visibilityActors) && context.visibilityActors.length) return context.visibilityActors;
      return Array.isArray(renderSnapshot?.actors) ? renderSnapshot.actors : [];
    }

    getWorldMapActorNowMs(options = {}) {
      const optionNow = options.epochNowMs ?? options.nowMs ?? options.serverNowMs;
      const resolvedOptionNow = Number(optionNow);
      if (Number.isFinite(resolvedOptionNow)) return resolvedOptionNow;
      const resolvedNow = SharedWorldTime?.getEpochNowMs?.({
        ...options,
        host: this.host || this,
      }, Number.NaN);
      return Number.isFinite(resolvedNow) ? resolvedNow : Number.NaN;
    }

    buildFreshWorldMapActors(state = {}, options = {}) {
      if (!SharedWorldMarchSystem?.buildActors || !this.hasWorldExplorerMissions(state)) return [];
      const actors = SharedWorldMarchSystem.buildActors(state.worldExplorerState || {}, {
        nowMs: this.getWorldMapActorNowMs(options),
      });
      return Array.isArray(actors) ? actors : [];
    }

    getActorIdentityKeys(actor = {}) {
      return [actor?.missionId, actor?.id, actor?.formation?.id, actor?.formationId]
        .map((key) => String(key || ''))
        .filter(Boolean);
    }

    isWorldMapMissionActor(actor = {}) {
      if (!actor || typeof actor !== 'object') return false;
      if (actor.missionId || actor.unitKey || actor.type === 'scout') return true;
      if (actor.status === 'active' || actor.status === 'idle') return true;
      if (Array.isArray(actor.route) && actor.route.length) return true;
      return Boolean(
        actor.progress
        || actor.formation
        || actor.formationSnapshot
        || actor.remainingSeconds !== undefined
        || actor.travelRemainingSeconds !== undefined
      );
    }

    dedupeWorldMapActors(actors = []) {
      const result = [];
      const seen = new Set();
      (Array.isArray(actors) ? actors : []).forEach((actor) => {
        const keys = this.getActorIdentityKeys(actor);
        if (keys.length && keys.some((key) => seen.has(key))) return;
        keys.forEach((key) => seen.add(key));
        result.push(actor);
      });
      return result;
    }

    getNonMissionContextActors(actors = [], missionIds = new Set()) {
      return (Array.isArray(actors) ? actors : []).filter((actor) => {
        if (this.getActorIdentityKeys(actor).some((key) => missionIds.has(key))) return false;
        return !this.isWorldMapMissionActor(actor);
      });
    }

    resolveWorldMapActors(state = {}, contextActors = [], options = {}) {
      const actors = Array.isArray(contextActors) ? contextActors : [];
      const freshActors = this.dedupeWorldMapActors(this.buildFreshWorldMapActors(state, options));
      const missionIds = this.getWorldExplorerMissionIds(state);
      if (!freshActors.length) {
        if (!missionIds.size) {
          return this.hasWorldExplorerState(state)
            ? this.dedupeWorldMapActors(this.getNonMissionContextActors(actors, missionIds))
            : this.dedupeWorldMapActors(actors);
        }
        return this.dedupeWorldMapActors(this.getNonMissionContextActors(actors, missionIds));
      }
      return this.dedupeWorldMapActors([
        ...freshActors,
        ...this.getNonMissionContextActors(actors, missionIds),
      ]);
    }

    publishWorldMapActorLayerContext(context = null) {
      this.lastMapHomeWorldHudContext = context;
      if (this.host && this.host !== this) {
        this.host.lastMapHomeWorldHudContext = context;
      }
      return context;
    }

    publishWorldMapSnapshotLayerContext(context = null) {
      this.lastWorldTileMapContext = context;
      if (this.host && this.host !== this) {
        this.host.lastWorldTileMapContext = context;
      }
      return context;
    }

    publishWorldActorOverlayDiag(diag = null) {
      this.lastWorldActorOverlayDiag = diag;
      if (this.host && this.host !== this) {
        this.host.lastWorldActorOverlayDiag = diag;
        if (this.host.worldMapRenderer) this.host.worldMapRenderer.lastWorldActorOverlayDiag = diag;
      }
      return diag;
    }

    createWorldActorOverlayDiag(context = null, options = {}) {
      const frame = cloneWorldActorOverlayFrame(context?.frame || null);
      const delegated = Boolean(
        options.__worldActorOverlayDelegated
        || this.__worldActorOverlayDelegated
        || (this.host?.worldMapRenderer && this.host.worldMapRenderer !== this.host && this.host.worldMapRenderer.ctx !== this.ctx)
      );
      return {
        delegated,
        clearedCanvasId: '',
        drawnCanvasId: '',
        clearRect: null,
        drawFrame: frame,
        actorCount: Array.isArray(context?.actors) ? context.actors.length : 0,
        arrowCanvasId: '',
        clearedEqualsDrawn: false,
        clearCoversDrawFrame: false,
      };
    }

    finalizeWorldActorOverlayDiag(diag = null) {
      if (!diag) return null;
      const clearedCanvasId = diag.clearedCanvasId || '';
      const drawnCanvasId = diag.drawnCanvasId || '';
      diag.clearedEqualsDrawn = clearedCanvasId === drawnCanvasId;
      diag.clearCoversDrawFrame = doesClearCoverWorldActorFrame(diag.clearRect, diag.drawFrame);
      return diag;
    }

    logWorldActorOverlayDiag(diag = null, options = {}) {
      if (!diag) return false;
      const now = Number(options.epochNowMs ?? options.nowMs ?? options.serverNowMs ?? this.getNow?.() ?? Date.now());
      const safeNow = Number.isFinite(now) ? now : Date.now();
      const last = Number(this.lastWorldActorOverlayDiagLogAt);
      if (Number.isFinite(last) && safeNow - last < WORLD_ACTOR_OVERLAY_DIAG_LOG_INTERVAL_MS) return false;
      this.lastWorldActorOverlayDiagLogAt = safeNow;
      if (this.host && this.host !== this) this.host.lastWorldActorOverlayDiagLogAt = safeNow;
      const logger = global.ClientOperationLog || globalThis.ClientOperationLog;
      logger?.record?.('worldActorOverlay:diag', diag);
      return true;
    }

    setActiveWorldActorOverlayDiag(diag = null) {
      this.__worldActorOverlayActiveDiag = diag;
      if (this.host && this.host !== this) {
        this.host.__worldActorOverlayActiveDiag = diag;
        if (this.host.worldMapRenderer) this.host.worldMapRenderer.__worldActorOverlayActiveDiag = diag;
      }
      return diag;
    }

    clearWorldActorBackingStore(diag = null) {
      if (!this.ctx || typeof this.ctx.clearRect !== 'function') return false;
      const canvas = this.canvas || this.ctx.canvas || null;
      const pixelRatio = Math.max(1, Number(canvas?._backingStorePixelRatio || this.pixelRatio) || 1);
      const logicalWidth = Math.max(1, Number(this.width) || Number(canvas?.clientWidth) || 1);
      const logicalHeight = Math.max(1, Number(this.height) || Number(canvas?.clientHeight) || 1);
      const backingWidth = Math.max(1, Number(canvas?.width) || Math.ceil(logicalWidth * pixelRatio));
      const backingHeight = Math.max(1, Number(canvas?.height) || Math.ceil(logicalHeight * pixelRatio));
      if (typeof this.ctx.setTransform === 'function') {
        const clearRect = { x: 0, y: 0, w: backingWidth, h: backingHeight };
        if (diag) {
          diag.clearedCanvasId = getWorldActorOverlayCanvasId(this.ctx);
          diag.clearRect = clearRect;
        }
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(clearRect.x, clearRect.y, clearRect.w, clearRect.h);
        this.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        return true;
      }
      const clearRect = { x: 0, y: 0, w: this.width, h: this.height };
      if (diag) {
        diag.clearedCanvasId = getWorldActorOverlayCanvasId(this.ctx);
        diag.clearRect = clearRect;
      }
      this.ctx.clearRect(clearRect.x, clearRect.y, clearRect.w, clearRect.h);
      return true;
    }

    getWorldActorOverlayLayerRenderer() {
      const host = this.host || null;
      const currentCtx = this.ctx || host?.ctx || null;
      const candidates = [
        this.worldActorLayerRenderer,
        host?.worldActorLayerRenderer,
        host?.host?.worldActorLayerRenderer,
      ].filter(Boolean);
      for (const candidate of candidates) {
        const layerRenderer = candidate?.worldMapLayerRenderer || candidate;
        if (!layerRenderer || layerRenderer === this) continue;
        if (typeof layerRenderer.renderWorldMapActorLayer !== 'function') continue;
        const candidateCtx = layerRenderer.ctx || candidate?.ctx || null;
        if (currentCtx && candidateCtx && currentCtx === candidateCtx) continue;
        return layerRenderer;
      }
      return null;
    }

    publishWorldActorOverlayLayerContext(layerRenderer = null, context = null) {
      if (!layerRenderer || layerRenderer === this) return false;
      layerRenderer.lastWorldTileMapContext = context;
      const layerHost = layerRenderer.host || null;
      if (layerHost && layerHost !== layerRenderer) {
        layerHost.lastWorldTileMapContext = context;
      }
      return true;
    }

    getExplicitWorldActorRenderer() {
      if (this.injectedWorldActorRenderer) return this.injectedWorldActorRenderer;

      const renderer = this.worldMapRenderer || this.host?.worldMapRenderer || null;
      const worldMapRenderer = renderer?.worldMapRenderer || renderer || null;
      const hudRenderer = this.worldMapActorHudRenderer
        || this.host?.worldMapActorHudRenderer
        || worldMapRenderer?.worldMapActorHudRenderer
        || renderer?.worldMapActorHudRenderer
        || null;
      return hudRenderer?.worldActorRenderer
        || worldMapRenderer?.worldActorRenderer
        || renderer?.worldActorRenderer
        || this.worldActorRenderer
        || this.host?.worldActorRenderer
        || null;
    }

    renderWorldActorsWithCtx(actors = [], viewport = {}, geometry = {}, ctx = null) {
      const actorRenderer = this.getExplicitWorldActorRenderer();
      if (actorRenderer?.renderActors) {
        if (typeof actorRenderer.withActorRenderCtx === 'function') {
          return actorRenderer.withActorRenderCtx(ctx, () => actorRenderer.renderActors(actors, viewport, geometry, { ctx }));
        }
        return actorRenderer.renderActors(actors, viewport, geometry, { ctx });
      }
      return this.renderWorldActors?.(actors, viewport, geometry, { ctx }) || false;
    }

    renderWorldMapActorLayer(state = {}, options = {}) {
      if (!this.ctx) return false;
      if (!options.__worldActorOverlayDelegated) {
        const overlayLayerRenderer = this.getWorldActorOverlayLayerRenderer();
        if (overlayLayerRenderer) {
          const layerContext = options.worldMapRuntimeContext || this.getWorldMapActorLayerContext(state, options);
          this.publishWorldActorOverlayLayerContext(overlayLayerRenderer, layerContext);
          return overlayLayerRenderer.renderWorldMapActorLayer(state, {
            ...options,
            __worldActorOverlayDelegated: true,
            worldMapRuntimeContext: layerContext,
          });
        }
      }
      const context = this.getWorldMapActorLayerContext(state, options);
      this.beginFrame(options);
      this.setHitTargets([]);
      const diag = this.createWorldActorOverlayDiag(context, options);
      this.clearWorldActorBackingStore(diag);
      if (!context) {
        this.publishWorldMapActorLayerContext(null);
        this.finalizeWorldActorOverlayDiag(diag);
        this.publishWorldActorOverlayDiag(diag);
        this.logWorldActorOverlayDiag(diag, options);
        this.endFrame({ ...options, showFpsOverlay: false });
        return false;
      }
      const { actors, viewport, geometry, frame, uiState } = context;
      let didClip = false;
      if (this.ctx.save && this.ctx.beginPath && this.ctx.rect && this.ctx.clip) {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(frame.x, frame.y, frame.width, frame.height);
        this.ctx.clip();
        didClip = true;
      }
      try {
        this.renderWorldScoutRoutes?.(context.tileMapView, viewport, actors);
        diag.drawnCanvasId = getWorldActorOverlayCanvasId(this.ctx);
        this.setActiveWorldActorOverlayDiag(diag);
        this.renderWorldActorsWithCtx(actors, viewport, geometry, this.ctx);
      } finally {
        this.setActiveWorldActorOverlayDiag(null);
        if (didClip && this.ctx.restore) this.ctx.restore();
      }
      this.addWorldActorHitTargets?.(actors, viewport, geometry);
      this.publishWorldMapActorLayerContext(context);
      this.finalizeWorldActorOverlayDiag(diag);
      this.publishWorldActorOverlayDiag(diag);
      this.logWorldActorOverlayDiag(diag, options);
      this.endFrame({ ...options, showFpsOverlay: false });
      return true;
    }

    getEpochNowMs() {
      return SharedWorldTime?.getEpochNowMs?.(this) ?? Date.now();
    }

    getExplorerMissionRemainingSeconds(mission = {}, nowMs = this.getEpochNowMs()) {
      return SharedWorldTime?.getRemainingSeconds?.(mission, nowMs) ?? Math.max(0, Math.ceil(Number(mission.remainingSeconds) || 0));
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

    hasRenderableWorldTileMap(tileMapView = null) {
      return Array.isArray(tileMapView?.tiles) && tileMapView.tiles.length > 0;
    }

    getLastRenderableWorldMapContext() {
      const contexts = [
        this.lastWorldTileMapContext,
        this.worldMapRenderer?.lastWorldTileMapContext,
        this.worldMapLayerRenderer?.lastWorldTileMapContext,
        this.host?.lastWorldTileMapContext,
      ].filter(Boolean);
      return contexts.find((context) => this.hasRenderableWorldTileMap(context?.tileMapView)) || null;
    }

    shouldPreserveWorldMapLayerOnEmpty(state = {}, options = {}) {
      if (options.__snapshotBackbuffer) return false;
      if (options.preserveOnEmptyWorldMap === false || options.clearOnEmptyWorldMap === true) return false;
      if (options.loading?.visible || options.auth?.view?.loginPanelVisible) return false;
      return Boolean(this.getLastRenderableWorldMapContext());
    }

    setWorldMapLayerRenderResult(result = {}) {
      const next = {
        rendered: Boolean(result.rendered),
        drewFrame: Boolean(result.drewFrame),
        preserved: Boolean(result.preserved),
        reason: result.reason || '',
      };
      this.lastWorldMapLayerRenderResult = next;
      if (this.host && this.host !== this) this.host.lastWorldMapLayerRenderResult = next;
      return next;
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
      if (typeof this.renderWorldTileFogMask === 'function') {
        this.renderWorldTileFogMask(tileMapView, viewport, frame, visibleEntries);
      }
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

  global.WorldMapLayerCanvasRenderer = WorldMapLayerCanvasRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorldMapLayerCanvasRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
