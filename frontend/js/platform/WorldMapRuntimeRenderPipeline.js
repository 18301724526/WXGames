(function (global) {
  var RenderPolicy = global.WorldMapRuntimeRenderPolicy;
  if (typeof module !== 'undefined' && module.exports && !RenderPolicy) {
    RenderPolicy = require('./WorldMapRuntimeRenderPolicy');
  }

  function summarizeMission(mission) {
    return global.WorldMarchTrace?.summarizeMission?.(mission);
  }

  function publishStateToRenderer(host, state) {
    host.lastGameState = state;
    host.lastWorldMarchState = state;
    const renderer = host.renderer;
    if (!renderer) return;
    renderer.lastGameState = state;
    renderer.lastWorldMarchState = state;
    if (renderer.worldMapRenderer) {
      renderer.worldMapRenderer.lastGameState = state;
      renderer.worldMapRenderer.lastWorldMarchState = state;
    }
    if (renderer.worldMapLayerRenderer) {
      renderer.worldMapLayerRenderer.lastGameState = state;
      renderer.worldMapLayerRenderer.lastWorldMarchState = state;
    }
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
    Object.assign(host, RenderPolicy.createCannotRenderState());
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
    host.syncWaterAnimationFlag(context.uiState);
    host.lastLayout = host.getLayerLayout(state, { topBarBottom: context.topBarBottom });
    logSnapshotRender(state, rendered, {
      epochNowMs: context.epochNowMs,
      hitTargetCount: host.hitTargets.length,
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
    host.lastLayout = host.getLayerLayout(state, { topBarBottom: context.topBarBottom });
    if (rendered) {
      host.syncWaterAnimationFlag(context.uiState);
      host.lastTileMapContext = host.getLastTileMapContext();
      host.hasBakedMapLayer = true;
      host.mapBakeDirty = false;
      host.markBakedCamera(host.camera);
      host.syncHitTargetsFromRenderer();
    }
    logFullRender(state, rendered, {
      epochNowMs: context.epochNowMs,
      runtimeState: {
        hasBakedMapLayer: host.hasBakedMapLayer,
        mapBakeDirty: host.mapBakeDirty,
        hitTargetCount: host.hitTargets.length,
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
    host.lastRenderAt = now;

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
