(function (global) {
  const TUTORIAL_DIALOGUE_LAYER_NAME = 'tutorialDialogue';
  const TUTORIAL_DIALOGUE_LAYER_Z_INDEX = 1001;

  function getPixelRatio() {
    return Math.min(2, Math.max(1, Number(global.devicePixelRatio) || 1));
  }

  function getLayerRect(renderer = {}) {
    const runtime = renderer.h5Runtime || null;
    return {
      x: 0,
      y: 0,
      width: Math.max(1, Math.ceil(Number(runtime?.width || renderer.width) || 1)),
      height: Math.max(1, Math.ceil(Number(runtime?.height || renderer.height) || 1)),
    };
  }

  function begin(renderer = {}) {
    const runtime = renderer.h5Runtime || null;
    if (!runtime?.ensureLayerCanvas) return null;
    const layerRect = getLayerRect(renderer);
    const canvas = runtime.ensureLayerCanvas(TUTORIAL_DIALOGUE_LAYER_NAME, {
      contextType: '2d',
      zIndex: TUTORIAL_DIALOGUE_LAYER_Z_INDEX,
      pixelRatio: getPixelRatio(),
      rect: layerRect,
    });
    const ctx = canvas?.getContext?.('2d') || null;
    if (!ctx) return null;
    runtime.setLayerVisible?.(TUTORIAL_DIALOGUE_LAYER_NAME, true);
    ctx.clearRect?.(0, 0, layerRect.width, layerRect.height);
    return ctx;
  }

  function clear(renderer = {}, hide = false) {
    const runtime = renderer.h5Runtime || null;
    const canvas = runtime?.getLayerCanvas?.(TUTORIAL_DIALOGUE_LAYER_NAME) || null;
    const ctx = canvas?.getContext?.('2d') || null;
    if (ctx) {
      const metrics = runtime.getLayerMetrics?.(TUTORIAL_DIALOGUE_LAYER_NAME) || {};
      ctx.clearRect?.(
        0,
        0,
        metrics.width || renderer.width || canvas.width || 1,
        metrics.height || renderer.height || canvas.height || 1,
      );
    }
    if (hide) runtime?.setLayerVisible?.(TUTORIAL_DIALOGUE_LAYER_NAME, false);
    return Boolean(ctx);
  }

  function withHostContext(renderer = {}, ctx = null, callback = null) {
    if (!ctx || typeof callback !== 'function') return undefined;
    const host = renderer.host || null;
    if (!host) return callback();
    const previousCtx = host.ctx;
    host.ctx = ctx;
    try {
      return callback();
    } finally {
      host.ctx = previousCtx;
    }
  }

  const api = {
    TUTORIAL_DIALOGUE_LAYER_NAME,
    TUTORIAL_DIALOGUE_LAYER_Z_INDEX,
    begin,
    clear,
    withHostContext,
  };

  global.TutorialDialogueLayer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
