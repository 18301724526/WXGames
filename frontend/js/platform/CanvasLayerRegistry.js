(function (global) {
  const LAYERS = Object.freeze({
    worldMap: Object.freeze({
      key: 'worldMap',
      zIndex: 997,
      contextType: '2d',
    }),
    worldFog: Object.freeze({
      key: 'worldFog',
      zIndex: 998,
      contextType: 'webgl',
      feature: 'FOG_OF_WAR_ENABLED',
    }),
  });

  function getLayer(name = '') {
    return LAYERS[String(name || '')] || null;
  }

  function getLayerName(name = '') {
    return getLayer(name)?.key || String(name || '');
  }

  function getLayerOptions(name = '', overrides = {}) {
    const layer = getLayer(name);
    if (!layer) return { ...(overrides || {}) };
    const base = { zIndex: layer.zIndex };
    if (layer.contextType && layer.contextType !== '2d') base.contextType = layer.contextType;
    return {
      ...base,
      ...(overrides || {}),
    };
  }

  function isLayerEnabled(name = '', config = null, options = {}) {
    const layer = getLayer(name);
    if (!layer) return false;
    if (!layer.feature) return true;
    const FeatureFlags = options.FeatureFlags || global.FeatureFlags;
    if (FeatureFlags?.isEnabled) return FeatureFlags.isEnabled(config, layer.feature);
    return config?.FEATURES?.[layer.feature] === true;
  }

  const api = {
    LAYERS,
    getLayer,
    getLayerName,
    getLayerOptions,
    isLayerEnabled,
  };

  global.CanvasLayerRegistry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
