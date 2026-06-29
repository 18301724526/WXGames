(function (global) {
  var EcsModeRuntimeBase = global.EcsModeRuntime;
  if (typeof module !== 'undefined' && module.exports && !EcsModeRuntimeBase) {
    try {
      EcsModeRuntimeBase = require('../ecs/mode/EcsModeRuntimeEntry');
    } catch (_error) {
      EcsModeRuntimeBase = null;
    }
  }

  function pickOption(options = {}, key = '') {
    return options && Object.prototype.hasOwnProperty.call(options, key) ? options[key] : undefined;
  }

  function buildMilitaryRenderOptions(host = null, runtime = null, options = {}) {
    const explicitUiState = pickOption(options, 'territoryUiState');
    const runtimeUiState = explicitUiState || runtime?.getCameraUiState?.() || null;
    if (typeof host?.buildRenderOptions === 'function') {
      const renderOptions = host.buildRenderOptions('military', runtimeUiState, {
        forceMapHome: true,
      }) || {};
      const { territoryUiState = runtimeUiState || {} } = renderOptions;
      return {
        ...renderOptions,
        territoryUiState,
      };
    }
    return {
      territoryUiState: runtimeUiState || {},
    };
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

      getWorldMapLayerBackingStoreState() {
        const backing = this.getCanvasLayerBackingStoreState?.('worldMap', null);
        if (!backing) return null;
        const metrics = this.getCanvasLayerMetrics?.('worldMap', null) || {};
        return {
          epoch: Number(backing.epoch) || 0,
          reason: backing.reason || '',
          width: Number(backing.width) || 0,
          height: Number(backing.height) || 0,
          pixelRatio: Number(backing.pixelRatio) || Number(this.runtime?.pixelRatio) || 1,
          logicalWidth: Number(metrics.width) || 0,
          logicalHeight: Number(metrics.height) || 0,
        };
      },

      getWorldMapRuntimeBakeState() {
        const runtime = this.worldMapRuntimeCoordinator?.getMapRuntime?.() || this.worldMapRuntime || null;
        return runtime?.getBakedLayerState?.() || runtime?.bakedLayerState || null;
      },

      getWorldMapBakedLayerValidity() {
        const runtime = this.worldMapRuntimeCoordinator?.getMapRuntime?.() || this.worldMapRuntime || null;
        if (!runtime?.hasBakedMapLayer) return { valid: false, reason: 'notBaked' };
        if (runtime?.mapBakeDirty) return { valid: false, reason: 'mapBakeDirty' };
        const backing = this.getWorldMapLayerBackingStoreState?.() || null;
        if (!backing) return { valid: true, reason: 'noBackingState' };
        const baked = this.getWorldMapRuntimeBakeState?.() || null;
        if (!baked) return { valid: false, reason: 'missingBakedLayerState', backing };
        const sameEpoch = Number(baked.epoch) === Number(backing.epoch);
        const sameWidth = Number(baked.width) === Number(backing.width);
        const sameHeight = Number(baked.height) === Number(backing.height);
        const samePixelRatio = Number(baked.pixelRatio || 1) === Number(backing.pixelRatio || 1);
        const valid = sameEpoch && sameWidth && sameHeight && samePixelRatio;
        return {
          valid,
          reason: valid ? 'valid' : 'backingStoreChanged',
          baked,
          backing,
          checks: {
            sameEpoch,
            sameWidth,
            sameHeight,
            samePixelRatio,
          },
        };
      },

      hasValidBakedWorldMapLayer() {
        const validity = this.getWorldMapBakedLayerValidity?.() || { valid: false, reason: 'missingValidator' };
        this.lastWorldMapBakedLayerValidity = validity;
        return Boolean(validity.valid);
      },

      createFogOwner(context = null, options = {}) {
        const FogOwner = EcsModeRuntimeBase?.FogOwner || global.EcsModeRuntime?.FogOwner;
        if (!FogOwner?.createFogOwner || !context) return null;
        const epochNowMs = options.epochNowMs ?? this.getWorldEpochNowMs?.() ?? context.epochNowMs;
        const owner = FogOwner.createFogOwner({
          ...(context || {}),
          config: this.config,
          epochNowMs,
          state: options.state || this.lastGame?.state || this.state || {},
          worldExplorerState: options.worldExplorerState
            || this.lastGame?.state?.worldExplorerState
            || this.state?.worldExplorerState
            || {},
        }, {
          ...options,
          epochNowMs,
        });
        this.__ecsFogOwner = owner;
        return owner;
      },

      getLastFogOwner() {
        return this.__ecsFogOwner || null;
      },

      renderWorldFogLayer(context = null, options = {}) {
        if (this.isFogOfWarEnabled?.() !== true) {
          this.worldFogRenderer?.clear?.();
          return false;
        }
        if (!this.worldFogRenderer?.renderWorldFog) return false;
        if (!context?.tileMapView || !context?.viewport || !context?.frame) {
          this.worldFogRenderer.clear?.();
          return false;
        }
        const owner = this.createFogOwner(context, options);
        const FogOwner = EcsModeRuntimeBase?.FogOwner || global.EcsModeRuntime?.FogOwner;
        const renderContext = FogOwner?.getFogRendererContext?.(owner) || null;
        if (!renderContext) {
          this.worldFogRenderer.clear?.();
          return false;
        }
        this.syncWorldMapRendererLayerMetrics();
        return this.worldFogRenderer.renderWorldFog(renderContext);
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
        const baseOptions = buildMilitaryRenderOptions(this, runtime, options);
        const { territoryUiState = {} } = baseOptions;
        const rendered = this.worldMapRenderer.renderWorldMapActorLayer(state, {
          ...baseOptions,
          ...options,
          epochNowMs: options.epochNowMs ?? this.getWorldEpochNowMs?.() ?? Date.now(),
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
        if (rendered && runtime?.syncHitTargetsFromRenderer) {
          runtime.syncHitTargetsFromRenderer({
            preserveOnEmpty: options.preserveRuntimeHitTargetsOnEmpty === true,
          });
        }
        return rendered;
      },

      refreshWorldMapLayerFromSnapshot(options = {}) {
        if (!this.previewEnabled || !this.worldMapRenderer || !this.lastGame?.state) return false;
        if (typeof this.worldMapRenderer.renderWorldMapSnapshotLayer !== 'function') return false;
        this.syncWorldMapRendererLayerMetrics();
        const state = this.lastGame.state;
        const runtime = this.worldMapRuntimeCoordinator?.getMapRuntime?.() || this.worldMapRuntime;
        const baseOptions = buildMilitaryRenderOptions(this, runtime, options);
        const { territoryUiState = {} } = baseOptions;
        const topBarBottom = typeof this.renderer?.getTopBarBottom === 'function'
          ? this.renderer.getTopBarBottom(state, { isMapHome: true })
          : 84;
        const epochNowMs = options.epochNowMs ?? this.getWorldEpochNowMs?.() ?? Date.now();
        const rendered = this.worldMapRenderer.renderWorldMapSnapshotLayer(state, {
          ...baseOptions,
          epochNowMs,
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
        this.renderWorldFogLayer(frameContext, { epochNowMs, state });
        this.renderWorldActorLayer({
          ...options,
          epochNowMs,
          state,
          territoryUiState,
          preserveRuntimeHitTargetsOnEmpty: true,
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

  global.CanvasGameShellWorldMapLayerRuntime = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
