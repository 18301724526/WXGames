(function (global) {
  const WorldMarchSystem = (() => {
    if (global.WorldMarchSystem) return global.WorldMarchSystem;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../domain/WorldMarchSystem');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();
  const WorldMapInputActionMap = (() => {
    if (global.WorldMapInputActionMap) return global.WorldMapInputActionMap;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../domain/WorldMapInputActionMap');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();
  const WorldMapPickingModel = (() => {
    if (global.WorldMapPickingModel) return global.WorldMapPickingModel;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../domain/WorldMapPickingModel');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();
  const WorldMapInputIntent = (() => {
    if (global.WorldMapInputIntent) return global.WorldMapInputIntent;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../domain/WorldMapInputIntent');
      } catch (error) {
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
      } catch (error) {
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
      } catch (error) {
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
      } catch (error) {
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
      } catch (error) {
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
      } catch (error) {
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
      this.lastRenderAt = 0;
      this.lastLayout = null;
      this.hitTargets = [];
      this.frameMs = Math.max(1, Number(options.frameMs) || 16);
      this.waterTimeMs = null;
      this.dragLayerOffset = { x: 0, y: 0 };
      this.renderOnDrag = options.renderOnDrag !== false;
      this.bakedCamera = { x: this.camera.x, y: this.camera.y };
      this.baseHitTargets = [];
      this.hasBakedMapLayer = false;
      this.mapBakeDirty = true;
      this.bakedLayerState = null;
      this.lastMapDataSignature = '';
      this.lastTileMapContext = null;
      this.inputEpoch = 0;
      this.inputSequence = 0;
      this.lastPickingSignature = '';
      this.pickingSnapshot = null;
      this.lastInputIntent = null;
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
      const raf = this.runtime?.requestAnimationFrame || global.requestAnimationFrame;
      return typeof raf === 'function' ? raf.bind(this.runtime || global) : null;
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
        global.WorldMarchTrace?.logDedup?.('runtime:signature:unchanged', [
          signature.length,
          state?.worldExplorerState?.activeMission?.id || '',
          state?.worldExplorerState?.activeMission?.status || '',
          (state?.worldExplorerState?.activeMission?.revealedTileIds || []).length,
          Math.floor(Number(options.epochNowMs || Date.now()) / 10000),
        ].join('|'), {
          signatureLength: signature.length,
          activeMission: global.WorldMarchTrace?.summarizeMission?.(state?.worldExplorerState?.activeMission),
          mapBakeDirty: this.mapBakeDirty,
          hasBakedMapLayer: this.hasBakedMapLayer,
        });
        return false;
      }
      global.WorldMarchTrace?.log?.('runtime:signature:changed', {
        hadPreviousSignature: syncResult.hadPreviousSignature,
        previousLength: this.lastMapDataSignature.length,
        nextLength: signature.length,
        activeMission: global.WorldMarchTrace?.summarizeMission?.(state?.worldExplorerState?.activeMission),
      });
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
        hitTargetCount: this.hitTargets.length,
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
        hitTargetCount: this.hitTargets.length,
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
        return WorldMapInputActionMap.getHitTarget(point, this.hitTargets);
      }
      return null;
    }

    dispatchAction(action, event = null, meta = {}) {
      if (!this.onAction) return false;
      const result = this.onAction(action, event, meta);
      if (result && typeof result.then === 'function') return result.then((value) => value !== false);
      return result !== false;
    }

    handleTap(point = {}, event = null) {
      const context = this.getLastTileMapContext();
      const layerPoint = this.getLayerPointFromHudPoint(point);
      const pickingSnapshot = this.getPickingSnapshot();
      const action = this.resolveTapAction(point, {
        context,
        layerPoint,
        pickingSnapshot,
      });
      const inputIntent = this.createTapIntent(point, action, {
        context,
        layerPoint,
        pickingSnapshot,
      });
      this.lastInputIntent = inputIntent;
      const actionMeta = { inputIntent };
      global.ClientOperationLog?.record?.('worldMap:tapHit', {
        point: global.ClientOperationLog?.summarizePoint?.(point),
        layerPoint: global.ClientOperationLog?.summarizePoint?.(layerPoint),
        action: global.ClientOperationLog?.summarizeAction?.(action),
        inputIntent: global.ClientOperationLog?.summarizeInputIntent?.(inputIntent) || inputIntent,
        hitTargetCount: this.hitTargets.length,
        dragLayerOffset: sanitizeDragOffset(this.dragLayerOffset),
      });
      if (!action || action.disabled) return false;
      if (action.type === 'worldMapDrag') return false;
      if (action.type === 'selectWorldMarchTarget' && action.background) {
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
      this.hitTargets = this.getOffsetHitTargets();
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
        x: WorldMapRuntimeCameraPolicy.toLegacyAxis(camera?.x),
        y: WorldMapRuntimeCameraPolicy.toLegacyAxis(camera?.y),
      };
      this.clearDragLayerOffset();
      return this.bakedCamera;
    }

    getOffsetHitTargets() {
      return WorldMapRuntimeCameraPolicy.applyOffsetToHitTargets(this.baseHitTargets, this.dragLayerOffset);
    }

    resolveTapAction(point = {}, options = {}) {
      const context = options.context || this.getLastTileMapContext();
      const normalizedPoint = options.layerPoint || this.getLayerPointFromHudPoint(point);
      if (WorldMapInputActionMap?.resolveTapAction) {
        const action = WorldMapInputActionMap.resolveTapAction(point, {
          hitTargets: this.hitTargets,
          backgroundPoint: normalizedPoint,
          context,
          pickingSnapshot: options.pickingSnapshot || this.getPickingSnapshot(),
        });
        if (action) return action;
      }
      return null;
    }

    createTapIntent(point = {}, action = null, options = {}) {
      if (!WorldMapInputIntent?.createTapIntent) return null;
      this.inputSequence += 1;
      return WorldMapInputIntent.createTapIntent({
        source: 'worldMapRuntime',
        clientSequence: this.inputSequence,
        physicalPoint: point,
        layerPoint: options.layerPoint || this.getLayerPointFromHudPoint(point),
        action,
        pickingSnapshot: options.pickingSnapshot || this.getPickingSnapshot(),
        context: options.context || this.getLastTileMapContext(),
        camera: this.camera,
        diagnostics: {
          hitTargetCount: this.hitTargets.length,
          dragLayerOffset: sanitizeDragOffset(this.dragLayerOffset),
        },
      });
    }

    getPickingSnapshot() {
      const context = this.getLastTileMapContext();
      if (!context || !WorldMapPickingModel?.buildSignature || !WorldMapPickingModel?.createSnapshot) {
        this.lastPickingSignature = '';
        this.pickingSnapshot = null;
        return null;
      }
      const signature = WorldMapPickingModel.buildSignature(context);
      if (this.pickingSnapshot && signature === this.lastPickingSignature) return this.pickingSnapshot;
      this.inputEpoch += 1;
      this.lastPickingSignature = signature;
      this.pickingSnapshot = WorldMapPickingModel.createSnapshot(context, {
        inputEpoch: this.inputEpoch,
        signature,
      });
      return this.pickingSnapshot;
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
          previousBaseHitTargets: this.baseHitTargets,
          sourceTargets,
        })
        : { preserved: false, targets: sourceTargets };
      this.baseHitTargets = resolvedTargets.targets;
      this.hitTargets = this.getOffsetHitTargets();
      global.ClientOperationLog?.recordSampled?.('worldMap:hitTargetsSynced', 'hitTargets', {
        baseHitTargetCount: this.baseHitTargets.length,
        hitTargetCount: this.hitTargets.length,
        sourceHitTargetCount: sourceTargets.length,
        mapTargetCount: mapTargets.length,
        preserved: Boolean(resolvedTargets.preserved),
        actorTargetCount: actorTargets.length,
        viewportOffsetX,
        viewportOffsetY,
        dragLayerOffset: sanitizeDragOffset(this.dragLayerOffset),
      }, 500);
      return this.hitTargets;
    }

    getLastTileMapContext() {
      return this.lastTileMapContext
        || this.renderer?.lastWorldTileMapContext
        || this.renderer?.worldMapRenderer?.lastWorldTileMapContext
        || this.renderer?.worldMapLayerRenderer?.lastWorldTileMapContext
        || null;
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
