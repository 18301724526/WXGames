(function (global) {
  function normalizeWorkSize(width = 1, height = 1, cacheScale = 1) {
    const localW = Math.max(1, Math.ceil(Number(width) || 1));
    const localH = Math.max(1, Math.ceil(Number(height) || 1));
    const scale = Math.max(1, Number(cacheScale) || 1);
    return {
      width: localW,
      height: localH,
      scale,
      pixelWidth: Math.max(1, Math.ceil(localW * scale)),
      pixelHeight: Math.max(1, Math.ceil(localH * scale)),
    };
  }

  function assignWorkSize(work = {}, size = {}) {
    work.width = size.width;
    work.height = size.height;
    work.pixelWidth = size.pixelWidth;
    work.pixelHeight = size.pixelHeight;
    work.scale = size.scale;
    return work;
  }

  function resizeCanvas(canvas = null, pixelWidth = 1, pixelHeight = 1) {
    if (!canvas) return false;
    const width = Math.max(1, Math.ceil(Number(pixelWidth) || 1));
    const height = Math.max(1, Math.ceil(Number(pixelHeight) || 1));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    return true;
  }

  function createLayerWork(width = 1, height = 1, cacheScale = 1, options = {}) {
    const createCanvas = options.createCanvas;
    if (typeof createCanvas !== 'function') return null;
    const size = normalizeWorkSize(width, height, cacheScale);
    const canvas = createCanvas(size.pixelWidth, size.pixelHeight);
    const ctx = canvas?.getContext?.('2d') || null;
    if (!canvas || !ctx) return null;
    return assignWorkSize({ canvas, ctx }, size);
  }

  function getLayerCacheContext(store = {}, cacheName = '', width = 1, height = 1, cacheScale = 1, options = {}) {
    if (!store || !cacheName) return null;
    const size = normalizeWorkSize(width, height, cacheScale);
    const cached = store[cacheName];
    if (cached?.canvas && cached?.ctx) {
      resizeCanvas(cached.canvas, size.pixelWidth, size.pixelHeight);
      return assignWorkSize(cached, size);
    }
    const work = createLayerWork(size.width, size.height, size.scale, options);
    if (!work) return null;
    store[cacheName] = work;
    return work;
  }

  function getVisibleBlit(work = {}, layout = {}, clipFrame = null) {
    if (!work?.canvas || !layout?.frame) return null;
    const drawX = Number(layout.drawX) || 0;
    const drawY = Number(layout.drawY) || 0;
    const frameWidth = Math.max(1, Number(layout.frame.width) || 1);
    const frameHeight = Math.max(1, Number(layout.frame.height) || 1);
    const clip = clipFrame || { x: drawX, y: drawY, width: frameWidth, height: frameHeight };
    const clipX = Number(clip.x) || 0;
    const clipY = Number(clip.y) || 0;
    const clipWidth = Math.max(0, Number(clip.width) || 0);
    const clipHeight = Math.max(0, Number(clip.height) || 0);
    const visibleX = Math.max(drawX, clipX);
    const visibleY = Math.max(drawY, clipY);
    const visibleRight = Math.min(drawX + frameWidth, clipX + clipWidth);
    const visibleBottom = Math.min(drawY + frameHeight, clipY + clipHeight);
    const visibleWidth = Math.max(0, visibleRight - visibleX);
    const visibleHeight = Math.max(0, visibleBottom - visibleY);
    if (visibleWidth <= 0 || visibleHeight <= 0) return {
      empty: true,
      drawX: visibleX,
      drawY: visibleY,
      drawWidth: 0,
      drawHeight: 0,
    };
    const scale = Math.max(1, Number(work.scale) || 1);
    const sourceX = Math.max(0, (visibleX - drawX) * scale);
    const sourceY = Math.max(0, (visibleY - drawY) * scale);
    const sourceWidth = Math.min(
      Math.max(1, visibleWidth * scale),
      Math.max(1, (Number(work.canvas.width) || sourceX + visibleWidth * scale) - sourceX),
    );
    const sourceHeight = Math.min(
      Math.max(1, visibleHeight * scale),
      Math.max(1, (Number(work.canvas.height) || sourceY + visibleHeight * scale) - sourceY),
    );
    return {
      empty: false,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      drawX: visibleX,
      drawY: visibleY,
      drawWidth: sourceWidth / scale,
      drawHeight: sourceHeight / scale,
    };
  }

  function drawLayerCache(targetCtx = null, work = {}, layout = {}, clipFrame = null) {
    if (!work?.canvas || !layout?.frame || typeof targetCtx?.drawImage !== 'function') return false;
    const blit = getVisibleBlit(work, layout, clipFrame);
    if (!blit) return false;
    if (blit.empty) return true;
    targetCtx.drawImage(
      work.canvas,
      blit.sourceX,
      blit.sourceY,
      blit.sourceWidth,
      blit.sourceHeight,
      blit.drawX,
      blit.drawY,
      blit.drawWidth,
      blit.drawHeight,
    );
    return true;
  }

  const api = {
    normalizeWorkSize,
    assignWorkSize,
    resizeCanvas,
    createLayerWork,
    getLayerCacheContext,
    getVisibleBlit,
    drawLayerCache,
  };

  global.WorldMapLayerCacheStore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
