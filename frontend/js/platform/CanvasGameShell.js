(function (global) {
  var CanvasGameAppBase = global.CanvasGameApp;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameAppBase) {
    CanvasGameAppBase = require('./CanvasGameApp');
  }
  var FeatureFlagsBase = global.FeatureFlags;
  if (typeof module !== 'undefined' && module.exports && !FeatureFlagsBase) {
    try {
      FeatureFlagsBase = require('../config/FeatureFlags');
    } catch (_error) {
      FeatureFlagsBase = null;
    }
  }
  var CanvasLayerRegistryBase = global.CanvasLayerRegistry;
  if (typeof module !== 'undefined' && module.exports && !CanvasLayerRegistryBase) {
    try {
      CanvasLayerRegistryBase = require('./CanvasLayerRegistry');
    } catch (_error) {
      CanvasLayerRegistryBase = null;
    }
  }
  var DebugOverlayRegistryBase = global.DebugOverlayRegistry;
  if (typeof module !== 'undefined' && module.exports && !DebugOverlayRegistryBase) {
    try {
      DebugOverlayRegistryBase = require('./DebugOverlayRegistry');
    } catch (_error) {
      DebugOverlayRegistryBase = null;
    }
  }
  var WorldFogCanvasRendererBase = global.WorldFogCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports && !WorldFogCanvasRendererBase) {
    try {
      WorldFogCanvasRendererBase = require('./renderers/WorldFogCanvasRenderer');
    } catch (_error) {
      WorldFogCanvasRendererBase = null;
    }
  }
  var CanvasModeOwnershipRuntime = global.CanvasModeOwnershipRuntime;
  if (typeof module !== 'undefined' && module.exports && !CanvasModeOwnershipRuntime) {
    CanvasModeOwnershipRuntime = require('./CanvasModeOwnershipRuntime');
  }
  var TutorialGuideUiControllerBase = global.TutorialGuideUiController;
  if (typeof module !== 'undefined' && module.exports && !TutorialGuideUiControllerBase) {
    TutorialGuideUiControllerBase = require('./TutorialGuideUiController');
  }
  var CanvasModalSnapshotAdapter = global.CanvasModalSnapshotAdapter;
  if (typeof module !== 'undefined' && module.exports && !CanvasModalSnapshotAdapter) {
    CanvasModalSnapshotAdapter = require('./CanvasModalSnapshotAdapter');
  }
  var WorldMapRuntimeCoordinatorBase = global.WorldMapRuntimeCoordinator;
  if (typeof module !== 'undefined' && module.exports && !WorldMapRuntimeCoordinatorBase) {
    WorldMapRuntimeCoordinatorBase = require('./WorldMapRuntimeCoordinator');
  }
  var WorldMapRuntimePolicy = global.WorldMapRuntimePolicy;
  if (typeof module !== 'undefined' && module.exports && !WorldMapRuntimePolicy) {
    WorldMapRuntimePolicy = require('./WorldMapRuntimePolicy');
  }
  var WorldMapRuntimeRenderPolicy = global.WorldMapRuntimeRenderPolicy;
  if (typeof module !== 'undefined' && module.exports && !WorldMapRuntimeRenderPolicy) {
    try {
      WorldMapRuntimeRenderPolicy = require('./WorldMapRuntimeRenderPolicy');
    } catch (_error) {
      WorldMapRuntimeRenderPolicy = null;
    }
  }
  var EcsModeRuntimeBase = global.EcsModeRuntime;
  if (typeof module !== 'undefined' && module.exports && !EcsModeRuntimeBase) {
    try {
      EcsModeRuntimeBase = require('../ecs/mode/EcsModeRuntimeEntry');
    } catch (_error) {
      EcsModeRuntimeBase = null;
    }
  }
  var WorldMarchSystem = global.WorldMarchSystem;
  if (typeof module !== 'undefined' && module.exports && !WorldMarchSystem) {
    try {
      WorldMarchSystem = require('../ecs/system/WorldMarchSystem');
    } catch (_error) {
      WorldMarchSystem = null;
    }
  }
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
  const ActorPickingDiagnostics = (() => {
    if (global.ActorPickingDiagnostics) return global.ActorPickingDiagnostics;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../debug/ActorPickingDiagnostics');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
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
  var StateWriter = global.StateWriter;
  if (typeof module !== 'undefined' && module.exports && !StateWriter) {
    StateWriter = require('../state/StateWriter');
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

  function t(key = '', params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
  }

  function getMountedGame(shell) {
    return shell?.lastGame && shell.lastGame !== shell ? shell.lastGame : null;
  }

  function getUiStateOwner(shell) {
    return getMountedGame(shell) || shell;
  }

  function getWorldActorOverlayAssemblyReason(assembly, context = {}) {
    if (assembly.enabled !== true) return 'flag_disabled';
    if (assembly.canvasCreated !== true) {
      return context.runtimeHasEnsureLayerCanvas ? 'canvas_not_created' : 'runtime_no_ensureLayerCanvas';
    }
    if (!context.worldMapRenderer) return 'terrain_renderer_missing';
    if (!context.worldActorLayerRenderer) return 'actor_renderer_missing';
    if (!context.terrainCtx) return 'terrain_ctx_missing';
    if (!context.actorCtx) return 'actor_ctx_missing';
    if (assembly.ctxSeparated !== true) return 'ctx_shared';
    return 'ok';
  }

  function recordWorldActorOverlayAssembly(assembly) {
    global.ClientOperationLog?.record?.('worldActorOverlay:assembly', {
      enabled: assembly.enabled,
      canvasCreated: assembly.canvasCreated,
      ctxSeparated: assembly.ctxSeparated,
      reason: assembly.reason,
    });
  }

  function syncWorldActorOverlayRendererLinks(shell) {
    const worldMapRenderer = shell?.worldMapRenderer || null;
    const worldActorLayerRenderer = shell?.worldActorLayerRenderer || null;
    if (!worldMapRenderer || !worldActorLayerRenderer) return false;
    const mapChildRenderer = worldMapRenderer.worldMapRenderer || null;
    worldMapRenderer.worldActorLayerRenderer = worldActorLayerRenderer;
    worldActorLayerRenderer.worldMapRenderer = worldMapRenderer;
    if (mapChildRenderer) mapChildRenderer.worldActorLayerRenderer = worldActorLayerRenderer;
    return true;
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

  function summarizeActorPickingAction(action = {}) {
    return action ? {
      type: action.type || '',
      actorId: action.actorId || '',
      missionId: action.missionId || '',
      tileId: action.tileId || '',
      siteId: action.siteId || '',
      targetQ: action.targetQ ?? action.q ?? null,
      targetR: action.targetR ?? action.r ?? null,
      inputSurface: action.inputSurface || '',
      background: Boolean(action.background),
      disabled: Boolean(action.disabled),
    } : null;
  }

  function createActorPickingTapTraceId() {
    if (ActorPickingDiagnostics?.createTapTraceId) return ActorPickingDiagnostics.createTapTraceId();
    const sequence = (Number(global.__actorPickingDiagTapSequence) || 0) + 1;
    global.__actorPickingDiagTapSequence = sequence;
    return `tap-${Date.now()}-${sequence}`;
  }

  function logActorPickingDiag(stage = '', detail = {}, options = {}) {
    return ActorPickingDiagnostics?.log?.(stage, detail, options) || null;
  }

  function pickOption(options = {}, key = '') {
    return options && Object.prototype.hasOwnProperty.call(options, key) ? options[key] : undefined;
  }

  function buildMilitaryRenderOptions(host = null, runtime = null, options = {}) {
    const explicitUiState = pickOption(options, 'territoryUiState');
    const runtimeUiState = explicitUiState || runtime?.getCameraUiState?.() || null;
    if (typeof host?.buildRenderOptions === 'function') {
      const renderOptions = host.buildRenderOptions('military', runtimeUiState, {
        forceMapHome: true,
      }) || {};
      const { territoryUiState = runtimeUiState || {} } = renderOptions;
      return { ...renderOptions, territoryUiState };
    }
    return { territoryUiState: runtimeUiState || {} };
  }

  function writeOwnedStateField(host, state, field, value, source) {
    if (StateWriter.getStateHost(host)?.state === state) {
      return StateWriter.commit(host, (prev) => ({ ...prev, [field]: value }), { source });
    }
    return { ...state, [field]: value };
  }

  function hasActiveWorldExplorerMission(state = {}, options = {}) {
    const explorer = state?.worldExplorerState || {};
    if (WorldMarchSystem?.hasActiveMission) return WorldMarchSystem.hasActiveMission(explorer, options);
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

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
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
        || host.getCanonicalWorldTileMapContext?.()
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
      this.worldClock = options.worldClock || this.runtime?.worldClock || SharedWorldClock?.getShared?.({ runtime: this.runtime }) || null;
      if (this.runtime && typeof this.runtime === 'object' && this.worldClock) this.runtime.worldClock = this.worldClock;
      this.config = options.config || global.GameConfig || {};
      this.loadTrace = options.loadTrace || null;
      this.layerRegistry = options.layerRegistry || CanvasLayerRegistryBase || global.CanvasLayerRegistry || null;
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
        awaitAsync: true,
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
      this.activeTaskCenterTab = 'main';
      this.activeGuidebookTab = 'planning';
      this.techTreePanX = 0;
      this.techTreePanY = 0;
      this.techTreeZoom = 1;
      this.selectedTechId = '';
      this.techTreeDragStart = null;
      this.pageTransition = null;
      this.buildingTransition = null;
      this.transitionTimer = null;
      this.lastAnimationRenderAt = 0;
      this.animationRenderQueued = false;
      this.lastWorldMapLayerRenderAt = 0;
      this.worldMapLayerRenderQueued = false;
      this.worldMapQueuedRenderOptions = null;
      this.worldActorAnimationActive = false;
      this.worldActorAnimationQueued = false;
      this.worldActorQueuedRenderOptions = null;
      this.lastWorldActorAnimationRenderAt = 0;
      this.worldMapDragFrameActive = false;
      this.worldMapDragWaterTimeMs = null;
      this.worldMapDragCooldownUntil = 0;
      this.deferRenderUntilWorldMapDragEnd = false;
      this.worldMapPinchDragging = false;
      this.tileMapWaterTimer = null;
      this.networkOverlayTimer = null;
      TerritoryUiStateStore.ensure(this);
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
      this.networkState = {
        status: 'online',
        failureCount: 0,
      };
      this.tutorialIntro = null;
      this.floatingTexts = [];
      this.floatDurationMs = options.floatDurationMs || 1200;
      this.mapHomeActive = false;
      this.useWorldMapRuntime = options.useWorldMapRuntime !== false;
      this.guideController = options.guideController || null;
    }

getCanvasLayerRegistry() {
      return this.layerRegistry || CanvasLayerRegistryBase || global.CanvasLayerRegistry || null;
    }

getCanvasLayerName(name = '') {
      return this.getCanvasLayerRegistry()?.getLayerName?.(name) || String(name || '');
    }

getCanvasLayerOptions(name = '', overrides = {}) {
      return this.getCanvasLayerRegistry()?.getLayerOptions?.(name, overrides) || { ...(overrides || {}) };
    }

isCanvasLayerEnabled(name = '') {
      const registry = this.getCanvasLayerRegistry();
      const FeatureFlags = FeatureFlagsBase || global.FeatureFlags;
      if (registry?.isLayerEnabled) return registry.isLayerEnabled(name, this.config, { FeatureFlags });
      if (name === 'worldFog') {
        return FeatureFlags?.isEnabled
          ? FeatureFlags.isEnabled(this.config, 'FOG_OF_WAR_ENABLED')
          : this.config?.FEATURES?.FOG_OF_WAR_ENABLED === true;
      }
      return Boolean(name);
    }

ensureCanvasLayer(name = '', overrides = {}) {
      if (this.isCanvasLayerEnabled(name) !== true) return null;
      if (typeof this.runtime?.ensureLayerCanvas !== 'function') {
        // Minimal runtimes without layer support only expose the visible canvas.
        if (this.getCanvasLayerName(name) === 'mainHud') return this.runtime?.ensureCanvas?.() || null;
        return null;
      }
      return this.runtime.ensureLayerCanvas(this.getCanvasLayerName(name), this.getCanvasLayerOptions(name, overrides));
    }

getCanvasLayerCanvas(name = '') {
      if (this.isCanvasLayerEnabled(name) !== true) return null;
      return this.runtime?.getLayerCanvas?.(this.getCanvasLayerName(name)) || null;
    }

getCanvasLayerMetrics(name = '', fallback = null) {
      if (this.isCanvasLayerEnabled(name) !== true) return fallback;
      return this.runtime?.getLayerMetrics?.(this.getCanvasLayerName(name)) || fallback;
    }

getCanvasLayerBackingStoreState(name = '', fallback = null) {
      if (this.isCanvasLayerEnabled(name) !== true) return fallback;
      return this.runtime?.getLayerBackingStoreState?.(this.getCanvasLayerName(name)) || fallback;
    }

setCanvasLayerTranslate(name = '', x = 0, y = 0) {
      if (this.isCanvasLayerEnabled(name) !== true) return false;
      return this.runtime?.setLayerTranslate?.(this.getCanvasLayerName(name), x, y) || false;
    }

clearCanvasLayerTransform(name = '') {
      if (this.isCanvasLayerEnabled(name) !== true) return false;
      return this.runtime?.clearLayerTransform?.(this.getCanvasLayerName(name)) || false;
    }

setCanvasLayerVisible(name = '', visible = true) {
      if (this.isCanvasLayerEnabled(name) !== true) return false;
      return this.runtime?.setLayerVisible?.(this.getCanvasLayerName(name), visible !== false) || false;
    }

isFogOfWarEnabled() {
      return this.isCanvasLayerEnabled('worldFog') === true;
    }

    // Lazily own the world actor spine layer renderer (single webgl context, many skeletons).
    // Optional: if the class is absent or construction throws, marching armies keep the 2D
    // sprite path. Failure is remembered so we never retry a broken webgl init every frame.
    getWorldActorSpineRenderer() {
      if (this.worldActorSpineRendererFailed) return null;
      if (this.worldActorSpineRenderer) return this.worldActorSpineRenderer;
      const RendererClass = global.WorldActorSpineRenderer;
      if (typeof RendererClass !== 'function') return null;
      try {
        this.worldActorSpineRenderer = new RendererClass({ host: this, runtime: this.runtime });
      } catch (_error) {
        this.worldActorSpineRendererFailed = true;
        this.worldActorSpineRenderer = null;
        return null;
      }
      return this.worldActorSpineRenderer;
    }

isDebugOverlayEnabled(name = '') {
      const registry = DebugOverlayRegistryBase || global.DebugOverlayRegistry;
      return registry?.isOverlayEnabled?.(name, this.config, { FeatureFlags: FeatureFlagsBase || global.FeatureFlags }) === true;
    }

createDebugOverlaySnapshot(context = {}, options = {}) {
      const registry = DebugOverlayRegistryBase || global.DebugOverlayRegistry;
      if (!registry?.createOverlaySnapshot) return null;
      return registry.createOverlaySnapshot({
        renderer: this.renderer || null,
        surface: this.renderer || null,
        worldMapRuntime: this.worldMapRuntime || this.worldMapRuntimeCoordinator?.getMapRuntime?.() || null,
        visibilitySnapshot: this.getLastFogProjection?.()?.visibilitySnapshot || null,
        inputTrace: this.lastDebugInputTrace || null,
        config: this.config,
        ...context,
      }, {
        config: this.config,
        FeatureFlags: FeatureFlagsBase || global.FeatureFlags,
        ...options,
      });
    }

    syncWorldActorOverlayRendererLinks() {
          return syncWorldActorOverlayRendererLinks(this);
        }

    getWorldMapRenderState() {
          return this.worldMapRenderState
            || this.worldMapRenderer?.worldMapRenderState
            || this.renderer?.worldMapRenderState
            || null;
        }

    createRenderer(canvas) {
          if (this.renderer || !canvas) return this.renderer;
          const RendererCtor = global.H5CanvasGameRenderer;
          if (!RendererCtor) return null;
          const sharedAssetCache = new Map();
          const sharedAssetMetricsCache = new Map();
          const sharedWorldTileMaskCache = new Map();
          const sharedWorldTileMaskMetricsCache = new Map();
          const sharedWorldTileDryCompositeCache = new Map();
          const sharedWorldMapRenderState =
            this.worldMapRenderState ||
            this.renderer?.worldMapRenderState ||
            global.WorldMapRenderState?.createWorldMapRenderState?.() ||
            null;
          this.worldMapRenderState = sharedWorldMapRenderState;
          const worldMapLayerPadding = this.getWorldMapLayerPadding();
          const mapCanvas = this.ensureCanvasLayer?.('worldMap', { padding: worldMapLayerPadding }) || null;
          const fogEnabled = this.isCanvasLayerEnabled?.('worldFog') === true;
          const fogCanvas = this.ensureCanvasLayer?.('worldFog', { padding: worldMapLayerPadding }) || null;
          const actorEnabled = this.isCanvasLayerEnabled?.('worldActor') === true;
          const actorCanvas = actorEnabled ? (this.ensureCanvasLayer?.('worldActor', { padding: worldMapLayerPadding }) || null) : null;
          const actorAssembly = {
            enabled: actorEnabled,
            canvasCreated: Boolean(actorCanvas),
            ctxSeparated: false,
            reason: actorEnabled ? 'pending' : 'flag_disabled',
          };
          if (mapCanvas && !this.worldMapRenderer) {
            const layerMetrics = this.getCanvasLayerMetrics?.('worldMap', {}) || {};
            this.worldMapRenderer = new RendererCtor({
              canvas: mapCanvas,
              getWorldActorSpineRenderer: this.getWorldActorSpineRenderer?.bind(this),
              presenter: this.presenter,
              loadTrace: this.loadTrace || this.lastGame?.loadTrace || null,
              pixelRatio: this.runtime?.pixelRatio,
              width: layerMetrics.width || this.runtime?.width,
              height: layerMetrics.height || this.runtime?.height,
              viewportOffsetX: Number(layerMetrics.padding) || 0,
              viewportOffsetY: Number(layerMetrics.padding) || 0,
              viewportWidth: layerMetrics.viewportWidth || this.runtime?.width,
              viewportHeight: layerMetrics.viewportHeight || this.runtime?.height,
              h5Runtime: this.runtime,
              assetCache: sharedAssetCache,
              assetMetricsCache: sharedAssetMetricsCache,
              worldTileMaskCache: sharedWorldTileMaskCache,
              worldTileMaskMetricsCache: sharedWorldTileMaskMetricsCache,
              worldTileDryCompositeCache: sharedWorldTileDryCompositeCache,
              worldMapRenderState: sharedWorldMapRenderState,
              showFpsOverlay: false,
            });
            if (typeof this.worldMapRenderer.setAssetsChangedHandler === 'function') {
              this.worldMapRenderer.setAssetsChangedHandler(() => {
                this.renderer?.invalidateWorldTileCaches?.();
                this.renderer?.invalidateWorldTileViewCache?.();
                this.requestWorldMapRenderAnimationFrame();
              });
            }
          }
          if (actorCanvas && this.worldMapRenderer && !this.worldActorLayerRenderer) {
            const actorMetrics = this.getCanvasLayerMetrics?.('worldActor', this.getCanvasLayerMetrics?.('worldMap', {}) || {}) || {};
            this.worldActorLayerRenderer = new RendererCtor({
              canvas: actorCanvas,
              getWorldActorSpineRenderer: this.getWorldActorSpineRenderer?.bind(this),
              presenter: this.presenter,
              loadTrace: this.loadTrace || this.lastGame?.loadTrace || null,
              pixelRatio: this.runtime?.pixelRatio,
              width: actorMetrics.width || this.runtime?.width,
              height: actorMetrics.height || this.runtime?.height,
              viewportOffsetX: Number(actorMetrics.padding) || 0,
              viewportOffsetY: Number(actorMetrics.padding) || 0,
              viewportWidth: actorMetrics.viewportWidth || this.runtime?.width,
              viewportHeight: actorMetrics.viewportHeight || this.runtime?.height,
              h5Runtime: this.runtime,
              assetCache: sharedAssetCache,
              assetMetricsCache: sharedAssetMetricsCache,
              worldTileMaskCache: sharedWorldTileMaskCache,
              worldTileMaskMetricsCache: sharedWorldTileMaskMetricsCache,
              worldTileDryCompositeCache: sharedWorldTileDryCompositeCache,
              worldMapRenderState: sharedWorldMapRenderState,
              showFpsOverlay: false,
            });
            this.syncWorldActorOverlayRendererLinks();
            this.worldMapRenderer.worldActorOverlayCanvas = actorCanvas;
            this.worldMapRenderer.worldActorOverlayCtx = this.worldActorLayerRenderer.ctx || null;
            this.worldActorLayerRenderer.worldActorOverlayCanvas = actorCanvas;
            if (typeof this.worldActorLayerRenderer.setAssetsChangedHandler === 'function') {
              this.worldActorLayerRenderer.setAssetsChangedHandler(() => {
                this.requestWorldMapRenderAnimationFrame({ force: true, invalidateWorldTileView: false });
              });
            }
          }
          const terrainCtx = this.worldMapRenderer?.ctx || null;
          const actorCtx = this.worldActorLayerRenderer?.ctx || null;
          actorAssembly.ctxSeparated = Boolean(terrainCtx && actorCtx && terrainCtx !== actorCtx);
          actorAssembly.reason = getWorldActorOverlayAssemblyReason(actorAssembly, {
            runtimeHasEnsureLayerCanvas: typeof this.runtime?.ensureLayerCanvas === 'function',
            worldMapRenderer: this.worldMapRenderer || null,
            worldActorLayerRenderer: this.worldActorLayerRenderer || null,
            terrainCtx,
            actorCtx,
          });
          this.worldActorOverlayAssembly = actorAssembly;
          this.syncWorldActorOverlayRendererLinks();
          if (this.worldMapRenderer) {
            this.worldMapRenderer.worldActorOverlaySeparate = this.worldActorOverlayAssembly.ctxSeparated;
          }
          if (this.worldActorLayerRenderer) {
            this.worldActorLayerRenderer.worldActorOverlaySeparate = this.worldActorOverlayAssembly.ctxSeparated;
          }
          recordWorldActorOverlayAssembly(this.worldActorOverlayAssembly);
          const FogRendererCtor = fogEnabled ? (WorldFogCanvasRendererBase || global.WorldFogCanvasRenderer) : null;
          if (fogEnabled && fogCanvas && !this.worldFogRenderer && FogRendererCtor) {
            const fogMetrics = this.getCanvasLayerMetrics?.('worldFog', this.getCanvasLayerMetrics?.('worldMap', {}) || {}) || {};
            const gl = fogCanvas.getContext?.('webgl', {
              alpha: true,
              antialias: false,
              depth: false,
              stencil: false,
              preserveDrawingBuffer: false,
              premultipliedAlpha: true,
            }) || fogCanvas.getContext?.('experimental-webgl', {
              alpha: true,
              antialias: false,
              depth: false,
              stencil: false,
              preserveDrawingBuffer: false,
              premultipliedAlpha: true,
            }) || null;
            this.worldFogRenderer = new FogRendererCtor({
              canvas: fogCanvas,
              gl,
              pixelRatio: this.runtime?.pixelRatio,
              width: fogMetrics.width || this.runtime?.width,
              height: fogMetrics.height || this.runtime?.height,
              viewportOffsetX: Number(fogMetrics.padding) || 0,
              viewportOffsetY: Number(fogMetrics.padding) || 0,
              viewportWidth: fogMetrics.viewportWidth || this.runtime?.width,
              viewportHeight: fogMetrics.viewportHeight || this.runtime?.height,
            });
          }
          this.renderer = new RendererCtor({
            canvas,
            presenter: this.presenter,
            loadTrace: this.loadTrace || this.lastGame?.loadTrace || null,
            pixelRatio: this.runtime?.pixelRatio,
            width: this.runtime?.width,
            height: this.runtime?.height,
            h5Runtime: this.runtime,
            canvasLayerRegistry: this.getCanvasLayerRegistry?.() || null,
            ensureCanvasLayer: this.ensureCanvasLayer?.bind(this),
            getCanvasLayerCanvas: this.getCanvasLayerCanvas?.bind(this),
            getCanvasLayerMetrics: this.getCanvasLayerMetrics?.bind(this),
            setCanvasLayerVisible: this.setCanvasLayerVisible?.bind(this),
            requestOverlayRenderFrame: this.requestOverlayRenderFrame?.bind(this),
            getWorldActorSpineRenderer: this.getWorldActorSpineRenderer?.bind(this),
            assetCache: sharedAssetCache,
            assetMetricsCache: sharedAssetMetricsCache,
            worldTileMaskCache: sharedWorldTileMaskCache,
            worldTileMaskMetricsCache: sharedWorldTileMaskMetricsCache,
            worldTileDryCompositeCache: sharedWorldTileDryCompositeCache,
          });
          if (typeof this.renderer.setAssetsChangedHandler === 'function') {
            this.renderer.setAssetsChangedHandler(() => {
              this.worldMapRenderer?.invalidateWorldTileCaches?.();
              this.worldMapRenderer?.invalidateWorldTileViewCache?.();
              this.requestRenderAnimationFrame();
            });
          }
          if (this.worldMapRenderer) this.worldMapRenderer.presenter = this.renderer.presenter;
          if (this.worldActorLayerRenderer) this.worldActorLayerRenderer.presenter = this.renderer.presenter;
          this.ensureWorldMapRuntime();
          return this.renderer;
        }

    mount(game) {
          if (this.mounted) return false;
          if (!this.runtime || typeof this.runtime.ensureCanvas !== 'function') return false;
          const canvas = this.runtime.ensureCanvas();
          if (!canvas) return false;
          // Stage compositing: the renderer draws the HUD on an offscreen surface and the
          // visible canvas is the composite target. Falls back to the visible canvas when
          // the runtime has no offscreen layer support.
          const hudTarget = this.ensureCanvasLayer?.('mainHud') || canvas;
          this.createRenderer(hudTarget);
          this.mounted = true;
          this.lastGame = game || null;
          const shouldHoldInitialLoading = Boolean(game?.token && !game?.hasServerState);
          if (shouldHoldInitialLoading) {
            this.loading = {
              visible: true,
              percentage: 0,
              message: t('world.map.loading.default'),
            };
          }
          if (game?.authView) this.applyAuthShell(game.authView);
          if (game?.authCredentials) this.applyCredentials(game.authCredentials);
          if (this.runtime?.onResize && !this.resizeDisposer) {
            this.resizeDisposer = this.runtime.onResize((size) => this.handleResize(size));
          }
          this.bindInput();
          this.renderActive();
          return true;
        }

    bindInput() {
          if (!this.inputEnabled || !this.runtime?.onTap || this.tapDisposer) return false;
          this.tapDisposer = this.runtime.onTap((point, event) => this.handleTap(point, event));
          if (this.runtime.onDrag && !this.dragDisposer) {
            this.dragDisposer = this.runtime.onDrag((phase, point, event) => this.handleDrag(phase, point, event));
          }
          if (this.runtime.onGesture && !this.gestureDisposer) {
            this.gestureDisposer = this.runtime.onGesture((gesture, event) => this.handleGesture(gesture, event));
          }
          if (this.runtime.onPointerMove && !this.pointerMoveDisposer) {
            this.pointerMoveDisposer = this.runtime.onPointerMove((point) => this.handlePointerMove(point));
          }
          return true;
        }

    handlePointerMove(point) {
          if (!this.renderer || typeof this.renderer.setHoverPoint !== 'function') return false;
          const changed = this.renderer.setHoverPoint(point);
          if (changed && this.isBlockingPanelSnapshotOpen('showFamousPersons')) {
            this.getPanelSurfaceManager?.()?.refreshPanelSurface?.('famousPersons');
          }
          return changed;
        }

    hasBlockingOverlayOpen() {
          if (typeof this.isModeBlockingOverlayOpen === 'function') {
            return Boolean(
              this.isModeBlockingOverlayOpen()
              || this.tutorialAdvisorDialogue
              || this.lastGame?.tutorialAdvisorDialogue,
            );
          }
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
          return Boolean(this.isBlockingPanelSnapshotOpen('showSettings')
            || this.isBlockingPanelSnapshotOpen('showLogs')
            || this.isBlockingPanelSnapshotOpen('showResourceDetails')
            || this.isBlockingPanelSnapshotOpen('showCitySwitcher')
            || this.isBlockingPanelSnapshotOpen('showSubcityList')
            || this.isBlockingPanelSnapshotOpen('showCityManagement')
            || this.isBlockingPanelSnapshotOpen('showAdvisor')
            || this.tutorialAdvisorDialogue
            || this.lastGame?.tutorialAdvisorDialogue
            || this.isBlockingPanelSnapshotOpen('showTaskCenter')
            || this.isBlockingPanelSnapshotOpen('showGuidebook')
            || this.armyFormationEditor?.open
            || confirmDialogOpen
            || this.getCommandPanelValue()
            || this.isBlockingPanelSnapshotOpen('techDetailOpen')
            || this.isEventSnapshotOpen?.()
            || namingOpen
            || battleScene?.visible
            || this.isEntityBattleActive()
            || rewardRevealOpen);
        }

    isEntityBattleActive() {
          if (typeof this.isModeEntityBattleActive === 'function') return this.isModeEntityBattleActive();
          return Boolean((this.entityBattle || this.lastGame?.entityBattle)?.visible);
        }

    isWorldMapHudAction(action = {}) {
          const type = action?.type || '';
          return Boolean(type
            && type !== 'worldMapDrag'
            && type !== 'openWorldSite'
            && type !== 'resetWorldPan'
            && type !== 'closeWorldSite'
            && type !== 'blockCanvasModal');
        }

    isTechTreeDragAction(action = {}) {
          return Boolean(action?.type === 'techTreeDrag' || action?.dragType === 'techTreeDrag');
        }

    containsCanvasPoint(rect = {}, point = {}) {
          const x = Number(point?.x);
          const y = Number(point?.y);
          return Number.isFinite(x)
            && Number.isFinite(y)
            && x >= Number(rect.x)
            && x <= Number(rect.x) + Number(rect.width)
            && y >= Number(rect.y)
            && y <= Number(rect.y) + Number(rect.height);
        }

    getTechTreeHitAction(point = {}) {
          const targets = Array.isArray(this.renderer?.hitTargets) ? this.renderer.hitTargets : [];
          for (let index = targets.length - 1; index >= 0; index -= 1) {
            const target = targets[index];
            if (!this.isTechTreeDragAction(target?.action)) continue;
            if (this.containsCanvasPoint(target, point)) return target.action;
          }
          return null;
        }

    isTechTreeInteractionOpen() {
          const snapshot = typeof this.getModeSnapshot === 'function' ? this.getModeSnapshot() : null;
          if (snapshot) return snapshot.baseModeKey === 'techTree' || snapshot.canRouteTechTree || this.getCommandPanelValue() === 'tech';
          return Boolean(this.getActiveTab() === 'tech' || this.getCommandPanelValue() === 'tech');
        }

    hasBlockingOverlayExceptTechTree() {
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
          return Boolean(this.isBlockingPanelSnapshotOpen('showSettings')
            || this.isBlockingPanelSnapshotOpen('showLogs')
            || this.isBlockingPanelSnapshotOpen('showResourceDetails')
            || this.isBlockingPanelSnapshotOpen('showCitySwitcher')
            || this.isBlockingPanelSnapshotOpen('showSubcityList')
            || this.isBlockingPanelSnapshotOpen('showCityManagement')
            || this.isBlockingPanelSnapshotOpen('showAdvisor')
            || this.tutorialAdvisorDialogue
            || this.lastGame?.tutorialAdvisorDialogue
            || this.isBlockingPanelSnapshotOpen('showTaskCenter')
            || this.isBlockingPanelSnapshotOpen('showGuidebook')
            || this.armyFormationEditor?.open
            || confirmDialogOpen
            || (this.getCommandPanelValue() && this.getCommandPanelValue() !== 'tech')
            || this.isBlockingPanelSnapshotOpen('techDetailOpen')
            || this.isEventSnapshotOpen?.()
            || namingOpen
            || battleScene?.visible
            || this.isEntityBattleActive()
            || rewardRevealOpen);
        }

    canRouteTechTreeInteraction(action = null) {
          const snapshot = typeof this.getModeSnapshot === 'function' ? this.getModeSnapshot() : null;
          if (!this.isTechTreeInteractionOpen()) return false;
          if (snapshot ? !snapshot.canRouteTechTree : this.hasBlockingOverlayExceptTechTree()) return false;
          if (action && !this.isTechTreeDragAction(action)) return false;
          return true;
        }

    stopCanvasEvent(event) {
          if (event?.preventDefault) event.preventDefault();
          if (event?.stopPropagation) event.stopPropagation();
          return true;
        }

    observeAsyncActionResult(result) {
          if (result && typeof result.then === 'function') {
            result.catch((error) => this.actionController?.log?.(error));
          }
          return result;
        }

    dispatchCanvasAction(action = {}, meta = {}) {
          if (this.actionDispatcher?.canHandle?.(action, this)) {
            return this.actionDispatcher.handle(action, this);
          }
          return this.actionController?.handle?.(action, meta) || false;
        }

    getTutorialControlAction(point = {}) {
          if (!this.renderer || typeof this.renderer.getHitTarget !== 'function') return null;
          const action = this.renderer.getHitTarget(point);
          if (!action) return null;
          return action.type === 'blockCanvasModal' ? { ...action, tutorialBlocked: true } : action;
        }

    isTutorialInputActive() {
          const intro = this.lastGame?.tutorialIntro || this.tutorialIntro || null;
          const highlight = this.tutorialHighlight || null;
          return Boolean(intro?.active || highlight);
        }

    getActiveTutorialIntro() {
          const intro = this.lastGame?.tutorialIntro || this.tutorialIntro || null;
          return intro?.active ? intro : null;
        }

    isTutorialIntroActionAllowed(action = {}, intro = this.getActiveTutorialIntro()) {
          if (!intro?.active || !action?.type) return false;
          const targetAction = action.allowedAction || action;
          const capitalCityId = intro.capitalCityId || this.lastGame?.state?.cityState?.capitalCityId || 'capital';
          const actionId = targetAction.cityId || targetAction.territoryId || targetAction.siteId || '';
          if (intro.step === 'city') {
            return targetAction.type === 'openWorldSite' && (!actionId || actionId === capitalCityId);
          }
          if (intro.step === 'enter') {
            return targetAction.type === 'enterCity' && (!actionId || actionId === capitalCityId);
          }
          return false;
        }

    matchesTutorialAllowedAction(action = {}, allowedAction = null) {
          if (!action?.type || !allowedAction?.type) return false;
          // A guided openWorldSite click on a tile the scout actor still overlaps
          // resolves to the multi-candidate world target picker. Accept that picker
          // when it carries the guided site candidate so the click is not blocked;
          // the first-city guide then highlights choosing the site from the picker.
          if (allowedAction.type === 'openWorldSite' && action.type === 'openWorldTargetPicker') {
            const wanted = String(allowedAction.siteId || allowedAction.cityId || allowedAction.territoryId || '');
            const candidates = Array.isArray(action.candidates) ? action.candidates : [];
            return candidates.some((candidate) => {
              const candidateAction = candidate?.action || candidate || {};
              const candidateSiteId = String(candidateAction.siteId || candidateAction.cityId || candidateAction.territoryId || '');
              return (candidateAction.type === 'openWorldSite' || candidate?.kind === 'site')
                && (!wanted || candidateSiteId === wanted);
            });
          }
          if (action.type !== allowedAction.type) return false;
          const getTargetId = (item = {}) => item.siteId || item.territoryId || item.cityId || item.targetId || '';
          const allowedTargetId = getTargetId(allowedAction);
          const actionTargetId = getTargetId(action);
          return Object.entries(allowedAction).every(([key, value]) => (
            key === 'type'
            || value === undefined
            || action[key] === value
            || (['siteId', 'territoryId', 'cityId', 'targetId'].includes(key) && (!actionTargetId || !allowedTargetId || actionTargetId === allowedTargetId))
          ));
        }

    isTutorialHighlightActionAllowed(action = {}, highlight = this.tutorialHighlight) {
          if (!highlight || !action?.type) return false;
          const targetAction = action.allowedAction || action;
          if (highlight.allowedAction) {
            return this.matchesTutorialAllowedAction(targetAction, highlight.allowedAction);
          }
          const type = targetAction?.type || '';
          return Boolean(type
            && type !== 'worldMapDrag'
            && type !== 'techTreeDrag');
        }

    isTutorialAdvisorCloseActionAllowed(action = {}) {
          if (action?.type !== 'closeAdvisor') return false;
          const dialogue = this.tutorialAdvisorDialogue || this.lastGame?.tutorialAdvisorDialogue || null;
          if (!dialogue) return false;
          const actionSource = action.source || '';
          const dialogueSource = dialogue.source || '';
          return !actionSource
            || actionSource === 'tutorialAdvisorDialogue'
            || !dialogueSource
            || actionSource === dialogueSource;
        }

    isTutorialActionAllowed(action = {}) {
          if (!action?.type || action.type === 'blockCanvasModal') return false;
          if (this.isRewardRevealSnapshotOpen?.() && action.type === 'closeRewardReveal') return true;
          if (this.isTutorialAdvisorCloseActionAllowed(action)) return true;
          const targetAction = action.allowedAction || action;
          if (this.tutorialHighlight?.allowedAction
            && this.isTutorialHighlightActionAllowed(targetAction, this.tutorialHighlight)) {
            return true;
          }
          const intro = this.getActiveTutorialIntro();
          if (intro) return this.isTutorialIntroActionAllowed(targetAction, intro);
          return this.isTutorialHighlightActionAllowed(targetAction);
        }

    shouldBlockTutorialInput(point = {}) {
          if (!this.isTutorialInputActive()) return false;
          return !this.isTutorialActionAllowed(this.getTutorialControlAction(point));
        }

    blockTutorialCanvasInput(event) {
          global.ClientOperationLog?.record?.('input:tutorialBlocked', {
            dragAction: global.ClientOperationLog?.summarizeAction?.(this.dragAction),
          }, { flush: true });
          this.dragAction = null;
          this.worldMapPinchDragging = false;
          if (this.isWorldMapDragging()) this.finishWorldMapSnapshotDrag();
          this.stopCanvasEvent(event);
          return true;
        }

    handleDrag(phase, point, event) {
          if (!this.inputEnabled || !this.renderer) return false;
          const routedInput = typeof this.resolveInputIntent === 'function' ? this.resolveInputIntent({ kind: 'drag', phase, pointer: point }) : null;
          if (routedInput ? routedInput.route === 'entity-battle' : this.isEntityBattleActive()) {
            return this.actionController?.handle?.({ type: 'entityBattleDrag', phase, pointer: point }, { event }) || false;
          }
          if (this.isTutorialInputActive()) {
            if (phase === 'start') {
              if (this.shouldBlockTutorialInput(point)) return this.blockTutorialCanvasInput(event);
              return this.blockTutorialCanvasInput(event);
            }
            if (!this.dragAction) return this.blockTutorialCanvasInput(event);
          }
          if (phase === 'start' && typeof this.renderer.getHitTarget === 'function') {
            const action = this.getTechTreeHitAction(point) || this.renderer.getHitTarget(point);
            global.ClientOperationLog?.record?.('input:dragHit', {
              phase,
              point: global.ClientOperationLog?.summarizePoint?.(point),
              action: global.ClientOperationLog?.summarizeAction?.(action),
              mapHomeActive: Boolean(this.lastGame?.mapHomeActive),
              currentTab: this.lastGame?.state?.currentTab || this.lastGame?.activeTab || '',
              militaryView: this.lastGame?.state?.militaryView || this.lastGame?.militaryView || '',
            });
            if (this.canRouteTechTreeInteraction(action)) {
              this.dragAction = { type: 'techTreeDrag' };
            } else if (this.isWorldMapHudAction(action)) {
              return false;
            }
          }
          if (this.ensureWorldMapRuntimeCoordinator()?.canRouteDrag(phase, point, this.lastGame?.state)) {
            return this.handleWorldMapRuntimeDrag(phase, point, event);
          }
          if (phase === 'start') {
            if (this.dragAction) {
              // Reuse the hit-tested tech tree action from the HUD gate above.
            } else if (this.getActiveTab() === 'tech' && !this.hasBlockingOverlayOpen()) {
              this.dragAction = { type: 'techTreeDrag' };
            } else {
              if (typeof this.renderer.getHitTarget !== 'function') return false;
              const action = this.renderer.getHitTarget(point);
              if (
              action?.type !== 'worldMapDrag'
              && action?.type !== 'openWorldSite'
              && action?.type !== 'techTreeDrag'
              && action?.dragType !== 'techTreeDrag'
            ) return false;
              this.dragAction = action.dragType === 'techTreeDrag' ? { type: 'techTreeDrag' } : action;
            }
          }
          if (!this.dragAction) return false;
          const dragType = this.dragAction.type === 'techTreeDrag'
            ? 'techTreeDrag'
            : 'worldMapDrag';
          if (dragType === 'worldMapDrag' && phase === 'start') {
            this.closeWorldSiteHud({ direct: true });
            this.startWorldMapSnapshotDrag();
          }
          const handled = this.actionController?.handle?.({ type: dragType, phase, pointer: point }, { event }) || false;
          if (phase === 'start' || phase === 'end' || phase === 'cancel') {
            global.ClientOperationLog?.record?.('input:dragRouted', {
              phase,
              dragType,
              point: global.ClientOperationLog?.summarizePoint?.(point),
              handled,
            }, { flush: phase !== 'start' });
          } else if (dragType === 'worldMapDrag') {
            global.ClientOperationLog?.recordSampled?.('input:dragRouted', dragType, {
              phase,
              dragType,
              point: global.ClientOperationLog?.summarizePoint?.(point),
              handled,
            });
          }
          if (dragType === 'worldMapDrag' && (phase === 'end' || phase === 'cancel')) {
            this.finishWorldMapSnapshotDrag();
          }
          if (phase === 'end' || phase === 'cancel') {
            this.dragAction = null;
          }
          return handled;
        }

    handleGesture(gesture, event) {
          if (!this.inputEnabled || !this.renderer) return false;
          if (this.isTutorialInputActive()) return this.blockTutorialCanvasInput(event);
          const routedInput = typeof this.resolveInputIntent === 'function' ? this.resolveInputIntent({ kind: 'gesture', gesture }) : null;
          if (routedInput ? routedInput.route === 'entity-battle' : this.isEntityBattleActive()) {
            const handled = this.actionController?.handle?.({ type: 'entityBattleZoom', gesture }, { event }) || false;
            if (handled && event?.preventDefault) event.preventDefault();
            if (handled && event?.stopPropagation) event.stopPropagation();
            return handled;
          }
          const worldMapGestureHandled = this.handleWorldMapGesture(gesture, event);
          if (worldMapGestureHandled) return true;
          if (!this.canRouteTechTreeInteraction()) return false;
          const point = {
            x: Number(gesture?.centerX ?? gesture?.x) || 0,
            y: Number(gesture?.centerY ?? gesture?.y) || 0,
          };
          if (!this.getTechTreeHitAction(point)) {
            if (typeof this.renderer.getHitTarget !== 'function') return false;
            if (!this.isTechTreeDragAction(this.renderer.getHitTarget(point))) return false;
          }
          const handled = this.actionController?.handle?.({ type: 'techTreeZoom', gesture }, { event }) || false;
          if (handled && event?.preventDefault) event.preventDefault();
          if (handled && event?.stopPropagation) event.stopPropagation();
          return handled;
        }

    handleWorldMapGesture(gesture = {}, event) {
          if (gesture?.type !== 'pinchZoom') return false;
          if (this.isTutorialInputActive()) return false;
          if (typeof this.canRouteModeWorldMap === 'function' && !this.canRouteModeWorldMap()) return false;
          const coordinator = this.ensureWorldMapRuntimeCoordinator();
          const runtime = coordinator?.getMapRuntime?.();
          const state = this.lastGame?.state || {};
          if (!coordinator || !runtime || !this.isWorldMapHomeActive() || this.hasBlockingOverlayOpen()) return false;
          if (!coordinator.canRender?.(state)) return false;
          const point = {
            x: Number(gesture.centerX ?? gesture.x) || 0,
            y: Number(gesture.centerY ?? gesture.y) || 0,
          };
          if (!runtime.isPointInMap?.(point, state) && !this.worldMapPinchDragging) return false;
          const phase = gesture.phase || 'move';
          if (phase === 'end' || phase === 'cancel') {
            this.worldMapPinchDragging = false;
            this.finishWorldMapSnapshotDrag();
            if (event?.preventDefault) event.preventDefault();
            if (event?.stopPropagation) event.stopPropagation();
            return true;
          }
          const dx = Number(gesture.deltaX);
          const dy = Number(gesture.deltaY);
          if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false;
          if (!this.worldMapPinchDragging) {
            this.closeWorldSiteHud({ direct: true });
            const waterTimeMs = this.startWorldMapSnapshotDrag();
            runtime.waterTimeMs = waterTimeMs;
            this.worldMapPinchDragging = true;
          }
          const moved = runtime.setCamera?.(
            (Number(runtime.camera?.x) || 0) + dx,
            (Number(runtime.camera?.y) || 0) + dy,
            { source: 'pinchPan', render: false },
          ) !== false;
          this.worldMapRuntime = runtime;
          this.updateWorldMapDragCompositor();
          if (event?.preventDefault) event.preventDefault();
          if (event?.stopPropagation) event.stopPropagation();
          return moved || true;
        }

    handleTap(point, event) {
          if (!this.inputEnabled || !this.renderer || typeof this.renderer.getHitTarget !== 'function') return false;
          const tapTraceId = createActorPickingTapTraceId();
          global.__actorPickingDiagActiveTapTraceId = tapTraceId;
          const action = this.renderer.getHitTarget(point);
          const routeThroughRuntime = shouldRouteTapThroughWorldMapRuntime(action);
          logActorPickingDiag('shellInput:handleTap:start', {
            tapTraceId,
            point: global.ClientOperationLog?.summarizePoint?.(point) || point,
            rendererAction: summarizeActorPickingAction(action),
            routeThroughRuntime,
            tutorialActive: this.isTutorialInputActive(),
            blockingOverlay: Boolean(this.hasBlockingOverlayOpen?.()),
            mapHomeActive: Boolean(this.lastGame?.mapHomeActive),
            currentTab: this.lastGame?.state?.currentTab || this.lastGame?.activeTab || '',
            militaryView: this.lastGame?.state?.militaryView || this.lastGame?.militaryView || '',
          });
          global.ClientOperationLog?.record?.('input:tapHit', {
            point: global.ClientOperationLog?.summarizePoint?.(point),
            action: global.ClientOperationLog?.summarizeAction?.(action),
            tutorialActive: this.isTutorialInputActive(),
            blockingOverlay: this.hasBlockingOverlayOpen?.(),
            mapHomeActive: Boolean(this.lastGame?.mapHomeActive),
            currentTab: this.lastGame?.state?.currentTab || this.lastGame?.activeTab || '',
            militaryView: this.lastGame?.state?.militaryView || this.lastGame?.militaryView || '',
          });
          if (this.isTutorialInputActive() && !this.isTutorialActionAllowed(action)) {
            return this.blockTutorialCanvasInput(event);
          }
          if (action?.type === 'blockCanvasModal') {
            const handled = this.handleAction(action, event);
            if (handled) this.stopCanvasEvent(event);
            return handled;
          }
          if (routeThroughRuntime) {
            const runtimeHandled = this.ensureWorldMapRuntimeCoordinator()?.handleTap(point, event, { tapTraceId }) || false;
            this.observeAsyncActionResult(runtimeHandled);
            this.worldMapRuntime = this.worldMapRuntimeCoordinator?.getMapRuntime?.() || this.worldMapRuntime;
            logActorPickingDiag('shellInput:handleTap:runtimeResult', {
              tapTraceId,
              rendererAction: summarizeActorPickingAction(action),
              runtimeHandled: summarizeHandledForOperationLog(runtimeHandled),
            });
            global.ClientOperationLog?.record?.(action ? 'input:tapRuntime' : 'input:tapMiss', {
              point: global.ClientOperationLog?.summarizePoint?.(point),
              actionType: action?.type || '',
              action: global.ClientOperationLog?.summarizeAction?.(action),
              runtimeHandled: summarizeHandledForOperationLog(runtimeHandled),
            }, { flush: true });
            if (runtimeHandled) return runtimeHandled;
            if (action?.type === 'selectWorldMarchTarget' && action.background) return false;
            const closed = this.closeWorldSiteHud({ direct: true });
            if (closed) {
              if (event?.preventDefault) event.preventDefault();
              if (event?.stopPropagation) event.stopPropagation();
              return true;
            }
            return false;
          }
          if (action?.disabled) {
            global.ClientOperationLog?.record?.('input:tapDisabled', {
              point: global.ClientOperationLog?.summarizePoint?.(point),
              action: global.ClientOperationLog?.summarizeAction?.(action),
            }, { flush: true });
            if (event?.preventDefault) event.preventDefault();
            if (event?.stopPropagation) event.stopPropagation();
            return true;
          }
          if (!action) {
            const runtimeHandled = this.ensureWorldMapRuntimeCoordinator()?.handleTap(point, event, { tapTraceId }) || false;
            this.observeAsyncActionResult(runtimeHandled);
            this.worldMapRuntime = this.worldMapRuntimeCoordinator?.getMapRuntime?.() || this.worldMapRuntime;
            logActorPickingDiag('shellInput:handleTap:missRuntimeResult', {
              tapTraceId,
              runtimeHandled: summarizeHandledForOperationLog(runtimeHandled),
            });
            global.ClientOperationLog?.record?.('input:tapMiss', {
              point: global.ClientOperationLog?.summarizePoint?.(point),
              runtimeHandled: summarizeHandledForOperationLog(runtimeHandled),
            }, { flush: true });
            if (runtimeHandled) return runtimeHandled;
            const closed = this.closeWorldSiteHud({ direct: true });
            if (closed) {
              if (event?.preventDefault) event.preventDefault();
              if (event?.stopPropagation) event.stopPropagation();
              return true;
            }
            return false;
          }
          if (action.background && action.type !== 'closeWorldSite') {
            const closed = this.closeWorldSiteHud({ direct: true });
            if (closed) {
              if (event?.preventDefault) event.preventDefault();
              if (event?.stopPropagation) event.stopPropagation();
              return true;
            }
          }
          const handled = this.handleAction(action, event, { tapTraceId });
          logActorPickingDiag('shellInput:handleTap:directActionResult', {
            tapTraceId,
            action: summarizeActorPickingAction(action),
            handled: summarizeHandledForOperationLog(handled),
          });
          global.ClientOperationLog?.record?.('input:tapAction', {
            action: global.ClientOperationLog?.summarizeAction?.(action),
            handled: handled && typeof handled.then === 'function' ? 'promise' : Boolean(handled),
          }, { flush: true });
          this.advanceTutorialIntroAfterHandled(handled, action);
          if (handled && event?.preventDefault) event.preventDefault();
          if (handled && event?.stopPropagation) event.stopPropagation();
          return handled;
        }

    handleAction(action, event, meta = {}) {
          const handled = this.dispatchCanvasAction(action, { ...(meta || {}), event }) || false;
          if (action?.type === 'openWorldSite') {
            if (handled && typeof handled.then === 'function') {
              handled.then((value) => {
                if (value !== false) this.syncForwardedLocalAction(action);
              }).catch(() => {});
            } else if (handled) {
              this.syncForwardedLocalAction(action);
            }
          }
          return handled;
        }

    advanceTutorialIntro(action = {}) {
          const controller = this.lastGame?.tutorialIntroOverlay || this.tutorialIntroOverlay || null;
          if (!controller || typeof controller.advanceFromAction !== 'function') return false;
          return controller.advanceFromAction(action);
        }

    advanceTutorialIntroAfterHandled(handled, action = {}) {
          if (handled && typeof handled.then === 'function') {
            handled.then((value) => {
              if (value !== false) this.advanceTutorialIntro(action);
            }).catch((error) => this.actionController?.log?.(error));
            return true;
          }
          return handled ? this.advanceTutorialIntro(action) : false;
        }

    isPointBlockedByTutorialShield(point = {}) {
          if (!this.renderer || typeof this.renderer.getHitTarget !== 'function') return false;
          return this.renderer.getHitTarget(point)?.type === 'blockCanvasModal';
        }

    setInputEnabled(enabled) {
          this.inputEnabled = Boolean(enabled);
          if (!this.inputEnabled && this.tapDisposer) {
            this.tapDisposer();
            this.tapDisposer = null;
          }
          if (!this.inputEnabled && this.dragDisposer) {
            this.dragDisposer();
            this.dragDisposer = null;
          }
          if (!this.inputEnabled && this.gestureDisposer) {
            this.gestureDisposer();
            this.gestureDisposer = null;
          }
          if (!this.inputEnabled && this.pointerMoveDisposer) {
            this.pointerMoveDisposer();
            this.pointerMoveDisposer = null;
          }
          if (this.inputEnabled) this.bindInput();
        }

    getCanvasGameHost() {
          return this.lastGame || null;
        }

    getCanvasActionState() {
          return this.lastGame?.state || {};
        }

    runAction(callback) {
          if (typeof this.lastGame?.runAction === 'function') return this.lastGame.runAction(callback);
          return typeof callback === 'function' ? callback() : null;
        }

    setPendingBuildingAction(pending = null, options = {}) {
          const nextPending = pending && pending.buildingId
            ? {
              buildingId: pending.buildingId,
              action: pending.action === 'upgrade' ? 'upgrade' : 'build',
            }
            : null;
          getUiStateOwner(this).pendingBuildingAction = nextPending;
          if (options.render !== false) this.renderActive();
          return true;
        }

    selectBuildingCategory(action = {}) {
          const owner = getUiStateOwner(this);
          const category = action.category || 'all';
          owner.activeBuildingCategory = category;
          owner.buildingOffset = 0;
          this.buildingTransition = null;
          if (owner !== this) owner.buildingTransition = null;
          return true;
        }

    selectTechNode(action = {}) {
          const techId = action.techId || '';
          getUiStateOwner(this).selectedTechId = techId;
          CanvasModalSnapshotAdapter.openBlockingPanelSnapshot(this, 'techDetailOpen', Boolean(techId));
          if (this.lastGame?.state && typeof this.lastGame.state === 'object') {
            StateWriter.commit(this, (prev) => ({
              ...prev,
              techUiState: {
                ...(prev.techUiState || {}),
                selectedTechId: techId,
                detailOpen: Boolean(techId),
              },
            }), { source: 'shell:selectTechNode' });
          }
          return true;
        }

    closeTechDetail() {
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'techDetailOpen');
          if (this.lastGame?.state && typeof this.lastGame.state === 'object') {
            StateWriter.commit(this, (prev) => ({
              ...prev,
              techUiState: {
                ...(prev.techUiState || {}),
                detailOpen: false,
              },
            }), { source: 'shell:closeTechDetail' });
          }
          return true;
        }

    openFamousPersons() {
          return this.getPanelSurfaceManager?.()?.openPanel?.('famousPersons') !== false;
        }

    closeFamousPersons() {
          this.getPanelSurfaceManager?.()?.closePanel?.('famousPersons');
          const game = this.lastGame || null;
          game?.tutorialController?.onFamousPersonsClosed?.();
          return true;
        }

    openFamousPersonDetail(action = {}) {
          return this.getPanelSurfaceManager?.()?.runPanelAction?.('famousPersons', 'openDetail', action) !== false;
        }

    closeFamousPersonDetail() {
          return this.getPanelSurfaceManager?.()?.runPanelAction?.('famousPersons', 'closeDetail') !== false;
        }

    // getArmyFormation was a divergent copy that read this.lastGame.state; it now lives in
    // ArmyFormationQueries (via host.getState) and the shell inherits CanvasGameApp's
    // delegator -- one implementation for both. See slice 5 of the re-decomposition.

    // The army-formation editor wrappers (setArmyFormationEditor, openArmyFormation,
    // closeArmyFormationEditor, toggleArmyFormationMember, changeArmyFormationPage,
    // changeArmyFormationSoldiers, requestArmyFormationSoldierInput,
    // autoReplenishArmyFormation, saveArmyFormation) were delegate-to-lastGame copies
    // that mirrored the editor blob back onto the shell. The blob is now single-owned
    // by ArmyFormationEditorController on the state host and the shell inherits
    // CanvasGameApp's delegators + the armyFormationEditor accessor -- one
    // implementation, one store, for both. See slice 6 of the re-decomposition.

    enterCity(action = {}) {
          const game = this.lastGame;
          const cityId = action.cityId || action.territoryId || action.siteId || game?.state?.activeCityId || 'capital';
          const tab = action.tab || 'buildings';
          if (typeof game?.enterCity === 'function') return game.enterCity(cityId, { tab });
          CanvasModalSnapshotAdapter.openBlockingPanelSnapshot(this, 'showCityManagement', true);
          getUiStateOwner(this).activeCityManagementTab = tab;
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showSubcityList');
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'activeCommandPanel');
          this.closeEventSnapshot?.();
          this.renderActive();
          return true;
        }

    openCityManagement(action = {}) {
          const tab = action.tab || 'buildings';
          CanvasModalSnapshotAdapter.openBlockingPanelSnapshot(this, 'showCityManagement', true);
          getUiStateOwner(this).activeCityManagementTab = tab;
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showSubcityList');
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'activeCommandPanel');
          this.closeEventSnapshot?.();
          this.renderActive();
          return true;
        }

    closeCityManagement() {
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showCityManagement');
          this.renderActive();
          return true;
        }

    switchCityManagementTab(tab = 'buildings') {
          const allowed = ['buildings', 'people', 'military'];
          getUiStateOwner(this).activeCityManagementTab = allowed.includes(tab) ? tab : 'buildings';
          this.renderActive();
          return true;
        }

    changeFamousPersonsPage(action = {}) {
          return this.getPanelSurfaceManager?.()?.runPanelAction?.('famousPersons', 'changePage', action) !== false;
        }

    resetForCanvasTabSwitch() {
          const owner = getUiStateOwner(this);
          owner.buildingOffset = 0;
          owner.activeBuildingCategory = 'all';
          owner.techTreePanX = 0;
          owner.techTreePanY = 0;
          owner.techTreeZoom = 1;
          owner.selectedTechId = '';
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'techDetailOpen');
          this.techTreeDragStart = null;
          this.buildingTransition = null;
          this.closeEventSnapshot?.();
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showGuidebook');
          this.getPanelSurfaceManager?.()?.closePanel?.('famousPersons', { render: false });
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showCityManagement');
          this.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], soldierAssignments: {}, soldierDraftAssignments: {}, page: 0, saving: false };
          this.closeRewardRevealSnapshot?.();
        }

    resetLocalViewToResources(options = {}) {
          const owner = getUiStateOwner(this);
          const homeView = this.resolveMapHomeViewState(this.lastGame?.state || {}, { requestedTab: 'resources', forceMapHome: true });
          owner.buildingOffset = 0;
          owner.activeBuildingCategory = 'all';
          owner.techTreePanX = 0;
          owner.techTreePanY = 0;
          owner.techTreeZoom = 1;
          owner.selectedTechId = '';
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'techDetailOpen');
          this.techTreeDragStart = null;
          this.pageTransition = null;
          this.buildingTransition = null;
          this.closeEventSnapshot?.();
          TerritoryUiStateStore?.patch?.(this, {
            selectedSiteId: '',
            expeditionConfigSiteId: '',
            expeditionSoldiers: '',
            expeditionTroopType: '',
            expeditionLeader: '',
          });
          this.clearWorldSiteHudSelection?.();
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showResourceDetails');
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showCitySwitcher');
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showSubcityList');
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showCityManagement');
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showAdvisor');
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showTaskCenter');
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showGuidebook');
          this.getPanelSurfaceManager?.()?.closePanel?.('famousPersons', { render: false });
          this.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], soldierAssignments: {}, soldierDraftAssignments: {}, page: 0, saving: false };
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'activeCommandPanel');
          this.activeTaskCenterTab = 'main';
          this.activeGuidebookTab = 'planning';
          const game = this.lastGame;
          if (game?.state && typeof game.state === 'object') {
            StateWriter.commit(this, (prev) => ({
              ...prev,
              currentTab: homeView.activeTab,
              militaryView: homeView.militaryView,
            }), { source: 'shell:resetLocalViewToResources' });
          }
          if (game && 'activeTab' in game) game.activeTab = homeView.activeTab;
          if (game && 'militaryView' in game) game.militaryView = homeView.militaryView;
          if (game && 'mapHomeActive' in game) game.mapHomeActive = homeView.isMapHome;
          if (!options.skipGame && game?.resetLocalViewToResources) {
            game.resetLocalViewToResources({ skipShell: true, skipRender: true });
          }
          if (!options.skipRender) this.renderReadOnly(game?.state, homeView.activeTab);
          return true;
        }

    forwardCanvasAction(action, meta = {}) {
          if (!this.onAction) return undefined;
          const result = this.onAction(action, meta.event, meta);
          const syncAfterAllowed = (value) => {
            const forwarded = value !== false;
            if (forwarded) this.syncForwardedLocalAction(action);
            return forwarded;
          };
          if (result && typeof result.then === 'function') return result.then(syncAfterAllowed);
          return syncAfterAllowed(result);
        }

    syncForwardedLocalAction(action = {}) {
          if (action.type === 'openWorldSite') {
            const siteId = action.siteId || action.territoryId || action.cityId || '';
            if (!siteId) return false;
            const territory = this.lastGame?.territoryController || null;
            if (territory?.openSiteDialog) territory.openSiteDialog(siteId);
            TerritoryUiStateStore?.patch?.(this, { selectedSiteId: siteId });
            this.lastGame?.tutorialController?.refreshCurrentHighlight?.();
            return true;
          }
          return false;
        }

    renderCanvasAction(action = {}) {
          if (this.renderPanelCanvasAction?.(action)) return true;
          this.renderActive();
          return true;
        }

    clearWorldSiteHudSelection() {
          const uiState = TerritoryUiStateStore?.ensure?.(this) || {};
          const changed = Boolean(
            uiState.selectedSiteId
            || uiState.worldMarchTarget
            || uiState.selectedWorldActorId
            || uiState.selectedWorldMissionId
            || uiState.expeditionConfigSiteId
            || uiState.expeditionSoldiers
            || uiState.expeditionTroopType
            || uiState.expeditionLeader
          );
          TerritoryUiStateStore?.clearWorldSelection?.(this, { clearWorldMarchTarget: true });
          const territoryController = this.lastGame?.territoryController || null;
          if (territoryController?.closeSiteDialog) {
            territoryController.closeSiteDialog({ render: false });
          }
          return changed;
        }

    closeWorldSiteHud(options = {}) {
          const changed = this.clearWorldSiteHudSelection();
          if (!changed) return false;
          if (options.render === false) return true;
          if (options.direct || this.isWorldMapDragging()) {
            return this.renderReadOnly(this.lastGame?.state, this.getActiveTab()) !== false;
          }
          return this.renderActive({ invalidateWorldTileView: false }) !== false;
        }

    getCanvasTarget(type, predicate = null) {
          if (!this.renderer || !Array.isArray(this.renderer.hitTargets)) return null;
          let target = null;
          for (let index = this.renderer.hitTargets.length - 1; index >= 0; index -= 1) {
            const item = this.renderer.hitTargets[index];
            if (
              item.action?.type === type
              && (typeof predicate !== 'function' || predicate(item.action))
            ) {
              target = item;
              break;
            }
          }
          if (!target) return null;
          return {
            x: target.x,
            y: target.y,
            width: target.width,
            height: target.height,
            action: target.action,
            getRect: () => ({
              left: target.x,
              top: target.y,
              width: target.width,
              height: target.height,
              right: target.x + target.width,
              bottom: target.y + target.height,
            }),
            getBoundingClientRect: () => ({
              left: target.x,
              top: target.y,
              width: target.width,
              height: target.height,
              right: target.x + target.width,
              bottom: target.y + target.height,
            }),
            scrollIntoView() {},
          };
        }

    getGuideState() {
          return this.lastGame?.state || {};
        }

    getGuideActiveTab() {
          return this.getActiveTab();
        }

    getGuideCanvasTarget(type, predicate = null) {
          return this.getCanvasTarget(type, predicate);
        }

    renderGuideFrame() {
          return this.renderActive();
        }

    // The highlight blob + show/hide/target-refresh lifecycle are single-owned by
    // TutorialGuideUiController on the state host (re-decomposition slice 10); the
    // methods below stay as thin delegators. renderGuideHighlightFrame keeps its
    // body here because it re-points tab/military view state (mode-owned territory).
    refreshTutorialHighlightTarget(highlight = this.tutorialHighlight) {
          return this.getTutorialGuideUiController().refreshTarget(this, highlight);
        }

    renderGuideHighlightFrame(highlight = this.tutorialHighlight) {
          if (highlight?.locator) {
            const refreshed = this.refreshTutorialHighlightTarget(highlight);
            if (!refreshed) {
              this.tutorialHighlight = null;
              return this.renderReadOnly
                ? this.renderReadOnly(this.lastGame?.state, this.getActiveTab())
                : this.renderActive();
            }
            this.tutorialHighlight = refreshed;
            highlight = refreshed;
          }
          const activeTab = highlight?.renderActiveTab || this.getActiveTab();
          const renderOptions = highlight?.renderOptions || null;
          if (highlight?.renderActiveTab) {
            const renderView = this.resolveMapHomeViewState?.(this.lastGame?.state || {}, {
              requestedTab: activeTab,
              militaryView: this.lastGame?.state?.militaryView || this.lastGame?.militaryView,
              ...(renderOptions || {}),
            }) || { activeTab, militaryView: this.lastGame?.state?.militaryView || this.lastGame?.militaryView, isMapHome: false };
            const nextActiveTab = renderView.activeTab || activeTab;
            const nextMilitaryView = nextActiveTab === 'military' ? renderView.militaryView : 'army';
            this.mapHomeActive = Boolean(renderView.isMapHome);
            if (this.lastGame && typeof this.lastGame === 'object') {
              if ('activeTab' in this.lastGame) this.lastGame.activeTab = nextActiveTab;
              if ('militaryView' in this.lastGame && nextMilitaryView) this.lastGame.militaryView = nextMilitaryView;
              if ('mapHomeActive' in this.lastGame) this.lastGame.mapHomeActive = Boolean(renderView.isMapHome);
              if (this.lastGame.state && typeof this.lastGame.state === 'object') {
                StateWriter.commit(this, (prev) => ({
                  ...prev,
                  currentTab: nextActiveTab,
                  ...(nextMilitaryView ? { militaryView: nextMilitaryView } : {}),
                }), { source: 'shellGuideUi:refreshHighlight' });
              }
            }
          }
          if (renderOptions && typeof this.renderReadOnly === 'function') {
            return this.renderReadOnly(this.lastGame?.state, activeTab, renderOptions);
          }
          return this.renderActive();
        }

    switchGuideTab(tabId) {
          if (!tabId) return false;
          if (this.lastGame?.handleCanvasTabSelection) {
            const result = this.lastGame.handleCanvasTabSelection(tabId);
            if (result !== false && this.lastGame?.state && typeof this.lastGame.state === 'object') {
              StateWriter.commit(this, (prev) => ({ ...prev, currentTab: tabId }), { source: 'shellGuideUi:switchGuideTab' });
            }
            return result;
          }
          if (this.onAction) return this.onAction({ type: 'switchTab', tab: tabId, source: 'guideTask' });
          return this.lastGame?.switchTab?.(tabId);
        }

    setGuideMilitaryView(view) {
          if (this.onAction) return this.onAction({ type: 'switchMilitaryView', view: view || 'army' });
          if (this.lastGame?.switchMilitaryView) return this.lastGame.switchMilitaryView(view || 'army');
          if (this.lastGame?.state) StateWriter.commit(this, (prev) => ({ ...prev, militaryView: view || 'army' }), { source: 'shellGuideUi:setGuideMilitaryView' });
          return true;
        }

    showGuideControllerHighlight(target, message) {
          return this.showTutorialHighlight(target, message);
        }

    hideGuideControllerHighlight() {
          return this.hideTutorialHighlight();
        }

    getTutorialTarget() {
          return null;
        }

    getTutorialTargetWithoutScroll() {
          return null;
        }

    refreshTaskCenterGuideHighlight() {
          return false;
        }

    hasClaimableMainTask() {
          return false;
        }

    refreshCurrentGuideHighlight() {
          return false;
        }

    getTargetTab() {
          return null;
        }

    ensureTutorialTargetVisible() {
          return false;
        }

    goToGuideTaskTarget() {
          return false;
        }

    resolveTutorialRect(target) {
          return TutorialGuideUiControllerBase.resolveTutorialRect(target);
        }

    showTutorialHighlight(target, message, options = {}) {
          return this.getTutorialGuideUiController().show(this, target, message, options);
        }

    hideTutorialHighlight() {
          return this.getTutorialGuideUiController().hide(this);
        }

    syncWorldMapRendererLayerMetrics() {
            if (!this.worldMapRenderer) return false;
            const metrics = this.getCanvasLayerMetrics?.('worldMap', null);
            if (!metrics) return false;
            const width = Number(metrics.width) || this.runtime?.width || this.worldMapRenderer.width;
            const height =
              Number(metrics.height) || this.runtime?.height || this.worldMapRenderer.height;
            const padding = Number(metrics.padding) || 0;
            const changed =
              this.worldMapRenderer.width !== width ||
              this.worldMapRenderer.height !== height ||
              this.worldMapRenderer.viewportOffsetX !== padding ||
              this.worldMapRenderer.viewportOffsetY !== padding;
            this.worldMapRenderer.width = width;
            this.worldMapRenderer.height = height;
            this.worldMapRenderer.pixelRatio =
              this.runtime?.pixelRatio || this.worldMapRenderer.pixelRatio;
            this.worldMapRenderer.viewportOffsetX = padding;
            this.worldMapRenderer.viewportOffsetY = padding;
            this.worldMapRenderer.viewportWidth =
              Number(metrics.viewportWidth) || this.runtime?.width || width;
            this.worldMapRenderer.viewportHeight =
              Number(metrics.viewportHeight) || this.runtime?.height || height;
            if (this.worldActorLayerRenderer) {
              const actorMetrics = this.getCanvasLayerMetrics?.('worldActor', metrics) || metrics;
              this.worldActorLayerRenderer.width = Number(actorMetrics.width) || width;
              this.worldActorLayerRenderer.height = Number(actorMetrics.height) || height;
              this.worldActorLayerRenderer.pixelRatio =
                this.runtime?.pixelRatio || this.worldActorLayerRenderer.pixelRatio;
              this.worldActorLayerRenderer.viewportOffsetX = Number(actorMetrics.padding) || padding;
              this.worldActorLayerRenderer.viewportOffsetY = Number(actorMetrics.padding) || padding;
              this.worldActorLayerRenderer.viewportWidth =
                Number(actorMetrics.viewportWidth) || this.worldMapRenderer.viewportWidth;
              this.worldActorLayerRenderer.viewportHeight =
                Number(actorMetrics.viewportHeight) || this.worldMapRenderer.viewportHeight;
              this.syncWorldActorOverlayRendererLinks?.();
            }
            if (this.isFogOfWarEnabled?.() === true && this.worldFogRenderer?.setMetrics) {
              const fogMetrics = this.getCanvasLayerMetrics?.('worldFog', metrics) || metrics;
              this.worldFogRenderer.setMetrics({
                width: Number(fogMetrics.width) || width,
                height: Number(fogMetrics.height) || height,
                pixelRatio: this.runtime?.pixelRatio || this.worldFogRenderer.pixelRatio,
                viewportOffsetX: Number(fogMetrics.padding) || padding,
                viewportOffsetY: Number(fogMetrics.padding) || padding,
                viewportWidth: Number(fogMetrics.viewportWidth) || this.worldMapRenderer.viewportWidth,
                viewportHeight:
                  Number(fogMetrics.viewportHeight) || this.worldMapRenderer.viewportHeight,
              });
            }
            if (changed) this.worldMapRuntime?.invalidateBake?.();
            return true;
          }

    getWorldMapLayerBackingStoreState() {
            const backing = this.getCanvasLayerBackingStoreState?.('worldMap', null);
            if (!backing) return null;
            const metrics = this.getCanvasLayerMetrics?.('worldMap', null) || {};
            return {
              epoch: Number(backing.epoch) || 0,
              reason: backing.reason || '',
              width: Number(backing.width) || 0,
              height: Number(backing.height) || 0,
              pixelRatio: Number(backing.pixelRatio) || Number(this.runtime?.pixelRatio) || 1,
              logicalWidth: Number(metrics.width) || 0,
              logicalHeight: Number(metrics.height) || 0,
            };
          }

    getWorldMapRuntimeBakeState() {
            const runtime =
              this.worldMapRuntimeCoordinator?.getMapRuntime?.() || this.worldMapRuntime || null;
            return runtime?.getBakedLayerState?.() || runtime?.bakedLayerState || null;
          }

    getWorldMapBakedLayerValidity() {
            const runtime =
              this.worldMapRuntimeCoordinator?.getMapRuntime?.() || this.worldMapRuntime || null;
            if (!runtime?.hasBakedMapLayer) return { valid: false, reason: 'notBaked' };
            if (runtime?.mapBakeDirty) return { valid: false, reason: 'mapBakeDirty' };
            const backing = this.getWorldMapLayerBackingStoreState?.() || null;
            if (!backing) return { valid: true, reason: 'noBackingState' };
            const baked = this.getWorldMapRuntimeBakeState?.() || null;
            if (!baked) return { valid: false, reason: 'missingBakedLayerState', backing };
            const sameEpoch = Number(baked.epoch) === Number(backing.epoch);
            const sameWidth = Number(baked.width) === Number(backing.width);
            const sameHeight = Number(baked.height) === Number(backing.height);
            const samePixelRatio = Number(baked.pixelRatio || 1) === Number(backing.pixelRatio || 1);
            const valid = sameEpoch && sameWidth && sameHeight && samePixelRatio;
            return {
              valid,
              reason: valid ? 'valid' : 'backingStoreChanged',
              baked,
              backing,
              checks: {
                sameEpoch,
                sameWidth,
                sameHeight,
                samePixelRatio,
              },
            };
          }

    hasValidBakedWorldMapLayer() {
            const validity = this.getWorldMapBakedLayerValidity?.() || {
              valid: false,
              reason: 'missingValidator',
            };
            this.lastWorldMapBakedLayerValidity = validity;
            return Boolean(validity.valid);
          }

    createFogProjection(context = null, options = {}) {
            const FogProjection =
              EcsModeRuntimeBase?.FogProjection || global.EcsModeRuntime?.FogProjection;
            if (!FogProjection?.createFogProjection || !context) return null;
            const epochNowMs = options.epochNowMs ?? this.getWorldEpochNowMs?.() ?? context.epochNowMs;
            const projection = FogProjection.createFogProjection(
              {
                ...(context || {}),
                config: this.config,
                epochNowMs,
                state: options.state || this.lastGame?.state || this.state || {},
                worldExplorerState:
                  options.worldExplorerState ||
                  this.lastGame?.state?.worldExplorerState ||
                  this.state?.worldExplorerState ||
                  {},
              },
              {
                ...options,
                epochNowMs,
              },
            );
            this.__ecsFogProjection = projection;
            return projection;
          }

    getLastFogProjection() {
            return this.__ecsFogProjection || null;
          }

    // Single canonical accessor for "the last committed world tile-map context".
    // The context supplies GEOMETRY only (tileMapView/viewport/frame); fog and actor
    // FACTS are always projected fresh from (state, worldClock) — never read from here.
    getCanonicalWorldTileMapContext() {
            const runtime =
              this.worldMapRuntimeCoordinator?.getMapRuntime?.() || this.worldMapRuntime;
            return (
              runtime?.getLastTileMapContext?.()
              || runtime?.lastTileMapContext
              || this.getWorldMapRenderState?.()?.lastWorldTileMapContext
              || this.worldMapRenderer?.lastWorldTileMapContext
              || null
            );
          }

    renderWorldFogLayer(context = null, options = {}) {
            const rendered = this.renderWorldFogLayerContent(context, options);
            // Fog draws on an offscreen webgl surface; present it onto the 2d DOM layer canvas
            // in the same synchronous task (preserveDrawingBuffer:false semantics).
            this.runtime?.presentLayer?.('worldFog');
            return rendered;
          }

    renderWorldFogLayerContent(context = null, options = {}) {
            if (this.isFogOfWarEnabled?.() !== true) {
              this.worldFogRenderer?.clear?.();
              return false;
            }
            if (!this.worldFogRenderer?.renderWorldFog) return false;
            if (!context?.tileMapView || !context?.viewport || !context?.frame) {
              this.worldFogRenderer.clear?.();
              return false;
            }
            const projection = this.createFogProjection(context, options);
            const renderContext = projection?.rendererContext || null;
            if (!renderContext) {
              this.worldFogRenderer.clear?.();
              return false;
            }
            this.syncWorldMapRendererLayerMetrics();
            return this.worldFogRenderer.renderWorldFog(renderContext);
          }

    clearWorldMapLayerTransform() {
            const mapCleared = this.clearCanvasLayerTransform?.('worldMap') || false;
            this.clearCanvasLayerTransform?.('worldFog');
            this.clearCanvasLayerTransform?.('worldActor');
            this.clearCanvasLayerTransform?.('worldActorSpine');
            return mapCleared;
          }

    setWorldMapLayerVisible(visible = true) {
            const mapVisible = this.setCanvasLayerVisible?.('worldMap', visible !== false) || false;
            const fogVisible = this.setCanvasLayerVisible?.('worldFog', visible !== false) || false;
            const actorVisible = this.setCanvasLayerVisible?.('worldActor', visible !== false) || false;
            if (visible === false && fogVisible) {
              this.worldFogRenderer?.clear?.();
              this.runtime?.presentLayer?.('worldFog');
            }
            if (visible === false && actorVisible) {
              this.worldActorLayerRenderer?.clearAll?.();
              this.runtime?.presentLayer?.('worldActor');
            }
            return mapVisible;
          }

    renderWorldActorLayer(options = {}) {
            if (
              !this.worldMapRenderer ||
              typeof this.worldMapRenderer.renderWorldMapActorLayer !== 'function'
            )
              return false;
            const state = options.state || this.lastGame?.state;
            if (!state) return false;
            this.syncWorldMapRendererLayerMetrics();
            const runtime = this.worldMapRuntimeCoordinator?.getMapRuntime?.() || this.worldMapRuntime;
            const baseOptions = buildMilitaryRenderOptions(this, runtime, options);
            const { territoryUiState = {} } = baseOptions;
            const rendered = this.worldMapRenderer.renderWorldMapActorLayer(state, {
              ...baseOptions,
              ...options,
              epochNowMs: options.epochNowMs ?? this.getWorldEpochNowMs?.() ?? Date.now(),
              activeTab: 'military',
              isMapHome: true,
              territoryUiState,
              worldMapRuntimeContext:
                options.worldMapRuntimeContext || this.getCanonicalWorldTileMapContext(),
              showFpsOverlay: false,
            });
            if (rendered && runtime?.syncHitTargetsFromRenderer) {
              runtime.syncHitTargetsFromRenderer({
                preserveOnEmpty: options.preserveRuntimeHitTargetsOnEmpty === true,
              });
            }
            this.runtime?.presentLayer?.('worldActor');
            return rendered;
          }

    refreshWorldMapLayerFromSnapshot(options = {}) {
            if (!this.previewEnabled || !this.worldMapRenderer || !this.lastGame?.state) return false;
            if (typeof this.worldMapRenderer.renderWorldMapSnapshotLayer !== 'function') return false;
            this.syncWorldMapRendererLayerMetrics();
            const state = this.lastGame.state;
            const runtime = this.worldMapRuntimeCoordinator?.getMapRuntime?.() || this.worldMapRuntime;
            const baseOptions = buildMilitaryRenderOptions(this, runtime, options);
            const { territoryUiState = {} } = baseOptions;
            const topBarBottom =
              typeof this.renderer?.getTopBarBottom === 'function'
                ? this.renderer.getTopBarBottom(state, { isMapHome: true })
                : 84;
            const epochNowMs = options.epochNowMs ?? this.getWorldEpochNowMs?.() ?? Date.now();
            const rendered = this.worldMapRenderer.renderWorldMapSnapshotLayer(state, {
              ...baseOptions,
              epochNowMs,
              activeTab: 'military',
              isMapHome: true,
              territoryUiState,
              topBarBottom,
              frameless: true,
              preserveOnMiss: options.preserveOnMiss ?? true,
              reuseCachedWorldTileView: true,
              snapshotOnly: true,
              waterTimeMs: options.waterTimeMs ?? this.worldMapDragWaterTimeMs,
              showFpsOverlay: false,
            });
            if (!rendered) return false;
            const frameContext = this.getWorldMapRenderState?.()?.lastWorldTileMapContext
              || this.worldMapRenderer.lastWorldTileMapContext
              || null;
            if (frameContext && runtime) runtime.commitFrameState?.({ lastTileMapContext: frameContext });
            this.renderWorldFogLayer(frameContext, { epochNowMs, state });
            this.renderWorldActorLayer({
              ...options,
              epochNowMs,
              state,
              territoryUiState,
              preserveRuntimeHitTargetsOnEmpty: true,
              worldMapRuntimeContext: frameContext || options.worldMapRuntimeContext || null,
            });
            if (options.commitCamera !== false) runtime?.markBakedCamera?.(runtime.camera);
            if (options.clearTransform !== false) this.clearWorldMapLayerTransform();
            this.runtime?.presentLayer?.('worldMap');
            return true;
          }

    getWorldMapSnapshotRenderOptions(waterTimeMs = this.getFrozenWorldMapWaterTimeMs()) {
            return WorldMapRuntimePolicy.getSnapshotRenderOptions(waterTimeMs, this.getFrozenWorldMapWaterTimeMs());
          }

    getWorldMapLayerPadding() {
            return WorldMapRuntimePolicy.getLayerPadding({
              dragCachePanRange: this.worldMapRenderer?.getWorldTileDragCachePanRange?.()
                || this.renderer?.getWorldTileDragCachePanRange?.()
                || 180,
            });
          }

    getFrozenWorldMapWaterTimeMs() {
            return WorldMapRuntimePolicy.hasNumber(this.worldMapDragWaterTimeMs)
              ? Number(this.worldMapDragWaterTimeMs)
              : this.now();
          }

    isWorldMapDragging() {
            return WorldMapRuntimePolicy.isDragging(this.worldMapDragWaterTimeMs);
          }

    isWorldMapDragCoolingDown() {
            return WorldMapRuntimePolicy.isDragCoolingDown(this.worldMapDragCooldownUntil, this.now());
          }

    getWorldMapDragCooldownMs() {
            return WorldMapRuntimePolicy.getDragCooldownMs(220);
          }

    hasPendingWorldMapCompositeCommit() {
            return false;
          }

    getWorldMapPan() {
            const uiState = TerritoryUiStateStore?.ensure?.(this) || {};
            return WorldMapRuntimePolicy.getWorldMapPan(uiState);
          }

    startWorldMapSnapshotDrag() {
            this.worldMapDragWaterTimeMs = this.now();
            return this.worldMapDragWaterTimeMs;
          }

    finishWorldMapSnapshotDrag() {
            this.worldMapDragCooldownUntil = this.now() + this.getWorldMapDragCooldownMs();
            this.worldMapDragWaterTimeMs = null;
            this.worldMapDragFrameActive = false;
            this.worldMapPinchDragging = false;
            if (this.worldMapRuntime) this.worldMapRuntime.waterTimeMs = null;
            const shouldRender = Boolean(this.deferRenderUntilWorldMapDragEnd);
            this.deferRenderUntilWorldMapDragEnd = false;
            this.updateWorldActorAnimationLoop?.({ force: true });
            return shouldRender ? this.renderActive({ invalidateWorldTileView: false }) : true;
          }

    getWorldMapRuntimeDragOffset() {
            const runtime = this.worldMapRuntimeCoordinator?.getMapRuntime?.() || this.worldMapRuntime;
            return WorldMapRuntimePolicy.getDragOffset(runtime);
          }

    getWorldMapDragTransformLimit() {
            return WorldMapRuntimePolicy.getDragTransformLimit(this.getWorldMapLayerPadding());
          }

    isWorldMapDragTransformNearLimit(offset = this.getWorldMapRuntimeDragOffset()) {
            return WorldMapRuntimePolicy.isDragTransformNearLimit(offset, {
              layerPadding: this.getWorldMapLayerPadding(),
            });
          }

    updateWorldMapDragCompositor() {
            const offset = this.getWorldMapRuntimeDragOffset();
            if (this.isWorldMapDragTransformNearLimit(offset)) {
              if (this.refreshWorldMapLayerFromSnapshot({
                waterTimeMs: this.now(),
                commitCamera: true,
                clearTransform: true,
                preserveOnMiss: true,
              })) return this.getWorldMapRuntimeDragOffset();
            }
            if (this.refreshWorldMapLayerFromSnapshot({
              waterTimeMs: this.now(),
              commitCamera: true,
              clearTransform: true,
              preserveOnMiss: true,
            })) return offset;
            if (
              typeof this.runtime?.ensureLayerCanvas === 'function'
              && !this.getCanvasLayerCanvas?.('worldMap')
            ) {
              this.ensureCanvasLayer?.('worldMap', { padding: this.getWorldMapLayerPadding() });
              this.ensureCanvasLayer?.('worldActor', { padding: this.getWorldMapLayerPadding() });
            }
            this.setCanvasLayerTranslate?.('worldMap', offset.x, offset.y);
            this.setCanvasLayerTranslate?.('worldFog', offset.x, offset.y);
            this.setCanvasLayerTranslate?.('worldActor', offset.x, offset.y);
            this.setCanvasLayerTranslate?.('worldActorSpine', offset.x, offset.y);
            return offset;
          }

    getWorldTileWaterAnimationFrameMs() {
            const fps = Number(this.worldMapRenderer?.getWorldTileWaterAnimationFps?.()
              || this.renderer?.getWorldTileWaterAnimationFps?.()
              || 8);
            return WorldMapRuntimePolicy.getWaterAnimationFrameMs({
              animationFrameMs: this.getAnimationFrameMs(),
              fps,
            });
          }

    renderWorldMapLayerFrame(options = {}) {
            if (!this.previewEnabled || !this.worldMapRenderer || !this.lastGame?.state) return false;
            const frameOptionsBase = {
              ...options,
              epochNowMs: options.epochNowMs ?? this.getWorldEpochNowMs?.() ?? Date.now(),
            };
            const coordinator = this.ensureWorldMapRuntimeCoordinator();
            const runtime = coordinator?.getMapRuntime?.();
            if (this.isWorldMapHomeActive() && coordinator?.canRender(this.lastGame.state)) {
              const snapshotWaterRefresh = WorldMapRuntimePolicy.isSnapshotWaterRefresh(frameOptionsBase);
              if (!snapshotWaterRefresh && !this.shouldRenderRuntimeWorldMap(this.lastGame.state, frameOptionsBase)) return false;
              const runtimeDragging = Boolean(runtime?.isDragging?.());
              const frameOptions = WorldMapRuntimePolicy.resolveRuntimeFrameOptions(frameOptionsBase, {
                runtimeDragging,
                dragFrameActive: this.worldMapDragFrameActive,
                shellDragging: this.isWorldMapDragging(),
                frozenWaterTimeMs: this.getFrozenWorldMapWaterTimeMs(),
              });
              return this.renderRuntimeWorldMap(this.lastGame.state, {
                ...frameOptionsBase,
                ...frameOptions,
              });
            }
            this.syncWorldMapRendererLayerMetrics();
            const now = this.now();
            const frameMs = Math.max(1, this.getAnimationFrameMs() - 1);
            if (!options.force && this.lastWorldMapLayerRenderAt && now - this.lastWorldMapLayerRenderAt < frameMs) return false;
            this.lastWorldMapLayerRenderAt = now;
            const reuseCachedWorldTileView = Boolean(options.reuseCachedWorldTileView || this.worldMapDragFrameActive || this.isWorldMapDragging());
            this.worldMapDragFrameActive = false;
            const waterTimeMs = WorldMapRuntimePolicy.hasNumber(frameOptionsBase.waterTimeMs)
              ? Number(frameOptionsBase.waterTimeMs)
              : (reuseCachedWorldTileView ? this.getFrozenWorldMapWaterTimeMs() : null);
            return this.renderWorldMapLayer(this.lastGame.state, {
              ...frameOptionsBase,
              reuseCachedWorldTileView,
              snapshotOnly: Boolean(frameOptionsBase.snapshotOnly || reuseCachedWorldTileView),
              waterTimeMs,
            });
          }

    requestWorldMapRenderAnimationFrame(options = {}) {
            if (!this.worldMapRenderer) return this.requestRenderAnimationFrame();
            this.worldMapQueuedRenderOptions = {
              ...(this.worldMapQueuedRenderOptions || {}),
              ...options,
            };
            if (this.worldMapLayerRenderQueued) return true;
            const raf = this.getRequestAnimationFrame();
            if (!raf) {
              const queuedOptions = this.worldMapQueuedRenderOptions || {};
              this.worldMapQueuedRenderOptions = null;
              return this.renderWorldMapLayerFrame(queuedOptions);
            }
            this.worldMapLayerRenderQueued = true;
            raf(() => {
              this.worldMapLayerRenderQueued = false;
              const queuedOptions = this.worldMapQueuedRenderOptions || {};
              this.worldMapQueuedRenderOptions = null;
              this.renderWorldMapLayerFrame(queuedOptions);
            });
            return true;
          }

    renderWorldMapLayer(state = this.lastGame?.state, options = null) {
            if (!this.previewEnabled || !this.worldMapRenderer || !state) return false;
            if (this.isWorldMapHomeActive() && this.ensureWorldMapRuntimeCoordinator()?.canRender(state)) {
              return this.renderRuntimeWorldMap(state, options || {});
            }
            this.syncWorldMapRendererLayerMetrics();
            const homeView = this.resolveMapHomeViewState(state, {
              requestedTab: options?.activeTab || this.getActiveTab(),
              militaryView: state.militaryView || this.lastGame?.militaryView,
              forceMapHome: Boolean(this.lastGame?.mapHomeActive || options?.isMapHome),
            });
            this.mapHomeActive = homeView.isMapHome;
            // Single write point + no in-place mutation of the passed state object: when the
            // resolved view differs, route the owned field through StateWriter (or derive a
            // fresh object for a detached snapshot) instead of mutating the caller's input.
            if (homeView.militaryView && state.militaryView !== homeView.militaryView) state = writeOwnedStateField(this, state, 'militaryView', homeView.militaryView, 'shellFrame:renderWorldMapLayer');
            if (homeView.activeTab !== 'military') {
              if (typeof this.worldMapRenderer.clearAll === 'function') {
                this.worldMapRenderer.clearAll();
                this.worldMapRuntime?.invalidateBake?.();
              }
              return false;
            }
            const territoryUiState = options?.territoryUiState
              || TerritoryUiStateStore?.ensure?.(this)
              || {};
            const baseOptions = options || this.buildRenderOptions(homeView.activeTab, territoryUiState);
            const topBarBottom = typeof this.renderer?.getTopBarBottom === 'function'
              ? this.renderer.getTopBarBottom(state, { isMapHome: homeView.isMapHome })
              : 84;
            const rendered = this.worldMapRenderer.renderWorldMapLayer(state, {
              ...baseOptions,
              epochNowMs: baseOptions.epochNowMs ?? Date.now(),
              activeTab: homeView.activeTab,
              isMapHome: homeView.isMapHome,
              territoryUiState,
              topBarBottom,
              reuseCachedWorldTileView: Boolean(options?.reuseCachedWorldTileView),
              snapshotOnly: Boolean(options?.snapshotOnly),
              waterTimeMs: WorldMapRuntimePolicy.hasNumber(options?.waterTimeMs)
                ? Number(options.waterTimeMs)
                : null,
              showFpsOverlay: false,
            });
            if (rendered) this.renderWorldFogLayer(
              this.getWorldMapRenderState?.()?.lastWorldTileMapContext
                || this.worldMapRenderer.lastWorldTileMapContext
                || null,
              {
              epochNowMs: baseOptions.epochNowMs ?? Date.now(),
              state,
              },
            );
            if (rendered) this.lastWorldMapLayerRenderAt = this.now();
            // The map draws on an offscreen surface; composite the world stack so the
            // presentation canvas reflects this frame in the same task.
            this.runtime?.presentLayer?.('worldMap');
            return rendered;
          }

    startTileMapWaterTimer() {
            if (this.tileMapWaterTimer || !this.runtime?.setInterval) return false;
            this.tileMapWaterTimer = this.runtime.setInterval(() => {
              if (this.getActiveTab() !== 'military') {
                this.stopTileMapWaterTimer();
                return;
              }
              if (this.isWorldMapDragging() || this.isWorldMapDragCoolingDown()) return;
              const epochNowMs = this.getWorldEpochNowMs?.() ?? Date.now();
              if (hasActiveWorldExplorerMission(this.lastGame?.state, { epochNowMs })) {
                this.updateWorldActorAnimationLoop?.({ epochNowMs });
                if (!this.worldActorLayerRenderer) {
                  if (this.worldMapRenderer) this.renderWorldMapLayerFrame({ force: true, epochNowMs });
                  else this.renderAnimationFrame();
                }
                return;
              }
              if (this.isWorldMapHomeActive() && !this.shouldRenderRuntimeWorldMap(this.lastGame?.state, {})) {
                this.renderWorldMapLayerFrame({
                  reuseCachedWorldTileView: true,
                  snapshotOnly: true,
                  waterTimeMs: this.now(),
                });
                return;
              }
              if (this.worldMapRenderer) this.renderWorldMapLayerFrame();
              else this.renderAnimationFrame();
            }, this.getWorldTileWaterAnimationFrameMs());
            return true;
          }

    stopTileMapWaterTimer() {
            if (!this.tileMapWaterTimer) return;
            this.runtime?.clearInterval?.(this.tileMapWaterTimer);
            this.tileMapWaterTimer = null;
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
              consumeDragEvent: true,
              getRenderer: () => this.worldMapRenderer,
              getPresenter: () => this.presenter || this.renderer?.presenter,
              getState: () => this.lastGame?.state || {},
              getLayerBackingStoreState: () => this.getWorldMapLayerBackingStoreState?.() || null,
              getBaseUiState: () => TerritoryUiStateStore?.ensure?.(this) || {},
              getLocalUiState: () => TerritoryUiStateStore?.ensure?.(this) || {},
              getTerritoryController: () => this.lastGame?.territoryController || null,
              getTopBarBottom: (state) => (typeof this.renderer?.getTopBarBottom === 'function'
                ? this.renderer.getTopBarBottom(state, { isMapHome: true })
                : 84),
              getRequestedTab: (state = this.lastGame?.state || {}) => this.lastGame?.getActiveTab?.()
                || this.lastGame?.activeTab
                || state.currentTab
                || 'resources',
              getMilitaryView: (state = this.lastGame?.state || {}) => state.militaryView || this.lastGame?.militaryView,
              getForceMapHome: () => Boolean(this.lastGame?.mapHomeActive),
              canRouteTap: (point) => !this.isPointBlockedByTutorialShield(point),
              onAction: (action, event, meta) => {
                const handled = this.handleAction(action, event, meta);
                this.advanceTutorialIntroAfterHandled(handled, action);
                return handled;
              },
              onBeforeRender: () => this.syncWorldMapRendererLayerMetrics(),
              onBeforeDrag: ({ phase, runtime }) => {
                if (phase === 'start') {
                  this.closeWorldSiteHud({ direct: true });
                  const waterTimeMs = this.startWorldMapSnapshotDrag();
                  if (runtime) runtime.waterTimeMs = waterTimeMs;
                }
              },
              onAfterDrag: ({ phase, handled }) => {
                if (handled && phase === 'move') {
                  this.updateWorldMapDragCompositor();
                }
                if (handled && (phase === 'end' || phase === 'cancel')) {
                  this.finishWorldMapSnapshotDrag();
                }
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
            if (coordinator) return coordinator.isMapHomeActive(this.lastGame?.state || {});
            const state = this.lastGame?.state || {};
            const homeView = this.resolveMapHomeViewState(state, {
              requestedTab: this.lastGame?.getActiveTab?.()
                || this.lastGame?.activeTab
                || state.currentTab
                || 'resources',
              militaryView: state.militaryView || this.lastGame?.militaryView,
              forceMapHome: Boolean(this.lastGame?.mapHomeActive),
            });
            return Boolean(homeView.isMapHome && homeView.activeTab === 'military' && homeView.militaryView === 'world');
          }

    canRouteWorldMapRuntimeDrag(point = {}) {
            return Boolean(this.ensureWorldMapRuntimeCoordinator()?.canRouteDrag('start', point, this.lastGame?.state));
          }

    handleWorldMapRuntimeDrag(phase, point = {}, event) {
            const handled = this.ensureWorldMapRuntimeCoordinator()?.handleDrag(phase, point, event) || false;
            this.worldMapRuntime = this.worldMapRuntimeCoordinator?.getMapRuntime?.() || this.worldMapRuntime;
            return handled;
          }

    renderRuntimeWorldMap(state = this.lastGame?.state, options = {}) {
            if (!state) return false;
            const coordinator = this.ensureWorldMapRuntimeCoordinator();
            if (!coordinator) return false;
            if (!options.snapshotOnly) this.clearWorldMapLayerTransform();
            const rendered = coordinator.render(state, options);
            this.worldMapRuntime = coordinator.getMapRuntime();
            if (rendered) this.renderWorldFogLayer(this.getCanonicalWorldTileMapContext(), {
              epochNowMs: options.epochNowMs,
              state,
            });
            this.runtime?.presentLayer?.('worldMap');
            return rendered;
          }

    shouldRenderRuntimeWorldMap(state = this.lastGame?.state, options = {}) {
            const coordinator = this.ensureWorldMapRuntimeCoordinator();
            const runtime = coordinator?.getMapRuntime?.();
            if (!coordinator?.canRender?.(state)) return false;
            if (typeof this.hasValidBakedWorldMapLayer === 'function' && !this.hasValidBakedWorldMapLayer()) return true;
            if (!runtime || typeof runtime.isMapBakeDirty !== 'function') return true;
            return Boolean(options.force || runtime.isMapBakeDirty(state, options));
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
            // Feed the shared FPS meter from the ONLY continuous rAF loop on
            // the map home: its callback cadence IS the live frame rate. The
            // HUD's event-driven renders are too sparse for the meter's 250ms
            // sample window, which left `FPS --` on device while animating.
            this.renderer?.updateFps?.(now);
            const frameMs = Math.max(1, this.getWorldActorAnimationFrameMs() - 1);
            if (!options.force && this.lastWorldActorAnimationRenderAt && now - this.lastWorldActorAnimationRenderAt < frameMs) return false;
            this.lastWorldActorAnimationRenderAt = now;
            const rendered = renderWorldActorLayerFrame(this, options);
            this.renderWorldFogAnimationFrame(now, options);
            return rendered;
          }

    // Fog reveal strength is a continuous function of time. The fog projection derives
    // its FACTS (missions, reveal strength, actors) fresh from (state, worldClock) on
    // every call — the cached tile-map context only supplies geometry. So animating fog
    // is just re-rendering the fog layer at ~8fps; no terrain re-blit, no full stack.
    renderWorldFogAnimationFrame(now = this.now?.() ?? Date.now()) {
            if (this.isFogOfWarEnabled?.() !== true) return false;
            const fogFrameMs = 125;
            if (
              this.lastWorldFogAnimationRenderAt &&
              now - this.lastWorldFogAnimationRenderAt < fogFrameMs
            ) {
              return false;
            }
            if (this.isWorldMapDragging?.()) return false; // drag frames refresh the full stack
            this.lastWorldFogAnimationRenderAt = now;
            const frameContext = this.getCanonicalWorldTileMapContext();
            if (!frameContext) return false;
            return this.renderWorldFogLayer(frameContext, {
              epochNowMs: this.getWorldEpochNowMs?.() ?? now,
              state: this.lastGame?.state,
            });
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

    // now() + getWorldEpochNowMs() were byte-redundant with the base CanvasGameApp
    // versions (App.now === RenderScheduler.now === runtime.now||Date.now; the world
    // epoch chain now includes lastGame.worldClock in WorldClockTimingModule), so the
    // shell inherits both from CanvasGameApp -- one code path, no divergent copy.

    getTabOrder() {
          return ['resources', 'buildings', 'tech', 'events', 'civilization', 'military'];
        }

    getTransitionDurationMs() {
          return 220;
        }

    getAnimationFrameMs() {
          return 16;
        }

    getRequestAnimationFrame() {
          const raf = this.runtime?.requestAnimationFrame || this.scheduler?.requestAnimationFrame;
          const owner = this.runtime?.requestAnimationFrame ? this.runtime : this.scheduler;
          return typeof raf === 'function' ? raf.bind(owner) : null;
        }

    renderAnimationFrame() {
          const now = this.now();
          const frameMs = Math.max(1, this.getAnimationFrameMs() - 1);
          if (this.lastAnimationRenderAt && now - this.lastAnimationRenderAt < frameMs) return false;
          this.lastAnimationRenderAt = now;
          return this.renderActive();
        }

    render(action = {}) {
          if (this.renderPanelCanvasAction?.(action)) return true;
          return this.renderActive();
        }

    renderCanvasSurface(activeTab = null, options = {}) {
          const state = this.lastGame?.state || null;
          if (!state) return false;
          return this.renderReadOnly(state, activeTab || state.currentTab || this.getActiveTab(), options);
        }

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
        }

    requestOverlayRenderFrame() {
          return this.requestRenderAnimationFrame({ type: 'overlayRenderFrame' });
        }

    handleResize(size) {
          if (!this.renderer) return;
          this.renderer.width = size.width;
          this.renderer.height = size.height;
          this.renderer.pixelRatio = size.pixelRatio;
          if (this.worldMapRenderer) {
            this.syncWorldMapRendererLayerMetrics();
          }
          this.renderActive();
        }

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
        }

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
        }

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
        }

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
            panelSurfaceManager: this.getPanelSurfaceManager?.(),
            armyFormationEditor: this.armyFormationEditor,
            worldMapRuntimeContext: this.getCanonicalWorldTileMapContext(),
            activeCommandPanel: panel.activeCommandPanel || '',
            activeDockItemIds: panel.activeDockItemIds,
            showTopBarDebugStats: panel.showTopBarDebugStats === true,
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
        }

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
        }

    renderPanelSurface(state = this.lastGame?.state, activeTab = this.getActiveTab(), options = {}) {
          if (!this.previewEnabled || !this.renderer || !state) return false;
          const renderOptions = {
            ...this.buildRenderOptions(activeTab, options.territoryUiState, options),
            ...options,
            mode: 'hud',
          };
          this.renderer.render(state, renderOptions);
          // hud-mode renders also reset the shared hit-target pool; re-assert
          // any open panel surface before this frame's targets go live.
          this.getPanelSurfaceManager?.()?.syncOpenPanelSurfacesAfterBaseRender?.();
          this.runtime?.compositeStage?.();
          return true;
        }

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
          let runtimeWorldMapRenderedThisFrame = false;
          if (homeView.isMapHome && this.ensureWorldMapRuntimeCoordinator()?.canRender(state)) {
             const hasValidWorldMapLayer = this.hasValidBakedWorldMapLayer?.() !== false;
             const shouldRenderRuntimeMap = this.shouldRenderRuntimeWorldMap(state, renderOptions) || !hasValidWorldMapLayer;
             if (shouldRenderRuntimeMap) {
               worldMapLayerRendered = this.renderRuntimeWorldMap(state, {
                 ...renderOptions,
                 force: renderOptions.force || !hasValidWorldMapLayer,
               }) !== false;
               runtimeWorldMapRenderedThisFrame = worldMapLayerRendered;
             } else {
               worldMapLayerRendered = hasValidWorldMapLayer;
             }
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
               this.getWorldMapRenderState?.()?.lastWorldMapLayerRenderResult || this.lastWorldMapLayerRenderResult || this.worldMapRenderer?.lastWorldMapLayerRenderResult || null,
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
               this.getWorldMapRenderState?.()?.lastWorldMapLayerRenderResult || this.lastWorldMapLayerRenderResult || this.worldMapRenderer?.lastWorldMapLayerRenderResult || null,
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
          const liveWorldMapRuntimeContext = this.getCanonicalWorldTileMapContext();
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
              worldMapRuntimeHitTargets: this.worldMapRuntime?.getHitTargets?.() || [],
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
            if (
              homeView.isMapHome
              && worldMapLayerVisible
              && !runtimeWorldMapRenderedThisFrame
              && typeof this.renderWorldActorLayer === 'function'
              && (state?.worldExplorerState || this.getWorldMapRenderState?.()?.lastMapHomeWorldHudContext || this.worldActorLayerRenderer?.lastMapHomeWorldHudContext)
            ) {
              this.renderWorldActorLayer({
                ...renderOptions,
                state,
                preserveRuntimeHitTargetsOnEmpty: true,
                worldMapRuntimeContext: liveWorldMapRuntimeContext,
              });
            }
            // The full frame just reset the shared hit-target pool to base HUD
            // targets; repaint any open panel surface in the same task so panel
            // targets (and the close-time base snapshot) survive authority
            // refreshes, resizes and reconnect renders.
            this.getPanelSurfaceManager?.()?.syncOpenPanelSurfacesAfterBaseRender?.();
            const waterAnimated = Boolean(territoryUiState.tileMapWaterAnimated
              || this.lastGame?.territoryController?.uiState?.tileMapWaterAnimated
              || this.territoryUiState?.tileMapWaterAnimated);
            const explorerAnimated = hasActiveWorldExplorerMission(state, renderOptions);
            this.updateWorldActorAnimationLoop?.({ ...renderOptions, state });
            if (homeView.activeTab === 'military' && (waterAnimated || (explorerAnimated && !this.worldActorLayerRenderer))) this.startTileMapWaterTimer();
            else this.stopTileMapWaterTimer();
            // Per-frame stage composite: the HUD surface just repainted, and any layer
            // repaint that reached no explicit presentLayer hook (e.g. WorldMapRuntime's
            // self-queued rAF frames) also lands on the visible canvas here. 2d surfaces
            // persist across tasks and webgl layers composite from their present cache, so
            // this is safe outside the painting task.
            this.runtime?.compositeStage?.();
            return true;
          }

    getTabLocks() {
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

    getTechTreePan() {
            const owner = getUiStateOwner(this);
            return {
              x: Number(owner.techTreePanX) || 0,
              y: Number(owner.techTreePanY) || 0,
            };
          }

    setTechTreePan(pan = {}) {
            const owner = getUiStateOwner(this);
            const x = Number(pan.x) || 0;
            const y = Number(pan.y) || 0;
            owner.techTreePanX = x;
            owner.techTreePanY = y;
            return true;
          }

    getTechTreeZoom() {
            return Math.max(0.65, Math.min(1.6, Number(getUiStateOwner(this).techTreeZoom) || 1));
          }

    setTechTreeZoom(zoom = 1) {
            const owner = getUiStateOwner(this);
            const nextZoom = Math.max(0.65, Math.min(1.6, Number(zoom) || 1));
            owner.techTreeZoom = nextZoom;
            return true;
          }

    startTransitionTimer() {
            if (this.transitionTimer || !this.runtime?.setInterval) return false;
            this.transitionTimer = this.runtime.setInterval(() => {
              const now = this.now();
              const duration = this.getTransitionDurationMs();
              const pageDone =
                !this.pageTransition ||
                now - this.pageTransition.startedAt >= (this.pageTransition.durationMs || duration);
              const buildingDone =
                !this.buildingTransition ||
                now - this.buildingTransition.startedAt >=
                  (this.buildingTransition.durationMs || duration);
              if (pageDone) this.pageTransition = null;
              if (buildingDone) {
                this.buildingTransition = null;
                if (this.lastGame && typeof this.lastGame === 'object')
                  this.lastGame.buildingTransition = null;
              }
              if (!this.pageTransition && !this.buildingTransition) this.stopTransitionTimer();
              this.renderAnimationFrame();
            }, this.getAnimationFrameMs());
            return true;
          }

    stopTransitionTimer() {
            if (!this.transitionTimer) return;
            this.runtime?.clearInterval?.(this.transitionTimer);
            this.transitionTimer = null;
          }

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
          }

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
          }

    showFloatingText(text, options = {}) {
          const content = String(text ?? '').trim();
          if (!content) return false;
          const now = this.now();
          this.floatingTexts.unshift({
            id: `${now}:${content}:${this.floatingTexts.length}`,
            text: content,
            color: options.color || '#74d3a0',
            createdAt: now,
            durationMs: options.durationMs || this.floatDurationMs,
          });
          this.floatingTexts = this.floatingTexts.slice(0, 4);
          this.startFloatTimer();
          this.renderActive();
          return true;
        }

    showRewardReveal(reveal) {
          if (!reveal) return false;
          this.openRewardRevealSnapshot?.({ ...reveal, createdAt: this.now() });
          this.tutorialHighlight = null;
          this.startFloatTimer();
          this.renderActive();
          return true;
        }

    closeRewardReveal() {
          const hadReveal = this.isRewardRevealSnapshotOpen?.() === true;
          this.closeRewardRevealSnapshot?.();
          if (hadReveal) {
            this.renderActive();
            this.lastGame?.tutorialController?.refreshCurrentHighlight?.();
          }
          return hadReveal;
        }

    openConfirmDialog(view = {}) {
          const dialog = {
            visible: true,
            kind: view.kind || 'generic',
            source: view.source || '',
            title: view.title || t('shell.confirm.title'),
            message: view.message || '',
            confirmLabel: view.confirmLabel || t('common.confirm'),
            cancelLabel: view.cancelLabel || t('common.cancel'),
            confirmAction: view.confirmAction || null,
            submitting: Boolean(view.submitting),
          };
          this.openConfirmDialogSnapshot?.(dialog, {
            onConfirm: view.onConfirm || null,
            onCancel: view.onCancel || null,
          });
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showSettings');
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showLogs');
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showResourceDetails');
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showCitySwitcher');
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showSubcityList');
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showCityManagement');
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showAdvisor');
          this.getPanelSurfaceManager?.()?.closePanel?.('famousPersons', { render: false });
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'activeCommandPanel');
          this.closeEventSnapshot?.();
          this.renderActive();
          return true;
        }

    openResetConfirm(options = {}) {
          return this.openConfirmDialog({
            kind: 'resetGame',
            source: options.source || '',
            title: t('shell.confirm.resetTitle'),
            message: t('shell.confirm.resetMessage'),
            confirmLabel: t('shell.confirm.resetConfirm'),
            cancelLabel: t('common.cancel'),
          });
        }

    closeConfirmDialog() {
          const hadDialog = this.isConfirmDialogSnapshotOpen?.() === true;
          this.closeConfirmDialogSnapshot?.();
          if (hadDialog) this.renderActive();
          return hadDialog;
        }

    setConfirmDialogSubmitting(isSubmitting) {
          if (!this.isConfirmDialogSnapshotOpen?.()) return false;
          this.updateConfirmDialogSnapshot?.({ submitting: Boolean(isSubmitting) });
          this.renderActive();
          return true;
        }

    getFloatingTextView(now = this.now()) {
          return this.floatingTexts
            .map((effect) => ({
              ...effect,
              progress: Math.max(0, Math.min(1, (now - effect.createdAt) / Math.max(1, effect.durationMs))),
            }))
            .filter((effect) => effect.progress < 1);
        }

    pruneFloatingTexts(now = this.now()) {
          const next = this.floatingTexts.filter((effect) => now - effect.createdAt < effect.durationMs);
          const changed = next.length !== this.floatingTexts.length;
          this.floatingTexts = next;
          return changed;
        }

    startFloatTimer() {
          if (this.effectTimer || !this.runtime?.setInterval) return;
          this.effectTimer = this.runtime.setInterval(() => {
            const changed = this.pruneFloatingTexts();
            const hasHighlight = Boolean(this.tutorialHighlight);
            const hasReveal = this.isRewardRevealSnapshotOpen?.() === true;
            if (!this.floatingTexts.length && !hasHighlight && !hasReveal) {
              this.stopFloatTimer();
            }
            if (changed || this.floatingTexts.length || hasHighlight || hasReveal) {
              this.renderAnimationFrame();
            }
          }, this.getAnimationFrameMs());
          this.floatTimer = this.effectTimer;
        }

    stopFloatTimer() {
          if (!this.effectTimer) return;
          this.runtime?.clearInterval?.(this.effectTimer);
          this.effectTimer = null;
          this.floatTimer = null;
        }

    applyAuthShell(view = {}) {
          this.auth = {
            ...this.auth,
            view: {
              loginPanelVisible: Boolean(view.loginPanelVisible),
              appVisible: view.appVisible !== false,
              message: view.message || '',
            },
          };
          this.renderActive();
        }

    setLoginMessage(message) {
          this.applyAuthShell({
            ...(this.auth.view || {}),
            loginPanelVisible: true,
            appVisible: false,
            message: message || '',
          });
        }

    applyCredentials(view = {}) {
          this.auth = {
            ...this.auth,
            credentials: {
              usernameValue: view.usernameValue || '',
              passwordValue: view.passwordValue || '',
              rememberPasswordChecked: Boolean(view.rememberPasswordChecked),
            },
          };
          this.renderActive();
        }

    readCredentials() {
          const credentials = this.auth.credentials || {};
          return {
            username: String(credentials.usernameValue || '').trim().toLowerCase(),
            password: credentials.passwordValue || '',
            rememberPassword: Boolean(credentials.rememberPasswordChecked),
          };
        }

    showLoading(message = '') {
          this.loading = {
            visible: true,
            percentage: 0,
            message: message || t('shell.loading.defaultMessage'),
          };
          this.renderActive();
          return true;
        }

    updateLoading(progress = {}) {
          if (!this.loading.visible) return false;
          this.loading = {
            ...this.loading,
            percentage: Math.max(0, Math.min(100, Number(progress.percentage) || 0)),
            message: progress.message || this.loading.message,
          };
          this.renderActive();
          return true;
        }

    hideLoading() {
          const hadLoading = Boolean(this.loading.visible);
          this.loading = {
            visible: false,
            percentage: 100,
            message: '',
          };
          if (hadLoading) this.renderActive();
          return hadLoading;
        }

    async preloadAssets(onProgress = null, assetPaths = null) {
          if (!this.renderer || typeof this.renderer.preloadAssets !== 'function') {
            onProgress?.({ total: 0, completed: 0, loaded: 0, failed: 0, percentage: 100 });
            return Promise.resolve({ total: 0, completed: 0, loaded: 0, failed: 0, percentage: 100 });
          }
          const report = typeof onProgress === 'function' ? onProgress : null;
          const result = await this.renderer.preloadAssets(assetPaths || undefined, (progress = {}) => {
            const percentage = Math.round(Math.max(0, Math.min(100, Number(progress.percentage) || 0)) * 0.65);
            report?.({
              ...progress,
              phase: progress.phase || 'assets:download',
              percentage,
              message: progress.message || t('shell.loading.assets'),
            });
          });
          const preloadPaths = assetPaths || this.renderer.getPreloadAssetPaths?.();
          const prewarmRenderer = typeof this.worldMapRenderer?.prewarmWorldTileCachesForLoading === 'function'
            ? this.worldMapRenderer
            : this.renderer;
          await prewarmRenderer?.prewarmWorldTileCachesForLoading?.(preloadPaths, (progress = {}) => {
            const prewarmPercentage = Math.max(0, Math.min(100, Number(progress.percentage) || 0));
            report?.({
              ...progress,
              percentage: Math.min(99, 65 + Math.round(prewarmPercentage * 0.34)),
              message: progress.message || t('shell.loading.worldMapAssets'),
            });
          });
          report?.({
            total: result.total,
            completed: result.completed,
            loaded: result.loaded,
            failed: result.failed,
            percentage: 100,
            phase: 'assets:ready',
            status: 'complete',
            message: t('shell.loading.assetsReady'),
          });
          return result;
        }

    toggleRememberPassword() {
          const credentials = this.auth.credentials || {};
          this.auth = {
            ...this.auth,
            credentials: {
              ...credentials,
              rememberPasswordChecked: !credentials.rememberPasswordChecked,
            },
          };
          this.renderActive();
          return true;
        }

    requestAuthInput(field) {
          if (!this.auth.view?.loginPanelVisible || !this.runtime?.requestTextInput) return false;
          const credentials = this.auth.credentials || {};
          const isPassword = field === 'password';
          Promise.resolve(this.runtime.requestTextInput({
            title: isPassword ? t('shell.auth.inputPasswordTitle') : t('shell.auth.inputUsernameTitle'),
            message: isPassword ? '' : t('shell.auth.inputUsernameMessage'),
            placeholder: isPassword ? t('shell.login.password') : t('shell.login.username'),
            value: isPassword ? '' : (credentials.usernameValue || ''),
            maxLength: isPassword ? 64 : 32,
          })).then((value) => {
            if (value === null || value === undefined || !this.auth.view?.loginPanelVisible) return;
            const nextValue = String(value);
            this.auth = {
              ...this.auth,
              credentials: {
                ...this.auth.credentials,
                [isPassword ? 'passwordValue' : 'usernameValue']: nextValue,
              },
            };
            this.renderActive();
          }).catch(() => {});
          return true;
        }

    openNaming(view = {}) {
          const namingState = { visible: true, view, inputValue: '', submitting: false };
          this.openNamingSnapshot?.(namingState);
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showSettings');
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showLogs');
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showResourceDetails');
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showCitySwitcher');
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showSubcityList');
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showCityManagement');
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'showAdvisor');
          this.getPanelSurfaceManager?.()?.closePanel?.('famousPersons', { render: false });
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, 'activeCommandPanel');
          this.closeEventSnapshot?.();
          this.renderActive();
          return true;
        }

    closeNaming() {
          this.closeNamingSnapshot?.();
          this.renderActive();
          return true;
        }

    getNamingName() {
          return this.getNamingInputValue?.() || '';
        }

    setNamingSubmitting(isSubmitting) {
          const submitting = Boolean(isSubmitting);
          this.updateNamingSnapshot?.({ submitting });
          this.renderActive();
        }

    requestNamingInput() {
          const naming = this.getNamingSnapshot?.() || null;
          if (!naming?.visible) return false;
          const view = naming.view || {};
          const currentValue = naming.inputValue || '';
          if (!this.runtime || typeof this.runtime.requestTextInput !== 'function') return false;
          Promise.resolve(this.runtime.requestTextInput({
            title: view.title || t('shell.naming.title'),
            message: view.message || '',
            placeholder: view.placeholder || '',
            value: currentValue,
            maxLength: view.maxLength || 12,
          })).then((value) => {
            if (value === null || value === undefined || !this.isNamingSnapshotOpen?.()) return;
            const maxLength = Number(view.maxLength) || 12;
            const inputValue = String(value).trim().slice(0, maxLength);
            this.updateNamingSnapshot?.({ inputValue });
            this.renderActive();
            const game = this.getCanvasGameHost?.() || this.lastGame || null;
            const refresh = () => game?.tutorialController?.refreshCurrentHighlight?.();
            if (typeof this.runtime?.setTimeout === 'function') this.runtime.setTimeout(refresh, 0);
            else refresh();
          }).catch(() => {});
          return true;
        }

    setNetworkState(state = {}) {
          const previousStatus = this.networkState?.status || 'online';
          this.networkState = {
            ...(this.networkState || {}),
            ...(state || {}),
          };
          const nextStatus = this.networkState.status || 'online';
          if (previousStatus !== nextStatus || nextStatus === 'reconnecting') {
            this.renderActive({ invalidateWorldTileView: false });
          }
          if (nextStatus === 'reconnecting') this.startNetworkOverlayTimer();
          else this.stopNetworkOverlayTimer();
          return this.networkState;
        }

    startNetworkOverlayTimer() {
          if (this.networkOverlayTimer || !this.runtime?.setInterval) return false;
          this.networkOverlayTimer = this.runtime.setInterval(() => {
            if (this.networkState?.status !== 'reconnecting') {
              this.stopNetworkOverlayTimer();
              return;
            }
            this.renderActive({ invalidateWorldTileView: false });
          }, 160);
          return true;
        }

    stopNetworkOverlayTimer() {
          if (!this.networkOverlayTimer) return false;
          this.runtime?.clearInterval?.(this.networkOverlayTimer);
          this.networkOverlayTimer = null;
          return true;
        }

    // startBattleScene / closeBattleScene were delegate-to-lastGame wrappers; the
    // battle-scene timers are now single-owned by BattleSceneController on the state
    // host and the shell inherits CanvasGameApp's delegators, which resolve to the
    // same controller. See slice 9 of the re-decomposition.

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

static mount(game, options = {}) {
      const RuntimeCtor = options.Runtime || global.H5CanvasRuntime;
      const runtime = options.canvasRuntime
        || (options.runtime?.ensureCanvas ? options.runtime : null)
        || (RuntimeCtor ? new RuntimeCtor(options) : null);
      const shell = new CanvasGameShell({
        runtime,
        config: options.config || game?.config || global.GameConfig,
        renderer: options.renderer,
        presenter: options.presenter,
        loadTrace: options.loadTrace || game?.loadTrace || null,
        previewEnabled: options.previewEnabled,
        inputEnabled: options.inputEnabled,
        onAction: options.onAction,
      });
      const mounted = shell.mount(game);
      return mounted ? shell : null;
    }
  }



  global.CanvasGameShell = CanvasGameShell;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasGameShell;
})(typeof window !== 'undefined' ? window : globalThis);
