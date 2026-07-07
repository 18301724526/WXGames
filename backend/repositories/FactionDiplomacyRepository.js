// FactionDiplomacyRepository — shared-world persistence for faction<->faction diplomacy edges
// (docs/design/04, 08). Parallel to shared_world_territories / factions: diplomacy is shared world
// state (cross-player visible, simulated once in the world tick), never hidden in a player's gameState.
//
// Storage (doc 04 §2): favorability is DIRECTED (each side its own row), state/since/treaties are
// SYMMETRIC (mirrored onto both (A,B) and (B,A) rows by the ONE write command in
// FactionDiplomacyService — this repo persists rows; it does not enforce symmetry). Additive: new
// table, touches nothing existing.

const diplomacyCore = require('../../shared/faction/diplomacyCore');

const DEFAULT_WORLD_ID = 'default';

function parseJson(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_) {
    return fallback;
  }
}

class FactionDiplomacyRepository {
  constructor(db, options = {}) {
    this.db = db;
    this.worldId = options.worldId || DEFAULT_WORLD_ID;
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS faction_diplomacy (
        worldId TEXT,
        fromFactionId TEXT,
        toFactionId TEXT,
        favorability REAL DEFAULT 0,
        state TEXT DEFAULT 'neutral',
        nemesisStreak INTEGER DEFAULT 0,
        since TEXT,
        treaties TEXT,
        updatedAt TEXT,
        PRIMARY KEY (worldId, fromFactionId, toFactionId)
      );
      CREATE INDEX IF NOT EXISTS idx_faction_diplomacy_from ON faction_diplomacy(worldId, fromFactionId);
    `);
  }

  rowToEdge(row, fromFactionId, toFactionId) {
    if (!row) {
      // an absent edge is the default neutral relation (never stored until it changes).
      return { ...diplomacyCore.normalizeEdge({}), fromFactionId, toFactionId, since: null };
    }
    const edge = diplomacyCore.normalizeEdge({
      favorability: row.favorability,
      state: row.state,
      nemesisStreak: row.nemesisStreak,
      treaties: parseJson(row.treaties, {}),
    });
    return { ...edge, fromFactionId: row.fromFactionId, toFactionId: row.toFactionId, since: row.since || null };
  }

  getEdge(fromFactionId, toFactionId) {
    const row = this.db.prepare(
      'SELECT * FROM faction_diplomacy WHERE worldId = ? AND fromFactionId = ? AND toFactionId = ?',
    ).get(this.worldId, String(fromFactionId || ''), String(toFactionId || ''));
    return this.rowToEdge(row, String(fromFactionId || ''), String(toFactionId || ''));
  }

  getEdgesFor(fromFactionId) {
    const rows = this.db.prepare('SELECT * FROM faction_diplomacy WHERE worldId = ? AND fromFactionId = ?')
      .all(this.worldId, String(fromFactionId || ''));
    return rows.map((row) => this.rowToEdge(row, row.fromFactionId, row.toFactionId));
  }

  upsertEdge(fromFactionId, toFactionId, edge, now = null) {
    const e = diplomacyCore.normalizeEdge(edge);
    this.db.prepare(`
      INSERT INTO faction_diplomacy (worldId, fromFactionId, toFactionId, favorability, state, nemesisStreak, since, treaties, updatedAt)
      VALUES (@worldId, @fromFactionId, @toFactionId, @favorability, @state, @nemesisStreak, @since, @treaties, @updatedAt)
      ON CONFLICT(worldId, fromFactionId, toFactionId) DO UPDATE SET
        favorability = excluded.favorability,
        state = excluded.state,
        nemesisStreak = excluded.nemesisStreak,
        since = excluded.since,
        treaties = excluded.treaties,
        updatedAt = excluded.updatedAt
    `).run({
      worldId: this.worldId,
      fromFactionId: String(fromFactionId || ''),
      toFactionId: String(toFactionId || ''),
      favorability: e.favorability,
      state: e.state,
      nemesisStreak: e.nemesisStreak,
      since: (edge && edge.since) || now || null,
      treaties: JSON.stringify(e.treaties || {}),
      updatedAt: now || null,
    });
    return this.getEdge(fromFactionId, toFactionId);
  }
}

module.exports = { FactionDiplomacyRepository };
