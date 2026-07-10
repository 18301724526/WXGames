(function (global) {
  var WorldMapRuntimeBase = global.WorldMapRuntime;
  if (typeof module !== 'undefined' && module.exports && !WorldMapRuntimeBase) {
    WorldMapRuntimeBase = require('./WorldMapRuntime');
  }
  const UiRuntimeStateStore = (() => {
    if (global.UiRuntimeStateStore) return global.UiRuntimeStateStore;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../state/UiRuntimeStateStore');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class WorldMapRuntimeCoordinator {
    constructor(options = {}) {
      this.host = options.host || null;
      this.RuntimeCtor = options.RuntimeCtor || WorldMapRuntimeBase || global.WorldMapRuntime;
      this.mapRuntime = options.worldMapRuntime || null;
      this.useWorldMapRuntime = options.useWorldMapRuntime !== false;
      this.renderOnDrag = options.renderOnDrag;
      this.consumeDragEvent = Boolean(options.consumeDragEvent);
      this.getPlatformRuntime = options.getPlatformRuntime || (() => this.host?.runtime || null);
      this.getRenderer = options.getRenderer || (() => this.host?.renderer || null);
      this.getPresenter = options.getPresenter || (() => this.host?.presenter || this.getRenderer()?.presenter || null);
      this.getState = options.getState || (() => this.host?.state || {});
      this.getLayerBackingStoreState = options.getLayerBackingStoreState || (() => (
        this.host?.getWorldMapLayerBackingStoreState?.()
        || this.host?.runtime?.getLayerBackingStoreState?.('worldMap')
        || null
      ));
      this.getBaseUiState = options.getBaseUiState || (() => this.host?.territoryUiState || {});
      this.getLocalUiState = options.getLocalUiState || (() => this.host?.territoryUiState || {});
      this.getTerritoryController = options.getTerritoryController || (() => this.host?.territoryController || null);
      this.getTopBarBottom = options.getTopBarBottom || ((state) => (
        typeof this.getRenderer()?.getTopBarBottom === 'function'
          ? this.getRenderer().getTopBarBottom(state)
          : 84
      ));
      this.getRequestedTab = options.getRequestedTab || ((state = this.getState()) => (
        UiRuntimeStateStore?.getNavigation?.(this.host)?.activeTab
          || this.host?.getActiveTab?.()
          || state?.currentTab
          || 'resources'
      ));
      this.getMilitaryView = options.getMilitaryView || ((state = this.getState()) => (
        UiRuntimeStateStore?.getNavigation?.(this.host)?.militaryView || state?.militaryView
      ));
      this.getForceMapHome = options.getForceMapHome || (() => Boolean(this.host?.mapHomeActive));
      this.canRouteTap = options.canRouteTap || (() => true);
      this.resolveMapHomeViewState = options.resolveMapHomeViewState || ((state, viewOptions) => {
        if (this.host?.resolveMapHomeViewState) return this.host.resolveMapHomeViewState(state || {}, viewOptions);
        const presenter = this.getPresenter();
        if (presenter?.resolveMapHomeViewState) return presenter.resolveMapHomeViewState(state || {}, viewOptions);
        const requestedTab = viewOptions.requestedTab || viewOptions.activeTab || state?.currentTab || 'resources';
        const hasTiles = Array.isArray(state?.territoryState?.worldMap?.tiles)
          && state.territoryState.worldMap.tiles.length > 0;
        const canUseMapHome = true;
        const requestedMilitaryView = viewOptions.militaryView || state?.militaryView || 'army';
        const militaryMapRequested = requestedTab === 'military'
          && (viewOptions.forceMapHome || viewOptions.isMapHome || requestedMilitaryView === 'world');
        const shouldUseMapHome = canUseMapHome
          && viewOptions.allowDefaultMapHome !== false
          && (viewOptions.forceMapHome || requestedTab === 'resources' || requestedTab === 'territory' || militaryMapRequested);
        return {
          activeTab: shouldUseMapHome ? 'military' : (requestedTab === 'territory' ? 'military' : requestedTab),
          requestedTab,
          militaryView: shouldUseMapHome ? 'world' : requestedMilitaryView,
          isMapHome: Boolean(shouldUseMapHome),
          canUseMapHome,
        };
      });
      this.isBlocked = options.isBlocked || (() => Boolean(this.host?.hasBlockingOverlayOpen?.()));
      this.onAction = options.onAction || ((action, event, meta = {}) => this.host?.actionController?.handle?.(action, { ...(meta || {}), event }));
      this.onBeforeRender = options.onBeforeRender || null;
      this.onBeforeDrag = options.onBeforeDrag || null;
      this.onAfterDrag = options.onAfterDrag || null;
      this.onCameraChanged = options.onCameraChanged || null;
    }

    isEnabled() {
      return this.useWorldMapRuntime && this.host?.useWorldMapRuntime !== false;
    }

    getMapRuntime() {
      return this.mapRuntime || this.host?.worldMapRuntime || null;
    }

    setMapRuntime(runtime) {
      this.mapRuntime = runtime || null;
      return this.mapRuntime;
    }

    ensureRuntime() {
      if (!this.isEnabled()) return this.getMapRuntime();
      const renderer = this.getRenderer();
      let runtime = this.getMapRuntime();
      if (!runtime && !renderer) return null;
      if (!runtime) {
        const RuntimeCtor = this.RuntimeCtor || global.WorldMapRuntime;
        if (!RuntimeCtor) return null;
        runtime = new RuntimeCtor({
          runtime: this.getPlatformRuntime(),
          renderer,
          presenter: this.getPresenter(),
          initialPanX: this.getBaseUiState()?.worldPanX,
          initialPanY: this.getBaseUiState()?.worldPanY,
          getState: () => this.getState() || {},
          getLayerBackingStoreState: () => this.getLayerBackingStoreState?.() || null,
          getBaseUiState: () => this.getBaseUiState() || {},
          getTopBarBottom: (state) => this.getTopBarBottom(state),
          onAction: (action, event, meta) => this.onAction?.(action, event, meta),
          renderOnDrag: this.renderOnDrag,
          onCameraChanged: (camera, options) => this.syncCamera(camera, options),
        });
        this.setMapRuntime(runtime);
      }
      if (renderer && typeof runtime.setRenderer === 'function') runtime.setRenderer(renderer);
      const presenter = this.getPresenter();
      if (presenter && typeof runtime.setPresenter === 'function') runtime.setPresenter(presenter);
      if ('renderOnDrag' in runtime && this.renderOnDrag !== undefined) {
        runtime.renderOnDrag = this.renderOnDrag !== false;
      }
      return runtime;
    }

    syncCamera(camera = {}, options = {}) {
      const x = Number(camera.x) || 0;
      const y = Number(camera.y) || 0;
      const territory = this.getTerritoryController();
      if (territory?.uiState) {
        territory.uiState.worldPanX = x;
        territory.uiState.worldPanY = y;
      }
      const baseUiState = this.getBaseUiState();
      if (baseUiState && typeof baseUiState === 'object') {
        baseUiState.worldPanX = x;
        baseUiState.worldPanY = y;
      }
      const localUiState = this.getLocalUiState();
      if (localUiState && typeof localUiState === 'object') {
        localUiState.worldPanX = x;
        localUiState.worldPanY = y;
      }
      this.onCameraChanged?.({ x, y }, options);
      return { x, y };
    }

    getMapHomeView(state = this.getState(), options = {}) {
      return this.resolveMapHomeViewState(state || {}, {
        requestedTab: options.requestedTab || this.getRequestedTab(state),
        militaryView: options.militaryView || this.getMilitaryView(state),
        forceMapHome: options.forceMapHome ?? this.getForceMapHome(state),
        allowDefaultMapHome: options.allowDefaultMapHome,
        isMapHome: options.isMapHome,
      });
    }

    isMapHomeActive(state = this.getState(), options = {}) {
      const homeView = this.getMapHomeView(state, options);
      return Boolean(homeView.isMapHome && homeView.activeTab === 'military' && homeView.militaryView === 'world');
    }

    canRender(state = this.getState()) {
      const runtime = this.ensureRuntime();
      return Boolean(runtime?.canRender?.(state || this.getState()));
    }

    canRouteDrag(phase, point = {}, state = this.getState()) {
      const runtime = this.ensureRuntime();
      if (!runtime || !this.isMapHomeActive(state) || this.isBlocked()) return false;
      if (!runtime.canRender?.(state)) return false;
      const continuation = phase === 'move' || phase === 'end' || phase === 'cancel';
      return Boolean(runtime.isPointInMap?.(point, state) || (runtime.isDragging?.() && continuation));
    }

    handleDrag(phase, point = {}, event) {
      const state = this.getState();
      if (!this.canRouteDrag(phase, point, state)) return false;
      const runtime = this.ensureRuntime();
      this.onBeforeDrag?.({ phase, point, event, runtime, state });
      const handled = runtime.handleDrag(phase, point, event);
      this.onAfterDrag?.({ phase, point, event, runtime, state, handled });
      if (handled && this.consumeDragEvent) {
        if (event?.preventDefault) event.preventDefault();
        if (event?.stopPropagation) event.stopPropagation();
      }
      return handled;
    }

    handleTap(point = {}, event, meta = {}) {
      const state = this.getState();
      const runtime = this.ensureRuntime();
      if (!runtime
        || !this.isMapHomeActive(state)
        || this.isBlocked()
        || this.canRouteTap?.(point, state, event) === false
        || !runtime.canRender?.(state)
        || !runtime.isPointInMap?.(point, state)) {
        return false;
      }
      return runtime.handleTap(point, event, meta);
    }

    render(state = this.getState(), options = {}) {
      const runtime = this.ensureRuntime();
      if (!runtime || !state || !runtime.canRender?.(state)) return false;
      this.onBeforeRender?.({ state, options, runtime });
      return runtime.render({
        ...options,
        state,
        force: options.force !== false,
      });
    }
  }

  global.WorldMapRuntimeCoordinator = WorldMapRuntimeCoordinator;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapRuntimeCoordinator;
})(typeof window !== 'undefined' ? window : globalThis);
