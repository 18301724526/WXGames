// CanvasLayoutService -- SHAPE-A stateless pure-math layout/animation helpers extracted
// from CanvasGameRenderer (god-file re-decomposition slice 14), bodies verbatim.
//
// Slice 14 planned a CanvasLayoutService/CanvasAnimationEasing pair, but the renderer
// only owns one pure layout-math body (parsePixelValue) -- the rest of its geometry
// methods are child-renderer delegators -- so per the fewer-than-3-functions rule the
// easing/interpolation math is merged into this single module instead of a near-empty
// second file. All functions are pure (args in -> value out, no host reads);
// getTransitionFrame is param-lifted: the renderer passes this.getNow() as `now`.
(function (global) {
  function parsePixelValue(value) {
    if (typeof value === 'number') return value;
    const parsed = Number(String(value ?? '').replace('px', ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function easeOutCubic(value) {
    const t = Math.max(0, Math.min(1, Number(value) || 0));
    return 1 - (1 - t) ** 3;
  }

  function getTransitionFrame(transition = null, now = 0) {
    if (!transition) return null;
    const startedAt = Number(transition.startedAt);
    if (!Number.isFinite(startedAt)) return null;
    const durationMs = Math.max(1, Number(transition.durationMs) || 220);
    const progress = Math.max(0, Math.min(1, (now - startedAt) / durationMs));
    if (progress >= 1) return null;
    return {
      progress,
      eased: easeOutCubic(progress),
      direction: Number(transition.direction) < 0 ? -1 : 1,
    };
  }

  function interpolateRect(fromRect = {}, toRect = {}, progress = 1) {
    const eased = easeOutCubic(progress);
    const read = (rect, key, fallback = 0) => Number(rect?.[key] ?? fallback) || 0;
    const lerp = (from, to) => from + (to - from) * eased;
    const left = lerp(read(fromRect, 'left'), read(toRect, 'left'));
    const top = lerp(read(fromRect, 'top'), read(toRect, 'top'));
    const width = lerp(read(fromRect, 'width'), read(toRect, 'width'));
    const height = lerp(read(fromRect, 'height'), read(toRect, 'height'));
    return {
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
    };
  }

  const api = Object.freeze({
    parsePixelValue,
    easeOutCubic,
    getTransitionFrame,
    interpolateRect,
  });
  global.CanvasLayoutService = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
