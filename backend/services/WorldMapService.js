const {
  CAPITAL_TILE_ID,
  DEFAULT_WORLD_SEED,
  DEFAULT_WORLD_HEIGHT,
  DEFAULT_WORLD_WIDTH,
  DEFAULT_WORLD_WRAPPING,
  DIRECTION_VECTORS,
  SCOUT_REVEAL_RADIUS,
  SIDE_DIRECTIONS,
  SIDE_ORDER,
  START_REVEAL_RADIUS,
  START_SAFE_LAND_RADIUS,
  WORLD_MAP_VERSION,
  WORLD_TOPOLOGY_VERSION,
} = require('./worldMap/WorldMapConstants');
const { getSpawnOrigin } = require('./spawn/SpawnAssignment');
const {
  clone,
  getCanonicalTileId,
  getDistanceFromCapital,
  getTileId,
  toInteger,
} = require('./worldMap/WorldMapShared');
const WorldMapTopology = require('./worldMap/WorldMapTopology');
const {
  compareTiles,
  createWorldMapBatch,
  mergeTiles,
} = require('./worldMap/WorldMapBatch');
const {
  createWorldMapGenerationMetadata,
} = require('./worldMap/WorldMapGenerationAuthority');
const {
  chooseOceanTemplates,
  getRiverMouthTemplateForNeighborOfOcean,
  getRiverPorts,
  getWorldWaterFeatures,
} = require('./worldMap/WorldMapWater');
const {
  chooseBaseTerrain,
  chooseTerrain,
  createTile,
  isStartSafeLandCoord,
  isWaterFamilyTerrain,
  normalizeTile,
} = require('./worldMap/WorldMapTiles');
const VisionHistory = require('./worldMap/WorldMapVisionHistory');

function createInitialWorldMap(seed = DEFAULT_WORLD_SEED, now = new Date(), options = {}) {
  const origin = getSpawnOrigin(options.spawn || options.origin || {});
  const tiles = getRevealArea(origin.q, origin.r, START_REVEAL_RADIUS).map((coord) => {
    const isCapital = coord.q === origin.q && coord.r === origin.r;
    return createTile(seed, coord.q, coord.r, now, {
      terrain: isCapital ? 'capital' : undefined,
      siteId: isCapital ? 'capital' : null,
      visibility: isCapital ? 'controlled' : 'scouted',
      controlled: isCapital,
    });
  });
  return {
    version: WORLD_MAP_VERSION,
    seed,
    generationAuthority: createWorldMapGenerationMetadata(seed),
    topology: WorldMapTopology.createWorldTopologyMetadata(),
    origin: { q: origin.q, r: origin.r },
    tiles,
    visionHistory: VisionHistory.normalizeHistory({
      sources: [{ kind: 'city', q: origin.q, r: origin.r, revealedAt: typeof now === 'string' ? now : now.toISOString() }],
    }),
  };
}

function ensureStartingArea(tileMap, seed, now = new Date(), options = {}) {
  const origin = getSpawnOrigin(options.spawn || options.origin || {});
  for (const coord of getRevealArea(origin.q, origin.r, START_REVEAL_RADIUS)) {
    const canonicalId = getCanonicalTileId(coord.q, coord.r);
    const existing = tileMap.get(canonicalId);
    const isCapital = coord.q === origin.q && coord.r === origin.r;
    if (existing) {
      if (isCapital) {
        tileMap.set(canonicalId, normalizeTile({
          ...existing,
          terrain: 'capital',
          siteId: 'capital',
          visibility: 'controlled',
          discovered: true,
          visible: true,
        }, seed, now));
      }
      continue;
    }
    tileMap.set(canonicalId, createTile(seed, coord.q, coord.r, now, {
      terrain: isCapital ? 'capital' : undefined,
      siteId: isCapital ? 'capital' : null,
      visibility: isCapital ? 'controlled' : 'scouted',
      controlled: isCapital,
    }));
  }
  return tileMap;
}

function getSeed(gameStateOrSeed) {
  if (typeof gameStateOrSeed === 'string' && gameStateOrSeed) return gameStateOrSeed;
  const existingSeed = typeof gameStateOrSeed?.worldMap?.seed === 'string' ? gameStateOrSeed.worldMap.seed : '';
  if (existingSeed && existingSeed !== `world-${gameStateOrSeed?.playerId || ''}`) return existingSeed;
  return DEFAULT_WORLD_SEED;
}

function getWorldMapVersion(rawWorldMap) {
  return Math.max(0, toInteger(rawWorldMap?.version, 0));
}

function normalizeWorldMap(rawWorldMap, options = {}) {
  const seed = options.seed || rawWorldMap?.seed || DEFAULT_WORLD_SEED;
  const now = options.now || new Date();
  const origin = getSpawnOrigin(options.spawn || options.origin || rawWorldMap?.origin || {});
  const tileMap = new Map();
  for (const rawTile of Array.isArray(rawWorldMap?.tiles) ? rawWorldMap.tiles : []) {
    const tile = normalizeTile(rawTile, seed, now);
    if (tile) {
      const canonicalKey = WorldMapTopology.getTileCanonicalKey(tile);
      tileMap.set(canonicalKey, mergeTiles(tileMap.get(canonicalKey), tile, seed, now));
    }
  }
  ensureStartingArea(tileMap, seed, now, { origin });
  const visionHistory = VisionHistory.normalizeHistory(rawWorldMap?.visionHistory || rawWorldMap?.visionHistorySources);
  if (!visionHistory.sources.some((source) => source.kind === 'city' && source.q === origin.q && source.r === origin.r)) {
    visionHistory.sources.push({ kind: 'city', q: origin.q, r: origin.r, tileId: getTileId(origin.q, origin.r), revealedAt: null });
  }
  return {
    version: WORLD_MAP_VERSION,
    seed,
    generationAuthority: createWorldMapGenerationMetadata(seed),
    topology: WorldMapTopology.createWorldTopologyMetadata(rawWorldMap?.topology),
    origin: {
      q: origin.q,
      r: origin.r,
    },
    tiles: [...tileMap.values()].sort(compareTiles),
    visionHistory: VisionHistory.normalizeHistory(visionHistory),
  };
}

function ensureWorldMap(gameState, now = new Date()) {
  const seed = getSeed(gameState);
  gameState.worldMap = normalizeWorldMap(gameState.worldMap, { seed, now, origin: gameState.worldMap?.origin });
  return gameState.worldMap;
}

function getTile(worldMap, q, r) {
  const canonicalId = getCanonicalTileId(q, r);
  return (worldMap?.tiles || []).find((tile) => (
    WorldMapTopology.getTileCanonicalKey(tile) === canonicalId
    || tile.q === q && tile.r === r
  )) || null;
}

function upsertTile(worldMap, tile) {
  const canonicalId = WorldMapTopology.getTileCanonicalKey(tile);
  const index = worldMap.tiles.findIndex((item) => WorldMapTopology.getTileCanonicalKey(item) === canonicalId);
  if (index >= 0) worldMap.tiles[index] = mergeTiles(worldMap.tiles[index], tile, worldMap.seed);
  else worldMap.tiles.push(tile);
  worldMap.tiles.sort(compareTiles);
  return index >= 0 ? worldMap.tiles[index] : tile;
}

function revealTile(gameState, q, r, now = new Date(), overrides = {}) {
  const worldMap = ensureWorldMap(gameState, now);
  const existing = getTile(worldMap, q, r);
  const isoNow = typeof now === 'string' ? now : now.toISOString();
  const hasSiteOverride = Object.prototype.hasOwnProperty.call(overrides, 'siteId');
  const discovered = overrides.discovered !== undefined ? Boolean(overrides.discovered) : true;
  const visible = overrides.visible !== undefined ? Boolean(overrides.visible) : true;
  const tile = existing
    ? normalizeTile({
      ...existing,
      ...overrides,
      id: existing.visible === false && visible !== false ? getTileId(q, r) : existing.id,
      q: existing.visible === false && visible !== false ? toInteger(q, existing.q) : existing.q,
      r: existing.visible === false && visible !== false ? toInteger(r, existing.r) : existing.r,
      siteId: hasSiteOverride ? overrides.siteId : existing.siteId,
      discovered,
      visible,
      visibility: overrides.visibility || existing.visibility || 'scouted',
      discoveredAt: existing.discoveredAt || existing.generatedAt || isoNow,
      lastScoutedAt: overrides.lastScoutedAt || isoNow,
      intel: overrides.intel || existing.intel,
    }, worldMap.seed, now)
    : createTile(worldMap.seed, q, r, now, overrides);
  return upsertTile(worldMap, tile);
}

function revealTiles(gameState, coords = [], now = new Date(), options = {}) {
  const worldMap = ensureWorldMap(gameState, now);
  const batch = createWorldMapBatch(worldMap, now);
  const revealed = [];
  const getOverrides = typeof options.overrides === 'function'
    ? options.overrides
    : () => options.overrides || {};
  for (const coord of Array.isArray(coords) ? coords : []) {
    if (!coord || typeof coord !== 'object') continue;
    const q = toInteger(coord.q ?? coord.x, 0);
    const r = toInteger(coord.r ?? coord.y, 0);
    const overrides = {
      ...(coord.overrides && typeof coord.overrides === 'object' ? coord.overrides : {}),
      ...(getOverrides(coord, revealed.length) || {}),
    };
    const tile = batch.revealTile(q, r, overrides);
    if (tile) revealed.push(tile);
  }
  batch.commit();
  return revealed;
}

function recordVisionSource(gameState, source, now = new Date()) {
  ensureWorldMap(gameState, now);
  return VisionHistory.recordSource(gameState, source, now);
}

function recordVisionPath(gameState, from, to, now = new Date(), options = {}) {
  ensureWorldMap(gameState, now);
  return VisionHistory.recordPath(gameState, {
    kind: options.kind || 'unit',
    from,
    to,
  }, now, options);
}

function normalizeVisionHistory(history = {}) {
  return VisionHistory.normalizeHistory(history);
}

function getRevealArea(q, r, radius = SCOUT_REVEAL_RADIUS) {
  const centerQ = toInteger(q, 0);
  const centerR = toInteger(r, 0);
  const safeRadius = Math.max(0, toInteger(radius, SCOUT_REVEAL_RADIUS));
  const coords = [];
  for (let dq = -safeRadius; dq <= safeRadius; dq += 1) {
    for (let dr = -safeRadius; dr <= safeRadius; dr += 1) {
      coords.push({ q: centerQ + dq, r: centerR + dr });
    }
  }
  return coords.sort((a, b) => (
    Math.max(Math.abs(a.q - centerQ), Math.abs(a.r - centerR))
    - Math.max(Math.abs(b.q - centerQ), Math.abs(b.r - centerR))
    || a.q - b.q
    || a.r - b.r
  ));
}

function revealTileArea(gameState, q, r, now = new Date(), options = {}) {
  const radius = options.radius === undefined ? SCOUT_REVEAL_RADIUS : options.radius;
  return revealTiles(gameState, getRevealArea(q, r, radius), now);
}

function canPlaceSiteOnTerrain(seed, q, r) {
  // 'shore' tiles are marchable land, but sites conservatively stay off the
  // coastline for now (keeps pre-shore placement semantics unchanged).
  return !['ocean', 'river', 'shore'].includes(chooseTerrain(seed, q, r));
}

function bindSiteToTile(gameState, q, r, siteId, now = new Date(), options = {}) {
  const controlled = Boolean(options.controlled || options.visibility === 'controlled');
  const tile = revealTile(gameState, q, r, now, {
    siteId,
    visibility: controlled ? 'controlled' : (options.visibility || 'scouted'),
    intel: options.intel,
  });
  if (controlled) recordVisionSource(gameState, { kind: 'city', q, r }, now);
  return tile;
}

function getClientWorldMap(gameState, now = new Date()) {
  return getClientWorldMapFromNormalized(ensureWorldMap(gameState, now));
}

function isCapitalOriginTile(tile = {}, origin = {}) {
  return toInteger(tile.q ?? tile.x, 0) === toInteger(origin.q ?? origin.x, 0)
    && toInteger(tile.r ?? tile.y, 0) === toInteger(origin.r ?? origin.y, 0);
}

function isLegacyCapitalTileOutsideOrigin(tile = {}, origin = {}) {
  const markedCapital = tile.id === CAPITAL_TILE_ID
    || tile.siteId === 'capital'
    || tile.terrain === 'capital';
  return markedCapital && !isCapitalOriginTile(tile, origin);
}

// SSOT: "has the player revealed this tile" — the ONE written form of the reveal predicate.
// gameState.worldMap.tiles is NOT reveal-only: solid-fill bridge tiles (TerritoryStateNormalizer.
// revealSolidKnownWorldTiles) and AI-explorer tiles (WorldAiExplorerService.revealAiArea, written
// with visibility:'hidden'/visible:false) live in the same array. Every consumer that needs "what
// the player can actually see" must come through here (or getRevealedTileCoordSet below) — never
// hand-roll the visibility check or treat raw tile presence as "revealed".
function isTileRevealed(tile) {
  return Boolean(tile) && tile.visibility !== 'hidden' && tile.visible !== false;
}

// Full client-projection rule for one tile: revealed AND not a legacy capital marker left behind
// at a stale origin. Shared verbatim by getClientWorldMapFromNormalized (what the client can draw)
// and getRevealedTileCoordSet (what gates coordinate-keyed projections) so the two can never fork.
function isClientProjectedTile(tile, origin) {
  return isTileRevealed(tile) && !isLegacyCapitalTileOutsideOrigin(tile, origin);
}

// SSOT: coordinate key for coordinate-keyed projection sets (territories, encounters, tiles).
// Moved here from TerritoryClientAssembler (which now delegates) so lower layers can build the
// same keys without requiring the client assembler. Accepts x/y or q/r shaped objects.
function getTileCoordinateKey(site = {}) {
  const x = Number(site.x ?? site.q ?? 0);
  const y = Number(site.y ?? site.r ?? 0);
  return `${Math.floor(x)},${Math.floor(y)}`;
}

// SSOT: the coordinate-key set of every tile the CLIENT map projects. By construction (same
// isClientProjectedTile) this set always equals the coordinates of
// getClientWorldMapFromNormalized(worldMap).tiles — consumers gate against what the client can
// actually draw, never against the raw persisted tile array.
function getRevealedTileCoordSet(worldMap = {}) {
  const origin = getSpawnOrigin(worldMap.origin || {});
  return new Set((Array.isArray(worldMap.tiles) ? worldMap.tiles : [])
    .filter((tile) => isClientProjectedTile(tile, origin))
    .map((tile) => getTileCoordinateKey(tile)));
}

function getClientWorldMapFromNormalized(worldMap) {
  const clientWorldMap = clone(worldMap || {});
  const origin = getSpawnOrigin(clientWorldMap.origin || {});
  clientWorldMap.tiles = (clientWorldMap.tiles || []).filter((tile) => isClientProjectedTile(tile, origin));
  return clientWorldMap;
}

module.exports = {
  WORLD_MAP_VERSION,
  WORLD_TOPOLOGY_VERSION,
  DEFAULT_WORLD_SEED,
  DEFAULT_WORLD_HEIGHT,
  DEFAULT_WORLD_WIDTH,
  DEFAULT_WORLD_WRAPPING,
  CAPITAL_TILE_ID,
  START_REVEAL_RADIUS,
  START_SAFE_LAND_RADIUS,
  SCOUT_REVEAL_RADIUS,
  SIDE_ORDER,
  SIDE_DIRECTIONS,
  DIRECTION_VECTORS,
  getDistanceFromCapital,
  getWorldMapVersion,
  getWorldWaterFeatures,
  createWorldMapGenerationMetadata,
  createWorldTopologyMetadata: WorldMapTopology.createWorldTopologyMetadata,
  getCanonicalTileId,
  getWrappedDistance: WorldMapTopology.getWrappedDistance,
  getWrappedDelta: WorldMapTopology.getDelta,
  normalizeWorldCoord: WorldMapTopology.normalizeCoord,
  normalizeWorldSize: WorldMapTopology.normalizeWorldSize,
  getTileId,
  chooseBaseTerrain,
  chooseTerrain,
  isWaterFamilyTerrain,
  chooseOceanTemplates,
  getRiverPorts,
  getRiverMouthTemplateForNeighborOfOcean,
  getRevealArea,
  getRevealedTileCoordSet,
  getTileCoordinateKey,
  isTileRevealed,
  revealTileArea,
  canPlaceSiteOnTerrain,
  createTile,
  createWorldMapBatch,
  createInitialWorldMap,
  normalizeWorldMap,
  ensureWorldMap,
  normalizeVisionHistory,
  recordVisionPath,
  recordVisionSource,
  revealTile,
  revealTiles,
  bindSiteToTile,
  getClientWorldMap,
  getClientWorldMapFromNormalized,
};
