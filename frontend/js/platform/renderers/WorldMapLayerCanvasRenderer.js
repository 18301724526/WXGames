(function (global) {
  const SharedWorldTime = (() => {
    if (global.WorldTime) return global.WorldTime;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/WorldTime');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedWorldMarchSystem = (() => {
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

  class WorldMapLayerCanvasRenderer {
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
          if (prop === 'host' || prop in target) return Reflect.set(target, prop, value);
          if (target.host && prop in target.host) {
            target.host[prop] = value;
            return true;
          }
          target[prop] = value;
          return true;
        },
      });
    }

    buildMilitaryNavigationViewState(state = {}) {
      if (this.presenter && typeof this.presenter.buildMilitaryNavigationViewState === 'function') {
        return this.presenter.buildMilitaryNavigationViewState(state);
      }
      const activeView = ['army', 'scout', 'world'].includes(state.militaryView) ? state.militaryView : 'army';
      return {
        activeView,
        locked: false,
        views: ['army', 'scout', 'world'].map((id) => ({
          id,
          isActive: id === activeView,
          disabled: false,
          isLocked: false,
          title: '',
          ariaSelected: String(id === activeView),
        })),
      };
    }

    getWorldMapLayerLayout(state = {}, topBarBottom = null, options = {}) {
      const nav = this.buildMilitaryNavigationViewState(state);
      if (nav.activeView !== 'world') return null;
      const layout = this.getLayout();
      const offsetX = Number(this.viewportOffsetX) || 0;
      const offsetY = Number(this.viewportOffsetY) || 0;
      const viewportBottom = this.height - Math.max(0, offsetY);
      const tabsTop = viewportBottom - 60 - this.bottomSafeArea;
      if (options.isMapHome) {
        const mapX = 0;
        const mapY = Math.max(0, topBarBottom ?? 84);
        const mapW = this.width;
        const mapBottom = this.height - 64;
        const mapH = Math.max(160, mapBottom - mapY);
        return {
          nav,
          panel: {
            x: mapX,
            y: mapY,
            width: mapW,
            height: mapH,
          },
          world: {
            x: mapX,
            y: mapY,
            width: mapW,
            height: mapH,
          },
          map: {
            x: mapX,
            y: mapY,
            width: mapW,
            height: mapH,
          },
        };
      }
      const panelTop = topBarBottom ?? 84;
      const panelHeight = Math.max(360, tabsTop - panelTop - 12);
      const panelX = layout.contentX;
      const panelWidth = layout.contentWidth;
      const worldX = panelX + 12;
      const worldY = panelTop + 88;
      const worldW = panelWidth - 24;
      const worldH = Math.max(120, panelTop + panelHeight - worldY - 12);
      return {
        nav,
        panel: {
          x: panelX,
          y: panelTop,
          width: panelWidth,
          height: panelHeight,
        },
        world: {
          x: worldX,
          y: worldY,
          width: worldW,
          height: worldH,
        },
        map: {
          x: worldX + 12,
          y: worldY + 46,
          width: worldW - 24,
          height: Math.max(160, worldH - 58),
        },
      };
    }

    renderMapHomeWorldView(state = {}, topBarBottom = 84, options = {}) {
      const layout = this.getWorldMapLayerLayout(state, topBarBottom, { isMapHome: true });
      if (!layout) return false;
      const territoryState = state.territoryState || {};
      const uiState = options.territoryUiState || {};
      const tileMapView = this.resolveWorldTileMapView(territoryState, uiState, {
        ...options,
        worldExplorerState: state.worldExplorerState || {},
      });
      if (!tileMapView?.tiles?.length) {
        if (Array.isArray(territoryState.territories) && territoryState.territories.length > 0) {
          this.renderMilitaryWorldView(state, layout.map.x, layout.map.y, layout.map.width, layout.map.height, {
            ...options,
            isMapHome: true,
          });
          return true;
        }
        this.renderMapHomeEmptyWorld(layout, topBarBottom, options);
        return true;
      }
      if (this.isWorldTileMapWaterAnimated(tileMapView)) uiState.tileMapWaterAnimated = true;
      const offsetX = Number(this.viewportOffsetX) || 0;
      const offsetY = Number(this.viewportOffsetY) || 0;
      const visibleWidth = Number(this.viewportWidth) || Math.max(1, this.width - offsetX * 2);
      const visibleHeight = Number(this.viewportHeight) || Math.max(1, this.height - offsetY * 2);
      const visibleMapY = Math.max(0, topBarBottom ?? 84);
      const visibleMapH = Math.max(160, visibleHeight - 64 - visibleMapY);
      this.renderWorldTileMap(tileMapView, layout.map.x, layout.map.y, layout.map.width, layout.map.height, uiState, {
        ...options,
        state,
        hitTargetsOnly: Boolean(options.skipWorldMapLayer),
        frameless: true,
        fastDrag: Boolean(options.reuseCachedWorldTileView),
        scaleBasisWidth: visibleWidth,
        scaleBasisHeight: visibleMapH,
        originX: offsetX + visibleWidth * 0.5,
        originY: offsetY + visibleMapY + visibleMapH * 0.42,
      });
      return true;
    }

    collectMapHomeWorldSiteHitTargets(state = {}, topBarBottom = 84, options = {}) {
      const layout = this.getWorldMapLayerLayout(state, topBarBottom, { isMapHome: true });
      if (!layout) return false;
      const territoryState = state.territoryState || {};
      const uiState = options.territoryUiState || {};
      const tileMapView = this.resolveWorldTileMapView(territoryState, uiState, {
        ...options,
        worldExplorerState: state.worldExplorerState || {},
      });
      if (!tileMapView?.tiles?.length) return true;
      const offsetX = Number(this.viewportOffsetX) || 0;
      const offsetY = Number(this.viewportOffsetY) || 0;
      const visibleWidth = Number(this.viewportWidth) || Math.max(1, this.width - offsetX * 2);
      const visibleHeight = Number(this.viewportHeight) || Math.max(1, this.height - offsetY * 2);
      const visibleMapY = Math.max(0, topBarBottom ?? 84);
      const visibleMapH = Math.max(160, visibleHeight - 64 - visibleMapY);
      const geometry = tileMapView.geometry || {};
      const scale = Math.max(0.38, Math.min(0.78, Math.min(visibleWidth / 520, visibleMapH / 420)));
      const viewport = {
        originX: offsetX + visibleWidth * 0.5,
        originY: offsetY + visibleMapY + visibleMapH * 0.42,
        panX: Number(tileMapView.pan?.x) || 0,
        panY: Number(tileMapView.pan?.y) || 0,
        scale,
        seed: tileMapView.seed || 'scout-tile-v1',
        geometry,
      };
      const frame = {
        x: layout.map.x + 1,
        y: layout.map.y + 1,
        width: layout.map.width - 2,
        height: layout.map.height - 2,
      };
      const visibleEntries = this.getWorldTileRenderEntries(tileMapView, viewport, frame, geometry);
      this.addWorldMapDragHitTarget?.(layout.map.x, layout.map.y, layout.map.width, layout.map.height);
      this.addWorldMarchTileHitTargets?.(tileMapView, viewport, frame);
      this.addWorldTileSiteHitTargets(tileMapView, viewport, visibleEntries, uiState);
      const lastContext = options.worldMapRuntimeContext
        || this.lastWorldTileMapContext
        || this.worldMapRenderer?.lastWorldTileMapContext
        || null;
      const contextActors = Array.isArray(lastContext?.actors)
        ? lastContext.actors
        : (Array.isArray(lastContext?.renderSnapshot?.actors) ? lastContext.renderSnapshot.actors : []);
      const actors = contextActors.length || !SharedWorldMarchSystem?.buildActors
        ? contextActors
        : SharedWorldMarchSystem.buildActors(state.worldExplorerState || {}, {
          nowMs: options.epochNowMs ?? options.nowMs ?? this.getEpochNowMs(),
        });
      this.lastMapHomeWorldHudContext = {
        actors,
        frame,
        geometry,
        renderSnapshot: lastContext?.renderSnapshot || null,
        tileMapView,
        uiState,
        viewport,
      };
      if (this.host && this.host !== this) {
        this.host.lastMapHomeWorldHudContext = this.lastMapHomeWorldHudContext;
      }
      return true;
    }

    getWorldMapActorLayerContext(state = {}, options = {}) {
      const context = options.worldMapRuntimeContext
        || this.lastWorldTileMapContext
        || this.worldMapRenderer?.lastWorldTileMapContext
        || this.worldMapLayerRenderer?.lastWorldTileMapContext
        || null;
      if (!context?.tileMapView || !context?.viewport || !context?.frame) return null;
      const renderSnapshot = context.renderSnapshot || null;
      const uiState = options.territoryUiState || context.uiState || renderSnapshot?.ui || {};
      const contextActors = Array.isArray(context.actors)
        ? context.actors
        : (Array.isArray(renderSnapshot?.actors) ? renderSnapshot.actors : []);
      const actors = contextActors.length || !SharedWorldMarchSystem?.buildActors
        ? contextActors
        : SharedWorldMarchSystem.buildActors(state.worldExplorerState || {}, {
          nowMs: options.epochNowMs ?? options.nowMs ?? this.getEpochNowMs(),
        });
      return {
        actors,
        frame: context.frame || renderSnapshot?.frame || {},
        geometry: context.geometry || renderSnapshot?.geometry || context.tileMapView?.geometry || {},
        renderSnapshot,
        tileMapView: context.tileMapView,
        uiState,
        viewport: context.viewport || renderSnapshot?.viewport || {},
      };
    }

    publishWorldMapActorLayerContext(context = null) {
      this.lastMapHomeWorldHudContext = context;
      if (this.host && this.host !== this) {
        this.host.lastMapHomeWorldHudContext = context;
      }
      return context;
    }

    renderWorldMapActorLayer(state = {}, options = {}) {
      if (!this.ctx) return false;
      const context = this.getWorldMapActorLayerContext(state, options);
      this.beginFrame(options);
      this.setHitTargets([]);
      this.clearAll();
      if (!context) {
        this.publishWorldMapActorLayerContext(null);
        this.endFrame({ ...options, showFpsOverlay: false });
        return false;
      }
      const { actors, viewport, geometry, frame, uiState } = context;
      let didClip = false;
      if (this.ctx.save && this.ctx.beginPath && this.ctx.rect && this.ctx.clip) {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(frame.x, frame.y, frame.width, frame.height);
        this.ctx.clip();
        didClip = true;
      }
      try {
        this.renderWorldActors?.(actors, viewport, geometry);
      } finally {
        if (didClip && this.ctx.restore) this.ctx.restore();
      }
      this.addWorldActorHitTargets?.(actors, viewport, geometry);
      this.publishWorldMapActorLayerContext(context);
      this.endFrame({ ...options, showFpsOverlay: false });
      return true;
    }

    getEpochNowMs() {
      return SharedWorldTime?.getEpochNowMs?.(this) ?? Date.now();
    }

    getExplorerMissionRemainingSeconds(mission = {}, nowMs = this.getEpochNowMs()) {
      return SharedWorldTime?.getRemainingSeconds?.(mission, nowMs) ?? Math.max(0, Math.ceil(Number(mission.remainingSeconds) || 0));
    }

    renderMapHomeEmptyWorld(layout = {}, topBarBottom = 84, options = {}) {
      const map = layout.map || { x: 0, y: topBarBottom, width: this.width, height: Math.max(160, this.height - topBarBottom - 64) };
      if (this.ctx) {
        this.ctx.fillStyle = this.createGradient(
          map.x,
          map.y,
          map.x,
          map.y + map.height,
          [
            [0, '#202920'],
            [0.55, '#18251f'],
            [1, '#111816'],
          ],
          '#18251f',
        );
        this.ctx.fillRect(map.x, map.y, map.width, map.height);
        this.ctx.strokeStyle = 'rgba(255, 226, 177, 0.08)';
        this.ctx.lineWidth = 1;
        const grid = 34;
        for (let x = map.x - (map.x % grid); x < map.x + map.width; x += grid) {
          this.ctx.beginPath();
          this.ctx.moveTo(x, map.y);
          this.ctx.lineTo(x, map.y + map.height);
          this.ctx.stroke();
        }
        for (let y = map.y - (map.y % grid); y < map.y + map.height; y += grid) {
          this.ctx.beginPath();
          this.ctx.moveTo(map.x, y);
          this.ctx.lineTo(map.x + map.width, y);
          this.ctx.stroke();
        }
      }
      const message = options.loading?.message || '\u6b63\u5728\u6574\u7406\u5927\u5730\u56fe';
      const panelWidth = Math.min(260, map.width - 36);
      const panelHeight = 86;
      const x = map.x + (map.width - panelWidth) / 2;
      const y = map.y + Math.max(76, map.height * 0.36 - panelHeight / 2);
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: 'rgba(20, 24, 18, 0.82)',
        stroke: 'rgba(255, 226, 177, 0.18)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.05)',
      });
      this.drawText(message, x + panelWidth / 2, y + 24, {
        size: 14,
        bold: true,
        color: '#ffe6b5',
        align: 'center',
      });
      this.drawText('\u5730\u56fe\u6570\u636e\u540c\u6b65\u540e\u4f1a\u81ea\u52a8\u663e\u793a', x + panelWidth / 2, y + 52, {
        size: 11,
        color: '#cbbd96',
        align: 'center',
      });
      this.addHitTarget({ x: map.x, y: map.y, width: map.width, height: map.height }, { type: 'blockCanvasModal' });
      return true;
    }

    renderWorldMapLayer(state = {}, options = {}) {
      if (!this.presenter || !this.ctx) return false;
      this.beginFrame(options);
      this.setHitTargets([]);
      this.clearAll();
      const layout = this.getWorldMapLayerLayout(state, options.topBarBottom, options);
      if (!layout) {
        this.endFrame({ ...options, showFpsOverlay: false });
        return false;
      }
      const territoryState = state.territoryState || {};
      const uiState = options.territoryUiState || {};
      const tileMapView = this.resolveWorldTileMapView(territoryState, uiState, {
        ...options,
        worldExplorerState: state.worldExplorerState || {},
      });
      if (!tileMapView?.tiles?.length) {
        this.endFrame({ ...options, showFpsOverlay: false });
        return false;
      }
      if (this.isWorldTileMapWaterAnimated(tileMapView)) uiState.tileMapWaterAnimated = true;
      this.worldTileWaterTimeOverride = options.waterTimeMs !== null
        && options.waterTimeMs !== undefined
        && Number.isFinite(Number(options.waterTimeMs))
        ? Number(options.waterTimeMs)
        : null;
      const drawWorldMap = () => {
        this.renderWorldTileMap(tileMapView, layout.map.x, layout.map.y, layout.map.width, layout.map.height, uiState, {
          ...options,
          state,
          frameless: Boolean(options.isMapHome),
          fastDrag: Boolean(options.reuseCachedWorldTileView),
          snapshotOnly: Boolean(options.snapshotOnly),
        });
      };
      try {
        if (options.collectHitTargets) drawWorldMap();
        else this.withSuppressedHitTargets(drawWorldMap);
      } finally {
        this.worldTileWaterTimeOverride = null;
      }
      this.endFrame({ ...options, showFpsOverlay: false });
      return true;
    }

    renderWorldMapSnapshotLayer(state = {}, options = {}) {
      if (!this.presenter || !this.ctx || typeof this.ctx.drawImage !== 'function') return false;
      if (options.preserveOnMiss && !options.__snapshotBackbuffer) {
        const cacheScale = Math.max(1, Number(this.pixelRatio) || 1);
        const work = this.getWorldTileLayerCacheContext('worldTileSnapshotLayerBackbuffer', this.width, this.height, cacheScale);
        if (!work?.canvas || !work?.ctx) return false;
        const previousCtx = this.ctx;
        this.ctx = work.ctx;
        try {
          work.ctx.setTransform?.(1, 0, 0, 1, 0, 0);
          work.ctx.clearRect?.(0, 0, work.pixelWidth || work.canvas.width, work.pixelHeight || work.canvas.height);
          work.ctx.setTransform?.(cacheScale, 0, 0, cacheScale, 0, 0);
          const rendered = this.renderWorldMapSnapshotLayer(state, {
            ...options,
            preserveOnMiss: false,
            __snapshotBackbuffer: true,
          });
          if (!rendered) return false;
        } finally {
          this.ctx = previousCtx;
        }
        this.ctx.drawImage(
          work.canvas,
          0,
          0,
          work.pixelWidth || work.canvas.width,
          work.pixelHeight || work.canvas.height,
          0,
          0,
          work.width || this.width,
          work.height || this.height,
        );
        return true;
      }
      this.beginFrame(options);
      this.setHitTargets([]);
      this.clearAll();
      const layout = this.getWorldMapLayerLayout(state, options.topBarBottom, options);
      if (!layout) {
        this.endFrame({ ...options, showFpsOverlay: false });
        return false;
      }
      const territoryState = state.territoryState || {};
      const uiState = options.territoryUiState || {};
      const tileMapView = this.resolveWorldTileMapView(territoryState, uiState, {
        ...options,
        worldExplorerState: state.worldExplorerState || {},
      });
      if (!tileMapView?.tiles?.length) {
        this.endFrame({ ...options, showFpsOverlay: false });
        return false;
      }
      const x = layout.map.x;
      const y = layout.map.y;
      const width = layout.map.width;
      const height = layout.map.height;
      const geometry = tileMapView.geometry || {};
      const scaleBasisWidth = Number(options.scaleBasisWidth) || width;
      const scaleBasisHeight = Number(options.scaleBasisHeight) || height;
      const originX = options.originX !== undefined ? Number(options.originX) : x + width * 0.5;
      const originY = options.originY !== undefined ? Number(options.originY) : y + height * 0.42;
      const scale = Math.max(0.38, Math.min(0.78, Math.min(scaleBasisWidth / 520, scaleBasisHeight / 420)));
      const viewport = {
        originX: Number.isFinite(originX) ? originX : x + width * 0.5,
        originY: Number.isFinite(originY) ? originY : y + height * 0.42,
        panX: Number(tileMapView.pan?.x) || 0,
        panY: Number(tileMapView.pan?.y) || 0,
        scale,
        seed: tileMapView.seed || 'scout-tile-v1',
        geometry,
      };
      const frame = { x: x + 1, y: y + 1, width: width - 2, height: height - 2 };
      const visibleEntries = this.getWorldTileRenderEntries(tileMapView, viewport, frame, geometry);
      if (typeof this.renderWorldTileFogMask === 'function') {
        this.renderWorldTileFogMask(tileMapView, viewport, frame, visibleEntries);
      }
      this.worldTileWaterTimeOverride = options.waterTimeMs !== null
        && options.waterTimeMs !== undefined
        && Number.isFinite(Number(options.waterTimeMs))
        ? Number(options.waterTimeMs)
        : null;
      let renderedSnapshot = false;
      try {
        if (options.frameless && this.ctx?.fillRect) {
          this.ctx.fillStyle = 'rgba(20, 26, 23, 0.92)';
          this.ctx.fillRect(x, y, width, height);
        }
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(x + 1, y + 1, width - 2, height - 2);
        this.ctx.clip();
        renderedSnapshot = this.renderWorldTileSnapshotCache(tileMapView, viewport, frame);
        this.ctx.restore();
      } finally {
        this.worldTileWaterTimeOverride = null;
      }
      this.endFrame({ ...options, showFpsOverlay: false });
      return renderedSnapshot;
    }
  }

  global.WorldMapLayerCanvasRenderer = WorldMapLayerCanvasRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorldMapLayerCanvasRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
