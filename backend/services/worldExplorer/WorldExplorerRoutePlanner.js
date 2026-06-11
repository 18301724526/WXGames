const WorldMapService = require('../WorldMapService');
const TerritoryService = require('../TerritoryService');
const { TutorialFlowConfig } = require('../config/GameplayConfigRuntime');
const {
  DEFAULT_RANDOM_ROUTE_LENGTH,
  MAX_RANDOM_ROUTE_LENGTH,
  MAX_MANUAL_ROUTE_LENGTH,
  MAX_ROUTE_DISTANCE_FROM_ORIGIN,
  TUTORIAL_FIRST_SITE_GRANT_KEY,
  NEIGHBOR_OFFSETS,
  toInteger,
  hashString,
  random01,
  getCoordinateKey,
  getDistance,
} = require('./WorldExplorerShared');

const TUTORIAL_EMPTY_CITY_NAMES = [
  '\u6e05\u6cc9\u57ce',
  '\u77f3\u6e21\u9547',
  '\u9752\u6797\u57ce',
  '\u6cb3\u6e7e\u57ce',
];

function getTutorialSteps() {
  return TutorialFlowConfig.TUTORIAL_STEPS;
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
    .filter((tile) => tile && tile.discovered !== false && tile.visible !== false && tile.visibility !== 'hidden')
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
  const delta = WorldMapService.getWrappedDelta(origin, { q: targetQ, r: targetR });
  const distance = Math.max(Math.abs(delta.q), Math.abs(delta.r));
  if (distance <= 0) {
    return { success: false, error: 'EXPLORE_TARGET_IS_ORIGIN', message: 'Explore target is already the origin.' };
  }
  if (distance > MAX_MANUAL_ROUTE_LENGTH) {
    return { success: false, error: 'EXPLORE_TARGET_TOO_FAR', message: 'Explore target is too far.' };
  }
  const route = [];
  let q = origin.q;
  let r = origin.r;
  let remainingQ = delta.q;
  let remainingR = delta.r;
  for (let step = 1; step <= distance; step += 1) {
    const stepQ = Math.sign(remainingQ);
    const stepR = Math.sign(remainingR);
    q += stepQ;
    r += stepR;
    remainingQ -= stepQ;
    remainingR -= stepR;
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
  const routeTarget = route.at(-1) || { q: origin.q, r: origin.r };
  return { success: true, route, target: { q: routeTarget.q, r: routeTarget.r } };
}

function getStepDirection(from = {}, to = {}) {
  const delta = WorldMapService.getWrappedDelta(from, to);
  const vector = {
    q: Math.sign(toInteger(delta.q, 0)),
    r: Math.sign(toInteger(delta.r, 0)),
  };
  return Object.entries(WorldMapService.DIRECTION_VECTORS)
    .find(([, candidate]) => candidate.q === vector.q && candidate.r === vector.r)?.[0] || '';
}

function getEventEpoch(gameState = {}) {
  if (gameState.worldEventEpoch || gameState.eventEpoch) return String(gameState.worldEventEpoch || gameState.eventEpoch);
  return hashString(JSON.stringify({
    gameDay: gameState.gameDay || 0,
    regularEventState: gameState.regularEventState || null,
    threatEventState: gameState.threatEventState || null,
    activeBuffs: gameState.activeBuffs || [],
  })).toString(16);
}

function getNearbyGenerationState(gameState = {}, center = {}, radius = 8) {
  const centerQ = toInteger(center.q ?? center.x, 0);
  const centerR = toInteger(center.r ?? center.y, 0);
  const isNearby = (coord = {}) => (
    getDistance(centerQ, centerR, coord.x ?? coord.q, coord.y ?? coord.r) <= radius
  );
  return {
    currentEra: gameState.currentEra || 0,
    gameDay: gameState.gameDay || 0,
    territories: (gameState.territories || [])
      .filter(isNearby)
      .map((territory) => ({
        id: territory.id || '',
        x: territory.x ?? territory.q ?? 0,
        y: territory.y ?? territory.r ?? 0,
        owner: territory.owner || '',
        ownerPlayerId: territory.ownerPlayerId || '',
        status: territory.status || '',
        type: territory.type || '',
      }))
      .sort((a, b) => a.x - b.x || a.y - b.y || a.id.localeCompare(b.id)),
    worldAi: (gameState.worldAi?.explorers || [])
      .filter((explorer) => isNearby(explorer.position || {}))
      .map((explorer) => ({
        id: explorer.id || '',
        factionId: explorer.factionId || '',
        q: explorer.position?.q ?? explorer.position?.x ?? 0,
        r: explorer.position?.r ?? explorer.position?.y ?? 0,
      }))
      .sort((a, b) => a.q - b.q || a.r - b.r || a.id.localeCompare(b.id)),
  };
}

function createGenerationContext(gameState = {}, step = {}, options = {}) {
  const origin = options.origin || getExploreOrigin(gameState);
  const target = options.target || step;
  const previous = options.previous || origin;
  const center = { q: toInteger(step.q, 0), r: toInteger(step.r, 0) };
  return {
    source: 'player-world-explore',
    playerId: gameState.playerId || '',
    mode: options.mode || 'unknown',
    direction: options.direction || getStepDirection(previous, step),
    origin: {
      q: toInteger(origin.q ?? origin.x, 0),
      r: toInteger(origin.r ?? origin.y, 0),
      cityId: origin.cityId || 'capital',
      territoryId: origin.territoryId || 'capital',
    },
    target: {
      q: toInteger(target.q ?? target.x, toInteger(step.q, 0)),
      r: toInteger(target.r ?? target.y, toInteger(step.r, 0)),
    },
    step: toInteger(step.step, 0),
    eventEpoch: getEventEpoch(gameState),
    nearbyStateHash: hashString(JSON.stringify(getNearbyGenerationState(gameState, center))).toString(16),
  };
}

function createPlannedTiles(gameState, route, now = new Date(), options = {}) {
  const worldMap = WorldMapService.ensureWorldMap(gameState, now);
  let previous = options.origin || getExploreOrigin(gameState);
  return route.map((step) => {
    const tile = WorldMapService.createTile(worldMap.seed, step.q, step.r, now, {
      visibility: 'scouted',
      generationContext: createGenerationContext(gameState, step, {
        ...options,
        previous,
      }),
    });
    previous = step;
    return tile;
  });
}

function shouldGuaranteeTutorialEmptyCity(gameState = {}) {
  const TUTORIAL_STEPS = getTutorialSteps();
  const tutorial = gameState.tutorial || {};
  if (tutorial.completed || tutorial.disabled) return false;
  const step = Math.floor(Number(tutorial.currentStep) || 0);
  if (step < TUTORIAL_STEPS.scoutFormationSaved || step >= TUTORIAL_STEPS.scoutExploreClaimed) return false;
  return !tutorial.grants?.[TUTORIAL_FIRST_SITE_GRANT_KEY];
}

function pickTutorialCityName(gameState = {}, q = 0, r = 0) {
  const seed = hashString(`${gameState.playerId || 'tutorial'}|${q}|${r}|first-empty-city`);
  return TUTORIAL_EMPTY_CITY_NAMES[seed % TUTORIAL_EMPTY_CITY_NAMES.length];
}

function getPlanningTerrainForMapTerrain(mapTerrain = 'plains') {
  if (mapTerrain === 'forest') return 'forest';
  if (['hills', 'mountain', 'waste', 'desert'].includes(mapTerrain)) return 'hills';
  if (mapTerrain === 'river') return 'river';
  if (mapTerrain === 'ocean') return 'coast';
  return 'plains';
}

function createTutorialEmptyCitySite(gameState = {}, step = {}, plannedTile = {}, now = new Date()) {
  const q = toInteger(step.q, 0);
  const r = toInteger(step.r, 0);
  const siteId = `site_${q}_${r}`;
  const mapTerrain = plannedTile.terrain && !['ocean', 'river'].includes(plannedTile.terrain)
    ? plannedTile.terrain
    : 'plains';
  return {
    id: siteId,
    x: q,
    y: r,
    naturalName: pickTutorialCityName(gameState, q, r),
    cityName: null,
    type: 'town',
    terrain: getPlanningTerrainForMapTerrain(mapTerrain),
    mapTerrain,
    owner: 'neutral',
    status: 'discovered',
    scale: 2,
    threat: 0,
    defense: TerritoryService.MIN_EXPEDITION_SOLDIERS,
    recommendedSoldiers: TerritoryService.MIN_EXPEDITION_SOLDIERS,
    art: TerritoryService.SITE_ART.town,
    visualOffset: { x: 0, y: 0 },
    discoveredAt: now.toISOString(),
    occupiedAt: null,
    effects: { foodOutputMultiplier: 0.05 },
    summary: '\u4e00\u5ea7\u672a\u8bbe\u9632\u7684\u7a7a\u57ce\uff0c\u9002\u5408\u4f5c\u4e3a\u7b2c\u4e00\u5904\u5916\u90e8\u636e\u70b9\u3002',
    lastBattle: null,
    garrison: null,
    defenderLeader: null,
    battleTarget: null,
  };
}

function createTutorialPlannedSites(gameState, route = [], plannedTiles = [], now = new Date()) {
  if (!shouldGuaranteeTutorialEmptyCity(gameState)) return [];
  const worldMap = WorldMapService.ensureWorldMap(gameState, now);
  const plannedById = new Map(plannedTiles.map((tile) => [tile.id || WorldMapService.getTileId(tile.q, tile.r), tile]));
  const existingCoords = new Set((gameState.territories || []).map((site) => getCoordinateKey(site.x, site.y)));
  const chosen = [...route].reverse().find((step) => {
    if (existingCoords.has(getCoordinateKey(step.q, step.r))) return false;
    const planned = plannedById.get(step.tileId) || {};
    const terrain = planned.terrain || WorldMapService.chooseTerrain(worldMap.seed, step.q, step.r);
    return !['ocean', 'river'].includes(terrain);
  }) || route.at(-1);
  if (!chosen) return [];
  const tileId = chosen.tileId || WorldMapService.getTileId(chosen.q, chosen.r);
  let plannedTile = plannedById.get(tileId);
  if (!plannedTile) {
    plannedTile = WorldMapService.createTile(worldMap.seed, chosen.q, chosen.r, now, {
      terrain: 'plains',
      visibility: 'scouted',
    });
  }
  if (['ocean', 'river'].includes(plannedTile.terrain)) {
    plannedTile.terrain = 'plains';
    plannedTile.riverPorts = [];
    plannedTile.oceanTemplates = [];
    plannedTile.transitionKey = '';
  }
  const site = createTutorialEmptyCitySite(gameState, chosen, plannedTile, now);
  return [{
    tileId,
    q: chosen.q,
    r: chosen.r,
    siteId: site.id,
    materialized: false,
    revealedAt: null,
    site,
  }];
}

module.exports = {
  getExploreOrigin,
  getKnownTileIds,
  countUnknownNeighbors,
  getRandomRouteCandidates,
  buildRandomRoute,
  buildManualRoute,
  getEventEpoch,
  getNearbyGenerationState,
  getStepDirection,
  createGenerationContext,
  createPlannedTiles,
  shouldGuaranteeTutorialEmptyCity,
  pickTutorialCityName,
  getPlanningTerrainForMapTerrain,
  createTutorialEmptyCitySite,
  createTutorialPlannedSites,
};
