(function (global) {
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
        && (Number(state?.currentEra) || 0) >= 5
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

    getMapDataSignature(state = this.getState()) {
      const territoryState = state?.territoryState || {};
      if (typeof this.presenter?.getWorldTileMapSignature === 'function') {
        return this.presenter.getWorldTileMapSignature(territoryState);
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
      });
    }

    syncMapDataSignature(state = this.getState()) {
      const signature = this.getMapDataSignature(state);
      if (signature === this.lastMapDataSignature) return false;
      const hadPreviousSignature = Boolean(this.lastMapDataSignature);
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

    getCurrentMapDataSignature(state = this.getState()) {
      return this.getMapDataSignature(state);
    }

    isMapBakeDirty(state = this.getState()) {
      if (!this.hasBakedMapLayer || this.mapBakeDirty) return true;
      return this.getCurrentMapDataSignature(state) !== this.lastMapDataSignature;
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
      const x = Number(point.x);
      const y = Number(point.y);
      let backgroundAction = null;
      for (let index = this.hitTargets.length - 1; index >= 0; index -= 1) {
        const target = this.hitTargets[index];
        if (
          x >= target.x
          && x <= target.x + target.width
          && y >= target.y
          && y <= target.y + target.height
        ) {
          if (target.action?.background) backgroundAction = target.action;
          else return target.action;
        }
      }
      return backgroundAction;
    }

    handleTap(point = {}, event = null) {
      const action = this.getHitTarget(point);
      if (!action || action.disabled || action.type === 'worldMapDrag') return false;
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
      this.baseHitTargets = (this.renderer?.hitTargets || [])
        .filter((target) => target?.action?.type === 'openWorldSite'
          || target?.action?.type === 'resetWorldPan'
          || target?.action?.type === 'worldMapDrag')
        .map((target) => ({
          ...target,
          x: (Number(target.x) || 0) - viewportOffsetX,
          y: (Number(target.y) || 0) - viewportOffsetY,
        }));
      this.hitTargets = this.getOffsetHitTargets();
      return this.hitTargets;
    }

    render(options = {}) {
      const state = options.state || this.getState();
      if (!this.canRender(state)) {
        this.renderer?.clearAll?.();
        this.hitTargets = [];
        this.baseHitTargets = [];
        this.hasBakedMapLayer = false;
        this.mapBakeDirty = true;
        this.lastMapDataSignature = '';
        return false;
      }
      const snapshotOnly = Boolean(options.snapshotOnly || this.isDragging());
      const canUseSnapshotLayer = Boolean(snapshotOnly
        && this.hasBakedMapLayer
        && !this.isMapBakeDirty(state)
        && typeof this.renderer.renderWorldMapSnapshotLayer === 'function');
      const now = this.now();
      if (!options.force && this.lastRenderAt && now - this.lastRenderAt < Math.max(1, this.frameMs - 1)) return false;
      this.lastRenderAt = now;
      const uiState = this.getCameraUiState();
      const topBarBottom = options.topBarBottom ?? this.getTopBarBottom(state);
      if (canUseSnapshotLayer) {
        const renderedSnapshot = this.renderer.renderWorldMapSnapshotLayer(state, {
          ...options,
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
        return renderedSnapshot;
      }
      this.syncMapDataSignature(state);
      const rendered = this.renderer.renderWorldMapLayer(state, {
        ...options,
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
        this.hasBakedMapLayer = true;
        this.mapBakeDirty = false;
        this.markBakedCamera(this.camera);
        this.syncHitTargetsFromRenderer();
      }
      return rendered;
    }
  }

  global.WorldMapRuntime = WorldMapRuntime;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapRuntime;
})(typeof window !== 'undefined' ? window : globalThis);
