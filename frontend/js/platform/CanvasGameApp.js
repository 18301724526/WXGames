(function (global) {
  var GameCommandServiceBase = global.GameCommandService;
  if (typeof module !== 'undefined' && module.exports && !GameCommandServiceBase) {
    GameCommandServiceBase = require('./GameCommandService');
  }
  var TutorialFlowShared = global.TutorialFlowShared;
  if (typeof module !== 'undefined' && module.exports && !TutorialFlowShared) {
    TutorialFlowShared = require('../../../shared/tutorialFlowConfig');
  }
  var TutorialGuideControllerBase = global.TutorialGuideController;
  if (typeof module !== 'undefined' && module.exports && !TutorialGuideControllerBase) {
    try {
      TutorialGuideControllerBase = require('../tutorial/TutorialGuideController');
    } catch (_error) {
      TutorialGuideControllerBase = null;
    }
  }
  var CanvasGameAppRenderPolicy = global.CanvasGameAppRenderPolicy;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameAppRenderPolicy) {
    CanvasGameAppRenderPolicy = require('./CanvasGameAppRenderPolicy');
  }
  var CanvasGameAppRenderScheduler = global.CanvasGameAppRenderScheduler;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameAppRenderScheduler) {
    CanvasGameAppRenderScheduler = require('./CanvasGameAppRenderScheduler');
  }
  var WorldMapRuntimeCoordinatorBase = global.WorldMapRuntimeCoordinator;
  if (typeof module !== 'undefined' && module.exports && !WorldMapRuntimeCoordinatorBase) {
    WorldMapRuntimeCoordinatorBase = require('./WorldMapRuntimeCoordinator');
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
  var WorldMarchOptimisticState = global.WorldMarchOptimisticState;
  if (typeof module !== 'undefined' && module.exports && !WorldMarchOptimisticState) {
    try {
      WorldMarchOptimisticState = require('../state/optimistic/index');
    } catch (_error) {
      WorldMarchOptimisticState = null;
    }
  }
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../ecs/resource/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  const SharedRewardText = (() => {
    if (global.RewardText) return global.RewardText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../ecs/resource/RewardText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  const BattleStore = (() => {
    if (global.BattleStore) return global.BattleStore;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../state/BattleStore');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  const WorldMapInputActionMap = (() => {
    if (global.WorldMapInputActionMap) return global.WorldMapInputActionMap;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../ecs/input/WorldMapInputActionMap');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  var CanvasModalSnapshotAdapter = global.CanvasModalSnapshotAdapter;
  if (typeof module !== 'undefined' && module.exports && !CanvasModalSnapshotAdapter) {
    CanvasModalSnapshotAdapter = require('./CanvasModalSnapshotAdapter');
  }
  var CanvasModeOwnershipRuntime = global.CanvasModeOwnershipRuntime;
  if (typeof module !== 'undefined' && module.exports && !CanvasModeOwnershipRuntime) {
    CanvasModeOwnershipRuntime = require('./CanvasModeOwnershipRuntime');
  }
  var StateWriter = global.StateWriter;
  if (typeof module !== 'undefined' && module.exports && !StateWriter) {
    StateWriter = require('../state/StateWriter');
  }
  var UiRuntimeStateStore = global.UiRuntimeStateStore;
  if (typeof module !== 'undefined' && module.exports && !UiRuntimeStateStore) {
    UiRuntimeStateStore = require('../state/UiRuntimeStateStore');
  }
  var TerritoryUiStateStore = global.TerritoryUiStateStore;
  if (typeof module !== 'undefined' && module.exports && !TerritoryUiStateStore) {
    TerritoryUiStateStore = require('../state/TerritoryUiStateStore');
  }
  var WorldClockTimingModule = global.WorldClockTimingModule;
  if (typeof module !== 'undefined' && module.exports && !WorldClockTimingModule) {
    WorldClockTimingModule = require('./WorldClockTimingModule');
  }
  var ArmyFormationQueries = global.ArmyFormationQueries;
  if (typeof module !== 'undefined' && module.exports && !ArmyFormationQueries) {
    ArmyFormationQueries = require('./ArmyFormationQueries');
  }
  var ArmyFormationEditorController = global.ArmyFormationEditorController;
  if (typeof module !== 'undefined' && module.exports && !ArmyFormationEditorController) {
    ArmyFormationEditorController = require('./ArmyFormationEditorController');
  }
  var ScoutCountdownTimer = global.ScoutCountdownTimer;
  if (typeof module !== 'undefined' && module.exports && !ScoutCountdownTimer) {
    ScoutCountdownTimer = require('./ScoutCountdownTimer');
  }
  var TileMapWaterAnimationTimer = global.TileMapWaterAnimationTimer;
  if (typeof module !== 'undefined' && module.exports && !TileMapWaterAnimationTimer) {
    TileMapWaterAnimationTimer = require('./TileMapWaterAnimationTimer');
  }
  var EntityBattleController = global.EntityBattleController;
  if (typeof module !== 'undefined' && module.exports && !EntityBattleController) {
    EntityBattleController = require('./EntityBattleController');
  }
  var BattleSceneController = global.BattleSceneController;
  if (typeof module !== 'undefined' && module.exports && !BattleSceneController) {
    BattleSceneController = require('./BattleSceneController');
  }
  var TutorialGuideUiController = global.TutorialGuideUiController;
  if (typeof module !== 'undefined' && module.exports && !TutorialGuideUiController) {
    TutorialGuideUiController = require('./TutorialGuideUiController');
  }
  var CanvasPanelSurfaceManager = global.CanvasPanelSurfaceManager;
  if (typeof module !== 'undefined' && module.exports && !CanvasPanelSurfaceManager) {
    CanvasPanelSurfaceManager = require('./CanvasPanelSurfaceManager');
  }
  var CanvasLayerRegistryBase = global.CanvasLayerRegistry;
  if (typeof module !== 'undefined' && module.exports && !CanvasLayerRegistryBase) {
    CanvasLayerRegistryBase = require('./CanvasLayerRegistry');
  }

  function t(key = '', params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
  }

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
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

  function buildMilitaryRenderOptions(host = null, uiState = null, options = {}) {
    if (typeof host?.buildRenderOptions === 'function') {
      const renderOptions = host.buildRenderOptions('military', uiState, {
        ...options,
        forceMapHome: true,
      }) || {};
      const { territoryUiState = uiState || {} } = renderOptions;
      return { ...renderOptions, territoryUiState };
    }
    return { territoryUiState: uiState || {} };
  }

  function resolveRuntimeUiState(runtime = null) {
    return runtime?.getCameraUiState?.() || null;
  }

  function isMapHomeActive(host = {}, state = {}) {
    if (typeof host.isWorldMapHomeActive === 'function') {
      try {
        return host.isWorldMapHomeActive(state);
      } catch (_error) {
        // Fall through to the legacy map-home fields below.
      }
    }
    return Boolean(host.mapHomeActive
      && (state?.currentTab || host.activeTab) === 'military'
      && (state?.militaryView || host.militaryView) === 'world');
  }

  function getRequestAnimationFrame(host = {}) {
    const raf = host.runtime?.requestAnimationFrame || host.scheduler?.requestAnimationFrame;
    const owner = host.runtime?.requestAnimationFrame ? host.runtime : host.scheduler;
    return typeof raf === 'function' ? raf.bind(owner) : null;
  }

  function getFrameMs(host = {}) {
    const configuredFps = toNumber(
      host.config?.WORLD_ACTOR_ANIMATION_FPS
        ?? host.config?.PERFORMANCE?.WORLD_ACTOR_ANIMATION_FPS,
      30,
    );
    const fps = Math.max(1, Math.min(60, configuredFps));
    const baseFrameMs = Math.max(1, toNumber(host.getAnimationFrameMs?.(), 16));
    return Math.max(baseFrameMs, Math.round(1000 / fps));
  }

  function getState(host = {}) {
    return host.lastGame?.state || host.state || {};
  }

  function shouldAnimateWorldActors(host = {}, options = {}) {
    const state = options.state || getState(host);
    if (!state || !isMapHomeActive(host, state)) return false;
    if (host.isWorldMapDragging?.()) return false;
    const epochNowMs = options.epochNowMs ?? host.getWorldEpochNowMs?.() ?? Date.now();
    return hasActiveWorldExplorerMission(state, { ...options, epochNowMs });
  }

  function canRenderWorldActorLayer(host = {}) {
    if (host.canvasShell?.renderWorldActorLayer) return true;
    if (typeof host.renderWorldActorLayer === 'function') return true;
    return Boolean(host.renderer && typeof host.renderer.renderWorldMapActorLayer === 'function');
  }

  function renderWorldActorLayerFrame(host = {}, options = {}) {
    if (!canRenderWorldActorLayer(host)) return false;
    if (host.canvasShell?.renderWorldActorLayer) {
      return host.canvasShell.renderWorldActorLayer({
        ...options,
        state: options.state || getState(host),
        epochNowMs: options.epochNowMs ?? host.getWorldEpochNowMs?.() ?? Date.now(),
        preserveRuntimeHitTargetsOnEmpty: options.preserveRuntimeHitTargetsOnEmpty !== false,
      });
    }
    const state = options.state || getState(host);
    if (!state) return false;
    const epochNowMs = options.epochNowMs ?? host.getWorldEpochNowMs?.() ?? Date.now();
    if (typeof host.renderWorldActorLayer === 'function') {
      return host.renderWorldActorLayer({
        ...options,
        epochNowMs,
        state,
        preserveRuntimeHitTargetsOnEmpty: options.preserveRuntimeHitTargetsOnEmpty !== false,
      });
    }
    const runtime = host.worldMapRuntimeCoordinator?.getMapRuntime?.() || host.worldMapRuntime || null;
    const territoryUiState = options.territoryUiState
      || runtime?.getCameraUiState?.()
      || TerritoryUiStateStore?.ensure?.(host)
      || {};
    const rendered = host.renderer.renderWorldMapActorLayer(state, {
      ...options,
      epochNowMs,
      activeTab: 'military',
      isMapHome: true,
      territoryUiState,
      worldMapRuntimeContext: options.worldMapRuntimeContext
        || runtime?.getLastTileMapContext?.()
        || runtime?.lastTileMapContext
        || host.renderer?.lastWorldTileMapContext
        || null,
      preserveCanvas: true,
      showFpsOverlay: false,
    });
    if (rendered && runtime?.syncHitTargetsFromRenderer) {
      runtime.syncHitTargetsFromRenderer({
        preserveOnEmpty: options.preserveRuntimeHitTargetsOnEmpty !== false,
      });
    }
    return rendered;
  }

  function shouldRouteTapThroughWorldMapRuntime(action = null) {
    if (WorldMapInputActionMap?.shouldRouteTapThroughWorldMapRuntime) {
      return WorldMapInputActionMap.shouldRouteTapThroughWorldMapRuntime(action);
    }
    return !action;
  }

  function summarizeHandledForOperationLog(handled) {
    return handled && typeof handled.then === 'function' ? 'promise' : Boolean(handled);
  }

  function incrementPanelRefactorCounter(name = '') {
    const counters = global.__panelRefactorCounters || global.__PANEL_REFACTOR_COUNTERS__ || null;
    if (!counters || !name) return false;
    counters[name] = (Number(counters[name]) || 0) + 1;
    return true;
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
          StateWriter.commit(this, options.initialState || {
            resources: {},
            population: {},
            currentEra: 0,
            softGuide: null,
          }, { source: 'CanvasGameApp:constructor:init' });
          UiRuntimeStateStore?.ensure?.(this, {
            activeTab: options.activeTab || this.state.currentTab || 'resources',
            militaryView: options.militaryView || this.state.militaryView || 'army',
          });
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
          UiRuntimeStateStore?.setNavigation?.(this, initialHome);
          this.mapHomeActive = initialHome.isMapHome;
          StateWriter.commit(this, (prev) => ({
            ...prev,
            currentTab: initialHome.activeTab,
            militaryView: initialHome.militaryView,
          }), { source: 'CanvasGameApp:constructor:home' });
          this.activeCityManagementTab = 'buildings';
          this.activeTaskCenterTab = 'main';
          this.activeGuidebookTab = 'planning';
          this.famousPersonsPage = 0;
          this.selectedFamousPersonId = '';
          this.tutorialIntro = options.tutorialIntro || null;
          this.tutorialIntroOverlay = options.tutorialIntroOverlay || null;
          this.buildingOffset = 0;
          this.activeBuildingCategory = 'all';
          this.techTreePanX = 0;
          this.techTreePanY = 0;
          this.techTreeZoom = 1;
          StateWriter.commit(this, (prev) => ({
            ...prev,
            techUiState: {
              ...(prev.techUiState || {}),
              selectedTechId: '',
              detailOpen: false,
            },
          }), { source: 'CanvasGameApp:constructor:techUi' });
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
          TerritoryUiStateStore.ensure(this);
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
          const shellPanelSurfaceManager = this.canvasShell && this.canvasShell !== this
            ? this.canvasShell.panelSurfaceManager || null
            : null;
          this.panelSurfaceManager = options.panelSurfaceManager || null;
          if (!this.panelSurfaceManager && !shellPanelSurfaceManager && CanvasPanelSurfaceManager) {
            this.panelSurfaceManager = new CanvasPanelSurfaceManager({ host: this, registry: options.panelRegistry });
          }
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


    getStateHost() {
          return StateWriter.getStateHost(this);
        }

    getState() {
          return this.getStateHost()?.state || {};
        }

    // Single owner of the army-formation editor blob (re-decomposition slice 6):
    // the ArmyFormationEditorController lives on the state host, so a mounted
    // shell and its game resolve to the SAME controller. The accessor below keeps
    // the legacy field name alive for every existing read/write site (blocking
    // checks, renderer options, CanvasModeOwnershipRuntime, the action
    // controller's panel sweep) while retiring both legacy mirrors (app->shell
    // forward copy and shell->app copy-back).
    getArmyFormationEditorController() {
          const owner = this.getStateHost() || this;
          if (!owner.armyFormationEditorController) {
            owner.armyFormationEditorController = new ArmyFormationEditorController({ host: owner });
          }
          return owner.armyFormationEditorController;
        }

    get armyFormationEditor() {
          return this.getArmyFormationEditorController().editor;
        }

    set armyFormationEditor(value) {
          this.getArmyFormationEditorController().replaceEditor(value);
        }

    getFrozenWorldMapWaterTimeMs() {
          return this.worldMapDragWaterTimeMs !== null &&
            this.worldMapDragWaterTimeMs !== undefined &&
            Number.isFinite(Number(this.worldMapDragWaterTimeMs))
            ? Number(this.worldMapDragWaterTimeMs)
            : this.now();
        }

    isWorldMapDragging() {
          return (
            this.worldMapDragWaterTimeMs !== null &&
            this.worldMapDragWaterTimeMs !== undefined &&
            Number.isFinite(Number(this.worldMapDragWaterTimeMs))
          );
        }

    isWorldMapDragCoolingDown() {
          return Number(this.worldMapDragCooldownUntil) > this.now();
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
          this.updateWorldActorAnimationLoop?.({ force: true });
        }

    renderWorldMapSnapshotDragFrame() {
          if (!this.renderer || typeof this.renderer.renderWorldMapSnapshotLayer !== 'function')
            return false;
          const coordinator = this.ensureWorldMapRuntimeCoordinator();
          const runtime = coordinator?.getMapRuntime?.();
          if (!runtime || !coordinator?.canRender?.(this.state)) return false;
          const renderOptions = buildMilitaryRenderOptions(this, resolveRuntimeUiState(runtime));
          const { territoryUiState = {} } = renderOptions;
          const topBarBottom =
            typeof this.renderer.getTopBarBottom === 'function'
              ? this.renderer.getTopBarBottom(this.state, { isMapHome: true })
              : 84;
          const epochNowMs = this.getWorldEpochNowMs?.() ?? Date.now();
          const rendered = this.renderer.renderWorldMapSnapshotLayer(this.state, {
            ...renderOptions,
            epochNowMs,
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
          const frameContext = this.renderer.lastWorldTileMapContext || null;
          if (frameContext) runtime.commitFrameState?.({ lastTileMapContext: frameContext });
          this.renderer.renderWorldMapActorLayer?.(this.state, {
            epochNowMs,
            activeTab: 'military',
            isMapHome: true,
            territoryUiState,
            worldMapRuntimeContext: frameContext,
            preserveCanvas: true,
            showFpsOverlay: false,
          });
          runtime.syncHitTargetsFromRenderer?.({ preserveOnEmpty: true });
          const renderResult =
            this.renderer.lastWorldMapLayerRenderResult ||
            this.renderer.worldMapLayerRenderer?.lastWorldMapLayerRenderResult ||
            null;
          const frameState =
            runtime.getWorldMapFrameState?.({ renderResult, rendered }) ||
            WorldMapRuntimeRenderPolicy?.createWorldMapFrameState?.(runtime, {
              renderResult,
              rendered,
            }) ||
            null;
          const compositionOptions = WorldMapRuntimeRenderPolicy?.createWorldMapCompositionOptions
            ? WorldMapRuntimeRenderPolicy.createWorldMapCompositionOptions(
                {
                  activeTab: 'military',
                  isMapHome: true,
                  territoryUiState,
                  network: this.networkState,
                },
                frameState || {},
              )
            : {
                activeTab: 'military',
                isMapHome: true,
                skipWorldMapLayer: true,
                worldMapRuntimeHitTargets: runtime.getHitTargets?.() || [],
                preserveCanvas: true,
                territoryUiState,
                network: this.networkState,
              };
          this.renderer.render(this.state, {
            ...compositionOptions,
            activeTab: 'military',
            isMapHome: true,
            territoryUiState,
            network: this.networkState,
          });
          return true;
        }

    getWorldMapSnapshotRenderOptions(waterTimeMs = this.getFrozenWorldMapWaterTimeMs()) {
          const hasWaterTimeMs =
            waterTimeMs !== null && waterTimeMs !== undefined && Number.isFinite(Number(waterTimeMs));
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
            getLayerBackingStoreState: () =>
              this.runtime?.getLayerBackingStoreState?.('worldMap') || null,
            getBaseUiState: () => TerritoryUiStateStore?.ensure?.(this) || {},
            getLocalUiState: () => {
              const renderOptions = buildMilitaryRenderOptions(
                this,
                TerritoryUiStateStore?.ensure?.(this) || {},
              );
              const { territoryUiState = {} } = renderOptions;
              return territoryUiState;
            },
            getTerritoryController: () => this.territoryController,
            getTopBarBottom: (state) =>
              typeof this.renderer?.getTopBarBottom === 'function'
                ? this.renderer.getTopBarBottom(state, { isMapHome: true })
                : 84,
            getRequestedTab: (state = this.state) => state?.currentTab || this.activeTab || 'resources',
            getMilitaryView: (state = this.state) => state?.militaryView || this.militaryView,
            getForceMapHome: () => this.mapHomeActive,
            canRouteTap: (point) => !this.isPointBlockedByTutorialShield(point),
            onAction: (action, event, meta = {}) => {
              const handled = this.dispatchCanvasAction(action, { ...(meta || {}), event });
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
          return Boolean(
            homeView.isMapHome &&
            homeView.activeTab === 'military' &&
            homeView.militaryView === 'world',
          );
        }

    renderRuntimeWorldMap(stateOrOptions = this.state, maybeOptions = null) {
          const hasExplicitState = maybeOptions !== null && maybeOptions !== undefined;
          const state = hasExplicitState ? stateOrOptions : this.state;
          const options = hasExplicitState ? maybeOptions || {} : stateOrOptions || {};
          const coordinator = this.ensureWorldMapRuntimeCoordinator();
          if (!coordinator) return false;
          const rendered = coordinator.render(state || this.state, options);
          this.worldMapRuntime = coordinator.getMapRuntime();
          return rendered;
        }

    shouldRenderRuntimeWorldMap(stateOrOptions = this.state, maybeOptions = null) {
          const hasExplicitState = maybeOptions !== null && maybeOptions !== undefined;
          const state = hasExplicitState ? stateOrOptions : this.state;
          const options = hasExplicitState ? maybeOptions || {} : stateOrOptions || {};
          const coordinator = this.ensureWorldMapRuntimeCoordinator();
          const runtime = coordinator?.getMapRuntime?.();
          if (!coordinator?.canRender?.(state || this.state)) return false;
          if (runtime?.isBakedLayerStateValid && !runtime.isBakedLayerStateValid()) return true;
          if (!runtime || typeof runtime.isMapBakeDirty !== 'function') return true;
          return Boolean(options.force || runtime.isMapBakeDirty(state || this.state, options));
        }

    refreshWorldMapLayerFromSnapshot(options = {}) {
          const coordinator = this.ensureWorldMapRuntimeCoordinator();
          const runtime = coordinator?.getMapRuntime?.();
          if (
            !runtime ||
            !this.renderer ||
            typeof this.renderer.renderWorldMapSnapshotLayer !== 'function'
          )
            return false;
          const renderOptions = buildMilitaryRenderOptions(this, resolveRuntimeUiState(runtime));
          const { territoryUiState = {} } = renderOptions;
          const epochNowMs = options.epochNowMs ?? this.getWorldEpochNowMs?.() ?? Date.now();
          const rendered = this.renderer.renderWorldMapSnapshotLayer(this.state, {
            ...renderOptions,
            epochNowMs,
            activeTab: 'military',
            isMapHome: true,
            territoryUiState,
            topBarBottom:
              typeof this.renderer.getTopBarBottom === 'function'
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
          const frameContext = this.renderer.lastWorldTileMapContext || null;
          if (frameContext) runtime.commitFrameState?.({ lastTileMapContext: frameContext });
          this.renderer.renderWorldMapActorLayer?.(this.state, {
            epochNowMs,
            activeTab: 'military',
            isMapHome: true,
            territoryUiState,
            worldMapRuntimeContext: frameContext,
            preserveCanvas: true,
            showFpsOverlay: false,
          });
          runtime.syncHitTargetsFromRenderer?.({ preserveOnEmpty: true });
          const renderResult =
            this.renderer.lastWorldMapLayerRenderResult ||
            this.renderer.worldMapLayerRenderer?.lastWorldMapLayerRenderResult ||
            null;
          if (renderResult?.drewFrame !== false) {
            runtime.commitBakedFrame?.(frameContext || runtime.getLastTileMapContext?.() || null);
            runtime.markBakedLayerCommitted?.();
          }
          if (options.commitCamera !== false) runtime.markBakedCamera?.(runtime.camera);
          return true;
        }

    getWorldMarchClientReport() {
                return WorldMarchOptimisticState?.buildClientReport?.(this) || null;
              }

    playUnseenWorldCombatReports(state = this.state) {
                const reports = state?.worldExplorerState?.combat?.recentReports;
                if (!Array.isArray(reports) || !reports.length) return false;
                this.playedWorldCombatReportIds = this.playedWorldCombatReportIds || new Set();
                // First sync of this session: the reports already present are history from
                // before the page loaded, not battles that just happened. Mark them all seen
                // without playing 鈥?otherwise every reload (e.g. the post-deploy update
                // refresh) re-plays the newest historical report as an orderless replay.
                if (!this.worldCombatReportsSeeded) {
                  for (const entry of reports) {
                    const seededId = entry?.id || entry?.report?.id || '';
                    if (seededId) this.playedWorldCombatReportIds.add(seededId);
                  }
                  this.worldCombatReportsSeeded = true;
                  return false;
                }
                // recentReports is newest-first. Play only the newest unseen report
                // and mark the rest seen, so a backlog (several battles between syncs)
                // doesn't stack multiple battle scenes at once.
                let toPlay = null;
                for (const entry of reports) {
                  const report = entry?.report || null;
                  const reportId = entry?.id || report?.id || '';
                  if (!report || !reportId || this.playedWorldCombatReportIds.has(reportId)) continue;
                  if (!toPlay) toPlay = report;
                  this.playedWorldCombatReportIds.add(reportId);
                }
                if (toPlay && typeof this.startBattleScene === 'function') {
                  this.startBattleScene(toPlay);
                  return true;
                }
                return false;
              }

    // Auto-engage (connection point 1): the backend marks an arrived mission
    // combat.status='engaged' instead of auto-settling. When our own idle formation is
    // engaged on an enemy tile and no battle scene is open, open the interactive battle
    // (the "retreat window") ONCE per engagement. Dedup key = missionId:encounterId:engagedAt
    // so a re-sync of the same engagement never re-opens; a NEW engagement (different
    // engagedAt) opens again. If the player closes the scene without resolving, we remember
    // the engagement as dismissed so it is not immediately re-opened — the backend timeout
    // fallback settles it if it stays engaged.
    maybeAutoEnterEngagedBattle(state = this.state) {
                if (typeof this.enterInteractiveBattle !== 'function') return false;
                const explorer = state?.worldExplorerState || {};
                const missions = [
                  ...(Array.isArray(explorer.idleMissions) ? explorer.idleMissions : []),
                  ...(Array.isArray(explorer.missions) ? explorer.missions : []),
                ].filter(Boolean);
                // A live battle scene is already open: never stack a second one.
                if (this.entityBattle) return false;
                this.autoEnteredEngagements = this.autoEnteredEngagements || new Set();
                this.dismissedEngagements = this.dismissedEngagements || new Set();
                for (const mission of missions) {
                  const combat = mission.combat;
                  if (!mission || mission.status !== 'idle' || !combat || combat.status !== 'engaged') continue;
                  if (!combat.encounterId || !combat.engagedAt) continue;
                  const key = `${mission.id}:${combat.encounterId}:${combat.engagedAt}`;
                  if (this.autoEnteredEngagements.has(key) || this.dismissedEngagements.has(key)) continue;
                  this.autoEnteredEngagements.add(key);
                  const position = mission.position || mission.target || {};
                  const engagementKey = key;
                  Promise.resolve(
                    this.enterInteractiveBattle({
                      missionId: mission.id,
                      formationSlot: mission.formation?.slot ?? 1,
                      cityId: mission.formation?.cityId || this.state?.activeCityId || 'capital',
                      targetQ: position.q ?? position.x,
                      targetR: position.r ?? position.y,
                      engagement: {
                        missionId: mission.id,
                        encounterId: combat.encounterId,
                        engagedAt: combat.engagedAt,
                      },
                    }),
                  ).then((opened) => {
                    // Opening failed (e.g. prerequisites missing): drop the dedup mark so a
                    // later sync of the same still-engaged mission can retry.
                    if (opened === false) this.autoEnteredEngagements.delete(engagementKey);
                  }).catch(() => {
                    this.autoEnteredEngagements.delete(engagementKey);
                  });
                  return true; // one engagement per sync
                }
                return false;
              }

    // Called when the player closes an interactive battle scene: remember the engagement
    // as dismissed so the auto-open hook does not immediately re-open the same fight.
    markEngagementDismissed(missionId = '', encounterId = '', engagedAt = '') {
                if (!missionId || !encounterId || !engagedAt) return false;
                this.dismissedEngagements = this.dismissedEngagements || new Set();
                this.dismissedEngagements.add(`${missionId}:${encounterId}:${engagedAt}`);
                return true;
              }

    applyState(payload = {}, options = {}) {
                this.syncWorldClock?.(payload);
                const loadTrace = this.loadTrace || null;
                loadTrace?.mark?.('state:apply:start', {
                  payload: loadTrace.summarizePayload?.(payload) || null,
                });
                global.WorldMarchTrace?.log?.('app:applyState:input', {
                  payload: global.WorldMarchTrace?.summarizeApiPayload?.(payload) || null,
                  before: global.WorldMarchTrace?.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
                });
                const rawNextState = payload.gameState || payload.state || this.state;
                const nextState = WorldMarchOptimisticState?.reconcileState?.(this, rawNextState, { source: 'applyState' })
                  || rawNextState;
                const payloadWorldMap = global.CodexWorldMapDiag?.summarizeWorldMap?.(payload) || null;
                const nextStateSummary = global.CodexWorldMapDiag?.summarizeState?.(nextState) || null;
                global.CodexWorldMapDiag?.logChanged?.('state:applyState:input', {
                  source: payload.gameState ? 'payload.gameState' : (payload.state ? 'payload.state' : 'currentState'),
                  payloadHasWorldMap: Boolean(payloadWorldMap?.hasWorldMap),
                  payloadTileCount: payloadWorldMap?.tileCount || 0,
                  payloadVersion: payloadWorldMap?.version || 0,
                  nextTileCount: nextStateSummary?.worldMap?.tileCount || 0,
                  nextVersion: nextStateSummary?.worldMap?.version || 0,
                  nextCurrentTab: nextStateSummary?.currentTab || '',
                  nextMilitaryView: nextStateSummary?.militaryView || '',
                }, {
                  source: payload.gameState ? 'payload.gameState' : (payload.state ? 'payload.state' : 'currentState'),
                  payloadWorldMap,
                  nextState: nextStateSummary,
                });
                const nextTutorial = payload.tutorial ?? nextState.tutorial ?? this.tutorial ?? {};
                const localTab = this.getActiveTab();
                const localMilitaryView = this.state?.militaryView || this.militaryView || nextState.militaryView || 'army';
                const homeView = this.resolveMapHomeViewState(nextState, {
                  requestedTab: localTab,
                  militaryView: localMilitaryView,
                  forceMapHome: this.mapHomeActive && (localTab === 'resources' || localTab === 'military'),
                });
                StateWriter.commit(this, {
                  ...nextState,
                  currentTab: homeView.activeTab,
                  militaryView: homeView.militaryView,
                  softGuide: payload.softGuide ?? nextState.softGuide ?? null,
                  guideTasks: payload.guideTasks ?? nextState.guideTasks ?? { visible: false, tasks: [] },
                  taskCenter: payload.taskCenter ?? nextState.taskCenter ?? null,
                  eraProgress: payload.eraProgress ?? nextState.eraProgress,
                }, { source: 'applyState' });
                const assignedStateSummary = global.CodexWorldMapDiag?.summarizeState?.(this.state) || null;
                global.CodexWorldMapDiag?.logChanged?.('state:applyState:afterAssign', {
                  tileCount: assignedStateSummary?.worldMap?.tileCount || 0,
                  version: assignedStateSummary?.worldMap?.version || 0,
                  currentTab: assignedStateSummary?.currentTab || '',
                  militaryView: assignedStateSummary?.militaryView || '',
                  mapHomeActive: Boolean(this.mapHomeActive),
                }, {
                  state: assignedStateSummary,
                  mapHomeActive: Boolean(this.mapHomeActive),
                });
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
                global.WorldMarchTrace?.log?.('app:applyState:after', {
                  after: global.WorldMarchTrace?.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
                });
                this.playUnseenWorldCombatReports?.(this.state);
                if (options.render !== false) this.render();
                loadTrace?.ready?.({
                  source: 'applyState',
                  activeTab: this.state?.currentTab || '',
                  militaryView: this.state?.militaryView || '',
                });
              }

    getGameApi() {
                return this.gameAPI || this.api;
              }

    applyApiState(data = {}, options = {}) {
                this.syncWorldClock?.(data);
                const apiPayloadWorldMap = global.CodexWorldMapDiag?.summarizeWorldMap?.(data) || null;
                global.CodexWorldMapDiag?.logChanged?.('state:applyApiState:input', {
                  payloadHasWorldMap: Boolean(apiPayloadWorldMap?.hasWorldMap),
                  payloadTileCount: apiPayloadWorldMap?.tileCount || 0,
                  payloadVersion: apiPayloadWorldMap?.version || 0,
                  hasNormalizer: Boolean(this.stateNormalizer?.normalizeGameState),
                }, {
                  payloadWorldMap: apiPayloadWorldMap,
                  hasNormalizer: Boolean(this.stateNormalizer?.normalizeGameState),
                });
                global.WorldMarchTrace?.log?.('app:applyApiState:input', {
                  payload: global.WorldMarchTrace?.summarizeApiPayload?.(data) || null,
                  before: global.WorldMarchTrace?.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
                });
                if (this.stateNormalizer?.normalizeGameState) {
                  const nextState = this.stateNormalizer.normalizeGameState(data);
                  const normalizedStateSummary = global.CodexWorldMapDiag?.summarizeState?.(nextState) || null;
                  global.CodexWorldMapDiag?.logChanged?.('state:applyApiState:afterNormalizer', {
                    tileCount: normalizedStateSummary?.worldMap?.tileCount || 0,
                    version: normalizedStateSummary?.worldMap?.version || 0,
                    currentTab: normalizedStateSummary?.currentTab || '',
                    militaryView: normalizedStateSummary?.militaryView || '',
                    tutorialStep: normalizedStateSummary?.tutorial?.currentStep ?? null,
                  }, {
                    nextState: normalizedStateSummary,
                  });
                  this.tutorial = this.stateNormalizer.normalizeTutorialState?.(data) || this.tutorial || {};
                  this.syncFromServer(nextState, data.tutorial, data.eraProgress, options);
                  global.WorldMarchTrace?.log?.('app:applyApiState:afterNormalizer', {
                    after: global.WorldMarchTrace?.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
                  });
                  return;
                }
                this.applyState(data, options);
              }

    syncFromServer(serverState, tutorial, eraProgress, options = {}) {
                this.syncWorldClock?.({
                  gameState: serverState,
                  tutorial,
                  eraProgress,
                });
                const reconciledServerState = WorldMarchOptimisticState?.reconcileState?.(this, serverState, { source: 'syncFromServer' })
                  || serverState;
                const loadTrace = this.loadTrace || null;
                loadTrace?.mark?.('state:syncFromServer:start', {
                  payload: loadTrace.summarizePayload?.({ gameState: serverState }) || null,
                });
                global.WorldMarchTrace?.log?.('app:syncFromServer:input', {
                  server: global.WorldMarchTrace?.summarizeWorldExplorerState?.(reconciledServerState?.worldExplorerState),
                  before: global.WorldMarchTrace?.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
                });
                const serverStateSummary = global.CodexWorldMapDiag?.summarizeState?.(reconciledServerState) || null;
                const beforeStateSummary = global.CodexWorldMapDiag?.summarizeState?.(this.state) || null;
                global.CodexWorldMapDiag?.logChanged?.('state:syncFromServer:input', {
                  serverTileCount: serverStateSummary?.worldMap?.tileCount || 0,
                  serverVersion: serverStateSummary?.worldMap?.version || 0,
                  beforeTileCount: beforeStateSummary?.worldMap?.tileCount || 0,
                  beforeVersion: beforeStateSummary?.worldMap?.version || 0,
                  serverCurrentTab: serverStateSummary?.currentTab || '',
                  beforeCurrentTab: beforeStateSummary?.currentTab || '',
                }, {
                  serverState: serverStateSummary,
                  beforeState: beforeStateSummary,
                });
                const localTab = this.getActiveTab();
                const localMilitaryView = this.state?.militaryView || this.militaryView || 'army';
                const homeView = this.resolveMapHomeViewState(reconciledServerState, {
                  requestedTab: localTab,
                  militaryView: localMilitaryView,
                  forceMapHome: this.mapHomeActive && (localTab === 'resources' || localTab === 'military'),
                });
                StateWriter.commit(this, (prev) => (this.stateManager?.sync
                  ? this.stateManager.sync(
                    {
                      ...(prev || {}),
                      currentTab: homeView.activeTab,
                      militaryView: homeView.militaryView,
                    },
                    reconciledServerState,
                    eraProgress,
                  )
                  : {
                    ...reconciledServerState,
                    currentTab: homeView.activeTab,
                    militaryView: homeView.militaryView,
                    eraProgress: eraProgress ?? reconciledServerState?.eraProgress,
                  }), { source: 'syncFromServer:sync' });
                const syncedStateSummary = global.CodexWorldMapDiag?.summarizeState?.(this.state) || null;
                global.CodexWorldMapDiag?.logChanged?.('state:syncFromServer:afterSync', {
                  tileCount: syncedStateSummary?.worldMap?.tileCount || 0,
                  version: syncedStateSummary?.worldMap?.version || 0,
                  currentTab: syncedStateSummary?.currentTab || '',
                  militaryView: syncedStateSummary?.militaryView || '',
                  usedStateManager: Boolean(this.stateManager?.sync),
                }, {
                  state: syncedStateSummary,
                  usedStateManager: Boolean(this.stateManager?.sync),
                });
                const syncedHomeView = this.resolveMapHomeViewState(this.state, {
                  requestedTab: homeView.activeTab,
                  militaryView: homeView.militaryView,
                  forceMapHome: homeView.isMapHome,
                });
                StateWriter.commit(this, (prev) => ({
                  ...prev,
                  currentTab: syncedHomeView.activeTab,
                  militaryView: syncedHomeView.militaryView,
                }), { source: 'syncFromServer:homeView' });
                this.activeTab = this.state.currentTab || syncedHomeView.activeTab;
                this.militaryView = this.state.militaryView || syncedHomeView.militaryView;
                this.mapHomeActive = syncedHomeView.isMapHome;
                const nextTutorial = this.getEffectiveTutorialState(tutorial || this.tutorial || {});
                this.tutorial = nextTutorial;
                StateWriter.commit(this, (prev) => ({
                  ...prev,
                  tutorial: nextTutorial,
                }), { source: 'syncFromServer:tutorial' });
                const beforeRenderStateSummary = global.CodexWorldMapDiag?.summarizeState?.(this.state) || null;
                global.CodexWorldMapDiag?.logChanged?.('state:syncFromServer:beforeRender', {
                  tileCount: beforeRenderStateSummary?.worldMap?.tileCount || 0,
                  version: beforeRenderStateSummary?.worldMap?.version || 0,
                  currentTab: beforeRenderStateSummary?.currentTab || '',
                  militaryView: beforeRenderStateSummary?.militaryView || '',
                  tutorialStep: beforeRenderStateSummary?.tutorial?.currentStep ?? null,
                  mapHomeActive: Boolean(this.mapHomeActive),
                }, {
                  state: beforeRenderStateSummary,
                  mapHomeActive: Boolean(this.mapHomeActive),
                });
                this.tutorialController?.sync?.(nextTutorial);
                this.updateSyncInterval();
                this.hasServerState = true;
                if (this.loading.visible || this.canvasShell?.loading?.visible) {
                  this.loading = { visible: false, percentage: 100, message: '' };
                  if (this.canvasShell?.loading) this.canvasShell.loading = { visible: false, percentage: 100, message: '' };
                }
                this.setPendingBuildingAction(null, { render: false });
                global.WorldMarchTrace?.log?.('app:syncFromServer:after', {
                  after: global.WorldMarchTrace?.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
                });
                this.playUnseenWorldCombatReports?.(this.state);
                this.maybeAutoEnterEngagedBattle?.(this.state);
                if (options.render !== false) this.render();
                loadTrace?.ready?.({
                  source: 'syncFromServer',
                  activeTab: this.state?.currentTab || '',
                  militaryView: this.state?.militaryView || '',
                });
              }

    getSyncInterval() {
                return this.config?.SYNC_INTERVAL_MS || this.syncIntervalMs;
              }

    updateSyncInterval() {
                this.syncService?.setIntervalMs?.(this.getSyncInterval());
              }

    applyHeartbeat(data = {}) {
                this.syncWorldClock?.(data);
                if (!data || data.gameState) return data;
                const wasReconnecting = this.networkState?.status === 'reconnecting';
                const marchVerification = data.worldMarchVerification || data.marchVerification || null;
                const largeDrift = marchVerification?.status === 'pullback'
                  || (Array.isArray(marchVerification?.results)
                    && marchVerification.results.some((result) => result?.severity === 'large'));
                // Measured heartbeat round-trip from the API layer (real RTT,
                // never fabricated); keeps the previous reading while a
                // heartbeat is mid-flight or failed. Number(null) is 0, so a
                // cleared measurement must stay out of the readout explicitly.
                const rawHeartbeatLatency = this.api?.lastHeartbeatLatencyMs;
                const measuredLatencyMs = rawHeartbeatLatency === null || rawHeartbeatLatency === undefined
                  ? Number.NaN
                  : Number(rawHeartbeatLatency);
                this.networkState = {
                  ...(this.networkState || {}),
                  status: largeDrift ? 'reconnecting' : 'online',
                  failureCount: largeDrift ? Math.max(1, Number(this.networkState?.failureCount) || 0) : 0,
                  serverTime: data.serverTime || this.networkState?.serverTime || null,
                  heartbeatSeq: Number(data.heartbeatSeq) || this.networkState?.heartbeatSeq || 0,
                  latencyMs: Number.isFinite(measuredLatencyMs) && measuredLatencyMs >= 0
                    ? measuredLatencyMs
                    : (this.networkState?.latencyMs ?? null),
                  message: largeDrift
                    ? (WorldMarchOptimisticState?.SLOW_SYNC_MESSAGE || this.networkState?.message || null)
                    : null,
                  worldMarchReconciliation: marchVerification || null,
                };
                if (this.canvasShell?.setNetworkState) this.canvasShell.setNetworkState(this.networkState);
                else if (wasReconnecting || largeDrift) this.renderCanvasSurface(this.state?.currentTab);
                return data;
              }

    ensureWorldClock() {
                return WorldClockTimingModule.ensureWorldClock(this);
              }

    syncWorldClock(payload = {}) {
                return WorldClockTimingModule.syncWorldClock(this, payload);
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
                if (!nextTutorial.completed && TutorialFlowShared.stepEquals(nextTutorial.currentStep, tutorialSteps.farmBuilt) && this.isEra2AdvanceReady()) {
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

    async syncOnce() {
                const trace = this.loadTrace || null;
                trace?.phaseStart?.('state:syncOnce', {
                  hasToken: Boolean(this.token),
                  forceLog: true,
                });
                const data = await this.api.getState();
                this.applyState(data);
                trace?.phaseEnd?.('state:syncOnce', {
                  forceLog: true,
                  payload: trace.summarizePayload?.(data) || null,
                });
                return data;
              }

    async startHeartbeat() {
                const api = this.getGameApi();
                api?.setToken?.(this.token);
                const trace = this.loadTrace || null;
                trace?.phaseStart?.('state:first-sync', {
                  hasToken: Boolean(this.token),
                  hasSyncService: Boolean(this.syncService),
                  forceLog: true,
                });
                try {
                  if (this.syncService?.stop) this.syncService.stop();
                  await this.syncOnce();
                  trace?.phaseEnd?.('state:first-sync', {
                    forceLog: true,
                    next: 'heartbeat:start',
                  });
                  this.syncService?.start?.();
                } catch (error) {
                  trace?.phaseFail?.('state:first-sync', error);
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
                this.getScoutCountdownTimer().stop();
              }

    showUpdatePrompt(version) {
                this.stopHeartbeat();
                return this.updateRuntime?.promptAndReload?.(version);
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
                    const report = this.getWorldMarchClientReport?.();
                    this.api.heartbeat(report ? { worldMarchClientReport: report } : undefined).then((data) => this.applyHeartbeat(data)).catch((error) => this.applyConnectionState({
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
                    worldMapRuntimeHitTargets: this.worldMapRuntime?.getHitTargets?.() || [],
                    worldMapRuntimeContext: this.worldMapRuntime?.getLastTileMapContext?.()
                      || this.worldMapRuntime?.lastTileMapContext
                      || this.renderer?.lastWorldTileMapContext
                      || null,
                    preserveCanvas: worldMapLayerRendered,
                  }, worldMapFrameState || {})
                  : {
                    skipWorldMapLayer: worldMapLayerRendered,
                    worldMapRuntimeHitTargets: this.worldMapRuntime?.getHitTargets?.() || [],
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
                  panelSurfaceManager: this.getPanelSurfaceManager(),
                  armyFormationEditor: this.armyFormationEditor,
                  activeCommandPanel: panel.activeCommandPanel || '',
                  activeDockItemIds: panel.activeDockItemIds,
                  showTopBarDebugStats: panel.showTopBarDebugStats === true,
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
              }

    buildPanelRenderOptions(activeTab = this.getActiveTab(), options = {}) {
                const state = this.state || {};
                const homeView = this.resolveMapHomeViewState(state, {
                  requestedTab: activeTab || this.getActiveTab(),
                  militaryView: state.militaryView || this.militaryView,
                  forceMapHome: this.mapHomeActive && (activeTab === 'resources' || activeTab === 'military'),
                  allowDefaultMapHome: options.allowDefaultMapHome,
                });
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
                return {
                  ...this.buildRenderOptions(homeView.activeTab, this.territoryUiState, options),
                  ...options,
                  mode: 'hud',
                  activeTab: homeView.activeTab,
                  isMapHome: homeView.isMapHome,
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
                  panelSurfaceManager: this.getPanelSurfaceManager(),
                  armyFormationEditor: this.armyFormationEditor,
                  activeCommandPanel: panel.activeCommandPanel || '',
                  activeDockItemIds: panel.activeDockItemIds,
                  showTopBarDebugStats: panel.showTopBarDebugStats === true,
                  rewardReveal: snapshotRewardReveal,
                  buildingOffset: this.buildingOffset,
                  techTreePanX: this.techTreePanX,
                  techTreePanY: this.techTreePanY,
                  techTreeZoom: this.getTechTreeZoom(),
                  selectedTechId: state.techUiState?.selectedTechId || '',
                  techDetailOpen: panel.techDetailOpen || Boolean(state.techUiState?.detailOpen),
                  activeBuildingCategory: this.activeBuildingCategory,
                  pendingBuildingAction: this.pendingBuildingAction || null,
                  activeEventId: snapshotEvent?.eventId ?? null,
                  targetPicker: snapshotTargetPicker,
                  ...(snapshotBattleScene ? { battleScene: snapshotBattleScene } : {}),
                  ...(this.entityBattle ? { entityBattle: this.entityBattle } : (snapshotEntityBattle ? { entityBattle: snapshotEntityBattle } : {})),
                  naming: snapshotNaming,
                  tutorialIntro: this.tutorialIntro || null,
                  tutorialAdvisorDialogue: this.tutorialAdvisorDialogue || null,
                  tutorialHighlight: options.tutorialHighlight || null,
                  loading: this.loading,
                  network: this.networkState,
                  confirmDialog: snapshotConfirmDialog,
                };
              }

    renderPanelSurface(activeTab = this.getActiveTab(), options = {}) {
                if (this.canvasShell?.renderPanelSurface) {
                  return this.canvasShell.renderPanelSurface(this.state, activeTab, options);
                }
                if (!this.renderer?.render) return false;
                this.renderer.render(this.state, this.buildPanelRenderOptions(activeTab, options));
                return true;
              }

    getPanelOverlaySurfaceHost() {
                return this.canvasShell && this.canvasShell !== this ? this.canvasShell : this;
              }

    getPanelOverlayLayerOptions(overrides = {}) {
                const registry = this.getCanvasLayerRegistry?.() || CanvasLayerRegistryBase || global.CanvasLayerRegistry;
                return registry?.getLayerOptions?.('panelOverlay', overrides) || {
                  zIndex: 1001,
                  pointerEvents: 'none',
                  ...(overrides || {}),
                };
              }

    getPanelOverlayCanvas() {
                const surfaceHost = this.getPanelOverlaySurfaceHost();
                if (surfaceHost && surfaceHost !== this && typeof surfaceHost.getPanelOverlayCanvas === 'function') {
                  return surfaceHost.getPanelOverlayCanvas();
                }
                if (typeof this.getCanvasLayerCanvas === 'function') return this.getCanvasLayerCanvas('panelOverlay');
                return this.runtime?.getLayerCanvas?.('panelOverlay') || null;
              }

    ensurePanelOverlayCanvas() {
                const surfaceHost = this.getPanelOverlaySurfaceHost();
                if (surfaceHost && surfaceHost !== this && typeof surfaceHost.ensurePanelOverlayCanvas === 'function') {
                  return surfaceHost.ensurePanelOverlayCanvas();
                }
                if (typeof this.ensureCanvasLayer === 'function') return this.ensureCanvasLayer('panelOverlay');
                if (typeof this.runtime?.ensureLayerCanvas === 'function') {
                  return this.runtime.ensureLayerCanvas('panelOverlay', this.getPanelOverlayLayerOptions());
                }
                return null;
              }

    setPanelOverlayVisible(visible = true) {
                const surfaceHost = this.getPanelOverlaySurfaceHost();
                if (surfaceHost && surfaceHost !== this && typeof surfaceHost.setPanelOverlayVisible === 'function') {
                  return surfaceHost.setPanelOverlayVisible(visible);
                }
                if (typeof this.setCanvasLayerVisible === 'function') return this.setCanvasLayerVisible('panelOverlay', visible);
                return this.runtime?.setLayerVisible?.('panelOverlay', visible) || false;
              }

    clearPanelOverlayCanvas(canvas = this.getPanelOverlayCanvas(), ctx = null) {
                const context = ctx || canvas?.getContext?.('2d') || null;
                if (!canvas || !context || typeof context.clearRect !== 'function') return false;
                const pixelRatio = Math.max(1, Number(canvas._backingStorePixelRatio) || this.runtime?.pixelRatio || 1);
                if (typeof context.setTransform === 'function') context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
                const width = Number(this.renderer?.width) || Number(this.runtime?.width) || Number(canvas.width) || 0;
                const height = Number(this.renderer?.height) || Number(this.runtime?.height) || Number(canvas.height) || 0;
                context.clearRect(0, 0, Math.max(1, width), Math.max(1, height));
                return true;
              }

    getPanelOverlayRenderOptions(options = {}) {
                const state = options.state || this.getState?.() || this.state || {};
                const owner = this.lastGame && this.lastGame !== this ? this.lastGame : this;
                const activeTab = options.activeTab || state.currentTab || this.getActiveTab?.() || 'resources';
                return {
                  ...options,
                  activeTab,
                  mode: 'panelOverlay',
                  panelSurfaceManager: options.panelSurfaceManager || this.getPanelSurfaceManager?.() || null,
                  famousPersonsPage: owner?.famousPersonsPage ?? this.famousPersonsPage ?? 0,
                  selectedFamousPersonId: owner?.selectedFamousPersonId ?? this.selectedFamousPersonId ?? '',
                  showFpsOverlay: false,
                };
              }

    renderPanelOverlaySurface(panelKey = '', manager = null, options = {}) {
                const surfaceHost = this.getPanelOverlaySurfaceHost();
                if (surfaceHost && surfaceHost !== this && typeof surfaceHost.renderPanelOverlaySurface === 'function') {
                  return surfaceHost.renderPanelOverlaySurface(panelKey, manager, {
                    ...options,
                    state: options.state || this.getState?.() || this.state || null,
                  });
                }
                const renderer = this.renderer || null;
                if (!renderer || !manager?.renderPanel) return false;
                const canvas = this.ensurePanelOverlayCanvas();
                const ctx = canvas?.getContext?.('2d') || null;
                if (!canvas || !ctx) return false;
                const state = options.state || this.getState?.() || this.state || {};
                const renderOptions = this.getPanelOverlayRenderOptions({
                  ...options,
                  state,
                  panelSurfaceManager: manager,
                });
                const shouldClear = options.clear !== false;
                if (shouldClear) this.clearPanelOverlayCanvas(canvas, ctx);
                const previousCanvas = renderer.canvas;
                renderer.canvas = canvas;
                const drawPanel = () => {
                  const renderModalTargets = () => {
                    renderer.beginFrame?.(renderOptions);
                    if (shouldClear) {
                      if (typeof renderer.clearHitTargetPool === 'function') renderer.clearHitTargetPool('modal');
                      else renderer.setHitTargets?.([]);
                    }
                    const rendered = manager.renderPanel(panelKey, renderer, state, renderOptions);
                    renderer.endFrame?.(renderOptions);
                    return rendered;
                  };
                  return typeof renderer.withHitTargetPool === 'function'
                    ? renderer.withHitTargetPool('modal', renderModalTargets)
                    : renderModalTargets();
                };
                try {
                  if (typeof renderer.withRenderCtx === 'function') renderer.withRenderCtx(ctx, drawPanel);
                  else drawPanel();
                } finally {
                  renderer.canvas = previousCanvas;
                }
                this.setPanelOverlayVisible(true);
                return true;
              }

    clearPanelOverlaySurface(_panelKey = '', _manager = null, options = {}) {
                const surfaceHost = this.getPanelOverlaySurfaceHost();
                if (surfaceHost && surfaceHost !== this && typeof surfaceHost.clearPanelOverlaySurface === 'function') {
                  return surfaceHost.clearPanelOverlaySurface(_panelKey, _manager, options);
                }
                const canvas = this.getPanelOverlayCanvas();
                if (canvas) this.clearPanelOverlayCanvas(canvas);
                if (typeof this.renderer?.clearHitTargetPool === 'function') this.renderer.clearHitTargetPool('modal');
                this.setPanelOverlayVisible(false);
                return true;
              }

    getPanelSurfaceManager() {
                const shell = this.canvasShell && this.canvasShell !== this ? this.canvasShell : null;
                if (shell?.panelSurfaceManager) return shell.panelSurfaceManager;
                if (shell && typeof shell.getPanelSurfaceManager === 'function') {
                  const manager = shell.getPanelSurfaceManager();
                  if (manager) return manager;
                }
                if (!this.panelSurfaceManager && CanvasPanelSurfaceManager) {
                  this.panelSurfaceManager = new CanvasPanelSurfaceManager({ host: this });
                }
                return this.panelSurfaceManager || null;
              }

    projectPanelSurface(panelKey = 'famousPersons', options = {}) {
                const manager = this.getPanelSurfaceManager?.() || null;
                return manager?.projectModalLayer?.({ ...options, requestedPanelKey: panelKey }) === true;
              }

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
              }

    // Timer lifecycles are single-owned by SHAPE-B timer classes (re-decomposition
    // slice 7), composed lazily so prototype-only test hosts keep working. The
    // water tick body stays here as the host callback -- it is render-stack
    // orchestration, and CanvasGameShell keeps its own divergent implementation.
    getScoutCountdownTimer() {
                if (!this.scoutCountdown) {
                  this.scoutCountdown = new ScoutCountdownTimer({ host: this });
                }
                return this.scoutCountdown;
              }

    getTileMapWaterAnimationTimer() {
                if (!this.tileMapWaterAnimation) {
                  this.tileMapWaterAnimation = new TileMapWaterAnimationTimer({
                    host: this,
                    tick: () => this.tickTileMapWaterAnimation(),
                  });
                }
                return this.tileMapWaterAnimation;
              }

    tickTileMapWaterAnimation() {
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
              }

    startTileMapWaterTimer() {
                return this.getTileMapWaterAnimationTimer().start();
              }

    stopTileMapWaterTimer() {
                return this.getTileMapWaterAnimationTimer().stop();
              }

    now() {
                return CanvasGameAppRenderScheduler.now(this);
              }

    getWorldEpochNowMs() {
                return WorldClockTimingModule.getWorldEpochNowMs(this);
              }

    wait(ms = 0) {
                return CanvasGameAppRenderScheduler.wait(this, ms);
              }

    getActiveTab() {
                return this.activeTab || this.state?.currentTab || 'resources';
              }

    resolveMapHomeViewState(state = this.state, options = {}) {
                if (this.presenter?.resolveMapHomeViewState) {
                  return this.presenter.resolveMapHomeViewState(state || {}, options);
                }
                return CanvasGameAppRenderPolicy.resolveMapHomeViewState(state || {}, options);
              }

    getTabOrder() {
                return CanvasGameAppRenderPolicy.getTabOrder();
              }

    getTransitionDurationMs() {
                return CanvasGameAppRenderScheduler.getTransitionDurationMs(this);
              }

    getAnimationFrameMs() {
                return CanvasGameAppRenderScheduler.getAnimationFrameMs(this);
              }

    getWorldTileWaterAnimationFrameMs() {
                return CanvasGameAppRenderScheduler.getWorldTileWaterAnimationFrameMs(this);
              }

    getWorldMapDragCooldownMs() {
                return CanvasGameAppRenderScheduler.getWorldMapDragCooldownMs(this);
              }

    getRequestAnimationFrame() {
                return CanvasGameAppRenderScheduler.getRequestAnimationFrame(this);
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
              }

    getCanvasActionState() {
                return this.state;
              }

    renderCanvasAction(_action = {}) {
                return this.renderCanvasSurface();
              }

    resetForCanvasTabSwitch() {
                CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showResourceDetails');
                CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showCitySwitcher');
                CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showSubcityList');
                CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showCityManagement');
                this.closeEventSnapshot?.();
                CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showTaskCenter');
                CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showGuidebook');
                this.getPanelSurfaceManager()?.closePanel?.('famousPersons', { render: false });
                this.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], soldierAssignments: {}, soldierDraftAssignments: {}, page: 0, saving: false };
                CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'activeCommandPanel');
                this.closeRewardRevealSnapshot?.();
                this.activeBuildingCategory = 'all';
                this.buildingOffset = 0;
                this.techTreePanX = 0;
                this.techTreePanY = 0;
                this.techTreeZoom = 1;
                CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'techDetailOpen');
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
                CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'techDetailOpen');
                this.techTreeDragStart = null;
                this.closeEventSnapshot?.();
                TerritoryUiStateStore?.clearWorldSelection?.(this, { clearWorldMarchTarget: true });
                this.territoryController?.closeSiteDialog?.({ render: false });
                CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showResourceDetails');
                CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showCitySwitcher');
                CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showSubcityList');
                CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showCityManagement');
                CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showTaskCenter');
                CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showGuidebook');
                this.getPanelSurfaceManager()?.closePanel?.('famousPersons', { render: false });
                this.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], soldierAssignments: {}, soldierDraftAssignments: {}, page: 0, saving: false };
                CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'activeCommandPanel');
                this.activeTaskCenterTab = 'main';
                this.activeGuidebookTab = 'planning';
                this.pageTransition = null;
                this.buildingTransition = null;
                if (this.canvasShell) {
                  TerritoryUiStateStore?.ensure?.(this.canvasShell);
                  this.canvasShell.closeWorldSiteHud?.({ render: false });
                }
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
                CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'techDetailOpen');
                this.techTreeDragStart = null;
                this.buildingTransition = null;
                this.startPageTransition(previousTab, this.activeTab, { fromBuildingOffset: previousBuildingOffset });
                this.closeEventSnapshot?.();
                this.renderMilitaryView();
                this.renderCanvasSurface(this.state.currentTab);
                this.renderSoftGuide();
              }

    getPreferredMilitaryView(tabId) {
                return CanvasGameAppRenderPolicy.getPreferredMilitaryView(tabId, this.state?.softGuide || {});
              }

    switchMilitaryView(view) {
                const allowed = ['army', 'scout', 'world', 'veteranCamp'];
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
              }

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
              }

    updateMilitaryViewLocks() {
                this.renderMilitaryView();
              }

    renderMilitary() {
                this.updateMilitaryViewLocks();
                this.renderCanvasSurface(this.state?.currentTab);
              }

    startScoutCountdownTimer() {
                this.getScoutCountdownTimer().start();
              }

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
              }

    showLoading(message = '') {
            this.loading = {
              visible: true,
              percentage: 0,
              message: message || t('shell.loading.defaultMessage'),
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

    async loadGameAssets(options = {}) {
            const message = options.message || t('shell.loading.defaultMessage');
            const hideWhenDone = options.hideWhenDone !== false;
            const minimumDurationMs = Number.isFinite(options.minimumDurationMs)
              ? Math.max(0, options.minimumDurationMs)
              : 3000;
            const trace = this.loadTrace || null;
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
              this.updateLoading({ percentage: 100, message: t('shell.loading.assetsReady') });
              if (hideWhenDone) this.hideLoading();
            }
          }

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
            return true;
          }

    selectBuildingCategory(action = {}) {
            const category = action.category || 'all';
            const previous = this.activeBuildingCategory || 'all';
            this.activeBuildingCategory = category;
            this.buildingOffset = 0;
            this.buildingTransition = null;
            return category !== previous;
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
            return true;
          }

    getTechTreeZoom() {
            return Math.max(0.65, Math.min(1.6, Number(this.techTreeZoom) || 1));
          }

    setTechTreeZoom(zoom = 1) {
            const nextZoom = Math.max(0.65, Math.min(1.6, Number(zoom) || 1));
            this.techTreeZoom = nextZoom;
            return true;
          }

    getWorldActorAnimationFrameMs() {
            return getFrameMs(this);
          }

    shouldAnimateWorldActors(options = {}) {
            return shouldAnimateWorldActors(this, options);
          }

    renderWorldActorAnimationFrame(options = {}) {
            if (!this.shouldAnimateWorldActors(options)) return false;
            const now = this.now?.() ?? Date.now();
            const frameMs = Math.max(1, this.getWorldActorAnimationFrameMs() - 1);
            if (!options.force && this.lastWorldActorAnimationRenderAt && now - this.lastWorldActorAnimationRenderAt < frameMs) return false;
            this.lastWorldActorAnimationRenderAt = now;
            return renderWorldActorLayerFrame(this, options);
          }

    requestWorldActorAnimationFrame(options = {}) {
            this.worldActorQueuedRenderOptions = {
              ...(this.worldActorQueuedRenderOptions || {}),
              ...options,
            };
            if (this.worldActorAnimationQueued) return true;
            const raf = getRequestAnimationFrame(this);
            if (!raf) {
              const queuedOptions = this.worldActorQueuedRenderOptions || {};
              this.worldActorQueuedRenderOptions = null;
              return this.renderWorldActorAnimationFrame(queuedOptions);
            }
            this.worldActorAnimationQueued = true;
            raf(() => {
              this.worldActorAnimationQueued = false;
              const queuedOptions = this.worldActorQueuedRenderOptions || {};
              this.worldActorQueuedRenderOptions = null;
              this.renderWorldActorAnimationFrame(queuedOptions);
              if (this.shouldAnimateWorldActors()) this.requestWorldActorAnimationFrame();
              else this.stopWorldActorAnimationLoop();
            });
            return true;
          }

    startWorldActorAnimationLoop(options = {}) {
            if (!canRenderWorldActorLayer(this)) return false;
            if (!this.shouldAnimateWorldActors(options)) {
              this.stopWorldActorAnimationLoop();
              return false;
            }
            if (this.worldActorAnimationActive) return true;
            this.worldActorAnimationActive = true;
            return this.requestWorldActorAnimationFrame({ force: true, ...options });
          }

    stopWorldActorAnimationLoop() {
            this.worldActorAnimationActive = false;
            this.worldActorQueuedRenderOptions = null;
            return true;
          }

    updateWorldActorAnimationLoop(options = {}) {
            return this.shouldAnimateWorldActors(options)
              ? this.startWorldActorAnimationLoop(options)
              : this.stopWorldActorAnimationLoop();
          }

    // The turn-card battle-scene timers + turn-duration policy are single-owned
          // by BattleSceneController on the state host (re-decomposition slice 9),
          // composed lazily. The scene session itself stays in BattleStore.
          getBattleSceneController() {
                const owner = this.getStateHost() || this;
                if (!owner.battleSceneController) {
                  owner.battleSceneController = new BattleSceneController({ host: owner });
                }
                return owner.battleSceneController;
              }

    getBattleBaseTurnDurationMs() {
                return this.getBattleSceneController().getBaseTurnDurationMs();
              }

    getBattleSkillCutInDurationMs() {
                return this.getBattleSceneController().getSkillCutInDurationMs();
              }

    getBattleTurnDurationMs(turn = null) {
                return this.getBattleSceneController().getTurnDurationMs(turn);
              }

    getCurrentBattleTurnDurationMs(scene = null) {
                return this.getBattleSceneController().getCurrentTurnDurationMs(scene);
              }

    getBattleStore() {
                return BattleStore || global.BattleStore || null;
              }

    invalidateRendererSnapshot() {
                this.__ecsRendererSnapshot = null;
                if (this.canvasShell) this.canvasShell.__ecsRendererSnapshot = null;
              }

    getBattleSceneSession() {
                const store = this.getBattleStore();
                return store ? store.getBattleScene() : null;
              }

    // The live entity-battle session + stepping timer are single-owned by
          // EntityBattleController on the state host (re-decomposition slice 8),
          // composed lazily so prototype-only test hosts keep working. The accessor
          // keeps the legacy field name alive for every read site (render options,
          // input routing, shell lastGame reads, mode facts); BattleStore keeps
          // holding the SAME live session reference via publish().
          getEntityBattleController() {
                const owner = this.getStateHost() || this;
                if (!owner.entityBattleController) {
                  owner.entityBattleController = new EntityBattleController({ host: owner });
                }
                return owner.entityBattleController;
              }

    get entityBattle() {
                return this.getEntityBattleController().session;
              }

    set entityBattle(value) {
                this.getEntityBattleController().session = value;
              }

    // The tutorial-highlight blob is single-owned by TutorialGuideUiController on
          // the state host (re-decomposition slice 10), composed lazily. The accessor
          // keeps the legacy field name alive for every read/write site (shell input
          // gating + render paths, advisor flows, mode facts), which retires the
          // app<->shell highlight mirror.
          getTutorialGuideUiController() {
                const owner = this.getStateHost() || this;
                if (!owner.tutorialGuideUiController) {
                  owner.tutorialGuideUiController = new TutorialGuideUiController({ host: owner });
                }
                return owner.tutorialGuideUiController;
              }

    get tutorialHighlight() {
                return this.getTutorialGuideUiController().highlight;
              }

    set tutorialHighlight(value) {
                this.getTutorialGuideUiController().highlight = value;
              }

    publishEntityBattle(session) {
                return this.getEntityBattleController().publish(session);
              }

    openEntityBattle(opts = {}) {
                return this.getEntityBattleController().open(opts);
              }

    startEntityBattleTimer() {
                return this.getEntityBattleController().startTimer();
              }

    stopEntityBattleTimer() {
                return this.getEntityBattleController().stopTimer();
              }

    tickEntityBattle() {
                return this.getEntityBattleController().tick();
              }

    recordEntityInput(input) {
                return this.getEntityBattleController().recordInput(input);
              }

    issueEntityInput(input) {
                return this.getEntityBattleController().issueInput(input);
              }

    entityBattleSelectGeneral(gid) {
                return this.getEntityBattleController().selectGeneral(gid);
              }

    entityBattleOrder(gid, order) {
                return this.getEntityBattleController().order(gid, order);
              }

    entityBattleMaster(order) {
                return this.getEntityBattleController().master(order);
              }

    entityBattleSkill(gid, skillId) {
                return this.getEntityBattleController().skill(gid, skillId);
              }

    toggleEntityBattleAuto() {
                return this.getEntityBattleController().toggleAuto();
              }

    entityBattleZoom(gesture = {}) {
                return this.getEntityBattleController().zoom(gesture);
              }

    entityBattleDrag(phase, point = {}) {
                return this.getEntityBattleController().drag(phase, point);
              }

    onEntityBattleEnd() {
                return this.getEntityBattleController().onEnd();
              }

    submitEntityResolve() {
                return this.getEntityBattleController().submitResolve();
              }

    closeEntityBattle() {
                return this.getEntityBattleController().close();
              }

    // LIVE attack on an active encounter tile. Opens a session on the backend
          // (startWorldCombat 鈫?deterministic {battleId, setup}, no simulation), then
          // runs the INTERACTIVE battle scene; on battle end it submits the recorded
          // inputStream to resolveWorldCombat for the authoritative result. Returns a
                // promise that resolves true when the scene opened. Falls back to false so
          // the caller can use the passive report path when prerequisites are missing.
          async enterInteractiveBattle(options = {}) {
                const view = (typeof window !== 'undefined' ? window : globalThis);
                const api = this.getGameApi?.() || this.api;
                if (typeof this.openEntityBattle !== 'function' || !api?.startWorldCombat || !view.BattleSimCore) {
                  view.console?.log?.('[battle-interactive] enterInteractiveBattle:abort', {
                    hasScene: typeof this.openEntityBattle === 'function', hasApi: !!api?.startWorldCombat, hasCore: !!view.BattleSimCore,
                  });
                  return false;
                }
                let opened = null;
                try {
                  opened = await api.startWorldCombat({
                    encounterId: options.encounterId || options.engagement?.encounterId || '',
                    missionId: options.missionId || '',
                    formationSlot: options.formationSlot ?? options.slot ?? 1,
                    cityId: options.cityId || this.state?.activeCityId || 'capital',
                    targetQ: options.targetQ ?? options.q,
                    targetR: options.targetR ?? options.r,
                  });
                } catch (err) {
                  view.console?.error?.('[battle-interactive] startWorldCombat failed:', err);
                  this.log?.(t('battle.scene.openFailed', { message: err?.payload?.message || err?.message || '' }));
                  return false;
                }
                if (!opened || opened.success === false || !opened.setup || !opened.battleId) {
                  this.log?.(opened?.message || t('battle.scene.cannotOpenHere'));
                  return false;
                }
                this.applyApiState?.(opened);
                const battleId = opened.battleId;
                const encounterId = opened.session?.encounterId
                  || opened.encounter?.id
                  || options.encounterId
                  || options.engagement?.encounterId
                  || '';
                const shown = this.openEntityBattle({
                  mode: 'interactive',
                  battleId,
                  setup: opened.setup,
                  encounter: opened.encounter,
                  battleTarget: opened.battleTarget,
                  onResolve: async ({ inputStream }) => {
                    try {
                      const resolved = await api.resolveWorldCombat(
                        battleId,
                        inputStream,
                        encounterId,
                      );
                      // The interactive scene already played this battle live. The
                      // authoritative re-sim pushes its report into recentReports, so
                      // mark it seen BEFORE applyApiState 鈥?otherwise the passive
                      // BattleReplayOverlay replays the very same fight right after
                      // (the "鍐涗护鐗?+ 鏃犲啗浠ょ増 浜ゆ浛鍑虹幇" double-play). The passive
                      // path stays only for unattended reports.
                      const playedReportId = resolved?.report?.id;
                      if (playedReportId) {
                        this.playedWorldCombatReportIds = this.playedWorldCombatReportIds || new Set();
                        this.playedWorldCombatReportIds.add(playedReportId);
                      }
                      this.applyApiState?.(resolved);
                      return resolved;
                    } catch (err) {
                      view.console?.error?.('[battle-interactive] resolveWorldCombat failed:', err);
                      this.log?.(t('battle.scene.settleFailed', { message: err?.payload?.message || err?.message || '' }));
                      return null;
                    }
                  },
                  onClose: () => {
                    // Player dismissed the retreat window without resolving: remember this
                    // engagement so the auto-open hook does not immediately re-open it on the
                    // next sync (the backend timeout fallback settles it if it stays engaged).
                    const engagement = options.engagement;
                    if (engagement) {
                      this.markEngagementDismissed?.(
                        engagement.missionId,
                        engagement.encounterId,
                        engagement.engagedAt,
                      );
                    }
                    this.renderCanvasSurface?.(this.state?.currentTab || 'military');
                  },
                });
                return shown !== false;
              }

    startBattleScene(report = null) {
                return this.getBattleSceneController().start(report);
              }

    stopBattleSceneTimer() {
                return this.getBattleSceneController().stopTurnTimer();
              }

    stopBattleAnimationTimer() {
                return this.getBattleSceneController().stopAnimationTimer();
              }

    startBattleAnimationTimer() {
                return this.getBattleSceneController().startAnimationTimer();
              }

    advanceBattleSceneTurn() {
                return this.getBattleSceneController().advanceTurn();
              }

    startBattleSceneTimer() {
                return this.getBattleSceneController().startTurnTimer();
              }

    closeBattleScene() {
                return this.getBattleSceneController().close();
              }

    skipBattleScene() {
                return this.getBattleSceneController().skip();
              }

    async runAction(callback) {
                try {
                  const data = await callback();
                  if (data) this.applyState(data);
                  return data;
                } catch (error) {
                  this.log(error.payload?.message || error.message || t('command.action.failed', {}));
                  return null;
                }
              }

    async seekFamousPerson(source = 'seek') {
                try {
                  const result = await this.getGameApi().seekFamousPerson(source);
                  this.applyApiState(result, { render: false });
                  this.log(result.message || t('command.famous.seekComplete'));
                  this.getPanelSurfaceManager()?.openPanel?.('famousPersons');
                  return result;
                } catch (error) {
                  this.log(t('command.famous.seekFailed', { message: error.payload?.message || error.message }));
                  this.projectPanelSurface('famousPersons', { source: 'seekFamousPerson:failure' });
                  return false;
                }
              }

    async acceptFamousPerson(candidateId) {
                try {
                  const result = await this.getGameApi().acceptFamousPerson(candidateId);
                  this.applyApiState(result, { render: false });
                  this.log(result.message || t('command.famous.accepted', {}));
                  this.getPanelSurfaceManager()?.openPanel?.('famousPersons');
                  return true;
                } catch (error) {
                  this.log(t('command.famous.acceptFailed', { message: error.payload?.message || error.message }));
                  this.projectPanelSurface('famousPersons', { source: 'acceptFamousPerson:failure' });
                  return false;
                }
              }

    async dismissFamousPersonCandidate(candidateId) {
                try {
                  const result = await this.getGameApi().dismissFamousPersonCandidate(candidateId);
                  this.applyApiState(result, { render: false });
                  this.log(result.message || t('command.famous.dismissed', {}));
                  this.getPanelSurfaceManager()?.openPanel?.('famousPersons');
                  return true;
                } catch (error) {
                  this.log(t('command.famous.dismissFailed', { message: error.payload?.message || error.message }));
                  this.projectPanelSurface('famousPersons', { source: 'dismissFamousPersonCandidate:failure' });
                  return false;
                }
              }

    async assignFamousAttributePoint(personId, attribute) {
                try {
                  const result = await this.getGameApi().assignFamousAttributePoint(personId, attribute);
                  this.applyApiState(result, { render: false });
                  const manager = this.getPanelSurfaceManager();
                  manager?.openPanel?.('famousPersons', { render: false });
                  manager?.runPanelAction?.('famousPersons', 'openDetail', { personId }, { render: false });
                  this.log(result.message || t('command.famous.attributeUpgraded'));
                  manager?.projectModalLayer?.({ requestedPanelKey: 'famousPersons', source: 'assignFamousAttributePoint:success' });
                  return true;
                } catch (error) {
                  this.log(t('command.famous.attributePointFailed', { message: error.payload?.message || error.message }));
                  this.projectPanelSurface('famousPersons', { source: 'assignFamousAttributePoint:failure' });
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

    async handleBuildingSuccess(result, action, buildingId) {
                if (this.commandService?.handleBuildingSuccess) {
                  this.pendingTutorialAdvisorDialogue = action === 'build' && buildingId === 'house';
                  try {
                    const handled = await this.commandService.handleBuildingSuccess(result, action, buildingId);
                    this.tutorialController?.sync?.(this.tutorial);
                    this.maybeShowHouseBuiltAdvisor(action, buildingId);
                    return handled;
                  } finally {
                    this.pendingTutorialAdvisorDialogue = false;
                  }
                }
                this.pendingTutorialAdvisorDialogue = action === 'build' && buildingId === 'house';
                try {
                  this.applyApiState(result);
                  this.showFloatingText(action === 'upgrade' ? t('command.building.upgradeSuccess') : t('command.building.buildSuccess'));
                  this.log(t('command.success.detail', { message: result?.message || '' }));
                  this.tutorialController?.sync?.(this.tutorial);
                  this.maybeShowHouseBuiltAdvisor(action, buildingId);
                  return true;
                } finally {
                  this.pendingTutorialAdvisorDialogue = false;
                }
              }

    maybeShowHouseBuiltAdvisor(action, buildingId) {
                const steps = this.tutorialController?.constructor?.TUTORIAL_STEPS || {};
                if (action !== 'build' || buildingId !== 'house') return false;
                if (!TutorialFlowShared.stepEquals(this.tutorial?.currentStep, steps.houseBuilt)) return false;
                return this.showHouseBuiltAdvisorDialogue();
              }

    showHouseBuiltAdvisorDialogue() {
                const message = t('command.house.builtAdvisor');
                StateWriter.commit(this, (prev) => ({
                  ...(prev || {}),
                  softGuide: {
                    mode: 'strong',
                    target: 'tab-civilization',
                    message,
                  },
                }), { source: 'houseBuiltAdvisor' });
                CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showAdvisor');
                CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showCityManagement');
                CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showSubcityList');
                CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'activeCommandPanel');
                this.closeEventSnapshot?.();
                this.tutorialHighlight = null;
                this.tutorialAdvisorDialogue = { message, advisorName: t('tutorial.advisorName'), source: 'houseBuilt' };
                if (this.canvasShell) {
                  this.canvasShell.tutorialAdvisorDialogue = this.tutorialAdvisorDialogue;
                }
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
                  this.log(t('command.auth.loginRequired'));
                  return false;
                }
                try {
                  const result = await this.getGameApi().assignJob(job, delta);
                  if (result?.success === false) {
                    this.log(result.message || t('command.job.assignFailed'));
                    const data = await this.getGameApi().getState?.();
                    if (data?.gameState) this.applyApiState(data);
                    return false;
                  }
                  this.applyApiState(result);
                  this.log(t('command.job.assigned', { delta: `${delta > 0 ? '+' : ''}${delta}`, job }));
                  return true;
                } catch (error) {
                  this.log(t('command.job.assignFailedDetail', { message: error.payload?.message || error.message }));
                  try {
                    const data = await this.getGameApi().getState?.();
                    if (data?.gameState) this.applyApiState(data);
                  } catch (_error) {
                    return false;
                  }
                  return false;
                }
              }

    async applyTalentPolicy(policyId) {
                if (!policyId) return false;
                try {
                  const result = await this.getGameApi().applyTalentPolicy(policyId);
                  this.applyApiState(result);
                  this.showFloatingText(result.message || t('command.policy.applied', {}));
                  this.log(result.message || t('command.policy.applied', {}));
                  return true;
                } catch (error) {
                  this.log(t('command.policy.failed', { message: error.payload?.message || error.message }));
                  this.renderCanvasSurface(this.state?.currentTab);
                  return false;
                }
              }

    async advanceEra() {
                try {
                  const result = await this.getGameApi().advanceEra();
                  this.applyApiState(result);
                  this.tutorialController?.sync?.(this.tutorial);
                  this.tutorialController?.onEraAdvanced?.(result);
                  this.log(t('command.era.entered', { message: result.message || this.state.currentEraName || '' }));
                  this.showFloatingText(result.message || this.state.currentEraName || t('command.era.advanced', {}));
                  return true;
                } catch (error) {
                  this.log(t('command.failedDetail', { message: error.payload?.message || error.message }));
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

    async startWorldMarch(options = {}) {
                let optimistic = null;
                try {
                  const trace = global.WorldMarchTrace;
                  trace?.log?.('app:startWorldMarch:begin', {
                    options: {
                      mode: options.mode || 'manual',
                      targetQ: options.targetQ ?? options.q ?? options.x ?? null,
                      targetR: options.targetR ?? options.r ?? options.y ?? null,
                      formationSlot: options.formationSlot ?? options.slot ?? null,
                    },
                    before: trace.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
                  });
                  optimistic = WorldMarchOptimisticState?.beginStart?.(this, { ...options, mode: 'manual' }) || null;
                  const api = this.getGameApi();
                  const result = await api.startWorldMarch({ ...options, mode: 'manual' });
                  trace?.log?.('app:startWorldMarch:apiResult', {
                    result: trace.summarizeApiPayload?.(result) || result,
                  });
                  this.applyApiState(result);
                  WorldMarchOptimisticState?.complete?.(this, optimistic || result?.mission?.id || '');
                  trace?.log?.('app:startWorldMarch:afterApply', {
                    after: trace.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
                  });
                  TerritoryUiStateStore?.patch?.(this, {
                    worldMarchTarget: null,
                    selectedWorldActorId: '',
                    selectedWorldMissionId: '',
                  });
                  this.tutorialController?.sync?.(this.tutorial);
                  this.tutorialController?.onExploreStarted?.(result);
                  this.showFloatingText(result.message || t('command.worldMarch.started', {}));
                  this.log(result.message || t('command.worldMarch.started', {}));
                  return true;
                } catch (error) {
                  global.WorldMarchTrace?.error?.('app:startWorldMarch:error', {
                    message: error.payload?.message || error.message,
                    payload: global.WorldMarchTrace?.summarizeApiPayload?.(error.payload) || error.payload || null,
                  });
                  WorldMarchOptimisticState?.rollback?.(this, optimistic || '', { render: false });
                  if (error.worldMarchDecline) {
                    this.showFloatingText(t('command.worldMarch.blocked'));
                  } else {
                    this.log(t('command.worldMarch.failed', { message: error.payload?.message || error.message || '' }));
                  }
                  this.renderCanvasSurface(this.state?.currentTab);
                  return false;
                }
              }

    async returnWorldMarch(missionId, options = {}) {
                if (!missionId) return false;
                let optimistic = null;
                try {
                  global.WorldMarchTrace?.log?.('app:returnWorldMarch:begin', {
                    missionId,
                    before: global.WorldMarchTrace?.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
                  });
                  optimistic = WorldMarchOptimisticState?.beginReturn?.(this, missionId, options) || null;
                  const api = this.getGameApi();
                  const result = await api.returnWorldMarch(missionId, options);
                  this.applyApiState(result);
                  WorldMarchOptimisticState?.complete?.(this, optimistic || missionId);
                  global.WorldMarchTrace?.log?.('app:returnWorldMarch:afterApply', {
                    result: global.WorldMarchTrace?.summarizeApiPayload?.(result) || result,
                    after: global.WorldMarchTrace?.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
                  });
                  this.showFloatingText(result.message || t('command.worldMarch.returning', {}));
                  this.log(result.message || t('command.worldMarch.returning', {}));
                  return true;
                } catch (error) {
                  global.WorldMarchTrace?.error?.('app:returnWorldMarch:error', {
                    missionId,
                    message: error.payload?.message || error.message,
                    payload: global.WorldMarchTrace?.summarizeApiPayload?.(error.payload) || error.payload || null,
                  });
                  WorldMarchOptimisticState?.rollback?.(this, optimistic || missionId, { render: false });
                  this.log(t('command.worldMarch.returnFailed', { message: error.payload?.message || error.message || '' }));
                  this.renderCanvasSurface(this.state?.currentTab);
                  return false;
                }
              }

    async stopWorldMarch(missionId, options = {}) {
                if (!missionId) return false;
                try {
                  global.WorldMarchTrace?.log?.('app:stopWorldMarch:begin', {
                    missionId,
                    before: global.WorldMarchTrace?.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
                  });
                  const api = this.getGameApi();
                  const result = await api.stopWorldMarch(missionId, options);
                  this.applyApiState(result);
                  global.WorldMarchTrace?.log?.('app:stopWorldMarch:afterApply', {
                    result: global.WorldMarchTrace?.summarizeApiPayload?.(result) || result,
                    after: global.WorldMarchTrace?.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
                  });
                  this.showFloatingText(result.message || t('command.worldMarch.stopped', {}));
                  this.log(result.message || t('command.worldMarch.stopped', {}));
                  return true;
                } catch (error) {
                  global.WorldMarchTrace?.error?.('app:stopWorldMarch:error', {
                    missionId,
                    message: error.payload?.message || error.message,
                    payload: global.WorldMarchTrace?.summarizeApiPayload?.(error.payload) || error.payload || null,
                  });
                  this.log(t('command.worldMarch.stopFailed', { message: error.payload?.message || error.message || '' }));
                  this.renderCanvasSurface(this.state?.currentTab);
                  return false;
                }
              }

    async claimGuideTaskReward(_taskId) {
                return false;
              }

    async claimTaskReward(taskId, category = 'main', _options = {}) {
                if (!taskId) return false;
                try {
                  const api = this.getGameApi();
                  const result = await api.claimTaskReward(taskId, category || 'main');
                  this.applyApiState(result);
                  this.tutorialController?.sync?.(this.tutorial);
                  this.tutorialController?.onTaskRewardClaimed?.(result);
                  if (!this.canvasShell?.showRewardReveal?.(result.rewardReveal) && result.rewardReveal) {
                    this.openRewardRevealSnapshot?.({ ...result.rewardReveal, createdAt: this.runtime?.now?.() || Date.now() });
                    this.renderCanvasSurface(this.state?.currentTab);
                  }
                  this.showFloatingText(
                    SharedRewardText && SharedRewardText.hasResources(result.rewardReveal?.resources)
                      ? SharedRewardText.formatResources(result.rewardReveal.resources)
                      : result.message || t('command.reward.claimed'),
                  );
                  this.log(t('command.reward.detail', { message: result.message || '' }));
                  return true;
                } catch (error) {
                  this.log(t('command.failedDetail', { message: error.payload?.message || error.message }));
                  this.renderCanvasSurface(this.state?.currentTab);
                  return false;
                }
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
                  CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showSubcityList');
                  CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'activeCommandPanel');
                  this.closeEventSnapshot?.();
                  if (targetCityId !== currentCityId) {
                    const result = await this.getGameApi().switchCity(targetCityId);
                    this.applyApiState(result);
                  }
                  CanvasModalSnapshotAdapter.openBlockingPanelSnapshot(this, 'showCityManagement', true);
                  this.activeCityManagementTab = options.tab || this.activeCityManagementTab || 'buildings';
                  TerritoryUiStateStore?.patch?.(this, {
                    selectedSiteId: '',
                    worldMarchTarget: null,
                    selectedWorldActorId: '',
                    selectedWorldMissionId: '',
                  });
                  this.territoryController?.closeSiteDialog?.();
                  if (this.canvasShell) TerritoryUiStateStore?.ensure?.(this.canvasShell);
                  const homeView = this.resolveMapHomeViewState(this.state, { requestedTab: 'resources', forceMapHome: true });
                  this.activeTab = homeView.activeTab;
                  this.militaryView = homeView.militaryView;
                  this.mapHomeActive = homeView.isMapHome;
                  StateWriter.commit(this, (prev) => ({
                    ...prev,
                    currentTab: homeView.activeTab,
                    militaryView: homeView.militaryView,
                  }), { source: 'CanvasGameApp:enterCity' });
                  this.renderCanvasSurface(homeView.activeTab);
                  this.tutorialController?.markCityEntered?.().then(() => {
                    this.tutorialController?.refreshCurrentHighlight?.();
                  }).catch((error) => this.log(error?.message || String(error)));
                  return true;
                } catch (error) {
                  this.log(t('command.failedDetail', { message: error.payload?.message || error.message }));
                  this.renderCanvasSurface(this.state?.currentTab);
                  return false;
                }
              }

    getArmyFormation(cityId, slot) {
            return ArmyFormationQueries.getArmyFormation(this, cityId, slot);
          }

    getArmyFormationSoldierCap(cityId, slot) {
            return ArmyFormationQueries.getArmyFormationSoldierCap(this, cityId, slot);
          }

    getArmyFormationReserveSoldiers(cityId) {
            return ArmyFormationQueries.getArmyFormationReserveSoldiers(this, cityId);
          }

    normalizeArmyFormationAssignments(assignments = {}, memberIds = [], cap = 1000) {
            return ArmyFormationEditorController.normalizeArmyFormationAssignments(assignments, memberIds, cap);
          }

    sumArmyFormationAssignments(assignments = {}) {
            return ArmyFormationEditorController.sumArmyFormationAssignments(assignments);
          }

    createArmyFormationEditorState(editor = {}) {
            return ArmyFormationEditorController.createArmyFormationEditorState(editor);
          }

    getArmyFormationEditablePool(editor = {}) {
            return ArmyFormationQueries.getArmyFormationEditablePool(this, editor);
          }

    setArmyFormationSoldierDraft(personId, value, options = {}) {
            return this.getArmyFormationEditorController().setSoldierDraft(personId, value, options);
          }

    setArmyFormationEditor(editor = {}, options = {}) {
            return this.getArmyFormationEditorController().setEditor(editor, options);
          }

    openArmyFormation(action = {}) {
            const opened = this.getArmyFormationEditorController().open(action) !== false;
            if (opened) {
              const owner = this.getStateHost() || this;
              const tutorialController = owner.tutorialController || this.tutorialController;
              const result = tutorialController?.onArmyFormationOpened?.();
              tutorialController?.refreshCurrentHighlight?.();
              const scheduler = owner.runtime || this.runtime || global;
              scheduler?.setTimeout?.(() => tutorialController?.refreshCurrentHighlight?.(), 0);
              if (result?.catch) result.catch((error) => owner.log?.(error));
            }
            return opened;
          }

    closeArmyFormationEditor(options = {}) {
            return this.getArmyFormationEditorController().close(options);
          }

    toggleArmyFormationMember(action = {}) {
            return this.getArmyFormationEditorController().toggleMember(action);
          }

    changeArmyFormationPage(action = {}) {
            return this.getArmyFormationEditorController().changePage(action);
          }

    changeArmyFormationSoldiers(action = {}) {
            return this.getArmyFormationEditorController().changeSoldiers(action);
          }

    requestArmyFormationSoldierInput(action = {}) {
            return this.getArmyFormationEditorController().requestSoldierInput(action);
          }

    autoReplenishArmyFormation() {
            return this.getArmyFormationEditorController().autoReplenish();
          }

    saveArmyFormation() {
            return this.getArmyFormationEditorController().save();
          }

    openNaming(prompt = {}) {
                const view = this.presenter.buildNamingPromptViewState(prompt);
                this.activeNamingPrompt = prompt;
                this.activeNamingPromptKey = view.key;
                const namingState = { visible: true, view, prompt, inputValue: '', submitting: false };
                this.openNamingSnapshot?.(namingState);
                  CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showResourceDetails');
                  CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showCitySwitcher');
                  CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showSubcityList');
                  CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showCityManagement');
                  this.closeEventSnapshot?.();
                  this.getPanelSurfaceManager()?.closePanel?.('famousPersons', { render: false });
                  CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'activeCommandPanel');
                  this.render();
                  this.scheduleTutorialHighlightRefresh(80);
              }

    closeNaming() {
                this.activeNamingPrompt = null;
                this.activeNamingPromptKey = null;
                this.closeNamingSnapshot?.();
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
                const naming = this.getNamingSnapshot?.() || null;
                if (!naming?.visible || typeof this.runtime.requestTextInput !== 'function') return;
                const view = naming.view || {};
                const value = await this.runtime.requestTextInput({
                  title: view.title || t('shell.naming.title'),
                  message: view.message || '',
                  placeholder: view.placeholder || '',
                  value: naming.inputValue || '',
                  maxLength: view.maxLength || 12,
                });
                if (value === null || value === undefined || !this.isNamingSnapshotOpen?.()) return;
                const inputValue = String(value).trim().slice(0, Number(view.maxLength) || 12);
                this.updateNamingSnapshot?.({ inputValue });
                this.render();
                this.scheduleTutorialHighlightRefresh(0);
              }

    submitNaming(inputName = null) {
                return this.submitNamingValue(inputName);
              }

    async submitNamingValue(inputName = null) {
                const naming = this.getNamingSnapshot?.() || null;
                const prompt = this.activeNamingPrompt || naming?.prompt || {};
                const name = String(inputName ?? naming?.inputValue ?? '').trim();
                if (!prompt.type || !name) return;
                let tutorialHandledView = false;
                this.updateNamingSnapshot?.({ submitting: true });
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
                  this.log(t('command.success.detail', { message: result.message || '' }));
                } catch (error) {
                  this.log(t('command.failedDetail', { message: error.payload?.message || error.message }));
                } finally {
                  this.updateNamingSnapshot?.({ submitting: false });
                  if (!tutorialHandledView) this.renderCanvasSurface(this.state?.currentTab);
                }
              }

    async handleCanvasTabSelection(tabId) {
                if (!tabId) return false;
                const onTabClicked = this.tutorialController?.onTabClicked;
                const allowed = typeof onTabClicked === 'function'
                  ? await onTabClicked.call(this.tutorialController, tabId).catch(() => false)
                  : true;
                if (!allowed) {
                  this.log(t('guide.completeCurrentStep'));
                  this.renderCanvasSurface(this.state?.currentTab);
                  return false;
                }
                this.switchTab(tabId);
                return true;
              }

    moveToCurrentMainTaskTarget() {
                return false;
              }

    continueCurrentMainTaskTarget() {
                return false;
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
                StateWriter.commit(this, (prev) => ({ ...prev, militaryView: this.militaryView }), { source: 'setGuideMilitaryView' });
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

    refreshTaskCenterGuideHighlight(action = {}) {
                return this.guideController?.refreshTaskCenterGuideHighlight?.(action) || false;
              }

    hasClaimableMainTask() {
                return false;
              }

    refreshCurrentGuideHighlight() {
                return false;
              }

    ensureGuideTargetVisible() {
                return false;
              }

    showGuideHighlight() {
                return false;
              }

    hideGuideHighlight() {
                if (this.canvasShell && typeof this.canvasShell.hideTutorialHighlight === 'function') {
                  return this.canvasShell.hideTutorialHighlight();
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

    goToGuideTaskTarget() {
                return false;
              }

    toggleCitySwitcher() {
                CanvasModalSnapshotAdapter.openBlockingPanelSnapshot(this, 'showCitySwitcher', !CanvasModalSnapshotAdapter.isBlockingPanelSnapshotOpen(this, 'showCitySwitcher'));
                this.renderCanvasSurface(this.state?.currentTab);
              }

    closeCitySwitcher(options = {}) {
                CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showCitySwitcher');
                if (options.skipRender) return true;
                this.renderCanvasSurface(this.state?.currentTab);
                return true;
              }

    openCityManagement(options = {}) {
                CanvasModalSnapshotAdapter.openBlockingPanelSnapshot(this, 'showCityManagement', true);
                this.activeCityManagementTab = options.tab || this.activeCityManagementTab || 'buildings';
                CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showSubcityList');
                CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'activeCommandPanel');
                this.closeEventSnapshot?.();
                return this.renderCanvasSurface(this.state?.currentTab);
              }

    closeCityManagement() {
                CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showCityManagement');
                return this.renderCanvasSurface(this.state?.currentTab);
              }

    switchCityManagementTab(tab = 'buildings') {
                const allowed = ['buildings', 'people', 'military'];
                this.activeCityManagementTab = allowed.includes(tab) ? tab : 'buildings';
                return this.renderCanvasSurface(this.state?.currentTab);
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
                  title: t('world.site.rename.cityTitle'),
                  message: t('world.site.rename.currentName', {
                    name: prompt.currentName || t('world.site.rename.unnamedCity'),
                  }),
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

    hasActiveGuideTaskTarget() {
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
                  CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showAdvisor');
                  this.canvasShell?.hideTutorialHighlight?.();
                  if (this.canvasShell?.actionController?.handle_openTaskCenter) {
                    this.canvasShell.actionController.handle_openTaskCenter(action);
                  } else if (this.actionController?.handle_openTaskCenter) {
                    this.actionController.handle_openTaskCenter(action);
                  } else {
                    CanvasModalSnapshotAdapter.openBlockingPanelSnapshot(this, 'showTaskCenter', true);
                    this.activeTaskCenterTab = 'main';
                    if (this.canvasShell) {
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
                const routedInput = typeof this.resolveInputIntent === 'function' ? this.resolveInputIntent({ kind: 'drag', phase, pointer: point }) : null;
                const routedInputRoute = routedInput && routedInput.route;
                if (routedInputRoute ? routedInputRoute === 'entity-battle' : (typeof this.isModeEntityBattleActive === 'function' ? this.isModeEntityBattleActive() : this.entityBattle?.visible)) {
                  return this.actionController?.handle?.({ type: 'entityBattleDrag', phase, pointer: point }) || false;
                }
                if (routedInputRoute ? routedInputRoute === 'tech-tree' : (typeof this.canRouteModeTechTree === 'function' ? this.canRouteModeTechTree() : this.activeTab === 'tech')) {
                  return this.actionController?.handle?.({ type: 'techTreeDrag', phase, pointer: point }) || false;
                }
                if (routedInputRoute) {
                  if (routedInputRoute !== 'world-map') return false;
                } else if (typeof this.canRouteModeWorldMap === 'function') {
                  if (!this.canRouteModeWorldMap()) return false;
                } else if (this.activeTab !== 'military' || this.militaryView !== 'world') return false;
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
                if (typeof this.isModeBlockingOverlayOpen === 'function') return this.isModeBlockingOverlayOpen();
                const battleScene = typeof this.getRendererSnapshot === 'function'
                  ? this.getRendererSnapshot()?.battle?.battleScene
                  : null;
                const namingOpen = typeof this.isNamingSnapshotOpen === 'function'
                  ? this.isNamingSnapshotOpen()
                  : false;
                const confirmDialogOpen = typeof this.isConfirmDialogSnapshotOpen === 'function'
                  ? this.isConfirmDialogSnapshotOpen()
                  : false;
                const rewardRevealOpen = typeof this.isRewardRevealSnapshotOpen === 'function'
                  ? this.isRewardRevealSnapshotOpen()
                  : false;
                return Boolean(this.isBlockingPanelSnapshotOpen('showResourceDetails')
                  || this.isBlockingPanelSnapshotOpen('showCitySwitcher')
                  || this.isBlockingPanelSnapshotOpen('showSubcityList')
                  || this.isBlockingPanelSnapshotOpen('showCityManagement')
                  || this.isBlockingPanelSnapshotOpen('showAdvisor')
                  || this.tutorialAdvisorDialogue
                  || this.canvasShell?.tutorialAdvisorDialogue
                  || this.isBlockingPanelSnapshotOpen('showTaskCenter')
                  || this.isBlockingPanelSnapshotOpen('showGuidebook')
                  || this.isBlockingPanelSnapshotOpen('showFamousPersons')
                  || this.armyFormationEditor?.open
                  || confirmDialogOpen
                  || this.getCommandPanelValue()
                  || this.isBlockingPanelSnapshotOpen('techDetailOpen')
                  || this.isEventSnapshotOpen?.()
                  || namingOpen
                  || battleScene?.visible
                  || this.entityBattle?.visible
                  || rewardRevealOpen);
              }

    handleGesture(gesture) {
                const routedInput = typeof this.resolveInputIntent === 'function' ? this.resolveInputIntent({ kind: 'gesture', gesture }) : null;
                const routedInputRoute = routedInput && routedInput.route;
                if (routedInputRoute ? routedInputRoute === 'entity-battle' : (typeof this.isModeEntityBattleActive === 'function' ? this.isModeEntityBattleActive() : this.entityBattle?.visible)) {
                  return this.actionController?.handle?.({ type: 'entityBattleZoom', gesture }) || false;
                }
                const worldMapGestureHandled = this.handleWorldMapGesture(gesture);
                if (worldMapGestureHandled) return true;
                if (typeof this.canRouteModeTechTree === 'function') {
                  if (!this.canRouteModeTechTree()) return false;
                } else if (this.activeTab !== 'tech' || this.hasBlockingOverlayOpen()) return false;
                return this.actionController?.handle?.({ type: 'techTreeZoom', gesture }) || false;
              }

    handleWorldMapGesture(gesture = {}) {
                if (gesture?.type !== 'pinchZoom') return false;
                const routedInput = typeof this.resolveInputIntent === 'function' ? this.resolveInputIntent({ kind: 'gesture', gesture }) : null;
                const routedInputRoute = routedInput && routedInput.route;
                if (routedInputRoute) {
                  if (routedInputRoute !== 'world-map') return false;
                } else if (typeof this.canRouteModeWorldMap === 'function') {
                  if (!this.canRouteModeWorldMap()) return false;
                } else if (this.activeTab !== 'military' || this.militaryView !== 'world') return false;
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

    observeAsyncActionResult(result) {
                if (result && typeof result.then === 'function') {
                  result.catch((error) => this.log?.(error));
                }
                return result;
              }

    dispatchCanvasAction(action = {}, meta = {}) {
                if (this.actionDispatcher?.canHandle?.(action, this)) {
                  return this.actionDispatcher.handle(action, this);
                }
                incrementPanelRefactorCounter('panelAction.dispatcherFallback.count');
                return this.actionController?.handle?.(action, meta) || false;
              }

    async handleTap(point) {
                const action = this.renderer.getHitTarget(point);
                const normalizedAction = ClientCommandSemantics?.normalizeAction?.(action) || action;
                global.ClientOperationLog?.record?.('input:tapHit', {
                  point: global.ClientOperationLog?.summarizePoint?.(point),
                  action: global.ClientOperationLog?.summarizeAction?.(normalizedAction),
                  blockingOverlay: this.hasBlockingOverlayOpen?.(),
                  mapHomeActive: Boolean(this.mapHomeActive),
                  currentTab: this.state?.currentTab || this.activeTab || '',
                  militaryView: this.state?.militaryView || this.militaryView || '',
                });
                if (normalizedAction?.type === 'blockCanvasModal') {
                  return this.dispatchCanvasAction(normalizedAction);
                }
                if (normalizedAction?.disabled) {
                  global.ClientOperationLog?.record?.('input:tapDisabled', {
                    point: global.ClientOperationLog?.summarizePoint?.(point),
                    action: global.ClientOperationLog?.summarizeAction?.(normalizedAction),
                  }, { flush: true });
                  return true;
                }
                if (shouldRouteTapThroughWorldMapRuntime(normalizedAction)) {
                  const handled = this.ensureWorldMapRuntimeCoordinator()?.handleTap(point);
                  this.observeAsyncActionResult(handled);
                  this.worldMapRuntime = this.worldMapRuntimeCoordinator?.getMapRuntime?.() || this.worldMapRuntime;
                  global.ClientOperationLog?.record?.(normalizedAction ? 'input:tapRuntime' : 'input:tapMiss', {
                    point: global.ClientOperationLog?.summarizePoint?.(point),
                    actionType: normalizedAction?.type || '',
                    action: global.ClientOperationLog?.summarizeAction?.(normalizedAction),
                    runtimeHandled: summarizeHandledForOperationLog(handled),
                  }, { flush: true });
                  if (handled) return handled;
                  return handled;
                }
                const handledResult = this.dispatchCanvasAction(normalizedAction);
                global.ClientOperationLog?.record?.('input:tapAction', {
                  action: global.ClientOperationLog?.summarizeAction?.(normalizedAction),
                  handled: summarizeHandledForOperationLog(handledResult),
                }, { flush: true });
                const handled = await handledResult;
                this.advanceTutorialIntroAfterHandled(handled, normalizedAction);
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
                  }).catch((error) => this.log?.(error));
                  return true;
                }
                return handled ? this.advanceTutorialIntro(action) : false;
              }

    isPointBlockedByTutorialShield(point = {}) {
                if (!this.renderer || typeof this.renderer.getHitTarget !== 'function') return false;
                return this.renderer.getHitTarget(point)?.type === 'blockCanvasModal';
              }

    getModeSnapshot() {
            return CanvasModeOwnershipRuntime.getModeSnapshot(this);
          }

    refreshModeSnapshot() {
            return CanvasModeOwnershipRuntime.refreshModeSnapshot(this);
          }

    deriveModeFacts() {
            return CanvasModeOwnershipRuntime.deriveModeFacts(this);
          }

    isModeBlockingOverlayOpen() {
            const snapshot = this.getModeSnapshot();
            return snapshot
              ? CanvasModeOwnershipRuntime.isBlockingOverlayOpen?.(snapshot)
              : this.deriveModeFacts().blockingOverlayActive;
          }

    isModeEntityBattleActive() {
            const snapshot = this.getModeSnapshot();
            return snapshot
              ? CanvasModeOwnershipRuntime.isEntityBattleActive?.(snapshot)
              : this.deriveModeFacts().entityBattleActive;
          }

    canRouteModeWorldMap() {
            const snapshot = this.getModeSnapshot();
            if (snapshot) return CanvasModeOwnershipRuntime.canRouteWorldMap?.(snapshot);
            const facts = this.deriveModeFacts();
            return facts.baseModeKey === 'worldMap' && !facts.blockingOverlayActive;
          }

    canRouteModeTechTree() {
            const snapshot = this.getModeSnapshot();
            if (snapshot) return CanvasModeOwnershipRuntime.canRouteTechTree?.(snapshot);
            const facts = this.deriveModeFacts();
            return facts.techTreeActive && !facts.techTreeBlockingOverlayActive;
          }

    resolveInputIntent(physicalIntent) {
            return CanvasModeOwnershipRuntime.resolveInputIntent(this, physicalIntent);
          }

    buildRendererSnapshot(options = {}) {
            return CanvasModeOwnershipRuntime.buildRendererSnapshot(this, options);
          }

    getRendererSnapshot() {
            return CanvasModeOwnershipRuntime.getRendererSnapshot(this);
          }

    openModal(subtype, payload, callbacks) {
            return CanvasModeOwnershipRuntime.openModal(this, subtype, payload, callbacks);
          }

    updateModalPayload(subtype, patch) {
            return CanvasModeOwnershipRuntime.updateModalPayload(this, subtype, patch);
          }

    closeModal(subtype) {
            return CanvasModeOwnershipRuntime.closeModal(this, subtype);
          }

    getModalPayload(subtype) {
            return CanvasModeOwnershipRuntime.getModalPayload(this, subtype);
          }

    isModalOpen(subtype) {
            return CanvasModeOwnershipRuntime.isModalOpen(this, subtype);
          }

    getModalOwnerHost() {
            return CanvasModeOwnershipRuntime.getModalOwnerHost(this);
          }

    resolveModalCallback(subtype, action, ...args) {
            return CanvasModeOwnershipRuntime.resolveModalCallback(this, subtype, action, ...args);
          }

    closeNamingSnapshot() {
            return CanvasModalSnapshotAdapter.closeNamingSnapshot(this);
          }

    closeConfirmDialogSnapshot() {
            return CanvasModalSnapshotAdapter.closeConfirmDialogSnapshot(this);
          }

    getConfirmDialogSnapshot(snapshot = null) {
            return CanvasModalSnapshotAdapter.getConfirmDialogSnapshot(this, snapshot);
          }

    getNamingSnapshot(snapshot = null) {
            return CanvasModalSnapshotAdapter.getNamingSnapshot(this, snapshot);
          }

    isNamingSnapshotOpen(snapshot = null) {
            return CanvasModalSnapshotAdapter.isNamingSnapshotOpen(this, snapshot);
          }

    isConfirmDialogSnapshotOpen(snapshot = null) {
            return CanvasModalSnapshotAdapter.isConfirmDialogSnapshotOpen(this, snapshot);
          }

    getNamingInputValue(snapshot = null) {
            return CanvasModalSnapshotAdapter.getNamingInputValue(this, snapshot);
          }

    openNamingSnapshot(payload = {}) {
            return CanvasModalSnapshotAdapter.openNamingSnapshot(this, payload);
          }

    updateNamingSnapshot(patch = {}) {
            return CanvasModalSnapshotAdapter.updateNamingSnapshot(this, patch);
          }

    openConfirmDialogSnapshot(payload = {}, callbacks = null) {
            return CanvasModalSnapshotAdapter.openConfirmDialogSnapshot(this, payload, callbacks);
          }

    updateConfirmDialogSnapshot(patch = {}) {
            return CanvasModalSnapshotAdapter.updateConfirmDialogSnapshot(this, patch);
          }

    resolveConfirmDialogSnapshotCallback(type, ...args) {
            return CanvasModalSnapshotAdapter.resolveConfirmDialogSnapshotCallback(this, type, ...args);
          }

    openRewardRevealSnapshot(payload = {}) {
            return CanvasModalSnapshotAdapter.openRewardRevealSnapshot(this, payload);
          }

    closeRewardRevealSnapshot() {
            return CanvasModalSnapshotAdapter.closeRewardRevealSnapshot(this);
          }

    getRewardRevealSnapshot(snapshot = null) {
            return CanvasModalSnapshotAdapter.getRewardRevealSnapshot(this, snapshot);
          }

    isRewardRevealSnapshotOpen(snapshot = null) {
            return CanvasModalSnapshotAdapter.isRewardRevealSnapshotOpen(this, snapshot);
          }

    openEventSnapshot(eventId) {
            return CanvasModalSnapshotAdapter.openEventSnapshot(this, eventId);
          }

    closeEventSnapshot() {
            return CanvasModalSnapshotAdapter.closeEventSnapshot(this);
          }

    getEventSnapshot(snapshot = null) {
            return CanvasModalSnapshotAdapter.getEventSnapshot(this, snapshot);
          }

    isEventSnapshotOpen(snapshot = null) {
            return CanvasModalSnapshotAdapter.isEventSnapshotOpen(this, snapshot);
          }

    openTargetPickerSnapshot(payload = {}) {
            return CanvasModalSnapshotAdapter.openTargetPickerSnapshot(this, payload);
          }

    closeTargetPickerSnapshot() {
            return CanvasModalSnapshotAdapter.closeTargetPickerSnapshot(this);
          }

    getTargetPickerSnapshot(snapshot = null) {
            return CanvasModalSnapshotAdapter.getTargetPickerSnapshot(this, snapshot);
          }

    isTargetPickerSnapshotOpen(snapshot = null) {
            return CanvasModalSnapshotAdapter.isTargetPickerSnapshotOpen(this, snapshot);
          }

    openBlockingPanelSnapshot(panelKey, value = true) {
            return CanvasModalSnapshotAdapter.openBlockingPanelSnapshot(this, panelKey, value);
          }

    closeBlockingPanelSnapshot(panelKey) {
            return CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, panelKey);
          }

    closeBlockingPanelsSnapshot(except = []) {
            return CanvasModalSnapshotAdapter.closeBlockingPanelsSnapshot(this, except);
          }

    isBlockingPanelSnapshotOpen(panelKey, snapshot = null) {
            return CanvasModalSnapshotAdapter.isBlockingPanelSnapshotOpen(this, panelKey, snapshot);
          }

    getCommandPanelValue(snapshot = null) {
            return CanvasModalSnapshotAdapter.getCommandPanelValue(this, snapshot);
          }

    buildBlockingPanelFacts(snapshot = null) {
            return CanvasModalSnapshotAdapter.buildBlockingPanelFacts(this, snapshot);
          }
}



  global.CanvasGameApp = CanvasGameApp;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasGameApp;
})(typeof window !== 'undefined' ? window : globalThis);
