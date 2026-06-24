(function (global) {
  const TUTORIAL_DIALOGUE_LAYER_NAME = 'tutorialDialogue';

  const CanvasLayerRegistry = (() => {
    if (global.CanvasLayerRegistry) return global.CanvasLayerRegistry;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../CanvasLayerRegistry');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

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
    const canEnsureLayer = typeof renderer.ensureCanvasLayer === 'function'
      || typeof runtime?.ensureLayerCanvas === 'function';
    if (!canEnsureLayer) return null;
    const layerRect = getLayerRect(renderer);
    const overrides = {
      pixelRatio: getPixelRatio(),
      rect: layerRect,
    };
    const canvas = typeof renderer.ensureCanvasLayer === 'function'
      ? renderer.ensureCanvasLayer(TUTORIAL_DIALOGUE_LAYER_NAME, overrides)
      : runtime.ensureLayerCanvas(
        TUTORIAL_DIALOGUE_LAYER_NAME,
        CanvasLayerRegistry?.getLayerOptions?.(TUTORIAL_DIALOGUE_LAYER_NAME, overrides) || overrides,
      );
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
    begin,
    clear,
    withHostContext,
  };

  global.TutorialDialogueLayer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
