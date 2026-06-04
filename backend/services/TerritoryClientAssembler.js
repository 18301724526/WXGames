const WorldMapService = require('./WorldMapService');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getMapBounds(territories) {
  const xs = territories.map((territory) => territory.x);
  const ys = territories.map((territory) => territory.y);
  return {
    minX: Math.min(...xs, 0),
    maxX: Math.max(...xs, 0),
    minY: Math.min(...ys, 0),
    maxY: Math.max(...ys, 0),
  };
}

function getClientScoutAreas(gameState, deps = {}) {
  gameState.scoutState = deps.normalizeScoutState(gameState.scoutState);
  return (gameState.scoutState.areas || []).map((area) => ({
    id: area.id,
    missionId: area.missionId,
    direction: area.direction,
    originX: area.originX,
    originY: area.originY,
    targetX: area.targetX,
    targetY: area.targetY,
    result: area.result,
    siteId: area.siteId,
    tileIds: [...area.tileIds],
    coords: area.coords.map((coord) => ({ ...coord })),
    scoutedAt: area.scoutedAt,
  }));
}

function getTerritoryIntelSnapshot(territory = {}, deps = {}) {
  const rawIntel = territory.intel && typeof territory.intel === 'object' ? territory.intel : {};
  const rawLevel = deps.toInteger(rawIntel.level, territory.owner === 'player' ? 4 : 1);
  const level = territory.owner === 'player'
    ? 4
    : Math.max(0, Math.min(4, rawLevel));
  return {
    level,
    knownTerrain: rawIntel.knownTerrain !== false,
    knownSite: rawIntel.knownSite !== false,
    knownOwner: rawIntel.knownOwner !== false,
    knownGarrison: Boolean(rawIntel.knownGarrison ?? level >= 2),
    knownLeader: Boolean(rawIntel.knownLeader ?? level >= 3),
    knownSkill: Boolean(rawIntel.knownSkill ?? level >= 4),
  };
}

function redactGarrisonForIntel(garrison, intel) {
  if (!garrison || typeof garrison !== 'object' || !intel.knownGarrison) return null;
  const redacted = {
    id: garrison.id || '',
    siteId: garrison.siteId || '',
    owner: garrison.owner || '',
    soldiers: garrison.soldiers || 0,
    quality: garrison.quality || '',
    threat: garrison.threat || 0,
    scale: garrison.scale || 1,
    generatedAt: garrison.generatedAt || null,
    leader: null,
  };
  if (intel.knownLeader && garrison.leader && typeof garrison.leader === 'object') {
    redacted.leader = {
      id: garrison.leader.id || '',
      name: garrison.leader.name || '',
      title: garrison.leader.title || '',
      archetype: garrison.leader.archetype || '',
      abilityArchetype: garrison.leader.abilityArchetype || '',
      quality: garrison.leader.quality || '',
      qualityLabel: garrison.leader.qualityLabel || '',
      level: garrison.leader.level || 1,
      attributes: clone(garrison.leader.attributes || {}),
      appearance: clone(garrison.leader.appearance || {}),
      abilityKit: intel.knownSkill && garrison.leader.abilityKit ? clone(garrison.leader.abilityKit) : null,
      skills: intel.knownSkill && Array.isArray(garrison.leader.skills) ? clone(garrison.leader.skills) : [],
    };
  }
  return redacted;
}

function getClientBattleTargetForIntel(battleTarget, intel) {
  if (!battleTarget || typeof battleTarget !== 'object') return null;
  return {
    ...battleTarget,
    defender: redactGarrisonForIntel(battleTarget.defender, intel),
    intelSnapshot: {
      ...(battleTarget.intelSnapshot && typeof battleTarget.intelSnapshot === 'object' ? battleTarget.intelSnapshot : {}),
      ...intel,
    },
  };
}

function getClientTerritoryView(territory, scoutOrigin, mission, deps = {}) {
  const intel = getTerritoryIntelSnapshot(territory, deps);
  return {
    ...territory,
    intel,
    garrison: redactGarrisonForIntel(territory.garrison, intel),
    defenderLeader: intel.knownLeader ? territory.defenderLeader : null,
    battleTarget: getClientBattleTargetForIntel(territory.battleTarget, intel),
    distance: deps.getDistance(territory.x, territory.y),
    originDistance: deps.getRelativeDistance(scoutOrigin.x, scoutOrigin.y, territory.x, territory.y),
    relativeX: territory.x - scoutOrigin.x,
    relativeY: territory.y - scoutOrigin.y,
    occupationMode: deps.getOccupationMode(territory),
    mission,
  };
}

function getClientTerritoryState(gameState, now = new Date(), deps = {}) {
  deps.updateMissionReadiness(gameState, now);
  const nowMs = now.getTime();
  const scoutOrigin = deps.getScoutOrigin(gameState);
  const missionsByTerritory = Object.fromEntries((gameState.warMissions || [])
    .filter((mission) => deps.getMissionKind(mission) === 'conquest')
    .map((mission) => [mission.territoryId, {
      ...mission,
      remainingSeconds: Math.max(0, Math.ceil((new Date(mission.completesAt).getTime() - nowMs) / 1000)),
      durationSeconds: Math.floor(deps.CONQUEST_DURATION_MS / 1000),
    }]));
  const territories = (gameState.territories || [])
    .map((territory) => getClientTerritoryView(territory, scoutOrigin, missionsByTerritory[territory.id] || null, deps));
  const scoutMissions = (gameState.warMissions || []).filter((mission) => deps.getMissionKind(mission) === 'scout');
  return {
    polity: gameState.polity || deps.createInitialPolity(),
    territories,
    worldMap: WorldMapService.getClientWorldMap(gameState, now),
    warMissions: gameState.warMissions || [],
    scoutMissions: scoutMissions.map((mission) => ({
      ...mission,
      remainingSeconds: Math.max(0, Math.ceil((new Date(mission.completesAt).getTime() - nowMs) / 1000)),
    })),
    activeScoutMission: deps.getActiveScoutMission(gameState),
    scoutReports: gameState.scoutReports || [],
    scoutAreas: getClientScoutAreas(gameState, deps),
    scoutOrigin,
    directions: Object.entries(deps.DIRECTIONS).map(([id, direction]) => ({ id, ...direction })),
    maxActiveScouts: deps.MAX_ACTIVE_SCOUTS,
    availableSoldiers: deps.getAvailableSoldiers(gameState),
    soldiersOnMission: deps.countTotalSoldiersOnMission(gameState),
    occupiedCount: deps.getOccupiedCount(gameState),
    discoveredCount: territories.length,
    mapBounds: getMapBounds(territories),
    territoryEffects: deps.getTerritoryEffects(gameState),
    namingPrompt: deps.getNamingPrompt(gameState),
    scoutDurationSeconds: Math.floor(deps.SCOUT_DURATION_MS / 1000),
    missionDurationSeconds: Math.floor(deps.CONQUEST_DURATION_MS / 1000),
    famousPersons: {
      people: clone(gameState.famousPeople || []),
    },
  };
}

module.exports = {
  getMapBounds,
  getClientScoutAreas,
  getTerritoryIntelSnapshot,
  redactGarrisonForIntel,
  getClientBattleTargetForIntel,
  getClientTerritoryView,
  getClientTerritoryState,
};
