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
  hashString,
  getTileId,
  normalizeTileIntel,
  normalizeTileVisibility,
  toInteger,
} = require('./WorldMapShared');
const WorldMapTopology = require('./WorldMapTopology');
const {
  roll01,
} = require('./WorldMapGenerationAuthority');
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
  const generation = WorldMapTopology.getGenerationCoord({ q, r });
  if (generation.q === 0 && generation.r === 0) return 'capital';
  const forest = roll01(seed, generation.q, generation.r, 'forest');
  const ridge = roll01(seed, generation.q, generation.r, 'ridge');
  const dry = roll01(seed, generation.q, generation.r, 'dry');
  const rough = roll01(seed, generation.q, generation.r, 'rough');
  const distance = getDistanceFromCapital(generation.q, generation.r);
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
  const generation = WorldMapTopology.getGenerationCoord({ q, r });
  const desertSides = SIDE_ORDER.filter((side) => {
    const dir = SIDE_DIRECTIONS[side];
    return chooseBaseTerrain(seed, generation.q + dir.q, generation.r + dir.r) === 'desert';
  });
  return getSortedSideKey(desertSides);
}

function resolveTransitionKey(tile, seed, q, r, terrain) {
  if (typeof tile?.transitionKey === 'string') return tile.transitionKey;
  return getTerrainTransitionKey(seed, q, r, terrain);
}

function chooseTerrain(seed, q, r) {
  const generation = WorldMapTopology.getGenerationCoord({ q, r });
  if (generation.q === 0 && generation.r === 0) return 'capital';
  if (isStartSafeLandCoord(generation.q, generation.r)) return chooseBaseTerrain(seed, generation.q, generation.r);
  if (chooseOceanTemplates(seed, generation.q, generation.r).length) return 'ocean';
  if (getRiverPorts(seed, generation.q, generation.r).length) return 'river';
  return chooseBaseTerrain(seed, generation.q, generation.r);
}

function normalizeGenerationContext(context = {}) {
  if (!context || typeof context !== 'object') return null;
  return {
    source: typeof context.source === 'string' ? context.source : '',
    mode: typeof context.mode === 'string' ? context.mode : '',
    direction: typeof context.direction === 'string' ? context.direction : '',
    eventEpoch: typeof context.eventEpoch === 'string' ? context.eventEpoch : String(context.eventEpoch || ''),
    nearbyStateHash: typeof context.nearbyStateHash === 'string' ? context.nearbyStateHash : String(context.nearbyStateHash || ''),
    origin: {
      q: toInteger(context.origin?.q ?? context.origin?.x, 0),
      r: toInteger(context.origin?.r ?? context.origin?.y, 0),
    },
    target: {
      q: toInteger(context.target?.q ?? context.target?.x, 0),
      r: toInteger(context.target?.r ?? context.target?.y, 0),
    },
    step: toInteger(context.step, 0),
  };
}

function getGenerationContextSalt(context = {}) {
  const normalized = normalizeGenerationContext(context);
  if (!normalized) return '';
  const meaningful = [
    normalized.source,
    normalized.mode,
    normalized.direction,
    normalized.eventEpoch,
    normalized.nearbyStateHash,
  ].some(Boolean);
  if (!meaningful) return '';
  return [
    normalized.source,
    normalized.mode,
    normalized.direction,
    normalized.eventEpoch,
    normalized.nearbyStateHash,
    normalized.origin.q,
    normalized.origin.r,
    normalized.target.q,
    normalized.target.r,
    normalized.step,
  ].join('|');
}

function chooseMaterializedTerrain(seed, q, r, generationContext = null) {
  const natural = chooseTerrain(seed, q, r);
  if (['capital', 'ocean', 'river'].includes(natural)) return natural;
  const salt = getGenerationContextSalt(generationContext);
  if (!salt) return natural;
  const generation = WorldMapTopology.getGenerationCoord({ q, r });
  const terrainPool = ['plains', 'forest', 'hills', 'mountain', 'waste', 'desert'];
  const baseIndex = Math.max(0, terrainPool.indexOf(natural));
  const shift = 1 + (hashString(`${seed}|${generation.q}|${generation.r}|${salt}|terrain`) % (terrainPool.length - 1));
  return terrainPool[(baseIndex + shift) % terrainPool.length];
}

function decorateTile(tile, seed) {
  const topology = WorldMapTopology.normalizeCoord(tile || {});
  const generationContext = tile?.generationContext && typeof tile.generationContext === 'object'
    ? { generationContext: { ...tile.generationContext } }
    : {};
  if (tile?.id === CAPITAL_TILE_ID || (topology.worldQ === 0 && topology.worldR === 0)) {
    return {
      ...tile,
      worldQ: topology.worldQ,
      worldR: topology.worldR,
      canonicalId: topology.canonicalId,
      terrain: 'capital',
      riverPorts: [],
      oceanTemplates: [],
      transitionKey: resolveTransitionKey(tile, seed, 0, 0, 'capital'),
      ...generationContext,
    };
  }
  const generation = WorldMapTopology.getGenerationCoord(tile);
  const authoritativeTerrain = TERRAIN_TYPES.includes(tile?.terrain) || tile?.terrain === 'capital' || tile?.terrain === 'ocean'
    ? tile.terrain
    : '';
  if (isStartSafeLandCoord(generation.q, generation.r)) {
    const terrain = authoritativeTerrain || chooseBaseTerrain(seed, generation.q, generation.r);
    return {
      ...tile,
      worldQ: topology.worldQ,
      worldR: topology.worldR,
      canonicalId: topology.canonicalId,
      terrain,
      riverPorts: [],
      oceanTemplates: [],
      transitionKey: resolveTransitionKey(tile, seed, generation.q, generation.r, terrain),
      ...generationContext,
    };
  }
  const naturalOceanTemplates = chooseOceanTemplates(seed, generation.q, generation.r);
  const naturalRiverPorts = getRiverPorts(seed, generation.q, generation.r);
  const terrain = authoritativeTerrain || (naturalOceanTemplates.length
    ? 'ocean'
    : naturalRiverPorts.length
      ? 'river'
      : chooseBaseTerrain(seed, generation.q, generation.r));
  const oceanTemplates = terrain === 'ocean' ? naturalOceanTemplates : [];
  const riverPorts = terrain === 'river' ? naturalRiverPorts : [];
  return {
    ...tile,
    worldQ: topology.worldQ,
    worldR: topology.worldR,
    canonicalId: topology.canonicalId,
    terrain,
    riverPorts,
    oceanTemplates,
    transitionKey: resolveTransitionKey(tile, seed, generation.q, generation.r, terrain),
    ...generationContext,
  };
}

function createTile(seed, q, r, now = new Date(), overrides = {}) {
  const isoNow = typeof now === 'string' ? now : now.toISOString();
  const topology = WorldMapTopology.normalizeCoord({ q, r });
  const terrain = overrides.terrain || chooseMaterializedTerrain(seed, q, r, overrides.generationContext);
  const discovered = overrides.discovered !== undefined ? Boolean(overrides.discovered) : true;
  const controlled = Boolean(overrides.controlled || overrides.visibility === 'controlled' || overrides.siteId === 'capital');
  const visibility = normalizeTileVisibility(overrides.visibility, { discovered, controlled });
  const discoveredAt = overrides.discoveredAt || overrides.generatedAt || (discovered ? isoNow : null);
  const lastScoutedAt = overrides.lastScoutedAt || (visibility !== 'unknown' ? isoNow : null);
  return decorateTile({
    id: getTileId(q, r),
    q,
    r,
    x: q,
    y: r,
    worldQ: topology.worldQ,
    worldR: topology.worldR,
    canonicalId: topology.canonicalId,
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
    ...(typeof overrides.transitionKey === 'string' ? { transitionKey: overrides.transitionKey } : {}),
    siteId: typeof overrides.siteId === 'string' && overrides.siteId ? overrides.siteId : null,
    ...(overrides.generationContext && typeof overrides.generationContext === 'object'
      ? { generationContext: { ...overrides.generationContext } }
      : {}),
  }, seed);
}

function normalizeTile(rawTile, seed, now = new Date()) {
  if (!rawTile || typeof rawTile !== 'object') return null;
  const q = toInteger(rawTile.q, 0);
  const r = toInteger(rawTile.r, 0);
  const topology = WorldMapTopology.normalizeCoord({ q, r });
  return createTile(seed, q, r, now, {
    canonicalId: rawTile.canonicalId || topology.canonicalId,
    worldQ: rawTile.worldQ ?? topology.worldQ,
    worldR: rawTile.worldR ?? topology.worldR,
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
    generationContext: rawTile.generationContext,
  });
}

module.exports = {
  chooseBaseTerrain,
  chooseMaterializedTerrain,
  chooseTerrain,
  createTile,
  decorateTile,
  getTerrainTransitionKey,
  isStartSafeLandCoord,
  normalizeTile,
};
