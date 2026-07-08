const {
  normalizeSoldierScale,
} = require('./TerritoryShared');

function createTerritoryMilitaryMissions() {
  function getMissionKind(mission) {
    return mission?.kind === 'scout' ? 'scout' : 'conquest';
  }

  function getActiveMissionForTerritory(gameState, territoryId) {
    return (gameState?.warMissions || []).find((mission) => (
      getMissionKind(mission) === 'conquest'
      && mission.territoryId === territoryId
      && ['active', 'ready'].includes(mission.status)
    )) || null;
  }

  function getMissionSoldierAllocations(mission) {
    if (Array.isArray(mission?.soldierAllocations) && mission.soldierAllocations.length) {
      return mission.soldierAllocations
        .map((allocation) => ({
          cityId: allocation?.cityId || mission.sourceCityId || 'capital',
          soldiers: normalizeSoldierScale(allocation?.soldiers, 0),
        }))
        .filter((allocation) => allocation.soldiers > 0);
    }
    return [{
      cityId: mission?.sourceCityId || 'capital',
      soldiers: normalizeSoldierScale(mission?.soldiersCommitted, 0),
    }];
  }

  function countSoldiersOnMission(gameState, cityId = gameState?.activeCityId || 'capital') {
    const sourceCityId = cityId || 'capital';
    return (gameState?.warMissions || []).reduce((sum, mission) => {
      if (getMissionKind(mission) !== 'conquest' || !['active', 'ready'].includes(mission.status)) return sum;
      const allocation = getMissionSoldierAllocations(mission).find((item) => item.cityId === sourceCityId);
      return sum + (allocation?.soldiers || 0);
    }, 0);
  }

  function countTotalSoldiersOnMission(gameState) {
    return (gameState?.warMissions || []).reduce((sum, mission) => {
      if (getMissionKind(mission) !== 'conquest' || !['active', 'ready'].includes(mission.status)) return sum;
      return sum + (mission.soldiersCommitted || 0);
    }, 0);
  }

  function getCitySoldierEntries(gameState) {
    const activeCityId = gameState?.activeCityId || 'capital';
    const cities = gameState?.cities && typeof gameState.cities === 'object'
      ? Object.values(gameState.cities).filter((city) => city && typeof city === 'object')
      : [];
    if (!cities.length) {
      return [{
        id: activeCityId,
        soldiers: Math.max(0, Math.floor(Number(gameState?.military?.soldiers) || 0)),
      }];
    }
    return cities.map((city) => {
      const id = city.id || city.territoryId || 'capital';
      // Single source of truth: read soldiers from the city slot, never the legacy top-level mirror.
      const military = city.military;
      return {
        id,
        soldiers: Math.max(0, Math.floor(Number(military?.soldiers) || 0)),
      };
    });
  }

  function getTotalSoldiers(gameState) {
    return getCitySoldierEntries(gameState).reduce((sum, entry) => sum + entry.soldiers, 0);
  }

  function getAvailableSoldiers(gameState) {
    return Math.max(0, getTotalSoldiers(gameState) - countTotalSoldiersOnMission(gameState));
  }

  function getAvailableSoldiersForCity(gameState, cityId) {
    const entry = getCitySoldierEntries(gameState).find((item) => item.id === (cityId || 'capital'));
    return Math.max(0, (entry?.soldiers || 0) - countSoldiersOnMission(gameState, cityId || 'capital'));
  }

  function allocateSoldiersForMission(gameState, requiredSoldiers) {
    const required = Math.max(0, Math.floor(Number(requiredSoldiers) || 0));
    if (getAvailableSoldiers(gameState) < required) return null;
    const activeCityId = gameState?.activeCityId || 'capital';
    const entries = getCitySoldierEntries(gameState)
      .map((entry, index) => ({
        ...entry,
        available: getAvailableSoldiersForCity(gameState, entry.id),
        priority: entry.id === activeCityId ? 0 : entry.id === 'capital' ? 1 : index + 2,
      }))
      .filter((entry) => entry.available > 0)
      .sort((a, b) => a.priority - b.priority || String(a.id).localeCompare(String(b.id)));
    const allocations = [];
    let remaining = required;
    for (const entry of entries) {
      if (remaining <= 0) break;
      const soldiers = Math.min(entry.available, remaining);
      allocations.push({ cityId: entry.id, soldiers });
      remaining -= soldiers;
    }
    if (remaining > 0) return null;
    return allocations;
  }

  function updateMissionReadiness(gameState, now = new Date()) {
    const nowMs = now.getTime();
    for (const mission of gameState?.warMissions || []) {
      if (mission.status === 'active' && new Date(mission.completesAt).getTime() <= nowMs) {
        mission.status = 'ready';
      }
    }
    return gameState?.warMissions;
  }

  return {
    allocateSoldiersForMission,
    countSoldiersOnMission,
    countTotalSoldiersOnMission,
    getActiveMissionForTerritory,
    getAvailableSoldiers,
    getAvailableSoldiersForCity,
    getCitySoldierEntries,
    getMissionKind,
    getMissionSoldierAllocations,
    getTotalSoldiers,
    updateMissionReadiness,
  };
}

module.exports = createTerritoryMilitaryMissions;
