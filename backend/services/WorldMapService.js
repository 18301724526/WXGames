const WORLD_MAP_VERSION = 2;
const DEFAULT_WORLD_SEED = 'world-seed-v1';
const CAPITAL_TILE_ID = 'tile_0_0';

const TERRAIN_TYPES = ['plains', 'forest', 'hills', 'mountain', 'waste', 'desert', 'river', 'ocean'];
const SIDE_ORDER = ['nw', 'ne', 'se', 'sw'];
const SIDE_DIRECTIONS = {
  nw: { q: -1, r: 0 },
  ne: { q: 0, r: -1 },
  se: { q: 1, r: 0 },
  sw: { q: 0, r: 1 },
};
const MICRO_BOOTSTRAP_BOUNDS = {
  minQ: -6,
  maxQ: 5,
  minR: -2,
  maxR: 5,
};
const MICRO_TERRAIN_OVERRIDES = new Map([
  ['tile_-4_-1', 'desert'],
  ['tile_-4_0', 'desert'],
  ['tile_-3_-1', 'desert'],
  ['tile_-3_0', 'desert'],
  ['tile_-2_-1', 'desert'],
  ['tile_-2_0', 'desert'],
  ['tile_-1_-1', 'desert'],
]);
const OCEAN_CORE_TILE_IDS = new Set([
  'tile_-6_1', 'tile_-6_2', 'tile_-6_3', 'tile_-6_4', 'tile_-6_5',
  'tile_-5_1', 'tile_-5_2', 'tile_-5_3', 'tile_-5_4',
  'tile_-4_2', 'tile_-4_3', 'tile_-4_4',
  'tile_-3_3', 'tile_-3_4',
  'tile_1_-1', 'tile_2_-1',
  'tile_1_0', 'tile_2_0',
  'tile_1_1', 'tile_2_1',
  'tile_4_-2', 'tile_5_-2',
  'tile_4_-1', 'tile_5_-1',
  'tile_4_0',
]);
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
const RIVER_PORTS_BY_TILE_ID = new Map([
  ['tile_4_2', ['ne', 'sw']],
  ['tile_4_1', ['ne', 'sw']],
]);
const RIVER_MOUTH_BY_TILE_ID = new Map([
  ['tile_4_1', 'river-mouth-sw'],
]);
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

function isOceanCoreCoord(q, r) {
  return OCEAN_CORE_TILE_IDS.has(getTileId(q, r));
}

function getAdjacentOceanSides(q, r) {
  const sides = new Set();
  for (const [offsetKey, side] of Object.entries(OCEAN_SHORE_EDGE_BY_CORE_OFFSET)) {
    const [dq, dr] = offsetKey.split(',').map(Number);
    if (isOceanCoreCoord(q + dq, r + dr)) sides.add(side);
  }
  return SIDE_ORDER.filter((side) => sides.has(side));
}

function getAdjacentOceanCorners(q, r) {
  const corners = [];
  for (const [offsetKey, corner] of Object.entries(OCEAN_CORNER_BY_CORE_OFFSET)) {
    const [dq, dr] = offsetKey.split(',').map(Number);
    if (isOceanCoreCoord(q + dq, r + dr)) corners.push(corner);
  }
  return corners;
}

function isOceanShoreCornerCoord(q, r) {
  return !isOceanCoreCoord(q, r) && getAdjacentOceanCorners(q, r).length > 0;
}

function getOceanShoreEdgeTemplateKeys(sides = []) {
  const key = getSortedSideKey(sides);
  const comboKeys = new Set(['nw-ne', 'ne-se', 'se-sw', 'nw-sw']);
  if (comboKeys.has(key)) return [key];
  return SIDE_ORDER.filter((side) => sides.includes(side));
}

function chooseOceanTemplates(q, r) {
  if (q === 0 && r === 0) return [];
  const tileId = getTileId(q, r);
  if (isOceanCoreCoord(q, r)) return ['full'];
  const sides = getAdjacentOceanSides(q, r);
  const blocksRiverMouth = isOceanShoreCornerCoord(q, r);
  const edgeKeys = getOceanShoreEdgeTemplateKeys(sides).map((key) => (
    !blocksRiverMouth && RIVER_MOUTH_BY_TILE_ID.get(tileId) && sides.length === 1 ? RIVER_MOUTH_BY_TILE_ID.get(tileId) : key
  ));
  return [
    ...edgeKeys,
    ...getAdjacentOceanCorners(q, r),
  ];
}

function getRiverPorts(q, r) {
  if (q === 0 && r === 0) return [];
  return RIVER_PORTS_BY_TILE_ID.get(getTileId(q, r)) || [];
}

function getTerrainTransitionKey(seed, q, r, terrain) {
  if (terrain !== 'plains' && terrain !== 'capital') return '';
  const desertSides = SIDE_ORDER.filter((side) => {
    const dir = SIDE_DIRECTIONS[side];
    return chooseBaseTerrain(seed, q + dir.q, r + dir.r) === 'desert';
  });
  return getSortedSideKey(desertSides);
}

function chooseBaseTerrain(seed, q, r) {
  const override = MICRO_TERRAIN_OVERRIDES.get(getTileId(q, r));
  if (override) return override;
  if (q === 0 && r === 0) return 'capital';
  if (q <= -3 && r <= 0) return 'desert';
  if (q <= -1 && r >= -1 && r <= 1) return 'plains';
  if (q <= 0 && r >= 2) return 'forest';
  if (q >= 1 && r <= -2) return 'hills';
  if (q >= 1 && r >= 1 && r <= 2) return 'plains';
  if (q >= 2 && r <= 0) return 'mountain';
  const forest = random01(seed, q, r, 'forest');
  const stone = random01(seed, q, r, 'stone');
  const dry = random01(seed, q, r, 'dry');
  const mountain = random01(seed, q, r, 'mountain');
  if (mountain > 0.88) return 'mountain';
  if (stone > 0.82) return 'hills';
  if (forest > 0.7) return 'forest';
  if (dry > 0.84) return 'waste';
  if (dry > 0.78 && forest < 0.36) return 'desert';
  return 'plains';
}

function chooseTerrain(seed, q, r) {
  if (q === 0 && r === 0) return 'capital';
  if (chooseOceanTemplates(q, r).length) return 'ocean';
  if (getRiverPorts(q, r).length) return 'river';
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
  const naturalOceanTemplates = chooseOceanTemplates(tile.q, tile.r);
  const naturalRiverPorts = getRiverPorts(tile.q, tile.r);
  const terrain = naturalOceanTemplates.length
    ? 'ocean'
    : naturalRiverPorts.length
      ? 'river'
      : tile.terrain;
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

function applyMicroTerrainBootstrap(tileMap, seed, now = new Date()) {
  for (let q = MICRO_BOOTSTRAP_BOUNDS.minQ; q <= MICRO_BOOTSTRAP_BOUNDS.maxQ; q += 1) {
    for (let r = MICRO_BOOTSTRAP_BOUNDS.minR; r <= MICRO_BOOTSTRAP_BOUNDS.maxR; r += 1) {
      const terrain = chooseTerrain(seed, q, r);
      const oceanTemplates = chooseOceanTemplates(q, r);
      const riverPorts = getRiverPorts(q, r);
      const id = getTileId(q, r);
      const existing = tileMap.get(id);
      tileMap.set(id, {
        ...(existing || createTile(seed, q, r, now)),
        terrain,
        oceanTemplates,
        riverPorts,
        transitionKey: getTerrainTransitionKey(seed, q, r, terrain),
        discovered: existing?.discovered !== false,
        visible: existing?.visible !== false,
      });
    }
  }
}

function createInitialWorldMap(seed = DEFAULT_WORLD_SEED, now = new Date()) {
  const tileMap = new Map();
  applyMicroTerrainBootstrap(tileMap, seed, now);
  const capital = tileMap.get(CAPITAL_TILE_ID) || createTile(seed, 0, 0, now, { terrain: 'capital', siteId: 'capital' });
  tileMap.set(CAPITAL_TILE_ID, {
    ...capital,
    terrain: 'capital',
    siteId: capital.siteId || 'capital',
    riverPorts: [],
    oceanTemplates: [],
    discovered: true,
    visible: true,
  });
  return {
    version: WORLD_MAP_VERSION,
    seed,
    origin: { q: 0, r: 0 },
    tiles: [...tileMap.values()].sort((a, b) => Math.max(Math.abs(a.q), Math.abs(a.r)) - Math.max(Math.abs(b.q), Math.abs(b.r)) || a.q - b.q || a.r - b.r),
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
  const incomingVersion = toInteger(rawWorldMap?.version, 0);
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
  const shouldBootstrapTerrain = incomingVersion < WORLD_MAP_VERSION
    || !tileMap.has('tile_1_0')
    || !tileMap.has('tile_4_1')
    || !tileMap.has('tile_4_2');
  if (shouldBootstrapTerrain) applyMicroTerrainBootstrap(tileMap, seed, now);
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

function bindSiteToTile(gameState, q, r, siteId, now = new Date()) {
  return revealTile(gameState, q, r, now, { siteId });
}

function getDirectionVector(direction) {
  return DIRECTION_VECTORS[direction] || null;
}

function buildScoutRoute(origin, direction, actionPoints) {
  const vector = getDirectionVector(direction);
  if (!vector) return [];
  const startQ = toInteger(origin?.q ?? origin?.x, 0);
  const startR = toInteger(origin?.r ?? origin?.y, 0);
  const steps = Math.max(0, toInteger(actionPoints, 0));
  const route = [];
  for (let step = 1; step <= steps; step += 1) {
    route.push({
      q: startQ + vector.q * step,
      r: startR + vector.r * step,
      step,
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
  DIRECTION_VECTORS,
  getTileId,
  chooseTerrain,
  chooseOceanTemplates,
  getRiverPorts,
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
