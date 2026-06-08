(function (global) {
  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function toLegacyAxis(value, fallback = 0) {
    return Number(value) || Number(fallback) || 0;
  }

  function createInitialCamera(options = {}) {
    return {
      x: toLegacyAxis(options.camera?.x, options.initialPanX),
      y: toLegacyAxis(options.camera?.y, options.initialPanY),
    };
  }

  function createCameraUiState(base = {}, camera = {}) {
    return {
      ...(base || {}),
      worldPanX: toNumber(camera.x),
      worldPanY: toNumber(camera.y),
    };
  }

  function syncCameraFromUi(camera = {}, uiState = {}) {
    const nextX = Number(uiState.worldPanX);
    const nextY = Number(uiState.worldPanY);
    return {
      x: Number.isFinite(nextX) ? nextX : toNumber(camera.x),
      y: Number.isFinite(nextY) ? nextY : toNumber(camera.y),
    };
  }

  function resolveCameraChange(camera = {}, x, y) {
    const current = {
      x: toNumber(camera.x),
      y: toNumber(camera.y),
    };
    const next = {
      x: Number.isFinite(Number(x)) ? Number(x) : current.x,
      y: Number.isFinite(Number(y)) ? Number(y) : current.y,
    };
    return {
      camera: next,
      changed: next.x !== current.x || next.y !== current.y,
    };
  }

  function getCameraOffsetFromBaked(camera = {}, bakedCamera = {}) {
    return {
      x: toNumber(camera.x) - toNumber(bakedCamera.x),
      y: toNumber(camera.y) - toNumber(bakedCamera.y),
    };
  }

  function createDragState(point = {}, camera = {}) {
    return {
      pointerId: point.pointerId,
      startX: Number(point.x) || 0,
      startY: Number(point.y) || 0,
      cameraX: toNumber(camera.x),
      cameraY: toNumber(camera.y),
    };
  }

  function resolveDragCamera(drag = null, point = {}) {
    if (!drag || point.pointerId !== drag.pointerId) {
      return {
        changed: false,
        camera: null,
      };
    }
    const x = Number(point.x) || 0;
    const y = Number(point.y) || 0;
    return {
      changed: true,
      camera: {
        x: toNumber(drag.cameraX) + x - toNumber(drag.startX),
        y: toNumber(drag.cameraY) + y - toNumber(drag.startY),
      },
    };
  }

  function canEndDrag(drag = null, point = {}) {
    return Boolean(drag && point.pointerId === drag.pointerId);
  }

  function normalizeDragLayerOffset(x = 0, y = 0) {
    return {
      x: Number.isFinite(Number(x)) ? Number(x) : 0,
      y: Number.isFinite(Number(y)) ? Number(y) : 0,
    };
  }

  function applyOffsetToHitTargets(hitTargets = [], offset = {}) {
    const offsetX = toNumber(offset.x);
    const offsetY = toNumber(offset.y);
    return (Array.isArray(hitTargets) ? hitTargets : []).map((target) => ({
      ...target,
      x: (Number(target.x) || 0) + offsetX,
      y: (Number(target.y) || 0) + offsetY,
    }));
  }

  const WorldMapRuntimeCameraPolicy = Object.freeze({
    toNumber,
    toLegacyAxis,
    createInitialCamera,
    createCameraUiState,
    syncCameraFromUi,
    resolveCameraChange,
    getCameraOffsetFromBaked,
    createDragState,
    resolveDragCamera,
    canEndDrag,
    normalizeDragLayerOffset,
    applyOffsetToHitTargets,
  });

  global.WorldMapRuntimeCameraPolicy = WorldMapRuntimeCameraPolicy;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapRuntimeCameraPolicy;
})(typeof window !== 'undefined' ? window : globalThis);
