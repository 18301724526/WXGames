(function (global) {
  var WorldMapRuntimePolicy = global.CanvasGameShellWorldMapRuntimePolicy;
  if (typeof module !== 'undefined' && module.exports && !WorldMapRuntimePolicy) {
    WorldMapRuntimePolicy = require('./CanvasGameShellWorldMapRuntimePolicy');
  }
  var WorldMarchSystem = global.WorldMarchSystem;
  if (typeof module !== 'undefined' && module.exports && !WorldMarchSystem) {
    try {
      WorldMarchSystem = require('../domain/WorldMarchSystem');
    } catch (error) {
      WorldMarchSystem = null;
    }
  }

  function hasActiveWorldExplorerMission(state = {}, options = {}) {
    const explorer = state?.worldExplorerState || {};
    if (WorldMarchSystem?.hasActiveMission) {
      return WorldMarchSystem.hasActiveMission(explorer, options);
    }
    const missions = [
      explorer.activeMission,
      ...(Array.isArray(explorer.missions) ? explorer.missions : []),
      ...(Array.isArray(explorer.readyMissions) ? explorer.readyMissions : []),
      ...(Array.isArray(explorer.idleMissions) ? explorer.idleMissions : []),
    ].filter(Boolean);
    return missions.some((mission) => mission.status === 'active');
  }

  function install(CanvasGameShell) {
    if (!CanvasGameShell?.prototype) return false;
    Object.assign(CanvasGameShell.prototype, {
      getWorldTileWaterAnimationFrameMs() {
        const fps = Number(this.worldMapRenderer?.getWorldTileWaterAnimationFps?.()
          || this.renderer?.getWorldTileWaterAnimationFps?.()
          || 8);
        return WorldMapRuntimePolicy.getWaterAnimationFrameMs({
          animationFrameMs: this.getAnimationFrameMs(),
          fps,
        });
      },

      renderWorldMapLayerFrame(options = {}) {
        if (!this.previewEnabled || !this.worldMapRenderer || !this.lastGame?.state) return false;
        const frameOptionsBase = {
          ...options,
          epochNowMs: options.epochNowMs ?? Date.now(),
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
      },

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
      },

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
        if (homeView.militaryView && state.militaryView !== homeView.militaryView) state.militaryView = homeView.militaryView;
        if (homeView.activeTab !== 'military') {
          if (typeof this.worldMapRenderer.clearAll === 'function') this.worldMapRenderer.clearAll();
          return false;
        }
        const territoryUiState = options?.territoryUiState
          || this.lastGame?.territoryController?.getUiState?.()
          || this.territoryUiState
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
        if (rendered) this.renderWorldFogLayer();
        if (rendered) this.lastWorldMapLayerRenderAt = this.now();
        return rendered;
      },

      startTileMapWaterTimer() {
        if (this.tileMapWaterTimer || !this.runtime?.setInterval) return false;
        this.tileMapWaterTimer = this.runtime.setInterval(() => {
          if (this.getActiveTab() !== 'military') {
            this.stopTileMapWaterTimer();
            return;
          }
          if (this.isWorldMapDragging() || this.isWorldMapDragCoolingDown()) return;
          if (hasActiveWorldExplorerMission(this.lastGame?.state, { epochNowMs: Date.now() })) {
            if (this.worldMapRenderer) this.renderWorldMapLayerFrame({ force: true, epochNowMs: Date.now() });
            this.renderAnimationFrame();
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
      },

      stopTileMapWaterTimer() {
        if (!this.tileMapWaterTimer) return;
        this.runtime?.clearInterval?.(this.tileMapWaterTimer);
        this.tileMapWaterTimer = null;
      },
    });
    return true;
  }

  const api = { install };

  global.CanvasGameShellWorldMapFrameRuntime = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
