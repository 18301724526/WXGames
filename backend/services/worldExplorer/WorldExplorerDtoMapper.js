const WorldMapService = require('../WorldMapService');
const {
  EXPLORE_STEP_DURATION_MS,
  MAX_MANUAL_ROUTE_LENGTH,
  MAX_ACTIVE_EXPLORE_MISSIONS,
  clone,
  toTimestamp,
  toInteger,
} = require('./WorldExplorerShared');
const FormationStrengthService = require('../military/FormationStrengthService');

function normalizeCoord(source = {}, fallback = {}) {
  const q = toInteger(source?.q ?? source?.x, fallback.q ?? 0);
  const r = toInteger(source?.r ?? source?.y, fallback.r ?? 0);
  const hasCoordinate = source?.q !== undefined
    || source?.x !== undefined
    || source?.r !== undefined
    || source?.y !== undefined
    || fallback.q !== undefined
    || fallback.x !== undefined
    || fallback.r !== undefined
    || fallback.y !== undefined;
  return {
    q,
    r,
    tileId: hasCoordinate
      ? WorldMapService.getTileId(q, r)
      : (source?.tileId || WorldMapService.getTileId(q, r)),
  };
}

function getCoordDto(source = {}, fallback = {}) {
  const coord = normalizeCoord(source, fallback);
  return {
    ...(clone(source || {}) || {}),
    q: coord.q,
    r: coord.r,
    tileId: coord.tileId,
  };
}

function getRouteDto(route = []) {
  return (Array.isArray(route) ? route : []).map((step, index) => {
    const coord = normalizeCoord(step);
    return {
      q: coord.q,
      r: coord.r,
      step: Math.max(1, toInteger(step?.step, index + 1)),
      tileId: coord.tileId,
      revealed: Boolean(step?.revealed),
      routeRevealedExplicit: Boolean(step?.routeRevealedExplicit)
        || Object.prototype.hasOwnProperty.call(step || {}, 'revealed'),
      revealedAt: step?.revealedAt || null,
    };
  });
}

function getPublicRouteStepDto(step = {}) {
  return {
    q: step.q,
    r: step.r,
    step: step.step,
    tileId: step.tileId,
    revealed: Boolean(step.revealed),
    revealedAt: step.revealedAt || null,
  };
}

function hasCoordPair(source = {}) {
  if (!source || typeof source !== 'object') return false;
  const hasQ = source.q !== undefined || source.x !== undefined;
  const hasR = source.r !== undefined || source.y !== undefined;
  return hasQ && hasR;
}

function addTileAlias(aliases, value, canonicalId) {
  if (!value || !canonicalId) return;
  const alias = String(value);
  const ids = aliases.get(alias) || new Set();
  ids.add(String(canonicalId));
  aliases.set(alias, ids);
}

function createRouteTileAliasMap(route = []) {
  const aliases = new Map();
  (Array.isArray(route) ? route : []).forEach((step) => {
    if (!hasCoordPair(step)) return;
    const coord = normalizeCoord(step);
    addTileAlias(aliases, coord.tileId, coord.tileId);
    addTileAlias(aliases, step.tileId, coord.tileId);
    addTileAlias(aliases, step.id, coord.tileId);
  });
  return aliases;
}

function createRevealedTileSet(mission = {}) {
  const routeAliases = createRouteTileAliasMap(mission.route);
  const revealed = new Set();
  (Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds : [])
    .filter(Boolean)
    .forEach((id) => {
      const aliases = routeAliases.get(String(id));
      if (aliases) {
        aliases.forEach((canonicalId) => revealed.add(canonicalId));
        return;
      }
      revealed.add(String(id));
    });
  return revealed;
}

function getPlannedTileDto(tile = {}) {
  const coord = normalizeCoord(tile);
  const dto = {
    ...(clone(tile || {}) || {}),
    id: coord.tileId,
    q: coord.q,
    r: coord.r,
  };
  if (Object.prototype.hasOwnProperty.call(dto, 'tileId')) dto.tileId = coord.tileId;
  return dto;
}

function getPlannedSiteDto(site = {}) {
  const coord = normalizeCoord(site);
  return {
    tileId: coord.tileId,
    q: coord.q,
    r: coord.r,
    siteId: site.siteId,
    materialized: Boolean(site.materialized),
    revealedAt: site.revealedAt || null,
    site: clone(site.site || null),
  };
}

function getPositionSource(mission = {}, route = []) {
  if (mission.position && typeof mission.position === 'object') return mission.position;
  const lastRevealed = [...route].reverse().find((step) => step.revealed);
  return lastRevealed || mission.origin || {};
}

function getRemainingSeconds(mission = {}, now = new Date()) {
  if (mission.status !== 'active') return 0;
  const nextStepAtMs = toTimestamp(mission.nextStepAt, 0);
  if (!nextStepAtMs) return 0;
  return Math.max(0, Math.ceil((nextStepAtMs - now.getTime()) / 1000));
}

function getMissionDto(mission = {}, now = new Date()) {
  const revealedTileSet = createRevealedTileSet(mission);
  const route = getRouteDto(mission.route || [])
    .map((step) => (
      !step.routeRevealedExplicit && revealedTileSet.has(step.tileId)
        ? { ...step, revealed: true }
        : step
    ));
  const position = normalizeCoord(getPositionSource(mission, route));
  const stepDurationMs = Math.max(1000, toInteger(mission.stepDurationMs, EXPLORE_STEP_DURATION_MS));
  const revealedTileIds = Array.from(new Set([
    ...revealedTileSet,
    ...route.filter((step) => step.revealed).map((step) => step.tileId),
  ].filter(Boolean).map(String)));
  return {
    id: mission.id,
    kind: mission.kind || 'worldExplore',
    mode: mission.mode,
    status: mission.status,
    origin: getCoordDto(mission.origin || {}),
    homeOrigin: getCoordDto(mission.homeOrigin || mission.origin || {}, mission.origin || {}),
    target: getCoordDto(mission.target || {}, position),
    route: route.map(getPublicRouteStepDto),
    plannedTiles: (Array.isArray(mission.plannedTiles) ? mission.plannedTiles : []).map(getPlannedTileDto),
    plannedSites: (Array.isArray(mission.plannedSites) ? mission.plannedSites : []).map(getPlannedSiteDto),
    formation: clone(mission.formation || {}),
    formationSnapshot: clone(FormationStrengthService.normalizeFormationSnapshot(mission.formationSnapshot)),
    position,
    revealedTileIds,
    stepDurationSeconds: Math.floor(stepDurationMs / 1000),
    remainingSeconds: getRemainingSeconds(mission, now),
    startedAt: mission.startedAt,
    nextStepAt: mission.nextStepAt || null,
    completesAt: mission.completesAt || null,
    completedAt: mission.completedAt || null,
  };
}

function getBusyFormationDto(mission = {}) {
  return {
    cityId: mission.formation?.cityId || mission.origin?.cityId || 'capital',
    slot: Math.max(1, Math.floor(Number(mission.formation?.slot) || 1)),
    missionId: mission.id,
    status: mission.status,
  };
}

function getClientStateDto(missions = [], options = {}) {
  const now = options.now || new Date();
  const missionDtos = (Array.isArray(missions) ? missions : [])
    .map((mission) => getMissionDto(mission, now))
    .filter((mission) => mission.status !== 'ready');
  const busyFormations = missionDtos
    .filter((mission) => mission.status === 'active')
    .map(getBusyFormationDto);
  return {
    missions: missionDtos,
    activeMission: missionDtos.find((mission) => mission.status === 'active') || null,
    idleMissions: missionDtos.filter((mission) => mission.status === 'idle'),
    busyFormations,
    marchVerification: options.marchVerification || null,
    maxActiveMissions: MAX_ACTIVE_EXPLORE_MISSIONS,
    maxManualRouteLength: MAX_MANUAL_ROUTE_LENGTH,
    stepDurationSeconds: Math.floor(EXPLORE_STEP_DURATION_MS / 1000),
  };
}

module.exports = {
  createRevealedTileSet,
  createRouteTileAliasMap,
  getBusyFormationDto,
  getClientStateDto,
  getCoordDto,
  getMissionDto,
  getPlannedSiteDto,
  getPlannedTileDto,
  getPositionSource,
  getRemainingSeconds,
  getRouteDto,
  normalizeCoord,
};
