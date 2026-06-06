const WorldMapService = require('../WorldMapService');
const {
  EXPLORE_STEP_DURATION_MS,
  DEFAULT_RANDOM_ROUTE_LENGTH,
  MAX_MANUAL_ROUTE_LENGTH,
  MAX_ACTIVE_EXPLORE_MISSIONS,
  clone,
  toTimestamp,
} = require('./WorldExplorerShared');
const { normalizeExploreState } = require('./WorldExplorerProgression');

function getClientMission(mission, now = new Date()) {
  const route = (mission.route || []).map((step) => ({
    q: step.q,
    r: step.r,
    step: step.step,
    tileId: step.tileId,
    revealed: Boolean(step.revealed),
    revealedAt: step.revealedAt || null,
  }));
  const lastRevealed = [...route].reverse().find((step) => step.revealed);
  const nextStepAtMs = toTimestamp(mission.nextStepAt, 0);
  return {
    id: mission.id,
    kind: mission.kind || 'worldExplore',
    mode: mission.mode,
    status: mission.status,
    origin: clone(mission.origin || {}),
    target: clone(mission.target || {}),
    route,
    plannedTiles: (mission.plannedTiles || []).map((tile) => clone(tile)),
    plannedSites: (mission.plannedSites || []).map((site) => ({
      tileId: site.tileId,
      q: site.q,
      r: site.r,
      siteId: site.siteId,
      materialized: Boolean(site.materialized),
      revealedAt: site.revealedAt || null,
      site: clone(site.site || null),
    })),
    formation: clone(mission.formation || {}),
    position: lastRevealed
      ? { q: lastRevealed.q, r: lastRevealed.r, tileId: lastRevealed.tileId }
      : { q: mission.origin?.q || 0, r: mission.origin?.r || 0, tileId: WorldMapService.getTileId(mission.origin?.q || 0, mission.origin?.r || 0) },
    revealedTileIds: [...(mission.revealedTileIds || [])],
    stepDurationSeconds: Math.floor((mission.stepDurationMs || EXPLORE_STEP_DURATION_MS) / 1000),
    remainingSeconds: mission.status === 'active' && nextStepAtMs
      ? Math.max(0, Math.ceil((nextStepAtMs - now.getTime()) / 1000))
      : 0,
    startedAt: mission.startedAt,
    nextStepAt: mission.nextStepAt || null,
    completesAt: mission.completesAt || null,
    completedAt: mission.completedAt || null,
  };
}

function getClientState(gameState, now = new Date()) {
  normalizeExploreState(gameState, now);
  const missions = (gameState.exploreMissions || []).map((mission) => getClientMission(mission, now));
  return {
    missions,
    activeMission: missions.find((mission) => mission.status === 'active') || null,
    readyMissions: missions.filter((mission) => mission.status === 'ready'),
    maxActiveMissions: MAX_ACTIVE_EXPLORE_MISSIONS,
    randomRouteLength: DEFAULT_RANDOM_ROUTE_LENGTH,
    maxManualRouteLength: MAX_MANUAL_ROUTE_LENGTH,
    stepDurationSeconds: Math.floor(EXPLORE_STEP_DURATION_MS / 1000),
  };
}

module.exports = {
  getClientMission,
  getClientState,
};
