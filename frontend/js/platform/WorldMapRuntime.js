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
      this.camera = {
        x: Number(options.camera?.x) || Number(options.initialPanX) || 0,
        y: Number(options.camera?.y) || Number(options.initialPanY) || 0,
      };
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
      return {
        ...base,
        worldPanX: this.camera.x,
        worldPanY: this.camera.y,
      };
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
      if (!layout?.map && !layout?.world && !layout?.panel && !this.canRender(state)) return null;
      const systemInfo = typeof this.runtime?.getSystemInfo === 'function'
        ? this.runtime.getSystemInfo()
        : {};
      const topBarBottom = Math.max(0, Number(this.getTopBarBottom(state)) || 84);
      const width = Math.max(1,
        Number(this.renderer?.viewportWidth)
        || Number(this.renderer?.width)
        || Number(this.runtime?.width)
        || Number(systemInfo.windowWidth)
        || 390);
      const height = Math.max(1,
        Number(this.renderer?.viewportHeight)
        || Number(this.renderer?.height)
        || Number(this.runtime?.height)
        || Number(systemInfo.windowHeight)
        || 844);
      const bottomSafeArea = Math.max(0, Number(this.renderer?.bottomSafeArea) || 0);
      const bottom = Math.max(topBarBottom, height - 60 - bottomSafeArea);
      return {
        x: 0,
        y: topBarBottom,
        width,
        height: bottom - topBarBottom,
      };
    }

    isPointInMap(point = {}, state = this.getState()) {
      const map = this.getInputMapRect(state);
      const x = Number(point.x);
      const y = Number(point.y);
      return Boolean(map
        && Number.isFinite(x)
        && Number.isFinite(y)
        && x >= Number(map.x)
        && x <= Number(map.x) + Number(map.width)
        && y >= Number(map.y)
        && y <= Number(map.y) + Number(map.height));
    }

    syncCameraFromUi(uiState = this.getBaseUiState?.() || {}) {
      const nextX = Number(uiState.worldPanX);
      const nextY = Number(uiState.worldPanY);
      if (Number.isFinite(nextX)) this.camera.x = nextX;
      if (Number.isFinite(nextY)) this.camera.y = nextY;
      return this.camera;
    }

    getMapDataSignature(state = this.getState(), options = {}) {
      const territoryState = state?.territoryState || {};
      const worldExplorerState = state?.worldExplorerState || {};
      if (typeof this.presenter?.getWorldTileMapSignature === 'function') {
        return this.presenter.getWorldTileMapSignature(territoryState, worldExplorerState, options);
      }
      const worldMap = territoryState.worldMap || {};
      const tiles = Array.isArray(worldMap.tiles) ? worldMap.tiles : [];
      const sites = Array.isArray(territoryState.territories) ? territoryState.territories : [];
      const missions = Array.isArray(territoryState.scoutMissions) ? territoryState.scoutMissions : [];
      return JSON.stringify({
        version: worldMap.version || 0,
        seed: worldMap.seed || '',
        tiles: tiles.map((tile) => ({
          id: tile.id,
          q: tile.q,
          r: tile.r,
          terrain: tile.terrain,
          discovered: tile.discovered !== false,
          visible: tile.visible !== false,
          siteId: tile.siteId || null,
          riverPorts: tile.riverPorts || [],
          oceanTemplates: tile.oceanTemplates || [],
          transitionKey: tile.transitionKey || '',
        })),
        sites: sites.map((site) => ({
          id: site.id,
          x: site.x,
          y: site.y,
          status: site.status,
          owner: site.owner,
          type: site.type,
          art: site.art,
          name: site.cityName || site.naturalName,
        })),
        missions: missions.map((mission) => ({
          id: mission.id,
          status: mission.status,
          route: mission.route || [],
          revealArea: mission.revealArea || [],
          revealedTileIds: mission.revealedTileIds || [],
          actionPointsRemaining: mission.actionPointsRemaining,
        })),
        explorerMissions: [
          worldExplorerState.activeMission,
          ...(Array.isArray(worldExplorerState.readyMissions) ? worldExplorerState.readyMissions : []),
          ...(Array.isArray(worldExplorerState.idleMissions) ? worldExplorerState.idleMissions : []),
        ].filter(Boolean).map((mission) => ({
          id: mission.id,
          status: mission.status,
          position: mission.position || null,
          route: mission.route || [],
          plannedTiles: mission.plannedTiles || [],
          plannedSites: mission.plannedSites || [],
          revealedTileIds: mission.revealedTileIds || [],
        })),
      });
    }

    syncMapDataSignature(state = this.getState(), options = {}) {
      const signature = this.getMapDataSignature(state, options);
      if (signature === this.lastMapDataSignature) {
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
      const hadPreviousSignature = Boolean(this.lastMapDataSignature);
      global.WorldMarchTrace?.log?.('runtime:signature:changed', {
        hadPreviousSignature,
        previousLength: this.lastMapDataSignature.length,
        nextLength: signature.length,
        activeMission: global.WorldMarchTrace?.summarizeMission?.(state?.worldExplorerState?.activeMission),
      });
      this.lastMapDataSignature = signature;
      if (hadPreviousSignature) {
        this.mapBakeDirty = true;
        if (typeof this.renderer?.invalidateWorldTileCaches === 'function') {
          this.renderer.invalidateWorldTileCaches();
        } else if (typeof this.renderer?.invalidateWorldTileViewCache === 'function') {
          this.renderer.invalidateWorldTileViewCache();
        }
      }
      return hadPreviousSignature;
    }

    getCurrentMapDataSignature(state = this.getState(), options = {}) {
      return this.getMapDataSignature(state, options);
    }

    isMapBakeDirty(state = this.getState(), options = {}) {
      if (!this.hasBakedMapLayer || this.mapBakeDirty) return true;
      return this.getCurrentMapDataSignature(state, options) !== this.lastMapDataSignature;
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
      const nextX = Number.isFinite(Number(x)) ? Number(x) : this.camera.x;
      const nextY = Number.isFinite(Number(y)) ? Number(y) : this.camera.y;
      if (nextX === this.camera.x && nextY === this.camera.y) return false;
      this.camera.x = nextX;
      this.camera.y = nextY;
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
      this.drag = {
        pointerId: point.pointerId,
        startX: Number(point.x) || 0,
        startY: Number(point.y) || 0,
        cameraX: this.camera.x,
        cameraY: this.camera.y,
      };
      return true;
    }

    moveDrag(point = {}) {
      if (!this.drag || point.pointerId !== this.drag.pointerId) return false;
      const x = Number(point.x) || 0;
      const y = Number(point.y) || 0;
      return this.setCamera(
        this.drag.cameraX + x - this.drag.startX,
        this.drag.cameraY + y - this.drag.startY,
        { source: 'drag', render: this.renderOnDrag },
      );
    }

    endDrag(point = {}) {
      if (!this.drag || point.pointerId !== this.drag.pointerId) return false;
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
      const nextX = Number.isFinite(Number(x)) ? Number(x) : 0;
      const nextY = Number.isFinite(Number(y)) ? Number(y) : 0;
      this.dragLayerOffset.x = nextX;
      this.dragLayerOffset.y = nextY;
      this.hitTargets = this.getOffsetHitTargets();
      return this.dragLayerOffset;
    }

    clearDragLayerOffset() {
      return this.setDragLayerOffset(0, 0);
    }

    getCameraOffsetFromBaked() {
      return {
        x: (Number(this.camera.x) || 0) - (Number(this.bakedCamera.x) || 0),
        y: (Number(this.camera.y) || 0) - (Number(this.bakedCamera.y) || 0),
      };
    }

    markBakedCamera(camera = this.camera) {
      this.bakedCamera = {
        x: Number(camera?.x) || 0,
        y: Number(camera?.y) || 0,
      };
      this.clearDragLayerOffset();
      return this.bakedCamera;
    }

    getOffsetHitTargets() {
      const offsetX = Number(this.dragLayerOffset.x) || 0;
      const offsetY = Number(this.dragLayerOffset.y) || 0;
      return (this.baseHitTargets || []).map((target) => ({
        ...target,
        x: (Number(target.x) || 0) + offsetX,
        y: (Number(target.y) || 0) + offsetY,
      }));
    }

    syncHitTargetsFromRenderer() {
      const viewportOffsetX = Number(this.renderer?.viewportOffsetX) || 0;
      const viewportOffsetY = Number(this.renderer?.viewportOffsetY) || 0;
      this.baseHitTargets = WorldMapInputActionMap?.normalizeHitTargets
        ? WorldMapInputActionMap.normalizeHitTargets(this.renderer?.hitTargets || [], {
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

    getBackgroundMarchTargetAction(point = {}) {
      const context = this.getLastTileMapContext();
      if (WorldMapInputActionMap?.getBackgroundMarchTargetAction) {
        return WorldMapInputActionMap.getBackgroundMarchTargetAction(point, context, {
          screenPointToAxialTile: WorldMarchSystem?.screenPointToAxialTile,
        });
      }
      return null;
    }

    render(options = {}) {
      const state = options.state || this.getState();
      this.lastGameState = state;
      this.lastWorldMarchState = state;
      if (this.renderer) {
        this.renderer.lastGameState = state;
        this.renderer.lastWorldMarchState = state;
        if (this.renderer.worldMapRenderer) {
          this.renderer.worldMapRenderer.lastGameState = state;
          this.renderer.worldMapRenderer.lastWorldMarchState = state;
        }
        if (this.renderer.worldMapLayerRenderer) {
          this.renderer.worldMapLayerRenderer.lastGameState = state;
          this.renderer.worldMapLayerRenderer.lastWorldMarchState = state;
        }
      }
      if (!this.canRender(state)) {
        global.WorldMarchTrace?.warn?.('runtime:render:cannotRender', {
          enabled: this.enabled,
          hasRenderer: Boolean(this.renderer),
          hasPresenter: Boolean(this.presenter),
          tileCount: Array.isArray(state?.territoryState?.worldMap?.tiles) ? state.territoryState.worldMap.tiles.length : 0,
          activeMission: global.WorldMarchTrace?.summarizeMission?.(state?.worldExplorerState?.activeMission),
        });
        this.renderer?.clearAll?.();
        this.hitTargets = [];
        this.baseHitTargets = [];
        this.hasBakedMapLayer = false;
        this.mapBakeDirty = true;
        this.lastMapDataSignature = '';
        return false;
      }
      const snapshotOnly = Boolean(options.snapshotOnly || this.isDragging());
      const renderOptions = {
        ...options,
        epochNowMs: options.epochNowMs || Date.now(),
      };
      const canUseSnapshotLayer = Boolean(snapshotOnly
        && this.hasBakedMapLayer
        && !this.isMapBakeDirty(state, renderOptions)
        && typeof this.renderer.renderWorldMapSnapshotLayer === 'function');
      global.WorldMarchTrace?.logDedup?.('runtime:render:begin', [
        snapshotOnly,
        canUseSnapshotLayer,
        this.hasBakedMapLayer,
        this.mapBakeDirty,
        state?.worldExplorerState?.activeMission?.id || '',
        state?.worldExplorerState?.activeMission?.status || '',
        (state?.worldExplorerState?.activeMission?.revealedTileIds || []).length,
        Math.floor(Number(renderOptions.epochNowMs) / 10000),
      ].join('|'), {
        snapshotOnly,
        canUseSnapshotLayer,
        hasBakedMapLayer: this.hasBakedMapLayer,
        mapBakeDirty: this.mapBakeDirty,
        epochNowMs: renderOptions.epochNowMs,
        activeMission: global.WorldMarchTrace?.summarizeMission?.(state?.worldExplorerState?.activeMission),
      });
      const now = this.now();
      if (!options.force && this.lastRenderAt && now - this.lastRenderAt < Math.max(1, this.frameMs - 1)) return false;
      this.lastRenderAt = now;
      const uiState = this.getCameraUiState();
      const topBarBottom = options.topBarBottom ?? this.getTopBarBottom(state);
      if (canUseSnapshotLayer) {
        const renderedSnapshot = this.renderer.renderWorldMapSnapshotLayer(state, {
          ...options,
          epochNowMs: renderOptions.epochNowMs,
          activeTab: 'military',
          isMapHome: true,
          territoryUiState: uiState,
          topBarBottom,
          reuseCachedWorldTileView: true,
          snapshotOnly: true,
          waterTimeMs: options.waterTimeMs ?? this.waterTimeMs,
          showFpsOverlay: false,
        });
        this.syncWaterAnimationFlag(uiState);
        this.lastLayout = this.getLayerLayout(state, { topBarBottom });
        global.WorldMarchTrace?.logDedup?.('runtime:render:snapshot', [
          renderedSnapshot,
          state?.worldExplorerState?.activeMission?.id || '',
          state?.worldExplorerState?.activeMission?.status || '',
          (state?.worldExplorerState?.activeMission?.revealedTileIds || []).length,
          Math.floor(Number(renderOptions.epochNowMs) / 10000),
        ].join('|'), {
          rendered: Boolean(renderedSnapshot),
          hitTargetCount: this.hitTargets.length,
          activeMission: global.WorldMarchTrace?.summarizeMission?.(state?.worldExplorerState?.activeMission),
        });
        return renderedSnapshot;
      }
      this.syncMapDataSignature(state, renderOptions);
      const rendered = this.renderer.renderWorldMapLayer(state, {
        ...options,
        epochNowMs: renderOptions.epochNowMs,
        activeTab: 'military',
        isMapHome: true,
        territoryUiState: uiState,
        topBarBottom,
        collectHitTargets: true,
        reuseCachedWorldTileView: Boolean(options.reuseCachedWorldTileView || this.isDragging()),
        snapshotOnly,
        waterTimeMs: options.waterTimeMs ?? this.waterTimeMs,
        showFpsOverlay: false,
      });
      this.lastLayout = this.getLayerLayout(state, { topBarBottom });
      if (rendered) {
        this.syncWaterAnimationFlag(uiState);
        this.lastTileMapContext = this.getLastTileMapContext();
        this.hasBakedMapLayer = true;
        this.mapBakeDirty = false;
        this.markBakedCamera(this.camera);
        this.syncHitTargetsFromRenderer();
      }
      global.WorldMarchTrace?.logDedup?.('runtime:render:full', [
        rendered,
        this.hasBakedMapLayer,
        this.mapBakeDirty,
        this.hitTargets.length,
        state?.worldExplorerState?.activeMission?.id || '',
        state?.worldExplorerState?.activeMission?.status || '',
        (state?.worldExplorerState?.activeMission?.revealedTileIds || []).length,
        Math.floor(Number(renderOptions.epochNowMs) / 10000),
      ].join('|'), {
        rendered: Boolean(rendered),
        hasBakedMapLayer: this.hasBakedMapLayer,
        mapBakeDirty: this.mapBakeDirty,
        hitTargetCount: this.hitTargets.length,
        activeMission: global.WorldMarchTrace?.summarizeMission?.(state?.worldExplorerState?.activeMission),
      });
      return rendered;
    }
  }

  global.WorldMapRuntime = WorldMapRuntime;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapRuntime;
})(typeof window !== 'undefined' ? window : globalThis);
