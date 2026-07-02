(function (global) {
  function setFrameStart(surfaceState, options = {}, nowFactory = Date.now) {
    const optionNow = Number(options.now);
    const now = Number.isFinite(optionNow) ? optionNow : nowFactory();
    surfaceState.frameNow = now;
    surfaceState.lastRenderOptions = options || {};
    if (options.epochNowMs !== undefined) surfaceState.epochNowMs = options.epochNowMs;
    if (options.serverNowMs !== undefined) surfaceState.serverNowMs = options.serverNowMs;
    surfaceState.famousSkillHitTargets = [];
    surfaceState.activeFamousSkillTooltip = null;
    return now;
  }

  function setFrameEnd(surfaceState) {
    surfaceState.frameNow = 0;
  }

  function getNow(surfaceState, nowFactory = Date.now) {
    return Number(surfaceState.frameNow) || nowFactory();
  }

  function updateFps(surfaceState, now = Date.now()) {
    const timestamp = Number(now);
    if (!Number.isFinite(timestamp)) return Number(surfaceState.currentFps) || 0;
    if (!surfaceState.fpsLastFrameAt) {
      surfaceState.fpsLastFrameAt = timestamp;
      surfaceState.fpsLastPaintAt = timestamp;
      return Number(surfaceState.currentFps) || 0;
    }
    const delta = Math.max(4, timestamp - surfaceState.fpsLastFrameAt);
    surfaceState.fpsLastFrameAt = timestamp;
    if (delta > 250) return Number(surfaceState.currentFps) || 0;
    const fps = Math.min(120, 1000 / delta);
    if (!Array.isArray(surfaceState.fpsSamples)) surfaceState.fpsSamples = [];
    surfaceState.fpsSamples.push(fps);
    if (surfaceState.fpsSamples.length > 30) surfaceState.fpsSamples.shift();
    const average = surfaceState.fpsSamples.reduce((sum, value) => sum + value, 0) / surfaceState.fpsSamples.length;
    surfaceState.currentFps = Math.round(average >= 58 && average <= 64 ? 60 : average);
    return surfaceState.currentFps;
  }

  function updatePaintedFps(surfaceState, options = {}, now = getNow(surfaceState)) {
    if (
      !surfaceState.fpsLastPaintAt
      || now - surfaceState.fpsLastPaintAt >= 180
      || (!surfaceState.fpsLastPaintedValue && surfaceState.currentFps)
    ) {
      surfaceState.fpsLastPaintAt = now;
      surfaceState.fpsLastPaintedValue = Math.max(0, Math.round(Number(options.fps ?? surfaceState.currentFps) || 0));
    }
    return Number(surfaceState.fpsLastPaintedValue) || 0;
  }

  const api = {
    setFrameStart,
    setFrameEnd,
    getNow,
    updateFps,
    updatePaintedFps,
  };

  global.CanvasSurfaceFrameClock = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
