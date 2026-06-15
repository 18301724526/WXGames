const BuildingState = require('../domain/BuildingState');
const TutorialService = require('./TutorialService');
const BuildingActionService = require('./BuildingActionService');
const BuildingEffectCalculator = require('../calculators/BuildingEffectCalculator');
const MilitaryService = require('./MilitaryService');
const EventService = require('./EventService');
const TerritoryService = require('./TerritoryService');
const WorldMapService = require('./WorldMapService');
const WorldExplorerService = require('./WorldExplorerService');
const WorldAiExplorerService = require('./WorldAiExplorerService');
const CityService = require('./CityService');
const TalentPolicyService = require('./TalentPolicyService');
const TechTreeService = require('./TechTreeService');
const FamousPersonService = require('./FamousPersonService');
const GameStateMigrationPipeline = require('./GameStateMigrationPipeline');

function createInitialGameState(playerId, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const nowIso = now.toISOString();
  const buildings = BuildingState.createInitialBuildingState();
  const buildingEffects = BuildingEffectCalculator.calculate(buildings);
  const spawn = options.spawn || options.spawnAssignment || null;
  return {
    playerId,
    saveMetadata: GameStateMigrationPipeline.createSaveMetadata(),
    resources: { food: 100, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
    buildings,
    buildingEffects,
    population: { total: 3, max: 3, maxPop: 3, farmers: 3, scholars: 0, craftsmen: 0, unassigned: 0, growthProgress: 0 },
    techs: TechTreeService.normalizeTechState({}),
    techEffects: {},
    currentEra: 0,
    eraHistory: [{ era: 0, advancedAt: nowIso }],
    happiness: 100,
    gameDay: 1,
    eventQueue: [],
    eventHistory: [],
    regularEventState: EventService.normalizeRegularEventState(null),
    threatEventState: EventService.normalizeThreatEventState(null),
    activeBuffs: [],
    offlineSnapshot: {},
    offlineEventLog: [],
    negativeStreak: 0,
    lastEventAt: 0,
    tutorial: TutorialService.createInitialTutorialState(),
    softGuideState: {},
    military: { soldiers: 0, soldierCap: 0, trainingProgress: 0, trainingIntervalSeconds: 0, trainingBatchSize: 0, defensePerSoldier: 0.01, defense: 0 },
    polity: TerritoryService.createInitialPolity(),
    territories: TerritoryService.createInitialTerritories(nowIso, { spawn }),
    worldMap: WorldMapService.createInitialWorldMap(WorldMapService.DEFAULT_WORLD_SEED, now, { spawn }),
    activeCityId: CityService.CAPITAL_CITY_ID,
    cities: {},
    talentPolicies: TalentPolicyService.createInitialTalentPolicyState(),
    famousPeople: [],
    famousPersonState: FamousPersonService.createInitialFamousPersonState(),
    taskProgress: { claimed: {} },
    scoutedCoordinates: [],
    scoutState: { emptyStreak: 0, areas: [] },
    exploreMissions: [],
    worldAi: WorldAiExplorerService.normalizeWorldAi(),
    warMissions: [],
    scoutReports: [],
    updatedAt: nowIso,
  };
}

function normalizeStateStructure(rawState) {
  const migrated = GameStateMigrationPipeline.migrateState(rawState || createInitialGameState('unknown'));
  const state = migrated.state;
  state.resources = {
    food: state.resources?.food || 0,
    knowledge: state.resources?.knowledge || 0,
    wood: state.resources?.wood || 0,
    iron: state.resources?.iron ?? state.resources?.metal ?? 0,
    stone: state.resources?.stone || 0,
    metal: state.resources?.metal ?? state.resources?.iron ?? 0,
  };
  state.buildings = BuildingState.normalizeLegacyBuildingState(state.buildings);
  state.population = {
    total: state.population?.total || 3,
    max: state.population?.max || state.population?.maxPop || 3,
    maxPop: state.population?.maxPop || state.population?.max || 3,
    farmers: state.population?.farmers || 0,
    scholars: state.population?.scholars || 0,
    craftsmen: state.population?.craftsmen || 0,
    unassigned: state.population?.unassigned || 0,
    growthProgress: state.population?.growthProgress || 0,
  };
  state.techs = TechTreeService.normalizeGameStateTechs(state);
  TechTreeService.grantEarnedEraPoints(state);
  state.techEffects = state.techEffects || {};
  state.eventQueue = state.eventQueue || [];
  state.eventHistory = state.eventHistory || [];
  EventService.cleanupRuntimeState(state);
  state.offlineSnapshot = state.offlineSnapshot || {};
  state.offlineEventLog = state.offlineEventLog || [];
  state.tutorial = TutorialService.normalizeTutorialState(state.tutorial);
  state.softGuideState = state.softGuideState && typeof state.softGuideState === 'object' ? state.softGuideState : {};
  state.military = MilitaryService.normalizeMilitaryState(state.military, state);
  state.currentEra = Number.isFinite(state.currentEra) ? state.currentEra : 0;
  state.talentPolicies = TalentPolicyService.normalizeTalentPolicyState(state.talentPolicies);
  state.famousPeople = FamousPersonService.normalizeFamousPeople(state.famousPeople);
  state.famousPersonState = FamousPersonService.normalizeFamousPersonState(state.famousPersonState);
  FamousPersonService.ensureFamousPersonState(state);
  state.taskProgress = state.taskProgress && typeof state.taskProgress === 'object' ? state.taskProgress : { claimed: {} };
  state.taskProgress.claimed = state.taskProgress.claimed && typeof state.taskProgress.claimed === 'object'
    ? state.taskProgress.claimed
    : {};
  TutorialService.ensureHouseGuideResources(state);
  TutorialService.ensureScoutFamousPersonGrant(state);
  WorldMapService.ensureWorldMap(state);
  state.exploreMissions = Array.isArray(state.exploreMissions)
    ? state.exploreMissions.map((mission) => WorldExplorerService.normalizeMission(mission)).filter(Boolean)
    : [];
  CityService.normalizeCities(state);
  WorldExplorerService.ensureTutorialFirstCityClaimSoldiers(state);
  state.eraHistory = Array.isArray(state.eraHistory) ? state.eraHistory : [{ era: state.currentEra, advancedAt: new Date().toISOString() }];
  state.gameDay = state.gameDay || 1;
  state.happiness = state.happiness || 100;
  state.updatedAt = state.updatedAt || new Date().toISOString();
  BuildingActionService.applyDerivedStats(state);
  CityService.persistLegacyFieldsToActiveCity(state);
  return state;
}

function advanceRuntimeState(gameState, now = new Date(), options = {}) {
  const state = normalizeStateStructure(gameState);
  const previousWorldMapVersion = WorldMapService.getWorldMapVersion(state.worldMap);
  WorldExplorerService.normalizeExploreState(state, now);
  if (options.advanceWorldAi === true) {
    WorldAiExplorerService.advanceAiExploration(state, now);
  }
  TerritoryService.normalizeTerritoryState(state, now, { previousWorldMapVersion });
  CityService.normalizeCities(state, now);
  WorldExplorerService.ensureTutorialFirstCityClaimSoldiers(state);
  BuildingActionService.applyDerivedStats(state);
  CityService.persistLegacyFieldsToActiveCity(state);
  return state;
}

function normalizeState(rawState) {
  return normalizeStateStructure(rawState);
}

module.exports = {
  createInitialGameState,
  normalizeState,
  normalizeStateStructure,
  advanceRuntimeState,
};
