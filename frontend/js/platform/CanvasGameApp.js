(function (global) {
  var WorldMapRuntimeCoordinatorBase = global.WorldMapRuntimeCoordinator;
  if (typeof module !== 'undefined' && module.exports && !WorldMapRuntimeCoordinatorBase) {
    WorldMapRuntimeCoordinatorBase = require('./WorldMapRuntimeCoordinator');
  }
  var GameCommandServiceBase = global.GameCommandService;
  if (typeof module !== 'undefined' && module.exports && !GameCommandServiceBase) {
    GameCommandServiceBase = require('./GameCommandService');
  }
  var TutorialGuideControllerBase = global.TutorialGuideController;
  if (typeof module !== 'undefined' && module.exports && !TutorialGuideControllerBase) {
    try {
      TutorialGuideControllerBase = require('../tutorial/TutorialGuideController');
    } catch (error) {
      TutorialGuideControllerBase = null;
    }
  }

  class CanvasGameApp {
    constructor(options = {}) {
      this.runtime = options.runtime || null;
      const runtimeRequired = options.runtimeRequired !== false;
      if (!this.runtime && runtimeRequired) throw new Error('Canvas game runtime is required');
      this.presenter = options.presenter || null;
      this.config = options.config || {};
      const ApiClass = options.apiClass || null;
      const RendererClass = options.rendererClass || null;
      const apiRequired = options.apiRequired !== false;
      this.api = options.api || (ApiClass ? new ApiClass(
        options.apiBase || this.config.API_BASE || '/api',
        this.runtime?.getStorage?.('token'),
        { transport: this.runtime },
      ) : null);
      if (!this.api && apiRequired) throw new Error('Canvas game API is required');
      const rendererRequired = options.rendererRequired !== false;
      this.renderer = options.renderer || (RendererClass ? new RendererClass({
        runtime: this.runtime,
        presenter: this.presenter,
      }) : null);
      if (!this.renderer && rendererRequired) throw new Error('Canvas game renderer is required');
      if (typeof this.renderer?.setAssetsChangedHandler === 'function') {
        this.renderer.setAssetsChangedHandler(() => this.render());
      }
      this.loading = {
        visible: false,
        percentage: 0,
        message: '',
      };
      this.pendingBuildingAction = null;
      this.hasServerState = Boolean(options.hasServerState);
      this.syncIntervalMs = options.syncIntervalMs || this.config.SYNC_INTERVAL_MS || 2000;
      this.state = options.initialState || {
        resources: {},
        population: {},
        currentEra: 0,
        softGuide: null,
      };
      this.mapHomeActive = false;
      const initialHome = this.resolveMapHomeViewState({
        ...this.state,
        currentTab: options.activeTab || this.state.currentTab || 'resources',
        militaryView: options.militaryView || this.state.militaryView || 'army',
      }, {
        requestedTab: options.activeTab || this.state.currentTab || 'resources',
        militaryView: options.militaryView || this.state.militaryView || 'army',
      });
      this.activeTab = initialHome.activeTab;
      this.militaryView = initialHome.militaryView;
      this.mapHomeActive = initialHome.isMapHome;
      this.state = {
        ...this.state,
        currentTab: initialHome.activeTab,
        militaryView: initialHome.militaryView,
      };
      this.showResourceDetails = false;
      this.showCitySwitcher = false;
      this.showSubcityList = false;
      this.showCityManagement = false;
      this.activeCityManagementTab = 'buildings';
      this.showTaskCenter = false;
      this.activeTaskCenterTab = 'main';
      this.showGuidebook = false;
      this.activeGuidebookTab = 'planning';
      this.showFamousPersons = false;
      this.famousPersonsPage = 0;
      this.selectedFamousPersonId = '';
      this.showTalentPolicy = false;
      this.talentPolicyUiState = {};
      this.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], page: 0, saving: false };
      this.activeCommandPanel = '';
      this.rewardReveal = null;
      this.battleScene = null;
      this.battleSceneTimer = null;
      this.battleAnimationTimer = null;
      this.tutorialHighlight = null;
      this.tutorialIntro = options.tutorialIntro || null;
      this.tutorialIntroOverlay = options.tutorialIntroOverlay || null;
      this.highlightTimer = null;
      this.skipNextSoftGuideRender = false;
      this.suppressSoftGuideRenderOnce = false;
      this.activeGuideNavigation = null;
      this.buildingOffset = 0;
      this.activeBuildingCategory = 'all';
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
      this.pageTransition = null;
      this.buildingTransition = null;
      this.transitionTimer = null;
      this.lastAnimationRenderAt = 0;
      this.animationRenderQueued = false;
      this.tileMapWaterTimer = null;
      this.activeEventId = null;
      this.naming = {
        visible: false,
        view: null,
        prompt: null,
        inputValue: '',
        submitting: false,
      };
      this.territoryUiState = {
        selectedSiteId: '',
        worldPanX: 0,
        worldPanY: 0,
        expeditionConfigSiteId: '',
        expeditionTroopType: '',
        expeditionLeader: '',
        expeditionSoldiers: '',
      };
      this.externalLog = typeof options.log === 'function' ? options.log : null;
      this.stateNormalizer = options.stateNormalizer || null;
      this.stateManager = options.stateManager || null;
      const TutorialGuideControllerCtor = options.tutorialControllerClass || TutorialGuideControllerBase || null;
      this.tutorialController = options.tutorialController || (TutorialGuideControllerCtor ? new TutorialGuideControllerCtor({ game: this }) : null);
      this.tutorialRenderer = options.tutorialRenderer || null;
      this.eventController = options.eventController || null;
      this.buildingController = options.buildingController || null;
      this.territoryController = options.territoryController || null;
      this.canvasShell = options.canvasShell || null;
      this.worldMapRuntime = options.worldMapRuntime || null;
      this.worldMapRuntimeCoordinator = options.worldMapRuntimeCoordinator || null;
      this.scheduler = options.scheduler || this.runtime || null;
      this.useWorldMapRuntime = options.useWorldMapRuntime !== false;
      this.worldMapPinchDragging = false;
      this.worldMapDragWaterTimeMs = null;
      this.worldMapDragCooldownUntil = 0;
      const SyncCtor = options.syncClass || global.GameStateSync || null;
      this.syncService = options.syncService || (SyncCtor && this.api
        ? new SyncCtor(this.api, this.config?.HEARTBEAT_INTERVAL_MS || 1000, this.scheduler || this.runtime || {})
        : null);
      if (this.syncService) {
        if (!this.syncService.onHeartbeat) this.syncService.onHeartbeat = (data) => this.applyHeartbeat(data);
        if (!this.syncService.onConnectionState) this.syncService.onConnectionState = (state) => this.applyConnectionState(state);
        if (!this.syncService.onError) {
          this.syncService.onError = (error) => {
            if (error?.payload?.error && this.handleAuthError) this.handleAuthError(error.payload);
          };
        }
      }
      this.updateChecker = options.updateChecker || null;
      this.networkState = {
        status: 'online',
        failureCount: 0,
        serverTime: null,
        heartbeatSeq: 0,
      };
      this.requestLogs = [];
      this.recentLogs = [];
      this.activeAdvisor = null;
      this.activeNamingPrompt = null;
      this.activeNamingPromptKey = null;
      this.scoutCountdownTimer = null;
      const CommandServiceCtor = options.commandServiceClass || GameCommandServiceBase || null;
      this.commandService = options.commandService || (CommandServiceCtor ? new CommandServiceCtor({ host: this }) : null);
      if (this.commandService && !this.commandService.host) this.commandService.host = this;
      const DispatcherCtor = global.CanvasActionDispatcher;
      this.actionDispatcher = options.actionDispatcher || (DispatcherCtor ? new DispatcherCtor() : null);
      const ActionControllerCtor = global.CanvasActionController || (typeof require === 'function' ? require('./CanvasActionController') : null);
      this.actionController = options.actionController || (ActionControllerCtor ? new ActionControllerCtor({
        host: this,
        awaitAsync: true,
        log: (message) => this.log(message),
      }) : null);
      this.guideController = options.guideController || null;
      this.timer = null;
      this.tapDisposer = null;
      this.dragDisposer = null;
      this.gestureDisposer = null;
      this.ensureWorldMapRuntime();
    }

    applyState(payload = {}) {
      const nextState = payload.gameState || payload.state || this.state;
      const nextTutorial = payload.tutorial ?? nextState.tutorial ?? this.tutorial ?? {};
      const localTab = this.getActiveTab();
      const localMilitaryView = this.state?.militaryView || this.militaryView || nextState.militaryView || 'army';
      const homeView = this.resolveMapHomeViewState(nextState, {
        requestedTab: localTab,
        militaryView: localMilitaryView,
        forceMapHome: this.mapHomeActive && (localTab === 'resources' || localTab === 'military'),
      });
      this.state = {
        ...nextState,
        currentTab: homeView.activeTab,
        militaryView: homeView.militaryView,
        softGuide: payload.softGuide ?? nextState.softGuide ?? null,
        guideTasks: payload.guideTasks ?? nextState.guideTasks ?? { visible: false, tasks: [] },
        taskCenter: payload.taskCenter ?? nextState.taskCenter ?? null,
        eraProgress: payload.eraProgress ?? nextState.eraProgress,
      };
      this.tutorial = nextTutorial;
      this.activeTab = this.state.currentTab || homeView.activeTab;
      this.militaryView = this.state.militaryView || homeView.militaryView;
      this.mapHomeActive = homeView.isMapHome;
      const api = this.getGameApi();
      if (payload.token && api) {
        api.setToken?.(payload.token);
        this.runtime?.setStorage?.('token', payload.token);
      }
      this.hasServerState = true;
      if (this.loading.visible || this.canvasShell?.loading?.visible) {
        this.loading = { visible: false, percentage: 100, message: '' };
        if (this.canvasShell?.loading) this.canvasShell.loading = { visible: false, percentage: 100, message: '' };
      }
      this.tutorialController?.sync?.(nextTutorial);
      this.setPendingBuildingAction(null, { render: false });
      this.render();
    }

    getGameApi() {
      return this.gameAPI || this.api;
    }

    applyApiState(data = {}) {
      if (this.stateNormalizer?.normalizeGameState) {
        const nextState = this.stateNormalizer.normalizeGameState(data);
        this.tutorial = this.stateNormalizer.normalizeTutorialState?.(data) || this.tutorial || {};
        this.syncFromServer(nextState, data.tutorial, data.eraProgress);
        return;
      }
      this.applyState(data);
    }

    syncFromServer(serverState, tutorial, eraProgress) {
      const localTab = this.getActiveTab();
      const localMilitaryView = this.state?.militaryView || this.militaryView || 'army';
      const homeView = this.resolveMapHomeViewState(serverState, {
        requestedTab: localTab,
        militaryView: localMilitaryView,
        forceMapHome: this.mapHomeActive && (localTab === 'resources' || localTab === 'military'),
      });
      if (this.stateManager && typeof this.stateManager === 'object') {
        this.stateManager.state = {
          ...(this.stateManager.state || {}),
          ...(this.state || {}),
          currentTab: homeView.activeTab,
          militaryView: homeView.militaryView,
        };
      }
      this.state = this.stateManager?.sync
        ? this.stateManager.sync(serverState, eraProgress)
        : {
          ...serverState,
          currentTab: homeView.activeTab,
          militaryView: homeView.militaryView,
          eraProgress: eraProgress ?? serverState?.eraProgress,
        };
      const syncedHomeView = this.resolveMapHomeViewState(this.state, {
        requestedTab: homeView.activeTab,
        militaryView: homeView.militaryView,
        forceMapHome: homeView.isMapHome,
      });
      this.state = {
        ...this.state,
        currentTab: syncedHomeView.activeTab,
        militaryView: syncedHomeView.militaryView,
      };
      this.activeTab = this.state.currentTab || syncedHomeView.activeTab;
      this.militaryView = this.state.militaryView || syncedHomeView.militaryView;
      this.mapHomeActive = syncedHomeView.isMapHome;
      const nextTutorial = this.getEffectiveTutorialState(tutorial || this.tutorial || {});
      this.tutorial = nextTutorial;
      this.state = {
        ...this.state,
        tutorial: nextTutorial,
      };
      this.tutorialController?.sync?.(nextTutorial);
      this.updateSyncInterval();
      this.hasServerState = true;
      if (this.loading.visible || this.canvasShell?.loading?.visible) {
        this.loading = { visible: false, percentage: 100, message: '' };
        if (this.canvasShell?.loading) this.canvasShell.loading = { visible: false, percentage: 100, message: '' };
      }
      this.setPendingBuildingAction(null, { render: false });
      this.render();
    }

    getSyncInterval() {
      return this.config?.SYNC_INTERVAL_MS || this.syncIntervalMs;
    }

    updateSyncInterval() {
      this.syncService?.setIntervalMs?.(this.getSyncInterval());
    }

    applyHeartbeat(data = {}) {
      if (!data || data.gameState) return data;
      const wasReconnecting = this.networkState?.status === 'reconnecting';
      this.networkState = {
        ...(this.networkState || {}),
        status: 'online',
        failureCount: 0,
        serverTime: data.serverTime || this.networkState?.serverTime || null,
        heartbeatSeq: Number(data.heartbeatSeq) || this.networkState?.heartbeatSeq || 0,
      };
      if (this.canvasShell?.setNetworkState) this.canvasShell.setNetworkState(this.networkState);
      else if (wasReconnecting) this.renderCanvasSurface(this.state?.currentTab);
      return data;
    }

    applyConnectionState(status = {}) {
      const nextStatus = status.status || 'online';
      const wasReconnecting = this.networkState?.status === 'reconnecting';
      this.networkState = {
        ...(this.networkState || {}),
        status: nextStatus,
        failureCount: Number(status.failureCount) || 0,
        lastError: status.error?.message || status.error?.payload?.message || null,
      };
      if (this.canvasShell?.setNetworkState) this.canvasShell.setNetworkState(this.networkState);
      else if (nextStatus === 'reconnecting' || wasReconnecting) this.renderCanvasSurface(this.state?.currentTab);
      return this.networkState;
    }

    getBuildingLevel(buildingId) {
      const entry = this.state?.buildings?.[buildingId];
      if (!entry) return 0;
      return typeof entry === 'object' ? entry.level || 0 : Number(entry) || 0;
    }

    isEra2AdvanceReady(progress = this.state?.eraProgress) {
      return this.state?.currentEra === 1
        && Boolean(progress?.canAdvance)
        && this.getBuildingLevel('house') > 0;
    }

    getEffectiveTutorialState(tutorial) {
      const nextTutorial = tutorial || { completed: false, currentStep: 0, phaseCompleted: { newbie: false, era2: false } };
      const tutorialSteps = this.tutorialController?.constructor?.TUTORIAL_STEPS || TutorialGuideControllerBase?.TUTORIAL_STEPS || {};
      if (!nextTutorial.completed && nextTutorial.currentStep === tutorialSteps.farmBuilt && this.isEra2AdvanceReady()) {
        return {
          ...nextTutorial,
          currentStep: tutorialSteps.era2AdvanceReady,
          phaseCompleted: {
            ...nextTutorial.phaseCompleted,
            newbie: true,
          },
        };
      }
      return nextTutorial;
    }

    canAdvanceEraByTutorial() {
      return true;
    }

    canAdvanceEraNow(progress = this.state?.eraProgress) {
      const tutorial = this.getEffectiveTutorialState(this.tutorial || this.state?.tutorial || {});
      const view = this.presenter?.buildCivilizationViewState?.(
        { ...this.state, eraProgress: progress },
        tutorial,
        { canOpenCivilizationTab: true },
      );
      return Boolean(view?.advanceButton?.canAdvance);
    }

    hasActiveTutorialGuideHighlight() {
      return false;
    }

    render() {
      this.renderMilitaryView();
      this.renderSoftGuide({ skipSurface: true });
      this.maybeShowNamingPrompt();
      this.renderCanvasSurface();
    }

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
        this.tutorialController?.refreshCurrentHighlight?.();
        return true;
      }
      if (!this.renderer?.render) return false;
      const runtimeCanRenderWorldMap = Boolean(homeView.isMapHome
        && this.ensureWorldMapRuntimeCoordinator()?.canRender(this.state));
      const worldMapLayerRendered = runtimeCanRenderWorldMap
        ? (this.shouldRenderRuntimeWorldMap()
          ? this.renderRuntimeWorldMap() !== false
          : Boolean(this.worldMapRuntime?.hasBakedMapLayer))
        : false;
      this.renderer.render(this.state, {
        activeTab: resolvedActiveTab,
        isMapHome: homeView.isMapHome,
        skipWorldMapLayer: worldMapLayerRendered,
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
        showTalentPolicy: this.showTalentPolicy,
        talentPolicyUiState: this.talentPolicyUiState,
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
        tutorialHighlight: null,
        loading: this.loading,
        network: this.networkState,
      });
      const waterAnimated = Boolean(this.territoryUiState?.tileMapWaterAnimated
        || this.territoryController?.uiState?.tileMapWaterAnimated);
      if (resolvedActiveTab === 'military' && waterAnimated) this.startTileMapWaterTimer();
      else this.stopTileMapWaterTimer();
      return true;
    }

    startTileMapWaterTimer() {
      if (this.tileMapWaterTimer) return false;
      const timerHost = typeof this.scheduler?.setInterval === 'function'
        ? this.scheduler
        : (typeof this.runtime?.setInterval === 'function' ? this.runtime : null);
      const setIntervalFn = timerHost?.setInterval || (typeof setInterval === 'function' ? setInterval : null);
      if (!setIntervalFn) return false;
      this.tileMapWaterTimer = timerHost
        ? setIntervalFn.call(timerHost, () => {
          if ((this.state?.currentTab || this.getActiveTab()) !== 'military') {
            this.stopTileMapWaterTimer();
            return;
          }
          if (this.isWorldMapDragging() || this.isWorldMapDragCoolingDown()) return;
          if (this.isWorldMapHomeActive() && !this.shouldRenderRuntimeWorldMap()) {
            this.renderRuntimeWorldMap({
              reuseCachedWorldTileView: true,
              snapshotOnly: true,
              waterTimeMs: this.now(),
            });
            return;
          }
          this.renderAnimationFrame('military');
        }, this.getWorldTileWaterAnimationFrameMs())
        : setIntervalFn(() => {
          if ((this.state?.currentTab || this.getActiveTab()) !== 'military') {
            this.stopTileMapWaterTimer();
            return;
          }
          if (this.isWorldMapDragging() || this.isWorldMapDragCoolingDown()) return;
          if (this.isWorldMapHomeActive() && !this.shouldRenderRuntimeWorldMap()) {
            this.renderRuntimeWorldMap({
              reuseCachedWorldTileView: true,
              snapshotOnly: true,
              waterTimeMs: this.now(),
            });
            return;
          }
          this.renderAnimationFrame('military');
        }, this.getWorldTileWaterAnimationFrameMs());
      return true;
    }

    stopTileMapWaterTimer() {
      if (!this.tileMapWaterTimer) return;
      if (typeof this.scheduler?.clearInterval === 'function') this.scheduler.clearInterval(this.tileMapWaterTimer);
      else if (typeof this.runtime?.clearInterval === 'function') this.runtime.clearInterval(this.tileMapWaterTimer);
      else if (typeof clearInterval === 'function') clearInterval(this.tileMapWaterTimer);
      this.tileMapWaterTimer = null;
    }

    showLoading(message = '') {
      this.loading = {
        visible: true,
        percentage: 0,
        message: message || '\u6b63\u5728\u6574\u7406\u8425\u5730\u8d44\u6e90',
      };
      this.canvasShell?.showLoading?.(this.loading.message);
      this.renderCanvasSurface();
      return true;
    }

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
    }

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
    }

    preloadAssets(onProgress = null, assetPaths = null) {
      if (this.canvasShell && typeof this.canvasShell.preloadAssets === 'function') {
        return this.canvasShell.preloadAssets(onProgress, assetPaths);
      }
      if (!this.renderer || typeof this.renderer.preloadAssets !== 'function') {
        onProgress?.({ total: 0, completed: 0, loaded: 0, failed: 0, percentage: 100 });
        return Promise.resolve({ total: 0, completed: 0, loaded: 0, failed: 0, percentage: 100 });
      }
      return this.renderer.preloadAssets(assetPaths || undefined, onProgress);
    }

    now() {
      return this.runtime?.now?.() || Date.now();
    }

    wait(ms = 0) {
      const delay = Math.max(0, Number(ms) || 0);
      if (delay <= 0) return Promise.resolve();
      if (this.scheduler && typeof this.scheduler.setTimeout === 'function') {
        return new Promise((resolve) => this.scheduler.setTimeout(resolve, delay));
      }
      if (typeof setTimeout === 'function') {
        return new Promise((resolve) => setTimeout(resolve, delay));
      }
      return Promise.resolve();
    }

    async loadGameAssets(options = {}) {
      const message = options.message || '\u6b63\u5728\u6574\u7406\u8425\u5730\u8d44\u6e90';
      const hideWhenDone = options.hideWhenDone !== false;
      const minimumDurationMs = Number.isFinite(options.minimumDurationMs)
        ? Math.max(0, options.minimumDurationMs)
        : 3000;
      const startedAt = this.now();
      this.showLoading(message);
      try {
        const result = await this.preloadAssets((progress) => {
          this.updateLoading({ ...progress, message });
        }, options.assetPaths || null);
        const elapsed = Math.max(0, this.now() - startedAt);
        await this.wait(Math.max(0, minimumDurationMs - elapsed));
        return result;
      } finally {
        this.updateLoading({ percentage: 100, message });
        if (hideWhenDone) this.hideLoading();
      }
    }

    getActiveTab() {
      return this.activeTab || this.state?.currentTab || 'resources';
    }

    resolveMapHomeViewState(state = this.state, options = {}) {
      if (this.presenter?.resolveMapHomeViewState) {
        return this.presenter.resolveMapHomeViewState(state || {}, options);
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
    }

    getTabOrder() {
      return ['resources', 'buildings', 'tech', 'events', 'civilization', 'military'];
    }

    getTransitionDurationMs() {
      return 220;
    }

    getAnimationFrameMs() {
      return this.canvasShell?.getAnimationFrameMs?.() || 16;
    }

    getWorldTileWaterAnimationFrameMs() {
      if (this.canvasShell?.getWorldTileWaterAnimationFrameMs) return this.canvasShell.getWorldTileWaterAnimationFrameMs();
      const fps = Number(this.renderer?.getWorldTileWaterAnimationFps?.() || 8);
      return Math.max(this.getAnimationFrameMs(), Math.round(1000 / Math.max(1, fps)));
    }

    getFrozenWorldMapWaterTimeMs() {
      if (
        this.worldMapDragWaterTimeMs === null
        || this.worldMapDragWaterTimeMs === undefined
        || !Number.isFinite(Number(this.worldMapDragWaterTimeMs))
      ) {
        this.worldMapDragWaterTimeMs = this.now();
      }
      return this.worldMapDragWaterTimeMs;
    }

    isWorldMapDragging() {
      return this.worldMapDragWaterTimeMs !== null
        && this.worldMapDragWaterTimeMs !== undefined
        && Number.isFinite(Number(this.worldMapDragWaterTimeMs));
    }

    isWorldMapDragCoolingDown() {
      return Number(this.worldMapDragCooldownUntil) > this.now();
    }

    getWorldMapDragCooldownMs() {
      return 220;
    }

    startWorldMapSnapshotDrag() {
      this.worldMapDragWaterTimeMs = this.now();
      return this.worldMapDragWaterTimeMs;
    }

    finishWorldMapSnapshotDrag() {
      this.worldMapDragCooldownUntil = this.now() + this.getWorldMapDragCooldownMs();
      this.worldMapDragWaterTimeMs = null;
      this.worldMapPinchDragging = false;
      if (this.worldMapRuntime) this.worldMapRuntime.waterTimeMs = null;
    }

    renderWorldMapSnapshotDragFrame() {
      if (!this.renderer || typeof this.renderer.renderWorldMapSnapshotLayer !== 'function') return false;
      const coordinator = this.ensureWorldMapRuntimeCoordinator();
      const runtime = coordinator?.getMapRuntime?.();
      if (!runtime || !coordinator?.canRender?.(this.state)) return false;
      const territoryUiState = runtime.getCameraUiState?.() || this.territoryUiState;
      const topBarBottom = typeof this.renderer.getTopBarBottom === 'function'
        ? this.renderer.getTopBarBottom(this.state, { isMapHome: true })
        : 84;
      const rendered = this.renderer.renderWorldMapSnapshotLayer(this.state, {
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
      this.renderer.render(this.state, {
        activeTab: 'military',
        isMapHome: true,
        skipWorldMapLayer: true,
        preserveCanvas: true,
        territoryUiState,
        network: this.networkState,
      });
      return true;
    }

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
    }

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
        getBaseUiState: () => this.territoryController?.uiState
          || this.territoryController?.getUiState?.()
          || this.territoryUiState
          || {},
        getLocalUiState: () => this.territoryUiState || {},
        getTerritoryController: () => this.territoryController,
        getTopBarBottom: (state) => (typeof this.renderer?.getTopBarBottom === 'function'
          ? this.renderer.getTopBarBottom(state, { isMapHome: true })
          : 84),
        getRequestedTab: (state = this.state) => state?.currentTab || this.activeTab || 'resources',
        getMilitaryView: (state = this.state) => state?.militaryView || this.militaryView,
        getForceMapHome: () => this.mapHomeActive,
        canRouteTap: (point) => !this.isPointBlockedByTutorialShield(point),
        onAction: (action) => {
          const handled = this.actionController?.handle?.(action);
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
    }

    ensureWorldMapRuntime() {
      const coordinator = this.ensureWorldMapRuntimeCoordinator();
      if (!coordinator) return this.worldMapRuntime;
      this.worldMapRuntime = coordinator.ensureRuntime();
      return this.worldMapRuntime;
    }

    isWorldMapHomeActive() {
      const coordinator = this.ensureWorldMapRuntimeCoordinator();
      if (coordinator) return coordinator.isMapHomeActive(this.state);
      const homeView = this.resolveMapHomeViewState(this.state, {
        requestedTab: this.state?.currentTab || this.activeTab || 'resources',
        militaryView: this.state?.militaryView || this.militaryView,
        forceMapHome: this.mapHomeActive,
      });
      return Boolean(homeView.isMapHome && homeView.activeTab === 'military' && homeView.militaryView === 'world');
    }

    renderRuntimeWorldMap(options = {}) {
      const coordinator = this.ensureWorldMapRuntimeCoordinator();
      if (!coordinator) return false;
      const rendered = coordinator.render(this.state, options);
      this.worldMapRuntime = coordinator.getMapRuntime();
      return rendered;
    }

    shouldRenderRuntimeWorldMap(options = {}) {
      const coordinator = this.ensureWorldMapRuntimeCoordinator();
      const runtime = coordinator?.getMapRuntime?.();
      if (!coordinator?.canRender?.(this.state)) return false;
      if (!runtime || typeof runtime.isMapBakeDirty !== 'function') return true;
      return Boolean(options.force || runtime.isMapBakeDirty(this.state));
    }

    refreshWorldMapLayerFromSnapshot(options = {}) {
      const coordinator = this.ensureWorldMapRuntimeCoordinator();
      const runtime = coordinator?.getMapRuntime?.();
      if (!runtime || !this.renderer || typeof this.renderer.renderWorldMapSnapshotLayer !== 'function') return false;
      const territoryUiState = runtime.getCameraUiState?.() || this.territoryUiState;
      const rendered = this.renderer.renderWorldMapSnapshotLayer(this.state, {
        activeTab: 'military',
        isMapHome: true,
        territoryUiState,
        topBarBottom: typeof this.renderer.getTopBarBottom === 'function'
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
      if (options.commitCamera !== false) runtime.markBakedCamera?.(runtime.camera);
      return true;
    }

    getRequestAnimationFrame() {
      const raf = this.runtime?.requestAnimationFrame || global.requestAnimationFrame;
      return typeof raf === 'function' ? raf.bind(this.runtime || global) : null;
    }

    renderAnimationFrame(activeTab = this.state?.currentTab || this.getActiveTab()) {
      if (this.canvasShell && typeof this.canvasShell.renderAnimationFrame === 'function') {
        return this.canvasShell.renderAnimationFrame();
      }
      const now = this.now();
      const frameMs = Math.max(1, this.getAnimationFrameMs() - 1);
      if (this.lastAnimationRenderAt && now - this.lastAnimationRenderAt < frameMs) return false;
      this.lastAnimationRenderAt = now;
      return this.renderCanvasSurface(activeTab);
    }

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
    }

    getBattleBaseTurnDurationMs() {
      return 900;
    }

    getBattleSkillCutInDurationMs() {
      return 2200;
    }

    getBattleTurnDurationMs(turn = null) {
      const isSkill = turn && (turn.action === 'skill' || turn.actionType === 'skill' || turn.presentation?.cutIn);
      return this.getBattleBaseTurnDurationMs() + (isSkill ? this.getBattleSkillCutInDurationMs() : 0);
    }

    getCurrentBattleTurnDurationMs(scene = this.battleScene) {
      const turns = scene?.report?.turns || [];
      const index = Math.max(0, Math.min(turns.length, Number(scene?.turnIndex) || 0));
      return this.getBattleTurnDurationMs(index < turns.length ? turns[index] : null);
    }

    syncBattleSceneToShell() {
      if (this.canvasShell) this.canvasShell.battleScene = this.battleScene;
    }

    startBattleScene(report = null) {
      if (!report) return false;
      this.battleScene = {
        visible: true,
        report,
        turnIndex: 0,
        startedAt: this.now(),
        turnStartedAt: this.now(),
        turnDurationMs: this.getBattleTurnDurationMs(report.turns?.[0] || null),
      };
      this.canvasShell?.startBattleScene?.(report);
      this.syncBattleSceneToShell();
      this.startBattleSceneTimer();
      this.startBattleAnimationTimer();
      this.renderCanvasSurface(this.state?.currentTab || 'military');
      return true;
    }

    stopBattleSceneTimer() {
      if (!this.battleSceneTimer) return;
      if (typeof this.scheduler?.clearTimeout === 'function') this.scheduler.clearTimeout(this.battleSceneTimer);
      else if (typeof this.runtime?.clearTimeout === 'function') this.runtime.clearTimeout(this.battleSceneTimer);
      else if (typeof clearTimeout === 'function') clearTimeout(this.battleSceneTimer);
      else if (typeof this.scheduler?.clearInterval === 'function') this.scheduler.clearInterval(this.battleSceneTimer);
      else if (typeof this.runtime?.clearInterval === 'function') this.runtime.clearInterval(this.battleSceneTimer);
      else if (typeof clearInterval === 'function') clearInterval(this.battleSceneTimer);
      this.battleSceneTimer = null;
    }

    stopBattleAnimationTimer() {
      if (!this.battleAnimationTimer) return;
      if (typeof this.scheduler?.clearInterval === 'function') this.scheduler.clearInterval(this.battleAnimationTimer);
      else if (typeof this.runtime?.clearInterval === 'function') this.runtime.clearInterval(this.battleAnimationTimer);
      else if (typeof clearInterval === 'function') clearInterval(this.battleAnimationTimer);
      this.battleAnimationTimer = null;
    }

    startBattleAnimationTimer() {
      this.stopBattleAnimationTimer();
      const timerHost = typeof this.scheduler?.setInterval === 'function'
        ? this.scheduler
        : (typeof this.runtime?.setInterval === 'function' ? this.runtime : null);
      const setIntervalFn = timerHost?.setInterval || (typeof setInterval === 'function' ? setInterval : null);
      if (!setIntervalFn) return false;
      this.battleAnimationTimer = timerHost
        ? setIntervalFn.call(timerHost, () => {
          if (!this.battleScene?.visible) {
            this.stopBattleAnimationTimer();
            return;
          }
          this.renderAnimationFrame(this.state?.currentTab || 'military');
        }, this.getAnimationFrameMs())
        : setIntervalFn(() => {
          if (!this.battleScene?.visible) {
            this.stopBattleAnimationTimer();
            return;
          }
          this.renderAnimationFrame(this.state?.currentTab || 'military');
        }, this.getAnimationFrameMs());
      return true;
    }

    advanceBattleSceneTurn() {
      if (!this.battleScene?.visible) {
        this.stopBattleSceneTimer();
        return false;
      }
      const turns = this.battleScene.report?.turns || [];
      if (this.battleScene.turnIndex < turns.length) {
        const nextTurnIndex = this.battleScene.turnIndex + 1;
        this.battleScene = {
          ...this.battleScene,
          turnIndex: nextTurnIndex,
          turnStartedAt: this.now(),
          turnDurationMs: this.getBattleTurnDurationMs(nextTurnIndex < turns.length ? turns[nextTurnIndex] : null),
        };
        this.syncBattleSceneToShell();
        this.renderAnimationFrame(this.state?.currentTab || 'military');
        this.startBattleSceneTimer();
        return true;
      }
      this.stopBattleSceneTimer();
      this.stopBattleAnimationTimer();
      return false;
    }

    startBattleSceneTimer() {
      this.stopBattleSceneTimer();
      const timerHost = typeof this.scheduler?.setTimeout === 'function'
        ? this.scheduler
        : (typeof this.runtime?.setTimeout === 'function' ? this.runtime : null);
      const setTimeoutFn = timerHost?.setTimeout || (typeof setTimeout === 'function' ? setTimeout : null);
      if (!setTimeoutFn) return false;
      this.battleSceneTimer = timerHost
        ? setTimeoutFn.call(timerHost, () => this.advanceBattleSceneTurn(), this.getCurrentBattleTurnDurationMs())
        : setTimeoutFn(() => this.advanceBattleSceneTurn(), this.getCurrentBattleTurnDurationMs());
      return true;
    }

    closeBattleScene() {
      this.stopBattleSceneTimer();
      this.stopBattleAnimationTimer();
      this.battleScene = null;
      this.canvasShell?.closeBattleScene?.();
      this.renderCanvasSurface(this.state?.currentTab || 'military');
      return true;
    }

    skipBattleScene() {
      if (!this.battleScene?.visible) return false;
      const turns = this.battleScene.report?.turns || [];
      this.battleScene = {
        ...this.battleScene,
        turnIndex: turns.length,
        turnStartedAt: this.now(),
      };
      this.syncBattleSceneToShell();
      this.stopBattleSceneTimer();
      this.stopBattleAnimationTimer();
      this.renderCanvasSurface(this.state?.currentTab || 'military');
      return true;
    }

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
    }

    stopTransitionTimer() {
      if (!this.transitionTimer) return;
      this.runtime?.clearInterval?.(this.transitionTimer);
      this.transitionTimer = null;
    }

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
    }

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
    }

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
    }

    getCanvasActionState() {
      return this.state;
    }

    getTechTreePan() {
      return {
        x: Number(this.techTreePanX) || 0,
        y: Number(this.techTreePanY) || 0,
      };
    }

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
    }

    getTechTreeZoom() {
      return Math.max(0.65, Math.min(1.6, Number(this.techTreeZoom) || 1));
    }

    setTechTreeZoom(zoom = 1) {
      const nextZoom = Math.max(0.65, Math.min(1.6, Number(zoom) || 1));
      this.techTreeZoom = nextZoom;
      if (this.canvasShell && typeof this.canvasShell === 'object') this.canvasShell.techTreeZoom = nextZoom;
      return true;
    }

    renderCanvasAction() {
      return this.renderCanvasSurface();
    }

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
    }

    openFamousPersonDetail(action = {}) {
      this.selectedFamousPersonId = action.personId || '';
      if (this.canvasShell && typeof this.canvasShell === 'object' && 'selectedFamousPersonId' in this.canvasShell) {
        this.canvasShell.selectedFamousPersonId = this.selectedFamousPersonId;
      }
      this.renderer?.clearFamousSkillTooltip?.();
      return this.renderCanvasSurface();
    }

    closeFamousPersonDetail() {
      this.selectedFamousPersonId = '';
      if (this.canvasShell && typeof this.canvasShell === 'object' && 'selectedFamousPersonId' in this.canvasShell) {
        this.canvasShell.selectedFamousPersonId = '';
      }
      this.renderer?.clearFamousSkillTooltip?.();
      return this.renderCanvasSurface();
    }

    resetForCanvasTabSwitch() {
      this.showResourceDetails = false;
      this.showCitySwitcher = false;
      this.showSubcityList = false;
      this.showCityManagement = false;
      this.activeEventId = null;
      this.showTaskCenter = false;
      this.showGuidebook = false;
      this.showFamousPersons = false;
      this.showTalentPolicy = false;
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
    }

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
      this.showTalentPolicy = false;
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
    }

    openNaming(prompt = {}) {
      const view = this.presenter.buildNamingPromptViewState(prompt);
      this.activeNamingPrompt = prompt;
      this.activeNamingPromptKey = view.key;
      this.naming = {
        visible: true,
        view,
        prompt,
        inputValue: '',
        submitting: false,
      };
        this.showResourceDetails = false;
        this.showCitySwitcher = false;
        this.showSubcityList = false;
        this.showCityManagement = false;
        this.activeEventId = null;
        this.showFamousPersons = false;
        this.activeCommandPanel = '';
        if (this.canvasShell && typeof this.canvasShell.naming !== 'undefined') this.canvasShell.naming = this.naming;
        this.render();
        this.scheduleTutorialHighlightRefresh(80);
    }

    closeNaming() {
      this.activeNamingPrompt = null;
      this.activeNamingPromptKey = null;
      this.naming = {
        visible: false,
        view: null,
        prompt: null,
        inputValue: '',
        submitting: false,
      };
      if (this.canvasShell && typeof this.canvasShell.naming !== 'undefined') this.canvasShell.naming = this.naming;
      this.render();
    }

    scheduleTutorialHighlightRefresh(delayMs = 0) {
      const callback = () => this.tutorialController?.refreshCurrentHighlight?.();
      const scheduler = typeof this.scheduler?.setTimeout === 'function'
        ? this.scheduler
        : (typeof this.runtime?.setTimeout === 'function' ? this.runtime : null);
      if (scheduler) {
        scheduler.setTimeout(callback, delayMs);
        return true;
      }
      if (typeof setTimeout === 'function') {
        setTimeout(callback, delayMs);
        return true;
      }
      callback();
      return false;
    }

    async requestNamingInput() {
      if (!this.naming.visible || typeof this.runtime.requestTextInput !== 'function') return;
      const view = this.naming.view || {};
      const value = await this.runtime.requestTextInput({
        title: view.title || '鍛藉悕',
        message: view.message || '',
        placeholder: view.placeholder || '',
        value: this.naming.inputValue || '',
        maxLength: view.maxLength || 12,
      });
      if (value === null || value === undefined || !this.naming.visible) return;
      this.naming.inputValue = String(value).trim().slice(0, Number(view.maxLength) || 12);
      if (this.canvasShell && typeof this.canvasShell.naming !== 'undefined') this.canvasShell.naming = this.naming;
      this.render();
    }

    submitNaming(inputName = null) {
      return this.submitNamingValue(inputName);
    }

    async submitNamingValue(inputName = null) {
      const prompt = this.activeNamingPrompt || this.naming.prompt || {};
      const name = String(inputName ?? this.naming.inputValue ?? '').trim();
      if (!prompt.type || !name) return;
      let tutorialHandledView = false;
      this.naming.submitting = true;
      if (this.canvasShell && typeof this.canvasShell.naming !== 'undefined') this.canvasShell.naming = this.naming;
      this.render();
      try {
        const api = this.getGameApi();
        const result = prompt.type === 'polity'
          ? await api.renamePolity(name)
          : await api.renameCity(prompt.territoryId, name);
        this.closeNaming();
        this.applyApiState(result);
        this.tutorialController?.sync?.(this.tutorial || this.state?.tutorial || {});
        tutorialHandledView = this.tutorialController?.refreshCurrentHighlight?.() === true;
        this.showFloatingText(result.message);
        this.log(`鎴愬姛锟?{result.message || ''}`);
      } catch (error) {
        this.log(`澶辫触锟?{error.payload?.message || error.message}`);
      } finally {
        this.naming.submitting = false;
        if (!tutorialHandledView) this.renderCanvasSurface(this.state?.currentTab);
      }
    }

    async syncOnce() {
      const data = await this.api.getState();
      this.applyState(data);
      return data;
    }

    async startHeartbeat() {
      const api = this.getGameApi();
      api?.setToken?.(this.token);
      try {
        if (this.syncService?.stop) this.syncService.stop();
        await this.syncOnce();
        this.syncService?.start?.();
      } catch (error) {
        if (error.payload && error.payload.error && this.handleAuthError) {
          this.handleAuthError(error.payload);
        } else {
          this.applyConnectionState({ status: 'reconnecting', failureCount: 1, error });
        }
      }
    }

    stopHeartbeat() {
      this.syncService?.stop?.();
      this.updateChecker?.stop?.();
      if (this.scoutCountdownTimer) {
        this.scheduler?.clearInterval?.(this.scoutCountdownTimer);
        this.scoutCountdownTimer = null;
      }
    }

    showUpdatePrompt(version) {
      this.stopHeartbeat();
      return this.updateRuntime?.promptAndReload?.(version);
    }

    async runAction(callback) {
      try {
        const data = await callback();
        if (data) this.applyState(data);
        return data;
      } catch (error) {
        this.log(error.payload?.message || error.message || '鎿嶄綔澶辫触');
        return null;
      }
    }

    async seekFamousPerson(source = 'seek') {
      try {
        const result = await this.getGameApi().seekFamousPerson(source);
        this.applyApiState(result);
        this.showFamousPersons = true;
        this.famousPersonsPage = 0;
        this.selectedFamousPersonId = '';
        if (this.canvasShell && 'showFamousPersons' in this.canvasShell) this.canvasShell.showFamousPersons = true;
        if (this.canvasShell && 'famousPersonsPage' in this.canvasShell) this.canvasShell.famousPersonsPage = 0;
        if (this.canvasShell && 'selectedFamousPersonId' in this.canvasShell) this.canvasShell.selectedFamousPersonId = '';
        this.showFloatingText(result.message || '瀵昏瀹屾垚');
        this.log(result.message || '瀵昏瀹屾垚');
        return true;
      } catch (error) {
        this.log(`瀵昏澶辫触锟?{error.payload?.message || error.message}`);
        this.renderCanvasSurface(this.state?.currentTab);
        return false;
      }
    }

    async acceptFamousPerson(candidateId) {
      try {
        const result = await this.getGameApi().acceptFamousPerson(candidateId);
        this.applyApiState(result);
        this.showFamousPersons = true;
        this.famousPersonsPage = 0;
        this.selectedFamousPersonId = '';
        if (this.canvasShell && 'showFamousPersons' in this.canvasShell) this.canvasShell.showFamousPersons = true;
        if (this.canvasShell && 'famousPersonsPage' in this.canvasShell) this.canvasShell.famousPersonsPage = 0;
        if (this.canvasShell && 'selectedFamousPersonId' in this.canvasShell) this.canvasShell.selectedFamousPersonId = '';
        this.showFloatingText(result.message || 'Famous person accepted');
        this.log(result.message || 'Famous person accepted');
        return true;
      } catch (error) {
        this.log(`鎺ョ撼澶辫触锟?{error.payload?.message || error.message}`);
        this.renderCanvasSurface(this.state?.currentTab);
        return false;
      }
    }

    async dismissFamousPersonCandidate(candidateId) {
      try {
        const result = await this.getGameApi().dismissFamousPersonCandidate(candidateId);
        this.applyApiState(result);
        this.showFamousPersons = true;
        this.selectedFamousPersonId = '';
        if (this.canvasShell && 'showFamousPersons' in this.canvasShell) this.canvasShell.showFamousPersons = true;
        if (this.canvasShell && 'selectedFamousPersonId' in this.canvasShell) this.canvasShell.selectedFamousPersonId = '';
        this.showFloatingText(result.message || 'Candidate dismissed');
        this.log(result.message || 'Candidate dismissed');
        return true;
      } catch (error) {
        this.log(`鏀惧純澶辫触锟?{error.payload?.message || error.message}`);
        this.renderCanvasSurface(this.state?.currentTab);
        return false;
      }
    }

    async assignFamousAttributePoint(personId, attribute) {
      try {
        const result = await this.getGameApi().assignFamousAttributePoint(personId, attribute);
        this.applyApiState(result);
        this.showFamousPersons = true;
        if (this.canvasShell && 'showFamousPersons' in this.canvasShell) this.canvasShell.showFamousPersons = true;
        if (this.canvasShell && 'selectedFamousPersonId' in this.canvasShell) this.canvasShell.selectedFamousPersonId = personId;
        this.selectedFamousPersonId = personId;
        this.showFloatingText(result.message || '灞炴€у凡鎻愬崌');
        this.log(result.message || '灞炴€у凡鎻愬崌');
        return true;
      } catch (error) {
        this.log(`鍔犵偣澶辫触锟?{error.payload?.message || error.message}`);
        this.renderCanvasSurface(this.state?.currentTab);
        return false;
      }
    }

    getArmyFormation(cityId, slot) {
      const targetCityId = cityId || this.state?.activeCityId || this.state?.cityState?.activeCityId || 'capital';
      const targetSlot = Math.max(1, Math.min(3, Number(slot) || 1));
      const formations = this.state?.military?.formations || {};
      const cityFormations = Array.isArray(formations[targetCityId]) ? formations[targetCityId] : [];
      return cityFormations.find((item) => Number(item?.slot) === targetSlot) || cityFormations[targetSlot - 1] || null;
    }

    setArmyFormationEditor(editor = {}, options = {}) {
      this.armyFormationEditor = {
        open: false,
        cityId: '',
        slot: 1,
        memberIds: [],
        page: 0,
        saving: false,
        ...(editor || {}),
      };
      if (this.canvasShell && typeof this.canvasShell === 'object') {
        this.canvasShell.armyFormationEditor = { ...this.armyFormationEditor };
      }
      if (options.render !== false) this.renderCanvasSurface(this.state?.currentTab);
      return true;
    }

    openArmyFormation(action = {}) {
      const slot = Math.max(1, Math.min(3, Number(action.slot) || 1));
      const cityId = action.cityId || this.state?.activeCityId || this.state?.cityState?.activeCityId || 'capital';
      const formation = this.getArmyFormation(cityId, slot);
      const memberIds = Array.isArray(formation?.memberIds) ? formation.memberIds : [];
      return this.setArmyFormationEditor({
        open: true,
        cityId,
        slot,
        memberIds: [...memberIds].slice(0, 5),
        page: 0,
        saving: false,
      });
    }

    closeArmyFormationEditor(options = {}) {
      return this.setArmyFormationEditor({ open: false, cityId: '', slot: 1, memberIds: [], page: 0, saving: false }, options);
    }

    toggleArmyFormationMember(action = {}) {
      const editor = this.armyFormationEditor || {};
      if (!editor.open) return false;
      const personId = String(action.personId || '').trim();
      if (!personId) return false;
      const memberIds = Array.isArray(editor.memberIds) ? [...editor.memberIds] : [];
      const index = memberIds.indexOf(personId);
      if (index >= 0) memberIds.splice(index, 1);
      else {
        if (memberIds.length >= 5) {
          this.showFloatingText('每个编队最多 5 名名人');
          return false;
        }
        memberIds.push(personId);
      }
      return this.setArmyFormationEditor({ ...editor, memberIds }, { render: true });
    }

    changeArmyFormationPage(action = {}) {
      const editor = this.armyFormationEditor || {};
      if (!editor.open) return false;
      const page = Math.max(0, (Number(editor.page) || 0) + (Number(action.delta) || 0));
      return this.setArmyFormationEditor({ ...editor, page }, { render: true });
    }

    async saveArmyFormation() {
      const editor = this.armyFormationEditor || {};
      if (!editor.open || editor.saving) return false;
      const cityId = editor.cityId || this.state?.activeCityId || 'capital';
      const slot = Math.max(1, Math.min(3, Number(editor.slot) || 1));
      const memberIds = (Array.isArray(editor.memberIds) ? editor.memberIds : []).slice(0, 5);
      this.setArmyFormationEditor({ ...editor, saving: true }, { render: true });
      try {
        const result = await this.getGameApi().setArmyFormation(cityId, slot, memberIds);
        this.applyApiState(result);
        this.tutorialController?.sync?.(this.tutorial);
        this.closeArmyFormationEditor({ render: false });
        this.showFloatingText(result.message || '编队已保存');
        this.log(result.message || '编队已保存');
        this.tutorialController?.refreshCurrentHighlight?.();
        this.renderCanvasSurface(this.state?.currentTab);
        return true;
      } catch (error) {
        const message = error.payload?.message || error.message || '编队保存失败';
        this.setArmyFormationEditor({ ...editor, saving: false }, { render: false });
        this.showFloatingText(message);
        this.log(message);
        this.renderCanvasSurface(this.state?.currentTab);
        return false;
      }
    }

    async apiGet(path) {
      const api = this.getGameApi();
      const startedAt = Date.now();
      try {
        const data = await api.request('GET', path);
        this.cacheRequestLog?.(path, 'GET', null, 200, data, Date.now() - startedAt);
        return data;
      } catch (error) {
        this.cacheRequestLog?.(path, 'GET', null, error.payload?.statusCode || 500, error.payload || { message: error.message }, Date.now() - startedAt);
        throw error;
      }
    }

    async apiPost(path, body) {
      const api = this.getGameApi();
      const startedAt = Date.now();
      try {
        const data = await api.request('POST', path, body);
        this.cacheRequestLog?.(path, 'POST', body, 200, data, Date.now() - startedAt);
        return data;
      } catch (error) {
        this.cacheRequestLog?.(path, 'POST', body, error.payload?.statusCode || 500, error.payload || { message: error.message }, Date.now() - startedAt);
        throw error;
      }
    }

    async handleBuildingSuccess(result, action, buildingId) {
      if (this.commandService?.handleBuildingSuccess) {
        const handled = await this.commandService.handleBuildingSuccess(result, action, buildingId);
        this.tutorialController?.sync?.(this.tutorial);
        this.maybeShowHouseBuiltAdvisor(action, buildingId);
        return handled;
      }
      this.applyApiState(result);
      this.showFloatingText(action === 'upgrade' ? '升级成功' : '建造成功');
      this.log(`Success: ${result?.message || ''}`);
      this.tutorialController?.sync?.(this.tutorial);
      this.maybeShowHouseBuiltAdvisor(action, buildingId);
      return true;
    }

    maybeShowHouseBuiltAdvisor(action, buildingId) {
      const steps = this.tutorialController?.constructor?.TUTORIAL_STEPS || {};
      if (action !== 'build' || buildingId !== 'house') return false;
      if (Number(this.tutorial?.currentStep) !== Number(steps.houseBuilt)) return false;
      this.state = {
        ...(this.state || {}),
        softGuide: {
          mode: 'strong',
          target: 'tab-civilization',
          message: '民居已经立起来了，族人终于有了稳定的居所。文明也向前迈出了一步。',
        },
      };
      this.showAdvisor = true;
      if (this.canvasShell) this.canvasShell.showAdvisor = true;
      this.renderCanvasSurface(this.state?.currentTab || this.getActiveTab());
      return true;
    }

    setPendingBuildingAction(pending = null, options = {}) {
      const nextPending = pending && pending.buildingId
        ? {
          buildingId: pending.buildingId,
          action: pending.action === 'upgrade' ? 'upgrade' : 'build',
        }
        : null;
      this.pendingBuildingAction = nextPending;
      if (this.canvasShell && typeof this.canvasShell === 'object') {
        this.canvasShell.pendingBuildingAction = nextPending;
      }
      if (options.render !== false) this.renderCanvasSurface(this.state?.currentTab || this.getActiveTab());
      return true;
    }

    async buildBuilding(buildingId) {
      return this.commandService?.buildBuilding
        ? this.commandService.buildBuilding(buildingId)
        : this.handleBuildingAction(buildingId, 'build');
    }

    async upgradeBuilding(buildingId) {
      return this.commandService?.upgradeBuilding
        ? this.commandService.upgradeBuilding(buildingId)
        : this.handleBuildingAction(buildingId, 'upgrade');
    }

    async handleBuildingAction(buildingId, action) {
      if (this.commandService?.handleBuildingAction) {
        return this.commandService.handleBuildingAction(buildingId, action);
      }
      return false;
    }

    async assignJob(job, delta) {
      if (!this.token && this.authStorage) {
        this.log('璇峰厛鐧诲綍');
        return false;
      }
      try {
        const result = await this.getGameApi().assignJob(job, delta);
        if (result?.success === false) {
          this.log(result.message || '浜哄彛鍒嗛厤澶辫触');
          const data = await this.getGameApi().getState?.();
          if (data?.gameState) this.applyApiState(data);
          return false;
        }
        this.applyApiState(result);
        this.log(`浜哄彛鍒嗛厤 ${delta > 0 ? '+' : ''}${delta} ${job}`);
        return true;
      } catch (error) {
        this.log(`浜哄彛鍒嗛厤澶辫触锟?{error.payload?.message || error.message}`);
        try {
          const data = await this.getGameApi().getState?.();
          if (data?.gameState) this.applyApiState(data);
        } catch (_) {}
        return false;
      }
    }

    getTalentPolicyDraft() {
      const policies = this.state?.talentPolicies || {};
      const systemPolicies = Array.isArray(policies.systemPolicies) ? policies.systemPolicies : [];
      const activeIsSystem = systemPolicies.some((policy) => policy.id === policies.activePolicyId);
      const basePolicyId = this.talentPolicyUiState.basePolicyId
        || this.canvasShell?.talentPolicyUiState?.basePolicyId
        || (activeIsSystem ? policies.activePolicyId : null)
        || 'balanced';
      const defaults = policies.defaultTiers || { agriculture: 2, knowledge: 2, industry: 2 };
      const tiers = this.talentPolicyUiState.tiers || this.canvasShell?.talentPolicyUiState?.tiers || {};
      return {
        basePolicyId,
        tiers: {
          agriculture: Number(tiers.agriculture ?? defaults.agriculture ?? 2),
          knowledge: Number(tiers.knowledge ?? defaults.knowledge ?? 2),
          industry: Number(tiers.industry ?? defaults.industry ?? 2),
        },
      };
    }

    async applyTalentPolicy(policyId) {
      if (!policyId) return false;
      try {
        const result = await this.getGameApi().applyTalentPolicy(policyId);
        this.applyApiState(result);
        this.showTalentPolicy = false;
        if (this.canvasShell && 'showTalentPolicy' in this.canvasShell) {
          this.canvasShell.showTalentPolicy = false;
        }
        this.showFloatingText(result.message || 'Policy applied');
        this.log(result.message || 'Policy applied');
        return true;
      } catch (error) {
        this.log(`鏂归拡澶辫触锟?{error.payload?.message || error.message}`);
        this.renderCanvasSurface(this.state?.currentTab);
        return false;
      }
    }

    async applyTalentPolicyDraft() {
      try {
        const result = await this.getGameApi().applyTalentPolicy(null, this.getTalentPolicyDraft());
        this.applyApiState(result);
        this.showTalentPolicy = false;
        if (this.canvasShell && 'showTalentPolicy' in this.canvasShell) {
          this.canvasShell.showTalentPolicy = false;
        }
        this.showFloatingText(result.message || 'Policy applied');
        this.log(result.message || 'Policy applied');
        return true;
      } catch (error) {
        this.log(`鏂归拡澶辫触锟?{error.payload?.message || error.message}`);
        this.renderCanvasSurface(this.state?.currentTab);
        return false;
      }
    }

    async saveTalentPolicyDraft() {
      try {
        const result = await this.getGameApi().saveTalentPolicy(this.getTalentPolicyDraft());
        this.applyApiState(result);
        this.showFloatingText(result.message || 'Policy saved');
        this.log(result.message || 'Policy saved');
        return true;
      } catch (error) {
        this.log(`淇濆瓨澶辫触锟?{error.payload?.message || error.message}`);
        this.renderCanvasSurface(this.state?.currentTab);
        return false;
      }
    }

    async deleteTalentPolicy(policyId) {
      if (!policyId) return false;
      try {
        const result = await this.getGameApi().deleteTalentPolicy(policyId);
        this.applyApiState(result);
        this.showFloatingText(result.message || 'Policy deleted');
        this.log(result.message || 'Policy deleted');
        return true;
      } catch (error) {
        this.log(`鍒犻櫎澶辫触锟?{error.payload?.message || error.message}`);
        this.renderCanvasSurface(this.state?.currentTab);
        return false;
      }
    }

    async advanceEra() {
      if (!this.canAdvanceEraNow()) {
        this.log(this.state?.isCapitalCity === false ? 'Capital only' : this.canAdvanceEraByTutorial() ? 'Requirements not met' : 'Action locked');
        this.renderMilitary();
        return false;
      }
      try {
        const result = await this.getGameApi().advanceEra();
        this.applyApiState(result);
        this.tutorialController?.sync?.(this.tutorial);
        this.tutorialController?.onEraAdvanced?.(result);
        this.log(`杩涘叆鏂伴樁娈碉細${result.message || this.state.currentEraName || ''}`);
        this.showFloatingText(result.message || this.state.currentEraName || 'Entered next era');
        return true;
      } catch (error) {
        this.log(`澶辫触锟?{error.payload?.message || error.message}`);
        return false;
      } finally {
        this.renderMilitary();
      }
    }

    async research(techId) {
      return this.commandService?.research
        ? this.commandService.research(techId)
        : false;
    }

    async startExplore(options = {}) {
      try {
        const result = await this.getGameApi().startExplore(options);
        this.applyApiState(result);
        this.tutorialController?.sync?.(this.tutorial);
        this.tutorialController?.onExploreStarted?.(result);
        this.showFloatingText(result.message || 'Explorer started');
        this.log(result.message || 'Explorer started');
        return true;
      } catch (error) {
        this.log(`Explore failed: ${error.payload?.message || error.message}`);
        this.renderCanvasSurface(this.state?.currentTab);
        return false;
      }
    }

    async claimExplore(missionId) {
      if (!missionId) return false;
      try {
        const result = await this.getGameApi().claimExplore(missionId);
        this.applyApiState(result);
        this.tutorialController?.sync?.(this.tutorial);
        this.tutorialController?.onExploreClaimed?.(result);
        this.showFloatingText(result.message || 'Explorer returned');
        this.log(result.message || 'Explorer returned');
        return true;
      } catch (error) {
        this.log(`Explore claim failed: ${error.payload?.message || error.message}`);
        this.renderCanvasSurface(this.state?.currentTab);
        return false;
      }
    }

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
      this.showTalentPolicy = false;
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
    }

    async handleCanvasTabSelection(tabId) {
      if (!tabId) return false;
      const onTabClicked = this.tutorialController?.onTabClicked;
      const allowed = typeof onTabClicked === 'function'
        ? await onTabClicked.call(this.tutorialController, tabId).catch(() => false)
        : true;
      if (!allowed) {
        this.log('璇峰厛瀹屾垚褰撳墠寮曞姝ラ');
        this.renderCanvasSurface(this.state?.currentTab);
        return false;
      }
      this.switchTab(tabId);
      return true;
    }

    async claimGuideTaskReward(taskId) {
      return false;
    }

    async claimTaskReward(taskId, category = 'main', options = {}) {
      if (!taskId) return false;
      try {
        const api = this.getGameApi();
        const result = await api.claimTaskReward(taskId, category || 'main');
        this.applyApiState(result);
        this.tutorialController?.sync?.(this.tutorial);
        this.tutorialController?.onTaskRewardClaimed?.(result);
        if (!this.canvasShell?.showRewardReveal?.(result.rewardReveal) && result.rewardReveal) {
          this.rewardReveal = {
            ...result.rewardReveal,
            createdAt: this.runtime?.now?.() || Date.now(),
          };
          this.renderCanvasSurface(this.state?.currentTab);
        }
        this.showFloatingText(result.rewardText || result.message || 'Reward claimed');
        this.log(`濂栧姳锟?{result.message || ''}`);
        return true;
      } catch (error) {
        this.log(`澶辫触锟?{error.payload?.message || error.message}`);
        this.renderCanvasSurface(this.state?.currentTab);
        return false;
      }
    }

    moveToCurrentMainTaskTarget() {
      return false;
    }

    continueCurrentMainTaskTarget() {
      return false;
    }

    getPreferredMilitaryView(tabId) {
      if (tabId === 'territory') return 'world';
      if (tabId !== 'military') return null;
      const guide = this.state?.softGuide || {};
      const target = guide.target || '';
      const message = String(guide.message || '');
      if (target === 'scout-action-first') return 'scout';
      if (target === 'tab-territory') return 'world';
      if (target !== 'tab-military') return null;
      if (/渚﹀療|鎺㈢储/.test(message)) return 'scout';
      if (/棰嗗湡|鐤嗗煙|涓栫晫|鍗犻/.test(message)) return 'world';
      return null;
    }

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
    }

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
    }

    updateMilitaryViewLocks() {
      this.renderMilitaryView();
    }

    getTargetTab(key) {
      return this.guideController?.getTargetTab?.(key) || null;
    }

    getTutorialTarget(key) {
      return this.canvasShell?.getTutorialTarget?.(key)
        || this.guideController?.getTargetRect?.(key)
        || null;
    }

    getGuideState() {
      return this.state;
    }

    getGuideActiveTab() {
      return this.getActiveTab();
    }

    getGuideTutorialState() {
      return this.state?.tutorial || {};
    }

    getGuideCanvasTarget(type, predicate = null) {
      return this.canvasShell?.getCanvasTarget?.(type, predicate)
        || this.getCanvasTarget(type, predicate);
    }

    renderGuideFrame() {
      this.renderCanvasSurface(this.state?.currentTab || this.getActiveTab());
      return true;
    }

    switchGuideTab(tabId) {
      this.switchTab(tabId);
      return true;
    }

    setGuideMilitaryView(view) {
      this.militaryView = view || 'army';
      this.state = { ...this.state, militaryView: this.militaryView };
      this.render();
      return true;
    }

    getCanvasTarget(type, predicate = null) {
      const targets = this.canvasShell?.renderer?.hitTargets || this.renderer?.hitTargets || [];
      const target = targets.find((item) => (
        item.action?.type === type
        && (typeof predicate !== 'function' || predicate(item.action))
      ));
      if (!target) return null;
      return {
        left: target.x,
        top: target.y,
        width: target.width,
        height: target.height,
        right: target.x + target.width,
        bottom: target.y + target.height,
      };
    }

    getGuideTargetRect(key) {
      return this.guideController?.getTargetRect?.(key) || null;
    }

    refreshTaskCenterGuideHighlight(action = {}) {
      return this.guideController?.refreshTaskCenterGuideHighlight?.(action) || false;
    }

    hasClaimableMainTask() {
      return false;
    }

    refreshCurrentGuideHighlight() {
      return false;
    }

    ensureGuideTargetVisible(key) {
      return false;
    }

    normalizeGuideHighlightRect(target) {
      if (!target) return null;
      const rawRect = typeof target.getRect === 'function'
        ? target.getRect()
        : (typeof target.getBoundingClientRect === 'function' ? target.getBoundingClientRect() : target);
      const left = Number(rawRect.left ?? rawRect.x);
      const top = Number(rawRect.top ?? rawRect.y);
      const width = Number(rawRect.width);
      const height = Number(rawRect.height);
      if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
      return {
        left,
        top,
        width,
        height,
        right: Number(rawRect.right) || left + width,
        bottom: Number(rawRect.bottom) || top + height,
      };
    }
    showGuideHighlight(target, message, options = {}) {
      return false;
    }

    hideGuideHighlight() {
      if (this.canvasShell && typeof this.canvasShell.hideTutorialHighlight === 'function') {
        const hidden = this.canvasShell.hideTutorialHighlight();
        this.tutorialHighlight = this.canvasShell.tutorialHighlight || null;
        return hidden;
      }
      const hadHighlight = Boolean(this.tutorialHighlight);
      this.tutorialHighlight = null;
      if (hadHighlight) this.renderCanvasSurface(this.state?.currentTab);
      return hadHighlight;
    }

    showGuideControllerHighlight(target, message) {
      return this.showGuideHighlight(target, message);
    }

    hideGuideControllerHighlight() {
      return this.hideGuideHighlight();
    }

    hasGuideControllerHighlight() {
      return false;
    }
    goToGuideTaskTarget(action = {}) {
      return false;
    }

    toggleCitySwitcher() {
      const target = this.canvasShell || this;
      target.showCitySwitcher = !target.showCitySwitcher;
      this.renderCanvasSurface(this.state?.currentTab);
    }

    closeCitySwitcher(options = {}) {
      const target = this.canvasShell || this;
      target.showCitySwitcher = false;
      if (options.skipRender) return true;
      this.renderCanvasSurface(this.state?.currentTab);
      return true;
    }

    async switchCity(cityId) {
      return this.commandService?.switchCity
        ? this.commandService.switchCity(cityId)
        : false;
    }

    async enterCity(cityId, options = {}) {
      const targetCityId = cityId || this.state?.activeCityId || this.state?.cityState?.activeCityId || 'capital';
      if (!targetCityId) return false;
      try {
        const currentCityId = this.state?.activeCityId
          || this.state?.cityState?.activeCityId
          || this.state?.cityState?.capitalCityId
          || 'capital';
        this.closeCitySwitcher({ skipRender: true });
        this.showSubcityList = false;
        this.activeCommandPanel = '';
        this.activeEventId = null;
        if (this.canvasShell) {
          this.canvasShell.showSubcityList = false;
          this.canvasShell.activeCommandPanel = '';
          this.canvasShell.activeEventId = null;
        }
        if (targetCityId !== currentCityId) {
          const result = await this.getGameApi().switchCity(targetCityId);
          this.applyApiState(result);
        }
        this.showCityManagement = true;
        this.activeCityManagementTab = options.tab || this.activeCityManagementTab || 'buildings';
        this.territoryUiState = {
          ...(this.territoryUiState || {}),
          selectedSiteId: '',
        };
        this.territoryController?.closeSiteDialog?.();
        if (this.canvasShell) {
          this.canvasShell.showCityManagement = true;
          this.canvasShell.activeCityManagementTab = this.activeCityManagementTab;
          this.canvasShell.territoryUiState = {
            ...(this.canvasShell.territoryUiState || {}),
            selectedSiteId: '',
          };
        }
        const homeView = this.resolveMapHomeViewState(this.state, { requestedTab: 'resources', forceMapHome: true });
        this.activeTab = homeView.activeTab;
        this.militaryView = homeView.militaryView;
        this.mapHomeActive = homeView.isMapHome;
        this.state = {
          ...this.state,
          currentTab: homeView.activeTab,
          militaryView: homeView.militaryView,
        };
        this.renderCanvasSurface(homeView.activeTab);
        this.tutorialController?.markCityEntered?.().then(() => {
          this.tutorialController?.refreshCurrentHighlight?.();
        }).catch((error) => this.log(error?.message || String(error)));
        return true;
      } catch (error) {
        this.log(`澶辫触锟?{error.payload?.message || error.message}`);
        this.renderCanvasSurface(this.state?.currentTab);
        return false;
      }
    }

    openCityManagement(options = {}) {
      this.showCityManagement = true;
      this.activeCityManagementTab = options.tab || this.activeCityManagementTab || 'buildings';
      this.showSubcityList = false;
      this.activeCommandPanel = '';
      this.activeEventId = null;
      if (this.canvasShell) {
        this.canvasShell.showCityManagement = true;
        this.canvasShell.activeCityManagementTab = this.activeCityManagementTab;
        this.canvasShell.showSubcityList = false;
        this.canvasShell.activeCommandPanel = '';
        this.canvasShell.activeEventId = null;
      }
      return this.renderCanvasSurface(this.state?.currentTab);
    }

    closeCityManagement() {
      this.showCityManagement = false;
      if (this.canvasShell) this.canvasShell.showCityManagement = false;
      return this.renderCanvasSurface(this.state?.currentTab);
    }

    switchCityManagementTab(tab = 'buildings') {
      const allowed = ['buildings', 'people', 'military'];
      this.activeCityManagementTab = allowed.includes(tab) ? tab : 'buildings';
      if (this.canvasShell) this.canvasShell.activeCityManagementTab = this.activeCityManagementTab;
      return this.renderCanvasSurface(this.state?.currentTab);
    }

    renderMilitary() {
      this.updateMilitaryViewLocks();
      this.renderCanvasSurface(this.state?.currentTab);
    }

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
    }

    renderTerritory() {
      this.renderCanvasSurface(this.state?.currentTab);
    }

    getMissionRemainingSeconds(mission) {
      return this.presenter?.getScoutMissionRemainingSeconds?.(mission);
    }

    formatScoutCountdown(seconds) {
      return this.presenter?.formatScoutCountdown?.(seconds);
    }

    maybeShowNamingPrompt() {
      const prompt = this.state?.territoryState?.namingPrompt;
      const key = prompt ? `${prompt.type}:${prompt.territoryId || 'polity'}` : null;
      if (!prompt || this.activeNamingPromptKey === key) return;
      this.openNaming(prompt);
    }

    requestCityRename(prompt = {}) {
      if (!prompt.territoryId) return null;
      this.openNaming({
        type: 'city',
        territoryId: prompt.territoryId,
        title: 'Rename city',
        message: `Current name: ${prompt.currentName || 'Unnamed city'}`,
      });
      return null;
    }

    closeNamingModal() {
      this.closeNaming();
    }
    renderSoftGuide(options = {}) {
      this.updateAdvisor(this.state?.softGuide || null, { skipSurface: true });
      this.hideGuideHighlight();
      if (!options.skipSurface) this.renderCanvasSurface(this.state?.currentTab);
    }

    getActiveGuideNavigation() {
      return null;
    }

    hasActiveGuideTaskTarget(target) {
      return false;
    }

    getFallbackGuideTarget(target) {
      if (target === 'btn-advance-era') return 'tab-civilization';
      if (target === 'card-craftsman') return 'tab-resources';
      if (target === 'event-card-special' || target === 'btn-claim-event') return 'tab-events';
      if (target === 'scout-action-first') return 'tab-military';
      if (target === 'task-center-main-claim') return 'task-center-button';
      if (typeof target === 'string' && target.startsWith('card-')) return 'tab-buildings';
      return null;
    }

    updateAdvisor(guide, options = {}) {
      const view = this.presenter?.buildAdvisorViewState?.(guide) || {};
      this.activeAdvisor = view.activeAdvisor;
      if (!options.skipSurface) this.renderCanvasSurface(this.state?.currentTab);
    }

    goToAdvisorTarget() {
      const target = this.activeAdvisor?.target || this.state?.softGuide?.target || null;
      if (target === 'task-center-button') {
        const action = { type: 'openTaskCenter', tab: 'main', source: 'advisor' };
        this.showAdvisor = false;
        if (this.canvasShell) this.canvasShell.showAdvisor = false;
        this.canvasShell?.hideTutorialHighlight?.();
        if (this.canvasShell?.actionController?.handle_openTaskCenter) {
          this.canvasShell.actionController.handle_openTaskCenter(action);
        } else if (this.actionController?.handle_openTaskCenter) {
          this.actionController.handle_openTaskCenter(action);
        } else {
          this.showTaskCenter = true;
          this.activeTaskCenterTab = 'main';
          if (this.canvasShell) {
            this.canvasShell.showTaskCenter = true;
            this.canvasShell.activeTaskCenterTab = 'main';
          }
          this.renderCanvasSurface(this.state?.currentTab);
        }
        this.tutorialController?.refreshCurrentHighlight?.();
        return true;
      }
      if (target === 'scout-action-first') {
        return this.canvasShell?.goToGuideTaskTarget?.({
          target,
          nextAction: { type: 'switchMilitaryView', view: 'scout' },
        });
      }
      const tabId = this.presenter?.getAdvisorTargetTab?.(target);
      if (tabId) this.switchTab(tabId);
      return Boolean(tabId);
    }

    showFloatingText(message) {
      const shown = this.canvasShell?.showFloatingText?.(message);
      if (!shown && message) this.log(message);
      return shown;
    }

    cacheRequestLog(path, method, body, statusCode, response, duration) {
      this.requestLogs.unshift({
        path,
        method,
        body: body ? JSON.stringify(body).slice(0, 200) : '',
        statusCode,
        response: JSON.stringify(response).slice(0, 200),
        duration,
        timestamp: new Date().toLocaleTimeString(),
      });
      if (this.requestLogs.length > 100) this.requestLogs = this.requestLogs.slice(0, 100);
    }

    log(message) {
      if (this.externalLog) this.externalLog(message);
      const entry = { text: String(message ?? ''), timestamp: Date.now() };
      this.recentLogs.unshift(entry);
      if (this.recentLogs.length > 30) this.recentLogs = this.recentLogs.slice(0, 30);
    }

    getSelectedSite() {
      return (this.state.territoryState?.territories || []).find((site) => site.id === this.territoryUiState.selectedSiteId) || null;
    }

    getExpeditionSoldiers(site = this.getSelectedSite()) {
      const recommended = Math.max(1, Number(site?.recommendedSoldiers) || Number(site?.defense) || 1);
      return Math.max(1, Number(this.territoryUiState.expeditionSoldiers) || recommended);
    }

    handleDrag(phase, point = {}) {
      if (this.activeTab === 'tech') {
        return this.actionController?.handle?.({ type: 'techTreeDrag', phase, pointer: point }) || false;
      }
      if (this.activeTab !== 'military' || this.militaryView !== 'world') return false;
      if (
        this.isWorldMapHomeActive()
        && !this.hasBlockingOverlayOpen()
      ) {
        const handled = this.ensureWorldMapRuntimeCoordinator()?.handleDrag(phase, point) || false;
        this.worldMapRuntime = this.worldMapRuntimeCoordinator?.getMapRuntime?.() || this.worldMapRuntime;
        return handled;
      }
      return this.actionController?.handle?.({ type: 'worldMapDrag', phase, pointer: point }) || false;
    }

    hasBlockingOverlayOpen() {
      return Boolean(this.showResourceDetails
        || this.showCitySwitcher
        || this.showSubcityList
        || this.showCityManagement
        || this.showTaskCenter
        || this.showGuidebook
        || this.showFamousPersons
        || this.showTalentPolicy
        || this.armyFormationEditor?.open
        || this.activeCommandPanel
        || this.techDetailOpen
        || this.activeEventId
        || this.naming?.visible
        || this.battleScene?.visible
        || this.rewardReveal);
    }

    handleGesture(gesture) {
      const worldMapGestureHandled = this.handleWorldMapGesture(gesture);
      if (worldMapGestureHandled) return true;
      if (this.activeTab !== 'tech' || this.hasBlockingOverlayOpen()) return false;
      return this.actionController?.handle?.({ type: 'techTreeZoom', gesture }) || false;
    }

    handleWorldMapGesture(gesture = {}) {
      if (gesture?.type !== 'pinchZoom') return false;
      if (this.activeTab !== 'military' || this.militaryView !== 'world') return false;
      if (!this.isWorldMapHomeActive() || this.hasBlockingOverlayOpen()) return false;
      const coordinator = this.ensureWorldMapRuntimeCoordinator();
      const runtime = coordinator?.getMapRuntime?.();
      if (!coordinator || !runtime || !coordinator.canRender?.(this.state)) return false;
      const point = {
        x: Number(gesture.centerX ?? gesture.x) || 0,
        y: Number(gesture.centerY ?? gesture.y) || 0,
      };
      if (!runtime.isPointInMap?.(point, this.state) && !this.worldMapPinchDragging) return false;
      const phase = gesture.phase || 'move';
      if (phase === 'end' || phase === 'cancel') {
        this.finishWorldMapSnapshotDrag();
        this.renderCanvasSurface(this.state?.currentTab || this.activeTab);
        return true;
      }
      const dx = Number(gesture.deltaX);
      const dy = Number(gesture.deltaY);
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false;
      if (!this.worldMapPinchDragging) {
        this.worldMapPinchDragging = true;
        runtime.waterTimeMs = this.startWorldMapSnapshotDrag();
      }
      runtime.setCamera?.(
        (Number(runtime.camera?.x) || 0) + dx,
        (Number(runtime.camera?.y) || 0) + dy,
        { source: 'pinchPan', render: false },
      );
      this.worldMapRuntime = runtime;
      this.renderWorldMapSnapshotDragFrame();
      return true;
    }

    async handleTap(point) {
      const action = this.renderer.getHitTarget(point);
      if (action?.type === 'blockCanvasModal') {
        return this.actionController?.handle?.(action);
      }
      if (!action || action.disabled) {
        const handled = this.ensureWorldMapRuntimeCoordinator()?.handleTap(point);
        this.worldMapRuntime = this.worldMapRuntimeCoordinator?.getMapRuntime?.() || this.worldMapRuntime;
        return handled;
      }
      if (action.type === 'showFamousSkillTooltip') {
        this.renderer.setPinnedFamousSkillTooltip?.(action);
        this.render();
        return;
      }
      if (action.type === 'clearFamousSkillTooltip') {
        this.renderer.clearFamousSkillTooltip?.();
        this.render();
        return;
      }
      const handled = await this.actionController?.handle?.(action);
      this.advanceTutorialIntroAfterHandled(handled, action);
      return handled;
    }

    advanceTutorialIntro(action = {}) {
      const controller = this.tutorialIntroOverlay || null;
      if (!controller || typeof controller.advanceFromAction !== 'function') return false;
      return controller.advanceFromAction(action);
    }

    advanceTutorialIntroAfterHandled(handled, action = {}) {
      if (handled && typeof handled.then === 'function') {
        handled.then((value) => {
          if (value !== false) this.advanceTutorialIntro(action);
        });
        return true;
      }
      return handled ? this.advanceTutorialIntro(action) : false;
    }

    isPointBlockedByTutorialShield(point = {}) {
      if (!this.renderer || typeof this.renderer.getHitTarget !== 'function') return false;
      return this.renderer.getHitTarget(point)?.type === 'blockCanvasModal';
    }

    start() {
      this.render();
      this.syncOnce().catch(() => {});
      if (this.timer) return;
      if (!this.tapDisposer && this.runtime && typeof this.runtime.onTap === 'function') {
        this.tapDisposer = this.runtime.onTap((point) => this.handleTap(point));
      }
      if (!this.dragDisposer && this.runtime && typeof this.runtime.onDrag === 'function') {
        this.dragDisposer = this.runtime.onDrag((phase, point) => this.handleDrag(phase, point));
      }
      if (!this.gestureDisposer && this.runtime && typeof this.runtime.onGesture === 'function') {
        this.gestureDisposer = this.runtime.onGesture((gesture) => this.handleGesture(gesture));
      }
      if (this.syncService?.start) this.syncService.start();
      else if (this.api?.heartbeat && this.runtime?.setInterval) {
        this.timer = this.runtime.setInterval(() => {
          this.api.heartbeat().then((data) => this.applyHeartbeat(data)).catch((error) => this.applyConnectionState({
            status: 'reconnecting',
            failureCount: (this.networkState?.failureCount || 0) + 1,
            error,
          }));
        }, this.config?.HEARTBEAT_INTERVAL_MS || this.syncIntervalMs);
      }
    }

    stop() {
      this.syncService?.stop?.();
      if (this.timer) {
        this.runtime.clearInterval(this.timer);
        this.timer = null;
      }
      if (this.highlightTimer) {
        this.runtime.clearInterval(this.highlightTimer);
        this.highlightTimer = null;
      }
      this.stopTransitionTimer();
      if (this.tapDisposer) {
        this.tapDisposer();
        this.tapDisposer = null;
      }
      if (this.dragDisposer) {
        this.dragDisposer();
        this.dragDisposer = null;
      }
      if (this.gestureDisposer) {
        this.gestureDisposer();
        this.gestureDisposer = null;
      }
    }
  }

  global.CanvasGameApp = CanvasGameApp;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasGameApp;
})(typeof window !== 'undefined' ? window : globalThis);
