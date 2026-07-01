(function (global) {
  // Cache context + actor-overlay diagnostics mixin for WorldMapLayerCanvasRenderer.
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
    const existing = canvas._layerName || canvas.dataset?.canvasLayer || canvas.id || '';
    if (existing) return existing;
    const canvasIds = getWorldActorOverlayCanvasIdStore();
    if (!canvasIds) return '';
    if (!canvasIds.has(canvas)) {
      global.__worldActorOverlayDiagCanvasIdSeq =
        (Number(global.__worldActorOverlayDiagCanvasIdSeq) || 0) + 1;
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
    if (![clearX, clearY, clearW, clearH, frameX, frameY, frameW, frameH].every(Number.isFinite))
      return false;
    return (
      clearX <= frameX &&
      clearY <= frameY &&
      clearX + clearW >= frameX + frameW &&
      clearY + clearH >= frameY + frameH
    );
  }

  function install(WorldMapLayerCanvasRenderer) {
    if (!WorldMapLayerCanvasRenderer?.prototype) return false;
    Object.assign(WorldMapLayerCanvasRenderer.prototype, {
      getWorldMapActorLayerContext(state = {}, options = {}) {
        const context =
          options.worldMapRuntimeContext ||
          this.lastWorldTileMapContext ||
          this.worldMapRenderer?.lastWorldTileMapContext ||
          this.worldMapLayerRenderer?.lastWorldTileMapContext ||
          null;
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
          geometry:
            context.geometry || renderSnapshot?.geometry || context.tileMapView?.geometry || {},
          renderSnapshot,
          tileMapView: context.tileMapView,
          uiState,
          viewport: context.viewport || renderSnapshot?.viewport || {},
        };
      },

      publishWorldMapActorLayerContext(context = null) {
        this.lastMapHomeWorldHudContext = context;
        if (this.host && this.host !== this) {
          this.host.lastMapHomeWorldHudContext = context;
        }
        return context;
      },

      publishWorldMapSnapshotLayerContext(context = null) {
        this.lastWorldTileMapContext = context;
        if (this.host && this.host !== this) {
          this.host.lastWorldTileMapContext = context;
        }
        return context;
      },

      publishWorldActorOverlayDiag(diag = null) {
        this.lastWorldActorOverlayDiag = diag;
        if (this.host && this.host !== this) {
          this.host.lastWorldActorOverlayDiag = diag;
          if (this.host.worldMapRenderer)
            this.host.worldMapRenderer.lastWorldActorOverlayDiag = diag;
        }
        return diag;
      },

      createWorldActorOverlayDiag(context = null, options = {}) {
        const frame = cloneWorldActorOverlayFrame(context?.frame || null);
        const delegated = Boolean(
          options.__worldActorOverlayDelegated ||
          this.__worldActorOverlayDelegated ||
          (this.host?.worldMapRenderer &&
            this.host.worldMapRenderer !== this.host &&
            this.host.worldMapRenderer.ctx !== this.ctx),
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
      },

      finalizeWorldActorOverlayDiag(diag = null) {
        if (!diag) return null;
        const clearedCanvasId = diag.clearedCanvasId || '';
        const drawnCanvasId = diag.drawnCanvasId || '';
        diag.clearedEqualsDrawn = clearedCanvasId === drawnCanvasId;
        diag.clearCoversDrawFrame = doesClearCoverWorldActorFrame(diag.clearRect, diag.drawFrame);
        return diag;
      },

      logWorldActorOverlayDiag(diag = null, options = {}) {
        if (!diag) return false;
        const now = Number(
          options.epochNowMs ??
            options.nowMs ??
            options.serverNowMs ??
            this.getNow?.() ??
            Date.now(),
        );
        const safeNow = Number.isFinite(now) ? now : Date.now();
        const last = Number(this.lastWorldActorOverlayDiagLogAt);
        if (Number.isFinite(last) && safeNow - last < WORLD_ACTOR_OVERLAY_DIAG_LOG_INTERVAL_MS)
          return false;
        this.lastWorldActorOverlayDiagLogAt = safeNow;
        if (this.host && this.host !== this) this.host.lastWorldActorOverlayDiagLogAt = safeNow;
        const logger = global.ClientOperationLog || globalThis.ClientOperationLog;
        logger?.record?.('worldActorOverlay:diag', diag);
        return true;
      },

      setActiveWorldActorOverlayDiag(diag = null) {
        this.__worldActorOverlayActiveDiag = diag;
        if (this.host && this.host !== this) {
          this.host.__worldActorOverlayActiveDiag = diag;
          if (this.host.worldMapRenderer)
            this.host.worldMapRenderer.__worldActorOverlayActiveDiag = diag;
        }
        return diag;
      },

      clearWorldActorBackingStore(diag = null) {
        if (!this.ctx || typeof this.ctx.clearRect !== 'function') return false;
        const canvas = this.canvas || this.ctx.canvas || null;
        const pixelRatio = Math.max(
          1,
          Number(canvas?._backingStorePixelRatio || this.pixelRatio) || 1,
        );
        const logicalWidth = Math.max(1, Number(this.width) || Number(canvas?.clientWidth) || 1);
        const logicalHeight = Math.max(1, Number(this.height) || Number(canvas?.clientHeight) || 1);
        const backingWidth = Math.max(
          1,
          Number(canvas?.width) || Math.ceil(logicalWidth * pixelRatio),
        );
        const backingHeight = Math.max(
          1,
          Number(canvas?.height) || Math.ceil(logicalHeight * pixelRatio),
        );
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
      },

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
      },

      publishWorldActorOverlayLayerContext(layerRenderer = null, context = null) {
        if (!layerRenderer || layerRenderer === this) return false;
        layerRenderer.lastWorldTileMapContext = context;
        const layerHost = layerRenderer.host || null;
        if (layerHost && layerHost !== layerRenderer) {
          layerHost.lastWorldTileMapContext = context;
        }
        return true;
      },

      getExplicitWorldActorRenderer() {
        if (this.injectedWorldActorRenderer) return this.injectedWorldActorRenderer;

        const renderer = this.worldMapRenderer || this.host?.worldMapRenderer || null;
        const worldMapRenderer = renderer?.worldMapRenderer || renderer || null;
        const hudRenderer =
          this.worldMapActorHudRenderer ||
          this.host?.worldMapActorHudRenderer ||
          worldMapRenderer?.worldMapActorHudRenderer ||
          renderer?.worldMapActorHudRenderer ||
          null;
        return (
          hudRenderer?.worldActorRenderer ||
          worldMapRenderer?.worldActorRenderer ||
          renderer?.worldActorRenderer ||
          this.worldActorRenderer ||
          this.host?.worldActorRenderer ||
          null
        );
      },

      renderWorldActorsWithCtx(
        actors = [],
        viewport = {},
        geometry = {},
        ctx = null,
        options = {},
      ) {
        const actorRenderer = this.getExplicitWorldActorRenderer();
        const renderOptions = { ...options, ctx };
        if (actorRenderer?.renderActors) {
          if (typeof actorRenderer.withActorRenderCtx === 'function') {
            return actorRenderer.withActorRenderCtx(ctx, () =>
              actorRenderer.renderActors(actors, viewport, geometry, renderOptions),
            );
          }
          return actorRenderer.renderActors(actors, viewport, geometry, renderOptions);
        }
        return this.renderWorldActors?.(actors, viewport, geometry, renderOptions) || false;
      },

      renderWorldMapActorLayer(state = {}, options = {}) {
        if (!this.ctx) return false;
        if (!options.__worldActorOverlayDelegated) {
          const overlayLayerRenderer = this.getWorldActorOverlayLayerRenderer();
          if (overlayLayerRenderer) {
            const layerContext =
              options.worldMapRuntimeContext || this.getWorldMapActorLayerContext(state, options);
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
          this.renderWorldActorsWithCtx(actors, viewport, geometry, this.ctx, options);
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
      },

      hasRenderableWorldTileMap(tileMapView = null) {
        return Array.isArray(tileMapView?.tiles) && tileMapView.tiles.length > 0;
      },

      getLastRenderableWorldMapContext() {
        const contexts = [
          this.lastWorldTileMapContext,
          this.worldMapRenderer?.lastWorldTileMapContext,
          this.worldMapLayerRenderer?.lastWorldTileMapContext,
          this.host?.lastWorldTileMapContext,
        ].filter(Boolean);
        return (
          contexts.find((context) => this.hasRenderableWorldTileMap(context?.tileMapView)) || null
        );
      },

      shouldPreserveWorldMapLayerOnEmpty(state = {}, options = {}) {
        if (options.__snapshotBackbuffer) return false;
        if (options.preserveOnEmptyWorldMap === false || options.clearOnEmptyWorldMap === true)
          return false;
        if (options.loading?.visible || options.auth?.view?.loginPanelVisible) return false;
        return Boolean(this.getLastRenderableWorldMapContext());
      },

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
      },
    });
    return true;
  }

  const WorldMapCacheCoordinator = { install };
  global.WorldMapCacheCoordinator = WorldMapCacheCoordinator;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapCacheCoordinator;
})(typeof window !== 'undefined' ? window : globalThis);
