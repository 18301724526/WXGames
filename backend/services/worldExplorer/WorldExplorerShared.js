const WorldMapService = require('../WorldMapService');

const EXPLORE_STEP_DURATION_MS = 10 * 1000;
const DEFAULT_RANDOM_ROUTE_LENGTH = 8;
const MAX_RANDOM_ROUTE_LENGTH = 16;
const MAX_MANUAL_ROUTE_LENGTH = 16;
const MAX_ACTIVE_EXPLORE_MISSIONS = 1;
const EXPLORE_REVEAL_RADIUS = 0;
const MAX_ROUTE_DISTANCE_FROM_ORIGIN = 32;
const TUTORIAL_FIRST_SITE_GRANT_KEY = 'firstExploreEmptyCity';
const NEIGHBOR_OFFSETS = Object.values(WorldMapService.DIRECTION_VECTORS);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function toTimestamp(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  if (value instanceof Date) {
    const stamp = value.getTime();
    return Number.isFinite(stamp) ? stamp : fallback;
  }
  if (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && /^-?\d+(\.\d+)?$/.test(value.trim()))) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.abs(number) < 1000000000000 ? number * 1000 : number;
  }
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
  return Math.max(
    Math.abs(toInteger(toQ, 0) - toInteger(fromQ, 0)),
    Math.abs(toInteger(toR, 0) - toInteger(fromR, 0)),
  );
}

module.exports = {
  EXPLORE_STEP_DURATION_MS,
  DEFAULT_RANDOM_ROUTE_LENGTH,
  MAX_RANDOM_ROUTE_LENGTH,
  MAX_MANUAL_ROUTE_LENGTH,
  MAX_ACTIVE_EXPLORE_MISSIONS,
  EXPLORE_REVEAL_RADIUS,
  MAX_ROUTE_DISTANCE_FROM_ORIGIN,
  TUTORIAL_FIRST_SITE_GRANT_KEY,
  NEIGHBOR_OFFSETS,
  clone,
  toInteger,
  toTimestamp,
  hashString,
  random01,
  getCoordinateKey,
  getDistance,
};
