// WorldCityRepository — shared-world persistence for the PRE-PLACED NEUTRAL CITIES of the one
// canonical world (march-discovery refactor, task #53 S3; docs/design/10 §3.2/§4). Holds the
// deterministic city layout (WorldCitySpawner.planCities) in a shared `world_cities` table, parallel
// to `factions` / `world_people` / `shared_world_territories`: these are authored by the world
// simulation off a FIXED world anchor, not by any single player, so there is ONE copy the whole world
// shares — N players must NOT fork N neutral copies (§4-2, §6-R-storage).
//
// Why a dedicated table (option (b), docs/design/10 §3.2) and NOT sentinel rows in
// shared_world_territories: that table's writer (GameStateRepository.saveSharedWorldTerritories) is
// load-bearing — it SKIPS owner-less territories and drives the per-player owned-territory projection.
// Relaxing that skip to admit neutral cities (option (a)) risks perturbing the player projection.
// A separate table mirrors the established FactionRepository/WorldPeopleRepository pattern and keeps
// the neutral-city single source clean and additive: new table, touches nothing existing.
//
// Single source: the row stores the full raw-territory JSON (the WorldCitySpawner.toRawTerritory
// shape — position + owner + type + status + scale + names ONLY; garrison/capitalDistance/battleTarget
// are re-derived by normalizeTerritory downstream, never stored here — §4-4). id/tileId are mirrored
// into indexed columns purely for queries.
//
// Discovery is SEPARATE from storage: this repo stores the shared single copy, while each player's
// world map decides whether that city is currently visible/materialized for that player (§4-3, §6-R2).

const WorldCitySpawner = require('../services/worldCombat/WorldCitySpawner');
const { toInteger } = require('../../shared/numberUtils');

const DEFAULT_WORLD_ID = 'default';

// The FIXED shared-world anchor the city layout keys off (docs/design/10 §6-R3): the canonical world
// origin (0,0), NOT any one player's capital (capitals spawn on a ring, off-origin — keying off one
// would shift the layout per player). Every player therefore sees the SAME cities.
const WORLD_ANCHOR = Object.freeze({ q: 0, r: 0 });

function parseJson(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_) {
    return fallback;
  }
}

class WorldCityRepository {
  constructor(db, options = {}) {
    this.db = db;
    this.worldId = options.worldId || DEFAULT_WORLD_ID;
    this.worldSeed = options.worldSeed || null;
    this.anchor = options.anchor || WORLD_ANCHOR;
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS world_cities (
        id TEXT PRIMARY KEY,
        worldId TEXT,
        tileId TEXT,
        city TEXT,
        updatedAt TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_world_cities_world ON world_cities(worldId);
    `);
  }

  rowToCity(row) {
    if (!row) return null;
    const city = parseJson(row.city, null);
    if (!city || typeof city !== 'object') return null;
    return city;
  }

  getCity(id) {
    const row = this.db.prepare('SELECT * FROM world_cities WHERE id = ?').get(String(id || ''));
    return this.rowToCity(row);
  }

  getAllCities(worldId = this.worldId) {
    const rows = this.db.prepare('SELECT * FROM world_cities WHERE worldId = ? ORDER BY id ASC').all(worldId);
    return rows.map((row) => this.rowToCity(row)).filter(Boolean);
  }

  hasAnyCity(worldId = this.worldId) {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM world_cities WHERE worldId = ?').get(worldId);
    return Number(row?.count || 0) > 0;
  }

  // Insert or replace a shared world city. The row stores the full raw-territory JSON; id/tileId are
  // query mirrors. Neutral only — a player-owned city lives in that player's game_states / the shared
  // occupied-territory table, never here (this table is the world-authored neutral single source).
  upsertCity(city, now = null) {
    const raw = city && typeof city === 'object' ? city : {};
    const id = String(raw.id || '');
    if (!id) throw new Error('WorldCityRepository.upsertCity: city.id required');
    if (raw.ownerPlayerId) {
      throw new Error('WorldCityRepository.upsertCity: owned cities live in game_states / shared_world_territories, not the shared neutral table');
    }
    const q = toInteger(raw.x ?? raw.q, 0);
    const r = toInteger(raw.y ?? raw.r, 0);
    const tileId = raw.tileId || `tile_${q}_${r}`;
    const updatedAt = now || raw.updatedAt || new Date().toISOString();
    this.db.prepare(`
      INSERT INTO world_cities (id, worldId, tileId, city, updatedAt)
      VALUES (@id, @worldId, @tileId, @city, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        worldId = excluded.worldId,
        tileId = excluded.tileId,
        city = excluded.city,
        updatedAt = excluded.updatedAt
    `).run({
      id,
      worldId: this.worldId,
      tileId,
      city: JSON.stringify({ ...raw, id }),
      updatedAt,
    });
    return { ...raw, id };
  }

  deleteCity(id) {
    this.db.prepare('DELETE FROM world_cities WHERE id = ?').run(String(id || ''));
  }

  // Idempotent, deterministic, ONE-TIME lay-down of the shared neutral city layer (docs/design/10
  // §4-5, §6-R8). Uses the same has-any shared seeding short-circuit: once ANY city
  // exists the seeding is considered done and never re-runs, so calling this on every world init (and
  // any future normalize hook) keeps the shared city count STABLE — no duplication, no
  // write-amplification of shared rows, even though the plan is a pure function of the fixed seed +
  // anchor. Returns the persisted city set.
  ensureSeeded(options = {}) {
    if (this.hasAnyCity()) return this.getAllCities();
    const worldSeed = options.worldSeed || this.worldSeed;
    if (!worldSeed) return [];
    const anchor = options.anchor || this.anchor;
    const occupiedTileIds = options.occupiedTileIds instanceof Set ? options.occupiedTileIds : new Set();
    const specs = WorldCitySpawner.planCities(worldSeed, anchor, { occupiedTileIds });
    const now = options.now instanceof Date ? options.now.toISOString() : (options.now || new Date().toISOString());
    const upsert = this.db.transaction((rawCities) => {
      rawCities.forEach((raw) => this.upsertCity(raw, now));
    });
    upsert(specs.map((spec) => WorldCitySpawner.toRawTerritory(spec)));
    return this.getAllCities();
  }

  ensureCompanionCityForSpawn(_playerId, spawn = {}, options = {}) {
    const worldSeed = options.worldSeed || this.worldSeed;
    if (!worldSeed) return null;
    const spec = WorldCitySpawner.planCompanionCity(worldSeed, spawn, options);
    if (!spec) return null;
    const existing = this.getCity(spec.id);
    if (existing) return existing;
    const now = options.now instanceof Date ? options.now.toISOString() : (options.now || new Date().toISOString());
    return this.upsertCity(WorldCitySpawner.toRawTerritory(spec), now);
  }
}

module.exports = { WorldCityRepository, WORLD_ANCHOR };
