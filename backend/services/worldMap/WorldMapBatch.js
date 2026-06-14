const {
  DEFAULT_WORLD_SEED,
} = require('./WorldMapConstants');
const {
  getTileId,
  toInteger,
} = require('./WorldMapShared');
const WorldMapTopology = require('./WorldMapTopology');
const {
  createTile,
  normalizeTile,
} = require('./WorldMapTiles');

function compareTiles(a, b) {
  return Math.max(Math.abs(a.q), Math.abs(a.r)) - Math.max(Math.abs(b.q), Math.abs(b.r))
    || a.q - b.q
    || a.r - b.r;
}

function mergeTiles(existing, tile, seed = DEFAULT_WORLD_SEED, now = new Date()) {
  if (!existing) return tile;
  const visibilityRank = { unknown: 0, hidden: 0, hinted: 1, scouted: 2, controlled: 3 };
  const existingVisibility = existing.visibility || 'unknown';
  const tileVisibility = tile.visibility || 'unknown';
  const visibility = (visibilityRank[tileVisibility] || 0) >= (visibilityRank[existingVisibility] || 0)
    ? tileVisibility
    : existingVisibility;
  const preferIncomingDisplay = existing.visible === false && tile.visible !== false;
  return normalizeTile({
    ...existing,
    ...tile,
    q: preferIncomingDisplay ? toInteger(tile.q, existing.q) : toInteger(existing.q, tile.q),
    r: preferIncomingDisplay ? toInteger(tile.r, existing.r) : toInteger(existing.r, tile.r),
    x: preferIncomingDisplay ? toInteger(tile.x ?? tile.q, existing.q) : toInteger(existing.x ?? existing.q, tile.q),
    y: preferIncomingDisplay ? toInteger(tile.y ?? tile.r, existing.r) : toInteger(existing.y ?? existing.r, tile.r),
    siteId: tile.siteId || existing.siteId || null,
    terrain: tile.terrain || existing.terrain,
    visibility,
    discovered: existing.discovered !== false || tile.discovered !== false,
    visible: existing.visible !== false || tile.visible !== false,
    discoveredAt: existing.discoveredAt || tile.discoveredAt,
    lastScoutedAt: tile.lastScoutedAt || existing.lastScoutedAt,
    intel: tile.intel || existing.intel,
    generatedAt: existing.generatedAt || tile.generatedAt,
  }, seed, now);
}

function createTileIndex(worldMap, now = new Date()) {
  const seed = worldMap?.seed || DEFAULT_WORLD_SEED;
  const index = new Map();
  for (const tile of Array.isArray(worldMap?.tiles) ? worldMap.tiles : []) {
    const normalized = normalizeTile(tile, seed, now);
    if (!normalized) continue;
    const canonicalId = WorldMapTopology.getTileCanonicalKey(normalized);
    index.set(canonicalId, mergeTiles(index.get(canonicalId), normalized, seed, now));
  }
  return index;
}

function createWorldMapBatch(worldMap, now = new Date()) {
  const seed = worldMap?.seed || DEFAULT_WORLD_SEED;
  const tileIndex = createTileIndex(worldMap, now);

  function getTile(q, r) {
    return tileIndex.get(WorldMapTopology.getCanonicalTileId(q, r)) || null;
  }

  function upsertTile(tile) {
    const normalized = normalizeTile(tile, seed, now);
    if (!normalized) return null;
    const canonicalId = WorldMapTopology.getTileCanonicalKey(normalized);
    const merged = mergeTiles(tileIndex.get(canonicalId), normalized, seed, now);
    tileIndex.set(canonicalId, merged);
    return merged;
  }

  function revealTile(q, r, overrides = {}) {
    const existing = getTile(q, r);
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
      }, seed, now)
      : createTile(seed, q, r, now, overrides);
    return upsertTile(tile);
  }

  function commit() {
    worldMap.tiles = [...tileIndex.values()].sort(compareTiles);
    return worldMap.tiles;
  }

  return {
    commit,
    getTile,
    revealTile,
    upsertTile,
  };
}

module.exports = {
  compareTiles,
  createTileIndex,
  createWorldMapBatch,
  mergeTiles,
};
