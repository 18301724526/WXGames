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

  class WorldMapRuntime {
    constructor(options = {}) {
      this.runtime = options.runtime || null;
      this.renderer = options.renderer || null;
      this.presenter = options.presenter || this.renderer?.presenter || null;
      this.getState = typeof options.getState === 'function' ? options.getState : (() => options.state || {});
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
      this.lastMapDataSignature = '';
      this.lastTileMapContext = null;
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

    handleTap(point = {}, event = null) {
      const action = this.getHitTarget(point);
      if (!action || action.disabled) return false;
      if (action.type === 'worldMapDrag') {
        const inferredAction = this.getBackgroundMarchTargetAction(point);
        if (!inferredAction) return false;
        if (this.onAction) return this.onAction(inferredAction, event) !== false;
        return false;
      }
      if (action.type === 'selectWorldMarchTarget' && action.background) {
        const inferredAction = this.getBackgroundMarchTargetAction(point) || action;
        if (this.onAction) return this.onAction(inferredAction, event) !== false;
        return false;
      }
      if (action.type === 'resetWorldPan') {
        this.resetCamera({ source: 'resetWorldPan', render: !this.onAction });
      }
      if (this.onAction) return this.onAction(action, event) !== false;
      return false;
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

    syncHitTargetsFromRenderer() {
      const viewportOffsetX = Number(this.renderer?.viewportOffsetX) || 0;
      const viewportOffsetY = Number(this.renderer?.viewportOffsetY) || 0;
      const actorTargets = this.renderer?.worldActorLayerRenderer?.hitTargets || [];
      const sourceTargets = [
        ...(Array.isArray(this.renderer?.hitTargets) ? this.renderer.hitTargets : []),
        ...(Array.isArray(actorTargets) ? actorTargets : []),
      ];
      this.baseHitTargets = WorldMapInputActionMap?.normalizeHitTargets
        ? WorldMapInputActionMap.normalizeHitTargets(sourceTargets, {
          offsetX: -viewportOffsetX,
          offsetY: -viewportOffsetY,
        })
        : [];
      this.hitTargets = this.getOffsetHitTargets();
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
