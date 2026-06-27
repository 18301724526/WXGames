const WorldMapService = require('./WorldMapService');
const { clone } = require('../../shared/objectUtils');

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

function getCoordinateKey(site = {}) {
  const x = Number(site.x ?? site.q ?? 0);
  const y = Number(site.y ?? site.r ?? 0);
  return `${Math.floor(x)},${Math.floor(y)}`;
}

function getWorldMapOrigin(worldMap = {}) {
  const origin = worldMap?.origin && typeof worldMap.origin === 'object'
    ? worldMap.origin
    : {};
  const q = Number(origin.q ?? origin.x);
  const r = Number(origin.r ?? origin.y);
  if (!Number.isFinite(q) || !Number.isFinite(r)) return null;
  return {
    x: Math.floor(q),
    y: Math.floor(r),
  };
}

function projectCapitalTerritoryToOrigin(territory = {}, origin = null) {
  if (!origin || territory?.id !== 'capital') return territory;
  return {
    ...territory,
    x: origin.x,
    y: origin.y,
  };
}

function isSharedOccupiedTerritory(site = {}) {
  return Boolean(site.ownerPlayerId && site.owner === 'player' && site.status === 'occupied');
}

function getTerritoryProjectionPriority(site = {}) {
  if (isSharedOccupiedTerritory(site)) return 4;
  if (site.owner === 'player' && site.status === 'occupied') return 3;
  if (site.status === 'contested') return 2;
  if (site.status === 'discovered') return 1;
  return 0;
}

function mergeProjectedTerritories(ownTerritories = [], sharedTerritories = []) {
  const byCoord = new Map();
  [...ownTerritories, ...sharedTerritories].forEach((territory) => {
    if (!territory || typeof territory !== 'object') return;
    const key = getCoordinateKey(territory);
    const existing = byCoord.get(key);
    if (!existing || getTerritoryProjectionPriority(territory) >= getTerritoryProjectionPriority(existing)) {
      byCoord.set(key, territory);
    }
  });
  return [...byCoord.values()];
}

function bindProjectedSitesToWorldMap(worldMap = {}, territories = []) {
  const siteByCoord = new Map((territories || [])
    .filter((site) => site && typeof site === 'object' && site.id)
    .map((site) => [getCoordinateKey(site), site]));
  if (!Array.isArray(worldMap.tiles) || !siteByCoord.size) return worldMap;
  return {
    ...worldMap,
    tiles: worldMap.tiles.map((tile) => {
      const site = siteByCoord.get(getCoordinateKey(tile));
      if (!site) return tile;
      return {
        ...tile,
        siteId: site.id,
        visibility: site.owner === 'player' && !site.ownerPlayerId ? 'controlled' : tile.visibility,
      };
    }),
  };
}

function getClientScoutAreas(gameState, deps = {}) {
  const scoutState = typeof deps.normalizeScoutState === 'function'
    ? deps.normalizeScoutState(gameState.scoutState)
    : (gameState.scoutState || {});
  return (scoutState.areas || []).map((area) => ({
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

function getClientTerritoryState(gameState, now = new Date(), deps = {}, projection = {}) {
  const nowMs = now.getTime();
  const scoutOrigin = deps.getScoutOrigin(gameState);
  const missionsByTerritory = Object.fromEntries((gameState.warMissions || [])
    .filter((mission) => deps.getMissionKind(mission) === 'conquest')
    .map((mission) => [mission.territoryId, {
      ...mission,
      remainingSeconds: Math.max(0, Math.ceil((new Date(mission.completesAt).getTime() - nowMs) / 1000)),
      durationSeconds: Math.floor(deps.CONQUEST_DURATION_MS / 1000),
    }]));
  const ownTerritories = Array.isArray(gameState.territories) ? gameState.territories : [];
  const sharedTerritories = Array.isArray(projection.sharedWorldTerritories) ? projection.sharedWorldTerritories : [];
  const capitalOrigin = getWorldMapOrigin(gameState.worldMap);
  const territories = mergeProjectedTerritories(ownTerritories, sharedTerritories)
    .map((territory) => projectCapitalTerritoryToOrigin(territory, capitalOrigin))
    .map((territory) => getClientTerritoryView(territory, scoutOrigin, missionsByTerritory[territory.id] || null, deps));
  const scoutMissions = (gameState.warMissions || []).filter((mission) => deps.getMissionKind(mission) === 'scout');
  const worldMap = typeof WorldMapService.getClientWorldMapFromNormalized === 'function'
    ? WorldMapService.getClientWorldMapFromNormalized(gameState.worldMap)
    : WorldMapService.getClientWorldMap(gameState, now);
  return {
    polity: gameState.polity || deps.createInitialPolity(),
    territories,
    worldMap: bindProjectedSitesToWorldMap(worldMap, territories),
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
  getCoordinateKey,
  mergeProjectedTerritories,
};
