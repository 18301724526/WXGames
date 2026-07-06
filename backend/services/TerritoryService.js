const DefenderLeaderService = require('./DefenderLeaderService');
const WorldMapService = require('./WorldMapService');
const TerritoryClientAssembler = require('./TerritoryClientAssembler');
const {
  CONQUEST_DURATION_MS,
  MIN_EXPEDITION_SOLDIERS,
  SITE_ART,
  SITE_TEMPLATES,
} = require('./territory/TerritoryConstants');
const createTerritoryCombatTargets = require('./territory/TerritoryCombatTargets');
const createTerritoryConquestMissions = require('./territory/TerritoryConquestMissions');
const GarrisonCaptureResolver = require('./territory/GarrisonCaptureResolver');
const createTerritoryMilitaryMissions = require('./territory/TerritoryMilitaryMissions');
const createTerritoryNaming = require('./territory/TerritoryNaming');
const createTerritoryQueries = require('./territory/TerritoryQueries');
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
  getScoutOrigin,
  getTerritory,
  getTerritoryEffects,
} = createTerritoryQueries();
const {
  normalizeBattleTarget,
  normalizeGarrison,
} = createTerritoryCombatTargets({
  DefenderLeaderService,
  WorldMapService,
});
const {
  allocateSoldiersForMission,
  countSoldiersOnMission,
  countTotalSoldiersOnMission,
  getActiveMissionForTerritory,
  getAvailableSoldiers,
  getMissionKind,
  getMissionSoldierAllocations,
  updateMissionReadiness,
} = createTerritoryMilitaryMissions({
  WorldMapService,
});
const {
  normalizeTerritoryState,
} = createTerritoryStateNormalizer({
  WorldMapService,
  getMissionSoldierAllocations,
  normalizeBattleTarget,
  normalizeGarrison,
  updateMissionReadiness,
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
const ConquestBattleService = require('./battle/ConquestBattleService');
const ConquestMissions = createTerritoryConquestMissions({
  BattleService,
  ConquestBattleService,
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

function getTerritoryBattleTileSnapshot(gameState, territory, now = new Date()) {
  const x = toInteger(territory?.x, 0);
  const y = toInteger(territory?.y, 0);
  const worldMap = WorldMapService.ensureWorldMap(gameState, now);
  const tileId = WorldMapService.getTileId(x, y);
  const tile = (worldMap.tiles || []).find((item) => item.q === x && item.r === y) || null;
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

function startConquest(gameState, territoryId, expeditionInput, now = new Date()) {
  normalizeTerritoryState(gameState, now);
  return createConquestMission(gameState, territoryId, expeditionInput, now);
}

function claimConquest(gameState, territoryId, now = new Date()) {
  normalizeTerritoryState(gameState, now);
  return resolveConquestClaim(gameState, territoryId, now);
}
// ②b: resolve a pending captured-general decision (execute/recruit/release).
function resolveCapture(gameState, decisionId, choice, now = new Date()) {
  return GarrisonCaptureResolver.resolveCaptureDecision(gameState, decisionId, choice, now);
}
function renameCity(gameState, territoryId, cityName) {
  normalizeTerritoryState(gameState);
  return applyCityName(gameState, territoryId, cityName);
}

function renamePolity(gameState, polityName) {
  normalizeTerritoryState(gameState);
  return applyPolityName(gameState, polityName);
}
function getClientTerritoryState(gameState, now = new Date(), projection = {}) {
  return TerritoryClientAssembler.getClientTerritoryState(gameState, now, {
    CONQUEST_DURATION_MS,
    countTotalSoldiersOnMission,
    createInitialPolity,
    getAvailableSoldiers,
    getDistance,
    getMissionKind,
    getNamingPrompt,
    getOccupationMode,
    getOccupiedCount,
    getRelativeDistance,
    getScoutOrigin,
    getTerritoryEffects,
    toInteger,
    updateMissionReadiness,
  }, projection);
}

module.exports = {
  SITE_ART,
  SITE_TEMPLATES,
  MIN_EXPEDITION_SOLDIERS,
  CONQUEST_DURATION_MS,
  MISSION_DURATION_MS: CONQUEST_DURATION_MS,
  createInitialPolity,
  createInitialTerritories,
  normalizeTerritoryState,
  getTerritoryEffects,
  getAvailableSoldiers,
  countSoldiersOnMission,
  getClientTerritoryState,
  startConquest,
  claimConquest,
  resolveCapture,
  renameCity,
  renamePolity,
  updateMissionReadiness,
};
