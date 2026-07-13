(function (global) {
  const TUTORIAL_HIGHLIGHT_LAYER_NAME = 'tutorialHighlight';

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

  function getRuntime(renderer = {}) {
    return renderer.h5Runtime || renderer.host?.h5Runtime || null;
  }

  function getPixelRatio(renderer = {}) {
    const runtime = getRuntime(renderer);
    return Math.min(2, Math.max(1, Number(
      runtime?.pixelRatio
      || runtime?.runtime?.devicePixelRatio
      || renderer.host?.pixelRatio
      || global.devicePixelRatio,
    ) || 1));
  }

  function getLayerRect(renderer = {}) {
    const runtime = getRuntime(renderer);
    return {
      x: 0,
      y: 0,
      width: Math.max(1, Math.ceil(Number(runtime?.width || renderer.width) || 1)),
      height: Math.max(1, Math.ceil(Number(runtime?.height || renderer.height) || 1)),
    };
  }

  function getLayerCanvas(renderer = {}) {
    const runtime = getRuntime(renderer);
    return runtime?.getLayerCanvas?.(TUTORIAL_HIGHLIGHT_LAYER_NAME)
      || renderer.host?.getCanvasLayerCanvas?.(TUTORIAL_HIGHLIGHT_LAYER_NAME)
      || null;
  }

  function setVisible(renderer = {}, visible = true) {
    if (typeof renderer.setCanvasLayerVisible === 'function') {
      return renderer.setCanvasLayerVisible(TUTORIAL_HIGHLIGHT_LAYER_NAME, visible !== false);
    }
    return getRuntime(renderer)?.setLayerVisible?.(
      TUTORIAL_HIGHLIGHT_LAYER_NAME,
      visible !== false,
    ) || false;
  }

  function begin(renderer = {}) {
    const runtime = getRuntime(renderer);
    const canEnsureLayer = typeof renderer.ensureCanvasLayer === 'function'
      || typeof runtime?.ensureLayerCanvas === 'function';
    if (!canEnsureLayer) return null;
    const layerRect = getLayerRect(renderer);
    const overrides = {
      pixelRatio: getPixelRatio(renderer),
      rect: layerRect,
    };
    const canvas = typeof renderer.ensureCanvasLayer === 'function'
      ? renderer.ensureCanvasLayer(TUTORIAL_HIGHLIGHT_LAYER_NAME, overrides)
      : runtime.ensureLayerCanvas(
        TUTORIAL_HIGHLIGHT_LAYER_NAME,
        CanvasLayerRegistry?.getLayerOptions?.(TUTORIAL_HIGHLIGHT_LAYER_NAME, overrides)
          || overrides,
      );
    const ctx = canvas?.getContext?.('2d') || null;
    if (!ctx) return null;
    ctx.clearRect?.(0, 0, layerRect.width, layerRect.height);
    setVisible(renderer, true);
    return ctx;
  }

  function clear(renderer = {}, hide = false) {
    const canvas = getLayerCanvas(renderer);
    const ctx = canvas?.getContext?.('2d') || null;
    if (ctx) {
      const layerRect = getLayerRect(renderer);
      ctx.clearRect?.(0, 0, layerRect.width, layerRect.height);
    }
    if (hide) setVisible(renderer, false);
    return Boolean(ctx);
  }

  function withHighlightContext(renderer = {}, ctx = null, callback = null) {
    if (!ctx || typeof callback !== 'function') return undefined;
    const hadOwnCtx = Object.prototype.hasOwnProperty.call(renderer, 'highlightCtx');
    const previousCtx = renderer.highlightCtx;
    const draw = () => {
      renderer.highlightCtx = ctx;
      try {
        return callback();
      } finally {
        if (hadOwnCtx) renderer.highlightCtx = previousCtx;
        else delete renderer.highlightCtx;
      }
    };
    const owner = renderer.host || null;
    if (typeof owner?.withRenderCtx === 'function') return owner.withRenderCtx(ctx, draw);
    if (!owner) return draw();
    const hadOwnOwnerCtx = Object.prototype.hasOwnProperty.call(owner, 'ctx');
    const previousOwnerCtx = owner.ctx;
    owner.ctx = ctx;
    try {
      return draw();
    } finally {
      if (hadOwnOwnerCtx) owner.ctx = previousOwnerCtx;
      else delete owner.ctx;
    }
  }

  const api = {
    TUTORIAL_HIGHLIGHT_LAYER_NAME,
    begin,
    clear,
    getLayerRect,
    withHighlightContext,
  };

  global.TutorialHighlightLayer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
