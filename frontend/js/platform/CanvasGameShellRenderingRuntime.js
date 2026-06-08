(function (global) {
  function install(CanvasGameShell) {
    if (!CanvasGameShell?.prototype) return false;
    Object.assign(CanvasGameShell.prototype, {
now() {
      return this.runtime?.now?.() || Date.now();
    },

getTabOrder() {
      return ['resources', 'buildings', 'tech', 'events', 'civilization', 'military'];
    },

getTransitionDurationMs() {
      return 220;
    },

getAnimationFrameMs() {
      return 16;
    },

getRequestAnimationFrame() {
      const raf = this.runtime?.requestAnimationFrame || global.requestAnimationFrame;
      return typeof raf === 'function' ? raf.bind(this.runtime || global) : null;
    },

renderAnimationFrame() {
      const now = this.now();
      const frameMs = Math.max(1, this.getAnimationFrameMs() - 1);
      if (this.lastAnimationRenderAt && now - this.lastAnimationRenderAt < frameMs) return false;
      this.lastAnimationRenderAt = now;
      return this.renderActive();
    },

requestRenderAnimationFrame(action = {}) {
      if (action?.type === 'worldMapDrag' && action.phase === 'move' && this.worldMapRenderer) {
        this.updateWorldMapDragCompositor();
        return true;
      }
      if (this.animationRenderQueued) return true;
      const raf = this.getRequestAnimationFrame();
      if (!raf) return this.renderAnimationFrame();
      this.animationRenderQueued = true;
      raf(() => {
        this.animationRenderQueued = false;
        this.renderAnimationFrame();
      });
      return true;
    },

startTransitionTimer() {
      if (this.transitionTimer || !this.runtime?.setInterval) return false;
      this.transitionTimer = this.runtime.setInterval(() => {
        const now = this.now();
        const duration = this.getTransitionDurationMs();
        const pageDone = !this.pageTransition || now - this.pageTransition.startedAt >= (this.pageTransition.durationMs || duration);
        const buildingDone = !this.buildingTransition || now - this.buildingTransition.startedAt >= (this.buildingTransition.durationMs || duration);
        if (pageDone) this.pageTransition = null;
        if (buildingDone) {
          this.buildingTransition = null;
          if (this.lastGame && typeof this.lastGame === 'object') this.lastGame.buildingTransition = null;
        }
        if (!this.pageTransition && !this.buildingTransition) this.stopTransitionTimer();
        this.renderAnimationFrame();
      }, this.getAnimationFrameMs());
      return true;
    },

stopTransitionTimer() {
      if (!this.transitionTimer) return;
      this.runtime?.clearInterval?.(this.transitionTimer);
      this.transitionTimer = null;
    },

startPageTransition(fromTab, toTab, options = {}) {
      if (!fromTab || !toTab || fromTab === toTab) {
        this.pageTransition = null;
        return false;
      }
      const tabs = this.getTabOrder();
      const fromIndex = tabs.indexOf(fromTab);
      const toIndex = tabs.indexOf(toTab);
      this.pageTransition = {
        fromTab,
        toTab,
        direction: toIndex >= 0 && fromIndex >= 0 && toIndex < fromIndex ? -1 : 1,
        startedAt: this.now(),
        durationMs: this.getTransitionDurationMs(),
        fromBuildingOffset: options.fromBuildingOffset ?? this.buildingOffset,
      };
      this.startTransitionTimer();
      this.renderActive();
      return true;
    },

scrollBuildings(action = {}) {
      const fromOffset = Math.max(0, Number(this.buildingOffset) || 0);
      const delta = Number(action.delta) || 0;
      const toOffset = Math.max(0, fromOffset + delta);
      this.buildingOffset = toOffset;
      if (toOffset !== fromOffset) {
        this.buildingTransition = {
          fromOffset,
          toOffset,
          direction: toOffset < fromOffset ? -1 : 1,
          startedAt: this.now(),
          durationMs: this.getTransitionDurationMs(),
        };
        this.startTransitionTimer();
      }
      if (this.lastGame && typeof this.lastGame === 'object') {
        this.lastGame.buildingOffset = this.buildingOffset;
        this.lastGame.buildingTransition = this.buildingTransition;
      }
      return true;
    },

handleResize(size) {
      if (!this.renderer) return;
      this.renderer.width = size.width;
      this.renderer.height = size.height;
      this.renderer.pixelRatio = size.pixelRatio;
      if (this.worldMapRenderer) {
        this.syncWorldMapRendererLayerMetrics();
      }
      this.renderActive();
    },

getActiveTab() {
      const state = this.lastGame?.state || {};
      const requestedTab = this.lastGame?.getActiveTab?.()
        || this.lastGame?.activeTab
        || state.currentTab
        || 'resources';
      const view = this.resolveMapHomeViewState(state, {
        requestedTab,
        militaryView: state.militaryView || this.lastGame?.militaryView,
        forceMapHome: Boolean(this.lastGame?.mapHomeActive)
          || requestedTab === 'resources'
          || requestedTab === 'territory',
      });
      this.mapHomeActive = view.isMapHome;
      if (this.lastGame && 'mapHomeActive' in this.lastGame) this.lastGame.mapHomeActive = view.isMapHome;
      if (this.lastGame?.state && view.isMapHome) {
        this.lastGame.state.currentTab = view.activeTab;
        this.lastGame.state.militaryView = view.militaryView;
      }
      return view.activeTab;
    },

resolveMapHomeViewState(state = this.lastGame?.state || {}, options = {}) {
      if (this.presenter?.resolveMapHomeViewState) {
        return this.presenter.resolveMapHomeViewState(state || {}, options);
      }
      if (this.lastGame?.resolveMapHomeViewState) {
        return this.lastGame.resolveMapHomeViewState(state || {}, options);
      }
      const requestedTab = options.requestedTab || options.activeTab || state?.currentTab || 'resources';
      const hasTiles = Array.isArray(state?.territoryState?.worldMap?.tiles) && state.territoryState.worldMap.tiles.length > 0;
      const canUseMapHome = true;
      const requestedMilitaryView = options.militaryView || state?.militaryView || 'army';
      const militaryMapRequested = requestedTab === 'military'
        && (options.forceMapHome || options.isMapHome || requestedMilitaryView === 'world');
      const shouldUseMapHome = canUseMapHome
        && options.allowDefaultMapHome !== false
        && (options.forceMapHome || requestedTab === 'resources' || requestedTab === 'territory' || militaryMapRequested);
      return {
        activeTab: shouldUseMapHome ? 'military' : (requestedTab === 'territory' ? 'military' : requestedTab),
        requestedTab,
        militaryView: shouldUseMapHome ? 'world' : requestedMilitaryView,
        isMapHome: Boolean(shouldUseMapHome),
        canUseMapHome,
      };
    },

getTechTreePan() {
      return {
        x: Number(this.techTreePanX) || 0,
        y: Number(this.techTreePanY) || 0,
      };
    },

setTechTreePan(pan = {}) {
      const x = Number(pan.x) || 0;
      const y = Number(pan.y) || 0;
      this.techTreePanX = x;
      this.techTreePanY = y;
      if (this.lastGame && typeof this.lastGame === 'object') {
        this.lastGame.techTreePanX = x;
        this.lastGame.techTreePanY = y;
      }
      return true;
    },

getTechTreeZoom() {
      return Math.max(0.65, Math.min(1.6, Number(this.techTreeZoom) || 1));
    },

setTechTreeZoom(zoom = 1) {
      const nextZoom = Math.max(0.65, Math.min(1.6, Number(zoom) || 1));
      this.techTreeZoom = nextZoom;
      if (this.lastGame && typeof this.lastGame === 'object') this.lastGame.techTreeZoom = nextZoom;
      return true;
    },

buildRenderOptions(activeTab = 'resources', territoryUiState = null, options = {}) {
      const state = this.lastGame?.state || {};
      const defaultForceMapHome = (activeTab === 'military' && Boolean(this.mapHomeActive || this.lastGame?.mapHomeActive))
        || activeTab === 'resources'
        || activeTab === 'territory';
      const hasForceOverride = Object.prototype.hasOwnProperty.call(options, 'forceMapHome');
      const homeView = this.resolveMapHomeViewState(state, {
        requestedTab: activeTab,
        militaryView: state.militaryView || this.lastGame?.militaryView,
        forceMapHome: hasForceOverride ? options.forceMapHome : defaultForceMapHome,
        allowDefaultMapHome: options.allowDefaultMapHome,
      });
      this.mapHomeActive = homeView.isMapHome;
      const resolvedTerritoryUiState = territoryUiState || this.lastGame?.territoryController?.getUiState?.() || this.territoryUiState || {};
      return {
        now: this.now(),
        epochNowMs: Date.now(),
        activeTab: homeView.activeTab,
        mode: 'hud',
        isMapHome: homeView.isMapHome,
        showSettings: this.showSettings,
        showLogs: this.showLogs,
        showResourceDetails: this.showResourceDetails,
        showCitySwitcher: this.showCitySwitcher,
        showSubcityList: this.showSubcityList,
        showCityManagement: this.showCityManagement,
        activeCityManagementTab: this.activeCityManagementTab,
        showAdvisor: this.showAdvisor,
        showTaskCenter: this.showTaskCenter,
        activeTaskCenterTab: this.activeTaskCenterTab,
        showGuidebook: this.showGuidebook,
        activeGuidebookTab: this.activeGuidebookTab,
        showFamousPersons: this.showFamousPersons,
        famousPersonsPage: this.famousPersonsPage,
        selectedFamousPersonId: this.selectedFamousPersonId,
        showTalentPolicy: this.showTalentPolicy,
        talentPolicyUiState: this.lastGame?.talentPolicyUiState || this.talentPolicyUiState || {},
        armyFormationEditor: this.armyFormationEditor,
        activeCommandPanel: this.activeCommandPanel || '',
        logs: this.lastGame?.requestLogs || [],
        tutorial: this.lastGame?.tutorialController?.state || this.lastGame?.tutorial || {},
        buildingOffset: this.buildingOffset,
        techTreePanX: this.techTreePanX,
        techTreePanY: this.techTreePanY,
        techTreeZoom: this.getTechTreeZoom(),
        ...(this.selectedTechId ? { selectedTechId: this.selectedTechId } : {}),
        techDetailOpen: this.techDetailOpen || Boolean(state.techUiState?.detailOpen),
        activeBuildingCategory: this.activeBuildingCategory,
        pendingBuildingAction: this.pendingBuildingAction || this.lastGame?.pendingBuildingAction || null,
        ...(this.pageTransition ? { pageTransition: this.pageTransition } : {}),
        ...(this.buildingTransition ? { buildingTransition: this.buildingTransition } : {}),
        activeEventId: this.activeEventId,
        territoryUiState: resolvedTerritoryUiState,
        ...((this.lastGame?.battleScene || this.battleScene) ? { battleScene: this.lastGame?.battleScene || this.battleScene } : {}),
        tabLocks: this.getTabLocks(state),
        naming: this.naming,
        auth: this.auth,
        loading: this.loading,
        network: this.networkState,
        floatingTexts: this.getFloatingTextView(),
        tutorialIntro: this.lastGame?.tutorialIntro || this.tutorialIntro || null,
        tutorialAdvisorDialogue: this.lastGame?.tutorialAdvisorDialogue || this.tutorialAdvisorDialogue || null,
        tutorialHighlight: this.tutorialHighlight,
        rewardReveal: this.rewardReveal,
      };
    },

renderActive(options = {}) {
      if (this.isWorldMapDragging()) {
        this.deferRenderUntilWorldMapDragEnd = true;
        return true;
      }
      if (this.hasPendingWorldMapCompositeCommit()) {
        this.deferRenderUntilWorldMapDragEnd = true;
        return true;
      }
      if (options.invalidateWorldTileView) {
        this.renderer?.invalidateWorldTileViewCache?.();
        this.worldMapRenderer?.invalidateWorldTileViewCache?.();
      }
      const guideActiveTab = this.tutorialHighlight?.renderActiveTab;
      if (guideActiveTab) {
        return this.renderReadOnly(
          this.lastGame?.state,
          guideActiveTab,
          this.tutorialHighlight?.renderOptions || {},
        );
      }
      return this.renderReadOnly(this.lastGame?.state, this.getActiveTab());
    },

renderReadOnly(state, activeTab = 'resources', options = {}) {
      if (!this.previewEnabled || !this.renderer || !state) return false;
      this.syncWorldMapRendererLayerMetrics();
      const territoryUiState = this.lastGame?.territoryController?.getUiState?.() || this.territoryUiState || {};
      const defaultForceMapHome = (activeTab === 'military' && Boolean(this.mapHomeActive || this.lastGame?.mapHomeActive))
        || activeTab === 'resources'
        || activeTab === 'territory';
      const hasForceOverride = Object.prototype.hasOwnProperty.call(options, 'forceMapHome');
      const homeView = this.resolveMapHomeViewState(state, {
        requestedTab: activeTab,
        militaryView: state.militaryView || this.lastGame?.militaryView,
        forceMapHome: hasForceOverride ? options.forceMapHome : defaultForceMapHome,
        allowDefaultMapHome: options.allowDefaultMapHome,
      });
      this.mapHomeActive = homeView.isMapHome;
      if (state.currentTab !== homeView.activeTab) state.currentTab = homeView.activeTab;
      const resolvedMilitaryView = homeView.activeTab === 'military' ? homeView.militaryView : 'army';
      if (resolvedMilitaryView && state.militaryView !== resolvedMilitaryView) state.militaryView = resolvedMilitaryView;
      const renderOptions = {
        ...this.buildRenderOptions(homeView.activeTab, territoryUiState, {
          forceMapHome: homeView.isMapHome,
          allowDefaultMapHome: options.allowDefaultMapHome,
        }),
        activeTab: homeView.activeTab,
        isMapHome: homeView.isMapHome,
      };
      let worldMapLayerRendered = false;
      if (homeView.isMapHome && this.ensureWorldMapRuntimeCoordinator()?.canRender(state)) {
        worldMapLayerRendered = this.shouldRenderRuntimeWorldMap(state, renderOptions)
          ? this.renderRuntimeWorldMap(state, renderOptions) !== false
          : Boolean(this.worldMapRuntime?.hasBakedMapLayer);
      } else {
        worldMapLayerRendered = this.renderWorldMapLayer(state, renderOptions) !== false;
      }
      this.setWorldMapLayerVisible(worldMapLayerRendered);
      this.renderer.render(state, this.worldMapRenderer && worldMapLayerRendered
        ? {
          ...renderOptions,
          skipWorldMapLayer: true,
          worldMapRuntimeHitTargets: Array.isArray(this.worldMapRuntime?.hitTargets)
            ? this.worldMapRuntime.hitTargets
            : [],
        }
        : {
          ...renderOptions,
          mode: undefined,
          skipWorldMapLayer: false,
          preserveCanvas: false,
        });
      const waterAnimated = Boolean(territoryUiState.tileMapWaterAnimated
        || this.lastGame?.territoryController?.uiState?.tileMapWaterAnimated
        || this.territoryUiState?.tileMapWaterAnimated);
      const explorerAnimated = Boolean(state.worldExplorerState?.activeMission);
      if (homeView.activeTab === 'military' && (waterAnimated || explorerAnimated)) this.startTileMapWaterTimer();
      else this.stopTileMapWaterTimer();
      return true;
    },

getTabLocks(state = {}) {
      const tabIds = ['resources', 'buildings', 'tech', 'events', 'civilization', 'military'];
      const canOpenTab = this.lastGame?.tutorialController?.canOpenTab;
      if (typeof canOpenTab !== 'function') {
        return tabIds.map((id) => ({ id, disabled: false, isLocked: false }));
      }
      return tabIds.map((id) => {
        const allowed = Boolean(canOpenTab.call(this.lastGame.tutorialController, id));
        return {
          id,
          disabled: !allowed,
          isLocked: !allowed,
        };
      });
    }
    });
    return true;
  }

  const api = { install };

  global.CanvasGameShellRenderingRuntime = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
