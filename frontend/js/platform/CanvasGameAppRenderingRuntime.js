(function (global) {
  var CanvasGameAppWorldMapRuntime = global.CanvasGameAppWorldMapRuntime;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameAppWorldMapRuntime) {
    CanvasGameAppWorldMapRuntime = require('./CanvasGameAppWorldMapRuntime');
  }
  var CanvasGameAppRenderPolicy = global.CanvasGameAppRenderPolicy;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameAppRenderPolicy) {
    CanvasGameAppRenderPolicy = require('./CanvasGameAppRenderPolicy');
  }
  var CanvasGameAppRenderScheduler = global.CanvasGameAppRenderScheduler;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameAppRenderScheduler) {
    CanvasGameAppRenderScheduler = require('./CanvasGameAppRenderScheduler');
  }
  var WorldMapRuntimeRenderPolicy = global.WorldMapRuntimeRenderPolicy;
  if (typeof module !== 'undefined' && module.exports && !WorldMapRuntimeRenderPolicy) {
    WorldMapRuntimeRenderPolicy = require('./WorldMapRuntimeRenderPolicy');
  }
  var WorldMarchSystem = global.WorldMarchSystem;
  if (typeof module !== 'undefined' && module.exports && !WorldMarchSystem) {
    WorldMarchSystem = require('../ecs/system/WorldMarchSystem');
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
  const { closeBlockingPanelSnapshot } = global.CanvasBlockingPanelSnapshotCalls || (typeof require !== 'undefined' ? require('./CanvasBlockingPanelSnapshotCalls') : {});
  var StateWriter = global.StateWriter;
  if (typeof module !== 'undefined' && module.exports && !StateWriter) {
    StateWriter = require('../state/StateWriter');
  }
  function hasActiveWorldExplorerMission(state = {}, options = {}) {
    if (WorldMarchSystem?.hasActiveMission) {
      return WorldMarchSystem.hasActiveMission(state?.worldExplorerState || {}, options);
    }
    const explorer = state?.worldExplorerState || {};
    const missions = [
      explorer.activeMission,
      ...(Array.isArray(explorer.missions) ? explorer.missions : []),
      ...(Array.isArray(explorer.idleMissions) ? explorer.idleMissions : []),
    ].filter(Boolean);
    return missions.some((mission) => mission.status === 'active');
  }
  function install(CanvasGameApp) {
    if (!CanvasGameApp?.prototype) return false;
    Object.assign(CanvasGameApp.prototype, {
      render() {
            this.renderMilitaryView();
            this.renderSoftGuide({ skipSurface: true });
            this.maybeShowNamingPrompt();
            this.renderCanvasSurface();
          },

      renderCanvasSurface(activeTab = this.getActiveTab()) {
            const homeView = this.resolveMapHomeViewState(this.state, {
              requestedTab: activeTab || this.getActiveTab(),
              militaryView: this.state?.militaryView || this.militaryView,
              forceMapHome: this.mapHomeActive && (activeTab === 'resources' || activeTab === 'military'),
            });
            const resolvedActiveTab = homeView.activeTab;
            this.mapHomeActive = homeView.isMapHome;
            this.activeTab = resolvedActiveTab;
            if (this.state && typeof this.state === 'object') {
              StateWriter.commit(this, (prev) => ({
                ...prev,
                currentTab: resolvedActiveTab,
                militaryView: homeView.militaryView,
              }), { source: 'renderCanvasSurface' });
            }
            this.militaryView = homeView.militaryView;
            if (this.canvasShell?.previewEnabled || typeof this.canvasShell?.renderReadOnly === 'function') {
              if (
                this.canvasShell?.isWorldMapDragging?.()
                || this.canvasShell?.hasPendingWorldMapCompositeCommit?.()
              ) {
                this.canvasShell.deferRenderUntilWorldMapDragEnd = true;
                return true;
              }
              if (this.canvasShell && typeof this.canvasShell.pageTransition !== 'undefined') this.canvasShell.pageTransition = this.pageTransition;
              if (this.canvasShell && typeof this.canvasShell.buildingTransition !== 'undefined') this.canvasShell.buildingTransition = this.buildingTransition;
              this.canvasShell.renderReadOnly(this.state, resolvedActiveTab);
              if (
                !this.pendingTutorialAdvisorDialogue
                && !this.tutorialAdvisorDialogue
                && !this.canvasShell?.tutorialAdvisorDialogue
              ) {
                this.tutorialController?.refreshCurrentHighlight?.();
              }
              return true;
            }
            if (!this.renderer?.render) return false;
            const runtimeCanRenderWorldMap = Boolean(homeView.isMapHome
              && this.ensureWorldMapRuntimeCoordinator()?.canRender(this.state));
            const runtimeRenderOptions = this.buildRenderOptions(resolvedActiveTab, this.territoryUiState);
            const explorerAnimatedForRuntime = hasActiveWorldExplorerMission(this.state, runtimeRenderOptions);
            let worldMapLayerRendered = runtimeCanRenderWorldMap
              ? (this.shouldRenderRuntimeWorldMap(runtimeRenderOptions)
                ? this.renderRuntimeWorldMap({
                  ...runtimeRenderOptions,
                  force: runtimeRenderOptions.force,
                }) !== false
                : (this.worldMapRuntime?.isBakedLayerStateValid?.() ?? Boolean(this.worldMapRuntime?.hasBakedMapLayer)))
              : false;
            const worldMapFrameState = runtimeCanRenderWorldMap
              ? (this.worldMapRuntime?.getWorldMapFrameState?.({ rendered: worldMapLayerRendered })
                || WorldMapRuntimeRenderPolicy?.createWorldMapFrameState?.(this.worldMapRuntime || {}, {
                  rendered: worldMapLayerRendered,
                })
                || null)
              : null;
            worldMapLayerRendered = WorldMapRuntimeRenderPolicy?.canSkipWorldMapLayer
              ? WorldMapRuntimeRenderPolicy.canSkipWorldMapLayer(worldMapFrameState)
              : Boolean(worldMapLayerRendered);
            const worldMapCompositionOptions = WorldMapRuntimeRenderPolicy?.createWorldMapCompositionOptions
              ? WorldMapRuntimeRenderPolicy.createWorldMapCompositionOptions({
                skipWorldMapLayer: worldMapLayerRendered,
                worldMapRuntimeHitTargets: Array.isArray(this.worldMapRuntime?.hitTargets)
                  ? this.worldMapRuntime.hitTargets
                  : [],
                worldMapRuntimeContext: this.worldMapRuntime?.getLastTileMapContext?.()
                  || this.worldMapRuntime?.lastTileMapContext
                  || this.renderer?.lastWorldTileMapContext
                  || null,
                preserveCanvas: worldMapLayerRendered,
              }, worldMapFrameState || {})
              : {
                skipWorldMapLayer: worldMapLayerRendered,
                worldMapRuntimeHitTargets: Array.isArray(this.worldMapRuntime?.hitTargets)
                  ? this.worldMapRuntime.hitTargets
                  : [],
                worldMapRuntimeContext: this.worldMapRuntime?.getLastTileMapContext?.()
                  || this.worldMapRuntime?.lastTileMapContext
                  || this.renderer?.lastWorldTileMapContext
                  || null,
                preserveCanvas: worldMapLayerRendered,
              };
            const rendererSnapshot = typeof this.buildRendererSnapshot === 'function'
              ? this.buildRendererSnapshot()
              : null;
            const battleSnapshot = rendererSnapshot?.battle || {};
            const snapshotBattleScene = battleSnapshot.battleScene || null;
            const snapshotEntityBattle = battleSnapshot.entityBattle || null;
            const snapshotNaming = this.getNamingSnapshot?.(rendererSnapshot) || null;
            const snapshotConfirmDialog = this.getConfirmDialogSnapshot?.(rendererSnapshot) || null;
            const snapshotRewardReveal = this.getRewardRevealSnapshot?.(rendererSnapshot) || null;
            const snapshotEvent = this.getEventSnapshot?.(rendererSnapshot) || null;
            const snapshotTargetPicker = this.getTargetPickerSnapshot?.(rendererSnapshot) || null;
            const panel = this.getRendererSnapshot?.()?.panel || {};
            this.renderer.render(this.state, {
              activeTab: resolvedActiveTab,
              isMapHome: homeView.isMapHome,
              ...worldMapCompositionOptions,
              showResourceDetails: panel.showResourceDetails,
              showCitySwitcher: panel.showCitySwitcher,
              showSubcityList: panel.showSubcityList,
              showCityManagement: panel.showCityManagement,
              activeCityManagementTab: this.activeCityManagementTab,
              showTaskCenter: panel.showTaskCenter,
              activeTaskCenterTab: this.activeTaskCenterTab,
              showGuidebook: panel.showGuidebook,
              activeGuidebookTab: this.activeGuidebookTab,
              showFamousPersons: panel.showFamousPersons,
              famousPersonsPage: this.famousPersonsPage,
              selectedFamousPersonId: this.selectedFamousPersonId,
              armyFormationEditor: this.canvasShell && 'armyFormationEditor' in this.canvasShell
                ? this.canvasShell.armyFormationEditor
                : this.armyFormationEditor,
              activeCommandPanel: panel.activeCommandPanel || '',
              rewardReveal: snapshotRewardReveal,
              buildingOffset: this.buildingOffset,
              techTreePanX: this.techTreePanX,
              techTreePanY: this.techTreePanY,
              techTreeZoom: this.getTechTreeZoom(),
              selectedTechId: this.state?.techUiState?.selectedTechId || '',
              techDetailOpen: panel.techDetailOpen || Boolean(this.state?.techUiState?.detailOpen),
              activeBuildingCategory: this.activeBuildingCategory,
              pendingBuildingAction: this.pendingBuildingAction || null,
              ...(this.pageTransition ? { pageTransition: this.pageTransition } : {}),
              ...(this.buildingTransition ? { buildingTransition: this.buildingTransition } : {}),
              activeEventId: snapshotEvent?.eventId ?? null,
              territoryUiState: this.territoryUiState,
              targetPicker: snapshotTargetPicker,
              ...(snapshotBattleScene ? { battleScene: snapshotBattleScene } : {}),
              ...(this.entityBattle ? { entityBattle: this.entityBattle } : (snapshotEntityBattle ? { entityBattle: snapshotEntityBattle } : {})),
              naming: snapshotNaming,
              tutorialIntro: this.tutorialIntro || null,
              tutorialAdvisorDialogue: this.tutorialAdvisorDialogue || null,
              tutorialHighlight: null,
              loading: this.loading,
              network: this.networkState,
              confirmDialog: snapshotConfirmDialog,
            });
            const waterAnimated = Boolean(this.territoryUiState?.tileMapWaterAnimated
              || this.territoryController?.uiState?.tileMapWaterAnimated);
            const explorerAnimated = explorerAnimatedForRuntime;
            this.updateWorldActorAnimationLoop?.({
              ...runtimeRenderOptions,
              state: this.state,
            });
            if (resolvedActiveTab === 'military' && (waterAnimated || (explorerAnimated && !this.canvasShell && !this.renderer?.worldActorLayerRenderer))) this.startTileMapWaterTimer();
            else this.stopTileMapWaterTimer();
            return true;
          },

      buildRenderOptions(activeTab = this.getActiveTab(), territoryUiState = this.territoryUiState, options = {}) {
            const state = this.state || {};
            const homeView = this.resolveMapHomeViewState(state, {
              requestedTab: activeTab || state.currentTab || 'resources',
              militaryView: state.militaryView || this.militaryView,
              forceMapHome: options.forceMapHome ?? Boolean(this.mapHomeActive),
              allowDefaultMapHome: options.allowDefaultMapHome,
            });
            return {
              epochNowMs: this.getWorldEpochNowMs?.() ?? Date.now(),
              activeTab: homeView.activeTab,
              isMapHome: homeView.isMapHome,
              territoryUiState: territoryUiState || this.territoryUiState || {},
              targetPicker: this.getTargetPickerSnapshot?.() || null,
              tutorial: this.tutorialController?.state || this.tutorial || {},
              tutorialIntro: this.tutorialIntro || null,
              tutorialAdvisorDialogue: this.tutorialAdvisorDialogue || null,
              worldMapRuntimeContext: this.worldMapRuntime?.getLastTileMapContext?.()
                || this.worldMapRuntime?.lastTileMapContext
                || this.renderer?.lastWorldTileMapContext
                || null,
              network: this.networkState,
            };
          },

      startTileMapWaterTimer() {
            if (this.tileMapWaterTimer) return false;
            const tick = () => {
              if ((this.state?.currentTab || this.getActiveTab()) !== 'military') {
                this.stopTileMapWaterTimer();
                return;
              }
              if (this.isWorldMapDragging() || this.isWorldMapDragCoolingDown()) return;
              const epochNowMs = this.getWorldEpochNowMs?.() ?? Date.now();
              if (hasActiveWorldExplorerMission(this.state, { epochNowMs })) {
                this.updateWorldActorAnimationLoop?.({ epochNowMs, state: this.state });
                if (!this.canvasShell && !this.renderer?.worldActorLayerRenderer) {
                  this.renderRuntimeWorldMap({
                    ...this.buildRenderOptions('military', this.territoryUiState),
                    epochNowMs,
                    force: true,
                  });
                  this.renderAnimationFrame('military');
                }
                return;
              }
              if (this.isWorldMapHomeActive() && !this.shouldRenderRuntimeWorldMap()) {
                this.renderRuntimeWorldMap({
                  reuseCachedWorldTileView: true,
                  snapshotOnly: true,
                  waterTimeMs: this.now(),
                });
                return;
              }
              this.renderAnimationFrame('military');
            };
            this.tileMapWaterTimer = CanvasGameAppRenderScheduler.setIntervalForHost(
              this,
              tick,
              this.getWorldTileWaterAnimationFrameMs(),
            );
            return Boolean(this.tileMapWaterTimer);
          },

      stopTileMapWaterTimer() {
            if (!this.tileMapWaterTimer) return;
            CanvasGameAppRenderScheduler.clearIntervalForHost(this, this.tileMapWaterTimer);
            this.tileMapWaterTimer = null;
          },

      now() {
            return CanvasGameAppRenderScheduler.now(this);
          },

      getWorldEpochNowMs() {
            const clock = this.worldClock || this.runtime?.worldClock || global.__WorldClockShared;
            return SharedWorldClock?.getEpochNowMs?.({ worldClock: clock }, Date.now()) ?? Date.now();
          },

      wait(ms = 0) {
            return CanvasGameAppRenderScheduler.wait(this, ms);
          },

      getActiveTab() {
            return this.activeTab || this.state?.currentTab || 'resources';
          },

      resolveMapHomeViewState(state = this.state, options = {}) {
            if (this.presenter?.resolveMapHomeViewState) {
              return this.presenter.resolveMapHomeViewState(state || {}, options);
            }
            return CanvasGameAppRenderPolicy.resolveMapHomeViewState(state || {}, options);
          },

      getTabOrder() {
            return CanvasGameAppRenderPolicy.getTabOrder();
          },

      getTransitionDurationMs() {
            return CanvasGameAppRenderScheduler.getTransitionDurationMs(this);
          },

      getAnimationFrameMs() {
            return CanvasGameAppRenderScheduler.getAnimationFrameMs(this);
          },

      getWorldTileWaterAnimationFrameMs() {
            return CanvasGameAppRenderScheduler.getWorldTileWaterAnimationFrameMs(this);
          },

      getWorldMapDragCooldownMs() {
            return CanvasGameAppRenderScheduler.getWorldMapDragCooldownMs(this);
          },

      getRequestAnimationFrame() {
            return CanvasGameAppRenderScheduler.getRequestAnimationFrame(this);
          },

      renderAnimationFrame(activeTab = this.state?.currentTab || this.getActiveTab()) {
            if (this.canvasShell && typeof this.canvasShell.renderAnimationFrame === 'function') {
              return this.canvasShell.renderAnimationFrame();
            }
            const now = this.now();
            const frameMs = Math.max(1, this.getAnimationFrameMs() - 1);
            if (this.lastAnimationRenderAt && now - this.lastAnimationRenderAt < frameMs) return false;
            this.lastAnimationRenderAt = now;
            return this.renderCanvasSurface(activeTab);
          },

      requestRenderAnimationFrame(activeTab = this.state?.currentTab || this.getActiveTab()) {
            const resolvedActiveTab = typeof activeTab === 'string'
              ? activeTab
              : (this.state?.currentTab || this.getActiveTab());
            if (this.canvasShell && typeof this.canvasShell.requestRenderAnimationFrame === 'function') {
              return this.canvasShell.requestRenderAnimationFrame();
            }
            if (this.animationRenderQueued) return true;
            const raf = this.getRequestAnimationFrame();
            if (!raf) return this.renderAnimationFrame(resolvedActiveTab);
            this.animationRenderQueued = true;
            raf(() => {
              this.animationRenderQueued = false;
              this.renderAnimationFrame(resolvedActiveTab);
            });
            return true;
          },

      startTransitionTimer() {
            if (this.canvasShell && typeof this.canvasShell.startTransitionTimer === 'function') {
              if (typeof this.canvasShell.pageTransition !== 'undefined') this.canvasShell.pageTransition = this.pageTransition;
              if (typeof this.canvasShell.buildingTransition !== 'undefined') this.canvasShell.buildingTransition = this.buildingTransition;
              return this.canvasShell.startTransitionTimer();
            }
            if (this.transitionTimer || !this.runtime?.setInterval) return false;
            this.transitionTimer = this.runtime.setInterval(() => {
              const now = this.now();
              const duration = this.getTransitionDurationMs();
              const pageDone = !this.pageTransition || now - this.pageTransition.startedAt >= (this.pageTransition.durationMs || duration);
              const buildingDone = !this.buildingTransition || now - this.buildingTransition.startedAt >= (this.buildingTransition.durationMs || duration);
              if (pageDone) this.pageTransition = null;
              if (buildingDone) this.buildingTransition = null;
              if (!this.pageTransition && !this.buildingTransition) this.stopTransitionTimer();
              this.renderAnimationFrame(this.state?.currentTab || this.getActiveTab());
            }, this.getAnimationFrameMs());
            return true;
          },

      stopTransitionTimer() {
            if (!this.transitionTimer) return;
            this.runtime?.clearInterval?.(this.transitionTimer);
            this.transitionTimer = null;
          },

      startPageTransition(fromTab, toTab, options = {}) {
            const buildingOffset = this.buildingOffset;
            if (!fromTab || !toTab || fromTab === toTab) {
              this.pageTransition = null;
              if (this.canvasShell && typeof this.canvasShell.pageTransition !== 'undefined') this.canvasShell.pageTransition = null;
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
              fromBuildingOffset: options.fromBuildingOffset ?? buildingOffset,
            };
            if (this.canvasShell && typeof this.canvasShell.pageTransition !== 'undefined') {
              this.canvasShell.pageTransition = this.pageTransition;
            }
            this.startTransitionTimer();
            return true;
          },

      getCanvasActionState() {
            return this.state;
          },

      renderCanvasAction() {
            return this.renderCanvasSurface();
          },

      resetForCanvasTabSwitch() {
            closeBlockingPanelSnapshot(this, 'showResourceDetails');
            closeBlockingPanelSnapshot(this, 'showCitySwitcher');
            closeBlockingPanelSnapshot(this, 'showSubcityList');
            closeBlockingPanelSnapshot(this, 'showCityManagement');
            this.closeEventSnapshot?.();
            closeBlockingPanelSnapshot(this, 'showTaskCenter');
            closeBlockingPanelSnapshot(this, 'showGuidebook');
            closeBlockingPanelSnapshot(this, 'showFamousPersons');
            this.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], soldierAssignments: {}, soldierDraftAssignments: {}, page: 0, saving: false };
            closeBlockingPanelSnapshot(this, 'activeCommandPanel');
            this.closeRewardRevealSnapshot?.();
            this.famousPersonsPage = 0;
            this.selectedFamousPersonId = '';
            if (this.canvasShell) this.canvasShell.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], soldierAssignments: {}, soldierDraftAssignments: {}, page: 0, saving: false };
            this.renderer?.clearFamousSkillTooltip?.();
            this.activeBuildingCategory = 'all';
            this.buildingOffset = 0;
            this.techTreePanX = 0;
            this.techTreePanY = 0;
            this.techTreeZoom = 1;
            closeBlockingPanelSnapshot(this, 'techDetailOpen');
            StateWriter.commit(this, (prev) => ({
              ...prev,
              techUiState: {
                ...(prev.techUiState || {}),
                selectedTechId: '',
                detailOpen: false,
              },
            }), { source: 'resetForCanvasTabSwitch' });
            this.techTreeDragStart = null;
            this.buildingTransition = null;
          },

      resetLocalViewToResources(options = {}) {
            const homeView = this.resolveMapHomeViewState(this.state, { requestedTab: 'resources', forceMapHome: true });
            this.activeTab = homeView.activeTab;
            this.militaryView = homeView.militaryView;
            this.mapHomeActive = homeView.isMapHome;
            this.buildingOffset = 0;
            this.activeBuildingCategory = 'all';
            this.techTreePanX = 0;
            this.techTreePanY = 0;
            this.techTreeZoom = 1;
            closeBlockingPanelSnapshot(this, 'techDetailOpen');
            this.techTreeDragStart = null;
            this.closeEventSnapshot?.();
            TerritoryUiStateStore?.clearWorldSelection?.(this, { clearWorldMarchTarget: true });
            this.territoryController?.closeSiteDialog?.({ render: false });
            closeBlockingPanelSnapshot(this, 'showResourceDetails');
            closeBlockingPanelSnapshot(this, 'showCitySwitcher');
            closeBlockingPanelSnapshot(this, 'showSubcityList');
            closeBlockingPanelSnapshot(this, 'showCityManagement');
            closeBlockingPanelSnapshot(this, 'showTaskCenter');
            closeBlockingPanelSnapshot(this, 'showGuidebook');
            closeBlockingPanelSnapshot(this, 'showFamousPersons');
            this.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], soldierAssignments: {}, soldierDraftAssignments: {}, page: 0, saving: false };
            closeBlockingPanelSnapshot(this, 'activeCommandPanel');
            this.famousPersonsPage = 0;
            this.selectedFamousPersonId = '';
            this.renderer?.clearFamousSkillTooltip?.();
            this.activeTaskCenterTab = 'main';
            this.activeGuidebookTab = 'planning';
            this.activeGuideNavigation = null;
            this.pageTransition = null;
            this.buildingTransition = null;
            if (this.canvasShell) {
              TerritoryUiStateStore?.ensure?.(this.canvasShell);
              this.canvasShell.closeWorldSiteHud?.({ render: false });
            }
            if (this.canvasShell) this.canvasShell.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], soldierAssignments: {}, soldierDraftAssignments: {}, page: 0, saving: false };
            if (this.state && typeof this.state === 'object') {
              StateWriter.commit(this, (prev) => ({
                ...prev,
                currentTab: homeView.activeTab,
                militaryView: homeView.militaryView,
                techUiState: {
                  ...(prev.techUiState || {}),
                  selectedTechId: '',
                  detailOpen: false,
                },
              }), { source: 'resetLocalViewToResources' });
            }
            if (this.canvasShell) {
              this.canvasShell.mapHomeActive = homeView.isMapHome;
            }
            if (!options.skipShell && this.canvasShell?.resetLocalViewToResources) {
              this.canvasShell.resetLocalViewToResources({ skipGame: true, skipRender: true });
            }
            if (!options.skipRender) this.renderCanvasSurface(homeView.activeTab);
            return true;
          },

      switchTab(tab) {
            const previousTab = this.getActiveTab();
            const previousBuildingOffset = this.buildingOffset;
            this.resetForCanvasTabSwitch();
            const navigation = this.presenter?.buildTabNavigationViewState?.(this.state, { requestedTab: tab });
            this.activeTab = navigation?.activeTab || tab || 'resources';
            const preferredMilitaryView = this.getPreferredMilitaryView(tab);
            const homeView = this.resolveMapHomeViewState(this.state, {
              requestedTab: this.activeTab,
              militaryView: preferredMilitaryView || this.state?.militaryView || this.militaryView,
              forceMapHome: tab === 'resources',
            });
            this.activeTab = homeView.activeTab;
            this.mapHomeActive = homeView.isMapHome;
            StateWriter.commit(this, (prev) => ({
              ...prev,
              currentTab: this.activeTab,
              militaryView: (preferredMilitaryView && !homeView.isMapHome)
                ? preferredMilitaryView
                : homeView.militaryView,
              techUiState: {
                ...(prev.techUiState || {}),
                detailOpen: false,
              },
            }), { source: 'switchTab' });
            this.militaryView = this.state.militaryView || homeView.militaryView;
            this.buildingOffset = 0;
            this.techTreePanX = 0;
            this.techTreePanY = 0;
            this.techTreeZoom = 1;
            closeBlockingPanelSnapshot(this, 'techDetailOpen');
            this.techTreeDragStart = null;
            this.buildingTransition = null;
            this.startPageTransition(previousTab, this.activeTab, { fromBuildingOffset: previousBuildingOffset });
            this.closeEventSnapshot?.();
            this.renderMilitaryView();
            this.renderCanvasSurface(this.state.currentTab);
            if (this.skipNextSoftGuideRender) {
              this.skipNextSoftGuideRender = false;
              if (this.activeGuideNavigation?.target === 'scout-action-first') {
                this.activeGuideNavigation = null;
                this.renderSoftGuide();
              }
            } else {
              this.renderSoftGuide();
            }
          },

      getPreferredMilitaryView(tabId) {
            return CanvasGameAppRenderPolicy.getPreferredMilitaryView(tabId, this.state?.softGuide || {});
          },

      switchMilitaryView(view) {
            const allowed = ['army', 'scout', 'world'];
            this.militaryView = allowed.includes(view) ? view : 'army';
            this.mapHomeActive = this.militaryView === 'world' && this.resolveMapHomeViewState(this.state, {
              requestedTab: this.state?.currentTab || this.activeTab,
              militaryView: this.militaryView,
              forceMapHome: this.mapHomeActive,
            }).isMapHome;
            StateWriter.commit(this, (prev) => ({ ...prev, militaryView: this.militaryView }), { source: 'switchMilitaryView' });
            this.renderMilitaryView();
            this.renderCanvasSurface(this.state?.currentTab);
            return true;
          },

      renderMilitaryView() {
            if (this.resolveMapHomeViewState(this.state, {
              requestedTab: this.state?.currentTab || this.activeTab,
              militaryView: this.state?.militaryView || this.militaryView,
              forceMapHome: this.mapHomeActive,
            }).isMapHome) {
              this.militaryView = 'world';
              if (this.state) StateWriter.commit(this, (prev) => ({ ...prev, militaryView: 'world' }), { source: 'renderMilitaryView:mapHome' });
              return;
            }
            const view = this.presenter?.buildMilitaryNavigationViewState?.(this.state);
            if (view?.activeView) {
              this.militaryView = view.activeView;
              if (this.state) StateWriter.commit(this, (prev) => ({ ...prev, militaryView: view.activeView }), { source: 'renderMilitaryView:nav' });
            }
          },

      updateMilitaryViewLocks() {
            this.renderMilitaryView();
          },

      renderMilitary() {
            this.updateMilitaryViewLocks();
            this.renderCanvasSurface(this.state?.currentTab);
          },

      startScoutCountdownTimer() {
            if (this.scoutCountdownTimer) return;
            this.scoutCountdownTimer = this.scheduler?.setInterval?.(() => {
              if ((this.state?.currentEra || 0) < 5) return;
              if (
                this.canvasShell?.isWorldMapDragging?.()
                || this.canvasShell?.hasPendingWorldMapCompositeCommit?.()
              ) return;
              if (this.state?.currentTab === 'military') this.renderCanvasSurface(this.state.currentTab);
              if (this.state?.currentTab === 'territory') {
                const territories = this.state.territoryState?.territories || [];
                const hasConquestMission = territories.some((site) => site.mission?.status === 'active');
                if (hasConquestMission) this.renderTerritory();
              }
            }, 1000);
          },

      renderTerritory() {
            const homeView = this.resolveMapHomeViewState(this.state, {
              requestedTab: 'territory',
              militaryView: 'world',
              forceMapHome: true,
            });
            this.activeTab = homeView.activeTab;
            this.militaryView = homeView.militaryView;
            this.mapHomeActive = homeView.isMapHome;
            if (this.state && typeof this.state === 'object') {
              StateWriter.commit(this, (prev) => ({
                ...prev,
                currentTab: homeView.activeTab,
                militaryView: homeView.militaryView,
              }), { source: 'renderTerritory' });
            }
            this.renderCanvasSurface(homeView.activeTab);
          },
    });
    CanvasGameAppWorldMapRuntime?.install?.(CanvasGameApp);
    return true;
  }

  const api = { install };

  global.CanvasGameAppRenderingRuntime = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
