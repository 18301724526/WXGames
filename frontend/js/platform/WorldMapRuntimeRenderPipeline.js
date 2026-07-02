(function (global) {
  var RenderPolicy = global.WorldMapRuntimeRenderPolicy;
  if (typeof module !== 'undefined' && module.exports && !RenderPolicy) {
    RenderPolicy = require('./WorldMapRuntimeRenderPolicy');
  }

  function summarizeMission(mission) {
    return global.WorldMarchTrace?.summarizeMission?.(mission);
  }

  function publishStateToRenderer(host, state) {
    return state;
  }

  function commitFrameState(host, patch = {}) {
    if (typeof host?.commitFrameState === 'function') return host.commitFrameState(patch);
    return null;
  }

  function handleCannotRender(host, state) {
    const trace = RenderPolicy.createCannotRenderTrace({
      enabled: host.enabled,
      renderer: host.renderer,
      presenter: host.presenter,
    }, state);
    global.WorldMarchTrace?.warn?.('runtime:render:cannotRender', {
      ...trace,
      activeMission: summarizeMission(state?.worldExplorerState?.activeMission),
    });
    host.renderer?.clearAll?.();
    const nextState = RenderPolicy.createCannotRenderState();
    host.resetHitTargetState?.();
    commitFrameState(host, {
      hasBakedMapLayer: nextState.hasBakedMapLayer,
      lastMapDataSignature: nextState.lastMapDataSignature,
      mapBakeDirty: nextState.mapBakeDirty,
    });
    return false;
  }

  function logRenderBegin(state, renderContext, runtimeState) {
    const trace = RenderPolicy.createRenderBeginTrace(state, renderContext, runtimeState);
    global.WorldMarchTrace?.logDedup?.('runtime:render:begin', trace.keyParts.join('|'), {
      ...trace.data,
      activeMission: summarizeMission(trace.data.activeMission),
    });
  }

  function logSnapshotRender(state, rendered, context) {
    const trace = RenderPolicy.createSnapshotTrace(state, rendered, context);
    global.WorldMarchTrace?.logDedup?.('runtime:render:snapshot', trace.keyParts.join('|'), {
      ...trace.data,
      activeMission: summarizeMission(trace.data.activeMission),
    });
  }

  function logFullRender(state, rendered, context) {
    const trace = RenderPolicy.createFullTrace(state, rendered, context.runtimeState, context.epochNowMs);
    global.WorldMarchTrace?.logDedup?.('runtime:render:full', trace.keyParts.join('|'), {
      ...trace.data,
      activeMission: summarizeMission(trace.data.activeMission),
    });
  }

  function renderSnapshotLayer(host, state, options, context) {
    const rendered = host.renderer.renderWorldMapSnapshotLayer(state, RenderPolicy.createSnapshotRenderOptions(options, {
      epochNowMs: context.epochNowMs,
      uiState: context.uiState,
      topBarBottom: context.topBarBottom,
      waterTimeMs: host.waterTimeMs,
    }));
    if (rendered && typeof host.renderer.renderWorldMapActorLayer === 'function') {
      const frameContext = host.renderer.worldMapRenderState?.lastWorldTileMapContext
        || host.renderer.lastWorldTileMapContext
        || host.renderer.worldMapLayerRenderer?.lastWorldTileMapContext
        || host.getLastTileMapContext?.()
        || host.lastTileMapContext
        || null;
      if (frameContext) commitFrameState(host, { lastTileMapContext: frameContext });
      host.renderer.renderWorldMapActorLayer(state, RenderPolicy.createActorRenderOptions(options, {
        epochNowMs: context.epochNowMs,
        uiState: context.uiState,
        worldMapRuntimeContext: frameContext,
      }));
      host.syncHitTargetsFromRenderer?.({ preserveOnEmpty: true });
    }
    host.syncWaterAnimationFlag(context.uiState);
    commitFrameState(host, {
      lastLayout: host.getLayerLayout(state, { topBarBottom: context.topBarBottom }),
    });
    logSnapshotRender(state, rendered, {
      epochNowMs: context.epochNowMs,
      hitTargetCount: host.getHitTargets?.().length || 0,
    });
    return rendered;
  }

  function renderFullLayer(host, state, options, context) {
    host.syncMapDataSignature(state, context.renderOptions);
    const rendered = host.renderer.renderWorldMapLayer(state, RenderPolicy.createFullRenderOptions(options, {
      epochNowMs: context.epochNowMs,
      uiState: context.uiState,
      topBarBottom: context.topBarBottom,
      dragging: context.dragging,
      snapshotOnly: context.snapshotOnly,
      waterTimeMs: host.waterTimeMs,
    }));
    const lastLayout = host.getLayerLayout(state, { topBarBottom: context.topBarBottom });
    commitFrameState(host, { lastLayout });
    const renderResult = host.renderer.worldMapRenderState?.lastWorldMapLayerRenderResult
      || host.renderer.lastWorldMapLayerRenderResult
      || host.renderer.worldMapLayerRenderer?.lastWorldMapLayerRenderResult
      || null;
    const drewFrame = rendered && renderResult?.drewFrame !== false;
    if (rendered && !drewFrame) {
      host.syncWaterAnimationFlag(context.uiState);
    }
    if (drewFrame) {
      host.syncWaterAnimationFlag(context.uiState);
      const lastTileMapContext = host.renderer.worldMapRenderState?.lastWorldTileMapContext
        || host.renderer.lastWorldTileMapContext
        || host.renderer.worldMapLayerRenderer?.lastWorldTileMapContext
        || host.getLastTileMapContext()
        || null;
      host.commitBakedFrame?.(lastTileMapContext, { lastLayout });
      host.markBakedLayerCommitted?.();
      if (typeof host.renderer.renderWorldMapActorLayer === 'function') {
        host.renderer.renderWorldMapActorLayer(state, RenderPolicy.createActorRenderOptions(options, {
          epochNowMs: context.epochNowMs,
          uiState: context.uiState,
          worldMapRuntimeContext: lastTileMapContext,
        }));
      }
      host.markBakedCamera(host.camera);
      host.syncHitTargetsFromRenderer();
    }
    logFullRender(state, rendered, {
      epochNowMs: context.epochNowMs,
      runtimeState: {
        hasBakedMapLayer: host.hasBakedMapLayer,
        mapBakeDirty: host.mapBakeDirty,
        hitTargetCount: host.getHitTargets?.().length || 0,
      },
    });
    return rendered;
  }

  function render(host, options = {}) {
    const state = options.state || host.getState();
    publishStateToRenderer(host, state);
    if (!host.canRender(state)) return handleCannotRender(host, state);

    const dragging = host.isDragging();
    const renderContext = RenderPolicy.createRenderContext(options, { dragging });
    const mapBakeDirty = renderContext.shouldCheckBakeDirty
      ? host.isMapBakeDirty(state, renderContext.renderOptions)
      : host.mapBakeDirty;
    const canUseSnapshotLayer = RenderPolicy.canUseSnapshotLayer(renderContext, {
      hasBakedMapLayer: host.hasBakedMapLayer,
      mapBakeDirty,
      canRenderSnapshotLayer: typeof host.renderer.renderWorldMapSnapshotLayer === 'function',
    });
    logRenderBegin(state, renderContext, {
      canUseSnapshotLayer,
      hasBakedMapLayer: host.hasBakedMapLayer,
      mapBakeDirty: host.mapBakeDirty,
    });

    const now = host.now();
    if (RenderPolicy.shouldThrottleRender(options, {
      nowMs: now,
      lastRenderAt: host.lastRenderAt,
      frameMs: host.frameMs,
    })) return false;
    commitFrameState(host, { lastRenderAt: now });

    const uiState = host.getCameraUiState();
    const topBarBottom = options.topBarBottom ?? host.getTopBarBottom(state);
    const frameContext = {
      dragging,
      epochNowMs: renderContext.renderOptions.epochNowMs,
      renderOptions: renderContext.renderOptions,
      snapshotOnly: renderContext.snapshotOnly,
      topBarBottom,
      uiState,
    };
    if (canUseSnapshotLayer) return renderSnapshotLayer(host, state, options, frameContext);
    return renderFullLayer(host, state, options, frameContext);
  }

  const WorldMapRuntimeRenderPipeline = Object.freeze({
    publishStateToRenderer,
    handleCannotRender,
    renderSnapshotLayer,
    renderFullLayer,
    render,
  });

  global.WorldMapRuntimeRenderPipeline = WorldMapRuntimeRenderPipeline;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapRuntimeRenderPipeline;
})(typeof window !== 'undefined' ? window : globalThis);
