const DefenderLeaderService = require('./DefenderLeaderService');
const WorldMapService = require('./WorldMapService');
const TerritoryClientAssembler = require('./TerritoryClientAssembler');
const {
  CONQUEST_DURATION_MS,
  DIRECTIONS,
  MAX_ACTIVE_SCOUTS,
  MAX_REPORTS,
  MAX_SCOUT_DISTANCE,
  MIN_EXPEDITION_SOLDIERS,
  SCOUT_ACTION_POINTS,
  SCOUT_DURATION_MS,
  SCOUT_SITE_MIN_DISTANCE,
  SCOUT_STEP_DURATION_MS,
  SITE_ART,
  SITE_TEMPLATES,
} = require('./territory/TerritoryConstants');
const createTerritoryCombatTargets = require('./territory/TerritoryCombatTargets');
const createTerritoryConquestMissions = require('./territory/TerritoryConquestMissions');
const createTerritoryMilitaryMissions = require('./territory/TerritoryMilitaryMissions');
const createTerritoryNaming = require('./territory/TerritoryNaming');
const createTerritoryScoutAreas = require('./territory/TerritoryScoutAreas');
const createTerritoryScoutPlanner = require('./territory/TerritoryScoutPlanner');
const createTerritoryScoutRecords = require('./territory/TerritoryScoutRecords');
const createTerritoryScoutResults = require('./territory/TerritoryScoutResults');
const createTerritorySiteMigration = require('./territory/TerritorySiteMigration');
const createTerritoryStateNormalizer = require('./territory/TerritoryStateNormalizer');
const {
  createInitialPolity,
  createInitialTerritories,
} = require('./territory/TerritoryInitialState');
const {
  getDistance,
  getPlanningTerrainForMapTerrain,
  getRelativeDistance,
  normalizeMapTerrainId,
  toInteger,
} = require('./territory/TerritoryShared');
const {
  ensureMissionRevealArea,
  ensureScoutMissionAreaRevealed,
  getExistingScoutAreaSite,
  getScoutResolvedCoordinate,
  isDirectionalScoutAreaMission,
} = createTerritoryScoutAreas({
  WorldMapService,
});
const {
  normalizeBattleTarget,
  normalizeGarrison,
} = createTerritoryCombatTargets({
  DefenderLeaderService,
  WorldMapService,
});
const {
  getScoutAreaTileIds,
  getScoutCoordinateRecord,
  normalizeScoutAreaRecords,
  normalizeScoutCoordinates,
  normalizeScoutReport,
  normalizeScoutReports,
  normalizeScoutState,
  upsertScoutAreaRecord,
  upsertScoutCoordinateRecord,
} = createTerritoryScoutRecords({
  WorldMapService,
  ensureMissionRevealArea,
  getScoutResolvedCoordinate,
  normalizeDirection,
});
const {
  attachScoutReportMapSnapshot,
  createEmptyScoutReport,
  createSiteFromScout,
  getDirectionProgressScore,
  getTerrainSiteScore,
  pickScoutSiteCoordinate,
  recordDiscoveredSiteOwnership,
  recordScoutOutcome,
  rollScoutOutcome,
} = createTerritoryScoutResults({
  WorldMapService,
  ensureMissionRevealArea,
  getScoutCoordinateRecord,
  getScoutResolvedCoordinate,
  getSiteSpacingProfile,
  normalizeGarrison,
  normalizeScoutReport,
  normalizeScoutState,
});
const {
  migrateTerritorySitesToCurrentWorldRules,
} = createTerritorySiteMigration({
  WorldMapService,
  getDirectionProgressScore,
  getTerrainSiteScore,
  normalizeBattleTarget,
  normalizeDirection,
});
const {
  allocateSoldiersForMission,
  countActiveScoutMissions,
  countSoldiersOnMission,
  countTotalSoldiersOnMission,
  enforceScoutMissionLimit,
  getActiveMissionForTerritory,
  getActiveScoutMission,
  getAvailableSoldiers,
  getMissionKind,
  getMissionSoldierAllocations,
  getScoutMissions,
  updateMissionReadiness,
} = createTerritoryMilitaryMissions({
  WorldMapService,
  ensureMissionRevealArea,
  isDirectionalScoutAreaMission,
});
const {
  normalizeTerritoryState,
} = createTerritoryStateNormalizer({
  WorldMapService,
  enforceScoutMissionLimit,
  getMissionSoldierAllocations,
  migrateTerritorySitesToCurrentWorldRules,
  normalizeBattleTarget,
  normalizeDirection,
  normalizeGarrison,
  normalizeScoutCoordinates,
  normalizeScoutReport,
  normalizeScoutReports,
  normalizeScoutState,
  updateMissionReadiness,
  upsertScoutCoordinateRecord,
});
const Naming = createTerritoryNaming({
  getTerritory,
});
const {
  getNamingPrompt,
  getOccupiedCount,
  renameCity: applyCityName,
  renamePolity: applyPolityName,
} = Naming;
const BattleService = require('./BattleService');
const ConquestMissions = createTerritoryConquestMissions({
  BattleService,
  getFamousPersonService: () => require('./FamousPersonService'),
  WorldMapService,
  allocateSoldiersForMission,
  attachBattleTileSnapshot,
  getActiveMissionForTerritory,
  getAvailableSoldiers,
  getMissionSoldierAllocations,
  getNamingPrompt,
  getTerritory,
  getTerritoryBattleTargetSnapshot,
  getTerritoryBattleTileSnapshot,
  normalizeBattleTarget,
});
const {
  claimConquest: resolveConquestClaim,
  getOccupationMode,
  startConquest: createConquestMission,
} = ConquestMissions;
const ScoutPlanner = createTerritoryScoutPlanner({
  WorldMapService,
  getScoutOrigin,
  normalizeScoutState,
});

function hasSiteSpacing(gameState, x, y) {
  return getSiteSpacingProfile(gameState, x, y).valid;
}

function getNearestSiteDistance(gameState, x, y) {
  const distances = (gameState.territories || [])
    .filter((territory) => Number.isFinite(Number(territory?.x)) && Number.isFinite(Number(territory?.y)))
    .map((territory) => getRelativeDistance(territory.x, territory.y, x, y));
  if (!distances.length) return MAX_SCOUT_DISTANCE;
  return Math.min(...distances);
}

function getSiteSpacingProfile(gameState, x, y) {
  const nearestDistance = getNearestSiteDistance(gameState, x, y);
  const valid = nearestDistance >= SCOUT_SITE_MIN_DISTANCE;
  return {
    valid,
    nearestDistance,
    score: valid
      ? Math.min(20, Math.max(0, nearestDistance - SCOUT_SITE_MIN_DISTANCE + 1) * 5)
      : -100,
  };
}

function getTerritoryBattleTileSnapshot(gameState, territory, now = new Date()) {
  const x = toInteger(territory?.x, 0);
  const y = toInteger(territory?.y, 0);
  const worldMap = WorldMapService.ensureWorldMap(gameState, now);
  const tileId = WorldMapService.getTileId(x, y);
  const tile = (worldMap.tiles || []).find((item) => item.id === tileId || (item.q === x && item.r === y)) || null;
  const mapTerrain = normalizeMapTerrainId(territory?.mapTerrain || territory?.tileTerrain || territory?.worldTerrain)
    || normalizeMapTerrainId(tile?.terrain)
    || normalizeMapTerrainId(territory?.terrain)
    || WorldMapService.chooseTerrain(worldMap.seed, x, y);
  const planningTerrain = getPlanningTerrainForMapTerrain(territory?.terrain || mapTerrain);
  return {
    tileId,
    q: x,
    r: y,
    mapTerrain,
    terrain: planningTerrain,
    tile: {
      id: tileId,
      q: x,
      r: y,
      terrain: mapTerrain,
    },
  };
}

function attachBattleTileSnapshot(report, snapshot, battleTarget = null) {
  if (!report || typeof report !== 'object') return report;
  return {
    ...report,
    tileId: snapshot.tileId,
    q: snapshot.q,
    r: snapshot.r,
    mapTerrain: snapshot.mapTerrain,
    terrain: snapshot.terrain,
    tile: { ...snapshot.tile },
    ...(battleTarget ? { battleTarget } : {}),
  };
}

function getTerritoryBattleTargetSnapshot(gameState, territory, now = new Date()) {
  const tileSnapshot = getTerritoryBattleTileSnapshot(gameState, territory, now);
  return normalizeBattleTarget({
    source: 'tile-map',
    tileId: tileSnapshot.tileId,
    q: tileSnapshot.q,
    r: tileSnapshot.r,
    mapTerrain: tileSnapshot.mapTerrain,
    terrain: tileSnapshot.terrain,
    tile: tileSnapshot.tile,
    defender: territory?.garrison || null,
    intelSnapshot: {
      knownTerrain: true,
      knownSite: true,
      knownOwner: true,
      knownGarrison: Boolean(territory?.garrison),
      knownLeader: Boolean(territory?.garrison?.leader || territory?.defenderLeader),
      knownSkill: Boolean((territory?.garrison?.leader || territory?.defenderLeader)?.abilityKit),
    },
  }, territory, now.toISOString());
}

function normalizeDirection(direction) {
  const key = String(direction || '').toLowerCase();
  return DIRECTIONS[key] ? key : null;
}

function getTerritory(gameState, territoryId) {
  return (gameState.territories || []).find((territory) => territory.id === territoryId) || null;
}

function getCapitalTerritory(gameState) {
  return getTerritory(gameState, 'capital') || { id: 'capital', x: 0, y: 0, cityName: '棣栭兘', naturalName: '棣栭兘', status: 'occupied' };
}

function getTerritoryForCity(gameState, cityId = gameState?.activeCityId || 'capital') {
  const normalizedCityId = cityId || 'capital';
  const city = gameState?.cities?.[normalizedCityId] || null;
  const territoryId = city?.territoryId || normalizedCityId;
  const territory = (gameState?.territories || []).find((item) => (
    item.id === territoryId || item.id === normalizedCityId
  ));
  if (territory && territory.status === 'occupied') return territory;
  return getCapitalTerritory(gameState);
}

function getScoutOrigin(gameState) {
  const activeCityId = gameState?.activeCityId || 'capital';
  const city = gameState?.cities?.[activeCityId] || null;
  const territory = getTerritoryForCity(gameState, activeCityId);
  return {
    cityId: city?.id || activeCityId,
    territoryId: territory.id || 'capital',
    name: city?.name || territory.cityName || territory.naturalName || '棣栭兘',
    x: toInteger(territory.x, 0),
    y: toInteger(territory.y, 0),
  };
}

function getTerritoryEffects(gameState) {
  const effects = {
    foodOutputMultiplier: 0,
    woodOutputMultiplier: 0,
    knowledgeOutputMultiplier: 0,
    threatDefense: 0,
  };
  for (const territory of gameState.territories || []) {
    if (territory.status !== 'occupied') continue;
    const territoryEffects = territory.effects || {};
    effects.foodOutputMultiplier += territoryEffects.foodOutputMultiplier || 0;
    effects.woodOutputMultiplier += territoryEffects.woodOutputMultiplier || 0;
    effects.knowledgeOutputMultiplier += territoryEffects.knowledgeOutputMultiplier || 0;
    effects.threatDefense += territoryEffects.threatDefense || 0;
  }
  return effects;
}

function resolveScoutMissionTarget(gameState, mission, now = new Date(), randomSource = Math.random) {
  if (mission.resolvedTarget) return { site: mission.siteId ? getTerritory(gameState, mission.siteId) : null, report: mission.report || null };
  const targetX = toInteger(mission.targetX, 0);
  const targetY = toInteger(mission.targetY, 0);
  const scoutedAt = now.toISOString();
  const existing = (gameState.territories || []).find((territory) => territory.x === targetX && territory.y === targetY) || null;
  const shouldUseLegacyCoordinateRecord = !isDirectionalScoutAreaMission(mission);
  const existingSite = shouldUseLegacyCoordinateRecord
    ? existing
    : getExistingScoutAreaSite(gameState, mission, now);
  const coordinateRecord = shouldUseLegacyCoordinateRecord
    ? getScoutCoordinateRecord(gameState, targetX, targetY)
    : null;

  if (existingSite) {
    mission.resolvedTarget = true;
    mission.result = 'site';
    mission.siteId = existingSite.id;
    mission.report = attachScoutReportMapSnapshot(gameState, mission, {
      id: `report_${existingSite.id}_${now.getTime()}`,
      siteId: existingSite.id,
      title: 'Scout confirmed site',
      text: `Scout confirmed ${existingSite.naturalName || existingSite.id}.`,
      direction: mission.direction,
      createdAt: now.toISOString(),
    }, now, {
      x: existingSite.x,
      y: existingSite.y,
      mapTerrain: existingSite.mapTerrain,
      terrain: existingSite.terrain,
    });
    WorldMapService.bindSiteToTile(gameState, existingSite.x, existingSite.y, existingSite.id, now);
    upsertScoutAreaRecord(gameState, mission, 'site', { siteId: existingSite.id, scoutedAt, now });
    return { site: existingSite, report: mission.report };
  }

  if (coordinateRecord?.result === 'empty') {
    mission.resolvedTarget = true;
    mission.result = 'empty';
    mission.siteId = null;
    mission.report = createEmptyScoutReport(gameState, mission, now, true);
    upsertScoutAreaRecord(gameState, mission, 'empty', { scoutedAt, now });
    return { site: null, report: mission.report };
  }

  if (coordinateRecord?.result === 'site' && coordinateRecord.siteId) {
    const recordedSite = getTerritory(gameState, coordinateRecord.siteId);
    mission.resolvedTarget = true;
    mission.result = 'site';
    mission.siteId = coordinateRecord.siteId;
    mission.report = recordedSite
      ? attachScoutReportMapSnapshot(gameState, mission, {
        id: `report_${recordedSite.id}_${now.getTime()}`,
        siteId: recordedSite.id,
        title: 'Scout confirmed site',
        text: `Scout confirmed ${recordedSite.naturalName || recordedSite.id}.`,
        direction: mission.direction,
        createdAt: now.toISOString(),
      }, now, {
        x: recordedSite.x,
        y: recordedSite.y,
        mapTerrain: recordedSite.mapTerrain,
        terrain: recordedSite.terrain,
      })
      : createEmptyScoutReport(gameState, mission, now, true);
    if (recordedSite) WorldMapService.bindSiteToTile(gameState, recordedSite.x, recordedSite.y, recordedSite.id, now);
    upsertScoutAreaRecord(gameState, mission, recordedSite ? 'site' : 'empty', {
      siteId: recordedSite?.id || null,
      scoutedAt,
      now,
    });
    return { site: recordedSite || null, report: mission.report };
  }

  const outcome = rollScoutOutcome(gameState, randomSource);
  mission.resolvedTarget = true;
  mission.result = outcome;
  if (outcome === 'empty') {
    recordScoutOutcome(gameState, 'empty');
    mission.siteId = null;
    mission.report = createEmptyScoutReport(gameState, mission, now);
    upsertScoutAreaRecord(gameState, mission, 'empty', { scoutedAt, now });
    return { site: null, report: mission.report };
  }

  const siteCoord = pickScoutSiteCoordinate(gameState, mission, now);
  if (!siteCoord) {
    recordScoutOutcome(gameState, 'empty');
    mission.result = 'empty';
    mission.siteId = null;
    mission.report = createEmptyScoutReport(gameState, mission, now);
    upsertScoutAreaRecord(gameState, mission, 'empty', { scoutedAt, now });
    return { site: null, report: mission.report };
  }

  mission.siteX = siteCoord.q;
  mission.siteY = siteCoord.r;
  mission.siteTerrain = siteCoord.terrain;
  mission.scoutDistance = Math.max(
    1,
    getRelativeDistance(toInteger(mission.originX, 0), toInteger(mission.originY, 0), siteCoord.q, siteCoord.r),
  );
  recordScoutOutcome(gameState, 'site');
  const created = createSiteFromScout(gameState, mission, now, randomSource);
  const site = created.site;
  gameState.territories.push(site);
  WorldMapService.bindSiteToTile(gameState, site.x, site.y, site.id, now);
  recordDiscoveredSiteOwnership(gameState, site.owner);
  upsertScoutAreaRecord(gameState, mission, 'site', { siteId: site.id, scoutedAt: site.discoveredAt || scoutedAt, now });
  mission.siteId = site.id;
  mission.report = created.report;
  return { site, report: mission.report };
}

function startScout(gameState, direction, now = new Date()) {
  normalizeTerritoryState(gameState, now);
  const normalizedDirection = normalizeDirection(direction);
  if (!normalizedDirection) return { success: false, error: 'INVALID_DIRECTION', message: '请选择有效侦察方向' };
  if (countActiveScoutMissions(gameState) >= MAX_ACTIVE_SCOUTS) {
    return { success: false, error: 'SCOUT_LIMIT_REACHED', message: `最多同时派出 ${MAX_ACTIVE_SCOUTS} 支侦察队` };
  }
  const existing = getScoutMissions(gameState).find((mission) => mission.direction === normalizedDirection && ['active', 'ready'].includes(mission.status));
  if (existing) return { success: false, error: 'SCOUT_EXISTS', message: `${DIRECTIONS[normalizedDirection].label}已有侦察任务` };
  const requestedOrigin = getScoutOrigin(gameState);
  const target = ScoutPlanner.findNextCoordinate(gameState, normalizedDirection, requestedOrigin);
  if (!target) return { success: false, error: 'NO_SCOUT_TARGET', message: '该方向暂时没有可侦察区域' };
  const origin = target.origin || requestedOrigin;
  const routeStartDistance = Math.max(1, target.distance - SCOUT_ACTION_POINTS + 1);
  const route = WorldMapService.buildScoutRoute(
    { q: origin.x, r: origin.y },
    normalizedDirection,
    SCOUT_ACTION_POINTS,
    { startDistance: routeStartDistance },
  )
    .map((step) => ({
      ...step,
      tileId: WorldMapService.getTileId(step.q, step.r),
      revealed: false,
    }));
  const revealArea = WorldMapService.getScoutRevealArea(
    WorldMapService.ensureWorldMap(gameState, now).seed,
    route,
    normalizedDirection,
  ).map((coord) => ({
    ...coord,
    tileId: WorldMapService.getTileId(coord.q, coord.r),
    revealed: false,
  }));
  const mission = {
    id: `scout_${normalizedDirection}_${now.getTime()}`,
    kind: 'scout',
    direction: normalizedDirection,
    sourceCityId: origin.cityId,
    originTerritoryId: origin.territoryId,
    originName: origin.name,
    originX: origin.x,
    originY: origin.y,
    targetX: target.x,
    targetY: target.y,
    scoutDistance: target.distance,
    actionPoints: SCOUT_ACTION_POINTS,
    actionPointsRemaining: SCOUT_ACTION_POINTS,
    route,
    revealArea,
    revealAreaSource: 'directional-route-v1',
    revealedTileIds: [],
    resolvedTarget: false,
    result: null,
    siteId: null,
    report: null,
    nextStepAt: now.toISOString(),
    returnedAt: null,
    startedAt: now.toISOString(),
    completesAt: new Date(now.getTime() + SCOUT_DURATION_MS).toISOString(),
    status: 'active',
  };
  gameState.warMissions = [...(gameState.warMissions || []), mission];
  return { success: true, message: `侦察队已向${DIRECTIONS[normalizedDirection].label}出发`, mission };
}

function claimScout(gameState, missionId, now = new Date(), randomSource = Math.random) {
  normalizeTerritoryState(gameState, now);
  const mission = (gameState.warMissions || []).find((item) => item.id === missionId && getMissionKind(item) === 'scout');
  if (!mission) return { success: false, error: 'MISSION_NOT_FOUND', message: '没有找到侦察任务' };
  if (mission.status !== 'ready') return { success: false, error: 'MISSION_NOT_READY', message: '侦察队尚未返回' };
  ensureScoutMissionAreaRevealed(gameState, mission, now);
  const resolved = resolveScoutMissionTarget(gameState, mission, now, randomSource);
  const site = mission.siteId ? getTerritory(gameState, mission.siteId) : resolved.site;
  const report = mission.report || resolved.report || createEmptyScoutReport(gameState, mission, now, true);
  gameState.scoutReports = [...(gameState.scoutReports || []), report].slice(-MAX_REPORTS);
  gameState.warMissions = (gameState.warMissions || []).filter((item) => item.id !== mission.id);
  return {
    success: true,
    message: site ? `侦察发现：${site.naturalName}` : '侦察结束：该处暂未发现可占领地点',
    site: site || null,
    report,
  };
}

function scoutTerritory(gameState, direction, now = new Date()) {
  return startScout(gameState, direction, now);
}

function startConquest(gameState, territoryId, expeditionInput, now = new Date()) {
  normalizeTerritoryState(gameState, now);
  return createConquestMission(gameState, territoryId, expeditionInput, now);
}

function claimConquest(gameState, territoryId, now = new Date()) {
  normalizeTerritoryState(gameState, now);
  return resolveConquestClaim(gameState, territoryId, now);
}
function renameCity(gameState, territoryId, cityName) {
  normalizeTerritoryState(gameState);
  return applyCityName(gameState, territoryId, cityName);
}

function renamePolity(gameState, polityName) {
  normalizeTerritoryState(gameState);
  return applyPolityName(gameState, polityName);
}
function getClientTerritoryState(gameState, now = new Date()) {
  return TerritoryClientAssembler.getClientTerritoryState(gameState, now, {
    CONQUEST_DURATION_MS,
    DIRECTIONS,
    MAX_ACTIVE_SCOUTS,
    SCOUT_DURATION_MS,
    countTotalSoldiersOnMission,
    createInitialPolity,
    getActiveScoutMission,
    getAvailableSoldiers,
    getDistance,
    getMissionKind,
    getNamingPrompt,
    getOccupationMode,
    getOccupiedCount,
    getRelativeDistance,
    getScoutOrigin,
    getTerritoryEffects,
    normalizeScoutState,
    toInteger,
    updateMissionReadiness,
  });
}

module.exports = {
  DIRECTIONS,
  SITE_ART,
  SITE_TEMPLATES,
  MIN_EXPEDITION_SOLDIERS,
  SCOUT_DURATION_MS,
  SCOUT_STEP_DURATION_MS,
  SCOUT_ACTION_POINTS,
  SCOUT_SITE_MIN_DISTANCE,
  CONQUEST_DURATION_MS,
  MISSION_DURATION_MS: CONQUEST_DURATION_MS,
  createInitialPolity,
  createInitialTerritories,
  normalizeTerritoryState,
  getTerritoryEffects,
  getAvailableSoldiers,
  countSoldiersOnMission,
  getClientTerritoryState,
  getActiveScoutMission,
  getScoutMissions,
  startScout,
  claimScout,
  scoutTerritory,
  startConquest,
  claimConquest,
  renameCity,
  renamePolity,
  updateMissionReadiness,
};
