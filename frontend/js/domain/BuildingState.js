(function (global) {
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  function t(key, params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
  }
  function getLevel(buildings, id) {
    const entry = buildings && buildings[id];
    if (!entry) return 0;
    if (typeof entry === 'number') return entry;
    return entry.level || 0;
  }

  function isBuilt(buildings, id) {
    return getLevel(buildings, id) > 0;
  }

  function getActionLabel(nextCost, level) {
    if (!level) return t('building.action.build');
    if (nextCost === null) return t('building.action.maxLevel');
    return t('building.action.upgrade');
  }

  const api = { getLevel, isBuilt, getActionLabel };
  global.FrontendBuildingState = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
