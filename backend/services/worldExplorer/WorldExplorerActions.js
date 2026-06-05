const WorldMapService = require('../WorldMapService');
const { TUTORIAL_STEPS } = require('../../config/TutorialFlowConfig');
const {
  EXPLORE_STEP_DURATION_MS,
  MAX_ACTIVE_EXPLORE_MISSIONS,
} = require('./WorldExplorerShared');
const { normalizeMission } = require('./WorldExplorerMissionNormalizer');
const { normalizeExploreState } = require('./WorldExplorerProgression');
const { getClientMission } = require('./WorldExplorerClientState');
const {
  getExploreOrigin,
  buildManualRoute,
  buildRandomRoute,
  createPlannedTiles,
  createTutorialPlannedSites,
} = require('./WorldExplorerRoutePlanner');
const {
  advanceTutorialStep,
  validateTutorialFormation,
  ensureTutorialFirstCityClaimSoldiers,
} = require('./WorldExplorerTutorial');

function countActiveMissions(gameState) {
  return (gameState.exploreMissions || []).filter((mission) => mission.status === 'active').length;
}

function startExplore(gameState, options = {}, now = new Date()) {
  normalizeExploreState(gameState, now);
  const formationValidation = validateTutorialFormation(gameState, options);
  if (!formationValidation.success) return formationValidation;
  if (countActiveMissions(gameState) >= MAX_ACTIVE_EXPLORE_MISSIONS) {
    return { success: false, error: 'EXPLORE_LIMIT_REACHED', message: 'An explorer mission is already active.' };
  }
  const mode = options.mode === 'manual' ? 'manual' : 'random';
  const origin = getExploreOrigin(gameState);
  const worldMap = WorldMapService.ensureWorldMap(gameState, now);
  let routeResult = null;
  if (mode === 'manual') {
    routeResult = buildManualRoute(origin, {
      q: options.targetQ ?? options.q ?? options.x,
      r: options.targetR ?? options.r ?? options.y,
    }, worldMap.seed);
    if (!routeResult.success) return routeResult;
  } else {
    routeResult = {
      success: true,
      route: buildRandomRoute(gameState, origin, options.routeLength, now),
    };
  }
  const route = routeResult.route || [];
  if (!route.length) {
    return { success: false, error: 'EXPLORE_ROUTE_EMPTY', message: 'No explorer route could be generated.' };
  }
  const plannedTiles = createPlannedTiles(gameState, route, now);
  const plannedSites = createTutorialPlannedSites(gameState, route, plannedTiles, now);
  const mission = normalizeMission({
    id: `explore_${mode}_${now.getTime()}`,
    mode,
    status: 'active',
    origin,
    target: routeResult.target || { q: route.at(-1).q, r: route.at(-1).r },
    route,
    plannedTiles,
    plannedSites,
    revealedTileIds: [],
    formation: formationValidation.formation,
    stepDurationMs: EXPLORE_STEP_DURATION_MS,
    startedAt: now.toISOString(),
    nextStepAt: new Date(now.getTime() + EXPLORE_STEP_DURATION_MS).toISOString(),
    completesAt: new Date(now.getTime() + EXPLORE_STEP_DURATION_MS * route.length).toISOString(),
  });
  gameState.exploreMissions = [...(gameState.exploreMissions || []), mission];
  gameState.tutorial = advanceTutorialStep(gameState.tutorial, TUTORIAL_STEPS.scoutExploreStarted);
  return {
    success: true,
    message: 'Explorer mission started.',
    mission: getClientMission(mission, now),
    tutorial: gameState.tutorial,
  };
}

function claimExplore(gameState, missionId, now = new Date()) {
  normalizeExploreState(gameState, now);
  const mission = (gameState.exploreMissions || []).find((item) => item.id === missionId);
  if (!mission) return { success: false, error: 'EXPLORE_MISSION_NOT_FOUND', message: 'Explorer mission not found.' };
  if (mission.status !== 'ready') return { success: false, error: 'EXPLORE_MISSION_NOT_READY', message: 'Explorer mission is not ready.' };
  gameState.exploreMissions = (gameState.exploreMissions || []).filter((item) => item.id !== mission.id);
  gameState.tutorial = advanceTutorialStep(gameState.tutorial, TUTORIAL_STEPS.scoutExploreClaimed);
  ensureTutorialFirstCityClaimSoldiers(gameState);
  return {
    success: true,
    message: 'Explorer mission complete.',
    mission: getClientMission({ ...mission, claimedAt: now.toISOString() }, now),
    tutorial: gameState.tutorial,
  };
}

module.exports = {
  countActiveMissions,
  startExplore,
  claimExplore,
};
