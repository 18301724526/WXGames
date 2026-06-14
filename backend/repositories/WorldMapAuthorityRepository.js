const WorldMapService = require('../services/WorldMapService');

const DEFAULT_WORLD_ID = 'default';
const DEFAULT_GENERATION_VERSION = 1;
const DEFAULT_CHUNK_SIZE = 16;

function parseJson(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_) {
    return fallback;
  }
}

function toInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function getTileCoord(tile = {}) {
  return {
    q: toInteger(tile.q ?? tile.x, 0),
    r: toInteger(tile.r ?? tile.y, 0),
  };
}

function getCanonicalId(tile = {}) {
  if (typeof tile.canonicalId === 'string' && tile.canonicalId) return tile.canonicalId;
  const { q, r } = getTileCoord(tile);
  return WorldMapService.getCanonicalTileId(q, r);
}

function getVisibility(tile = {}) {
  if (typeof tile.visibility === 'string' && tile.visibility) return tile.visibility;
  return tile.visible === false ? 'hidden' : 'scouted';
}

function isPlayerVisibleTile(tile = {}) {
  const visibility = getVisibility(tile);
  return tile.visible !== false && visibility !== 'hidden' && visibility !== 'unknown';
}

function createChunkRef(tile = {}, chunkSize = DEFAULT_CHUNK_SIZE) {
  const { q, r } = getTileCoord(tile);
  const normalizedChunkSize = Math.max(1, toInteger(chunkSize, DEFAULT_CHUNK_SIZE));
  const chunkX = Math.floor(q / normalizedChunkSize);
  const chunkY = Math.floor(r / normalizedChunkSize);
  return {
    chunkX,
    chunkY,
    chunkKey: `${DEFAULT_WORLD_ID}:${DEFAULT_GENERATION_VERSION}:${chunkX}:${chunkY}`,
  };
}

function normalizeGenerationContext(tile = {}, fallback = {}) {
  const context = tile.generationContext && typeof tile.generationContext === 'object'
    ? tile.generationContext
    : fallback;
  return context && typeof context === 'object' ? context : {};
}

function createGlobalTilePayload(tile = {}) {
  const { q, r } = getTileCoord(tile);
  const canonicalId = getCanonicalId(tile);
  const payload = {
    ...tile,
    id: WorldMapService.getTileId(q, r),
    q,
    r,
    x: tile.x ?? q,
    y: tile.y ?? r,
    canonicalId,
  };
  delete payload.visibility;
  delete payload.visible;
  delete payload.discovered;
  delete payload.discoveredAt;
  delete payload.lastScoutedAt;
  delete payload.intel;
  return payload;
}

function createPlayerTile(globalTile = {}, visibilityRow = {}) {
  const visibility = visibilityRow.visibility || 'scouted';
  const discoveredAt = visibilityRow.discoveredAt || visibilityRow.updatedAt || null;
  const intel = parseJson(visibilityRow.intel, null);
  return {
    ...globalTile,
    visibility,
    visible: visibility !== 'hidden' && visibility !== 'unknown',
    discovered: visibility !== 'unknown',
    discoveredAt,
    lastScoutedAt: visibilityRow.lastScoutedAt || discoveredAt,
    ...(intel ? { intel } : {}),
  };
}

class WorldMapAuthorityRepository {
  constructor(db, options = {}) {
    this.db = db;
    this.worldId = options.worldId || DEFAULT_WORLD_ID;
    this.generationVersion = Math.max(1, toInteger(options.generationVersion, DEFAULT_GENERATION_VERSION));
    this.chunkSize = Math.max(1, toInteger(options.chunkSize, DEFAULT_CHUNK_SIZE));
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS global_world_chunks (
        chunkKey TEXT PRIMARY KEY,
        worldId TEXT,
        chunkX INTEGER,
        chunkY INTEGER,
        generationVersion INTEGER,
        generationContext TEXT,
        firstDiscoveredBy TEXT,
        firstDiscoveredAt TEXT,
        updatedAt TEXT
      );
      CREATE TABLE IF NOT EXISTS global_world_tiles (
        canonicalId TEXT PRIMARY KEY,
        chunkKey TEXT,
        worldId TEXT,
        q INTEGER,
        r INTEGER,
        generationVersion INTEGER,
        tile TEXT,
        generationContext TEXT,
        firstDiscoveredBy TEXT,
        firstDiscoveredAt TEXT,
        updatedAt TEXT
      );
      CREATE TABLE IF NOT EXISTS player_world_visibility (
        playerId TEXT,
        canonicalId TEXT,
        chunkKey TEXT,
        visibility TEXT,
        intel TEXT,
        discoveredAt TEXT,
        lastScoutedAt TEXT,
        updatedAt TEXT,
        PRIMARY KEY (playerId, canonicalId)
      );
      CREATE INDEX IF NOT EXISTS idx_global_world_tiles_chunk ON global_world_tiles(chunkKey);
      CREATE INDEX IF NOT EXISTS idx_player_world_visibility_player ON player_world_visibility(playerId);
      CREATE INDEX IF NOT EXISTS idx_player_world_visibility_chunk ON player_world_visibility(chunkKey);
    `);
  }

  upsertChunk(chunkRef, playerId, generationContext, nowIso) {
    this.db.prepare(`
      INSERT INTO global_world_chunks (
        chunkKey, worldId, chunkX, chunkY, generationVersion, generationContext,
        firstDiscoveredBy, firstDiscoveredAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(chunkKey) DO UPDATE SET updatedAt = excluded.updatedAt
    `).run(
      chunkRef.chunkKey,
      this.worldId,
      chunkRef.chunkX,
      chunkRef.chunkY,
      this.generationVersion,
      JSON.stringify(generationContext || {}),
      playerId,
      nowIso,
      nowIso,
    );
  }

  upsertGlobalTile(tile, playerId, nowIso) {
    const canonicalId = getCanonicalId(tile);
    const existing = this.db.prepare('SELECT tile FROM global_world_tiles WHERE canonicalId = ?').get(canonicalId);
    if (existing) return parseJson(existing.tile, null);

    const { q, r } = getTileCoord(tile);
    const chunkRef = createChunkRef(tile, this.chunkSize);
    const generationContext = normalizeGenerationContext(tile, {
      source: 'legacy-world-map',
      playerId,
    });
    const payload = createGlobalTilePayload(tile);
    this.upsertChunk(chunkRef, playerId, generationContext, nowIso);
    this.db.prepare(`
      INSERT INTO global_world_tiles (
        canonicalId, chunkKey, worldId, q, r, generationVersion, tile,
        generationContext, firstDiscoveredBy, firstDiscoveredAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      canonicalId,
      chunkRef.chunkKey,
      this.worldId,
      q,
      r,
      this.generationVersion,
      JSON.stringify(payload),
      JSON.stringify(generationContext),
      playerId,
      nowIso,
      nowIso,
    );
    return payload;
  }

  upsertPlayerVisibility(playerId, tile, nowIso) {
    if (!isPlayerVisibleTile(tile)) return;
    const canonicalId = getCanonicalId(tile);
    const chunkRef = createChunkRef(tile, this.chunkSize);
    this.db.prepare(`
      INSERT INTO player_world_visibility (
        playerId, canonicalId, chunkKey, visibility, intel, discoveredAt, lastScoutedAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(playerId, canonicalId) DO UPDATE SET
        chunkKey = excluded.chunkKey,
        visibility = excluded.visibility,
        intel = excluded.intel,
        lastScoutedAt = excluded.lastScoutedAt,
        updatedAt = excluded.updatedAt
    `).run(
      playerId,
      canonicalId,
      chunkRef.chunkKey,
      getVisibility(tile),
      JSON.stringify(tile.intel || {}),
      tile.discoveredAt || nowIso,
      tile.lastScoutedAt || nowIso,
      nowIso,
    );
  }

  commitWorldMapForPlayer(gameState, nowIso = new Date().toISOString()) {
    const playerId = gameState?.playerId || '';
    if (!playerId) return;
    const tiles = Array.isArray(gameState?.worldMap?.tiles) ? gameState.worldMap.tiles : [];
    for (const tile of tiles) {
      if (!tile || typeof tile !== 'object') continue;
      if (!isPlayerVisibleTile(tile)) continue;
      const authoritativeTile = this.upsertGlobalTile(tile, playerId, nowIso);
      this.upsertPlayerVisibility(playerId, authoritativeTile ? { ...tile, ...authoritativeTile } : tile, nowIso);
    }
    gameState.worldMap = this.hydrateWorldMapForPlayer(
      playerId,
      this.sanitizeWorldMapForSave(gameState.worldMap),
    );
  }

  getPlayerVisibleTiles(playerId) {
    return this.db.prepare(`
      SELECT visibility.*, global_world_tiles.tile
      FROM player_world_visibility AS visibility
      INNER JOIN global_world_tiles
        ON global_world_tiles.canonicalId = visibility.canonicalId
      WHERE visibility.playerId = ?
      ORDER BY global_world_tiles.q ASC, global_world_tiles.r ASC
    `).all(playerId)
      .map((row) => {
        const globalTile = parseJson(row.tile, null);
        return globalTile ? createPlayerTile(globalTile, row) : null;
      })
      .filter(Boolean);
  }

  sanitizeWorldMapForSave(worldMap = {}) {
    return {
      ...(worldMap || {}),
      tiles: [],
    };
  }

  hydrateWorldMapForPlayer(playerId, worldMap = {}) {
    const visibleTiles = this.getPlayerVisibleTiles(playerId);
    return {
      ...(worldMap || {}),
      tiles: visibleTiles,
    };
  }

  clearPlayerVisibility(playerId) {
    this.db.prepare('DELETE FROM player_world_visibility WHERE playerId = ?').run(playerId);
  }

  migrateLegacyPlayerWorldMaps() {
    const rows = this.db.prepare('SELECT playerId, worldMap, updatedAt FROM game_states').all();
    const migrate = this.db.transaction((items) => {
      for (const row of items) {
        const worldMap = parseJson(row.worldMap, null);
        if (!worldMap || !Array.isArray(worldMap.tiles) || worldMap.tiles.length === 0) continue;
        const updatedAt = row.updatedAt || new Date().toISOString();
        this.commitWorldMapForPlayer({ playerId: row.playerId, worldMap }, updatedAt);
        this.db.prepare('UPDATE game_states SET worldMap = ? WHERE playerId = ?')
          .run(JSON.stringify(this.sanitizeWorldMapForSave(worldMap)), row.playerId);
      }
    });
    migrate(rows);
  }
}

module.exports = {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_GENERATION_VERSION,
  DEFAULT_WORLD_ID,
  WorldMapAuthorityRepository,
  createGlobalTilePayload,
  createPlayerTile,
  getCanonicalId,
  isPlayerVisibleTile,
};
