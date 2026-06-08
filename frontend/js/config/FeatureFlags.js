(function (global) {
  const DEFAULTS = Object.freeze({
    FOG_OF_WAR_ENABLED: false,
    DEBUG_OVERLAYS_ENABLED: false,
  });

  function readConfigFlags(config = null) {
    const flags = config?.FEATURES;
    return flags && typeof flags === 'object' ? flags : {};
  }

  function resolve(config = null, overrides = null) {
    const overrideFlags = overrides && typeof overrides === 'object' ? overrides : {};
    return {
      ...DEFAULTS,
      ...readConfigFlags(config),
      ...overrideFlags,
    };
  }

  function isEnabled(config = null, key = '') {
    return resolve(config)[key] === true;
  }

  const api = {
    DEFAULTS,
    resolve,
    isEnabled,
  };

  global.FeatureFlags = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
