const CanvasGameAppBase = window.CanvasGameApp
  || (typeof require === 'function' ? require('./js/platform/CanvasGameApp') : class {});

const DEFAULT_STATE = {
  resources: {},
  buildings: {},
  buildingCosts: {},
  buildingDefinitions: {},
  buildingEffects: {},
  unlockedBuildings: [],
  currentEra: 0,
  currentEraName: '原始时代',
  currentEraDescription: '',
  population: { total: 3, max: 3, maxPop: 3, farmers: 3, scholars: 0, craftsmen: 0, unassigned: 0 },
  happiness: 100,
  gameDay: 1,
  totalBuildings: 0,
  eraProgress: { percentage: 0, canAdvance: false, conditions: [] },
  currentTab: 'resources',
  militaryView: 'army',
  techs: {},
  eventQueue: [],
  eventHistory: [],
  regularEventState: null,
  threatEventState: null,
  activeBuffs: [],
  military: {},
  territoryState: {},
  softGuide: null,
  guideTasks: { visible: false, tasks: [] },
  taskCenter: null,
};

class H5GameHost extends CanvasGameAppBase {
  constructor() {
    super({
      runtimeRequired: false,
      apiRequired: false,
      rendererRequired: false,
      initialState: { ...DEFAULT_STATE },
    });
    this.apiBase = null;
    this.config = null;
    this.stateNormalizer = null;
    this.runtimeConstructors = null;
    this.token = null;
    this.playerId = null;
    this.tutorial = { completed: false, currentStep: 0, phaseCompleted: { newbie: false, era2: false } };
  }

  init() {
    const shell = window.H5ShellAdapter?.fromRuntime(window, {
      registry: window,
      getTerritoryUiState: () => this.territoryController?.getUiState?.() || {},
    });
    Object.assign(this, shell);

    this.apiBase = this.config?.API_BASE || this.apiBase;
    this.token = this.authStorage?.getToken?.() || null;
    const constructors = this.runtimeConstructors || {};
    this.gameAPI = new constructors.GameAPI(this.apiBase, this.token);
    this.api = this.gameAPI;
    this.buildingAPI = { setToken: (token) => this.gameAPI.setToken(token) };
    this.syncService = new constructors.GameStateSync(this.gameAPI, this.config?.SYNC_INTERVAL_MS, this.scheduler);
    this.updateChecker = new constructors.UpdateChecker({
      api: { getVersion: () => this.apiGet('/version') },
      intervalMs: this.config?.UPDATE_CHECK_INTERVAL_MS,
      scheduler: this.scheduler,
      onUpdate: (version, previousDeploymentId) => {
        this.log(`检测到新版本：${previousDeploymentId} -> ${version.deploymentId}`);
        return this.showUpdatePrompt(version);
      },
      onError: (error) => {
        const message = error?.payload?.message || error?.message || '未知错误';
        this.log(`版本检测失败：${message}`);
      },
      onLog: (entry) => {
        if (entry?.type === 'initialized') this.log(`版本检测已启动：${entry.deploymentId}`);
      },
    });
    this.stateManager = new constructors.GameStateManager(this.state, { buildingState: this.buildingState });
    this.tutorialRenderer.onSoftGuide = (message) => this.updateAdvisor({ message });
    this.tutorialController = new constructors.TutorialController({
      api: this.gameAPI,
      renderer: this.tutorialRenderer,
      getTarget: (key) => this.getTutorialTarget(key),
      getCurrentTab: () => this.state.currentTab,
      isEventModalOpen: () => this.eventController?.isOpen?.() || this.canvasShell?.activeEventId || false,
      getState: () => this.state,
      storage: this.tutorialStorage,
      startDelayMs: this.config?.TUTORIAL_START_DELAY_MS,
      scheduler: this.scheduler,
    });
    this.eventController = new constructors.EventController({
      api: this.gameAPI,
      getState: () => this.state,
      onStateApplied: (result) => this.applyApiState(result),
      onTutorialUpdated: (tutorial) => this.tutorialController.notifySpecialEventClaimed(tutorial),
      onFloatingText: (message) => this.showFloatingText(message),
      onLog: (message) => this.log(message),
      formatReward: (reward) => this.presenter.formatEventReward(reward),
    });
    this.buildingController = new constructors.BuildingController({
      api: this.gameAPI,
      onSuccess: (result, action, buildingId) => this.handleBuildingSuccess(result, action, buildingId),
      onError: (error) => this.log(error.payload?.message || error.message),
    });
    this.territoryController = new constructors.TerritoryController({
      api: this.gameAPI,
      getState: () => this.state,
      onRenderRequested: () => this.renderTerritory(),
      onStateApplied: (result) => this.applyApiState(result),
      onFloatingText: (message) => this.showFloatingText(message),
      onLog: (message) => this.log(message),
      onCityRenameRequested: (prompt) => this.requestCityRename(prompt),
    });

    this.gameModules?.mount?.(this);
    this.syncService.onState = (data) => this.applyApiState(data);
    this.syncService.onError = (error) => {
      if (error.payload && error.payload.error && this.handleAuthError) this.handleAuthError(error.payload);
    };

    this.territoryController.bind();
    this.startScoutCountdownTimer();
    this.updateChecker.start();
    this.canvasShell = window.CanvasGameShell?.mount(this, {
      document,
      runtime: window,
      presenter: this.presenter,
      previewEnabled: true,
      inputEnabled: true,
    });
    this.tutorialRenderer?.setCanvasShell?.(this.canvasShell);
    const onCanvasShellReady = this.onCanvasShellReady;
    this.onCanvasShellReady = null;
    if (typeof onCanvasShellReady === 'function') onCanvasShellReady();
    this.render();
  }
}

const Game = new H5GameHost();

window.H5GameBootstrap?.mount(Game, { document, runtime: window });
