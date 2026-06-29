const { BuildingConfig } = require('../services/config/GameplayConfigRuntime');

function createInitialBuildingState() {
  return Object.keys(BuildingConfig.getAllBuildings()).reduce((acc, id) => {
    acc[id] = null;
    return acc;
  }, {});
}

function getLevel(buildings, id) {
  const entry = buildings?.[id];
  if (!entry) return 0;
  if (typeof entry === 'number') return entry;
  return entry.level || 0;
}

function isBuilt(buildings, id) {
  return getLevel(buildings, id) > 0;
}

function build(buildings, id, now = new Date().toISOString()) {
  if (isBuilt(buildings, id)) {
    throw new Error('BUILDING_ALREADY_EXISTS');
  }
  return {
    ...buildings,
    [id]: {
      level: 1,
      builtAt: now,
      upgradedAt: now,
    },
  };
}

function upgrade(buildings, id, now = new Date().toISOString()) {
  if (!isBuilt(buildings, id)) {
    throw new Error('BUILDING_NOT_BUILT');
  }
  const current = buildings[id];
  return {
    ...buildings,
    [id]: {
      ...current,
      level: getLevel(buildings, id) + 1,
      upgradedAt: now,
    },
  };
}

function normalizeLegacyBuildingState(rawBuildings) {
  const base = createInitialBuildingState();
  const now = new Date().toISOString();
  const source = rawBuildings || {};
  for (const id of Object.keys(base)) {
    const value = source[id];
    if (value == null || value === 0) {
      base[id] = null;
      continue;
    }
    if (typeof value === 'number') {
      base[id] = {
        level: value,
        builtAt: now,
        upgradedAt: now,
      };
      continue;
    }
    if (typeof value === 'object' && value.level) {
      base[id] = {
        level: value.level,
        builtAt: value.builtAt || now,
        upgradedAt: value.upgradedAt || value.builtAt || now,
      };
    }
  }
  return base;
}

module.exports = {
  createInitialBuildingState,
  getLevel,
  isBuilt,
  build,
  upgrade,
  normalizeLegacyBuildingState,
};
