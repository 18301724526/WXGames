const {
  MAP_TERRAIN_TYPES,
  MIN_EXPEDITION_SOLDIERS,
  PLANNING_TERRAIN_BY_MAP_TERRAIN,
  SOLDIER_SCALE,
} = require('./TerritoryConstants');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function hasFiniteValue(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function normalizeSoldierScale(value, fallback = MIN_EXPEDITION_SOLDIERS) {
  const soldiers = toInteger(value, fallback);
  if (soldiers <= 0) return 0;
  return soldiers < MIN_EXPEDITION_SOLDIERS ? soldiers * SOLDIER_SCALE : soldiers;
}

function getDistance(x, y) {
  return Math.max(Math.abs(x), Math.abs(y));
}

function getRelativeDistance(fromX, fromY, toX, toY) {
  return Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY));
}

function getCoordinateKey(x, y) {
  return `${x},${y}`;
}

function normalizeMapTerrainId(value) {
  const terrain = String(value || '').trim();
  return MAP_TERRAIN_TYPES.has(terrain) ? terrain : null;
}

function getPlanningTerrainForMapTerrain(value, fallback = 'plains') {
  const mapTerrain = normalizeMapTerrainId(value);
  if (mapTerrain) return PLANNING_TERRAIN_BY_MAP_TERRAIN[mapTerrain] || fallback;
  const planningTerrain = String(value || '').trim();
  return ['plains', 'forest', 'hills', 'coast', 'river'].includes(planningTerrain)
    ? planningTerrain
    : fallback;
}

module.exports = {
  clone,
  getCoordinateKey,
  getDistance,
  getPlanningTerrainForMapTerrain,
  getRelativeDistance,
  hasFiniteValue,
  normalizeMapTerrainId,
  normalizeSoldierScale,
  toInteger,
};
