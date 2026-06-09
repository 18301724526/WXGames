const {
  DEFAULT_WORLD_SEED,
  SIDE_ORDER,
  TILE_VISIBILITY_LEVELS,
} = require('./WorldMapConstants');
const {
  hashString,
  roll01,
} = require('./WorldMapGenerationAuthority');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function random01(seed, q, r, salt) {
  return roll01(seed, q, r, salt);
}

function getTileId(q, r) {
  return `tile_${q}_${r}`;
}

function clampIntelLevel(value, fallback = 1) {
  const level = toInteger(value, fallback);
  return Math.max(0, Math.min(4, level));
}

function normalizeTileVisibility(value, options = {}) {
  if (options.controlled) return 'controlled';
  const visibility = typeof value === 'string' ? value : '';
  if (TILE_VISIBILITY_LEVELS.includes(visibility)) return visibility;
  return options.discovered === false ? 'unknown' : 'scouted';
}

function normalizeTileIntel(rawIntel, options = {}) {
  const raw = rawIntel && typeof rawIntel === 'object' ? rawIntel : {};
  const visibility = normalizeTileVisibility(options.visibility, options);
  const fallbackLevel = visibility === 'controlled'
    ? 4
    : visibility === 'unknown'
      ? 0
      : 1;
  const level = visibility === 'controlled' ? 4 : clampIntelLevel(raw.level, fallbackLevel);
  return {
    level,
    knownTerrain: Boolean(raw.knownTerrain ?? level >= 1),
    knownSite: Boolean(raw.knownSite ?? level >= 1),
    knownOwner: Boolean(raw.knownOwner ?? level >= 1),
    knownGarrison: visibility === 'controlled' ? true : Boolean(raw.knownGarrison ?? level >= 2),
    knownLeader: visibility === 'controlled' ? true : Boolean(raw.knownLeader ?? level >= 3),
    knownSkill: visibility === 'controlled' ? true : Boolean(raw.knownSkill ?? level >= 4),
  };
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

function getDistanceFromCapital(q, r) {
  return Math.max(Math.abs(q), Math.abs(r));
}

module.exports = {
  clampIntelLevel,
  clone,
  getDistanceFromCapital,
  getSortedSideKey,
  getTileId,
  hashString,
  normalizeSeedCoordArgs,
  normalizeTileIntel,
  normalizeTileVisibility,
  random01,
  toInteger,
};
