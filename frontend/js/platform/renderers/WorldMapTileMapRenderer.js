(function (global) {
  const sharedWorldMapRenderSnapshot = (() => {
    if (global.WorldMapRenderSnapshot) return global.WorldMapRenderSnapshot;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/projection/WorldMapRenderSnapshot');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const sharedWorldMarchSystem = (() => {
    if (global.WorldMarchSystem) return global.WorldMarchSystem;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/system/WorldMarchSystem');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  class WorldMapTileMapRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.worldMapRenderState = options.worldMapRenderState || this.host?.worldMapRenderState || null;
      this.worldMapCacheState = options.worldMapCacheState || this.host?.worldMapCacheState || null;
    }

    get ctx() {
      return this.host?.ctx || null;
    }

    get viewportOffsetX() {
      return Number(this.host?.viewportOffsetX) || 0;
    }

    get viewportOffsetY() {
      return Number(this.host?.viewportOffsetY) || 0;
    }

    get worldTileFastDragActive() {
      return Boolean(this.worldMapCacheState?.worldTileFastDragActive);
    }

    set worldTileFastDragActive(value) {
      if (this.worldMapCacheState) this.worldMapCacheState.worldTileFastDragActive = Boolean(value);
    }

    getWorldMapHitTargetModel() {
      return this.host?.constructor?.getWorldMapHitTargetModel?.() || null;
    }

    getWorldTileMapNowMs(options = {}) {
      const optionNow = options.nowMs ?? options.epochNowMs ?? options.serverNowMs;
      const resolvedOptionNow = Number(optionNow);
      if (Number.isFinite(resolvedOptionNow)) return resolvedOptionNow;
      return typeof this.host?.getEpochNowMs === 'function' ? this.host.getEpochNowMs() : Date.now();
    }

    hasCanonicalWorldExplorerState(options = {}) {
      const explorerState = options.worldExplorerState ?? options.state?.worldExplorerState;
      return Boolean(explorerState && typeof explorerState === 'object');
    }

    createWorldTileMapContext(tileMapView = {}, x = 0, y = 0, width = 0, height = 0, uiState = {}, options = {}) {
      const renderSnapshot = sharedWorldMapRenderSnapshot?.createSnapshot
        ? sharedWorldMapRenderSnapshot.createSnapshot({
          tileMapView,
          x,
          y,
          width,
          height,
          uiState,
        }, {
          ...options,
          nowMs: this.getWorldTileMapNowMs(options),
        })
        : null;
      const geometry = renderSnapshot?.geometry || tileMapView.geometry || {};
      const viewport = renderSnapshot?.viewport || {
        originX: x + width * 0.5,
        originY: y + height * 0.42,
        panX: Number(tileMapView.pan?.x) || 0,
        panY: Number(tileMapView.pan?.y) || 0,
        scale: Math.max(0.38, Math.min(0.78, Math.min(width / 520, height / 420))),
        seed: tileMapView.seed || 'scout-tile-v1',
        geometry,
        worldOrigin: tileMapView.origin || tileMapView.worldOrigin || { q: 0, r: 0 },
      };
      const frame = renderSnapshot?.frame || { x: x + 1, y: y + 1, width: width - 2, height: height - 2 };
      const visibilityActors = this.getWorldTileMapVisibilityActors(tileMapView, renderSnapshot, options);
      return {
        actors: [],
        visibilityActors,
        uiState,
        renderSnapshot,
        tileMapView,
        viewport,
        viewportOffsetX: this.viewportOffsetX,
        viewportOffsetY: this.viewportOffsetY,
        geometry,
        frame,
      };
    }

    publishWorldTileMapContext(context = null) {
      if (this.worldMapRenderState) this.worldMapRenderState.lastWorldTileMapContext = context;
      return context;
    }

    getWorldTileMapVisibilityActors(tileMapView = {}, renderSnapshot = null, options = {}) {
      const explorerState = options.worldExplorerState || options.state?.worldExplorerState || null;
      const explorerActors = explorerState && sharedWorldMarchSystem?.buildActors
        ? sharedWorldMarchSystem.buildActors(explorerState, { nowMs: this.getWorldTileMapNowMs(options) })
        : [];
      if (Array.isArray(explorerActors) && explorerActors.length) return explorerActors;
      if (this.hasCanonicalWorldExplorerState(options)) return [];
      const snapshotActors = Array.isArray(renderSnapshot?.actors) ? renderSnapshot.actors : null;
      if (snapshotActors?.length) return snapshotActors;
      if (this.host?.worldMapActorHudRenderer?.buildWorldMapActors) {
        const actors = this.host.worldMapActorHudRenderer.buildWorldMapActors(tileMapView, renderSnapshot, options);
        if (Array.isArray(actors) && actors.length) return actors;
      }
      const tileActors = sharedWorldMarchSystem?.buildActors?.({ missions: tileMapView.activeScouts || [] }, {
        nowMs: this.getWorldTileMapNowMs(options),
      }) || [];
      return tileActors.length ? tileActors : (snapshotActors || []);
    }

    getWorldTileMapActors(tileMapView = {}, renderSnapshot = null, options = {}) {
      return this.getWorldTileMapVisibilityActors(tileMapView, renderSnapshot, options);
    }

    drawWorldTileMapPanel(x = 0, y = 0, width = 0, height = 0, hitTargetsOnly = false, options = {}) {
      if (hitTargetsOnly) return false;
      if (options.frameless && this.ctx?.fillRect) {
        this.ctx.fillStyle = 'rgba(20, 26, 23, 0.92)';
        this.ctx.fillRect(x, y, width, height);
        return true;
      }
      this.host?.drawPanel?.(x, y, width, height, {
        fill: this.host?.createGradient?.(
          x, y, x, y + height,
          [
            [0, 'rgba(30, 43, 45, 0.88)'],
            [1, 'rgba(18, 17, 14, 0.94)'],
          ],
          'rgba(25, 31, 30, 0.92)',
        ),
        stroke: 'rgba(240, 180, 91, 0.18)',
        radius: 8,
        inset: 'rgba(255, 231, 184, 0.06)',
      });
      return true;
    }

    addWorldMapDragHitTarget(x = 0, y = 0, width = 0, height = 0) {
      const dragTarget = this.getWorldMapHitTargetModel()?.getWorldMapDragHitTarget?.({ x, y, width, height });
      if (dragTarget) this.host?.addHitTarget?.(dragTarget.rect, dragTarget.action);
      else this.host?.addHitTarget?.({ x, y, width, height }, { type: 'worldMapDrag', background: true, inputSurface: 'worldMap' });
      return true;
    }

    withWorldTileMapClip(x = 0, y = 0, width = 0, height = 0, callback = null) {
      if (typeof callback !== 'function') return false;
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(x + 1, y + 1, width - 2, height - 2);
      this.ctx.clip();
      try {
        return callback();
      } finally {
        this.ctx.restore();
      }
    }

    renderWorldTileMapSnapshotOnly(tileMapView = {}, viewport = {}, frame = {}, x = 0, y = 0, width = 0, height = 0) {
      return this.withWorldTileMapClip(x, y, width, height, () => {
        this.host?.renderWorldTileSnapshotCache?.(tileMapView, viewport, frame);
        return undefined;
      });
    }

    renderWorldTileMapHitTargets(tileMapView = {}, viewport = {}, frame = {}, geometry = {}, visibleEntries = [], uiState = {}, options = {}) {
      this.host?.addWorldMarchTileHitTargets?.(tileMapView, viewport, frame, options);
      this.host?.addWorldTileSiteHitTargets?.(tileMapView, viewport, visibleEntries, uiState);
      return true;
    }

    renderWorldTileMapLayers(tileMapView = {}, viewport = {}, frame = {}, geometry = {}, visibleEntries = [], uiState = {}, options = {}) {
      if (!this.host?.renderWorldTileWaterLayer?.(tileMapView, viewport, frame, visibleEntries)) {
        this.host?.renderWorldTileWaterEntries?.(tileMapView, viewport, visibleEntries, this.host?.getWorldTileWaterTimeMs?.());
      }
      if (!this.host?.renderWorldTileStaticLayer?.(tileMapView, viewport, frame, visibleEntries, uiState)) {
        this.host?.renderWorldTileStaticEntries?.(tileMapView, viewport, frame, visibleEntries, uiState, {
          addHitTargets: false,
        });
      }
      this.host?.addWorldMarchTileHitTargets?.(tileMapView, viewport, frame, options);
      this.host?.addWorldTileSiteHitTargets?.(tileMapView, viewport, visibleEntries, uiState);
      return true;
    }

    renderWorldTileMap(tileMapView = {}, x, y, width, height, uiState = {}, options = {}) {
      const context = this.publishWorldTileMapContext(
        this.createWorldTileMapContext(tileMapView, x, y, width, height, uiState, options),
      );
      const { renderSnapshot, viewport, geometry, frame } = context;
      const hitTargetsOnly = Boolean(options.hitTargetsOnly);
      const snapshotOnly = Boolean(options.snapshotOnly);
      const previousFastDragActive = this.worldTileFastDragActive;
      this.worldTileFastDragActive = Boolean(options.fastDrag);

      try {
        this.drawWorldTileMapPanel(x, y, width, height, hitTargetsOnly, options);
        this.addWorldMapDragHitTarget(x, y, width, height);
        if (!hitTargetsOnly && snapshotOnly) {
          this.renderWorldTileMapSnapshotOnly(tileMapView, viewport, frame, x, y, width, height);
          return;
        }
        const visibleEntries = this.host?.getWorldTileRenderEntries?.(tileMapView, viewport, frame, geometry) || [];
        const visibilityActors = this.getWorldTileMapVisibilityActors(tileMapView, renderSnapshot, options);
        context.entries = visibleEntries;
        context.visibilityActors = visibilityActors;
        context.actors = [];
        if (hitTargetsOnly) {
          this.renderWorldTileMapHitTargets(tileMapView, viewport, frame, geometry, visibleEntries, uiState, options, renderSnapshot, visibilityActors);
          return;
        }
        this.withWorldTileMapClip(x, y, width, height, () => (
          this.renderWorldTileMapLayers(tileMapView, viewport, frame, geometry, visibleEntries, uiState, options, renderSnapshot, visibilityActors)
        ));
      } finally {
        this.worldTileFastDragActive = previousFastDragActive;
      }
    }
  }

  global.WorldMapTileMapRenderer = WorldMapTileMapRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapTileMapRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
