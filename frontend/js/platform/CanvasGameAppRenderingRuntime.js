(function (global) {
  var CanvasGameAppWorldMapRuntimeBridge = global.CanvasGameAppWorldMapRuntimeBridge;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameAppWorldMapRuntimeBridge) {
    CanvasGameAppWorldMapRuntimeBridge = require('./CanvasGameAppWorldMapRuntimeBridge');
  }
  var CanvasGameAppRenderPolicy = global.CanvasGameAppRenderPolicy;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameAppRenderPolicy) {
    CanvasGameAppRenderPolicy = require('./CanvasGameAppRenderPolicy');
  }
  var CanvasGameAppRenderScheduler = global.CanvasGameAppRenderScheduler;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameAppRenderScheduler) {
    CanvasGameAppRenderScheduler = require('./CanvasGameAppRenderScheduler');
  }
  var WorldMarchSystem = global.WorldMarchSystem;
  if (typeof module !== 'undefined' && module.exports && !WorldMarchSystem) {
    WorldMarchSystem = require('../domain/WorldMarchSystem');
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
              this.state = {
                ...this.state,
                currentTab: resolvedActiveTab,
                militaryView: homeView.militaryView,
              };
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
              if (this.canvasShell && typeof this.canvasShell.techTreeZoom !== 'undefined') this.canvasShell.techTreeZoom = this.techTreeZoom;
              if (this.canvasShell && typeof this.canvasShell.buildingOffset !== 'undefined') this.canvasShell.buildingOffset = this.buildingOffset;
              if (this.canvasShell && typeof this.canvasShell.activeBuildingCategory !== 'undefined') this.canvasShell.activeBuildingCategory = this.activeBuildingCategory;
              if (this.canvasShell && typeof this.canvasShell.famousPersonsPage !== 'undefined') this.famousPersonsPage = this.canvasShell.famousPersonsPage;
              if (this.canvasShell && typeof this.canvasShell.selectedFamousPersonId !== 'undefined') this.selectedFamousPersonId = this.canvasShell.selectedFamousPersonId;
              if (this.canvasShell && typeof this.canvasShell.naming !== 'undefined') this.canvasShell.naming = this.naming;
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
            const worldMapLayerRendered = runtimeCanRenderWorldMap
              ? (explorerAnimatedForRuntime || this.shouldRenderRuntimeWorldMap(runtimeRenderOptions)
                ? this.renderRuntimeWorldMap({
                  ...runtimeRenderOptions,
                  force: explorerAnimatedForRuntime || runtimeRenderOptions.force,
                }) !== false
                : (this.worldMapRuntime?.isBakedLayerStateValid?.() ?? Boolean(this.worldMapRuntime?.hasBakedMapLayer)))
              : false;
            this.renderer.render(this.state, {
              activeTab: resolvedActiveTab,
              isMapHome: homeView.isMapHome,
              skipWorldMapLayer: worldMapLayerRendered,
              worldMapRuntimeHitTargets: Array.isArray(this.worldMapRuntime?.hitTargets)
                ? this.worldMapRuntime.hitTargets
                : [],
              worldMapRuntimeContext: this.worldMapRuntime?.getLastTileMapContext?.()
                || this.worldMapRuntime?.lastTileMapContext
                || this.renderer?.lastWorldTileMapContext
                || null,
              preserveCanvas: worldMapLayerRendered,
              showResourceDetails: this.showResourceDetails,
              showCitySwitcher: this.showCitySwitcher,
              showSubcityList: this.showSubcityList,
              showCityManagement: this.showCityManagement,
              activeCityManagementTab: this.activeCityManagementTab,
              showTaskCenter: this.showTaskCenter,
              activeTaskCenterTab: this.activeTaskCenterTab,
              showGuidebook: this.showGuidebook,
              activeGuidebookTab: this.activeGuidebookTab,
              showFamousPersons: this.showFamousPersons,
              famousPersonsPage: this.canvasShell?.famousPersonsPage ?? this.famousPersonsPage,
              selectedFamousPersonId: this.canvasShell?.selectedFamousPersonId ?? this.selectedFamousPersonId,
              armyFormationEditor: this.canvasShell && 'armyFormationEditor' in this.canvasShell
                ? this.canvasShell.armyFormationEditor
                : this.armyFormationEditor,
              activeCommandPanel: this.activeCommandPanel || '',
              rewardReveal: this.rewardReveal,
              buildingOffset: this.buildingOffset,
              techTreePanX: this.techTreePanX,
              techTreePanY: this.techTreePanY,
              techTreeZoom: this.getTechTreeZoom(),
              selectedTechId: this.state?.techUiState?.selectedTechId || this.canvasShell?.selectedTechId || '',
              techDetailOpen: this.techDetailOpen || Boolean(this.state?.techUiState?.detailOpen || this.canvasShell?.techDetailOpen),
              activeBuildingCategory: this.activeBuildingCategory,
              pendingBuildingAction: this.pendingBuildingAction || this.canvasShell?.pendingBuildingAction || null,
              ...(this.pageTransition ? { pageTransition: this.pageTransition } : {}),
              ...(this.buildingTransition ? { buildingTransition: this.buildingTransition } : {}),
              activeEventId: this.activeEventId,
              territoryUiState: this.territoryUiState,
              ...(this.battleScene ? { battleScene: this.battleScene } : {}),
              naming: this.naming,
              tutorialIntro: this.tutorialIntro || null,
              tutorialAdvisorDialogue: this.tutorialAdvisorDialogue || null,
              tutorialHighlight: null,
              loading: this.loading,
              network: this.networkState,
              confirmDialog: this.confirmDialog || this.canvasShell?.confirmDialog || null,
            });
            const waterAnimated = Boolean(this.territoryUiState?.tileMapWaterAnimated
              || this.territoryController?.uiState?.tileMapWaterAnimated);
            const explorerAnimated = explorerAnimatedForRuntime;
            if (resolvedActiveTab === 'military' && (waterAnimated || explorerAnimated)) this.startTileMapWaterTimer();
            else this.stopTileMapWaterTimer();
            return true;
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
                this.renderRuntimeWorldMap({
                  ...this.buildRenderOptions('military', this.territoryUiState),
                  epochNowMs,
                  force: true,
                });
                this.renderAnimationFrame('military');
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

      showLoading(message = '') {
            this.loading = {
              visible: true,
              percentage: 0,
              message: message || '\u6b63\u5728\u6574\u7406\u8425\u5730\u8d44\u6e90',
            };
            this.canvasShell?.showLoading?.(this.loading.message);
            this.renderCanvasSurface();
            return true;
          },

      updateLoading(progress = {}) {
            if (!this.loading.visible && !this.canvasShell?.loading?.visible) return false;
            this.loading = {
              ...this.loading,
              visible: true,
              percentage: Math.max(0, Math.min(100, Number(progress.percentage) || 0)),
              message: progress.message || this.loading.message,
            };
            this.canvasShell?.updateLoading?.(this.loading);
            this.renderCanvasSurface();
            return true;
          },

      hideLoading() {
            const hadLoading = Boolean(this.loading.visible || this.canvasShell?.loading?.visible);
            this.loading = {
              visible: false,
              percentage: 100,
              message: '',
            };
            this.canvasShell?.hideLoading?.();
            if (hadLoading) this.renderCanvasSurface();
            return hadLoading;
          },

      preloadAssets(onProgress = null, assetPaths = null) {
            if (this.canvasShell && typeof this.canvasShell.preloadAssets === 'function') {
              return this.canvasShell.preloadAssets(onProgress, assetPaths);
            }
            if (!this.renderer || typeof this.renderer.preloadAssets !== 'function') {
              onProgress?.({ total: 0, completed: 0, loaded: 0, failed: 0, percentage: 100 });
              return Promise.resolve({ total: 0, completed: 0, loaded: 0, failed: 0, percentage: 100 });
            }
            return this.renderer.preloadAssets(assetPaths || undefined, onProgress);
          },

      now() {
            return CanvasGameAppRenderScheduler.now(this);
          },

      getWorldEpochNowMs() {
            const clock = this.worldClock || this.runtime?.worldClock || global.__WorldClockShared;
            return clock?.getEpochNowMs?.(Date.now()) ?? Date.now();
          },

      wait(ms = 0) {
            return CanvasGameAppRenderScheduler.wait(this, ms);
          },

      async loadGameAssets(options = {}) {
            const message = options.message || '\u6b63\u5728\u6574\u7406\u8425\u5730\u8d44\u6e90';
            const hideWhenDone = options.hideWhenDone !== false;
            const minimumDurationMs = Number.isFinite(options.minimumDurationMs)
              ? Math.max(0, options.minimumDurationMs)
              : 3000;
            const trace = global.H5LoadTrace;
            const startedAt = this.now();
            trace?.phaseStart?.('assets:preload', {
              message,
              hideWhenDone,
              minimumDurationMs,
            });
            this.showLoading(message);
            try {
              const result = await this.preloadAssets((progress) => {
                const progressMessage = progress?.message || message;
                trace?.progress?.('assets:preload', { ...progress, message: progressMessage });
                this.updateLoading({ ...progress, message: progressMessage });
              }, options.assetPaths || null);
              const elapsed = Math.max(0, this.now() - startedAt);
              const minimumWaitMs = Math.max(0, minimumDurationMs - elapsed);
              trace?.phaseEnd?.('assets:preload', {
                ...result,
                minimumWaitMs,
              });
              if (minimumWaitMs > 0) {
                trace?.mark?.('assets:minimum-wait', {
                  waitMs: Math.round(minimumWaitMs),
                  reason: 'loading screen minimum duration',
                });
              }
              await this.wait(minimumWaitMs);
              return result;
            } catch (error) {
              trace?.phaseFail?.('assets:preload', error);
              throw error;
            } finally {
              this.updateLoading({ percentage: 100, message: '\u8d44\u6e90\u51c6\u5907\u5b8c\u6210' });
              if (hideWhenDone) this.hideLoading();
            }
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
            const buildingOffset = this.canvasShell && Number.isFinite(Number(this.canvasShell.buildingOffset))
              ? Number(this.canvasShell.buildingOffset)
              : this.buildingOffset;
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

      scrollBuildings(action = {}) {
            if (this.canvasShell && typeof this.canvasShell.scrollBuildings === 'function') {
              const scrolled = this.canvasShell.scrollBuildings(action);
              this.buildingOffset = this.canvasShell.buildingOffset;
              this.buildingTransition = this.canvasShell.buildingTransition;
              return scrolled;
            }
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
            return true;
          },

      selectBuildingCategory(action = {}) {
            const category = action.category || 'all';
            const previous = this.activeBuildingCategory || 'all';
            if (this.canvasShell && typeof this.canvasShell.selectBuildingCategory === 'function') {
              const changed = this.canvasShell.selectBuildingCategory(action);
              this.activeBuildingCategory = this.canvasShell.activeBuildingCategory;
              this.buildingOffset = this.canvasShell.buildingOffset;
              this.buildingTransition = this.canvasShell.buildingTransition;
              return changed !== false && category !== previous;
            }
            this.activeBuildingCategory = category;
            this.buildingOffset = 0;
            this.buildingTransition = null;
            if (this.canvasShell && typeof this.canvasShell.activeBuildingCategory !== 'undefined') {
              this.canvasShell.activeBuildingCategory = category;
              this.canvasShell.buildingOffset = 0;
              this.canvasShell.techTreePanX = 0;
              this.canvasShell.techTreePanY = 0;
              this.canvasShell.techTreeZoom = 1;
              this.canvasShell.buildingTransition = null;
            }
            return category !== previous;
          },

      getCanvasActionState() {
            return this.state;
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
            if (this.canvasShell && typeof this.canvasShell === 'object') {
              this.canvasShell.techTreePanX = x;
              this.canvasShell.techTreePanY = y;
            }
            return true;
          },

      getTechTreeZoom() {
            return Math.max(0.65, Math.min(1.6, Number(this.techTreeZoom) || 1));
          },

      setTechTreeZoom(zoom = 1) {
            const nextZoom = Math.max(0.65, Math.min(1.6, Number(zoom) || 1));
            this.techTreeZoom = nextZoom;
            if (this.canvasShell && typeof this.canvasShell === 'object') this.canvasShell.techTreeZoom = nextZoom;
            return true;
          },

      renderCanvasAction() {
            return this.renderCanvasSurface();
          },

      changeFamousPersonsPage(action = {}) {
            const delta = Number(action.delta) || 0;
            this.famousPersonsPage = Math.max(0, (Number(this.famousPersonsPage) || 0) + delta);
            this.selectedFamousPersonId = '';
            if (this.canvasShell && typeof this.canvasShell === 'object') {
              this.canvasShell.famousPersonsPage = this.famousPersonsPage;
              if ('selectedFamousPersonId' in this.canvasShell) this.canvasShell.selectedFamousPersonId = '';
            }
            this.renderer?.clearFamousSkillTooltip?.();
            return this.renderCanvasSurface();
          },

      openFamousPersonDetail(action = {}) {
            this.selectedFamousPersonId = action.personId || '';
            if (this.canvasShell && typeof this.canvasShell === 'object' && 'selectedFamousPersonId' in this.canvasShell) {
              this.canvasShell.selectedFamousPersonId = this.selectedFamousPersonId;
            }
            this.renderer?.clearFamousSkillTooltip?.();
            return this.renderCanvasSurface();
          },

      closeFamousPersonDetail() {
            this.selectedFamousPersonId = '';
            if (this.canvasShell && typeof this.canvasShell === 'object' && 'selectedFamousPersonId' in this.canvasShell) {
              this.canvasShell.selectedFamousPersonId = '';
            }
            this.renderer?.clearFamousSkillTooltip?.();
            return this.renderCanvasSurface();
          },

      resetForCanvasTabSwitch() {
            this.showResourceDetails = false;
            this.showCitySwitcher = false;
            this.showSubcityList = false;
            this.showCityManagement = false;
            this.activeEventId = null;
            this.showTaskCenter = false;
            this.showGuidebook = false;
            this.showFamousPersons = false;
            this.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], page: 0, saving: false };
            this.activeCommandPanel = '';
            this.rewardReveal = null;
            this.famousPersonsPage = 0;
            this.selectedFamousPersonId = '';
            if (this.canvasShell && 'selectedFamousPersonId' in this.canvasShell) this.canvasShell.selectedFamousPersonId = '';
            if (this.canvasShell) this.canvasShell.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], page: 0, saving: false };
            this.renderer?.clearFamousSkillTooltip?.();
            this.activeBuildingCategory = 'all';
            this.buildingOffset = 0;
            this.techTreePanX = 0;
            this.techTreePanY = 0;
            this.techTreeZoom = 1;
            this.techDetailOpen = false;
            if (this.canvasShell) this.canvasShell.selectedTechId = '';
            if (this.canvasShell) this.canvasShell.techDetailOpen = false;
            this.state = {
              ...this.state,
              techUiState: {
                ...(this.state.techUiState || {}),
                selectedTechId: '',
                detailOpen: false,
              },
            };
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
            this.techDetailOpen = false;
            this.techTreeDragStart = null;
            this.activeEventId = null;
            this.territoryUiState = {
              ...(this.territoryUiState || {}),
              selectedSiteId: '',
              worldMarchTarget: null,
              selectedWorldActorId: '',
              expeditionConfigSiteId: '',
              expeditionSoldiers: '',
              expeditionTroopType: '',
              expeditionLeader: '',
            };
            this.territoryController?.closeSiteDialog?.({ render: false });
            this.showResourceDetails = false;
            this.showCitySwitcher = false;
            this.showSubcityList = false;
            this.showCityManagement = false;
            this.showTaskCenter = false;
            this.showGuidebook = false;
            this.showFamousPersons = false;
            this.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], page: 0, saving: false };
            this.activeCommandPanel = '';
            this.famousPersonsPage = 0;
            this.selectedFamousPersonId = '';
            this.renderer?.clearFamousSkillTooltip?.();
            this.activeTaskCenterTab = 'main';
            this.activeGuidebookTab = 'planning';
            this.activeGuideNavigation = null;
            this.pageTransition = null;
            this.buildingTransition = null;
            if (this.canvasShell) this.canvasShell.selectedTechId = '';
            if (this.canvasShell) this.canvasShell.techDetailOpen = false;
            if (this.canvasShell && 'selectedFamousPersonId' in this.canvasShell) this.canvasShell.selectedFamousPersonId = '';
            if (this.canvasShell) {
              this.canvasShell.territoryUiState = {
                ...(this.canvasShell.territoryUiState || {}),
                selectedSiteId: '',
                worldMarchTarget: null,
                selectedWorldActorId: '',
                expeditionConfigSiteId: '',
                expeditionSoldiers: '',
                expeditionTroopType: '',
                expeditionLeader: '',
              };
              this.canvasShell.closeWorldSiteHud?.({ render: false });
            }
            if (this.canvasShell) this.canvasShell.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], page: 0, saving: false };
            if (this.state && typeof this.state === 'object') {
              this.state = {
                ...this.state,
                currentTab: homeView.activeTab,
                militaryView: homeView.militaryView,
                techUiState: {
                  ...(this.state.techUiState || {}),
                  selectedTechId: '',
                  detailOpen: false,
                },
              };
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
            this.state = {
              ...this.state,
              currentTab: this.activeTab,
              militaryView: homeView.militaryView,
              techUiState: {
                ...(this.state.techUiState || {}),
                detailOpen: false,
              },
            };
            if (preferredMilitaryView && !homeView.isMapHome) this.state.militaryView = preferredMilitaryView;
            this.militaryView = this.state.militaryView || homeView.militaryView;
            this.buildingOffset = 0;
            this.techTreePanX = 0;
            this.techTreePanY = 0;
            this.techTreeZoom = 1;
            this.techDetailOpen = false;
            this.techTreeDragStart = null;
            this.buildingTransition = null;
            if (this.canvasShell) this.canvasShell.techDetailOpen = false;
            if (this.canvasShell) this.canvasShell.techTreeZoom = 1;
            this.startPageTransition(previousTab, this.activeTab, { fromBuildingOffset: previousBuildingOffset });
            this.activeEventId = null;
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
            this.state = { ...this.state, militaryView: this.militaryView };
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
              if (this.state) this.state.militaryView = 'world';
              return;
            }
            const view = this.presenter?.buildMilitaryNavigationViewState?.(this.state);
            if (view?.activeView) {
              this.militaryView = view.activeView;
              if (this.state) this.state.militaryView = view.activeView;
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
              this.state = {
                ...this.state,
                currentTab: homeView.activeTab,
                militaryView: homeView.militaryView,
              };
            }
            this.renderCanvasSurface(homeView.activeTab);
          },
    });
    CanvasGameAppWorldMapRuntimeBridge?.install?.(CanvasGameApp);
    return true;
  }

  const api = { install };

  global.CanvasGameAppRenderingRuntime = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
