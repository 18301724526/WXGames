const WorldMapService = require('../WorldMapService');
const {
  EXPLORE_REVEAL_RADIUS,
  TUTORIAL_FIRST_SITE_GRANT_KEY,
  toTimestamp,
} = require('./WorldExplorerShared');
const {
  normalizePlannedSite,
  normalizeMissions,
} = require('./WorldExplorerMissionNormalizer');
const {
  advanceTutorialStep,
  ensureTutorialFirstCityClaimSoldiers,
} = require('./WorldExplorerTutorial');
const { TUTORIAL_STEPS } = require('../../config/TutorialFlowConfig');

function getPlannedTileById(mission) {
  return new Map((mission.plannedTiles || []).map((tile) => [tile.id || WorldMapService.getTileId(tile.q, tile.r), tile]));
}

function materializePlannedSitesForStep(gameState, mission, step, now = new Date()) {
  const tileId = step.tileId || WorldMapService.getTileId(step.q, step.r);
  const materialized = [];
  mission.plannedSites = (mission.plannedSites || []).map((plannedSite) => {
    if (!plannedSite || plannedSite.materialized || plannedSite.tileId !== tileId) return plannedSite;
    const normalized = normalizePlannedSite(plannedSite);
    const site = normalized?.site || null;
    if (!site) return plannedSite;
    const existing = (gameState.territories || []).find((territory) => territory.id === site.id) || null;
    if (!existing) gameState.territories = [...(gameState.territories || []), site];
    const tile = WorldMapService.bindSiteToTile(gameState, site.x, site.y, site.id, now, { visibility: 'scouted' });
    materialized.push({ site, tile });
    return {
      ...plannedSite,
      materialized: true,
      revealedAt: now.toISOString(),
    };
  });
  if (materialized.length && gameState.tutorial && !gameState.tutorial.grants?.[TUTORIAL_FIRST_SITE_GRANT_KEY]) {
    gameState.tutorial = {
      ...gameState.tutorial,
      grants: {
        ...(gameState.tutorial.grants || {}),
        [TUTORIAL_FIRST_SITE_GRANT_KEY]: {
          siteId: materialized[0].site.id,
          discoveredAt: now.toISOString(),
        },
      },
      updatedAt: now.toISOString(),
    };
  }
  return materialized;
}

function revealCoordinate(gameState, mission, coord, now = new Date()) {
  const planned = getPlannedTileById(mission).get(WorldMapService.getTileId(coord.q, coord.r));
  const overrides = planned
    ? {
      terrain: planned.terrain,
      riverPorts: planned.riverPorts,
      oceanTemplates: planned.oceanTemplates,
      transitionKey: planned.transitionKey,
      generatedAt: planned.generatedAt,
      visibility: 'scouted',
    }
    : { visibility: 'scouted' };
  return WorldMapService.revealTile(gameState, coord.q, coord.r, now, overrides);
}

function revealStep(gameState, mission, step, now = new Date()) {
  const coords = EXPLORE_REVEAL_RADIUS > 0
    ? WorldMapService.getRevealArea(step.q, step.r, EXPLORE_REVEAL_RADIUS)
    : [{ q: step.q, r: step.r }];
  const revealedTiles = coords.map((coord) => revealCoordinate(gameState, mission, coord, now));
  const materialized = materializePlannedSitesForStep(gameState, mission, step, now);
  if (!materialized.length) return revealedTiles;
  const byId = new Map(revealedTiles.map((tile) => [tile.id, tile]));
  materialized.forEach(({ tile }) => {
    if (tile?.id) byId.set(tile.id, tile);
  });
  return [...byId.values()];
}

function advanceExploreMissions(gameState, now = new Date()) {
  gameState.exploreMissions = normalizeMissions(gameState.exploreMissions);
  const nowMs = now.getTime();
  const newlyRevealedTiles = [];
  for (const mission of gameState.exploreMissions) {
    if (mission.status !== 'active') continue;
    let nextStepAtMs = toTimestamp(mission.nextStepAt, nowMs);
    while (nextStepAtMs <= nowMs) {
      const step = mission.route.find((item) => !item.revealed);
      if (!step) break;
      const revealedTiles = revealStep(gameState, mission, step, now);
      step.revealed = true;
      step.revealedAt = now.toISOString();
      mission.position = {
        q: step.q,
        r: step.r,
        tileId: step.tileId || WorldMapService.getTileId(step.q, step.r),
      };
      newlyRevealedTiles.push(...revealedTiles);
      mission.revealedTileIds = Array.from(new Set([
        ...(mission.revealedTileIds || []),
        ...revealedTiles.map((tile) => tile.id),
      ]));
      nextStepAtMs += mission.stepDurationMs;
    }
    mission.nextStepAt = new Date(nextStepAtMs).toISOString();
    if (mission.route.every((step) => step.revealed)) {
      mission.status = mission.mode === 'manual' ? 'idle' : 'ready';
      mission.completedAt = mission.completedAt || now.toISOString();
      mission.nextStepAt = null;
      if (mission.status === 'idle' && gameState.tutorial?.currentStep === TUTORIAL_STEPS.scoutExploreStarted) {
        gameState.tutorial = advanceTutorialStep(gameState.tutorial, TUTORIAL_STEPS.scoutExploreClaimed);
        ensureTutorialFirstCityClaimSoldiers(gameState);
      }
    }
  }
  return newlyRevealedTiles;
}

function normalizeExploreState(gameState, now = new Date()) {
  WorldMapService.ensureWorldMap(gameState, now);
  gameState.exploreMissions = normalizeMissions(gameState.exploreMissions);
  advanceExploreMissions(gameState, now);
  return gameState.exploreMissions;
}

module.exports = {
  getPlannedTileById,
  materializePlannedSitesForStep,
  revealCoordinate,
  revealStep,
  advanceExploreMissions,
  normalizeExploreState,
};
