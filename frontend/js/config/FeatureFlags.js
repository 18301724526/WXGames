(function (global) {
  const FeatureFlagCore = (() => {
    if (global.FeatureFlagCore) return global.FeatureFlagCore;
    if (typeof module !== 'undefined' && module.exports) {
      return require('../../../shared/featureFlags');
    }
    return null;
  })();

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
    const raw = {
      ...DEFAULTS,
      ...readConfigFlags(config),
      ...overrideFlags,
    };
    return Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [
        key,
        FeatureFlagCore.parseFeatureFlagValue(value, DEFAULTS[key] ?? false),
      ]),
    );
  }

  function isEnabled(config = null, key = '') {
    return resolve(config)[key] === true;
  }

  const api = {
    DEFAULTS,
    parseFlagValue: FeatureFlagCore.parseFeatureFlagValue,
    resolve,
    isEnabled,
  };

  global.FeatureFlags = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
