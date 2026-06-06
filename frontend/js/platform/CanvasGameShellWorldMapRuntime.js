(function (global) {
  var WorldMapRuntimeCoordinatorBase = global.WorldMapRuntimeCoordinator;
  if (typeof module !== 'undefined' && module.exports && !WorldMapRuntimeCoordinatorBase) {
    WorldMapRuntimeCoordinatorBase = require('./WorldMapRuntimeCoordinator');
  }
  function install(CanvasGameShell) {
    if (!CanvasGameShell?.prototype) return false;
    Object.assign(CanvasGameShell.prototype, {
getWorldMapSnapshotRenderOptions(waterTimeMs = this.getFrozenWorldMapWaterTimeMs()) {
      const hasWaterTimeMs = waterTimeMs !== null
        && waterTimeMs !== undefined
        && Number.isFinite(Number(waterTimeMs));
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
        consumeDragEvent: true,
        getRenderer: () => this.worldMapRenderer,
        getPresenter: () => this.presenter || this.renderer?.presenter,
        getState: () => this.lastGame?.state || {},
        getBaseUiState: () => this.lastGame?.territoryController?.uiState
          || this.lastGame?.territoryController?.getUiState?.()
          || this.territoryUiState
          || {},
        getLocalUiState: () => this.territoryUiState || {},
        getTerritoryController: () => this.lastGame?.territoryController || null,
        getTopBarBottom: (state) => (typeof this.renderer?.getTopBarBottom === 'function'
          ? this.renderer.getTopBarBottom(state, { isMapHome: true })
          : 84),
        getRequestedTab: (state = this.lastGame?.state || {}) => this.lastGame?.getActiveTab?.()
          || this.lastGame?.activeTab
          || state.currentTab
          || 'resources',
        getMilitaryView: (state = this.lastGame?.state || {}) => state.militaryView || this.lastGame?.militaryView,
        getForceMapHome: () => Boolean(this.lastGame?.mapHomeActive),
        canRouteTap: (point) => !this.isPointBlockedByTutorialShield(point),
        onAction: (action, event) => {
          const handled = this.handleAction(action, event);
          this.advanceTutorialIntroAfterHandled(handled, action);
          return handled;
        },
        onBeforeRender: () => this.syncWorldMapRendererLayerMetrics(),
        onBeforeDrag: ({ phase, runtime }) => {
          if (phase === 'start') {
            this.closeWorldSiteHud({ direct: true });
            const waterTimeMs = this.startWorldMapSnapshotDrag();
            if (runtime) runtime.waterTimeMs = waterTimeMs;
          }
        },
        onAfterDrag: ({ phase, handled }) => {
          if (handled && phase === 'move') {
            this.updateWorldMapDragCompositor();
          }
          if (handled && (phase === 'end' || phase === 'cancel')) {
            this.finishWorldMapSnapshotDrag();
          }
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
      if (coordinator) return coordinator.isMapHomeActive(this.lastGame?.state || {});
      const state = this.lastGame?.state || {};
      const homeView = this.resolveMapHomeViewState(state, {
        requestedTab: this.lastGame?.getActiveTab?.()
          || this.lastGame?.activeTab
          || state.currentTab
          || 'resources',
        militaryView: state.militaryView || this.lastGame?.militaryView,
        forceMapHome: Boolean(this.lastGame?.mapHomeActive),
      });
      return Boolean(homeView.isMapHome && homeView.activeTab === 'military' && homeView.militaryView === 'world');
    },

canRouteWorldMapRuntimeDrag(point = {}) {
      return Boolean(this.ensureWorldMapRuntimeCoordinator()?.canRouteDrag('start', point, this.lastGame?.state));
    },

handleWorldMapRuntimeDrag(phase, point = {}, event) {
      const handled = this.ensureWorldMapRuntimeCoordinator()?.handleDrag(phase, point, event) || false;
      this.worldMapRuntime = this.worldMapRuntimeCoordinator?.getMapRuntime?.() || this.worldMapRuntime;
      return handled;
    },

getWorldTileWaterAnimationFrameMs() {
      const fps = Number(this.worldMapRenderer?.getWorldTileWaterAnimationFps?.()
        || this.renderer?.getWorldTileWaterAnimationFps?.()
        || 8);
      return Math.max(this.getAnimationFrameMs(), Math.round(1000 / Math.max(1, fps)));
    },

getWorldMapLayerPadding() {
      return Math.max(200, Number(this.worldMapRenderer?.getWorldTileDragCachePanRange?.()
        || this.renderer?.getWorldTileDragCachePanRange?.()
        || 180));
    },

syncWorldMapRendererLayerMetrics() {
      if (!this.worldMapRenderer || typeof this.runtime?.getLayerMetrics !== 'function') return false;
      const metrics = this.runtime.getLayerMetrics('worldMap');
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
      if (changed) this.worldMapRuntime?.invalidateBake?.();
      return true;
    },

renderRuntimeWorldMap(state = this.lastGame?.state, options = {}) {
      if (!state) return false;
      const coordinator = this.ensureWorldMapRuntimeCoordinator();
      if (!coordinator) return false;
      if (!options.snapshotOnly) this.clearWorldMapLayerTransform();
      const rendered = coordinator.render(state, options);
      this.worldMapRuntime = coordinator.getMapRuntime();
      return rendered;
    },

shouldRenderRuntimeWorldMap(state = this.lastGame?.state, options = {}) {
      const coordinator = this.ensureWorldMapRuntimeCoordinator();
      const runtime = coordinator?.getMapRuntime?.();
      if (!coordinator?.canRender?.(state)) return false;
      if (!runtime || typeof runtime.isMapBakeDirty !== 'function') return true;
      return Boolean(options.force || runtime.isMapBakeDirty(state));
    },

getFrozenWorldMapWaterTimeMs() {
      if (
        this.worldMapDragWaterTimeMs === null
        || this.worldMapDragWaterTimeMs === undefined
        || !Number.isFinite(Number(this.worldMapDragWaterTimeMs))
      ) {
        this.worldMapDragWaterTimeMs = this.now();
      }
      return this.worldMapDragWaterTimeMs;
    },

isWorldMapDragging() {
      return this.worldMapDragWaterTimeMs !== null
        && this.worldMapDragWaterTimeMs !== undefined
        && Number.isFinite(Number(this.worldMapDragWaterTimeMs));
    },

isWorldMapDragCoolingDown() {
      return Number(this.worldMapDragCooldownUntil) > this.now();
    },

getWorldMapDragCooldownMs() {
      return 220;
    },

hasPendingWorldMapCompositeCommit() {
      return false;
    },

getWorldMapPan() {
      const uiState = this.lastGame?.territoryController?.getUiState?.() || this.territoryUiState || {};
      return {
        x: Number(uiState.worldPanX) || 0,
        y: Number(uiState.worldPanY) || 0,
      };
    },

startWorldMapSnapshotDrag() {
      this.worldMapDragWaterTimeMs = this.now();
      return this.worldMapDragWaterTimeMs;
    },

finishWorldMapSnapshotDrag() {
      this.worldMapDragCooldownUntil = this.now() + this.getWorldMapDragCooldownMs();
      this.worldMapDragWaterTimeMs = null;
      this.worldMapDragFrameActive = false;
      this.worldMapPinchDragging = false;
      if (this.worldMapRuntime) this.worldMapRuntime.waterTimeMs = null;
      const shouldRender = Boolean(this.deferRenderUntilWorldMapDragEnd);
      this.deferRenderUntilWorldMapDragEnd = false;
      return shouldRender ? this.renderActive({ invalidateWorldTileView: false }) : true;
    },

getWorldMapRuntimeDragOffset() {
      const runtime = this.worldMapRuntimeCoordinator?.getMapRuntime?.() || this.worldMapRuntime;
      if (runtime && typeof runtime.getCameraOffsetFromBaked === 'function') return runtime.getCameraOffsetFromBaked();
      return {
        x: Number(runtime?.dragLayerOffset?.x) || 0,
        y: Number(runtime?.dragLayerOffset?.y) || 0,
      };
    },

getWorldMapDragTransformLimit() {
      return Math.max(120, this.getWorldMapLayerPadding() * 0.72);
    },

isWorldMapDragTransformNearLimit(offset = this.getWorldMapRuntimeDragOffset()) {
      const limit = this.getWorldMapDragTransformLimit();
      return Math.abs(Number(offset.x) || 0) >= limit || Math.abs(Number(offset.y) || 0) >= limit;
    },

updateWorldMapDragCompositor() {
      const offset = this.getWorldMapRuntimeDragOffset();
      if (this.isWorldMapDragTransformNearLimit(offset)) {
        if (this.refreshWorldMapLayerFromSnapshot({
          waterTimeMs: this.now(),
          commitCamera: true,
          clearTransform: true,
          preserveOnMiss: true,
        })) return this.getWorldMapRuntimeDragOffset();
      }
      if (this.refreshWorldMapLayerFromSnapshot({
        waterTimeMs: this.now(),
        commitCamera: false,
        clearTransform: false,
        preserveOnMiss: true,
      })) {
        this.clearWorldMapLayerTransform();
        return offset;
      }
      if (
        typeof this.runtime?.ensureLayerCanvas === 'function'
        && typeof this.runtime?.getLayerCanvas === 'function'
        && !this.runtime.getLayerCanvas('worldMap')
      ) {
        this.runtime.ensureLayerCanvas('worldMap', { padding: this.getWorldMapLayerPadding() });
      }
      if (typeof this.runtime?.setLayerTranslate === 'function') {
        this.runtime.setLayerTranslate('worldMap', offset.x, offset.y);
      }
      return offset;
    },

clearWorldMapLayerTransform() {
      return typeof this.runtime?.clearLayerTransform === 'function'
        ? this.runtime.clearLayerTransform('worldMap')
        : false;
    },

setWorldMapLayerVisible(visible = true) {
      return typeof this.runtime?.setLayerVisible === 'function'
        ? this.runtime.setLayerVisible('worldMap', visible !== false)
        : false;
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
      if (options.commitCamera !== false) runtime?.markBakedCamera?.(runtime.camera);
      if (options.clearTransform !== false) this.clearWorldMapLayerTransform();
      return true;
    },

renderWorldMapLayerFrame(options = {}) {
      if (!this.previewEnabled || !this.worldMapRenderer || !this.lastGame?.state) return false;
      const coordinator = this.ensureWorldMapRuntimeCoordinator();
      const runtime = coordinator?.getMapRuntime?.();
      if (this.isWorldMapHomeActive() && coordinator?.canRender(this.lastGame.state)) {
        const snapshotWaterRefresh = Boolean(options.snapshotOnly
          && options.reuseCachedWorldTileView
          && options.waterTimeMs !== null
          && options.waterTimeMs !== undefined
          && Number.isFinite(Number(options.waterTimeMs)));
        if (!snapshotWaterRefresh && !this.shouldRenderRuntimeWorldMap(this.lastGame.state, options)) return false;
        const runtimeDragging = Boolean(runtime?.isDragging?.());
        const hasOptionWaterTime = options.waterTimeMs !== null
          && options.waterTimeMs !== undefined
          && Number.isFinite(Number(options.waterTimeMs));
        const reuseCachedWorldTileView = Boolean(options.reuseCachedWorldTileView || this.worldMapDragFrameActive || runtimeDragging);
        const waterTimeMs = hasOptionWaterTime
          ? Number(options.waterTimeMs)
          : (this.isWorldMapDragging() || runtimeDragging || reuseCachedWorldTileView
          ? this.getFrozenWorldMapWaterTimeMs()
          : null);
        const snapshotOnly = Boolean(options.snapshotOnly || this.worldMapDragFrameActive || runtimeDragging);
        return this.renderRuntimeWorldMap(this.lastGame.state, {
          ...options,
          reuseCachedWorldTileView,
          snapshotOnly,
          waterTimeMs,
        });
      }
      this.syncWorldMapRendererLayerMetrics();
      const now = this.now();
      const frameMs = Math.max(1, this.getAnimationFrameMs() - 1);
      if (!options.force && this.lastWorldMapLayerRenderAt && now - this.lastWorldMapLayerRenderAt < frameMs) return false;
      this.lastWorldMapLayerRenderAt = now;
      const reuseCachedWorldTileView = Boolean(options.reuseCachedWorldTileView || this.worldMapDragFrameActive || this.isWorldMapDragging());
      this.worldMapDragFrameActive = false;
      const waterTimeMs = options.waterTimeMs !== null
        && options.waterTimeMs !== undefined
        && Number.isFinite(Number(options.waterTimeMs))
        ? Number(options.waterTimeMs)
        : (reuseCachedWorldTileView ? this.getFrozenWorldMapWaterTimeMs() : null);
      return this.renderWorldMapLayer(this.lastGame.state, {
        reuseCachedWorldTileView,
        snapshotOnly: Boolean(options.snapshotOnly || reuseCachedWorldTileView),
        waterTimeMs,
      });
    },

requestWorldMapRenderAnimationFrame(options = {}) {
      if (!this.worldMapRenderer) return this.requestRenderAnimationFrame();
      this.worldMapQueuedRenderOptions = {
        ...(this.worldMapQueuedRenderOptions || {}),
        ...options,
      };
      if (this.worldMapLayerRenderQueued) return true;
      const raf = this.getRequestAnimationFrame();
      if (!raf) {
        const queuedOptions = this.worldMapQueuedRenderOptions || {};
        this.worldMapQueuedRenderOptions = null;
        return this.renderWorldMapLayerFrame(queuedOptions);
      }
      this.worldMapLayerRenderQueued = true;
      raf(() => {
        this.worldMapLayerRenderQueued = false;
        const queuedOptions = this.worldMapQueuedRenderOptions || {};
        this.worldMapQueuedRenderOptions = null;
        this.renderWorldMapLayerFrame(queuedOptions);
      });
      return true;
    },

renderWorldMapLayer(state = this.lastGame?.state, options = null) {
      if (!this.previewEnabled || !this.worldMapRenderer || !state) return false;
      if (this.isWorldMapHomeActive() && this.ensureWorldMapRuntimeCoordinator()?.canRender(state)) {
        return this.renderRuntimeWorldMap(state, options || {});
      }
      this.syncWorldMapRendererLayerMetrics();
      const homeView = this.resolveMapHomeViewState(state, {
        requestedTab: options?.activeTab || this.getActiveTab(),
        militaryView: state.militaryView || this.lastGame?.militaryView,
        forceMapHome: Boolean(this.lastGame?.mapHomeActive || options?.isMapHome),
      });
      this.mapHomeActive = homeView.isMapHome;
      if (homeView.militaryView && state.militaryView !== homeView.militaryView) state.militaryView = homeView.militaryView;
      if (homeView.activeTab !== 'military') {
        if (typeof this.worldMapRenderer.clearAll === 'function') this.worldMapRenderer.clearAll();
        return false;
      }
      const territoryUiState = options?.territoryUiState
        || this.lastGame?.territoryController?.getUiState?.()
        || this.territoryUiState
        || {};
      const topBarBottom = typeof this.renderer?.getTopBarBottom === 'function'
        ? this.renderer.getTopBarBottom(state, { isMapHome: homeView.isMapHome })
        : 84;
      const rendered = this.worldMapRenderer.renderWorldMapLayer(state, {
        ...(options || this.buildRenderOptions(homeView.activeTab, territoryUiState)),
        activeTab: homeView.activeTab,
        isMapHome: homeView.isMapHome,
        territoryUiState,
        topBarBottom,
        reuseCachedWorldTileView: Boolean(options?.reuseCachedWorldTileView),
        snapshotOnly: Boolean(options?.snapshotOnly),
        waterTimeMs: options?.waterTimeMs !== null
          && options?.waterTimeMs !== undefined
          && Number.isFinite(Number(options.waterTimeMs))
          ? Number(options.waterTimeMs)
          : null,
        showFpsOverlay: false,
      });
      if (rendered) this.lastWorldMapLayerRenderAt = this.now();
      return rendered;
    },

startTileMapWaterTimer() {
      if (this.tileMapWaterTimer || !this.runtime?.setInterval) return false;
      this.tileMapWaterTimer = this.runtime.setInterval(() => {
        if (this.getActiveTab() !== 'military') {
          this.stopTileMapWaterTimer();
          return;
        }
        if (this.isWorldMapDragging() || this.isWorldMapDragCoolingDown()) return;
        if (this.lastGame?.state?.worldExplorerState?.activeMission) {
          if (this.worldMapRenderer) this.renderWorldMapLayerFrame({ force: true });
          this.renderAnimationFrame();
          return;
        }
        if (this.isWorldMapHomeActive() && !this.shouldRenderRuntimeWorldMap(this.lastGame?.state, {})) {
          this.renderWorldMapLayerFrame({
            reuseCachedWorldTileView: true,
            snapshotOnly: true,
            waterTimeMs: this.now(),
          });
          return;
        }
        if (this.worldMapRenderer) this.renderWorldMapLayerFrame();
        else this.renderAnimationFrame();
      }, this.getWorldTileWaterAnimationFrameMs());
      return true;
    },

stopTileMapWaterTimer() {
      if (!this.tileMapWaterTimer) return;
      this.runtime?.clearInterval?.(this.tileMapWaterTimer);
      this.tileMapWaterTimer = null;
    }
    });
    return true;
  }

  const api = { install };

  global.CanvasGameShellWorldMapRuntime = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
