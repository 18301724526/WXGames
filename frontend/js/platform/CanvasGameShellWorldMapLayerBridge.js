(function (global) {
  var WorldMapVisualPluginRegistryBase = global.WorldMapVisualPluginRegistry;
  if (typeof module !== 'undefined' && module.exports && !WorldMapVisualPluginRegistryBase) {
    try {
      WorldMapVisualPluginRegistryBase = require('./WorldMapVisualPluginRegistry');
    } catch (error) {
      WorldMapVisualPluginRegistryBase = null;
    }
  }

  function install(CanvasGameShell) {
    if (!CanvasGameShell?.prototype) return false;
    Object.assign(CanvasGameShell.prototype, {
      syncWorldMapRendererLayerMetrics() {
        if (!this.worldMapRenderer) return false;
        const metrics = this.getCanvasLayerMetrics?.('worldMap', null);
        if (!metrics) return false;
        const width = Number(metrics.width) || this.runtime?.width || this.worldMapRenderer.width;
        const height = Number(metrics.height) || this.runtime?.height || this.worldMapRenderer.height;
        const padding = Number(metrics.padding) || 0;
        const changed = this.worldMapRenderer.width !== width
          || this.worldMapRenderer.height !== height
          || this.worldMapRenderer.viewportOffsetX !== padding
          || this.worldMapRenderer.viewportOffsetY !== padding;
        this.worldMapRenderer.width = width;
        this.worldMapRenderer.height = height;
        this.worldMapRenderer.pixelRatio = this.runtime?.pixelRatio || this.worldMapRenderer.pixelRatio;
        this.worldMapRenderer.viewportOffsetX = padding;
        this.worldMapRenderer.viewportOffsetY = padding;
        this.worldMapRenderer.viewportWidth = Number(metrics.viewportWidth) || this.runtime?.width || width;
        this.worldMapRenderer.viewportHeight = Number(metrics.viewportHeight) || this.runtime?.height || height;
        if (this.worldActorLayerRenderer) {
          const actorMetrics = this.getCanvasLayerMetrics?.('worldActor', metrics) || metrics;
          this.worldActorLayerRenderer.width = Number(actorMetrics.width) || width;
          this.worldActorLayerRenderer.height = Number(actorMetrics.height) || height;
          this.worldActorLayerRenderer.pixelRatio = this.runtime?.pixelRatio || this.worldActorLayerRenderer.pixelRatio;
          this.worldActorLayerRenderer.viewportOffsetX = Number(actorMetrics.padding) || padding;
          this.worldActorLayerRenderer.viewportOffsetY = Number(actorMetrics.padding) || padding;
          this.worldActorLayerRenderer.viewportWidth = Number(actorMetrics.viewportWidth) || this.worldMapRenderer.viewportWidth;
          this.worldActorLayerRenderer.viewportHeight = Number(actorMetrics.viewportHeight) || this.worldMapRenderer.viewportHeight;
          if (this.worldMapRenderer) {
            this.worldMapRenderer.worldActorLayerRenderer = this.worldActorLayerRenderer;
          }
        }
        if (this.isFogOfWarEnabled?.() === true && this.worldFogRenderer?.setMetrics) {
          const fogMetrics = this.getCanvasLayerMetrics?.('worldFog', metrics) || metrics;
          this.worldFogRenderer.setMetrics({
            width: Number(fogMetrics.width) || width,
            height: Number(fogMetrics.height) || height,
            pixelRatio: this.runtime?.pixelRatio || this.worldFogRenderer.pixelRatio,
            viewportOffsetX: Number(fogMetrics.padding) || padding,
            viewportOffsetY: Number(fogMetrics.padding) || padding,
            viewportWidth: Number(fogMetrics.viewportWidth) || this.worldMapRenderer.viewportWidth,
            viewportHeight: Number(fogMetrics.viewportHeight) || this.worldMapRenderer.viewportHeight,
          });
        }
        if (changed) this.worldMapRuntime?.invalidateBake?.();
        return true;
      },

      renderWorldFogLayer(context = null) {
        if (this.isFogOfWarEnabled?.() !== true) {
          this.worldFogRenderer?.clear?.();
          return false;
        }
        if (!this.worldFogRenderer?.renderWorldFog) return false;
        const fogContext = context
          || this.worldMapRenderer?.lastWorldFogContext
          || this.worldMapRenderer?.lastWorldTileMapContext
          || null;
        if (!fogContext?.tileMapView || !fogContext?.viewport || !fogContext?.frame) {
          this.worldFogRenderer.clear?.();
          return false;
        }
        const visualRegistry = WorldMapVisualPluginRegistryBase || global.WorldMapVisualPluginRegistry;
        const visualContext = visualRegistry?.createRendererContext?.('worldFog', {
          ...(this.worldMapRenderer?.lastWorldTileMapContext || {}),
          ...(fogContext || {}),
          config: this.config,
        }, {
          config: this.config,
        }) || null;
        this.syncWorldMapRendererLayerMetrics();
        return this.worldFogRenderer.renderWorldFog(visualContext || fogContext);
      },

      clearWorldMapLayerTransform() {
        const mapCleared = this.clearCanvasLayerTransform?.('worldMap') || false;
        this.clearCanvasLayerTransform?.('worldFog');
        this.clearCanvasLayerTransform?.('worldActor');
        return mapCleared;
      },

      setWorldMapLayerVisible(visible = true) {
        const mapVisible = this.setCanvasLayerVisible?.('worldMap', visible !== false) || false;
        const fogVisible = this.setCanvasLayerVisible?.('worldFog', visible !== false) || false;
        const actorVisible = this.setCanvasLayerVisible?.('worldActor', visible !== false) || false;
        if (visible === false && fogVisible) this.worldFogRenderer?.clear?.();
        if (visible === false && actorVisible) this.worldActorLayerRenderer?.clearAll?.();
        return mapVisible;
      },

      renderWorldActorLayer(options = {}) {
        if (!this.worldMapRenderer || typeof this.worldMapRenderer.renderWorldMapActorLayer !== 'function') return false;
        const state = options.state || this.lastGame?.state;
        if (!state) return false;
        this.syncWorldMapRendererLayerMetrics();
        const runtime = this.worldMapRuntimeCoordinator?.getMapRuntime?.() || this.worldMapRuntime;
        const territoryUiState = options.territoryUiState
          || runtime?.getCameraUiState?.()
          || this.lastGame?.territoryController?.getUiState?.()
          || this.territoryUiState
          || {};
        const rendered = this.worldMapRenderer.renderWorldMapActorLayer(state, {
          ...this.buildRenderOptions('military', territoryUiState),
          ...options,
          activeTab: 'military',
          isMapHome: true,
          territoryUiState,
          worldMapRuntimeContext: options.worldMapRuntimeContext
            || runtime?.getLastTileMapContext?.()
            || runtime?.lastTileMapContext
            || this.worldMapRenderer.lastWorldTileMapContext
            || null,
          showFpsOverlay: false,
        });
        if (rendered && runtime?.syncHitTargetsFromRenderer) runtime.syncHitTargetsFromRenderer();
        return rendered;
      },

      refreshWorldMapLayerFromSnapshot(options = {}) {
        if (!this.previewEnabled || !this.worldMapRenderer || !this.lastGame?.state) return false;
        if (typeof this.worldMapRenderer.renderWorldMapSnapshotLayer !== 'function') return false;
        this.syncWorldMapRendererLayerMetrics();
        const state = this.lastGame.state;
        const runtime = this.worldMapRuntimeCoordinator?.getMapRuntime?.() || this.worldMapRuntime;
        const territoryUiState = runtime?.getCameraUiState?.()
          || this.lastGame?.territoryController?.getUiState?.()
          || this.territoryUiState
          || {};
        const topBarBottom = typeof this.renderer?.getTopBarBottom === 'function'
          ? this.renderer.getTopBarBottom(state, { isMapHome: true })
          : 84;
        const rendered = this.worldMapRenderer.renderWorldMapSnapshotLayer(state, {
          ...this.buildRenderOptions('military', territoryUiState),
          activeTab: 'military',
          isMapHome: true,
          territoryUiState,
          topBarBottom,
          frameless: true,
          preserveOnMiss: options.preserveOnMiss ?? true,
          reuseCachedWorldTileView: true,
          snapshotOnly: true,
          waterTimeMs: options.waterTimeMs ?? this.worldMapDragWaterTimeMs,
          showFpsOverlay: false,
        });
        if (!rendered) return false;
        const frameContext = this.worldMapRenderer.lastWorldTileMapContext || null;
        if (frameContext && runtime) runtime.lastTileMapContext = frameContext;
        this.renderWorldFogLayer(frameContext);
        this.renderWorldActorLayer({
          ...options,
          state,
          territoryUiState,
          worldMapRuntimeContext: frameContext || options.worldMapRuntimeContext || null,
        });
        if (options.commitCamera !== false) runtime?.markBakedCamera?.(runtime.camera);
        if (options.clearTransform !== false) this.clearWorldMapLayerTransform();
        return true;
      },
    });
    return true;
  }

  const api = { install };

  global.CanvasGameShellWorldMapLayerBridge = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
