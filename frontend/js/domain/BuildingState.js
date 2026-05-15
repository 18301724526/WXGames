(function (global) {
  function getLevel(buildings, id) {
    const entry = buildings && buildings[id];
    if (!entry) return 0;
    if (typeof entry === 'number') return entry;
    return entry.level || 0;
  }

  function isBuilt(buildings, id) {
    return getLevel(buildings, id) > 0;
  }

  function getActionLabel(buildingConfig, level) {
    if (!level) return '建造';
    if (level >= (buildingConfig.maxLevel || 1)) return '已满级';
    return '升级';
  }

  const api = { getLevel, isBuilt, getActionLabel };
  global.FrontendBuildingState = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
