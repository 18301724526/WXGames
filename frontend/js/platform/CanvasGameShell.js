(function (global) {
  var CanvasGameAppBase = global.CanvasGameApp;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameAppBase) {
    CanvasGameAppBase = require('./CanvasGameApp');
  }
  var CanvasGameShellMounting = global.CanvasGameShellMounting;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameShellMounting) {
    CanvasGameShellMounting = require('./CanvasGameShellMounting');
  }
  var CanvasGameShellInputRouter = global.CanvasGameShellInputRouter;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameShellInputRouter) {
    CanvasGameShellInputRouter = require('./CanvasGameShellInputRouter');
  }
  var CanvasGameShellCommands = global.CanvasGameShellCommands;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameShellCommands) {
    CanvasGameShellCommands = require('./CanvasGameShellCommands');
  }
  var CanvasGameShellGuideUi = global.CanvasGameShellGuideUi;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameShellGuideUi) {
    CanvasGameShellGuideUi = require('./CanvasGameShellGuideUi');
  }
  var CanvasGameShellWorldMapRuntime = global.CanvasGameShellWorldMapRuntime;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameShellWorldMapRuntime) {
    CanvasGameShellWorldMapRuntime = require('./CanvasGameShellWorldMapRuntime');
  }
  var CanvasGameShellRenderingRuntime = global.CanvasGameShellRenderingRuntime;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameShellRenderingRuntime) {
    CanvasGameShellRenderingRuntime = require('./CanvasGameShellRenderingRuntime');
  }
  var CanvasGameShellSystemUi = global.CanvasGameShellSystemUi;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameShellSystemUi) {
    CanvasGameShellSystemUi = require('./CanvasGameShellSystemUi');
  }

  class CanvasGameShell extends (CanvasGameAppBase || class {}) {
constructor(options = {}) {
      super({
        runtime: options.runtime || null,
        renderer: options.renderer || null,
        presenter: options.presenter || null,
        actionDispatcher: options.actionDispatcher,
        runtimeRequired: false,
        apiRequired: false,
        rendererRequired: false,
      });
      this.runtime = options.runtime || null;
      this.renderer = options.renderer || null;
      this.worldMapRenderer = options.worldMapRenderer || null;
      this.worldMapRuntime = options.worldMapRuntime || null;
      this.worldMapRuntimeCoordinator = options.worldMapRuntimeCoordinator || null;
      this.presenter = options.presenter || null;
      this.previewEnabled = Boolean(options.previewEnabled);
      this.inputEnabled = Boolean(options.inputEnabled);
      this.onAction = typeof options.onAction === 'function' ? options.onAction : null;
      const DispatcherCtor = global.CanvasActionDispatcher;
      this.actionDispatcher = options.actionDispatcher || (DispatcherCtor ? new DispatcherCtor() : null);
      const ActionControllerCtor = global.CanvasActionController || (typeof require === 'function' ? require('./CanvasActionController') : null);
      this.actionController = options.actionController || (ActionControllerCtor ? new ActionControllerCtor({
        host: this,
        log: options.log,
      }) : this.actionController);
      this.mounted = false;
      this.lastGame = null;
      this.resizeDisposer = null;
      this.tapDisposer = null;
      this.dragDisposer = null;
      this.gestureDisposer = null;
      this.pointerMoveDisposer = null;
      this.effectTimer = null;
      this.floatTimer = null;
      this.showSettings = false;
      this.showLogs = false;
      this.showResourceDetails = false;
      this.showCitySwitcher = false;
      this.showSubcityList = false;
      this.showCityManagement = false;
      this.activeCityManagementTab = 'buildings';
      this.showAdvisor = false;
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
      this.buildingOffset = 0;
      this.activeBuildingCategory = 'all';
      this.techTreePanX = 0;
      this.techTreePanY = 0;
      this.techTreeZoom = 1;
      this.selectedTechId = '';
      this.techDetailOpen = false;
      this.techTreeDragStart = null;
      this.pageTransition = null;
      this.buildingTransition = null;
      this.transitionTimer = null;
      this.lastAnimationRenderAt = 0;
      this.animationRenderQueued = false;
      this.lastWorldMapLayerRenderAt = 0;
      this.worldMapLayerRenderQueued = false;
      this.worldMapQueuedRenderOptions = null;
      this.worldMapDragFrameActive = false;
      this.worldMapDragWaterTimeMs = null;
      this.worldMapDragCooldownUntil = 0;
      this.deferRenderUntilWorldMapDragEnd = false;
      this.worldMapPinchDragging = false;
      this.tileMapWaterTimer = null;
      this.networkOverlayTimer = null;
      this.activeEventId = null;
      this.territoryUiState = {};
      this.naming = {
        visible: false,
        view: null,
        inputValue: '',
        submitting: false,
      };
      this.auth = {
        view: {
          loginPanelVisible: false,
          appVisible: true,
          message: '',
        },
        credentials: {
          usernameValue: '',
          passwordValue: '',
          rememberPasswordChecked: false,
        },
      };
      this.loading = {
        visible: false,
        percentage: 0,
        message: '',
      };
      this.pendingBuildingAction = null;
      this.networkState = {
        status: 'online',
        failureCount: 0,
      };
      this.tutorialHighlight = null;
      this.tutorialIntro = null;
      this.floatingTexts = [];
      this.floatDurationMs = options.floatDurationMs || 1200;
      this.rewardReveal = null;
      this.battleScene = null;
      this.mapHomeActive = false;
      this.useWorldMapRuntime = options.useWorldMapRuntime !== false;
      this.guideController = options.guideController || null;
    }

static mount(game, options = {}) {
      const RuntimeCtor = options.Runtime || global.H5CanvasRuntime;
      const runtime = options.canvasRuntime
        || (options.runtime?.ensureCanvas ? options.runtime : null)
        || (RuntimeCtor ? new RuntimeCtor(options) : null);
      const shell = new CanvasGameShell({
        runtime,
        renderer: options.renderer,
        presenter: options.presenter,
        previewEnabled: options.previewEnabled,
        inputEnabled: options.inputEnabled,
        onAction: options.onAction,
      });
      const mounted = shell.mount(game);
      return mounted ? shell : null;
    }
  }

  [
    CanvasGameShellMounting,
    CanvasGameShellInputRouter,
    CanvasGameShellCommands,
    CanvasGameShellGuideUi,
    CanvasGameShellWorldMapRuntime,
    CanvasGameShellRenderingRuntime,
    CanvasGameShellSystemUi,
  ].forEach((shellModule) => shellModule?.install?.(CanvasGameShell));

  global.CanvasGameShell = CanvasGameShell;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasGameShell;
})(typeof window !== 'undefined' ? window : globalThis);
