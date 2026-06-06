(function (global) {
  const DEFAULT_FRAME_ASPECT_RATIO = 9 / 16;

  function getBrowserViewportSize(runtime = {}, documentRef = null) {
    const vv = runtime.visualViewport;
    const docElement = documentRef?.documentElement || {};
    return {
      width: Math.max(1, Math.floor(vv?.width || runtime.innerWidth || docElement.clientWidth || 390)),
      height: Math.max(1, Math.floor(vv?.height || runtime.innerHeight || docElement.clientHeight || 844)),
    };
  }

  function getViewportFrame(viewport = {}, options = {}) {
    const browserWidth = Math.max(1, Number(viewport.width) || 390);
    const browserHeight = Math.max(1, Number(viewport.height) || 844);
    if (options.lockAspectRatio === false) {
      return {
        x: 0,
        y: 0,
        width: Math.floor(browserWidth),
        height: Math.floor(browserHeight),
        viewportWidth: Math.floor(browserWidth),
        viewportHeight: Math.floor(browserHeight),
      };
    }

    const targetRatio = Math.max(0.1, Number(options.frameAspectRatio) || DEFAULT_FRAME_ASPECT_RATIO);
    let width = browserWidth;
    let height = width / targetRatio;
    if (height > browserHeight) {
      height = browserHeight;
      width = height * targetRatio;
    }
    const gameWidth = Math.max(1, Math.round(width));
    const gameHeight = Math.max(1, Math.round(height));
    return {
      x: Math.max(0, Math.floor((browserWidth - gameWidth) / 2)),
      y: Math.max(0, Math.floor((browserHeight - gameHeight) / 2)),
      width: gameWidth,
      height: gameHeight,
      viewportWidth: Math.floor(browserWidth),
      viewportHeight: Math.floor(browserHeight),
    };
  }

  function normalizeViewportFrame(frame = {}) {
    return {
      x: Number(frame.x) || 0,
      y: Number(frame.y) || 0,
      width: Math.max(1, Number(frame.width) || 1),
      height: Math.max(1, Number(frame.height) || 1),
      viewportWidth: Math.max(1, Number(frame.viewportWidth) || Number(frame.width) || 1),
      viewportHeight: Math.max(1, Number(frame.viewportHeight) || Number(frame.height) || 1),
    };
  }

  function applyViewportFrame(target = {}, frame = {}) {
    const nextFrame = normalizeViewportFrame(frame);
    target.frameRect = nextFrame;
    target.viewportWidth = nextFrame.viewportWidth;
    target.viewportHeight = nextFrame.viewportHeight;
    target.width = nextFrame.width;
    target.height = nextFrame.height;
    return nextFrame;
  }

  function applyCanvasLayerStyle(canvas, options = {}) {
    if (!canvas?.style) return;
    const padding = Math.max(0, Number(options.padding ?? canvas._viewportPadding) || 0);
    canvas._viewportPadding = padding;
    canvas.style.position = 'fixed';
    canvas.style.inset = 'auto';
    canvas.style.display = 'block';
    canvas.style.pointerEvents = options.pointerEvents || 'none';
    canvas.style.touchAction = 'none';
    canvas.style.zIndex = String(options.zIndex ?? 998);
    canvas.style.background = 'transparent';
    canvas.style.transformOrigin = '0 0';
    canvas.style.backfaceVisibility = 'hidden';
  }

  function shouldClipLayerToFrame(options = {}, canvas = null) {
    if (options.clipToFrame !== undefined) return Boolean(options.clipToFrame);
    const padding = Math.max(0, Number(options.padding ?? canvas?._viewportPadding) || 0);
    return !options.rect && padding > 0;
  }

  function applyLayerHostStyle(host, state = {}, options = {}) {
    if (!host?.style) return;
    const frame = state.frameRect || { x: 0, y: 0, width: state.width, height: state.height };
    host.style.position = 'fixed';
    host.style.inset = 'auto';
    host.style.left = `${Number(frame.x) || 0}px`;
    host.style.top = `${Number(frame.y) || 0}px`;
    host.style.width = `${Math.max(1, Number(frame.width) || state.width || 1)}px`;
    host.style.height = `${Math.max(1, Number(frame.height) || state.height || 1)}px`;
    host.style.overflow = 'hidden';
    host.style.pointerEvents = 'none';
    host.style.zIndex = String(options.zIndex ?? 998);
    host.style.background = 'transparent';
    host.style.transformOrigin = '0 0';
  }

  function getLayerMetrics(canvas = null, state = {}) {
    const padding = Math.max(0, Number(canvas?._viewportPadding) || 0);
    const fixedRect = canvas?._fixedRect || null;
    return {
      width: fixedRect ? Math.max(1, Number(fixedRect.width) || 1) : state.width + padding * 2,
      height: fixedRect ? Math.max(1, Number(fixedRect.height) || 1) : state.height + padding * 2,
      viewportWidth: state.width,
      viewportHeight: state.height,
      browserWidth: state.viewportWidth || state.width,
      browserHeight: state.viewportHeight || state.height,
      frameX: Number(state.frameRect?.x) || 0,
      frameY: Number(state.frameRect?.y) || 0,
      padding,
      rect: fixedRect,
    };
  }

  function resizeCanvas(canvas, state = {}) {
    if (!canvas) return null;
    const padding = Math.max(0, Number(canvas._viewportPadding) || 0);
    const fixedRect = canvas._fixedRect || null;
    const logicalWidth = fixedRect ? Math.max(1, Number(fixedRect.width) || 1) : state.width + padding * 2;
    const logicalHeight = fixedRect ? Math.max(1, Number(fixedRect.height) || 1) : state.height + padding * 2;
    const pixelRatio = Math.max(1, Number(canvas._pixelRatioOverride) || state.pixelRatio || 1);
    const nextWidth = Math.floor(logicalWidth * pixelRatio);
    const nextHeight = Math.floor(logicalHeight * pixelRatio);
    if (canvas.width !== nextWidth) canvas.width = nextWidth;
    if (canvas.height !== nextHeight) canvas.height = nextHeight;
    if (canvas.style) {
      const frame = state.frameRect || { x: 0, y: 0 };
      const left = fixedRect ? Number(fixedRect.x) || 0 : -padding;
      const top = fixedRect ? Number(fixedRect.y) || 0 : -padding;
      const layerHost = canvas._layerHost || null;
      if (layerHost) applyLayerHostStyle(layerHost, state, { zIndex: canvas.style.zIndex });
      canvas.style.position = layerHost ? 'absolute' : 'fixed';
      canvas.style.inset = 'auto';
      canvas.style.left = `${layerHost ? left : (Number(frame.x) || 0) + left}px`;
      canvas.style.top = `${layerHost ? top : (Number(frame.y) || 0) + top}px`;
      canvas.style.width = `${logicalWidth}px`;
      canvas.style.height = `${logicalHeight}px`;
    }
    if (canvas._contextType && canvas._contextType !== '2d') return canvas;
    const ctx = canvas.getContext?.('2d');
    if (ctx) {
      if (typeof ctx.setTransform === 'function') ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      else if (typeof ctx.scale === 'function') ctx.scale(pixelRatio, pixelRatio);
    }
    return canvas;
  }

  function toCanvasPoint(canvas = null, state = {}, event = {}) {
    const rect = canvas?.getBoundingClientRect?.() || { left: 0, top: 0, width: state.width, height: state.height };
    const touch = event.changedTouches?.[0] || event.touches?.[0] || event;
    const scaleX = rect.width ? state.width / rect.width : 1;
    const scaleY = rect.height ? state.height / rect.height : 1;
    return {
      x: (Number(touch.clientX ?? touch.pageX ?? touch.x ?? 0) - rect.left) * scaleX,
      y: (Number(touch.clientY ?? touch.pageY ?? touch.y ?? 0) - rect.top) * scaleY,
    };
  }

  const api = {
    DEFAULT_FRAME_ASPECT_RATIO,
    getBrowserViewportSize,
    getViewportFrame,
    normalizeViewportFrame,
    applyViewportFrame,
    applyCanvasLayerStyle,
    shouldClipLayerToFrame,
    applyLayerHostStyle,
    getLayerMetrics,
    resizeCanvas,
    toCanvasPoint,
  };

  global.H5CanvasViewport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
