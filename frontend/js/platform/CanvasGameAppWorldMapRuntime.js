(function (global) {
  var WorldMapRuntimeCoordinatorBase = global.WorldMapRuntimeCoordinator;
  if (typeof module !== 'undefined' && module.exports && !WorldMapRuntimeCoordinatorBase) {
    WorldMapRuntimeCoordinatorBase = require('./WorldMapRuntimeCoordinator');
  }
  var WorldMapRuntimeRenderPolicy = global.WorldMapRuntimeRenderPolicy;
  if (typeof module !== 'undefined' && module.exports && !WorldMapRuntimeRenderPolicy) {
    WorldMapRuntimeRenderPolicy = require('./WorldMapRuntimeRenderPolicy');
  }
  var TerritoryUiStateStore = global.TerritoryUiStateStore;
  if (typeof module !== 'undefined' && module.exports && !TerritoryUiStateStore) {
    TerritoryUiStateStore = require('../state/TerritoryUiStateStore');
  }

  function buildMilitaryRenderOptions(host = null, uiState = null, options = {}) {
    if (typeof host?.buildRenderOptions === 'function') {
      const renderOptions =
        host.buildRenderOptions('military', uiState, {
          ...options,
          forceMapHome: true,
        }) || {};
      const { territoryUiState = uiState || {} } = renderOptions;
      return {
        ...renderOptions,
        territoryUiState,
      };
    }
    return {
      territoryUiState: uiState || {},
    };
  }

  function resolveRuntimeUiState(runtime = null) {
    return runtime?.getCameraUiState?.() || null;
  }

  const WORLD_MAP_RUNTIME_METHODS = Object.freeze({
    getFrozenWorldMapWaterTimeMs() {
      return this.worldMapDragWaterTimeMs !== null &&
        this.worldMapDragWaterTimeMs !== undefined &&
        Number.isFinite(Number(this.worldMapDragWaterTimeMs))
        ? Number(this.worldMapDragWaterTimeMs)
        : this.now();
    },

    isWorldMapDragging() {
      return (
        this.worldMapDragWaterTimeMs !== null &&
        this.worldMapDragWaterTimeMs !== undefined &&
        Number.isFinite(Number(this.worldMapDragWaterTimeMs))
      );
    },

    isWorldMapDragCoolingDown() {
      return Number(this.worldMapDragCooldownUntil) > this.now();
    },

    startWorldMapSnapshotDrag() {
      this.worldMapDragWaterTimeMs = this.now();
      return this.worldMapDragWaterTimeMs;
    },

    finishWorldMapSnapshotDrag() {
      this.worldMapDragCooldownUntil = this.now() + this.getWorldMapDragCooldownMs();
      this.worldMapDragWaterTimeMs = null;
      this.worldMapPinchDragging = false;
      if (this.worldMapRuntime) this.worldMapRuntime.waterTimeMs = null;
      this.updateWorldActorAnimationLoop?.({ force: true });
    },

    renderWorldMapSnapshotDragFrame() {
      if (!this.renderer || typeof this.renderer.renderWorldMapSnapshotLayer !== 'function')
        return false;
      const coordinator = this.ensureWorldMapRuntimeCoordinator();
      const runtime = coordinator?.getMapRuntime?.();
      if (!runtime || !coordinator?.canRender?.(this.state)) return false;
      const renderOptions = buildMilitaryRenderOptions(this, resolveRuntimeUiState(runtime));
      const { territoryUiState = {} } = renderOptions;
      const topBarBottom =
        typeof this.renderer.getTopBarBottom === 'function'
          ? this.renderer.getTopBarBottom(this.state, { isMapHome: true })
          : 84;
      const epochNowMs = this.getWorldEpochNowMs?.() ?? Date.now();
      const rendered = this.renderer.renderWorldMapSnapshotLayer(this.state, {
        ...renderOptions,
        epochNowMs,
        activeTab: 'military',
        isMapHome: true,
        territoryUiState,
        topBarBottom,
        frameless: true,
        preserveOnMiss: false,
        reuseCachedWorldTileView: true,
        snapshotOnly: true,
        waterTimeMs: this.now(),
        showFpsOverlay: false,
      });
      if (!rendered) return false;
      const frameContext = this.renderer.lastWorldTileMapContext || null;
      if (frameContext) runtime.lastTileMapContext = frameContext;
      this.renderer.renderWorldMapActorLayer?.(this.state, {
        epochNowMs,
        activeTab: 'military',
        isMapHome: true,
        territoryUiState,
        worldMapRuntimeContext: frameContext,
        preserveCanvas: true,
        showFpsOverlay: false,
      });
      runtime.syncHitTargetsFromRenderer?.({ preserveOnEmpty: true });
      const renderResult =
        this.renderer.lastWorldMapLayerRenderResult ||
        this.renderer.worldMapLayerRenderer?.lastWorldMapLayerRenderResult ||
        null;
      const frameState =
        runtime.getWorldMapFrameState?.({ renderResult, rendered }) ||
        WorldMapRuntimeRenderPolicy?.createWorldMapFrameState?.(runtime, {
          renderResult,
          rendered,
        }) ||
        null;
      const compositionOptions = WorldMapRuntimeRenderPolicy?.createWorldMapCompositionOptions
        ? WorldMapRuntimeRenderPolicy.createWorldMapCompositionOptions(
            {
              activeTab: 'military',
              isMapHome: true,
              territoryUiState,
              network: this.networkState,
            },
            frameState || {},
          )
        : {
            activeTab: 'military',
            isMapHome: true,
            skipWorldMapLayer: true,
            worldMapRuntimeHitTargets: Array.isArray(runtime.hitTargets) ? runtime.hitTargets : [],
            preserveCanvas: true,
            territoryUiState,
            network: this.networkState,
          };
      this.renderer.render(this.state, {
        ...compositionOptions,
        activeTab: 'military',
        isMapHome: true,
        territoryUiState,
        network: this.networkState,
      });
      return true;
    },

    getWorldMapSnapshotRenderOptions(waterTimeMs = this.getFrozenWorldMapWaterTimeMs()) {
      const hasWaterTimeMs =
        waterTimeMs !== null && waterTimeMs !== undefined && Number.isFinite(Number(waterTimeMs));
      const resolvedWaterTimeMs = hasWaterTimeMs
        ? Number(waterTimeMs)
        : this.getFrozenWorldMapWaterTimeMs();
      return {
        force: true,
        reuseCachedWorldTileView: true,
        snapshotOnly: true,
        waterTimeMs: resolvedWaterTimeMs,
      };
    },

    ensureWorldMapRuntimeCoordinator() {
      if (this.worldMapRuntimeCoordinator) return this.worldMapRuntimeCoordinator;
      const CoordinatorCtor = WorldMapRuntimeCoordinatorBase || global.WorldMapRuntimeCoordinator;
      if (!CoordinatorCtor) return null;
      this.worldMapRuntimeCoordinator = new CoordinatorCtor({
        host: this,
        worldMapRuntime: this.worldMapRuntime,
        useWorldMapRuntime: this.useWorldMapRuntime,
        renderOnDrag: false,
        getRenderer: () => this.renderer,
        getPresenter: () => this.presenter,
        getState: () => this.state || {},
        getLayerBackingStoreState: () =>
          this.runtime?.getLayerBackingStoreState?.('worldMap') || null,
        getBaseUiState: () => TerritoryUiStateStore?.ensure?.(this) || {},
        getLocalUiState: () => {
          const renderOptions = buildMilitaryRenderOptions(this, TerritoryUiStateStore?.ensure?.(this) || {});
          const { territoryUiState = {} } = renderOptions;
          return territoryUiState;
        },
        getTerritoryController: () => this.territoryController,
        getTopBarBottom: (state) =>
          typeof this.renderer?.getTopBarBottom === 'function'
            ? this.renderer.getTopBarBottom(state, { isMapHome: true })
            : 84,
        getRequestedTab: (state = this.state) => state?.currentTab || this.activeTab || 'resources',
        getMilitaryView: (state = this.state) => state?.militaryView || this.militaryView,
        getForceMapHome: () => this.mapHomeActive,
        canRouteTap: (point) => !this.isPointBlockedByTutorialShield(point),
        onAction: (action, event, meta = {}) => {
          const handled = this.actionController?.handle?.(action, { ...(meta || {}), event });
          this.advanceTutorialIntroAfterHandled(handled, action);
          return handled;
        },
        onBeforeDrag: ({ phase, runtime }) => {
          if (phase === 'start') {
            const waterTimeMs = this.startWorldMapSnapshotDrag();
            if (runtime) runtime.waterTimeMs = waterTimeMs;
          }
        },
        onAfterDrag: ({ phase, handled }) => {
          if (handled && phase === 'move') this.renderWorldMapSnapshotDragFrame();
          if (handled && (phase === 'end' || phase === 'cancel')) this.finishWorldMapSnapshotDrag();
        },
      });
      return this.worldMapRuntimeCoordinator;
    },

    ensureWorldMapRuntime() {
      const coordinator = this.ensureWorldMapRuntimeCoordinator();
      if (!coordinator) return this.worldMapRuntime;
      this.worldMapRuntime = coordinator.ensureRuntime();
      return this.worldMapRuntime;
    },

    isWorldMapHomeActive() {
      const coordinator = this.ensureWorldMapRuntimeCoordinator();
      if (coordinator) return coordinator.isMapHomeActive(this.state);
      const homeView = this.resolveMapHomeViewState(this.state, {
        requestedTab: this.state?.currentTab || this.activeTab || 'resources',
        militaryView: this.state?.militaryView || this.militaryView,
        forceMapHome: this.mapHomeActive,
      });
      return Boolean(
        homeView.isMapHome &&
        homeView.activeTab === 'military' &&
        homeView.militaryView === 'world',
      );
    },

    renderRuntimeWorldMap(stateOrOptions = this.state, maybeOptions = null) {
      const hasExplicitState = maybeOptions !== null && maybeOptions !== undefined;
      const state = hasExplicitState ? stateOrOptions : this.state;
      const options = hasExplicitState ? maybeOptions || {} : stateOrOptions || {};
      const coordinator = this.ensureWorldMapRuntimeCoordinator();
      if (!coordinator) return false;
      const rendered = coordinator.render(state || this.state, options);
      this.worldMapRuntime = coordinator.getMapRuntime();
      return rendered;
    },

    shouldRenderRuntimeWorldMap(stateOrOptions = this.state, maybeOptions = null) {
      const hasExplicitState = maybeOptions !== null && maybeOptions !== undefined;
      const state = hasExplicitState ? stateOrOptions : this.state;
      const options = hasExplicitState ? maybeOptions || {} : stateOrOptions || {};
      const coordinator = this.ensureWorldMapRuntimeCoordinator();
      const runtime = coordinator?.getMapRuntime?.();
      if (!coordinator?.canRender?.(state || this.state)) return false;
      if (runtime?.isBakedLayerStateValid && !runtime.isBakedLayerStateValid()) return true;
      if (!runtime || typeof runtime.isMapBakeDirty !== 'function') return true;
      return Boolean(options.force || runtime.isMapBakeDirty(state || this.state, options));
    },

    refreshWorldMapLayerFromSnapshot(options = {}) {
      const coordinator = this.ensureWorldMapRuntimeCoordinator();
      const runtime = coordinator?.getMapRuntime?.();
      if (
        !runtime ||
        !this.renderer ||
        typeof this.renderer.renderWorldMapSnapshotLayer !== 'function'
      )
        return false;
      const renderOptions = buildMilitaryRenderOptions(this, resolveRuntimeUiState(runtime));
      const { territoryUiState = {} } = renderOptions;
      const epochNowMs = options.epochNowMs ?? this.getWorldEpochNowMs?.() ?? Date.now();
      const rendered = this.renderer.renderWorldMapSnapshotLayer(this.state, {
        ...renderOptions,
        epochNowMs,
        activeTab: 'military',
        isMapHome: true,
        territoryUiState,
        topBarBottom:
          typeof this.renderer.getTopBarBottom === 'function'
            ? this.renderer.getTopBarBottom(this.state, { isMapHome: true })
            : 84,
        frameless: true,
        preserveOnMiss: true,
        reuseCachedWorldTileView: true,
        snapshotOnly: true,
        waterTimeMs: options.waterTimeMs ?? this.worldMapDragWaterTimeMs,
        showFpsOverlay: false,
      });
      if (!rendered) return false;
      const frameContext = this.renderer.lastWorldTileMapContext || null;
      if (frameContext) runtime.lastTileMapContext = frameContext;
      this.renderer.renderWorldMapActorLayer?.(this.state, {
        epochNowMs,
        activeTab: 'military',
        isMapHome: true,
        territoryUiState,
        worldMapRuntimeContext: frameContext,
        preserveCanvas: true,
        showFpsOverlay: false,
      });
      runtime.syncHitTargetsFromRenderer?.({ preserveOnEmpty: true });
      const renderResult =
        this.renderer.lastWorldMapLayerRenderResult ||
        this.renderer.worldMapLayerRenderer?.lastWorldMapLayerRenderResult ||
        null;
      if (renderResult?.drewFrame !== false) {
        runtime.hasBakedMapLayer = true;
        runtime.mapBakeDirty = false;
        runtime.markBakedLayerCommitted?.();
      }
      if (options.commitCamera !== false) runtime.markBakedCamera?.(runtime.camera);
      return true;
    },
  });

  function install(CanvasGameApp) {
    if (!CanvasGameApp?.prototype) return false;
    Object.assign(CanvasGameApp.prototype, {
      getFrozenWorldMapWaterTimeMs: WORLD_MAP_RUNTIME_METHODS.getFrozenWorldMapWaterTimeMs,
      isWorldMapDragging: WORLD_MAP_RUNTIME_METHODS.isWorldMapDragging,
      isWorldMapDragCoolingDown: WORLD_MAP_RUNTIME_METHODS.isWorldMapDragCoolingDown,
      startWorldMapSnapshotDrag: WORLD_MAP_RUNTIME_METHODS.startWorldMapSnapshotDrag,
      finishWorldMapSnapshotDrag: WORLD_MAP_RUNTIME_METHODS.finishWorldMapSnapshotDrag,
      renderWorldMapSnapshotDragFrame: WORLD_MAP_RUNTIME_METHODS.renderWorldMapSnapshotDragFrame,
      getWorldMapSnapshotRenderOptions: WORLD_MAP_RUNTIME_METHODS.getWorldMapSnapshotRenderOptions,
      ensureWorldMapRuntimeCoordinator: WORLD_MAP_RUNTIME_METHODS.ensureWorldMapRuntimeCoordinator,
      ensureWorldMapRuntime: WORLD_MAP_RUNTIME_METHODS.ensureWorldMapRuntime,
      isWorldMapHomeActive: WORLD_MAP_RUNTIME_METHODS.isWorldMapHomeActive,
      renderRuntimeWorldMap: WORLD_MAP_RUNTIME_METHODS.renderRuntimeWorldMap,
      shouldRenderRuntimeWorldMap: WORLD_MAP_RUNTIME_METHODS.shouldRenderRuntimeWorldMap,
      refreshWorldMapLayerFromSnapshot: WORLD_MAP_RUNTIME_METHODS.refreshWorldMapLayerFromSnapshot,
    });
    return true;
  }

  const CanvasGameAppWorldMapRuntime = {
    WORLD_MAP_RUNTIME_METHODS,
    install,
  };
  global.CanvasGameAppWorldMapRuntime = CanvasGameAppWorldMapRuntime;
  if (typeof module !== 'undefined' && module.exports)
    module.exports = CanvasGameAppWorldMapRuntime;
})(typeof window !== 'undefined' ? window : globalThis);
