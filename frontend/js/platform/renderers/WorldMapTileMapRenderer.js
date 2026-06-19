(function (global) {
  const sharedWorldMapRenderSnapshot = (() => {
    if (global.WorldMapRenderSnapshot) return global.WorldMapRenderSnapshot;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/WorldMapRenderSnapshot');
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
        return require('../../domain/WorldMarchSystem');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  class WorldMapTileMapRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      return new Proxy(this, {
        get(target, prop, receiver) {
          const ownValue = Reflect.get(target, prop, receiver);
          if (ownValue !== undefined || prop in target) return ownValue;
          const host = target.host;
          if (host && prop in host) {
            const hostValue = host[prop];
            return typeof hostValue === 'function' ? hostValue.bind(host) : hostValue;
          }
          return undefined;
        },
        set(target, prop, value, receiver) {
          if (prop === 'host' || prop in target) return Reflect.set(target, prop, value, receiver);
          const host = target.host;
          if (host) {
            host[prop] = value;
            return true;
          }
          target[prop] = value;
          return true;
        },
      });
    }

    getWorldMapHitTargetModel() {
      return this.host?.constructor?.getWorldMapHitTargetModel?.() || null;
    }

    getWorldTileMapNowMs(options = {}) {
      const optionNow = options.nowMs ?? options.epochNowMs ?? options.serverNowMs;
      const resolvedOptionNow = Number(optionNow);
      if (Number.isFinite(resolvedOptionNow)) return resolvedOptionNow;
      return typeof this.getEpochNowMs === 'function' ? this.getEpochNowMs() : Date.now();
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
        viewportOffsetX: Number(this.viewportOffsetX) || 0,
        viewportOffsetY: Number(this.viewportOffsetY) || 0,
        geometry,
        frame,
      };
    }

    publishWorldTileMapContext(context = null) {
      this.lastWorldTileMapContext = context;
      if (this.host && this.host !== this) {
        this.host.lastWorldTileMapContext = context;
      }
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
      if (this.worldMapActorHudRenderer?.buildWorldMapActors) {
        const actors = this.worldMapActorHudRenderer.buildWorldMapActors(tileMapView, renderSnapshot, options);
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
      this.drawPanel(x, y, width, height, {
        fill: this.createGradient(
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
      if (dragTarget) this.addHitTarget(dragTarget.rect, dragTarget.action);
      else this.addHitTarget({ x, y, width, height }, { type: 'worldMapDrag', background: true, inputSurface: 'worldMap' });
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
        this.renderWorldTileSnapshotCache(tileMapView, viewport, frame);
        return undefined;
      });
    }

    renderWorldTileMapHitTargets(tileMapView = {}, viewport = {}, frame = {}, geometry = {}, visibleEntries = [], uiState = {}) {
      this.addWorldMarchTileHitTargets(tileMapView, viewport, frame);
      this.addWorldTileSiteHitTargets(tileMapView, viewport, visibleEntries, uiState);
      return true;
    }

    renderWorldTileMapLayers(tileMapView = {}, viewport = {}, frame = {}, geometry = {}, visibleEntries = [], uiState = {}) {
      if (!this.renderWorldTileWaterLayer(tileMapView, viewport, frame, visibleEntries)) {
        this.renderWorldTileWaterEntries(tileMapView, viewport, visibleEntries, this.getWorldTileWaterTimeMs());
      }
      if (!this.renderWorldTileStaticLayer(tileMapView, viewport, frame, visibleEntries, uiState)) {
        this.renderWorldTileStaticEntries(tileMapView, viewport, frame, visibleEntries, uiState, {
          addHitTargets: false,
        });
      }
      this.renderWorldTileFogMask(tileMapView, viewport, frame, visibleEntries);
      this.addWorldMarchTileHitTargets(tileMapView, viewport, frame);
      this.addWorldTileSiteHitTargets(tileMapView, viewport, visibleEntries, uiState);
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
        const visibleEntries = this.getWorldTileRenderEntries(tileMapView, viewport, frame, geometry);
        const visibilityActors = this.getWorldTileMapVisibilityActors(tileMapView, renderSnapshot, options);
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
