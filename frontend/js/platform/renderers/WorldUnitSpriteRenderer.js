(function (global) {
  function drawSprite(host = {}, x, y, scale = 1, framePath = '') {
    if (!framePath) return false;
    const image = host.getAsset?.(framePath);
    const sourceWidth = Number(image?.naturalWidth || image?.width || 0);
    const sourceHeight = Number(image?.naturalHeight || image?.height || 0);
    const ctx = host.ctx;
    if (!image || sourceWidth <= 0 || sourceHeight <= 0 || typeof ctx?.drawImage !== 'function') return false;
    const targetHeight = 68 * scale;
    const targetWidth = targetHeight * (sourceWidth / sourceHeight);
    const drawX = x - targetWidth * 0.5;
    const drawY = y - targetHeight + 11 * scale;
    ctx.save?.();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    ctx.beginPath?.();
    ctx.ellipse?.(x, y + 10 * scale, Math.max(13, targetWidth * 0.32), 5.5 * scale, -0.18, 0, Math.PI * 2);
    ctx.fill?.();
    ctx.drawImage(image, drawX, drawY, targetWidth, targetHeight);
    ctx.restore?.();
    return true;
  }

  function drawFallback(host = {}, x, y, scale = 1) {
    const ctx = host.ctx;
    if (!ctx) return;
    const now = host.getNow?.() || Date.now();
    const leg = Math.sin(now / 90) * 4 * scale;
    ctx.save?.();
    ctx.translate?.(x, y);
    ctx.scale?.(scale, scale);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
    ctx.beginPath?.();
    ctx.ellipse?.(0, 10, 15, 6, -0.18, 0, Math.PI * 2);
    ctx.fill?.();
    ctx.fillStyle = '#f0cf8a';
    ctx.strokeStyle = 'rgba(45, 31, 22, 0.92)';
    ctx.lineWidth = 2;
    ctx.beginPath?.();
    ctx.arc?.(0, -20, 7, 0, Math.PI * 2);
    ctx.fill?.();
    ctx.stroke?.();
    ctx.fillStyle = '#8c3d31';
    ctx.strokeStyle = 'rgba(48, 34, 22, 0.92)';
    ctx.lineWidth = 2;
    host.roundRectPath?.(-9, -12, 18, 23, 6);
    ctx.fill?.();
    ctx.stroke?.();
    ctx.strokeStyle = '#2c2318';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath?.();
    ctx.moveTo?.(-5, 10);
    ctx.lineTo?.(-7 + leg, 22);
    ctx.moveTo?.(5, 10);
    ctx.lineTo?.(7 - leg, 22);
    ctx.stroke?.();
    ctx.strokeStyle = '#d9bd73';
    ctx.lineWidth = 3;
    ctx.beginPath?.();
    ctx.moveTo?.(7, -7);
    ctx.lineTo?.(19, -14);
    ctx.stroke?.();
    ctx.restore?.();
  }

  function renderUnit(host = {}, x, y, scale = 1, framePath = '') {
    if (drawSprite(host, x, y, scale, framePath)) return true;
    drawFallback(host, x, y, scale);
    return false;
  }

  const api = {
    drawFallback,
    drawSprite,
    renderUnit,
  };

  global.WorldUnitSpriteRenderer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
