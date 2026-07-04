const WORLD_MAP_VERSION = 7;
const WORLD_TOPOLOGY_VERSION = 1;
const DEFAULT_WORLD_SEED = 'world-seed-v1';
const DEFAULT_WORLD_WIDTH = 1024;
const DEFAULT_WORLD_HEIGHT = 1024;
const DEFAULT_WORLD_WRAPPING = true;
const CAPITAL_TILE_ID = 'tile_0_0';
const START_REVEAL_RADIUS = 2;
const START_SAFE_LAND_RADIUS = 1;
const SCOUT_REVEAL_RADIUS = 1;
const SCOUT_REVEAL_MAIN_LIMIT = 3;
const SCOUT_REVEAL_BRANCH_LIMIT = 3;
const SCOUT_REVEAL_TILE_LIMIT = 6;
const WATER_FEATURE_CACHE_LIMIT = 64;
const HOME_RIVER_LENGTH = 7;
const RIVER_MOUTH_SCAN_RADIUS = 32;

const TERRAIN_TYPES = ['plains', 'forest', 'hills', 'mountain', 'waste', 'desert', 'river', 'ocean', 'shore'];
const TILE_VISIBILITY_LEVELS = ['unknown', 'hidden', 'hinted', 'scouted', 'controlled'];
const SIDE_ORDER = ['nw', 'ne', 'se', 'sw'];
const SIDE_DIRECTIONS = {
  nw: { q: -1, r: 0 },
  ne: { q: 0, r: -1 },
  se: { q: 1, r: 0 },
  sw: { q: 0, r: 1 },
};
const SIDE_OPPOSITES = {
  nw: 'se',
  ne: 'sw',
  se: 'nw',
  sw: 'ne',
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

module.exports = {
  CAPITAL_TILE_ID,
  DEFAULT_WORLD_SEED,
  DEFAULT_WORLD_HEIGHT,
  DEFAULT_WORLD_WIDTH,
  DEFAULT_WORLD_WRAPPING,
  DIRECTION_VECTORS,
  HOME_RIVER_LENGTH,
  OCEAN_CORNER_BY_CORE_OFFSET,
  OCEAN_SHORE_EDGE_BY_CORE_OFFSET,
  RIVER_MOUTH_SCAN_RADIUS,
  SCOUT_REVEAL_BRANCH_LIMIT,
  SCOUT_REVEAL_BRANCH_SIDES,
  SCOUT_REVEAL_MAIN_LIMIT,
  SCOUT_REVEAL_RADIUS,
  SCOUT_REVEAL_TILE_LIMIT,
  SIDE_DIRECTIONS,
  SIDE_OPPOSITES,
  SIDE_ORDER,
  START_REVEAL_RADIUS,
  START_SAFE_LAND_RADIUS,
  TERRAIN_TYPES,
  TILE_VISIBILITY_LEVELS,
  WATER_FEATURE_CACHE_LIMIT,
  WORLD_MAP_VERSION,
  WORLD_TOPOLOGY_VERSION,
};
