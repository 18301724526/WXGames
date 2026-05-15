class GameStateRepository {
  constructor(db) {
    this.db = db;
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        playerId TEXT PRIMARY KEY,
        deviceId TEXT UNIQUE,
        token TEXT,
        createdAt TEXT,
        lastActiveAt TEXT
      );
      CREATE TABLE IF NOT EXISTS game_states (
        playerId TEXT PRIMARY KEY,
        resources TEXT,
        buildings TEXT,
        population TEXT,
        techs TEXT,
        techEffects TEXT,
        currentEra INTEGER,
        eraHistory TEXT,
        happiness INTEGER,
        gameDay INTEGER,
        eventQueue TEXT,
        eventHistory TEXT,
        offlineSnapshot TEXT,
        offlineEventLog TEXT,
        negativeStreak INTEGER,
        lastEventAt TEXT,
        tutorial TEXT,
        updatedAt TEXT
      );
    `);

    const columns = this.db.prepare("PRAGMA table_info(game_states)").all();
    if (!columns.some((column) => column.name === 'tutorial')) {
      this.db.prepare('ALTER TABLE game_states ADD COLUMN tutorial TEXT').run();
    }
  }

  findByPlayerId(playerId) {
    const row = this.db.prepare('SELECT * FROM game_states WHERE playerId = ?').get(playerId);
    if (!row) return null;
    return {
      playerId: row.playerId,
      resources: JSON.parse(row.resources || '{}'),
      buildings: JSON.parse(row.buildings || '{}'),
      population: JSON.parse(row.population || '{}'),
      techs: JSON.parse(row.techs || '{}'),
      techEffects: JSON.parse(row.techEffects || '{}'),
      currentEra: row.currentEra || 0,
      eraHistory: JSON.parse(row.eraHistory || '[]'),
      happiness: row.happiness || 100,
      gameDay: row.gameDay || 1,
      eventQueue: JSON.parse(row.eventQueue || '[]'),
      eventHistory: JSON.parse(row.eventHistory || '[]'),
      offlineSnapshot: JSON.parse(row.offlineSnapshot || '{}'),
      offlineEventLog: JSON.parse(row.offlineEventLog || '[]'),
      negativeStreak: row.negativeStreak || 0,
      lastEventAt: row.lastEventAt ? Number(row.lastEventAt) || 0 : 0,
      tutorial: row.tutorial ? JSON.parse(row.tutorial) : null,
      updatedAt: row.updatedAt,
    };
  }

  findAll() {
    const rows = this.db.prepare(`
      SELECT game_states.playerId
      FROM game_states
      INNER JOIN players ON players.playerId = game_states.playerId
    `).all();
    return rows.map((row) => this.findByPlayerId(row.playerId)).filter(Boolean);
  }

  save(gameState) {
    this.db.prepare(`
      INSERT OR REPLACE INTO game_states (
        playerId, resources, buildings, population, techs, techEffects, currentEra,
        eraHistory, happiness, gameDay, eventQueue, eventHistory, offlineSnapshot,
        offlineEventLog, negativeStreak, lastEventAt, tutorial, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      gameState.playerId,
      JSON.stringify(gameState.resources || {}),
      JSON.stringify(gameState.buildings || {}),
      JSON.stringify(gameState.population || {}),
      JSON.stringify(gameState.techs || {}),
      JSON.stringify(gameState.techEffects || {}),
      gameState.currentEra || 0,
      JSON.stringify(gameState.eraHistory || []),
      gameState.happiness || 100,
      gameState.gameDay || 1,
      JSON.stringify(gameState.eventQueue || []),
      JSON.stringify(gameState.eventHistory || []),
      JSON.stringify(gameState.offlineSnapshot || {}),
      JSON.stringify(gameState.offlineEventLog || []),
      gameState.negativeStreak || 0,
      gameState.lastEventAt || 0,
      JSON.stringify(gameState.tutorial || {}),
      new Date().toISOString(),
    );
  }

  touchPlayerActiveAt(playerId) {
    this.db.prepare('UPDATE players SET lastActiveAt = ? WHERE playerId = ?').run(new Date().toISOString(), playerId);
  }
}

module.exports = GameStateRepository;
