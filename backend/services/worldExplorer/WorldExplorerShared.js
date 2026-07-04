const WorldMapService = require('../WorldMapService');
const { hashString } = require('../../../shared/signatureHash');
const { toInteger } = require('../../../shared/numberUtils');
const { clone } = require('../../../shared/objectUtils');
// Single source: the manual-route cap lives in shared/worldMarchCore so the backend
// planner, the DTO, and the client-side march policy can never disagree.
const { MAX_MANUAL_ROUTE_LENGTH } = require('../../../shared/worldMarchCore');

const EXPLORE_STEP_DURATION_MS = 10 * 1000;
const MAX_ACTIVE_EXPLORE_MISSIONS = 1;
const EXPLORE_REVEAL_RADIUS = 1;
const TUTORIAL_FIRST_SITE_GRANT_KEY = 'firstExploreEmptyCity';

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

function getCoordinateKey(q, r) {
  return `${toInteger(q, 0)},${toInteger(r, 0)}`;
}

function getDistance(fromQ, fromR, toQ, toR) {
  return WorldMapService.getWrappedDistance(
    { q: toInteger(fromQ, 0), r: toInteger(fromR, 0) },
    { q: toInteger(toQ, 0), r: toInteger(toR, 0) },
  );
}

module.exports = {
  EXPLORE_STEP_DURATION_MS,
  MAX_MANUAL_ROUTE_LENGTH,
  MAX_ACTIVE_EXPLORE_MISSIONS,
  EXPLORE_REVEAL_RADIUS,
  TUTORIAL_FIRST_SITE_GRANT_KEY,
  clone,
  toInteger,
  toTimestamp,
  hashString,
  getCoordinateKey,
  getDistance,
};
