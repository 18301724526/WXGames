const WorldMapService = require('../WorldMapService');
const {
  DEFAULT_MIN_CAPITAL_DISTANCE,
  DEFAULT_TUTORIAL_RADIUS,
  DEFAULT_TUTORIAL_TARGET_MAX_DISTANCE,
  DEFAULT_TUTORIAL_TARGET_MIN_DISTANCE,
} = require('./SpawnConstants');

function toInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function getCoordinateKey(q, r) {
  return `${toInteger(q, 0)},${toInteger(r, 0)}`;
}

function normalizeCoord(coord = {}) {
  return {
    q: toInteger(coord.q ?? coord.x, 0),
    r: toInteger(coord.r ?? coord.y, 0),
  };
}

function normalizeOccupiedCoordinates(coordinates = []) {
  return (Array.isArray(coordinates) ? coordinates : [])
    .map(normalizeCoord)
    .filter((coord) => Number.isFinite(coord.q) && Number.isFinite(coord.r));
}

function getDistance(a = {}, b = {}) {
  return WorldMapService.getWrappedDistance(normalizeCoord(a), normalizeCoord(b));
}

function isBlockedTerrain(terrain) {
  return terrain === 'ocean' || terrain === 'river';
}

function chooseTerrain(seed, q, r) {
  return WorldMapService.chooseTerrain(seed || WorldMapService.DEFAULT_WORLD_SEED, q, r);
}

function getNearestDistance(candidate = {}, occupiedCoordinates = []) {
  if (!occupiedCoordinates.length) return Infinity;
  return occupiedCoordinates.reduce((best, occupied) => (
    Math.min(best, getDistance(candidate, occupied))
  ), Infinity);
}

function countCrowdedCoordinates(candidate = {}, occupiedCoordinates = [], radius = DEFAULT_MIN_CAPITAL_DISTANCE) {
  return occupiedCoordinates.filter((occupied) => getDistance(candidate, occupied) < radius).length;
}

function hasTutorialTarget(candidate = {}, options = {}) {
  return Boolean(findTutorialTarget(candidate, options));
}

function findTutorialTarget(candidate = {}, options = {}) {
  const seed = options.seed || WorldMapService.DEFAULT_WORLD_SEED;
  const occupied = new Set(normalizeOccupiedCoordinates(options.occupiedCoordinates)
    .map((coord) => getCoordinateKey(coord.q, coord.r)));
  const minDistance = Math.max(1, toInteger(options.tutorialTargetMinDistance, DEFAULT_TUTORIAL_TARGET_MIN_DISTANCE));
  const maxDistance = Math.max(minDistance, toInteger(options.tutorialTargetMaxDistance, DEFAULT_TUTORIAL_TARGET_MAX_DISTANCE));
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
  const tutorialRadius = Math.max(1, toInteger(options.tutorialRadius, DEFAULT_TUTORIAL_RADIUS));
  const terrain = chooseTerrain(seed, coord.q, coord.r);
  const nearestCapitalDistance = getNearestDistance(coord, occupiedCoordinates);
  const crowding = countCrowdedCoordinates(coord, occupiedCoordinates, minCapitalDistance);
  const tutorialTarget = findTutorialTarget(coord, {
    ...options,
    occupiedCoordinates,
    tutorialTargetMaxDistance: tutorialRadius,
  });
  const reasons = [];

  if (isBlockedTerrain(terrain)) reasons.push('BLOCKED_TERRAIN');
  if (nearestCapitalDistance < minCapitalDistance) reasons.push('TOO_CLOSE_TO_CAPITAL');
  if (!tutorialTarget) reasons.push('NO_TUTORIAL_TARGET');

  const valid = reasons.length === 0;
  const distanceScore = nearestCapitalDistance === Infinity
    ? minCapitalDistance * 20
    : Math.min(nearestCapitalDistance, minCapitalDistance * 3) * 20;
  const tutorialScore = tutorialTarget ? 80 - tutorialTarget.distance * 4 : -120;
  const crowdingPenalty = crowding * 100;
  const terrainPenalty = isBlockedTerrain(terrain) ? 1000 : 0;
  const score = distanceScore + tutorialScore - crowdingPenalty - terrainPenalty;

  return {
    ...coord,
    terrain,
    valid,
    score,
    reasons,
    nearestCapitalDistance,
    crowding,
    tutorialTarget,
  };
}

module.exports = {
  countCrowdedCoordinates,
  findTutorialTarget,
  getCoordinateKey,
  getDistance,
  getNearestDistance,
  hasTutorialTarget,
  isBlockedTerrain,
  normalizeCoord,
  normalizeOccupiedCoordinates,
  scoreSpawnCandidate,
};
