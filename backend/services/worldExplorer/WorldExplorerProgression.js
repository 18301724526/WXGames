const WorldMapService = require('../WorldMapService');
const {
  EXPLORE_REVEAL_RADIUS,
  TUTORIAL_FIRST_SITE_GRANT_KEY,
  toInteger,
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
const WorldExplorerTrace = require('./WorldExplorerTrace');
const { TutorialFlowConfig } = require('../config/GameplayConfigRuntime');

function getTutorialSteps() {
  return TutorialFlowConfig.TUTORIAL_STEPS;
}

function getTileIdentity(tile = {}) {
  if (!tile || typeof tile !== 'object') return '';
  const rawQ = tile.q ?? tile.x;
  const rawR = tile.r ?? tile.y;
  if (rawQ === undefined || rawR === undefined) return '';
  return WorldMapService.getTileId(toInteger(rawQ, 0), toInteger(rawR, 0));
}

function getTileIdentities(tiles = []) {
  return (Array.isArray(tiles) ? tiles : [])
    .map(getTileIdentity)
    .filter(Boolean);
}

function summarizeStep(step = {}) {
  if (!step || typeof step !== 'object') return null;
  const q = Number(step.q || 0);
  const r = Number(step.r || 0);
  return {
    q,
    r,
    tileId: WorldMapService.getTileId(q, r),
    step: Number(step.step || 0),
    revealed: Boolean(step.revealed),
    revealedAt: step.revealedAt || null,
  };
}

function summarizeMission(mission = {}) {
  const route = Array.isArray(mission.route) ? mission.route : [];
  const revealedTileIds = Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds : [];
  return {
    id: mission.id || '',
    mode: mission.mode || '',
    status: mission.status || '',
    routeCount: route.length,
    nextStep: summarizeStep(route.find((step) => !step.revealed)),
    revealedTileCount: revealedTileIds.length,
    revealedTileIds: revealedTileIds.slice(0, 8),
    startedAt: mission.startedAt || '',
    nextStepAt: mission.nextStepAt || '',
    completesAt: mission.completesAt || '',
  };
}

function getPlannedTileById(mission) {
  return new Map((mission.plannedTiles || []).map((tile) => [WorldMapService.getTileId(tile.q, tile.r), tile]));
}

function createTileIdSet(coords = []) {
  return new Set((Array.isArray(coords) ? coords : [])
    .map((coord) => WorldMapService.getTileId(coord.q, coord.r))
    .filter(Boolean));
}

function materializePlannedSitesForStep(gameState, mission, step, now = new Date(), options = {}) {
  const tileId = WorldMapService.getTileId(step.q, step.r);
  const revealTileIds = options.revealTileIds instanceof Set
    ? options.revealTileIds
    : new Set([tileId]);
  const materialized = [];
  mission.plannedSites = (mission.plannedSites || []).map((plannedSite) => {
    if (!plannedSite || plannedSite.materialized || !revealTileIds.has(plannedSite.tileId)) return plannedSite;
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
  WorldExplorerTrace.log('progression:materializePlannedSitesForStep', {
    missionId: mission.id || '',
    tileId,
    revealTileCount: revealTileIds.size,
    materializedCount: materialized.length,
    siteIds: materialized.map(({ site }) => site?.id).filter(Boolean),
  });
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
      generationContext: planned.generationContext,
    }
    : { visibility: 'scouted' };
  const tile = WorldMapService.revealTile(gameState, coord.q, coord.r, now, overrides);
  WorldExplorerTrace.log('progression:revealCoordinate', {
    missionId: mission.id || '',
    coord: {
      q: coord.q,
      r: coord.r,
      tileId: WorldMapService.getTileId(coord.q, coord.r),
    },
    hadPlannedTile: Boolean(planned),
    tile: tile ? {
      id: tile.id,
      q: tile.q,
      r: tile.r,
      terrain: tile.terrain,
      visibility: tile.visibility,
      discovered: tile.discovered !== false,
      visible: tile.visible !== false,
      siteId: tile.siteId || null,
    } : null,
  });
  return tile;
}

function revealStep(gameState, mission, step, now = new Date()) {
  const coords = EXPLORE_REVEAL_RADIUS > 0
    ? WorldMapService.getRevealArea(step.q, step.r, EXPLORE_REVEAL_RADIUS)
    : [{ q: step.q, r: step.r }];
  const plannedTiles = getPlannedTileById(mission);
  const revealedTiles = WorldMapService.revealTiles(gameState, coords, now, {
    overrides: (coord) => {
      const planned = plannedTiles.get(WorldMapService.getTileId(coord.q, coord.r));
      return planned
        ? {
          terrain: planned.terrain,
          riverPorts: planned.riverPorts,
          oceanTemplates: planned.oceanTemplates,
          transitionKey: planned.transitionKey,
          generatedAt: planned.generatedAt,
          visibility: 'scouted',
          generationContext: planned.generationContext,
        }
        : { visibility: 'scouted' };
    },
  });
  const materialized = materializePlannedSitesForStep(gameState, mission, step, now, {
    revealTileIds: createTileIdSet(coords),
  });
  WorldExplorerTrace.log('progression:revealStep', {
    missionId: mission.id || '',
    step: summarizeStep(step),
    revealRadius: EXPLORE_REVEAL_RADIUS,
    coordCount: coords.length,
    revealedTileIds: getTileIdentities(revealedTiles).slice(0, 12),
    materializedCount: materialized.length,
  });
  if (!materialized.length) return revealedTiles;
  const byId = new Map(revealedTiles.map((tile) => [getTileIdentity(tile), tile]).filter(([id]) => id));
  materialized.forEach(({ tile }) => {
    const tileId = getTileIdentity(tile);
    if (tileId) byId.set(tileId, tile);
  });
  return [...byId.values()];
}

function advanceExploreMissions(gameState, now = new Date()) {
  const TUTORIAL_STEPS = getTutorialSteps();
  gameState.exploreMissions = normalizeMissions(gameState.exploreMissions);
  const nowMs = now.getTime();
  const newlyRevealedTiles = [];
  for (const mission of gameState.exploreMissions) {
    if (mission.status !== 'active') continue;
    let nextStepAtMs = toTimestamp(mission.nextStepAt, nowMs);
    WorldExplorerTrace.log('progression:advanceMission:begin', {
      now: now.toISOString(),
      nowMs,
      nextStepAtMs,
      mission: summarizeMission(mission),
    });
    while (nextStepAtMs <= nowMs) {
      const step = mission.route.find((item) => !item.revealed);
      if (!step) break;
      const revealedTiles = revealStep(gameState, mission, step, now);
      step.revealed = true;
      step.revealedAt = now.toISOString();
      mission.position = {
        q: step.q,
        r: step.r,
        tileId: WorldMapService.getTileId(step.q, step.r),
      };
      newlyRevealedTiles.push(...revealedTiles);
      mission.revealedTileIds = Array.from(new Set([
        ...(mission.revealedTileIds || []),
        ...getTileIdentities(revealedTiles),
      ]));
      nextStepAtMs += mission.stepDurationMs;
    }
    mission.nextStepAt = new Date(nextStepAtMs).toISOString();
    if (mission.route.every((step) => step.revealed)) {
      mission.status = 'idle';
      mission.completedAt = mission.completedAt || now.toISOString();
      mission.nextStepAt = null;
      if (mission.status === 'idle' && gameState.tutorial?.currentStep === TUTORIAL_STEPS.scoutExploreStarted) {
        gameState.tutorial = advanceTutorialStep(gameState.tutorial, TUTORIAL_STEPS.firstCityDiscovered);
        ensureTutorialFirstCityClaimSoldiers(gameState);
      }
    }
    WorldExplorerTrace.log('progression:advanceMission:after', {
      mission: summarizeMission(mission),
      newlyRevealedCount: newlyRevealedTiles.length,
      newlyRevealedIds: getTileIdentities(newlyRevealedTiles).slice(0, 12),
    });
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
