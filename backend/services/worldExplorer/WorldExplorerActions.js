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

function normalizeFormationSlot(value, fallback = 1) {
  const slot = Math.floor(Number(value));
  return Number.isFinite(slot) && slot > 0 ? slot : fallback;
}

function getBusyFormationMission(gameState, formation = {}) {
  const cityId = formation.cityId || 'capital';
  const slot = normalizeFormationSlot(formation.slot);
  return (gameState.exploreMissions || []).find((mission) => {
    if (!['active', 'ready'].includes(mission?.status)) return false;
    const missionFormation = mission.formation || {};
    return (missionFormation.cityId || 'capital') === cityId
      && normalizeFormationSlot(missionFormation.slot) === slot;
  }) || null;
}

function getIdleFormationMission(gameState, formation = {}) {
  const cityId = formation.cityId || 'capital';
  const slot = normalizeFormationSlot(formation.slot);
  return (gameState.exploreMissions || []).find((mission) => {
    if (mission?.status !== 'idle') return false;
    const missionFormation = mission.formation || {};
    return (missionFormation.cityId || 'capital') === cityId
      && normalizeFormationSlot(missionFormation.slot) === slot;
  }) || null;
}

function startExplore(gameState, options = {}, now = new Date()) {
  normalizeExploreState(gameState, now);
  const formationValidation = validateTutorialFormation(gameState, options);
  if (!formationValidation.success) return formationValidation;
  const busyMission = getBusyFormationMission(gameState, formationValidation.formation);
  if (busyMission) {
    return {
      success: false,
      error: 'EXPLORE_FORMATION_BUSY',
      message: 'This formation is already marching.',
      mission: getClientMission(busyMission, now),
    };
  }
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
    homeOrigin: origin,
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

function startWorldMarch(gameState, options = {}, now = new Date()) {
  normalizeExploreState(gameState, now);
  const formationValidation = validateTutorialFormation(gameState, options);
  if (!formationValidation.success) return formationValidation;
  const busyMission = getBusyFormationMission(gameState, formationValidation.formation);
  if (busyMission) {
    return {
      success: false,
      error: 'EXPLORE_FORMATION_BUSY',
      message: 'This formation is already marching.',
      mission: getClientMission(busyMission, now),
    };
  }
  if (countActiveMissions(gameState) >= MAX_ACTIVE_EXPLORE_MISSIONS) {
    return { success: false, error: 'EXPLORE_LIMIT_REACHED', message: 'An explorer mission is already active.' };
  }
  const origin = getExploreOrigin(gameState);
  const idleMission = getIdleFormationMission(gameState, formationValidation.formation);
  const marchOrigin = idleMission
    ? (idleMission.position || getLastRevealedOrOrigin(idleMission))
    : origin;
  const worldMap = WorldMapService.ensureWorldMap(gameState, now);
  const routeResult = buildManualRoute(marchOrigin, {
    q: options.targetQ ?? options.q ?? options.x,
    r: options.targetR ?? options.r ?? options.y,
  }, worldMap.seed);
  if (!routeResult.success) return routeResult;
  const route = routeResult.route || [];
  if (!route.length) {
    return { success: false, error: 'EXPLORE_ROUTE_EMPTY', message: 'No explorer route could be generated.' };
  }
  const plannedTiles = createPlannedTiles(gameState, route, now);
  const plannedSites = createTutorialPlannedSites(gameState, route, plannedTiles, now);
  const mission = idleMission || normalizeMission({
    id: `explore_manual_${now.getTime()}`,
    mode: 'manual',
    status: 'active',
    origin: marchOrigin,
    homeOrigin: idleMission?.homeOrigin || origin,
    route,
    formation: formationValidation.formation,
    stepDurationMs: EXPLORE_STEP_DURATION_MS,
    startedAt: now.toISOString(),
    nextStepAt: new Date(now.getTime() + EXPLORE_STEP_DURATION_MS).toISOString(),
    completesAt: new Date(now.getTime() + EXPLORE_STEP_DURATION_MS * route.length).toISOString(),
  });
  if (idleMission) {
    rebaseMissionRoute(idleMission, route, now, {
      origin: marchOrigin,
      plannedTiles,
      plannedSites,
    });
  } else {
    mission.plannedTiles = plannedTiles;
    mission.plannedSites = plannedSites;
    gameState.exploreMissions = [...(gameState.exploreMissions || []), mission];
  }
  gameState.tutorial = advanceTutorialStep(gameState.tutorial, TUTORIAL_STEPS.scoutExploreStarted);
  return {
    success: true,
    message: 'Explorer mission started.',
    mission: getClientMission(mission, now),
    tutorial: gameState.tutorial,
  };
}

function findActiveMission(gameState, missionId, now = new Date()) {
  normalizeExploreState(gameState, now);
  return (gameState.exploreMissions || []).find((item) => item.id === missionId && item.status === 'active') || null;
}

function getLastRevealedOrOrigin(mission) {
  const revealed = [...(mission.route || [])].reverse().find((step) => step.revealed);
  return revealed || mission.origin || { q: 0, r: 0 };
}

function rebaseMissionRoute(mission, route, now = new Date(), options = {}) {
  if (options.origin) {
    mission.homeOrigin = mission.homeOrigin || mission.origin || options.origin;
    mission.origin = {
      ...(mission.origin || {}),
      ...options.origin,
      q: options.origin.q,
      r: options.origin.r,
      tileId: options.origin.tileId || WorldMapService.getTileId(options.origin.q, options.origin.r),
    };
  }
  const normalizedRoute = route.map((step, index) => ({
    q: step.q,
    r: step.r,
    step: index + 1,
    tileId: step.tileId || WorldMapService.getTileId(step.q, step.r),
    revealed: false,
    revealedAt: null,
  }));
  mission.route = normalizedRoute;
  mission.target = normalizedRoute.at(-1)
    ? { q: normalizedRoute.at(-1).q, r: normalizedRoute.at(-1).r, tileId: normalizedRoute.at(-1).tileId }
    : { q: mission.origin?.q || 0, r: mission.origin?.r || 0, tileId: WorldMapService.getTileId(mission.origin?.q || 0, mission.origin?.r || 0) };
  mission.position = normalizedRoute.length
    ? { ...(mission.origin || {}), tileId: mission.origin?.tileId || WorldMapService.getTileId(mission.origin?.q || 0, mission.origin?.r || 0) }
    : { q: mission.target.q, r: mission.target.r, tileId: WorldMapService.getTileId(mission.target.q, mission.target.r) };
  mission.status = normalizedRoute.length ? 'active' : 'idle';
  mission.plannedTiles = Array.isArray(options.plannedTiles) ? options.plannedTiles : [];
  mission.plannedSites = Array.isArray(options.plannedSites) ? options.plannedSites : [];
  mission.revealedTileIds = [];
  mission.startedAt = now.toISOString();
  mission.nextStepAt = normalizedRoute.length
    ? new Date(now.getTime() + mission.stepDurationMs).toISOString()
    : null;
  mission.completesAt = normalizedRoute.length
    ? new Date(now.getTime() + mission.stepDurationMs * normalizedRoute.length).toISOString()
    : now.toISOString();
  mission.completedAt = normalizedRoute.length ? null : now.toISOString();
  return mission;
}

function returnWorldMarch(gameState, missionId, now = new Date()) {
  const mission = findActiveMission(gameState, missionId, now);
  if (!mission) return { success: false, error: 'EXPLORE_MISSION_NOT_FOUND', message: 'Explorer mission not found.' };
  const current = getLastRevealedOrOrigin(mission);
  const origin = mission.homeOrigin || mission.origin || { q: 0, r: 0 };
  const worldMap = WorldMapService.ensureWorldMap(gameState, now);
  const routeResult = buildManualRoute(current, { q: origin.q, r: origin.r }, worldMap.seed);
  if (!routeResult.success) {
    rebaseMissionRoute(mission, [], now);
  } else {
    rebaseMissionRoute(mission, routeResult.route, now);
  }
  return {
    success: true,
    message: 'Explorer returning.',
    mission: getClientMission(mission, now),
    tutorial: gameState.tutorial,
  };
}

function stopWorldMarch(gameState, missionId, options = {}, now = new Date()) {
  const mission = findActiveMission(gameState, missionId, now);
  if (!mission) return { success: false, error: 'EXPLORE_MISSION_NOT_FOUND', message: 'Explorer mission not found.' };
  const current = getLastRevealedOrOrigin(mission);
  const target = {
    q: options.targetQ ?? options.stopQ ?? options.q ?? current.q,
    r: options.targetR ?? options.stopR ?? options.r ?? current.r,
  };
  const worldMap = WorldMapService.ensureWorldMap(gameState, now);
  const routeResult = buildManualRoute(current, target, worldMap.seed);
  if (!routeResult.success) {
    rebaseMissionRoute(mission, [], now);
  } else {
    rebaseMissionRoute(mission, routeResult.route, now);
  }
  return {
    success: true,
    message: 'Explorer stopping.',
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
  startWorldMarch,
  returnWorldMarch,
  stopWorldMarch,
  claimExplore,
};
