(function (global) {
  var WorldMapRuntimeCoordinatorBase = global.WorldMapRuntimeCoordinator;
  if (typeof module !== 'undefined' && module.exports && !WorldMapRuntimeCoordinatorBase) {
    WorldMapRuntimeCoordinatorBase = require('./WorldMapRuntimeCoordinator');
  }

  function install(CanvasGameShell) {
    if (!CanvasGameShell?.prototype) return false;
    Object.assign(CanvasGameShell.prototype, {
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
          getLayerBackingStoreState: () => this.getWorldMapLayerBackingStoreState?.() || null,
          getBaseUiState: () => this.territoryUiState
            || this.lastGame?.territoryUiState
            || this.lastGame?.territoryController?.uiState
            || this.lastGame?.territoryController?.getUiState?.()
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
          onAction: (action, event, meta) => {
            const handled = this.handleAction(action, event, meta);
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

      renderRuntimeWorldMap(state = this.lastGame?.state, options = {}) {
        if (!state) return false;
        const coordinator = this.ensureWorldMapRuntimeCoordinator();
        if (!coordinator) return false;
        if (!options.snapshotOnly) this.clearWorldMapLayerTransform();
        const rendered = coordinator.render(state, options);
        this.worldMapRuntime = coordinator.getMapRuntime();
        if (rendered) this.renderWorldFogLayer();
        return rendered;
      },

      shouldRenderRuntimeWorldMap(state = this.lastGame?.state, options = {}) {
        const coordinator = this.ensureWorldMapRuntimeCoordinator();
        const runtime = coordinator?.getMapRuntime?.();
        if (!coordinator?.canRender?.(state)) return false;
        if (typeof this.hasValidBakedWorldMapLayer === 'function' && !this.hasValidBakedWorldMapLayer()) return true;
        if (!runtime || typeof runtime.isMapBakeDirty !== 'function') return true;
        return Boolean(options.force || runtime.isMapBakeDirty(state, options));
      },
    });
    return true;
  }

  const api = { install };

  global.CanvasGameShellWorldMapRuntime = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
