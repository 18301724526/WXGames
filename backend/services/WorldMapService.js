const WORLD_MAP_VERSION = 2;
const DEFAULT_WORLD_SEED = 'world-seed-v1';
const CAPITAL_TILE_ID = 'tile_0_0';
const SCOUT_REVEAL_RADIUS = 1;
const SCOUT_REVEAL_BRANCH_LIMIT = 5;

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
// Offsets are from the full ocean tile to the neighboring river-mouth tile.
const RIVER_MOUTH_TEMPLATE_BY_OCEAN_NEIGHBOR_OFFSET = {
  '0,1': 'river-mouth-ne',
  '0,-1': 'river-mouth-sw',
  '1,0': 'river-mouth-nw',
  '-1,0': 'river-mouth-se',
};
const OCEAN_CORNER_BY_CORE_OFFSET = {
  '1,1': 'corner-n',
  '-1,1': 'corner-e',
  '-1,-1': 'corner-s',
  '1,-1': 'corner-w',
};
const HOME_RIVER_LENGTH = 7;
const RIVER_MOUTH_SCAN_RADIUS = 32;
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

function getBoxBasinScore(q, r, centerQ, centerR, radiusQ, radiusR) {
  const qRatio = Math.abs(q - centerQ) / radiusQ;
  const rRatio = Math.abs(r - centerR) / radiusR;
  return 1 - Math.max(qRatio, rRatio);
}

function getWesternOceanBasinScore(q, r) {
  if (q > -3) return -1;
  const minR = Math.max(1, q + 6);
  const maxR = Math.max(4, -q - 1);
  const qFalloff = Math.max(0, (-3 - q) * 0.08);
  if (r >= minR && r <= maxR) return 0.5 + qFalloff;
  return -Math.min(Math.abs(r - minR), Math.abs(r - maxR));
}

function getEasternOceanBasinScore(q, r) {
  const withinColumn = q >= 4 && q <= 6;
  if (!withinColumn || r < -4 || r > 0) return -1;
  const maxR = q === 4 ? 0 : -1;
  const minR = q >= 6 ? -3 : -4;
  if (r < minR || r > maxR) return -1;
  const qScore = 1 - Math.abs(q - 4.5) / 2.5;
  const rScore = 1 - Math.abs(r + 1.5) / 3.5;
  return Math.min(qScore, rScore);
}

function getOceanBasinScore(seed, q, r) {
  const nearBay = getBoxBasinScore(q, r, 1.5, 0, 0.75, 1.15);
  const easternBay = getEasternOceanBasinScore(q, r);
  const westernSea = getWesternOceanBasinScore(q, r);
  const wildCoastNoise = (random01(seed, q, r, 'ocean-basin') - 0.5) * 0.12;
  return Math.max(nearBay, easternBay, westernSea + wildCoastNoise);
}

function isOceanCoreCoord(seedOrQ, qOrR, rValue) {
  const { seed, q, r } = normalizeSeedCoordArgs(seedOrQ, qOrR, rValue);
  if (q === 0 && r === 0) return false;
  return getOceanBasinScore(seed, q, r) >= 0;
}

function getAdjacentOceanSides(seed, q, r) {
  const sides = new Set();
  for (const [offsetKey, side] of Object.entries(OCEAN_SHORE_EDGE_BY_CORE_OFFSET)) {
    const [dq, dr] = offsetKey.split(',').map(Number);
    if (isOceanCoreCoord(seed, q + dq, r + dr)) sides.add(side);
  }
  return SIDE_ORDER.filter((side) => sides.has(side));
}

function getAdjacentOceanCorners(seed, q, r) {
  const corners = [];
  for (const [offsetKey, corner] of Object.entries(OCEAN_CORNER_BY_CORE_OFFSET)) {
    const [dq, dr] = offsetKey.split(',').map(Number);
    if (isOceanCoreCoord(seed, q + dq, r + dr)) corners.push(corner);
  }
  return corners;
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
  return RIVER_MOUTH_TEMPLATE_BY_OCEAN_NEIGHBOR_OFFSET[`${toInteger(qOffset)},${toInteger(rOffset)}`] || '';
}

function getHomeRiverChannel(seed) {
  const easternBayCenterQ = 4.5;
  const riverQ = Math.floor(easternBayCenterQ);
  const lengthBonus = Math.floor(random01(seed, riverQ, 0, 'home-river-length') * 3);
  return {
    q: riverQ,
    oceanSide: 'ne',
    inlandSide: 'sw',
    length: HOME_RIVER_LENGTH + lengthBonus,
  };
}

function findRiverMouth(seed, channel) {
  const oceanDir = SIDE_DIRECTIONS[channel.oceanSide];
  if (!oceanDir) return null;
  for (let r = -RIVER_MOUTH_SCAN_RADIUS; r <= RIVER_MOUTH_SCAN_RADIUS; r += 1) {
    if (isOceanCoreCoord(seed, channel.q, r)) continue;
    if (isOceanShoreCornerCoord(seed, channel.q, r)) continue;
    if (isOceanCoreCoord(seed, channel.q + oceanDir.q, r + oceanDir.r)) {
      return { q: channel.q, r };
    }
  }
  return null;
}

function getGeneratedRiverPorts(seed, q, r) {
  const channel = getHomeRiverChannel(seed);
  if (q !== channel.q) return [];
  const mouth = findRiverMouth(seed, channel);
  if (!mouth) return [];
  if (r < mouth.r || r >= mouth.r + channel.length) return [];
  const ports = [];
  if (r > mouth.r || r === mouth.r) ports.push(channel.oceanSide);
  if (r < mouth.r + channel.length - 1) ports.push(channel.inlandSide);
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
  DIRECTION_VECTORS,
  getDistanceFromCapital,
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
