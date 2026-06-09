const {
  CAPITAL_TILE_ID,
  DEFAULT_WORLD_SEED,
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
} = require('./worldMap/WorldMapConstants');
const {
  clone,
  getDistanceFromCapital,
  getTileId,
  toInteger,
} = require('./worldMap/WorldMapShared');
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

function createInitialWorldMap(seed = DEFAULT_WORLD_SEED, now = new Date()) {
  const tiles = getRevealArea(0, 0, START_REVEAL_RADIUS).map((coord) => {
    const isCapital = coord.q === 0 && coord.r === 0;
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
    origin: { q: 0, r: 0 },
    tiles,
    scoutTrails: [],
  };
}

function ensureStartingArea(tileMap, seed, now = new Date()) {
  for (const coord of getRevealArea(0, 0, START_REVEAL_RADIUS)) {
    const id = getTileId(coord.q, coord.r);
    const existing = tileMap.get(id);
    const isCapital = coord.q === 0 && coord.r === 0;
    if (existing) {
      if (isCapital) {
        tileMap.set(id, normalizeTile({
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
    tileMap.set(id, createTile(seed, coord.q, coord.r, now, {
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
  if (gameStateOrSeed?.worldMap?.seed) return gameStateOrSeed.worldMap.seed;
  return gameStateOrSeed?.playerId ? `world-${gameStateOrSeed.playerId}` : DEFAULT_WORLD_SEED;
}

function getWorldMapVersion(rawWorldMap) {
  return Math.max(0, toInteger(rawWorldMap?.version, 0));
}

function normalizeWorldMap(rawWorldMap, options = {}) {
  const seed = rawWorldMap?.seed || options.seed || DEFAULT_WORLD_SEED;
  const now = options.now || new Date();
  const tileMap = new Map();
  for (const rawTile of Array.isArray(rawWorldMap?.tiles) ? rawWorldMap.tiles : []) {
    const tile = normalizeTile(rawTile, seed, now);
    if (tile) tileMap.set(tile.id, tile);
  }
  ensureStartingArea(tileMap, seed, now);
  const scoutTrails = (Array.isArray(rawWorldMap?.scoutTrails) ? rawWorldMap.scoutTrails : [])
    .map(normalizeScoutTrail)
    .filter(Boolean);
  return {
    version: WORLD_MAP_VERSION,
    seed,
    generationAuthority: createWorldMapGenerationMetadata(seed),
    origin: {
      q: toInteger(rawWorldMap?.origin?.q, 0),
      r: toInteger(rawWorldMap?.origin?.r, 0),
    },
    tiles: [...tileMap.values()].sort((a, b) => Math.max(Math.abs(a.q), Math.abs(a.r)) - Math.max(Math.abs(b.q), Math.abs(b.r)) || a.q - b.q || a.r - b.r),
    scoutTrails,
  };
}

function ensureWorldMap(gameState, now = new Date()) {
  const seed = getSeed(gameState);
  gameState.worldMap = normalizeWorldMap(gameState.worldMap, { seed, now });
  return gameState.worldMap;
}

function getTile(worldMap, q, r) {
  return (worldMap?.tiles || []).find((tile) => tile.q === q && tile.r === r) || null;
}

function upsertTile(worldMap, tile) {
  const index = worldMap.tiles.findIndex((item) => item.id === tile.id);
  if (index >= 0) worldMap.tiles[index] = { ...worldMap.tiles[index], ...tile };
  else worldMap.tiles.push(tile);
  worldMap.tiles.sort((a, b) => Math.max(Math.abs(a.q), Math.abs(a.r)) - Math.max(Math.abs(b.q), Math.abs(b.r)) || a.q - b.q || a.r - b.r);
  return tile;
}

function revealTile(gameState, q, r, now = new Date(), overrides = {}) {
  const worldMap = ensureWorldMap(gameState, now);
  const existing = getTile(worldMap, q, r);
  const isoNow = typeof now === 'string' ? now : now.toISOString();
  const hasSiteOverride = Object.prototype.hasOwnProperty.call(overrides, 'siteId');
  const tile = existing
    ? normalizeTile({
      ...existing,
      ...overrides,
      siteId: hasSiteOverride ? overrides.siteId : existing.siteId,
      discovered: true,
      visible: true,
      visibility: overrides.visibility || existing.visibility || 'scouted',
      discoveredAt: existing.discoveredAt || existing.generatedAt || isoNow,
      lastScoutedAt: overrides.lastScoutedAt || isoNow,
      intel: overrides.intel || existing.intel,
    }, worldMap.seed, now)
    : createTile(worldMap.seed, q, r, now, overrides);
  return upsertTile(worldMap, tile);
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
  return getRevealArea(q, r, radius).map((coord) => revealTile(gameState, coord.q, coord.r, now));
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
  return (Array.isArray(revealArea) ? revealArea : [])
    .map((coord) => revealTile(gameState, coord.q, coord.r, now));
}

function canPlaceSiteOnTerrain(seed, q, r) {
  return !['ocean', 'river'].includes(chooseTerrain(seed, q, r));
}

function bindSiteToTile(gameState, q, r, siteId, now = new Date(), options = {}) {
  const controlled = Boolean(options.controlled || options.visibility === 'controlled');
  return revealTile(gameState, q, r, now, {
    siteId,
    visibility: controlled ? 'controlled' : (options.visibility || 'scouted'),
    intel: options.intel,
  });
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
  return clone(ensureWorldMap(gameState, now));
}

module.exports = {
  WORLD_MAP_VERSION,
  DEFAULT_WORLD_SEED,
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
  createInitialWorldMap,
  normalizeWorldMap,
  ensureWorldMap,
  revealTile,
  bindSiteToTile,
  buildScoutRoute,
  recordScoutTrail,
  getClientWorldMap,
};
