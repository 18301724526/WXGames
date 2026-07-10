(function (global) {
  'use strict';

  function parseFeatureFlagValue(value, fallback = false) {
    if (value === true || value === 1) return true;
    if (value === false || value === 0) return false;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes') return true;
      if (normalized === '0' || normalized === 'false' || normalized === 'off' || normalized === 'no' || normalized === '') return false;
    }
    return fallback;
  }

  const api = Object.freeze({
    parseFeatureFlagValue,
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.FeatureFlagCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
