const WORLD_MAP_VERSION = 1;
const DEFAULT_WORLD_SEED = 'world-seed-v1';
const CAPITAL_TILE_ID = 'tile_0_0';

const TERRAIN_TYPES = ['plains', 'forest', 'hills', 'mountain', 'waste', 'desert'];
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

function chooseTerrain(seed, q, r) {
  if (q === 0 && r === 0) return 'capital';
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

function createTile(seed, q, r, now = new Date(), overrides = {}) {
  const isoNow = typeof now === 'string' ? now : now.toISOString();
  return {
    id: getTileId(q, r),
    q,
    r,
    terrain: overrides.terrain || chooseTerrain(seed, q, r),
    discovered: overrides.discovered !== undefined ? Boolean(overrides.discovered) : true,
    visible: overrides.visible !== undefined ? Boolean(overrides.visible) : true,
    generatedAt: overrides.generatedAt || isoNow,
    riverPorts: Array.isArray(overrides.riverPorts) ? [...overrides.riverPorts] : [],
    oceanTemplates: Array.isArray(overrides.oceanTemplates) ? [...overrides.oceanTemplates] : [],
    transitionKey: typeof overrides.transitionKey === 'string' ? overrides.transitionKey : '',
    siteId: typeof overrides.siteId === 'string' && overrides.siteId ? overrides.siteId : null,
  };
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
  return {
    version: WORLD_MAP_VERSION,
    seed,
    origin: { q: 0, r: 0 },
    tiles: [createTile(seed, 0, 0, now, { terrain: 'capital', siteId: 'capital' })],
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
