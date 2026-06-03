const WorldMapService = require('./WorldMapService');

const EXPLORE_STEP_DURATION_MS = 10 * 1000;
const DEFAULT_RANDOM_ROUTE_LENGTH = 8;
const MAX_RANDOM_ROUTE_LENGTH = 16;
const MAX_MANUAL_ROUTE_LENGTH = 16;
const MAX_ACTIVE_EXPLORE_MISSIONS = 1;
const EXPLORE_REVEAL_RADIUS = 0;
const MAX_ROUTE_DISTANCE_FROM_ORIGIN = 32;

const NEIGHBOR_OFFSETS = Object.values(WorldMapService.DIRECTION_VECTORS);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function toTimestamp(value, fallback = 0) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : fallback;
}

function hashString(input) {
  let hash = 2166136261;
  const text = String(input);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function random01(seed, q, r, salt) {
  return hashString(`${seed || 'world-explorer'}|${q}|${r}|${salt}`) / 4294967295;
}

function getCoordinateKey(q, r) {
  return `${toInteger(q, 0)},${toInteger(r, 0)}`;
}

function getDistance(fromQ, fromR, toQ, toR) {
  return Math.max(Math.abs(toInteger(toQ, 0) - toInteger(fromQ, 0)), Math.abs(toInteger(toR, 0) - toInteger(fromR, 0)));
}

function normalizeRouteStep(rawStep, index = 0) {
  if (!rawStep || typeof rawStep !== 'object') return null;
  const q = toInteger(rawStep.q ?? rawStep.x, 0);
  const r = toInteger(rawStep.r ?? rawStep.y, 0);
  const step = Math.max(1, toInteger(rawStep.step, index + 1));
  return {
    q,
    r,
    step,
    tileId: rawStep.tileId || WorldMapService.getTileId(q, r),
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
    id: rawTile.id || WorldMapService.getTileId(q, r),
    q,
    r,
  };
}

function normalizeMission(rawMission) {
  if (!rawMission || typeof rawMission !== 'object') return null;
  const route = (Array.isArray(rawMission.route) ? rawMission.route : [])
    .map(normalizeRouteStep)
    .filter(Boolean)
    .sort((a, b) => a.step - b.step);
  if (!route.length) return null;
  const mode = rawMission.mode === 'manual' ? 'manual' : 'random';
  const status = ['active', 'ready', 'cancelled'].includes(rawMission.status)
    ? rawMission.status
    : 'active';
  const origin = rawMission.origin && typeof rawMission.origin === 'object'
    ? rawMission.origin
    : {};
  const originQ = toInteger(origin.q ?? rawMission.originQ ?? rawMission.originX, 0);
  const originR = toInteger(origin.r ?? rawMission.originR ?? rawMission.originY, 0);
  const stepDurationMs = Math.max(1000, toInteger(rawMission.stepDurationMs, EXPLORE_STEP_DURATION_MS));
  const revealedTileIds = Array.from(new Set([
    ...(Array.isArray(rawMission.revealedTileIds) ? rawMission.revealedTileIds : []),
    ...route.filter((step) => step.revealed).map((step) => step.tileId),
  ].filter(Boolean).map(String)));
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
    },
    target: rawMission.target && typeof rawMission.target === 'object'
      ? {
        q: toInteger(rawMission.target.q ?? rawMission.target.x, route.at(-1)?.q || originQ),
        r: toInteger(rawMission.target.r ?? rawMission.target.y, route.at(-1)?.r || originR),
      }
      : { q: route.at(-1)?.q || originQ, r: route.at(-1)?.r || originR },
    route,
    plannedTiles: (Array.isArray(rawMission.plannedTiles) ? rawMission.plannedTiles : [])
      .map(normalizePlannedTile)
      .filter(Boolean),
    revealedTileIds,
    stepDurationMs,
    startedAt: rawMission.startedAt || new Date().toISOString(),
    nextStepAt: rawMission.nextStepAt || rawMission.startedAt || new Date().toISOString(),
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

function getExploreOrigin(gameState) {
  const activeCityId = gameState?.activeCityId || 'capital';
  const city = gameState?.cities?.[activeCityId] || null;
  const territoryId = city?.territoryId || activeCityId;
  const territory = (gameState?.territories || []).find((item) => (
    item?.id === territoryId || item?.id === activeCityId
  )) || (gameState?.territories || []).find((item) => item?.id === 'capital') || {};
  return {
    q: toInteger(territory.x ?? territory.q, 0),
    r: toInteger(territory.y ?? territory.r, 0),
    cityId: city?.id || activeCityId,
    territoryId: territory.id || 'capital',
    name: city?.name || territory.cityName || territory.naturalName || 'capital',
  };
}

function getKnownTileIds(gameState) {
  const worldMap = WorldMapService.ensureWorldMap(gameState);
  return new Set((worldMap.tiles || [])
    .filter((tile) => tile && tile.discovered !== false)
    .map((tile) => tile.id || WorldMapService.getTileId(tile.q, tile.r)));
}

function countUnknownNeighbors(seed, knownTileIds, visitedKeys, q, r) {
  return NEIGHBOR_OFFSETS.reduce((sum, offset) => {
    const nextQ = q + offset.q;
    const nextR = r + offset.r;
    const key = getCoordinateKey(nextQ, nextR);
    if (visitedKeys.has(key)) return sum;
    if (WorldMapService.chooseTerrain(seed, nextQ, nextR) === 'ocean') return sum;
    const tileId = WorldMapService.getTileId(nextQ, nextR);
    return sum + (knownTileIds.has(tileId) ? 0 : 1);
  }, 0);
}

function getRandomRouteCandidates(seed, knownTileIds, visitedKeys, current, origin, routeSeed, step) {
  const candidates = [];
  for (const offset of NEIGHBOR_OFFSETS) {
    const q = current.q + offset.q;
    const r = current.r + offset.r;
    const key = getCoordinateKey(q, r);
    if (visitedKeys.has(key)) continue;
    if (getDistance(origin.q, origin.r, q, r) > MAX_ROUTE_DISTANCE_FROM_ORIGIN) continue;
    if (WorldMapService.chooseTerrain(seed, q, r) === 'ocean') continue;
    const tileId = WorldMapService.getTileId(q, r);
    const known = knownTileIds.has(tileId);
    const frontier = countUnknownNeighbors(seed, knownTileIds, visitedKeys, q, r);
    candidates.push({
      q,
      r,
      tileId,
      known,
      frontier,
      roll: random01(routeSeed, q, r, `step-${step}`),
    });
  }
  return candidates.sort((a, b) => (
    Number(a.known) - Number(b.known)
    || b.frontier - a.frontier
    || b.roll - a.roll
    || a.q - b.q
    || a.r - b.r
  ));
}

function buildRandomRoute(gameState, origin, routeLength = DEFAULT_RANDOM_ROUTE_LENGTH, now = new Date()) {
  const worldMap = WorldMapService.ensureWorldMap(gameState, now);
  const length = Math.max(1, Math.min(MAX_RANDOM_ROUTE_LENGTH, toInteger(routeLength, DEFAULT_RANDOM_ROUTE_LENGTH)));
  const knownTileIds = getKnownTileIds(gameState);
  const visitedKeys = new Set([getCoordinateKey(origin.q, origin.r)]);
  const routeSeed = `${worldMap.seed}|${origin.q}|${origin.r}|${now.getTime()}`;
  const route = [];
  let current = { q: origin.q, r: origin.r };
  for (let step = 1; step <= length; step += 1) {
    const candidates = getRandomRouteCandidates(worldMap.seed, knownTileIds, visitedKeys, current, origin, routeSeed, step);
    const chosen = candidates[0];
    if (!chosen) break;
    route.push({
      q: chosen.q,
      r: chosen.r,
      step,
      tileId: chosen.tileId,
      revealed: false,
      revealedAt: null,
    });
    visitedKeys.add(getCoordinateKey(chosen.q, chosen.r));
    knownTileIds.add(chosen.tileId);
    current = { q: chosen.q, r: chosen.r };
  }
  return route;
}

function buildManualRoute(origin, target, seed = WorldMapService.DEFAULT_WORLD_SEED) {
  const targetQ = toInteger(target?.q ?? target?.x, origin.q);
  const targetR = toInteger(target?.r ?? target?.y, origin.r);
  const distance = getDistance(origin.q, origin.r, targetQ, targetR);
  if (distance <= 0) {
    return { success: false, error: 'EXPLORE_TARGET_IS_ORIGIN', message: 'Explore target is already the origin.' };
  }
  if (distance > MAX_MANUAL_ROUTE_LENGTH) {
    return { success: false, error: 'EXPLORE_TARGET_TOO_FAR', message: 'Explore target is too far.' };
  }
  const route = [];
  let q = origin.q;
  let r = origin.r;
  for (let step = 1; step <= distance; step += 1) {
    q += Math.sign(targetQ - q);
    r += Math.sign(targetR - r);
    if (WorldMapService.chooseTerrain(seed, q, r) === 'ocean') {
      return { success: false, error: 'EXPLORE_ROUTE_BLOCKED', message: 'Explorer route is blocked by ocean.' };
    }
    route.push({
      q,
      r,
      step,
      tileId: WorldMapService.getTileId(q, r),
      revealed: false,
      revealedAt: null,
    });
  }
  return { success: true, route, target: { q: targetQ, r: targetR } };
}

function createPlannedTiles(gameState, route, now = new Date()) {
  const worldMap = WorldMapService.ensureWorldMap(gameState, now);
  return route.map((step) => WorldMapService.createTile(worldMap.seed, step.q, step.r, now, {
    visibility: 'scouted',
  }));
}

function getPlannedTileById(mission) {
  return new Map((mission.plannedTiles || []).map((tile) => [tile.id || WorldMapService.getTileId(tile.q, tile.r), tile]));
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
  return coords.map((coord) => revealCoordinate(gameState, mission, coord, now));
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
      newlyRevealedTiles.push(...revealedTiles);
      mission.revealedTileIds = Array.from(new Set([
        ...(mission.revealedTileIds || []),
        ...revealedTiles.map((tile) => tile.id),
      ]));
      nextStepAtMs += mission.stepDurationMs;
    }
    mission.nextStepAt = new Date(nextStepAtMs).toISOString();
    if (mission.route.every((step) => step.revealed)) {
      mission.status = 'ready';
      mission.completedAt = mission.completedAt || now.toISOString();
      mission.nextStepAt = null;
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

function countActiveMissions(gameState) {
  return (gameState.exploreMissions || []).filter((mission) => mission.status === 'active').length;
}

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
    position: lastRevealed
      ? { q: lastRevealed.q, r: lastRevealed.r, tileId: lastRevealed.tileId }
      : { q: mission.origin?.q || 0, r: mission.origin?.r || 0, tileId: WorldMapService.getTileId(mission.origin?.q || 0, mission.origin?.r || 0) },
    revealedTileIds: [...(mission.revealedTileIds || [])],
    stepDurationSeconds: Math.floor((mission.stepDurationMs || EXPLORE_STEP_DURATION_MS) / 1000),
    remainingSeconds: mission.status === 'active' && nextStepAtMs
      ? Math.max(0, Math.ceil((nextStepAtMs - now.getTime()) / 1000))
      : 0,
    startedAt: mission.startedAt,
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

function startExplore(gameState, options = {}, now = new Date()) {
  normalizeExploreState(gameState, now);
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
  const mission = normalizeMission({
    id: `explore_${mode}_${now.getTime()}`,
    mode,
    status: 'active',
    origin,
    target: routeResult.target || { q: route.at(-1).q, r: route.at(-1).r },
    route,
    plannedTiles: createPlannedTiles(gameState, route, now),
    revealedTileIds: [],
    stepDurationMs: EXPLORE_STEP_DURATION_MS,
    startedAt: now.toISOString(),
    nextStepAt: new Date(now.getTime() + EXPLORE_STEP_DURATION_MS).toISOString(),
    completesAt: new Date(now.getTime() + EXPLORE_STEP_DURATION_MS * route.length).toISOString(),
  });
  gameState.exploreMissions = [...(gameState.exploreMissions || []), mission];
  return {
    success: true,
    message: 'Explorer mission started.',
    mission: getClientMission(mission, now),
  };
}

function claimExplore(gameState, missionId, now = new Date()) {
  normalizeExploreState(gameState, now);
  const mission = (gameState.exploreMissions || []).find((item) => item.id === missionId);
  if (!mission) return { success: false, error: 'EXPLORE_MISSION_NOT_FOUND', message: 'Explorer mission not found.' };
  if (mission.status !== 'ready') return { success: false, error: 'EXPLORE_MISSION_NOT_READY', message: 'Explorer mission is not ready.' };
  gameState.exploreMissions = (gameState.exploreMissions || []).filter((item) => item.id !== mission.id);
  return {
    success: true,
    message: 'Explorer mission complete.',
    mission: getClientMission({ ...mission, claimedAt: now.toISOString() }, now),
  };
}

module.exports = {
  EXPLORE_STEP_DURATION_MS,
  DEFAULT_RANDOM_ROUTE_LENGTH,
  MAX_RANDOM_ROUTE_LENGTH,
  MAX_MANUAL_ROUTE_LENGTH,
  MAX_ACTIVE_EXPLORE_MISSIONS,
  EXPLORE_REVEAL_RADIUS,
  normalizeExploreState,
  advanceExploreMissions,
  startExplore,
  claimExplore,
  getClientState,
  buildRandomRoute,
  buildManualRoute,
};
