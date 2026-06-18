(function (global) {
  var WorldMarchSystem = global.WorldMarchSystem;
  if (typeof module !== 'undefined' && module.exports && !WorldMarchSystem) {
    try {
      WorldMarchSystem = require('../domain/WorldMarchSystem');
    } catch (error) {
      WorldMarchSystem = null;
    }
  }
  var WorldMapRuntimeRenderPolicy = global.WorldMapRuntimeRenderPolicy;
  if (typeof module !== 'undefined' && module.exports && !WorldMapRuntimeRenderPolicy) {
    try {
      WorldMapRuntimeRenderPolicy = require('./WorldMapRuntimeRenderPolicy');
    } catch (error) {
      WorldMapRuntimeRenderPolicy = null;
    }
  }

  function hasActiveWorldExplorerMission(state = {}, options = {}) {
    const explorer = state?.worldExplorerState || {};
    if (WorldMarchSystem?.hasActiveMission) {
      return WorldMarchSystem.hasActiveMission(explorer, options);
    }
    const missions = [
      explorer.activeMission,
      ...(Array.isArray(explorer.missions) ? explorer.missions : []),
      ...(Array.isArray(explorer.idleMissions) ? explorer.idleMissions : []),
    ].filter(Boolean);
    return missions.some((mission) => mission.status === 'active');
  }

  function install(CanvasGameShell) {
    if (!CanvasGameShell?.prototype) return false;
    Object.assign(CanvasGameShell.prototype, {
now() {
      return this.runtime?.now?.() || Date.now();
    },

getWorldEpochNowMs() {
      const clock = this.worldClock || this.runtime?.worldClock || this.lastGame?.worldClock || global.__WorldClockShared;
      return clock?.getEpochNowMs?.(Date.now()) ?? Date.now();
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

render() {
      return this.renderActive();
    },

renderCanvasSurface(activeTab = null, options = {}) {
      const state = this.lastGame?.state || null;
      if (!state) return false;
      return this.renderReadOnly(state, activeTab || state.currentTab || this.getActiveTab(), options);
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

resolveTerritoryUiState(overrideUiState = null) {
      const territoryController = this.lastGame?.territoryController || null;
      const controllerSnapshot = territoryController?.getUiState?.() || null;
      const sources = [
        controllerSnapshot,
        this.lastGame?.territoryUiState,
        this.territoryUiState,
        territoryController?.uiState,
        overrideUiState,
      ].filter((source) => source && typeof source === 'object');
      const resolved = Object.assign({}, ...sources);
      const liveSelectedActorSource = [
        this.lastGame?.territoryUiState,
        this.territoryUiState,
        territoryController?.uiState,
      ].find((source) => source?.selectedWorldActorId);
      if (liveSelectedActorSource?.selectedWorldActorId) {
        resolved.selectedWorldActorId = liveSelectedActorSource.selectedWorldActorId;
      }
      return resolved;
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
      const resolvedTerritoryUiState = this.resolveTerritoryUiState(territoryUiState);
      return {
        now: this.now(),
        epochNowMs: this.getWorldEpochNowMs?.() ?? Date.now(),
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
        armyFormationEditor: this.armyFormationEditor,
        worldMapRuntimeContext: this.worldMapRuntime?.getLastTileMapContext?.()
          || this.worldMapRuntime?.lastTileMapContext
          || this.worldMapRenderer?.lastWorldTileMapContext
          || null,
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
        confirmDialog: this.confirmDialog,
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
      const inputSummary = global.CodexWorldMapDiag?.summarizeState?.(state) || null;
      global.CodexWorldMapDiag?.logChanged?.('shell:renderReadOnly:input', {
        activeTab,
        optionsForceMapHome: options.forceMapHome,
        optionsAllowDefaultMapHome: options.allowDefaultMapHome,
        optionsIsMapHome: options.isMapHome,
        shellMapHomeActive: Boolean(this.mapHomeActive),
        tileCount: inputSummary?.worldMap?.tileCount || 0,
        mapVersion: inputSummary?.worldMap?.version || 0,
        currentTab: inputSummary?.currentTab || '',
        militaryView: inputSummary?.militaryView || '',
        tutorialStep: inputSummary?.tutorial?.currentStep ?? null,
      }, {
        activeTab,
        options: {
          forceMapHome: options.forceMapHome,
          allowDefaultMapHome: options.allowDefaultMapHome,
          isMapHome: options.isMapHome,
        },
        state: inputSummary,
        shellMapHomeActive: Boolean(this.mapHomeActive),
      });
      const territoryUiState = this.resolveTerritoryUiState(options.territoryUiState);
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
         epochNowMs: this.getWorldEpochNowMs?.() ?? Date.now(),
         activeTab: homeView.activeTab,
         isMapHome: homeView.isMapHome,
       };
       let worldMapLayerRendered = false;
       let worldMapFrameState = null;
      if (homeView.isMapHome && this.ensureWorldMapRuntimeCoordinator()?.canRender(state)) {
         const explorerAnimated = hasActiveWorldExplorerMission(state, renderOptions);
         worldMapLayerRendered = (explorerAnimated || this.shouldRenderRuntimeWorldMap(state, renderOptions))
           ? this.renderRuntimeWorldMap(state, {
             ...renderOptions,
             force: explorerAnimated || renderOptions.force,
           }) !== false
           : this.hasValidBakedWorldMapLayer?.() !== false;
         const bakedLayerValidity = typeof this.getWorldMapBakedLayerValidity === 'function'
           ? this.getWorldMapBakedLayerValidity()
           : null;
         worldMapFrameState = this.worldMapRuntime?.getWorldMapFrameState?.({ bakedLayerValidity, rendered: worldMapLayerRendered })
           || WorldMapRuntimeRenderPolicy?.createWorldMapFrameState?.(this.worldMapRuntime || {}, {
             bakedLayerValidity,
             rendered: worldMapLayerRendered,
           })
           || null;
         worldMapLayerRendered = WorldMapRuntimeRenderPolicy?.canSkipWorldMapLayer
           ? WorldMapRuntimeRenderPolicy.canSkipWorldMapLayer(worldMapFrameState)
           : Boolean(worldMapLayerRendered);
         const runtimeRenderResult = global.CodexWorldMapDiag?.summarizeRenderResult?.(
           this.lastWorldMapLayerRenderResult || this.worldMapRenderer?.lastWorldMapLayerRenderResult || null,
         );
         global.CodexWorldMapDiag?.logChanged?.('shell:runtimeMap:frameState', {
           rendered: worldMapLayerRendered,
           visualLayerValid: worldMapFrameState?.visualLayerValid,
           visualLayerReason: worldMapFrameState?.visualLayerReason || '',
           hitTargetsPreserved: worldMapFrameState?.hitTargetsPreserved,
           resultReason: runtimeRenderResult?.reason || '',
           resultPreserved: Boolean(runtimeRenderResult?.preserved),
         }, {
           homeView,
           worldMapLayerRendered,
           frameState: worldMapFrameState,
           renderResult: runtimeRenderResult,
         });
       } else {
         worldMapLayerRendered = this.renderWorldMapLayer(state, renderOptions) !== false;
         const directRenderResult = global.CodexWorldMapDiag?.summarizeRenderResult?.(
           this.lastWorldMapLayerRenderResult || this.worldMapRenderer?.lastWorldMapLayerRenderResult || null,
         );
         global.CodexWorldMapDiag?.logChanged?.('shell:directMap:renderResult', {
           rendered: worldMapLayerRendered,
           resultReason: directRenderResult?.reason || '',
           resultPreserved: Boolean(directRenderResult?.preserved),
           isMapHome: Boolean(homeView.isMapHome),
           activeTab: homeView.activeTab || '',
           requestedTab: homeView.requestedTab || '',
         }, {
           homeView,
           worldMapLayerRendered,
           renderResult: directRenderResult,
         });
      }
      this.setWorldMapLayerVisible(worldMapLayerRendered);
      const refreshedTutorialHighlight = typeof this.refreshTutorialHighlightTarget === 'function'
        ? this.refreshTutorialHighlightTarget(this.tutorialHighlight)
        : this.tutorialHighlight;
      this.tutorialHighlight = refreshedTutorialHighlight || null;
      const liveWorldMapRuntimeContext = this.worldMapRuntime?.getLastTileMapContext?.()
        || this.worldMapRuntime?.lastTileMapContext
        || this.worldMapRenderer?.lastWorldTileMapContext
        || null;
      const liveWorldMapAnchorSource = this.worldMapRenderer || null;
      const runtimeCompositionOptions = WorldMapRuntimeRenderPolicy?.createWorldMapCompositionOptions
        ? WorldMapRuntimeRenderPolicy.createWorldMapCompositionOptions({
          ...renderOptions,
          tutorialHighlight: this.tutorialHighlight,
          worldMapRenderer: liveWorldMapAnchorSource,
          worldMapAnchorSource: liveWorldMapAnchorSource,
          worldMapRuntimeContext: liveWorldMapRuntimeContext,
        }, worldMapFrameState || {})
        : {
          ...renderOptions,
          tutorialHighlight: this.tutorialHighlight,
          worldMapRenderer: liveWorldMapAnchorSource,
          worldMapAnchorSource: liveWorldMapAnchorSource,
          skipWorldMapLayer: true,
          worldMapRuntimeHitTargets: Array.isArray(this.worldMapRuntime?.hitTargets)
            ? this.worldMapRuntime.hitTargets
            : [],
          worldMapRuntimeContext: liveWorldMapRuntimeContext,
        };
      const composeSummary = {
        worldMapLayerRendered,
        hasRuntimeContext: Boolean(liveWorldMapRuntimeContext),
        runtimeContextTiles: Array.isArray(liveWorldMapRuntimeContext?.tileMapView?.tiles)
          ? liveWorldMapRuntimeContext.tileMapView.tiles.length
          : null,
        skipWorldMapLayer: runtimeCompositionOptions.skipWorldMapLayer,
        preserveCanvas: runtimeCompositionOptions.preserveCanvas,
        visualLayerValid: runtimeCompositionOptions.worldMapFrameState?.visualLayerValid,
        visualLayerReason: runtimeCompositionOptions.worldMapFrameState?.visualLayerReason || '',
        hitTargetsPreserved: runtimeCompositionOptions.worldMapFrameState?.hitTargetsPreserved,
      };
      global.CodexWorldMapDiag?.logChanged?.('shell:renderReadOnly:compose', composeSummary, {
        worldMapLayerRendered,
        hasRuntimeContext: Boolean(liveWorldMapRuntimeContext),
        runtimeContextTiles: Array.isArray(liveWorldMapRuntimeContext?.tileMapView?.tiles)
          ? liveWorldMapRuntimeContext.tileMapView.tiles.length
          : null,
        composition: {
          skipWorldMapLayer: runtimeCompositionOptions.skipWorldMapLayer,
          preserveCanvas: runtimeCompositionOptions.preserveCanvas,
          visualLayerValid: runtimeCompositionOptions.worldMapFrameState?.visualLayerValid,
          visualLayerReason: runtimeCompositionOptions.worldMapFrameState?.visualLayerReason,
          hitTargetsPreserved: runtimeCompositionOptions.worldMapFrameState?.hitTargetsPreserved,
        },
      });
      this.renderer.render(state, this.worldMapRenderer && worldMapLayerRendered
        ? runtimeCompositionOptions
        : {
          ...renderOptions,
          tutorialHighlight: this.tutorialHighlight,
          worldMapRenderer: liveWorldMapAnchorSource,
          worldMapAnchorSource: liveWorldMapAnchorSource,
          worldMapRuntimeContext: liveWorldMapRuntimeContext,
          mode: undefined,
          skipWorldMapLayer: false,
          preserveCanvas: false,
        });
       const waterAnimated = Boolean(territoryUiState.tileMapWaterAnimated
         || this.lastGame?.territoryController?.uiState?.tileMapWaterAnimated
         || this.territoryUiState?.tileMapWaterAnimated);
       const explorerAnimated = hasActiveWorldExplorerMission(state, renderOptions);
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
