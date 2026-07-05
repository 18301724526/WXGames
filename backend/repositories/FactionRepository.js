// FactionRepository — shared-world persistence for 势力(Faction) entities (docs/design/01, 08;
// architecture: shared-world PVPVE). Holds AI + lightweight-NEUTRAL factions in a shared `factions`
// table, parallel to shared_world_territories: these are authored by the world simulation (world
// worker), not by any single player, so they live in shared state and are projected to players.
//
// A REAL PLAYER's faction is NOT stored here — it derives from its game_states row (factionId =
// player_<playerId>); FactionRegistryService materializes it and merges. This repo is additive: it
// creates a new table and touches nothing existing.
//
// Single source: the row stores the full faction JSON (factionCore.normalizeFaction shape) with
// id/kind/lifecycleState mirrored into indexed columns for queries — cities/officers/diplomacy are
// NEVER stored on the faction (derived from territory.ownerFactionId / person.factionId / diplomacy).

const factionCore = require('../../shared/faction/factionCore');

const DEFAULT_WORLD_ID = 'default';

function parseJson(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_) {
    return fallback;
  }
}

class FactionRepository {
  constructor(db, options = {}) {
    this.db = db;
    this.worldId = options.worldId || DEFAULT_WORLD_ID;
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS factions (
        id TEXT PRIMARY KEY,
        worldId TEXT,
        kind TEXT,
        lifecycleState TEXT,
        faction TEXT,
        updatedAt TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_factions_world_kind_state
        ON factions(worldId, kind, lifecycleState);
    `);
  }

  rowToFaction(row) {
    if (!row) return null;
    // The JSON blob is authoritative; the columns are just query mirrors.
    return factionCore.normalizeFaction(parseJson(row.faction, { id: row.id, kind: row.kind }));
  }

  getFaction(id) {
    const row = this.db.prepare('SELECT * FROM factions WHERE id = ?').get(String(id || ''));
    return this.rowToFaction(row);
  }

  getAllFactions(worldId = this.worldId) {
    const rows = this.db.prepare('SELECT * FROM factions WHERE worldId = ?').all(worldId);
    return rows.map((row) => this.rowToFaction(row)).filter(Boolean);
  }

  getFactionsByKind(kind, worldId = this.worldId) {
    const rows = this.db.prepare('SELECT * FROM factions WHERE worldId = ? AND kind = ?').all(worldId, String(kind || ''));
    return rows.map((row) => this.rowToFaction(row)).filter(Boolean);
  }

  getAliveFactions(worldId = this.worldId) {
    const rows = this.db.prepare('SELECT * FROM factions WHERE worldId = ? AND lifecycleState = ?')
      .all(worldId, factionCore.LIFECYCLE.ALIVE);
    return rows.map((row) => this.rowToFaction(row)).filter(Boolean);
  }

  // Insert or replace a faction. Player factions must NOT be written here (they live in game_states);
  // guard against it so the shared table stays authored only by the world sim.
  upsertFaction(faction, now = null) {
    const normalized = factionCore.normalizeFaction(faction);
    if (!normalized.id) throw new Error('FactionRepository.upsertFaction: faction.id required');
    if (normalized.kind === factionCore.KIND.PLAYER) {
      throw new Error('FactionRepository.upsertFaction: player factions live in game_states, not the shared table');
    }
    // This repo REPLACES the whole faction blob (document store), so callers must pass a full
    // read-modify-write faction. As a defensive guard for the one immutable-once-set field, preserve an
    // existing createdAt when the incoming faction omits it, so a partial write can't null it out.
    if (!normalized.createdAt) {
      const existing = this.getFaction(normalized.id);
      if (existing && existing.createdAt) normalized.createdAt = existing.createdAt;
    }
    const updatedAt = now || normalized.updatedAt || null;
    normalized.updatedAt = updatedAt;
    this.db.prepare(`
      INSERT INTO factions (id, worldId, kind, lifecycleState, faction, updatedAt)
      VALUES (@id, @worldId, @kind, @lifecycleState, @faction, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        worldId = excluded.worldId,
        kind = excluded.kind,
        lifecycleState = excluded.lifecycleState,
        faction = excluded.faction,
        updatedAt = excluded.updatedAt
    `).run({
      id: normalized.id,
      worldId: this.worldId,
      kind: normalized.kind,
      lifecycleState: normalized.lifecycle.state,
      faction: JSON.stringify(normalized),
      updatedAt,
    });
    return normalized;
  }

  deleteFaction(id) {
    this.db.prepare('DELETE FROM factions WHERE id = ?').run(String(id || ''));
  }
}

module.exports = { FactionRepository };
