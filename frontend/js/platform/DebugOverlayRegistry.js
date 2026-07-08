(function (global) {
  const FeatureFlags = (() => {
    if (global.FeatureFlags) return global.FeatureFlags;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../config/FeatureFlags');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const DebugOverlaySnapshot = (() => {
    if (global.DebugOverlaySnapshot) return global.DebugOverlaySnapshot;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../ecs/debug/DebugOverlaySnapshot');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const DEFAULT_OVERLAYS = Object.freeze({
    fps: Object.freeze({ key: 'fps', label: 'FPS', stage: 'hudDebug', feature: 'DEBUG_OVERLAYS_ENABLED' }),
    worldMapBake: Object.freeze({ key: 'worldMapBake', label: 'Map Bake', stage: 'worldMapDebug', feature: 'DEBUG_OVERLAYS_ENABLED' }),
    visibility: Object.freeze({ key: 'visibility', label: 'Visibility', stage: 'worldMapDebug', feature: 'DEBUG_OVERLAYS_ENABLED' }),
    inputTrace: Object.freeze({ key: 'inputTrace', label: 'Input Trace', stage: 'inputDebug', feature: 'DEBUG_OVERLAYS_ENABLED' }),
  });

  function getOverlayDefinitions(options = {}) {
    const overlays = options.overlays || DEFAULT_OVERLAYS;
    if (Array.isArray(overlays)) return overlays.filter(Boolean);
    return Object.values(overlays || {}).filter(Boolean);
  }

  function getOverlay(key = '', options = {}) {
    return getOverlayDefinitions(options).find((overlay) => overlay.key === key) || null;
  }

  function getRequestedOverlayKeys(config = null, options = {}) {
    const requested = options.enabledOverlayKeys
      || options.overlayKeys
      || config?.DEBUG_OVERLAY_KEYS
      || config?.FEATURES?.DEBUG_OVERLAY_KEYS
      || null;
    return DebugOverlaySnapshot?.normalizeOverlayKeys
      ? DebugOverlaySnapshot.normalizeOverlayKeys(requested || getOverlayDefinitions(options).map((overlay) => overlay.key))
      : (Array.isArray(requested) ? requested : getOverlayDefinitions(options).map((overlay) => overlay.key));
  }

  function isOverlayEnabled(overlayOrKey = '', config = null, options = {}) {
    const overlay = typeof overlayOrKey === 'string' ? getOverlay(overlayOrKey, options) : overlayOrKey;
    if (!overlay || overlay.enabled === false) return false;
    const flags = options.FeatureFlags || FeatureFlags || global.FeatureFlags;
    const resolvedConfig = config || options.config || null;
    if (overlay.feature) {
      const enabled = flags?.isEnabled
        ? flags.isEnabled(resolvedConfig, overlay.feature)
        : resolvedConfig?.FEATURES?.[overlay.feature] === true;
      if (enabled !== true) return false;
    }
    const requestedKeys = getRequestedOverlayKeys(resolvedConfig, options);
    return requestedKeys.includes(overlay.key);
  }

  function getEnabledOverlays(config = null, options = {}) {
    return getOverlayDefinitions(options).filter((overlay) => isOverlayEnabled(overlay, config, options));
  }

  function createOverlaySnapshot(context = {}, options = {}) {
    const config = options.config || context.config || null;
    const enabled = getEnabledOverlays(config, options);
    if (!enabled.length || !DebugOverlaySnapshot?.createSnapshot) return null;
    return DebugOverlaySnapshot.createSnapshot(context, {
      ...options,
      overlayKeys: enabled.map((overlay) => overlay.key),
    });
  }

  const api = {
    DEFAULT_OVERLAYS,
    createOverlaySnapshot,
    getEnabledOverlays,
    getOverlay,
    getOverlayDefinitions,
    getRequestedOverlayKeys,
    isOverlayEnabled,
  };

  global.DebugOverlayRegistry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
