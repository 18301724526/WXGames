const { normalizeSpawnAssignment } = require('../services/spawn/SpawnAssignment');
const { toInteger } = require('../../shared/numberUtils');

const DEFAULT_WORLD_ID = 'default';

function parseJson(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_) {
    return fallback;
  }
}

function getTerritoryCoord(territory = {}) {
  return {
    q: toInteger(territory.q ?? territory.x, 0),
    r: toInteger(territory.r ?? territory.y, 0),
  };
}

function isCapitalTerritory(territory = {}) {
  return territory.id === 'capital' || territory.type === 'capital';
}

function isOccupiedTerritory(territory = {}) {
  return territory.status === 'occupied' || territory.owner === 'player' || Boolean(territory.ownerPlayerId);
}

class SpawnAuthorityRepository {
  constructor(db, options = {}) {
    this.db = db;
    this.worldId = options.worldId || DEFAULT_WORLD_ID;
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS player_spawn_allocations (
        playerId TEXT PRIMARY KEY,
        worldId TEXT,
        q INTEGER,
        r INTEGER,
        spawnKey TEXT,
        status TEXT,
        assignment TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        UNIQUE(worldId, spawnKey)
      );
      CREATE INDEX IF NOT EXISTS idx_player_spawn_allocations_world_status
        ON player_spawn_allocations(worldId, status);
    `);
  }

  rowToAssignment(row) {
    if (!row) return null;
    const parsed = parseJson(row.assignment, {});
    return normalizeSpawnAssignment({
      ...parsed,
      playerId: row.playerId,
      worldId: row.worldId || this.worldId,
      q: row.q,
      r: row.r,
      spawnKey: row.spawnKey,
      status: row.status || parsed.status || 'reserved',
      createdAt: row.createdAt || parsed.createdAt || null,
      updatedAt: row.updatedAt || parsed.updatedAt || null,
    });
  }

  getSpawnForPlayer(playerId) {
    const row = this.db.prepare('SELECT * FROM player_spawn_allocations WHERE playerId = ?').get(playerId);
    return this.rowToAssignment(row);
  }

  getSpawnByKey(worldId, spawnKey) {
    const row = this.db.prepare(`
      SELECT * FROM player_spawn_allocations WHERE worldId = ? AND spawnKey = ?
    `).get(worldId || this.worldId, spawnKey);
    return this.rowToAssignment(row);
  }

  reserveSpawn(playerId, assignment = {}, options = {}) {
    const nowIso = options.nowIso || new Date().toISOString();
    const normalized = normalizeSpawnAssignment({
      ...assignment,
      playerId,
      worldId: assignment.worldId || this.worldId,
      status: assignment.status || 'reserved',
    });
    const transaction = this.db.transaction(() => {
      const current = this.getSpawnForPlayer(playerId);
      if (current) return current;
      this.db.prepare(`
        INSERT INTO player_spawn_allocations (
          playerId, worldId, q, r, spawnKey, status, assignment, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        playerId,
        normalized.worldId,
        normalized.q,
        normalized.r,
        normalized.spawnKey,
        normalized.status,
        JSON.stringify({
          ...normalized,
          playerId,
          createdAt: nowIso,
          updatedAt: nowIso,
        }),
        nowIso,
        nowIso,
      );
      return this.getSpawnForPlayer(playerId);
    });

    try {
      return transaction();
    } catch (error) {
      if (String(error.message || '').includes('UNIQUE constraint failed')) {
        const current = this.getSpawnForPlayer(playerId);
        if (current) return current;
        const reserved = this.getSpawnByKey(normalized.worldId, normalized.spawnKey);
        const conflict = new Error(`Spawn coordinate already reserved: ${normalized.spawnKey}`);
        conflict.code = 'SPAWN_ALREADY_RESERVED';
        conflict.spawnKey = normalized.spawnKey;
        conflict.playerId = playerId;
        conflict.reservedBy = reserved?.playerId || '';
        throw conflict;
      }
      throw error;
    }
  }

  releaseSpawnForPlayer(playerId) {
    return this.db.prepare('DELETE FROM player_spawn_allocations WHERE playerId = ?').run(playerId).changes;
  }

  getReservedSpawnCoordinates(options = {}) {
    const worldId = options.worldId || this.worldId;
    return this.db.prepare(`
      SELECT playerId, q, r, spawnKey, status
      FROM player_spawn_allocations
      WHERE worldId = ? AND status IN ('reserved', 'active')
      ORDER BY q ASC, r ASC, playerId ASC
    `).all(worldId)
      .map((row) => ({
        playerId: row.playerId,
        q: toInteger(row.q, 0),
        r: toInteger(row.r, 0),
        spawnKey: row.spawnKey,
        status: row.status,
        source: 'spawn-allocation',
      }));
  }

  getOccupiedCapitalCoordinates() {
    return this.db.prepare('SELECT playerId, territories FROM game_states ORDER BY playerId ASC').all()
      .flatMap((row) => {
        const territories = parseJson(row.territories, []);
        if (!Array.isArray(territories)) return [];
        return territories
          .filter((territory) => territory && typeof territory === 'object' && isCapitalTerritory(territory))
          .map((territory) => ({
            ...getTerritoryCoord(territory),
            playerId: row.playerId,
            territoryId: territory.id || 'capital',
            source: 'game-state-capital',
          }));
      });
  }

  getOccupiedSharedTerritoryCoordinates() {
    return this.db.prepare('SELECT id, ownerPlayerId, territory FROM shared_world_territories ORDER BY id ASC').all()
      .map((row) => {
        const territory = parseJson(row.territory, null);
        if (!territory || typeof territory !== 'object' || !isOccupiedTerritory(territory)) return null;
        return {
          ...getTerritoryCoord(territory),
          playerId: territory.ownerPlayerId || row.ownerPlayerId || '',
          territoryId: territory.id || row.id,
          source: 'shared-world-territory',
        };
      })
      .filter(Boolean);
  }

  getOccupiedSpawnCoordinates(options = {}) {
    const includeSharedTerritories = options.includeSharedTerritories !== false;
    const includeReservedSpawns = options.includeReservedSpawns !== false;
    return [
      ...this.getOccupiedCapitalCoordinates(),
      ...(includeSharedTerritories ? this.getOccupiedSharedTerritoryCoordinates() : []),
      ...(includeReservedSpawns ? this.getReservedSpawnCoordinates(options) : []),
    ];
  }
}

module.exports = {
  SpawnAuthorityRepository,
};
