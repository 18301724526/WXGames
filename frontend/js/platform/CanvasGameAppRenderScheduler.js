(function (global) {
  var WorldMapRuntimePolicy = global.WorldMapRuntimePolicy;
  if (typeof module !== 'undefined' && module.exports && !WorldMapRuntimePolicy) {
    WorldMapRuntimePolicy = require('./WorldMapRuntimePolicy');
  }

  function now(host = {}) {
    return host.runtime?.now?.() || Date.now();
  }

  function wait(host = {}, ms = 0) {
    const delay = Math.max(0, Number(ms) || 0);
    if (delay <= 0) return Promise.resolve();
    if (host.scheduler && typeof host.scheduler.setTimeout === 'function') {
      return new Promise((resolve) => host.scheduler.setTimeout(resolve, delay));
    }
    if (typeof setTimeout === 'function') {
      return new Promise((resolve) => setTimeout(resolve, delay));
    }
    return Promise.resolve();
  }

  function getRequestAnimationFrame(host = {}) {
    const raf = host.runtime?.requestAnimationFrame || host.scheduler?.requestAnimationFrame;
    const owner = host.runtime?.requestAnimationFrame ? host.runtime : host.scheduler;
    return typeof raf === 'function' ? raf.bind(owner) : null;
  }

  function getAnimationFrameMs(host = {}) {
    return host.canvasShell?.getAnimationFrameMs?.() || 16;
  }

  function getTransitionDurationMs() {
    return 220;
  }

  function getWorldMapDragCooldownMs() {
    return 220;
  }

  function getWorldTileWaterAnimationFrameMs(host = {}) {
    if (host.canvasShell?.getWorldTileWaterAnimationFrameMs) return host.canvasShell.getWorldTileWaterAnimationFrameMs();
    const fps = Number(host.renderer?.getWorldTileWaterAnimationFps?.() || 8);
    if (WorldMapRuntimePolicy?.getWaterAnimationFrameMs) {
      return WorldMapRuntimePolicy.getWaterAnimationFrameMs({
        animationFrameMs: getAnimationFrameMs(host),
        fps,
      });
    }
    return Math.max(getAnimationFrameMs(host), Math.round(1000 / Math.max(1, fps)));
  }

  function getIntervalHost(host = {}) {
    if (typeof host.scheduler?.setInterval === 'function') return host.scheduler;
    if (typeof host.runtime?.setInterval === 'function') return host.runtime;
    return null;
  }

  function setIntervalForHost(host = {}, callback, delay) {
    const timerHost = getIntervalHost(host);
    const setIntervalFn = timerHost?.setInterval || (typeof setInterval === 'function' ? setInterval : null);
    if (!setIntervalFn) return null;
    return timerHost ? setIntervalFn.call(timerHost, callback, delay) : setIntervalFn(callback, delay);
  }

  function clearIntervalForHost(host = {}, timer) {
    if (!timer) return false;
    if (typeof host.scheduler?.clearInterval === 'function') host.scheduler.clearInterval(timer);
    else if (typeof host.runtime?.clearInterval === 'function') host.runtime.clearInterval(timer);
    else if (typeof clearInterval === 'function') clearInterval(timer);
    return true;
  }

  const CanvasGameAppRenderScheduler = Object.freeze({
    now,
    wait,
    getRequestAnimationFrame,
    getAnimationFrameMs,
    getTransitionDurationMs,
    getWorldMapDragCooldownMs,
    getWorldTileWaterAnimationFrameMs,
    getIntervalHost,
    setIntervalForHost,
    clearIntervalForHost,
  });

  global.CanvasGameAppRenderScheduler = CanvasGameAppRenderScheduler;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasGameAppRenderScheduler;
})(typeof window !== 'undefined' ? window : globalThis);
