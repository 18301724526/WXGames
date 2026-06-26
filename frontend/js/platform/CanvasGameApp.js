(function (global) {
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
  var CanvasGameAppStateSync = global.CanvasGameAppStateSync;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameAppStateSync) {
    CanvasGameAppStateSync = require('./CanvasGameAppStateSync');
  }
  var CanvasGameAppRenderingRuntime = global.CanvasGameAppRenderingRuntime;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameAppRenderingRuntime) {
    CanvasGameAppRenderingRuntime = require('./CanvasGameAppRenderingRuntime');
  }
  var CanvasGameWorldActorAnimationRuntime = global.CanvasGameWorldActorAnimationRuntime;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameWorldActorAnimationRuntime) {
    CanvasGameWorldActorAnimationRuntime = require('./CanvasGameWorldActorAnimationRuntime');
  }
  var CanvasGameAppBattleScene = global.CanvasGameAppBattleScene;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameAppBattleScene) {
    CanvasGameAppBattleScene = require('./CanvasGameAppBattleScene');
  }
  var CanvasGameAppCommands = global.CanvasGameAppCommands;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameAppCommands) {
    CanvasGameAppCommands = require('./CanvasGameAppCommands');
  }
  var CanvasGameAppGuideUi = global.CanvasGameAppGuideUi;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameAppGuideUi) {
    CanvasGameAppGuideUi = require('./CanvasGameAppGuideUi');
  }
  var CanvasModalSnapshotAdapter = global.CanvasModalSnapshotAdapter;
  if (typeof module !== 'undefined' && module.exports && !CanvasModalSnapshotAdapter) {
    CanvasModalSnapshotAdapter = require('./CanvasModalSnapshotAdapter');
  }
  var CanvasGameAppInputRouter = global.CanvasGameAppInputRouter;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameAppInputRouter) {
    CanvasGameAppInputRouter = require('./CanvasGameAppInputRouter');
  }
  var CanvasModeOwnershipBridge = global.CanvasModeOwnershipBridge;
  if (typeof module !== 'undefined' && module.exports && !CanvasModeOwnershipBridge) {
    CanvasModeOwnershipBridge = require('./CanvasModeOwnershipBridge');
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
          this.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], soldierAssignments: {}, soldierDraftAssignments: {}, page: 0, saving: false };
          this.activeCommandPanel = '';
          this.battleReplayTurnTimer = null;
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
          this.worldActorAnimationActive = false;
          this.worldActorAnimationQueued = false;
          this.worldActorQueuedRenderOptions = null;
          this.lastWorldActorAnimationRenderAt = 0;
          this.tileMapWaterTimer = null;
          this.activeEventId = null;
          this.territoryUiState = {
            selectedSiteId: '',
            worldMarchTarget: null,
            selectedWorldActorId: '',
            selectedWorldMissionId: '',
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
            if (!this.syncService.onState) this.syncService.onState = (data) => this.applyApiState(data);
            if (!this.syncService.onConnectionState) this.syncService.onConnectionState = (state) => this.applyConnectionState(state);
            if (!this.syncService.onError) {
              this.syncService.onError = (error) => {
                if (error?.payload?.error && this.handleAuthError) this.handleAuthError(error.payload);
              };
            }
            this.syncService.setStateProvider?.(() => this.state);
            if ('getWorldMarchClientReport' in this.syncService) {
              this.syncService.getWorldMarchClientReport = () => this.getWorldMarchClientReport?.();
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
  }

  [
    CanvasGameAppStateSync,
    CanvasGameAppRenderingRuntime,
    CanvasGameWorldActorAnimationRuntime,
    CanvasGameAppBattleScene,
    CanvasGameAppCommands,
    CanvasModeOwnershipBridge,
    CanvasModalSnapshotAdapter,
    CanvasGameAppGuideUi,
    CanvasGameAppInputRouter,
  ].forEach((module) => module?.install?.(CanvasGameApp));

  global.CanvasGameApp = CanvasGameApp;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasGameApp;
})(typeof window !== 'undefined' ? window : globalThis);
