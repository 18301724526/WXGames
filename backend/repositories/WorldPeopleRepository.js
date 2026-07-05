// WorldPeopleRepository — shared-world persistence for WORLD-authored people (docs/design/02, 03, 08;
// architecture: shared-world PVPVE). Holds 在野武将 (ronin, factionId null) + AI-faction officers in a
// shared `world_people` table, parallel to `factions` / shared_world_territories: these are authored by
// the world simulation, not by any single player.
//
// A REAL PLAYER's roster is NOT stored here — it stays in that player's game_states row
// (gameState.famousPeople). The logical person registry = the union view of this table + every player's
// roster; a person RECRUITED into a player faction (②b capture) MOVES from here into that player's
// game_states and is deleted from this table. So this repo REJECTS writing a person whose factionId is a
// player faction, mirroring FactionRepository's guard. Additive: new table, touches nothing existing.
//
// Single source: the row stores the full person JSON with its social fields normalized through the one
// source (PersonSocialFields.normalizeSocial); id/factionId are mirrored into indexed columns purely for
// queries. relationships/personality live ON the person, never duplicated elsewhere.

const factionCore = require('../../shared/faction/factionCore');
const PersonSocialFields = require('../services/person/PersonSocialFields');

const DEFAULT_WORLD_ID = 'default';

function parseJson(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_) {
    return fallback;
  }
}

// Normalize a world person: require an id, then re-derive the social sub-object from the single source
// (deterministic backfill for old rows), keeping every other field as-is. factionId is authoritative
// from the normalized social fields (null = 在野).
function normalizePerson(raw) {
  const person = raw && typeof raw === 'object' ? raw : {};
  const id = String(person.id || '');
  const social = PersonSocialFields.normalizeSocial(person, id);
  return { ...person, ...social, id };
}

class WorldPeopleRepository {
  constructor(db, options = {}) {
    this.db = db;
    this.worldId = options.worldId || DEFAULT_WORLD_ID;
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS world_people (
        id TEXT PRIMARY KEY,
        worldId TEXT,
        factionId TEXT,
        person TEXT,
        updatedAt TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_world_people_world_faction
        ON world_people(worldId, factionId);
    `);
  }

  rowToPerson(row) {
    if (!row) return null;
    return normalizePerson(parseJson(row.person, { id: row.id, factionId: row.factionId }));
  }

  getPerson(id) {
    const row = this.db.prepare('SELECT * FROM world_people WHERE id = ?').get(String(id || ''));
    return this.rowToPerson(row);
  }

  getAllPeople(worldId = this.worldId) {
    const rows = this.db.prepare('SELECT * FROM world_people WHERE worldId = ?').all(worldId);
    return rows.map((row) => this.rowToPerson(row)).filter(Boolean);
  }

  // AI-faction officers for a given faction.
  getPeopleByFaction(factionId, worldId = this.worldId) {
    const rows = this.db.prepare('SELECT * FROM world_people WHERE worldId = ? AND factionId = ?')
      .all(worldId, String(factionId || ''));
    return rows.map((row) => this.rowToPerson(row)).filter(Boolean);
  }

  // 在野武将: people with no faction (factionId null) — the recruitment pool.
  getRoninPeople(worldId = this.worldId) {
    const rows = this.db.prepare('SELECT * FROM world_people WHERE worldId = ? AND factionId IS NULL').all(worldId);
    return rows.map((row) => this.rowToPerson(row)).filter(Boolean);
  }

  // Insert or replace a world person. Player-owned people must NOT be written here (they live in
  // game_states.famousPeople); guard against it so the shared table stays world-authored only.
  upsertPerson(person, now = null) {
    const normalized = normalizePerson(person);
    if (!normalized.id) throw new Error('WorldPeopleRepository.upsertPerson: person.id required');
    if (normalized.factionId && factionCore.isPlayerFaction(normalized.factionId)) {
      throw new Error('WorldPeopleRepository.upsertPerson: player-owned people live in game_states, not the shared table');
    }
    const updatedAt = now || normalized.updatedAt || null;
    normalized.updatedAt = updatedAt;
    this.db.prepare(`
      INSERT INTO world_people (id, worldId, factionId, person, updatedAt)
      VALUES (@id, @worldId, @factionId, @person, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        worldId = excluded.worldId,
        factionId = excluded.factionId,
        person = excluded.person,
        updatedAt = excluded.updatedAt
    `).run({
      id: normalized.id,
      worldId: this.worldId,
      factionId: normalized.factionId || null,
      person: JSON.stringify(normalized),
      updatedAt,
    });
    return normalized;
  }

  deletePerson(id) {
    this.db.prepare('DELETE FROM world_people WHERE id = ?').run(String(id || ''));
  }
}

module.exports = { WorldPeopleRepository, normalizePerson };
