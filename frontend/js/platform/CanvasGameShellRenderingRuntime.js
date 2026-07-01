(function (global) {
  var WorldMarchSystem = global.WorldMarchSystem;
  if (typeof module !== 'undefined' && module.exports && !WorldMarchSystem) {
    try {
      WorldMarchSystem = require('../ecs/system/WorldMarchSystem');
    } catch (_error) {
      WorldMarchSystem = null;
    }
  }
  var StateWriter = global.StateWriter;
  if (typeof module !== 'undefined' && module.exports && !StateWriter) {
    StateWriter = require('../state/StateWriter');
  }
  var WorldMapRuntimeRenderPolicy = global.WorldMapRuntimeRenderPolicy;
  if (typeof module !== 'undefined' && module.exports && !WorldMapRuntimeRenderPolicy) {
    try {
      WorldMapRuntimeRenderPolicy = require('./WorldMapRuntimeRenderPolicy');
    } catch (_error) {
      WorldMapRuntimeRenderPolicy = null;
    }
  }
  var ActorPickingDiagnostics = global.ActorPickingDiagnostics;
  if (typeof module !== 'undefined' && module.exports && !ActorPickingDiagnostics) {
    try {
      ActorPickingDiagnostics = require('../debug/ActorPickingDiagnostics');
    } catch (_error) {
      ActorPickingDiagnostics = null;
    }
  }
  var SharedWorldClock = global.WorldClock;
  if (typeof module !== 'undefined' && module.exports && !SharedWorldClock) {
    try {
      SharedWorldClock = require('../ecs/foundation/WorldClock');
    } catch (_error) {
      SharedWorldClock = null;
    }
  }
  var TerritoryUiStateStore = global.TerritoryUiStateStore;
  if (typeof module !== 'undefined' && module.exports && !TerritoryUiStateStore) {
    TerritoryUiStateStore = require('../state/TerritoryUiStateStore');
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

  function summarizeActorPickingUiState(uiState = {}) {
    return {
      present: Boolean(uiState && typeof uiState === 'object'),
      selectedWorldActorId: uiState?.selectedWorldActorId || '',
      selectedWorldMissionId: uiState?.selectedWorldMissionId || '',
      selectedSiteId: uiState?.selectedSiteId || '',
      hasWorldMarchTarget: Boolean(uiState?.worldMarchTarget),
      worldMarchTargetTileId: uiState?.worldMarchTarget?.tileId || '',
      worldMarchTargetPickerOpen: Boolean(uiState?.worldMarchTarget?.pickerOpen),
      hasWorldTargetPicker: Boolean(uiState?.worldTargetPicker),
      worldTargetPickerCandidates: Array.isArray(uiState?.worldTargetPicker?.candidates)
        ? uiState.worldTargetPicker.candidates.length
        : 0,
    };
  }

  function logActorPickingDiag(stage = '', detail = {}, options = {}) {
    return ActorPickingDiagnostics?.log?.(stage, detail, options) || null;
  }

  function getMountedGame(shell) {
    return shell?.lastGame && shell.lastGame !== shell ? shell.lastGame : null;
  }

  function getUiStateOwner(shell) {
    return getMountedGame(shell) || shell;
  }

  function install(CanvasGameShell) {
    if (!CanvasGameShell?.prototype) return false;
    Object.assign(CanvasGameShell.prototype, {
now() {
      return this.runtime?.now?.() || Date.now();
    },

getWorldEpochNowMs() {
      const clock = this.worldClock || this.runtime?.worldClock || this.lastGame?.worldClock || global.__WorldClockShared;
      return SharedWorldClock?.getEpochNowMs?.({ worldClock: clock }, Date.now()) ?? Date.now();
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
      const raf = this.runtime?.requestAnimationFrame || this.scheduler?.requestAnimationFrame;
      const owner = this.runtime?.requestAnimationFrame ? this.runtime : this.scheduler;
      return typeof raf === 'function' ? raf.bind(owner) : null;
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

requestOverlayRenderFrame() {
      return this.requestRenderAnimationFrame({ type: 'overlayRenderFrame' });
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
        fromBuildingOffset: options.fromBuildingOffset ?? getUiStateOwner(this).buildingOffset,
      };
      this.startTransitionTimer();
      this.renderActive();
      return true;
    },

scrollBuildings(action = {}) {
      const owner = getUiStateOwner(this);
      const fromOffset = Math.max(0, Number(owner.buildingOffset) || 0);
      const delta = Number(action.delta) || 0;
      const toOffset = Math.max(0, fromOffset + delta);
      owner.buildingOffset = toOffset;
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
      if (owner !== this) owner.buildingTransition = this.buildingTransition;
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
        StateWriter.commit(this, (prev) => ({
          ...prev,
          currentTab: view.activeTab,
          militaryView: view.militaryView,
        }), { source: 'shellRendering:getActiveTab' });
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
      const owner = getUiStateOwner(this);
      return {
        x: Number(owner.techTreePanX) || 0,
        y: Number(owner.techTreePanY) || 0,
      };
    },

setTechTreePan(pan = {}) {
      const owner = getUiStateOwner(this);
      const x = Number(pan.x) || 0;
      const y = Number(pan.y) || 0;
      owner.techTreePanX = x;
      owner.techTreePanY = y;
      return true;
    },

getTechTreeZoom() {
      return Math.max(0.65, Math.min(1.6, Number(getUiStateOwner(this).techTreeZoom) || 1));
    },

setTechTreeZoom(zoom = 1) {
      const owner = getUiStateOwner(this);
      const nextZoom = Math.max(0.65, Math.min(1.6, Number(zoom) || 1));
      owner.techTreeZoom = nextZoom;
      return true;
    },

resolveTerritoryUiState(overrideUiState = null) {
      const ownerUiState = TerritoryUiStateStore?.ensure?.(this) || {};
      const resolved = TerritoryUiStateStore?.resolve?.(this, overrideUiState) || ownerUiState;
      logActorPickingDiag('shell:resolveTerritoryUiState', {
        sources: {
          ownerTerritoryUiState: summarizeActorPickingUiState(ownerUiState),
          overrideUiState: summarizeActorPickingUiState(overrideUiState),
        },
        resolved: summarizeActorPickingUiState(resolved),
        ownerAlias: {
          shellMatchesOwner: this.territoryUiState === ownerUiState,
          controllerMatchesOwner: this.lastGame?.territoryController?.uiState === ownerUiState,
        },
      }, {
        signature: [
          ownerUiState?.selectedWorldActorId || '',
          ownerUiState?.selectedWorldMissionId || '',
          overrideUiState?.selectedWorldActorId || '',
          overrideUiState?.selectedWorldMissionId || '',
          resolved.selectedWorldActorId || '',
          resolved.selectedWorldMissionId || '',
        ].join('|'),
      });
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
      const rendererSnapshot = typeof this.buildRendererSnapshot === 'function'
        ? this.buildRendererSnapshot()
        : null;
      const panel = this.getRendererSnapshot?.()?.panel || {};
      const battleSnapshot = rendererSnapshot?.battle || {};
      const snapshotBattleScene = battleSnapshot.battleScene || null;
      const snapshotEntityBattle = battleSnapshot.entityBattle || null;
      const snapshotNaming = this.getNamingSnapshot?.(rendererSnapshot) || null;
      const snapshotConfirmDialog = this.getConfirmDialogSnapshot?.(rendererSnapshot) || null;
      const snapshotRewardReveal = this.getRewardRevealSnapshot?.(rendererSnapshot) || null;
      const snapshotEvent = this.getEventSnapshot?.(rendererSnapshot) || null;
      const snapshotTargetPicker = this.getTargetPickerSnapshot?.(rendererSnapshot) || null;
      const uiOwner = getUiStateOwner(this);
      logActorPickingDiag('shell:buildRenderOptions:territoryUiState', {
        activeTab,
        input: summarizeActorPickingUiState(territoryUiState),
        resolved: summarizeActorPickingUiState(resolvedTerritoryUiState),
      }, {
        signature: [
          activeTab,
          territoryUiState?.selectedWorldActorId || '',
          resolvedTerritoryUiState?.selectedWorldActorId || '',
          Boolean(resolvedTerritoryUiState?.worldMarchTarget),
          Boolean(snapshotTargetPicker),
          snapshotTargetPicker?.pickerKind || '',
        ].join('|'),
      });
      return {
        now: this.now(),
        epochNowMs: this.getWorldEpochNowMs?.() ?? Date.now(),
        activeTab: homeView.activeTab,
        mode: 'hud',
        isMapHome: homeView.isMapHome,
        showSettings: panel.showSettings,
        showLogs: panel.showLogs,
        showResourceDetails: panel.showResourceDetails,
        showCitySwitcher: panel.showCitySwitcher,
        showSubcityList: panel.showSubcityList,
        showCityManagement: panel.showCityManagement,
        activeCityManagementTab: uiOwner.activeCityManagementTab,
        showAdvisor: panel.showAdvisor,
        showTaskCenter: panel.showTaskCenter,
        activeTaskCenterTab: this.activeTaskCenterTab,
        showGuidebook: panel.showGuidebook,
        activeGuidebookTab: this.activeGuidebookTab,
        showFamousPersons: panel.showFamousPersons,
        famousPersonsPage: uiOwner.famousPersonsPage,
        selectedFamousPersonId: uiOwner.selectedFamousPersonId,
        armyFormationEditor: this.armyFormationEditor,
        worldMapRuntimeContext: this.worldMapRuntime?.getLastTileMapContext?.()
          || this.worldMapRuntime?.lastTileMapContext
          || this.worldMapRenderer?.lastWorldTileMapContext
          || null,
        activeCommandPanel: panel.activeCommandPanel || '',
        logs: this.lastGame?.requestLogs || [],
        tutorial: this.lastGame?.tutorialController?.state || this.lastGame?.tutorial || {},
        buildingOffset: uiOwner.buildingOffset,
        techTreePanX: uiOwner.techTreePanX,
        techTreePanY: uiOwner.techTreePanY,
        techTreeZoom: this.getTechTreeZoom(),
        ...(state.techUiState?.selectedTechId || uiOwner.selectedTechId
          ? { selectedTechId: state.techUiState?.selectedTechId || uiOwner.selectedTechId }
          : {}),
        techDetailOpen: panel.techDetailOpen || Boolean(state.techUiState?.detailOpen),
        activeBuildingCategory: uiOwner.activeBuildingCategory,
        pendingBuildingAction: uiOwner.pendingBuildingAction || null,
        ...(this.pageTransition ? { pageTransition: this.pageTransition } : {}),
        ...(this.buildingTransition ? { buildingTransition: this.buildingTransition } : {}),
        activeEventId: snapshotEvent?.eventId ?? null,
        territoryUiState: resolvedTerritoryUiState,
        targetPicker: snapshotTargetPicker,
        ...(snapshotBattleScene ? { battleScene: snapshotBattleScene } : {}),
        ...((this.lastGame?.entityBattle || this.entityBattle) ? { entityBattle: this.lastGame?.entityBattle || this.entityBattle } : (snapshotEntityBattle ? { entityBattle: snapshotEntityBattle } : {})),
        tabLocks: this.getTabLocks(state),
        naming: snapshotNaming,
        auth: this.auth,
        loading: this.loading,
        network: this.networkState,
        confirmDialog: snapshotConfirmDialog,
        floatingTexts: this.getFloatingTextView(),
        tutorialIntro: this.lastGame?.tutorialIntro || this.tutorialIntro || null,
        tutorialAdvisorDialogue: this.lastGame?.tutorialAdvisorDialogue || this.tutorialAdvisorDialogue || null,
        tutorialHighlight: this.tutorialHighlight,
        rewardReveal: snapshotRewardReveal,
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
      logActorPickingDiag('shell:renderReadOnly:territoryUiState', {
        activeTab,
        optionsTerritoryUiState: summarizeActorPickingUiState(options.territoryUiState),
        resolved: summarizeActorPickingUiState(territoryUiState),
      }, {
        signature: [
          activeTab,
          options.territoryUiState?.selectedWorldActorId || '',
          territoryUiState?.selectedWorldActorId || '',
          Boolean(territoryUiState?.worldMarchTarget),
          this.isTargetPickerSnapshotOpen?.() ? '1' : '',
        ].join('|'),
      });
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
      const resolvedMilitaryView = homeView.activeTab === 'military' ? homeView.militaryView : 'army';
      // Honor the name: renderReadOnly must NOT mutate the state object it is handed.
      // The active tab/military view it derives are owned facts, so route the update
      // through StateWriter (the single write point), then re-point the local `state`
      // to the canonical owner's fresh object for the rest of the read-only render.
      const needsTabUpdate = state.currentTab !== homeView.activeTab;
      const needsMilitaryUpdate = Boolean(resolvedMilitaryView) && state.militaryView !== resolvedMilitaryView;
      if ((needsTabUpdate || needsMilitaryUpdate) && StateWriter.getStateHost(this)?.state === state) {
        state = StateWriter.commit(this, (prev) => ({
          ...prev,
          ...(needsTabUpdate ? { currentTab: homeView.activeTab } : {}),
          ...(needsMilitaryUpdate ? { militaryView: resolvedMilitaryView } : {}),
        }), { source: 'shellRendering:renderReadOnly' });
      } else if (needsTabUpdate || needsMilitaryUpdate) {
        // Fallback: the handed state is not the owner's slot (e.g. a detached snapshot).
        // Derive a fresh object instead of mutating the caller's input.
        state = {
          ...state,
          ...(needsTabUpdate ? { currentTab: homeView.activeTab } : {}),
          ...(needsMilitaryUpdate ? { militaryView: resolvedMilitaryView } : {}),
        };
      }
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
      let worldMapLayerVisible = false;
      if (homeView.isMapHome && this.ensureWorldMapRuntimeCoordinator()?.canRender(state)) {
         const hasValidWorldMapLayer = this.hasValidBakedWorldMapLayer?.() !== false;
         worldMapLayerRendered = (this.shouldRenderRuntimeWorldMap(state, renderOptions) || !hasValidWorldMapLayer)
           ? this.renderRuntimeWorldMap(state, {
             ...renderOptions,
             force: renderOptions.force || !hasValidWorldMapLayer,
           }) !== false
           : hasValidWorldMapLayer;
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
         worldMapLayerVisible = Boolean(worldMapLayerRendered || worldMapFrameState?.visualLayerValid);
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
         worldMapLayerVisible = Boolean(worldMapLayerRendered);
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
      this.setWorldMapLayerVisible(worldMapLayerVisible);
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
        this.updateWorldActorAnimationLoop?.({ ...renderOptions, state });
        if (homeView.activeTab === 'military' && (waterAnimated || (explorerAnimated && !this.worldActorLayerRenderer))) this.startTileMapWaterTimer();
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
