const WorldMapService = require('../WorldMapService');
const {
  EXPLORE_STEP_DURATION_MS,
  toInteger,
} = require('./WorldExplorerShared');

function normalizeRouteStep(rawStep, index = 0) {
  if (!rawStep || typeof rawStep !== 'object') return null;
  const q = toInteger(rawStep.q ?? rawStep.x, 0);
  const r = toInteger(rawStep.r ?? rawStep.y, 0);
  const step = Math.max(1, toInteger(rawStep.step, index + 1));
  return {
    q,
    r,
    step,
    tileId: WorldMapService.getTileId(q, r),
    revealed: Boolean(rawStep.revealed),
    revealedAt: rawStep.revealedAt || null,
  };
}

function normalizePlannedTile(rawTile) {
  if (!rawTile || typeof rawTile !== 'object') return null;
  const q = toInteger(rawTile.q, 0);
  const r = toInteger(rawTile.r, 0);
  return {
    ...rawTile,
    id: WorldMapService.getTileId(q, r),
    q,
    r,
  };
}

function normalizePlannedSite(rawSite) {
  if (!rawSite || typeof rawSite !== 'object') return null;
  const q = toInteger(rawSite.q ?? rawSite.x, 0);
  const r = toInteger(rawSite.r ?? rawSite.y, 0);
  const site = rawSite.site && typeof rawSite.site === 'object' ? rawSite.site : {};
  const siteId = String(rawSite.siteId || site.id || `site_${q}_${r}`).trim();
  if (!siteId) return null;
  const tileId = WorldMapService.getTileId(q, r);
  return {
    tileId,
    q,
    r,
    siteId,
    materialized: Boolean(rawSite.materialized),
    revealedAt: rawSite.revealedAt || null,
    site: {
      ...site,
      id: siteId,
      x: toInteger(site.x ?? q, q),
      y: toInteger(site.y ?? r, r),
    },
  };
}

function normalizeMission(rawMission) {
  if (!rawMission || typeof rawMission !== 'object') return null;
  const route = (Array.isArray(rawMission.route) ? rawMission.route : [])
    .map(normalizeRouteStep)
    .filter(Boolean)
    .sort((a, b) => a.step - b.step);
  const mode = rawMission.mode === 'manual' ? 'manual' : 'random';
  const status = ['active', 'idle', 'cancelled'].includes(rawMission.status)
    ? rawMission.status
    : null;
  if (!status) return null;
  if (!route.length && status !== 'idle') return null;
  const origin = rawMission.origin && typeof rawMission.origin === 'object'
    ? rawMission.origin
    : {};
  const originQ = toInteger(origin.q ?? rawMission.originQ ?? rawMission.originX, 0);
  const originR = toInteger(origin.r ?? rawMission.originR ?? rawMission.originY, 0);
  const homeOrigin = rawMission.homeOrigin && typeof rawMission.homeOrigin === 'object'
    ? rawMission.homeOrigin
    : origin;
  const homeOriginQ = toInteger(homeOrigin.q ?? originQ, originQ);
  const homeOriginR = toInteger(homeOrigin.r ?? originR, originR);
  const stepDurationMs = Math.max(1000, toInteger(rawMission.stepDurationMs, EXPLORE_STEP_DURATION_MS));
  const revealedTileIds = Array.from(new Set([
    ...(Array.isArray(rawMission.revealedTileIds) ? rawMission.revealedTileIds : []),
    ...route.filter((step) => step.revealed).map((step) => step.tileId),
  ].filter(Boolean).map(String)));
  const rawPosition = rawMission.position && typeof rawMission.position === 'object'
    ? rawMission.position
    : null;
  const positionQ = toInteger(rawPosition?.q ?? rawPosition?.x ?? route.filter((step) => step.revealed).at(-1)?.q ?? originQ, originQ);
  const positionR = toInteger(rawPosition?.r ?? rawPosition?.y ?? route.filter((step) => step.revealed).at(-1)?.r ?? originR, originR);
  return {
    id: typeof rawMission.id === 'string' && rawMission.id ? rawMission.id : `explore_${mode}_${Date.now()}`,
    kind: 'worldExplore',
    mode,
    status,
    origin: {
      q: originQ,
      r: originR,
      cityId: origin.cityId || rawMission.sourceCityId || 'capital',
      territoryId: origin.territoryId || rawMission.originTerritoryId || 'capital',
      name: origin.name || rawMission.originName || '',
      tileId: WorldMapService.getTileId(originQ, originR),
    },
    homeOrigin: {
      q: homeOriginQ,
      r: homeOriginR,
      cityId: homeOrigin.cityId || origin.cityId || rawMission.sourceCityId || 'capital',
      territoryId: homeOrigin.territoryId || origin.territoryId || rawMission.originTerritoryId || 'capital',
      name: homeOrigin.name || origin.name || rawMission.originName || '',
      tileId: WorldMapService.getTileId(homeOriginQ, homeOriginR),
    },
    target: rawMission.target && typeof rawMission.target === 'object'
      ? {
        q: toInteger(rawMission.target.q ?? rawMission.target.x, route.at(-1)?.q || originQ),
        r: toInteger(rawMission.target.r ?? rawMission.target.y, route.at(-1)?.r || originR),
        tileId: WorldMapService.getTileId(
          toInteger(rawMission.target.q ?? rawMission.target.x, route.at(-1)?.q || originQ),
          toInteger(rawMission.target.r ?? rawMission.target.y, route.at(-1)?.r || originR),
        ),
      }
      : {
        q: route.at(-1)?.q ?? positionQ,
        r: route.at(-1)?.r ?? positionR,
        tileId: WorldMapService.getTileId(route.at(-1)?.q ?? positionQ, route.at(-1)?.r ?? positionR),
      },
    position: {
      q: positionQ,
      r: positionR,
      tileId: WorldMapService.getTileId(positionQ, positionR),
    },
    route,
    plannedTiles: (Array.isArray(rawMission.plannedTiles) ? rawMission.plannedTiles : [])
      .map(normalizePlannedTile)
      .filter(Boolean),
    plannedSites: (Array.isArray(rawMission.plannedSites) ? rawMission.plannedSites : [])
      .map(normalizePlannedSite)
      .filter(Boolean),
    revealedTileIds,
    stepDurationMs,
    formation: rawMission.formation && typeof rawMission.formation === 'object'
      ? {
        cityId: rawMission.formation.cityId || rawMission.sourceCityId || origin.cityId || 'capital',
        slot: Math.max(1, toInteger(rawMission.formation.slot ?? rawMission.formationSlot, 1)),
        memberIds: Array.isArray(rawMission.formation.memberIds)
          ? rawMission.formation.memberIds.map(String)
          : [],
      }
      : {
        cityId: rawMission.sourceCityId || origin.cityId || 'capital',
        slot: Math.max(1, toInteger(rawMission.formationSlot, 1)),
        memberIds: [],
      },
    startedAt: rawMission.startedAt || new Date().toISOString(),
    nextStepAt: status === 'idle' ? null : rawMission.nextStepAt || rawMission.startedAt || new Date().toISOString(),
    completesAt: rawMission.completesAt || rawMission.startedAt || new Date().toISOString(),
    completedAt: rawMission.completedAt || null,
    claimedAt: rawMission.claimedAt || null,
  };
}

function normalizeMissions(rawMissions) {
  return (Array.isArray(rawMissions) ? rawMissions : [])
    .map(normalizeMission)
    .filter(Boolean);
}

module.exports = {
  normalizeRouteStep,
  normalizePlannedTile,
  normalizePlannedSite,
  normalizeMission,
  normalizeMissions,
};
