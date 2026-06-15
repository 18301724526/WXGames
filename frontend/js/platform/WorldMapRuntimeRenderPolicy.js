(function (global) {
  var SharedWorldClock = global.WorldClock;
  if (typeof module !== 'undefined' && module.exports && !SharedWorldClock) {
    try {
      SharedWorldClock = require('../domain/WorldClock');
    } catch (error) {
      SharedWorldClock = null;
    }
  }

  function resolveEpochNowMs(options = {}, fallbackNowMs = Date.now()) {
    if (options.epochNowMs !== null && options.epochNowMs !== undefined) return options.epochNowMs;
    if (options.serverNowMs !== null && options.serverNowMs !== undefined) return options.serverNowMs;
    const clockNow = SharedWorldClock?.getEpochNowMs?.(options, Number.NaN);
    if (Number.isFinite(Number(clockNow))) return clockNow;
    const fallback = Number(fallbackNowMs);
    return Number.isFinite(fallback) ? fallback : Date.now();
  }

  function isSnapshotOnly(options = {}, runtimeState = {}) {
    return Boolean(options.snapshotOnly || runtimeState.dragging);
  }

  function createRenderContext(options = {}, runtimeState = {}) {
    const epochNowMs = resolveEpochNowMs(options, runtimeState.epochNowMs);
    const snapshotOnly = isSnapshotOnly(options, runtimeState);
    return {
      snapshotOnly,
      renderOptions: {
        ...options,
        epochNowMs,
      },
      shouldCheckBakeDirty: Boolean(snapshotOnly && runtimeState.hasBakedMapLayer),
    };
  }

  function canUseSnapshotLayer(renderContext = {}, runtimeState = {}) {
    return Boolean(renderContext.snapshotOnly
      && runtimeState.hasBakedMapLayer
      && !runtimeState.mapBakeDirty
      && runtimeState.canRenderSnapshotLayer);
  }

  function shouldThrottleRender(options = {}, timing = {}) {
    const nowMs = Number(timing.nowMs) || 0;
    const lastRenderAt = Number(timing.lastRenderAt) || 0;
    const frameMs = Math.max(1, Number(timing.frameMs) || 1);
    return Boolean(!options.force && lastRenderAt && nowMs - lastRenderAt < Math.max(1, frameMs - 1));
  }

  function createCannotRenderState() {
    return {
      hitTargets: [],
      baseHitTargets: [],
      hasBakedMapLayer: false,
      mapBakeDirty: true,
      lastMapDataSignature: '',
    };
  }

  function getMissionTraceParts(state = {}, epochNowMs = Date.now()) {
    const activeMission = state?.worldExplorerState?.activeMission || null;
    return {
      activeMission,
      missionId: activeMission?.id || '',
      missionStatus: activeMission?.status || '',
      revealedCount: (activeMission?.revealedTileIds || []).length,
      epochBucket: Math.floor(Number(epochNowMs) / 10000),
    };
  }

  function createCannotRenderTrace(runtimeState = {}, state = {}) {
    return {
      enabled: runtimeState.enabled,
      hasRenderer: Boolean(runtimeState.renderer),
      hasPresenter: Boolean(runtimeState.presenter),
      tileCount: Array.isArray(state?.territoryState?.worldMap?.tiles)
        ? state.territoryState.worldMap.tiles.length
        : 0,
    };
  }

  function createRenderBeginTrace(state = {}, renderContext = {}, runtimeState = {}) {
    const parts = getMissionTraceParts(state, renderContext.renderOptions?.epochNowMs);
    return {
      keyParts: [
        renderContext.snapshotOnly,
        runtimeState.canUseSnapshotLayer,
        runtimeState.hasBakedMapLayer,
        runtimeState.mapBakeDirty,
        parts.missionId,
        parts.missionStatus,
        parts.revealedCount,
        parts.epochBucket,
      ],
      data: {
        snapshotOnly: renderContext.snapshotOnly,
        canUseSnapshotLayer: runtimeState.canUseSnapshotLayer,
        hasBakedMapLayer: runtimeState.hasBakedMapLayer,
        mapBakeDirty: runtimeState.mapBakeDirty,
        epochNowMs: renderContext.renderOptions?.epochNowMs,
        activeMission: parts.activeMission,
      },
    };
  }

  function createSnapshotRenderOptions(options = {}, context = {}) {
    return {
      ...options,
      epochNowMs: context.epochNowMs,
      activeTab: 'military',
      isMapHome: true,
      territoryUiState: context.uiState || {},
      topBarBottom: context.topBarBottom,
      reuseCachedWorldTileView: true,
      snapshotOnly: true,
      waterTimeMs: options.waterTimeMs ?? context.waterTimeMs,
      showFpsOverlay: false,
    };
  }

  function createSnapshotTrace(state = {}, rendered = false, context = {}) {
    const parts = getMissionTraceParts(state, context.epochNowMs);
    return {
      keyParts: [
        rendered,
        parts.missionId,
        parts.missionStatus,
        parts.revealedCount,
        parts.epochBucket,
      ],
      data: {
        rendered: Boolean(rendered),
        hitTargetCount: Number(context.hitTargetCount) || 0,
        activeMission: parts.activeMission,
      },
    };
  }

  function createFullRenderOptions(options = {}, context = {}) {
    return {
      ...options,
      epochNowMs: context.epochNowMs,
      activeTab: 'military',
      isMapHome: true,
      territoryUiState: context.uiState || {},
      topBarBottom: context.topBarBottom,
      collectHitTargets: true,
      reuseCachedWorldTileView: Boolean(options.reuseCachedWorldTileView || context.dragging),
      snapshotOnly: Boolean(context.snapshotOnly),
      waterTimeMs: options.waterTimeMs ?? context.waterTimeMs,
      showFpsOverlay: false,
    };
  }

  function createActorRenderOptions(options = {}, context = {}) {
    return {
      ...options,
      epochNowMs: context.epochNowMs,
      activeTab: 'military',
      isMapHome: true,
      territoryUiState: context.uiState || {},
      worldMapRuntimeContext: context.worldMapRuntimeContext || options.worldMapRuntimeContext || null,
      preserveCanvas: true,
      showFpsOverlay: false,
    };
  }

  function createFullTrace(state = {}, rendered = false, runtimeState = {}, epochNowMs = Date.now()) {
    const parts = getMissionTraceParts(state, epochNowMs);
    return {
      keyParts: [
        rendered,
        runtimeState.hasBakedMapLayer,
        runtimeState.mapBakeDirty,
        runtimeState.hitTargetCount,
        parts.missionId,
        parts.missionStatus,
        parts.revealedCount,
        parts.epochBucket,
      ],
      data: {
        rendered: Boolean(rendered),
        hasBakedMapLayer: runtimeState.hasBakedMapLayer,
        mapBakeDirty: runtimeState.mapBakeDirty,
        hitTargetCount: Number(runtimeState.hitTargetCount) || 0,
        activeMission: parts.activeMission,
      },
    };
  }

  const WorldMapRuntimeRenderPolicy = Object.freeze({
    resolveEpochNowMs,
    isSnapshotOnly,
    createRenderContext,
    canUseSnapshotLayer,
    shouldThrottleRender,
    createCannotRenderState,
    createCannotRenderTrace,
    createActorRenderOptions,
    createRenderBeginTrace,
    createSnapshotRenderOptions,
    createSnapshotTrace,
    createFullRenderOptions,
    createFullTrace,
  });

  global.WorldMapRuntimeRenderPolicy = WorldMapRuntimeRenderPolicy;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapRuntimeRenderPolicy;
})(typeof window !== 'undefined' ? window : globalThis);
