const WORLD_MAP_VERSION = 3;
const DEFAULT_WORLD_SEED = 'world-seed-v1';
const CAPITAL_TILE_ID = 'tile_0_0';
const SCOUT_REVEAL_RADIUS = 1;
const SCOUT_REVEAL_BRANCH_LIMIT = 5;
const WORLD_WATER_FEATURE_CACHE = new Map();

const TERRAIN_TYPES = ['plains', 'forest', 'hills', 'mountain', 'waste', 'desert', 'river', 'ocean'];
const SIDE_ORDER = ['nw', 'ne', 'se', 'sw'];
const SIDE_DIRECTIONS = {
  nw: { q: -1, r: 0 },
  ne: { q: 0, r: -1 },
  se: { q: 1, r: 0 },
  sw: { q: 0, r: 1 },
};
const OCEAN_SHORE_EDGE_BY_CORE_OFFSET = {
  '-1,0': 'nw',
  '0,-1': 'ne',
  '1,0': 'se',
  '0,1': 'sw',
};
const OCEAN_CORNER_BY_CORE_OFFSET = {
  '1,1': 'corner-n',
  '-1,1': 'corner-e',
  '-1,-1': 'corner-s',
  '1,-1': 'corner-w',
};
const HOME_RIVER_LENGTH = 7;
const RIVER_MOUTH_SCAN_RADIUS = 32;
const WATER_FEATURE_CACHE_LIMIT = 64;
const SIDE_OPPOSITES = {
  nw: 'se',
  ne: 'sw',
  se: 'nw',
  sw: 'ne',
};
const DIRECTION_VECTORS = {
  n: { q: 0, r: -1 },
  ne: { q: 1, r: -1 },
  e: { q: 1, r: 0 },
  se: { q: 1, r: 1 },
  s: { q: 0, r: 1 },
  sw: { q: -1, r: 1 },
  w: { q: -1, r: 0 },
  nw: { q: -1, r: -1 },
};
const SCOUT_REVEAL_BRANCH_SIDES = {
  n: [{ q: -1, r: 0 }, { q: 1, r: 0 }],
  ne: [{ q: 0, r: -1 }, { q: 1, r: 0 }],
  e: [{ q: 0, r: -1 }, { q: 0, r: 1 }],
  se: [{ q: 1, r: 0 }, { q: 0, r: 1 }],
  s: [{ q: -1, r: 0 }, { q: 1, r: 0 }],
  sw: [{ q: 0, r: 1 }, { q: -1, r: 0 }],
  w: [{ q: 0, r: -1 }, { q: 0, r: 1 }],
  nw: [{ q: -1, r: 0 }, { q: 0, r: -1 }],
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function hashString(input) {
  let hash = 2166136261;
  const text = String(input);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function random01(seed, q, r, salt) {
  return hashString(`${seed}|${q}|${r}|${salt}`) / 4294967295;
}

function getTileId(q, r) {
  return `tile_${q}_${r}`;
}

function getSortedSideKey(sides = []) {
  return sides
    .filter(Boolean)
    .sort((a, b) => SIDE_ORDER.indexOf(a) - SIDE_ORDER.indexOf(b))
    .join('-');
}

function normalizeSeedCoordArgs(seedOrQ, qOrR, rValue) {
  if (rValue === undefined) {
    return {
      seed: DEFAULT_WORLD_SEED,
      q: toInteger(seedOrQ, 0),
      r: toInteger(qOrR, 0),
    };
  }
  return {
    seed: typeof seedOrQ === 'string' && seedOrQ ? seedOrQ : DEFAULT_WORLD_SEED,
    q: toInteger(qOrR, 0),
    r: toInteger(rValue, 0),
  };
}

function rotateSide(side, steps) {
  const index = SIDE_ORDER.indexOf(side);
  if (index < 0) return SIDE_ORDER[0];
  return SIDE_ORDER[(index + steps + SIDE_ORDER.length * 4) % SIDE_ORDER.length];
}

function pickSide(seed, salt) {
  return SIDE_ORDER[Math.floor(random01(seed, 0, 0, salt) * SIDE_ORDER.length) % SIDE_ORDER.length];
}

function getBoxBasinScore(q, r, basin) {
  const qRatio = Math.abs(q - basin.centerQ) / basin.radiusQ;
  const rRatio = Math.abs(r - basin.centerR) / basin.radiusR;
  return 1 - Math.max(qRatio, rRatio);
}

function createOceanBasin(seed, id, side, options = {}) {
  const main = SIDE_DIRECTIONS[side] || SIDE_DIRECTIONS.ne;
  const lateralSide = rotateSide(side, options.lateralTurn || 1);
  const lateral = SIDE_DIRECTIONS[lateralSide] || SIDE_DIRECTIONS.se;
  const distance = (options.baseDistance || 3)
    + Math.floor(random01(seed, id, 0, `ocean-${id}-distance`) * (options.distanceSpread || 3));
  const lateralOffset = Math.floor(random01(seed, id, 1, `ocean-${id}-lateral`) * 5) - 2;
  return {
    id,
    side,
    centerQ: main.q * distance + lateral.q * lateralOffset,
    centerR: main.r * distance + lateral.r * lateralOffset,
    radiusQ: main.q === 0
      ? 0.65 + random01(seed, id, 2, `ocean-${id}-radius-q`) * 0.35
      : 1.35 + random01(seed, id, 2, `ocean-${id}-radius-q`) * (options.radiusBoost || 1.5),
    radiusR: main.r === 0
      ? 0.65 + random01(seed, id, 3, `ocean-${id}-radius-r`) * 0.35
      : 1.35 + random01(seed, id, 3, `ocean-${id}-radius-r`) * (options.radiusBoost || 1.5),
    noise: options.noise || 0.16,
  };
}

function buildOceanBasins(seed) {
  const primarySide = pickSide(seed, 'primary-ocean-side');
  const secondarySide = SIDE_OPPOSITES[primarySide] || rotateSide(primarySide, 2);
  const tertiarySide = rotateSide(primarySide, random01(seed, 0, 0, 'tertiary-ocean-turn') < 0.5 ? 1 : -1);
  return [
    createOceanBasin(seed, 'primary', primarySide, { baseDistance: 3, distanceSpread: 3, radiusBoost: 1.35, noise: 0.12 }),
    createOceanBasin(seed, 'secondary', secondarySide, { baseDistance: 8, distanceSpread: 5, radiusBoost: 2.2, lateralTurn: -1, noise: 0.18 }),
    createOceanBasin(seed, 'tertiary', tertiarySide, { baseDistance: 10, distanceSpread: 6, radiusBoost: 2.6, noise: 0.22 }),
  ];
}

function getOceanBasinScoreForBasins(seed, q, r, basins) {
  return (Array.isArray(basins) ? basins : []).reduce((best, basin) => {
    const ragged = (random01(seed, q, r, `ocean-basin-${basin.id}`) - 0.5) * basin.noise;
    return Math.max(best, getBoxBasinScore(q, r, basin) + ragged);
  }, -1);
}

function isOceanCoreCoordForBasins(seed, q, r, basins) {
  if (q === 0 && r === 0) return false;
  return getOceanBasinScoreForBasins(seed, q, r, basins) >= 0;
}

function getAdjacentOceanSidesForBasins(seed, q, r, basins) {
  const sides = new Set();
  for (const [offsetKey, side] of Object.entries(OCEAN_SHORE_EDGE_BY_CORE_OFFSET)) {
    const [dq, dr] = offsetKey.split(',').map(Number);
    if (isOceanCoreCoordForBasins(seed, q + dq, r + dr, basins)) sides.add(side);
  }
  return SIDE_ORDER.filter((side) => sides.has(side));
}

function getAdjacentOceanCornersForBasins(seed, q, r, basins) {
  const corners = [];
  for (const [offsetKey, corner] of Object.entries(OCEAN_CORNER_BY_CORE_OFFSET)) {
    const [dq, dr] = offsetKey.split(',').map(Number);
    if (isOceanCoreCoordForBasins(seed, q + dq, r + dr, basins)) corners.push(corner);
  }
  return corners;
}

function hasOceanTemplateForBasins(seed, q, r, basins) {
  return isOceanCoreCoordForBasins(seed, q, r, basins)
    || getAdjacentOceanSidesForBasins(seed, q, r, basins).length > 0
    || getAdjacentOceanCornersForBasins(seed, q, r, basins).length > 0;
}

function getRiverLength(seed) {
  return HOME_RIVER_LENGTH + Math.floor(random01(seed, 0, 0, 'home-river-length') * 3);
}

function canBuildRiverPath(seed, q, r, oceanSide, length, basins) {
  const inlandSide = SIDE_OPPOSITES[oceanSide];
  const inlandDir = SIDE_DIRECTIONS[inlandSide];
  if (!inlandDir) return false;
  for (let step = 1; step < length; step += 1) {
    const nextQ = q + inlandDir.q * step;
    const nextR = r + inlandDir.r * step;
    if (nextQ === 0 && nextR === 0) return false;
    if (hasOceanTemplateForBasins(seed, nextQ, nextR, basins)) return false;
  }
  return true;
}

function findRiverChannel(seed, basins) {
  const length = getRiverLength(seed);
  const candidates = [];
  for (let q = -RIVER_MOUTH_SCAN_RADIUS; q <= RIVER_MOUTH_SCAN_RADIUS; q += 1) {
    for (let r = -RIVER_MOUTH_SCAN_RADIUS; r <= RIVER_MOUTH_SCAN_RADIUS; r += 1) {
      if (q === 0 && r === 0) continue;
      if (isOceanCoreCoordForBasins(seed, q, r, basins)) continue;
      if (getAdjacentOceanCornersForBasins(seed, q, r, basins).length > 0) continue;
      const sides = getAdjacentOceanSidesForBasins(seed, q, r, basins);
      if (sides.length !== 1) continue;
      const oceanSide = sides[0];
      const oceanDir = SIDE_DIRECTIONS[oceanSide];
      if (!oceanDir) continue;
      if (!isOceanCoreCoordForBasins(seed, q + oceanDir.q, r + oceanDir.r, basins)) continue;
      if (!canBuildRiverPath(seed, q, r, oceanSide, length, basins)) continue;
      const distance = getDistanceFromCapital(q, r);
      const shoreScore = getOceanBasinScoreForBasins(seed, q + oceanDir.q, r + oceanDir.r, basins);
      const stableNoise = random01(seed, q, r, `river-channel-${oceanSide}`);
      candidates.push({
        q,
        r,
        oceanSide,
        inlandSide: SIDE_OPPOSITES[oceanSide],
        length,
        score: 40 - Math.abs(distance - 4) * 3 + shoreScore * 6 + stableNoise,
      });
    }
  }
  return candidates.sort((a, b) => b.score - a.score || a.q - b.q || a.r - b.r)[0] || null;
}

function buildWorldWaterFeatures(seed = DEFAULT_WORLD_SEED) {
  const normalizedSeed = typeof seed === 'string' && seed ? seed : DEFAULT_WORLD_SEED;
  const basins = buildOceanBasins(normalizedSeed);
  return {
    seed: normalizedSeed,
    basins,
    river: findRiverChannel(normalizedSeed, basins),
  };
}

function getWorldWaterFeatures(seed = DEFAULT_WORLD_SEED) {
  const normalizedSeed = typeof seed === 'string' && seed ? seed : DEFAULT_WORLD_SEED;
  if (WORLD_WATER_FEATURE_CACHE.has(normalizedSeed)) return WORLD_WATER_FEATURE_CACHE.get(normalizedSeed);
  if (WORLD_WATER_FEATURE_CACHE.size >= WATER_FEATURE_CACHE_LIMIT) WORLD_WATER_FEATURE_CACHE.clear();
  const features = buildWorldWaterFeatures(normalizedSeed);
  WORLD_WATER_FEATURE_CACHE.set(normalizedSeed, features);
  return features;
}

function getOceanBasinScore(seed, q, r) {
  return getOceanBasinScoreForBasins(seed, q, r, getWorldWaterFeatures(seed).basins);
}

function isOceanCoreCoord(seedOrQ, qOrR, rValue) {
  const { seed, q, r } = normalizeSeedCoordArgs(seedOrQ, qOrR, rValue);
  return isOceanCoreCoordForBasins(seed, q, r, getWorldWaterFeatures(seed).basins);
}

function getAdjacentOceanSides(seed, q, r) {
  return getAdjacentOceanSidesForBasins(seed, q, r, getWorldWaterFeatures(seed).basins);
}

function getAdjacentOceanCorners(seed, q, r) {
  return getAdjacentOceanCornersForBasins(seed, q, r, getWorldWaterFeatures(seed).basins);
}

function isOceanShoreCornerCoord(seed, q, r) {
  return !isOceanCoreCoord(seed, q, r) && getAdjacentOceanCorners(seed, q, r).length > 0;
}

function getOceanShoreEdgeTemplateKeys(sides = []) {
  const key = getSortedSideKey(sides);
  const comboKeys = new Set(['nw-ne', 'ne-se', 'se-sw', 'nw-sw']);
  if (comboKeys.has(key)) return [key];
  return SIDE_ORDER.filter((side) => sides.includes(side));
}

function getRiverMouthTemplateForNeighborOfOcean(qOffset, rOffset) {
  const q = toInteger(qOffset);
  const r = toInteger(rOffset);
  const side = Object.entries(SIDE_DIRECTIONS)
    .find(([_side, dir]) => dir.q === -q && dir.r === -r)?.[0] || '';
  return side ? `river-mouth-${side}` : '';
}

function getGeneratedRiverPorts(seed, q, r) {
  const channel = getWorldWaterFeatures(seed).river;
  if (!channel) return [];
  const inlandDir = SIDE_DIRECTIONS[channel.inlandSide];
  if (!inlandDir) return [];
  let riverStep = -1;
  for (let step = 0; step < channel.length; step += 1) {
    if (q === channel.q + inlandDir.q * step && r === channel.r + inlandDir.r * step) {
      riverStep = step;
      break;
    }
  }
  if (riverStep < 0) return [];
  const ports = [];
  ports.push(channel.oceanSide);
  if (riverStep < channel.length - 1) ports.push(channel.inlandSide);
  return SIDE_ORDER.filter((side) => ports.includes(side));
}

function getRiverPorts(seedOrQ, qOrR, rValue) {
  const { seed, q, r } = normalizeSeedCoordArgs(seedOrQ, qOrR, rValue);
  if (q === 0 && r === 0) return [];
  return getGeneratedRiverPorts(seed, q, r);
}

function chooseOceanTemplates(seedOrQ, qOrR, rValue) {
  const { seed, q, r } = normalizeSeedCoordArgs(seedOrQ, qOrR, rValue);
  if (q === 0 && r === 0) return [];
  if (isOceanCoreCoord(seed, q, r)) return ['full'];
  const sides = getAdjacentOceanSides(seed, q, r);
  const blocksRiverMouth = isOceanShoreCornerCoord(seed, q, r);
  const riverPorts = getRiverPorts(seed, q, r);
  const edgeKeys = getOceanShoreEdgeTemplateKeys(sides).map((key) => (
    !blocksRiverMouth && sides.length === 1 && riverPorts.includes(key)
      ? getRiverMouthTemplateForNeighborOfOcean(
        -(SIDE_DIRECTIONS[key]?.q || 0),
        -(SIDE_DIRECTIONS[key]?.r || 0),
      ) || key
      : key
  ));
  return [
    ...edgeKeys,
    ...getAdjacentOceanCorners(seed, q, r),
  ];
}

function getTerrainTransitionKey(seed, q, r, terrain) {
  if (terrain !== 'plains' && terrain !== 'capital') return '';
  const desertSides = SIDE_ORDER.filter((side) => {
    const dir = SIDE_DIRECTIONS[side];
    return chooseBaseTerrain(seed, q + dir.q, r + dir.r) === 'desert';
  });
  return getSortedSideKey(desertSides);
}

function getDistanceFromCapital(q, r) {
  return Math.max(Math.abs(q), Math.abs(r));
}

function chooseBaseTerrain(seed, q, r) {
  if (q === 0 && r === 0) return 'capital';
  const forest = random01(seed, q, r, 'forest');
  const ridge = random01(seed, q, r, 'ridge');
  const dry = random01(seed, q, r, 'dry');
  const rough = random01(seed, q, r, 'rough');
  const distance = getDistanceFromCapital(q, r);
  const settlementBias = Math.max(0, 4 - distance) * 0.06;
  if (rough > 0.9 - settlementBias && ridge > 0.72) return 'mountain';
  if (ridge > 0.8 - settlementBias || (rough > 0.84 && distance >= 4)) return 'hills';
  if (dry > 0.84 && forest < 0.42) return distance >= 3 ? 'desert' : 'waste';
  if (dry > 0.78 && rough > 0.58) return 'waste';
  if (forest > 0.66 + settlementBias && dry < 0.76) return 'forest';
  return 'plains';
}

function chooseTerrain(seed, q, r) {
  if (q === 0 && r === 0) return 'capital';
  if (chooseOceanTemplates(seed, q, r).length) return 'ocean';
  if (getRiverPorts(seed, q, r).length) return 'river';
  return chooseBaseTerrain(seed, q, r);
}

function decorateTile(tile, seed) {
  if (tile?.id === CAPITAL_TILE_ID || (tile?.q === 0 && tile?.r === 0)) {
    return {
      ...tile,
      terrain: 'capital',
      riverPorts: [],
      oceanTemplates: [],
      transitionKey: tile.transitionKey || getTerrainTransitionKey(seed, 0, 0, 'capital'),
    };
  }
  const naturalOceanTemplates = chooseOceanTemplates(seed, tile.q, tile.r);
  const naturalRiverPorts = getRiverPorts(seed, tile.q, tile.r);
  const terrain = naturalOceanTemplates.length
    ? 'ocean'
    : naturalRiverPorts.length
      ? 'river'
      : chooseBaseTerrain(seed, tile.q, tile.r);
  const oceanTemplates = terrain === 'ocean' ? naturalOceanTemplates : [];
  const riverPorts = terrain === 'river' ? naturalRiverPorts : [];
  return {
    ...tile,
    terrain,
    riverPorts,
    oceanTemplates,
    transitionKey: tile.transitionKey || getTerrainTransitionKey(seed, tile.q, tile.r, terrain),
  };
}

function createTile(seed, q, r, now = new Date(), overrides = {}) {
  const isoNow = typeof now === 'string' ? now : now.toISOString();
  const terrain = overrides.terrain || chooseTerrain(seed, q, r);
  return decorateTile({
    id: getTileId(q, r),
    q,
    r,
    terrain,
    discovered: overrides.discovered !== undefined ? Boolean(overrides.discovered) : true,
    visible: overrides.visible !== undefined ? Boolean(overrides.visible) : true,
    generatedAt: overrides.generatedAt || isoNow,
    riverPorts: Array.isArray(overrides.riverPorts) ? [...overrides.riverPorts] : [],
    oceanTemplates: Array.isArray(overrides.oceanTemplates) ? [...overrides.oceanTemplates] : [],
    transitionKey: typeof overrides.transitionKey === 'string' ? overrides.transitionKey : '',
    siteId: typeof overrides.siteId === 'string' && overrides.siteId ? overrides.siteId : null,
  }, seed);
}

function normalizeTile(rawTile, seed, now = new Date()) {
  if (!rawTile || typeof rawTile !== 'object') return null;
  const q = toInteger(rawTile.q, 0);
  const r = toInteger(rawTile.r, 0);
  return createTile(seed, q, r, now, {
    id: rawTile.id || getTileId(q, r),
    terrain: TERRAIN_TYPES.includes(rawTile.terrain) || rawTile.terrain === 'capital' || rawTile.terrain === 'ocean'
      ? rawTile.terrain
      : chooseTerrain(seed, q, r),
    discovered: rawTile.discovered !== false,
    visible: rawTile.visible !== false,
    generatedAt: rawTile.generatedAt,
    riverPorts: rawTile.riverPorts,
    oceanTemplates: rawTile.oceanTemplates,
    transitionKey: rawTile.transitionKey,
    siteId: rawTile.siteId,
  });
}

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
  const capital = createTile(seed, 0, 0, now, { terrain: 'capital', siteId: 'capital' });
  return {
    version: WORLD_MAP_VERSION,
    seed,
    origin: { q: 0, r: 0 },
    tiles: [{
      ...capital,
      id: CAPITAL_TILE_ID,
      terrain: 'capital',
      siteId: capital.siteId || 'capital',
      riverPorts: [],
      oceanTemplates: [],
      discovered: true,
      visible: true,
    }],
    scoutTrails: [],
  };
}

function getSeed(gameStateOrSeed) {
  if (typeof gameStateOrSeed === 'string' && gameStateOrSeed) return gameStateOrSeed;
  if (gameStateOrSeed?.worldMap?.seed) return gameStateOrSeed.worldMap.seed;
  return gameStateOrSeed?.playerId ? `world-${gameStateOrSeed.playerId}` : DEFAULT_WORLD_SEED;
}

function normalizeWorldMap(rawWorldMap, options = {}) {
  const seed = rawWorldMap?.seed || options.seed || DEFAULT_WORLD_SEED;
  const now = options.now || new Date();
  const tileMap = new Map();
  for (const rawTile of Array.isArray(rawWorldMap?.tiles) ? rawWorldMap.tiles : []) {
    const tile = normalizeTile(rawTile, seed, now);
    if (tile) tileMap.set(tile.id, tile);
  }
  if (!tileMap.has(CAPITAL_TILE_ID)) {
    tileMap.set(CAPITAL_TILE_ID, createTile(seed, 0, 0, now, { terrain: 'capital', siteId: 'capital' }));
  }
  const scoutTrails = (Array.isArray(rawWorldMap?.scoutTrails) ? rawWorldMap.scoutTrails : [])
    .map(normalizeScoutTrail)
    .filter(Boolean);
  return {
    version: WORLD_MAP_VERSION,
    seed,
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
  const tile = existing
    ? { ...existing, discovered: true, visible: true, ...overrides }
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
  const branchLimit = Math.max(0, toInteger(options.branchLimit, SCOUT_REVEAL_BRANCH_LIMIT));
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

  for (const step of normalizedRoute) {
    addCoord(step.q, step.r, step.step, 'main');
    if (step.step > branchLimit || !branchSides.length) continue;
    branchSides.forEach((side, sideIndex) => {
      const roll = random01(seed || DEFAULT_WORLD_SEED, step.q + side.q, step.r + side.r, `scout-branch-${direction}-${step.step}-${sideIndex}`);
      if (roll < 0.72) addCoord(step.q + side.q, step.r + side.r, step.step, 'branch');
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

function bindSiteToTile(gameState, q, r, siteId, now = new Date()) {
  return revealTile(gameState, q, r, now, { siteId });
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
  SCOUT_REVEAL_RADIUS,
  SCOUT_REVEAL_BRANCH_LIMIT,
  SIDE_ORDER,
  SIDE_DIRECTIONS,
  DIRECTION_VECTORS,
  getDistanceFromCapital,
  getWorldWaterFeatures,
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
