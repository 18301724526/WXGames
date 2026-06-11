(function (global) {
  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function hasNumber(value) {
    return value !== null
      && value !== undefined
      && Number.isFinite(Number(value));
  }

  function getNavigator(options = {}) {
    return options.navigator || global.navigator || {};
  }

  function isMobileNavigator(nav = {}) {
    const userAgent = String(nav.userAgent || '');
    return Boolean(Number(nav.maxTouchPoints) > 0
      || /Android|Mobile|iPhone|iPad|iPod/i.test(userAgent));
  }

  function getWaterAnimationDeviceFloorMs(options = {}) {
    const nav = getNavigator(options);
    const cores = toNumber(options.hardwareConcurrency ?? nav.hardwareConcurrency, 0);
    const memory = toNumber(options.deviceMemoryGb ?? options.deviceMemory ?? nav.deviceMemory, 0);
    const mobileLike = isMobileNavigator(nav);
    if ((memory > 0 && memory <= 4) || (mobileLike && cores > 0 && cores <= 4)) return 900;
    if ((memory > 0 && memory <= 6) || (mobileLike && cores > 0 && cores <= 6)) return 450;
    return 0;
  }

  function getSnapshotRenderOptions(waterTimeMs, fallbackWaterTimeMs = null) {
    return {
      force: true,
      reuseCachedWorldTileView: true,
      snapshotOnly: true,
      waterTimeMs: hasNumber(waterTimeMs) ? Number(waterTimeMs) : fallbackWaterTimeMs,
    };
  }

  function getWaterAnimationFrameMs(options = {}) {
    const animationFrameMs = Math.max(1, toNumber(options.animationFrameMs, 16));
    const fps = Math.max(1, toNumber(options.fps, 8));
    return Math.max(animationFrameMs, Math.round(1000 / fps), getWaterAnimationDeviceFloorMs(options));
  }

  function getLayerPadding(options = {}) {
    return Math.max(200, toNumber(options.dragCachePanRange, 180));
  }

  function getDragCooldownMs(value = 220) {
    return Math.max(0, toNumber(value, 220));
  }

  function isDragging(waterTimeMs) {
    return hasNumber(waterTimeMs);
  }

  function isDragCoolingDown(cooldownUntil, nowMs) {
    return toNumber(cooldownUntil) > toNumber(nowMs);
  }

  function getDragTransformLimit(layerPadding) {
    return Math.max(120, toNumber(layerPadding, 200) * 0.72);
  }

  function isDragTransformNearLimit(offset = {}, options = {}) {
    const limit = getDragTransformLimit(options.layerPadding);
    return Math.abs(toNumber(offset.x)) >= limit || Math.abs(toNumber(offset.y)) >= limit;
  }

  function getDragOffset(runtime = null) {
    if (runtime && typeof runtime.getCameraOffsetFromBaked === 'function') return runtime.getCameraOffsetFromBaked();
    return {
      x: toNumber(runtime?.dragLayerOffset?.x),
      y: toNumber(runtime?.dragLayerOffset?.y),
    };
  }

  function getWorldMapPan(uiState = {}) {
    return {
      x: toNumber(uiState.worldPanX),
      y: toNumber(uiState.worldPanY),
    };
  }

  function resolveRuntimeFrameOptions(options = {}, state = {}) {
    const runtimeDragging = Boolean(state.runtimeDragging);
    const reuseCachedWorldTileView = Boolean(options.reuseCachedWorldTileView || state.dragFrameActive || runtimeDragging);
    const waterTimeMs = hasNumber(options.waterTimeMs)
      ? Number(options.waterTimeMs)
      : (state.shellDragging || runtimeDragging || reuseCachedWorldTileView ? state.frozenWaterTimeMs : null);
    return {
      reuseCachedWorldTileView,
      snapshotOnly: Boolean(options.snapshotOnly || state.dragFrameActive || runtimeDragging),
      waterTimeMs,
    };
  }

  function isSnapshotWaterRefresh(options = {}) {
    return Boolean(options.snapshotOnly
      && options.reuseCachedWorldTileView
      && hasNumber(options.waterTimeMs));
  }

  const CanvasGameShellWorldMapRuntimePolicy = Object.freeze({
    toNumber,
    hasNumber,
    getWaterAnimationDeviceFloorMs,
    getSnapshotRenderOptions,
    getWaterAnimationFrameMs,
    getLayerPadding,
    getDragCooldownMs,
    isDragging,
    isDragCoolingDown,
    getDragTransformLimit,
    isDragTransformNearLimit,
    getDragOffset,
    getWorldMapPan,
    resolveRuntimeFrameOptions,
    isSnapshotWaterRefresh,
  });

  global.CanvasGameShellWorldMapRuntimePolicy = CanvasGameShellWorldMapRuntimePolicy;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasGameShellWorldMapRuntimePolicy;
})(typeof window !== 'undefined' ? window : globalThis);
