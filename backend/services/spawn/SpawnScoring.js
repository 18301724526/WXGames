const WorldMapService = require('../WorldMapService');
const {
  DEFAULT_MIN_CAPITAL_DISTANCE,
  DEFAULT_STARTER_TARGET_RADIUS,
  DEFAULT_STARTER_TARGET_MAX_DISTANCE,
  DEFAULT_STARTER_TARGET_MIN_DISTANCE,
} = require('./SpawnConstants');
const { toInteger } = require('../../../shared/numberUtils');

function getCoordinateKey(q, r) {
  return `${toInteger(q, 0)},${toInteger(r, 0)}`;
}

function normalizeCoord(coord = {}) {
  return {
    q: toInteger(coord.q ?? coord.x, 0),
    r: toInteger(coord.r ?? coord.y, 0),
  };
}

function normalizeOccupiedCoordinate(coord = {}) {
  return {
    ...normalizeCoord(coord),
    blocksTile: coord.blocksTile !== false,
    blocksDistance: coord.blocksDistance !== false,
  };
}

function normalizeOccupiedCoordinates(coordinates = []) {
  return (Array.isArray(coordinates) ? coordinates : [])
    .map(normalizeOccupiedCoordinate)
    .filter((coord) => Number.isFinite(coord.q) && Number.isFinite(coord.r));
}

function getDistance(a = {}, b = {}) {
  return WorldMapService.getWrappedDistance(normalizeCoord(a), normalizeCoord(b));
}

function isBlockedTerrain(terrain) {
  // 'shore' is marchable, but spawn points and starter targets conservatively
  // stay off the coastline (same footprint as before the shore terrain existed).
  return terrain === 'ocean' || terrain === 'river' || terrain === 'shore';
}

function chooseTerrain(seed, q, r) {
  return WorldMapService.chooseTerrain(seed || WorldMapService.DEFAULT_WORLD_SEED, q, r);
}

function getNearestDistance(candidate = {}, occupiedCoordinates = []) {
  const distanceBlockers = occupiedCoordinates.filter((coord) => coord.blocksDistance !== false);
  if (!distanceBlockers.length) return Infinity;
  return distanceBlockers.reduce((best, occupied) => (
    Math.min(best, getDistance(candidate, occupied))
  ), Infinity);
}

function countCrowdedCoordinates(candidate = {}, occupiedCoordinates = [], radius = DEFAULT_MIN_CAPITAL_DISTANCE) {
  return occupiedCoordinates
    .filter((occupied) => occupied.blocksDistance !== false)
    .filter((occupied) => getDistance(candidate, occupied) < radius).length;
}

function hasStarterTarget(candidate = {}, options = {}) {
  return Boolean(findStarterTarget(candidate, options));
}

function findStarterTarget(candidate = {}, options = {}) {
  const seed = options.seed || WorldMapService.DEFAULT_WORLD_SEED;
  const occupied = new Set(normalizeOccupiedCoordinates(options.occupiedCoordinates)
    .filter((coord) => coord.blocksTile !== false)
    .map((coord) => getCoordinateKey(coord.q, coord.r)));
  const minDistance = Math.max(1, toInteger(options.starterTargetMinDistance, DEFAULT_STARTER_TARGET_MIN_DISTANCE));
  const maxDistance = Math.max(minDistance, toInteger(options.starterTargetMaxDistance, DEFAULT_STARTER_TARGET_MAX_DISTANCE));
  const origin = normalizeCoord(candidate);
  const candidates = [];

  for (let q = origin.q - maxDistance; q <= origin.q + maxDistance; q += 1) {
    for (let r = origin.r - maxDistance; r <= origin.r + maxDistance; r += 1) {
      const coord = { q, r };
      const distance = getDistance(origin, coord);
      if (distance < minDistance || distance > maxDistance) continue;
      if (occupied.has(getCoordinateKey(q, r))) continue;
      const terrain = chooseTerrain(seed, q, r);
      if (isBlockedTerrain(terrain)) continue;
      candidates.push({
        q,
        r,
        distance,
        terrain,
        score: (maxDistance - distance) * 10,
      });
    }
  }

  return candidates.sort((a, b) => (
    b.score - a.score
    || a.distance - b.distance
    || a.q - b.q
    || a.r - b.r
  ))[0] || null;
}

function scoreSpawnCandidate(candidate = {}, options = {}) {
  const seed = options.seed || WorldMapService.DEFAULT_WORLD_SEED;
  const coord = normalizeCoord(candidate);
  const occupiedCoordinates = normalizeOccupiedCoordinates(options.occupiedCoordinates);
  const minCapitalDistance = Math.max(1, toInteger(options.minCapitalDistance, DEFAULT_MIN_CAPITAL_DISTANCE));
  const starterTargetRadius = Math.max(1, toInteger(options.starterTargetRadius, DEFAULT_STARTER_TARGET_RADIUS));
  const terrain = chooseTerrain(seed, coord.q, coord.r);
  const nearestCapitalDistance = getNearestDistance(coord, occupiedCoordinates);
  const crowding = countCrowdedCoordinates(coord, occupiedCoordinates, minCapitalDistance);
  const occupiedTiles = new Set(occupiedCoordinates
    .filter((occupied) => occupied.blocksTile !== false)
    .map((occupied) => getCoordinateKey(occupied.q, occupied.r)));
  const starterTarget = findStarterTarget(coord, {
    ...options,
    occupiedCoordinates,
    starterTargetMaxDistance: starterTargetRadius,
  });
  const reasons = [];

  if (isBlockedTerrain(terrain)) reasons.push('BLOCKED_TERRAIN');
  if (occupiedTiles.has(getCoordinateKey(coord.q, coord.r))) reasons.push('OCCUPIED_TILE');
  if (nearestCapitalDistance < minCapitalDistance) reasons.push('TOO_CLOSE_TO_CAPITAL');
  if (!starterTarget) reasons.push('NO_STARTER_TARGET');

  const valid = reasons.length === 0;
  const distanceScore = nearestCapitalDistance === Infinity
    ? minCapitalDistance * 20
    : Math.min(nearestCapitalDistance, minCapitalDistance * 3) * 20;
  const starterScore = starterTarget ? 80 - starterTarget.distance * 4 : -120;
  const crowdingPenalty = crowding * 100;
  const terrainPenalty = isBlockedTerrain(terrain) ? 1000 : 0;
  const score = distanceScore + starterScore - crowdingPenalty - terrainPenalty;

  return {
    ...coord,
    terrain,
    valid,
    score,
    reasons,
    nearestCapitalDistance,
    crowding,
    starterTarget,
  };
}

module.exports = {
  countCrowdedCoordinates,
  findStarterTarget,
  getCoordinateKey,
  getDistance,
  getNearestDistance,
  hasStarterTarget,
  isBlockedTerrain,
  normalizeOccupiedCoordinate,
  normalizeCoord,
  normalizeOccupiedCoordinates,
  scoreSpawnCandidate,
};
