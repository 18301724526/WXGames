const {
  DEFAULT_WORLD_HEIGHT,
  DEFAULT_WORLD_WIDTH,
  DEFAULT_WORLD_WRAPPING,
  WORLD_TOPOLOGY_VERSION,
} = require('./WorldMapConstants');

const { toInteger } = require('../../../shared/numberUtils');

const SCHEMA = 'world-map-topology-v1';
const COORDINATE_SYSTEM = 'diamond-isometric-square';

function toPositiveInteger(value, fallback = 1) {
  const number = toInteger(value, fallback);
  return number > 0 ? number : fallback;
}

function getTileId(q, r) {
  return `tile_${toInteger(q, 0)}_${toInteger(r, 0)}`;
}

function modulo(value, size) {
  const safeSize = toPositiveInteger(size, 1);
  return ((toInteger(value, 0) % safeSize) + safeSize) % safeSize;
}

function normalizeWorldSize(options = {}) {
  return {
    width: toPositiveInteger(options.width ?? options.worldWidth, DEFAULT_WORLD_WIDTH),
    height: toPositiveInteger(options.height ?? options.worldHeight, DEFAULT_WORLD_HEIGHT),
    wrapping: options.wrapping === undefined ? DEFAULT_WORLD_WRAPPING : options.wrapping !== false,
  };
}

function getCanonicalAxis(value, size, wrapping = true) {
  return wrapping ? modulo(value, size) : toInteger(value, 0);
}

function getCenteredAxis(value, size, wrapping = true) {
  const raw = toInteger(value, 0);
  if (!wrapping) return raw;
  const canonical = modulo(raw, size);
  return canonical > Math.floor(size / 2) ? canonical - size : canonical;
}

function normalizeCoord(coord = {}, options = {}) {
  const size = normalizeWorldSize(options);
  const q = toInteger(coord.q ?? coord.x ?? coord.col, 0);
  const r = toInteger(coord.r ?? coord.y ?? coord.row, 0);
  const worldQ = getCanonicalAxis(q, size.width, size.wrapping);
  const worldR = getCanonicalAxis(r, size.height, size.wrapping);
  const generationQ = getCenteredAxis(worldQ, size.width, size.wrapping);
  const generationR = getCenteredAxis(worldR, size.height, size.wrapping);
  return {
    q,
    r,
    x: q,
    y: r,
    tileId: getTileId(q, r),
    worldQ,
    worldR,
    generationQ,
    generationR,
    canonicalId: getTileId(worldQ, worldR),
    worldWidth: size.width,
    worldHeight: size.height,
    wrapped: size.wrapping,
  };
}

function getGenerationCoord(coord = {}, options = {}) {
  const normalized = normalizeCoord(coord, options);
  return {
    q: normalized.generationQ,
    r: normalized.generationR,
    x: normalized.generationQ,
    y: normalized.generationR,
    worldQ: normalized.worldQ,
    worldR: normalized.worldR,
    canonicalId: normalized.canonicalId,
  };
}

function getCanonicalTileId(q, r, options = {}) {
  return normalizeCoord({ q, r }, options).canonicalId;
}

function getTileCanonicalKey(tile = {}, options = {}) {
  if (typeof tile.canonicalId === 'string' && tile.canonicalId) return tile.canonicalId;
  return getCanonicalTileId(tile.q ?? tile.x, tile.r ?? tile.y, options);
}

function wrapDelta(delta, size) {
  const safeSize = toPositiveInteger(size, 1);
  const raw = toInteger(delta, 0);
  if (Math.abs(raw) * 2 <= safeSize) return raw;
  const wrapped = raw > 0 ? raw - safeSize : raw + safeSize;
  return Math.abs(wrapped) < Math.abs(raw) ? wrapped : raw;
}

function getDelta(from = {}, to = {}, options = {}) {
  const size = normalizeWorldSize(options);
  const start = normalizeCoord(from, size);
  const end = normalizeCoord(to, size);
  const rawQ = end.worldQ - start.worldQ;
  const rawR = end.worldR - start.worldR;
  return {
    q: size.wrapping ? wrapDelta(rawQ, size.width) : rawQ,
    r: size.wrapping ? wrapDelta(rawR, size.height) : rawR,
  };
}

function getWrappedDistance(from = {}, to = {}, options = {}) {
  const delta = getDelta(from, to, options);
  return Math.max(Math.abs(delta.q), Math.abs(delta.r));
}

function getDistanceFromCapital(q, r, options = {}) {
  return getWrappedDistance({ q: 0, r: 0 }, { q, r }, options);
}

function createWorldTopologyMetadata(options = {}) {
  const size = normalizeWorldSize(options);
  return {
    schema: SCHEMA,
    version: WORLD_TOPOLOGY_VERSION,
    coordinateSystem: COORDINATE_SYSTEM,
    width: size.width,
    height: size.height,
    wrapping: size.wrapping,
    canonicalTileId: 'worldQ/worldR',
    displayTileId: 'q/r',
  };
}

module.exports = {
  COORDINATE_SYSTEM,
  SCHEMA,
  WORLD_TOPOLOGY_VERSION,
  createWorldTopologyMetadata,
  getCanonicalTileId,
  getDelta,
  getDistanceFromCapital,
  getGenerationCoord,
  getTileCanonicalKey,
  getWrappedDistance,
  modulo,
  normalizeCoord,
  normalizeWorldSize,
  wrapDelta,
};
