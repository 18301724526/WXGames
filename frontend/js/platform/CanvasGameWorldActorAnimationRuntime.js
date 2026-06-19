(function (global) {
  var WorldMarchSystem = global.WorldMarchSystem;
  if (typeof module !== 'undefined' && module.exports && !WorldMarchSystem) {
    try {
      WorldMarchSystem = require('../domain/WorldMarchSystem');
    } catch (error) {
      WorldMarchSystem = null;
    }
  }

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function hasActiveWorldExplorerMission(state = {}, options = {}) {
    if (WorldMarchSystem?.hasActiveMission) {
      return WorldMarchSystem.hasActiveMission(state?.worldExplorerState || {}, options);
    }
    const explorer = state?.worldExplorerState || {};
    const missions = [
      explorer.activeMission,
      ...(Array.isArray(explorer.missions) ? explorer.missions : []),
      ...(Array.isArray(explorer.idleMissions) ? explorer.idleMissions : []),
    ].filter(Boolean);
    return missions.some((mission) => mission.status === 'active');
  }

  function isMapHomeActive(host = {}, state = {}) {
    if (typeof host.isWorldMapHomeActive === 'function') {
      try {
        return host.isWorldMapHomeActive(state);
      } catch (error) {
        // Tests and legacy hosts sometimes stub only part of the world-map coordinator.
      }
    }
    return Boolean(host.mapHomeActive
      && (state?.currentTab || host.activeTab) === 'military'
      && (state?.militaryView || host.militaryView) === 'world');
  }

  function getRequestAnimationFrame(host = {}) {
    const raf = host.runtime?.requestAnimationFrame || global.requestAnimationFrame;
    return typeof raf === 'function' ? raf.bind(host.runtime || global) : null;
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
      || host.territoryController?.getUiState?.()
      || host.territoryController?.uiState
      || host.territoryUiState
      || {};
    const rendered = host.renderer.renderWorldMapActorLayer(state, {
      ...options,
      epochNowMs,
      activeTab: 'military',
      isMapHome: true,
      territoryUiState,
      worldMapRuntimeContext: options.worldMapRuntimeContext
        || runtime?.getLastTileMapContext?.()
        || runtime?.lastTileMapContext
        || host.renderer?.lastWorldTileMapContext
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

  function install(Host) {
    if (!Host?.prototype) return false;
    Object.assign(Host.prototype, {
      getWorldActorAnimationFrameMs() {
        return getFrameMs(this);
      },

      shouldAnimateWorldActors(options = {}) {
        return shouldAnimateWorldActors(this, options);
      },

      renderWorldActorAnimationFrame(options = {}) {
        if (!this.shouldAnimateWorldActors(options)) return false;
        const now = this.now?.() ?? Date.now();
        const frameMs = Math.max(1, this.getWorldActorAnimationFrameMs() - 1);
        if (!options.force && this.lastWorldActorAnimationRenderAt && now - this.lastWorldActorAnimationRenderAt < frameMs) return false;
        this.lastWorldActorAnimationRenderAt = now;
        return renderWorldActorLayerFrame(this, options);
      },

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
      },

      startWorldActorAnimationLoop(options = {}) {
        if (!canRenderWorldActorLayer(this)) return false;
        if (!this.shouldAnimateWorldActors(options)) {
          this.stopWorldActorAnimationLoop();
          return false;
        }
        if (this.worldActorAnimationActive) return true;
        this.worldActorAnimationActive = true;
        return this.requestWorldActorAnimationFrame({ force: true, ...options });
      },

      stopWorldActorAnimationLoop() {
        this.worldActorAnimationActive = false;
        this.worldActorQueuedRenderOptions = null;
        return true;
      },

      updateWorldActorAnimationLoop(options = {}) {
        return this.shouldAnimateWorldActors(options)
          ? this.startWorldActorAnimationLoop(options)
          : this.stopWorldActorAnimationLoop();
      },
    });
    return true;
  }

  const CanvasGameWorldActorAnimationRuntime = Object.freeze({
    canRenderWorldActorLayer,
    getFrameMs,
    hasActiveWorldExplorerMission,
    renderWorldActorLayerFrame,
    shouldAnimateWorldActors,
    install,
  });

  global.CanvasGameWorldActorAnimationRuntime = CanvasGameWorldActorAnimationRuntime;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasGameWorldActorAnimationRuntime;
})(typeof window !== 'undefined' ? window : globalThis);
