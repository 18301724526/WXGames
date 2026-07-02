(function (global) {
  const WorldMarchSystem = (() => {
    if (global.WorldMarchSystem) return global.WorldMarchSystem;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../ecs/system/WorldMarchSystem');
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
  const WorldMapPickingModel = (() => {
    if (global.WorldMapPickingModel) return global.WorldMapPickingModel;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../ecs/input/WorldMapPickingModel');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  const WorldMapInputIntent = (() => {
    if (global.WorldMapInputIntent) return global.WorldMapInputIntent;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../ecs/input/WorldMapInputIntent');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  const WorldMapRuntimeBakePolicy = (() => {
    if (global.WorldMapRuntimeBakePolicy) return global.WorldMapRuntimeBakePolicy;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldMapRuntimeBakePolicy');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  const WorldMapRuntimeCameraPolicy = (() => {
    if (global.WorldMapRuntimeCameraPolicy) return global.WorldMapRuntimeCameraPolicy;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldMapRuntimeCameraPolicy');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  const WorldMapRuntimeInputPolicy = (() => {
    if (global.WorldMapRuntimeInputPolicy) return global.WorldMapRuntimeInputPolicy;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldMapRuntimeInputPolicy');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  const WorldMapRuntimeHitTargetPolicy = (() => {
    if (global.WorldMapRuntimeHitTargetPolicy) return global.WorldMapRuntimeHitTargetPolicy;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldMapRuntimeHitTargetPolicy');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  const WorldMapRuntimeRenderPolicy = (() => {
    if (global.WorldMapRuntimeRenderPolicy) return global.WorldMapRuntimeRenderPolicy;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldMapRuntimeRenderPolicy');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  const WorldMapRuntimeRenderPipeline = (() => {
    if (global.WorldMapRuntimeRenderPipeline) return global.WorldMapRuntimeRenderPipeline;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldMapRuntimeRenderPipeline');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  const WorldMapRuntimeFrameState = (() => {
    if (global.WorldMapRuntimeFrameState) return global.WorldMapRuntimeFrameState;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldMapRuntimeFrameState');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  const WorldMapInputState = (() => {
    if (global.WorldMapInputState) return global.WorldMapInputState;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldMapInputState');
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

  function sanitizeDragOffset(offset = {}) {
    return {
      x: Number(offset.x) || 0,
      y: Number(offset.y) || 0,
    };
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

  function logActorPickingDiag(stage = '', detail = {}, options = {}) {
    return ActorPickingDiagnostics?.log?.(stage, detail, options) || null;
  }

  function summarizeBackgroundTargetProbe(action = null, context = {}, layerPoint = {}) {
    if (!action || action.type !== 'selectWorldMarchTarget') return null;
    const tileMapView = context?.tileMapView || context?.renderSnapshot?.tileMapView || {};
    const viewport = context?.viewport || context?.renderSnapshot?.viewport || {};
    const frame = context?.frame || context?.renderSnapshot?.frame || {};
    const tiles = Array.isArray(tileMapView.tiles) ? tileMapView.tiles : [];
    const targetQ = Number(action.targetQ ?? action.q);
    const targetR = Number(action.targetR ?? action.r);
    const targetTileId = action.tileId || (Number.isFinite(targetQ) && Number.isFinite(targetR) ? global.TileCoord.tileId(targetQ, targetR) : '');
    const targetTile = tiles.find((tile) => {
      const q = Number(tile?.q ?? tile?.x);
      const r = Number(tile?.r ?? tile?.y);
      const id = tile?.tileId || tile?.id || (Number.isFinite(q) && Number.isFinite(r) ? global.TileCoord.tileId(q, r) : '');
      if (targetTileId && id === targetTileId) return true;
      return Number.isFinite(q) && Number.isFinite(r)
        && Number.isFinite(targetQ) && Number.isFinite(targetR)
        && Math.floor(q) === Math.floor(targetQ)
        && Math.floor(r) === Math.floor(targetR);
    }) || null;
    return {
      target: {
        tileId: targetTileId,
        q: Number.isFinite(targetQ) ? Math.floor(targetQ) : null,
        r: Number.isFinite(targetR) ? Math.floor(targetR) : null,
        known: action.known === undefined ? null : Boolean(action.known),
        terrain: action.terrain || '',
        terrainLabel: action.terrainLabel || '',
      },
      targetExists: Boolean(targetTile),
      targetTile: targetTile ? {
        id: targetTile.id || '',
        tileId: targetTile.tileId || targetTile.id || '',
        q: targetTile.q ?? targetTile.x ?? null,
        r: targetTile.r ?? targetTile.y ?? null,
        terrain: targetTile.terrain || '',
        terrainLabel: targetTile.terrainLabel || '',
        visibility: targetTile.visibility || '',
        discovered: targetTile.discovered === false ? false : true,
        visible: targetTile.visible === false ? false : true,
        renderOnly: Boolean(targetTile.renderOnly),
        renderReady: Boolean(targetTile.renderReady),
        siteId: targetTile.siteId || '',
      } : null,
      tileMap: {
        tileCount: tiles.length,
        version: tileMapView.version || 0,
        seed: tileMapView.seed || '',
        origin: tileMapView.origin || tileMapView.worldOrigin || viewport.worldOrigin || null,
      },
      viewport: {
        originX: Number(viewport.originX) || 0,
        originY: Number(viewport.originY) || 0,
        panX: Number(viewport.panX) || 0,
        panY: Number(viewport.panY) || 0,
        scale: Number(viewport.scale) || 0,
      },
      frame: {
        x: Number(frame.x) || 0,
        y: Number(frame.y) || 0,
        width: Number(frame.width) || 0,
        height: Number(frame.height) || 0,
      },
      layerPoint: global.ClientOperationLog?.summarizePoint?.(layerPoint) || layerPoint,
    };
  }

  class WorldMapRuntime {
    constructor(options = {}) {
      this.runtime = options.runtime || null;
      this.renderer = options.renderer || null;
      this.presenter = options.presenter || this.renderer?.presenter || null;
      this.getState = typeof options.getState === 'function' ? options.getState : (() => options.state || {});
      this.getLayerBackingStoreState = typeof options.getLayerBackingStoreState === 'function'
        ? options.getLayerBackingStoreState
        : null;
      this.getBaseUiState = typeof options.getBaseUiState === 'function' ? options.getBaseUiState : (() => options.uiState || {});
      this.getTopBarBottom = typeof options.getTopBarBottom === 'function' ? options.getTopBarBottom : (() => 84);
      this.onAction = typeof options.onAction === 'function' ? options.onAction : null;
      this.onCameraChanged = typeof options.onCameraChanged === 'function' ? options.onCameraChanged : null;
      this.enabled = options.enabled !== false;
      this.camera = WorldMapRuntimeCameraPolicy.createInitialCamera(options);
      this.drag = null;
      this.renderQueued = false;
      this.queuedRenderOptions = null;
      this.worldMapRuntimeFrameState = WorldMapRuntimeFrameState?.createWorldMapRuntimeFrameState
        ? WorldMapRuntimeFrameState.createWorldMapRuntimeFrameState(options.worldMapRuntimeFrameState || {})
        : {
          lastRenderAt: 0,
          lastLayout: null,
          hasBakedMapLayer: false,
          mapBakeDirty: true,
          bakedLayerState: null,
          lastMapDataSignature: '',
          lastTileMapContext: null,
        };
      this.worldMapInputState = WorldMapInputState?.createWorldMapInputState
        ? WorldMapInputState.createWorldMapInputState(options.worldMapInputState || {})
        : {
          hitTargets: [],
          baseHitTargets: [],
          lastHitTargetSync: null,
          hitTargetSyncSequence: 0,
          inputEpoch: 0,
          inputSequence: 0,
          lastPickingSignature: '',
          pickingSnapshot: null,
          lastInputIntent: null,
        };
      this.frameMs = Math.max(1, Number(options.frameMs) || 16);
      this.waterTimeMs = null;
      this.dragLayerOffset = { x: 0, y: 0 };
      this.renderOnDrag = options.renderOnDrag !== false;
      this.bakedCamera = { x: this.camera.x, y: this.camera.y };
    }

    get lastRenderAt() { return Number(this.worldMapRuntimeFrameState?.lastRenderAt) || 0; }
    set lastRenderAt(value) { this.commitFrameState({ lastRenderAt: value }); }
    get lastLayout() { return this.worldMapRuntimeFrameState?.lastLayout || null; }
    set lastLayout(value) { this.commitFrameState({ lastLayout: value || null }); }
    get hasBakedMapLayer() { return Boolean(this.worldMapRuntimeFrameState?.hasBakedMapLayer); }
    set hasBakedMapLayer(value) { this.commitFrameState({ hasBakedMapLayer: value }); }
    get mapBakeDirty() { return this.worldMapRuntimeFrameState?.mapBakeDirty !== false; }
    set mapBakeDirty(value) { this.commitFrameState({ mapBakeDirty: value }); }
    get bakedLayerState() { return this.worldMapRuntimeFrameState?.bakedLayerState || null; }
    set bakedLayerState(value) { this.commitFrameState({ bakedLayerState: value || null }); }
    get lastMapDataSignature() { return this.worldMapRuntimeFrameState?.lastMapDataSignature || ''; }
    set lastMapDataSignature(value) { this.commitFrameState({ lastMapDataSignature: value || '' }); }
    get lastTileMapContext() { return this.worldMapRuntimeFrameState?.lastTileMapContext || null; }
    set lastTileMapContext(value) { this.commitFrameState({ lastTileMapContext: value || null }); }

    commitFrameState(patch = {}) {
      if (!this.worldMapRuntimeFrameState) return null;
      if (WorldMapRuntimeFrameState?.applyWorldMapRuntimeFramePatch) {
        return WorldMapRuntimeFrameState.applyWorldMapRuntimeFramePatch(this.worldMapRuntimeFrameState, patch);
      }
      Object.assign(this.worldMapRuntimeFrameState, patch || {});
      return this.worldMapRuntimeFrameState;
    }

    resetFrameState(patch = {}) {
      this.worldMapRuntimeFrameState = WorldMapRuntimeFrameState?.createWorldMapRuntimeFrameState
        ? WorldMapRuntimeFrameState.createWorldMapRuntimeFrameState(patch)
        : {
          lastRenderAt: Number(patch.lastRenderAt) || 0,
          lastLayout: patch.lastLayout || null,
          hasBakedMapLayer: Boolean(patch.hasBakedMapLayer),
          mapBakeDirty: patch.mapBakeDirty !== false,
          bakedLayerState: patch.bakedLayerState || null,
          lastMapDataSignature: patch.lastMapDataSignature || '',
          lastTileMapContext: patch.lastTileMapContext || null,
        };
      return this.worldMapRuntimeFrameState;
    }

    getHitTargets() {
      if (WorldMapInputState?.getHitTargets) return WorldMapInputState.getHitTargets(this.worldMapInputState);
      if (!Array.isArray(this.worldMapInputState?.hitTargets)) this.worldMapInputState.hitTargets = [];
      return this.worldMapInputState.hitTargets;
    }

    setHitTargets(targets = []) {
      if (WorldMapInputState?.setHitTargets) {
        return WorldMapInputState.setHitTargets(this.worldMapInputState, targets);
      }
      this.worldMapInputState.hitTargets = Array.isArray(targets) ? targets : [];
      return this.worldMapInputState.hitTargets;
    }

    getBaseHitTargets() {
      if (WorldMapInputState?.getBaseHitTargets) return WorldMapInputState.getBaseHitTargets(this.worldMapInputState);
      if (!Array.isArray(this.worldMapInputState?.baseHitTargets)) this.worldMapInputState.baseHitTargets = [];
      return this.worldMapInputState.baseHitTargets;
    }

    setBaseHitTargets(targets = []) {
      if (WorldMapInputState?.setBaseHitTargets) {
        return WorldMapInputState.setBaseHitTargets(this.worldMapInputState, targets);
      }
      this.worldMapInputState.baseHitTargets = Array.isArray(targets) ? targets : [];
      return this.worldMapInputState.baseHitTargets;
    }

    getLastHitTargetSync() {
      return WorldMapInputState?.getLastHitTargetSync
        ? WorldMapInputState.getLastHitTargetSync(this.worldMapInputState)
        : (this.worldMapInputState?.lastHitTargetSync || null);
    }

    getHitTargetSyncSequence() {
      return WorldMapInputState?.getHitTargetSyncSequence
        ? WorldMapInputState.getHitTargetSyncSequence(this.worldMapInputState)
        : (Number(this.worldMapInputState?.hitTargetSyncSequence) || 0);
    }

    setLastInputIntent(intent = null) {
      if (WorldMapInputState?.setLastInputIntent) {
        return WorldMapInputState.setLastInputIntent(this.worldMapInputState, intent);
      }
      this.worldMapInputState.lastInputIntent = intent || null;
      return this.worldMapInputState.lastInputIntent;
    }

    getLastInputIntent() {
      return WorldMapInputState?.getLastInputIntent
        ? WorldMapInputState.getLastInputIntent(this.worldMapInputState)
        : (this.worldMapInputState?.lastInputIntent || null);
    }

    getLastPickingSignature() {
      return WorldMapInputState?.getLastPickingSignature
        ? WorldMapInputState.getLastPickingSignature(this.worldMapInputState)
        : (this.worldMapInputState?.lastPickingSignature || '');
    }

    resetHitTargetState() {
      if (WorldMapInputState?.resetHitTargetState) {
        WorldMapInputState.resetHitTargetState(this.worldMapInputState);
        return true;
      }
      this.setHitTargets([]);
      this.setBaseHitTargets([]);
      this.worldMapInputState.lastHitTargetSync = null;
      this.worldMapInputState.hitTargetSyncSequence = 0;
      return true;
    }

    commitBakedFrame(context = null, options = {}) {
      return this.commitFrameState({
        hasBakedMapLayer: true,
        mapBakeDirty: false,
        ...(Object.prototype.hasOwnProperty.call(options, 'lastLayout')
          ? { lastLayout: options.lastLayout }
          : {}),
        lastTileMapContext: context || null,
      });
    }

    setRenderer(renderer) {
      this.renderer = renderer || null;
      if (!this.presenter && renderer?.presenter) this.presenter = renderer.presenter;
      return this;
    }

    setPresenter(presenter) {
      this.presenter = presenter || null;
      if (this.renderer) this.renderer.presenter = this.presenter;
      return this;
    }

    setEnabled(enabled) {
      this.enabled = Boolean(enabled);
      return this.enabled;
    }

    canRender(state = this.getState()) {
      return Boolean(this.enabled
        && this.renderer
        && typeof this.renderer.renderWorldMapLayer === 'function'
        && this.presenter
        && Array.isArray(state?.territoryState?.worldMap?.tiles)
        && state.territoryState.worldMap.tiles.length > 0);
    }

    getRequestAnimationFrame() {
      const raf = this.runtime?.requestAnimationFrame || this.scheduler?.requestAnimationFrame;
      const owner = this.runtime?.requestAnimationFrame ? this.runtime : this.scheduler;
      return typeof raf === 'function' ? raf.bind(owner) : null;
    }

    now() {
      return this.runtime?.now?.() || Date.now();
    }

    getCameraUiState() {
      const base = this.getBaseUiState?.() || {};
      return WorldMapRuntimeCameraPolicy.createCameraUiState(base, this.camera);
    }

    syncWaterAnimationFlag(uiState = {}) {
      if (!uiState?.tileMapWaterAnimated) return false;
      const base = this.getBaseUiState?.();
      if (base && typeof base === 'object') base.tileMapWaterAnimated = true;
      return true;
    }

    getLayerLayout(state = this.getState(), options = {}) {
      if (!this.renderer || typeof this.renderer.getWorldMapLayerLayout !== 'function') return null;
      const topBarBottom = options.topBarBottom ?? this.getTopBarBottom(state);
      return this.renderer.getWorldMapLayerLayout(state, topBarBottom, {
        ...options,
        isMapHome: true,
      });
    }

    getInputMapRect(state = this.getState()) {
      const layout = this.lastLayout || this.getLayerLayout(state);
      const systemInfo = typeof this.runtime?.getSystemInfo === 'function'
        ? this.runtime.getSystemInfo()
        : {};
      return WorldMapRuntimeInputPolicy.createInputMapRect({
        layout,
        canRender: this.canRender(state),
        topBarBottom: this.getTopBarBottom(state),
        renderer: this.renderer,
        runtime: this.runtime,
        systemInfo,
      });
    }

    isPointInMap(point = {}, state = this.getState()) {
      return WorldMapRuntimeInputPolicy.isPointInMap(point, this.getInputMapRect(state));
    }

    syncCameraFromUi(uiState = this.getBaseUiState?.() || {}) {
      this.camera = WorldMapRuntimeCameraPolicy.syncCameraFromUi(this.camera, uiState);
      return this.camera;
    }

    getMapDataSignature(state = this.getState(), options = {}) {
      return WorldMapRuntimeBakePolicy.getMapDataSignature(state, {
        ...options,
        presenter: this.presenter,
      });
    }

    syncMapDataSignature(state = this.getState(), options = {}) {
      const signature = this.getMapDataSignature(state, options);
      const syncResult = WorldMapRuntimeBakePolicy.getSignatureSyncResult(this.lastMapDataSignature, signature);
      if (!syncResult.changed) {
        return false;
      }
      this.lastMapDataSignature = syncResult.signature;
      if (syncResult.shouldInvalidateBake) {
        this.mapBakeDirty = true;
        if (typeof this.renderer?.invalidateWorldTileCaches === 'function') {
          this.renderer.invalidateWorldTileCaches();
        } else if (typeof this.renderer?.invalidateWorldTileViewCache === 'function') {
          this.renderer.invalidateWorldTileViewCache();
        }
      }
      return syncResult.hadPreviousSignature;
    }

    getCurrentMapDataSignature(state = this.getState(), options = {}) {
      return this.getMapDataSignature(state, options);
    }

    isMapBakeDirty(state = this.getState(), options = {}) {
      if (typeof this.isBakedLayerStateValid === 'function' && !this.isBakedLayerStateValid()) return true;
      return WorldMapRuntimeBakePolicy.isMapBakeDirty({
        hasBakedMapLayer: this.hasBakedMapLayer,
        mapBakeDirty: this.mapBakeDirty,
        lastMapDataSignature: this.lastMapDataSignature,
      }, state, {
        ...options,
        presenter: this.presenter,
      });
    }

    invalidateBake() {
      this.mapBakeDirty = true;
      return true;
    }

    resetWorldState(options = {}) {
      this.drag = null;
      this.renderQueued = false;
      this.queuedRenderOptions = null;
      this.lastLayout = null;
      this.resetHitTargetState();
      this.hasBakedMapLayer = false;
      this.mapBakeDirty = true;
      this.bakedLayerState = null;
      this.lastMapDataSignature = '';
      this.lastTileMapContext = null;
      if (WorldMapInputState?.resetPickingState) {
        WorldMapInputState.resetPickingState(this.worldMapInputState);
      } else {
        this.worldMapInputState.inputEpoch = 0;
        this.worldMapInputState.lastPickingSignature = '';
        this.worldMapInputState.pickingSnapshot = null;
      }
      this.setLastInputIntent(null);
      this.waterTimeMs = null;
      this.dragLayerOffset = { x: 0, y: 0 };
      this.bakedCamera = { x: this.camera.x, y: this.camera.y };
      if (options.resetInputSequence === true) this.worldMapInputState.inputSequence = 0;
      if (options.invalidateRendererCaches !== false) {
        if (typeof this.renderer?.invalidateWorldTileCaches === 'function') {
          this.renderer.invalidateWorldTileCaches();
        } else {
          this.renderer?.invalidateWorldTileViewCache?.();
        }
      }
      return true;
    }

    getCurrentLayerBackingStoreState() {
      const direct = this.getLayerBackingStoreState?.();
      if (direct) return direct;
      const runtimeLayerState = this.runtime?.getLayerBackingStoreState?.('worldMap');
      if (runtimeLayerState) return runtimeLayerState;
      const rendererCanvas = this.renderer?.canvas || this.renderer?.worldMapLayerRenderer?.canvas || null;
      const canvasState = this.runtime?.getCanvasBackingStoreState?.(rendererCanvas) || null;
      if (canvasState) return canvasState;
      if (!rendererCanvas) return null;
      return {
        epoch: Number(rendererCanvas._backingStoreEpoch) || 0,
        reason: rendererCanvas._backingStoreReason || '',
        width: Number(rendererCanvas.width) || 0,
        height: Number(rendererCanvas.height) || 0,
        pixelRatio: Number(rendererCanvas._backingStorePixelRatio || rendererCanvas._pixelRatioOverride) || Number(this.renderer?.pixelRatio) || 1,
      };
    }

    markBakedLayerCommitted(layerState = this.getCurrentLayerBackingStoreState()) {
      if (!layerState) {
        this.bakedLayerState = null;
        return null;
      }
      this.bakedLayerState = {
        epoch: Number(layerState.epoch) || 0,
        reason: layerState.reason || '',
        width: Number(layerState.width) || 0,
        height: Number(layerState.height) || 0,
        pixelRatio: Number(layerState.pixelRatio) || 1,
      };
      return this.bakedLayerState;
    }

    getBakedLayerState() {
      return this.bakedLayerState || null;
    }

    isBakedLayerStateValid(layerState = this.getCurrentLayerBackingStoreState()) {
      if (!this.hasBakedMapLayer || this.mapBakeDirty) return false;
      if (!layerState || !this.bakedLayerState) return true;
      return Number(this.bakedLayerState.epoch) === Number(layerState.epoch)
        && Number(this.bakedLayerState.width) === Number(layerState.width)
        && Number(this.bakedLayerState.height) === Number(layerState.height)
        && Number(this.bakedLayerState.pixelRatio || 1) === Number(layerState.pixelRatio || 1);
    }

    resetCamera(options = {}) {
      this.camera.x = 0;
      this.camera.y = 0;
      this.onCameraChanged?.({ ...this.camera }, options);
      if (options.render !== false) this.requestRender();
      return true;
    }

    setCamera(x, y, options = {}) {
      const next = WorldMapRuntimeCameraPolicy.resolveCameraChange(this.camera, x, y);
      if (!next.changed) return false;
      this.camera = next.camera;
      if (options.source === 'drag' || options.source === 'pinchPan' || options.source === 'resetWorldPan') {
        global.ClientOperationLog?.recordSampled?.('worldMap:camera', options.source || 'camera', {
          camera: global.ClientOperationLog?.summarizeCamera?.(this.camera),
          bakedCamera: global.ClientOperationLog?.summarizeCamera?.(this.bakedCamera),
          render: options.render !== false,
        }, options.source === 'drag' ? 180 : 0);
      }
      this.onCameraChanged?.({ ...this.camera }, options);
      const isDragLike = options.source === 'drag' || options.source === 'pinchPan';
      if (isDragLike && options.render === false) {
        const offset = this.getCameraOffsetFromBaked();
        this.setDragLayerOffset(offset.x, offset.y);
      }
      if (options.render !== false) {
        this.requestRender(isDragLike ? {
          force: true,
          reuseCachedWorldTileView: true,
          snapshotOnly: true,
          waterTimeMs: options.waterTimeMs ?? this.waterTimeMs,
        } : {});
      }
      return true;
    }

    beginDrag(point = {}) {
      if (!this.canRender()) return false;
      if (!this.isPointInMap(point)) return false;
      this.drag = WorldMapRuntimeCameraPolicy.createDragState(point, this.camera);
      global.ClientOperationLog?.record?.('worldMap:dragStart', {
        point: global.ClientOperationLog?.summarizePoint?.(point),
        camera: global.ClientOperationLog?.summarizeCamera?.(this.camera),
        hitTargetCount: this.getHitTargets().length,
      });
      return true;
    }

    moveDrag(point = {}) {
      const next = WorldMapRuntimeCameraPolicy.resolveDragCamera(this.drag, point);
      if (!next.changed) return false;
      return this.setCamera(next.camera.x, next.camera.y, { source: 'drag', render: this.renderOnDrag });
    }

    endDrag(point = {}) {
      if (!WorldMapRuntimeCameraPolicy.canEndDrag(this.drag, point)) return false;
      this.drag = null;
      global.ClientOperationLog?.record?.('worldMap:dragEnd', {
        point: global.ClientOperationLog?.summarizePoint?.(point),
        camera: global.ClientOperationLog?.summarizeCamera?.(this.camera),
        bakedCamera: global.ClientOperationLog?.summarizeCamera?.(this.bakedCamera),
        dragLayerOffset: sanitizeDragOffset(this.dragLayerOffset),
        hitTargetCount: this.getHitTargets().length,
      }, { flush: true });
      return true;
    }

    handleDrag(phase, point = {}) {
      if (phase === 'start') return this.beginDrag(point);
      if (phase === 'move') return this.moveDrag(point);
      if (phase === 'end' || phase === 'cancel') return this.endDrag(point);
      return false;
    }

    isDragging() {
      return Boolean(this.drag);
    }

    getHitTarget(point = {}) {
      if (WorldMapInputActionMap?.getHitTarget) {
        return WorldMapInputActionMap.getHitTarget(point, this.getHitTargets());
      }
      return null;
    }

    dispatchAction(action, event = null, meta = {}) {
      if (!this.onAction) return false;
      const result = this.onAction(action, event, meta);
      if (result && typeof result.then === 'function') return result.then((value) => value !== false);
      return result !== false;
    }

    handleTap(point = {}, event = null, meta = {}) {
      const tapTraceId = meta.tapTraceId || global.__actorPickingDiagActiveTapTraceId || '';
      const context = this.getLastTileMapContext();
      const layerPoint = this.getLayerPointFromHudPoint(point);
      const pickingSnapshot = this.getPickingSnapshot();
      const action = this.resolveTapAction(point, {
        context,
        layerPoint,
        pickingSnapshot,
        tapTraceId,
      });
      const inputIntent = this.createTapIntent(point, action, {
        context,
        layerPoint,
        pickingSnapshot,
      });
      this.setLastInputIntent(inputIntent);
      const actionMeta = { inputIntent, tapTraceId };
      logActorPickingDiag('worldMapRuntime:handleTap', {
        tapTraceId,
        point: global.ClientOperationLog?.summarizePoint?.(point) || point,
        layerPoint: global.ClientOperationLog?.summarizePoint?.(layerPoint) || layerPoint,
        action: summarizeActorPickingAction(action),
        hitTargetCount: this.getHitTargets().length,
        pickingSnapshot: pickingSnapshot ? {
          inputEpoch: pickingSnapshot.inputEpoch || 0,
          signature: pickingSnapshot.signature || '',
          counts: pickingSnapshot.counts || null,
        } : null,
      });
      global.ClientOperationLog?.record?.('worldMap:tapHit', {
        point: global.ClientOperationLog?.summarizePoint?.(point),
        layerPoint: global.ClientOperationLog?.summarizePoint?.(layerPoint),
        action: global.ClientOperationLog?.summarizeAction?.(action),
        inputIntent: global.ClientOperationLog?.summarizeInputIntent?.(inputIntent) || inputIntent,
        hitTargetCount: this.getHitTargets().length,
        dragLayerOffset: sanitizeDragOffset(this.dragLayerOffset),
      });
      if (!action || action.disabled) return false;
      if (action.type === 'worldMapDrag') return false;
      if (action.type === 'selectWorldMarchTarget' && action.background) {
        global.ClientOperationLog?.record?.('worldMap:backgroundTargetProbe', summarizeBackgroundTargetProbe(action, context, layerPoint), { flush: true });
        global.ClientOperationLog?.record?.('worldMap:backgroundTarget', {
          point: global.ClientOperationLog?.summarizePoint?.(point),
          action: global.ClientOperationLog?.summarizeAction?.(action),
          inputIntent: global.ClientOperationLog?.summarizeInputIntent?.(inputIntent) || inputIntent,
        }, { flush: true });
        return this.dispatchAction(action, event, actionMeta);
      }
      if (action.type === 'resetWorldPan') {
        this.resetCamera({ source: 'resetWorldPan', render: !this.onAction });
      }
      return this.dispatchAction(action, event, actionMeta);
    }

    requestRender(options = {}) {
      this.queuedRenderOptions = {
        ...(this.queuedRenderOptions || {}),
        ...options,
      };
      if (this.renderQueued) return true;
      const raf = this.getRequestAnimationFrame();
      if (!raf) {
        const queuedOptions = this.queuedRenderOptions || {};
        this.queuedRenderOptions = null;
        return this.render(queuedOptions);
      }
      this.renderQueued = true;
      raf(() => {
        this.renderQueued = false;
        const queuedOptions = this.queuedRenderOptions || {};
        this.queuedRenderOptions = null;
        this.render(queuedOptions);
      });
      return true;
    }

    setDragLayerOffset(x = 0, y = 0) {
      this.dragLayerOffset = WorldMapRuntimeCameraPolicy.normalizeDragLayerOffset(x, y);
      this.setHitTargets(this.getOffsetHitTargets());
      return this.dragLayerOffset;
    }

    clearDragLayerOffset() {
      return this.setDragLayerOffset(0, 0);
    }

    getCameraOffsetFromBaked() {
      return WorldMapRuntimeCameraPolicy.getCameraOffsetFromBaked(this.camera, this.bakedCamera);
    }

    markBakedCamera(camera = this.camera) {
      this.bakedCamera = {
        x: WorldMapRuntimeCameraPolicy.normalizeCameraAxis(camera?.x),
        y: WorldMapRuntimeCameraPolicy.normalizeCameraAxis(camera?.y),
      };
      this.clearDragLayerOffset();
      return this.bakedCamera;
    }

    getOffsetHitTargets() {
      return WorldMapRuntimeCameraPolicy.applyOffsetToHitTargets(this.getBaseHitTargets(), this.dragLayerOffset);
    }

    resolveTapAction(point = {}, options = {}) {
      const context = options.context || this.getLastTileMapContext();
      const normalizedPoint = options.layerPoint || this.getLayerPointFromHudPoint(point);
      if (WorldMapInputActionMap?.resolveTapAction) {
        const action = WorldMapInputActionMap.resolveTapAction(point, {
          hitTargets: this.getHitTargets(),
          backgroundPoint: normalizedPoint,
          context,
        pickingSnapshot: options.pickingSnapshot || this.getPickingSnapshot(),
          tapTraceId: options.tapTraceId || global.__actorPickingDiagActiveTapTraceId || '',
        });
        if (action) return action;
      }
      return null;
    }

    createTapIntent(point = {}, action = null, options = {}) {
      if (!WorldMapInputIntent?.createTapIntent) return null;
      const clientSequence = WorldMapInputState?.nextInputSequence
        ? WorldMapInputState.nextInputSequence(this.worldMapInputState)
        : ((this.worldMapInputState.inputSequence = (Number(this.worldMapInputState.inputSequence) || 0) + 1));
      return WorldMapInputIntent.createTapIntent({
        source: 'worldMapRuntime',
        clientSequence,
        physicalPoint: point,
        layerPoint: options.layerPoint || this.getLayerPointFromHudPoint(point),
        action,
        pickingSnapshot: options.pickingSnapshot || this.getPickingSnapshot(),
        context: options.context || this.getLastTileMapContext(),
        camera: this.camera,
        diagnostics: {
          hitTargetCount: this.getHitTargets().length,
          dragLayerOffset: sanitizeDragOffset(this.dragLayerOffset),
        },
      });
    }

    getPickingSnapshot() {
      const context = this.getPickingContext();
      if (!context || !WorldMapPickingModel?.buildSignature || !WorldMapPickingModel?.createSnapshot) {
        if (WorldMapInputState?.clearPickingSnapshot) {
          WorldMapInputState.clearPickingSnapshot(this.worldMapInputState);
        } else {
          this.worldMapInputState.lastPickingSignature = '';
          this.worldMapInputState.pickingSnapshot = null;
        }
        return null;
      }
      const signature = WorldMapPickingModel.buildSignature(context);
      const previousSnapshot = WorldMapInputState?.getPickingSnapshot
        ? WorldMapInputState.getPickingSnapshot(this.worldMapInputState)
        : (this.worldMapInputState.pickingSnapshot || null);
      if (previousSnapshot && signature === this.getLastPickingSignature()) return previousSnapshot;
      const inputEpoch = WorldMapInputState?.nextInputEpoch
        ? WorldMapInputState.nextInputEpoch(this.worldMapInputState)
        : ((this.worldMapInputState.inputEpoch = (Number(this.worldMapInputState.inputEpoch) || 0) + 1));
      const snapshot = WorldMapPickingModel.createSnapshot(context, {
        inputEpoch,
        signature,
      });
      if (WorldMapInputState?.setPickingSnapshot) {
        return WorldMapInputState.setPickingSnapshot(this.worldMapInputState, signature, snapshot);
      }
      this.worldMapInputState.lastPickingSignature = signature;
      this.worldMapInputState.pickingSnapshot = snapshot;
      return snapshot;
    }

    syncHitTargetsFromRenderer(options = {}) {
      const viewportOffsetX = Number(this.renderer?.viewportOffsetX) || 0;
      const viewportOffsetY = Number(this.renderer?.viewportOffsetY) || 0;
      const rendererTargetGroups = WorldMapRuntimeHitTargetPolicy?.collectRendererHitTargetGroups
        ? WorldMapRuntimeHitTargetPolicy.collectRendererHitTargetGroups(this.renderer)
        : {
          mapTargets: Array.isArray(this.renderer?.hitTargets) ? this.renderer.hitTargets : [],
          actorTargets: Array.isArray(this.renderer?.worldActorLayerRenderer?.hitTargets)
            ? this.renderer.worldActorLayerRenderer.hitTargets
            : [],
        };
      const normalizeTargets = (targets) => (WorldMapInputActionMap?.normalizeHitTargets
        ? WorldMapInputActionMap.normalizeHitTargets(targets, {
          offsetX: -viewportOffsetX,
          offsetY: -viewportOffsetY,
        })
        : []);
      const mapTargets = normalizeTargets(rendererTargetGroups.mapTargets);
      const actorTargets = normalizeTargets(rendererTargetGroups.actorTargets);
      const sourceTargets = [
        ...mapTargets,
        ...actorTargets,
      ];
      const resolvedTargets = WorldMapRuntimeHitTargetPolicy?.resolveBaseHitTargets
        ? WorldMapRuntimeHitTargetPolicy.resolveBaseHitTargets({
          preserveOnEmpty: options.preserveOnEmpty,
          actorTargets,
          mapTargets,
          previousBaseHitTargets: this.getBaseHitTargets(),
          sourceTargets,
        })
        : { preserved: false, targets: sourceTargets };
      const baseHitTargets = resolvedTargets.targets;
      const hitTargets = WorldMapRuntimeCameraPolicy.applyOffsetToHitTargets(baseHitTargets, this.dragLayerOffset);
      const committed = WorldMapInputState?.commitHitTargetSync
        ? WorldMapInputState.commitHitTargetSync(this.worldMapInputState, {
          actorTargetCount: actorTargets.length,
          baseHitTargets,
          hitTargets,
          mapTargetCount: mapTargets.length,
          preserved: Boolean(resolvedTargets.preserved),
          sourceHitTargetCount: sourceTargets.length,
          viewportOffsetX,
          viewportOffsetY,
        })
        : null;
      if (!committed) {
        this.setBaseHitTargets(baseHitTargets);
        this.setHitTargets(hitTargets);
        this.worldMapInputState.hitTargetSyncSequence = this.getHitTargetSyncSequence() + 1;
        this.worldMapInputState.lastHitTargetSync = {
          actorTargetCount: actorTargets.length,
          baseHitTargetCount: baseHitTargets.length,
          hitTargetCount: hitTargets.length,
          mapTargetCount: mapTargets.length,
          preserved: Boolean(resolvedTargets.preserved),
          sequence: this.getHitTargetSyncSequence(),
          sourceHitTargetCount: sourceTargets.length,
          viewportOffsetX,
          viewportOffsetY,
        };
      }
      const sync = this.getLastHitTargetSync();
      global.ClientOperationLog?.recordSampled?.('worldMap:hitTargetsSynced', 'hitTargets', {
        baseHitTargetCount: Number(sync?.baseHitTargetCount) || this.getBaseHitTargets().length,
        hitTargetCount: Number(sync?.hitTargetCount) || this.getHitTargets().length,
        sourceHitTargetCount: sourceTargets.length,
        mapTargetCount: mapTargets.length,
        preserved: Boolean(resolvedTargets.preserved),
        actorTargetCount: actorTargets.length,
        viewportOffsetX,
        viewportOffsetY,
        dragLayerOffset: sanitizeDragOffset(this.dragLayerOffset),
      }, 500);
      return this.getHitTargets();
    }

    getWorldMapFrameState(options = {}) {
      if (WorldMapRuntimeRenderPolicy?.createWorldMapFrameState) {
        return WorldMapRuntimeRenderPolicy.createWorldMapFrameState(this, options);
      }
      const lastHitTargetSync = this.getLastHitTargetSync();
      return {
        context: this.getLastTileMapContext(),
        hitTargetCount: this.getHitTargets().length,
        hitTargets: this.getHitTargets(),
        hitTargetsFresh: !lastHitTargetSync?.preserved,
        hitTargetsPreserved: Boolean(lastHitTargetSync?.preserved),
        visualLayerValid: this.isBakedLayerStateValid(),
      };
    }

    getLastTileMapContext() {
      return this.lastTileMapContext
        || this.renderer?.worldMapRenderState?.lastWorldTileMapContext
        || this.renderer?.lastWorldTileMapContext
        || this.renderer?.worldMapRenderer?.lastWorldTileMapContext
        || this.renderer?.worldMapLayerRenderer?.lastWorldTileMapContext
        || null;
    }

    getLastActorLayerContext() {
      return this.renderer?.worldMapRenderState?.lastMapHomeWorldHudContext
        || this.renderer?.lastMapHomeWorldHudContext
        || this.renderer?.worldMapRenderer?.lastMapHomeWorldHudContext
        || this.renderer?.worldMapLayerRenderer?.lastMapHomeWorldHudContext
        || this.renderer?.worldActorLayerRenderer?.lastMapHomeWorldHudContext
        || this.renderer?.worldActorLayerRenderer?.lastWorldTileMapContext
        || null;
    }

    isActorLayerContextAligned(mapContext = null, actorContext = null) {
      if (!mapContext || !actorContext) return false;
      return Boolean(
        (actorContext.tileMapView && actorContext.tileMapView === mapContext.tileMapView)
        || (actorContext.renderSnapshot && actorContext.renderSnapshot === mapContext.renderSnapshot)
        || (actorContext.viewport && actorContext.viewport === mapContext.viewport)
      );
    }

    getPickingContext() {
      const mapContext = this.getLastTileMapContext();
      const actorContext = this.getLastActorLayerContext();
      const actors = Array.isArray(actorContext?.actors) ? actorContext.actors : null;
      if (!mapContext || !actors || actors.length === 0 || !this.isActorLayerContextAligned(mapContext, actorContext)) {
        return mapContext;
      }
      return {
        ...mapContext,
        actors,
      };
    }

    getLayerPointFromHudPoint(point = {}) {
      const offsetX = Number(this.renderer?.viewportOffsetX) || 0;
      const offsetY = Number(this.renderer?.viewportOffsetY) || 0;
      const dragOffset = this.dragLayerOffset || {};
      return {
        ...point,
        x: Number(point.x) + offsetX - (Number(dragOffset.x) || 0),
        y: Number(point.y) + offsetY - (Number(dragOffset.y) || 0),
      };
    }

    getBackgroundMarchTargetAction(point = {}) {
      const context = this.getLastTileMapContext();
      const normalizedPoint = this.getLayerPointFromHudPoint(point);
      if (WorldMapInputActionMap?.getBackgroundMarchTargetAction) {
        return WorldMapInputActionMap.getBackgroundMarchTargetAction(normalizedPoint, context, {
          screenPointToAxialTile: WorldMarchSystem?.screenPointToAxialTile,
        });
      }
      return null;
    }

    render(options = {}) {
      return WorldMapRuntimeRenderPipeline.render(this, options);
    }
  }

  global.WorldMapRuntime = WorldMapRuntime;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapRuntime;
})(typeof window !== 'undefined' ? window : globalThis);
