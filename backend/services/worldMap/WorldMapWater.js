const {
  DEFAULT_WORLD_SEED,
  HOME_RIVER_LENGTH,
  OCEAN_CORNER_BY_CORE_OFFSET,
  OCEAN_SHORE_EDGE_BY_CORE_OFFSET,
  RIVER_MOUTH_SCAN_RADIUS,
  SIDE_DIRECTIONS,
  SIDE_OPPOSITES,
  SIDE_ORDER,
  WATER_FEATURE_CACHE_LIMIT,
} = require('./WorldMapConstants');
const {
  getDistanceFromCapital,
  getSortedSideKey,
  normalizeSeedCoordArgs,
  toInteger,
} = require('./WorldMapShared');
const {
  roll01,
} = require('./WorldMapGenerationAuthority');

const WORLD_WATER_FEATURE_CACHE = new Map();

function rotateSide(side, steps) {
  const index = SIDE_ORDER.indexOf(side);
  if (index < 0) return SIDE_ORDER[0];
  return SIDE_ORDER[(index + steps + SIDE_ORDER.length * 4) % SIDE_ORDER.length];
}

function pickSide(seed, salt) {
  return SIDE_ORDER[Math.floor(roll01(seed, 0, 0, salt) * SIDE_ORDER.length) % SIDE_ORDER.length];
}

function createOceanBasin(seed, id, side, options = {}) {
  const main = SIDE_DIRECTIONS[side] || SIDE_DIRECTIONS.ne;
  const lateralSide = rotateSide(side, options.lateralTurn || 1);
  const lateral = SIDE_DIRECTIONS[lateralSide] || SIDE_DIRECTIONS.se;
  const coastDistance = (options.baseDistance || 4)
    + Math.floor(roll01(seed, id, 0, `ocean-${id}-distance`) * (options.distanceSpread || 3));
  const lateralOffset = Math.floor(roll01(seed, id, 1, `ocean-${id}-lateral`) * 5) - 2;
  const lateralRadius = (options.baseRadius || 2)
    + Math.floor(roll01(seed, id, 2, `ocean-${id}-radius`) * (options.radiusSpread || 3));
  const coastJitter = options.coastJitter || 3;
  const openCenterDistance = coastDistance + Math.ceil(coastJitter / 2);
  return {
    id,
    side,
    coastDistance,
    lateralSide,
    lateralCenter: lateralOffset,
    lateralRadius,
    lateralGrowthEvery: options.lateralGrowthEvery || 7,
    maxLateralGrowth: options.maxLateralGrowth || 8,
    coastJitter,
    centerQ: main.q * openCenterDistance + lateral.q * lateralOffset,
    centerR: main.r * openCenterDistance + lateral.r * lateralOffset,
  };
}

function buildOceanBasins(seed) {
  const primarySide = pickSide(seed, 'primary-ocean-side');
  const secondarySide = SIDE_OPPOSITES[primarySide] || rotateSide(primarySide, 2);
  const tertiarySide = rotateSide(primarySide, roll01(seed, 0, 0, 'tertiary-ocean-turn') < 0.5 ? 1 : -1);
  return [
    createOceanBasin(seed, 'primary', primarySide, { baseDistance: 22, distanceSpread: 4, baseRadius: 2, radiusSpread: 3, coastJitter: 4 }),
    createOceanBasin(seed, 'secondary', secondarySide, { baseDistance: 27, distanceSpread: 5, baseRadius: 3, radiusSpread: 4, lateralTurn: -1, coastJitter: 5 }),
    createOceanBasin(seed, 'tertiary', tertiarySide, { baseDistance: 31, distanceSpread: 4, baseRadius: 3, radiusSpread: 5, coastJitter: 5 }),
  ];
}

function getProjection(q, r, side) {
  const dir = SIDE_DIRECTIONS[side] || SIDE_DIRECTIONS.ne;
  return q * dir.q + r * dir.r;
}

function getOpenOceanCoastDistance(seed, basin, lateralProjection) {
  const jitter = Math.max(0, toInteger(basin.coastJitter, 0));
  if (!jitter) return basin.coastDistance;
  const coastRoll = roll01(seed, basin.id, lateralProjection, 'open-ocean-coast');
  return basin.coastDistance + Math.round((coastRoll - 0.5) * jitter);
}

function getOpenOceanLateralRadius(basin, depth) {
  const growthEvery = Math.max(1, toInteger(basin.lateralGrowthEvery, 7));
  const maxGrowth = Math.max(0, toInteger(basin.maxLateralGrowth, 8));
  const growth = Math.min(maxGrowth, Math.floor(Math.max(0, depth) / growthEvery));
  return Math.max(0, toInteger(basin.lateralRadius, 0)) + growth;
}

function getOpenOceanBasinScore(seed, q, r, basin) {
  if (!basin || !SIDE_DIRECTIONS[basin.side]) return -1;
  const mainProjection = getProjection(q, r, basin.side);
  const lateralProjection = getProjection(q, r, basin.lateralSide);
  const coastDistance = getOpenOceanCoastDistance(seed, basin, lateralProjection);
  const depth = mainProjection - coastDistance;
  const lateralRadius = getOpenOceanLateralRadius(basin, depth);
  const lateralScore = lateralRadius - Math.abs(lateralProjection - basin.lateralCenter);
  return Math.min(depth, lateralScore);
}

function getOceanBasinScoreForBasins(seed, q, r, basins) {
  return (Array.isArray(basins) ? basins : []).reduce((best, basin) => {
    return Math.max(best, getOpenOceanBasinScore(seed, q, r, basin));
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
  return HOME_RIVER_LENGTH + Math.floor(roll01(seed, 0, 0, 'home-river-length') * 3);
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
      const stableNoise = roll01(seed, q, r, `river-channel-${oceanSide}`);
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

module.exports = {
  buildOceanBasins,
  buildWorldWaterFeatures,
  chooseOceanTemplates,
  getAdjacentOceanCorners,
  getAdjacentOceanSides,
  getOceanBasinScore,
  getRiverMouthTemplateForNeighborOfOcean,
  getRiverPorts,
  getWorldWaterFeatures,
  isOceanCoreCoord,
};
