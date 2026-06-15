const WorldMapService = require('../WorldMapService');
const { TutorialFlowConfig } = require('../config/GameplayConfigRuntime');
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
  createPlannedTiles,
  createTutorialPlannedSites,
  shouldGuaranteeTutorialEmptyCity,
} = require('./WorldExplorerRoutePlanner');
const {
  advanceTutorialStep,
  validateTutorialFormation,
  ensureTutorialFirstCityClaimSoldiers,
} = require('./WorldExplorerTutorial');
const {
  AoiSyncSnapshot,
  CommandAuthorityContract,
  ServerTimelineSnapshot,
} = require('../realtime');

function countActiveMissions(gameState) {
  return (gameState.exploreMissions || []).filter((mission) => mission.status === 'active').length;
}

function getTutorialSteps() {
  return TutorialFlowConfig.TUTORIAL_STEPS;
}

function normalizeFormationSlot(value, fallback = 1) {
  const slot = Math.floor(Number(value));
  return Number.isFinite(slot) && slot > 0 ? slot : fallback;
}

function getBusyFormationMission(gameState, formation = {}) {
  const cityId = formation.cityId || 'capital';
  const slot = normalizeFormationSlot(formation.slot);
  return (gameState.exploreMissions || []).find((mission) => {
    if (mission?.status !== 'active') return false;
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

function isTraceEnabled(options = {}) {
  return Boolean(options?.debugTrace || options?.worldMarchTrace);
}

function summarizeCoord(coord = {}) {
  if (!coord || typeof coord !== 'object') return null;
  const q = Number(coord.q ?? coord.x ?? 0);
  const r = Number(coord.r ?? coord.y ?? 0);
  return {
    q,
    r,
    tileId: WorldMapService.getTileId(q, r),
  };
}

function summarizeMission(mission = null) {
  if (!mission || typeof mission !== 'object') return null;
  const route = Array.isArray(mission.route) ? mission.route : [];
  const plannedTiles = Array.isArray(mission.plannedTiles) ? mission.plannedTiles : [];
  const plannedSites = Array.isArray(mission.plannedSites) ? mission.plannedSites : [];
  const revealedTileIds = Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds : [];
  return {
    id: mission.id || '',
    mode: mission.mode || '',
    status: mission.status || '',
    origin: summarizeCoord(mission.origin),
    target: summarizeCoord(mission.target),
    position: summarizeCoord(mission.position),
    routeCount: route.length,
    routeIds: route.slice(0, 8).map((step) => WorldMapService.getTileId(step.q, step.r)),
    plannedTileCount: plannedTiles.length,
    plannedTileIds: plannedTiles.slice(0, 8).map((tile) => WorldMapService.getTileId(tile.q, tile.r)),
    plannedSiteCount: plannedSites.length,
    plannedSiteIds: plannedSites.slice(0, 8).map((site) => site.siteId || site.site?.id || site.tileId),
    revealedTileCount: revealedTileIds.length,
    revealedTileIds: revealedTileIds.slice(0, 8),
    formation: mission.formation ? {
      cityId: mission.formation.cityId || 'capital',
      slot: normalizeFormationSlot(mission.formation.slot),
      memberCount: Array.isArray(mission.formation.memberIds) ? mission.formation.memberIds.length : 0,
    } : null,
    startedAt: mission.startedAt || '',
    nextStepAt: mission.nextStepAt || '',
    completesAt: mission.completesAt || '',
  };
}

function traceWorldMarch(stage, options = {}, payload = {}) {
  if (!isTraceEnabled(options)) return false;
  try {
    console.info('[WorldMarchTrace:server]', stage, {
      at: new Date().toISOString(),
      ...payload,
    });
    return true;
  } catch (_) {
    return false;
  }
}

function startWorldMarch(gameState, options = {}, now = new Date()) {
  const TUTORIAL_STEPS = getTutorialSteps();
  normalizeExploreState(gameState, now);
  traceWorldMarch('actions:startWorldMarch:begin', options, {
    target: {
      q: options.targetQ ?? options.q ?? options.x ?? null,
      r: options.targetR ?? options.r ?? options.y ?? null,
    },
    formationSlot: options.formationSlot ?? options.slot ?? null,
    existingMissions: (gameState.exploreMissions || []).map(summarizeMission),
  });
  const formationValidation = validateTutorialFormation(gameState, options);
  if (!formationValidation.success) {
    traceWorldMarch('actions:startWorldMarch:formationRejected', options, {
      result: formationValidation,
    });
    return formationValidation;
  }
  const busyMission = getBusyFormationMission(gameState, formationValidation.formation);
  if (busyMission) {
    traceWorldMarch('actions:startWorldMarch:busyFormation', options, {
      formation: formationValidation.formation,
      busyMission: summarizeMission(busyMission),
    });
    return {
      success: false,
      error: 'EXPLORE_FORMATION_BUSY',
      message: 'This formation is already marching.',
      mission: getClientMission(busyMission, now),
    };
  }
  if (countActiveMissions(gameState) >= MAX_ACTIVE_EXPLORE_MISSIONS) {
    traceWorldMarch('actions:startWorldMarch:limitReached', options, {
      activeCount: countActiveMissions(gameState),
      maxActive: MAX_ACTIVE_EXPLORE_MISSIONS,
    });
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
  traceWorldMarch('actions:startWorldMarch:routeResult', options, {
    origin: summarizeCoord(origin),
    marchOrigin: summarizeCoord(marchOrigin),
    target: summarizeCoord(routeResult.target || {
      q: options.targetQ ?? options.q ?? options.x,
      r: options.targetR ?? options.r ?? options.y,
    }),
    success: routeResult.success,
    error: routeResult.error || '',
    routeCount: Array.isArray(routeResult.route) ? routeResult.route.length : 0,
    routeIds: (routeResult.route || []).slice(0, 8).map((step) => WorldMapService.getTileId(step.q, step.r)),
  });
  if (!routeResult.success) return routeResult;
  let route = routeResult.route || [];
  if (!route.length) {
    traceWorldMarch('actions:startWorldMarch:emptyRoute', options, {
      origin: summarizeCoord(origin),
      marchOrigin: summarizeCoord(marchOrigin),
    });
    return { success: false, error: 'EXPLORE_ROUTE_EMPTY', message: 'No explorer route could be generated.' };
  }
  let plannedTiles = createPlannedTiles(gameState, route, now, {
    mode: 'manual',
    origin: marchOrigin,
    target: routeResult.target || route.at(-1),
  });
  let plannedSites = createTutorialPlannedSites(gameState, route, plannedTiles, now, {
    planningContext: options.planningContext,
  });
  if (shouldGuaranteeTutorialEmptyCity(gameState)) {
    if (!plannedSites.length) {
      return {
        success: false,
        error: 'EXPLORE_TUTORIAL_TARGET_OCCUPIED',
        message: 'No valid guided empty city target is available on this route.',
      };
    }
    const tutorialTargetId = plannedSites[0].tileId;
    const tutorialTargetIndex = route.findIndex((step) => WorldMapService.getTileId(step.q, step.r) === tutorialTargetId);
    if (tutorialTargetIndex >= 0 && tutorialTargetIndex < route.length - 1) {
      route = route.slice(0, tutorialTargetIndex + 1);
      plannedTiles = createPlannedTiles(gameState, route, now, {
        mode: 'manual',
        origin: marchOrigin,
        target: route.at(-1),
      });
      plannedSites = createTutorialPlannedSites(gameState, route, plannedTiles, now, {
        planningContext: options.planningContext,
      });
    }
  }
  traceWorldMarch('actions:startWorldMarch:planned', options, {
    plannedTileCount: plannedTiles.length,
    plannedTileIds: plannedTiles.slice(0, 8).map((tile) => WorldMapService.getTileId(tile.q, tile.r)),
    plannedTerrain: plannedTiles.slice(0, 8).map((tile) => `${WorldMapService.getTileId(tile.q, tile.r)}:${tile.terrain}`),
    plannedSiteCount: plannedSites.length,
    plannedSiteIds: plannedSites.slice(0, 8).map((site) => site.siteId || site.site?.id || site.tileId),
    idleMission: summarizeMission(idleMission),
  });
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
  const result = {
    success: true,
    message: 'Explorer mission started.',
    mission: getClientMission(mission, now),
    tutorial: gameState.tutorial,
  };
  traceWorldMarch('actions:startWorldMarch:result', options, {
    mission: summarizeMission(mission),
    clientMission: summarizeMission(result.mission),
    allMissions: (gameState.exploreMissions || []).map(summarizeMission),
  });
  return attachMarchAuthority(result, gameState, mission, 'startWorldMarch', now, {
    clientSequence: options.clientSequence,
    clientInputIntent: options.clientInputIntent,
    aoiRadius: options.aoiRadius,
  });
}

function findActiveMission(gameState, missionId, now = new Date()) {
  normalizeExploreState(gameState, now);
  return (gameState.exploreMissions || []).find((item) => item.id === missionId && item.status === 'active') || null;
}

function findReturnableMission(gameState, missionId, now = new Date()) {
  normalizeExploreState(gameState, now);
  return (gameState.exploreMissions || []).find((item) => (
    item.id === missionId && ['active', 'idle'].includes(item.status)
  )) || null;
}

function getLastRevealedOrOrigin(mission) {
  const revealed = [...(mission.route || [])].reverse().find((step) => step.revealed);
  return revealed || mission.position || mission.origin || { q: 0, r: 0 };
}

function getReturnRouteOrigin(mission) {
  if (mission?.status === 'idle' && mission.position) return mission.position;
  return getLastRevealedOrOrigin(mission);
}

function rebaseMissionRoute(mission, route, now = new Date(), options = {}) {
  if (options.origin) {
    mission.homeOrigin = mission.homeOrigin || mission.origin || options.origin;
    mission.origin = {
      ...(mission.origin || {}),
      ...options.origin,
      q: options.origin.q,
      r: options.origin.r,
      tileId: WorldMapService.getTileId(options.origin.q, options.origin.r),
    };
  }
  const normalizedRoute = route.map((step, index) => ({
    q: step.q,
    r: step.r,
    step: index + 1,
    tileId: WorldMapService.getTileId(step.q, step.r),
    revealed: false,
    revealedAt: null,
  }));
  mission.route = normalizedRoute;
  mission.target = normalizedRoute.at(-1)
    ? { q: normalizedRoute.at(-1).q, r: normalizedRoute.at(-1).r, tileId: normalizedRoute.at(-1).tileId }
    : { q: mission.origin?.q || 0, r: mission.origin?.r || 0, tileId: WorldMapService.getTileId(mission.origin?.q || 0, mission.origin?.r || 0) };
  mission.position = normalizedRoute.length
    ? { ...(mission.origin || {}), tileId: WorldMapService.getTileId(mission.origin?.q || 0, mission.origin?.r || 0) }
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

function createRebasedRoutePreview(gameState, route, now = new Date(), options = {}) {
  if (!Array.isArray(route) || route.length === 0) {
    return {
      plannedTiles: [],
      plannedSites: [],
    };
  }
  return {
    plannedTiles: createPlannedTiles(gameState, route, now, {
      mode: options.mode || 'manual',
      origin: options.origin,
      target: options.target || route.at(-1),
    }),
    plannedSites: [],
  };
}

function attachMarchAuthority(result = {}, gameState = {}, mission = null, action = '', now = new Date(), options = {}) {
  if (!mission) return result;
  const timeline = ServerTimelineSnapshot.createMissionSnapshot(mission, { now });
  const aoi = AoiSyncSnapshot.createSnapshot(gameState, {
    now,
    mission,
    missionId: mission.id,
    timeline,
    radius: options.aoiRadius,
  });
  return CommandAuthorityContract.attach(result, {
    type: action,
    actorId: mission.id,
    missionId: mission.id,
    playerId: gameState.playerId || '',
    clientSequence: options.clientSequence || null,
    clientInputIntent: options.clientInputIntent || null,
    serverTime: now.toISOString(),
  }, {
    serverTime: now.toISOString(),
    timeline,
    aoi,
  });
}

function returnWorldMarch(gameState, missionId, options = {}, now = new Date()) {
  let resolvedOptions = options || {};
  let resolvedNow = now;
  if (options instanceof Date || typeof options?.toISOString === 'function') {
    resolvedNow = options;
    resolvedOptions = {};
  }
  const mission = findReturnableMission(gameState, missionId, resolvedNow);
  if (!mission) return { success: false, error: 'EXPLORE_MISSION_NOT_FOUND', message: 'Explorer mission not found.' };
  const current = getReturnRouteOrigin(mission);
  const origin = mission.homeOrigin || mission.origin || { q: 0, r: 0 };
  const worldMap = WorldMapService.ensureWorldMap(gameState, resolvedNow);
  const routeResult = buildManualRoute(current, { q: origin.q, r: origin.r }, worldMap.seed);
  if (!routeResult.success) {
    rebaseMissionRoute(mission, [], resolvedNow, { origin: current });
  } else {
    rebaseMissionRoute(mission, routeResult.route, resolvedNow, {
      origin: current,
      ...createRebasedRoutePreview(gameState, routeResult.route, resolvedNow, {
        mode: 'return',
        origin: current,
        target: routeResult.target || origin,
      }),
    });
  }
  const result = {
    success: true,
    message: 'Explorer returning.',
    mission: getClientMission(mission, resolvedNow),
    tutorial: gameState.tutorial,
  };
  return attachMarchAuthority(result, gameState, mission, 'returnWorldMarch', resolvedNow, {
    clientSequence: resolvedOptions.clientSequence,
    clientInputIntent: resolvedOptions.clientInputIntent,
    aoiRadius: resolvedOptions.aoiRadius,
  });
}

function stopWorldMarch(gameState, missionId, options = {}, now = new Date()) {
  const mission = findActiveMission(gameState, missionId, now);
  if (!mission) return { success: false, error: 'EXPLORE_MISSION_NOT_FOUND', message: 'Explorer mission not found.' };
  const timeline = ServerTimelineSnapshot.createMissionSnapshot(mission, { now });
  const current = getLastRevealedOrOrigin(mission);
  const target = timeline.stopTile || current;
  const worldMap = WorldMapService.ensureWorldMap(gameState, now);
  const routeResult = buildManualRoute(current, target, worldMap.seed);
  if (!routeResult.success) {
    rebaseMissionRoute(mission, [], now, { origin: current });
  } else {
    rebaseMissionRoute(mission, routeResult.route, now, {
      origin: current,
      ...createRebasedRoutePreview(gameState, routeResult.route, now, {
        mode: 'stop',
        origin: current,
        target: routeResult.target || target,
      }),
    });
  }
  const result = {
    success: true,
    message: 'Explorer stopping.',
    mission: getClientMission(mission, now),
    tutorial: gameState.tutorial,
  };
  return attachMarchAuthority(result, gameState, mission, 'stopWorldMarch', now, {
    clientSequence: options.clientSequence,
    clientInputIntent: options.clientInputIntent,
    aoiRadius: options.aoiRadius,
  });
}

module.exports = {
  countActiveMissions,
  startWorldMarch,
  returnWorldMarch,
  stopWorldMarch,
};
