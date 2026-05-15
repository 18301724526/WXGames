const { ERA_BUILDING_UNLOCKS } = require('../config/EraConfig');

function getUnlockedBuildings(currentEra) {
  const result = new Set();
  for (let era = 0; era <= currentEra; era += 1) {
    (ERA_BUILDING_UNLOCKS[era] || []).forEach((id) => result.add(id));
  }
  return [...result];
}

function isUnlocked(buildingId, currentEra) {
  return getUnlockedBuildings(currentEra).includes(buildingId);
}

module.exports = {
  getUnlockedBuildings,
  isUnlocked,
};
