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
      lastHitTargetSync: null,
      hitTargetSyncSequence: 0,
      hasBakedMapLayer: false,
      mapBakeDirty: true,
      lastMapDataSignature: '',
    };
  }

  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function createHitTargetFrameState(runtime = {}, syncState = null) {
    const source = syncState && typeof syncState === 'object' && !Array.isArray(syncState)
      ? syncState
      : (runtime?.lastHitTargetSync || {});
    const hitTargets = toArray(runtime?.hitTargets);
    const sourceHitTargetCount = Number(source.sourceHitTargetCount);
    const mapTargetCount = Number(source.mapTargetCount);
    return {
      actorTargetCount: Number(source.actorTargetCount) || 0,
      baseHitTargetCount: Number(source.baseHitTargetCount) || toArray(runtime?.baseHitTargets).length,
      hitTargetCount: Number(source.hitTargetCount) || hitTargets.length,
      hitTargets,
      hitTargetsFresh: Boolean(!source.preserved && (
        (Number.isFinite(sourceHitTargetCount) && sourceHitTargetCount > 0)
        || (Number.isFinite(mapTargetCount) && mapTargetCount > 0)
      )),
      hitTargetsPreserved: Boolean(source.preserved),
      mapTargetCount: Number.isFinite(mapTargetCount) ? mapTargetCount : 0,
      sourceHitTargetCount: Number.isFinite(sourceHitTargetCount) ? sourceHitTargetCount : hitTargets.length,
      syncSequence: Number(source.sequence) || 0,
    };
  }

  function createRenderResultVisualState(renderResult = null) {
    if (!renderResult || typeof renderResult !== 'object') return null;
    if (renderResult.rendered && renderResult.drewFrame !== false) {
      return { valid: true, reason: renderResult.reason || 'renderedFrame' };
    }
    if (renderResult.rendered && renderResult.drewFrame === false) {
      return { valid: false, reason: renderResult.reason || 'renderedWithoutFrame' };
    }
    return { valid: false, reason: renderResult.reason || 'renderMissed' };
  }

  function createRuntimeVisualLayerState(runtime = {}, options = {}) {
    const explicitValidity = options.bakedLayerValidity || options.visualLayerValidity || null;
    if (explicitValidity && typeof explicitValidity === 'object') {
      return {
        valid: Boolean(explicitValidity.valid),
        reason: explicitValidity.reason || (explicitValidity.valid ? 'valid' : 'invalid'),
        baked: explicitValidity.baked || null,
        backing: explicitValidity.backing || null,
        checks: explicitValidity.checks || null,
      };
    }
    if (typeof options.visualLayerValid === 'boolean') {
      return {
        valid: options.visualLayerValid,
        reason: options.visualLayerReason || (options.visualLayerValid ? 'valid' : 'invalid'),
      };
    }
    if (!runtime) return { valid: false, reason: 'missingRuntime' };
    if (!runtime.hasBakedMapLayer) return { valid: false, reason: 'notBaked' };
    if (runtime.mapBakeDirty) return { valid: false, reason: 'mapBakeDirty' };
    if (typeof runtime.isBakedLayerStateValid === 'function') {
      const valid = runtime.isBakedLayerStateValid(options.layerState);
      return {
        valid: Boolean(valid),
        reason: valid ? 'valid' : 'bakedLayerInvalid',
      };
    }
    return { valid: true, reason: 'valid' };
  }

  function createWorldMapFrameState(runtime = {}, options = {}) {
    const renderResultState = createRenderResultVisualState(options.renderResult || null);
    const runtimeVisualState = createRuntimeVisualLayerState(runtime, options);
    const visualState = renderResultState || runtimeVisualState;
    const hitTargetState = createHitTargetFrameState(runtime, options.hitTargetSync || null);
    const context = options.worldMapRuntimeContext
      || runtime?.getLastTileMapContext?.()
      || runtime?.lastTileMapContext
      || null;
    return {
      ...hitTargetState,
      context,
      rendered: Boolean(options.rendered),
      visualLayerValid: Boolean(visualState.valid),
      visualLayerReason: visualState.reason || '',
      visualLayerState: visualState,
    };
  }

  function canSkipWorldMapLayer(frameState = {}) {
    return Boolean(frameState?.visualLayerValid);
  }

  function createWorldMapCompositionOptions(options = {}, frameState = {}) {
    const state = frameState || {};
    const skipWorldMapLayer = canSkipWorldMapLayer(state);
    return {
      ...options,
      preserveCanvas: skipWorldMapLayer && options.preserveCanvas === true,
      skipWorldMapLayer,
      worldMapFrameState: state,
      worldMapRuntimeHitTargets: toArray(options.worldMapRuntimeHitTargets || state.hitTargets),
      worldMapRuntimeContext: options.worldMapRuntimeContext || state.context || null,
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
    createHitTargetFrameState,
    createRenderResultVisualState,
    createRuntimeVisualLayerState,
    createWorldMapCompositionOptions,
    createWorldMapFrameState,
    createRenderBeginTrace,
    createSnapshotRenderOptions,
    createSnapshotTrace,
    createFullRenderOptions,
    createFullTrace,
    canSkipWorldMapLayer,
  });

  global.WorldMapRuntimeRenderPolicy = WorldMapRuntimeRenderPolicy;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapRuntimeRenderPolicy;
})(typeof window !== 'undefined' ? window : globalThis);
