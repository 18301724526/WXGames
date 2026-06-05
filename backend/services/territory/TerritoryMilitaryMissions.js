const {
  MAX_ACTIVE_SCOUTS,
  MIN_EXPEDITION_SOLDIERS,
  SCOUT_ACTION_POINTS,
  SCOUT_STEP_DURATION_MS,
} = require('./TerritoryConstants');
const {
  normalizeSoldierScale,
  toInteger,
} = require('./TerritoryShared');

function createTerritoryMilitaryMissions(dependencies = {}) {
  const {
    WorldMapService,
    ensureMissionRevealArea,
    isDirectionalScoutAreaMission,
  } = dependencies;

  function getMissionKind(mission) {
    return mission?.kind === 'scout' ? 'scout' : 'conquest';
  }

  function getScoutMissions(gameState) {
    return (gameState?.warMissions || []).filter((mission) => getMissionKind(mission) === 'scout');
  }

  function getActiveScoutMission(gameState) {
    return getScoutMissions(gameState).find((mission) => mission.status === 'active') || null;
  }

  function countActiveScoutMissions(gameState) {
    return getScoutMissions(gameState).filter((mission) => mission.status === 'active').length;
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
      const military = id === activeCityId && gameState?.military ? gameState.military : city.military;
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
    const required = Math.max(MIN_EXPEDITION_SOLDIERS, Math.floor(Number(requiredSoldiers) || MIN_EXPEDITION_SOLDIERS));
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

  function advanceScoutMission(gameState, mission, now = new Date(), randomSource = Math.random) {
    void randomSource;
    const nowMs = now.getTime();
    const route = Array.isArray(mission.route) ? mission.route : [];
    const revealArea = ensureMissionRevealArea(gameState, mission, now);
    const strictRevealArea = typeof isDirectionalScoutAreaMission === 'function'
      ? isDirectionalScoutAreaMission(mission)
      : mission?.revealAreaSource === 'directional-route-v1';
    let nextStepAt = new Date(mission.nextStepAt || mission.startedAt || now).getTime();
    if (!Number.isFinite(nextStepAt)) nextStepAt = nowMs;
    mission.revealedTileIds = Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds : [];
    mission.actionPointsRemaining = Math.max(0, toInteger(mission.actionPointsRemaining, mission.actionPoints || SCOUT_ACTION_POINTS));

    for (const step of route) {
      if (step.revealed) continue;
      if (mission.actionPointsRemaining <= 0 || nextStepAt > nowMs) break;
      const stepArea = revealArea.filter((coord) => coord.step === step.step && !coord.revealed);
      const revealTargets = stepArea.length || !strictRevealArea ? (stepArea.length ? stepArea : [step]) : [];
      const revealedTiles = WorldMapService.revealScoutArea(gameState, revealTargets, now);
      const tile = revealedTiles.find((item) => item.q === step.q && item.r === step.r) || revealedTiles[0] || null;
      step.tileId = tile?.id || step.tileId || WorldMapService.getTileId(step.q, step.r);
      step.revealed = true;
      for (const coord of stepArea) {
        coord.revealed = true;
        coord.tileId = WorldMapService.getTileId(coord.q, coord.r);
      }
      mission.revealedTileIds = Array.from(new Set([
        ...mission.revealedTileIds,
        ...revealedTiles.map((item) => item.id),
      ]));
      mission.actionPointsRemaining = Math.max(0, mission.actionPointsRemaining - 1);
      nextStepAt += SCOUT_STEP_DURATION_MS;
    }

    mission.nextStepAt = new Date(nextStepAt).toISOString();
    const routeDone = route.every((step) => step.revealed);
    if (mission.actionPointsRemaining <= 0 || routeDone || new Date(mission.completesAt).getTime() <= nowMs) {
      mission.status = 'ready';
      mission.actionPointsRemaining = 0;
      mission.returnedAt = mission.returnedAt || now.toISOString();
      WorldMapService.recordScoutTrail(gameState, mission, mission.revealedTileIds, true);
    } else {
      WorldMapService.recordScoutTrail(gameState, mission, mission.revealedTileIds, false);
    }
    return mission;
  }

  function updateMissionReadiness(gameState, now = new Date(), randomSource = Math.random) {
    const nowMs = now.getTime();
    for (const mission of gameState?.warMissions || []) {
      if (getMissionKind(mission) === 'scout' && mission.status === 'active') {
        advanceScoutMission(gameState, mission, now, randomSource);
      }
      if (mission.status === 'active' && new Date(mission.completesAt).getTime() <= nowMs) {
        mission.status = 'ready';
      }
    }
    return gameState?.warMissions;
  }

  function enforceScoutMissionLimit(gameState) {
    const missions = gameState?.warMissions || [];
    const activeScouts = missions
      .filter((mission) => getMissionKind(mission) === 'scout' && mission.status === 'active')
      .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
    if (activeScouts.length <= MAX_ACTIVE_SCOUTS) return missions;
    const keepIds = new Set(activeScouts.slice(0, MAX_ACTIVE_SCOUTS).map((mission) => mission.id));
    gameState.warMissions = missions.filter((mission) => (
      getMissionKind(mission) !== 'scout'
      || mission.status !== 'active'
      || keepIds.has(mission.id)
    ));
    return gameState.warMissions;
  }

  return {
    advanceScoutMission,
    allocateSoldiersForMission,
    countActiveScoutMissions,
    countSoldiersOnMission,
    countTotalSoldiersOnMission,
    enforceScoutMissionLimit,
    getActiveMissionForTerritory,
    getActiveScoutMission,
    getAvailableSoldiers,
    getAvailableSoldiersForCity,
    getCitySoldierEntries,
    getMissionKind,
    getMissionSoldierAllocations,
    getScoutMissions,
    getTotalSoldiers,
    updateMissionReadiness,
  };
}

module.exports = createTerritoryMilitaryMissions;
