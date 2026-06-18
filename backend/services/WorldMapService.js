const {
  CAPITAL_TILE_ID,
  DEFAULT_WORLD_SEED,
  DEFAULT_WORLD_HEIGHT,
  DEFAULT_WORLD_WIDTH,
  DEFAULT_WORLD_WRAPPING,
  DIRECTION_VECTORS,
  SCOUT_REVEAL_BRANCH_LIMIT,
  SCOUT_REVEAL_BRANCH_SIDES,
  SCOUT_REVEAL_MAIN_LIMIT,
  SCOUT_REVEAL_RADIUS,
  SCOUT_REVEAL_TILE_LIMIT,
  SIDE_DIRECTIONS,
  SIDE_ORDER,
  START_REVEAL_RADIUS,
  START_SAFE_LAND_RADIUS,
  WORLD_MAP_VERSION,
  WORLD_TOPOLOGY_VERSION,
} = require('./worldMap/WorldMapConstants');
const { getSpawnOrigin } = require('./spawn/SpawnAssignment');
const {
  clone,
  getCanonicalTileId,
  getDistanceFromCapital,
  getTileId,
  toInteger,
} = require('./worldMap/WorldMapShared');
const WorldMapTopology = require('./worldMap/WorldMapTopology');
const {
  compareTiles,
  createWorldMapBatch,
  mergeTiles,
} = require('./worldMap/WorldMapBatch');
const {
  createWorldMapGenerationMetadata,
  roll01,
} = require('./worldMap/WorldMapGenerationAuthority');
const {
  chooseOceanTemplates,
  getRiverMouthTemplateForNeighborOfOcean,
  getRiverPorts,
  getWorldWaterFeatures,
} = require('./worldMap/WorldMapWater');
const {
  chooseBaseTerrain,
  chooseTerrain,
  createTile,
  isStartSafeLandCoord,
  normalizeTile,
} = require('./worldMap/WorldMapTiles');
const VisionHistory = require('./worldMap/WorldMapVisionHistory');

function normalizeScoutTrail(rawTrail) {
  if (!rawTrail || typeof rawTrail !== 'object') return null;
  const missionId = typeof rawTrail.missionId === 'string' && rawTrail.missionId ? rawTrail.missionId : '';
  if (!missionId) return null;
  return {
    missionId,
    direction: typeof rawTrail.direction === 'string' ? rawTrail.direction : '',
    tileIds: Array.isArray(rawTrail.tileIds) ? rawTrail.tileIds.filter(Boolean).map(String) : [],
    returned: Boolean(rawTrail.returned),
  };
}

function createInitialWorldMap(seed = DEFAULT_WORLD_SEED, now = new Date(), options = {}) {
  const origin = getSpawnOrigin(options.spawn || options.origin || {});
  const tiles = getRevealArea(origin.q, origin.r, START_REVEAL_RADIUS).map((coord) => {
    const isCapital = coord.q === origin.q && coord.r === origin.r;
    return createTile(seed, coord.q, coord.r, now, {
      terrain: isCapital ? 'capital' : undefined,
      siteId: isCapital ? 'capital' : null,
      visibility: isCapital ? 'controlled' : 'scouted',
      controlled: isCapital,
    });
  });
  return {
    version: WORLD_MAP_VERSION,
    seed,
    generationAuthority: createWorldMapGenerationMetadata(seed),
    topology: WorldMapTopology.createWorldTopologyMetadata(),
    origin: { q: origin.q, r: origin.r },
    tiles,
    visionHistory: VisionHistory.normalizeHistory({
      sources: [{ kind: 'city', q: origin.q, r: origin.r, revealedAt: typeof now === 'string' ? now : now.toISOString() }],
    }),
    scoutTrails: [],
  };
}

function ensureStartingArea(tileMap, seed, now = new Date(), options = {}) {
  const origin = getSpawnOrigin(options.spawn || options.origin || {});
  for (const coord of getRevealArea(origin.q, origin.r, START_REVEAL_RADIUS)) {
    const canonicalId = getCanonicalTileId(coord.q, coord.r);
    const existing = tileMap.get(canonicalId);
    const isCapital = coord.q === origin.q && coord.r === origin.r;
    if (existing) {
      if (isCapital) {
        tileMap.set(canonicalId, normalizeTile({
          ...existing,
          terrain: 'capital',
          siteId: 'capital',
          visibility: 'controlled',
          discovered: true,
          visible: true,
        }, seed, now));
      }
      continue;
    }
    tileMap.set(canonicalId, createTile(seed, coord.q, coord.r, now, {
      terrain: isCapital ? 'capital' : undefined,
      siteId: isCapital ? 'capital' : null,
      visibility: isCapital ? 'controlled' : 'scouted',
      controlled: isCapital,
    }));
  }
  return tileMap;
}

function getSeed(gameStateOrSeed) {
  if (typeof gameStateOrSeed === 'string' && gameStateOrSeed) return gameStateOrSeed;
  const existingSeed = typeof gameStateOrSeed?.worldMap?.seed === 'string' ? gameStateOrSeed.worldMap.seed : '';
  if (existingSeed && existingSeed !== `world-${gameStateOrSeed?.playerId || ''}`) return existingSeed;
  return DEFAULT_WORLD_SEED;
}

function getWorldMapVersion(rawWorldMap) {
  return Math.max(0, toInteger(rawWorldMap?.version, 0));
}

function normalizeWorldMap(rawWorldMap, options = {}) {
  const seed = options.seed || rawWorldMap?.seed || DEFAULT_WORLD_SEED;
  const now = options.now || new Date();
  const origin = getSpawnOrigin(options.spawn || options.origin || rawWorldMap?.origin || {});
  const tileMap = new Map();
  for (const rawTile of Array.isArray(rawWorldMap?.tiles) ? rawWorldMap.tiles : []) {
    const tile = normalizeTile(rawTile, seed, now);
    if (tile) {
      const canonicalKey = WorldMapTopology.getTileCanonicalKey(tile);
      tileMap.set(canonicalKey, mergeTiles(tileMap.get(canonicalKey), tile, seed, now));
    }
  }
  ensureStartingArea(tileMap, seed, now, { origin });
  const scoutTrails = (Array.isArray(rawWorldMap?.scoutTrails) ? rawWorldMap.scoutTrails : [])
    .map(normalizeScoutTrail)
    .filter(Boolean);
  const visionHistory = VisionHistory.normalizeHistory(rawWorldMap?.visionHistory || rawWorldMap?.visionHistorySources);
  if (!visionHistory.sources.some((source) => source.kind === 'city' && source.q === origin.q && source.r === origin.r)) {
    visionHistory.sources.push({ kind: 'city', q: origin.q, r: origin.r, tileId: getTileId(origin.q, origin.r), revealedAt: null });
  }
  return {
    version: WORLD_MAP_VERSION,
    seed,
    generationAuthority: createWorldMapGenerationMetadata(seed),
    topology: WorldMapTopology.createWorldTopologyMetadata(rawWorldMap?.topology),
    origin: {
      q: origin.q,
      r: origin.r,
    },
    tiles: [...tileMap.values()].sort(compareTiles),
    visionHistory: VisionHistory.normalizeHistory(visionHistory),
    scoutTrails,
  };
}

function ensureWorldMap(gameState, now = new Date()) {
  const seed = getSeed(gameState);
  gameState.worldMap = normalizeWorldMap(gameState.worldMap, { seed, now, origin: gameState.worldMap?.origin });
  return gameState.worldMap;
}

function getTile(worldMap, q, r) {
  const canonicalId = getCanonicalTileId(q, r);
  return (worldMap?.tiles || []).find((tile) => (
    WorldMapTopology.getTileCanonicalKey(tile) === canonicalId
    || tile.q === q && tile.r === r
  )) || null;
}

function upsertTile(worldMap, tile) {
  const canonicalId = WorldMapTopology.getTileCanonicalKey(tile);
  const index = worldMap.tiles.findIndex((item) => WorldMapTopology.getTileCanonicalKey(item) === canonicalId);
  if (index >= 0) worldMap.tiles[index] = mergeTiles(worldMap.tiles[index], tile, worldMap.seed);
  else worldMap.tiles.push(tile);
  worldMap.tiles.sort(compareTiles);
  return index >= 0 ? worldMap.tiles[index] : tile;
}

function revealTile(gameState, q, r, now = new Date(), overrides = {}) {
  const worldMap = ensureWorldMap(gameState, now);
  const existing = getTile(worldMap, q, r);
  const isoNow = typeof now === 'string' ? now : now.toISOString();
  const hasSiteOverride = Object.prototype.hasOwnProperty.call(overrides, 'siteId');
  const discovered = overrides.discovered !== undefined ? Boolean(overrides.discovered) : true;
  const visible = overrides.visible !== undefined ? Boolean(overrides.visible) : true;
  const tile = existing
    ? normalizeTile({
      ...existing,
      ...overrides,
      id: existing.visible === false && visible !== false ? getTileId(q, r) : existing.id,
      q: existing.visible === false && visible !== false ? toInteger(q, existing.q) : existing.q,
      r: existing.visible === false && visible !== false ? toInteger(r, existing.r) : existing.r,
      siteId: hasSiteOverride ? overrides.siteId : existing.siteId,
      discovered,
      visible,
      visibility: overrides.visibility || existing.visibility || 'scouted',
      discoveredAt: existing.discoveredAt || existing.generatedAt || isoNow,
      lastScoutedAt: overrides.lastScoutedAt || isoNow,
      intel: overrides.intel || existing.intel,
    }, worldMap.seed, now)
    : createTile(worldMap.seed, q, r, now, overrides);
  return upsertTile(worldMap, tile);
}

function revealTiles(gameState, coords = [], now = new Date(), options = {}) {
  const worldMap = ensureWorldMap(gameState, now);
  const batch = createWorldMapBatch(worldMap, now);
  const revealed = [];
  const getOverrides = typeof options.overrides === 'function'
    ? options.overrides
    : () => options.overrides || {};
  for (const coord of Array.isArray(coords) ? coords : []) {
    if (!coord || typeof coord !== 'object') continue;
    const q = toInteger(coord.q ?? coord.x, 0);
    const r = toInteger(coord.r ?? coord.y, 0);
    const overrides = {
      ...(coord.overrides && typeof coord.overrides === 'object' ? coord.overrides : {}),
      ...(getOverrides(coord, revealed.length) || {}),
    };
    const tile = batch.revealTile(q, r, overrides);
    if (tile) revealed.push(tile);
  }
  batch.commit();
  return revealed;
}

function recordVisionSource(gameState, source, now = new Date()) {
  ensureWorldMap(gameState, now);
  return VisionHistory.recordSource(gameState, source, now);
}

function recordVisionPath(gameState, from, to, now = new Date(), options = {}) {
  ensureWorldMap(gameState, now);
  return VisionHistory.recordPath(gameState, {
    kind: options.kind || 'unit',
    from,
    to,
  }, now, options);
}

function getRevealArea(q, r, radius = SCOUT_REVEAL_RADIUS) {
  const centerQ = toInteger(q, 0);
  const centerR = toInteger(r, 0);
  const safeRadius = Math.max(0, toInteger(radius, SCOUT_REVEAL_RADIUS));
  const coords = [];
  for (let dq = -safeRadius; dq <= safeRadius; dq += 1) {
    for (let dr = -safeRadius; dr <= safeRadius; dr += 1) {
      coords.push({ q: centerQ + dq, r: centerR + dr });
    }
  }
  return coords.sort((a, b) => (
    Math.max(Math.abs(a.q - centerQ), Math.abs(a.r - centerR))
    - Math.max(Math.abs(b.q - centerQ), Math.abs(b.r - centerR))
    || a.q - b.q
    || a.r - b.r
  ));
}

function revealTileArea(gameState, q, r, now = new Date(), options = {}) {
  const radius = options.radius === undefined ? SCOUT_REVEAL_RADIUS : options.radius;
  return revealTiles(gameState, getRevealArea(q, r, radius), now);
}

function getScoutRevealArea(seed, route = [], direction = '', options = {}) {
  const mainLimit = Math.max(1, toInteger(options.mainLimit, SCOUT_REVEAL_MAIN_LIMIT));
  const branchLimit = Math.min(mainLimit, Math.max(0, toInteger(options.branchLimit, SCOUT_REVEAL_BRANCH_LIMIT)));
  const tileLimit = Math.max(mainLimit, toInteger(options.tileLimit, SCOUT_REVEAL_TILE_LIMIT));
  const minTileLimit = Math.max(mainLimit, Math.min(tileLimit, toInteger(options.minTileLimit, Math.min(4, tileLimit))));
  const branchSides = SCOUT_REVEAL_BRANCH_SIDES[direction] || [];
  const byKey = new Map();
  const addCoord = (q, r, step, kind) => {
    const safeQ = toInteger(q, 0);
    const safeR = toInteger(r, 0);
    const key = getTileId(safeQ, safeR);
    const existing = byKey.get(key);
    if (existing) {
      if (kind === 'main' && existing.kind !== 'main') existing.kind = 'main';
      existing.step = Math.min(existing.step, step);
      return existing;
    }
    const coord = { q: safeQ, r: safeR, step, kind };
    byKey.set(key, coord);
    return coord;
  };

  const normalizedRoute = (Array.isArray(route) ? route : [])
    .map((step, index) => ({
      q: toInteger(step?.q, 0),
      r: toInteger(step?.r, 0),
      step: Math.max(1, toInteger(step?.step, index + 1)),
    }))
    .sort((a, b) => a.step - b.step);

  const revealRoute = normalizedRoute.slice(0, mainLimit);
  const branchCandidates = [];
  for (const step of revealRoute) {
    addCoord(step.q, step.r, step.step, 'main');
    if (step.step > branchLimit || !branchSides.length) continue;
    branchSides.forEach((side, sideIndex) => {
      const roll = roll01(seed || DEFAULT_WORLD_SEED, step.q + side.q, step.r + side.r, `scout-branch-${direction}-${step.step}-${sideIndex}`, {
        action: 'scoutRevealArea',
      });
      branchCandidates.push({
        q: step.q + side.q,
        r: step.r + side.r,
        step: step.step,
        sideIndex,
        roll,
      });
    });
  }

  const addBranch = (candidate) => {
    if (byKey.size >= tileLimit) return;
    addCoord(candidate.q, candidate.r, candidate.step, 'branch');
  };
  for (const candidate of branchCandidates) {
    if (candidate.roll < 0.72) addBranch(candidate);
  }
  if (byKey.size < minTileLimit) {
    branchCandidates
      .filter((candidate) => !byKey.has(getTileId(candidate.q, candidate.r)))
      .sort((a, b) => a.roll - b.roll || a.step - b.step || a.sideIndex - b.sideIndex)
      .forEach((candidate) => {
        if (byKey.size < minTileLimit) addBranch(candidate);
      });
  }
  return [...byKey.values()].sort((a, b) => (
    a.step - b.step
    || (a.kind === 'main' ? -1 : b.kind === 'main' ? 1 : 0)
    || a.q - b.q
    || a.r - b.r
  ));
}

function revealScoutArea(gameState, revealArea = [], now = new Date()) {
  return revealTiles(gameState, revealArea, now);
}

function canPlaceSiteOnTerrain(seed, q, r) {
  return !['ocean', 'river'].includes(chooseTerrain(seed, q, r));
}

function bindSiteToTile(gameState, q, r, siteId, now = new Date(), options = {}) {
  const controlled = Boolean(options.controlled || options.visibility === 'controlled');
  const tile = revealTile(gameState, q, r, now, {
    siteId,
    visibility: controlled ? 'controlled' : (options.visibility || 'scouted'),
    intel: options.intel,
  });
  if (controlled) recordVisionSource(gameState, { kind: 'city', q, r }, now);
  return tile;
}

function getDirectionVector(direction) {
  return DIRECTION_VECTORS[direction] || null;
}

function buildScoutRoute(origin, direction, actionPoints, options = {}) {
  const vector = getDirectionVector(direction);
  if (!vector) return [];
  const startQ = toInteger(origin?.q ?? origin?.x, 0);
  const startR = toInteger(origin?.r ?? origin?.y, 0);
  const steps = Math.max(0, toInteger(actionPoints, 0));
  const startDistance = Math.max(1, toInteger(options.startDistance, 1));
  const route = [];
  for (let step = 0; step < steps; step += 1) {
    const distance = startDistance + step;
    route.push({
      q: startQ + vector.q * distance,
      r: startR + vector.r * distance,
      step: step + 1,
    });
  }
  return route;
}

function recordScoutTrail(gameState, mission, tileIds, returned = false) {
  const worldMap = ensureWorldMap(gameState);
  const missionId = mission?.id || '';
  if (!missionId) return null;
  const nextTrail = {
    missionId,
    direction: mission.direction || '',
    tileIds: Array.from(new Set(tileIds.filter(Boolean))),
    returned: Boolean(returned),
  };
  const index = worldMap.scoutTrails.findIndex((trail) => trail.missionId === missionId);
  if (index >= 0) worldMap.scoutTrails[index] = nextTrail;
  else worldMap.scoutTrails.push(nextTrail);
  return nextTrail;
}

function getClientWorldMap(gameState, now = new Date()) {
  return getClientWorldMapFromNormalized(ensureWorldMap(gameState, now));
}

function isCapitalOriginTile(tile = {}, origin = {}) {
  return toInteger(tile.q ?? tile.x, 0) === toInteger(origin.q ?? origin.x, 0)
    && toInteger(tile.r ?? tile.y, 0) === toInteger(origin.r ?? origin.y, 0);
}

function isLegacyCapitalTileOutsideOrigin(tile = {}, origin = {}) {
  const markedCapital = tile.id === CAPITAL_TILE_ID
    || tile.siteId === 'capital'
    || tile.terrain === 'capital';
  return markedCapital && !isCapitalOriginTile(tile, origin);
}

function getClientWorldMapFromNormalized(worldMap) {
  const clientWorldMap = clone(worldMap || {});
  const origin = getSpawnOrigin(clientWorldMap.origin || {});
  clientWorldMap.tiles = (clientWorldMap.tiles || []).filter((tile) => (
    tile.visibility !== 'hidden'
    && tile.visible !== false
    && !isLegacyCapitalTileOutsideOrigin(tile, origin)
  ));
  return clientWorldMap;
}

module.exports = {
  WORLD_MAP_VERSION,
  WORLD_TOPOLOGY_VERSION,
  DEFAULT_WORLD_SEED,
  DEFAULT_WORLD_HEIGHT,
  DEFAULT_WORLD_WIDTH,
  DEFAULT_WORLD_WRAPPING,
  CAPITAL_TILE_ID,
  START_REVEAL_RADIUS,
  START_SAFE_LAND_RADIUS,
  SCOUT_REVEAL_RADIUS,
  SCOUT_REVEAL_MAIN_LIMIT,
  SCOUT_REVEAL_BRANCH_LIMIT,
  SCOUT_REVEAL_TILE_LIMIT,
  SIDE_ORDER,
  SIDE_DIRECTIONS,
  DIRECTION_VECTORS,
  getDistanceFromCapital,
  getWorldMapVersion,
  getWorldWaterFeatures,
  createWorldMapGenerationMetadata,
  createWorldTopologyMetadata: WorldMapTopology.createWorldTopologyMetadata,
  getCanonicalTileId,
  getWrappedDistance: WorldMapTopology.getWrappedDistance,
  getWrappedDelta: WorldMapTopology.getDelta,
  normalizeWorldCoord: WorldMapTopology.normalizeCoord,
  normalizeWorldSize: WorldMapTopology.normalizeWorldSize,
  getTileId,
  chooseBaseTerrain,
  chooseTerrain,
  chooseOceanTemplates,
  getRiverPorts,
  getRiverMouthTemplateForNeighborOfOcean,
  getRevealArea,
  revealTileArea,
  getScoutRevealArea,
  revealScoutArea,
  canPlaceSiteOnTerrain,
  createTile,
  createWorldMapBatch,
  createInitialWorldMap,
  normalizeWorldMap,
  ensureWorldMap,
  recordVisionPath,
  recordVisionSource,
  revealTile,
  revealTiles,
  bindSiteToTile,
  buildScoutRoute,
  recordScoutTrail,
  getClientWorldMap,
  getClientWorldMapFromNormalized,
};
