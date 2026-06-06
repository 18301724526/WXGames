const {
  CAPITAL_TILE_ID,
  START_SAFE_LAND_RADIUS,
  TERRAIN_TYPES,
  SIDE_DIRECTIONS,
  SIDE_ORDER,
} = require('./WorldMapConstants');
const {
  getDistanceFromCapital,
  getSortedSideKey,
  getTileId,
  normalizeTileIntel,
  normalizeTileVisibility,
  random01,
  toInteger,
} = require('./WorldMapShared');
const {
  chooseOceanTemplates,
  getRiverPorts,
} = require('./WorldMapWater');

function isStartSafeLandCoord(q, r) {
  return q !== 0 || r !== 0
    ? getDistanceFromCapital(q, r) <= START_SAFE_LAND_RADIUS
    : false;
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

function getTerrainTransitionKey(seed, q, r, terrain) {
  if (terrain !== 'plains' && terrain !== 'capital') return '';
  const desertSides = SIDE_ORDER.filter((side) => {
    const dir = SIDE_DIRECTIONS[side];
    return chooseBaseTerrain(seed, q + dir.q, r + dir.r) === 'desert';
  });
  return getSortedSideKey(desertSides);
}

function chooseTerrain(seed, q, r) {
  if (q === 0 && r === 0) return 'capital';
  if (isStartSafeLandCoord(q, r)) return chooseBaseTerrain(seed, q, r);
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
  if (isStartSafeLandCoord(tile.q, tile.r)) {
    const terrain = chooseBaseTerrain(seed, tile.q, tile.r);
    return {
      ...tile,
      terrain,
      riverPorts: [],
      oceanTemplates: [],
      transitionKey: tile.transitionKey || getTerrainTransitionKey(seed, tile.q, tile.r, terrain),
    };
  }
  const naturalOceanTemplates = chooseOceanTemplates(seed, tile.q, tile.r);
  const naturalRiverPorts = getRiverPorts(seed, tile.q, tile.r);
  const terrain = naturalOceanTemplates.length
    ? 'ocean'
    : naturalRiverPorts.length
      ? 'river'
      : chooseBaseTerrain(seed, tile.q, tile.r);
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
  const discovered = overrides.discovered !== undefined ? Boolean(overrides.discovered) : true;
  const controlled = Boolean(overrides.controlled || overrides.visibility === 'controlled' || overrides.siteId === 'capital');
  const visibility = normalizeTileVisibility(overrides.visibility, { discovered, controlled });
  const discoveredAt = overrides.discoveredAt || overrides.generatedAt || (discovered ? isoNow : null);
  const lastScoutedAt = overrides.lastScoutedAt || (visibility !== 'unknown' ? isoNow : null);
  return decorateTile({
    id: getTileId(q, r),
    q,
    r,
    terrain,
    discovered,
    visible: overrides.visible !== undefined ? Boolean(overrides.visible) : discovered,
    visibility,
    discoveredAt,
    lastScoutedAt,
    intel: normalizeTileIntel(overrides.intel, { visibility, discovered, controlled }),
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
    visibility: rawTile.visibility,
    discoveredAt: rawTile.discoveredAt,
    lastScoutedAt: rawTile.lastScoutedAt,
    intel: rawTile.intel,
    generatedAt: rawTile.generatedAt,
    riverPorts: rawTile.riverPorts,
    oceanTemplates: rawTile.oceanTemplates,
    transitionKey: rawTile.transitionKey,
    siteId: rawTile.siteId,
  });
}

module.exports = {
  chooseBaseTerrain,
  chooseTerrain,
  createTile,
  decorateTile,
  getTerrainTransitionKey,
  isStartSafeLandCoord,
  normalizeTile,
};
