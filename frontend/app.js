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
  currentTab: 'military',
  militaryView: 'world',
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
  tutorialEnabled: true,
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
    this.tutorialIntroOverlay = null;
  }

  init() {
    const shell = window.H5ShellAdapter?.fromRuntime(window, {
      registry: window,
      getTerritoryUiState: () => this.territoryController?.getUiState?.() || {},
    });
    Object.assign(this, shell);

    this.apiBase = this.config?.API_BASE || this.apiBase;
    this.token = this.authStorage?.getToken?.() || null;
    this.loadTrace = window.H5LoadTrace || null;
    const constructors = this.runtimeConstructors || {};
    this.gameAPI = new constructors.GameAPI(this.apiBase, this.token, {
      transport: this.gameApiTransport,
      abortControllerFactory: () => this.gameApiTransport?.createAbortController?.(),
      deployStatusPath: this.config?.DEPLOY_STATUS_PATH,
      trace: this.loadTrace,
    });
    this.loadTrace?.setReporter?.((event) => this.gameAPI.reportClientEvent(event));
    window.ClientOperationLog?.setUploader?.((snapshot) => this.gameAPI.uploadClientOperationLog(snapshot));
    this.api = this.gameAPI;
    this.buildingAPI = { setToken: (token) => this.gameAPI.setToken(token) };
    this.syncService = new constructors.GameStateSync(this.gameAPI, this.config?.HEARTBEAT_INTERVAL_MS || 1000, this.scheduler);
    this.syncService.onState = (data) => this.applyApiState(data);
    this.syncService.setStateProvider?.(() => this.state);
    this.updateChecker = new constructors.UpdateChecker({
      api: this.gameAPI,
      intervalMs: this.config?.UPDATE_CHECK_INTERVAL_MS,
      scheduler: this.scheduler,
      onUpdate: (version, previousDeploymentId) => {
        this.log(`检测到新版本：${previousDeploymentId} -> ${version.deploymentId}`);
        return this.showUpdatePrompt(version);
      },
      onDeployFailure: (version, deployStatus) => {
        const target = deployStatus?.targetCommit ? String(deployStatus.targetCommit).slice(0, 12) : '';
        const stage = deployStatus?.stage || '';
        const message = deployStatus?.error?.message || 'deploy failed';
        this.log(`Deploy failed${target ? ` ${target}` : ''}${stage ? ` at ${stage}` : ''}: ${message}`);
        return this.updateRuntime?.notifyDeployFailure?.(version);
      },
      onError: (error) => {
        const message = error?.payload?.message || error?.message || '未知错误';
        this.log(`版本检测失败：${message}`);
      },
      onLog: (entry) => {
        if (entry?.type === 'initialized') this.log(`版本检测已启动：${entry.deploymentId}`);
      },
      trace: this.loadTrace,
    });
    this.stateManager = new constructors.GameStateManager(this.state, { buildingState: this.buildingState });
    this.eventController = new constructors.EventController({
      api: this.gameAPI,
      getState: () => this.state,
      onStateApplied: (result) => this.applyApiState(result),
      onTutorialUpdated: () => {},
      onFloatingText: (message) => this.showFloatingText(message),
      onLog: (message) => this.log(message),
      formatReward: (reward) => this.presenter.formatEventReward(reward),
    });
    if (constructors.CaptureController) {
      // ②b: captured-general decision controller (斩杀/招降/放生). Panel auto-surfaces from state.
      this.captureController = new constructors.CaptureController({
        api: this.gameAPI,
        getState: () => this.state,
        onStateApplied: (result) => this.applyApiState(result),
        onFloatingText: (message) => this.showFloatingText(message),
        onLog: (message) => this.log(message),
      });
    }
    this.buildingController = new constructors.BuildingController({
      api: this.gameAPI,
      onSuccess: (result, action, buildingId) => this.handleBuildingSuccess(result, action, buildingId),
      onError: (error) => this.log(error.payload?.message || error.message),
    });
    this.territoryController = new constructors.TerritoryController({
      api: this.gameAPI,
      getState: () => this.state,
      uiState: this.territoryUiState,
      onRenderRequested: () => this.renderTerritory(),
      onStateApplied: (result) => this.applyApiState(result),
      onFloatingText: (message) => this.showFloatingText(message),
      onLog: (message) => this.log(message),
      onCityRenameRequested: (prompt) => this.requestCityRename(prompt),
      onBattleSceneRequested: (report) => this.startBattleScene(report),
    });
    window.TerritoryUiStateStore?.ensure?.(this);
    if (this.isTutorialEnabled() && !this.tutorialController && window.TutorialGuideController) {
      this.tutorialController = new window.TutorialGuideController({
        game: this,
        api: this.gameAPI,
      });
    }
    if (this.tutorialController) {
      this.tutorialController.game = this;
      this.tutorialController.api = this.gameAPI;
      this.tutorialController.sync(this.tutorial);
    }

    this.gameModules?.mount?.(this);
    this.syncService.onHeartbeat = (data) => this.applyHeartbeat(data);
    this.syncService.onState = this.syncService.onState || ((data) => this.applyApiState(data));
    this.syncService.setStateProvider?.(() => this.state);
    this.syncService.onConnectionState = (state) => this.applyConnectionState(state);
    this.syncService.onError = (error) => {
      if (error.payload && error.payload.error && this.handleAuthError) this.handleAuthError(error.payload);
    };

    this.territoryController.bind();
    this.startScoutCountdownTimer();
    this.updateChecker.start();
    this.canvasShell = window.CanvasGameShell?.mount(this, {
      document,
      runtime: window,
      config: this.config,
      presenter: this.presenter,
      loadTrace: this.loadTrace,
      previewEnabled: true,
      inputEnabled: true,
    });
    const onCanvasShellReady = this.onCanvasShellReady;
    this.onCanvasShellReady = null;
    if (typeof onCanvasShellReady === 'function') onCanvasShellReady();
    if (!this.token || this.hasServerState) this.render();
  }

  isTutorialEnabled() {
    const parser = window.FeatureFlags?.parseFlagValue || window.FeatureFlagCore?.parseFeatureFlagValue;
    if (typeof parser !== 'function') return this.state?.tutorialEnabled !== false;
    return parser(this.state?.tutorialEnabled, true);
  }

  ensureTutorialIntroOverlay() {
    if (!this.isTutorialEnabled()) return null;
    if (this.tutorialIntroOverlay) return this.tutorialIntroOverlay;
    if (!window.TutorialIntroOverlay) return null;
    this.tutorialIntroOverlay = new window.TutorialIntroOverlay({
      runtime: window,
      storage: window.localStorage || null,
      game: this,
    });
    return this.tutorialIntroOverlay;
  }

  maybeStartTutorialIntro() {
    if (!this.isTutorialEnabled()) return false;
    return this.ensureTutorialIntroOverlay()?.start(this.state) || false;
  }

  applyApiState(data = {}, options = {}) {
    super.applyApiState(data, options);
    if (!this.isTutorialEnabled()) return false;
    this.tutorialController?.sync?.(this.tutorial);
    this.maybeStartTutorialIntro();
    return true;
  }

  applyState(payload = {}, options = {}) {
    super.applyState(payload, options);
    if (!this.isTutorialEnabled()) return false;
    this.tutorialController?.sync?.(this.tutorial);
    this.maybeStartTutorialIntro();
    return true;
  }
}

function consumeCodexIabAuthFromUrl(runtime = null) {
  const host = runtime || window;
  try {
    const location = host.location;
    const storage = host.localStorage;
    if (!location || !storage) return false;

    const url = new URL(location.href);
    const token = url.searchParams.get('codexIabToken');
    if (!token) return false;

    storage.setItem('cf_token', token);
    storage.setItem('cf_username', url.searchParams.get('codexIabUser') || 'codexqa');

    url.searchParams.delete('codexIabToken');
    url.searchParams.delete('codexIabUser');
    url.searchParams.set('codexIabAuth', '1');
    host.history?.replaceState?.(null, host.document?.title || '', `${url.pathname}${url.search}${url.hash}`);
    return true;
  } catch (error) {
    console.warn('[codex-iab-auth] failed to consume token from URL', error);
    return false;
  }
}

consumeCodexIabAuthFromUrl(window);

const Game = new H5GameHost();

window.H5GameBootstrap?.mount(Game, { document, runtime: window });
