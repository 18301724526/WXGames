const WorldMapService = require('../services/WorldMapService');
const WorldCampSpawner = require('../services/worldCombat/WorldCampSpawner');
const WorldCombatEncounterService = require('../services/worldCombat/WorldCombatEncounterService');
const { WORLD_ANCHOR } = require('./WorldCityRepository');
const { DEFAULT_WORLD_SEED } = require('../services/worldMap/WorldMapConstants');
const { toInteger } = require('../../shared/numberUtils');

const DEFAULT_WORLD_ID = 'default';

function parseJson(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_) {
    return fallback;
  }
}

function clone(value) {
  return value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value;
}

function toTimestamp(value = null) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date().toISOString();
}

function stripPlayerIntel(encounter = {}) {
  const raw = clone(encounter) || {};
  delete raw.battleReport;
  delete raw.resolvedByMissionId;
  return raw;
}

class WorldEncounterRepository {
  constructor(db, options = {}) {
    this.db = db;
    this.worldId = options.worldId || DEFAULT_WORLD_ID;
    this.worldSeed = options.worldSeed || DEFAULT_WORLD_SEED;
    this.anchor = options.anchor || WORLD_ANCHOR;
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS world_encounters (
        id TEXT PRIMARY KEY,
        worldId TEXT,
        tileId TEXT,
        encounter TEXT,
        updatedAt TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_world_encounters_world ON world_encounters(worldId);
      CREATE INDEX IF NOT EXISTS idx_world_encounters_tile ON world_encounters(tileId);
    `);
  }

  rowToEncounter(row) {
    if (!row) return null;
    const encounter = parseJson(row.encounter, null);
    if (!encounter || typeof encounter !== 'object') return null;
    return encounter;
  }

  hasAnyEncounter(worldId = this.worldId) {
    const row = this.db
      .prepare('SELECT COUNT(*) AS count FROM world_encounters WHERE worldId = ?')
      .get(worldId);
    return Number(row?.count || 0) > 0;
  }

  readAllEncounters(worldId = this.worldId) {
    const rows = this.db
      .prepare('SELECT * FROM world_encounters WHERE worldId = ? ORDER BY id ASC')
      .all(worldId);
    return rows.map((row) => this.rowToEncounter(row)).filter(Boolean);
  }

  refreshRespawns(now = new Date()) {
    const stamp = now instanceof Date ? now : new Date(now || Date.now());
    const encounters = this.readAllEncounters();
    for (const encounter of encounters) {
      const next = clone(encounter);
      if (WorldCombatEncounterService.respawnCampIfReady(next, stamp)) {
        this.upsertEncounter(next, stamp);
      }
    }
  }

  getAllEncounters(options = {}) {
    if (options.refreshRespawns !== false) {
      this.refreshRespawns(options.now instanceof Date ? options.now : new Date(options.now || Date.now()));
    }
    return this.readAllEncounters(options.worldId || this.worldId);
  }

  getEncounter(id, options = {}) {
    const encounterId = String(id || '');
    if (!encounterId) return null;
    if (options.refreshRespawns !== false) {
      this.refreshRespawns(options.now instanceof Date ? options.now : new Date(options.now || Date.now()));
    }
    const row = this.db.prepare('SELECT * FROM world_encounters WHERE id = ?').get(encounterId);
    return this.rowToEncounter(row);
  }

  getActiveEncounter(id, options = {}) {
    const encounter = this.getEncounter(id, options);
    return encounter && encounter.status === 'active' ? encounter : null;
  }

  getActiveEncounterAt(coord = {}, options = {}) {
    const q = toInteger(coord.q ?? coord.x, 0);
    const r = toInteger(coord.r ?? coord.y, 0);
    const tileId = WorldMapService.getTileId(q, r);
    const encounters = this.getAllEncounters(options);
    return encounters.find((encounter) => encounter.status === 'active' && encounter.tileId === tileId) || null;
  }

  upsertEncounter(encounter, now = null) {
    const raw = stripPlayerIntel(encounter && typeof encounter === 'object' ? encounter : {});
    const id = String(raw.id || '');
    if (!id) throw new Error('WorldEncounterRepository.upsertEncounter: encounter.id required');
    const q = toInteger(raw.q ?? raw.x, 0);
    const r = toInteger(raw.r ?? raw.y, 0);
    const tileId = raw.tileId || WorldMapService.getTileId(q, r);
    const updatedAt = toTimestamp(now || raw.updatedAt);
    const persisted = {
      ...raw,
      id,
      q,
      r,
      tileId,
      updatedAt,
    };
    this.db.prepare(`
      INSERT INTO world_encounters (id, worldId, tileId, encounter, updatedAt)
      VALUES (@id, @worldId, @tileId, @encounter, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        worldId = excluded.worldId,
        tileId = excluded.tileId,
        encounter = excluded.encounter,
        updatedAt = excluded.updatedAt
    `).run({
      id,
      worldId: this.worldId,
      tileId,
      encounter: JSON.stringify(persisted),
      updatedAt,
    });
    return persisted;
  }

  deleteEncounter(id) {
    this.db.prepare('DELETE FROM world_encounters WHERE id = ?').run(String(id || ''));
  }

  ensureSeeded(options = {}) {
    if (this.hasAnyEncounter()) return this.getAllEncounters(options);
    const worldSeed = options.worldSeed || this.worldSeed;
    if (!worldSeed) return [];
    const anchor = options.anchor || this.anchor;
    const occupiedTileIds = options.occupiedTileIds instanceof Set ? options.occupiedTileIds : new Set();
    const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
    const specs = WorldCampSpawner.planCamps(worldSeed, anchor, { occupiedTileIds });
    const seed = this.db.transaction((rawSpecs) => {
      rawSpecs.forEach((spec) => this.upsertEncounter(WorldCampSpawner.campSpecToEncounter(spec, now), now));
    });
    seed(specs);
    return this.getAllEncounters({ ...options, now });
  }
}

module.exports = {
  WorldEncounterRepository,
};
